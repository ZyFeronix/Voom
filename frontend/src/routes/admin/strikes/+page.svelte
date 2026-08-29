<script>
	import { onMount } from 'svelte';
	import { admin as adminApi } from '$lib/api.js';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';

	let { data } = $props();
	const staff = $derived(data.staff);
	const canUnmute = $derived(staff.permissions.includes('strikes.unmute'));

	let loading = $state(true);
	let loadError = $state('');
	let strikes = $state([]);
	let searchQuery = $state('');
	let page = $state(1);
	let totalPages = $state(1);
	const LIMIT = 20;

	let feedback = $state('');
	let feedbackError = $state(false);

	async function loadStrikes(p = 1) {
		loading = true;
		loadError = '';
		try {
			const params = { page: p, limit: LIMIT };
			if (searchQuery.trim()) params.q = searchQuery.trim();
			const res = await adminApi.strikes.list(params);
			strikes = res.strikes || [];
			page = res.page || p;
			totalPages = Math.ceil(res.total / (res.limit || LIMIT)) || 1;
		} catch (e) {
			loadError = e?.message || 'No se pudo cargar el historial de sanciones.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadStrikes(1);
	});

	let searchTimeout;
	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => loadStrikes(1), 400);
	}

	async function unmute(strike) {
		try {
			await adminApi.strikes.unmute(strike.user_id);
			feedback = `Silencio levantado a @${strike.target_username}.`;
			feedbackError = false;
			setTimeout(() => (feedback = ''), 4000);
			loadStrikes(page);
		} catch (e) {
			feedback = e?.message || 'No se pudo levantar el silencio.';
			feedbackError = true;
			setTimeout(() => (feedback = ''), 4000);
		}
	}

	const LEVEL_META = {
		1: { label: 'Advertencia', cls: 'is-pending' },
		2: { label: 'Silencio 24h', cls: 'is-reviewing' },
		3: { label: 'Suspensión 7d', cls: 'is-banned' },
		4: { label: 'Ban permanente', cls: 'is-banned' }
	};

	function fmtDate(raw) {
		if (!raw) return '—';
		const s = String(raw).trim();
		const iso = (s.includes('T') ? s : s.replace(' ', 'T')).replace(/Z?$/, 'Z');
		const d = new Date(iso);
		return Number.isNaN(d.getTime())
			? s
			: d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
	}
</script>

<svelte:head>
	<title>Sanciones | Voom! Staff</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title"><span class="material-icons-round">gavel</span> Sanciones</h1>
	<p class="page-subtitle">Historial disciplinario completo de la plataforma.</p>
</div>

<div class="page-content">
	{#if loadError}
		<div class="alert-box error" role="alert">
			<span class="material-icons-round">error</span>
			<span style="flex:1">{loadError}</span>
			<button class="btn-aero-secondary btn-sm" onclick={() => loadStrikes(page)}>Reintentar</button
			>
		</div>
	{/if}
	{#if feedback}
		<div class="alert-box {feedbackError ? 'error' : 'success'}" role="status">
			<span class="material-icons-round">{feedbackError ? 'error' : 'check_circle'}</span>
			{feedback}
		</div>
	{/if}

	<div class="glass-panel admin-toolbar neo-shadow">
		<label class="search-box">
			<span class="material-icons-round">search</span>
			<input
				type="search"
				placeholder="Buscar por usuario o ID…"
				bind:value={searchQuery}
				oninput={onSearchInput}
			/>
		</label>
	</div>

	<div class="glass-card table-card">
		{#if loading}
			<div style="padding:20px">
				{#each Array(6) as _, i (i)}
					<div class="skeleton-shimmer skeleton-row"></div>
				{/each}
			</div>
		{:else if strikes.length === 0}
			<div class="empty-state">
				<span class="material-icons-round">volunteer_activism</span>
				<p>Sin sanciones registradas</p>
				<p class="empty-hint">La moderación no ha tenido que actuar todavía.</p>
			</div>
		{:else}
			<div class="table-responsive">
				<table class="aero-table">
					<thead>
						<tr>
							<th>Sancionado</th>
							<th>Nivel</th>
							<th>Motivo</th>
							<th>Impuesta por</th>
							<th>Fecha</th>
							{#if canUnmute}<th style="text-align:right">Acciones</th>{/if}
						</tr>
					</thead>
					<tbody>
						{#each strikes as strike (strike.id)}
							<tr>
								<td>
									<div class="cell-user">
										<div style="flex: 0 0 44px; min-width: 44px; min-height: 44px">
											<AeroAvatar
												src={strike.target_avatar}
												alt={strike.target_username}
												size="sm"
												showPresence={false}
											/>
										</div>
										<div class="cell-user-main">
											<div class="cell-user-name">@{strike.target_username}</div>
											<div class="cell-user-sub">id {strike.user_id}</div>
										</div>
									</div>
								</td>
								<td>
									{#if LEVEL_META[strike.strike_level]}
										<span class="status-badge {LEVEL_META[strike.strike_level].cls}"
											><span class="dot"></span>{LEVEL_META[strike.strike_level].label}</span
										>
									{:else}
										<span class="status-badge is-inactive"
											><span class="dot"></span>Nv.{strike.strike_level}</span
										>
									{/if}
								</td>
								<td><span class="cell-body">{strike.reason}</span></td>
								<td>{strike.issuer_name || 'Staff'}</td>
								<td>{fmtDate(strike.created_at)}</td>
								{#if canUnmute}
									<td>
										<div class="row-actions">
											<button
												class="icon-btn"
												title="Levantar silencio"
												onclick={() => unmute(strike)}
												disabled={strike.action_taken === 'perm_ban' ||
													strike.action_taken === 'warning'}
											>
												<span class="material-icons-round">record_voice_over</span>
											</button>
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="pagination-bar">
				<button
					class="page-btn"
					disabled={page <= 1}
					onclick={() => loadStrikes(page - 1)}
					aria-label="Página anterior"
				>
					<span class="material-icons-round">chevron_left</span>
				</button>
				<span class="pagination-info">Página {page} de {totalPages}</span>
				<button
					class="page-btn"
					disabled={page >= totalPages}
					onclick={() => loadStrikes(page + 1)}
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
	.row-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}
</style>
