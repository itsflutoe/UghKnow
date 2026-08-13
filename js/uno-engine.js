// ============================================================
// UGHKNOW ENGINE - Correct UNO logic
// ============================================================

const COLORS = ['red', 'blue', 'green', 'yellow'];
const ACTIONS = ['skip', 'reverse', 'draw2'];

let _cardUid = 0;
function uid() {
  return 'c' + (++_cardUid) + '_' + Math.random().toString(36).slice(2, 6);
}

function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    deck.push({ id: uid(), color, value: '0', type: 'number' });
    for (let n = 1; n <= 9; n++) {
      deck.push({ id: uid(), color, value: String(n), type: 'number' });
      deck.push({ id: uid(), color, value: String(n), type: 'number' });
    }
    for (const action of ACTIONS) {
      deck.push({ id: uid(), color, value: action, type: 'action' });
      deck.push({ id: uid(), color, value: action, type: 'action' });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: uid(), color: null, value: 'wild', type: 'wild' });
    deck.push({ id: uid(), color: null, value: 'wild4', type: 'wild' });
  }
  return shuffle(deck);
}

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isPlayable(card, topCard, currentColor) {
  if (!topCard) return true;
  if (card.type === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function getPlayableCards(hand, topCard, currentColor) {
  return hand.filter(c => isPlayable(c, topCard, currentColor));
}

function applyCardEffect(card, state, chosenColor = null) {
  const next = JSON.parse(JSON.stringify(state));
  next.discardPile.push(card);
  next.lastAction = { type: 'play', card, seat: state.currentSeat, color: chosenColor };

  if (card.type === 'wild') {
    next.currentColor = chosenColor || COLORS[Math.floor(Math.random() * 4)];
  } else {
    next.currentColor = card.color;
  }

  let skipNext = false;
  let drawCount = 0;
  let reverse = false;

  if (card.value === 'skip') skipNext = true;
  else if (card.value === 'reverse') {
    reverse = true;
    if (state.players.length === 2) skipNext = true;
  } else if (card.value === 'draw2') {
    drawCount = 2;
    skipNext = true;
  } else if (card.value === 'wild4') {
    drawCount = 4;
    skipNext = true;
  }

  if (reverse) next.direction *= -1;

  const n = next.players.length;
  let seat = state.currentSeat;

  if (skipNext) {
    seat = (seat + next.direction + n * 2) % n;
  } else {
    seat = (seat + next.direction + n) % n;
  }
  next.currentSeat = seat;

  if (state.rules && state.rules.stackDraw && (card.value === 'draw2' || card.value === 'wild4')) {
    next.pendingDraw = (state.pendingDraw || 0) + drawCount;
  } else {
    next.pendingDraw = drawCount;
  }

  return next;
}

function drawCards(state, seat, count) {
  const next = JSON.parse(JSON.stringify(state));
  const player = next.players.find(p => p.seat === seat);
  if (!player) return next;

  for (let i = 0; i < count; i++) {
    if (next.drawPile.length === 0) {
      if (next.discardPile.length <= 1) break;
      const top = next.discardPile.pop();
      next.drawPile = shuffle(next.discardPile);
      next.discardPile = [top];
    }
    if (next.drawPile.length === 0) break;
    const card = next.drawPile.pop();
    player.hand.push(card);
  }
  player.cardCount = player.hand.length;
  player.unoCalled = false;
  return next;
}

function createInitialState(playerConfigs, rules = {}) {
  _cardUid = 0;
  let deck = createDeck();
  const handSize = rules.startingHandSize || 7;

  const players = playerConfigs.map(pc => {
    const hand = deck.splice(0, handSize);
    return {
      seat: pc.seat,
      userId: pc.userId || null,
      username: pc.username || pc.botName || `Player ${pc.seat}`,
      isBot: !!pc.isBot,
      botName: pc.botName || null,
      botDifficulty: pc.botDifficulty || 'normal',
      hand,
      cardCount: hand.length,
      unoCalled: false
    };
  });

  let startCard;
  do {
    startCard = deck.pop();
  } while (startCard && startCard.type === 'wild');

  if (!startCard) {
    startCard = { id: uid(), color: 'red', value: '0', type: 'number' };
  }

  return {
    players,
    drawPile: deck,
    discardPile: [startCard],
    currentColor: startCard.color,
    currentSeat: 0,
    direction: 1,
    pendingDraw: 0,
    status: 'active',
    winnerSeat: null,
    lastAction: { type: 'start', card: startCard },
    rules: Object.assign({
      stackDraw: true,
      jumpIn: false,
      sevenO: false,
      forcePlay: false,
      drawUntilPlayable: false,
      allowDrawWithPlayable: true,
      startingHandSize: 7
    }, rules)
  };
}

function checkWinner(state) {
  for (const p of state.players) {
    if ((p.cardCount !== undefined && p.cardCount === 0) || (p.hand && p.hand.length === 0)) {
      return p.seat;
    }
  }
  return null;
}

window.UnoEngine = {
  createDeck,
  shuffle,
  isPlayable,
  getPlayableCards,
  applyCardEffect,
  drawCards,
  createInitialState,
  checkWinner,
  COLORS
};
