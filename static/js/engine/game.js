export class UltimateTicTacToe {
    constructor() {
        this.reset();
    }

    reset() {
        // 9 малых досок, каждая 3x3. null - пусто, 'X' или 'O'.
        this.boards = Array(9).fill(null).map(() => Array(9).fill(null));
        // Статус каждой из 9 досок (кто победил на ней)
        this.boardWinners = Array(9).fill(null);
        // Текущий игрок: 'X' или 'O'
        this.currentPlayer = 'X';
        // Индекс доски, в которую нужно делать следующий ход (0-8). -1 означает любую доску.
        this.activeBoard = -1;
    }

    /**
     * Проверяет победителя на одной малой доске 3x3.
     * @param {Array} board - Массив из 9 клеток.
     * @returns {'X' | 'O' | null} - Победитель или null.
     */
    checkSmallBoardWinner(board) {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Горизонтали
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Вертикали
            [0, 4, 8], [2, 4, 6]  // Диагонали
        ];
        for (const line of lines) {
            const [a, b, c] = line;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a];
            }
        }
        return null;
    }

    /**
     * Делает ход в указанную клетку.
     * @param {number} boardIndex - Индекс малой доски (0-8).
     * @param {number} cellIndex - Индекс клетки внутри доски (0-8).
     * @returns {boolean} - true, если ход успешен, иначе false.
     */
    makeMove(boardIndex, cellIndex) {
        // Проверяем, можно ли сделать ход
        if (this.activeBoard !== -1 && this.activeBoard !== boardIndex) return false;
        if (this.boards[boardIndex][cellIndex] || this.boardWinners[boardIndex]) return false;

        this.boards[boardIndex][cellIndex] = this.currentPlayer;

        // Проверяем, не появился ли победитель на этой малой доске
        const winner = this.checkSmallBoardWinner(this.boards[boardIndex]);
        if (winner) {
            this.boardWinners[boardIndex] = winner;
        }

        // Правило очистки: если доска заполнена и на ней нет победителя
        const isBoardFull = this.boards[boardIndex].every(cell => cell !== null);
        if (isBoardFull && !this.boardWinners[boardIndex]) {
            this.boards[boardIndex].fill(null);
        }

        // Определяем следующую активную доску
        // Если следующая доска уже выиграна или заполнена, игрок может ходить куда угодно
        this.activeBoard = (this.boardWinners[cellIndex] || this.boards[cellIndex].every(c => c !== null))
            ? -1
            : cellIndex;

        // Меняем игрока
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        return true;
    }

    /**
     * Проверяет, завершена ли игра (есть ли победитель на одной из малых досок).
     * @returns {boolean}
     */
    isGameOver() {
        return this.boardWinners.some(winner => winner !== null);
    }

    /**
     * Возвращает доступные ходы для текущего игрока.
     * @returns {Array<{boardIndex: number, cellIndex: number}>}
     */
    getValidMoves() {
        const moves = [];
        if (this.isGameOver()) return moves;

        const boardsToPlay = (this.activeBoard === -1)
            ? [0, 1, 2, 3, 4, 5, 6, 7, 8]
            : [this.activeBoard];

        for (const boardIndex of boardsToPlay) {
            if (this.boardWinners[boardIndex]) continue;
            for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
                if (!this.boards[boardIndex][cellIndex]) {
                    moves.push({ boardIndex, cellIndex });
                }
            }
        }
        return moves;
    }
}