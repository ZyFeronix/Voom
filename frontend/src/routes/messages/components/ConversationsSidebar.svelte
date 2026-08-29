<script>
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';
	import { formatListTime } from '$lib/utils/datetime.js';
	import { fly, fade } from 'svelte/transition';
	import { clickOutside } from '$lib/actions/clickOutside.js';
	import { parseMsnEmotes } from '$lib/data/msnEmoticons.js';

	let {
		chatStore,
		mobileView,
		onNewDM,
		onSelectConversation,
		onPinConversation,
		onMuteConversation
	} = $props();

	let menuOpenId = $state(null);
	let statusPickerOpen = $state(false);
	let customStatusText = $state(authStore.user?.custom_status_text || '');
	let statusInputFocused = $state(false);
	let statusSavedRecently = $state(false);

	const STATUS_OPTIONS = [
		{ id: 'online', label: 'En línea', color: '#00d4aa' },
		{ id: 'away', label: 'Inactivo', color: '#f5a623' },
		{ id: 'dnd', label: 'No molestar', color: '#f43f5e' },
		{ id: 'invisible', label: 'Invisible', color: '#94a3b8' }
	];

	const currentStatusObj = $derived(
		STATUS_OPTIONS.find((s) => s.id === (authStore.user?.custom_status || 'online')) ||
			STATUS_OPTIONS[0]
	);

	async function selectStatus(statusId) {
		if (authStore.user) {
			authStore.updateUser({ custom_status: statusId });
		}
		try {
			await fetch('/api/users/me/status', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authStore.token}`
				},
				body: JSON.stringify({
					custom_status: statusId,
					custom_status_text: customStatusText,
					duration_minutes: 'forever'
				})
			});
		} catch (e) {
			console.error('Failed to update status', e);
		}
	}

	async function saveCustomStatusText() {
		try {
			const res = await fetch('/api/users/me/status', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authStore.token}`
				},
				body: JSON.stringify({
					custom_status: authStore.user?.custom_status || 'online',
					custom_status_text: customStatusText,
					duration_minutes: 'forever'
				})
			});
			if (res.ok) {
				const data = await res.json();
				authStore.updateUser({
					custom_status: data.custom_status,
					custom_status_text: data.custom_status_text
				});
				statusSavedRecently = true;
				setTimeout(() => {
					statusSavedRecently = false;
				}, 2000);
			}
		} catch (e) {
			console.error('Failed to save status text', e);
		}
	}

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

	// Agrupación Fijados / Todas (solo en el filtro "Todos").
	const pinnedGroup = $derived(filter === 'all' ? filteredConvs.filter((c) => c.is_pinned) : []);
	const restGroup = $derived(
		filter === 'all' ? filteredConvs.filter((c) => !c.is_pinned) : filteredConvs
	);

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

<svelte:window
	onclick={() => (menuOpenId = null)}
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			menuOpenId = null;
			statusPickerOpen = false;
		}
	}}
/>

<aside class="conversations-sidebar" class:hidden-mobile={mobileView === 'chat'}>
	<!-- Encabezado con tarjeta de perfil y presencia integrada (sin popups) -->
	<header class="sidebar-header">
		<div class="user-profile-card">
			<div class="user-avatar-slot" style="flex: 0 0 44px; min-width: 44px; min-height: 44px">
				{#if authStore.user?.avatar_url}
					<img
						src={authStore.user.avatar_url}
						alt="Mi Avatar"
						class="user-card-avatar"
						width="44"
						height="44"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<div class="user-card-init">
						{(authStore.user?.display_name || authStore.user?.username || '?')[0].toUpperCase()}
					</div>
				{/if}
				<span class="user-presence-dot status-{authStore.user?.custom_status || 'online'}"></span>
			</div>

			<div class="user-card-details">
				<div class="user-card-topline">
					<span
						class="user-card-name"
						title={authStore.user?.display_name || authStore.user?.username}
					>
						{authStore.user?.display_name || authStore.user?.username || 'Mi Perfil'}
					</span>
					<div class="status-pill-container" use:clickOutside={() => (statusPickerOpen = false)}>
						<button
							type="button"
							class="status-pill-badge status-{currentStatusObj.id}"
							class:active={statusPickerOpen}
							onclick={() => (statusPickerOpen = !statusPickerOpen)}
							aria-label="Cambiar estado de conexión"
							aria-expanded={statusPickerOpen}
						>
							<span class="status-dot-mini status-{currentStatusObj.id}"></span>
							<span class="status-pill-label">{currentStatusObj.label}</span>
							<span class="material-icons-round status-pill-chevron">expand_more</span>
						</button>

						{#if statusPickerOpen}
							<div class="status-pill-dropdown" transition:fly={{ y: 4, duration: 150 }}>
								{#each STATUS_OPTIONS as opt (opt.id)}
									{@const isCurrent = currentStatusObj.id === opt.id}
									<button
										type="button"
										class="status-pill-opt"
										class:selected={isCurrent}
										onclick={() => {
											selectStatus(opt.id);
											statusPickerOpen = false;
										}}
									>
										<span class="status-dot-mini status-{opt.id}"></span>
										<span class="status-opt-name">{opt.label}</span>
										{#if isCurrent}
											<span class="material-icons-round status-opt-check">check</span>
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<div class="user-status-capsule" class:focused={statusInputFocused}>
					<span class="material-icons-round status-capsule-icon" class:saved={statusSavedRecently}>
						{statusSavedRecently ? 'check_circle' : 'edit_note'}
					</span>
					<input
						type="text"
						placeholder="¿Qué estás pensando?"
						bind:value={customStatusText}
						onfocus={() => (statusInputFocused = true)}
						onblur={() => {
							statusInputFocused = false;
							saveCustomStatusText();
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								e.currentTarget.blur();
							}
						}}
						class="user-status-text-input"
						maxlength="60"
						title="Escribe tu estado personal (presiona Enter para guardar)"
					/>
					<div class="status-capsule-actions">
						{#if customStatusText && statusInputFocused}
							<button
								type="button"
								class="status-capsule-clear-btn"
								style="flex: 0 0 24px; min-width: 24px; min-height: 24px"
								onmousedown={(e) => {
									e.preventDefault();
									customStatusText = '';
									saveCustomStatusText();
								}}
								aria-label="Borrar estado"
								title="Borrar estado"
							>
								<span class="material-icons-round">close</span>
							</button>
						{/if}
						{#if statusInputFocused}
							<span
								class="status-limiter"
								class:limit-warn={customStatusText.length > 50}
								title="Límite de caracteres"
							>
								{customStatusText.length}/60
							</span>
						{/if}
					</div>
				</div>
			</div>

			<button
				onclick={onNewDM}
				class="new-chat-btn"
				style="flex: 0 0 32px; min-width: 32px; min-height: 32px"
				aria-label="Nuevo Mensaje"
				title="Iniciar nuevo chat"
			>
				<span class="material-icons-round">add</span>
			</button>
		</div>

		<!-- Búsqueda -->
		<div class="search-wrapper">
			<span class="material-icons-round search-icon">search</span>
			<input
				id="chat_search_input"
				name="chat_search"
				type="text"
				placeholder="Buscar conversaciones..."
				bind:value={chatStore.searchQuery}
				class="search-input"
				autocomplete="off"
			/>
			{#if chatStore.searchQuery}
				<button
					class="search-clear-btn"
					style="flex: 0 0 28px; min-width: 28px; min-height: 28px"
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
			{#each Array(6) as _, i (i)}
				<div class="skeleton-item" style="--stagger-delay: {i * 60}ms;" in:fade={{ duration: 150 }}>
					<div
						class="skeleton-avatar"
						style="flex: 0 0 44px; min-width: 44px; min-height: 44px;"
					></div>
					<div class="skeleton-lines">
						<div class="skeleton-line short"></div>
						<div class="skeleton-line long"></div>
					</div>
				</div>
			{/each}
		{:else if filteredConvs.length === 0}
			<div class="empty-conversations" in:fly={{ y: 15, duration: 300 }}>
				<div class="empty-conv-icon-glow">
					<span class="material-icons-round">
						{chatStore.searchQuery || filter !== 'all' ? 'search_off' : 'chat_bubble_outline'}
					</span>
				</div>
				<p class="empty-conv-title">
					{#if chatStore.searchQuery}
						Sin resultados para “{chatStore.searchQuery}”
					{:else if filter === 'unread'}
						Todo al día. No tienes mensajes sin leer.
					{:else if filter === 'pinned'}
						Aún no has fijado ninguna conversación.
					{:else}
						Bandeja de mensajes vacía
					{/if}
				</p>
				{#if !chatStore.searchQuery && filter === 'all'}
					<button class="btn-aero-primary empty-new-chat" onclick={onNewDM}>
						<span class="material-icons-round" style="font-size: 16px;">add</span> Iniciar un chat
					</button>
				{/if}
			</div>
		{:else}
			<div class="conv-list-inner">
				{#if pinnedGroup.length > 0}
					<div class="group-label" in:fade={{ duration: 180 }}>
						<span class="material-icons-round">push_pin</span> Fijados
					</div>
				{/if}
				{#snippet convCard(conv, i, flipMenu = false)}
					{@const preview = previewParts(conv)}
					{@const online = peerOnline(conv)}
					<div
						role="button"
						tabindex="0"
						class="conv-card"
						class:active={chatStore.activeConvId === conv.id}
						class:has-unread={conv.unread_count > 0}
						class:menu-open={menuOpenId === conv.id}
						class:menu-flip={flipMenu}
						in:fly={{ y: 10, duration: 220, delay: Math.min(i, 8) * 25 }}
						onclick={() => onSelectConversation(conv.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onSelectConversation(conv.id);
							}
						}}
					>
						<div
							class="conv-avatar-wrap"
							style="flex: 0 0 44px; min-width: 44px; min-height: 44px;"
						>
							{#if conv.peer_avatar}
								<img
									src={conv.peer_avatar}
									alt={conv.name || conv.peer_display_name}
									class="conv-avatar-img"
									width="44"
									height="44"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<div class="conv-avatar-init">
									{getInitials(conv.name || conv.peer_display_name || conv.peer_username)}
								</div>
							{/if}
							{#if online}
								<span class="conv-online-dot" title="En línea"></span>
							{/if}
						</div>
						<div class="conv-details">
							<div class="conv-line1">
								<h3 class="conv-name">
									<span class="conv-name-text"
										>{conv.name || conv.peer_display_name || conv.peer_username}</span
									>
									{#if conv.is_verified}
										<span class="material-icons-round verified-check" title="Cuenta verificada"
											>verified</span
										>
									{/if}
								</h3>
								<div class="conv-meta-action">
									{#if conv.last_message_time}
										<time class="conv-time" datetime={conv.last_message_time}
											>{formatListTime(conv.last_message_time)}</time
										>
									{/if}
									<button
										class="conv-menu-btn"
										style="flex: 0 0 28px; min-width: 28px; min-height: 28px;"
										onclick={(e) => toggleMenu(e, conv.id)}
										aria-label="Opciones de conversación"
										title="Opciones"
									>
										<span class="material-icons-round">more_vert</span>
									</button>
								</div>
							</div>
							<div class="conv-line2">
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
												/>
											{:else}
												{part.content || part.text}
											{/if}
										{/each}
									{:else}
										{preview.text}
									{/if}
								</p>
								{#if conv.unread_count > 0}
									<span class="unread-badge" class:muted={conv.is_muted}
										>{conv.unread_count > 99 ? '99+' : conv.unread_count}</span
									>
								{/if}
							</div>
						</div>
						{#if menuOpenId === conv.id}
							<div
								class="conv-menu"
								use:clickOutside={() => (menuOpenId = null)}
								transition:fly={{ y: -6, duration: 150 }}
							>
								<button class="conv-menu-item" onclick={(e) => handlePin(e, conv.id)}>
									<span class="material-icons-round">push_pin</span>
									{conv.is_pinned ? 'Dejar de fijar' : 'Fijar chat'}
								</button>
								<button class="conv-menu-item" onclick={(e) => handleMute(e, conv.id)}>
									<span class="material-icons-round"
										>{conv.is_muted ? 'notifications_active' : 'notifications_off'}</span
									>
									{conv.is_muted ? 'Reactivar sonido' : 'Silenciar'}
								</button>
							</div>
						{/if}
					</div>
				{/snippet}
				{#each pinnedGroup as conv, i (conv.id)}
					{@render convCard(conv, i)}
				{/each}
				{#if pinnedGroup.length > 0 && restGroup.length > 0}
					<div class="group-label" in:fade={{ duration: 180 }}>
						<span class="material-icons-round">forum</span> Todas las conversaciones
					</div>
				{/if}
				{#each restGroup as conv, i (conv.id)}
					{@render convCard(conv, i, i >= restGroup.length - 2)}
				{/each}
			</div>
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
	/* ═══════════════════════════════════════════════════════════
	   Voom! Messenger — Bandeja de conversaciones "Retro-Aero"
	   Lista plana tipo contactos MSN moderno: filas limpias,
	   selección con acento, segmented control y menús sin solapes.
	   ═══════════════════════════════════════════════════════════ */

	.conversations-sidebar {
		position: relative;
		width: 320px;
		flex-shrink: 0;
		border-right: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		overflow: hidden;
		isolation: isolate;
		background: rgba(var(--accent-blue-rgb), 0.03);
	}
	:global([data-theme='dark']) .conversations-sidebar,
	:global([data-theme='midnight']) .conversations-sidebar {
		background: rgba(0, 0, 0, 0.14);
	}

	/* ── Cabecera ───────────────────────────────────────────── */
	.sidebar-header {
		position: relative;
		z-index: 2;
		padding: 12px 12px 10px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		border-bottom: 1px solid var(--border-subtle);
	}

	/* Fila de perfil: simple, sin caja pesada */
	.user-profile-card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 2px 2px;
	}

	.user-avatar-slot {
		position: relative;
		width: 42px;
		height: 42px;
		flex: 0 0 42px;
		min-width: 42px;
		min-height: 42px;
		flex-shrink: 0;
	}
	.user-card-avatar {
		width: 100%;
		height: 100%;
		border-radius: 14px;
		corner-shape: squircle;
		object-fit: cover;
		display: block;
	}
	.user-card-init {
		width: 100%;
		height: 100%;
		border-radius: 14px;
		corner-shape: squircle;
		background: linear-gradient(140deg, var(--aero-sky), var(--accent-blue-base));
		color: #ffffff;
		font-weight: 800;
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.user-presence-dot {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid var(--bg-surface-solid, var(--bg-surface));
	}
	.user-presence-dot.status-online {
		background: var(--aero-mint, #00d4aa);
	}
	.user-presence-dot.status-away,
	.user-presence-dot.status-idle {
		background: #f5a623;
	}
	.user-presence-dot.status-dnd {
		background: #e5484d;
	}
	.user-presence-dot.status-invisible,
	.user-presence-dot.status-offline {
		background: #64748b;
	}

	.user-card-details {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.user-card-topline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
	}
	.user-card-name {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 0.88rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Selector de estado: pill compacta con chevron */
	.status-pill-container {
		position: relative;
		flex-shrink: 0;
	}
	.status-pill-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 7px;
		background: transparent;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		cursor: pointer;
		font-family: inherit;
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}
	.status-pill-badge:hover,
	.status-pill-badge.active {
		background: rgba(var(--accent-blue-rgb), 0.08);
		border-color: rgba(var(--accent-blue-rgb), 0.3);
	}
	.status-pill-badge:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.status-pill-label {
		font-size: 0.66rem;
		font-weight: 700;
		color: var(--text-secondary);
		white-space: nowrap;
	}
	.status-pill-chevron {
		font-size: 13px !important;
		color: var(--text-muted);
	}
	.status-dot-mini {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.status-dot-mini.status-online {
		background: var(--aero-mint, #00d4aa);
	}
	.status-dot-mini.status-away,
	.status-dot-mini.status-idle {
		background: #f5a623;
	}
	.status-dot-mini.status-dnd {
		background: #e5484d;
	}
	.status-dot-mini.status-invisible,
	.status-dot-mini.status-offline {
		background: #64748b;
	}

	/* Dropdown de estado: superficie sólida con sombra */
	.status-pill-dropdown {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		min-width: 150px;
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: 12px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
		z-index: 30;
		padding: 4px;
		display: flex;
		flex-direction: column;
	}
	.status-pill-opt {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 9px;
		background: transparent;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-family: inherit;
		text-align: left;
		transition: background 0.13s ease;
	}
	.status-pill-opt:hover {
		background: rgba(var(--accent-blue-rgb), 0.08);
	}
	.status-pill-opt:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: -2px;
	}
	.status-pill-opt.selected {
		background: rgba(var(--accent-blue-rgb), 0.06);
	}
	.status-opt-name {
		flex: 1;
		font-size: 0.76rem;
		font-weight: 600;
		color: var(--text-primary);
	}
	.status-opt-check {
		font-size: 15px !important;
		color: var(--accent-blue-base);
	}

	/* Cápsula de estado personal */
	.user-status-capsule {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 8px;
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		background: transparent;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}
	.user-status-capsule.focused {
		border-color: var(--accent-blue-base);
		box-shadow: 0 0 0 3px rgba(var(--accent-blue-rgb), 0.12);
	}
	.status-capsule-icon {
		font-size: 15px !important;
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.status-capsule-icon.saved {
		color: var(--aero-mint, #00d4aa);
	}
	.user-status-text-input {
		flex: 1;
		min-width: 0;
		border: none;
		background: transparent;
		outline: none;
		padding: 7px 0;
		font-size: 0.76rem;
		color: var(--text-primary);
		font-family: inherit;
	}
	.user-status-text-input::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}
	.status-capsule-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}
	.status-capsule-clear-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
	}
	.status-capsule-clear-btn:hover {
		color: var(--text-primary);
		background: rgba(var(--accent-blue-rgb), 0.1);
	}
	.status-capsule-clear-btn .material-icons-round {
		font-size: 13px;
	}
	.status-limiter {
		font-size: 0.62rem;
		font-weight: 700;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.status-limiter.limit-warn {
		color: var(--aero-amber, #f5a623);
	}

	/* Botón nuevo chat */
	.new-chat-btn {
		background: var(--accent-blue-base);
		border: none;
		color: #ffffff;
		cursor: pointer;
		padding: 0;
		width: 34px;
		height: 34px;
		min-width: 34px;
		min-height: 34px;
		flex: 0 0 34px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(var(--accent-blue-rgb), 0.35);
		transition:
			transform 0.15s var(--ease-spring),
			filter 0.15s ease;
	}
	.new-chat-btn:hover {
		transform: translateY(-1px);
		filter: brightness(1.08);
	}
	.new-chat-btn:active {
		transform: scale(0.94);
	}
	.new-chat-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.new-chat-btn .material-icons-round {
		font-size: 19px;
	}

	/* ── Búsqueda ───────────────────────────────────────────── */
	.search-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}
	.search-icon {
		position: absolute;
		left: 11px;
		color: var(--text-muted);
		font-size: 1rem !important;
		pointer-events: none;
		z-index: 1;
	}
	.search-input {
		width: 100%;
		box-sizing: border-box;
		padding: 9px 34px;
		font-size: 0.82rem;
		font-family: inherit;
		border-radius: 11px;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface-solid, var(--bg-surface));
		color: var(--text-primary);
		outline: none;
		transition:
			border-color 0.16s ease,
			box-shadow 0.16s ease;
	}
	.search-input:focus {
		border-color: var(--accent-blue-base);
		box-shadow: 0 0 0 3px rgba(var(--accent-blue-rgb), 0.12);
	}
	.search-input::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}
	.search-clear-btn {
		position: absolute;
		right: 6px;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		width: 26px;
		height: 26px;
		min-width: 26px;
		min-height: 26px;
		flex: 0 0 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
	}
	.search-clear-btn:hover {
		color: var(--text-primary);
		background: rgba(var(--accent-blue-rgb), 0.1);
	}
	.search-clear-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 1px;
	}
	.search-clear-btn .material-icons-round {
		font-size: 15px;
	}

	/* ── Filtros: segmented control limpio ──────────────────── */
	.filter-tabs {
		display: flex;
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--border-subtle);
		border-radius: 11px;
		background: rgba(var(--accent-blue-rgb), 0.04);
	}
	.filter-tab {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 6px 8px;
		background: transparent;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.73rem;
		font-weight: 700;
		color: var(--text-muted);
		transition:
			background 0.15s ease,
			color 0.15s ease,
			box-shadow 0.15s ease;
	}
	.filter-tab:hover {
		color: var(--text-secondary);
	}
	.filter-tab:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: -2px;
	}
	.filter-tab.active {
		background: var(--bg-surface-solid, var(--bg-surface));
		color: var(--text-primary);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
	}
	.filter-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 17px;
		height: 16px;
		padding: 0 4px;
		border-radius: var(--radius-full);
		background: var(--accent-blue-base);
		color: #ffffff;
		font-size: 0.6rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	/* ── Lista ──────────────────────────────────────────────── */
	.conversations-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 8px;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
	}
	.conversations-list::-webkit-scrollbar {
		width: 5px;
		background: transparent;
	}
	.conversations-list::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb);
		border-radius: var(--radius-xs);
	}
	.conv-list-inner {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.group-label {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 10px 6px 4px;
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.group-label .material-icons-round {
		font-size: 12px;
	}

	/* Fila de conversación: plana, selección con acento (guía MSN) */
	.conv-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 8px;
		border-radius: 12px;
		cursor: pointer;
		border: 1px solid transparent;
		transition:
			background 0.14s ease,
			border-color 0.14s ease;
	}
	.conv-card:hover {
		background: rgba(var(--accent-blue-rgb), 0.06);
	}
	.conv-card:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: -2px;
	}
	.conv-card.active {
		background: rgba(var(--accent-blue-rgb), 0.1);
		border-color: rgba(var(--accent-blue-rgb), 0.28);
	}
	.conv-card.menu-open {
		background: rgba(var(--accent-blue-rgb), 0.08);
	}

	.conv-avatar-wrap {
		position: relative;
		width: 44px;
		height: 44px;
		flex: 0 0 44px;
		min-width: 44px;
		min-height: 44px;
		flex-shrink: 0;
	}
	.conv-avatar-img {
		width: 100%;
		height: 100%;
		border-radius: 14px;
		corner-shape: squircle;
		object-fit: cover;
		display: block;
	}
	.conv-avatar-init {
		width: 100%;
		height: 100%;
		border-radius: 14px;
		corner-shape: squircle;
		background: linear-gradient(140deg, var(--aero-sky), var(--accent-blue-base));
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-weight: 800;
		font-size: 0.86rem;
	}
	.conv-online-dot {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--aero-mint, #00d4aa);
		border: 2px solid var(--bg-surface-solid, var(--bg-surface));
	}

	.conv-details {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.conv-line1 {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	.conv-name {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		font-weight: 700;
		font-size: 0.85rem;
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
	}
	.conv-meta-action {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}
	.conv-time {
		font-size: 0.64rem;
		color: var(--text-muted);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.conv-menu-btn {
		background: transparent;
		border: none;
		color: transparent;
		cursor: pointer;
		padding: 0;
		width: 26px;
		height: 26px;
		min-width: 26px;
		min-height: 26px;
		flex: 0 0 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		transition:
			color 0.14s ease,
			background 0.14s ease;
	}
	.conv-card:hover .conv-menu-btn,
	.conv-card:focus-within .conv-menu-btn,
	.conv-card.menu-open .conv-menu-btn {
		color: var(--text-muted);
	}
	.conv-menu-btn:hover {
		color: var(--text-primary) !important;
		background: rgba(var(--accent-blue-rgb), 0.12);
	}
	.conv-menu-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 1px;
	}
	.conv-menu-btn .material-icons-round {
		font-size: 16px;
	}

	.conv-line2 {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.conv-preview {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		flex: 1;
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.conv-card.has-unread .conv-preview {
		color: var(--text-secondary);
		font-weight: 600;
	}
	.preview-status-icon,
	.preview-attachment-icon {
		font-size: 13px !important;
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.unread-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 19px;
		height: 18px;
		padding: 0 5px;
		border-radius: var(--radius-full);
		background: var(--accent-blue-base);
		color: #ffffff;
		font-size: 0.62rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
		line-height: 1;
	}
	.unread-badge.muted {
		background: var(--text-muted);
	}

	/* Menú contextual: sólido, con flip para las últimas filas */
	.conv-menu {
		position: absolute;
		top: calc(100% - 4px);
		right: 10px;
		min-width: 170px;
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: 12px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
		z-index: 20;
		padding: 4px;
		display: flex;
		flex-direction: column;
	}
	.conv-card.menu-flip .conv-menu {
		top: auto;
		bottom: calc(100% - 4px);
	}
	.conv-menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		background: transparent;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-primary);
		text-align: left;
		transition: background 0.13s ease;
	}
	.conv-menu-item:hover {
		background: rgba(var(--accent-blue-rgb), 0.08);
	}
	.conv-menu-item:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: -2px;
	}
	.conv-menu-item .material-icons-round {
		font-size: 16px;
		color: var(--text-muted);
	}

	/* ── Esqueletos ─────────────────────────────────────────── */
	.skeleton-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
		border-radius: 12px;
		animation: skel-in 0.3s ease both;
		animation-delay: var(--stagger-delay, 0ms);
	}
	@keyframes skel-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.skeleton-avatar {
		width: 44px;
		height: 44px;
		border-radius: 14px;
		background: var(--border-subtle);
		opacity: 0.6;
	}
	.skeleton-lines {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.skeleton-line {
		height: 9px;
		border-radius: var(--radius-xs);
		background: var(--border-subtle);
		opacity: 0.6;
	}
	.skeleton-line.short {
		width: 40%;
	}
	.skeleton-line.long {
		width: 75%;
	}

	/* ── Vacío ──────────────────────────────────────────────── */
	.empty-conversations {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 36px 16px;
		gap: 10px;
	}
	.empty-conv-icon-glow {
		width: 56px;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 18px;
		corner-shape: squircle;
		background: rgba(var(--accent-blue-rgb), 0.08);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.2);
		color: var(--accent-blue-base);
	}
	.empty-conv-icon-glow .material-icons-round {
		font-size: 26px;
	}
	.empty-conv-title {
		font-size: 0.82rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.45;
		max-width: 220px;
	}
	.empty-new-chat {
		margin-top: 6px;
		padding: 8px 16px;
		font-size: 0.78rem;
		border-radius: var(--radius-full);
	}

	/* ── Pie de conexión ────────────────────────────────────── */
	.sidebar-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 9px 12px;
		border-top: 1px solid var(--border-subtle);
		font-size: 0.66rem;
		font-weight: 600;
		color: var(--text-muted);
	}
	.footer-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--text-muted);
	}
	.footer-dot.on {
		background: var(--aero-mint, #00d4aa);
		box-shadow: 0 0 0 2px rgba(var(--aero-mint-rgb, 0, 212, 170), 0.18);
	}

	/* ── Móvil ──────────────────────────────────────────────── */
	@media (max-width: 768px) {
		.conversations-sidebar {
			width: 100%;
		}
		.conversations-sidebar.hidden-mobile {
			transform: translateX(-100%);
			opacity: 0;
			pointer-events: none;
			visibility: hidden;
			transition:
				transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
				opacity 0.25s ease,
				visibility 0s linear 0.28s;
		}
		.conversations-sidebar:not(.hidden-mobile) {
			transform: translateX(0);
			opacity: 1;
			visibility: visible;
			transition:
				transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
				opacity 0.25s ease,
				visibility 0s linear 0s;
		}
		.conversations-sidebar {
			will-change: transform, opacity;
		}
	}
</style>
