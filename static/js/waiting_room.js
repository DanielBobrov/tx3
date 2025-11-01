document.addEventListener('DOMContentLoaded', () => {
    const gameId = window.INIT?.gameId;

    if (typeof gameId === 'undefined') {
        console.error('Game ID is not defined!');
        return;
    }

    const socket = io();

    socket.on('connect', () => {
        console.log('Socket.IO connected! Joining waiting room for game:', gameId);
        socket.emit('join', { game_id: gameId });
    });

    socket.on('update_state', (state) => {
        console.log('Received game state update:', state);

        if (state.status === 'active') {
            console.log('Game has started! Reloading page...');

            const statusElement = document.getElementById('waitingStatus');
            if (statusElement) {
                statusElement.textContent = window.i18n.t('waiting_room.opponent_found');
            }

            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO disconnected.');
    });
});