<script>
	import { tick, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { messages as messagesApi, posts as postsApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';
	import { twemojiAction } from '$lib/actions/twemoji.js';
	import VoiceRecorder from '$lib/components/VoiceRecorder.svelte';
	import MediaPlayer from '$lib/components/MediaPlayer.svelte';

	let conversations = $state([]);
	let activeConvId = $state(null);
	let messages = $state([]);
	let loadingConvs = $state(true);
	let loadingMsgs = $state(false);
	let sending = $state(false);
	let messageText = $state('');
	let attachedVoiceNote = $state(null);
	let showVoiceRecorder = $state(false);
	let chatSessionKey = $state(0); // Increments on every openChat — triggers {#key}

	let scrollContainer = $state();
	let messageInput = $state();
	let processedMessageIds = new Set();
	let deletingMessageId = $state(null);

	let joinedConvId = null; // sala de conversación activa en el socket
	let isPeerTyping = $state(false);
	let typingTimeout = null; // apaga el indicador del peer tras inactividad
	let selfTypingTimeout = null; // debounce del "dejé de escribir" propio

	let activeConv = $derived(conversations.find((c) => Number(c.id) === Number(activeConvId)));

	// Presencia en vivo: usa el store de presencia si el socket está conectado,
	// si no, cae al valor inicial de la API.
	function peerOnline(conv) {
		if (!conv?.peer_id) return false;
		if (notificationsStore.connected) return notificationsStore.isUserOnline(conv.peer_id);
		return !!conv.peer_online;
	}

	// SSE real-time messages
	$effect(() => {
		const newMsgs = notificationsStore.newMessages;
		if (newMsgs.length > 0) {
			let needsScroll = false;
			let shouldReload = false;
			const isNearBottom = scrollContainer
				? scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <
					150
				: true;

			newMsgs.forEach((msg) => {
				if (Number(msg.conversation_id) === Number(activeConvId)) {
					// Solo procesar mensajes realmente nuevos — evita repetir markRead /
					// fetchUnreadMessageCount en cada re-ejecución del $effect (flood de peticiones).
					if (!messages.some((m) => Number(m.id) === Number(msg.id))) {
						const tempIndex = messages.findIndex(
							(m) =>
								m.pending && m.body === msg.body && Number(m.sender_id) === Number(msg.sender_id)
						);
						if (tempIndex !== -1) {
							messages[tempIndex] = { ...msg, pending: false };
							messages = [...messages];
						} else {
							messages = [...messages, msg];
						}
						needsScroll = true;
						shouldReload = true;
						if (Number(msg.sender_id) !== Number(authStore.user?.id)) {
							messagesApi
								.markRead(activeConvId, msg.id)
								.then(() => {
									notificationsStore.fetchUnreadMessageCount();
								})
								.catch(() => {});
						}
					}
				} else if (!processedMessageIds.has(msg.id)) {
					// Mensaje de otra conversación: refrescar la lista una sola vez.
					shouldReload = true;
				}
				processedMessageIds.add(msg.id);
			});

			// NOTA: no se drena la cola global (clearNewMessages) aquí — la comparte la
			// página /messages. La deduplicación por processedMessageIds ya evita el
			// reprocesamiento, así que la cola se deja intacta para otros consumidores.

			if (needsScroll && isNearBottom) scrollToBottom();
			if (shouldReload) loadConversations(true);
		}
	});

	// Indicador "escribiendo..." del peer en tiempo real vía socket.
	$effect(() => {
		const sock = notificationsStore.getSocket?.() ?? null;
		if (!sock) return;
		const handleTyping = ({ convId, userId, isTyping }) => {
			if (Number(convId) !== Number(activeConvId)) return;
			if (Number(userId) === Number(authStore.user?.id)) return;
			if (isTyping) {
				isPeerTyping = true;
				clearTimeout(typingTimeout);
				// Auto-scroll si el usuario está leyendo en tiempo real (cerca del fondo)
				const nearBottom = scrollContainer
					? scrollContainer.scrollHeight -
							scrollContainer.scrollTop -
							scrollContainer.clientHeight <
						150
					: true;
				if (nearBottom) scrollToBottom();
				typingTimeout = setTimeout(() => {
					isPeerTyping = false;
				}, 3000);
			} else {
				clearTimeout(typingTimeout);
				isPeerTyping = false;
			}
		};
		sock.on('typing', handleTyping);
		return () => sock.off('typing', handleTyping);
	});

	function handleMessageReaction(e) {
		const { message_id, emoji, action } = e.detail || {};
		if (!message_id || !emoji) return;

		messages = messages.map((m) => {
			if (Number(m.id) === Number(message_id)) {
				const reactions = { ...(m.reactions || {}) };

				// If action is provided (from local sync)
				if (action === 'removed') {
					if (reactions[emoji]) {
						reactions[emoji].count = Math.max(0, reactions[emoji].count - 1);
						reactions[emoji].reacted = false;
						if (reactions[emoji].count === 0) delete reactions[emoji];
					}
				} else if (action === 'added') {
					if (!reactions[emoji]) reactions[emoji] = { count: 0, reacted: false };
					reactions[emoji].count += 1;
					reactions[emoji].reacted = true;
				} else {
					// Fallback for SSE event (another user reacted)
					if (!reactions[emoji]) reactions[emoji] = { count: 0, reacted: false };
					reactions[emoji].count += 1;
				}
				return { ...m, reactions };
			}
			return m;
		});
	}

	$effect(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('message_reaction', handleMessageReaction);
			window.addEventListener('message_reaction_local', handleMessageReaction);
			return () => {
				window.removeEventListener('message_reaction', handleMessageReaction);
				window.removeEventListener('message_reaction_local', handleMessageReaction);
			};
		}
	});

	$effect(() => {
		if (authStore.isAuthenticated) {
			loadConversations();
		}
	});

	async function loadConversations(isBackground = false) {
		if (!isBackground) loadingConvs = true;
		try {
			const data = await messagesApi.conversations.list();
			let newConvs = data.conversations ? data.conversations.slice(0, 5) : [];
			if (activeConvId) {
				newConvs = newConvs.map((c) =>
					Number(c.id) === Number(activeConvId) ? { ...c, unread_count: 0 } : c
				);
			}
			conversations = newConvs;
		} catch (err) {
			console.error('Error loading conversations for widget:', err);
		} finally {
			if (!isBackground) loadingConvs = false;
		}
	}

	async function openChat(id) {
		messages = [];
		chatSessionKey++;
		activeConvId = id;
		loadingMsgs = true;
		processedMessageIds.clear();
		isPeerTyping = false;

		// Unirse a la sala de la conversación para recibir "typing" en tiempo real
		// (dejando la anterior si la había).
		const sock = notificationsStore.getSocket?.() ?? null;
		if (sock) {
			if (joinedConvId && joinedConvId !== id) sock.emit('leave_conversation', joinedConvId);
			sock.emit('join_conversation', id);
			joinedConvId = id;
		}

		// Optimistically clear unread_count locally
		conversations = conversations.map((c) =>
			Number(c.id) === Number(id) ? { ...c, unread_count: 0 } : c
		);

		try {
			const data = await messagesApi.list(id, { limit: 50 });
			const loadedMessages = data.messages || [];
			loadedMessages.forEach((m) => processedMessageIds.add(m.id));
			messages = loadedMessages;
			await tick();
			scrollToBottom();

			if (messages.length > 0) {
				const lastMsg = messages[messages.length - 1];
				messagesApi
					.markRead(id, lastMsg.id)
					.then(() => {
						notificationsStore.fetchUnreadMessageCount();
					})
					.catch(() => {});
			}
		} catch (err) {
			console.error('Error loading messages:', err);
		} finally {
			loadingMsgs = false;
		}
	}

	function closeChat() {
		const sock = notificationsStore.getSocket?.() ?? null;
		if (sock && joinedConvId) sock.emit('leave_conversation', joinedConvId);
		joinedConvId = null;
		isPeerTyping = false;
		clearTimeout(typingTimeout);
		clearTimeout(selfTypingTimeout);
		activeConvId = null;
		messages = [];
		processedMessageIds.clear();
		notificationsStore.clearNewMessages();
		showVoiceRecorder = false;
		attachedVoiceNote = null;
	}

	async function scrollToBottom() {
		await tick();
		requestAnimationFrame(() => {
			if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
		});
	}

	function isEmojiOnly(text) {
		if (!text) return false;
		const stripped = text.replace(/[\s\uFE0F]/g, '');
		if (!stripped) return false;
		if (!/^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u200D)+$/u.test(stripped))
			return false;
		if (typeof Intl !== 'undefined' && Intl.Segmenter) {
			return (
				[...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(stripped)].length <= 3
			);
		}
		return Array.from(stripped).length <= 5;
	}

	async function sendMessage(e) {
		if (e) e.preventDefault();
		if ((!messageText.trim() && !attachedVoiceNote) || sending) return;

		sending = true;
		const text = messageText.trim();
		messageText = '';

		const tempId = 'temp_' + Date.now();
		const tempMsg = {
			id: tempId,
			conversation_id: activeConvId,
			sender_id: authStore.user?.id,
			body: text,
			created_at: new Date().toISOString(),
			pending: true
		};

		if (attachedVoiceNote) {
			tempMsg.media_type = 'audio';
			try {
				tempMsg.media_url = URL.createObjectURL(attachedVoiceNote);
			} catch (_e) {}
		}

		messages = [...messages, tempMsg];
		scrollToBottom();

		try {
			let payload = { body: text };
			if (attachedVoiceNote) {
				const fd = new FormData();
				fd.append('media', attachedVoiceNote, 'voice_note.webm');
				const uploadRes = await postsApi.uploadMedia(fd);
				if (uploadRes.media && uploadRes.media.length > 0) {
					payload.media_url = uploadRes.media[0].media_url || uploadRes.media[0].url;
					payload.media_type = 'audio';
				} else if (uploadRes.url) {
					payload.media_url = uploadRes.url;
					payload.media_type = 'audio';
				}
			}

			const res = await messagesApi.send(activeConvId, payload);
			const realMsg = res.message || {
				id: res.message_id,
				body: text,
				sender_id: authStore.user?.id
			};

			if (messages.some((m) => Number(m.id) === Number(realMsg.id))) {
				messages = messages.filter((m) => m.id !== tempId);
			} else {
				messages = messages.map((m) =>
					m.id === tempId ? { ...m, ...realMsg, pending: false } : m
				);
			}

			if (realMsg.id) processedMessageIds.add(realMsg.id);
			loadConversations();
		} catch (err) {
			console.error('Error sending message:', err);
			messages = messages.filter((m) => m.id !== tempId);
		} finally {
			sending = false;
			attachedVoiceNote = null;
			if (messageInput && !showVoiceRecorder) messageInput.focus();
		}
	}

	async function deleteMessage(msgId) {
		try {
			await messagesApi.delete(msgId);
			messages = messages.map((m) =>
				m.id === msgId
					? {
							...m,
							body: 'Este mensaje fue eliminado',
							voice_url: null,
							media_url: null,
							media_type: null,
							is_deleted: 1
						}
					: m
			);
		} catch (err) {
			console.error('Error deleting message:', err);
		} finally {
			deletingMessageId = null;
		}
	}

	// Reaccionar a un mensaje (toggle optimista: si ya reaccionaste la quitas, si no la añades).
	async function handleReact(msgId, emoji) {
		const msg = messages.find((m) => Number(m.id) === Number(msgId));
		const alreadyReacted = !!msg?.reactions?.[emoji]?.reacted;
		const action = alreadyReacted ? 'removed' : 'added';
		// Actualización optimista local
		window.dispatchEvent(
			new CustomEvent('message_reaction_local', {
				detail: { message_id: msgId, emoji, action }
			})
		);
		try {
			await messagesApi.react(msgId, emoji);
		} catch (err) {
			// Revertir en caso de error
			window.dispatchEvent(
				new CustomEvent('message_reaction_local', {
					detail: { message_id: msgId, emoji, action: alreadyReacted ? 'added' : 'removed' }
				})
			);
			console.error('Error reaccionando al mensaje:', err);
		}
	}

	function getInitials(name) {
		if (!name) return '?';
		return name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	// Emitir "escribiendo" propio y programar el "dejé de escribir" tras 2s de pausa.
	// Se usa oninput (no onkeydown) para reaccionar solo a cambios reales del texto,
	// ignorando teclas de navegación como flechas, Shift o Tab.
	function handleTypingInput() {
		if (!activeConvId) return;
		const sock = notificationsStore.getSocket?.() ?? null;
		if (!sock) return;
		sock.emit('typing', { convId: activeConvId, isTyping: true });
		clearTimeout(selfTypingTimeout);
		selfTypingTimeout = setTimeout(() => {
			sock.emit('typing', { convId: activeConvId, isTyping: false });
		}, 2000);
	}

	onDestroy(() => {
		processedMessageIds.clear();
		clearTimeout(typingTimeout);
		clearTimeout(selfTypingTimeout);
		const sock = notificationsStore.getSocket?.() ?? null;
		if (sock && joinedConvId) sock.emit('leave_conversation', joinedConvId);
	});
</script>

<div class="glass-panel quick-chat-widget">
	{#if !activeConvId}
		<!-- ── Conversations List ── -->
		<div class="qc-list-view" in:fade={{ duration: 180 }}>
			<div class="qc-list-header">
				<h3 class="qc-title">
					<span class="material-icons-round" style="font-size:15px;color:var(--aero-blue)"
						>chat_bubble</span
					>
					Quick Chat
				</h3>
				<a href="/messages" class="qc-see-all" data-sveltekit-preload-data="hover">Ver todos</a>
			</div>

			<div
				class="qc-conv-list"
				style="overflow-y: scroll; scrollbar-width: thin; scrollbar-color: rgba(46,134,232,0.7) rgba(0,0,0,0.2);"
			>
				{#if loadingConvs}
					<!-- Shimmer skeleton for conversations -->
					{#each [1, 2, 3] as _}
						<div class="qc-conv-skeleton">
							<div class="skel-avatar"></div>
							<div class="skel-text">
								<div class="skel-line" style="width:55%"></div>
								<div class="skel-line" style="width:75%;height:8px;margin-top:5px"></div>
							</div>
						</div>
					{/each}
				{:else if conversations.length === 0}
					<div class="qc-empty">
						<span class="material-icons-round" style="font-size:28px;opacity:0.3">forum</span>
						<p>No hay chats recientes</p>
					</div>
				{:else}
					{#each conversations as conv}
						<button class="qc-conv-item" onclick={() => openChat(conv.id)}>
							<div class="qc-conv-avatar-wrap">
								{#if conv.peer_avatar}
									<img
										src={conv.peer_avatar}
										alt="Avatar"
										class="qc-conv-avatar-img"
										width="36"
										height="36"
										loading="lazy"
										decoding="async"
									/>
								{:else}
									<div class="qc-conv-avatar-fallback">
										{getInitials(conv.peer_display_name || conv.peer_username)}
									</div>
								{/if}
								{#if peerOnline(conv)}
									<span class="qc-online-dot"></span>
								{/if}
							</div>
							<div class="qc-conv-info">
								<div class="qc-conv-top">
									<span class="qc-conv-name"
										>{conv.name || conv.peer_display_name || conv.peer_username}</span
									>
									{#if conv.last_message_at}
										<span class="qc-conv-time"
											>{new Date(conv.last_message_at).toLocaleTimeString([], {
												hour: '2-digit',
												minute: '2-digit'
											})}</span
										>
									{/if}
								</div>
								<p class="qc-conv-preview" class:unread={conv.unread_count > 0}>
									{#if Number(conv.last_message_sender_id) === Number(authStore.user?.id)}
										<span style="opacity:0.6">Tú: </span>
									{/if}
									{conv.last_message_body || 'Nueva conversación'}
								</p>
							</div>
							{#if conv.unread_count > 0}
								<span class="qc-badge">{conv.unread_count}</span>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{:else}
		<!-- ── Active Chat View ── -->
		<div class="qc-chat-view" in:fade={{ duration: 180 }}>
			<!-- Header -->
			<div class="qc-chat-header">
				<button class="qc-back-btn" onclick={closeChat} aria-label="Volver">
					<span class="material-icons-round" style="font-size:18px">arrow_back</span>
				</button>
				<div class="qc-chat-peer">
					{#if activeConv?.peer_avatar}
						<img
							src={activeConv.peer_avatar}
							alt="Avatar"
							class="qc-peer-avatar"
							width="26"
							height="26"
							loading="lazy"
							decoding="async"
						/>
					{:else}
						<div class="qc-peer-avatar-fallback">
							{getInitials(activeConv?.peer_display_name || activeConv?.peer_username)}
						</div>
					{/if}
					<div>
						<p class="qc-peer-name">
							{activeConv?.name ||
								activeConv?.peer_display_name ||
								activeConv?.peer_username ||
								'Chat'}
						</p>
						{#if peerOnline(activeConv)}
							<p class="qc-peer-status">En línea</p>
						{/if}
					</div>
				</div>
				<a href="/messages" class="qc-open-full" title="Abrir chat completo">
					<span class="material-icons-round" style="font-size:16px">open_in_full</span>
				</a>
			</div>

			<!-- Messages -->
			<div bind:this={scrollContainer} class="qc-messages">
				{#if loadingMsgs}
					<!-- Shimmer skeleton for messages — alternating bubbles -->
					<div class="qc-msg-skeletons">
						<div class="qc-msg-skel peer">
							<div class="qc-msg-skel-bubble" style="width:72%"></div>
						</div>
						<div class="qc-msg-skel me">
							<div class="qc-msg-skel-bubble" style="width:55%"></div>
						</div>
						<div class="qc-msg-skel peer">
							<div class="qc-msg-skel-bubble" style="width:80%"></div>
						</div>
						<div class="qc-msg-skel me">
							<div class="qc-msg-skel-bubble" style="width:45%"></div>
						</div>
						<div class="qc-msg-skel peer">
							<div class="qc-msg-skel-bubble" style="width:60%"></div>
						</div>
					</div>
				{:else if messages.length === 0 && !isPeerTyping}
					<div class="qc-messages-empty">
						<span class="material-icons-round" style="font-size:24px;opacity:0.25">waving_hand</span
						>
						<p>¡Escribe algo para saludar!</p>
					</div>
				{:else}
					{#key chatSessionKey}
						<div class="qc-bubbles-frame">
							{#each messages as msg, i}
								{@const isMe = Number(msg.sender_id) === Number(authStore.user?.id)}
								{@const ANIM_WINDOW = 12}
								{@const posFromEnd = messages.length - 1 - i}
								{@const animated = posFromEnd < ANIM_WINDOW}
								{@const animIndex = animated ? ANIM_WINDOW - 1 - posFromEnd : -1}
								{@const staggerDelay = animated ? animIndex * 80 : 0}
								<div
									class="qc-bubble-row {isMe ? 'me' : 'peer'}"
									class:no-anim={!animated}
									style="--stagger-delay: {staggerDelay}ms"
								>
									<div class="qc-bubble-wrapper">
										{#if isMe && !msg.is_deleted}
											<button
												class="qc-msg-action-btn"
												onclick={() => (deletingMessageId = msg.id)}
												aria-label="Eliminar mensaje"
												title="Eliminar mensaje"
											>
												<span class="material-icons-round" style="font-size: 14px;">delete</span>
											</button>
										{/if}
										<div
											class="qc-bubble"
											class:pending={msg.pending}
											class:deleted={msg.is_deleted}
											class:qc-emoji-only={!msg.is_deleted && isEmojiOnly(msg.body || msg.content)}
											use:twemojiAction
										>
											{#if msg.is_deleted}
												<span class="deleted-text"
													><span
														class="material-icons-round"
														style="font-size: 14px; margin-right: 4px; vertical-align: middle;"
														>block</span
													>Este mensaje fue eliminado</span
												>
											{:else}
												{#if msg.media_type === 'audio' || msg.media_type === 'video' || msg.voice_url}
													<div class="mb-1">
														<MediaPlayer
															type={msg.media_type || 'audio'}
															src={msg.media_url || msg.voice_url}
														/>
													</div>
												{/if}
												{#if msg.body || msg.content}
													<div>{msg.body || msg.content}</div>
												{/if}
											{/if}
										</div>
										{#if msg.reactions && Object.keys(msg.reactions).length > 0}
											<div class="qc-reactions-list">
												{#each Object.entries(msg.reactions) as [emoji, data]}
													<button
														class="qc-reaction-tag {data.reacted ? 'user-reacted' : ''}"
														onclick={() => handleReact(msg.id, emoji)}
														aria-label="{data.reacted ? 'Quitar' : 'Reaccionar'} {emoji}"
													>
														<span use:twemojiAction>{emoji}</span>
														<span style="opacity: 0.6;">{data.count}</span>
													</button>
												{/each}
											</div>
										{/if}
										{#if deletingMessageId === msg.id}
											<div class="delete-confirm-inline" in:fade={{ duration: 150 }}>
												<span style="font-weight: 600; opacity: 0.9;">¿Eliminar mensaje?</span>
												<div class="flex gap-2">
													<button class="btn-confirm-del" onclick={() => deleteMessage(msg.id)}
														>Sí, borrar</button
													>
													<button class="btn-cancel-del" onclick={() => (deletingMessageId = null)}
														>Cancelar</button
													>
												</div>
											</div>
										{/if}
									</div>
								</div>
							{/each}
							{#if isPeerTyping}
								<div class="qc-bubble-row peer" in:fade={{ duration: 150 }}>
									<div class="qc-bubble-wrapper" style="align-items: flex-start;">
										{#if activeConv?.peer_avatar}
											<img
												src={activeConv.peer_avatar}
												alt=""
												class="qc-peer-mini-avatar"
												style="width:24px;height:24px;border-radius:50%;object-fit:cover;flex-shrink:0;margin-right:6px;"
												width="24"
												height="24"
												loading="lazy"
												decoding="async"
											/>
										{:else}
											<div
												class="qc-peer-mini-avatar"
												style="width:24px;height:24px;border-radius:50%;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.6rem;flex-shrink:0;margin-right:6px;"
											>
												{getInitials(activeConv?.peer_display_name || activeConv?.peer_username)}
											</div>
										{/if}
										<div class="qc-typing-bubble">
											<span class="qc-dot"></span><span class="qc-dot"></span><span class="qc-dot"
											></span>
										</div>
									</div>
								</div>
							{/if}
						</div>
					{/key}
				{/if}
			</div>

			<!-- Input -->
			<div
				class="qc-input-area"
				style="display: grid; align-items: center; grid-template-columns: minmax(0, 1fr);"
			>
				{#if showVoiceRecorder}
					<div
						class="w-full"
						style="grid-area: 1 / 1;"
						in:fly={{ y: 15, duration: 300, easing: backOut }}
						out:fade={{ duration: 150 }}
					>
						<VoiceRecorder
							variant="compact"
							onrecorded={(blob) => {
								attachedVoiceNote = blob;
								showVoiceRecorder = false;
								sendMessage();
							}}
							oncancel={() => {
								showVoiceRecorder = false;
							}}
						/>
					</div>
				{:else}
					<form
						onsubmit={sendMessage}
						class="qc-form relative flex items-center gap-2"
						style="grid-area: 1 / 1;"
						in:fade={{ duration: 200, delay: 150 }}
						out:fade={{ duration: 150 }}
					>
						<button
							type="button"
							class="qc-action-btn"
							onclick={() => (showVoiceRecorder = !showVoiceRecorder)}
							aria-label="Nota de voz"
						>
							<span class="material-icons-round text-muted" style="font-size:18px">mic</span>
						</button>
						<input
							bind:this={messageInput}
							type="text"
							id="qc_message_input"
							name="qc_message_input"
							bind:value={messageText}
							oninput={handleTypingInput}
							placeholder="Mensaje..."
							class="qc-input"
							autocomplete="off"
						/>
						<button
							type="submit"
							class="qc-send-btn"
							disabled={(!messageText.trim() && !attachedVoiceNote) || sending}
							aria-label="Enviar"
						>
							<span class="material-icons-round" style="font-size:16px">send</span>
						</button>
					</form>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* ── Indicador "escribiendo..." ───────────────────────────── */
	.qc-typing-bubble {
		display: flex;
		gap: 4px;
		align-items: center;
		padding: 8px 12px;
		border-radius: 16px;
		border-bottom-left-radius: 2px;
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
	}
	.qc-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--aero-sky);
		animation: qc-wave 1.3s linear infinite;
	}
	.qc-dot:nth-child(2) {
		animation-delay: -1.1s;
	}
	.qc-dot:nth-child(3) {
		animation-delay: -0.9s;
	}
	@keyframes qc-wave {
		0%,
		60%,
		100% {
			transform: translateY(0);
		}
		30% {
			transform: translateY(-4px);
		}
	}

	/* ── Widget Container ─────────────────────────────────────── */
	.quick-chat-widget {
		overflow: hidden;
		display: flex;
		flex-direction: column;
		padding: 0;
		height: 400px;
	}

	/* ── Conversations List ───────────────────────────────────── */
	.qc-list-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.qc-list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px 10px;
		flex-shrink: 0;
	}

	.qc-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin: 0;
	}

	.qc-see-all {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--aero-blue);
		text-decoration: none;
		opacity: 0.8;
		transition: opacity 150ms;
	}
	.qc-see-all:hover {
		opacity: 1;
	}

	.qc-conv-list {
		flex: 1;
		min-height: 0;
		overflow-y: scroll; /* Always show scrollbar track */
		padding: 0 8px 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	/* ── Custom Invisible Gel Scrollbars ──────────────────────── */
	.qc-conv-list::-webkit-scrollbar,
	.qc-messages::-webkit-scrollbar {
		width: 6px;
	}

	.qc-conv-list::-webkit-scrollbar-track,
	.qc-messages::-webkit-scrollbar-track {
		background: var(--scrollbar-track);
		border-radius: 10px;
	}

	.qc-conv-list::-webkit-scrollbar-thumb,
	.qc-messages::-webkit-scrollbar-thumb {
		background: rgba(14, 165, 233, 0.25); /* Gel cyan/skyblue para Modo Día */
		border-radius: 10px;
	}

	.qc-conv-list::-webkit-scrollbar-thumb:hover,
	.qc-messages::-webkit-scrollbar-thumb:hover {
		background: rgba(14, 165, 233, 0.45);
	}

	/* Modo Noche: Gel blanco translúcido */
	:global([data-theme='dark']) .qc-conv-list::-webkit-scrollbar-thumb,
	:global([data-theme='dark']) .qc-messages::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.15);
	}

	:global([data-theme='dark']) .qc-conv-list::-webkit-scrollbar-thumb:hover,
	:global([data-theme='dark']) .qc-messages::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.25);
	}

	.qc-conv-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
		border-radius: 12px;
		border: none;
		background: transparent;
		cursor: pointer;
		text-align: left;
		transition: background 150ms;
		color: inherit;
	}
	.qc-conv-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.qc-conv-avatar-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.qc-conv-avatar-img {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--glass-border);
	}

	.qc-conv-avatar-fallback {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: linear-gradient(135deg, rgba(46, 134, 232, 0.3), rgba(0, 229, 255, 0.2));
		border: 1px solid var(--glass-border);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--aero-blue);
	}

	.qc-online-dot {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #22c55e;
		border: 2px solid var(--bg-surface);
	}

	.qc-conv-info {
		flex: 1;
		min-width: 0;
	}

	.qc-conv-top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 4px;
	}

	.qc-conv-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.qc-conv-time {
		font-size: 0.6rem;
		color: var(--text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.qc-conv-preview {
		font-size: 0.7rem;
		color: var(--text-muted);
		margin: 2px 0 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.qc-conv-preview.unread {
		font-weight: 700;
		color: var(--text-primary);
	}

	.qc-badge {
		background: var(--aero-blue);
		color: #fff;
		font-size: 0.6rem;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 99px;
		min-width: 18px;
		text-align: center;
		flex-shrink: 0;
	}

	.qc-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 24px 0;
		color: var(--text-muted);
		font-size: 0.72rem;
	}

	/* ── Conversation Skeleton ────────────────────────────────── */
	.qc-conv-skeleton {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
	}

	.skel-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		flex-shrink: 0;
		background: rgba(255, 255, 255, 0.06);
		background-image: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 0%,
			rgba(255, 255, 255, 0.12) 40%,
			rgba(255, 255, 255, 0.04) 80%
		);
		background-size: 200% 100%;
		animation: qc-shimmer 1.4s ease-in-out infinite;
	}

	.skel-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.skel-line {
		height: 10px;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.06);
		background-image: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 0%,
			rgba(255, 255, 255, 0.12) 40%,
			rgba(255, 255, 255, 0.04) 80%
		);
		background-size: 200% 100%;
		animation: qc-shimmer 1.4s ease-in-out infinite;
	}

	.qc-conv-skeleton:nth-child(2) .skel-avatar,
	.qc-conv-skeleton:nth-child(2) .skel-line {
		animation-delay: 0.15s;
	}
	.qc-conv-skeleton:nth-child(3) .skel-avatar,
	.qc-conv-skeleton:nth-child(3) .skel-line {
		animation-delay: 0.3s;
	}

	@keyframes qc-shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* ── Active Chat View ─────────────────────────────────────── */
	.qc-chat-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.qc-chat-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--glass-border);
		background: rgba(255, 255, 255, 0.03);
		border-radius: 20px 20px 0 0;
		flex-shrink: 0;
	}

	.qc-back-btn {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition:
			background 150ms,
			color 150ms;
	}
	.qc-back-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	.qc-chat-peer {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
	}

	.qc-peer-avatar {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.qc-peer-avatar-fallback {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: rgba(46, 134, 232, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--aero-blue);
		flex-shrink: 0;
	}

	.qc-peer-name {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.qc-peer-status {
		font-size: 0.6rem;
		color: #22c55e;
		font-weight: 600;
		margin: 0;
	}

	.qc-open-full {
		color: var(--text-muted);
		opacity: 0.5;
		transition: opacity 150ms;
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}
	.qc-open-full:hover {
		opacity: 1;
	}

	/* ── Messages Area ────────────────────────────────────────── */
	.qc-messages {
		flex: 1 1 0;
		min-height: 0;
		overflow-y: scroll; /* Always show scrollbar track */
		padding: 12px 6px 12px 10px;
		display: flex;
		flex-direction: column;
	}

	.qc-messages-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		flex: 1;
		color: var(--text-muted);
		font-size: 0.72rem;
	}

	/* ── Message Skeleton ─────────────────────────────────────── */
	.qc-msg-skeletons {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 4px 0;
		flex: 1;
	}

	.qc-msg-skel {
		display: flex;
	}
	.qc-msg-skel.me {
		justify-content: flex-end;
	}
	.qc-msg-skel.peer {
		justify-content: flex-start;
	}

	.qc-msg-skel-bubble {
		height: 32px;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.06);
		background-image: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 0%,
			rgba(255, 255, 255, 0.14) 40%,
			rgba(255, 255, 255, 0.04) 80%
		);
		background-size: 200% 100%;
		animation: qc-shimmer 1.4s ease-in-out infinite;
	}

	.qc-msg-skel:nth-child(1) .qc-msg-skel-bubble {
		animation-delay: 0s;
	}
	.qc-msg-skel:nth-child(2) .qc-msg-skel-bubble {
		animation-delay: 0.1s;
	}
	.qc-msg-skel:nth-child(3) .qc-msg-skel-bubble {
		animation-delay: 0.2s;
	}
	.qc-msg-skel:nth-child(4) .qc-msg-skel-bubble {
		animation-delay: 0.3s;
	}
	.qc-msg-skel:nth-child(5) .qc-msg-skel-bubble {
		animation-delay: 0.4s;
	}

	/* ── Bubble Entrance Animation ────────────────────────────── */
	@keyframes qc-bubble-in {
		from {
			opacity: 0;
			transform: translateY(-10px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.qc-bubbles-frame {
		display: flex;
		flex-direction: column;
		gap: 8px;
		justify-content: flex-start;
		flex: 1 0 auto;
		/* Push content to bottom when few messages */
		padding-top: max(0px, calc(100% - 9999px));
	}

	.qc-bubble-row {
		display: flex;
		animation-name: qc-bubble-in;
		animation-fill-mode: both;
		animation-duration: 120ms;
		animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
		animation-delay: var(--stagger-delay, 0ms);
	}
	.qc-bubble-row.no-anim {
		animation: none !important;
		opacity: 1;
		transform: none;
	}

	.qc-emoji-only {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		font-size: 3rem !important;
		padding: 0 !important;
	}
	.qc-bubble-row.me {
		justify-content: flex-end;
	}
	.qc-bubble-row.peer {
		justify-content: flex-start;
	}

	.qc-bubble-wrapper {
		display: flex;
		flex-direction: column;
		max-width: 82%;
		position: relative;
	}
	.qc-bubble-row.me .qc-bubble-wrapper {
		align-items: flex-end;
	}
	.qc-bubble-row.peer .qc-bubble-wrapper {
		align-items: flex-start;
	}

	.qc-bubble {
		padding: 7px 12px;
		border-radius: 16px;
		font-size: 0.76rem;
		line-height: 1.45;
		word-break: break-word;
		transition: opacity 200ms;
	}
	.qc-bubble.pending {
		opacity: 0.6;
	}

	.qc-bubble-row.me .qc-bubble {
		background: var(--grad-primary);
		color: #fff;
		border-bottom-right-radius: 4px;
		box-shadow: 0 3px 10px rgba(46, 134, 232, 0.2);
	}

	.qc-bubble-row.peer .qc-bubble {
		background: rgba(255, 255, 255, 0.07);
		color: var(--text-primary);
		border: 1px solid var(--glass-border);
		border-bottom-left-radius: 4px;
	}

	.qc-msg-action-btn {
		position: absolute;
		right: 100%;
		top: 50%;
		transform: translateY(-50%);
		margin-right: 4px;
		opacity: 0;
		transition:
			opacity 0.2s,
			background 0.2s;
		background: transparent;
		border: none;
		color: var(--rose-500, #f43f5e);
		user-select: none;
		-webkit-user-select: none;
		cursor: pointer;
		padding: 6px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.qc-msg-action-btn:hover {
		background: rgba(244, 63, 94, 0.1);
	}
	.qc-bubble-wrapper:hover .qc-msg-action-btn {
		opacity: 1;
	}
	.deleted-text {
		font-style: italic;
		opacity: 0.6;
		display: flex;
		align-items: center;
	}
	.qc-bubble.deleted {
		background: rgba(255, 255, 255, 0.05) !important;
		border: 1px dashed rgba(255, 255, 255, 0.2) !important;
		color: var(--text-muted) !important;
		box-shadow: none !important;
	}
	.delete-confirm-inline {
		background: rgba(15, 23, 42, 0.95);
		border: 1px solid var(--rose-500, #f43f5e);
		border-radius: 8px;
		padding: 10px;
		margin-top: 4px;
		font-size: 0.8rem;
		color: #fff;
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 10;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}
	.btn-confirm-del {
		background: rgba(244, 63, 94, 0.2);
		color: var(--rose-400, #fb7185);
		border: 1px solid rgba(244, 63, 94, 0.3);
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		transition: all 0.2s;
		flex: 1;
	}
	.btn-confirm-del:hover {
		background: rgba(244, 63, 94, 0.3);
		border-color: rgba(244, 63, 94, 0.5);
	}
	.btn-cancel-del {
		background: transparent;
		color: #94a3b8;
		border: 1px solid #334155;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		transition: all 0.2s;
		flex: 1;
	}
	.btn-cancel-del:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.qc-reactions-list {
		display: flex;
		gap: 3px;
		margin-top: 3px;
		flex-wrap: wrap;
	}
	.qc-reaction-tag {
		padding: 2px 5px;
		border-radius: 8px;
		background: rgba(0, 229, 255, 0.06);
		border: 1px solid rgba(0, 119, 255, 0.1);
		font-size: 0.65rem;
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.qc-reaction-tag.user-reacted {
		background: rgba(0, 119, 255, 0.2);
		border-color: var(--primary);
	}

	/* Noto Color Emoji renders via font — no img tags needed */

	/* ── Input Area ───────────────────────────────────────────── */
	.qc-input-area {
		padding: 10px 10px 12px;
		border-top: 1px solid var(--glass-border);
		flex-shrink: 0;
	}

	.qc-form {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.qc-action-btn {
		width: 44px;
		height: 44px;
		flex: 0 0 44px;
		min-width: 44px;
		min-height: 44px;
		border-radius: 50%;
		border: none;
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 150ms;
		flex-shrink: 0;
	}
	.qc-action-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	.qc-action-btn:active {
		background: rgba(255, 255, 255, 0.15);
	}

	.qc-input {
		flex: 1;
		min-width: 0;
		height: 44px;
		padding: 0 16px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--glass-border);
		color: var(--text-primary);
		font-size: 0.75rem;
		outline: none;
		transition:
			border-color 150ms,
			background 150ms;
	}
	.qc-input::placeholder {
		color: var(--text-muted);
	}
	.qc-input:focus {
		border-color: rgba(46, 134, 232, 0.4);
		background: rgba(255, 255, 255, 0.09);
	}

	.qc-send-btn {
		width: 44px;
		height: 44px;
		flex: 0 0 44px;
		min-width: 44px;
		min-height: 44px;
		border-radius: 50%;
		background: var(--grad-primary);
		border: none;
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-shadow: 0 4px 12px rgba(46, 134, 232, 0.3);
		transition:
			transform 150ms,
			box-shadow 150ms,
			opacity 150ms;
	}
	.qc-send-btn:hover:not(:disabled) {
		transform: scale(1.08);
		box-shadow: 0 6px 16px rgba(46, 134, 232, 0.4);
	}
	.qc-send-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* ── Custom Scrollbar ─────────────────────────────────────── */
	:global(.qc-messages::-webkit-scrollbar),
	:global(.qc-conv-list::-webkit-scrollbar) {
		width: 5px !important;
		background: rgba(0, 0, 0, 0.2) !important;
	}
	:global(.qc-messages::-webkit-scrollbar-track),
	:global(.qc-conv-list::-webkit-scrollbar-track) {
		background: rgba(0, 0, 0, 0.15) !important;
		border: none !important;
	}
	:global(.qc-messages::-webkit-scrollbar-thumb),
	:global(.qc-conv-list::-webkit-scrollbar-thumb) {
		background: rgba(46, 134, 232, 0.8) !important;
		border-radius: 6px !important;
		border: none !important;
	}
	:global(.qc-messages::-webkit-scrollbar-thumb:hover),
	:global(.qc-conv-list::-webkit-scrollbar-thumb:hover) {
		background: rgba(46, 134, 232, 1) !important;
	}
</style>
