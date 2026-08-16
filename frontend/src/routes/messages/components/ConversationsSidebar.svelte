<script>
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';
	import { formatTime } from '$lib/utils/datetime.js';
	import { fly } from 'svelte/transition';
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

	function getInitials(name) {
		if (!name) return '?';
		return name.substring(0, 2).toUpperCase();
	}

	function peerOnline(conv) {
		if (!conv?.peer_id) return false;
		if (notificationsStore.connected) return notificationsStore.isUserOnline(conv.peer_id);
		return !!conv.peer_online;
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

<div class="conversations-sidebar" class:hidden-mobile={mobileView === 'chat'}>
	<!-- Top header with DM button -->
	<div class="sidebar-header">
		<div class="sidebar-title-row">
			<h1 class="sidebar-title">Mensajes</h1>

			<div class="sidebar-actions flex">
				<button
					onclick={onStatusConfig}
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
				<button onclick={onNewDM} class="aero-icon-btn" aria-label="Nuevo Mensaje">
					<span class="material-icons-round">chat</span>
				</button>
			</div>
		</div>

		<!-- Search input -->
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
		</div>
	</div>

	<!-- Conversations list container -->
	<div class="conversations-list">
		{#if chatStore.loadingConvs}
			{#each Array(6) as _}
				<div class="skeleton-item">
					<div class="skeleton-avatar animate-pulse"></div>
					<div class="skeleton-lines">
						<div class="skeleton-line short animate-pulse"></div>
						<div class="skeleton-line long animate-pulse"></div>
					</div>
				</div>
			{/each}
		{:else if chatStore.filteredConversations.length === 0}
			<div class="empty-conversations" in:fly={{ y: 20, duration: 400 }}>
				<span class="material-icons-round">question_answer</span>
				<p>No hay conversaciones</p>
			</div>
		{:else}
			{#each chatStore.filteredConversations as conv, i}
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
					class:pinned={conv.is_pinned}
					in:fly={{ y: 12, duration: 250, delay: i * 30 }}
				>
					<div class="conv-avatar-wrapper">
						<div
							class="conv-avatar"
							style="flex: 0 0 38px; min-width: 38px; min-height: 38px; width: 38px; height: 38px;"
						>
							{#if conv.peer_avatar}
								<img
									src={conv.peer_avatar}
									alt={conv.name || conv.peer_display_name}
									width="38"
									height="38"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<span>{getInitials(conv.name || conv.peer_display_name || conv.peer_username)}</span
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
									<span class="material-icons-round pin-icon">push_pin</span>
								{/if}
								{conv.name || conv.peer_display_name || conv.peer_username}
							</h3>
							{#if conv.last_message_time}
								<span class="conv-time">
									{formatTime(conv.last_message_time)}
								</span>
							{/if}
						</div>
						<p class="conv-preview">
							{#if conv.last_message_body}
								{#each parseMsnEmotes(conv.last_message_body) as part}
									{#if part.type === 'emote'}
										<img
											class="msn-emoji-render"
											src={part.url}
											alt={part.code}
											title={part.code}
											style="width: 1.1em; height: 1.1em; vertical-align: middle; margin: 0 1px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15)); image-rendering: pixelated;"
										/>
									{:else}
										{part.text}
									{/if}
								{/each}
							{:else}
								Empezar conversación...
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
								{conv.unread_count}
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
			{/each}
		{/if}
	</div>
</div>

<style>
	.conversations-sidebar {
		width: 300px;
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

	.sidebar-header {
		padding: 12px 14px;
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: rgba(var(--accent-blue-rgb), 0.02);
	}

	.sidebar-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.sidebar-title {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 800;
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin: 0;
	}

	.sidebar-actions {
		gap: 6px;
		align-items: center;
	}

	.status-avatar {
		width: 26px;
		height: 26px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		object-fit: cover;
		border: 2px solid transparent;
	}

	.status-avatar-initial {
		width: 26px;
		height: 26px;
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
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.18s,
			color 0.18s;
	}
	.aero-icon-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.08);
		color: var(--text-primary);
	}

	.search-wrapper {
		position: relative;
	}

	.search-wrapper .material-icons-round {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		font-size: 1rem;
		pointer-events: none;
	}

	.search-wrapper input {
		padding-left: 32px;
		width: 100%;
		height: 32px;
	}

	.conversations-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
	}

	.conv-item {
		width: 100%;
		padding: 9px 12px;
		display: flex;
		gap: 10px;
		align-items: center;
		background: none;
		border: none;
		border-left: 3px solid transparent;
		cursor: pointer;
		transition: all 0.18s ease;
		text-align: left;
		position: relative;
	}

	.conv-item:focus-visible {
		outline: 2px solid var(--accent-blue-base);
		outline-offset: -2px;
	}

	.conv-item.pinned {
		background: rgba(var(--accent-blue-rgb), 0.05);
	}

	.pin-icon {
		font-size: 0.8rem !important;
		color: var(--accent-blue-base);
		vertical-align: middle;
		margin-right: 2px;
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
		min-width: 160px;
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

	.conv-item:hover {
		background: var(--bg-surface-hover);
	}

	.conv-item.active {
		background: var(--bg-overlay);
		border-left-color: var(--accent-blue-base);
	}

	.conv-avatar-wrapper {
		position: relative;
		flex-shrink: 0;
	}

	.conv-avatar {
		width: 38px;
		height: 38px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-weight: 700;
		font-size: 0.8rem;
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

	.conv-details {
		flex: 1;
		min-width: 0;
	}

	.conv-meta {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.conv-name {
		font-weight: 700;
		font-size: 0.82rem;
		color: var(--text-primary);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.conv-time {
		font-size: 0.68rem;
		color: var(--text-muted);
	}

	.conv-preview {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin: 2px 0 0 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.unread-badge {
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		background: var(--accent-blue-base);
		color: white;
		font-weight: 800;
		font-size: 0.68rem;
		box-shadow: 0 2px 6px rgba(var(--accent-blue-rgb), 0.35);
	}

	.skeleton-item {
		padding: 10px 12px;
		display: flex;
		gap: 10px;
		align-items: center;
		opacity: 0.6;
	}

	.skeleton-avatar {
		width: 38px;
		height: 38px;
		flex: 0 0 38px;
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

	.empty-conversations {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 16px;
		text-align: center;
		color: var(--text-muted);
	}

	.empty-conversations .material-icons-round {
		font-size: 2rem;
		margin-bottom: 6px;
		opacity: 0.5;
	}

	.empty-conversations p {
		font-size: 0.78rem;
		margin: 0;
	}

	@media (max-width: 768px) {
		.conversations-sidebar.hidden-mobile {
			display: none;
		}
		.conversations-sidebar {
			width: 100%;
			border-right: none;
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
