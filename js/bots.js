// ============================================================
// BOT AI - Easy / Normal / Hard
// ============================================================

function botChooseCard(hand, topCard, currentColor, rules, difficulty, opponents) {
  const playable = UnoEngine.getPlayableCards(hand, topCard, currentColor, rules);
  if (playable.length === 0) return null;

  if (difficulty === 'easy') {
    // Random legal
    return playable[Math.floor(Math.random() * playable.length)];
  }

  // Prefer action cards and matching color
  const byColor = playable.filter(c => c.color === currentColor);
  const actions = playable.filter(c => c.type === 'action' || c.type === 'wild');
  const numbers = playable.filter(c => c.type === 'number');

  if (difficulty === 'normal') {
    // Prefer same color, then actions, then any
    if (byColor.length) return byColor[Math.floor(Math.random() * byColor.length)];
    if (actions.length) return actions[Math.floor(Math.random() * actions.length)];
    return playable[Math.floor(Math.random() * playable.length)];
  }

  // HARD
  // 1. If someone has 1 card, try to punish with draw/skip
  const someoneUno = opponents.some(o => o.cardCount === 1);
  if (someoneUno) {
    const punish = playable.find(c => c.value === 'draw2' || c.value === 'wild4' || c.value === 'skip');
    if (punish) return punish;
  }

  // 2. Prefer keeping wilds for later unless only option
  const nonWild = playable.filter(c => c.type !== 'wild');
  if (nonWild.length) {
    // Prefer high numbers or actions of current color
    const good = nonWild.filter(c => c.color === currentColor);
    if (good.length) {
      // Prefer actions
      const act = good.find(c => c.type === 'action');
      if (act) return act;
      return good.sort((a, b) => Number(b.value) - Number(a.value))[0];
    }
    // Change color to one we have most of
    const colorCount = {};
    hand.forEach(c => { if (c.color) colorCount[c.color] = (colorCount[c.color] || 0) + 1; });
    const bestColor = Object.entries(colorCount).sort((a, b) => b[1] - a[1])[0]?.[0];
    const change = nonWild.find(c => c.color === bestColor);
    if (change) return change;
    return nonWild[0];
  }

  // Only wilds left
  return playable[0];
}

function botChooseWildColor(hand) {
  const colorCount = { red: 0, blue: 0, green: 0, yellow: 0 };
  hand.forEach(c => {
    if (c.color) colorCount[c.color]++;
  });
  return Object.entries(colorCount).sort((a, b) => b[1] - a[1])[0][0];
}

function botShouldCallUno(hand) {
  return hand.length === 1;
}

// Run a full bot turn (returns new state or null if cannot act)
function runBotTurn(state, seat) {
  const player = state.players.find(p => p.seat === seat);
  if (!player || !player.isBot) return null;

  const top = state.discardPile[state.discardPile.length - 1];
  const opponents = state.players.filter(p => p.seat !== seat);

  // Handle pending draws first
  if (state.pendingDraw > 0) {
    // Can we stack?
    if (state.rules.stackDraw) {
      const stackCard = player.hand.find(c => 
        (c.value === 'draw2' && top.value === 'draw2') ||
        (c.value === 'wild4')
      );
      if (stackCard) {
        let color = null;
        if (stackCard.type === 'wild') color = botChooseWildColor(player.hand);
        let next = UnoEngine.applyCardEffect(stackCard, state, color);
        // Remove from hand
        next.players = next.players.map(p => {
          if (p.seat === seat) {
            const hand = p.hand.filter(c => c !== stackCard);
            return { ...p, hand, cardCount: hand.length };
          }
          return p;
        });
        return next;
      }
    }
    // Must draw
    let next = UnoEngine.drawCards(state, seat, state.pendingDraw);
    next.pendingDraw = 0;
    // Advance turn after forced draw
    const n = next.players.length;
    next.currentSeat = (seat + next.direction + n) % n;
    return next;
  }

  const card = botChooseCard(player.hand, top, state.currentColor, state.rules, player.botDifficulty || 'normal', opponents);

  if (!card) {
    // Draw
    let next = UnoEngine.drawCards(state, seat, 1);
    const drawn = next.players.find(p => p.seat === seat).hand.slice(-1)[0];
    // If force play / draw until playable
    if (state.rules.drawUntilPlayable || state.rules.forcePlay) {
      while (!UnoEngine.isPlayable(drawn, top, state.currentColor, state.rules) && next.drawPile.length > 0) {
        next = UnoEngine.drawCards(next, seat, 1);
      }
    }
    // Check if can play the drawn card
    const newHand = next.players.find(p => p.seat === seat).hand;
    const playableDrawn = UnoEngine.getPlayableCards(newHand, top, state.currentColor, state.rules);
    if (playableDrawn.length && (state.rules.forcePlay || !state.rules.allowDrawWithPlayable)) {
      // Play it (simple: play first)
      const toPlay = playableDrawn[0];
      let color = null;
      if (toPlay.type === 'wild') color = botChooseWildColor(newHand);
      next = UnoEngine.applyCardEffect(toPlay, next, color);
      next.players = next.players.map(p => {
        if (p.seat === seat) {
          const hand = p.hand.filter(c => c !== toPlay);
          return { ...p, hand, cardCount: hand.length, unoCalled: hand.length === 1 };
        }
        return p;
      });
    } else {
      // Just drawn, advance turn
      const n = next.players.length;
      next.currentSeat = (seat + next.direction + n) % n;
    }
    return next;
  }

  // Play the card
  let color = null;
  if (card.type === 'wild') color = botChooseWildColor(player.hand);

  let next = UnoEngine.applyCardEffect(card, state, color);
  next.players = next.players.map(p => {
    if (p.seat === seat) {
      const hand = p.hand.filter(c => c !== card);
      const uno = hand.length === 1;
      return { ...p, hand, cardCount: hand.length, unoCalled: uno };
    }
    return p;
  });

  // Winner check later
  return next;
}

window.BotAI = {
  botChooseCard,
  botChooseWildColor,
  botShouldCallUno,
  runBotTurn
};
