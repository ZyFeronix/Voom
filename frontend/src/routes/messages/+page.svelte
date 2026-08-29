<script>
	import { onMount, onDestroy, tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { messages as messagesApi, marketplace as marketplaceApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';
	import { RTCManager } from '$lib/rtc.js';

	import { createChatStore } from '$lib/stores/chat.svelte.js';
	import { createRTCStore } from '$lib/stores/rtc.svelte.js';
	import { playNudge, playMessageReceived } from '$lib/utils/sound.js';
	import { ZUMBIDO_TEXT, isZumbidoMessage } from '$lib/utils/zumbido.js';

	import ConversationsSidebar from './components/ConversationsSidebar.svelte';
	import ChatPane from './components/ChatPane.svelte';
	import RTCModals from './components/RTCModals.svelte';
	import NewDMModal from './components/NewDMModal.svelte';

	const chatStore = createChatStore();
	const rtcStore = createRTCStore();

	let mobileView = $state('list'); // 'list' or 'chat'
	let isPeerTyping = $state(false);
	let typingTimeout = null;
	let joinedConvId = null;

	// Producto de Marketplace vinculado desde /marketplace (?product=<id>)
	let pendingProduct = $state(null);

	let showNewDMModal = $state(false);
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

	async function loadConversations(hideLoading = false) {
		if (!hideLoading) chatStore.loadingConvs = true;
		try {
			const res = await messagesApi.conversations.list();
			chatStore.setConversations(res.conversations || []);
			// Sin auto-selección: se muestra la tarjeta de bienvenida y el usuario
			// elige la conversación manualmente.
		} catch (e) {
			console.error('Failed to load conversations', e);
		} finally {
			if (!hideLoading) chatStore.loadingConvs = false;
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
			tick().then(() => chatPaneComponent?.ensureScrollToBottom(true, 'instant'));
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
					await loadConversations(true);
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
					loadConversations(true);
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
		const cleanText = (text || '').trim();
		const finalBody = cleanText || (voiceBlob ? 'Nota de voz' : file ? 'Archivo adjunto' : '');
		const pendingMsg = {
			id: tempId,
			conversation_id: chatStore.activeConvId,
			sender_id: authStore.user?.id,
			body: finalBody,
			content: finalBody,
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
			chatPaneComponent?.ensureScrollToBottom(true, 'smooth');
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
				body: cleanText,
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
						body: cleanText,
						media_url: uploadedMedia,
						media_type: mediaType,
						reply_to_id: replyTo?.id || null
					}
				});
			}
			loadConversations(true);
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
			tick().then(() => chatPaneComponent?.ensureScrollToBottom(true, 'smooth'));
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
				tick().then(() => chatPaneComponent?.ensureScrollToBottom(true, 'smooth'));
				loadConversations(true);
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
			await loadConversations(true);
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
				loadConversations(true);
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

		// La clase RTCManager recibe las callbacks por constructor:
		// (conversationId, onStreamAdded, onStreamRemoved, callType).
		const rm = new RTCManager(
			chatStore.activeConvId,
			(peerId, stream, streamCallType) => {
				// Track remoto recibido: se registra una sola vez por peer.
				if (!rtcStore.remoteStreams.some((rs) => rs.peerId === peerId)) {
					rtcStore.remoteStreams = [
						...rtcStore.remoteStreams,
						{ peerId, stream, callType: streamCallType }
					];
				}
			},
			(peerId) => {
				// Stream remoto retirado (peer colgó, falló o se cerró la PC).
				rtcStore.remoteStreams = rtcStore.remoteStreams.filter((rs) => rs.peerId !== peerId);
				// Si ya no queda ningún peer remoto en una llamada activa, se corta.
				// El guard evita re-entrada: rtc.js marca _closed en sendHangupAndClose.
				if (rtcStore.remoteStreams.length === 0 && rtcStore.inCall && rtcManager) {
					endCall();
				}
			},
			type
		);

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
		if (newMsgs.length === 0) return;
		untrack(() => {
			// Refrescar el sidebar ÚNICAMENTE cuando llega un mensaje genuinamente
			// nuevo (ya sea de la conversación activa o de otra). Evita re-fetch
			// espurios por duplicados o por mensajes propios ya reflejados en
			// handleSendMessage (que llama a loadConversations al enviar).
			let shouldReloadSidebar = false;

			newMsgs.forEach((msg) => {
				const isActiveConv = Number(msg.conversation_id) === Number(chatStore.activeConvId);

				if (isActiveConv) {
					if (
						!chatStore.messages.some(
							(m) => (m.id && msg.id && Number(m.id) === Number(msg.id)) || m.id === msg.id
						)
					) {
						shouldReloadSidebar = true;
						const tempIndex = chatStore.messages.findIndex(
							(m) =>
								m.pending &&
								Number(m.sender_id) === Number(msg.sender_id) &&
								((m.body || '').trim() === (msg.body || '').trim() ||
									(m.media_type && m.media_type === msg.media_type) ||
									(!m.body && !msg.body))
						);
						if (tempIndex !== -1) {
							chatStore.messages[tempIndex] = { ...msg, pending: false, uploading: false };
							chatStore.messages = [...chatStore.messages];
						} else {
							chatStore.addMessage(msg);
						}

						if (Number(msg.sender_id) !== Number(authStore.user?.id)) {
							// Zumbido recibido: reproduce el sonido nudge.
							if (isZumbidoMessage(msg)) {
								playNudge();
								triggerShake();
							} else {
								playMessageReceived();
							}
							messagesApi
								.markRead(chatStore.activeConvId, msg.id)
								.then(() => {
									notificationsStore.fetchUnreadMessageCount();
								})
								.catch(() => {});
						}
						tick().then(() => chatPaneComponent?.ensureScrollToBottom(false, 'smooth'));
					}
				} else {
					// Mensaje de otra conversación: el hilo activo no se toca, pero el
					// sidebar debe reflejar el último mensaje y el badge de no leídos.
					shouldReloadSidebar = true;
					if (Number(msg.sender_id) !== Number(authStore.user?.id)) {
						playMessageReceived();
					}
				}
			});

			if (shouldReloadSidebar) loadConversations(true);
			notificationsStore.clearNewMessages();
		});
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
								// 'hangup' lo gestiona la propia clase (cierra la PC y dispara
								// onStreamRemoved → limpia remoteStreams y corta la llamada si
								// quedó vacía). 'peer_left' es defensivo: handleSignal lo ignora.
								if (rtcStore.inCall && rtcManager) {
									await rtcManager.handleSignal(sig.sender_id, payload);
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

	// Handlers Socket.IO efímeros de la vista. Se registran/de-registran de forma
	// reactiva (suscripción viviente) vía Svelte 5 $effect con función de limpieza,
	// en lugar de un sondeo con setInterval que dejaba listeners huérfanos tras
	// caídas de red o reconexiones tardías.
	//
	// Se usan funciones declaradas (no arrow en variables reasignadas) para que el
	// $effect de suscripción pueda referenciar referencias estables y el cleanup
	// haga socket.off() con la misma referencia exacta.

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

	function handleIncomingTyping(data) {
		// El servidor emite { convId, userId, isTyping } (ver lib/server/socket.js).
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
	}

	function handleIncomingZumbido(data) {
		// Manejador de zumbidos directos en tiempo real.
		if (Number(data.senderId) === Number(authStore.user?.id)) return;
		playNudge();
		triggerShake();
		if (Number(data.convId) !== Number(chatStore.activeConvId)) {
			loadConversations(true);
		}
	}

	function handleMessageEdited(data) {
		if (Number(data.conversation_id) === Number(chatStore.activeConvId)) {
			chatStore.updateMessage(data.id, {
				body: data.body,
				content: data.body,
				edited_at: data.edited_at
			});
		}
	}

	function handleMessageDeleted(data) {
		if (Number(data.conversation_id) === Number(chatStore.activeConvId)) {
			chatStore.deleteMessage(data.id);
		}
		loadConversations(true);
	}

	function handleMessagesRead(data) {
		if (Number(data.conversation_id) === Number(chatStore.activeConvId)) {
			chatStore.applyPeerLastRead(data.last_read_id);
		}
	}

	// Reacciones en vivo del peer (añadir/quitar). Las propias ya se aplican
	// de forma optimista en handleReact, así que se ignoran aquí.
	function handleMessageReaction(data) {
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
	}

	// Suscripción viviente a los eventos Socket.IO de la vista.
	// Reacciona cuando el socket cambia (reconexiones) o conecta: registra los
	// listeners y re-registra tras caídas de red. El cleanup desregistra todo.
	// No depende de activeConvId para registrarse; los handlers filtran por
	// conversación internamente y el join de sala se gestiona en selectConversation.
	$effect(() => {
		const socket = notificationsStore.getSocket();
		if (!socket) return;

		const register = () => {
			socket.on('typing', handleIncomingTyping);
			socket.on('zumbido', handleIncomingZumbido);
			socket.on('message_edited', handleMessageEdited);
			socket.on('message_deleted', handleMessageDeleted);
			socket.on('messages_read', handleMessagesRead);
			socket.on('message_reaction', handleMessageReaction);
		};

		// Registrar inmediatamente si ya está conectado y en las reconexiones.
		if (socket.connected) register();
		socket.on('connect', register);

		return () => {
			socket.off('connect', register);
			socket.off('typing', handleIncomingTyping);
			socket.off('zumbido', handleIncomingZumbido);
			socket.off('message_edited', handleMessageEdited);
			socket.off('message_deleted', handleMessageDeleted);
			socket.off('messages_read', handleMessagesRead);
			socket.off('message_reaction', handleMessageReaction);
		};
	});

	onMount(async () => {
		await loadConversations();
		const peerParam = page.url.searchParams.get('peer');
		if (peerParam) {
			const conv = chatStore.conversations.find((c) => c.peer_username === peerParam);
			if (conv) selectConversation(conv.id);
		}

		// Enlace directo desde Marketplace: abrir la conversación con el vendedor
		// y vincular el producto en el compositor (?product=<listingId>).
		const productParam = page.url.searchParams.get('product');
		if (productParam && /^\d+$/.test(productParam)) {
			try {
				const { listing } = await marketplaceApi.get(productParam);
				if (listing) {
					pendingProduct = {
						id: listing.id,
						title: listing.title,
						price: listing.price,
						image: listing.image_url || null,
						url: `/marketplace?item=${listing.id}`
					};
					let conv = chatStore.conversations.find(
						(c) => Number(c.peer_id) === Number(listing.user_id)
					);
					if (!conv) {
						const res = await messagesApi.conversations.create({
							user_id: listing.user_id
						});
						if (res.conversation_id) {
							await loadConversations(true);
							conv = chatStore.conversations.find(
								(c) => Number(c.id) === Number(res.conversation_id)
							);
						}
					}
					if (conv) selectConversation(conv.id);
				}
			} catch (err) {
				console.error('Failed to attach marketplace product:', err);
			}
			// Limpiar la query para no re-vincular el producto al recargar
			goto('/messages', { replaceState: true });
		}

		// Los handlers de socket se definen y registran de forma reactiva en el
		// $effect `socketEventSubscriptions` (ver más abajo), no dentro de onMount.
	});

	onDestroy(() => {
		if (typingTimeout) clearTimeout(typingTimeout);
		if (shakeTimeout) clearTimeout(shakeTimeout);
		if (nudgeCooldownTimer) clearInterval(nudgeCooldownTimer);
		const socket = notificationsStore.getSocket();
		if (socket) {
			// Salir de la sala de la conversación activa al abandonar la vista.
			// Los listeners de eventos ya se desregistran en el cleanup del $effect
			// `socketEventSubscriptions`; aquí solo se abandona la sala.
			if (joinedConvId) socket.emit('leave_conversation', joinedConvId);
		}
		if (rtcManager) {
			// close() detiene el stream local y cierra todas las PeerConnections.
			rtcManager.close();
		}
	});
</script>

<svelte:head>
	<title>Mensajes — Voom!</title>
</svelte:head>

<div class="messages-container" class:shake={isShaking}>
	<!-- .chat-window define su propio glass (blur/ruido/especular); NO apilar la
	     clase global glass-card: duplicaría backdrop-filter y pseudo-capas. -->
	<div class="chat-window">
		<ConversationsSidebar
			{chatStore}
			{mobileView}
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
			bind:pendingProduct
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

<style>
	/* ═══════════════════════════════════════════════════════════
	   Voom! Messenger — Shell "Retro-Aero limpio"
	   Una sola superficie de cristal por zona, cero gradientes
	   apilados, un acento (azul aero) para la interacción.
	   ═══════════════════════════════════════════════════════════ */

	.messages-container {
		position: relative;
		width: 100%;
		height: 100dvh;
		max-height: 100dvh;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--bg-base, #071322);
	}

	@media (max-width: 768px) {
		.messages-container {
			height: var(--vv-height, 100dvh);
			max-height: var(--vv-height, 100dvh);
			padding-bottom: 72px;
			box-sizing: border-box;
		}

		:global(html.has-keyboard) .messages-container {
			padding-bottom: 8px;
		}
	}

	/* Superficie única de mensajería: ocupa TODO el área, sin
	   zonas flotantes ni márgenes. Un solo cristal + hairline. */
	.chat-window {
		position: relative;
		display: flex;
		flex: 1 1 auto;
		min-height: 0;
		width: 100%;
		height: 100%;
		border-radius: 0;
		overflow: hidden;
		isolation: isolate;
		border: none;
		background: rgba(13, 27, 46, 0.72);
		backdrop-filter: var(--glass-blur, blur(18px) saturate(1.15));
		-webkit-backdrop-filter: var(--glass-blur, blur(18px) saturate(1.15));
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}

	:global([data-theme='light']) .chat-window {
		background: rgba(255, 255, 255, 0.88);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	:global([data-theme='dark']) .chat-window {
		background: rgba(13, 27, 46, 0.78);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}

	:global([data-theme='midnight']) .chat-window {
		background: rgba(6, 13, 28, 0.9);
		box-shadow: inset 0 1px 0 rgba(160, 210, 255, 0.08);
	}

	/* ── Perfiles de rendimiento ───────────────────────────── */
	:global(:root[data-perf='high']) .chat-window,
	:global(:root[data-perf-profile='high']) .chat-window {
		backdrop-filter: var(--glass-blur, blur(16px) saturate(1.15));
		-webkit-backdrop-filter: var(--glass-blur, blur(16px) saturate(1.15));
	}

	:global(:root[data-perf='balanced']) .chat-window,
	:global(:root[data-perf-profile='balanced']) .chat-window {
		backdrop-filter: blur(8px) saturate(1.05);
		-webkit-backdrop-filter: blur(8px) saturate(1.05);
	}

	:global(:root[data-perf='eco']) .chat-window,
	:global(:root[data-perf-profile='lite']) .chat-window,
	:global(:root[data-perf-mode='true']) .chat-window {
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
		background: var(--bg-surface-solid, var(--bg-surface)) !important;
		box-shadow: none !important;
	}

	/* ── Zumbido: sacudida de la ventana completa ──────────── */
	@keyframes global-shake {
		0%,
		100% {
			transform: translate3d(0, 0, 0) rotate(0deg);
		}
		10%,
		90% {
			transform: translate3d(-8px, -3px, 0) rotate(-0.6deg);
		}
		20%,
		80% {
			transform: translate3d(10px, 4px, 0) rotate(0.8deg);
		}
		30%,
		50%,
		70% {
			transform: translate3d(-12px, 5px, 0) rotate(-1deg);
		}
		40%,
		60% {
			transform: translate3d(12px, -4px, 0) rotate(1deg);
		}
	}

	.messages-container.shake,
	.messages-container.shake .chat-window {
		animation: global-shake 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
		will-change: transform;
	}
</style>
