<script>
	import '../../routes/layout.css';
	import '$lib/styles/admin.css';
	import { page } from '$app/state';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';

	let { data, children } = $props();

	const staff = $derived(data.staff);
	const isAdminLevel = $derived(staff.role === 'admin' || staff.role === 'super_admin');

	// Nav filtrada por permisos (lib/server/roles.js). '*' = solo admin.
	const fullNav = [
		{ href: '/admin', icon: 'dashboard', label: 'Resumen', perm: 'dashboard.view', exact: true },
		{ href: '/admin/reports', icon: 'flag', label: 'Reportes', perm: 'reports.view' },
		{ href: '/admin/content', icon: 'grid_view', label: 'Contenido', perm: 'content.view' },
		{ href: '/admin/users', icon: 'people', label: 'Usuarios', perm: 'users.view' },
		{
			href: '/admin/verifications',
			icon: 'verified',
			label: 'Verificaciones',
			perm: 'verifications.view'
		},
		{ href: '/admin/strikes', icon: 'gavel', label: 'Sanciones', perm: 'strikes.view' },
		{ href: '/admin/team', icon: 'diversity_3', label: 'Equipo', perm: 'announcements.view' },
		{ href: '/admin/audit', icon: 'history', label: 'Auditoría', perm: '*' },
		{ href: '/admin/tags', icon: 'sell', label: 'Tags', perm: '*' },
		{
			href: '/admin/invites',
			icon: 'confirmation_number',
			label: 'Invitaciones',
			perm: 'settings.manage'
		},
		{ href: '/admin/settings', icon: 'tune', label: 'Sistema', perm: 'settings.manage' },
		{ href: '/admin/apis', icon: 'api', label: 'APIs', perm: 'settings.manage' }
	];
	const nav = $derived(
		fullNav.filter((item) =>
			item.perm === '*' ? isAdminLevel : staff.permissions.includes(item.perm)
		)
	);

	function isActive(href, exact = false) {
		if (exact) return page.url.pathname === href;
		return page.url.pathname.startsWith(href);
	}

	let drawerOpen = $state(false);

	// Hidratar el store de auth en cliente (presencia, sockets, etc.). El guard
	// de acceso ya lo resolvió el layout server — aquí no se redirige.
	$effect(() => {
		authStore.initialize();
	});

	// Cierra el drawer al navegar entre secciones.
	$effect(() => {
		page.url.pathname;
		drawerOpen = false;
	});
</script>

<div class="admin-shell">
	<!-- Botón hamburguesa (móvil) -->
	<button
		class="mobile-menu-btn"
		class:open={drawerOpen}
		onclick={() => (drawerOpen = !drawerOpen)}
		aria-label={drawerOpen ? 'Cerrar menú' : 'Abrir menú'}
		aria-expanded={drawerOpen}
	>
		<span class="material-icons-round">{drawerOpen ? 'close' : 'menu'}</span>
	</button>

	{#if drawerOpen}
		<div class="drawer-backdrop" role="presentation" onclick={() => (drawerOpen = false)}></div>
	{/if}

	<!-- ── Sidebar ──────────────────────────────────────── -->
	<aside class="admin-aside" class:drawer-open={drawerOpen}>
		<div class="aside-header">
			<a href="/feed" class="aside-back-link" title="Volver a la plataforma">
				<span class="material-icons-round">arrow_back</span>
			</a>
			<div class="aside-logo">
				<div class="aside-logo-icon">
					<span class="material-icons-round">admin_panel_settings</span>
				</div>
				<div class="aside-logo-text">
					<span class="aside-logo-title">Voom!</span>
					<span class="aside-logo-sub">{staff.title}</span>
				</div>
			</div>
		</div>

		<nav class="aside-nav" aria-label="Navegación del panel">
			{#each nav as item (item.href)}
				<a
					href={item.href}
					class="aside-nav-link"
					class:active={isActive(item.href, item.exact)}
					onclick={() => (drawerOpen = false)}
				>
					<span class="material-icons-round aside-nav-icon">{item.icon}</span>
					<span class="aside-nav-label">{item.label}</span>
					{#if isActive(item.href, item.exact)}
						<span class="aside-nav-pip"></span>
					{/if}
				</a>
			{/each}
		</nav>

		<div class="aside-footer">
			<div class="aside-user">
				<div style="flex: 0 0 44px; min-width: 44px; min-height: 44px">
					<AeroAvatar
						src={staff.avatar_url}
						alt={staff.display_name}
						size="sm"
						showPresence={false}
					/>
				</div>
				<div class="aside-user-info">
					<p class="aside-user-name">{staff.display_name}</p>
					<p class="aside-user-role" class:is-admin={isAdminLevel}>{staff.label}</p>
				</div>
				<div class="aside-user-badge" title={staff.label}>
					<span class="material-icons-round"
						>{isAdminLevel ? 'workspace_premium' : 'shield_person'}</span
					>
				</div>
			</div>
		</div>
	</aside>

	<!-- ── Main ─────────────────────────────────────────── -->
	<main class="admin-main">
		{@render children()}
	</main>
</div>

<style>
	/* ── Shell ──────────────────────────────────────────── */
	.admin-shell {
		display: flex;
		min-height: 100vh;
		background: var(--bg-canvas);
		font-family: var(--font-sans);
	}

	/* ── Botón hamburguesa (solo móvil) ─────────────────── */
	.mobile-menu-btn {
		display: none;
		position: fixed;
		top: 14px;
		left: 14px;
		z-index: calc(var(--z-modal-backdrop, 500) + 20);
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		border: 1px solid var(--glass-border);
		background: var(--bg-surface);
		color: var(--text-primary);
		cursor: pointer;
		align-items: center;
		justify-content: center;
		box-shadow: var(--shadow-md);
	}
	.mobile-menu-btn .material-icons-round {
		font-size: 21px;
	}

	.drawer-backdrop {
		display: none;
	}

	/* ── Sidebar ───────────────────────────────────────── */
	.admin-aside {
		width: 248px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: var(--glass-bg);
		backdrop-filter: blur(28px) saturate(1.6);
		-webkit-backdrop-filter: blur(28px) saturate(1.6);
		border-right: 1px solid var(--glass-border);
		box-shadow: 2px 0 24px rgba(46, 134, 232, 0.07);
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-y: auto;
		scrollbar-width: none;
		padding: 20px 12px 16px;
		gap: 4px;
	}
	.admin-aside::-webkit-scrollbar {
		display: none;
	}

	/* Header */
	.aside-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 24px;
		padding: 0 4px;
	}

	.aside-back-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
		text-decoration: none;
		flex-shrink: 0;
		transition: all var(--t-base);
	}
	.aside-back-link .material-icons-round {
		font-size: 16px;
	}
	.aside-back-link:hover {
		background: var(--grad-primary);
		color: #fff;
		border-color: transparent;
		transform: translateX(-2px);
	}

	.aside-logo {
		display: flex;
		align-items: center;
		gap: 9px;
		flex: 1;
		min-width: 0;
	}
	.aside-logo-icon {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		flex-shrink: 0;
		box-shadow:
			0 4px 12px rgba(46, 134, 232, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.35);
	}
	.aside-logo-icon .material-icons-round {
		font-size: 17px;
	}
	.aside-logo-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.aside-logo-title {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 0.98rem;
		background: var(--grad-primary);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.aside-logo-sub {
		font-size: 0.62rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.07em;
		line-height: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Nav */
	.aside-nav {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex: 1;
	}

	.aside-nav-link {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 12px;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		text-decoration: none;
		font-weight: 500;
		font-size: 0.88rem;
		border: 1px solid transparent;
		position: relative;
		overflow: hidden;
		transition:
			background var(--t-base),
			color var(--t-base),
			border-color var(--t-base),
			box-shadow var(--t-base),
			transform var(--t-spring);
	}
	.aside-nav-icon {
		font-size: 19px;
		flex-shrink: 0;
		transition: transform var(--t-spring);
	}
	.aside-nav-label {
		flex: 1;
	}

	.aside-nav-link:hover {
		background: var(--bg-overlay);
		color: var(--aero-blue);
		border-color: var(--glass-border);
		box-shadow: var(--shadow-xs), var(--glass-inset);
	}
	.aside-nav-link:hover .aside-nav-icon {
		transform: scale(1.12) translateX(1px);
	}

	.aside-nav-link.active {
		background: var(--grad-primary);
		color: #fff;
		border-color: rgba(255, 255, 255, 0.22);
		box-shadow:
			0 4px 14px rgba(46, 134, 232, 0.28),
			var(--glass-inset);
		font-weight: 600;
	}
	.aside-nav-link.active .aside-nav-icon {
		transform: scale(1.05);
	}
	/* Glossy highlight on active */
	.aside-nav-link.active::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 45%;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, transparent 100%);
		border-radius: var(--radius-md) var(--radius-md) var(--radius-xs) var(--radius-xs);
		pointer-events: none;
	}

	.aside-nav-pip {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.75);
		flex-shrink: 0;
	}

	/* Footer / User Card */
	.aside-footer {
		border-top: 1px solid var(--border-subtle);
		padding-top: 12px;
		margin-top: 8px;
	}
	.aside-user {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 9px 10px;
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-xs), var(--glass-inset);
	}
	.aside-user-info {
		flex: 1;
		min-width: 0;
	}
	.aside-user-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: 0;
	}
	.aside-user-role {
		font-size: 0.66rem;
		color: var(--aero-sky);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 0;
	}
	.aside-user-role.is-admin {
		color: var(--badge-admin, var(--aero-amber));
	}
	.aside-user-badge .material-icons-round {
		font-size: 16px;
		color: var(--aero-sky);
	}
	.aside-user-badge[title='Administrador'] .material-icons-round,
	.aside-user-badge[title='Super Admin'] .material-icons-round {
		color: var(--badge-admin, var(--aero-amber));
	}

	/* ── Main Content ──────────────────────────────────── */
	.admin-main {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		min-height: 100vh;
	}

	/* ── Responsive: drawer móvil ──────────────────────── */
	@media (max-width: 768px) {
		.mobile-menu-btn {
			display: flex;
		}
		.admin-aside {
			position: fixed;
			left: 0;
			top: 0;
			bottom: 0;
			z-index: calc(var(--z-modal-backdrop, 500) + 10);
			transform: translateX(-105%);
			transition: transform var(--t-base) var(--ease-smooth);
			box-shadow: var(--shadow-lg);
		}
		.admin-aside.drawer-open {
			transform: translateX(0);
		}
		.drawer-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			z-index: calc(var(--z-modal-backdrop, 500) + 5);
			background: rgba(8, 12, 24, 0.5);
			backdrop-filter: blur(4px);
			-webkit-backdrop-filter: blur(4px);
		}
	}
</style>
