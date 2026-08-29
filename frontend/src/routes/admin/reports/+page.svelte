<script>
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { admin as adminApi } from '$lib/api.js';

	let { data } = $props();
	const staff = $derived(data.staff);
	const canResolve = $derived(staff.permissions.includes('reports.resolve'));
	const canStrike = $derived(staff.permissions.includes('strikes.issue'));

	let loading = $state(true);
	let reports = $state([]);
	let stats = $state({ pending: 0, resolved: 0, dismissed: 0, total: 0 });
	let statusFilter = $state('pending');
	let typeFilter = $state('all');
	let searchQuery = $state('');
	let page = $state(1);
	let totalPages = $state(1);
	const LIMIT = 20;

	let actionError = $state('');
	let actionSuccess = $state('');

	const ENTITY_META = {
		post: { icon: 'article', label: 'Post' },
		comment: { icon: 'chat_bubble', label: 'Comentario' },
		reel: { icon: 'movie', label: 'Reel' },
		user: { icon: 'person', label: 'Perfil' }
	};

	const STATUS_TABS = [
		{ key: 'pending', label: 'Pendientes', countKey: 'pending' },
		{ key: 'resolved', label: 'Resueltos', countKey: 'resolved' },
		{ key: 'dismissed', label: 'Descartados', countKey: 'dismissed' },
		{ key: 'all', label: 'Todos', countKey: 'total' }
	];

	const presetReasons = [
		'Spam reiterado y enlaces no autorizados',
		'Acoso, hostigamiento o insultos directos',
		'Contenido NSFW / Explícito sin etiquetar',
		'Infracción de derechos de autor / Suplantación',
		'Comportamiento perjudicial para la comunidad'
	];

	// Constructor único de query params (antes copiado 3 veces).
	function buildParams(p = page) {
		const params = { page: p, limit: LIMIT };
		if (statusFilter !== 'all') params.status = statusFilter;
		if (typeFilter !== 'all') params.type = typeFilter;
		if (searchQuery.trim()) params.q = searchQuery.trim();
		return params;
	}

	async function loadReports(p = 1, { silent = false } = {}) {
		if (!silent) loading = true;
		try {
			const res = await adminApi.reports.list(buildParams(p));
			reports = res.reports || [];
			page = res.page || p;
			totalPages = Math.ceil(res.total / (res.limit || LIMIT)) || 1;
			if (res.stats) stats = res.stats;
		} catch (e) {
			showError(e?.message || 'Error al cargar la cola de moderación.');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadReports(1);
	});

	let searchTimeout;
	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => loadReports(1), 400);
	}

	function showError(msg) {
		actionError = msg;
		setTimeout(() => (actionError = ''), 4500);
	}
	function showSuccess(msg) {
		actionSuccess = msg;
		setTimeout(() => (actionSuccess = ''), 4500);
	}

	async function quickResolve(report, resolution) {
		const idx = reports.findIndex((r) => r.id === report.id);
		const prevReport = idx !== -1 ? { ...reports[idx] } : null;
		const prevStats = { ...stats };

		if (idx !== -1) {
			reports[idx].status = resolution;
			reports = [...reports];
		}
		if (statusFilter === 'pending' && stats.pending > 0) {
			stats.pending--;
			if (resolution === 'resolved') stats.resolved++;
			else stats.dismissed++;
			stats = { ...stats };
		}

		try {
			await adminApi.reports.resolve(report.id, {
				resolution,
				delete_content: false,
				entity_type: report.entity_type,
				entity_id: report.entity_id
			});
			showSuccess(
				`Reporte #${report.id} ${resolution === 'resolved' ? 'resuelto' : 'descartado'}.`
			);
			loadReports(page, { silent: true });
		} catch (e) {
			if (idx !== -1 && prevReport) {
				reports[idx] = prevReport;
				reports = [...reports];
			}
			stats = prevStats;
			showError(e?.message || 'Error al procesar el reporte.');
		}
	}

	// ── Modal de sanción ──
	const STRIKE_LEVELS = [
		{ level: 1, icon: 'warning', title: 'Advertencia', desc: 'Aviso oficial en su historial.' },
		{
			level: 2,
			icon: 'voice_over_off',
			title: 'Silencio 24h',
			desc: 'Sin publicar ni comentar por 24 h.'
		},
		{
			level: 3,
			icon: 'block',
			title: 'Suspensión 7 días',
			desc: 'Cuenta desactivada temporalmente.'
		},
		{ level: 4, icon: 'gavel', title: 'Ban permanente', desc: 'Pérdida definitiva del acceso.' }
	];
	let selectedReport = $state(null);
	let strikeLevel = $state(2);
	let strikeReason = $state('');
	let deleteContent = $state(true);
	let isSubmitting = $state(false);

	function openStrikeModal(report) {
		selectedReport = report;
		strikeLevel = 2;
		strikeReason = `Infracción en reporte #${report.id}: ${report.reason}`;
		deleteContent = true;
	}

	async function submitStrike() {
		if (!selectedReport) return;
		if (!selectedReport.target_author_id) {
			showError('No se pudo identificar al autor del contenido reportado.');
			return;
		}
		if (!strikeReason.trim()) {
			showError('Debe especificar un motivo para la sanción.');
			return;
		}

		isSubmitting = true;
		const report = selectedReport;

		try {
			await adminApi.strikes.issue({
				user_id: report.target_author_id,
				strike_level: strikeLevel,
				reason: strikeReason.trim(),
				report_id: report.id
			});
			if (deleteContent && report.entity_type && report.entity_id) {
				await adminApi.reports.resolve(report.id, {
					resolution: 'resolved',
					delete_content: true,
					entity_type: report.entity_type,
					entity_id: report.entity_id
				});
			}
			selectedReport = null;
			showSuccess(`Sanción aplicada a @${report.target_author_username}.`);
			loadReports(page, { silent: true });
		} catch (e) {
			showError(e?.message || 'Error al aplicar la sanción disciplinaria.');
		} finally {
			isSubmitting = false;
		}
	}

	function fmtDate(raw) {
		if (!raw) return '';
		const s = String(raw).trim();
		const iso = (s.includes('T') ? s : s.replace(' ', 'T')).replace(/Z?$/, 'Z');
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? s
			: d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
	}

	function statusMeta(status) {
		if (status === 'pending') return { cls: 'is-pending', label: 'Pendiente' };
		if (status === 'resolved') return { cls: 'is-resolved', label: 'Resuelto' };
		if (status === 'dismissed') return { cls: 'is-dismissed', label: 'Descartado' };
		return { cls: 'is-inactive', label: status };
	}
</script>

<svelte:head>
	<title>Reportes | Voom! Staff</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title"><span class="material-icons-round">flag</span> Reportes</h1>
	<p class="page-subtitle">Centro de confianza y seguridad — revisa, sanciona y cierra casos.</p>
</div>

<div class="page-content">
	{#if actionError}
		<div class="alert-box error" role="alert">
			<span class="material-icons-round">error</span>
			<span style="flex:1">{actionError}</span>
		</div>
	{/if}
	{#if actionSuccess}
		<div class="alert-box success" role="status">
			<span class="material-icons-round">check_circle</span>
			{actionSuccess}
		</div>
	{/if}

	<!-- KPIs -->
	<div class="metric-grid">
		<div class="glass-card metric-card">
			<div class="metric-icon is-rose">
				<span class="material-icons-round">pending_actions</span>
			</div>
			<div>
				<div class="metric-value">{stats.pending}</div>
				<div class="metric-label">Pendientes</div>
			</div>
		</div>
		<div class="glass-card metric-card">
			<div class="metric-icon is-mint"><span class="material-icons-round">task_alt</span></div>
			<div>
				<div class="metric-value">{stats.resolved}</div>
				<div class="metric-label">Resueltos</div>
			</div>
		</div>
		<div class="glass-card metric-card">
			<div class="metric-icon"><span class="material-icons-round">do_not_disturb_on</span></div>
			<div>
				<div class="metric-value">{stats.dismissed}</div>
				<div class="metric-label">Descartados</div>
			</div>
		</div>
		<div class="glass-card metric-card">
			<div class="metric-icon is-amber"><span class="material-icons-round">receipt_long</span></div>
			<div>
				<div class="metric-value">{stats.total}</div>
				<div class="metric-label">Total histórico</div>
			</div>
		</div>
	</div>

	<!-- Toolbar: tabs de estado + chips de entidad + búsqueda (todo server-side) -->
	<div class="glass-panel admin-toolbar neo-shadow">
		<div class="filter-chips">
			{#each STATUS_TABS as tab (tab.key)}
				<button
					class="filter-chip"
					class:active={statusFilter === tab.key}
					onclick={() => {
						statusFilter = tab.key;
						loadReports(1);
					}}
				>
					{tab.label}
					<span class="chip-count">{stats[tab.countKey] ?? 0}</span>
				</button>
			{/each}
		</div>
		<div class="filter-chips">
			<button
				class="filter-chip"
				class:active={typeFilter === 'all'}
				onclick={() => {
					typeFilter = 'all';
					loadReports(1);
				}}>Todos</button
			>
			{#each Object.entries(ENTITY_META) as [key, meta] (key)}
				<button
					class="filter-chip"
					class:active={typeFilter === key}
					onclick={() => {
						typeFilter = key;
						loadReports(1);
					}}>{meta.label}</button
				>
			{/each}
		</div>
		<label class="search-box" style="margin-left:auto">
			<span class="material-icons-round">search</span>
			<input
				type="search"
				placeholder="Motivo, autor del reporte…"
				bind:value={searchQuery}
				oninput={onSearchInput}
			/>
		</label>
	</div>

	<!-- Lista de casos -->
	{#if loading}
		{#each Array(4) as _, i (i)}
			<div class="skeleton-shimmer skeleton-card"></div>
		{/each}
	{:else if reports.length === 0}
		<div class="glass-card">
			<div class="empty-state">
				<span class="material-icons-round">verified_user</span>
				<p>No hay reportes en esta vista</p>
				<p class="empty-hint">La comunidad está tranquila por ahora.</p>
			</div>
		</div>
	{:else}
		<div class="reports-list">
			{#each reports as report (report.id)}
				{@const sm = statusMeta(report.status)}
				{@const em = ENTITY_META[report.entity_type] || { icon: 'help', label: report.entity_type }}
				<article class="glass-card report-card">
					<header class="report-head">
						<span class="case-id">CASO #{report.id}</span>
						<span class="entity-pill"
							><span class="material-icons-round">{em.icon}</span>{em.label}</span
						>
						<span class="status-badge {sm.cls}"><span class="dot"></span>{sm.label}</span>
						<span class="muted-note">{fmtDate(report.created_at)}</span>
					</header>

					<div class="report-body">
						<div class="reason-box">
							<p class="reason-text">{report.reason}</p>
							{#if report.reporter_name}
								<span class="muted-note"
									>Reportado por <strong>@{report.reporter_name}</strong></span
								>
							{/if}
						</div>

						{#if report.target_author_username}
							<div class="target-box">
								<div class="cell-user">
									<div class="cell-user-main">
										<div class="cell-user-name">@{report.target_author_username}</div>
										<div class="cell-user-sub">Infractor</div>
									</div>
								</div>
								<div class="target-badges">
									{#if report.target_author_strikes > 0}
										<span class="status-badge is-banned"
											><span class="dot"></span>{report.target_author_strikes} sanciones</span
										>
									{/if}
									{#if report.target_author_muted_until}
										<span class="status-badge is-pending"><span class="dot"></span>silenciado</span>
									{/if}
								</div>
							</div>
						{/if}

						{#if report.content_preview}
							<blockquote class="content-preview">“{report.content_preview}”</blockquote>
						{/if}
					</div>

					{#if report.status === 'pending' && canResolve}
						<footer class="report-actions">
							{#if canStrike}
								<button class="btn-aero-danger btn-sm" onclick={() => openStrikeModal(report)}>
									<span class="material-icons-round" style="font-size:15px">gavel</span>
									Sancionar &amp; resolver
								</button>
							{/if}
							<button
								class="btn-aero-secondary btn-sm"
								onclick={() => quickResolve(report, 'resolved')}
							>
								Borrar sin sanción
							</button>
							<button
								class="btn-aero-ghost btn-sm"
								onclick={() => quickResolve(report, 'dismissed')}
							>
								Descartar
							</button>
						</footer>
					{/if}
				</article>
			{/each}
		</div>

		<div class="pagination-bar">
			<button
				class="page-btn"
				disabled={page <= 1}
				onclick={() => loadReports(page - 1)}
				aria-label="Página anterior"
			>
				<span class="material-icons-round">chevron_left</span>
			</button>
			<span class="pagination-info">Página {page} de {totalPages}</span>
			<button
				class="page-btn"
				disabled={page >= totalPages}
				onclick={() => loadReports(page + 1)}
				aria-label="Página siguiente"
			>
				<span class="material-icons-round">chevron_right</span>
			</button>
		</div>
	{/if}
</div>

<!-- ══ Modal: sancionar & resolver ══ -->
{#if selectedReport}
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 150 }}
		onclick={(e) => e.target === e.currentTarget && (selectedReport = null)}
		role="presentation"
	>
		<div class="modal-panel" in:scale={{ duration: 200, start: 0.94, easing: backOut }}>
			<div class="modal-header">
				<h3>
					<span class="material-icons-round">gavel</span>
					CASO #{selectedReport.id} → @{selectedReport.target_author_username || 'desconocido'}
				</h3>
				<button class="modal-close" onclick={() => (selectedReport = null)} aria-label="Cerrar">
					<span class="material-icons-round">close</span>
				</button>
			</div>
			<div class="modal-body">
				<div class="strike-grid">
					{#each STRIKE_LEVELS as sl (sl.level)}
						<button
							class="strike-card"
							class:selected={strikeLevel === sl.level}
							onclick={() => (strikeLevel = sl.level)}
							type="button"
						>
							<span class="material-icons-round">{sl.icon}</span>
							<strong>{sl.title}</strong>
							<small>{sl.desc}</small>
						</button>
					{/each}
				</div>

				<label class="delete-toggle">
					<input type="checkbox" bind:checked={deleteContent} />
					<span class="material-icons-round">delete_sweep</span>
					Eliminar también el contenido reportado
				</label>

				<div class="filter-chips">
					{#each presetReasons as preset (preset)}
						<button class="filter-chip" type="button" onclick={() => (strikeReason = preset)}
							>{preset}</button
						>
					{/each}
				</div>

				<div class="form-group">
					<label class="form-label" for="report-strike-reason">Motivo de la sanción</label>
					<textarea
						id="report-strike-reason"
						class="aero-input strike-reason-input"
						rows="3"
						bind:value={strikeReason}
					></textarea>
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn-aero-ghost" onclick={() => (selectedReport = null)}>Cancelar</button>
				<button class="btn-aero-danger" onclick={submitStrike} disabled={isSubmitting}>
					{#if isSubmitting}<span class="material-icons-round spin" style="font-size:16px"
							>sync</span
						>{/if}
					Aplicar &amp; resolver
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.neo-shadow {
		box-shadow: var(--shadow-md);
	}
	.reports-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.report-card {
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.report-head {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.case-id {
		font-family: var(--font-mono, monospace);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}
	.entity-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.74rem;
		font-weight: 600;
		color: var(--aero-sky);
	}
	.entity-pill .material-icons-round {
		font-size: 15px;
	}
	.report-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.reason-box {
		padding: 10px 14px;
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.reason-text {
		margin: 0 0 4px;
		font-size: 0.88rem;
		color: var(--text-primary);
	}
	.target-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
	}
	.target-badges {
		display: flex;
		gap: 6px;
	}
	.content-preview {
		margin: 0;
		padding: 10px 14px;
		border-left: 3px solid var(--aero-sky);
		background: var(--bg-overlay);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		font-size: 0.82rem;
		color: var(--text-secondary);
		font-style: italic;
	}
	.report-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		border-top: 1px solid var(--border-subtle);
		padding-top: 12px;
	}

	.strike-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 10px;
	}
	.strike-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--glass-border);
		background: var(--bg-overlay);
		color: var(--text-secondary);
		cursor: pointer;
		text-align: left;
		transition: all var(--t-base);
	}
	.strike-card:hover {
		border-color: var(--aero-sky);
	}
	.strike-card.selected {
		border-color: var(--aero-rose);
		background: rgba(236, 72, 153, 0.08);
		box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.12);
	}
	.strike-card .material-icons-round {
		font-size: 20px;
		color: var(--aero-rose);
	}
	.strike-card strong {
		font-size: 0.8rem;
		color: var(--text-primary);
	}
	.strike-card small {
		font-size: 0.7rem;
		color: var(--text-muted);
		line-height: 1.35;
	}

	.delete-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.84rem;
		color: var(--text-secondary);
		cursor: pointer;
		user-select: none;
	}
	.delete-toggle input {
		accent-color: var(--aero-rose);
		width: 16px;
		height: 16px;
	}
	.delete-toggle .material-icons-round {
		font-size: 17px;
		color: var(--aero-rose);
	}

	.strike-reason-input {
		resize: vertical;
		min-height: 70px;
	}
</style>
