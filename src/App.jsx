import React, { useState } from 'react';
import Board from './components/Board';
import PlayerDashboard from './components/PlayerDashboard';
import Lobby from './components/Lobby';
import { useGameEngine } from './hooks/useGameEngine';
import { useGameAudio } from './hooks/useGameAudio';
import { useMultiplayer } from './hooks/useMultiplayer';
import { isPeekVisibleToLocalPlayer } from './game/powers';
import './index.css';

function App() {
  const [gameMode, setGameMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('join') ? '1v1' : 'menu';
  });
  
  const peerLogic = useMultiplayer();
  const audioControls = useGameAudio();
  
  // Base gameEngine mode on internal logic
  let engineMode = 'ai';
  if (gameMode === '1v1' || gameMode === '1v1_host' || gameMode === '1v1_client') {
     engineMode = peerLogic.isHost ? '1v1_host' : '1v1_client';
  }
  const localPlayerIndex = engineMode === '1v1_client' ? 1 : 0;

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
  } = useGameEngine(engineMode, peerLogic, audioControls);

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
      <div className="game-shell">
        
        <header className="game-header">
          <h1 className="glitch-effect game-title">
             MEMORY_HACKER.EXE
          </h1>
          <p className="game-subtitle">Sabotage your opponent. Hack their memory.</p>
        </header>

        {gameMode === 'menu' && (
           <div className="menu-screen flex-center">
             <button className="start-btn menu-btn" onClick={startSoloGame}>SOLO SYSTEM (vs AI)</button>
             <button className="start-btn menu-btn menu-btn-alt" onClick={startMultiplayer}>MULTIPLAYER (1v1)</button>
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
            <main className="game-main">
              <Board 
                cards={cards.map(c => ({
                  ...c,
                  isFlipped: isPeekVisibleToLocalPlayer(c, localPlayerIndex)
                }))}
                onCardClick={handleCardClick}
                isFogMode={activeFogger !== null && activeFogger !== localPlayerIndex}
                isGameStarted={isGameStarted}
                winner={winner}
                onRestart={() => {
                   if (gameMode === 'ai' || gameMode === '1v1') {
                     startGame();
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
