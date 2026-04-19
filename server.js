import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, 'dist');

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webp': 'image/webp'
};

function sendFile(res, filePath) {
  const extension = extname(filePath);
  res.writeHead(200, { 'content-type': contentTypes[extension] || 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN || true,
    methods: ['GET', 'POST']
  }
});

httpServer.on('request', (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '') || '/';

  if (pathname.startsWith('/socket.io')) {
    return;
  }

  console.log(`${req.method} ${pathname}`);

  if (pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (existsSync(DIST_DIR)) {
    const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const requestedFile = safePath === '/' ? 'index.html' : safePath.slice(1);
    const filePath = join(DIST_DIR, requestedFile);

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      sendFile(res, filePath);
      return;
    }

    sendFile(res, join(DIST_DIR, 'index.html'));
    return;
  }

  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('Memory Hacker multiplayer server is running. Build the frontend with "npm run build" to serve the game here.');
});

const rooms = new Map();

function createRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  do {
    code = 'MH-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));

  return code;
}

function leaveCurrentRoom(socket) {
  const { roomCode } = socket.data;
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  socket.leave(roomCode);
  socket.data.roomCode = null;
  socket.data.role = null;

  if (!room) return;

  socket.to(roomCode).emit('peer-disconnected');
  rooms.delete(roomCode);
}

io.on('connection', (socket) => {
  socket.emit('socket-ready', { socketId: socket.id });

  socket.on('create-room', (ack) => {
    leaveCurrentRoom(socket);

    const roomCode = createRoomCode();
    rooms.set(roomCode, {
      hostId: socket.id,
      guestId: null
    });

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.role = 'host';

    ack?.({ ok: true, roomCode, socketId: socket.id });
  });

  socket.on('join-room', (roomCode, ack) => {
    leaveCurrentRoom(socket);

    const cleanRoomCode = roomCode?.trim().toUpperCase();
    const room = rooms.get(cleanRoomCode);

    if (!room) {
      ack?.({ ok: false, message: 'Room not found.' });
      return;
    }

    if (room.guestId) {
      ack?.({ ok: false, message: 'Room is already full.' });
      return;
    }

    room.guestId = socket.id;
    socket.join(cleanRoomCode);
    socket.data.roomCode = cleanRoomCode;
    socket.data.role = 'guest';

    io.to(cleanRoomCode).emit('room-ready', {
      roomCode: cleanRoomCode,
      hostId: room.hostId,
      guestId: room.guestId
    });

    ack?.({ ok: true, roomCode: cleanRoomCode, socketId: socket.id, hostId: room.hostId });
  });

  socket.on('game-message', (message) => {
    const { roomCode } = socket.data;
    if (!roomCode || !rooms.has(roomCode)) return;

    socket.to(roomCode).emit('game-message', message);
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Memory Hacker multiplayer server listening on 0.0.0.0:${PORT}`);
  console.log('Health check path: /health');
});
