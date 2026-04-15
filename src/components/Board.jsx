import React from 'react';
import Card from './Card';
import './Board.css';

export default function Board({ cards, onCardClick, isFogMode, isGameStarted, winner, onRestart }) {
  
  return (
    <div className={`board-wrapper ${isFogMode ? 'blur-effect' : ''}`}>
      {!isGameStarted && !winner && (
        <div className="board-overlay">
          <h2 className="overlay-text glitch-effect">SYSTEM READY</h2>
          <button className="start-btn" onClick={onRestart}>INITIALIZE</button>
        </div>
      )}
      
      {winner && (
        <div className="board-overlay">
          <h2 className="overlay-text glow-cyan">
            {winner === 'Draw' ? 'stalemate()' : `${winner} hacked the system!`}
          </h2>
          <button className="start-btn" onClick={onRestart}>REBOOT</button>
        </div>
      )}

      <div className="board-grid">
        {cards.map((card) => (
          <Card key={card.id} card={card} onClick={onCardClick} />
        ))}
      </div>
    </div>
  );
}
