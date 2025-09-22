// moves_history.js
class MoveNavigator {
    constructor(board) {
        this.board = board;
        this.moves = [];
        this.currentMoveIndex = -1;
        this.isViewingHistory = false;
        this.gameId = window.INIT?.gameId;

        this.initControls();
        this.initMovesList();
    }

    initControls() {
        document.getElementById('navFirst').addEventListener('click', () => this.goToMove(0));
        document.getElementById('navPrev').addEventListener('click', () => this.goToMove(this.currentMoveIndex - 1));
        document.getElementById('navNext').addEventListener('click', () => this.goToMove(this.currentMoveIndex + 1));
        document.getElementById('navLast').addEventListener('click', () => this.goToMove(this.moves.length - 1));

        addEventListener("keydown", (event) => {
                 if (event.key === "ArrowLeft")  { this.goToMove(this.currentMoveIndex - 1) }
            else if (event.key === "ArrowRight") { this.goToMove(this.currentMoveIndex + 1) }
            else if (event.key === "ArrowUp")    { this.goToMove(0) }
            else if (event.key === "ArrowDown")  { this.goToMove(this.moves.length - 1) }
        });

        // Изначально скрываем индикатор просмотра
        document.getElementById('viewingIndicator').style.display = 'none';
    }

    initMovesList() {
        this.movesListEl = document.getElementById('movesList');
    }

    setMoves(movesData) {
        // Преобразуем данные в массив ходов
        if (typeof movesData === 'string') {
            // Если это строка цифр, преобразуем в массив
            this.moves = movesData.split('').map(n => parseInt(n));
        } else if (Array.isArray(movesData)) {
            this.moves = movesData;
        } else {
            this.moves = [];
        }

        this.currentMoveIndex = this.moves.length - 1;
        this.updateMovesList();
        this.updateNavigationButtons();
    }

    goToMove(index) {
        if (index < 0 || index >= this.moves.length) return;

        this.currentMoveIndex = index;
        this.isViewingHistory = index < this.moves.length - 1;

        // Восстанавливаем состояние доски до указанного хода
        this.reconstructBoardState(index);

        // Обновляем UI
        this.updateViewingIndicator();
        this.updateNavigationButtons();
        this.highlightCurrentMove();

        // Блокируем доску если просматриваем историю
        if (this.isViewingHistory) {
            this.board.setActiveMini(-2); // Блокируем все мини-доски
        } else {
            // Возвращаем актуальное состояние активной мини-доски
            // Это должно быть обновлено из последнего состояния от сервера
            if (window.lastGameState && typeof window.lastGameState.active_mini === 'number' && (window.lastGameState.step === 0 ? 'X' : 'O') === window.INIT.myMark) {
                this.board.setActiveMini(window.lastGameState.active_mini);
            }
        }
    }

    reconstructBoardState(moveIndex) {
        // Очищаем доску
        this.board.clear();

        // Отслеживаем заполненные доски для очистки
        const boardCounts = new Array(9).fill(0);
        const boardStates = Array(9).fill(null).map(() => Array(9).fill(''));
        let currentMark = 'X'; // Первый ход всегда X
        let activeMini = 4; // Первый ход всегда в центральной доске
        let gameWon = false;

        // Применяем все ходы до указанного индекса
        for (let i = 0; i <= moveIndex; i++) {
            const cellIndex = this.moves[i];

            // Вычисляем координаты
            const miniRow = Math.floor(activeMini / 3);
            const miniCol = activeMini % 3;
            const cellRow = Math.floor(cellIndex / 3);
            const cellCol = cellIndex % 3;

            // Глобальные координаты
            const globalRow = miniRow * 3 + cellRow;
            const globalCol = miniCol * 3 + cellCol;

            // Ставим метку
            this.board.setMark(globalRow, globalCol, currentMark);
            boardStates[activeMini][cellIndex] = currentMark;

            // Увеличиваем счетчик для текущей мини-доски
            boardCounts[activeMini]++;

            // Проверяем победу в мини-доске
            const miniWinner = this.checkMiniWin(boardStates[activeMini]);

            // Если доска заполнена (9 клеток) И нет победителя, очищаем её
            if (boardCounts[activeMini] === 9 && !miniWinner) {
                this.clearMiniBoard(activeMini);
                boardCounts[activeMini] = 0;
                boardStates[activeMini] = Array(9).fill('');
            }


            // Подсвечиваем последний ход
            if (i === moveIndex) {
                this.board.highlightLast(globalRow, globalCol);
            }

            // Следующий ход будет в доске с номером cellIndex
            activeMini = cellIndex;

            // Меняем игрока
            currentMark = currentMark === 'X' ? 'O' : 'X';
        }
    }

    checkMiniWin(miniBoard) {
        // Проверяем выигрышные комбинации в мини-доске
        const winPatterns = [[0, 1, 2], [3, 4, 5], [6, 7, 8], // горизонтали
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // вертикали
            [0, 4, 8], [2, 4, 6]             // диагонали
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (miniBoard[a] && miniBoard[a] === miniBoard[b] && miniBoard[a] === miniBoard[c]) {
                return miniBoard[a]; // Возвращаем победителя ('X' или 'O')
            }
        }

        return null; // Нет победителя
    }

    clearMiniBoard(miniIndex) {
        const miniRow = Math.floor(miniIndex / 3);
        const miniCol = miniIndex % 3;

        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const globalRow = miniRow * 3 + r;
                const globalCol = miniCol * 3 + c;
                this.board.setMark(globalRow, globalCol, '');
            }
        }
    }

    updateMovesList() {
        this.movesListEl.innerHTML = '';

        let currentMark = 'X';
        let activeMini = 4;
        let currentPair = null;

        this.moves.forEach((move, index) => {
            const isWhiteMove = index % 2 === 0;

            // Создаем новую пару для хода X
            if (isWhiteMove) {
                currentPair = document.createElement('div');
                currentPair.className = 'move-pair';

                const moveNum = Math.floor(index / 2) + 1;
                const moveNumEl = document.createElement('span');
                moveNumEl.className = 'move-number';
                moveNumEl.textContent = `${moveNum}.`;
                currentPair.appendChild(moveNumEl);

                this.movesListEl.appendChild(currentPair);
            }

            // Создаем элемент хода
            const moveEl = document.createElement('div');
            moveEl.className = 'move-item';
            moveEl.dataset.moveIndex = index;

            // Добавляем информацию о ходе
            const cellIndex = move;
            const boardLabel = this.getBoardLabel(activeMini);
            const cellLabel = this.getCellLabel(cellIndex);

            moveEl.innerHTML = `<span class="move-notation">${currentMark}: ${boardLabel}${cellLabel}</span>`;

            // Обработчик клика
            moveEl.addEventListener('click', () => this.goToMove(index));

            // Добавляем ход в текущую пару
            if (currentPair) {
                currentPair.appendChild(moveEl);
            }
            moveEl.scrollIntoView();

            // Обновляем для следующего хода
            activeMini = cellIndex;
            currentMark = currentMark === 'X' ? 'O' : 'X';
        });
    }

    getBoardLabel(boardIndex) {
        // const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
        // return labels[boardIndex] || '';
        return ""
    }

    getCellLabel(cellIndex) {
        return (cellIndex + 1).toString();
    }

    highlightCurrentMove() {
        // Убираем подсветку со всех ходов
        this.movesListEl.querySelectorAll('.move-item').forEach(el => {
            el.classList.remove('current');
        });

        // Подсвечиваем текущий ход
        const currentMoveEl = this.movesListEl.querySelector(`[data-move-index="${this.currentMoveIndex}"]`);
        if (currentMoveEl) {
            currentMoveEl.classList.add('current');
            // Прокручиваем к текущему ходу
            currentMoveEl.scrollIntoView({behavior: 'smooth', block: 'nearest'});
        }
    }

    updateViewingIndicator() {
        const indicator = document.getElementById('viewingIndicator');
        const moveNumSpan = document.getElementById('viewingMoveNum');

        if (this.isViewingHistory) {
            indicator.style.display = 'block';
            moveNumSpan.textContent = `${this.currentMoveIndex + 1} из ${this.moves.length}`;
        } else {
            indicator.style.display = 'none';
        }
    }

    updateNavigationButtons() {
        document.getElementById('navFirst').disabled = this.currentMoveIndex <= 0;
        document.getElementById('navPrev').disabled = this.currentMoveIndex <= 0;
        document.getElementById('navNext').disabled = this.currentMoveIndex >= this.moves.length - 1;
        document.getElementById('navLast').disabled = this.currentMoveIndex >= this.moves.length - 1;
    }
}

// Экспортируем для использования в ttt_game.js
window.MoveNavigator = MoveNavigator;
