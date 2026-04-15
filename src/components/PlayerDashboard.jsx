import React from 'react';
import './PlayerDashboard.css';
import { Shuffle, Eye, Ban, GitCompare, CloudFog } from 'lucide-react';

const powerIcons = {
  shuffle: Shuffle,
  peek: Eye,
  block: Ban,
  swap: GitCompare,
  fog: CloudFog
};

export default function PlayerDashboard({ players, currentPlayerIndex, onUsePower, activeHack }) {
  
  const renderPlayer = (player, index) => {
    const isActive = currentPlayerIndex === index;
    return (
      <div key={player.id} className={`player-info ${isActive ? 'active' : ''}`}>
        <div className="player-name">{player.name} {isActive && '[HACKING...]'}</div>
        <div className="player-score">{player.score} pts</div>
        
        <div className="powers-container">
          {Object.entries(player.powers).map(([powerKey, count]) => {
            if (count > 0) {
              const Icon = powerIcons[powerKey];
              return (
                <button 
                  key={powerKey} 
                  className="power-btn" 
                  title={`Use ${powerKey} hack`}
                  disabled={!isActive}
                  onClick={() => onUsePower(player.id, powerKey)}
                >
                  <Icon size={20} />
                  <span style={{ fontSize: '0.6rem', position: 'absolute', transform: 'translate(10px, 10px)' }}>
                    {count > 1 ? count : ''}
                  </span>
                </button>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="dashboard">
        {players.map(renderPlayer)}
      </div>
      <div className="active-hack-alert glitch-effect">
        {activeHack ? `WARNING: ${activeHack.toUpperCase()} INITIALIZED!` : ''}
      </div>
    </div>
  );
}
