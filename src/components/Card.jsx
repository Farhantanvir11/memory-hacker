import React from 'react';
import './Card.css';

// We receive the Icon component as a prop
export default function Card({ card, onClick }) {
  const { isFlipped, isMatched, icon: Icon, isGlitching } = card;

  // Determine classes
  let containerClasses = 'card-container';
  if (isFlipped) containerClasses += ' flipped';
  if (isMatched) containerClasses += ' matched';
  if (isGlitching) containerClasses += ' glitching';

  return (
    <div className={containerClasses} onClick={() => onClick(card)}>
      <div className="card-inner">
        <div className="card-front">
          {Icon && <Icon className="card-icon" size={40} strokeWidth={1.5} />}
        </div>
        <div className="card-back"></div>
      </div>
    </div>
  );
}
