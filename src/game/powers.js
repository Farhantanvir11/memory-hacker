export function getNextPlayerIndex(currentPlayerIndex) {
  return currentPlayerIndex === 0 ? 1 : 0;
}

export function getBlockedPlayerIndex(currentPlayerIndex) {
  return getNextPlayerIndex(currentPlayerIndex);
}

export function isPeekVisibleToLocalPlayer(card, localPlayerIndex) {
  return Boolean(card.isFlipped || card.peekedBy === localPlayerIndex);
}

export function applyPeekPower(cards, peekerIndex, randomize = defaultRandomize) {
  const unmatched = cards.filter((card) => !card.isMatched && !card.isFlipped);
  const peekCards = randomize(unmatched).slice(0, 3);
  const peekedCardIds = new Set(peekCards.map((card) => card.id));

  return cards.map((card) =>
    peekedCardIds.has(card.id)
      ? { ...card, peekedBy: peekerIndex, isGlitching: true }
      : card
  );
}

export function clearPeekPower(cards, peekedCardIds) {
  const ids = new Set(peekedCardIds);
  return cards.map((card) =>
    ids.has(card.id) ? { ...card, peekedBy: null, isGlitching: false } : card
  );
}

export function applyShufflePower(cards, randomize = defaultRandomize) {
  const unmatched = cards.filter((card) => !card.isMatched && !card.isFlipped);
  const shuffled = randomize(unmatched);
  let shuffleIndex = 0;

  return cards.map((card) => {
    if (!card.isMatched && !card.isFlipped) {
      const shuffledCard = shuffled[shuffleIndex];
      shuffleIndex += 1;
      return { ...shuffledCard, isGlitching: true };
    }

    return card;
  });
}

export function clearGlitching(cards) {
  return cards.map((card) => ({ ...card, isGlitching: false }));
}

export function applySwapPower(cards) {
  const unmatched = cards.filter((card) => !card.isMatched && !card.isFlipped);
  if (unmatched.length < 2) {
    return cards;
  }

  const [firstCard, secondCard] = unmatched;

  return cards.map((card) => {
    if (card.id === firstCard.id) {
      return { ...card, iconIndex: secondCard.iconIndex, icon: secondCard.icon, isGlitching: true };
    }

    if (card.id === secondCard.id) {
      return { ...card, iconIndex: firstCard.iconIndex, icon: firstCard.icon, isGlitching: true };
    }

    return card;
  });
}

function defaultRandomize(cards) {
  return [...cards].sort(() => Math.random() - 0.5);
}
