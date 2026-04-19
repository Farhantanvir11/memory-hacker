import { io } from 'socket.io-client';

const serverUrl = process.env.VITE_SOCKET_URL || 'http://127.0.0.1:3001';
const host = io(serverUrl, { transports: ['websocket'] });
const guest = io(serverUrl, { transports: ['websocket'] });

let roomCode = '';
let hostReady = false;
let guestReady = false;
let relayed = false;

const timeout = setTimeout(() => {
  console.error(JSON.stringify({ ok: false, roomCode, hostReady, guestReady, relayed }));
  host.close();
  guest.close();
  process.exit(1);
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
      throw new Error(response?.message || 'create-room failed');
    }

    roomCode = response.roomCode;
    guest.emit('join-room', roomCode, (joinResponse) => {
      if (!joinResponse?.ok) {
        throw new Error(joinResponse?.message || 'join-room failed');
      }
    });
  });
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
