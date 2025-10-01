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
    const gameId = init.gameId;
    let last_timer = () => null;

    if (typeof gameId === 'undefined') {
        console.error('Spectator mode: Game ID is not defined!');
        return;
    }

    const board = new Board('#Board', {});
    window.board = board;
    let movesHistoryManager = new MovesHistoryManager(board);

    if (init.initialGrid) {
        board.setState(init.initialGrid);
    }

    const socket = io();

    socket.on('connect', () => {
        console.log('Socket.IO connected as spectator. Joining game room:', gameId);
        socket.emit('join', { game_id: gameId });
    });

    socket.on('update_state', (state) => {
        console.log('Received new game state:', state);

        // Сохраняем последнее состояние для навигатора
        window.lastGameState = state;

        // Обновляем историю ходов
        if (state.pgn && movesHistoryManager) {
            movesHistoryManager.setMoves(state.pgn);
        }

        let cur_state = fen2grid(state.fen)
        let nextMark = cur_state[0], activeMini = cur_state[1], grid = cur_state[2];
        console.log(grid);

        // Обновляем доску
        if (!(movesHistoryManager && movesHistoryManager.isViewingHistory) && grid) {
            board.setState(grid, state.pgn);
            board.setActiveMini(-2);
        } else {
            console.log("DON't UPDATE BOARD", movesHistoryManager.isViewingHistory);
        }

        // Обновляем статус игры (кто ходит, игра окончена и т.д.)
        // const nextMark = state.step === 0 ? 'X' : 'O';
        if (state.status) {
            console.log("state.status = ", state.status);
            let statusText = '';
            if (state.status === 'active') {
                statusText = `Ход игрока: ${nextMark}`;
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
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO disconnected.');
    });
});