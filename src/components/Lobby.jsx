import React, { useState } from 'react';
import './Lobby.css'; // Just creating some basic styles
import { useMultiplayer } from '../hooks/useMultiplayer';
import { Copy, Check } from 'lucide-react';

export default function Lobby({ onStartGame, setGameMode, peerLogic }) {
  const [joinId, setJoinId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') || '';
  });
  const [lobbyMode, setLobbyMode] = useState('select'); // 'select', 'create', 'join'

  const {
    peerId,
    opponentId,
    connectionStatus,
    hostRoom,
    joinRoom
  } = peerLogic;

  React.useEffect(() => {
    if (lobbyMode === 'create' && connectionStatus !== 'hosting') {
      hostRoom();
    }
  }, [lobbyMode, hostRoom, connectionStatus]);

  React.useEffect(() => {
    if (connectionStatus !== 'idle' || !peerId) return;
    const params = new URLSearchParams(window.location.search);
    const urlJoinId = params.get('join');
    if (urlJoinId) {
       setLobbyMode('join');
       joinRoom(urlJoinId);
    }
  }, [connectionStatus, joinRoom, peerId]);

  const copyToClipboard = () => {
    if (!peerId) return;
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (connectionStatus === 'connected') {
    return (
      <div className="lobby-container flex-center">
        <div className="lobby-panel">
          <h2 className="glow-cyan">LINK ESTABLISHED</h2>
          <p>Connected to: <span className="highlight-id">{opponentId}</span></p>
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
        
        {lobbyMode === 'select' && (
          <div className="lobby-actions" style={{ flexDirection: 'column' }}>
            <button className="lobby-btn" onClick={() => setLobbyMode('create')}>CREATE ROOM</button>
            <button className="lobby-btn connect-btn" onClick={() => setLobbyMode('join')}>JOIN ROOM</button>
          </div>
        )}

        {lobbyMode === 'create' && (
          <div className="action-box" style={{ width: '100%' }}>
            <h3 className="glow-cyan">ROOM ESTABLISHED</h3>
            <p style={{ marginBottom: '10px' }}>Your System ID:</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '4px', border: '1px solid var(--neon-cyan)' }}>
               <h2 className="highlight-id" style={{ margin: 0, letterSpacing: '4px' }}>{peerId || 'Generating...'}</h2>
               {peerId && (
                 <button 
                   onClick={copyToClipboard} 
                   style={{ background: 'var(--neon-cyan)', border: 'none', color: '#000', cursor: 'pointer', padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', fontWeight: 'bold' }}
                 >
                   {copied ? 'COPIED!' : 'COPY'}
                 </button>
               )}
            </div>
            <p className="status-msg" style={{ marginTop: '20px' }}>AWAITING OPPONENT CONNECTION...</p>
          </div>
        )}

        {lobbyMode === 'join' && (
          <div className="action-box" style={{ width: '100%' }}>
             <h3>JOIN ROOM</h3>
             <input 
               type="text" 
               className="hacker-input" 
               placeholder="ENTER TARGET ID" 
               value={joinId}
               onChange={(e) => setJoinId(e.target.value.toUpperCase().replace(/\s/g, ''))}
               style={{ textTransform: 'uppercase', marginBottom: '15px' }}
             />
             <button className="lobby-btn connect-btn" onClick={() => joinRoom(joinId.trim())} disabled={!joinId}>
               ESTABLISH LINK
             </button>
             
             {connectionStatus === 'connecting' && <p className="status-msg" style={{ marginTop: '15px' }}>Attempting handshake...</p>}
             {connectionStatus === 'error' && <p className="status-msg error-msg" style={{ marginTop: '15px' }}>Connection failed. Verify ID.</p>}
          </div>
        )}

        <button className="back-btn" onClick={() => {
           if (lobbyMode === 'select') setGameMode('menu');
           else setLobbyMode('select');
        }} style={{ marginTop: '25px' }}>
          {lobbyMode === 'select' ? '← ABORT ROUTINE' : '← BACK TO TERMINAL'}
        </button>
      </div>
    </div>
  );
}
