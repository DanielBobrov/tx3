// Простой класс доски: FEN -> отрисовка, клики по клеткам, подсветки, onMove-хук
(function () {
  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  class ChessBoard {
    constructor(root, opts = {}) {
      this.el = typeof root === 'string' ? document.querySelector(root) : root;
      if (!this.el) throw new Error('ChessBoard root not found');
      this.orientation = opts.orientation || (this.el.getAttribute('data-orientation') || 'white');
      this.onMove = opts.onMove || null; // async ({from,to,piece}) => { return true|false|{legal:boolean} }
      this.selected = null;
      this.mapSquares();
      this.attachHandlers();
    }

    mapSquares() {
      this.sq = {};
      this.el.querySelectorAll('.square').forEach(s => {
        this.sq[s.dataset.square] = s;
      });
    }

    getPiece(square) {
      const el = this.sq[square]?.querySelector('.piece');
      return el?.dataset.piece || null;
    }
    setPiece(square, code) {
      const el = this.sq[square]?.querySelector('.piece');
      if (!el) return;
      if (code) el.dataset.piece = code; else delete el.dataset.piece;
    }

    clear() {
      Object.keys(this.sq).forEach(sq => this.setPiece(sq, null));
    }

    setPosition(fen) {
      if (!fen || fen === 'startpos') fen = START_FEN;
      const [board] = fen.trim().split(/\s+/);
      this.clear();
      const rows = board.split('/');
      // DOM порядок зависит от ориентации, но адреса клеток одинаковые — просто расставим по координатам
      let rank = 8;
      for (const row of rows) {
        let fileIndex = 0;
        for (const ch of row) {
          if (/\d/.test(ch)) {
            fileIndex += parseInt(ch, 10);
          } else {
            const file = 'abcdefgh'[fileIndex];
            const isWhite = ch === ch.toUpperCase();
            const code = (isWhite ? 'w' : 'b') + ch.toUpperCase();
            this.setPiece(file + rank, code);
            fileIndex++;
          }
        }
        rank--;
      }
    }

    movePiece(from, to) {
      const piece = this.getPiece(from);
      if (!piece) return false;
      const snapshot = this.serialize();
      // simple move
      this.setPiece(to, piece);
      this.setPiece(from, null);
      this.highlightLastMove(from, to);
      return snapshot;
    }

    serialize() {
      const pos = {};
      for (const sq of Object.keys(this.sq)) {
        const p = this.getPiece(sq);
        if (p) pos[sq] = p;
      }
      return pos;
    }
    loadSerialized(pos) {
      this.clear();
      Object.entries(pos).forEach(([sq, p]) => this.setPiece(sq, p));
    }

    clearHighlights() {
      this.el.querySelectorAll('.square.highlight, .square.selected').forEach(s => {
        s.classList.remove('highlight', 'selected');
      });
    }
    highlightLastMove(from, to) {
      this.clearHighlights();
      this.sq[from]?.classList.add('highlight');
      this.sq[to]?.classList.add('highlight');
    }

    attachHandlers() {
      this.el.addEventListener('click', async (e) => {
        const squareEl = e.target.closest('.square');
        if (!squareEl) return;
        const square = squareEl.dataset.square;

        if (!this.selected) {
          // Выбор клетки-источника
          if (!this.getPiece(square)) return; // пусто — игнор
          this.selected = square;
          squareEl.classList.add('selected');
          return;
        }

        const from = this.selected;
        const to = square;
        this.selected = null;
        this.el.querySelectorAll('.square.selected').forEach(el => el.classList.remove('selected'));
        if (from === to) return;

        const snapshot = this.movePiece(from, to);

        if (this.onMove) {
          try {
            const res = await this.onMove({ from, to, piece: this.getPiece(to) });
            const legal = typeof res === 'boolean' ? res : (res && res.legal !== undefined ? res.legal : true);
            if (!legal) {
              // откат
              this.loadSerialized(snapshot);
              this.clearHighlights();
            }
          } catch (err) {
            this.loadSerialized(snapshot);
            this.clearHighlights();
            console.error('onMove error:', err);
          }
        }
      });
    }
  }

  window.ChessBoard = ChessBoard;
  window.START_FEN = START_FEN;
})();