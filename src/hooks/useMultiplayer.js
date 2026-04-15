import { useState, useEffect, useRef, useCallback } from 'react';
import { Peer } from 'peerjs';

export function useMultiplayer() {
  const [peerId, setPeerId] = useState('');
  const [opponentId, setOpponentId] = useState('');
  // 'idle' | 'hosting' | 'connecting' | 'connected' | 'error'
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [isHost, setIsHost] = useState(false);
  
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const onDataCallback = useRef(null);

  useEffect(() => {
    if (peerRef.current) return;
    
    const generateShortId = () => {
       const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
       let result = '';
       for (let i = 0; i < 4; i++) {
         result += chars.charAt(Math.floor(Math.random() * chars.length));
       }
       return result;
    };
    
    const peer = new Peer('MH-' + generateShortId());
    peerRef.current = peer;
    
    peer.on('open', (id) => {
      setPeerId(id);
    });

    peer.on('connection', (conn) => {
      // Someone is connecting to us (We are Host)
      setConnectionStatus('connected');
      setOpponentId(conn.peer);
      setIsHost(true);
      connRef.current = conn;
      
      conn.on('data', (data) => {
        if (onDataCallback.current) {
          onDataCallback.current(data);
        }
      });
      
      conn.on('close', () => {
         setConnectionStatus('error');
      });
    });

    peer.on('error', (err) => {
      console.error('PeerJS Error:', err);
      setConnectionStatus('error');
    });

    return () => {
      if (peerRef.current) {
         peerRef.current.destroy();
         peerRef.current = null;
      }
    };
  }, []);

  const hostRoom = useCallback(() => {
    setConnectionStatus('hosting');
    setIsHost(true);
  }, []);

  const joinRoom = useCallback((targetId) => {
    setConnectionStatus('connecting');
    setIsHost(false);
    
    if (peerRef.current) {
      const conn = peerRef.current.connect(targetId);
      connRef.current = conn;
      
      conn.on('open', () => {
        setConnectionStatus('connected');
        setOpponentId(targetId);
      });
      
      conn.on('data', (data) => {
        if (onDataCallback.current) {
           onDataCallback.current(data);
        }
      });
      
      conn.on('error', () => {
         setConnectionStatus('error');
      });

      conn.on('close', () => {
         setConnectionStatus('error');
      });
    }
  }, []);
  
  const setOnData = useCallback((callback) => {
    onDataCallback.current = callback;
  }, []);

  const sendData = useCallback((data) => {
    if (connRef.current && connectionStatus === 'connected') {
      connRef.current.send(data);
    }
  }, [connectionStatus]);

  return {
    peerId,
    opponentId,
    connectionStatus,
    isHost,
    hostRoom,
    joinRoom,
    sendData,
    setOnData
  };
}
