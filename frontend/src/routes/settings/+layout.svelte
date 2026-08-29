<script>
	import '$lib/styles/settings.css';
	import { fade } from 'svelte/transition';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { authStore } from '$lib/stores/auth.svelte.js';

	let { data, children } = $props();

	const NAV = [
		{ href: '/settings/profile', icon: 'person', label: 'Editar Perfil' },
		{ href: '/settings/design', icon: 'palette', label: 'Diseño del Perfil' },
		{ href: '/settings/algorithm', icon: 'auto_awesome', label: 'Feed y Algoritmo' },
		{ href: '/settings/privacy', icon: 'lock', label: 'Privacidad' },
		{ href: '/settings/security', icon: 'shield', label: 'Seguridad y Sesiones' },
		{ href: '/settings/blocked', icon: 'block', label: 'Usuarios Bloqueados' },
		{ href: '/settings/notifications', icon: 'notifications', label: 'Notificaciones' },
		{ href: '/settings/payments', icon: 'payments', label: 'Pagos y Enlaces' },
		{ href: '/settings/performance', icon: 'speed', label: 'Rendimiento' },
		{ href: '/settings/data', icon: 'folder_special', label: 'Mis Datos (RGPD)' }
	];

	const TEAM_ROLES = ['team', 'support', 'moderator', 'admin', 'super_admin', 'staff'];

	let isTeam = $derived(
		data.authed && (TEAM_ROLES.includes(data.user?.role) || authStore.isTeamOrHigher)
	);

	function isActive(href) {
		const path = page.url.pathname;
		if (href === '/settings') return path === '/settings';
		return path === href || path.startsWith(href + '/');
	}

	// El editor de diseño es una experiencia inmersiva a pantalla completa:
	// se renderiza fuera del contenedor/sidebar de ajustes.
	let immersive = $derived(isActive('/settings/design'));

	// Fallback cliente: si el server no pudo autenticar por cookie pero hay
	// token en localStorage (sesiones previas al mirror), se sincroniza la
	// cookie y se re-ejecutan los loads. Sin token real → login.
	$effect(() => {
		if (data.authed || typeof window === 'undefined') return;
		if (!authStore.initialized) {
			authStore.initialize();
			return;
		}
		if (authStore.loading) return;
		if (authStore.token) {
			invalidateAll();
		} else {
			goto('/login');
		}
	});
</script>

<svelte:head>
	<title>Ajustes — Voom!</title>
</svelte:head>

{#if !data.authed}
	<div class="settings-container">
		<div class="settings-layout">
			<div class="glass-card panel-card">
				<div class="panel-loading" in:fade>
					<span class="loading loading-spinner text-primary"></span>
					<span>Verificando sesión...</span>
				</div>
			</div>
		</div>
	</div>
{:else if immersive}
	{@render children()}
{:else}
	<div class="settings-container">
		<div class="settings-layout">
			<!-- Sidebar de navegación (rutas reales) -->
			<nav class="settings-sidebar glass-card" aria-label="Secciones de ajustes">
				<h2 class="sidebar-section-title">Ajustes</h2>

				<a href="/settings" class="sidebar-btn" class:active={isActive('/settings')}>
					<span class="material-icons-round">dashboard</span>
					<span>Resumen</span>
				</a>

				{#each NAV as item (item.href)}
					<a href={item.href} class="sidebar-btn" class:active={isActive(item.href)}>
						<span class="material-icons-round">{item.icon}</span>
						<span>{item.label}</span>
					</a>
				{/each}

				{#if isTeam}
					<a
						href="/studio/emotes"
						class="sidebar-btn sidebar-btn-team"
						style="text-decoration: none;"
					>
						<span class="material-icons-round" style="color: var(--aero-mint);">military_tech</span>
						<span>Estudio Emotes (EXP)</span>
					</a>
				{/if}
			</nav>

			<!-- Panel de contenido -->
			<div class="settings-content-panel">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	.sidebar-btn-team {
		margin-top: 8px;
		border-top: 1px solid var(--border-subtle);
		padding-top: 14px;
	}
</style>
