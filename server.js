import express from 'express';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT) || 3000;
const GAME_TITLE = 'Guachafita Strike';
const ROOM_CODE_LENGTH = 4;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const STAGE_IDS = ['plaza_bolivar', 'leyenda_vallenata', 'transmilenio'];
const MAX_PAYLOAD_BYTES = 12_000;
const rooms = new Map();

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 100_000
});

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }
  next();
});

app.get('/health', (request, response) => response.json({ ok: true, gameTitle: GAME_TITLE, rooms: rooms.size }));
app.get('/', (request, response) => response.sendFile(path.join(currentDirectory, 'index.html')));
app.use('/js', express.static(path.join(currentDirectory, 'js')));
app.use('/src', express.static(path.join(currentDirectory, 'src')));
app.use('/assets', express.static(path.join(currentDirectory, 'assets')));
app.use((request, response) => response.sendFile(path.join(currentDirectory, 'index.html')));

function createRoomCode() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    let code = '';
    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('No fue posible generar un código de sala disponible.');
}

function normalizeRoomCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH);
}

function payloadIsSafe(payload) {
  try {
    return JSON.stringify(payload ?? {}).length <= MAX_PAYLOAD_BYTES;
  } catch {
    return false;
  }
}

function getSocketRoom(socket) {
  const roomCode = socket.data.roomCode;
  const room = roomCode ? rooms.get(roomCode) : null;
  if (!room) return null;
  const ownsSlot = room.p1SocketId === socket.id || room.p2SocketId === socket.id;
  return ownsSlot ? room : null;
}

function relay(socket, eventName, payload, { hostOnly = false } = {}) {
  const room = getSocketRoom(socket);
  if (!room || !payloadIsSafe(payload)) return;
  if (hostOnly && socket.data.playerNumber !== 1) return;
  socket.to(room.code).emit(eventName, {
    ...payload,
    roomCode: room.code,
    playerNumber: socket.data.playerNumber,
    serverTime: Date.now()
  });
}

function sanitizePlayerInput(payload) {
  const horizontalValue = Number(payload?.horizontal);
  return {
    horizontal: Number.isFinite(horizontalValue) ? Math.max(-1, Math.min(1, horizontalValue)) : 0,
    jump: payload?.jump === true,
    guard: payload?.guard === true,
    basic: payload?.basic === true,
    special: payload?.special === true,
    ulti: payload?.ulti === true,
    sequence: Number.isSafeInteger(payload?.sequence) ? payload.sequence : 0
  };
}

function clearSocketRoom(socket, roomCode) {
  if (!socket) return;
  socket.leave(roomCode);
  socket.data.roomCode = null;
  socket.data.playerNumber = null;
}

function closeRoom(room) {
  if (!room) return;
  [room.p1SocketId, room.p2SocketId].forEach(socketId => {
    clearSocketRoom(io.sockets.sockets.get(socketId), room.code);
  });
  rooms.delete(room.code);
}

function leaveCurrentRoom(socket, reason = 'left') {
  const room = getSocketRoom(socket);
  if (!room) return;
  const playerNumber = socket.data.playerNumber;
  clearSocketRoom(socket, room.code);

  if (room.phase === 'battle') {
    const remainingSocketId = playerNumber === 1 ? room.p2SocketId : room.p1SocketId;
    const remainingPlayerNumber = playerNumber === 1 ? 2 : 1;
    const remainingSocket = io.sockets.sockets.get(remainingSocketId);
    if (remainingSocket) {
      remainingSocket.emit('playerDisconnected', {
        roomCode: room.code,
        playerNumber,
        winnerPlayerNumber: remainingPlayerNumber,
        reason
      });
    }
    closeRoom(room);
    return;
  }

  if (playerNumber === 1) {
    io.to(room.code).emit('roomClosed', { roomCode: room.code, reason: 'host_left' });
    const guest = io.sockets.sockets.get(room.p2SocketId);
    if (guest) {
      clearSocketRoom(guest, room.code);
    }
    rooms.delete(room.code);
    return;
  }

  room.p2SocketId = null;
  room.selections[2] = null;
  io.to(room.code).emit('opponentDisconnected', { roomCode: room.code, playerNumber, reason });
}

io.on('connection', socket => {
  socket.on('createRoom', (payload = {}, acknowledge = () => {}) => {
    try {
      leaveCurrentRoom(socket, 'changed_room');
      const code = createRoomCode();
      const room = {
        code,
        p1SocketId: socket.id,
        p2SocketId: null,
        stageId: STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)],
        selections: { 1: null, 2: null },
        phase: 'lobby',
        createdAt: Date.now()
      };
      rooms.set(code, room);
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.playerNumber = 1;
      const response = { ok: true, gameTitle: GAME_TITLE, roomCode: code, playerNumber: 1, isHost: true };
      socket.emit('roomCreated', response);
      acknowledge(response);
    } catch (error) {
      acknowledge({ ok: false, error: error.message });
    }
  });

  socket.on('joinRoom', (payload = {}, acknowledge = () => {}) => {
    const code = normalizeRoomCode(payload.roomCode);
    const room = rooms.get(code);
    if (code.length !== ROOM_CODE_LENGTH || !room) {
      acknowledge({ ok: false, error: 'La sala no existe.' });
      return;
    }
    if (room.p1SocketId === socket.id) {
      acknowledge({ ok: false, error: 'Ya eres el Host de esta sala.' });
      return;
    }
    if (room.p2SocketId === socket.id) {
      acknowledge({ ok: true, gameTitle: GAME_TITLE, roomCode: code, playerNumber: 2, isHost: false });
      return;
    }
    if (room.p2SocketId && room.p2SocketId !== socket.id) {
      acknowledge({ ok: false, error: 'La sala ya está llena.' });
      return;
    }
    leaveCurrentRoom(socket, 'changed_room');
    room.p2SocketId = socket.id;
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerNumber = 2;
    const response = { ok: true, gameTitle: GAME_TITLE, roomCode: code, playerNumber: 2, isHost: false };
    socket.emit('roomJoined', response);
    acknowledge(response);
    io.to(code).emit('roomReady', { gameTitle: GAME_TITLE, roomCode: code, players: 2, stageId: room.stageId });
  });

  socket.on('characterSelect', payload => {
    const room = getSocketRoom(socket);
    const characterId = String(payload?.characterId || '').slice(0, 40);
    if (!room || !characterId) return;
    room.selections[socket.data.playerNumber] = characterId;
    io.to(room.code).emit('characterSelected', {
      roomCode: room.code,
      playerNumber: socket.data.playerNumber,
      characterId
    });
    if (room.selections[1] && room.selections[2]) {
      room.phase = 'battle';
      io.to(room.code).emit('selectionComplete', {
        roomCode: room.code,
        player1Key: room.selections[1],
        player2Key: room.selections[2],
        stageId: room.stageId
      });
    }
  });

  socket.on('playerInput', payload => relay(socket, 'playerInput', sanitizePlayerInput(payload)));
  socket.on('gameStateSync', payload => relay(socket, 'gameStateSync', payload, { hostOnly: true }));
  socket.on('playerAttack', payload => relay(socket, 'playerAttack', payload, { hostOnly: true }));
  socket.on('playerHit', payload => relay(socket, 'playerHit', payload, { hostOnly: true }));
  socket.on('abandonMatch', (payload = {}, acknowledge = () => {}) => {
    const room = getSocketRoom(socket);
    if (!room) {
      acknowledge({ ok: false, error: 'La sala ya no está activa.' });
      return;
    }
    const abandonedBy = socket.data.playerNumber;
    io.to(room.code).emit('matchAbandoned', {
      roomCode: room.code,
      abandonedBy,
      reason: 'voluntary'
    });
    acknowledge({ ok: true, roomCode: room.code, abandonedBy });
    closeRoom(room);
  });
  socket.on('leaveRoom', () => leaveCurrentRoom(socket));
  socket.on('disconnect', reason => leaveCurrentRoom(socket, reason));
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`${GAME_TITLE} Online disponible en http://localhost:${PORT}`);
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter(address => address && !address.internal && (address.family === 'IPv4' || address.family === 4))
    .map(address => address.address);
  [...new Set(addresses)].forEach(address => {
    console.log(`Red local: http://${address}:${PORT}`);
  });
});
