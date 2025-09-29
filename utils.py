import dataclasses
import datetime
import threading
import time
from dataclasses import dataclass
from typing import Optional, List

WAITING, ACTIVE, ENDED = "waiting", "active", "ended"


@dataclass
class Game:
    id: int
    players: List[int]
    pgn: str = ""
    step: int = 0
    status: str = WAITING  # Предполагаю, что WAITING определена где-то в коде
    left_time: Optional[List[float]] = None
    time_addition: int = 0
    use_time: bool = False
    last_move_time: Optional[datetime.datetime] = None
    winner: Optional[str] = None
    fen: str = "04" + "0" * 81

    def add_step(self, step):
        self.pgn += str(step)
        self.step = (self.step + 1) % 2

    def __get_grid(self):
        grid = [[None for __ in range(9)] for _ in range(9)]
        for i in range(9):
            for j in range(9):
                mark = self.fen[i * 9 + j + 2]
                grid[i][j] = None if mark == "0" else "X" if mark == "1" else "O"
        return grid

    def __set_grid(self, grid):
        fen = str(self.step) + str(self.active_mini)
        for i in range(9):
            for j in range(9):
                fen += "0" if grid[i][j] is None else "1" if grid[i][j] == "X" else "2"
        self.fen = fen

    grid = property(__get_grid, __set_grid)

    @property
    def active_mini(self):
        if not self.pgn:
            return 4
        step = int(self.pgn[-1])
        return step

    def get_state_for_client(self):
        """Возвращает словарь с состоянием игры для отправки клиенту."""
        return {
            "status": self.status,
            "pgn": self.pgn,
            "fen": self.fen,
            "step": self.step,
            "players": self.players,
            "winner": self.winner,
            "left_time": [round(i, 2) for i in self.left_time],
            "last_move_time": self.last_move_time.timestamp() if self.last_move_time != -1 else None,
            "active_mini": self.active_mini
        }


@dataclasses.dataclass
class Player:
    username: str
    password: str
    id: int = None
    games: list[int] = dataclasses.field(default_factory=list)


class ExtendableTimer:
    def __init__(self, interval, function, args=None, kwargs=None):
        self.interval = interval
        self.function = function
        self.args = args if args is not None else []
        self.kwargs = kwargs if kwargs is not None else {}
        self.timer = None
        self.start_time = None

    def start(self):
        self.start_time = time.time()
        self.timer = threading.Timer(self.interval, self.function, self.args, self.kwargs)
        self.timer.start()

    def extend(self, additional_seconds):
        if self.timer and self.timer.is_alive():
            # Вычисляем сколько времени осталось
            elapsed = time.time() - self.start_time
            remaining = self.interval - elapsed

            # Отменяем текущий таймер
            self.timer.cancel()

            # Создаем новый таймер с увеличенным временем
            new_interval = remaining + additional_seconds
            self.interval = elapsed + new_interval  # Обновляем общее время
            self.timer = threading.Timer(new_interval, self.function, self.args, self.kwargs)
            self.timer.start()

    def cancel(self):
        if self.timer:
            self.timer.cancel()
