import { io } from 'socket.io-client';

const serverUrl = process.env.VITE_SOCKET_URL || 'http://127.0.0.1:3001';
const host = io(serverUrl, { transports: ['websocket'] });
const guest = io(serverUrl, { transports: ['websocket'] });

let roomCode = '';
let hostReady = false;
let guestReady = false;
let relayed = false;
let lastError = '';

function fail(message) {
  clearTimeout(timeout);
  console.error(JSON.stringify({
    ok: false,
    serverUrl,
    roomCode,
    hostReady,
    guestReady,
    relayed,
    error: message || lastError || 'Timed out waiting for multiplayer server.'
  }));
  host.close();
  guest.close();
  process.exit(1);
}

const timeout = setTimeout(() => {
  fail(`Could not connect to ${serverUrl}. Start the backend with "npm run server" first, or set VITE_SOCKET_URL to your deployed backend.`);
}, 5000);

function finishIfReady() {
  if (!hostReady || !guestReady || !relayed) return;

  clearTimeout(timeout);
  console.log(JSON.stringify({ ok: true, roomCode, hostReady, guestReady, relayed }));
  host.close();
  guest.close();
  process.exit(0);
}

host.on('connect', () => {
  host.emit('create-room', (response) => {
    if (!response?.ok) {
      fail(response?.message || 'create-room failed');
      return;
    }

    roomCode = response.roomCode;
    guest.emit('join-room', roomCode, (joinResponse) => {
      if (!joinResponse?.ok) {
        fail(joinResponse?.message || 'join-room failed');
      }
    });
  });
});

host.on('connect_error', (err) => {
  lastError = `Host client could not connect to ${serverUrl}: ${err.message}`;
});

guest.on('connect_error', (err) => {
  lastError = `Guest client could not connect to ${serverUrl}: ${err.message}`;
});

host.on('room-ready', () => {
  hostReady = true;
  host.emit('game-message', { type: 'SMOKE_TEST', payload: { roomCode } });
  finishIfReady();
});

guest.on('room-ready', () => {
  guestReady = true;
  finishIfReady();
});

guest.on('game-message', (message) => {
  relayed = message?.type === 'SMOKE_TEST' && message?.payload?.roomCode === roomCode;
  finishIfReady();
});
