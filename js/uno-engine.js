// ============================================================
// CYBER UNO ENGINE - Pure game logic (client + used by bots)
// ============================================================

const COLORS = ['red', 'blue', 'green', 'yellow'];
const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const ACTIONS = ['skip', 'reverse', 'draw2'];
const WILDS = ['wild', 'wild4'];

function createDeck() {
  const deck = [];
  // Numbers
  for (const color of COLORS) {
    deck.push({ color, value: '0', type: 'number' });
    for (let n = 1; n <= 9; n++) {
      deck.push({ color, value: String(n), type: 'number' });
      deck.push({ color, value: String(n), type: 'number' });
    }
    // Actions
    for (const action of ACTIONS) {
      deck.push({ color, value: action, type: 'action' });
      deck.push({ color, value: action, type: 'action' });
    }
  }
  // Wilds
  for (let i = 0; i < 4; i++) {
    deck.push({ color: null, value: 'wild', type: 'wild' });
    deck.push({ color: null, value: 'wild4', type: 'wild' });
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

function cardId(card) {
  return `${card.color || 'w'}_${card.value}_${Math.random().toString(36).slice(2, 7)}`;
}

function isPlayable(card, topCard, currentColor, rules = {}) {
  if (!topCard) return true;
  if (card.type === 'wild') return true;

  // Jump-in (same card value+color) handled separately by caller if enabled
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function getPlayableCards(hand, topCard, currentColor, rules = {}) {
  return hand.filter(c => isPlayable(c, topCard, currentColor, rules));
}

function applyCardEffect(card, state, chosenColor = null) {
  const next = { ...state };
  next.discardPile = [...state.discardPile, card];
  next.lastAction = { type: 'play', card, seat: state.currentSeat };

  if (card.type === 'wild') {
    next.currentColor = chosenColor || COLORS[Math.floor(Math.random() * 4)];
  } else {
    next.currentColor = card.color;
  }

  let skipNext = false;
  let drawCount = 0;
  let reverse = false;

  if (card.value === 'skip') {
    skipNext = true;
  } else if (card.value === 'reverse') {
    reverse = true;
    if (state.players.length === 2) skipNext = true; // reverse acts as skip in 2p
  } else if (card.value === 'draw2') {
    drawCount = 2;
    skipNext = true;
  } else if (card.value === 'wild4') {
    drawCount = 4;
    skipNext = true;
  }

  if (reverse) {
    next.direction = state.direction * -1;
  }

  // Advance turn
  let nextSeat = state.currentSeat;
  const dir = next.direction;
  const n = state.players.length;

  if (skipNext) {
    nextSeat = (nextSeat + dir + n) % n;
    nextSeat = (nextSeat + dir + n) % n;
  } else {
    nextSeat = (nextSeat + dir + n) % n;
  }

  next.currentSeat = nextSeat;

  // Pending draw for next player (stacking handled externally if rules allow)
  next.pendingDraw = (state.pendingDraw || 0) + drawCount;

  return next;
}

function drawCards(state, seat, count) {
  const next = { ...state };
  next.drawPile = [...state.drawPile];
  next.players = state.players.map(p => ({ ...p, hand: [...p.hand] }));

  const player = next.players.find(p => p.seat === seat);
  if (!player) return next;

  for (let i = 0; i < count; i++) {
    if (next.drawPile.length === 0) {
      // Reshuffle discard except top
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
  // playerConfigs: [{seat, userId, isBot, botName, botDifficulty, username}]
  let deck = createDeck();
  const handSize = rules.startingHandSize || 7;

  const players = playerConfigs.map(pc => {
    const hand = deck.splice(0, handSize);
    return {
      seat: pc.seat,
      userId: pc.userId || null,
      username: pc.username || pc.botName || `Player ${pc.seat}`,
      isBot: !!pc.isBot,
      botName: pc.botName,
      botDifficulty: pc.botDifficulty || 'normal',
      hand,
      cardCount: hand.length,
      unoCalled: false
    };
  });

  // Start discard (must not be wild ideally)
  let startCard;
  do {
    startCard = deck.pop();
  } while (startCard && startCard.type === 'wild');

  if (!startCard) {
    // fallback
    startCard = { color: 'red', value: '0', type: 'number' };
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
    rules: { ...rules }
  };
}

// Check if player has won
function checkWinner(state) {
  for (const p of state.players) {
    if (p.hand.length === 0) {
      return p.seat;
    }
  }
  return null;
}

// Serialize for storage (remove full hands of others if needed)
function serializeState(state) {
  return JSON.parse(JSON.stringify(state));
}

// For bots and UI
window.UnoEngine = {
  createDeck,
  shuffle,
  isPlayable,
  getPlayableCards,
  applyCardEffect,
  drawCards,
  createInitialState,
  checkWinner,
  serializeState,
  COLORS,
  NUMBERS,
  ACTIONS,
  WILDS
};
