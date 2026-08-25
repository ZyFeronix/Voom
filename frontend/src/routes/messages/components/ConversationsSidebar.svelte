<script>
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';
	import { formatListTime } from '$lib/utils/datetime.js';
	import { fly, fade } from 'svelte/transition';
	import { parseMsnEmotes } from '$lib/data/msnEmoticons.js';

	let {
		chatStore,
		mobileView,
		onStatusConfig,
		onNewDM,
		onSelectConversation,
		onPinConversation,
		onMuteConversation
	} = $props();

	let menuOpenId = $state(null);
	// Filtro de la bandeja: todos / sin leer / fijados. 'all' por defecto.
	let filter = $state('all');

	const FILTERS = [
		{ id: 'all', label: 'Todos' },
		{ id: 'unread', label: 'Sin leer' },
		{ id: 'pinned', label: 'Fijados' }
	];

	function getInitials(name) {
		if (!name) return '?';
		return name.substring(0, 2).toUpperCase();
	}

	function peerOnline(conv) {
		if (!conv?.peer_id) return false;
		if (notificationsStore.connected) return notificationsStore.isUserOnline(conv.peer_id);
		return !!conv.peer_online;
	}

	// Total de no leídos (para el badge de la pestaña "Sin leer").
	const totalUnread = $derived(
		chatStore.conversations.reduce((acc, c) => acc + (c.unread_count > 0 ? c.unread_count : 0), 0)
	);

	const filteredConvs = $derived.by(() => {
		if (filter === 'unread')
			return chatStore.filteredConversations.filter((c) => c.unread_count > 0);
		if (filter === 'pinned') return chatStore.filteredConversations.filter((c) => c.is_pinned);
		return chatStore.filteredConversations;
	});

	// Vista previa del último mensaje con prefijos de medio / estado.
	function previewParts(conv) {
		if (!conv.last_message_time) return { text: 'Empieza la conversación', icon: null };
		if (conv.last_message_is_deleted) return { text: 'Mensaje eliminado', icon: 'block' };
		const mine = Number(conv.last_message_sender_id) === Number(authStore.user?.id);
		let text = conv.last_message_body || '';
		let icon = null;
		if (!text) {
			if (conv.last_message_media_type === 'image') {
				text = 'Foto';
				icon = 'photo';
			} else if (conv.last_message_media_type === 'video') {
				text = 'Video';
				icon = 'movie';
			} else if (conv.last_message_media_type === 'audio') {
				text = 'Nota de voz';
				icon = 'mic';
			} else {
				text = 'Archivo adjunto';
				icon = 'attach_file';
			}
		}
		if (mine && !conv.last_message_is_deleted) icon = 'done_all';
		return { text, icon };
	}

	function toggleMenu(e, id) {
		e.stopPropagation();
		menuOpenId = menuOpenId === id ? null : id;
	}

	function handlePin(e, id) {
		e.stopPropagation();
		menuOpenId = null;
		onPinConversation?.(id);
	}

	function handleMute(e, id) {
		e.stopPropagation();
		menuOpenId = null;
		onMuteConversation?.(id);
	}
</script>

<svelte:window onclick={() => (menuOpenId = null)} />

<aside class="conversations-sidebar" class:hidden-mobile={mobileView === 'chat'}>
	<!-- Encabezado: título + acciones -->
	<header class="sidebar-header">
		<div class="sidebar-title-row">
			<div class="title-block">
				<h1 class="sidebar-title">Mensajes</h1>
				<span class="sidebar-count">
					{chatStore.conversations.length}
					{chatStore.conversations.length === 1 ? 'conversación' : 'conversaciones'}
				</span>
			</div>

			<div class="sidebar-actions flex">
				<button
					onclick={(e) => onStatusConfig?.(e)}
					class="aero-icon-btn"
					aria-label="Estado de conexión"
					title="Cambiar estado"
				>
					{#if authStore.user?.avatar_url}
						<img
							src={authStore.user.avatar_url}
							alt="Mi Estado"
							class="status-avatar status-border-{authStore.user?.custom_status || 'online'}"
						/>
					{:else}
						<div
							class="status-avatar-initial status-border-{authStore.user?.custom_status ||
								'online'}"
						>
							{(authStore.user?.display_name || authStore.user?.username || '?')[0].toUpperCase()}
						</div>
					{/if}
				</button>
				<button onclick={onNewDM} class="aero-icon-btn new-dm-btn" aria-label="Nuevo Mensaje">
					<span class="material-icons-round">chat</span>
				</button>
			</div>
		</div>

		<!-- Búsqueda -->
		<div class="search-wrapper">
			<span class="material-icons-round">search</span>
			<input
				id="chat_search_input"
				name="chat_search"
				type="text"
				placeholder="Buscar chats..."
				bind:value={chatStore.searchQuery}
				class="aero-input"
				style="padding-top: 5px; padding-bottom: 5px; font-size: 0.78rem;"
			/>
			{#if chatStore.searchQuery}
				<button
					class="search-clear-btn"
					onclick={() => (chatStore.searchQuery = '')}
					aria-label="Limpiar búsqueda"
				>
					<span class="material-icons-round">close</span>
				</button>
			{/if}
		</div>

		<!-- Filtros de bandeja -->
		<div class="filter-tabs" role="tablist" aria-label="Filtrar conversaciones">
			{#each FILTERS as f (f.id)}
				<button
					type="button"
					role="tab"
					aria-selected={filter === f.id}
					class="filter-tab"
					class:active={filter === f.id}
					onclick={() => (filter = f.id)}
				>
					{f.label}
					{#if f.id === 'unread' && totalUnread > 0}
						<span class="filter-badge">{totalUnread}</span>
					{/if}
				</button>
			{/each}
		</div>
	</header>

	<!-- Lista de conversaciones -->
	<div class="conversations-list">
		{#if chatStore.loadingConvs}
			{#each Array(7) as _, i (i)}
				<div class="skeleton-item">
					<div class="skeleton-avatar animate-pulse"></div>
					<div class="skeleton-lines">
						<div class="skeleton-line short animate-pulse"></div>
						<div class="skeleton-line long animate-pulse"></div>
					</div>
				</div>
			{/each}
		{:else if filteredConvs.length === 0}
			<div class="empty-conversations" in:fly={{ y: 20, duration: 400 }}>
				<span class="material-icons-round">
					{chatStore.searchQuery || filter !== 'all' ? 'search_off' : 'question_answer'}
				</span>
				<p>
					{#if chatStore.searchQuery}
						Sin resultados para “{chatStore.searchQuery}”
					{:else if filter === 'unread'}
						No tienes mensajes sin leer
					{:else if filter === 'pinned'}
						Aún no fijas ninguna conversación
					{:else}
						No hay conversaciones
					{/if}
				</p>
				{#if !chatStore.searchQuery && filter === 'all'}
					<button class="empty-new-chat" onclick={onNewDM}>Iniciar un chat</button>
				{/if}
			</div>
		{:else}
			<ul class="conv-list-inner">
				{#each filteredConvs as conv, i (conv.id)}
					{@const preview = previewParts(conv)}
					<li>
						<div
							onclick={() => onSelectConversation(conv.id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onSelectConversation(conv.id);
								}
							}}
							role="button"
							tabindex="0"
							class="conv-item"
							class:active={chatStore.activeConvId === conv.id}
							class:has-unread={conv.unread_count > 0}
							in:fly={{ y: 12, duration: 250, delay: Math.min(i, 8) * 30 }}
						>
							<!-- Indicador de activo (barra lateral) -->
							<span class="active-bar" aria-hidden="true"></span>

							<div class="conv-avatar-wrapper">
								<div
									class="conv-avatar"
									style="flex: 0 0 44px; min-width: 44px; min-height: 44px; width: 44px; height: 44px;"
								>
									{#if conv.peer_avatar}
										<img
											src={conv.peer_avatar}
											alt={conv.name || conv.peer_display_name}
											width="44"
											height="44"
											loading="lazy"
											decoding="async"
										/>
									{:else}
										<span
											>{getInitials(
												conv.name || conv.peer_display_name || conv.peer_username
											)}</span
										>
									{/if}
								</div>
								{#if peerOnline(conv)}
									<span class="online-indicator"></span>
								{/if}
							</div>

							<div class="conv-details">
								<div class="conv-meta">
									<h3 class="conv-name">
										{#if conv.is_pinned}
											<span class="material-icons-round pin-icon" title="Conversación fijada"
												>push_pin</span
											>
										{/if}
										<span class="conv-name-text"
											>{conv.name || conv.peer_display_name || conv.peer_username}</span
										>
										{#if conv.is_verified}
											<span class="material-icons-round verified-check" title="Cuenta verificada"
												>verified</span
											>
										{/if}
									</h3>
									{#if conv.last_message_time}
										<time class="conv-time" datetime={conv.last_message_time}>
											{formatListTime(conv.last_message_time)}
										</time>
									{/if}
								</div>
								<p class="conv-preview">
									{#if preview.icon === 'done_all'}
										<span class="material-icons-round preview-status-icon">done_all</span>
									{:else if preview.icon}
										<span class="material-icons-round preview-attachment-icon">{preview.icon}</span>
									{/if}
									{#if conv.last_message_body}
										{#each parseMsnEmotes(conv.last_message_body) as part}
											{#if part.type === 'emote'}
												<img
													class="msn-emoji-render"
													src={part.url}
													alt={part.code}
													title={part.code}
													style="width: 1.1em; height: 1.1em; vertical-align: middle; margin: 0 1px; image-rendering: pixelated;"
												/>
											{:else}
												{part.text}
											{/if}
										{/each}
									{:else}
										{preview.text}
									{/if}
								</p>
							</div>

							<div class="conv-badges">
								{#if conv.is_muted}
									<span class="material-icons-round mute-icon" title="Silenciado"
										>notifications_off</span
									>
								{/if}
								{#if conv.unread_count > 0}
									<span class="unread-badge" class:muted={conv.is_muted}>
										{conv.unread_count > 99 ? '99+' : conv.unread_count}
									</span>
								{/if}
							</div>

							<div class="conv-menu-wrapper">
								<button
									class="conv-menu-btn"
									onclick={(e) => toggleMenu(e, conv.id)}
									aria-label="Opciones de conversación"
									title="Opciones"
								>
									<span class="material-icons-round">more_vert</span>
								</button>
								{#if menuOpenId === conv.id}
									<div class="conv-menu" transition:fly={{ y: -6, duration: 150 }}>
										<button class="conv-menu-item" onclick={(e) => handlePin(e, conv.id)}>
											<span class="material-icons-round">push_pin</span>
											{conv.is_pinned ? 'Dejar de fijar' : 'Fijar chat'}
										</button>
										<button class="conv-menu-item" onclick={(e) => handleMute(e, conv.id)}>
											<span class="material-icons-round">
												{conv.is_muted ? 'notifications_active' : 'notifications_off'}
											</span>
											{conv.is_muted ? 'Reactivar sonido' : 'Silenciar'}
										</button>
									</div>
								{/if}
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Pie: conexión en vivo -->
	<footer class="sidebar-footer" in:fade={{ duration: 200 }}>
		<span class="footer-dot" class:on={notificationsStore.connected}></span>
		{#if notificationsStore.connected}
			Conectado en tiempo real
		{:else}
			Reconectando…
		{/if}
	</footer>
</aside>

<style>
	.conversations-sidebar {
		width: 320px;
		flex-shrink: 0;
		border-right: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		overflow: hidden;
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
	}

	/* ── Header ─────────────────────────────────────────────── */
	.sidebar-header {
		padding: 14px 14px 10px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		border-bottom: 1px solid var(--border-subtle);
		background:
			radial-gradient(120% 90% at 85% -30%, rgba(var(--accent-blue-rgb), 0.09), transparent 60%),
			rgba(var(--accent-blue-rgb), 0.02);
	}

	.sidebar-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.title-block {
		min-width: 0;
	}

	.sidebar-title {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin: 0;
		line-height: 1.15;
		background: linear-gradient(120deg, var(--text-primary) 55%, var(--accent-blue-base) 130%);
		-webkit-background-clip: text;
		background-clip: text;
	}

	.sidebar-count {
		font-size: 0.68rem;
		color: var(--text-muted);
		font-weight: 600;
	}

	.sidebar-actions {
		gap: 6px;
		align-items: center;
	}

	.status-avatar {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		object-fit: cover;
		border: 2px solid transparent;
	}

	.status-avatar-initial {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--grad-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		font-size: 13px;
		border: 2px solid transparent;
	}

	.aero-icon-btn {
		position: relative;
		background: rgba(var(--accent-blue-rgb), 0.06);
		border: 1px solid transparent;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		min-width: 32px;
		min-height: 32px;
		box-sizing: border-box;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: visible;
		transition:
			background 0.18s,
			color 0.18s,
			transform 0.18s var(--ease-spring),
			box-shadow 0.2s,
			border-color 0.18s;
	}
	.aero-icon-btn .status-avatar,
	.aero-icon-btn .status-avatar-initial {
		pointer-events: none;
	}
	.aero-icon-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.12);
		color: var(--text-primary);
		transform: translateY(-1px);
		border-color: rgba(var(--accent-blue-rgb), 0.25);
	}
	.aero-icon-btn:active {
		transform: scale(0.94);
	}

	.new-dm-btn {
		background: linear-gradient(135deg, var(--aero-sky), var(--accent-blue-base));
		color: #fff;
		box-shadow: 0 2px 8px rgba(var(--accent-blue-rgb), 0.35);
	}
	.new-dm-btn:hover {
		background: linear-gradient(135deg, var(--accent-blue-light), var(--accent-blue-base));
		box-shadow: 0 4px 12px rgba(var(--accent-blue-rgb), 0.5);
	}

	/* ── Búsqueda ───────────────────────────────────────────── */
	.search-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-wrapper .material-icons-round {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		font-size: 1rem;
		pointer-events: none;
		z-index: 1;
	}

	.search-clear-btn {
		position: absolute;
		right: 6px;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px;
		display: flex;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		transition: color 0.15s;
	}
	.search-clear-btn:hover {
		color: var(--text-primary);
	}
	.search-clear-btn .material-icons-round {
		font-size: 14px;
	}

	/* ── Tabs de filtro ─────────────────────────────────────── */
	.filter-tabs {
		display: flex;
		gap: 4px;
		padding: 3px;
		background: rgba(var(--accent-blue-rgb), 0.05);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
	}

	.filter-tab {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 4px 6px;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
		background: transparent;
		border: none;
		border-radius: calc(var(--radius-sm) - 3px);
		cursor: pointer;
		transition:
			background 0.18s,
			color 0.18s,
			box-shadow 0.18s;
	}

	.filter-tab:hover {
		color: var(--text-primary);
	}

	.filter-tab.active {
		background: var(--bg-surface-solid, #fff);
		color: var(--accent-blue-base);
		box-shadow:
			0 1px 4px rgba(0, 0, 0, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.35);
	}

	.filter-badge {
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--aero-sky), var(--accent-blue-base));
		color: #fff;
		font-size: 0.62rem;
		font-weight: 800;
		border-radius: var(--radius-full);
		line-height: 1;
	}

	/* ── Lista ──────────────────────────────────────────────── */
	.conversations-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
		padding: 4px 0 8px;
	}

	.conv-list-inner {
		list-style: none;
		margin: 0;
		padding: 0 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.conv-item {
		width: 100%;
		padding: 9px 10px;
		display: flex;
		gap: 10px;
		align-items: center;
		background: none;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition:
			background 0.18s ease,
			box-shadow 0.2s ease,
			transform 0.18s ease;
		text-align: left;
		position: relative;
		isolation: isolate;
	}

	.conv-item:focus-visible {
		outline: 2px solid var(--accent-blue-base);
		outline-offset: -2px;
	}

	.conv-item:hover {
		background: var(--bg-surface-hover);
	}

	.conv-item.active {
		background: var(--bg-overlay);
		box-shadow:
			inset 0 1px 0 var(--glass-border-t),
			0 2px 8px rgba(var(--accent-blue-rgb), 0.08);
	}

	/* Barra de activo a la izquierda, con transición suave */
	.active-bar {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%) scaleY(0);
		width: 3px;
		height: 60%;
		border-radius: var(--radius-full);
		background: linear-gradient(180deg, var(--aero-sky), var(--accent-blue-base));
		box-shadow: 0 0 8px rgba(var(--accent-blue-rgb), 0.5);
		transition: transform 0.22s var(--ease-spring);
	}
	.conv-item.active .active-bar {
		transform: translateY(-50%) scaleY(1);
	}

	.conv-item.pinned {
		background: rgba(var(--accent-blue-rgb), 0.04);
	}

	.pin-icon {
		font-size: 0.72rem !important;
		color: var(--accent-blue-base);
		flex-shrink: 0;
		transform: rotate(45deg);
	}

	.conv-badges {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.mute-icon {
		font-size: 0.95rem !important;
		color: var(--text-muted);
		opacity: 0.7;
	}

	.unread-badge.muted {
		background: var(--text-muted);
		box-shadow: none;
		opacity: 0.7;
	}

	.conv-menu-wrapper {
		position: relative;
		flex-shrink: 0;
	}

	.conv-menu-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		display: flex;
		align-items: center;
		opacity: 0;
		transition:
			opacity 0.18s,
			background 0.2s,
			color 0.2s;
	}
	.conv-item:hover .conv-menu-btn,
	.conv-item:focus-within .conv-menu-btn {
		opacity: 1;
	}
	.conv-menu-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.12);
		color: var(--accent-blue-base);
	}
	.conv-menu-btn .material-icons-round {
		font-size: 18px;
	}

	.conv-menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 4px;
		min-width: 170px;
		background: var(--bg-surface-solid, #ffffff);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
		z-index: 60;
		overflow: hidden;
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
	}
	.conv-menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		background: transparent;
		border: none;
		color: var(--text-primary);
		font-size: 0.78rem;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s;
	}
	.conv-menu-item:hover {
		background: var(--bg-overlay);
	}
	.conv-menu-item .material-icons-round {
		font-size: 16px;
		color: var(--text-muted);
	}

	/* ── Avatar ─────────────────────────────────────────────── */
	.conv-avatar-wrapper {
		position: relative;
		flex-shrink: 0;
	}

	.conv-avatar {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-weight: 700;
		font-size: 0.82rem;
		overflow: hidden;
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.3),
			0 1px 3px rgba(0, 0, 0, 0.12);
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
		width: 11px;
		height: 11px;
		background: var(--aero-mint);
		border: 2px solid var(--bg-surface-solid, #ffffff);
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		box-shadow: 0 0 6px rgba(0, 212, 170, 0.55);
	}

	/* ── Detalles ───────────────────────────────────────────── */
	.conv-details {
		flex: 1;
		min-width: 0;
	}

	.conv-meta {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 6px;
	}

	.conv-name {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		min-width: 0;
		font-weight: 700;
		font-size: 0.84rem;
		color: var(--text-primary);
		margin: 0;
	}

	.conv-name-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.verified-check {
		font-size: 0.82rem !important;
		color: var(--badge-verified, var(--aero-sky));
		flex-shrink: 0;
		filter: drop-shadow(0 0 3px rgba(var(--accent-blue-rgb), 0.4));
	}

	.conv-time {
		font-size: 0.66rem;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.conv-preview {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 0.73rem;
		color: var(--text-muted);
		margin: 2px 0 0 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.preview-attachment-icon {
		font-size: 0.85rem !important;
		color: var(--text-muted);
		flex-shrink: 0;
		opacity: 0.85;
	}

	.preview-status-icon {
		font-size: 0.8rem !important;
		color: var(--accent-blue-base);
		flex-shrink: 0;
		opacity: 0.8;
	}

	/* Ítems con no leídos: texto reforzado + hora en color acento */
	.conv-item.has-unread .conv-name,
	.conv-item.has-unread .conv-preview {
		color: var(--text-primary);
		font-weight: 700;
	}
	.conv-item.has-unread .conv-time {
		color: var(--accent-blue-base);
		font-weight: 700;
	}

	.unread-badge {
		min-width: 18px;
		padding: 1px 6px;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, var(--aero-sky), var(--accent-blue-base));
		color: white;
		font-weight: 800;
		font-size: 0.66rem;
		text-align: center;
		box-shadow: 0 2px 6px rgba(var(--accent-blue-rgb), 0.35);
	}

	/* ── Skeletons ──────────────────────────────────────────── */
	.skeleton-item {
		padding: 10px 12px;
		display: flex;
		gap: 10px;
		align-items: center;
		opacity: 0.6;
	}

	.skeleton-avatar {
		width: 44px;
		height: 44px;
		flex: 0 0 44px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--border-subtle);
	}

	.skeleton-lines {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.skeleton-line {
		height: 10px;
		background: var(--border-subtle);
		border-radius: var(--radius-xs);
	}

	.skeleton-line.short {
		width: 45%;
		opacity: 0.8;
	}

	.skeleton-line.long {
		width: 75%;
		opacity: 0.5;
	}

	/* ── Estado vacío ───────────────────────────────────────── */
	.empty-conversations {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 20px;
		text-align: center;
		color: var(--text-muted);
		gap: 4px;
	}

	.empty-conversations .material-icons-round {
		font-size: 2.4rem;
		margin-bottom: 6px;
		opacity: 0.4;
	}

	.empty-conversations p {
		font-size: 0.78rem;
		margin: 0;
		max-width: 210px;
	}

	.empty-new-chat {
		margin-top: 10px;
		padding: 6px 14px;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent-blue-base);
		background: rgba(var(--accent-blue-rgb), 0.08);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.25);
		border-radius: var(--radius-full);
		cursor: pointer;
		transition:
			background 0.18s,
			transform 0.18s var(--ease-spring);
	}
	.empty-new-chat:hover {
		background: rgba(var(--accent-blue-rgb), 0.16);
		transform: translateY(-1px);
	}

	/* ── Footer de estado ───────────────────────────────────── */
	.sidebar-footer {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 14px;
		border-top: 1px solid var(--border-subtle);
		font-size: 0.66rem;
		font-weight: 600;
		color: var(--text-muted);
		background: rgba(var(--accent-blue-rgb), 0.03);
		flex-shrink: 0;
	}

	.footer-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--text-muted);
		opacity: 0.5;
		flex-shrink: 0;
	}

	.footer-dot.on {
		background: var(--aero-mint);
		opacity: 1;
		box-shadow: 0 0 6px rgba(0, 212, 170, 0.6);
		animation: footer-pulse 2.4s ease-in-out infinite;
	}

	@keyframes footer-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.footer-dot.on,
		.aero-icon-btn,
		.active-bar {
			animation: none !important;
			transition: none !important;
		}
	}

	@media (max-width: 768px) {
		.conversations-sidebar.hidden-mobile {
			display: none;
		}
		.conversations-sidebar {
			width: 100%;
			border-right: none;
		}
		.sidebar-header {
			padding-top: 10px;
		}
		.sidebar-footer {
			display: none;
		}
	}

	:global(.conversations-list::-webkit-scrollbar) {
		width: 5px !important;
		background: transparent !important;
	}
	:global(.conversations-list::-webkit-scrollbar-track) {
		background: transparent !important;
		border: none !important;
	}
	:global(.conversations-list::-webkit-scrollbar-thumb) {
		background: var(--scrollbar-thumb) !important;
		border-radius: var(--radius-xs) !important;
		border: none !important;
	}
	:global(.conversations-list::-webkit-scrollbar-thumb:hover) {
		background: var(--scrollbar-thumb-hover) !important;
	}
</style>
