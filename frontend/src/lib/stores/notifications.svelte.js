/**
 * Notifications Store - Manages real-time SSE connection, notifications, and real-time messages
 */

import { notifications as notifApi, messages as messagesApi } from '$lib/api.js';
import { io } from 'socket.io-client';

let _notifications = $state([]);
let _newMessages = $state([]); // Real-time incoming messages queue
let _rtcSignals = $state([]); // WebRTC signaling queue
let _unreadCount = $state(0);
let _unreadMessageCount = $state(0);
let _connected = $state(false);
let _socket = null;

// Track processed event IDs to prevent duplicates
let _processedMessageIds = new Set();
let _processedNotificationIds = new Set();
let _processedSignalIds = new Set();

/**
 * Connect to the real-time Socket.IO server.
 */
function connect(token) {
	if (!token) return;
	
	// Close existing connection before creating new one
	if (_socket) {
		_socket.disconnect();
		_socket = null;
	}

	try {
		_socket = io({
			auth: { token },
			reconnection: true,
			reconnectionAttempts: Infinity,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			timeout: 20000,
		});

		_socket.on('connect', () => {
			_connected = true;
			console.log('[Socket] Connected successfully.');
			// Initial fetch to sync any missed events while disconnected
			fetchInitialNotifications();
			fetchUnreadMessageCount();
		});

		_socket.on('new_message', (data) => {
			try {
				if (data.messages && data.messages.length > 0) {
					// Deduplicate by message ID before adding
					const uniqueMessages = data.messages.filter(msg => {
						if (_processedMessageIds.has(msg.id)) return false;
						_processedMessageIds.add(msg.id);
						return true;
					});
					if (uniqueMessages.length > 0) {
						_newMessages = [..._newMessages, ...uniqueMessages].slice(-50);
						// Increase unread message count when a new message arrives (if it's not ours)
						const unreadToAdd = uniqueMessages.filter(m => !m.is_own_message).length;
						if (unreadToAdd > 0) {
							_unreadMessageCount += unreadToAdd;
						}
					}
				}
			} catch (err) {
				console.error('[Socket] Error parsing new_message:', err);
			}
		});

		_socket.on('new_notification', (data) => {
			try {
				if (data.notifications && data.notifications.length > 0) {
					// Deduplicate by notification ID before adding
					const uniqueNotifs = data.notifications.filter(notif => {
						if (_processedNotificationIds.has(notif.id)) return false;
						if (notif.type === 'message') return false; // Ignorar notificaciones de tipo mensaje
						_processedNotificationIds.add(notif.id);
						return true;
					});
					if (uniqueNotifs.length > 0) {
						_notifications = [...uniqueNotifs, ..._notifications];
						_unreadCount += uniqueNotifs.filter(n => !n.is_read).length;
						
						// Dispatch global event for message reactions so chat UI can update
						uniqueNotifs.filter(n => n.type === 'message_reaction').forEach(n => {
							if (typeof window !== 'undefined') {
								// message format: "username reaccionó a tu mensaje con ❤️"
								const emojiMatch = n.message.match(/con (.+)$/);
								const emoji = emojiMatch ? emojiMatch[1] : null;
								if (emoji) {
									window.dispatchEvent(new CustomEvent('message_reaction', {
										detail: { messageId: n.entity_id, emoji }
									}));
								}
							}
						});
					}
				}
			} catch (err) {
				console.error('[Socket] Error parsing new_notification:', err);
			}
		});

		_socket.on('rtc_signal', (data) => {
			try {
				if (data.signals && data.signals.length > 0) {
					// Deduplicate by signal ID before adding
					const uniqueSignals = data.signals.filter(sig => {
						if (_processedSignalIds.has(sig.id)) return false;
						_processedSignalIds.add(sig.id);
						return true;
					});
					if (uniqueSignals.length > 0) {
						_rtcSignals = [..._rtcSignals, ...uniqueSignals].slice(-20);
					}
				}
			} catch (err) {
				console.error('[Socket] Error parsing rtc_signal:', err);
			}
		});

		_socket.on('disconnect', () => {
			console.log('[Socket] Disconnected.');
			_connected = false;
		});

		_socket.on('connect_error', (err) => {
			console.error('[Socket] Connection error:', err.message);
			_connected = false;
		});

	} catch (err) {
		console.error('[Socket] Initialization error:', err);
	}
}

async function fetchInitialNotifications() {
	try {
		const data = await notifApi.list();
		const newItems = data.notifications || [];
		// Deduplicate initial fetch
		const uniqueItems = newItems.filter(n => !_processedNotificationIds.has(n.id) && n.type !== 'message');
		uniqueItems.forEach(n => _processedNotificationIds.add(n.id));
		_notifications = uniqueItems;
		_unreadCount = uniqueItems.filter(n => !n.is_read).length;
	} catch (err) {
		console.error('[SSE] Failed to fetch initial notifications:', err);
	}
}

async function fetchUnreadMessageCount() {
	try {
		const data = await messagesApi.unreadCount();
		_unreadMessageCount = data.unread_count || 0;
	} catch (err) {
		console.error('[SSE] Failed to fetch unread message count:', err);
	}
}

/**
 * Disconnect SSE stream.
 */
function disconnect() {
	if (_socket) {
		_socket.disconnect();
		_socket = null;
	}
	_connected = false;
	_newMessages = [];
}

export function getSocket() {
	return _socket;
}

/**
 * Clear the new messages queue (e.g. after they've been consumed by chat views)
 */
function clearNewMessages() {
	_newMessages = [];
}

/**
 * Mark a notification as read.
 */
function markRead(id) {
	_notifications = _notifications.map(n =>
		n.id === id ? { ...n, is_read: true } : n
	);
	_unreadCount = Math.max(0, _unreadCount - 1);
}

/**
 * Mark all notifications as read.
 */
function markAllRead() {
	_notifications = _notifications.map(n => ({ ...n, is_read: true }));
	_unreadCount = 0
}

/**
 * Add a local notification (e.g. from UI actions).
 */
function addLocal(notification) {
	_notifications = [{ id: Date.now(), is_read: false, ...notification }, ..._notifications];
	_unreadCount += 1;
}

/**
 * Set notifications from API fetch.
 */
function setNotifications(items) {
	_notifications = items;
	_unreadCount = items.filter(n => !n.is_read).length;
}

function decreaseUnreadMessageCount() {
	if (_unreadMessageCount > 0) {
		_unreadMessageCount -= 1;
	}
}

export const notificationsStore = {
	get items() { return _notifications; },
	get newMessages() { return _newMessages; },
	get rtcSignals() { return _rtcSignals; },
	get unreadCount() { return _unreadCount; },
	get unreadMessageCount() { return _unreadMessageCount; },
	get connected() { return _connected; },
	connect,
	disconnect,
	clearNewMessages,
	markRead,
	markAllRead,
	addLocal,
	setNotifications,
	decreaseUnreadMessageCount,
	fetchUnreadMessageCount
};
