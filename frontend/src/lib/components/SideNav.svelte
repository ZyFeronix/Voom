<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { uiStore } from '$lib/stores/ui.svelte.js';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';
	import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';
	import { slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';

	const parseBool = (val) => val !== '0' && val !== false && val !== 'false';
	const settings = $derived(page.data.globalSettings || {});

	const navItems = $derived(
		[
			{ href: '/feed', icon: 'home', label: 'Inicio', show: true },
			{ href: '/explore', icon: 'explore', label: 'Explorar', show: true },
			{
				href: '/reels',
				icon: 'play_circle',
				label: 'Reels',
				show: parseBool(settings.reels_enabled)
			},
			{
				href: '/messages',
				icon: 'chat_bubble',
				label: 'Mensajes',
				show: true,
				badge: () => notificationsStore.unreadMessageCount
			},
			{
				href: '/notifications',
				icon: 'notifications',
				label: 'Notificaciones',
				show: true,
				badge: () => notificationsStore.unreadCount
			},
			{
				href: '/marketplace',
				icon: 'storefront',
				label: 'Marketplace',
				show: parseBool(settings.marketplace_enabled)
			},
			{
				href: '/leaderboard',
				icon: 'emoji_events',
				label: 'Ranking',
				show: parseBool(settings.gamification_enabled)
			}
		].filter((i) => i.show)
	);

	const creatorItems = $derived(
		[
			{ href: '/posts/create', icon: 'post_add', label: 'Nuevo Post', show: true },
			{
				href: '/stories/create',
				icon: 'auto_stories',
				label: 'Historia',
				show: parseBool(settings.stories_enabled)
			},
			{
				href: '/reels/create',
				icon: 'video_call',
				label: 'Nuevo Reel',
				show: parseBool(settings.reels_enabled)
			}
		].filter((i) => i.show)
	);

	const profileUrl = $derived(
		authStore.user?.username ? `/u/${authStore.user.username}` : '/login'
	);

	const xpForLevel = (lv) => (lv <= 1 ? 0 : Math.pow(lv - 1, 2) * 100);
	const levelProgress = $derived.by(() => {
		const lv = authStore.user?.level || 1;
		const xp = authStore.user?.xp_points || 0;
		const cur = xpForLevel(lv);
		const next = xpForLevel(lv + 1);
		return next > cur ? Math.min(1, Math.max(0, (xp - cur) / (next - cur))) : 1;
	});

	async function handleLogout() {
		await authStore.logout();
		goto('/');
	}

	function isActive(href) {
		const path = page.url.pathname;
		// Excepción: /reels no activo cuando se está creando un reel
		if (href === '/reels' && path === '/reels/create') return false;
		// /feed solo activo en exacto /feed
		if (href === '/feed') return path === '/feed';
		// Match de segmento: href debe ser exacto o seguido de '/' para evitar
		// colisiones como /m → /messages vs /marketplace
		return path === href || path.startsWith(href + '/');
	}
</script>

<nav class="vs-sidenav" aria-label="Navegación principal">
	<!-- ══ MARCA ══ -->
	<div class="vs-brand">
		<a href="/feed" class="vs-brand__logo" title="VSocial">
			<div class="vs-brand__icon">
				<span class="material-icons-round">hub</span>
			</div>
			<div class="vs-brand__text">
				<span class="vs-brand__name">VSocial</span>
				<span class="vs-brand__tagline">Virtual Network</span>
			</div>
		</a>
		<button
			class="vs-brand__toggle"
			onclick={() => uiStore.toggleSidebar()}
			title={uiStore.sidebarExpanded ? 'Colapsar' : 'Expandir'}
			aria-label={uiStore.sidebarExpanded ? 'Colapsar barra lateral' : 'Expandir barra lateral'}
		>
			<span class="material-icons-round">
				{uiStore.sidebarExpanded ? 'menu_open' : 'menu'}
			</span>
		</button>
	</div>

	<!-- ══ NAVEGACIÓN PRINCIPAL ══ -->
	<div class="vs-nav-body">
		<div class="vs-nav-section">
			<span class="vs-nav-section__label">Navegación</span>
			<ul class="vs-nav-list" role="list">
				{#each navItems as item (item.href)}
					{@const badgeCount = item.badge ? item.badge() : 0}
					<li
						transition:slide={{ duration: 200, easing: cubicOut }}
						animate:flip={{ duration: 200, easing: cubicOut }}
					>
						<a
							href={item.href}
							class="vs-nav-item"
							class:vs-nav-item--active={isActive(item.href)}
							title={item.label}
							aria-current={isActive(item.href) ? 'page' : undefined}
						>
							<div class="vs-nav-item__icon">
								<span class="material-icons-round">{item.icon}</span>
								{#if badgeCount > 0}
									<span class="vs-nav-item__badge" aria-label="{badgeCount} sin leer">
										{badgeCount > 99 ? '99+' : badgeCount}
									</span>
								{/if}
							</div>
							<span class="vs-nav-item__label">{item.label}</span>
							{#if badgeCount > 0 && !isActive(item.href)}
								<span class="vs-nav-item__count">{badgeCount > 99 ? '+99' : badgeCount}</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</div>

		<!-- ══ CREAR ══ -->
		<div class="vs-nav-section vs-nav-section--create">
			<span class="vs-nav-section__label">Crear</span>
			<ul class="vs-nav-list" role="list">
				{#each creatorItems as item (item.href)}
					<li>
						<a
							href={item.href}
							class="vs-nav-item"
							class:vs-nav-item--active={page.url.pathname === item.href}
							title={item.label}
						>
							<div class="vs-nav-item__icon">
								<span class="material-icons-round">{item.icon}</span>
							</div>
							<span class="vs-nav-item__label">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>

		<!-- ══ EQUIPO V-SOCIAL / EXP ══ -->
		{#if authStore.isTeamOrHigher}
			<div class="vs-nav-section vs-nav-section--team">
				<span class="vs-nav-section__label">Equipo</span>
				<ul class="vs-nav-list" role="list">
					<li>
						<a
							href="/studio/emotes"
							class="vs-nav-item"
							class:vs-nav-item--active={page.url.pathname === '/studio/emotes'}
							title="Estudio de Emotes y Stickers (Experimental)"
						>
							<div class="vs-nav-item__icon" style="color: var(--aero-mint);">
								<span class="material-icons-round">military_tech</span>
							</div>
							<span class="vs-nav-item__label">Estudio Emotes</span>
						</a>
					</li>
				</ul>
			</div>
		{/if}

		<!-- ══ ADMIN ══ -->
		{#if authStore.isAdmin}
			<div class="vs-nav-section vs-nav-section--admin">
				<span class="vs-nav-section__label">Admin</span>
				<ul class="vs-nav-list" role="list">
					<li>
						<a
							href="/admin"
							class="vs-nav-item"
							class:vs-nav-item--active={page.url.pathname.startsWith('/admin')}
							title="Panel de Administración"
						>
							<div class="vs-nav-item__icon">
								<span class="material-icons-round">admin_panel_settings</span>
							</div>
							<span class="vs-nav-item__label">Panel Admin</span>
						</a>
					</li>
				</ul>
			</div>
		{/if}
	</div>

	<!-- ══ PIE ══ -->
	<div class="vs-footer">
		<a
			href="/settings"
			class="vs-nav-item vs-footer__settings"
			class:vs-nav-item--active={page.url.pathname === '/settings'}
			title="Ajustes"
		>
			<div class="vs-nav-item__icon">
				<span class="material-icons-round">settings</span>
			</div>
			<span class="vs-nav-item__label">Ajustes</span>
		</a>

		{#if authStore.user}
			<div class="vs-user-card">
				<a href={profileUrl} class="vs-user-card__link" title="Ver mi perfil">
					<AeroAvatar
						src={authStore.user.avatar_url}
						alt={authStore.user.username}
						size="md"
						online={authStore.user.custom_status === 'online' || !authStore.user.custom_status}
						away={authStore.user.custom_status === 'away'}
						busy={authStore.user.custom_status === 'busy'}
						isVtuber={authStore.user.is_virtual}
					/>
					<div class="vs-user-card__info">
						<div class="vs-user-card__row">
							<span class="vs-user-card__name"
								>{authStore.user.display_name || authStore.user.username}</span
							>
							{#if authStore.user.level != null}
								<LevelBadge level={authStore.user.level} size="sm" showText={false} />
							{/if}
						</div>
						<span class="vs-user-card__handle">@{authStore.user.username}</span>
						{#if authStore.user.level != null}
							<div
								class="vs-user-card__xp"
								aria-hidden="true"
								title="{Math.round(levelProgress * 100)}% hacia el nivel {(authStore.user.level ||
									1) + 1}"
							>
								<div class="vs-user-card__xp-fill" style="width: {levelProgress * 100}%"></div>
							</div>
						{/if}
					</div>
				</a>
				<button
					class="vs-user-card__logout"
					onclick={handleLogout}
					title="Cerrar sesión"
					aria-label="Cerrar sesión"
				>
					<span class="material-icons-round">logout</span>
				</button>
			</div>
		{/if}
	</div>
</nav>

<style>
	/* ═══════════════════════════════════════════════════════
	   SIDENAV — Glassmorphism 2.0 + Neo-Aero
	   El sidebar es una hoja de cristal verticalizada.
	   Todos los tamaños usan tokens del sistema de diseño.
	═══════════════════════════════════════════════════════ */

	.vs-sidenav {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 100vh;
		padding: 16px 10px 14px;
		gap: 0;
		/* Superficie de cristal */
		background: var(--bg-sidebar);
		backdrop-filter: blur(14px) saturate(1.1);
		-webkit-backdrop-filter: blur(14px) saturate(1.1);
		/* Borde separador derecho */
		border-right: 1px solid var(--border-subtle);
		/* Aceleración GPU */
		will-change: transform;
		transform: translateZ(0);
		contain: layout style;
		position: relative;
		box-sizing: border-box;
		user-select: none;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
	}
	.vs-sidenav::-webkit-scrollbar {
		display: none;
	}

	/* Textura sutil anti-banding */
	.vs-sidenav::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--noise-texture);
		opacity: 0.025;
		pointer-events: none;
		z-index: 0;
	}

	/* Línea especular en el borde derecho (efecto cristal) */
	.vs-sidenav::after {
		content: '';
		position: absolute;
		top: 20px;
		right: 0;
		bottom: 20px;
		width: 1px;
		background: linear-gradient(
			180deg,
			transparent 0%,
			rgba(255, 255, 255, 0.2) 25%,
			rgba(255, 255, 255, 0.08) 75%,
			transparent 100%
		);
		pointer-events: none;
	}

	/* Todo el contenido por encima del ruido */
	.vs-sidenav > * {
		position: relative;
		z-index: 1;
	}

	/* ─── MARCA ──────────────────────────────────────────── */
	.vs-brand {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 4px 14px;
		margin-bottom: 8px;
		border-bottom: 1px solid var(--border-subtle);
		flex-shrink: 0;
	}

	.vs-brand__logo {
		display: flex;
		align-items: center;
		gap: 9px;
		text-decoration: none;
		border-radius: var(--radius-md);
		padding: 4px 6px 4px 4px;
		min-width: 0;
		transition: opacity var(--t-base);
	}
	.vs-brand__logo:hover {
		opacity: 0.85;
	}

	.vs-brand__icon {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		/* Volumen Neo-Aero */
		box-shadow:
			0 4px 14px rgba(27, 133, 243, 0.38),
			inset 0 1px 0 rgba(255, 255, 255, 0.55),
			inset 0 -1px 0 rgba(0, 0, 0, 0.12);
		position: relative;
		overflow: hidden;
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base);
	}
	/* Destello especular superior */
	.vs-brand__icon::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 50%;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, transparent 100%);
		border-radius: inherit;
	}
	.vs-brand__icon .material-icons-round {
		font-size: 19px;
		color: #fff;
		position: relative;
		z-index: 1;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
	}
	.vs-brand__logo:hover .vs-brand__icon {
		transform: scale(1.07) rotate(3deg);
		box-shadow:
			0 6px 18px rgba(27, 133, 243, 0.48),
			inset 0 1px 0 rgba(255, 255, 255, 0.65);
	}

	.vs-brand__text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		transition:
			opacity var(--t-fast),
			max-width var(--t-spring);
		overflow: hidden;
	}
	.vs-brand__name {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.1rem;
		letter-spacing: -0.03em;
		background: var(--grad-primary);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		line-height: 1.1;
		white-space: nowrap;
	}
	.vs-brand__tagline {
		font-size: 0.58rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--text-muted);
		opacity: 0.65;
		white-space: nowrap;
	}

	.vs-brand__toggle {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: var(--radius-sm);
		background: transparent;
		border: 1px solid transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background var(--t-base),
			border-color var(--t-base),
			color var(--t-base),
			transform var(--t-spring);
	}
	.vs-brand__toggle .material-icons-round {
		font-size: 18px;
	}
	.vs-brand__toggle:hover {
		background: var(--bg-surface-hover);
		border-color: var(--border-subtle);
		color: var(--text-primary);
		transform: scale(1.06);
	}
	.vs-brand__toggle:active {
		transform: scale(0.94);
	}

	/* ─── CUERPO DE NAVEGACIÓN ───────────────────────────── */
	.vs-nav-body {
		flex: 1 1 0%;
		display: flex;
		flex-direction: column;
		gap: 20px;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
		padding: 2px 0 8px;
	}
	.vs-nav-body::-webkit-scrollbar {
		display: none;
	}

	/* ─── SECCIONES CON ETIQUETA ─────────────────────────── */
	.vs-nav-section {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.vs-nav-section__label {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		opacity: 0.6;
		padding: 0 12px;
		margin-bottom: 2px;
		white-space: nowrap;
		overflow: hidden;
		transition:
			opacity var(--t-fast),
			max-height var(--t-spring);
	}

	.vs-nav-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	/* ─── ITEM DE NAVEGACIÓN ─────────────────────────────── */
	.vs-nav-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 10px;
		border-radius: var(--radius-md);
		min-height: 40px;
		text-decoration: none;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		letter-spacing: -0.01em;
		border: 1px solid transparent;
		position: relative;
		box-sizing: border-box;
		transition:
			color var(--t-base),
			background var(--t-base),
			border-color var(--t-base),
			transform var(--t-spring),
			box-shadow var(--t-base);
	}

	/* Ícono contenedor */
	.vs-nav-item__icon {
		flex-shrink: 0;
		position: relative;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.vs-nav-item__icon .material-icons-round {
		font-size: 20px;
		transition:
			transform var(--t-spring),
			color var(--t-base);
	}

	.vs-nav-item__label {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition:
			opacity var(--t-fast),
			max-width var(--t-spring);
	}

	/* Contador de notificaciones inline (expandido) */
	.vs-nav-item__count {
		flex-shrink: 0;
		font-size: 0.68rem;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: var(--radius-full);
		background: rgba(236, 72, 153, 0.12);
		color: var(--aero-rose);
		border: 1px solid rgba(236, 72, 153, 0.25);
		line-height: 1.5;
		letter-spacing: 0;
		transition:
			opacity var(--t-fast),
			max-width var(--t-spring);
	}

	/* Burbuja de badge sobre el ícono (modo colapsado / siempre visible) */
	.vs-nav-item__badge {
		position: absolute;
		top: -5px;
		right: -7px;
		min-width: 16px;
		height: 16px;
		padding: 0 3px;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, #ff2d55 0%, #ec4899 100%);
		color: #fff;
		font-size: 0.6rem;
		font-weight: 800;
		line-height: 16px;
		text-align: center;
		box-shadow:
			0 2px 6px rgba(255, 45, 85, 0.45),
			0 0 0 2px var(--bg-sidebar);
		pointer-events: none;
		z-index: 2;
	}

	/* — HOVER — */
	.vs-nav-item:hover {
		color: var(--accent-blue-base);
		background: var(--bg-surface-hover);
		border-color: var(--border-subtle);
		transform: translateX(2px);
	}
	.vs-nav-item:hover .vs-nav-item__icon .material-icons-round {
		transform: scale(1.1);
	}

	/* — ACTIVO — */
	.vs-nav-item--active {
		color: #fff;
		font-weight: 650;
		background: var(--grad-primary);
		border-color: rgba(255, 255, 255, 0.25);
		box-shadow:
			0 4px 16px rgba(27, 133, 243, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.35);
	}
	.vs-nav-item--active::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: var(--radius-md);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 55%);
		pointer-events: none;
	}
	.vs-nav-item--active .vs-nav-item__icon .material-icons-round {
		color: #fff;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
		transform: scale(1.05);
	}
	.vs-nav-item--active:hover {
		transform: none;
		box-shadow:
			0 6px 20px rgba(27, 133, 243, 0.38),
			inset 0 1px 0 rgba(255, 255, 255, 0.4);
	}

	/* Divider visual entre secciones distintas */
	.vs-nav-section--create {
		padding-top: 4px;
	}
	.vs-nav-section--admin {
		padding-top: 4px;
	}

	/* ─── PIE ────────────────────────────────────────────── */
	.vs-footer {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 10px;
		margin-top: auto;
		border-top: 1px solid var(--border-subtle);
		flex-shrink: 0;
	}

	/* ─── TARJETA DE USUARIO ───────────────────────────────
	   Aero ID: chip squircle con borde degradado (mismo patrón
	   que el logo y el beacon del leaderboard), línea especular
	   superior y barrido de brillo al hover. El nivel reutiliza
	   LevelBadge para heredar los tiers del resto de la app. */
	.vs-user-card {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 9px 9px 9px 10px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		border: 1.5px solid transparent;
		background:
			linear-gradient(var(--bg-surface), var(--bg-surface)) padding-box,
			linear-gradient(
					135deg,
					color-mix(in srgb, var(--aero-sky) 55%, transparent),
					color-mix(in srgb, #fff 18%, transparent) 38%,
					color-mix(in srgb, var(--aero-mint) 34%, transparent) 72%,
					color-mix(in srgb, var(--aero-sky) 45%, transparent)
				)
				border-box;
		box-shadow:
			var(--glass-inset-highlight),
			0 6px 18px color-mix(in srgb, var(--aero-blue) 12%, transparent);
		transition:
			box-shadow var(--t-base),
			transform var(--t-spring);
		overflow: hidden;
		box-sizing: border-box;
		position: relative;
	}
	/* Línea especular superior (firma Aero) */
	.vs-user-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 12%;
		right: 12%;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.4) 50%,
			transparent 100%
		);
		opacity: 0.7;
		transition: opacity var(--t-base);
		pointer-events: none;
	}
	/* Barrido de brillo que cruza la tarjeta al hover */
	.vs-user-card::after {
		content: '';
		position: absolute;
		top: -20%;
		bottom: -20%;
		left: 0;
		width: 42%;
		background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.16), transparent);
		transform: translateX(-180%) skewX(-15deg);
		opacity: 0;
		transition:
			transform 0.65s var(--ease-smooth),
			opacity 0.25s ease;
		pointer-events: none;
	}
	.vs-user-card:hover {
		transform: translateY(-1px);
		box-shadow:
			var(--glass-inset-highlight),
			0 8px 24px color-mix(in srgb, var(--aero-blue) 22%, transparent);
	}
	.vs-user-card:hover::before {
		opacity: 1;
	}
	.vs-user-card:hover::after {
		transform: translateX(340%) skewX(-15deg);
		opacity: 1;
	}

	.vs-user-card__link {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
		text-decoration: none;
		border-radius: var(--radius-sm);
		transition: transform 0.2s var(--ease-out);
	}
	.vs-user-card__link:active {
		transform: scale(0.97);
	}
	.vs-user-card__link:focus-visible {
		outline: 2px solid var(--aero-sky);
		outline-offset: 2px;
	}

	.vs-user-card__info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.vs-user-card__row {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.vs-user-card__name {
		flex: 1;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.83rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: 0.01em;
	}

	.vs-user-card__handle {
		font-size: 0.68rem;
		font-weight: 400;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		opacity: 0.85;
	}

	/* Barra de XP con punta luminosa al hover */
	.vs-user-card__xp {
		position: relative;
		margin-top: 3px;
		height: 4px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--text-primary) 10%, transparent);
		box-shadow: inset 0 1px 2px color-mix(in srgb, #000 14%, transparent);
	}
	.vs-user-card__xp-fill {
		position: relative;
		height: 100%;
		border-radius: var(--radius-full);
		background: var(--grad-primary);
		box-shadow: 0 0 8px color-mix(in srgb, var(--aero-sky) 45%, transparent);
		transition: width var(--t-slow);
	}
	.vs-user-card__xp-fill::after {
		content: '';
		position: absolute;
		right: -2px;
		top: 50%;
		width: 8px;
		height: 8px;
		transform: translateY(-50%) scale(0.4);
		border-radius: var(--radius-full);
		background: #fff;
		box-shadow:
			0 0 6px var(--aero-sky),
			0 0 14px color-mix(in srgb, var(--aero-sky) 65%, transparent);
		opacity: 0;
		transition:
			opacity var(--t-base),
			transform var(--t-spring);
	}
	.vs-user-card:hover .vs-user-card__xp-fill::after {
		opacity: 1;
		transform: translateY(-50%) scale(1);
	}

	/* Botón de logout */
	.vs-user-card__logout {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-full);
		background: transparent;
		border: 1px solid transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background var(--t-base),
			border-color var(--t-base),
			color var(--t-base),
			transform var(--t-spring),
			box-shadow var(--t-base);
	}
	.vs-user-card__logout .material-icons-round {
		font-size: 17px;
	}
	.vs-user-card__logout:hover {
		background: rgba(var(--aero-rose-rgb), 0.15);
		border-color: rgba(var(--aero-rose-rgb), 0.35);
		color: var(--aero-rose);
		transform: scale(1.08);
		box-shadow: 0 4px 12px rgba(var(--aero-rose-rgb), 0.25);
	}
	.vs-user-card__logout:focus-visible {
		outline: 2px solid var(--aero-rose);
		outline-offset: 2px;
	}
	.vs-user-card__logout:active {
		transform: scale(0.92);
	}

	/* ─── ESTADO COLAPSADO (.vs-shell--collapsed) ─────────── */
	:global(.vs-shell--collapsed) .vs-sidenav {
		padding: 16px 8px 14px;
		align-items: center;
	}

	/* Ocultar todo lo textual */
	:global(.vs-shell--collapsed) .vs-brand__text,
	:global(.vs-shell--collapsed) .vs-nav-section__label,
	:global(.vs-shell--collapsed) .vs-nav-item__label,
	:global(.vs-shell--collapsed) .vs-nav-item__count,
	:global(.vs-shell--collapsed) .vs-user-card__info,
	:global(.vs-shell--collapsed) .vs-user-card__logout {
		display: none !important;
	}

	/* Logo centrado */
	:global(.vs-shell--collapsed) .vs-brand {
		flex-direction: column;
		gap: 8px;
		padding-bottom: 12px;
		width: 100%;
		align-items: center;
	}
	:global(.vs-shell--collapsed) .vs-brand__logo {
		padding: 4px;
		gap: 0;
		justify-content: center;
	}
	:global(.vs-shell--collapsed) .vs-brand__toggle {
		/* El toggle aún está visible */
	}

	/* Items de navegación centrados */
	:global(.vs-shell--collapsed) .vs-nav-body {
		width: 100%;
		align-items: center;
	}
	:global(.vs-shell--collapsed) .vs-nav-section {
		width: 100%;
		align-items: center;
	}
	:global(.vs-shell--collapsed) .vs-nav-list {
		width: 100%;
		align-items: center;
	}
	:global(.vs-shell--collapsed) .vs-nav-item {
		width: 44px;
		height: 44px;
		min-height: 44px;
		padding: 0;
		justify-content: center;
		gap: 0;
		margin: 0;
	}
	:global(.vs-shell--collapsed) .vs-nav-item__icon {
		width: 44px;
		height: 44px;
	}
	:global(.vs-shell--collapsed) .vs-nav-item:hover {
		transform: translateY(-2px);
	}

	/* Footer colapsado */
	:global(.vs-shell--collapsed) .vs-footer {
		width: 100%;
		align-items: center;
	}
	:global(.vs-shell--collapsed) .vs-footer__settings {
		width: 44px;
		height: 44px;
		min-height: 44px;
		padding: 0;
		justify-content: center;
		gap: 0;
	}
	:global(.vs-shell--collapsed) .vs-footer__settings .vs-nav-item__icon {
		width: 44px;
		height: 44px;
	}

	/* Tarjeta de usuario colapsada: solo avatar */
	:global(.vs-shell--collapsed) .vs-user-card {
		background: transparent;
		border-color: transparent;
		box-shadow: none;
		padding: 4px 0;
		justify-content: center;
		gap: 0;
	}
	:global(.vs-shell--collapsed) .vs-user-card::before {
		display: none;
	}
	:global(.vs-shell--collapsed) .vs-user-card:hover {
		background: transparent;
		border-color: transparent;
		box-shadow: none;
		transform: none;
	}
	:global(.vs-shell--collapsed) .vs-user-card__link {
		flex: none;
		gap: 0;
	}

	/* Móvil: reducir blur para rendimiento GPU */
	@media (max-width: 768px) {
		.vs-sidenav {
			backdrop-filter: blur(10px);
			-webkit-backdrop-filter: blur(10px);
		}
	}
</style>
