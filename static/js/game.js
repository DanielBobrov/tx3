function fen2grid(fen) {
    let curMark = null;
    let mark = fen[0] === '0' ? 'X' : 'O';
    let activeMini = parseInt(fen[1]);
    let grid = [];
    for (let i = 0; i < 9; i++) {
        grid.push([]);
        for (let j = 0; j < 9; j++) {
            curMark = fen[9 * i + j + 2]
            if (curMark === "0") {
                curMark = null;
            } else if (curMark === "1") {
                curMark = "X";
            } else {
                curMark = "O";
            }
            grid[i].push(curMark);
        }
    }
    return [mark, activeMini, grid];
}


document.addEventListener('DOMContentLoaded', () => {
    const init = window.INIT || {};
    var last_timer = () => null;
    let moveNavigator = null;

    const socket = io();
    window.GAME_SOCKET = socket; // Для удобства отладки в консоли

    let addTimeBtn = document.getElementById("addTimeBtn");
    if (addTimeBtn !== null) addTimeBtn.addEventListener("click", () => {
        console.log("ADD TIME", {game_id: init.gameId, player_id: init.me});
        socket.emit("add_time", {game_id: init.gameId, player_id: init.me})
    });

    const board = new Board('#Board', {
        myMark: init.myMark || 'X',
        activeMini: typeof init.activeMini === 'number' ? init.activeMini : -1,
        onMove: async ({row, col, mini, mark}) => {
            console.log(`Sending move: row=${row}, col=${col}`);
            socket.emit('move', {
                game_id: init.gameId,
                row: row,
                col: col
            });
        }
    });
    window.board = board;
    moveNavigator = new MovesHistoryManager(board);

    if (init.initialGrid) board.setState(init.initialGrid, init.initialPgn);

    socket.on('connect', () => {
        console.log('Socket.IO connected!');
        console.log(init);
        socket.emit('join', {game_id: init.gameId});
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        if (reason === 'io server disconnect') {
            // сервер принудительно отключил, переподключаемся вручную
            socket.connect();
        }
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts');
    });
    socket.on('connect_error', (error) => console.log('Connection error:', error));

    socket.on('update_state', (state) => {
        console.log('Received new game state:', state);

        // Сохраняем последнее состояние для навигатора
        window.lastGameState = state;

        // Обновляем историю ходов
        if (state.pgn && moveNavigator) {
            moveNavigator.setMoves(state.pgn);
        }

        // if (state.fen) {
        //     window.INIT.fen = state.fen;
        // }

        // // Если мы просматриваем историю, не обновляем доску автоматически
        // if (moveNavigator && moveNavigator.isViewingHistory) {
        //     return;
        // }
        let cur_state = fen2grid(state.fen)
        let nextMark = cur_state[0], activeMini = cur_state[1], grid = cur_state[2];
        console.log(grid);

        // Обновляем доску
        if (!(moveNavigator && moveNavigator.isViewingHistory) && grid) {
            board.setState(grid, state.pgn);
        } else {
            console.log("DON't UPDATE BOARD", moveNavigator.isViewingHistory);
        }

        console.log("ACTIVE MINI", activeMini);
        console.log("NEXT MARK", fen2grid(state.fen));

        // Обновляем статус игры (кто ходит, игра окончена и т.д.)
        // const nextMark = state.step === 0 ? 'X' : 'O';
        if (state.status) {
            console.log("state.status = ", state.status);
            let statusText = '';
            if (state.status === 'active') {
                statusText = `Ход игрока: ${nextMark}`;
                if (nextMark !== init.myMark) {
                    board.setActiveMini(-2);
                } else {
                    board.setActiveMini(activeMini);
                }
            } else if (state.status === 'ended') {
                window.location.reload();
            } else {
                statusText = state.status;
            }
            document.getElementById('gameStatus').textContent = statusText;

            try {
                document.getElementById("clockX").textContent = formatTime(state.left_time[0] * 1000);
                document.getElementById("clockO").textContent = formatTime(state.left_time[1] * 1000);


                last_timer();
                last_timer = createTimer(state.left_time[state.step], state.last_move_time * 1000, document.getElementById("clock" + nextMark))
            } catch (e) {
            }
        }

        // Можно добавить другую логику: подсветку активного мини-поля и т.д.
        // if (typeof state.activeMini === 'number') board.setActiveMini(state.activeMini);
    });

    document.getElementById("resign-btn").addEventListener("click", () => {
        console.log("RESIGN");
        socket.emit("resign", {player_id: init.me, game_id: init.gameId});
    });
});

function isTouchDevice() {
    return (('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0));
}

if (!isTouchDevice()) {
    console.log("DESKTOP");
    document.write('<script src="/static/js/vim.js"></script>');
} else {
    console.log("MOBILE");
}

function swapPlayers() {
    let player1 = document.querySelector(".player.top");
    let player2 = document.querySelector(".player.bottom");

    let h1 = player1.innerHTML;
    let h2 = player2.innerHTML;

    player1.innerHTML = h2;
    player2.innerHTML = h1;
}