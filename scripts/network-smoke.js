import { io } from 'socket.io-client';

const SERVER_URL = process.env.GUACHAFITA_SERVER_URL
  || process.env.POLITIKAOS_SERVER_URL
  || 'http://127.0.0.1:3000';

function once(socket, eventName, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout esperando ${eventName}.`)), timeoutMs);
    socket.once(eventName, payload => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

function emitWithAck(socket, eventName, payload) {
  return new Promise(resolve => socket.emit(eventName, payload, resolve));
}

const host = io(SERVER_URL, { forceNew: true });
const guest = io(SERVER_URL, { forceNew: true });
const thirdPlayer = io(SERVER_URL, { forceNew: true });
let disconnectHost = null;
let disconnectGuest = null;

try {
  await Promise.all([once(host, 'connect'), once(guest, 'connect'), once(thirdPlayer, 'connect')]);
  const created = await emitWithAck(host, 'createRoom', {});
  const roomReady = once(host, 'roomReady');
  const joined = await emitWithAck(guest, 'joinRoom', { roomCode: created.roomCode });
  const ready = await roomReady;
  if (!created.ok || !joined.ok || created.playerNumber !== 1 || joined.playerNumber !== 2 || ready.players !== 2) {
    throw new Error('El flujo de creación/unión no asignó correctamente P1 y P2.');
  }
  if (created.gameTitle !== 'Guachafita Strike' || joined.gameTitle !== 'Guachafita Strike'
    || ready.gameTitle !== 'Guachafita Strike') {
    throw new Error('El lobby no anunció el nombre oficial Guachafita Strike.');
  }
  const rejectedThirdPlayer = await emitWithAck(thirdPlayer, 'joinRoom', { roomCode: created.roomCode });
  if (rejectedThirdPlayer.ok) throw new Error('La sala aceptó incorrectamente a un tercer jugador.');

  const hostSelection = once(host, 'selectionComplete');
  const guestSelection = once(guest, 'selectionComplete');
  host.emit('characterSelect', { characterId: 'abelardo' });
  guest.emit('characterSelect', { characterId: 'petro' });
  const [selectionP1, selectionP2] = await Promise.all([hostSelection, guestSelection]);
  if (selectionP1.player1Key !== 'abelardo' || selectionP2.player2Key !== 'petro') {
    throw new Error('La selección de personajes no quedó sincronizada.');
  }

  const relayedInput = once(host, 'playerInput');
  guest.emit('playerInput', { horizontal: -1, basic: true });
  const input = await relayedInput;
  if (input.playerNumber !== 2 || input.horizontal !== -1) throw new Error('Falló la retransmisión de input P2.');

  const relayedState = once(guest, 'gameStateSync');
  host.emit('gameStateSync', { roundTime: 88, player1: { health: 90 } });
  const state = await relayedState;
  if (state.playerNumber !== 1 || state.roundTime !== 88) throw new Error('Falló el estado autoritativo del Host.');

  let guestStateReachedHost = false;
  host.once('gameStateSync', () => { guestStateReachedHost = true; });
  guest.emit('gameStateSync', { roundTime: 1, player1: { health: 1 } });
  await new Promise(resolve => setTimeout(resolve, 220));
  if (guestStateReachedHost) throw new Error('P2 pudo emitir un snapshot autoritativo.');

  const relayedHit = once(guest, 'playerHit');
  host.emit('playerHit', { targetSide: 'P2', health: 75, damage: 10 });
  const hit = await relayedHit;
  if (hit.playerNumber !== 1 || hit.health !== 75) throw new Error('Falló la retransmisión autoritativa de impactos.');

  const abandonedForHost = once(host, 'matchAbandoned');
  const abandonedForGuest = once(guest, 'matchAbandoned');
  const abandonAck = emitWithAck(guest, 'abandonMatch', {});
  const [hostAbandon, guestAbandon, acknowledgedAbandon] = await Promise.all([
    abandonedForHost,
    abandonedForGuest,
    abandonAck
  ]);
  if (!acknowledgedAbandon.ok || hostAbandon.abandonedBy !== 2 || guestAbandon.abandonedBy !== 2) {
    throw new Error('El abandono voluntario no cerró limpiamente la sala para ambos jugadores.');
  }

  disconnectHost = io(SERVER_URL, { forceNew: true });
  disconnectGuest = io(SERVER_URL, { forceNew: true });
  await Promise.all([once(disconnectHost, 'connect'), once(disconnectGuest, 'connect')]);
  const disconnectRoom = await emitWithAck(disconnectHost, 'createRoom', {});
  const disconnectReady = once(disconnectHost, 'roomReady');
  await emitWithAck(disconnectGuest, 'joinRoom', { roomCode: disconnectRoom.roomCode });
  await disconnectReady;
  const disconnectSelection = once(disconnectHost, 'selectionComplete');
  disconnectHost.emit('characterSelect', { characterId: 'uribe' });
  disconnectGuest.emit('characterSelect', { characterId: 'epa_colombia' });
  await disconnectSelection;
  const playerDisconnected = once(disconnectHost, 'playerDisconnected');
  disconnectGuest.disconnect();
  const disconnectNotice = await playerDisconnected;
  if (disconnectNotice.playerNumber !== 2 || disconnectNotice.winnerPlayerNumber !== 1) {
    throw new Error('La caída involuntaria no adjudicó la victoria al jugador restante.');
  }

  console.log(`OK salas ${created.roomCode}/${disconnectRoom.roomCode}: red, abandono limpio y victoria por desconexión.`);
} finally {
  host.disconnect();
  guest.disconnect();
  thirdPlayer.disconnect();
  disconnectHost?.disconnect();
  disconnectGuest?.disconnect();
}
