document.addEventListener('DOMContentLoaded', () => {
  const init = window.INIT || {};
  const board = new ChessBoard('#gameBoard', {
    orientation: init.orientation || 'white',
    onMove: async ({ from, to }) => {
      // Подключи свою логику: валидация на сервере, UCI/SAN, и т.д.
      if (GAME.ws && GAME.ws.readyState === WebSocket.OPEN) {
        GAME.ws.send(JSON.stringify({ t: 'move', gameId: init.gameId, from, to }));
      }
      // Возвращай true/false, либо {legal:false} для отката
      return true;
    }
  });

  board.setPosition(init.initialFEN);

  // Простейший реестр "игры"
  const GAME = {
    ws: null,
    sendChat(msg) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ t: 'chat', gameId: init.gameId, msg }));
      }
    },
    applyMoveUci({ from, to }) {
      // простой локальный апдейт (сервер — источник истины)
      const snap = board.movePiece(from, to);
      return snap;
    },
    addMoveSAN(san) {
      const ol = document.getElementById('movesList');
      const li = document.createElement('li');
      li.textContent = san;
      ol.appendChild(li);
      li.scrollIntoView({ block: 'nearest' });
    }
  };
  window.GAME = GAME;

  // Подключение к WS, если нужно
  if (init.wsUrl) {
    try {
      GAME.ws = new WebSocket(init.wsUrl);
      GAME.ws.addEventListener('open', () => console.log('WS connected'));
      GAME.ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(ev.data);
        switch (msg.t) {
          case 'state':
            if (msg.fen) board.setPosition(msg.fen);
            if (msg.status) document.getElementById('gameStatus').textContent = msg.status;
            break;
          case 'move':
            if (msg.from && msg.to) GAME.applyMoveUci(msg);
            if (msg.san) GAME.addMoveSAN(msg.san);
            break;
          case 'chat':
            appendChatLine(msg.user, msg.text);
            break;
        }
      });
    } catch (e) {
      console.warn('WS error:', e);
    }
  }

  // Кнопки управления
  const btnDraw = document.getElementById('btnOfferDraw');
  const btnResign = document.getElementById('btnResign');
  const btnRematch = document.getElementById('btnRematch');
  btnDraw?.addEventListener('click', () => {
    GAME.ws?.send(JSON.stringify({ t: 'offer-draw', gameId: init.gameId }));
  });
  btnResign?.addEventListener('click', () => {
    GAME.ws?.send(JSON.stringify({ t: 'resign', gameId: init.gameId }));
  });
  btnRematch?.addEventListener('click', () => {
    GAME.ws?.send(JSON.stringify({ t: 'rematch', gameId: init.gameId }));
  });

  // Чат
  const chatLog = document.getElementById('chatLog');
  const chatMsg = document.getElementById('chatMsg');
  const chatSend = document.getElementById('chatSend');

  function appendChatLine(user, text) {
    const div = document.createElement('div');
    div.className = 'chat-line';
    const who = user?.name || user || 'Гость';
    div.innerHTML = `<span class="muted">${who}:</span> ${escapeHtml(text)}`;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  chatSend?.addEventListener('click', () => {
    const txt = (chatMsg.value || '').trim();
    if (!txt) return;
    appendChatLine('Вы', txt);
    GAME.sendChat(txt);
    chatMsg.value = '';
  });

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
  }
});