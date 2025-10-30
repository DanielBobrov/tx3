// analysis.js - Система анализа партий с деревом вариантов

import {Engine} from "/static/js/engine.js";



// ===== КЛАСС 1: ИГРОВАЯ ЛОГИКА =====
class GameLogic {
    constructor() {
        this.WIN_PATTERNS = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // горизонтали
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // вертикали
            [0, 4, 8], [2, 4, 6]              // диагонали
        ];
    }

    /**
     * Парсинг FEN в массив
     * FEN формат: "04" + 81 символов (0=пусто, 1=X, 2=O)
     * Первый символ - текущий игрок (0=X, 1=O)
     * Второй символ - активная минидоска (0-8)
     */
    parseFen(fen) {
        if (typeof fen !== 'string' || fen.length !== 83) {
            return null;
        }
        
        const step = parseInt(fen[0]); // 0=X ходит, 1=O ходит
        const activeMini = parseInt(fen[1]);
        const grid = [];
        
        for (let i = 0; i < 9; i++) {
            grid[i] = [];
            for (let j = 0; j < 9; j++) {
                const idx = 2 + i * 9 + j;
                const val = fen[idx];
                grid[i][j] = val === '0' ? null : (val === '1' ? 'X' : 'O');
            }
        }
        
        return { step, activeMini, grid };
    }

    /**
     * Создание FEN из состояния
     */
    createFen(step, activeMini, grid) {
        let fen = step.toString() + activeMini.toString();
        
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                const cell = grid[i][j];
                fen += cell === null ? '0' : (cell === 'X' ? '1' : '2');
            }
        }
        
        return fen;
    }

    /**
     * Валидация хода
     */
    isValidMove(fen, move, activeMini) {
        if (move < 0 || move > 8) {
            return { valid: false, error: 'Неверный номер клетки (0-8)' };
        }

        const state = this.parseFen(fen);
        if (!state) {
            return { valid: false, error: 'Неверный формат FEN' };
        }

        // Проверяем, что ходим в правильную минидоску
        if (activeMini !== -1 && activeMini !== state.activeMini) {
            return { valid: false, error: `Нужно ходить в минидоску ${state.activeMini}` };
        }

        // Вычисляем координаты клетки
        const miniRow = Math.floor(state.activeMini / 3);
        const miniCol = state.activeMini % 3;
        const cellRow = Math.floor(move / 3);
        const cellCol = move % 3;
        const globalRow = miniRow * 3 + cellRow;
        const globalCol = miniCol * 3 + cellCol;

        // Проверяем, что клетка пустая
        if (state.grid[globalRow][globalCol] !== null) {
            return { valid: false, error: 'Клетка уже занята' };
        }

        return { valid: true };
    }

    /**
     * Применение хода и возврат нового FEN
     */
    applyMove(fen, move) {
        const state = this.parseFen(fen);
        if (!state) return null;

        const currentMark = state.step === 0 ? 'X' : 'O';
        const miniRow = Math.floor(state.activeMini / 3);
        const miniCol = state.activeMini % 3;
        const cellRow = Math.floor(move / 3);
        const cellCol = move % 3;
        const globalRow = miniRow * 3 + cellRow;
        const globalCol = miniCol * 3 + cellCol;

        // Ставим метку
        state.grid[globalRow][globalCol] = currentMark;

        // Проверяем победу в минидоске
        const miniBoard = this.getMiniBoard(state.grid, state.activeMini);
        const miniWinner = this.checkMiniWin(miniBoard);

        // Проверяем заполнение минидоски (если нет победителя)
        if (!miniWinner && this.isMiniboardFull(miniBoard)) {
            // Очищаем минидоску
            this.clearMiniBoard(state.grid, state.activeMini);
        }

        // Следующий ход
        const nextStep = (state.step + 1) % 2;
        const nextActiveMini = move;

        const newFen = this.createFen(nextStep, nextActiveMini, state.grid);
        
        return {
            fen: newFen,
            winner: miniWinner,
            gameWon: !!miniWinner // Победа в игре = победа в минидоске
        };
    }

    /**
     * Получить минидоску как массив 9 элементов
     */
    getMiniBoard(grid, miniIndex) {
        const miniRow = Math.floor(miniIndex / 3);
        const miniCol = miniIndex % 3;
        const board = [];

        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const globalRow = miniRow * 3 + r;
                const globalCol = miniCol * 3 + c;
                board.push(grid[globalRow][globalCol]);
            }
        }

        return board;
    }

    /**
     * Проверка победы в минидоске
     */
    checkMiniWin(miniBoard) {
        for (const pattern of this.WIN_PATTERNS) {
            const [a, b, c] = pattern;
            if (miniBoard[a] && 
                miniBoard[a] === miniBoard[b] && 
                miniBoard[a] === miniBoard[c]) {
                return miniBoard[a];
            }
        }
        return null;
    }

    /**
     * Проверка заполнения минидоски
     */
    isMiniboardFull(miniBoard) {
        return miniBoard.every(cell => cell !== null);
    }

    /**
     * Очистка минидоски
     */
    clearMiniBoard(grid, miniIndex) {
        const miniRow = Math.floor(miniIndex / 3);
        const miniCol = miniIndex % 3;

        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const globalRow = miniRow * 3 + r;
                const globalCol = miniCol * 3 + c;
                grid[globalRow][globalCol] = null;
            }
        }
    }
}

// ===== КЛАСС 2: УЗЕЛ ДЕРЕВА =====
class Node {
    constructor(move = null, fen = null, mark = null, parent = null) {
        this.move = move;           // Номер хода 0-8 (или null для корня)
        this.fen = fen;             // FEN после этого хода
        this.mark = mark;           // 'X' или 'O' - кто сходил
        this.parent = parent;       // Родительский узел
        this.children = [];         // Массив дочерних узлов
        this.winner = null;         // Победитель после этого хода
    }

    /**
     * Добавить дочерний узел
     */
    addChild(move, fen, mark) {
        const child = new Node(move, fen, mark, this);
        this.children.push(child);
        return child;
    }

    /**
     * Найти ребенка с указанным ходом
     */
    findChild(move) {
        return this.children.find(child => child.move === move);
    }

    /**
     * Получить путь от корня до этого узла
     */
    getPath() {
        const path = [];
        let current = this;
        
        while (current.parent) {
            path.unshift(current);
            current = current.parent;
        }
        
        return path;
    }

    /**
     * Получить глубину узла (расстояние от корня)
     */
    getDepth() {
        let depth = 0;
        let current = this;
        
        while (current.parent) {
            depth++;
            current = current.parent;
        }
        
        return depth;
    }
}

// ===== КЛАСС 3: МЕНЕДЖЕР АНАЛИЗА =====
class AnalysisManager {
    constructor(board, startFen = null) {
        this.board = board;
        this.logic = new GameLogic();
        
        // Инициализация дерева
        const initialFen = startFen || '04' + '0'.repeat(81);
        this.root = new Node(null, initialFen, null, null);
        this.currentNode = this.root;
        
        this.initUI();
        
        // Обновляем доску с начальным состоянием
        this.updateBoard();
    }

    /**
     * Инициализация UI элементов
     */
    initUI() {
        // Навигация
        document.getElementById('navFirst')?.addEventListener('click', () => this.goToFirst());
        document.getElementById('navPrev')?.addEventListener('click', () => this.goBack());
        document.getElementById('navNext')?.addEventListener('click', () => this.goForward());
        document.getElementById('navLast')?.addEventListener('click', () => this.goToLast());

        // Клавиши
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.goBack();
            else if (e.key === 'ArrowRight') this.goForward();
            else if (e.key === 'ArrowUp') this.goToFirst();
            else if (e.key === 'ArrowDown') this.goToLast();
        });

        // Кнопка вставки PGN
        document.getElementById('pastePgnBtn')?.addEventListener('click', () => this.pastePgn());
    }

    /**
     * Построить дерево из PGN строки
     */
    buildTreeFromPgn(pgn, startFen = null) {
        if (!this.validatePgn(pgn)) {
            alert(window.i18n.t('pgn.invalid_format'));
            return false;
        }

        // Сбрасываем дерево
        const initialFen = startFen || '04' + '0'.repeat(81);
        this.root = new Node(null, initialFen, null, null);
        this.currentNode = this.root;

        // Применяем ходы
        let currentNode = this.root;
        
        for (let i = 0; i < pgn.length; i++) {
            const move = parseInt(pgn[i]);
            const state = this.logic.parseFen(currentNode.fen);
            const mark = state.step === 0 ? 'X' : 'O';

            // Валидация хода
            const validation = this.logic.isValidMove(currentNode.fen, move, state.activeMini);
            if (!validation.valid) {
                alert(`${window.i18n.t('pgn.error_at_move')} ${i + 1}: ${validation.error}`);
                return false;
            }

            // Применяем ход
            const result = this.logic.applyMove(currentNode.fen, move);
            if (!result) {
                alert(`${window.i18n.t('pgn.could_not_apply')} ${i + 1}`);
                return false;
            }

            // Добавляем узел
            const newNode = currentNode.addChild(move, result.fen, mark);
            newNode.winner = result.winner;
            currentNode = newNode;

            // Останавливаемся при победе
            if (result.gameWon) {
                break;
            }
        }

        this.pgn = pgn;
        this.currentNode = this.root;
        this.updateBoard();
        this.renderTree();
        this.goToLast();
        console.log("SUCCESS");
        
        return true;
    }

    /**
     * Валидация PGN
     */
    validatePgn(pgn) {
        if (typeof pgn !== 'string') return false;
        if (pgn.length === 0) return true; // Пустой PGN валиден
        
        // Проверяем что только цифры 0-8
        return /^[0-8]+$/.test(pgn);
    }

    /**
     * Добавить ход (создать ветку если нужно)
     */
    addMove(move) {
        // Проверяем, завершена ли игра в текущем узле
        if (this.currentNode.winner) {
            alert(window.i18n.t('game.already_finished'));
            return false;
        }

        const state = this.logic.parseFen(this.currentNode.fen);
        
        // Валидация
        const validation = this.logic.isValidMove(this.currentNode.fen, move, state.activeMini);
        if (!validation.valid) {
            alert(validation.error);
            return false;
        }

        // Проверяем, есть ли уже такой ход
        let childNode = this.currentNode.findChild(move);
        
        if (!childNode) {
            // Создаем новую ветку
            const mark = state.step === 0 ? 'X' : 'O';
            const result = this.logic.applyMove(this.currentNode.fen, move);
            
            if (!result) {
                alert(window.i18n.t('pgn.could_not_apply'));
                return false;
            }

            childNode = this.currentNode.addChild(move, result.fen, mark);
            childNode.winner = result.winner;
        }

        // Переходим к узлу
        this.currentNode = childNode;
        this.updateBoard();
        this.renderTree();
        
        return true;
    }

    /**
     * Переход к узлу
     */
    goToNode(node) {
        if (!node) return;
        this.currentNode = node;
        this.updateBoard();
        this.renderTree();
    }

    /**
     * Навигация
     */
    goBack() {
        if (this.currentNode && this.currentNode.parent) {
            this.currentNode = this.currentNode.parent;
            this.updateBoard();
            this.renderTree();
        }
    }

    goForward() {
        // Идем по первому ребенку (главная линия)
        if (this.currentNode && this.currentNode.children.length > 0) {
            this.currentNode = this.currentNode.children[0];
            this.updateBoard();
            this.renderTree();
        }
    }

    goToFirst() {
        this.currentNode = this.root;
        this.updateBoard();
        this.renderTree();
    }

    goToLast() {
        // Идем до конца главной линии
        if (!this.currentNode) this.currentNode = this.root;
        
        while (this.currentNode.children.length > 0) {
            this.currentNode = this.currentNode.children[0];
        }
        this.updateBoard();
        this.renderTree();
    }

    /**
     * Обновить доску по текущему узлу
     */
    updateBoard() {
        if (!this.currentNode) {
            this.currentNode = this.root;
        }
        
        const state = this.logic.parseFen(this.currentNode.fen);
        if (!state) return;

        // Очищаем доску
        this.board.clear();

        // Расставляем фигуры
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (state.grid[i][j]) {
                    this.board.setMark(i, j, state.grid[i][j]);
                }
            }
        }

        // Подсвечиваем последний ход
        if (this.currentNode.move !== null && this.currentNode.parent) {
            const parentState = this.logic.parseFen(this.currentNode.parent.fen);
            const miniRow = Math.floor(parentState.activeMini / 3);
            const miniCol = parentState.activeMini % 3;
            const cellRow = Math.floor(this.currentNode.move / 3);
            const cellCol = this.currentNode.move % 3;
            const globalRow = miniRow * 3 + cellRow;
            const globalCol = miniCol * 3 + cellCol;
            
            this.board.highlightLast(globalRow, globalCol);
        }

        // Устанавливаем активную минидоску для анализа
        // Показываем какая минидоска должна быть активна
        if (!this.currentNode.winner) {
            this.board.setActiveMini(state.activeMini);
        } else {
            // Если игра закончена, блокируем все
            this.board.setActiveMini(-2);
        }

        // Обновляем статус
        this.updateStatus();
        
        // Обновляем PGN в board для копирования
        this.board.pgn = this.getCurrentPgn();
        this.pgn = this.board.pgn;
    }

    /**
     * Обновить статус игры
     */
    updateStatus() {
        const statusEl = document.getElementById('gameStatus');
        if (!statusEl) return;

        if (this.currentNode.winner) {
            statusEl.textContent = `${window.i18n.t('game.won')} ${this.currentNode.winner}!`;
        } else {
            const state = this.logic.parseFen(this.currentNode.fen);
            const nextMark = state.step === 0 ? 'X' : 'O';
            statusEl.textContent = `${window.i18n.t('game.move')} ${nextMark}`;
        }
    }

    /**
     * Рендеринг дерева ходов
     */
    renderTree() {
        const container = document.getElementById('movesTree');
        if (!container) return;

        container.innerHTML = '';
        
        // Рендерим главную линию парами
        this.renderMainLine(this.root, container);
        
        // Прокручиваем к текущему ходу
        const currentEl = container.querySelector('.move-item.current');
        if (currentEl) {
            currentEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Рендеринг главной линии (парами X-O)
     */
    renderMainLine(node, container) {
        if (node.children.length === 0) return;

        let currentNode = node.children[0]; // Первый ребенок = главная линия
        let depth = 0;

        while (currentNode) {
            const isXMove = depth % 2 === 0;

            if (isXMove) {
                // Начинаем новую пару (main-move)
                const mainMoveDiv = document.createElement('div');
                mainMoveDiv.className = 'main-move';

                const mainLineDiv = document.createElement('div');
                mainLineDiv.className = 'main-line';

                const moveNum = Math.floor(depth / 2) + 1;

                // Сохраняем ссылку на узел X для замыкания
                const nodeX = currentNode;
                
                // Ход X (с номером хода)
                const moveSpanX = document.createElement('span');
                moveSpanX.className = 'move-item';
                const checkmarkX = nodeX.winner === nodeX.mark ? '#' : '';
                moveSpanX.textContent = `${moveNum}.${nodeX.mark}:${nodeX.move+1}${checkmarkX}`;
                moveSpanX.dataset.mark = nodeX.mark;

                if (nodeX === this.currentNode) {
                    moveSpanX.classList.add('current');
                }

                moveSpanX.addEventListener('click', () => this.goToNode(nodeX));
                mainLineDiv.appendChild(moveSpanX);

                // Альтернативы для X
                const altXNodes = nodeX.children.slice(1);

                // Проверяем есть ли ход O
                if (nodeX.children.length > 0) {
                    const nodeO = nodeX.children[0];

                    // Ход O
                    const moveSpanO = document.createElement('span');
                    moveSpanO.className = 'move-item';
                    const checkmarkO = nodeO.winner === nodeO.mark ? '#' : '';
                    moveSpanO.textContent = `${nodeO.mark}:${nodeO.move+1}${checkmarkO}`;
                    moveSpanO.dataset.mark = nodeO.mark;

                    if (nodeO === this.currentNode) {
                        moveSpanO.classList.add('current');
                    }

                    moveSpanO.addEventListener('click', () => this.goToNode(nodeO));
                    mainLineDiv.appendChild(moveSpanO);

                    mainMoveDiv.appendChild(mainLineDiv);

                    // Альтернативы для X
                    for (const altNode of altXNodes) {
                        this.renderAltMove(altNode, mainMoveDiv, depth + 1);
                    }

                    // Альтернативы для O
                    const altONodes = nodeO.children.slice(1);
                    for (const altNode of altONodes) {
                        this.renderAltMove(altNode, mainMoveDiv, depth + 2);
                    }

                    container.appendChild(mainMoveDiv);

                    // Продолжаем главную линию с детей O
                    currentNode = nodeO.children.length > 0 ? nodeO.children[0] : null;
                    depth += 2;
                } else {
                    // Только X, нет O
                    mainMoveDiv.appendChild(mainLineDiv);

                    // Альтернативы для X
                    for (const altNode of altXNodes) {
                        this.renderAltMove(altNode, mainMoveDiv, depth + 1);
                    }

                    container.appendChild(mainMoveDiv);
                    currentNode = null;
                }
            } else {
                // Если начинается с O (не должно быть в главной линии, но на всякий случай)
                currentNode = currentNode.children.length > 0 ? currentNode.children[0] : null;
                depth++;
            }
        }
    }

    /**
     * Рендеринг альтернативного хода (рекурсивно)
     */
    renderAltMove(node, container, depth) {
        const altMoveDiv = document.createElement('div');
        altMoveDiv.className = 'alt-move';

        const mainLineDiv = document.createElement('div');
        mainLineDiv.className = 'main-line';

        // Вычисляем номер хода и префикс
        let moveNum = Math.floor(depth / 2) + 1;
        const isXMove = depth % 2 === 0;
        const movePrefix = isXMove ? `` : `..`;

        // Собираем всю линию (первые дети) и их альтернативы
        const nodesInLine = [];
        let currentNode = node;
        let currentDepth = depth;

        while (currentNode) {
            nodesInLine.push({
                node: currentNode,
                depth: currentDepth
            });
            currentNode = currentNode.children.length > 0 ? currentNode.children[0] : null;
            currentDepth++;
        }

        // Рендерим все ходы в main-line
        for (let i = 0; i < nodesInLine.length; i++) {
            const {node: nodeRef} = nodesInLine[i];
            const moveSpan = document.createElement('span');
            moveSpan.className = 'move-item';
            const checkmark = nodeRef.winner === nodeRef.mark ? '#' : '';
            // Добавляем номер хода только к первому элементу
            const prefix = (i === 0) ? movePrefix : '';
            let moveNumText = "";
            if (nodeRef.mark === 'X') {
                moveNumText = `${moveNum}.`; 
                moveNum += 1;
            }
            moveSpan.textContent = `${moveNumText}${prefix}${nodeRef.mark}:${nodeRef.move+1}${checkmark}`;
            moveSpan.dataset.mark = nodeRef.mark;

            if (nodeRef === this.currentNode) {
                moveSpan.classList.add('current');
            }

            moveSpan.addEventListener('click', () => this.goToNode(nodeRef));
            mainLineDiv.appendChild(moveSpan);
        }

        // Добавляем main-line в alt-move
        altMoveDiv.appendChild(mainLineDiv);

        // Теперь рекурсивно рендерим альтернативы для всех узлов в линии
        for (const {node: nodeRef, depth: nodeDepth} of nodesInLine) {
            const altNodes = nodeRef.children.slice(1);
            for (const altNode of altNodes) {
                this.renderAltMove(altNode, altMoveDiv, nodeDepth + 1);
            }
        }

        container.appendChild(altMoveDiv);
    }

    /**
     * Вставить PGN из буфера обмена
     */
    async pastePgn() {
        try {
            const text = await navigator.clipboard.readText();
            const pgn = text.trim();
            
            if (pgn.length === 0) {
                alert(window.i18n.t('clipboard.empty'));
                return;
            }

            this.buildTreeFromPgn(pgn);
        } catch (err) {
            console.error('Ошибка чтения буфера обмена:', err);
            alert(window.i18n.t('clipboard.access_denied'));
        }
    }

    /**
     * Получить текущий PGN (главная линия)
     */
    getCurrentPgn() {
        const path = this.currentNode.getPath();
        return path.map(node => node.move).join('');
    }
}

// Экспорт для глобального использования
window.GameLogic = GameLogic;
window.Node = Node;
window.AnalysisManager = AnalysisManager;




// =====================================================================================================================

// const engine = new Engine();
//
// // запускаем/обновляем анализ каждый раз после хода игрока
// function onUserMove(pgn) {
//   engine.start(
//     pgn,
//     (score, depth) => console.log(`depth ${depth} → ${score}`),
//     {maxDepth: 50}
//   );
// }
//
// // по желанию можно явно остановить
// function onGameOver() {
//   engine.stop();
// }
//
// window.onUserMove = onUserMove;
// window.onGameOver = onGameOver;


import { GameEngine } from './engine/engine.js';
const engine = new GameEngine();
// // Загружаем позицию
// engine.loadFen(fen);
//
// // Получаем оценку (глубина 4)
// console.time("Evaluation time");
// const evaluation = engine.getEvaluation(4);
// console.timeEnd("Evaluation time");

window.engine = engine;


