import React, { useState } from 'react';
import './Lobby.css'; // Just creating some basic styles
import { useMultiplayer } from '../hooks/useMultiplayer';
import { Copy, Check } from 'lucide-react';

export default function Lobby({ onStartGame, setGameMode, peerLogic }) {
  const [joinId, setJoinId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') || '';
  });
  const [copied, setCopied] = useState(false);
  
  const {
    peerId,
    opponentId,
    connectionStatus,
    hostRoom,
    joinRoom
  } = peerLogic;

  // Auto-connect if URL parameter exists
  React.useEffect(() => {
    if (joinId && connectionStatus === 'idle') {
       joinRoom(joinId);
    }
  }, [joinId, connectionStatus, joinRoom]);

  const copyToClipboard = () => {
    if (!peerId) return;
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // We are connected and ready to start
  if (connectionStatus === 'connected') {
    return (
      <div className="lobby-container flex-center">
        <div className="lobby-panel">
          <h2 className="glow-cyan">LINK ESTABLISHED</h2>
          <p>Connected to: {opponentId}</p>
          {peerLogic.isHost ? (
             <button className="start-btn" onClick={() => onStartGame(true)}>INITIALIZE MATCH</button>
          ) : (
             <p className="glow-magenta glitch-effect">WAITING FOR HOST TO INITIALIZE...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-container flex-center">
      <div className="lobby-panel">
        <h2 className="glow-green">MULTIPLAYER TERMINAL</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
           <p style={{ margin: 0 }}>Your System ID: <span className="highlight-id">{peerId || 'Generating...'}</span></p>
           {peerId && (
             <button 
               onClick={copyToClipboard} 
               style={{ background: 'transparent', border: '1px solid var(--neon-cyan)', color: 'var(--neon-cyan)', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
               title="Copy to clipboard"
             >
               {copied ? <Check size={16} color="var(--neon-green)" /> : <Copy size={16} />}
             </button>
           )}
        </div>
        
        <div className="lobby-actions">
          <div className="action-box">
            <h3>HOST LINK</h3>
            <button className="lobby-btn" onClick={hostRoom} disabled={!peerId || connectionStatus === 'hosting'}>
              {connectionStatus === 'hosting' ? 'AWAITING CONNECTION...' : 'OPEN PORT (CREATE ROOM)'}
            </button>
          </div>

          <div className="action-divider"><span>OR</span></div>

          <div className="action-box">
             <h3>CONNECT TO HOST</h3>
             <input 
               type="text" 
               className="hacker-input" 
               placeholder="ENTER TARGET ID" 
               value={joinId}
               onChange={(e) => setJoinId(e.target.value.toUpperCase().replace(/\s/g, ''))}
               style={{ textTransform: 'uppercase' }}
             />
             <button className="lobby-btn connect-btn" onClick={() => joinRoom(joinId.trim())} disabled={!joinId}>
               ESTABLISH LINK (JOIN ROOM)
             </button>
          </div>
        </div>
        
        {connectionStatus === 'connecting' && <p className="status-msg">Attempting handshake...</p>}
        {connectionStatus === 'error' && <p className="status-msg error-msg">Connection failed. Verify ID.</p>}
        
        <button className="back-btn" onClick={() => setGameMode('menu')}>← ABORT ROUTINE</button>
      </div>
    </div>
  );
}
