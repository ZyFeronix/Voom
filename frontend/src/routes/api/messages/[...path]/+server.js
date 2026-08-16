/**
 * VSocial — Messages API
 *
 * Sub-rutas (dispatch interno por segmentos de params.path):
 *   GET    /unread-count
 *   GET    /conversations
 *   GET    /conversations/user/:peerId          → obtener/crear DM
 *   GET    /conversations/:convId/messages       → paginado por cursor (before/after)
 *   POST   /conversations/:convId/messages       → enviar (soporta reply_to_id)
 *   POST   /conversations/:convId/typing
 *   POST   /conversations/:convId/read[/:msgId]
 *   POST   /conversations/:convId/pin            → toggle fijar
 *   POST   /conversations/:convId/mute           → toggle silenciar
 *   POST   /:msgId/reactions                     → toggle reacción
 *   PUT    /:msgId                               → editar texto (solo autor)
 *   DELETE /:msgId                               → borrado lógico (solo autor)
 */
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { requireAuth, checkUserNotMuted } from '$lib/server/auth.js';
import { getSocketIO, isUserOnline } from '$lib/server/socket.js';

async function getOrCreateDm(db, user1, user2) {
	// Validar peer: debe existir y no ser uno mismo (evita colisión de PK y filas huérfanas)
	if (!Number.isInteger(user2) || user2 <= 0 || user1 === user2) return null;
	const peerExists = await db.prepare('SELECT 1 FROM users WHERE id = ?').get(user2);
	if (!peerExists) return null;

	const conv = await db
		.prepare(
			`
		SELECT c.id FROM conversations c
		JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
		JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
		WHERE c.type = 'dm' AND cp1.user_id = ? AND cp2.user_id = ?
	`
		)
		.get(user1, user2);
	if (conv) return conv.id;

	const result = await db.prepare("INSERT INTO conversations (type) VALUES ('dm')").run();
	const convId = Number(result.lastInsertRowid);
	await db
		.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)')
		.run(convId, user1);
	await db
		.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)')
		.run(convId, user2);
	return convId;
}

export async function GET({ request, url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();

	// GET /api/messages/unread-count
	if (parts[0] === 'unread-count') {
		const totalUnread = await db
			.prepare(
				`
			SELECT COUNT(*) as cnt
			FROM messages_new m
			JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
			WHERE cp.user_id = ? AND m.sender_id != ?
			AND m.id > COALESCE((SELECT message_id FROM message_read_receipts WHERE conversation_id = m.conversation_id AND user_id = ?), 0)
			AND NOT EXISTS (
			    SELECT 1 FROM conversation_participants cp2 
			    JOIN users u ON cp2.user_id = u.id 
			    WHERE cp2.conversation_id = m.conversation_id AND cp2.user_id != cp.user_id 
			      AND (SELECT type FROM conversations WHERE id = m.conversation_id) = 'dm' 
			      AND (u.is_active = 0 OR u.is_banned = 1)
			)
		`
			)
			.get(userId, userId, userId);

		return json({ unread_count: totalUnread.cnt || 0 });
	}

	// GET /api/messages/conversations
	if (parts[0] === 'conversations' && parts.length === 1) {
		const convs = await db
			.prepare(
				`
			SELECT c.id, c.type, c.group_name, c.group_avatar_url, c.last_message_at,
				cp.is_pinned, cp.is_muted,
				m.body as last_message_body, m.created_at as last_message_time, m.sender_id as last_message_sender_id,
				(SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) as participant_count,
				(SELECT COUNT(*) FROM messages_new mn 
				 WHERE mn.conversation_id = c.id AND mn.sender_id != ? 
				 AND mn.id > COALESCE((SELECT message_id FROM message_read_receipts WHERE conversation_id = c.id AND user_id = ?), 0)
				) as unread_count
			FROM conversations c
			JOIN conversation_participants cp ON c.id = cp.conversation_id
			LEFT JOIN (SELECT conversation_id, MAX(id) as max_id FROM messages_new GROUP BY conversation_id) latest_msg ON c.id = latest_msg.conversation_id
			LEFT JOIN messages_new m ON latest_msg.max_id = m.id
			WHERE cp.user_id = ?
			  AND NOT EXISTS (
			      SELECT 1 FROM conversation_participants cp2 
			      JOIN users u ON cp2.user_id = u.id 
			      WHERE cp2.conversation_id = c.id AND cp2.user_id != cp.user_id 
			        AND c.type = 'dm' 
			        AND (u.is_active = 0 OR u.is_banned = 1)
			  )
			ORDER BY cp.is_pinned DESC, COALESCE(c.last_message_at, c.created_at) DESC
		`
			)
			.all(userId, userId, userId);

		for (const c of convs) {
			if (c.type === 'dm') {
				const peer = await db
					.prepare(
						`
					SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.last_seen_at,
						COALESCE(s.show_online_status, 1) AS show_online_status
					FROM conversation_participants cp
					JOIN users u ON cp.user_id = u.id
					LEFT JOIN user_settings s ON s.user_id = u.id
					WHERE cp.conversation_id = ? AND cp.user_id != ? LIMIT 1
				`
					)
					.get(c.id, userId);
				if (peer) {
					c.peer_id = peer.id;
					c.name = peer.display_name;
					c.username = peer.username;
					c.avatar = peer.avatar_url;
					c.peer_avatar = peer.avatar_url;
					c.peer_display_name = peer.display_name;
					c.peer_username = peer.username;
					c.is_verified = peer.is_verified;
					// Presencia en vivo desde el registro en memoria de Socket.IO,
					// respetando la privacidad show_online_status del peer.
					c.peer_online = peer.show_online_status ? isUserOnline(peer.id) : false;
					c.peer_last_seen = peer.show_online_status ? peer.last_seen_at : null;
				}
			} else {
				c.name = c.group_name;
				c.avatar = c.group_avatar_url;
			}
		}
		return json({ conversations: convs });
	}

	// GET /api/messages/conversations/user/:peerId
	if (parts[0] === 'conversations' && parts[1] === 'user' && parts[2]) {
		const peerId = parseInt(parts[2]);
		const convId = await getOrCreateDm(db, userId, peerId);
		if (!convId) return json({ error: 'Usuario no válido' }, { status: 400 });
		return json({ conversation_id: convId });
	}

	// GET /api/messages/conversations/:convId/messages
	if (parts[0] === 'conversations' && parts[2] === 'messages') {
		const convId = parseInt(parts[1]);
		const participant = await db
			.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
			.get(convId, userId);
		if (!participant) return json({ error: 'No autorizado' }, { status: 403 });

		// Cursor-based pagination
		const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit')) || 50));
		const before = url.searchParams.get('before'); // message_id cursor
		const after = url.searchParams.get('after'); // message_id cursor for newer messages

		let query = `
			SELECT m.*, u.username as sender_username, u.display_name as sender_display_name, u.avatar_url as sender_avatar_url,
			(
				SELECT JSON_OBJECT(
					'id', rm.id,
					'body', rm.body,
					'media_type', rm.media_type,
					'is_deleted', rm.is_deleted,
					'sender_id', rm.sender_id,
					'sender_name', ru.display_name,
					'sender_username', ru.username
				)
				FROM messages_new rm JOIN users ru ON rm.sender_id = ru.id
				WHERE rm.id = m.reply_to_id
			) as reply_json,
			(
				SELECT JSON_GROUP_ARRAY(JSON_OBJECT('emoji', r.emoji, 'count', r.cnt, 'user_reacted', r.user_reacted))
				FROM (
					SELECT emoji, COUNT(*) as cnt, MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as user_reacted
					FROM message_reactions 
					WHERE message_id = m.id 
					GROUP BY emoji
				) r
			) as reactions_json
			FROM messages_new m JOIN users u ON m.sender_id = u.id 
			WHERE m.conversation_id = ?
		`;
		const params = [userId, convId];

		if (before) {
			query += ` AND m.id < ?`;
			params.push(parseInt(before));
			query += ` ORDER BY m.created_at DESC LIMIT ?`;
			params.push(limit);
		} else if (after) {
			query += ` AND m.id > ?`;
			params.push(parseInt(after));
			query += ` ORDER BY m.created_at ASC LIMIT ?`;
			params.push(limit);
		} else {
			query += ` ORDER BY m.created_at DESC LIMIT ?`;
			params.push(limit);
		}

		const rawMessages = await db.prepare(query).all(...params);

		const messages = rawMessages.map((msg) => {
			let reactions = {};
			if (msg.reactions_json) {
				try {
					const parsed = JSON.parse(msg.reactions_json);
					for (const r of parsed) {
						reactions[r.emoji] = { count: r.count, reacted: !!r.user_reacted };
					}
				} catch (_e) {}
			}
			delete msg.reactions_json;

			let reply_to = null;
			if (msg.reply_json) {
				try {
					reply_to = JSON.parse(msg.reply_json);
				} catch (_e) {}
			}
			delete msg.reply_json;

			return { ...msg, reactions, reply_to };
		});

		// Reverse if fetching older messages (DESC order) to maintain chronological order
		const orderedMessages = before || (!before && !after) ? messages.reverse() : messages;

		// Get read receipts for the peer
		const peer = await db
			.prepare(
				`
			SELECT user_id FROM conversation_participants 
			WHERE conversation_id = ? AND user_id != ? LIMIT 1
		`
			)
			.get(convId, userId);

		let peerLastReadId = null;
		if (peer) {
			const readReceipt = await db
				.prepare(
					`
				SELECT message_id FROM message_read_receipts 
				WHERE conversation_id = ? AND user_id = ?
			`
				)
				.get(convId, peer.user_id);
			peerLastReadId = readReceipt?.message_id || null;
		}

		// Return cursor info for pagination
		const hasMore = messages.length === limit;
		const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1].id : null;
		const prevCursor = messages.length > 0 ? messages[0].id : null;

		return json({
			messages: orderedMessages,
			conversation_id: convId,
			pagination: {
				has_more: hasMore,
				next_cursor: nextCursor,
				prev_cursor: prevCursor,
				limit
			},
			read_receipt: {
				peer_last_read_id: peerLastReadId
			}
		});
	}
	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function POST({ request, _url, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();

	// POST /api/messages/conversations/:convId/messages
	if (parts[0] === 'conversations' && parts[2] === 'messages') {
		const convId = parseInt(parts[1]);
		const participant = await db
			.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
			.get(convId, userId);
		if (!participant) return json({ error: 'No autorizado' }, { status: 403 });

		const body = await request.json();
		let text = (body.body || body.content || '').trim();
		const mediaUrl = (body.media_url || '').trim();
		const mediaType = (body.media_type || '').trim();
		const voiceUrl = (body.voice_url || '').trim();
		let replyToId = body.reply_to_id ? parseInt(body.reply_to_id) : null;
		await checkUserNotMuted(userId);
		if (!text && !mediaUrl && !voiceUrl)
			return json({ error: 'Message body or attachment required' }, { status: 400 });

		const isZumbido =
			text === '⚡ ¡ZUMBIDO!' ||
			text.toLowerCase() === '/zumbido' ||
			text.toLowerCase() === '/nudge';
		if (isZumbido) {
			text = '⚡ ¡ZUMBIDO!';
		}

		// Validar que el mensaje citado pertenezca a esta conversación
		if (replyToId) {
			const parent = await db
				.prepare('SELECT id FROM messages_new WHERE id = ? AND conversation_id = ?')
				.get(replyToId, convId);
			if (!parent) replyToId = null;
		}

		const result = await db
			.prepare(
				'INSERT INTO messages_new (conversation_id, sender_id, body, media_url, media_type, voice_url, reply_to_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
			)
			.run(convId, userId, text, mediaUrl || null, mediaType || null, voiceUrl || null, replyToId);
		const msgId = Number(result.lastInsertRowid);

		await db
			.prepare("UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?")
			.run(convId);

		const user = await db
			.prepare('SELECT display_name, username FROM users WHERE id = ?')
			.get(userId);
		const userName = user?.display_name || user?.username || 'Alguien';
		const peers = await db
			.prepare(
				'SELECT user_id, is_muted FROM conversation_participants WHERE conversation_id = ? AND user_id != ?'
			)
			.all(convId, userId);
		const insertNotif = db.prepare(
			"INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, 'message', 'message', ?, ?)"
		);

		const io = getSocketIO();
		const fullMsg = await db
			.prepare(
				`SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_url as sender_avatar,
				(
					SELECT JSON_OBJECT(
						'id', rm.id, 'body', rm.body, 'media_type', rm.media_type, 'is_deleted', rm.is_deleted,
						'sender_id', rm.sender_id, 'sender_name', ru.display_name, 'sender_username', ru.username
					)
					FROM messages_new rm JOIN users ru ON rm.sender_id = ru.id WHERE rm.id = m.reply_to_id
				) as reply_json
				FROM messages_new m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`
			)
			.get(msgId);

		if (fullMsg) {
			try {
				fullMsg.reply_to = fullMsg.reply_json ? JSON.parse(fullMsg.reply_json) : null;
			} catch (_e) {
				fullMsg.reply_to = null;
			}
			delete fullMsg.reply_json;
		}

		for (const peer of peers) {
			// Respetar silencio de conversación: no generar notificación persistente
			if (!peer.is_muted) {
				const notifRes = await insertNotif.run(
					peer.user_id,
					userId,
					msgId,
					isZumbido
						? `${userName} te ha enviado un ZUMBIDO.`
						: `${userName} te ha enviado un mensaje.`
				);

				if (io) {
					const latestNotif = await db
						.prepare('SELECT * FROM notifications WHERE id = ?')
						.get(notifRes.lastInsertRowid);
					if (latestNotif) {
						io.to(`user_${peer.user_id}`).emit('new_notification', {
							notifications: [latestNotif]
						});
					}
				}
			}

			if (io) {
				if (isZumbido) {
					io.to(`user_${peer.user_id}`).emit('zumbido', {
						convId,
						senderId: userId,
						messageId: msgId,
						timestamp: Date.now()
					});
				}
				io.to(`user_${peer.user_id}`).emit('new_message', { messages: [fullMsg] });
			}
		}

		if (io) {
			io.to(`user_${userId}`).emit('new_message', {
				messages: [{ ...fullMsg, is_own_message: true }]
			});
		}

		return json({
			success: true,
			message_id: msgId,
			conversation_id: convId,
			message: {
				id: msgId,
				sender_id: userId,
				body: text,
				media_url: mediaUrl || null,
				media_type: mediaType || null,
				voice_url: voiceUrl || null,
				reply_to_id: replyToId,
				reply_to: fullMsg?.reply_to || null,
				created_at: new Date().toISOString(),
				sender_username: user?.username
			}
		});
	}

	// POST /api/messages/conversations/:convId/typing
	// Reservado: el indicador de "escribiendo…" viaja en tiempo real por Socket.IO
	// (evento `typing`, ver lib/server/socket.js). Este endpoint HTTP existe solo
	// como fallback no-op para clientes sin websocket y no persiste estado.
	if (parts[0] === 'conversations' && parts[2] === 'typing') {
		return json({ success: true });
	}

	// POST /api/messages/conversations/:convId/read
	if (parts[0] === 'conversations' && parts[2] === 'read') {
		const convId = parseInt(parts[1]);
		const participant = await db
			.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
			.get(convId, userId);
		if (!participant) return json({ error: 'No autorizado' }, { status: 403 });

		// The message ID is either in the URL (parts[3]) or the body. Let's support both.
		let messageId;
		if (parts[3]) {
			messageId = parseInt(parts[3]);
		} else {
			const body = await request.json().catch(() => ({}));
			messageId = parseInt(body.message_id);
		}

		if (!messageId || isNaN(messageId))
			return json({ error: 'message_id required' }, { status: 400 });

		// El mensaje debe pertenecer a esta conversación (no aceptar punteros arbitrarios)
		const target = await db
			.prepare('SELECT id FROM messages_new WHERE id = ? AND conversation_id = ?')
			.get(messageId, convId);
		if (!target) return json({ error: 'Mensaje no válido' }, { status: 400 });

		await db
			.prepare(
				`
			INSERT INTO message_read_receipts (conversation_id, user_id, message_id, read_at)
			VALUES (?, ?, ?, datetime('now'))
			ON CONFLICT(conversation_id, user_id) DO UPDATE SET message_id = ?, read_at = datetime('now')
		`
			)
			.run(convId, userId, messageId, messageId);

		// Notificar a los demás participantes para actualizar sus confirmaciones de lectura en vivo
		const io = getSocketIO();
		if (io) {
			const peers = await db
				.prepare(
					'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?'
				)
				.all(convId, userId);
			for (const peer of peers) {
				io.to(`user_${peer.user_id}`).emit('messages_read', {
					conversation_id: convId,
					reader_id: userId,
					last_read_id: messageId
				});
			}
		}

		return json({ success: true });
	}

	// POST /api/messages/conversations/:convId/pin  (toggle fijar)
	if (parts[0] === 'conversations' && parts[2] === 'pin') {
		const convId = parseInt(parts[1]);
		const participant = await db
			.prepare(
				'SELECT is_pinned FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
			)
			.get(convId, userId);
		if (!participant) return json({ error: 'No autorizado' }, { status: 403 });

		const next = participant.is_pinned ? 0 : 1;
		await db
			.prepare(
				'UPDATE conversation_participants SET is_pinned = ? WHERE conversation_id = ? AND user_id = ?'
			)
			.run(next, convId, userId);
		return json({ success: true, is_pinned: next });
	}

	// POST /api/messages/conversations/:convId/mute  (toggle silenciar)
	if (parts[0] === 'conversations' && parts[2] === 'mute') {
		const convId = parseInt(parts[1]);
		const participant = await db
			.prepare(
				'SELECT is_muted FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
			)
			.get(convId, userId);
		if (!participant) return json({ error: 'No autorizado' }, { status: 403 });

		const next = participant.is_muted ? 0 : 1;
		await db
			.prepare(
				'UPDATE conversation_participants SET is_muted = ? WHERE conversation_id = ? AND user_id = ?'
			)
			.run(next, convId, userId);
		return json({ success: true, is_muted: next });
	}

	// POST /api/messages/:msgId/reactions
	if (parts.length === 2 && parts[1] === 'reactions') {
		const msgId = parseInt(parts[0]);
		try {
			const body = await request.json();
			if (body.emoji) {
				const msg = await db
					.prepare('SELECT sender_id, conversation_id FROM messages_new WHERE id = ?')
					.get(msgId);
				if (!msg) return json({ success: false, error: 'Message not found' }, { status: 404 });

				// El usuario debe ser participante de la conversación del mensaje
				const isParticipant = await db
					.prepare(
						'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
					)
					.get(msg.conversation_id, userId);
				if (!isParticipant)
					return json({ success: false, error: 'No autorizado' }, { status: 403 });

				const io = getSocketIO();
				const existing = await db
					.prepare(
						'SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?'
					)
					.get(msgId, userId, body.emoji);

				let action;
				if (existing) {
					await db
						.prepare(
							'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?'
						)
						.run(msgId, userId, body.emoji);
					action = 'removed';
				} else {
					await db
						.prepare('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)')
						.run(msgId, userId, body.emoji);
					action = 'added';

					// Notificar al autor del mensaje (solo al añadir)
					if (msg.sender_id !== userId) {
						const user = await db
							.prepare('SELECT display_name, username FROM users WHERE id = ?')
							.get(userId);
						const userName = user?.display_name || user?.username || 'Alguien';
						const notifRes = await db
							.prepare(
								"INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message) VALUES (?, ?, 'message_reaction', 'message', ?, ?)"
							)
							.run(
								msg.sender_id,
								userId,
								msgId,
								`${userName} reaccionó a tu mensaje con ${body.emoji}`
							);

						if (io) {
							const latestNotif = await db
								.prepare('SELECT * FROM notifications WHERE id = ?')
								.get(notifRes.lastInsertRowid);
							if (latestNotif) {
								io.to(`user_${msg.sender_id}`).emit('new_notification', {
									notifications: [latestNotif]
								});
							}
						}
					}
				}

				// Difundir el cambio de reacción a todos los participantes para
				// actualizar la UI del chat en vivo (añadir y quitar).
				if (io) {
					const convPeers = await db
						.prepare('SELECT user_id FROM conversation_participants WHERE conversation_id = ?')
						.all(msg.conversation_id);
					for (const p of convPeers) {
						io.to(`user_${p.user_id}`).emit('message_reaction', {
							conversation_id: msg.conversation_id,
							message_id: msgId,
							emoji: body.emoji,
							action,
							actor_id: userId
						});
					}
				}

				return json({ success: true, action });
			}
		} catch (e) {
			console.error('Error toggling reaction:', e);
		}
		return json({ success: false });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function PUT({ request, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();

	// PUT /api/messages/:id  (editar texto de un mensaje propio)
	if (parts.length === 1 && !isNaN(parseInt(parts[0]))) {
		const msgId = parseInt(parts[0]);
		const body = await request.json().catch(() => ({}));
		const text = (body.body || '').trim();
		if (!text) return json({ error: 'Message body required' }, { status: 400 });

		const msg = await db
			.prepare('SELECT sender_id, conversation_id, is_deleted FROM messages_new WHERE id = ?')
			.get(msgId);
		if (!msg) return json({ error: 'Message not found' }, { status: 404 });
		if (msg.sender_id !== userId) return json({ error: 'Unauthorized' }, { status: 403 });
		if (msg.is_deleted) return json({ error: 'Cannot edit a deleted message' }, { status: 400 });

		await db
			.prepare("UPDATE messages_new SET body = ?, edited_at = datetime('now') WHERE id = ?")
			.run(text, msgId);

		const io = getSocketIO();
		if (io) {
			const peers = await db
				.prepare('SELECT user_id FROM conversation_participants WHERE conversation_id = ?')
				.all(msg.conversation_id);
			const payload = {
				id: msgId,
				conversation_id: msg.conversation_id,
				body: text,
				edited_at: new Date().toISOString()
			};
			for (const peer of peers) {
				io.to(`user_${peer.user_id}`).emit('message_edited', payload);
			}
		}

		return json({ success: true, id: msgId, body: text, edited_at: new Date().toISOString() });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}

export async function DELETE({ request, params }) {
	const parts = params.path ? params.path.split('/') : [];
	const userId = await requireAuth(request);
	const db = getDb();

	// DELETE /api/messages/:id
	if (parts.length === 1 && !isNaN(parseInt(parts[0]))) {
		const msgId = parseInt(parts[0]);

		const msg = await db
			.prepare('SELECT sender_id, conversation_id FROM messages_new WHERE id = ?')
			.get(msgId);
		if (!msg) return json({ error: 'Message not found' }, { status: 404 });
		if (msg.sender_id !== userId) return json({ error: 'Unauthorized' }, { status: 403 });

		await db
			.prepare(
				"UPDATE messages_new SET is_deleted = 1, body = 'Este mensaje fue eliminado', voice_url = NULL, media_url = NULL, media_type = NULL WHERE id = ?"
			)
			.run(msgId);

		const io = getSocketIO();
		if (io) {
			const peers = await db
				.prepare('SELECT user_id FROM conversation_participants WHERE conversation_id = ?')
				.all(msg.conversation_id);
			for (const peer of peers) {
				io.to(`user_${peer.user_id}`).emit('message_deleted', {
					id: msgId,
					conversation_id: msg.conversation_id
				});
			}
		}

		return json({ success: true, id: msgId });
	}

	return json({ error: 'Endpoint not found' }, { status: 404 });
}
