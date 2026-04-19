import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

export function useMultiplayer() {
  const [peerId, setPeerId] = useState('');
  const [opponentId, setOpponentId] = useState('');
  // 'idle' | 'hosting' | 'connecting' | 'connected' | 'error'
  const [connectionStatus, setConnectionStatus] = useState(SOCKET_URL ? 'idle' : 'error');
  const [isHost, setIsHost] = useState(false);
  const [errorMessage, setErrorMessage] = useState(SOCKET_URL ? '' : 'Multiplayer server URL is missing. Set VITE_SOCKET_URL to your deployed Socket.IO server URL.');

  const socketRef = useRef(null);
  const roomCodeRef = useRef('');
  const onDataCallback = useRef(null);

  useEffect(() => {
    if (!SOCKET_URL) {
      return;
    }

    const socket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socketRef.current = socket;

    socket.on('socket-ready', ({ socketId }) => {
      if (!roomCodeRef.current) {
        setPeerId(socketId);
      }
      setErrorMessage('');
    });

    socket.on('connect_error', (err) => {
      setConnectionStatus('error');
      setErrorMessage(`Could not reach multiplayer server at ${SOCKET_URL}: ${err.message}`);
    });

    socket.on('room-ready', ({ roomCode, hostId, guestId }) => {
      roomCodeRef.current = roomCode;
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
      setErrorMessage(SOCKET_URL
        ? 'Multiplayer server is not connected yet. Try again in a moment.'
        : 'Multiplayer server URL is missing. Set VITE_SOCKET_URL before deploying.'
      );
      return;
    }

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
  }, []);

  const joinRoom = useCallback((targetId) => {
    const socket = socketRef.current;
    const cleanTargetId = targetId?.trim().toUpperCase();

    if (!cleanTargetId) {
      setConnectionStatus('error');
      setErrorMessage('Invalid room ID.');
      return;
    }

    if (!socket?.connected) {
      setConnectionStatus('error');
      setErrorMessage(SOCKET_URL
        ? 'Multiplayer server is not connected yet. Try again in a moment.'
        : 'Multiplayer server URL is missing. Set VITE_SOCKET_URL before deploying.'
      );
      return;
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
    errorMessage,
    hostRoom,
    joinRoom,
    sendData,
    setOnData
  };
}
