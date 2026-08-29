<script>
	import { onMount } from 'svelte';
	import { invites as invitesApi } from '$lib/api.js';
	import { uiStore } from '$lib/stores/ui.svelte.js';

	let invites = $state([]);
	let stats = $state({ total: 0, active: 0, exhausted: 0, totalRegistrations: 0 });
	let loading = $state(true);
	let saving = $state(false);
	let errorMsg = $state('');
	let okMsg = $state('');
	let copiedCode = $state('');

	// Formulario de generación
	let newCount = $state(1);
	let newMaxUses = $state('');
	let newExpires = $state('');
	let newLabel = $state('');

	async function loadInvites() {
		loading = true;
		errorMsg = '';
		try {
			const res = await invitesApi.list();
			invites = res.invites || [];
			stats = res.stats || stats;
		} catch (err) {
			errorMsg = err.message || 'No se pudieron cargar las invitaciones';
		} finally {
			loading = false;
		}
	}

	onMount(loadInvites);

	function flash(msg) {
		okMsg = msg;
		setTimeout(() => (okMsg = ''), 3000);
	}

	async function createInvites() {
		saving = true;
		errorMsg = '';
		okMsg = '';
		try {
			const res = await invitesApi.create({
				count: newCount,
				max_uses: newMaxUses === '' ? null : newMaxUses,
				expires_at: newExpires || null,
				label: newLabel.trim() || null
			});
			const codes = (res.created || []).map((c) => c.code).join(', ');
			flash(
				(res.created?.length || 0) > 1
					? `${res.created.length} códigos generados: ${codes}`
					: `Código generado: ${codes}`
			);
			newCount = 1;
			newMaxUses = '';
			newExpires = '';
			newLabel = '';
			await loadInvites();
		} catch (err) {
			errorMsg = err.message || 'No se pudieron generar los códigos';
		} finally {
			saving = false;
		}
	}

	async function toggleActive(invite) {
		saving = true;
		errorMsg = '';
		try {
			await invitesApi.update(invite.id, { is_active: !invite.is_active });
			flash(invite.is_active ? 'Código desactivado' : 'Código reactivado');
			await loadInvites();
		} catch (err) {
			errorMsg = err.message || 'No se pudo actualizar el código';
		} finally {
			saving = false;
		}
	}

	async function removeInvite(invite) {
		const ok = await uiStore.requestConfirm({
			title: 'Eliminar invitación',
			message: `¿Eliminar el código ${invite.code}? El historial de quién lo usó se borrará con él.`,
			danger: true,
			confirmText: 'Eliminar'
		});
		if (!ok) return;
		saving = true;
		errorMsg = '';
		okMsg = '';
		try {
			await invitesApi.remove(invite.id);
			flash('Código eliminado');
			await loadInvites();
		} catch (err) {
			errorMsg = err.message || 'No se pudo eliminar el código';
		} finally {
			saving = false;
		}
	}

	async function copyCode(code) {
		try {
			await navigator.clipboard.writeText(code);
			copiedCode = code;
			setTimeout(() => (copiedCode = ''), 1500);
		} catch {
			errorMsg = 'No se pudo copiar al portapapeles';
		}
	}

	function inviteState(invite) {
		if (!invite.is_active) return { label: 'Desactivado', cls: 'is-banned' };
		const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
		if (invite.expires_at && invite.expires_at <= now)
			return { label: 'Expirado', cls: 'is-banned' };
		if (invite.max_uses !== null && invite.uses_count >= invite.max_uses)
			return { label: 'Agotado', cls: 'is-pending' };
		return { label: 'Activo', cls: 'is-active' };
	}

	function usesLabel(invite) {
		return invite.max_uses === null
			? `${invite.used_by_count ?? 0} / ∞`
			: `${invite.used_by_count ?? 0} / ${invite.max_uses}`;
	}
</script>

<svelte:head>
	<title>Invitaciones | Voom! Admin</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">
		<span class="material-icons-round">confirmation_number</span> Invitaciones
	</h1>
	<p class="page-subtitle">
		Códigos de registro para la beta cerrada. Actívalos en Ajustes → «Registro Solo con Invitación»
		y comparte los códigos con tu comunidad.
	</p>
</div>

<div class="page-content">
	{#if errorMsg}
		<div class="alert-box error" role="alert">
			<span class="material-icons-round">error</span>
			<span style="flex:1">{errorMsg}</span>
		</div>
	{/if}
	{#if okMsg}
		<div class="alert-box success" role="status">
			<span class="material-icons-round">check_circle</span>
			<span style="flex:1; word-break: break-all">{okMsg}</span>
		</div>
	{/if}

	<!-- Métricas -->
	<div class="stats-row">
		<div class="stat-chip">
			<span class="material-icons-round">confirmation_number</span>
			<div><strong>{stats.total}</strong><span>códigos</span></div>
		</div>
		<div class="stat-chip">
			<span class="material-icons-round">check_circle</span>
			<div><strong>{stats.active}</strong><span>activos</span></div>
		</div>
		<div class="stat-chip">
			<span class="material-icons-round">block</span>
			<div><strong>{stats.exhausted}</strong><span>agotados</span></div>
		</div>
		<div class="stat-chip">
			<span class="material-icons-round">how_to_reg</span>
			<div><strong>{stats.totalRegistrations}</strong><span>registros</span></div>
		</div>
	</div>

	<!-- Formulario de generación -->
	<div class="glass-card create-card">
		<h2 class="card-title">Generar códigos</h2>
		<div class="create-row">
			<div class="field" style="max-width: 130px">
				<label class="field-label" for="inv-count">Cantidad</label>
				<input
					id="inv-count"
					type="number"
					min="1"
					max="100"
					bind:value={newCount}
					class="aero-input"
				/>
			</div>
			<div class="field" style="max-width: 170px">
				<label class="field-label" for="inv-max">Usos por código</label>
				<input
					id="inv-max"
					type="number"
					min="1"
					placeholder="Vacío = ilimitado"
					bind:value={newMaxUses}
					class="aero-input"
				/>
			</div>
			<div class="field" style="max-width: 190px">
				<label class="field-label" for="inv-exp">Expira</label>
				<input id="inv-exp" type="date" bind:value={newExpires} class="aero-input" />
			</div>
			<div class="field">
				<label class="field-label" for="inv-label">Nota interna</label>
				<input
					id="inv-label"
					type="text"
					placeholder="Ej. Lote Discord #1"
					bind:value={newLabel}
					class="aero-input"
					onkeydown={(e) => e.key === 'Enter' && createInvites()}
				/>
			</div>
			<button class="btn-aero-primary create-btn" onclick={createInvites} disabled={saving}>
				{#if saving}
					<span class="material-icons-round spin">sync</span>
				{:else}
					<span class="material-icons-round">add</span>
				{/if}
				<span>Generar</span>
			</button>
		</div>
	</div>

	<!-- Listado -->
	<div class="glass-card table-card">
		{#if loading && invites.length === 0}
			<div style="padding:20px">
				{#each Array(4) as _, i (i)}
					<div class="skeleton-shimmer skeleton-row"></div>
				{/each}
			</div>
		{:else if invites.length === 0}
			<div class="empty-state">
				<span class="material-icons-round">confirmation_number</span>
				<p>Todavía no hay códigos. Genera el primer lote con el formulario de arriba.</p>
			</div>
		{:else}
			<div class="table-responsive">
				<table class="aero-table">
					<thead>
						<tr>
							<th>Código</th>
							<th>Nota</th>
							<th style="text-align:center">Usos</th>
							<th style="text-align:center">Expira</th>
							<th style="text-align:center">Estado</th>
							<th style="text-align:right">Acciones</th>
						</tr>
					</thead>
					<tbody>
						{#each invites as invite (invite.id)}
							{@const state = inviteState(invite)}
							<tr>
								<td>
									<button
										class="code-chip"
										title="Copiar código"
										onclick={() => copyCode(invite.code)}
									>
										<code>{invite.code}</code>
										<span class="material-icons-round">
											{copiedCode === invite.code ? 'check' : 'content_copy'}
										</span>
									</button>
								</td>
								<td class="label-cell">{invite.label || '—'}</td>
								<td style="text-align:center">
									<span class="post-count">{usesLabel(invite)}</span>
								</td>
								<td style="text-align:center" class="expiry-cell">
									{invite.expires_at ? invite.expires_at.slice(0, 10) : 'Nunca'}
								</td>
								<td style="text-align:center">
									<span class="status-badge {state.cls}">
										<span class="dot"></span>
										{state.label}
									</span>
								</td>
								<td>
									<div style="display:flex; gap:6px; justify-content:flex-end">
										<button
											class="icon-btn"
											title={invite.is_active ? 'Desactivar' : 'Reactivar'}
											onclick={() => toggleActive(invite)}
											disabled={saving}
										>
											<span class="material-icons-round">
												{invite.is_active ? 'pause_circle' : 'play_circle'}
											</span>
										</button>
										<button
											class="icon-btn danger"
											title="Eliminar código"
											onclick={() => removeInvite(invite)}
											disabled={saving}
										>
											<span class="material-icons-round">delete</span>
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<style>
	.stats-row {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.stat-chip {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
	}
	.stat-chip .material-icons-round {
		color: var(--aero-sky);
		font-size: 20px;
	}
	.stat-chip div {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.stat-chip strong {
		font-size: 1.05rem;
		color: var(--text-primary);
	}
	.stat-chip span {
		font-size: 0.7rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.create-card {
		border-radius: var(--radius-lg);
		padding: 20px 24px;
		z-index: 50;
		position: relative;
		overflow: visible !important;
		contain: none !important;
	}
	.card-title {
		font-size: 0.95rem;
		font-weight: 700;
		margin: 0 0 14px;
		color: var(--text-primary);
	}
	.create-row {
		display: flex;
		align-items: flex-end;
		gap: 14px;
		flex-wrap: wrap;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex: 1;
		min-width: 150px;
	}
	.field-label {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.create-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 22px;
		flex-shrink: 0;
	}

	.code-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		border-radius: var(--radius-xs);
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
		cursor: pointer;
		color: var(--aero-mint);
		font-size: 0.8rem;
		transition:
			border-color 0.15s ease,
			transform 0.15s ease;
	}
	.code-chip:hover {
		border-color: var(--aero-mint);
		transform: translateY(-1px);
	}
	.code-chip code {
		font-family: var(--font-mono, monospace);
		font-weight: 700;
		letter-spacing: 0.5px;
	}
	.code-chip .material-icons-round {
		font-size: 14px;
		color: var(--text-muted);
	}
	.label-cell {
		color: var(--text-secondary);
		font-size: 0.85rem;
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.expiry-cell {
		font-size: 0.85rem;
		color: var(--text-tertiary);
	}
	.post-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
		font-size: 0.78rem;
		font-weight: 600;
	}
</style>
