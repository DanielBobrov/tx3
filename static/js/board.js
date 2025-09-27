// Ultimate Tic-Tac-Toe board: 9x9 (3x3 мини-доски по 3x3)
(function () {
    class Board {
        constructor(root, opts = {}) {
            this.el = typeof root === 'string' ? document.querySelector(root) : root;
            if (!this.el) throw new Error('Board root not found');
            this.onMove = opts.onMove || null;
            this.myMark = (opts.myMark === 'O') ? 'O' : 'X';
            this.activeMini = (typeof opts.activeMini === 'number') ? opts.activeMini : -1;
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

        setState(grid, pgn) {
            if (typeof grid === 'string' && grid.length === 81) {
                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        const ch = grid[r * 9 + c];
                        this.setMark(r, c, (ch === 'X' || ch === 'O') ? ch : '');
                    }
                }
                return;
            }
            if (Array.isArray(grid) && grid.length === 9) {
                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        const ch = grid[r]?.[c];
                        this.setMark(r, c, (ch === 'X' || ch === 'O') ? ch : '');
                    }
                }
            }

            let cellIndex = pgn[pgn.length - 1];
            let _pgn = "4" + pgn;
            let last_move = _pgn[_pgn.length - 2];
            console.log("cellIndex:", cellIndex);
            console.log("_pgn:", _pgn);
            console.log("last_move:", last_move);
            console.log("THIS:", this);
            // Вычисляем координаты
            const miniRow = Math.floor(last_move / 3);
            console.log("miniRow:", miniRow);
            const miniCol = last_move % 3;
            console.log("miniCol:", miniCol);
            const cellRow = Math.floor(cellIndex / 3);
            console.log("cellRow:", cellRow);
            const cellCol = cellIndex % 3;
            console.log("cellCol:", cellCol);

            // Глобальные координаты
            const globalRow = miniRow * 3 + cellRow;
            const globalCol = miniCol * 3 + cellCol;

            this.highlightLast(globalRow, globalCol);
            console.log(globalRow, globalCol);
        }

        setActiveMini(idx) {
            this.activeMini = (typeof idx === 'number') ? idx : -1;

            this.minis.forEach((mini, i) => {
                // Определяем, каким должно быть состояние для ЭТОЙ конкретной доски
                const shouldBeActive = (this.activeMini !== -1 || i === this.activeMini);
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
                console.error("CLICKED");
                const cell = e.target.closest('.cell');
                if (!cell || !this.el.contains(cell)) return;

                const r = +cell.dataset.row;
                const c = +cell.dataset.col;
                const mini = +cell.dataset.mini;

                if (this.activeMini !== -1 && mini !== this.activeMini) return;
                if (this.getMark(r, c)) return;

                const snapshot = this.serialize();

                // Оптимистично ставим метку
                // this.setMark(r, c, this.myMark);
                // this.highlightLast(r, c);

                if (this.onMove) {
                    try {
                        const res = await this.onMove({row: r, col: c, mini, mark: this.myMark});
                        const ok = typeof res === 'boolean' ? res : (res && (res.ok ?? res.legal ?? true));
                        if (!ok) {
                            this.setState(snapshot);
                            this.clearHighlights();
                        } else {
                            // Можно принять вспомогательные данные от сервера (например, следующий активный мини)
                            if (res && typeof res.nextMini === 'number') this.setActiveMini(res.nextMini);
                            if (res && res.miniWin) this.setMiniWin(res.miniWin.index, res.miniWin.mark);
                        }
                    } catch (err) {
                        console.error('onMove error', err);
                        this.setState(snapshot);
                        this.clearHighlights();
                    }
                }
            });
        }
    }

    window.Board = Board;
})();

