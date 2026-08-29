<script>
	import { onMount } from 'svelte';
	import { admin as adminApi } from '$lib/api.js';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';

	let loading = $state(true);
	let loadError = $state('');
	let logs = $state([]);
	let searchQuery = $state('');
	let actionFilter = $state('');
	let page = $state(1);
	let totalPages = $state(1);
	const LIMIT = 30;

	// Grupos de acción para el filtro rápido.
	const ACTION_FILTERS = [
		{ key: '', label: 'Todas' },
		{ key: 'user.create', label: 'Altas' },
		{ key: 'user.update', label: 'Ediciones' },
		{ key: 'user.ban', label: 'Bans' },
		{ key: 'user.delete', label: 'Borrados' },
		{ key: 'report.resolve', label: 'Reportes' },
		{ key: 'content.delete', label: 'Contenido' },
		{ key: 'strike.issue', label: 'Sanciones' },
		{ key: 'verification.review', label: 'Verificaciones' },
		{ key: 'settings.update', label: 'Sistema' },
		{ key: 'announcement.create', label: 'Anuncios' }
	];

	async function loadAudit(p = 1) {
		loading = true;
		loadError = '';
		try {
			const params = { page: p, limit: LIMIT };
			if (searchQuery.trim()) params.q = searchQuery.trim();
			if (actionFilter) params.action = actionFilter;
			const res = await adminApi.audit.list(params);
			logs = res.logs || [];
			page = res.page || p;
			totalPages = Math.ceil(res.total / (res.limit || LIMIT)) || 1;
		} catch (e) {
			loadError = e?.message || 'No se pudo cargar la auditoría.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadAudit(1);
	});

	let searchTimeout;
	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => loadAudit(1), 400);
	}

	function fmtDate(raw) {
		if (!raw) return '—';
		const s = String(raw).trim();
		const iso = (s.includes('T') ? s : s.replace(' ', 'T')).replace(/Z?$/, 'Z');
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? s
			: d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
	}

	function actionIcon(action) {
		if (action.startsWith('user.')) return 'person';
		if (action.startsWith('report.')) return 'flag';
		if (action.startsWith('content.')) return 'grid_view';
		if (action.startsWith('strike.')) return 'gavel';
		if (action.startsWith('verification.')) return 'verified';
		if (action.startsWith('settings.')) return 'tune';
		if (action.startsWith('announcement.')) return 'campaign';
		return 'bolt';
	}

	function detailsSummary(raw) {
		if (!raw) return '';
		try {
			const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
			return Object.entries(parsed)
				.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
				.join(' · ');
		} catch {
			return String(raw);
		}
	}
</script>

<svelte:head>
	<title>Auditoría | Voom! Staff</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title"><span class="material-icons-round">history</span> Auditoría</h1>
	<p class="page-subtitle">Trazabilidad completa: cada acción del staff queda registrada.</p>
</div>

<div class="page-content">
	{#if loadError}
		<div class="alert-box error" role="alert">
			<span class="material-icons-round">error</span>
			<span style="flex:1">{loadError}</span>
			<button class="btn-aero-secondary btn-sm" onclick={() => loadAudit(page)}>Reintentar</button>
		</div>
	{/if}

	<div class="glass-panel admin-toolbar neo-shadow">
		<label class="search-box">
			<span class="material-icons-round">search</span>
			<input
				type="search"
				placeholder="Buscar acción, entidad o autor…"
				bind:value={searchQuery}
				oninput={onSearchInput}
			/>
		</label>
		<div class="filter-chips">
			{#each ACTION_FILTERS as f (f.key || 'all')}
				<button
					class="filter-chip"
					class:active={actionFilter === f.key}
					onclick={() => {
						actionFilter = f.key;
						loadAudit(1);
					}}>{f.label}</button
				>
			{/each}
		</div>
	</div>

	<div class="glass-card table-card">
		{#if loading}
			<div style="padding:20px">
				{#each Array(8) as _, i (i)}
					<div class="skeleton-shimmer skeleton-row"></div>
				{/each}
			</div>
		{:else if logs.length === 0}
			<div class="empty-state">
				<span class="material-icons-round">history_toggle_off</span>
				<p>Sin registros de auditoría</p>
				<p class="empty-hint">Las acciones del staff aparecerán aquí automáticamente.</p>
			</div>
		{:else}
			<div class="table-responsive">
				<table class="aero-table">
					<thead>
						<tr>
							<th>Autor</th>
							<th>Acción</th>
							<th>Entidad</th>
							<th>Detalles</th>
							<th>IP</th>
							<th>Fecha</th>
						</tr>
					</thead>
					<tbody>
						{#each logs as log (log.id)}
							<tr>
								<td>
									<div class="cell-user">
										<div style="flex: 0 0 44px; min-width: 44px; min-height: 44px">
											<AeroAvatar
												src={log.actor_avatar}
												alt={log.actor_name || 'sistema'}
												size="sm"
												showPresence={false}
											/>
										</div>
										<div class="cell-user-main">
											<div class="cell-user-name">{log.actor_name || 'Sistema'}</div>
										</div>
									</div>
								</td>
								<td>
									<span class="action-pill">
										<span class="material-icons-round">{actionIcon(log.action)}</span>
										{log.action}
									</span>
								</td>
								<td>
									{#if log.entity_type}
										<span class="muted-note">{log.entity_type} #{log.entity_id}</span>
									{:else}
										<span class="muted-note">—</span>
									{/if}
								</td>
								<td><span class="cell-body">{detailsSummary(log.details)}</span></td>
								<td><span class="muted-note">{log.ip || '—'}</span></td>
								<td>{fmtDate(log.created_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="pagination-bar">
				<button
					class="page-btn"
					disabled={page <= 1}
					onclick={() => loadAudit(page - 1)}
					aria-label="Página anterior"
				>
					<span class="material-icons-round">chevron_left</span>
				</button>
				<span class="pagination-info">Página {page} de {totalPages}</span>
				<button
					class="page-btn"
					disabled={page >= totalPages}
					onclick={() => loadAudit(page + 1)}
					aria-label="Página siguiente"
				>
					<span class="material-icons-round">chevron_right</span>
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.neo-shadow {
		box-shadow: var(--shadow-md);
	}
	.action-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono, monospace);
		font-size: 0.74rem;
		font-weight: 600;
		color: var(--text-secondary);
	}
	.action-pill .material-icons-round {
		font-size: 14px;
		color: var(--aero-sky);
	}
</style>
