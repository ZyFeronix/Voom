<script>
	import { onMount } from 'svelte';
	import { admin as adminApi } from '$lib/api.js';

	let loading = $state(true);
	let stats = $state(null);
	let activity = $state([]);
	let reports = $state([]);

	onMount(async () => {
		try {
			const res = await adminApi.dashboard();
			stats = res.stats;
			activity = res.recent_activity || [];
			reports = res.recent_reports || [];
		} catch (e) {
			console.error(e);
			// Fallback
			stats = { total_users: 0, total_posts: 0, total_reels: 0, pending_reports: 0 };
		} finally {
			loading = false;
		}
	});

	// Helper for dates
	function timeAgo(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		const seconds = Math.floor((new Date() - date) / 1000);
		let interval = seconds / 31536000;
		if (interval > 1) return Math.floor(interval) + ' años';
		interval = seconds / 2592000;
		if (interval > 1) return Math.floor(interval) + ' meses';
		interval = seconds / 86400;
		if (interval > 1) return Math.floor(interval) + ' d';
		interval = seconds / 3600;
		if (interval > 1) return Math.floor(interval) + ' h';
		interval = seconds / 60;
		if (interval > 1) return Math.floor(interval) + ' min';
		return Math.floor(seconds) + ' s';
	}
</script>

<svelte:head>
	<title>Dashboard | VSocial Admin</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Dashboard</h1>
	<p class="page-subtitle">Visión general del estado de VSocial</p>
</div>

{#if loading}
	<div class="loader-container">
		<span class="loading loading-spinner text-primary"></span>
	</div>
{:else}
	<!-- ── Metrics ──────────────────────────────────────────────────────── -->
	<div class="metrics-grid">
		<div class="metric-card glass-card">
			<div class="metric-icon" style="color: var(--aero-sky);">
				<span class="material-icons-round">people</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats?.total_users || 0}</p>
				<p class="metric-label">Usuarios Registrados</p>
			</div>
		</div>

		<div class="metric-card glass-card">
			<div class="metric-icon" style="color: var(--aero-rose);">
				<span class="material-icons-round">movie</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats?.total_reels || 0}</p>
				<p class="metric-label">Reels Publicados</p>
			</div>
		</div>

		<div class="metric-card glass-card">
			<div
				class="metric-icon"
				style="background: var(--grad-primary); color: #fff; box-shadow: 0 4px 15px rgba(46,134,232,0.4), inset 0 2px 4px rgba(255,255,255,0.4);"
			>
				<span class="material-icons-round text-white">dynamic_feed</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats?.total_posts || 0}</p>
				<p class="metric-label">Posts Totales</p>
			</div>
		</div>

		<div class="metric-card glass-card">
			<div class="metric-icon" style="color: var(--aero-amber);">
				<span class="material-icons-round">flag</span>
			</div>
			<div class="metric-data">
				<p class="metric-value">{stats?.pending_reports || 0}</p>
				<p class="metric-label">Reportes Pendientes</p>
			</div>
		</div>
	</div>

	<div class="dashboard-columns">
		<!-- ── Activity Feed ────────────────────────────────────────────────── -->
		<div class="dashboard-col glass-card">
			<div class="col-header">
				<h2 class="col-title">Actividad Reciente</h2>
			</div>
			<div class="activity-list">
				{#if activity.length === 0}
					<div class="empty-state">No hay actividad reciente.</div>
				{:else}
					{#each activity as act}
						<div class="activity-item">
							<div class="act-avatar">
								{#if act.actor_avatar}
									<img src={act.actor_avatar} alt="Avatar" />
								{:else}
									<span class="material-icons-round">notifications</span>
								{/if}
							</div>
							<div class="act-content">
								<p class="act-text">
									<span class="act-user">@{act.actor_username || 'Sistema'}</span>
									{act.body || act.message}
								</p>
								<span class="act-time">{timeAgo(act.created_at)}</span>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- ── Recent Reports ───────────────────────────────────────────────── -->
		<div class="dashboard-col glass-card">
			<div class="col-header">
				<h2 class="col-title">Reportes Pendientes</h2>
				<a href="/admin/reports" class="col-link">Ver todos</a>
			</div>
			<div class="reports-list">
				{#if reports.length === 0}
					<div class="empty-state">No hay reportes pendientes.</div>
				{:else}
					{#each reports as r}
						<div class="report-item">
							<div class="rep-icon">
								<span class="material-icons-round">report_problem</span>
							</div>
							<div class="rep-content">
								<p class="rep-title">Reporte #{r.id} • {r.entity_type}</p>
								<p class="rep-reason">{r.reason}</p>
							</div>
							<span class="rep-time">{timeAgo(r.created_at)}</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.page-header {
		padding: 32px;
		background: linear-gradient(180deg, rgba(46, 134, 232, 0.03) 0%, transparent 100%);
		border-bottom: 1px solid var(--border-subtle);
	}
	.page-title {
		font-size: 1.8rem;
		font-family: var(--font-display);
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}
	.page-subtitle {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin: 4px 0 0;
	}

	.loader-container {
		display: flex;
		justify-content: center;
		padding: 64px;
	}

	/* Metrics Grid */
	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 20px;
		padding: 32px;
	}
	.metric-card {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 24px;
		border-radius: var(--radius-lg);
	}
	.metric-icon {
		width: 56px;
		height: 56px;
		border-radius: 16px;
		background: var(--bg-surface);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}
	.metric-icon .material-icons-round {
		font-size: 28px;
	}
	.metric-data {
		display: flex;
		flex-direction: column;
	}
	.metric-value {
		font-size: 1.8rem;
		font-weight: 800;
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
		line-height: 1.2;
	}
	.metric-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	/* Columns */
	.dashboard-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		padding: 0 32px 32px;
	}
	@media (max-width: 1024px) {
		.dashboard-columns {
			grid-template-columns: 1fr;
		}
	}

	.dashboard-col {
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
	}
	.col-header {
		padding: 20px 24px;
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.col-title {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}
	.col-link {
		font-size: 0.85rem;
		color: var(--aero-sky);
		text-decoration: none;
		font-weight: 600;
	}
	.col-link:hover {
		text-decoration: underline;
	}

	.empty-state {
		padding: 32px;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	/* Activity List */
	.activity-list {
		display: flex;
		flex-direction: column;
	}
	.activity-item {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border-subtle);
	}
	.activity-item:last-child {
		border-bottom: none;
	}
	.act-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--bg-surface);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.act-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.act-avatar .material-icons-round {
		font-size: 18px;
		color: var(--text-muted);
	}
	.act-content {
		flex: 1;
		min-width: 0;
	}
	.act-text {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin: 0 0 4px 0;
		line-height: 1.4;
	}
	.act-user {
		font-weight: 700;
		color: var(--text-primary);
	}
	.act-time {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	/* Reports List */
	.reports-list {
		display: flex;
		flex-direction: column;
	}
	.report-item {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border-subtle);
	}
	.report-item:last-child {
		border-bottom: none;
	}
	.rep-icon {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: rgba(232, 74, 114, 0.1);
		color: var(--aero-rose);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.rep-content {
		flex: 1;
		min-width: 0;
	}
	.rep-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 4px 0;
	}
	.rep-reason {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin: 0;
	}
	.rep-time {
		font-size: 0.7rem;
		color: var(--text-muted);
		flex-shrink: 0;
	}
</style>
