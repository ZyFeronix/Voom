<script>
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';
	import { isSoundEnabled, setSoundEnabled } from '$lib/utils/sound.js';
	import { formatDayLabel, isDifferentDay, lastSeenLabel } from '$lib/utils/datetime.js';
	import { isZumbidoMessage, ZUMBIDO_TEXT } from '$lib/utils/zumbido.js';
	import MessageBubble from './MessageBubble.svelte';
	import ChatComposer from './ChatComposer.svelte';
	import MsnContactCard from '$lib/components/MsnContactCard.svelte';
	import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';

	let {
		chatStore,
		rtcStore,
		mobileView,
		onBackMobile,
		onStartAudioCall,
		onStartVideoCall,
		onEndCall,
		onLoadMore,
		onSendMessage,
		onSendZumbido,
		nudgeCooldown = 0,
		isPeerTyping,
		onDeleteMessage,
		onReact,
		onReply,
		onEdit,
		onNewDM,
		onTyping,
		onRetrySend,
		onDiscardMessage,
		pendingProduct = $bindable(null)
	} = $props();

	let scrollContainer = $state(null);
	let composerComponent = $state(null);
	let deletingMessageId = $state(null);
	let activeReactionMsgId = $state(null);
	// Portal de reacciones: posición fija calculada desde el botón que lo abre.
	// position:fixed evita el recorte por overflow del área de mensajes y el
	// solape con burbujas vecinas.
	let pickerX = $state(0);
	let pickerY = $state(0);
	let pickerUp = $state(false);
	let paneEl = $state(null);
	let showMsnContactCard = $state(false);
	let soundOn = $state(isSoundEnabled());

	function toggleSound() {
		soundOn = !soundOn;
		setSoundEnabled(soundOn);
	}

	// Buscador dentro del chat
	let showSearch = $state(false);
	let searchTerm = $state('');
	let searchMatches = $state([]);
	let currentMatchIdx = $state(0);

	// Botón flotante "bajar al último mensaje"
	let showScrollDown = $state(false);
	let atBottom = $state(true);
	let contentElement = $state(null);
	let isInitialConvLoad = $state(true);
	let prevConvId = $state(null);
	let prevMsgCount = $state(0);

	export function focusComposer() {
		composerComponent?.focus?.();
	}

	// Recalcula coincidencias del buscador cuando cambia el término o los mensajes.
	$effect(() => {
		const term = searchTerm.trim().toLowerCase();
		const msgs = chatStore.messages;
		if (!term) {
			searchMatches = [];
			currentMatchIdx = 0;
			return;
		}
		const matches = [];
		for (const m of msgs) {
			const body = (m.body || m.content || '').toLowerCase();
			if (!m.is_deleted && body.includes(term)) matches.push(m.id);
		}
		searchMatches = matches;
		if (currentMatchIdx >= matches.length) currentMatchIdx = 0;
	});

	function scrollToMessage(id) {
		const el = scrollContainer?.querySelector(`[data-msg-id="${id}"]`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			el.classList.remove('quote-highlight');
			void el.offsetWidth; // forzar reflow para reiniciar la animación
			el.classList.add('quote-highlight');
			setTimeout(() => {
				el?.classList.remove('quote-highlight');
			}, 1800);
		}
	}

	function gotoMatch(dir) {
		if (searchMatches.length === 0) return;
		currentMatchIdx = (currentMatchIdx + dir + searchMatches.length) % searchMatches.length;
		scrollToMessage(searchMatches[currentMatchIdx]);
	}

	function toggleSearch() {
		showSearch = !showSearch;
		if (!showSearch) {
			searchTerm = '';
			searchMatches = [];
		}
	}

	function getInitials(name) {
		if (!name) return '?';
		return name.substring(0, 2).toUpperCase();
	}

	function peerOnline(conv) {
		if (!conv?.peer_id) return false;
		if (notificationsStore.connected) return notificationsStore.isUserOnline(conv.peer_id);
		return !!conv.peer_online;
	}

	function handleScroll() {
		if (!scrollContainer) return;
		// Cerrar el portal de reacciones al desplazar el historial.
		if (activeReactionMsgId !== null) activeReactionMsgId = null;
		// Si nos acercamos al top, cargamos más
		if (
			scrollContainer.scrollTop < 100 &&
			chatStore.hasMoreMessages &&
			!chatStore.loadingMoreMessages
		) {
			loadMore();
		}
		// Detectar si el usuario está cerca del fondo para el botón flotante
		const dist =
			scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
		atBottom = dist < 120;
		showScrollDown = !atBottom;
	}

	// Carga mensajes anteriores preservando la posición de scroll para que la
	// vista no salte al inicio al prepender el bloque de mensajes antiguos.
	async function loadMore() {
		if (!scrollContainer || chatStore.loadingMoreMessages || !chatStore.hasMoreMessages) return;
		const prevHeight = scrollContainer.scrollHeight;
		const prevTop = scrollContainer.scrollTop;
		await onLoadMore();
		await tick();
		requestAnimationFrame(() => {
			if (!scrollContainer) return;
			scrollContainer.scrollTop = prevTop + (scrollContainer.scrollHeight - prevHeight);
		});
	}

	export function scrollToBottom(force = true, behavior = 'smooth') {
		if (!scrollContainer) return;
		if (!force && !atBottom) return;
		if (behavior === 'instant' || behavior === 'auto') {
			scrollContainer.scrollTop = scrollContainer.scrollHeight;
		} else {
			scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
		}
		atBottom = true;
		showScrollDown = false;
	}

	// Asegura que la vista se desplace y permanezca en el último mensaje incluso ante
	// reflows del navegador, transiciones de entrada o carga asíncrona de recursos.
	export function ensureScrollToBottom(force = true, behavior = 'instant') {
		if (!scrollContainer) return;
		if (!force && !atBottom && !isInitialConvLoad) return;

		const applyScroll = () => {
			if (!scrollContainer) return;
			if (behavior === 'instant' || behavior === 'auto') {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			} else {
				scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
			}
			atBottom = true;
			showScrollDown = false;
		};

		applyScroll();
		requestAnimationFrame(applyScroll);
		setTimeout(applyScroll, 40);
		setTimeout(applyScroll, 120);
		setTimeout(applyScroll, 280);
		setTimeout(applyScroll, 450);
	}

	// ResizeObserver: Cuando el contenedor de mensajes cambia de tamaño (por render
	// de fuentes, hidratación o emoticons), mantiene la posición al fondo si correspondía.
	$effect(() => {
		if (!contentElement || !scrollContainer) return;
		const ro = new ResizeObserver(() => {
			if (atBottom || isInitialConvLoad) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		});
		ro.observe(contentElement);
		return () => ro.disconnect();
	});

	// Captura el evento 'load' de imágenes y videos hijos para que cuando terminen
	// de descargarse y adquieran su altura real, no dejen desfasado el scroll hacia arriba.
	$effect(() => {
		if (!scrollContainer) return;
		const handleMediaLoad = (e) => {
			if (e.target && (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO')) {
				if (atBottom || isInitialConvLoad) {
					scrollContainer.scrollTop = scrollContainer.scrollHeight;
				}
			}
		};
		scrollContainer.addEventListener('load', handleMediaLoad, true);
		return () => {
			scrollContainer?.removeEventListener('load', handleMediaLoad, true);
		};
	});

	// Efecto reactivo para detectar cambio de conversación o llegada de mensajes
	$effect(() => {
		const currentConvId = chatStore.activeConvId;
		const loading = chatStore.loadingMsgs;
		const messages = chatStore.messages;
		const msgCount = messages.length;

		// Cambio de chat: reiniciar bandera inicial para garantizar descenso al fondo
		if (currentConvId !== prevConvId) {
			prevConvId = currentConvId;
			prevMsgCount = 0;
			isInitialConvLoad = true;
			atBottom = true;
			showScrollDown = false;
		}

		// Al finalizar de cargar mensajes en la conversación activa:
		if (!loading && msgCount > 0 && isInitialConvLoad) {
			tick().then(() => {
				ensureScrollToBottom(true, 'instant');
				setTimeout(() => {
					isInitialConvLoad = false;
				}, 500);
			});
		} else if (!isInitialConvLoad && msgCount > prevMsgCount) {
			// Mensaje nuevo agregado a la conversación activa
			const lastMsg = messages[msgCount - 1];
			const isFromMe = Number(lastMsg?.sender_id) === Number(authStore.user?.id);
			tick().then(() => {
				if (isFromMe) {
					ensureScrollToBottom(true, 'smooth');
				} else if (atBottom) {
					ensureScrollToBottom(false, 'smooth');
				}
			});
		}

		prevMsgCount = msgCount;
	});

	const PICKER_WIDTH = 320;
	const PICKER_HEIGHT = 270; // grilla 210px + pestañas + padding del portal
	const PICKER_GAP = 8;

	function handleReactionMenuClick(e, msgId) {
		e.stopPropagation();
		if (activeReactionMsgId === msgId) {
			activeReactionMsgId = null;
			return;
		}
		activeReactionMsgId = msgId;
		const rect = e.currentTarget.getBoundingClientRect();
		// El portal debe quedar DENTRO del área del chat (nunca sobre la
		// sidebar ni fuera de la ventana): se clampa a los límites del pane.
		const pane = (paneEl || document.body).getBoundingClientRect();
		const loX = pane.left + 8;
		const hiX = Math.max(loX, pane.right - PICKER_WIDTH - 8);
		pickerX = Math.min(Math.max(loX, rect.left + rect.width / 2 - PICKER_WIDTH / 2), hiX);
		// Flip según el espacio DENTRO del pane (no del viewport).
		const spaceBelow = pane.bottom - rect.bottom;
		const fitsDown = spaceBelow >= PICKER_HEIGHT + PICKER_GAP;
		const fitsUp = rect.top - pane.top >= PICKER_HEIGHT + PICKER_GAP;
		pickerUp = !fitsDown && fitsUp;
		if (pickerUp) {
			// translateY(-100%): el ancla es el borde inferior del portal.
			pickerY = Math.max(rect.top - PICKER_GAP, pane.top + 8 + PICKER_HEIGHT);
		} else {
			pickerY = Math.min(rect.bottom + PICKER_GAP, pane.bottom - 8 - PICKER_HEIGHT);
		}
	}

	function handlePaneKeydown(e) {
		if (e.key === 'Escape' && activeReactionMsgId !== null) {
			activeReactionMsgId = null;
		}
	}
</script>

<svelte:window onkeydown={handlePaneKeydown} />

<div class="chat-pane" class:hidden-mobile={mobileView === 'list'} bind:this={paneEl}>
	{#if chatStore.activeConvId && chatStore.activeConv}
		<!-- Cabecera única: identidad + estado en vivo + acciones.
		     El wrapper interno la alinea con la columna de mensajes (980px). -->
		<header class="chat-header">
			<div class="chat-header-inner">
				<div class="peer-profile-info">
					<!-- Volver (solo móvil) -->
					<button
						onclick={() => {
							chatStore.setActiveConvId(null);
							onBackMobile();
						}}
						class="back-mobile-btn"
						style="flex: 0 0 32px; min-width: 32px; min-height: 32px;"
						aria-label="Volver a la lista de conversaciones"
						title="Volver"
					>
						<span class="material-icons-round">arrow_back</span>
					</button>

					<div
						class="conv-avatar-wrapper"
						style="flex: 0 0 44px; min-width: 44px; min-height: 44px;"
					>
						<div class="conv-avatar">
							{#if chatStore.activeConv.peer_avatar}
								<img
									src={chatStore.activeConv.peer_avatar}
									alt={chatStore.activeConv.name || chatStore.activeConv.peer_display_name}
									width="44"
									height="44"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<span
									>{getInitials(
										chatStore.activeConv.name ||
											chatStore.activeConv.peer_display_name ||
											chatStore.activeConv.peer_username
									)}</span
								>
							{/if}
						</div>
						<span
							class="presence-dot"
							class:on={peerOnline(chatStore.activeConv)}
							title={peerOnline(chatStore.activeConv) ? 'En línea' : 'Desconectado'}
						></span>
					</div>

					<div class="peer-text-block">
						<h2 class="peer-name">
							<span class="peer-name-text">
								{chatStore.activeConv.name ||
									chatStore.activeConv.peer_display_name ||
									chatStore.activeConv.peer_username}
							</span>
							{#if chatStore.activeConv.is_verified}
								<span class="material-icons-round verified-check" title="Cuenta verificada"
									>verified</span
								>
							{/if}
						</h2>
						<p class="peer-status" class:typing-status={isPeerTyping}>
							{#if isPeerTyping}
								<span class="typing-inline-dots" aria-hidden="true">
									<span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>
								</span>
								Escribiendo…
							{:else if peerOnline(chatStore.activeConv)}
								<span class="status-live-dot" aria-hidden="true"></span>
								Activo ahora
							{:else}
								{lastSeenLabel(chatStore.activeConv.peer_last_seen)}
							{/if}
						</p>
					</div>
				</div>

				<div class="chat-actions" role="toolbar" aria-label="Acciones del chat">
					<!-- Zumbido: llama la atención del peer (estilo MSN) -->
					<button
						class="icon-btn zumbido-btn"
						class:in-cooldown={nudgeCooldown > 0}
						disabled={nudgeCooldown > 0}
						title={nudgeCooldown > 0
							? `Espera ${nudgeCooldown}s para enviar otro zumbido`
							: 'Enviar un Zumbido'}
						aria-label={nudgeCooldown > 0
							? `Zumbido en espera (${nudgeCooldown}s)`
							: 'Enviar un Zumbido'}
						onclick={() =>
							onSendZumbido ? onSendZumbido() : onSendMessage?.({ text: ZUMBIDO_TEXT })}
					>
						{#if nudgeCooldown > 0}
							<span class="cooldown-num">{nudgeCooldown}</span>
						{:else}
							<span class="material-icons-round">bolt</span>
						{/if}
					</button>

					{#if rtcStore.inCall}
						<button class="icon-btn call-end-btn" title="Colgar llamada" onclick={onEndCall}>
							<span class="material-icons-round">call_end</span>
						</button>
					{:else}
						<button
							class="icon-btn"
							title="Llamada de audio"
							aria-label="Iniciar llamada de audio"
							onclick={onStartAudioCall}
						>
							<span class="material-icons-round">call</span>
						</button>
						<button
							class="icon-btn"
							title="Videollamada"
							aria-label="Iniciar videollamada"
							onclick={onStartVideoCall}
						>
							<span class="material-icons-round">videocam</span>
						</button>
					{/if}

					<button
						type="button"
						class="icon-btn"
						class:toggled={soundOn === false}
						title={soundOn ? 'Sonidos activados' : 'Sonidos silenciados'}
						aria-label={soundOn ? 'Silenciar sonidos' : 'Activar sonidos'}
						onclick={toggleSound}
					>
						<span class="material-icons-round">{soundOn ? 'volume_up' : 'volume_off'}</span>
					</button>
					<button
						type="button"
						class="icon-btn"
						class:toggled={showSearch}
						title="Buscar en la conversación"
						aria-label="Buscar en la conversación"
						onclick={toggleSearch}
					>
						<span class="material-icons-round">search</span>
					</button>

					{#if chatStore.activeConv.peer_username}
						<button
							class="icon-btn"
							aria-label="Ver Ficha de Contacto"
							title="Ver Ficha de Contacto"
							onclick={() => (showMsnContactCard = !showMsnContactCard)}
						>
							<span class="material-icons-round">account_circle</span>
						</button>
					{/if}
				</div>
			</div>
		</header>

		{#if showSearch}
			<div class="in-chat-search" transition:fade={{ duration: 150 }}>
				<span class="material-icons-round">search</span>
				<input
					type="text"
					placeholder="Buscar en esta conversación..."
					bind:value={searchTerm}
					onkeydown={(e) => {
						if (e.key === 'Enter') gotoMatch(e.shiftKey ? -1 : 1);
						if (e.key === 'Escape') toggleSearch();
					}}
					class="in-chat-search-input"
					autocomplete="off"
				/>
				<span class="search-count">
					{searchMatches.length > 0
						? `${currentMatchIdx + 1}/${searchMatches.length}`
						: searchTerm.trim()
							? '0/0'
							: ''}
				</span>
				<button
					class="search-nav-btn"
					style="flex: 0 0 28px; min-width: 28px; min-height: 28px;"
					onclick={() => gotoMatch(-1)}
					disabled={searchMatches.length === 0}
					aria-label="Anterior"
				>
					<span class="material-icons-round">keyboard_arrow_up</span>
				</button>
				<button
					class="search-nav-btn"
					style="flex: 0 0 28px; min-width: 28px; min-height: 28px;"
					onclick={() => gotoMatch(1)}
					disabled={searchMatches.length === 0}
					aria-label="Siguiente"
				>
					<span class="material-icons-round">keyboard_arrow_down</span>
				</button>
				<button
					class="search-nav-btn"
					style="flex: 0 0 28px; min-width: 28px; min-height: 28px;"
					onclick={toggleSearch}
					aria-label="Cerrar búsqueda"
				>
					<span class="material-icons-round">close</span>
				</button>
			</div>
		{/if}

		<!-- El stack contiene SOLO el historial + el botón flotante de scroll:
		     así el botón nunca puede solaparse con el compositor. -->
		<div class="messages-stack">
			<!-- Chat Messages Area -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				bind:this={scrollContainer}
				class="messages-area"
				role="log"
				aria-live="polite"
				aria-label="Historial de mensajes de la conversación"
				onscroll={handleScroll}
				onclick={() => {
					activeReactionMsgId = null;
				}}
			>
				{#if chatStore.hasMoreMessages && !chatStore.loadingMoreMessages}
					<button class="load-more-btn" onclick={loadMore} aria-label="Cargar mensajes anteriores">
						Cargar mensajes anteriores
					</button>
				{/if}
				{#if chatStore.loadingMoreMessages}
					<div class="loading-more glass-dots-loader">
						<div class="glass-dot animate-pulse"></div>
						<div class="glass-dot animate-pulse" style="animation-delay: 0.2s"></div>
						<div class="glass-dot animate-pulse" style="animation-delay: 0.4s"></div>
					</div>
				{/if}

				{#key chatStore.chatSessionKey}
					<div
						bind:this={contentElement}
						class="chat-content-frame"
						in:fade={{ duration: 280, delay: 60 }}
					>
						{#if chatStore.loadingMsgs}
							<div class="chat-skeletons">
								<div class="skeleton-bubble peer">
									<div class="skel-text long animate-pulse"></div>
									<div class="skel-text short animate-pulse"></div>
								</div>
								<div class="skeleton-bubble me">
									<div class="skel-text med animate-pulse"></div>
								</div>
								<div class="skeleton-bubble peer">
									<div class="skel-text long animate-pulse"></div>
								</div>
							</div>
						{:else if chatStore.messages.length === 0}
							<div class="empty-chat empty-chat-neo">
								<div class="empty-icon-glow">
									<span class="material-icons-round floating-icon">forum</span>
								</div>
								<p class="empty-chat-title">El inicio de algo genial</p>
								<p class="empty-chat-subtitle">
									Envía un mensaje para comenzar a chatear con {chatStore.activeConv
										.peer_display_name || chatStore.activeConv.peer_username}.
								</p>
							</div>
						{:else}
							<div class="messages-transition-group">
								{#each chatStore.messages as msg, i (msg.id)}
									{@const isMe = Number(msg.sender_id) === Number(authStore.user?.id)}
									{@const ANIM_WINDOW = 15}
									{@const posFromEnd = chatStore.messages.length - 1 - i}
									{@const animated = posFromEnd < ANIM_WINDOW}
									{@const animIndex = animated ? ANIM_WINDOW - 1 - posFromEnd : -1}
									{@const staggerDelay = animated ? animIndex * 90 : 0}
									{@const newDay =
										i === 0 ||
										isDifferentDay(chatStore.messages[i - 1]?.created_at, msg.created_at)}
									{@const nextMsg = chatStore.messages[i + 1]}
									{@const newDayNext =
										nextMsg && isDifferentDay(msg.created_at, nextMsg.created_at)}
									{@const isZumbidoMsg = isZumbidoMessage(msg)}
									{@const samePrev =
										i > 0 &&
										!newDay &&
										!isZumbidoMsg &&
										!isZumbidoMessage(chatStore.messages[i - 1]) &&
										Number(chatStore.messages[i - 1].sender_id) === Number(msg.sender_id)}
									{@const sameNext =
										nextMsg &&
										!newDayNext &&
										!isZumbidoMsg &&
										!isZumbidoMessage(nextMsg) &&
										Number(nextMsg.sender_id) === Number(msg.sender_id)}

									{#if newDay}
										<div class="date-chip" in:fade={{ duration: 200 }}>
											<span>{formatDayLabel(msg.created_at)}</span>
										</div>
									{/if}

									<MessageBubble
										{msg}
										{isMe}
										activeConv={chatStore.activeConv}
										{animated}
										{staggerDelay}
										isGroupStart={!samePrev}
										isGroupEnd={!sameNext}
										{deletingMessageId}
										isCurrentMatch={showSearch && searchMatches[currentMatchIdx] === msg.id}
										onBubbleClick={(e, id) => handleReactionMenuClick(e, id)}
										onDeleteClick={(id) => (deletingMessageId = id)}
										onConfirmDelete={(id) => {
											onDeleteMessage(id);
											deletingMessageId = null;
										}}
										onCancelDelete={() => (deletingMessageId = null)}
										onReactionMenuClick={(e, id) => handleReactionMenuClick(e, id)}
										onReact={(id, emoji) => onReact(id, emoji)}
										onReply={(m) => onReply(m)}
										onEdit={(m) => onEdit(m)}
										onQuoteClick={(id) => scrollToMessage(id)}
										onRetry={(id) => onRetrySend?.(id)}
										onDiscard={(id) => onDiscardMessage?.(id)}
									/>
								{/each}

								{#if isPeerTyping}
									<div class="message-group peer no-anim" in:fade={{ duration: 150 }}>
										<div class="message-bubble-row">
											<div
												class="peer-mini-avatar"
												style="flex: 0 0 28px; min-width: 28px; min-height: 28px;"
											>
												{#if chatStore.activeConv.peer_avatar}
													<img
														src={chatStore.activeConv.peer_avatar}
														alt={chatStore.activeConv.peer_display_name}
														width="28"
														height="28"
														loading="lazy"
														decoding="async"
													/>
												{:else}
													<span
														>{getInitials(
															chatStore.activeConv.peer_display_name ||
																chatStore.activeConv.peer_username
														)}</span
													>
												{/if}
											</div>
											<div class="bubble-wrapper">
												<div class="typing-bubble">
													<div class="dot"></div>
													<div class="dot"></div>
													<div class="dot"></div>
												</div>
											</div>
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/key}
			</div>

			{#if showScrollDown}
				<button
					class="scroll-down-btn"
					onclick={() => scrollToBottom(true)}
					aria-label="Ir al último mensaje"
					title="Ir al último mensaje"
					transition:fade={{ duration: 150 }}
				>
					<span class="material-icons-round">keyboard_arrow_down</span>
				</button>
			{/if}
		</div>

		{#if showMsnContactCard && chatStore.activeConv}
			<MsnContactCard
				peer={chatStore.activeConv}
				online={peerOnline(chatStore.activeConv)}
				status={chatStore.activeConv.peer_status || 'online'}
				onClose={() => (showMsnContactCard = false)}
				onNudge={() => {
					if (onSendZumbido) onSendZumbido();
					else onSendMessage({ text: ZUMBIDO_TEXT });
					showMsnContactCard = false;
				}}
				onAudioCall={() => {
					onStartAudioCall();
					showMsnContactCard = false;
				}}
				onVideoCall={() => {
					onStartVideoCall();
					showMsnContactCard = false;
				}}
			/>
		{/if}

		<!-- Portal de reacciones: fixed y anclado al botón que lo abrió (único
		     por vista) — nunca queda recortado ni solapa burbujas. -->
		{#if activeReactionMsgId !== null}
			<div class="reaction-portal" class:up={pickerUp} style="left: {pickerX}px; top: {pickerY}px;">
				<TwemojiPicker
					variant="inline"
					onSelect={(emoji) => onReact(activeReactionMsgId, emoji)}
					onClose={() => (activeReactionMsgId = null)}
				/>
			</div>
		{/if}

		<ChatComposer
			bind:this={composerComponent}
			sending={chatStore.sending}
			onSend={onSendMessage}
			{chatStore}
			{onTyping}
			bind:pendingProduct
		/>
	{:else}
		<!-- No Active Conversation Select: Rediseño Aero Welcome Card (R3) -->
		<div class="no-chat-selected" in:fade={{ duration: 250 }}>
			<div class="aero-welcome-card">
				<div class="aero-orb-container">
					<div class="aero-orb-halo" aria-hidden="true"></div>
					<div class="empty-icon-glow big aero-orb">
						<span class="material-icons-round floating-icon">forum</span>
					</div>
					<span class="aero-orb-sparkle s1 material-icons-round" aria-hidden="true"
						>auto_awesome</span
					>
					<span class="aero-orb-sparkle s2 material-icons-round" aria-hidden="true">bolt</span>
				</div>

				<h2 class="no-chat-title">Tus Mensajes</h2>
				<p class="no-chat-sub">
					Selecciona un chat de la lista o crea uno nuevo para empezar a hablar en tiempo real.
				</p>

				<div class="aero-feature-pills">
					<div class="feature-pill">
						<span class="material-icons-round pill-icon">bolt</span>
						<span>Zumbidos MSN</span>
					</div>
					<div class="feature-pill">
						<span class="material-icons-round pill-icon">lock</span>
						<span>Tiempo Real</span>
					</div>
					<div class="feature-pill">
						<span class="material-icons-round pill-icon">videocam</span>
						<span>Llamadas HD</span>
					</div>
				</div>

				<button
					type="button"
					onclick={() => onNewDM?.()}
					class="btn-aero-primary no-chat-cta"
					aria-label="Nuevo mensaje"
				>
					<span class="material-icons-round">add_circle</span>
					<span>Nuevo mensaje</span>
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	/* ═══════════════════════════════════════════════════════════
	   Voom! Messenger — Panel de chat "Retro-Aero limpio"
	   Superficies planas, hairlines, un acento. Sin pill decorativa
	   ni elementos absolutos que se crucen.
	   ═══════════════════════════════════════════════════════════ */

	.chat-pane {
		flex: 1;
		min-height: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		position: relative;
		isolation: isolate;
		overflow: hidden;
		background: transparent;
	}

	/* ── Cabecera: barra plana de 64px con hairline inferior ── */
	.chat-header {
		position: relative;
		z-index: 10;
		display: flex;
		border-bottom: 1px solid var(--border-subtle);
		background: rgba(247, 251, 254, 0.85);
		padding: 10px 16px;
	}
	.chat-header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		max-width: 980px;
		margin: 0 auto;
		min-height: 44px;
	}
	:global([data-theme='dark']) .chat-header {
		background: rgba(9, 20, 38, 0.45);
	}
	:global([data-theme='midnight']) .chat-header {
		background: rgba(3, 8, 18, 0.5);
	}

	.peer-profile-info {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.back-mobile-btn {
		display: none;
		background: transparent;
		border: none;
		padding: 0;
		width: 34px;
		height: 34px;
		min-width: 34px;
		min-height: 34px;
		flex: 0 0 34px;
		color: var(--text-secondary);
		cursor: pointer;
		border-radius: 10px;
		transition:
			background 0.16s ease,
			color 0.16s ease;
	}
	.back-mobile-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.1);
		color: var(--text-primary);
	}
	.back-mobile-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}

	.conv-avatar-wrapper {
		position: relative;
		width: 44px;
		height: 44px;
		flex: 0 0 44px;
		min-width: 44px;
		min-height: 44px;
		flex-shrink: 0;
	}

	.conv-avatar {
		width: 100%;
		height: 100%;
		border-radius: 14px;
		corner-shape: squircle;
		background: linear-gradient(140deg, var(--aero-sky) 0%, var(--accent-blue-base) 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-weight: 800;
		font-size: 0.9rem;
		overflow: hidden;
	}
	.conv-avatar img {
		width: 100%;
		height: 100%;
		border-radius: 14px;
		corner-shape: squircle;
		object-fit: cover;
		display: block;
	}

	.presence-dot {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 12px;
		height: 12px;
		border-radius: var(--radius-full);
		background: var(--text-muted);
		border: 2px solid var(--bg-surface-solid, var(--bg-surface));
		transition: background 0.2s ease;
	}
	.presence-dot.on {
		background: var(--aero-mint, #00d4aa);
		box-shadow: 0 0 0 2px rgba(var(--aero-mint-rgb, 0, 212, 170), 0.18);
	}

	.peer-text-block {
		min-width: 0;
	}

	.peer-name {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.01em;
	}
	.peer-name-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.verified-check {
		font-size: 0.9rem !important;
		color: var(--badge-verified, var(--aero-sky));
		flex-shrink: 0;
	}

	.peer-status {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin: 2px 0 0 0;
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.status-live-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--aero-mint, #00d4aa);
		flex-shrink: 0;
	}
	.typing-status {
		color: var(--accent-blue-base);
		font-weight: 700;
	}

	.typing-inline-dots {
		display: inline-flex;
		gap: 2.5px;
		align-items: center;
	}
	.tdot {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--accent-blue-base);
		animation: tdot-bounce 1.2s ease-in-out infinite;
	}
	.tdot:nth-child(2) {
		animation-delay: 0.15s;
	}
	.tdot:nth-child(3) {
		animation-delay: 0.3s;
	}
	@keyframes tdot-bounce {
		0%,
		60%,
		100% {
			transform: translateY(0);
			opacity: 0.5;
		}
		30% {
			transform: translateY(-3.5px);
			opacity: 1;
		}
	}

	/* ── Acciones de cabecera: botones fantasma cuadrados ───── */
	.chat-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.icon-btn {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		min-width: 32px;
		min-height: 32px;
		flex: 0 0 32px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		transition:
			background 0.16s ease,
			color 0.16s ease;
	}
	.icon-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.1);
		color: var(--accent-blue-base);
	}
	.icon-btn:active {
		transform: scale(0.94);
	}
	.icon-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.icon-btn.toggled {
		background: rgba(var(--accent-blue-rgb), 0.12);
		color: var(--accent-blue-base);
	}
	.icon-btn .material-icons-round {
		font-size: 18px;
	}

	.icon-btn.zumbido-btn {
		color: var(--aero-amber, #f5a623);
	}
	.icon-btn.zumbido-btn:hover:not(:disabled) {
		background: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.12);
		color: var(--aero-amber, #f5a623);
	}
	.icon-btn.zumbido-btn.in-cooldown {
		color: var(--text-muted);
		cursor: not-allowed;
		opacity: 0.65;
	}
	.icon-btn.zumbido-btn .cooldown-num {
		font-size: 0.74rem;
		font-weight: 800;
		font-family: var(--font-display);
		line-height: 1;
	}

	.icon-btn.call-end-btn {
		background: #e5484d;
		color: #ffffff;
	}
	.icon-btn.call-end-btn:hover {
		background: #d63c41;
		color: #ffffff;
	}

	@media (max-width: 768px) {
		.back-mobile-btn {
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.chat-header {
			padding: 8px 10px;
		}
	}

	/* ── Búsqueda dentro del chat: cluster de la cabecera ───── */
	.in-chat-search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-bottom: 1px solid var(--border-subtle);
		background: transparent;
		z-index: 10;
	}
	.in-chat-search > .material-icons-round {
		color: var(--accent-blue-base);
		font-size: 1.05rem;
	}
	.in-chat-search-input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-primary);
		font-size: 0.84rem;
	}
	.in-chat-search-input::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}
	.search-count {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--accent-blue-base);
		min-width: 32px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.search-nav-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		width: 28px;
		height: 28px;
		min-width: 28px;
		min-height: 28px;
		flex: 0 0 28px;
		border-radius: 8px;
		transition:
			background 0.16s ease,
			color 0.16s ease;
	}
	.search-nav-btn:hover:not(:disabled) {
		background: rgba(var(--accent-blue-rgb), 0.1);
		color: var(--accent-blue-base);
	}
	.search-nav-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.search-nav-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.search-nav-btn .material-icons-round {
		font-size: 18px;
	}

	/* ── Stack de mensajes: historial + botón flotante ──────── */
	.messages-stack {
		position: relative;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.messages-area {
		position: relative;
		z-index: 1;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
		scroll-behavior: smooth;
		/* Tinte propio de la ZONA de mensajes: la hace legible como
		   territorio distinto y da contraste a las burbujas del peer. */
		background: rgba(var(--accent-blue-rgb), 0.03);
		transition: background 0.25s ease;
	}
	:global([data-theme='dark']) .messages-area {
		background: rgba(0, 0, 0, 0.14);
	}
	:global([data-theme='midnight']) .messages-area {
		background: rgba(0, 0, 0, 0.24);
	}

	.load-more-btn {
		padding: 6px 16px;
		margin: 0 auto 8px;
		background: transparent;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--accent-blue-base);
		font-size: 0.76rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background 0.16s ease,
			color 0.16s ease;
	}
	.load-more-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.1);
	}
	.load-more-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}

	.loading-more {
		display: flex;
		justify-content: center;
		padding: 6px;
		margin-bottom: 6px;
	}

	/* Botón flotante "bajar al último": dentro del stack, nunca
	   sobre el compositor. */
	.scroll-down-btn {
		position: absolute;
		right: 20px;
		bottom: 16px;
		width: 38px;
		height: 38px;
		min-width: 38px;
		min-height: 38px;
		border: none;
		border-radius: var(--radius-full);
		background: var(--accent-blue-base);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 15;
		/* Anillo doble: destaca sobre fondo claro y oscuro */
		box-shadow:
			0 0 0 3px rgba(255, 255, 255, 0.55),
			0 6px 18px rgba(var(--accent-blue-rgb), 0.45);
		transition:
			transform 0.16s var(--ease-spring),
			background 0.16s ease,
			box-shadow 0.16s ease;
	}
	.scroll-down-btn:hover {
		background: var(--accent-blue-dark, var(--accent-blue-base));
		transform: translateY(-2px);
		box-shadow:
			0 0 0 3px rgba(255, 255, 255, 0.7),
			0 8px 22px rgba(var(--accent-blue-rgb), 0.55);
	}
	.scroll-down-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.scroll-down-btn .material-icons-round {
		font-size: 22px;
	}

	/* ── Estados vacíos y esqueletos ────────────────────────── */
	.empty-chat {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		text-align: center;
		padding: 24px;
		color: var(--text-muted);
	}
	.empty-chat-title {
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0 0 4px 0;
		letter-spacing: -0.01em;
	}
	.empty-chat-subtitle {
		font-size: 0.78rem;
		max-width: 280px;
		margin: 0;
		line-height: 1.45;
	}

	.chat-skeletons {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px 0;
		width: 100%;
		height: 100%;
		justify-content: flex-end;
	}
	.skeleton-bubble {
		padding: 10px 14px;
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 65%;
		background: var(--border-subtle);
		opacity: 0.5;
	}
	.skeleton-bubble.peer {
		align-self: flex-start;
		border-bottom-left-radius: 4px;
	}
	.skeleton-bubble.me {
		align-self: flex-end;
		border-bottom-right-radius: 4px;
		background: rgba(var(--accent-blue-rgb), 0.25);
	}
	.skel-text {
		height: 11px;
		border-radius: var(--radius-xs);
		background: var(--text-muted);
		opacity: 0.4;
	}
	.skel-text.long {
		width: 100%;
	}
	.skel-text.med {
		width: 70%;
	}
	.skel-text.short {
		width: 40%;
	}

	.glass-dots-loader {
		display: flex;
		gap: 5px;
		align-items: center;
		justify-content: center;
		padding: 8px;
	}
	.glass-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent-blue-base);
	}

	.chat-content-frame {
		display: flex;
		flex-direction: column;
		flex: 1 0 auto;
		justify-content: flex-start;
		width: 100%;
		max-width: 980px;
	}
	.messages-transition-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
		margin-top: auto;
	}

	/* ── Separador de fecha: texto puro con hairlines ───────── */
	.date-chip {
		align-self: center;
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 12px 0 6px;
		user-select: none;
		width: 100%;
		justify-content: center;
	}
	.date-chip::before,
	.date-chip::after {
		content: '';
		flex: 1;
		max-width: 140px;
		height: 1px;
		background: var(--border-subtle);
	}
	.date-chip span {
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	/* ── Burbuja "escribiendo…" ─────────────────────────────── */
	.typing-bubble {
		display: flex;
		gap: 5px;
		align-items: center;
		padding: 10px 15px;
		border-radius: 16px;
		border-bottom-left-radius: 4px;
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--border-subtle);
	}
	:global([data-theme='dark']) .typing-bubble,
	:global([data-theme='midnight']) .typing-bubble {
		background: rgba(255, 255, 255, 0.08);
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent-blue-base);
		animation: wave 1.3s linear infinite;
	}
	.dot:nth-child(2) {
		animation-delay: -1.1s;
	}
	.dot:nth-child(3) {
		animation-delay: -0.9s;
	}
	@keyframes wave {
		0%,
		60%,
		100% {
			transform: translateY(0);
		}
		30% {
			transform: translateY(-4px);
		}
	}

	.message-group.peer.no-anim {
		align-self: flex-start;
		max-width: min(72%, 560px);
	}
	.message-bubble-row {
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}
	.peer-mini-avatar {
		width: 28px;
		height: 28px;
		min-width: 28px;
		min-height: 28px;
		flex: 0 0 28px;
		border-radius: 10px;
		corner-shape: squircle;
		background: linear-gradient(140deg, var(--aero-sky), var(--accent-blue-base));
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-weight: 700;
		font-size: 0.7rem;
		overflow: hidden;
		flex-shrink: 0;
		margin-bottom: 2px;
	}
	.peer-mini-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* ── Portal de reacciones: fixed, anclado al botón ────────
	   Superficie sólida propia: el picker inline es transparente
	   por diseño y es ESTE contenedor el que aporta el fondo. */
	.reaction-portal {
		position: fixed;
		z-index: 60;
		width: min(320px, calc(100vw - 16px));
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: 14px;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
		overflow: hidden;
		padding: 6px;
		box-sizing: border-box;
	}
	.reaction-portal.up {
		transform: translateY(-100%);
	}

	/* ── Welcome card (sin chat activo) ─────────────────────── */
	.no-chat-selected {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 20px;
		text-align: center;
		height: 100%;
		position: relative;
		overflow: hidden;
	}
	.aero-welcome-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 420px;
		width: 100%;
		padding: 36px 32px 32px;
	}
	.aero-orb-container {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 20px;
	}
	.aero-orb-halo {
		position: absolute;
		width: 96px;
		height: 96px;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgba(var(--accent-blue-rgb), 0.28) 0%,
			rgba(var(--aero-mint-rgb), 0.12) 55%,
			transparent 75%
		);
		pointer-events: none;
	}
	.aero-orb {
		position: relative;
		z-index: 1;
	}
	.empty-icon-glow {
		position: relative;
		width: 64px;
		height: 64px;
		margin-bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(var(--accent-blue-rgb), 0.1);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.25);
		border-radius: 20px;
		corner-shape: squircle;
	}
	.empty-icon-glow.big {
		width: 64px;
		height: 64px;
	}
	.empty-icon-glow::before {
		display: none;
	}
	.floating-icon {
		font-size: 1.7rem !important;
		color: var(--accent-blue-base) !important;
		animation: float 4s ease-in-out infinite;
	}
	.aero-orb-sparkle {
		position: absolute;
		color: var(--aero-amber, #f5a623);
		font-size: 15px !important;
		pointer-events: none;
	}
	.aero-orb-sparkle.s1 {
		top: -6px;
		right: -14px;
	}
	.aero-orb-sparkle.s2 {
		bottom: -2px;
		left: -14px;
		color: var(--aero-sky);
		font-size: 13px !important;
	}

	.no-chat-title {
		font-family: var(--font-display);
		font-size: 1.45rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0 0 8px 0;
		letter-spacing: -0.02em;
	}
	.no-chat-sub {
		font-size: 0.84rem;
		color: var(--text-muted);
		max-width: 320px;
		margin: 0 auto 22px auto;
		line-height: 1.5;
	}

	.aero-feature-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: center;
		margin-bottom: 24px;
	}
	.feature-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 12px;
		border-radius: var(--radius-full);
		background: transparent;
		border: 1px solid var(--border-subtle);
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-secondary);
	}
	.feature-pill .pill-icon {
		font-size: 14px !important;
		color: var(--accent-blue-base);
	}

	.no-chat-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 11px 26px;
		font-size: 0.88rem;
		font-weight: 800;
		border-radius: var(--radius-full);
		box-shadow: 0 6px 20px rgba(var(--accent-blue-rgb), 0.35);
		transition:
			transform 0.16s var(--ease-spring),
			box-shadow 0.2s ease;
	}
	.no-chat-cta:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 26px rgba(var(--accent-blue-rgb), 0.45);
	}
	.no-chat-cta:active {
		transform: scale(0.97);
	}
	.no-chat-cta .material-icons-round {
		font-size: 19px;
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-6px);
		}
	}

	/* ── Móvil: deslizamiento horizontal con visibilidad diferida ── */
	@media (max-width: 768px) {
		.chat-pane {
			/* Ocupa el ancho completo y se desliza ENCIMA de la sidebar:
			   ambos paneles absolutos en el mismo hueco del chat-window. */
			position: absolute;
			inset: 0;
			width: 100%;
			z-index: 2;
		}
		.chat-pane.hidden-mobile {
			transform: translateX(100%);
			opacity: 0;
			pointer-events: none;
			visibility: hidden;
			transition:
				transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
				opacity 0.25s ease,
				visibility 0s linear 0.28s;
		}
		.chat-pane:not(.hidden-mobile) {
			transform: translateX(0);
			opacity: 1;
			visibility: visible;
			transition:
				transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
				opacity 0.25s ease,
				visibility 0s linear 0s;
		}
		.chat-pane {
			will-change: transform, opacity;
		}
		.messages-area {
			padding: 12px;
		}
	}

	:global(.messages-area::-webkit-scrollbar) {
		width: 5px !important;
		background: transparent !important;
	}
	:global(.messages-area::-webkit-scrollbar-track) {
		background: transparent !important;
		border: none !important;
	}
	:global(.messages-area::-webkit-scrollbar-thumb) {
		background: var(--scrollbar-thumb) !important;
		border-radius: var(--radius-xs) !important;
		border: none !important;
	}
	:global(.messages-area::-webkit-scrollbar-thumb:hover) {
		background: var(--scrollbar-thumb-hover) !important;
	}

	/* Resaltado al saltar a un mensaje citado / resultado de búsqueda */
	:global(.message-group.quote-highlight .message-bubble) {
		animation: quote-flash 1.6s ease-out;
	}
	@keyframes quote-flash {
		0% {
			outline: 3px solid var(--accent-blue-base);
			box-shadow: 0 0 24px rgba(var(--accent-blue-rgb), 0.55);
		}
		40% {
			outline: 2px solid var(--aero-sky);
			box-shadow: 0 0 14px rgba(var(--accent-blue-rgb), 0.3);
		}
		100% {
			outline: 0px solid transparent;
			box-shadow: none;
		}
	}

	/* ── Perfiles de rendimiento ───────────────────────────── */
	:global(:root[data-perf='eco']) .aero-orb-halo,
	:global(:root[data-perf-profile='lite']) .aero-orb-halo,
	:global(:root[data-perf-mode='true']) .aero-orb-halo {
		display: none !important;
	}
	:global(:root[data-perf='eco']) .floating-icon,
	:global(:root[data-perf-profile='lite']) .floating-icon,
	:global(:root[data-perf-mode='true']) .floating-icon {
		animation: none !important;
	}
</style>
