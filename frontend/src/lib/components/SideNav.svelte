<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { uiStore } from '$lib/stores/ui.svelte.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';

	const navItems = [
		{ href: '/feed',          icon: 'home',           label: 'Inicio' },
		{ href: '/explore',       icon: 'explore',        label: 'Explorar' },
		{ href: '/reels',         icon: 'play_circle',    label: 'Reels' },
		{ href: '/marketplace',   icon: 'storefront',     label: 'Marketplace' },
		{ href: '/leaderboard',   icon: 'emoji_events',   label: 'Ranking' },
		{ href: '/messages',      icon: 'chat_bubble',    label: 'Mensajes', badge: () => notificationsStore.unreadMessageCount },
		{ href: '/notifications', icon: 'notifications',  label: 'Notificaciones', badge: () => notificationsStore.unreadCount },
	];

	const creatorItems = [
		{ href: '/stories/create', icon: 'auto_stories', label: 'Nueva Historia' },
		{ href: '/posts/create',   icon: 'post_add',  label: 'Nuevo Post' },
		{ href: '/reels/create',   icon: 'video_call',   label: 'Nuevo Reel' },
	];

	const bottomItems = [
		{ href: `/u/${authStore.user?.username}`, icon: 'person',   label: 'Mi Perfil' },
		{ href: '/settings',                      icon: 'settings', label: 'Ajustes' },
	];

	async function handleLogout() {
		await authStore.logout();
		goto('/');
	}
	function isActiveNav(href) {
		if (href === '/reels' && page.url.pathname === '/reels/create') return false;
		if (href === '/feed' && page.url.pathname !== '/feed') return false;
		return page.url.pathname.startsWith(href);
	}
</script>

<nav class="vs-sidenav">
	<!-- Logo & Toggle -->
	<div class="vs-logo-row">
		<a href="/feed" class="vs-logo-link" class:collapsed={!uiStore.sidebarExpanded}>
			<div class="vs-logo-box">
				<span class="material-icons-round" style="font-size:18px; color:#fff;">hub</span>
			</div>
			<span class="vs-logo-text">VSocial</span>
		</a>
		<button onclick={() => uiStore.toggleSidebar()} class="vs-collapse-btn" title="Alternar menú">
			<span class="material-icons-round" style="font-size: 20px;">{uiStore.sidebarExpanded ? 'menu_open' : 'menu'}</span>
		</button>
	</div>

	<!-- Main navigation -->
	<div class="vs-nav-section">
		{#each navItems as item}
			<a
				href={item.href}
				class="vs-nav-link {isActiveNav(item.href) ? 'active' : ''}"
			>
				<span class="vs-nav-icon-wrapper">
					<span class="material-icons-round vs-nav-icon">{item.icon}</span>
					{#if item.badge && item.badge() > 0}
						<span class="vs-badge">{item.badge() > 99 ? '+99' : item.badge()}</span>
					{/if}
				</span>
				<span class="vs-nav-label">{item.label}</span>
				{#if isActiveNav(item.href)}
					<span class="vs-active-pip"></span>
				{/if}
			</a>
		{/each}
	</div>

	<!-- Create section -->
	<div class="vs-nav-group">
		<p class="vs-section-title">Crear</p>
		<div class="vs-nav-section">
			{#each creatorItems as item}
				<a
					href={item.href}
					class="vs-nav-link creator {page.url.pathname === item.href ? 'active' : ''}"
				>
					<span class="material-icons-round vs-nav-icon">{item.icon}</span>
					<span class="vs-nav-label">{item.label}</span>
				</a>
			{/each}
		</div>
	</div>

	<!-- Admin -->
	{#if authStore.isAdmin}
		<div class="vs-nav-group">
			<p class="vs-section-title">Admin</p>
			<a href="/admin" class="vs-nav-link admin {page.url.pathname.startsWith('/admin') ? 'active' : ''}">
				<span class="material-icons-round vs-nav-icon">admin_panel_settings</span>
				<span class="vs-nav-label">Panel Admin</span>
			</a>
		</div>
	{/if}

	<!-- Spacer -->
	<div style="flex:1"></div>

	<!-- Bottom section -->
	<div class="vs-bottom-section">
		{#each bottomItems as item}
			<a
				href={item.href}
				class="vs-nav-link {page.url.pathname === item.href ? 'active' : ''}"
			>
				<span class="material-icons-round vs-nav-icon">{item.icon}</span>
				<span class="vs-nav-label">{item.label}</span>
			</a>
		{/each}

		<!-- User card -->
		{#if authStore.user}
			<div class="vs-user-card">
				<div class="vs-user-avatar">
					{#if authStore.user.avatar_url}
						<img src={authStore.user.avatar_url} alt={authStore.user.username} />
					{:else}
						<span class="vs-avatar-letter">
							{(authStore.user.display_name || authStore.user.username || '?')[0].toUpperCase()}
						</span>
					{/if}
					<span class="vs-online-dot"></span>
				</div>
				<div class="vs-user-info">
					<p class="vs-user-name">{authStore.user.display_name || authStore.user.username}</p>
					<p class="vs-user-handle">@{authStore.user.username}</p>
				</div>
				<button onclick={handleLogout} class="vs-logout-btn" title="Cerrar sesión">
					<span class="material-icons-round" style="font-size:17px">logout</span>
				</button>
			</div>
		{/if}
	</div>
</nav>

<style>
	/* ─── Shell ─────────────────────────────────── */
	.vs-sidenav {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-height: 100vh;
		padding: 18px 12px 16px;
		gap: 2px;

		background: var(--bg-sidebar);
		backdrop-filter: blur(24px) saturate(1.5);
		-webkit-backdrop-filter: blur(24px) saturate(1.5);
		will-change: transform;
		transform: translateZ(0);
		border-right: 1px solid var(--glass-border-t);
		box-shadow: 2px 0 20px rgba(46,134,232,0.06);

		overflow-y: auto;
		scrollbar-width: none; /* Firefox */
	}
	.vs-sidenav::-webkit-scrollbar {
		display: none; /* Chrome, Edge, Safari */
		width: 0px;
	}
	.vs-sidenav::-webkit-scrollbar-track {
		background: transparent;
	}
	.vs-sidenav::-webkit-scrollbar-thumb {
		background: transparent;
	}
	.vs-sidenav::-webkit-scrollbar-thumb:hover {
		background: var(--aero-blue);
	}

	/* ─── Logo & Toggle ─────────────────────────── */
	.vs-logo-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
		padding: 0 4px;
	}
	.vs-logo-link {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 10px;
		border-radius: var(--radius-md);
		text-decoration: none;
		transition: opacity var(--t-base);
		overflow: hidden;
	}
	.vs-logo-link:hover { opacity: 0.85; }

	.vs-collapse-btn {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		transition: background var(--t-base), color var(--t-base);
	}
	.vs-collapse-btn:hover {
		background: var(--bg-surface-hover);
		color: var(--text-primary);
	}

	.vs-logo-box {
		width: 34px; height: 34px;
		border-radius: 10px;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(46,134,232,0.35), inset 0 1px 0 rgba(255,255,255,0.35);
		transition: transform var(--t-spring), box-shadow var(--t-base);
		flex-shrink: 0;
	}
	.vs-logo-link:hover .vs-logo-box {
		transform: scale(1.08) rotate(4deg);
		box-shadow: 0 6px 18px rgba(46,134,232,0.45), inset 0 1px 0 rgba(255,255,255,0.40);
	}

	.vs-logo-text {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.12rem;
		background: var(--grad-primary);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: -0.02em;
	}

	/* ─── Nav Links ─────────────────────────────── */
	.vs-nav-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.vs-nav-link {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 9px 12px;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		text-decoration: none;
		font-weight: 500;
		font-size: 0.9rem;
		transition: background var(--t-base), color var(--t-base), transform var(--t-spring), box-shadow var(--t-base), gap var(--t-spring), padding var(--t-spring);
		border: 1px solid transparent;
		position: relative;
	}

	.vs-nav-icon-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.vs-nav-icon {
		font-size: 20px;
		transition: transform var(--t-spring);
	}
	
	.vs-badge {
		position: absolute;
		top: -5px;
		right: -10px;
		background: #ef4444; /* aero-rose or red */
		color: #fff;
		font-size: 0.60rem;
		font-weight: 800;
		font-family: var(--font-sans);
		padding: 2px 4px;
		min-width: 16px;
		text-align: center;
		border-radius: 9px;
		box-shadow: 0 2px 4px rgba(239, 68, 68, 0.4), 0 0 0 2px var(--bg-sidebar);
		z-index: 2;
		pointer-events: none;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.vs-nav-label { 
		flex: 1; 
		white-space: nowrap; 
		overflow: hidden; 
		max-width: 200px;
		opacity: 1;
		transition: max-width var(--t-spring), opacity var(--t-fast);
	}

	.vs-nav-link:hover {
		background: var(--bg-overlay);
		color: var(--aero-blue);
		border-color: var(--glass-border);
		box-shadow: var(--shadow-xs), var(--glass-inset);
	}
	.vs-nav-link:hover .vs-nav-icon {
		transform: scale(1.12) translateX(1px);
	}

	.vs-nav-link.active {
		background: var(--grad-primary);
		color: #fff;
		border-color: rgba(255,255,255,0.20);
		box-shadow: 0 4px 14px rgba(46,134,232,0.28), var(--glass-inset);
		font-weight: 600;
	}
	.vs-nav-link.active .vs-nav-icon {
		transform: scale(1.05);
	}
	/* Glossy highlight on active */
	.vs-nav-link.active::before {
		content: '';
		position: absolute;
		top: 0; left: 0; right: 0;
		height: 45%;
		background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%);
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		pointer-events: none;
	}

	/* Creator links get a mint tint on hover */
	.vs-nav-link.creator:hover {
		color: var(--aero-mint);
		background: rgba(61,199,154,0.08);
		border-color: rgba(61,199,154,0.18);
	}
	.vs-nav-link.admin:hover, .vs-nav-link.admin.active {
		background: linear-gradient(145deg, var(--aero-amber), hsl(38,80%,48%));
		color: #fff;
		border-color: rgba(255, 193, 7, 0.4);
		box-shadow: 0 4px 14px rgba(255, 193, 7, 0.25), var(--glass-inset);
	}

	.vs-active-pip {
		width: 6px; height: 6px;
		border-radius: 50%;
		background: rgba(255,255,255,0.75);
		flex-shrink: 0;
	}

	/* ─── Groups ────────────────────────────────── */
	.vs-nav-group { margin-top: 14px; }

	.vs-section-title {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin: 8px 12px;
		opacity: 0.7;
		white-space: nowrap;
		overflow: hidden;
		max-height: 20px;
		transition: max-height var(--t-spring), opacity var(--t-fast), margin var(--t-spring);
	}

	/* ─── Bottom ────────────────────────────────── */
	.vs-bottom-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
		border-top: 1px solid var(--border-subtle);
		padding-top: 12px;
		margin-top: 4px;
	}

	/* ─── User Card ─────────────────────────────── */
	.vs-user-card {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 9px 10px;
		margin-top: 8px;
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		border-top-color: var(--glass-border-t);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-xs), var(--glass-inset);
	}

	.vs-user-avatar {
		position: relative;
		flex-shrink: 0;
	}
	.vs-user-avatar img {
		width: 32px; height: 32px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid rgba(255,255,255,0.7);
	}
	.vs-avatar-letter {
		width: 32px; height: 32px;
		border-radius: 50%;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-weight: 700;
		font-size: 0.82rem;
		border: 2px solid rgba(255,255,255,0.5);
	}
	.vs-online-dot {
		position: absolute;
		bottom: 0; right: -1px;
		width: 9px; height: 9px;
		border-radius: 50%;
		background: var(--aero-mint);
		border: 2px solid var(--bg-surface);
		box-shadow: 0 0 6px rgba(61,199,154,0.5);
	}

	.vs-user-info { flex: 1; min-width: 0; }
	.vs-user-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.vs-user-handle {
		font-size: 0.70rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.vs-logout-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px; height: 30px;
		border-radius: var(--radius-sm);
		background: rgba(232,74,114,0.10);
		border: 1px solid rgba(232,74,114,0.18);
		color: var(--aero-rose);
		cursor: pointer;
		flex-shrink: 0;
		transition: background var(--t-base), box-shadow var(--t-base), transform var(--t-spring);
	}
	.vs-logout-btn:hover {
		background: var(--aero-rose);
		color: #fff;
		transform: scale(1.06);
		box-shadow: 0 4px 12px rgba(232,74,114,0.30);
	}
	/* ─── Collapsed State ───────────────────────── */
	:global(.vs-shell--collapsed) .vs-nav-label,
	:global(.vs-shell--collapsed) .vs-logo-text,
	:global(.vs-shell--collapsed) .vs-user-info,
	:global(.vs-shell--collapsed) .vs-online-dot,
	:global(.vs-shell--collapsed) .vs-logout-btn,
	:global(.vs-shell--collapsed) .vs-active-pip {
		max-width: 0;
		opacity: 0;
		pointer-events: none;
		display: none;
	}
	
	:global(.vs-shell--collapsed) .vs-section-title {
		max-height: 0;
		opacity: 0;
		margin: 0;
		overflow: hidden;
	}

	:global(.vs-shell--collapsed) .vs-logo-row {
		flex-direction: column;
		gap: 16px;
		padding: 0;
	}
	:global(.vs-shell--collapsed) .vs-logo-link {
		padding: 6px 0;
		justify-content: center;
		margin-bottom: 0;
		gap: 0;
	}
	:global(.vs-shell--collapsed) .vs-nav-link {
		justify-content: center;
		padding: 12px 0;
		gap: 0;
	}
	:global(.vs-shell--collapsed) .vs-nav-link:hover {
		transform: translateY(-2px);
	}
	:global(.vs-shell--collapsed) .vs-user-card {
		justify-content: center;
		padding: 12px 0;
		gap: 0;
	}
</style>