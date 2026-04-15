import { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal, Shield, Cpu, Code, Database, Bug, Wifi, Lock, Unlock, Server } from 'lucide-react';

const ICONS = [Terminal, Shield, Cpu, Code, Database, Bug, Wifi, Lock, Unlock, Server];

// Generate an initial deck of 20 cards (10 pairs)
const generateDeck = () => {
  const deck = [];
  ICONS.forEach((icon, index) => {
    // Add two of each card
    deck.push({ id: `card-${index}-a`, iconIndex: index, isFlipped: false, isMatched: false, isGlitching: false, icon });
    deck.push({ id: `card-${index}-b`, iconIndex: index, isFlipped: false, isMatched: false, isGlitching: false, icon });
  });

  // Shuffle randomly
  return deck.sort(() => Math.random() - 0.5);
};

export function useGameEngine(gameMode, peerLogic) {
  const [cards, setCards] = useState([]);

  // Define players dynamically based on mode
  const [players, setPlayers] = useState([
    { id: 'p1', name: 'Player 1', score: 0, powers: { shuffle: 1, peek: 1, block: 1, swap: 1, fog: 1 } },
    { id: 'p2', name: gameMode === 'ai' ? 'AI_BOT' : 'Player 2', score: 0, powers: { shuffle: 1, peek: 1, block: 1, swap: 1, fog: 1 } }
  ]);

  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState([]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [winner, setWinner] = useState(null);

  const [activeHack, setActiveHack] = useState(null);
  const [activeFogger, setActiveFogger] = useState(null);

  const [isLocked, setIsLocked] = useState(false);

  const { sendData, setOnData, isHost } = peerLogic || {};

  // For debugging and internal state diffing
  const stateRef = useRef(null);

  // Re-attach icons after serialization (icons are React components, can't be sent over network)
  const restoreIcons = (deck) => {
    if (!deck) return [];
    return deck.map(c => ({ ...c, icon: ICONS[c.iconIndex] }));
  };

  const stripIcons = (deck) => {
    if (!deck) return [];
    return deck.map(c => {
      const { icon, ...rest } = c;
      return rest;
    });
  };

  // Synchronize state if we are Host (1v1)
  const syncStateToClient = useCallback((newStateOverrides = {}) => {
    if (gameMode !== 'ai' && isHost && sendData) {
      setTimeout(() => {
        try {
          const cardsToSend = newStateOverrides.cards || stateRef.current.cards;
          sendData({
            type: 'STATE_SYNC',
            payload: {
              cards: stripIcons(cardsToSend),
              players: newStateOverrides.players || stateRef.current.players,
              currentPlayerIndex: newStateOverrides.currentPlayerIndex !== undefined ? newStateOverrides.currentPlayerIndex : stateRef.current.currentPlayerIndex,
              activeHack: newStateOverrides.activeHack !== undefined ? newStateOverrides.activeHack : stateRef.current.activeHack,
              activeFogger: newStateOverrides.activeFogger !== undefined ? newStateOverrides.activeFogger : stateRef.current.activeFogger,
              winner: newStateOverrides.winner !== undefined ? newStateOverrides.winner : stateRef.current.winner,
              isGameStarted: newStateOverrides.isGameStarted !== undefined ? newStateOverrides.isGameStarted : stateRef.current.isGameStarted
            }
          });
        } catch (e) {
          console.error('Failed to sync state:', e);
        }
      }, 50); // slight delay to ensure local state settled
    }
  }, [gameMode, isHost, sendData]);

  // Keep a ref to latest state for syncing
  useEffect(() => {
    stateRef.current = { cards, players, currentPlayerIndex, activeHack, activeFogger, isGameStarted, winner, flippedCards };
  }, [cards, players, currentPlayerIndex, activeHack, activeFogger, isGameStarted, winner, flippedCards]);

  // Handle incoming PeerJS messages
  useEffect(() => {
    if (setOnData && gameMode !== 'ai') {
      setOnData((data) => {
        if (data.type === 'STATE_SYNC' && !isHost) {
          const p = data.payload;
          setCards(restoreIcons(p.cards));
          setPlayers(p.players);
          setCurrentPlayerIndex(p.currentPlayerIndex);
          setActiveHack(p.activeHack);
          setActiveFogger(p.activeFogger);
          setWinner(p.winner);
          setIsGameStarted(p.isGameStarted);
        }
        else if (data.type === 'INTENT_START' && isHost) {
          startGame(true);
        }
        else if (data.type === 'INTENT_CLICK' && isHost) {
          const targetCard = stateRef.current.cards.find(c => c.id === data.payload.cardId);
          if (targetCard) handleCardClick(targetCard, true);
        }
        else if (data.type === 'INTENT_POWER' && isHost) {
          executePower(data.payload.playerId, data.payload.powerName, true);
        }
      });
    }
  }, [setOnData, gameMode, isHost]);

  // Initialize Game
  const startGame = useCallback((fromNetwork = false) => {
    if (gameMode !== 'ai' && !isHost && !fromNetwork) {
      sendData({ type: 'INTENT_START' });
      return;
    }

    const initialDeck = generateDeck();
    setCards(initialDeck);

    setPlayers([
      { id: 'p1', name: 'Player 1', score: 0, powers: { shuffle: 1, peek: 1, block: 1, swap: 1, fog: 1 } },
      { id: 'p2', name: gameMode === 'ai' ? 'AI_BOT' : 'Player 2', score: 0, powers: { shuffle: 1, peek: 1, block: 1, swap: 1, fog: 1 } }
    ]);

    setCurrentPlayerIndex(0);
    setFlippedCards([]);
    setWinner(null);
    setActiveHack(null);
    setActiveFogger(null);
    setIsLocked(false);
    setIsGameStarted(true);

    if (isHost) syncStateToClient({ cards: initialDeck, isGameStarted: true, currentPlayerIndex: 0 });
  }, [gameMode, isHost, syncStateToClient, sendData]);

  const handleCardClick = (clickedCard, fromNetwork = false) => {
    const currentState = stateRef.current;
    if (!currentState.isGameStarted || isLocked || currentState.activeHack) return;

    // Authorization check
    if (gameMode !== 'ai') {
      if (!isHost && currentState.currentPlayerIndex !== 1) return; // Client can only play as P2
      if (isHost && currentState.currentPlayerIndex !== 0 && !fromNetwork) return; // Host can only play as P1

      if (!isHost && !fromNetwork) {
        sendData({ type: 'INTENT_CLICK', payload: { cardId: clickedCard.id } });
        return;
      }
    }

    if (clickedCard.isFlipped || clickedCard.isMatched) return;
    if (currentState.flippedCards.length >= 2) return;

    // Flip the clicked card
    const updatedCards = currentState.cards.map(c =>
      c.id === clickedCard.id ? { ...c, isFlipped: true } : c
    );

    const newFlippedCards = [...currentState.flippedCards, clickedCard];

    // Prevent async race condition by updating ref synchronously
    stateRef.current.cards = updatedCards;
    stateRef.current.flippedCards = newFlippedCards;

    setCards(updatedCards);
    setFlippedCards(newFlippedCards);

    syncStateToClient({ cards: updatedCards });

    if (newFlippedCards.length === 2) {
      setIsLocked(true);

      const [firstCard, secondCard] = newFlippedCards;

      if (firstCard.iconIndex === secondCard.iconIndex) {
        setTimeout(() => {
          setCards(prev => {
            const nc = prev.map(c => (c.id === firstCard.id || c.id === secondCard.id) ? { ...c, isMatched: true } : c);
            stateRef.current.cards = nc;
            syncStateToClient({ cards: nc });
            return nc;
          });

          setPlayers(prev => {
            const newPlayers = [...prev];
            newPlayers[stateRef.current.currentPlayerIndex].score += 10;
            stateRef.current.players = newPlayers;
            syncStateToClient({ players: newPlayers });
            return newPlayers;
          });

          stateRef.current.flippedCards = [];
          setFlippedCards([]);
          setIsLocked(false);
        }, 800);
      } else {
        setTimeout(() => {
          setCards(prev => {
            const nc = prev.map(c => (c.id === firstCard.id || c.id === secondCard.id) ? { ...c, isFlipped: false } : c);
            stateRef.current.cards = nc;
            syncStateToClient({ cards: nc, currentPlayerIndex: stateRef.current.currentPlayerIndex === 0 ? 1 : 0 });
            return nc;
          });
          stateRef.current.flippedCards = [];
          setFlippedCards([]);
          setCurrentPlayerIndex(prev => {
            const nI = prev === 0 ? 1 : 0;
            stateRef.current.currentPlayerIndex = nI;
            return nI;
          });
          setIsLocked(false);
        }, 1200);
      }
    }
  };

  useEffect(() => {
    const totalScore = players.reduce((sum, p) => sum + p.score, 0);
    if (totalScore === 100 && isGameStarted) {
      let winStr = 'Draw';
      if (players[0].score > players[1].score) winStr = players[0].name;
      else if (players[1].score > players[0].score) winStr = players[1].name;

      setWinner(winStr);
      syncStateToClient({ winner: winStr });
    }
  }, [players, isGameStarted, syncStateToClient]);

  const executePower = (playerId, powerName, fromNetwork = false) => {
    const currentState = stateRef.current;
    if (isLocked) return;

    if (gameMode !== 'ai') {
      const isPlayer1 = currentState.players[0].id === playerId;
      if (!isHost && isPlayer1) return;
      if (isHost && !isPlayer1 && !fromNetwork) return;

      if (!isHost && !fromNetwork) {
        sendData({ type: 'INTENT_POWER', payload: { playerId, powerName } });
        return;
      }
    }

    if (currentState.players[currentState.currentPlayerIndex].powers[powerName] <= 0) return;

    setPlayers(prev => {
      const newP = [...prev];
      newP[currentState.currentPlayerIndex].powers[powerName] -= 1;
      syncStateToClient({ players: newP, activeHack: powerName });
      return newP;
    });

    setActiveHack(powerName);
    setIsLocked(true);

    if (powerName === 'shuffle') {
      setTimeout(() => {
        const unmatched = [...stateRef.current.cards].filter(c => !c.isMatched && !c.isFlipped);
        const shuffled = [...unmatched].sort(() => Math.random() - 0.5);

        let shuffleIdx = 0;
        const newDeck = stateRef.current.cards.map(c => {
          if (!c.isMatched && !c.isFlipped) {
            const sc = shuffled[shuffleIdx];
            shuffleIdx++;
            return { ...sc, isGlitching: true };
          }
          return c;
        });
        setCards(newDeck);
        syncStateToClient({ cards: newDeck });

        setTimeout(() => {
          setCards(prev => {
            const nc = prev.map(c => ({ ...c, isGlitching: false }));
            syncStateToClient({ cards: nc, activeHack: null });
            return nc;
          });
          setActiveHack(null);
          setIsLocked(false);
        }, 1500);
      }, 100);
    }
    else if (powerName === 'peek') {
      const unmatched = stateRef.current.cards.filter(c => !c.isMatched && !c.isFlipped);
      const peekCards = [...unmatched].sort(() => Math.random() - 0.5).slice(0, 3);

      const peekerIndex = (isHost && !fromNetwork) ? 0 : 1;

      setCards(prev => {
        const nc = prev.map(c => peekCards.find(pc => pc.id === c.id) ? { ...c, peekedBy: peekerIndex, isGlitching: true } : c);
        syncStateToClient({ cards: nc });
        return nc;
      });

      setTimeout(() => {
        setCards(prev => {
          const nc = prev.map(c => peekCards.find(pc => pc.id === c.id) ? { ...c, peekedBy: null, isGlitching: false } : c);
          syncStateToClient({ cards: nc, activeHack: null });
          return nc;
        });
        setActiveHack(null);
        setIsLocked(false);
      }, 2000);
    }
    else if (powerName === 'block') {
      setTimeout(() => {
        setActiveHack(null);
        setIsLocked(false);
        syncStateToClient({ activeHack: null });
      }, 1000);
    }
    else if (powerName === 'swap') {
      const unmatched = stateRef.current.cards.filter(c => !c.isMatched && !c.isFlipped);
      if (unmatched.length >= 2) {
        const c1 = unmatched[0];
        const c2 = unmatched[1];
        setCards(prev => {
          const nc = prev.map(c => {
            if (c.id === c1.id) return { ...c, iconIndex: c2.iconIndex, icon: c2.icon, isGlitching: true };
            if (c.id === c2.id) return { ...c, iconIndex: c1.iconIndex, icon: c1.icon, isGlitching: true };
            return c;
          });
          syncStateToClient({ cards: nc });
          return nc;
        });
        setTimeout(() => {
          setCards(prev => {
            const nc = prev.map(c => ({ ...c, isGlitching: false }));
            syncStateToClient({ cards: nc, activeHack: null });
            return nc;
          });
          setActiveHack(null);
          setIsLocked(false);
        }, 1000);
      } else {
        setActiveHack(null);
        setIsLocked(false);
        syncStateToClient({ activeHack: null });
      }
    }
    else if (powerName === 'fog') {
      const foggerIndex = (isHost && !fromNetwork) ? 0 : 1;
      setActiveFogger(foggerIndex);
      syncStateToClient({ activeFogger: foggerIndex, activeHack: null });
      setIsLocked(false);
      setActiveHack(null);
      setTimeout(() => {
        setActiveFogger(null);
        syncStateToClient({ activeFogger: null });
      }, 5000);
    }
  };

  // AI Logic remain unchanged, but restricted to AI mode
  useEffect(() => {
    if (gameMode === 'ai' && isGameStarted && currentPlayerIndex === 1 && !isLocked && !winner) {
      const timer = setTimeout(() => {
        if (Math.random() > 0.8) {
          const p2 = players[1];
          const availablePowers = Object.keys(p2.powers).filter(k => p2.powers[k] > 0);
          if (availablePowers.length > 0) {
            const randomPower = availablePowers[Math.floor(Math.random() * availablePowers.length)];
            executePower(p2.id, randomPower);
            return;
          }
        }

        const unFlipped = cards.filter(c => !c.isFlipped && !c.isMatched);
        if (unFlipped.length > 0) {
          const randomCard = unFlipped[Math.floor(Math.random() * unFlipped.length)];
          handleCardClick(randomCard);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentPlayerIndex, isLocked, isGameStarted, winner, cards, players, gameMode]);

  return {
    cards, players, currentPlayerIndex, isGameStarted, winner, activeFogger, activeHack,
    startGame, handleCardClick, executePower
  };
}
