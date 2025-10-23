function join_game(game_id) {
    window.location.replace(`/join_game/${game_id}`);
}

function join_spectator(game_id) {
    window.location.replace(`/game/${game_id}`);
}
