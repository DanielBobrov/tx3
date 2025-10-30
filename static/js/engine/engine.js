// js/engine.js
import { UltimateTicTacToe } from './game.js';
import { minimax } from './minimax.js';

export class GameEngine {
    constructor() {
        this.game = new UltimateTicTacToe();
    }

    /**
     * Загружает позицию из FEN-строки вашего формата.
     * @param {string} fen - Строка из 83 цифр.
     */
    loadFen(fen) {
        if (fen.length !== 83) {
            console.error("Invalid FEN length. Must be 83 digits.");
            return;
        }

        this.game.reset();

        // 1. Устанавливаем текущего игрока
        this.game.currentPlayer = fen[0] === '0' ? 'X' : 'O';

        // 2. Устанавливаем активную доску
        this.game.activeBoard = parseInt(fen[1], 10);

        // 3. Расставляем фигуры на доске
        const boardState = fen.substring(2);
        for (let k = 0; k < 81; k++) {
            const value = boardState[k];
            if (value === '0') continue; // Клетка пуста

            const globalRow = Math.floor(k / 9);
            const globalCol = k % 9;

            const boardRow = Math.floor(globalRow / 3);
            const boardCol = Math.floor(globalCol / 3);
            const boardIndex = boardRow * 3 + boardCol;

            const cellRow = globalRow % 3;
            const cellCol = globalCol % 3;
            const cellIndex = cellRow * 3 + cellCol;

            this.game.boards[boardIndex][cellIndex] = value === '1' ? 'X' : 'O';
        }

        // 4. Пересчитываем победителей на малых досках после загрузки
        for (let i = 0; i < 9; i++) {
            this.game.boardWinners[i] = this.game.checkSmallBoardWinner(this.game.boards[i]);
        }
    }

    /**
     * Возвращает числовую оценку текущей позиции.
     * @param {number} depth - Глубина анализа (рекомендуется 3-5).
     * @returns {number} - Оценка позиции.
     */
    getEvaluation(depth = 4) {
        if (this.game.isGameOver()) {
             // Если игра уже закончена, можно вернуть максимальную или минимальную оценку сразу.
            const xWins = this.game.boardWinners.some(w => w === 'X');
            if (xWins) return 10000;
            const oWins = this.game.boardWinners.some(w => w === 'O');
            if (oWins) return -10000;
        }

        const isMaximizing = this.game.currentPlayer === 'X';
        return minimax(this.game, depth, -Infinity, Infinity, isMaximizing);
    }
}