<script>
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';
	import { isSoundEnabled, setSoundEnabled } from '$lib/utils/sound.js';
	import MessageBubble from './MessageBubble.svelte';
	import ChatComposer from './ChatComposer.svelte';
	import MsnContactCard from '$lib/components/MsnContactCard.svelte';

	let {
		chatStore,
		rtcStore,
		mobileView,
		onBackMobile,
		onStartAudioCall,
		onStartVideoCall,
		onStartScreenShare,
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
		onDiscardMessage
	} = $props();

	let scrollContainer = $state(null);
	let composerComponent = $state(null);
	let deletingMessageId = $state(null);
	let activeReactionMsgId = $state(null);
	let reactionPickerDirection = $state('up');
	let showMsnContactCard = $state(false);
	let showGamesSoon = $state(false);
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
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

	function lastSeenLabel(conv) {
		const ts = conv?.peer_last_seen;
		if (!ts) return 'Desconectado';
		const then = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z').getTime();
		if (isNaN(then)) return 'Desconectado';
		const diffMin = Math.floor((Date.now() - then) / 60000);
		if (diffMin < 1) return 'Visto hace un momento';
		if (diffMin < 60) return `Visto hace ${diffMin} min`;
		const diffH = Math.floor(diffMin / 60);
		if (diffH < 24) return `Visto hace ${diffH} h`;
		const diffD = Math.floor(diffH / 24);
		return `Visto hace ${diffD} d`;
	}

	function handleScroll() {
		if (!scrollContainer) return;
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

	export function scrollToBottom(force = true) {
		if (!scrollContainer) return;
		// Solo autoscroll si el usuario ya está cerca del fondo (salvo force explícito)
		if (!force && !atBottom) return;
		requestAnimationFrame(() => {
			if (scrollContainer) {
				scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
				atBottom = true;
				showScrollDown = false;
			}
		});
	}

	function handleReactionMenuClick(e, msgId) {
		e.stopPropagation();
		if (activeReactionMsgId === msgId) {
			activeReactionMsgId = null;
			return;
		}
		activeReactionMsgId = msgId;
		const rect = e.currentTarget.getBoundingClientRect();
		// Si hay espacio abajo, mostramos el picker hacia abajo, sino hacia arriba
		if (window.innerHeight - rect.bottom > 300) {
			reactionPickerDirection = 'down';
		} else {
			reactionPickerDirection = 'up';
		}
	}
</script>

<div class="chat-pane" class:hidden-mobile={mobileView === 'list'}>
	{#if chatStore.activeConvId && chatStore.activeConv}
		<div class="chat-header-container">
			<div class="chat-header">
				<div class="peer-profile-info">
					<!-- Back button -->
					<button
						onclick={() => {
							chatStore.setActiveConvId(null);
							onBackMobile();
						}}
						class="back-mobile-btn"
						aria-label="Volver"
					>
						<span class="material-icons-round">arrow_back</span>
					</button>

					<!-- Peer Info -->
					<div class="conv-avatar-wrapper">
						<div
							class="conv-avatar"
							style="width: 34px; height: 34px; flex: 0 0 34px; min-width: 34px; min-height: 34px;"
						>
							{#if chatStore.activeConv.peer_avatar}
								<img
									src={chatStore.activeConv.peer_avatar}
									alt={chatStore.activeConv.name || chatStore.activeConv.peer_display_name}
									width="34"
									height="34"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<span style="font-size: 0.78rem;"
									>{getInitials(
										chatStore.activeConv.name ||
											chatStore.activeConv.peer_display_name ||
											chatStore.activeConv.peer_username
									)}</span
								>
							{/if}
						</div>
						{#if peerOnline(chatStore.activeConv)}
							<span class="online-indicator"></span>
						{/if}
					</div>

					<div style="min-width: 0;">
						<h2 class="peer-name">
							{chatStore.activeConv.name ||
								chatStore.activeConv.peer_display_name ||
								chatStore.activeConv.peer_username}
						</h2>
						<p class="peer-status" class:typing-status={isPeerTyping}>
							{#if isPeerTyping}
								Escribiendo...
							{:else if peerOnline(chatStore.activeConv)}
								Activo ahora
							{:else}
								<span class="material-icons-round" style="font-size: 9px; margin-right: 2px;"
									>circle</span
								>
								{lastSeenLabel(chatStore.activeConv)}
							{/if}
						</p>
					</div>
				</div>

				<div class="header-actions-row">
					<!-- Zumbido: llama la atención del peer (estilo MSN) -->
					<button
						class="aero-icon-btn zumbido-btn"
						class:in-cooldown={nudgeCooldown > 0}
						disabled={nudgeCooldown > 0}
						title={nudgeCooldown > 0
							? `Espera ${nudgeCooldown}s para enviar otro zumbido`
							: 'Enviar un Zumbido'}
						aria-label={nudgeCooldown > 0
							? `Zumbido en espera (${nudgeCooldown}s)`
							: 'Enviar un Zumbido'}
						onclick={() =>
							onSendZumbido ? onSendZumbido() : onSendMessage?.({ text: '⚡ ¡ZUMBIDO!' })}
					>
						{#if nudgeCooldown > 0}
							<span class="cooldown-num">{nudgeCooldown}</span>
						{:else}
							<span class="material-icons-round">bolt</span>
						{/if}
					</button>
					<!-- Juegos / Actividades (próximamente) -->
					<button
						class="aero-icon-btn header-tool-btn"
						title="Juegos y actividades (próximamente)"
						aria-label="Juegos y actividades"
						onclick={() => (showGamesSoon = !showGamesSoon)}
					>
						<span class="material-icons-round">sports_esports</span>
					</button>
					<!-- Guiño: envía un guiño rápido -->
					<button
						class="aero-icon-btn header-tool-btn"
						title="Enviar un guiño"
						aria-label="Enviar un guiño"
						onclick={() => onSendMessage?.({ text: '😉' })}
					>
						<span class="material-icons-round">sentiment_very_satisfied</span>
					</button>

					{#if rtcStore.inCall}
						<button class="aero-icon-btn call-end-btn" title="Colgar" onclick={onEndCall}>
							<span class="material-icons-round">call_end</span>
						</button>
					{:else}
						<button
							class="aero-icon-btn header-tool-btn"
							title="Llamada de audio"
							onclick={onStartAudioCall}
						>
							<span class="material-icons-round">call</span>
						</button>
						<button
							class="aero-icon-btn header-tool-btn"
							title="Videollamada"
							onclick={onStartVideoCall}
						>
							<span class="material-icons-round">videocam</span>
						</button>
						<button
							class="aero-icon-btn header-tool-btn"
							title="Compartir pantalla"
							onclick={onStartScreenShare}
						>
							<span class="material-icons-round">present_to_all</span>
						</button>
					{/if}

					{#if chatStore.activeConv.peer_username}
						<button
							class="aero-icon-btn header-tool-btn"
							aria-label="Ver Ficha de Contacto"
							title="Ver Ficha de Contacto"
							onclick={() => (showMsnContactCard = !showMsnContactCard)}
						>
							<span class="material-icons-round">account_circle</span>
						</button>
					{/if}
				</div>
			</div>

			<div class="chat-sub-header">
				<div class="sub-header-info">
					<span class="livechat-dot"></span>
					<span class="livechat-label">LiveChat</span>
					<span class="sub-header-sep">•</span>
					<span class="material-icons-round zumbido-hint-icon">bolt</span>
					<span>Envía un Zumbido para llamar la atención</span>
				</div>
				<button
					type="button"
					class="sounds-toggle"
					class:sounds-off={!soundOn}
					onclick={toggleSound}
					title={soundOn ? 'Sonidos activados' : 'Sonidos silenciados'}
					aria-label={soundOn ? 'Silenciar sonidos' : 'Activar sonidos'}
				>
					<span class="material-icons-round" style="font-size: 13px;"
						>{soundOn ? 'volume_up' : 'volume_off'}</span
					>
					<span>Sonidos</span>
				</button>
			</div>

			{#if showGamesSoon}
				<div class="games-soon-note" transition:fade={{ duration: 150 }}>
					<span class="material-icons-round" style="font-size: 14px;">sports_esports</span>
					Juegos y actividades — próximamente
				</div>
			{/if}
		</div>

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
					onclick={() => gotoMatch(-1)}
					disabled={searchMatches.length === 0}
					aria-label="Anterior"
				>
					<span class="material-icons-round">keyboard_arrow_up</span>
				</button>
				<button
					class="search-nav-btn"
					onclick={() => gotoMatch(1)}
					disabled={searchMatches.length === 0}
					aria-label="Siguiente"
				>
					<span class="material-icons-round">keyboard_arrow_down</span>
				</button>
				<button class="search-nav-btn" onclick={toggleSearch} aria-label="Cerrar búsqueda">
					<span class="material-icons-round">close</span>
				</button>
			</div>
		{/if}

		<!-- Chat Messages Area -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={scrollContainer}
			class="messages-area"
			style="overflow-y: scroll; scrollbar-width: thin; scrollbar-color: rgba(46,134,232,0.7) rgba(0,0,0,0.2);"
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
				<div class="chat-content-frame" in:fade={{ duration: 280, delay: 60 }}>
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

								<MessageBubble
									{msg}
									{isMe}
									activeConv={chatStore.activeConv}
									{animated}
									{staggerDelay}
									{deletingMessageId}
									{activeReactionMsgId}
									{reactionPickerDirection}
									isCurrentMatch={showSearch && searchMatches[currentMatchIdx] === msg.id}
									onBubbleClick={() => {}}
									onDeleteClick={(id) => (deletingMessageId = id)}
									onConfirmDelete={(id) => {
										onDeleteMessage(id);
										deletingMessageId = null;
									}}
									onCancelDelete={() => (deletingMessageId = null)}
									onReactionMenuClick={(e, id) => handleReactionMenuClick(e, id)}
									onReact={(id, emoji) => onReact(id, emoji)}
									onCloseReactionPicker={() => (activeReactionMsgId = null)}
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
										<div class="peer-mini-avatar">
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
		{#if showMsnContactCard && chatStore.activeConv}
			<MsnContactCard
				peer={chatStore.activeConv}
				online={peerOnline(chatStore.activeConv)}
				status={chatStore.activeConv.peer_status || 'online'}
				onClose={() => (showMsnContactCard = false)}
				onNudge={() => {
					if (onSendZumbido) onSendZumbido();
					else onSendMessage({ text: '⚡ ¡ZUMBIDO!' });
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

		<ChatComposer
			bind:this={composerComponent}
			sending={chatStore.sending}
			onSend={onSendMessage}
			{chatStore}
			{onTyping}
		/>
	{:else}
		<!-- No Active Conversation Select -->
		<div class="no-chat-selected">
			<span class="material-icons-round no-chat-icon">chat_bubble_outline</span>
			<h2 class="sidebar-title" style="font-size: 1.5rem; margin-bottom: 8px;">Tus Mensajes</h2>
			<p class="peer-status" style="max-width: 280px; margin: 0 auto 16px auto;">
				Selecciona un chat de la lista izquierda o crea uno nuevo para empezar a hablar en tiempo
				real.
			</p>
			<button onclick={() => onNewDM?.()} class="btn-aero-primary" style="padding: 10px 24px;">
				Nuevo mensaje
			</button>
		</div>
	{/if}
</div>

<style>
	.chat-pane {
		flex: 1;
		min-height: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--bg-surface);
		position: relative;
		overflow-x: hidden;
	}

	.chat-header-container {
		position: relative;
		display: flex;
		flex-direction: column;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		z-index: 10;
	}

	.chat-header {
		padding: 10px 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.peer-profile-info {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}

	.back-mobile-btn {
		background: none;
		border: none;
		padding: 2px;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		border-radius: var(--radius-xs);
		transition: color 0.18s;
	}

	.back-mobile-btn:hover {
		color: var(--text-primary);
	}

	.conv-avatar-wrapper {
		position: relative;
		flex-shrink: 0;
	}

	.conv-avatar {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-weight: 700;
		overflow: hidden;
	}

	.conv-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.online-indicator {
		position: absolute;
		bottom: -1px;
		right: -1px;
		width: 9px;
		height: 9px;
		background: var(--aero-mint);
		border: 2px solid var(--bg-surface-solid, #ffffff);
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
	}

	.peer-name {
		font-weight: 700;
		font-size: 0.9rem;
		color: var(--text-primary);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.peer-status {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin: 1px 0 0 0;
		display: flex;
		align-items: center;
	}

	.typing-status {
		color: var(--accent-blue-base);
		font-weight: 600;
		animation: status-pulse 1.5s infinite;
	}

	@keyframes status-pulse {
		0% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
		100% {
			opacity: 0.6;
		}
	}

	.header-actions-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.aero-icon-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		min-width: 32px;
		min-height: 32px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.18s ease;
		box-sizing: border-box;
	}
	.aero-icon-btn .material-icons-round {
		font-size: 17px;
	}

	.header-tool-btn {
		background: rgba(var(--accent-blue-rgb), 0.06);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
	}
	.header-tool-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.12);
		color: var(--accent-blue-base);
		border-color: var(--accent-blue-base);
	}

	/* Botón de Zumbido resaltado en ámbar */
	.zumbido-btn {
		background: linear-gradient(135deg, rgba(245, 166, 35, 0.9), rgba(245, 140, 20, 0.9));
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.2);
		box-shadow: 0 0 10px rgba(245, 166, 35, 0.4);
		transition: all var(--t-fast);
	}
	.zumbido-btn:hover:not(:disabled) {
		transform: scale(1.05);
		box-shadow: 0 0 14px rgba(245, 166, 35, 0.6);
	}
	.zumbido-btn.in-cooldown {
		background: rgba(245, 166, 35, 0.18) !important;
		color: var(--aero-amber) !important;
		border-color: rgba(245, 166, 35, 0.4) !important;
		box-shadow: none !important;
		cursor: not-allowed;
		opacity: 0.85;
	}
	.zumbido-btn .cooldown-num {
		font-size: 0.76rem;
		font-weight: 800;
		font-family: var(--font-display);
		line-height: 1;
	}

	.call-end-btn {
		background: linear-gradient(135deg, #ef4444, #dc2626);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.chat-sub-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 14px;
		background: rgba(var(--accent-blue-rgb), 0.04);
		font-size: 0.72rem;
		color: var(--text-muted);
		border-top: 1px solid var(--border-subtle);
	}

	.sub-header-info {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.livechat-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--aero-mint);
		flex-shrink: 0;
	}

	.livechat-label {
		font-weight: 700;
		color: var(--text-primary);
	}

	.sub-header-sep {
		opacity: 0.5;
	}

	.zumbido-hint-icon {
		color: var(--aero-amber);
		font-size: 13px;
	}

	.games-soon-note {
		position: absolute;
		right: 12px;
		top: 100%;
		margin-top: 6px;
		z-index: 40;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		font-size: 0.72rem;
		color: var(--text-primary);
		background: var(--bg-surface-solid, #ffffff);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
	}

	.sounds-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.72rem;
		cursor: pointer;
		padding: 2px 4px;
		border-radius: var(--radius-xs);
		transition: color 0.18s ease;
	}
	.sounds-toggle:hover {
		color: var(--accent-blue-base);
	}
	.sounds-toggle.sounds-off {
		opacity: 0.5;
	}

	.in-chat-search {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--bg-surface);
	}
	.in-chat-search > .material-icons-round {
		color: var(--text-muted);
		font-size: 1rem;
	}
	.in-chat-search-input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-primary);
		font-size: 0.8rem;
	}
	.in-chat-search-input::placeholder {
		color: var(--text-muted);
		opacity: 0.6;
	}
	.search-count {
		font-size: 0.7rem;
		color: var(--text-muted);
		min-width: 30px;
		text-align: center;
	}
	.search-nav-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		padding: 2px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		transition:
			background 0.18s,
			color 0.18s;
	}
	.search-nav-btn:hover:not(:disabled) {
		background: rgba(var(--accent-blue-rgb), 0.1);
		color: var(--accent-blue-base);
	}
	.search-nav-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.search-nav-btn .material-icons-round {
		font-size: 17px;
	}

	.scroll-down-btn {
		position: absolute;
		right: 18px;
		bottom: 76px;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--grad-primary);
		border: 1px solid var(--glass-border-t);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 30;
		box-shadow: 0 4px 12px rgba(var(--accent-blue-rgb), 0.35);
		transition:
			transform 0.18s ease,
			box-shadow 0.2s ease;
	}
	.scroll-down-btn:hover {
		transform: translateY(-2px) scale(1.05);
		box-shadow: 0 6px 18px rgba(var(--accent-blue-rgb), 0.5);
	}
	.scroll-down-btn .material-icons-round {
		font-size: 20px;
	}

	.messages-area {
		flex: 1;
		min-height: 0;
		overflow-y: scroll;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
	}

	.load-more-btn {
		padding: 6px 16px;
		margin: 0 auto 6px;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		color: var(--accent-blue-base);
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.load-more-btn:hover {
		background: var(--accent-blue-base);
		color: white;
		transform: translateY(-1px);
	}

	.loading-more {
		display: flex;
		justify-content: center;
		padding: 6px;
		margin-bottom: 6px;
	}

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
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 4px 0;
	}

	.empty-chat-subtitle {
		font-size: 0.75rem;
		max-width: 240px;
		margin: 0;
	}

	/* Neo-Aero Empty State */
	.empty-chat-neo {
		background: linear-gradient(180deg, transparent 0%, rgba(var(--accent-blue-rgb), 0.03) 100%);
		border-radius: var(--radius-lg);
	}

	.empty-icon-glow {
		position: relative;
		width: 56px;
		height: 56px;
		margin-bottom: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(var(--accent-blue-rgb), 0.04);
		border: 1px solid var(--glass-border);
		border-radius: 50%;
		box-shadow:
			0 0 20px rgba(var(--accent-blue-rgb), 0.08),
			inset 0 1px 3px rgba(255, 255, 255, 0.1);
	}

	.empty-icon-glow::before {
		content: '';
		position: absolute;
		inset: -2px;
		background: linear-gradient(135deg, var(--aero-sky), transparent, var(--aero-mint));
		border-radius: 50%;
		z-index: -1;
		opacity: 0.3;
		filter: blur(6px);
		animation: spin-glow 6s linear infinite;
	}

	@keyframes spin-glow {
		100% {
			transform: rotate(360deg);
		}
	}

	.floating-icon {
		font-size: 1.75rem !important;
		color: var(--accent-blue-base) !important;
		animation: float 4s ease-in-out infinite;
	}

	/* Skeleton for Chat */
	.chat-skeletons {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px 0;
		width: 100%;
		height: 100%;
		justify-content: flex-end;
	}

	.skeleton-bubble {
		padding: 8px 12px;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 65%;
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
	}

	.skeleton-bubble.peer {
		align-self: flex-start;
		border-bottom-left-radius: 2px;
	}

	.skeleton-bubble.me {
		align-self: flex-end;
		border-bottom-right-radius: 2px;
		background: rgba(var(--accent-blue-rgb), 0.08);
	}

	.skel-text {
		height: 11px;
		border-radius: var(--radius-xs);
		background: var(--border-subtle);
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

	/* Glass Dots Loader */
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
		box-shadow: 0 0 6px var(--accent-blue-base);
	}

	.chat-content-frame {
		display: flex;
		flex-direction: column;
		flex: 1 0 auto;
		justify-content: flex-start;
	}

	.messages-transition-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		margin-top: auto;
	}

	.typing-bubble {
		display: flex;
		gap: 4px;
		align-items: center;
		padding: 6px 12px;
		border-radius: var(--radius-md);
		border-bottom-left-radius: 2px;
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
	}

	.dot {
		width: 5px;
		height: 5px;
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
			transform: translateY(-3px);
		}
	}

	.no-chat-selected {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px;
		text-align: center;
	}

	.no-chat-icon {
		font-size: 3.5rem;
		color: var(--border-subtle);
		margin-bottom: 12px;
		animation: float 3s ease-in-out infinite;
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-8px);
		}
	}

	@media (max-width: 768px) {
		.chat-pane.hidden-mobile {
			display: none;
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
</style>
