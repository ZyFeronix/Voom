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
			
			const session = await db.prepare(
				'SELECT id, user_id, expires_at FROM user_sessions WHERE token_hash = ? LIMIT 1'
			).get(tokenHash);

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

	io.on('connection', (socket) => {
		console.log(`[Socket] User connected: ${socket.userId} (Socket ID: ${socket.id})`);

		// Join personal room for 1:1 routing and notifications
		socket.join(`user_${socket.userId}`);

		socket.on('join_conversation', (convId) => {
			socket.join(`conv_${convId}`);
			console.log(`[Socket] User ${socket.userId} joined conv_${convId}`);
		});

		socket.on('leave_conversation', (convId) => {
			socket.leave(`conv_${convId}`);
		});

		socket.on('typing', ({ convId, isTyping }) => {
			// Broadcast to everyone in the room except the sender
			socket.to(`conv_${convId}`).emit('typing', {
				convId,
				userId: socket.userId,
				isTyping
			});
		});

		socket.on('disconnect', () => {
			console.log(`[Socket] User disconnected: ${socket.userId}`);
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
