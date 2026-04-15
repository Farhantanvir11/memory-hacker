import React, { useState } from 'react';
import Board from './components/Board';
import PlayerDashboard from './components/PlayerDashboard';
import Lobby from './components/Lobby';
import { useGameEngine } from './hooks/useGameEngine';
import { useMultiplayer } from './hooks/useMultiplayer';
import './index.css';

function App() {
  const [gameMode, setGameMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('join') ? '1v1' : 'menu';
  });
  
  const peerLogic = useMultiplayer();
  
  // Base gameEngine mode on internal logic
  let engineMode = 'ai';
  if (gameMode === '1v1' || gameMode === '1v1_host' || gameMode === '1v1_client') {
     engineMode = peerLogic.isHost ? '1v1_host' : '1v1_client';
  }

  const {
    cards,
    players,
    currentPlayerIndex,
    isGameStarted,
    winner,
    activeFogger,
    activeHack,
    startGame,
    handleCardClick,
    executePower
  } = useGameEngine(engineMode, peerLogic);

  const startSoloGame = () => {
    setGameMode('ai');
    startGame();
  };

  const startMultiplayer = () => {
    setGameMode('1v1');
  };

  return (
    <>
      <div className="scanline-overlay"></div>
      <div className="game-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        
        <header style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid var(--neon-cyan)' }}>
          <h1 className="glitch-effect" style={{ 
              margin: 0, 
              color: '#ffffff', 
              textShadow: '0 0 5px var(--neon-cyan), 0 0 15px var(--neon-cyan), 0 0 30px var(--neon-green), 0 0 45px var(--neon-green)',
              fontSize: '3.5rem',
              letterSpacing: '6px',
              fontWeight: '900'
          }}>
             MEMORY_HACKER.EXE
          </h1>
          <p style={{ margin: '5px 0 0 0', opacity: 0.7 }}>Sabotage your opponent. Hack their memory.</p>
        </header>

        {gameMode === 'menu' && (
           <div className="flex-center" style={{ flex: 1, flexDirection: 'column', gap: '20px' }}>
             <button className="start-btn" onClick={startSoloGame} style={{ width: '250px' }}>SOLO SYSTEM (vs AI)</button>
             <button className="start-btn" onClick={startMultiplayer} style={{ width: '250px', borderColor: 'var(--neon-magenta)', color: 'var(--neon-magenta)' }}>MULTIPLAYER (1v1)</button>
           </div>
        )}

        {gameMode === '1v1' && !isGameStarted && (
           <Lobby 
             onStartGame={startGame} 
             setGameMode={setGameMode} 
             peerLogic={peerLogic} 
           />
        )}

        {((gameMode === 'ai' || gameMode === '1v1') && isGameStarted) && (
          <>
            <PlayerDashboard 
              players={players} 
              currentPlayerIndex={currentPlayerIndex} 
              onUsePower={executePower}
              activeHack={activeHack}
            />
            <main style={{ flex: 1, display: 'flex', position: 'relative' }}>
              <Board 
                cards={cards.map(c => ({
                  ...c,
                  isFlipped: c.isFlipped || c.peekedBy === (engineMode === '1v1_client' ? 1 : 0)
                }))}
                onCardClick={handleCardClick}
                isFogMode={activeFogger !== null && activeFogger !== (engineMode === '1v1_client' ? 1 : 0)}
                isGameStarted={isGameStarted}
                winner={winner}
                onRestart={() => {
                   if (gameMode === 'ai' || (gameMode === '1v1' && peerLogic.isHost)) {
                       startGame();
                   } else {
                       // Client waits for host
                   }
                }}
              />
            </main>
          </>
        )}
        
      </div>
    </>
  );
}

export default App;
