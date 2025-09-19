document.addEventListener('DOMContentLoaded', () => {
    const init = window.INIT || {};
    const gameId = init.gameId;

    if (typeof gameId === 'undefined') {
        console.error('Spectator mode: Game ID is not defined!');
        return;
    }

    const board = new TTTBoard('#tttBoard', {});

    if (init.initialGrid) {
        board.setState(init.initialGrid);
    }

    const socket = io();

    socket.on('connect', () => {
        console.log('Socket.IO connected as spectator. Joining game room:', gameId);
        socket.emit('join', { game_id: gameId });
    });

    socket.on('update_state', (state) => {
        console.log('Spectator received new game state:', state);

        if (state.board) {
            board.setState(state.board);
        }

        const statusElement = document.getElementById('gameStatus');
        if (statusElement) {
            let statusText = '';
            if (state.status === 'active') {
                const nextMark = state.step === 0 ? 'X' : 'O';
                statusText = `Сейчас ходит игрок: ${nextMark}`;
            } else if (state.status === 'ended') {
                window.location.reload();
            } else {
                statusText = `Статус игры: ${state.status}`;
            }
            statusElement.textContent = statusText;
        }
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO disconnected.');
    });
});