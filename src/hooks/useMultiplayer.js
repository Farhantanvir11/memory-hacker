import { useState, useEffect, useRef, useCallback } from 'react';
import { Peer } from 'peerjs';

export function useMultiplayer() {
  const [peerId, setPeerId] = useState('');
  const [opponentId, setOpponentId] = useState('');
  // 'idle' | 'hosting' | 'connecting' | 'connected' | 'error'
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [isHost, setIsHost] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const onDataCallback = useRef(null);
  const destroyedRef = useRef(false);

  const generateShortId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const attachConnectionHandlers = useCallback((conn, nextIsHost, nextOpponentId) => {
    connRef.current = conn;
    setErrorMessage('');

    let openCheck = null;

    const establishConnection = () => {
      if (openCheck) clearInterval(openCheck);
      setConnectionStatus('connected');
      setOpponentId(nextOpponentId || conn.peer);
      setIsHost(nextIsHost);
    };

    if (conn.open) {
      establishConnection();
    } else {
      openCheck = setInterval(() => {
        if (conn.open) establishConnection();
      }, 100);
    }

    conn.on('open', establishConnection);

    conn.on('data', (data) => {
      if (onDataCallback.current) {
        onDataCallback.current(data);
      }
    });

    conn.on('error', (err) => {
      if (openCheck) clearInterval(openCheck);
      console.error('Connection error:', err);
      setErrorMessage(err?.message || 'Connection failed.');
      setConnectionStatus('error');
    });

    conn.on('close', () => {
      if (openCheck) clearInterval(openCheck);
      if (!destroyedRef.current) {
        setErrorMessage('Connection closed.');
        setConnectionStatus('error');
      }
    });

    return () => {
      if (openCheck) clearInterval(openCheck);
    };
  }, []);

  useEffect(() => {
    if (peerRef.current) return;
    destroyedRef.current = false;

    const peer = new Peer('MH-' + generateShortId(), {
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      pingInterval: 5000,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    });

    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      setErrorMessage('');
    });

    peer.on('connection', (conn) => {
      attachConnectionHandlers(conn, true, conn.peer);
    });

    peer.on('disconnected', () => {
      if (!destroyedRef.current && !peer.destroyed) {
        peer.reconnect();
      }
    });

    peer.on('error', (err) => {
      console.error('PeerJS Error:', err);
      setErrorMessage(err?.message || 'Peer connection failed.');
      setConnectionStatus('error');
    });

    return () => {
      destroyedRef.current = true;
      connRef.current?.close();
      peer.destroy();
      peerRef.current = null;
    };
  }, [attachConnectionHandlers]);

  const hostRoom = useCallback(() => {
    setConnectionStatus('hosting');
    setIsHost(true);
    setErrorMessage('');
  }, []);

  const joinRoom = useCallback((targetId) => {
    const cleanTargetId = targetId?.trim().toUpperCase();

    if (!cleanTargetId) {
      setErrorMessage('Invalid room ID.');
      return;
    }

    if (!peerRef.current || !peerRef.current.id) {
      setErrorMessage('Network peer is still starting. Try again in a moment.');
      return;
    }

    connRef.current?.close();

    setConnectionStatus('connecting');
    setIsHost(false);
    setErrorMessage('');

    const conn = peerRef.current.connect(cleanTargetId, {
      reliable: true,
      serialization: 'json'
    });

    attachConnectionHandlers(conn, false, cleanTargetId);
  }, [attachConnectionHandlers]);

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
    errorMessage,
    hostRoom,
    joinRoom,
    sendData,
    setOnData
  };
}
