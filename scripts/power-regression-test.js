import assert from 'node:assert/strict';
import {
  applyPeekPower,
  applyShufflePower,
  applySwapPower,
  clearGlitching,
  clearPeekPower,
  getBlockedPlayerIndex,
  getNextPlayerIndex,
  isPeekVisibleToLocalPlayer
} from '../src/game/powers.js';

function createCard(id, iconIndex, overrides = {}) {
  return {
    id,
    iconIndex,
    isFlipped: false,
    isMatched: false,
    isGlitching: false,
    peekedBy: null,
    ...overrides
  };
}

function reverse(items) {
  return [...items].reverse();
}

const baseCards = [
  createCard('a', 1),
  createCard('b', 2),
  createCard('c', 3),
  createCard('d', 4),
  createCard('e', 5, { isMatched: true }),
  createCard('f', 6, { isFlipped: true })
];

const peekedCards = applyPeekPower(baseCards, 0, reverse);
const revealedToPlayer = peekedCards.filter((card) => card.peekedBy === 0);
assert.equal(revealedToPlayer.length, 3);
assert.ok(revealedToPlayer.every((card) => card.isGlitching));
assert.ok(revealedToPlayer.every((card) => isPeekVisibleToLocalPlayer(card, 0)));
assert.ok(revealedToPlayer.every((card) => !isPeekVisibleToLocalPlayer(card, 1)));

const clearedPeekCards = clearPeekPower(peekedCards, revealedToPlayer.map((card) => card.id));
assert.ok(clearedPeekCards.every((card) => card.peekedBy === null || card.peekedBy === undefined));
assert.ok(clearedPeekCards.every((card) => !card.isGlitching));

const shuffledCards = applyShufflePower(baseCards, reverse);
assert.deepEqual(
  shuffledCards.filter((card) => !card.isMatched && !card.isFlipped).map((card) => card.iconIndex),
  [4, 3, 2, 1]
);
assert.ok(shuffledCards.filter((card) => !card.isMatched && !card.isFlipped).every((card) => card.isGlitching));

const clearedShuffleCards = clearGlitching(shuffledCards);
assert.ok(clearedShuffleCards.every((card) => !card.isGlitching));

const swappedCards = applySwapPower(baseCards);
assert.equal(swappedCards[0].iconIndex, 2);
assert.equal(swappedCards[1].iconIndex, 1);
assert.ok(swappedCards[0].isGlitching);
assert.ok(swappedCards[1].isGlitching);

assert.equal(getBlockedPlayerIndex(0), 1);
assert.equal(getBlockedPlayerIndex(1), 0);
assert.equal(getNextPlayerIndex(0), 1);
assert.equal(getNextPlayerIndex(1), 0);

console.log(JSON.stringify({ ok: true }));
