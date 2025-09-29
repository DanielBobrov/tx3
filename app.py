import os
import random
from functools import wraps

import dotenv
import flask
from flask import session, redirect, render_template, request
from flask_socketio import SocketIO, join_room, emit

from database import *
from utils import *

dotenv.load_dotenv()
app = flask.Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
app.config["SESSION_VERSION"] = datetime.datetime.now().timestamp()

# async_mode="eventlet" важен для работы в асинхронном режиме
socketio = SocketIO(app, ping_timeout=1, ping_interval=1, async_mode="eventlet",
                    # logger=True,          # для отладки
                    #     engineio_logger=True  # детальные логи
                    )

# @app.before_request
# def check_session_version():
#     if "version" not in session or session["version"] != app.config["SESSION_VERSION"]:
#         session.clear()
#         session["version"] = app.config["SESSION_VERSION"]


games: Database[Game] = Database(Game, "games.db", "games")
active_games = games
timers: dict[int: ExtendableTimer] = {}
players: Database[Player] = Database(Player, "players.db", "players")


def create_game(player_0: int, player_piece: str, use_time: bool = False, duration: int = 0,
                addition: int = 0, random_start=False) -> Game:
    game_players = [None, None]
    game_players[player_piece == "O"] = player_0
    game = Game(
        id=len(games),
        players=game_players,
        use_time=use_time,
        left_time=[duration * 60, duration * 60],
        time_addition=addition,
        last_move_time=-1,
    )
    if random_start:
        grid = generate_random_start_position()
        game.grid = grid
    game_id = games.append(game)
    game.id = game_id
    games[game_id] = game
    return game


def generate_random_start_position():
    # Создаем массив 9x9 заполненный нулями
    board = [[None for _ in range(9)] for _ in range(9)]

    # Проходим по каждому квадрату 3x3
    for block_row in range(3):
        for block_col in range(3):
            # Определяем начальные координаты квадрата
            start_row = block_row * 3
            start_col = block_col * 3

            # Генерируем случайные позиции для 1 и 2 внутри квадрата
            positions = list(range(9))  # 0-8 для 9 клеток в квадрате
            random.shuffle(positions)

            # Берем первые две позиции
            pos1 = positions[0]
            pos2 = positions[1]

            # Преобразуем линейную позицию в координаты внутри квадрата
            row1, col1 = pos1 // 3, pos1 % 3
            row2, col2 = pos2 // 3, pos2 % 3

            # Размещаем 1 и 2
            board[start_row + row1][start_col + col1] = "X"
            board[start_row + row2][start_col + col2] = "O"

    print("generated random start position:", board)

    return board


def auth_player(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if session.get("player_id") is None:
            player = Player(None, None)
            player_id = players.append(player)
            session["player_id"] = player_id
            print(f"AUTH NEW PLAYER = {players[player_id]}")
        return function(*args, **kwargs)

    return wrapper


def desk_is_full(desk):
    for i in range(3):
        for j in range(3):
            if desk[i][j] is None:
                return False
    return True


def player_wins(desk):
    lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
    line_desk = desk[0] + desk[1] + desk[2]
    for [a, b, c] in lines:
        if line_desk[a] == line_desk[b] == line_desk[c] is not None:
            return True
    return False


def make_move(grid, row, col, mark):
    grid[row][col] = mark
    desk = [
        [grid[i][j] for j in range((col // 3) * 3, (col // 3 + 1) * 3)]
        for i in range((row // 3) * 3, (row // 3 + 1) * 3)
    ]
    if player_wins(desk):
        return grid, True
    if desk_is_full(desk):
        for i in range((row // 3) * 3, (row // 3 + 1) * 3):
            for j in range((col // 3) * 3, (col // 3 + 1) * 3):
                grid[i][j] = None
    return grid, False


def broadcast_game_state(game_id: int):
    """Отправляет полное состояние игры всем в комнате."""
    game = active_games[game_id]
    # "to" указывает, в какую комнату отправлять событие
    socketio.emit("update_state", game.get_state_for_client(), to=f"game-{game_id}")
    # print(f"Broadcasted game state: {game.get_state_for_client()}")


def lose_game(game: Game, loser_mark):
    game.status = ENDED
    game.winner = (loser_mark + 1) % 2
    # del active_games[game.game_id]
    if game.use_time:
        try:
            timers[game.id].cancel()
        finally:
            del timers[game.id]

    games[game.id] = game
    broadcast_game_state(game.id)


def lose_by_time(game, player_mark):
    game.left_time[player_mark] = 0
    lose_game(game, player_mark)


@app.context_processor
def inject_variables():
    return dict(players=players, games=games, player_id=session.get("player_id"))


@socketio.on("add_time")
@auth_player
def on_add_time(data):
    game_id = data.get("game_id")
    player_id = data.get("player_id")
    print(1)
    if player_id != session.get("player_id"):
        return {"error": 401}
    if timers.get(game_id) is None:
        return {"error": 405}
    if player_id not in games[game_id].players:
        return {"error": 403}
    game = games[game_id]
    player_side = games[game_id].players.index(player_id)
    other_player_side = (player_side + 1) % 2
    game.left_time[other_player_side] += 15
    games[game_id] = game
    if game.step == other_player_side:
        print("ADDING TIME")
        timer: ExtendableTimer = timers.get(game_id)
        print(timer.start_time + timer.interval)
        timer.extend(15)
    broadcast_game_state(game_id)


@socketio.on("join")
@auth_player
def on_join(data):
    """Клиент присоединяется к комнате игры."""
    game_id = int(data.get("game_id"))
    game = active_games[game_id]
    if game is None:
        return
    room_name = f"game-{game_id}"
    join_room(room_name)
    # Сразу после подключения отправим ему актуальное состояние
    emit("update_state", game.get_state_for_client())


def validate_move(game: Game, move):
    active_mini = game.active_mini
    if not (active_mini // 3 * 3 <= move[0] < active_mini // 3 * 3 + 3 and active_mini % 3 * 3 <= move[
        1] < active_mini % 3 * 3 + 3):
        return False
    return True


@socketio.on("resign")
@auth_player
def on_resign_fn(data):
    player_id = data.get("player_id")
    if player_id != session.get("player_id"):
        return {"error": 403}
    game_id = data.get("game_id")
    game = games[game_id]
    if game is None:
        return {"error": 403}
    if player_id not in game.players:
        return {"error": 403}
    lose_game(game, player_id)


@socketio.on("move")
@auth_player
def on_move_fn(data):
    """Обработка хода, полученного через WebSocket."""
    game_id, row, col = int(data.get("game_id")), data.get("row"), data.get("col")
    player = session.get("player_id")

    try:
        game: Game = active_games[game_id]
    except:
        print(f"Game {game_id} has no active game")
        for game in active_games:
            print(game)
        raise
    if game is None or game.status != ACTIVE or player not in game.players: return {"error": 400}

    player_mark = 0 if game.players[0] == player else 1
    other_player_mark = (player_mark + 1) % 2
    if game.step != player_mark:
        # Это не его ход
        return {"error": 400}

    if game.grid[row][col] is not None:
        # Клетка занята
        return {"error": 400}

    if not validate_move(game, (row, col)):
        return {"error": 400}

    if game.use_time:
        cur_time = datetime.datetime.now()

        timer: ExtendableTimer = timers[game_id]
        timer.cancel()

        game.left_time[player_mark] -= (cur_time - game.last_move_time).total_seconds()
        game.last_move_time = cur_time

        if game.left_time[player_mark] <= 0:
            return lose_game(game, player_mark)

        timers[game_id] = ExtendableTimer(game.left_time[other_player_mark], lose_by_time, [game, other_player_mark])
        timers[game_id].start()

    grid, wins = make_move(game.grid, row, col, ["X", "O"][player_mark])
    game.add_step(3 * (row % 3) + (col % 3))
    game.grid = grid
    game.left_time[player_mark] += game.time_addition

    if wins:
        return lose_game(game, other_player_mark)

    games[game_id] = game
    broadcast_game_state(game_id)


@app.route("/")
@auth_player
def home():
    last_games = list(games)[::-1]
    if len(last_games) > 5:
        last_games = last_games[:5]
    return render_template("index.html", last_games=last_games, player=players[session.get("player_id")])


@app.route("/analysis")
@auth_player
def analysis():
    return render_template("analysis.html", game=games[-3], player=players[session.get("player_id")])


@app.route("/all_games")
@auth_player
def on_all_games_fn():
    last_games = games[::-1]
    return render_template("all_games.html", last_games=last_games, player=players[session.get("player_id")])


@app.route("/logout", methods=["GET"])
@auth_player
def on_get_logout_fn():
    session["player_id"] = None
    return redirect("/")


@app.route("/login", methods=["GET"])
@auth_player
def on_get_login_fn():
    return render_template("login.html")


@app.route("/login", methods=["POST"])
@auth_player
def on_post_login_fn():
    player = players.get_by("username", request.json.get("username"))[0]
    if player is None or player.password != request.json.get("password"):
        return {"error": "invalid_credentials"}, 401
    print(f"Logged new {player = }")
    session["player_id"] = player.id
    return "200"


@app.route("/signup", methods=["GET"])
@auth_player
def on_get_signup_fn():
    return render_template("login.html", registration=True)


@app.route("/signup", methods=["POST"])
@auth_player
def on_post_signup_fn():
    username: str = request.json.get("username")
    if players.get_by("username", username):
        return {"error": "username_taken"}, 401
    if not isinstance(username, str) or len(username) > 30 or len(username) < 3:
        return {"error": "username is invalid"}, 401
    password: str = request.json.get("password")
    if not isinstance(password, str) or len(password) > 30 or len(password) < 3:
        return {"error": "password is invalid"}, 401
    for i in username:
        if i.isspace() or i == "ㅤ":
            return {"error": "username is invalid"}, 401
    player = Player(username=request.json.get("username"), password=password,
                    id=session.get("player_id"))
    players[session.get("player_id")] = player
    return "200"


@app.route("/create_game", methods=["POST"])
@auth_player
def on_create_game_fn():
    player_id = session.get("player_id")
    player = players[player_id]
    game = create_game(
        player_0=player_id,
        use_time=request.json.get("use_time"),
        duration=request.json.get("duration", 0),
        addition=request.json.get("addition", 0),
        player_piece=request.json.get("player_piece"),
        random_start=request.json.get("use_random_start"),
    )
    player.games.append(game.id)
    players[player_id] = player
    return {"game_id": f"{game.id}"}


@app.route("/game/<int:game_id>", methods=["GET"])
@auth_player
def on_game_fn(game_id: int):
    try:
        game: Game = games[game_id]
    except IndexError:
        return {"error": 404}
    if game is None:
        return redirect("/")
    player_id = session["player_id"]

    if game.status == ENDED:
        return render_template("ended_game.html", game=game, player=players[session.get("player_id")])

    is_player = player_id in game.players

    if game.status == ACTIVE:
        if is_player:
            return render_template("active_game.html", game=game, player=players[session.get("player_id")])
        return render_template("active_game.html", game=game, player=players[session.get("player_id")], spectator=True)

    if game.status == WAITING:
        # Если это создатель игры, то он ждет
        if is_player:
            return render_template("waiting_game.html", game=game, player=players[session.get("player_id")])

        # Если это второй игрок, он присоединяется
        if game.players[0] is None:
            game.players[0] = player_id
        else:
            game.players[1] = player_id
        player = players[player_id]
        player.games.append(game_id)
        players[player_id] = player

        game.status = ACTIVE
        games[game_id] = game
        game.last_move_time = datetime.datetime.now()

        if game.use_time:
            timers[game_id] = ExtendableTimer(game.left_time[0], lose_by_time, args=[game, 0])
            timers[game_id].start()

        active_games[game_id] = game
        socketio.start_background_task(target=broadcast_game_state, game_id=game_id)

        return redirect(f"/game/{game_id}")

    return redirect(f"/")


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
