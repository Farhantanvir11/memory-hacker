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

  const initializePeer = useCallback(() => {
    if (peerRef.current) return;

    const generateShortId = () => {
       const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
       let result = '';
       for (let i = 0; i < 4; i++) {
         result += chars.charAt(Math.floor(Math.random() * chars.length));
       }
       return result;
    };
    
    // Safely enforce STUN explicitly for Vercel, omitting broken explicit host overrides
    const peer = new Peer('MH-' + generateShortId(), {
      pingInterval: 5000,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });
    
    peerRef.current = peer;
    
    peer.on('open', (id) => {
      setPeerId(id);
    });

    peer.on('connection', (conn) => {
      connRef.current = conn;
      
      const establishConnection = () => {
        setConnectionStatus('connected');
        setOpponentId(conn.peer);
        setIsHost(true);
      };

      if (conn.open) {
        establishConnection();
      } else {
        conn.on('open', establishConnection);
      }
      
      conn.on('data', (data) => {
        if (onDataCallback.current) {
          onDataCallback.current(data);
        }
      });
      
      conn.on('close', () => {
         setConnectionStatus('error');
      });
    });

    peer.on('disconnected', () => {
      console.log('Peer disconnected from server, attempting to reconnect...');
      peer.reconnect();
    });

    peer.on('error', (err) => {
      console.error('PeerJS Error:', err);
      if (err.type === 'peer-unavailable' || err.type === 'network') {
         setConnectionStatus('error');
      }
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (peerRef.current) {
         peerRef.current.destroy();
         peerRef.current = null;
      }
    };
  }, []);

  const hostRoom = useCallback(() => {
    initializePeer();
    setConnectionStatus('hosting');
    setIsHost(true);
  }, [initializePeer]);

  const joinRoom = useCallback((targetId) => {
    initializePeer();
    setConnectionStatus('connecting');
    setIsHost(false);
    
    // Wait slightly to ensure Peer is constructed in memory before connecting
    setTimeout(() => {
        if (peerRef.current) {
          if (peerRef.current.disconnected) {
            peerRef.current.reconnect();
          }
          
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
    }, 100);
  }, [initializePeer]);
  
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
