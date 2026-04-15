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
      
      const establishHostConnection = () => {
        setConnectionStatus('connected');
        setOpponentId(conn.peer);
        setIsHost(true);
        // Backup heartbeat sync to ensure Client connects
        conn.send({ type: 'SYS_ACK' });
      };

      if (conn.open) {
         establishHostConnection();
      } else {
         conn.on('open', establishHostConnection);
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
        // Intercept explicit host verification
        if (data && data.type === 'SYS_ACK') {
           setConnectionStatus('connected');
           setOpponentId(targetId);
           return;
        }

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
