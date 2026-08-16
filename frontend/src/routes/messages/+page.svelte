<script>
	import { onMount, onDestroy, tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { messages as messagesApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';
	import { RTCManager } from '$lib/rtc.js';

	import { createChatStore } from '$lib/stores/chat.svelte.js';
	import { createRTCStore } from '$lib/stores/rtc.svelte.js';
	import { playNudge } from '$lib/utils/sound.js';

	const ZUMBIDO_TEXT = '⚡ ¡ZUMBIDO!';

	import ConversationsSidebar from './components/ConversationsSidebar.svelte';
	import ChatPane from './components/ChatPane.svelte';
	import RTCModals from './components/RTCModals.svelte';
	import NewDMModal from './components/NewDMModal.svelte';
	import StatusConfigModal from '$lib/components/StatusConfigModal.svelte';

	const chatStore = createChatStore();
	const rtcStore = createRTCStore();

	let mobileView = $state('list'); // 'list' or 'chat'
	let isPeerTyping = $state(false);
	let typingTimeout = null;
	let joinedConvId = null;

	let showNewDMModal = $state(false);
	let showStatusConfig = $state(false);
	let isShaking = $state(false);
	let shakeTimeout = null;
	let lastShakeTime = 0;
	let nudgeCooldown = $state(0);
	let nudgeCooldownTimer = null;

	function triggerShake() {
		const now = Date.now();
		if (now - lastShakeTime < 350) return;
		lastShakeTime = now;
		isShaking = false;
		if (shakeTimeout) clearTimeout(shakeTimeout);
		requestAnimationFrame(() => {
			isShaking = true;
			shakeTimeout = setTimeout(() => {
				isShaking = false;
			}, 600);
		});
	}

	let chatPaneComponent = $state(null);
	let callTimer = null;
	let rtcManager = null;

	async function loadConversations(keepActive = false, hideLoading = false) {
		if (!hideLoading) chatStore.loadingConvs = true;
		try {
			const res = await messagesApi.conversations.list();
			chatStore.setConversations(res.conversations || []);
			if (!keepActive && chatStore.conversations.length > 0 && !chatStore.activeConvId) {
				// selectConversation(chatStore.conversations[0].id);
			}
		} catch (e) {
			console.error('Failed to load conversations', e);
		} finally {
			chatStore.loadingConvs = false;
		}
	}

	async function loadMessages(convId) {
		chatStore.loadingMsgs = true;
		chatStore.hasMoreMessages = true;
		try {
			const res = await messagesApi.list(convId, { limit: 50 });
			if (res.messages) {
				const arr = res.messages;
				if (arr.length < 50) chatStore.hasMoreMessages = false;
				chatStore.setMessages(arr);
				// Aplicar confirmaciones de lectura del peer sobre los mensajes propios
				const peerRead = res.read_receipt?.peer_last_read_id;
				if (peerRead) chatStore.applyPeerLastRead(peerRead);
			}
		} catch (e) {
			console.error('Failed to load messages', e);
			chatStore.setMessages([]);
		} finally {
			chatStore.loadingMsgs = false;
			tick().then(() => chatPaneComponent?.scrollToBottom());
		}
	}

	async function selectConversation(convId) {
		chatStore.setActiveConvId(convId);
		chatStore.setMessages([]);
		isPeerTyping = false;
		mobileView = 'chat';
		await loadMessages(convId);

		const conv = chatStore.conversations.find((c) => c.id === convId);
		if (conv?.unread_count > 0) {
			// markRead requiere un id de mensaje real; si no hay mensajes, se omite.
			const lastMsgId =
				chatStore.messages.length > 0 ? chatStore.messages[chatStore.messages.length - 1].id : null;
			if (lastMsgId && !String(lastMsgId).startsWith('temp_')) {
				messagesApi.markRead(convId, lastMsgId).catch(() => {});
			}
			notificationsStore.fetchUnreadMessageCount();
			conv.unread_count = 0;
			chatStore.conversations = [...chatStore.conversations];
		}

		const socket = notificationsStore.getSocket();
		if (socket) {
			if (joinedConvId) socket.emit('leave_conversation', joinedConvId);
			socket.emit('join_conversation', convId);
			joinedConvId = convId;
		}

		// If URL has peer param, clean it up
		const peer = page.url.searchParams.get('peer');
		if (peer && conv?.peer_username === peer) {
			goto('/messages', { replaceState: true });
		}
	}

	async function handleStartDM(user) {
		showNewDMModal = false;
		const exists = chatStore.conversations.find((c) => Number(c.peer_id) === Number(user.id));
		if (exists) {
			selectConversation(exists.id);
		} else {
			try {
				const res = await messagesApi.conversations.create({ user_id: user.id });
				if (res.conversation_id) {
					await loadConversations(true, true);
					selectConversation(res.conversation_id);
				}
			} catch (error) {
				console.error('Error creating DM:', error);
			}
		}
	}

	async function handleSendMessage({ text, file, voiceBlob }) {
		if (chatStore.sending) return;

		// Modo edición: si hay un mensaje en edición, se actualiza en lugar de enviar.
		if (chatStore.editingMessage) {
			const editing = chatStore.editingMessage;
			const newText = (text || '').trim();
			if (!newText || newText === editing.body) {
				chatStore.editingMessage = null;
				return;
			}
			chatStore.editingMessage = null;
			try {
				const res = await messagesApi.edit(editing.id, newText);
				if (res.success) {
					chatStore.updateMessage(editing.id, {
						body: newText,
						content: newText,
						edited_at: res.edited_at
					});
					loadConversations(true, true);
				}
			} catch (e) {
				console.error('Edit error:', e);
			}
			return;
		}

		const isZumbido = (text || '').trim() === ZUMBIDO_TEXT;
		if (isZumbido) {
			if (nudgeCooldown > 0) return;
			nudgeCooldown = 5;
			if (nudgeCooldownTimer) clearInterval(nudgeCooldownTimer);
			nudgeCooldownTimer = setInterval(() => {
				nudgeCooldown -= 1;
				if (nudgeCooldown <= 0) {
					clearInterval(nudgeCooldownTimer);
					nudgeCooldownTimer = null;
				}
			}, 1000);

			// Notificación instantánea vía Socket.IO (latencia cero)
			const socket = notificationsStore.getSocket();
			if (socket && chatStore.activeConvId) {
				socket.emit('zumbido', { convId: chatStore.activeConvId });
			}
		}

		chatStore.sending = true;

		const replyTo = chatStore.replyingTo;
		chatStore.replyingTo = null;

		const tempId = 'temp_' + Date.now();
		// media_type solo aplica cuando hay adjunto real; los mensajes de solo texto
		// deben persistir con media_type null (no 'image').
		const mediaType = file
			? file.type.startsWith('video')
				? 'video'
				: 'image'
			: voiceBlob
				? 'audio'
				: null;
		const pendingMsg = {
			id: tempId,
			conversation_id: chatStore.activeConvId,
			sender_id: authStore.user?.id,
			body: text || (voiceBlob ? 'Nota de voz' : 'Archivo adjunto'),
			content: text || (voiceBlob ? 'Nota de voz' : 'Archivo adjunto'),
			created_at: new Date().toISOString(),
			is_deleted: 0,
			reactions: {},
			reply_to_id: replyTo?.id || null,
			reply_to: replyTo
				? {
						id: replyTo.id,
						body: replyTo.body || replyTo.content,
						media_type: replyTo.media_type,
						is_deleted: replyTo.is_deleted,
						sender_id: replyTo.sender_id,
						sender_name: replyTo.sender_display_name || replyTo.sender_name,
						sender_username: replyTo.sender_username
					}
				: null,
			media_url: file || voiceBlob ? 'uploading...' : null,
			media_type: mediaType,
			uploading: !!(file || voiceBlob),
			pending: true
		};

		chatStore.addMessage(pendingMsg);
		tick().then(() => {
			chatPaneComponent?.scrollToBottom();
			if (isZumbido) {
				playNudge();
				triggerShake();
			}
		});

		try {
			let uploadedMedia = null;
			if (file) {
				const fd = new FormData();
				fd.append('file', file);
				const upRes = await fetch('/api/upload', {
					method: 'POST',
					headers: { Authorization: `Bearer ${authStore.token}` },
					body: fd
				});
				if (upRes.ok) {
					const data = await upRes.json();
					uploadedMedia = data.url;
				} else {
					throw new Error('upload_failed');
				}
			} else if (voiceBlob) {
				const fd = new FormData();
				fd.append('file', voiceBlob, 'voice.webm');
				const upRes = await fetch('/api/upload', {
					method: 'POST',
					headers: { Authorization: `Bearer ${authStore.token}` },
					body: fd
				});
				if (upRes.ok) {
					const data = await upRes.json();
					uploadedMedia = data.url;
				} else {
					throw new Error('upload_failed');
				}
			}

			const res = await messagesApi.send(chatStore.activeConvId, {
				body: text,
				media_url: uploadedMedia,
				media_type: mediaType,
				reply_to_id: replyTo?.id || null
			});

			if (res.message) {
				chatStore.updateMessage(tempId, { ...res.message, pending: false, uploading: false });
			} else {
				// Falló el envío pero el medio ya se subió: se puede reintentar sin re-subir.
				chatStore.updateMessage(tempId, {
					error: true,
					pending: false,
					uploading: false,
					_retry: {
						body: text,
						media_url: uploadedMedia,
						media_type: mediaType,
						reply_to_id: replyTo?.id || null
					}
				});
			}
			loadConversations(true, true);
		} catch (e) {
			console.error('Send error:', e);
			// Mantener el mensaje visible marcado como fallido para permitir reintento.
			chatStore.updateMessage(tempId, {
				error: true,
				pending: false,
				uploading: false,
				_retry: file || voiceBlob ? null : { body: text, reply_to_id: replyTo?.id || null }
			});
		} finally {
			chatStore.sending = false;
			tick().then(() => chatPaneComponent?.scrollToBottom());
		}
	}

	// Reintenta un envío fallido. Si el medio ya se había subido (_retry.media_url)
	// se reenvía tal cual; si no hay payload reutilizable (adjunto perdido), se descarta.
	async function handleRetrySend(msgId) {
		const msg = chatStore.messages.find((m) => m.id === msgId);
		if (!msg) return;
		if (!msg._retry) {
			// Sin payload reutilizable (p.ej. adjunto que hubo que re-subir): eliminar.
			chatStore.messages = chatStore.messages.filter((m) => m.id !== msgId);
			return;
		}
		const payload = msg._retry;
		chatStore.updateMessage(msgId, { error: false, pending: true });
		try {
			const res = await messagesApi.send(chatStore.activeConvId, payload);
			if (res.message) {
				chatStore.messages = chatStore.messages.filter((m) => m.id !== msgId);
				chatStore.addMessage({ ...res.message, pending: false });
				tick().then(() => chatPaneComponent?.scrollToBottom());
				loadConversations(true, true);
			} else {
				chatStore.updateMessage(msgId, { error: true, pending: false });
			}
		} catch (e) {
			console.error('Retry send error:', e);
			chatStore.updateMessage(msgId, { error: true, pending: false });
		}
	}

	function handleSendZumbido() {
		if (nudgeCooldown > 0 || chatStore.sending || !chatStore.activeConvId) return;
		handleSendMessage({ text: ZUMBIDO_TEXT });
	}

	function handleDiscardMessage(msgId) {
		chatStore.messages = chatStore.messages.filter((m) => m.id !== msgId);
	}

	async function handleReact(msgId, emoji) {
		try {
			const res = await messagesApi.react(msgId, emoji);
			const action = res.action;
			if (!action) return;
			const msg = chatStore.messages.find((m) => m.id === msgId);
			if (!msg) return;
			if (!msg.reactions) msg.reactions = {};
			const r = msg.reactions;
			if (action === 'added') {
				if (r[emoji]) {
					r[emoji].count += 1;
					r[emoji].reacted = true;
				} else {
					r[emoji] = { count: 1, reacted: true };
				}
			} else if (action === 'removed') {
				if (r[emoji]) {
					r[emoji].count -= 1;
					r[emoji].reacted = false;
					if (r[emoji].count <= 0) delete r[emoji];
				}
			}
			chatStore.messages = [...chatStore.messages];
		} catch (e) {
			console.error('Reaction error:', e);
		}
	}

	function handleReply(msg) {
		chatStore.editingMessage = null;
		chatStore.replyingTo = msg;
		tick().then(() => chatPaneComponent?.focusComposer?.());
	}

	function handleStartEdit(msg) {
		chatStore.replyingTo = null;
		chatStore.editingMessage = msg;
		tick().then(() => chatPaneComponent?.focusComposer?.());
	}

	async function handlePinConversation(convId) {
		try {
			const res = await messagesApi.pin(convId);
			const conv = chatStore.conversations.find((c) => c.id === convId);
			if (conv) conv.is_pinned = res.is_pinned;
			await loadConversations(true, true);
		} catch (e) {
			console.error('Pin error:', e);
		}
	}

	async function handleMuteConversation(convId) {
		try {
			const res = await messagesApi.mute(convId);
			const conv = chatStore.conversations.find((c) => c.id === convId);
			if (conv) {
				conv.is_muted = res.is_muted;
				chatStore.conversations = [...chatStore.conversations];
			}
		} catch (e) {
			console.error('Mute error:', e);
		}
	}

	async function handleDeleteMessage(msgId) {
		try {
			const res = await messagesApi.delete(msgId);
			if (res.success || res.status === 'success') {
				chatStore.deleteMessage(msgId);
				loadConversations(true, true);
			}
		} catch (error) {
			console.error('Error deleting message:', error);
		}
	}

	// --- WebRTC Logic ---
	function _startCallTimer() {
		if (callTimer) clearInterval(callTimer);
		rtcStore.callDurationSecs = 0;
		callTimer = setInterval(() => {
			rtcStore.callDurationSecs += 1;
		}, 1000);
	}

	function _cleanupCallState() {
		if (callTimer) clearInterval(callTimer);
		callTimer = null;
		rtcStore.inCall = false;
		rtcStore.showCallModal = false;
		rtcStore.localStream?.getTracks().forEach((t) => t.stop());
		rtcStore.localStream = null;
		rtcStore.remoteStreams = [];
		rtcStore.micMuted = false;
		rtcStore.camMuted = false;
		rtcManager = null;
		rtcStore.rtcManager = null;
	}

	function initRTC(type) {
		rtcStore.callType = type;
		rtcStore.remoteStreams = [];
		rtcStore.micMuted = false;
		rtcStore.camMuted = false;

		const rm = new RTCManager(chatStore.activeConvId, authStore.user.id);

		rm.onLocalStream = (s) => (rtcStore.localStream = s);
		rm.onRemoteStream = (peerId, s) => {
			if (!rtcStore.remoteStreams.some((rs) => rs.peerId === peerId)) {
				rtcStore.remoteStreams = [...rtcStore.remoteStreams, { peerId, stream: s }];
			}
		};
		rm.onPeerLeft = (peerId) => {
			rtcStore.remoteStreams = rtcStore.remoteStreams.filter((rs) => rs.peerId !== peerId);
			if (rtcStore.remoteStreams.length === 0) endCall();
		};

		rtcManager = rm;
		rtcStore.rtcManager = rm;
	}

	async function openDeviceSetup(type) {
		rtcStore.pendingCallType = type;
		rtcStore.showDeviceSetup = true;
		try {
			const devs = await navigator.mediaDevices.enumerateDevices();
			rtcStore.availableCams = devs.filter((d) => d.kind === 'videoinput');
			rtcStore.availableMics = devs.filter((d) => d.kind === 'audioinput');
			if (rtcStore.availableCams.length > 0)
				rtcStore.selectedCamId = rtcStore.availableCams[0].deviceId;
			if (rtcStore.availableMics.length > 0)
				rtcStore.selectedMicId = rtcStore.availableMics[0].deviceId;
			await updatePreview();
		} catch (e) {
			console.error('Error getting devices:', e);
		}
	}

	async function updatePreview() {
		if (rtcStore.previewStream) {
			rtcStore.previewStream.getTracks().forEach((t) => t.stop());
			rtcStore.previewStream = null;
		}
		if (rtcStore.pendingCallType === 'screen') return;

		try {
			const constraints = {
				audio: rtcStore.selectedMicId ? { deviceId: { exact: rtcStore.selectedMicId } } : true,
				video:
					rtcStore.pendingCallType === 'video'
						? rtcStore.selectedCamId
							? {
									deviceId: { exact: rtcStore.selectedCamId },
									width: { ideal: 1280 },
									height: { ideal: 720 }
								}
							: true
						: false
			};
			rtcStore.previewStream = await navigator.mediaDevices.getUserMedia(constraints);
		} catch (e) {
			console.error('Error updating preview:', e);
		}
	}

	function closeDeviceSetup() {
		if (rtcStore.previewStream) {
			rtcStore.previewStream.getTracks().forEach((t) => t.stop());
			rtcStore.previewStream = null;
		}
		rtcStore.showDeviceSetup = false;
		rtcStore.pendingCallType = null;
	}

	async function confirmDeviceSetup() {
		const type = rtcStore.pendingCallType;
		let stream = rtcStore.previewStream;
		rtcStore.previewStream = null;
		rtcStore.showDeviceSetup = false;
		rtcStore.pendingCallType = null;

		if (type === 'screen') {
			try {
				const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
				screenStream.getVideoTracks()[0].addEventListener('ended', () => endCall());
				if (stream && stream.getAudioTracks().length > 0) {
					screenStream.addTrack(stream.getAudioTracks()[0]);
				}
				stream = screenStream;
			} catch (e) {
				console.error('Screen share denied:', e);
				if (stream) stream.getTracks().forEach((t) => t.stop());
				return;
			}
		}

		_startCallWithStream(type, stream);
	}

	async function _startCallWithStream(type, stream) {
		if (rtcStore.inCall) return;
		if (!chatStore.activeConv?.peer_id && !rtcStore.incomingCallOffer) return;

		initRTC(type);
		rtcStore.localStream = stream;
		rtcManager.setLocalStream(stream);
		rtcStore.inCall = true;
		rtcStore.showCallModal = true;
		_startCallTimer();

		if (rtcStore.incomingCallOffer) {
			const offer = rtcStore.incomingCallOffer;
			rtcStore.incomingCallOffer = null;
			await rtcManager.handleSignal(offer.sender_id, offer.payload);
			for (const sig of rtcStore.pendingSignals) {
				await rtcManager.handleSignal(sig.sender_id, sig.payload);
			}
			rtcStore.pendingSignals = [];
		} else {
			await rtcManager.initiateCall([chatStore.activeConv.peer_id]);
		}
	}

	async function endCall() {
		if (!rtcManager && !rtcStore.inCall) return;
		const peerIds = chatStore.activeConv?.peer_id ? [chatStore.activeConv.peer_id] : [];
		if (rtcManager) {
			await rtcManager.sendHangupAndClose(peerIds);
		}
		_cleanupCallState();
	}

	async function acceptCall() {
		if (!rtcStore.incomingCallOffer) return;
		const offer = rtcStore.incomingCallOffer;
		if (Number(chatStore.activeConvId) !== Number(offer.conversation_id)) {
			await selectConversation(offer.conversation_id);
		}
		const responseType = offer.callType === 'screen' ? 'audio' : offer.callType || 'audio';
		await openDeviceSetup(responseType);
	}

	function declineCall() {
		const offer = rtcStore.incomingCallOffer;
		rtcStore.incomingCallOffer = null;
		rtcStore.pendingSignals = [];
		if (offer) {
			fetch('/api/rtc/signal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
				body: JSON.stringify({
					recipient_id: offer.sender_id,
					conversation_id: offer.conversation_id,
					payload: { type: 'hangup' }
				})
			});
		}
	}

	// Effect: SSE Messages
	$effect(() => {
		const newMsgs = notificationsStore.newMessages;
		if (newMsgs.length > 0) {
			untrack(() => {
				let shouldReload = false;
				newMsgs.forEach((msg) => {
					if (Number(msg.conversation_id) === Number(chatStore.activeConvId)) {
						if (!chatStore.messages.some((m) => Number(m.id) === Number(msg.id))) {
							const tempIndex = chatStore.messages.findIndex(
								(m) =>
									m.pending && m.body === msg.body && Number(m.sender_id) === Number(msg.sender_id)
							);
							if (tempIndex !== -1) {
								chatStore.messages[tempIndex] = { ...msg, pending: false };
								chatStore.messages = [...chatStore.messages];
							} else {
								chatStore.addMessage(msg);
							}

							if (Number(msg.sender_id) !== Number(authStore.user?.id)) {
								// Zumbido recibido: reproduce el sonido nudge.
								if ((msg.body || msg.content || '') === ZUMBIDO_TEXT) {
									playNudge();
									triggerShake();
								}
								messagesApi
									.markRead(chatStore.activeConvId, msg.id)
									.then(() => {
										notificationsStore.fetchUnreadMessageCount();
									})
									.catch(() => {});
							}
							tick().then(() => chatPaneComponent?.scrollToBottom());
						}
					}
					shouldReload = true;
				});
				if (shouldReload) loadConversations(false, true);
				notificationsStore.clearNewMessages();
			});
		}
	});

	// Effect: Reset RTC when active conversation changes
	$effect(() => {
		if (chatStore.activeConvId) {
			if (rtcManager && rtcManager.conversationId !== chatStore.activeConvId) {
				endCall();
			}
		}
	});

	// Effect: Handle RTC signals from SSE
	$effect(() => {
		const signals = notificationsStore.rtcSignals;
		if (signals.length > 0) {
			untrack(() => {
				signals.forEach(async (sig) => {
					if (!rtcStore.processedSignalIds.has(sig.id)) {
						rtcStore.processedSignalIds.add(sig.id);
						try {
							const payload = JSON.parse(sig.payload);
							if (payload.type === 'offer' && !rtcStore.inCall) {
								let callerName = 'Alguien';
								const conv = chatStore.conversations.find(
									(c) => Number(c.id) === Number(sig.conversation_id)
								);
								if (conv) callerName = conv.peer_display_name || conv.peer_username || callerName;

								rtcStore.incomingCallOffer = {
									sender_id: sig.sender_id,
									conversation_id: sig.conversation_id,
									payload,
									callerName,
									callType: payload.callType || 'audio'
								};
							} else if (payload.type === 'hangup' || payload.type === 'peer_left') {
								if (rtcStore.inCall && rtcManager) {
									rtcManager.handlePeerLeft(sig.sender_id);
								}
								if (rtcStore.incomingCallOffer?.sender_id === sig.sender_id) {
									rtcStore.incomingCallOffer = null;
								}
							} else {
								if (rtcStore.inCall && rtcManager) {
									await rtcManager.handleSignal(sig.sender_id, payload);
								} else if (rtcStore.incomingCallOffer) {
									rtcStore.pendingSignals = [...rtcStore.pendingSignals, sig];
								}
							}
						} catch (e) {
							console.error('Failed processing signal', e);
						}
					}
				});
			});
		}
	});

	// Removed nonexistent typingEvents effect

	let typingSocketHandler = null;
	let typingIntervalId = null;
	let zumbidoSocketHandler = null;
	let messageEditedHandler = null;
	let messageDeletedHandler = null;
	let messagesReadHandler = null;
	let messageReactionHandler = null;

	// Emite el evento de "escribiendo" al peer con throttling básico.
	let lastTypingEmit = 0;
	function notifyTyping(isTyping) {
		const socket = notificationsStore.getSocket();
		if (!socket || !chatStore.activeConvId) return;
		const now = Date.now();
		if (isTyping && now - lastTypingEmit < 1500) return;
		lastTypingEmit = now;
		socket.emit('typing', { convId: chatStore.activeConvId, isTyping });
	}

	messageEditedHandler = (data) => {
		if (Number(data.conversation_id) === Number(chatStore.activeConvId)) {
			chatStore.updateMessage(data.id, {
				body: data.body,
				content: data.body,
				edited_at: data.edited_at
			});
		}
	};

	messageDeletedHandler = (data) => {
		if (Number(data.conversation_id) === Number(chatStore.activeConvId)) {
			chatStore.deleteMessage(data.id);
		}
		loadConversations(true, true);
	};

	messagesReadHandler = (data) => {
		if (Number(data.conversation_id) === Number(chatStore.activeConvId)) {
			chatStore.applyPeerLastRead(data.last_read_id);
		}
	};

	// Reacciones en vivo del peer (añadir/quitar). Las propias ya se aplican
	// de forma optimista en handleReact, así que se ignoran aquí.
	messageReactionHandler = (data) => {
		if (Number(data.conversation_id) !== Number(chatStore.activeConvId)) return;
		if (Number(data.actor_id) === Number(authStore.user?.id)) return;
		const msg = chatStore.messages.find((m) => Number(m.id) === Number(data.message_id));
		if (!msg) return;
		if (!msg.reactions) msg.reactions = {};
		const r = msg.reactions;
		const emoji = data.emoji;
		if (data.action === 'added') {
			if (r[emoji]) r[emoji].count += 1;
			else r[emoji] = { count: 1, reacted: false };
		} else if (data.action === 'removed') {
			if (r[emoji]) {
				r[emoji].count -= 1;
				if (r[emoji].count <= 0) delete r[emoji];
			}
		}
		chatStore.messages = [...chatStore.messages];
	};

	onMount(async () => {
		await loadConversations();
		const peerParam = page.url.searchParams.get('peer');
		if (peerParam) {
			const conv = chatStore.conversations.find((c) => c.peer_username === peerParam);
			if (conv) selectConversation(conv.id);
		}

		// Typing event setup directly via socket. El servidor emite
		// { convId, userId, isTyping } (ver lib/server/socket.js).
		typingSocketHandler = (data) => {
			if (
				Number(data.convId) === Number(chatStore.activeConvId) &&
				Number(data.userId) !== Number(authStore.user?.id)
			) {
				isPeerTyping = !!data.isTyping;
				if (typingTimeout) clearTimeout(typingTimeout);
				if (data.isTyping) {
					typingTimeout = setTimeout(() => (isPeerTyping = false), 5000);
				}
			}
		};

		// Manejador de zumbidos directos en tiempo real
		zumbidoSocketHandler = (data) => {
			if (Number(data.senderId) === Number(authStore.user?.id)) return;
			playNudge();
			triggerShake();
			if (Number(data.convId) !== Number(chatStore.activeConvId)) {
				loadConversations(true, true);
			}
		};

		typingIntervalId = setInterval(() => {
			const socket = notificationsStore.getSocket();
			if (socket) {
				clearInterval(typingIntervalId);
				socket.on('typing', typingSocketHandler);
				socket.on('zumbido', zumbidoSocketHandler);
				socket.on('message_edited', messageEditedHandler);
				socket.on('message_deleted', messageDeletedHandler);
				socket.on('messages_read', messagesReadHandler);
				socket.on('message_reaction', messageReactionHandler);
			}
		}, 1000);
	});

	onDestroy(() => {
		if (typingIntervalId) clearInterval(typingIntervalId);
		if (typingTimeout) clearTimeout(typingTimeout);
		if (shakeTimeout) clearTimeout(shakeTimeout);
		if (nudgeCooldownTimer) clearInterval(nudgeCooldownTimer);
		const socket = notificationsStore.getSocket();
		if (socket) {
			// Salir de la sala de la conversación activa al abandonar la vista.
			if (joinedConvId) socket.emit('leave_conversation', joinedConvId);
			if (typingSocketHandler) socket.off('typing', typingSocketHandler);
			if (zumbidoSocketHandler) socket.off('zumbido', zumbidoSocketHandler);
			if (messageEditedHandler) socket.off('message_edited', messageEditedHandler);
			if (messageDeletedHandler) socket.off('message_deleted', messageDeletedHandler);
			if (messagesReadHandler) socket.off('messages_read', messagesReadHandler);
			if (messageReactionHandler) socket.off('message_reaction', messageReactionHandler);
		}
		if (rtcManager) {
			rtcManager.destroy();
		}
	});
</script>

<svelte:head>
	<title>Mensajes — VSocial</title>
</svelte:head>

<div class="messages-container" class:shake={isShaking}>
	<div class="glass-card chat-window">
		<ConversationsSidebar
			{chatStore}
			{mobileView}
			onStatusConfig={() => (showStatusConfig = true)}
			onNewDM={() => (showNewDMModal = true)}
			onSelectConversation={selectConversation}
			onPinConversation={handlePinConversation}
			onMuteConversation={handleMuteConversation}
		/>

		<ChatPane
			bind:this={chatPaneComponent}
			{chatStore}
			{rtcStore}
			{mobileView}
			{isPeerTyping}
			{nudgeCooldown}
			onBackMobile={() => (mobileView = 'list')}
			onStartAudioCall={() => openDeviceSetup('audio')}
			onStartVideoCall={() => openDeviceSetup('video')}
			onStartScreenShare={() => openDeviceSetup('screen')}
			onEndCall={endCall}
			onLoadMore={async () => {
				const oldestId = chatStore.messages[0]?.id;
				await chatStore.loadMoreMessages(chatStore.activeConvId, oldestId);
			}}
			onSendMessage={handleSendMessage}
			onSendZumbido={handleSendZumbido}
			onDeleteMessage={handleDeleteMessage}
			onReact={handleReact}
			onReply={handleReply}
			onEdit={handleStartEdit}
			onNewDM={() => (showNewDMModal = true)}
			onTyping={notifyTyping}
			onRetrySend={handleRetrySend}
			onDiscardMessage={handleDiscardMessage}
		/>
	</div>
</div>

{#if showNewDMModal}
	<NewDMModal onClose={() => (showNewDMModal = false)} onStartDM={handleStartDM} />
{/if}

<RTCModals
	{rtcStore}
	{chatStore}
	onCloseDeviceSetup={closeDeviceSetup}
	onConfirmDeviceSetup={confirmDeviceSetup}
	onUpdatePreview={updatePreview}
	onEndCall={endCall}
	onToggleMic={() => {
		rtcStore.micMuted = !rtcStore.micMuted;
		rtcManager?.muteAudio(rtcStore.micMuted);
	}}
	onToggleCam={() => {
		rtcStore.camMuted = !rtcStore.camMuted;
		rtcManager?.muteVideo(rtcStore.camMuted);
	}}
	onStartScreenShare={() => openDeviceSetup('screen')}
	onAcceptCall={acceptCall}
	onDeclineCall={declineCall}
/>

{#if showStatusConfig}
	<StatusConfigModal onClose={() => (showStatusConfig = false)} />
{/if}

<style>
	.messages-container {
		position: fixed;
		top: 58px;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
	}

	@media (min-width: 768px) {
		.messages-container {
			left: 16rem;
		}

		:global(.vs-shell--collapsed) .messages-container {
			left: 5rem;
		}
	}

	@media (max-width: 768px) {
		.messages-container {
			bottom: 0;
			height: auto;
			padding-bottom: 90px;
			border-radius: var(--radius-xs);
			border: none;
		}
	}

	.chat-window {
		display: flex;
		flex: 1;
		min-height: 0;
		width: 100%;
		height: 100%;
		border-radius: var(--radius-xs);
		overflow: visible;
		background: transparent;
		border: none;
		border-top: 1px solid var(--glass-border-t);
	}

	@keyframes global-shake {
		0%,
		100% {
			transform: translate3d(0, 0, 0) rotate(0deg);
		}
		10%,
		90% {
			transform: translate3d(-10px, -4px, 0) rotate(-0.8deg);
		}
		20%,
		80% {
			transform: translate3d(12px, 5px, 0) rotate(1deg);
		}
		30%,
		50%,
		70% {
			transform: translate3d(-14px, 6px, 0) rotate(-1.2deg);
		}
		40%,
		60% {
			transform: translate3d(14px, -5px, 0) rotate(1.2deg);
		}
	}

	.messages-container.shake,
	.messages-container.shake .chat-window {
		animation: global-shake 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
		will-change: transform;
	}
</style>
