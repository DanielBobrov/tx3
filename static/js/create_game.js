// Функции для работы с модальным окном
function openModal(event) {
    event.preventDefault();
    document.getElementById('createGameModal').classList.add('show');
}

function closeModal() {
    document.getElementById('createGameModal').classList.remove('show');
}

// Функция для переключения видимости настроек времени
function toggleTimerSettings() {
    const useTimer = document.getElementById('useTimer').checked;
    const timerSettings = document.getElementById('timerSettings');

    if (useTimer) {
        timerSettings.classList.remove('hidden');
    } else {
        timerSettings.classList.add('hidden');
    }
}

// Закрытие модального окна при клике вне его
document.getElementById('createGameModal').addEventListener('click', function(event) {
    if (event.target === this) {
        closeModal();
    }
});

// Обработка отправки формы
document.getElementById('createGameForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const useTimer = document.getElementById('useTimer').checked;
    const useRandomStart = document.getElementById('randomStart').checked;
    const pieceSelection = document.querySelector('input[name="piece"]:checked').value;

    // Определяем, какую фигуру выбрал игрок
    let playerPiece = pieceSelection;
    if (pieceSelection === 'random') {
        playerPiece = Math.random() < 0.5 ? 'X' : 'O';
    }

    // Подготавливаем данные для отправки
    const gameData = {
        player_piece: playerPiece,
        use_time: useTimer,
        use_random_start: useRandomStart
    };

    // Добавляем настройки времени только если таймер включен
    if (useTimer) {
        gameData.duration = parseInt(document.getElementById('gameDuration').value);
        gameData.addition = parseInt(document.getElementById('moveAddition').value);
    }

    try {
        const response = await fetch('/create_game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(gameData)
        });

        if (response.ok) {
            const data = await response.json();
            // Перенаправляем на страницу игры
            window.location.href = `/game/${data.game_id}`;
        } else {
            const error = await response.json();
            alert(error.message || window.i18n.t('create_game.error'));
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert(window.i18n.t('create_game.error_occurred'));
    }
});

function showVal(input) {
    let label = document.getElementsByClassName(input.id + "Value")[0];
    label.textContent = input.value;
}