<script>
	import { onMount } from 'svelte';
	import { admin } from '$lib/api.js';

	let { data } = $props();
	const staff = $derived(data.staff);
	const isAdminLevel = $derived(staff.role === 'admin' || staff.role === 'super_admin');

	let loading = $state(true);
	let loadError = $state('');
	let stats = $state(null);
	let recentReports = $state([]);
	let weeklySignups = $state([]);
	let announcements = $state([]);

	async function loadDashboard() {
		loading = true;
		loadError = '';
		try {
			const res = await admin.dashboard();
			stats = res.stats;
			recentReports = res.recent_reports || [];
			weeklySignups = res.weekly_signups || [];
			announcements = res.announcements || [];
		} catch (e) {
			loadError = e?.message || 'No se pudo cargar el resumen del panel.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadDashboard();
	});

	function timeAgo(dateStr) {
		if (!dateStr) return '';
		const raw = String(dateStr).trim();
		const iso = (raw.includes('T') ? raw : raw.replace(' ', 'T')).replace(/Z?$/, 'Z');
		const diff = Date.now() - new Date(iso).getTime();
		if (Number.isNaN(diff)) return '';
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'ahora mismo';
		if (mins < 60) return `hace ${mins} min`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `hace ${hours} h`;
		const days = Math.floor(hours / 24);
		if (days < 30) return `hace ${days} d`;
		return new Date(iso).toLocaleDateString('es-ES');
	}

	const ENTITY_LABELS = { post: 'Post', comment: 'Comentario', reel: 'Reel', user: 'Usuario' };

	// Accesos rápidos según los permisos reales del rol ('*' = solo admin).
	const QUICK_LINKS = [
		{
			href: '/admin/reports',
			icon: 'flag',
			label: 'Reportes',
			desc: 'Centro de confianza',
			perm: 'reports.view'
		},
		{
			href: '/admin/verifications',
			icon: 'verified',
			label: 'Verificaciones',
			desc: 'Solicitudes de insignia',
			perm: 'verifications.view'
		},
		{
			href: '/admin/users',
			icon: 'people',
			label: 'Usuarios',
			desc: 'Buscar y consultar fichas',
			perm: 'users.view'
		},
		{
			href: '/admin/content',
			icon: 'grid_view',
			label: 'Contenido',
			desc: 'Posts, reels y papelera',
			perm: 'content.view'
		},
		{
			href: '/admin/strikes',
			icon: 'gavel',
			label: 'Sanciones',
			desc: 'Historial disciplinario',
			perm: 'strikes.view'
		},
		{
			href: '/admin/team',
			icon: 'diversity_3',
			label: 'Equipo',
			desc: 'Anuncios internos',
			perm: 'announcements.view'
		},
		{
			href: '/admin/audit',
			icon: 'history',
			label: 'Auditoría',
			desc: 'Trazabilidad de acciones',
			perm: '*'
		},
		{
			href: '/admin/tags',
			icon: 'sell',
			label: 'Tags',
			desc: 'Etiquetas y temas',
			perm: '*'
		},
		{
			href: '/admin/settings',
			icon: 'tune',
			label: 'Sistema',
			desc: 'Configuración global',
			perm: 'settings.manage'
		},
		{
			href: '/admin/apis',
			icon: 'api',
			label: 'APIs',
			desc: 'Integraciones externas',
			perm: 'settings.manage'
		},
		{
			href: '/studio/emotes',
			icon: 'mood',
			label: 'Estudio Emotes',
			desc: 'Emotes y stickers',
			perm: 'announcements.view'
		}
	];
	const quickLinks = $derived(
		QUICK_LINKS.filter((l) => (l.perm === '*' ? isAdminLevel : staff.permissions.includes(l.perm)))
	);

	const maxWeekly = $derived(Math.max(1, ...weeklySignups.map((d) => d.count)));
	const WEEK_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
</script>

<svelte:head>
	<title>{staff.title} | Voom!</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">
		<span class="material-icons-round"
			>{isAdminLevel ? 'admin_panel_settings' : 'shield_person'}</span
		>
		{staff.title}
	</h1>
	<p class="page-subtitle">
		Hola, {staff.display_name} · sesión con rango {staff.label.toLowerCase()}
	</p>
</div>

<div class="page-content">
	{#if loadError}
		<div class="alert-box error" role="alert">
			<span class="material-icons-round">error</span>
			<span style="flex:1">{loadError}</span>
			<button class="btn-aero-secondary btn-sm" onclick={loadDashboard}>Reintentar</button>
		</div>
	{/if}

	{#if loading}
		<div class="metric-grid">
			{#each Array(4) as _, i (i)}
				<div class="glass-card metric-card">
					<div class="skeleton-shimmer" style="width:100%;height:44px;"></div>
				</div>
			{/each}
		</div>
		<div class="skeleton-shimmer skeleton-card"></div>
	{:else if stats}
		<!-- ══ KPIs por rol ══ -->
		<div class="metric-grid">
			{#if isAdminLevel}
				<a class="glass-card metric-card" href="/admin/users">
					<div class="metric-icon"><span class="material-icons-round">people</span></div>
					<div>
						<div class="metric-value">{stats.total_users ?? 0}</div>
						<div class="metric-label">Usuarios</div>
					</div>
				</a>
				<a class="glass-card metric-card" href="/admin/content">
					<div class="metric-icon is-mint"><span class="material-icons-round">grid_view</span></div>
					<div>
						<div class="metric-value">{stats.total_posts ?? 0}</div>
						<div class="metric-label">Posts</div>
					</div>
				</a>
				<a class="glass-card metric-card" href="/admin/content">
					<div class="metric-icon is-mint"><span class="material-icons-round">movie</span></div>
					<div>
						<div class="metric-value">{stats.total_reels ?? 0}</div>
						<div class="metric-label">Reels</div>
					</div>
				</a>
				<a class="glass-card metric-card" href="/admin/reports">
					<div class="metric-icon is-rose"><span class="material-icons-round">flag</span></div>
					<div>
						<div class="metric-value">{stats.pending_reports ?? 0}</div>
						<div class="metric-label">Reportes pendientes</div>
					</div>
				</a>
				<a class="glass-card metric-card" href="/admin/verifications">
					<div class="metric-icon is-amber"><span class="material-icons-round">verified</span></div>
					<div>
						<div class="metric-value">{stats.pending_verifications ?? 0}</div>
						<div class="metric-label">Verificaciones</div>
					</div>
				</a>
				<a class="glass-card metric-card" href="/admin/strikes">
					<div class="metric-icon is-rose"><span class="material-icons-round">gavel</span></div>
					<div>
						<div class="metric-value">{stats.active_strikes ?? 0}</div>
						<div class="metric-label">Sanciones activas</div>
					</div>
				</a>
				<div class="glass-card metric-card">
					<div class="metric-icon"><span class="material-icons-round">diversity_3</span></div>
					<div>
						<div class="metric-value">{stats.staff_count ?? 0}</div>
						<div class="metric-label">Staff</div>
					</div>
				</div>
				<div class="glass-card metric-card">
					<div class="metric-icon is-amber">
						<span class="material-icons-round">storefront</span>
					</div>
					<div>
						<div class="metric-value">{stats.total_listings ?? 0}</div>
						<div class="metric-label">Anuncios publicados</div>
					</div>
				</div>
				<div class="glass-card metric-card">
					<div class="metric-icon is-mint">
						<span class="material-icons-round">auto_stories</span>
					</div>
					<div>
						<div class="metric-value">{stats.total_stories ?? 0}</div>
						<div class="metric-label">Historias activas</div>
					</div>
				</div>
				<div class="glass-card metric-card">
					<div class="metric-icon"><span class="material-icons-round">today</span></div>
					<div>
						<div class="metric-value">{stats.new_users_today ?? 0}</div>
						<div class="metric-label">Nuevos hoy</div>
					</div>
				</div>
			{:else if staff.role === 'moderator'}
				<a class="glass-card metric-card" href="/admin/reports">
					<div class="metric-icon is-rose"><span class="material-icons-round">flag</span></div>
					<div>
						<div class="metric-value">{stats.pending_reports ?? 0}</div>
						<div class="metric-label">Reportes pendientes</div>
					</div>
				</a>
				<a class="glass-card metric-card" href="/admin/strikes">
					<div class="metric-icon is-rose"><span class="material-icons-round">gavel</span></div>
					<div>
						<div class="metric-value">{stats.active_strikes ?? 0}</div>
						<div class="metric-label">Sanciones activas</div>
					</div>
				</a>
				<a class="glass-card metric-card" href="/admin/content">
					<div class="metric-icon is-mint"><span class="material-icons-round">grid_view</span></div>
					<div>
						<div class="metric-value">{stats.total_posts ?? 0}</div>
						<div class="metric-label">Posts en plataforma</div>
					</div>
				</a>
				<a class="glass-card metric-card" href="/admin/users">
					<div class="metric-icon"><span class="material-icons-round">people</span></div>
					<div>
						<div class="metric-value">{stats.total_users ?? 0}</div>
						<div class="metric-label">Usuarios</div>
					</div>
				</a>
			{:else}
				<!-- Soporte / Equipo: vista ligera de solo lectura -->
				<div class="glass-card metric-card">
					<div class="metric-icon"><span class="material-icons-round">people</span></div>
					<div>
						<div class="metric-value">{stats.total_users ?? 0}</div>
						<div class="metric-label">Usuarios</div>
					</div>
				</div>
				<div class="glass-card metric-card">
					<div class="metric-icon is-mint"><span class="material-icons-round">grid_view</span></div>
					<div>
						<div class="metric-value">{stats.total_posts ?? 0}</div>
						<div class="metric-label">Posts</div>
					</div>
				</div>
				{#if staff.permissions.includes('verifications.view')}
					<a class="glass-card metric-card" href="/admin/verifications">
						<div class="metric-icon is-amber">
							<span class="material-icons-round">verified</span>
						</div>
						<div>
							<div class="metric-value">{stats.pending_verifications ?? 0}</div>
							<div class="metric-label">Verificaciones pendientes</div>
						</div>
					</a>
				{/if}
				{#if staff.permissions.includes('reports.view')}
					<a class="glass-card metric-card" href="/admin/reports">
						<div class="metric-icon is-rose"><span class="material-icons-round">flag</span></div>
						<div>
							<div class="metric-value">{stats.pending_reports ?? 0}</div>
							<div class="metric-label">Reportes pendientes</div>
						</div>
					</a>
				{/if}
			{/if}
		</div>

		<div class="section-grid">
			<!-- ══ Reportes recientes (quien ve reportes) ══ -->
			{#if recentReports.length && staff.permissions.includes('reports.view')}
				<div class="glass-card panel-card">
					<div class="toolbar-row">
						<h2 class="panel-title">
							<span class="material-icons-round">flag</span> Reportes recientes
						</h2>
						<a class="btn-aero-ghost btn-sm" href="/admin/reports">Ver todos</a>
					</div>
					{#each recentReports.slice(0, 4) as report (report.id)}
						<div class="mini-report">
							<span class="status-badge is-pending"
								><span class="dot"></span>{ENTITY_LABELS[report.entity_type] ||
									report.entity_type}</span
							>
							<p class="mini-report-reason">{report.reason}</p>
							<span class="muted-note">{timeAgo(report.created_at)}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- ══ Actividad semanal (solo admin) ══ -->
			{#if isAdminLevel}
				<div class="glass-card panel-card">
					<h2 class="panel-title">
						<span class="material-icons-round">bar_chart</span> Registros de la semana
					</h2>
					{#if weeklySignups.length}
						<div class="weekly-chart" role="img" aria-label="Registros por día de la semana">
							{#each weeklySignups as day (`${day.day}-${day.count}`)}
								<div class="weekly-bar-group">
									<div
										class="weekly-bar"
										style="height:{Math.max(8, Math.round((day.count / maxWeekly) * 100))}%"
									>
										<span class="weekly-bar-count">{day.count}</span>
									</div>
									<span class="weekly-bar-day">{WEEK_DAYS[parseInt(day.day)] ?? ''}</span>
								</div>
							{/each}
						</div>
					{:else}
						<p class="muted-note">Sin registros esta semana.</p>
					{/if}
				</div>
			{/if}

			<!-- ══ Anuncios internos ══ -->
			<div class="glass-card panel-card">
				<div class="toolbar-row">
					<h2 class="panel-title">
						<span class="material-icons-round">campaign</span> Anuncios del staff
					</h2>
					<a class="btn-aero-ghost btn-sm" href="/admin/team">Ver tablón</a>
				</div>
				{#if announcements.length}
					{#each announcements as ann (ann.id)}
						<div class="mini-announcement">
							<div class="mini-ann-head">
								{#if ann.pinned}<span class="material-icons-round pinned-icon">push_pin</span>{/if}
								<strong>{ann.title}</strong>
							</div>
							<p class="mini-ann-body">{ann.body}</p>
							<span class="muted-note"
								>{ann.author_name || 'Staff'} · {timeAgo(ann.created_at)}</span
							>
						</div>
					{/each}
				{:else}
					<p class="muted-note">Todavía no hay anuncios internos.</p>
				{/if}
			</div>
		</div>

		<!-- ══ Accesos rápidos ══ -->
		<div class="glass-card panel-card">
			<h2 class="panel-title"><span class="material-icons-round">bolt</span> Accesos rápidos</h2>
			<div class="quick-grid">
				{#each quickLinks as link (link.href)}
					<a href={link.href} class="quick-link">
						<span class="material-icons-round">{link.icon}</span>
						<span class="quick-label">{link.label}</span>
						<span class="quick-desc">{link.desc}</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.metric-card {
		text-decoration: none;
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base);
	}
	a.metric-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md), var(--shadow-glow);
	}

	.mini-report {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 0;
		border-bottom: 1px solid var(--border-subtle);
	}
	.mini-report:last-child {
		border-bottom: none;
	}
	.mini-report-reason {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 0.83rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.weekly-chart {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 8px;
		height: 140px;
		padding: 24px 4px 0;
	}
	.weekly-bar-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		height: 100%;
		justify-content: flex-end;
	}
	.weekly-bar {
		width: 100%;
		max-width: 42px;
		min-height: 8px;
		border-radius: var(--radius-sm) var(--radius-sm) 4px 4px;
		background: var(--grad-primary);
		position: relative;
		box-shadow: 0 3px 10px rgba(46, 134, 232, 0.2);
	}
	.weekly-bar-count {
		position: absolute;
		top: -18px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.66rem;
		font-weight: 700;
		color: var(--text-secondary);
	}
	.weekly-bar-day {
		font-size: 0.68rem;
		color: var(--text-muted);
		font-weight: 600;
	}

	.mini-announcement {
		padding: 10px 0;
		border-bottom: 1px solid var(--border-subtle);
	}
	.mini-announcement:last-child {
		border-bottom: none;
	}
	.mini-ann-head {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.87rem;
		color: var(--text-primary);
	}
	.pinned-icon {
		font-size: 14px;
		color: var(--aero-amber);
	}
	.mini-ann-body {
		margin: 4px 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.quick-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 10px;
	}
	.quick-link {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px;
		border-radius: var(--radius-md);
		border: 1px solid var(--glass-border);
		background: var(--bg-overlay);
		text-decoration: none;
		transition: all var(--t-base);
	}
	.quick-link:hover {
		border-color: var(--aero-sky);
		box-shadow: var(--shadow-sm), var(--glass-inset);
		transform: translateY(-2px);
	}
	.quick-link .material-icons-round {
		font-size: 20px;
		color: var(--aero-sky);
	}
	.quick-label {
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--text-primary);
	}
	.quick-desc {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
</style>
