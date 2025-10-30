// const WIN_SCORE = 10000;
// const BOARD_WIN_SCORE = 100;
// const TWO_IN_A_ROW_SCORE = 10;
// const ONE_IN_A_ROW_SCORE = 1;
//
// /**
//  * Оценивает одну малую доску 3x3.
//  * @param {Array} board - Массив из 9 клеток.
//  * @returns {number} - Оценка доски.
//  */
// function evaluateSmallBoard(board) {
//     let score = 0;
//     const lines = [
//         [0, 1, 2], [3, 4, 5], [6, 7, 8],
//         [0, 3, 6], [1, 4, 7], [2, 5, 8],
//         [0, 4, 8], [2, 4, 6]
//     ];
//
//     for (const line of lines) {
//         const [a, b, c] = line;
//         const pieces = [board[a], board[b], board[c]];
//         const xCount = pieces.filter(p => p === 'X').length;
//         const oCount = pieces.filter(p => p === 'O').length;
//
//         if (xCount === 2 && oCount === 0) score += TWO_IN_A_ROW_SCORE;
//         else if (oCount === 2 && xCount === 0) score -= TWO_IN_A_ROW_SCORE;
//         else if (xCount === 1 && oCount === 0) score += ONE_IN_A_ROW_SCORE;
//         else if (oCount === 1 && xCount === 0) score -= ONE_IN_A_ROW_SCORE;
//     }
//     return score;
// }
//
// /**
//  * Главная оценочная функция для всей игровой позиции.
//  * @param {UltimateTicTacToe} game - Игровой объект.
//  * @returns {number} - Финальная оценка.
//  */
// export function evaluatePosition(game) {
//     if (game.isGameOver()) {
//         const xWins = game.boardWinners.some(w => w === 'X');
//         if (xWins) return WIN_SCORE;
//         const oWins = game.boardWinners.some(w => w === 'O');
//         if (oWins) return -WIN_SCORE;
//     }
//
//     let totalScore = 0;
//     for (let i = 0; i < 9; i++) {
//         if (game.boardWinners[i] === 'X') {
//             totalScore += BOARD_WIN_SCORE;
//         } else if (game.boardWinners[i] === 'O') {
//             totalScore -= BOARD_WIN_SCORE;
//         } else {
//             totalScore += evaluateSmallBoard(game.boards[i]);
//         }
//     }
//     return totalScore;
// }


// js/evaluation.js

// --- КОНСТАНТЫ ДЛЯ НАСТРОЙКИ ОЦЕНКИ ---

// Абсолютная оценка за победу/поражение. Должна быть выше любой возможной комбинации других очков.
const WIN_SCORE = 10000;

// Очки за выигранную малую доску.
const BOARD_WIN_SCORE = 150;

// Вес стратегической оценки (два в ряд, центр и т.д.).
const WEIGHT_STRATEGIC = 2;

// Вес оценки мобильности (количество безопасных ходов).
const WEIGHT_MOBILITY = 5;

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

/**
 * Проверяет, есть ли у игрока угроза "две в ряд" на малой доске.
 * @param {Array<('X'|'O'|null)>} board - Малая доска 3x3.
 * @param {'X' | 'O'} player - Игрок.
 * @returns {boolean} - true, если угроза существует.
 */
function hasTwoInARowThreat(board, player) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (const line of lines) {
        const pieces = [board[line[0]], board[line[1]], board[line[2]]];
        const playerCount = pieces.filter(p => p === player).length;
        const emptyCount = pieces.filter(p => p === null).length;
        if (playerCount === 2 && emptyCount === 1) {
            return true;
        }
    }
    return false;
}

/**
 * [СТРАТЕГИЧЕСКИЙ КОМПОНЕНТ]
 * Оценивает статическое расположение фигур на одной малой доске.
 * @param {Array<('X'|'O'|null)>} board
 * @returns {number} - Положительное число за 'X', отрицательное за 'O'.
 */
function evaluateSmallBoardStrategic(board) {
    let score = 0;
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (const line of lines) {
        const pieces = [board[line[0]], board[line[1]], board[line[2]]];
        const xCount = pieces.filter(p => p === 'X').length;
        const oCount = pieces.filter(p => p === 'O').length;

        if (xCount === 2 && oCount === 0)      score += 50;
        else if (oCount === 2 && xCount === 0) score -= 50;
        else if (xCount === 1 && oCount === 0) score += 1;
        else if (oCount === 1 && xCount === 0) score -= 1;
    }
    return score;
}

/**
 * [ТАКТИЧЕСКИЙ КОМПОНЕНТ]
 * Подсчитывает количество "безопасных" ходов для игрока на указанной доске.
 * @param {import('./game').UltimateTicTacToe} game
 * @param {number} boardIndex
 * @param {'X' | 'O'} player
 * @returns {number}
 */
function countSafeMovesOnBoard(game, boardIndex, player) {
    if (game.boardWinners[boardIndex]) return 0;

    const opponent = player === 'X' ? 'O' : 'X';
    const boardState = game.boards[boardIndex];
    let safeMovesCount = 0;

    for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
        if (boardState[cellIndex] === null) {
            const destinationBoard = game.boards[cellIndex];
            if (!hasTwoInARowThreat(destinationBoard, opponent)) {
                safeMovesCount++;
            }
        }
    }
    return safeMovesCount - 4.5;
}

// --- ГЛАВНАЯ КОМБИНИРОВАННАЯ ФУНКЦИЯ ОЦЕНКИ ---

/**
 * Оценивает позицию, комбинируя стратегическое положение и тактическую мобильность.
 * Оценка = (Потенциал X) - (Потенциал O).
 * @param {import('./game').UltimateTicTacToe} game - Игровой объект.
 * @returns {number} - Оценка позиции. > 0 за X, < 0 за O.
 */
export function evaluatePosition(game) {
    // 1. Проверка на завершение игры (высший приоритет)
    if (game.isGameOver()) {
        const xHasWon = game.boardWinners.some(w => w === 'X');
        if (xHasWon) return WIN_SCORE;
        const oHasWon = game.boardWinners.some(w => w === 'O');
        if (oHasWon) return -WIN_SCORE;
    }

    let totalXScore = 0;
    let totalOScore = 0;

    // 2. Оцениваем каждую из 9 малых досок
    for (let i = 0; i < 9; i++) {
        if (game.boardWinners[i] === 'X') {
            totalXScore += BOARD_WIN_SCORE;
            continue;
        }
        if (game.boardWinners[i] === 'O') {
            totalOScore += BOARD_WIN_SCORE;
            continue;
        }

        // Если доска еще в игре, оцениваем ее по двум критериям:
        // А) Стратегическая ценность расположения фигур
        const strategicScore = evaluateSmallBoardStrategic(game.boards[i]);
        if (strategicScore > 0) {
            totalXScore += strategicScore * WEIGHT_STRATEGIC;
        } else {
            totalOScore += -strategicScore * WEIGHT_STRATEGIC;
        }

        // Б) Тактическая ценность (мобильность)
        totalXScore += countSafeMovesOnBoard(game, i, 'X') * WEIGHT_MOBILITY;
        totalOScore += countSafeMovesOnBoard(game, i, 'O') * WEIGHT_MOBILITY;
    }

    // 3. Бонус за "свободный ход" (когда можно ходить на любую доску)
    if (game.activeBoard === -1) {
        const bonus = 9 * WEIGHT_MOBILITY; // Бонус равен максимальному числу ходов
        if (game.currentPlayer === 'X') {
            totalXScore += bonus;
        } else {
            totalOScore += bonus;
        }
    }

    // 4. Финальная оценка — разница потенциалов
    return totalXScore - totalOScore;
}

/*
1 :  107
2 :  -4
3 :  206
4 :  -105
5 :  109
6 :  -112
7 :  108
8 :  -213
9 :  95
10 :  -10000

*/