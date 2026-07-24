import { Server } from 'socket.io';
import crypto from 'crypto';
import { decodeToken } from './jwt.js';
import { getDb, initDb } from './db.js';

/**
 * Socket.IO global instance
 * @type {Server}
 */
let io;

/**
 * Presencia en memoria — fuente de verdad de quién está conectado AHORA.
 * Map<userId, Set<socketId>>. Un usuario está "en línea" mientras tenga
 * al menos un socket activo (soporta múltiples pestañas/dispositivos).
 * Al reiniciar el proceso el mapa se vacía, reflejando que nadie está
 * conectado — más fiable que una columna is_online en BD que podría quedar
 * "pegada" tras un crash.
 */
const userSockets = new Map();

/**
 * Indica si un usuario tiene al menos una conexión activa.
 * @param {number|string} userId
 * @returns {boolean}
 */
export function isUserOnline(userId) {
	const set = userSockets.get(Number(userId));
	return !!set && set.size > 0;
}

/**
 * Devuelve el array de IDs de usuarios conectados en este instante.
 * @returns {number[]}
 */
export function getOnlineUserIds() {
	return [...userSockets.keys()].filter((id) => userSockets.get(id)?.size > 0);
}

/**
 * Obtiene los IDs de los usuarios con los que `userId` comparte una
 * conversación (DM o grupo). Son los destinatarios relevantes de un cambio
 * de presencia: quienes tienen abierto un chat con esta persona.
 */
async function getConversationPeers(db, userId) {
	const rows = await db
		.prepare(
			`SELECT DISTINCT cp2.user_id AS peer_id
			 FROM conversation_participants cp1
			 JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
			 WHERE cp1.user_id = ? AND cp2.user_id != ?`
		)
		.all(userId, userId);
	return rows.map((r) => r.peer_id);
}

/**
 * Comprueba la preferencia de privacidad show_online_status del usuario.
 * Si está desactivada, su presencia nunca se difunde y siempre aparece
 * como desconectado ante los demás.
 */
async function canSharePresence(db, userId) {
	const row = await db
		.prepare('SELECT show_online_status FROM user_settings WHERE user_id = ?')
		.get(userId);
	// Por defecto (sin fila de settings) se comparte la presencia.
	return !row || row.show_online_status !== 0;
}

/**
 * Difunde un cambio de presencia (online/offline) de `userId` a todos sus
 * pares de conversación. Respeta show_online_status.
 */
async function broadcastPresence(db, userId, online) {
	try {
		if (!(await canSharePresence(db, userId))) return;

		const nowIso = new Date().toISOString().slice(0, 19).replace('T', ' ');
		const peers = await getConversationPeers(db, userId);
		const payload = {
			userId: Number(userId),
			online,
			lastSeenAt: online ? null : nowIso
		};
		for (const peerId of peers) {
			io.to(`user_${peerId}`).emit('presence:update', payload);
		}
	} catch (err) {
		console.error('[Socket] broadcastPresence error:', err);
	}
}

/**
 * Initializes the Socket.IO server
 * @param {import('http').Server} httpServer
 */
export function initSocketIO(httpServer) {
	if (io) return io;

	io = new Server(httpServer, {
		cors: {
			origin: '*',
			methods: ['GET', 'POST']
		}
	});

	// Middleware for Authentication
	io.use(async (socket, next) => {
		try {
			const token = socket.handshake.auth.token;
			if (!token) {
				return next(new Error('Authentication error: Token missing'));
			}

			const decoded = decodeToken(token);
			if (!decoded || !decoded.user_id) {
				return next(new Error('Authentication error: Invalid token'));
			}

			await initDb();
			const db = getDb();
			const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

			const session = await db
				.prepare('SELECT id, user_id, expires_at FROM user_sessions WHERE token_hash = ? LIMIT 1')
				.get(tokenHash);

			if (!session) {
				return next(new Error('Authentication error: Invalid session'));
			}

			const expiresAt = new Date(session.expires_at + 'Z').getTime();
			if (expiresAt < Date.now()) {
				return next(new Error('Authentication error: Session expired'));
			}

			// Attach user info to socket
			socket.userId = session.user_id;
			next();
		} catch (err) {
			console.error('[Socket] Auth Error:', err);
			next(new Error('Authentication error: Internal server error'));
		}
	});

	io.on('connection', async (socket) => {
		const userId = Number(socket.userId);
		console.log(`[Socket] User connected: ${userId} (Socket ID: ${socket.id})`);

		// Join personal room for 1:1 routing and notifications
		socket.join(`user_${userId}`);

		// ── Presencia: registrar este socket ──────────────────────────────
		let sockets = userSockets.get(userId);
		const wasOffline = !sockets || sockets.size === 0;
		if (!sockets) {
			sockets = new Set();
			userSockets.set(userId, sockets);
		}
		sockets.add(socket.id);

		const db = getDb();
		// Refrescar last_seen_at al conectar (marca "visto ahora").
		try {
			await db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(userId);
		} catch (err) {
			console.error('[Socket] last_seen_at update (connect) error:', err);
		}

		// Solo difundir "en línea" en la transición offline → online.
		if (wasOffline) {
			broadcastPresence(db, userId, true);
		}

		// El cliente que acaba de entrar necesita saber quién ya está en línea
		// entre sus pares de conversación (sincronización inicial de presencia).
		try {
			const peers = await getConversationPeers(db, userId);
			const onlinePeers = [];
			for (const peerId of peers) {
				if (isUserOnline(peerId) && (await canSharePresence(db, peerId))) {
					onlinePeers.push(peerId);
				}
			}
			socket.emit('presence:sync', { onlineUserIds: onlinePeers });
		} catch (err) {
			console.error('[Socket] presence:sync error:', err);
		}

		socket.on('join_conversation', (convId) => {
			socket.join(`conv_${convId}`);
			console.log(`[Socket] User ${userId} joined conv_${convId}`);
		});

		socket.on('leave_conversation', (convId) => {
			socket.leave(`conv_${convId}`);
		});

		socket.on('typing', ({ convId, isTyping }) => {
			// Broadcast to everyone in the room except the sender
			socket.to(`conv_${convId}`).emit('typing', {
				convId,
				userId,
				isTyping
			});
		});

		// Heartbeat: el cliente late periódicamente; refrescamos last_seen_at
		// para detectar sesiones activas aunque no haya otra actividad.
		socket.on('heartbeat', async () => {
			try {
				await getDb()
					.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?")
					.run(userId);
			} catch (err) {
				console.error('[Socket] heartbeat error:', err);
			}
			socket.emit('heartbeat:ack');
		});

		socket.on('disconnect', async () => {
			console.log(`[Socket] User disconnected: ${userId} (Socket ID: ${socket.id})`);
			const set = userSockets.get(userId);
			if (set) {
				set.delete(socket.id);
				if (set.size === 0) {
					userSockets.delete(userId);
					// Transición online → offline: registrar last_seen y difundir.
					const dbRef = getDb();
					try {
						await dbRef
							.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?")
							.run(userId);
					} catch (err) {
						console.error('[Socket] last_seen_at update (disconnect) error:', err);
					}
					broadcastPresence(dbRef, userId, false);
				}
			}
		});
	});

	globalThis.io = io;
	console.log('[Socket] Socket.IO server initialized successfully.');
	return io;
}

/**
 * Get the global Socket.IO instance
 * @returns {Server|null}
 */
export function getSocketIO() {
	return globalThis.io || io;
}
