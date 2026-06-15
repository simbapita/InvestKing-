const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { createLobby, joinLobby, leaveLobby, startGame, socketToPlayer } = require('./lobby');
const { handlePlayerReady, handlePlayerMove, handleDisconnect } = require('./gameState');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../client')));
app.get('/health', (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on('create_lobby', (data) => {
    try { createLobby(socket, data, io); }
    catch (e) { console.error('create_lobby:', e); socket.emit('error', { message: 'Failed to create lobby.' }); }
  });

  socket.on('join_lobby', (data) => {
    try { joinLobby(socket, data, io); }
    catch (e) { console.error('join_lobby:', e); socket.emit('error', { message: 'Failed to join lobby.' }); }
  });

  socket.on('start_game', () => {
    try { startGame(socket, io); }
    catch (e) { console.error('start_game:', e); socket.emit('error', { message: 'Failed to start game.' }); }
  });

  socket.on('player_ready', (data) => {
    try { handlePlayerReady(socket, data, io); }
    catch (e) { console.error('player_ready:', e); }
  });

  socket.on('player_move', (data) => {
    handlePlayerMove(socket, data, io);
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    const info = socketToPlayer.get(socket.id);
    if (info) {
      handleDisconnect(socket, info.lobbyCode, info.playerId, io);
      leaveLobby(socket, io);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`AgarCity running on http://localhost:${PORT}`));
