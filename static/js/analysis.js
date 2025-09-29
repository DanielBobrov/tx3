// Класс для узла дерева ходов
class MoveNode {
    constructor(move, parent = null) {
        this.move = move; // {cellIndex, mark, activeMini, globalRow, globalCol}
        this.parent = parent;
        this.children = [];
        this.comment = '';
    }

    addChild(moveNode) {
        this.children.push(moveNode);
        return moveNode;
    }

    getMainLine() {
        // Возвращает основную линию (первый ребенок на каждом уровне)
        const moves = [];
        let current = this;
        while (current.children.length > 0) {
            current = current.children[0];
            moves.push(current);
        }
        return moves;
    }

    getAllMoves() {
        // Возвращает все ходы от корня до текущего узла
        const moves = [];
        let current = this;
        while (current.parent) {
            moves.unshift(current);
            current = current.parent;
        }
        return moves;
    }

    getMoveNumber() {
        // Вычисляет номер хода
        const moves = this.getAllMoves();
        return Math.floor((moves.length - 1) / 2) + 1;
    }

    getDepth() {
        // Вычисляет глубину узла в дереве вариантов
        let depth = 0;
        let current = this;

        while (current.parent) {
            // Если это не первый ребенок, увеличиваем глубину
            const siblings = current.parent.children;
            if (siblings.indexOf(current) > 0) {
                depth++;
            }
            current = current.parent;
        }

        return depth;
    }
}

class MovesTreeManager {
    constructor(board) {
        this.board = board;
        this.root = new MoveNode(null); // Корневой узел без хода
        this.currentNode = this.root;

        this.initControls();
        this.initMovesList();
    }

    initControls() {
        document.getElementById('navFirst').addEventListener('click', () => this.goToStart());
        document.getElementById('navPrev').addEventListener('click', () => this.goToPreviousMove());
        document.getElementById('navNext').addEventListener('click', () => this.goToNextMove());
        document.getElementById('navLast').addEventListener('click', () => this.goToMainLineEnd());

        addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft") this.goToPreviousMove();
            else if (event.key === "ArrowRight") this.goToNextMove();
            else if (event.key === "ArrowUp") this.goToStart();
            else if (event.key === "ArrowDown") this.goToMainLineEnd();
        });

        // Скрываем индикатор просмотра по умолчанию
        document.getElementById('viewingIndicator').style.display = 'none';
    }

    initMovesList() {
        this.movesListEl = document.getElementById('movesList');
    }

    addMove(moveData) {
        // Проверяем, есть ли уже такой ход среди детей текущего узла
        const existingChild = this.currentNode.children.find(child =>
            child.move.cellIndex === moveData.cellIndex
        );

        if (existingChild) {
            // Если ход уже существует, переходим к нему
            this.currentNode = existingChild;
        } else {
            // Создаем новый узел
            const newNode = new MoveNode(moveData, this.currentNode);
            this.currentNode.addChild(newNode);
            this.currentNode = newNode;
        }

        this.updateMovesList();
        this.updateNavigationButtons();
    }

    goToNode(node) {
        if (!node) return;

        this.currentNode = node;

        // Восстанавливаем состояние доски
        this.reconstructBoardToNode(node);

        // Обновляем UI
        this.updateMovesList();
        this.updateNavigationButtons();
        this.updateViewingIndicator();
    }

    goToStart() {
        this.goToNode(this.root);
        this.board.clear();
        this.board.setActiveMini(4);
        this.board.myMark = 'X';
        document.getElementById('gameStatus').textContent = 'Ход игрока: X';
    }

    goToPreviousMove() {
        if (this.currentNode.parent) {
            this.goToNode(this.currentNode.parent);
        }
    }

    goToNextMove() {
        if (this.currentNode.children.length > 0) {
            // По умолчанию идем по первому варианту (основная линия)
            this.goToNode(this.currentNode.children[0]);
        }
    }

    goToMainLineEnd() {
        let current = this.root;
        while (current.children.length > 0) {
            current = current.children[0];
        }
        this.goToNode(current);
    }

    reconstructBoardToNode(node) {
        // Получаем все ходы от корня до текущего узла
        const moves = node.getAllMoves();

        // Очищаем доску
        this.board.clear();

        // Применяем все ходы
        let activeMini = 4;

        moves.forEach((moveNode, index) => {
            const move = moveNode.move;

            // Ставим метку
            this.board.setMark(move.globalRow, move.globalCol, move.mark);

            // Подсвечиваем последний ход
            if (index === moves.length - 1) {
                this.board.highlightLast(move.globalRow, move.globalCol);
            }

            activeMini = move.cellIndex;
        });

        // Устанавливаем активную мини-доску и текущего игрока
        if (moves.length > 0) {
            this.board.setActiveMini(activeMini);
            const nextMark = (moves.length % 2 === 0) ? 'X' : 'O';
            this.board.myMark = nextMark;
            document.getElementById('gameStatus').textContent = `Ход игрока: ${nextMark}`;
        } else {
            this.board.setActiveMini(4);
            this.board.myMark = 'X';
            document.getElementById('gameStatus').textContent = 'Ход игрока: X';
        }
    }

    updateMovesList() {
        this.movesListEl.innerHTML = '';

        // Рендерим дерево ходов рекурсивно
        this.renderMovesTree(this.root);

        // Подсвечиваем текущий ход
        this.highlightCurrentMove();
    }

    renderMovesTree(node, isMainLine = true) {
        // Для корневого узла обрабатываем только детей
        if (!node.move) {
            node.children.forEach((child, index) => {
                this.renderMovesTree(child, index === 0);
            });
            return;
        }

        const depth = node.getDepth();
        const moveNumber = node.getMoveNumber();
        const isWhiteMove = node.move.mark === 'X';

        // Для основной линии и начала вариантов с хода белых
        if (isMainLine && isWhiteMove) {
            // Создаем пару для основной линии
            const pair = document.createElement('div');
            pair.className = 'move-pair';
            pair.dataset.moveNumber = moveNumber;

            // Номер хода
            const numEl = document.createElement('span');
            numEl.className = 'move-number';
            numEl.textContent = `${moveNumber}.`;
            pair.appendChild(numEl);

            // Ход белых
            const whiteMove = this.createMoveElement(node);
            pair.appendChild(whiteMove);

            // Ход черных (если есть)
            const blackChild = node.children.find(child => child.move.mark === 'O' && node.children.indexOf(child) === 0);
            if (blackChild && isMainLine) {
                const blackMove = this.createMoveElement(blackChild);
                pair.appendChild(blackMove);

                // Рендерим варианты после хода черных
                this.renderVariantsAfterNode(blackChild);

                // Продолжаем основную линию
                blackChild.children.forEach((child, index) => {
                    this.renderMovesTree(child, index === 0);
                });
            } else {
                // Рендерим варианты после хода белых
                this.renderVariantsAfterNode(node);

                // Продолжаем основную линию
                node.children.forEach((child, index) => {
                    if (child.move.mark === 'X') {
                        this.renderMovesTree(child, index === 0);
                    }
                });
            }

            this.movesListEl.appendChild(pair);

        } else if (!isMainLine) {
            // Это вариант - рендерим как отдельную линию
            this.renderVariationLine(node);
        }
    }

    renderVariantsAfterNode(node) {
        // Рендерим все варианты (кроме первого ребенка)
        node.children.forEach((child, index) => {
            if (index > 0) {
                this.renderVariationLine(child);
            }
        });
    }

    renderVariationLine(startNode) {
        const depth = startNode.getDepth();
        let container = document.createElement('div');
        container.className = 'variation-container';
        container.style.marginLeft = `${depth * 20}px`;

        let line = document.createElement('div');
        line.className = 'variation-line';

        // Добавляем вертикальную линию для вложенных вариантов
        if (depth > 1) {
            container.classList.add('nested-variation');
        }

        let current = startNode;
        let moveNumber = current.getMoveNumber();
        let isFirst = true;

        while (current) {
            // Добавляем номер хода
            if (isFirst && current.move.mark === 'O') {
                const dots = document.createElement('span');
                dots.className = 'move-number';
                dots.textContent = `${moveNumber}...`;
                line.appendChild(dots);
            } else if (current.move.mark === 'X') {
                const numEl = document.createElement('span');
                numEl.className = 'move-number';
                numEl.textContent = `${moveNumber}.`;
                line.appendChild(numEl);
            }

            // Добавляем сам ход
            const moveEl = this.createMoveElement(current);
            line.appendChild(moveEl);

            if (current.move.mark === 'O') {
                moveNumber++;
            }

            // Рендерим подварианты текущего хода
            if (current.children.length > 1) {
                // Добавляем текущую линию в контейнер
                container.appendChild(line);
                this.movesListEl.appendChild(container);

                // Рендерим подварианты
                current.children.forEach((child, index) => {
                    if (index > 0) {
                        this.renderVariationLine(child);
                    }
                });

                // Создаем новый контейнер для продолжения
                const newContainer = document.createElement('div');
                newContainer.className = 'variation-container';
                newContainer.style.marginLeft = `${depth * 20}px`;

                const newLine = document.createElement('div');
                newLine.className = 'variation-line';

                container = newContainer;
                line = newLine;
            }

            isFirst = false;
            current = current.children.length > 0 ? current.children[0] : null;
        }

        // Добавляем оставшуюся линию
        if (line.children.length > 0) {
            container.appendChild(line);
            this.movesListEl.appendChild(container);
        }
    }

    createMoveElement(node) {
        const moveEl = document.createElement('span');
        moveEl.className = 'move-item';
        moveEl.dataset.nodeId = this.getNodeId(node);

        const notation = `${node.move.mark}:${node.move.cellIndex + 1}`;
        moveEl.textContent = notation;

        // Обработчик клика
        moveEl.addEventListener('click', () => this.goToNode(node));

        return moveEl;
    }

    getNodeId(node) {
        // Генерируем уникальный ID для узла на основе пути от корня
        const path = [];
        let current = node;
        while (current.parent) {
            const index = current.parent.children.indexOf(current);
            path.unshift(index);
            current = current.parent;
        }
        return path.join('-');
    }

    highlightCurrentMove() {
        // Убираем подсветку со всех ходов
        this.movesListEl.querySelectorAll('.move-item').forEach(el => {
            el.classList.remove('current');
        });

        // Подсвечиваем текущий ход
        if (this.currentNode.move) {
            const currentId = this.getNodeId(this.currentNode);
            const currentEl = this.movesListEl.querySelector(`[data-node-id="${currentId}"]`);
            if (currentEl) {
                currentEl.classList.add('current');
                currentEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    updateViewingIndicator() {
        const indicator = document.getElementById('viewingIndicator');
        const moveNumSpan = document.getElementById('viewingMoveNum');

        const allMoves = this.currentNode.getAllMoves();
        const mainLine = this.root.getMainLine();
        const isViewingHistory = this.currentNode !== mainLine[mainLine.length - 1] && mainLine.length > 0;

        if (isViewingHistory) {
            indicator.style.display = 'block';
            moveNumSpan.textContent = `${allMoves.length} из ${mainLine.length}`;
        } else {
            indicator.style.display = 'none';
        }
    }

    updateNavigationButtons() {
        const hasPrevious = this.currentNode.parent !== null;
        const hasNext = this.currentNode.children.length > 0;

        document.getElementById('navFirst').disabled = !hasPrevious;
        document.getElementById('navPrev').disabled = !hasPrevious;
        document.getElementById('navNext').disabled = !hasNext;
        document.getElementById('navLast').disabled = this.currentNode === this.root.getMainLine()[this.root.getMainLine().length - 1] || this.root.children.length === 0;
    }
}

// Класс Board остается без изменений
class Board {
    constructor(root, opts = {}) {
        this.el = typeof root === 'string' ? document.querySelector(root) : root;
        if (!this.el) throw new Error('Board root not found');
        this.onMove = opts.onMove || null;
        this.myMark = (opts.myMark === 'O') ? 'O' : 'X';
        this.activeMini = (typeof opts.activeMini === 'number') ? opts.activeMini : 4;
        this.map();
        this.setActiveMini(this.activeMini);
        this.attach();
    }

    map() {
        this.cellMap = {};
        this.minis = Array.from(this.el.querySelectorAll('.mini'));
        this.el.querySelectorAll('.cell').forEach(cell => {
            const r = +cell.dataset.row, c = +cell.dataset.col;
            this.cellMap[`${r}-${c}`] = cell;
        });
    }

    getCell(r, c) {
        return this.cellMap[`${r}-${c}`];
    }

    getMark(r, c) {
        const cell = this.getCell(r, c);
        return cell?.querySelector('.mark')?.dataset.mark || '';
    }

    setMark(r, c, mark) {
        const cell = this.getCell(r, c);
        if (!cell) return;
        const markEl = cell.querySelector('.mark');
        if (mark === 'X' || mark === 'O') {
            markEl.dataset.mark = mark;
            markEl.textContent = mark;
            cell.classList.add('taken');
        } else {
            markEl.textContent = '';
            delete markEl.dataset.mark;
            cell.classList.remove('taken');
        }
    }

    clear() {
        Object.keys(this.cellMap).forEach(key => {
            const [r, c] = key.split('-').map(Number);
            this.setMark(r, c, '');
        });
        this.clearHighlights();
        this.minis.forEach(m => delete m.dataset.won);
    }

    serialize() {
        let s = '';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const m = this.getMark(r, c);
                s += (m === 'X' || m === 'O') ? m : '.';
            }
        }
        return s;
    }

    setActiveMini(idx) {
        this.activeMini = (typeof idx === 'number') ? idx : -1;

        this.minis.forEach((mini, i) => {
            const shouldBeActive = (this.activeMini === -1 || i === this.activeMini);
            const shouldBeDisabled = (this.activeMini !== -1 && i !== this.activeMini);

            if (shouldBeActive) {
                mini.classList.add('active');
            } else {
                mini.classList.remove('active');
            }

            if (shouldBeDisabled) {
                mini.classList.add('disabled');
            } else {
                mini.classList.remove('disabled');
            }
        });
    }

    clearHighlights() {
        this.el.querySelectorAll('.cell.highlight').forEach(cell => cell.classList.remove('highlight'));
    }

    highlightLast(r, c) {
        this.clearHighlights();
        const cell = this.getCell(r, c);
        if (cell) cell.classList.add('highlight');
    }

    attach() {
        this.el.addEventListener('click', async (e) => {
            const cell = e.target.closest('.cell');
            if (!cell || !this.el.contains(cell)) return;

            const r = +cell.dataset.row;
            const c = +cell.dataset.col;
            const mini = +cell.dataset.mini;

            // Проверяем, можно ли сделать ход
            if (this.activeMini !== -1 && mini !== this.activeMini) return;
            if (this.getMark(r, c)) return;

            // Вычисляем индекс клетки внутри мини-доски
            const cellIndex = 3 * (r % 3) + (c % 3);

            // Создаем данные о ходе
            const moveData = {
                cellIndex: cellIndex,
                mark: this.myMark,
                activeMini: mini,
                globalRow: r,
                globalCol: c
            };

            if (this.onMove) {
                try {
                    const res = await this.onMove(moveData);
                    if (res === true) {
                        // Делаем ход на доске
                        this.setMark(r, c, this.myMark);
                        this.highlightLast(r, c);

                        // Добавляем ход в дерево
                        window.movesTreeManager.addMove(moveData);

                        // Меняем активного игрока
                        this.myMark = (this.myMark === 'O') ? 'X' : 'O';

                        // Устанавливаем следующую активную мини-доску
                        this.setActiveMini(cellIndex);

                        // Обновляем статус
                        document.getElementById('gameStatus').textContent = `Ход игрока: ${this.myMark}`;
                    }
                } catch (err) {
                    console.error('onMove error', err);
                }
            }
        });
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const init = window.INIT || {};
    let movesTreeManager = null;

    // Создаем доску
    const board = new Board('#Board', {
        myMark: init.myMark || 'X',
        activeMini: typeof init.activeMini === 'number' ? init.activeMini : 4,
        onMove: async (moveData) => {
            // В режиме анализа всегда разрешаем ходы
            return true;
        }
    });

    window.board = board;

    // Создаем менеджер дерева ходов
    movesTreeManager = new MovesTreeManager(board);
    window.movesTreeManager = movesTreeManager;

    // Обработчик кнопки "Insert position"
    const insertBtn = document.getElementById('insert-position-btn');
    if (insertBtn) {
        insertBtn.addEventListener('click', () => {
            const fen = prompt('Введите FEN позицию:');
            if (fen && fen.length === 82) {
                loadPositionFromFEN(fen);
            }
        });
    }

    // Если есть начальная позиция, загружаем её
    if (init.initialPgn) {
        loadInitialPGN(init.initialPgn);
    }
});

// Функция загрузки позиции из FEN
function loadPositionFromFEN(fen) {
    // FEN формат: 81 символ для доски + 1 символ для активной мини-доски
    const boardState = fen.substring(0, 81);
    const activeMini = parseInt(fen[81]);

    // Очищаем текущее дерево
    window.movesTreeManager = new MovesTreeManager(window.board);

    // Устанавливаем позицию на доске
    for (let i = 0; i < 81; i++) {
        const r = Math.floor(i / 9);
        const c = i % 9;
        const mark = boardState[i];
        if (mark === 'X' || mark === 'O') {
            window.board.setMark(r, c, mark);
        }
    }

    // Устанавливаем активную мини-доску
    window.board.setActiveMini(activeMini);

    // Определяем, чей ход (считаем количество X и O)
    let xCount = 0, oCount = 0;
    for (let char of boardState) {
        if (char === 'X') xCount++;
        else if (char === 'O') oCount++;
    }

    window.board.myMark = xCount > oCount ? 'O' : 'X';
    document.getElementById('gameStatus').textContent = `Ход игрока: ${window.board.myMark}`;
}

// Функция загрузки начальной PGN
function loadInitialPGN(pgn) {
    if (!pgn) return;

    // Преобразуем PGN в последовательность ходов
    const moves = pgn.split('').map(n => parseInt(n));
    let currentMark = 'X';
    let activeMini = 4;

    moves.forEach((cellIndex) => {
        // Вычисляем координаты
        const miniRow = Math.floor(activeMini / 3);
        const miniCol = activeMini % 3;
        const cellRow = Math.floor(cellIndex / 3);
        const cellCol = cellIndex % 3;

        // Глобальные координаты
        const globalRow = miniRow * 3 + cellRow;
        const globalCol = miniCol * 3 + cellCol;

        // Создаем данные о ходе
        const moveData = {
            cellIndex: cellIndex,
            mark: currentMark,
            activeMini: activeMini,
            globalRow: globalRow,
            globalCol: globalCol
        };

        // Добавляем ход в дерево
        window.movesTreeManager.addMove(moveData);

        // Обновляем для следующего хода
        activeMini = cellIndex;
        currentMark = currentMark === 'X' ? 'O' : 'X';
    });

    // Переходим к последнему ходу
    window.movesTreeManager.goToMainLineEnd();
}

// CSS стили для вариантов
const styles = `
<style>
.moves-list {
    font-family: monospace;
    font-size: 14px;
    padding: 10px;
    max-height: 400px;
    overflow-y: auto;
    overflow-x: auto;
}

.move-pair {
    display: flex;
    align-items: center;
    margin: 2px 0;
    min-height: 24px;
}

.move-number {
    color: #666;
    margin-right: 8px;
    min-width: 30px;
}

.move-item {
    padding: 2px 6px;
    margin: 0 4px;
    cursor: pointer;
    border-radius: 3px;
    transition: background-color 0.2s;
    white-space: nowrap;
}

.move-item:hover {
    background-color: #f0f0f0;
}

.move-item.current {
    background-color: #e3f2fd;
    font-weight: bold;
}

.variation-container {
    position: relative;
    margin: 2px 0;
}

.variation-line {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    padding: 2px 0;
    padding-left: 8px;
    border-left: 2px solid #ddd;
}

.nested-variation > .variation-line {
    border-left-color: #bbb;
}

.variation-container.nested-variation::before {
    content: '';
    position: absolute;
    left: -2px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom, #ddd 50%, transparent 50%);
    background-size: 2px 8px;
}

.variation-line .move-item {
    font-size: 13px;
    color: #555;
}

.variation-line .move-number {
    font-size: 13px;
}

.viewing-indicator {
    margin-top: 10px;
    padding: 8px;
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    text-align: center;
    font-size: 13px;
}

.moves-nav {
    display: flex;
    justify-content: center;
    gap: 5px;
    margin-top: 10px;
}

.moves-nav button {
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #ccc;
    background: #fff;
    cursor: pointer;
    border-radius: 4px;
}

.moves-nav button:hover:not(:disabled) {
    background: #f0f0f0;
}

.moves-nav button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.moves-nav button svg {
    width: 20px;
    height: 20px;
}

/* Предотвращаем перенос строк в вариантах */
.variation-line {
    white-space: nowrap;
}

/* Стиль для глубоко вложенных вариантов */
.variation-container[style*="margin-left: 60px"] .variation-line {
    border-left-style: dotted;
}

.variation-container[style*="margin-left: 80px"] .variation-line {
    border-left-style: dashed;
    opacity: 0.9;
}

.variation-container[style*="margin-left: 100px"] .variation-line {
    opacity: 0.8;
}
</style>
`;

// Добавляем стили в документ
document.head.insertAdjacentHTML('beforeend', styles);
