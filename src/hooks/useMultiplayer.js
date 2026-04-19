import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:3001' : undefined);

export function useMultiplayer() {
  const [peerId, setPeerId] = useState('');
  const [opponentId, setOpponentId] = useState('');
  // 'idle' | 'hosting' | 'connecting' | 'connected' | 'error'
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [isHost, setIsHost] = useState(false);
  const [isServerReady, setIsServerReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const socketRef = useRef(null);
  const roomCodeRef = useRef('');
  const onDataCallback = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsServerReady(true);
      setConnectionStatus((status) => status === 'error' ? 'idle' : status);
      setErrorMessage('');
    });

    socket.on('connect_error', (err) => {
      setIsServerReady(false);
      setConnectionStatus('error');
      setErrorMessage(`Could not reach multiplayer server: ${err.message}`);
    });

    socket.on('room-ready', ({ roomCode, hostId, guestId }) => {
      roomCodeRef.current = roomCode;
      setPeerId(roomCode);
      setConnectionStatus('connected');
      setErrorMessage('');
      setOpponentId(socket.id === hostId ? guestId : hostId);
      setIsHost(socket.id === hostId);
    });

    socket.on('game-message', (data) => {
      onDataCallback.current?.(data);
    });

    socket.on('peer-disconnected', () => {
      setConnectionStatus('error');
      setErrorMessage('Opponent disconnected. Create a new room to play again.');
      setOpponentId('');
    });

    socket.on('disconnect', (reason) => {
      setIsServerReady(false);
      if (reason === 'io client disconnect') return;
      setConnectionStatus('error');
      setErrorMessage('Lost connection to the multiplayer server.');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const hostRoom = useCallback(() => {
    const socket = socketRef.current;

    if (!socket?.connected) {
      setConnectionStatus('error');
      setErrorMessage('Multiplayer server is still connecting. Try again in a moment.');
      return false;
    }

    roomCodeRef.current = '';
    setPeerId('');
    setConnectionStatus('hosting');
    setIsHost(true);
    setOpponentId('');
    setErrorMessage('');

    socket.emit('create-room', (response) => {
      if (!response?.ok) {
        setConnectionStatus('error');
        setErrorMessage(response?.message || 'Could not create room.');
        return;
      }

      roomCodeRef.current = response.roomCode;
      setPeerId(response.roomCode);
    });

    return true;
  }, []);

  const joinRoom = useCallback((targetId) => {
    const socket = socketRef.current;
    const cleanTargetId = targetId?.trim().toUpperCase();

    if (!cleanTargetId) {
      setConnectionStatus('error');
      setErrorMessage('Invalid room code.');
      return false;
    }

    if (!socket?.connected) {
      setConnectionStatus('error');
      setErrorMessage('Multiplayer server is still connecting. Try again in a moment.');
      return false;
    }

    setConnectionStatus('connecting');
    setIsHost(false);
    setOpponentId('');
    setErrorMessage('');

    socket.emit('join-room', cleanTargetId, (response) => {
      if (!response?.ok) {
        setConnectionStatus('error');
        setErrorMessage(response?.message || 'Could not join room.');
        return;
      }

      roomCodeRef.current = response.roomCode;
      setPeerId(response.roomCode);
      setOpponentId(response.hostId || '');
    });

    return true;
  }, []);

  const setOnData = useCallback((callback) => {
    onDataCallback.current = callback;
  }, []);

  const sendData = useCallback((data) => {
    const socket = socketRef.current;
    if (socket?.connected && connectionStatus === 'connected') {
      socket.emit('game-message', data);
    }
  }, [connectionStatus]);

  return {
    peerId,
    opponentId,
    connectionStatus,
    isHost,
    isServerReady,
    errorMessage,
    hostRoom,
    joinRoom,
    sendData,
    setOnData
  };
}
