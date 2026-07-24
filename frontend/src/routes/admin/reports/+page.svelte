<script>
	import { onMount } from 'svelte';
	import { admin as adminApi } from '$lib/api.js';

	let loading = $state(true);
	let reports = $state([]);
	let actionError = $state('');

	onMount(async () => {
		await loadReports();
	});

	async function loadReports() {
		loading = true;
		try {
			const res = await adminApi.reports.list();
			reports = res.reports || [];
		} catch (e) {
			console.error(e);
		} finally {
			loading = false;
		}
	}

	async function resolveReport(id, status) {
		try {
			await adminApi.reports.resolve(id, { status });
			const index = reports.findIndex((r) => r.id === id);
			if (index !== -1) {
				reports[index].status = status;
				reports = [...reports];
			}
		} catch (e) {
			console.error(e);
			actionError = 'Error al resolver reporte';
			setTimeout(() => (actionError = ''), 4000);
		}
	}
</script>

<svelte:head>
	<title>Reportes | VSocial Admin</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Cola de Moderación</h1>
	<p class="page-subtitle">Revisa reportes enviados por los usuarios</p>
</div>

<div class="page-content">
	{#if actionError}
		<div
			class="glass-panel p-4 mb-6 flex items-center gap-2 text-sm rounded-lg"
			style="background: rgba(232, 74, 114, 0.1); border-color: rgba(232, 74, 114, 0.2); color: var(--aero-rose);"
		>
			<span class="material-icons-round text-[18px]">error_outline</span>
			{actionError}
		</div>
	{/if}

	{#if loading && reports.length === 0}
		<div class="loader-container">
			<span class="loading loading-spinner text-primary"></span>
		</div>
	{:else if reports.length === 0}
		<div class="empty-state glass-card">
			<span class="material-icons-round">done_all</span>
			<p>No hay reportes. ¡Buen trabajo!</p>
		</div>
	{:else}
		<div class="reports-grid">
			{#each reports as report}
				<div class="report-card glass-card">
					<div class="report-header">
						<span class="report-tag" class:pending={report.status === 'pending'}>
							{report.status.toUpperCase()}
						</span>
						<span class="report-time">{new Date(report.created_at).toLocaleString()}</span>
					</div>
					<div class="report-body">
						<h3 class="entity-type">{report.entity_type} #{report.entity_id}</h3>
						<p class="report-reason"><strong>Motivo:</strong> {report.reason}</p>
						<p class="reporter">Reportado por: @{report.reporter_username || 'Sistema'}</p>
					</div>
					{#if report.status === 'pending'}
						<div class="report-actions">
							<button
								class="btn-aero-secondary btn-sm"
								onclick={() => resolveReport(report.id, 'dismissed')}>Ignorar</button
							>
							<button
								class="btn-aero-danger btn-sm"
								onclick={() => resolveReport(report.id, 'resolved')}>Resolver</button
							>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

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
		margin: 0;
	}
	.page-subtitle {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin: 4px 0 0;
	}

	.page-content {
		padding: 32px;
	}

	.reports-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 20px;
	}
	.report-card {
		padding: 20px;
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.report-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.report-tag {
		font-size: 0.7rem;
		font-weight: 700;
		padding: 4px 8px;
		border-radius: 6px;
		background: rgba(125, 151, 174, 0.1);
		color: var(--text-muted);
	}
	.report-tag.pending {
		background: rgba(232, 160, 35, 0.15);
		color: var(--aero-amber);
	}
	.report-time {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.report-body {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.entity-type {
		font-size: 1rem;
		font-weight: 700;
		margin: 0;
		color: var(--text-primary);
		text-transform: capitalize;
	}
	.report-reason {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.4;
	}
	.reporter {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0;
	}

	.report-actions {
		display: flex;
		gap: 8px;
		margin-top: auto;
		padding-top: 16px;
		border-top: 1px solid var(--border-subtle);
	}
	.report-actions button {
		flex: 1;
	}

	.empty-state {
		text-align: center;
		padding: 64px;
		color: var(--text-muted);
		border-radius: var(--radius-lg);
	}
	.empty-state .material-icons-round {
		font-size: 48px;
		opacity: 0.5;
		margin-bottom: 16px;
	}
	.loader-container {
		padding: 64px;
		text-align: center;
	}
</style>
