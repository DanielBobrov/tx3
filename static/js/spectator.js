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
    let moveNavigator = new MoveNavigator(board);

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
        if (state.pgn && moveNavigator) {
            moveNavigator.setMoves(state.pgn);
        }

        // Обновляем доску
        if (!(moveNavigator && moveNavigator.isViewingHistory) && state.board) {
            board.setState(state.board, state.pgn);
            board.setActiveMini(-2);
        } else {
            console.log("DON't UPDATE BOARD", moveNavigator.isViewingHistory);
        }

        // Обновляем статус игры (кто ходит, игра окончена и т.д.)
        const nextMark = state.step === 0 ? 'X' : 'O';
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