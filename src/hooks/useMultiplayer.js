import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const STORAGE_KEY = 'memory_hacker_socket_url';
const ENV_SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
const DEV_SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';
const LOCAL_SOCKET_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

function getStoredSocketUrl() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function getInitialSocketUrl() {
  return ENV_SOCKET_URL || getStoredSocketUrl() || DEV_SOCKET_URL;
}

function getConfigError(socketUrl) {
  if (!socketUrl) {
    return 'Enter your deployed multiplayer server URL to continue.';
  }

  if (!import.meta.env.DEV && LOCAL_SOCKET_PATTERN.test(socketUrl)) {
    return 'localhost cannot work on Vercel. Use your public HTTPS backend URL from Render, Railway, or Fly.';
  }

  return '';
}

export function useMultiplayer() {
  const [socketUrl, setSocketUrl] = useState(getInitialSocketUrl);
  const configError = getConfigError(socketUrl);
  const [peerId, setPeerId] = useState('');
  const [opponentId, setOpponentId] = useState('');
  // 'idle' | 'hosting' | 'connecting' | 'connected' | 'error'
  const [connectionStatus, setConnectionStatus] = useState(configError ? 'error' : 'idle');
  const [isHost, setIsHost] = useState(false);
  const [errorMessage, setErrorMessage] = useState(configError);

  const socketRef = useRef(null);
  const roomCodeRef = useRef('');
  const onDataCallback = useRef(null);

  useEffect(() => {
    if (getConfigError(socketUrl)) {
      return;
    }

    const socket = io(socketUrl, {
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
      setErrorMessage(`Could not reach multiplayer server at ${socketUrl}: ${err.message}.`);
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
  }, [socketUrl]);

  const configureServerUrl = useCallback((nextUrl) => {
    const cleanUrl = nextUrl.trim().replace(/\/$/, '');

    try {
      if (cleanUrl) {
        window.localStorage.setItem(STORAGE_KEY, cleanUrl);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage can be blocked; the in-memory URL still works for this session.
    }

    socketRef.current?.disconnect();
    socketRef.current = null;
    roomCodeRef.current = '';
    setPeerId('');
    setOpponentId('');
    setIsHost(false);
    setSocketUrl(cleanUrl);
    setConnectionStatus(getConfigError(cleanUrl) ? 'error' : 'idle');
    setErrorMessage(getConfigError(cleanUrl));
  }, []);

  const hostRoom = useCallback(() => {
    const socket = socketRef.current;

    if (!socket?.connected) {
      setConnectionStatus('error');
      setErrorMessage(configError || (socketUrl
        ? 'Multiplayer server is not connected yet. Try again in a moment.'
        : 'Enter your deployed multiplayer server URL to continue.'
      ));
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
  }, [configError, socketUrl]);

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
      setErrorMessage(configError || (socketUrl
        ? 'Multiplayer server is not connected yet. Try again in a moment.'
        : 'Enter your deployed multiplayer server URL to continue.'
      ));
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
  }, [configError, socketUrl]);

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
    socketUrl,
    configureServerUrl,
    hostRoom,
    joinRoom,
    sendData,
    setOnData
  };
}
