import { evaluatePosition } from './evaluation.js';

/**
 * Рекурсивный алгоритм Минимакс с альфа-бета отсечением.
 * @param {UltimateTicTacToe} game - Игровой объект.
 * @param {number} depth - Глубина поиска.
 * @param {number} alpha - Лучшее значение для максимизирующего игрока.
 * @param {number} beta - Лучшее значение для минимизирующего игрока.
 * @param {boolean} isMaximizingPlayer - true для 'X', false для 'O'.
 * @returns {number} - Оценка позиции.
 */
export function minimax(game, depth, alpha, beta, isMaximizingPlayer) {
    if (depth === 0 || game.isGameOver()) {
        // Добавляем небольшой шум в зависимости от глубины, чтобы предпочитать более быстрые победы
        return evaluatePosition(game);// + (isMaximizingPlayer ? depth : -depth);
    }

    const validMoves = game.getValidMoves();

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of validMoves) {
            const gameCopy = JSON.parse(JSON.stringify(game)); // Создаем копию
            Object.setPrototypeOf(gameCopy, Object.getPrototypeOf(game));
            gameCopy.makeMove(move.boardIndex, move.cellIndex);

            const score = minimax(gameCopy, depth - 1, alpha, beta, false);
            maxEval = Math.max(maxEval, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) {
                break; // Отсечение
            }
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of validMoves) {
            const gameCopy = JSON.parse(JSON.stringify(game)); // Создаем копию
            Object.setPrototypeOf(gameCopy, Object.getPrototypeOf(game));
            gameCopy.makeMove(move.boardIndex, move.cellIndex);

            const score = minimax(gameCopy, depth - 1, alpha, beta, true);
            minEval = Math.min(minEval, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) {
                break; // Отсечение
            }
        }
        return minEval;
    }
}