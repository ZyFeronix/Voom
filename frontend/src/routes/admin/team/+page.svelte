<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { admin as adminApi } from '$lib/api.js';
	import { uiStore } from '$lib/stores/ui.svelte.js';

	let { data } = $props();
	const staff = $derived(data.staff);
	const canPublish = $derived(staff.permissions.includes('announcements.manage'));

	let loading = $state(true);
	let loadError = $state('');
	let announcements = $state([]);

	let showForm = $state(false);
	let title = $state('');
	let body = $state('');
	let publishing = $state(false);

	let feedback = $state('');
	let feedbackError = $state(false);

	async function loadAnnouncements() {
		loading = true;
		loadError = '';
		try {
			const res = await adminApi.announcements.list();
			announcements = res.announcements || [];
		} catch (e) {
			loadError = e?.message || 'No se pudo cargar el tablón.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadAnnouncements();
	});

	function notify(msg, isError = false) {
		feedback = msg;
		feedbackError = isError;
		setTimeout(() => (feedback = ''), 4000);
	}

	async function publish() {
		if (!title.trim() || !body.trim()) {
			notify('Título y cuerpo son obligatorios.', true);
			return;
		}
		publishing = true;
		try {
			await adminApi.announcements.create({ title: title.trim(), body: body.trim() });
			title = '';
			body = '';
			showForm = false;
			notify('Anuncio publicado en el tablón.');
			loadAnnouncements();
		} catch (e) {
			notify(e?.message || 'No se pudo publicar el anuncio.', true);
		} finally {
			publishing = false;
		}
	}

	async function togglePin(ann) {
		try {
			await adminApi.announcements.pin(ann.id);
			loadAnnouncements();
		} catch (e) {
			notify(e?.message || 'No se pudo fijar el anuncio.', true);
		}
	}

	async function removeAnnouncement(ann) {
		const ok = await uiStore.requestConfirm({
			title: 'Eliminar anuncio',
			message: `«${ann.title}» desaparecerá del tablón del staff.`,
			danger: true,
			confirmText: 'Eliminar'
		});
		if (!ok) return;
		try {
			await adminApi.announcements.delete(ann.id);
			announcements = announcements.filter((a) => a.id !== ann.id);
		} catch (e) {
			notify(e?.message || 'No se pudo eliminar el anuncio.', true);
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
</script>

<svelte:head>
	<title>Equipo | Voom! Staff</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title"><span class="material-icons-round">diversity_3</span> Equipo</h1>
	<p class="page-subtitle">Tablón interno del staff: anuncios, accesos y coordinación.</p>
</div>

<div class="page-content">
	{#if loadError}
		<div class="alert-box error" role="alert">
			<span class="material-icons-round">error</span>
			<span style="flex:1">{loadError}</span>
			<button class="btn-aero-secondary btn-sm" onclick={loadAnnouncements}>Reintentar</button>
		</div>
	{/if}
	{#if feedback}
		<div class="alert-box {feedbackError ? 'error' : 'success'}" role="status">
			<span class="material-icons-round">{feedbackError ? 'error' : 'check_circle'}</span>
			{feedback}
		</div>
	{/if}

	<div class="team-layout">
		<!-- ══ Tablón de anuncios ══ -->
		<section class="team-main">
			<div class="glass-card panel-card">
				<div class="toolbar-row">
					<h2 class="panel-title">
						<span class="material-icons-round">campaign</span> Anuncios internos
					</h2>
					{#if canPublish}
						<button class="btn-aero-primary btn-sm" onclick={() => (showForm = !showForm)}>
							<span class="material-icons-round" style="font-size:16px"
								>{showForm ? 'close' : 'add'}</span
							>
							{showForm ? 'Cerrar' : 'Nuevo anuncio'}
						</button>
					{/if}
				</div>

				{#if showForm && canPublish}
					<form
						class="ann-form"
						onsubmit={(e) => {
							e.preventDefault();
							publish();
						}}
					>
						<div class="form-group">
							<label class="form-label" for="ann-title">Título</label>
							<input
								id="ann-title"
								class="aero-input"
								bind:value={title}
								maxlength="160"
								placeholder="Resumen del anuncio…"
							/>
						</div>
						<div class="form-group">
							<label class="form-label" for="ann-body">Contenido</label>
							<textarea
								id="ann-body"
								class="aero-input"
								rows="4"
								bind:value={body}
								placeholder="Escribe el anuncio para el equipo…"
							></textarea>
						</div>
						<div class="toolbar-row">
							<span></span>
							<button class="btn-aero-primary btn-sm" type="submit" disabled={publishing}>
								{#if publishing}<span class="material-icons-round spin" style="font-size:16px"
										>sync</span
									>{/if}
								Publicar
							</button>
						</div>
					</form>
				{/if}

				{#if loading}
					{#each Array(3) as _, i (i)}
						<div class="skeleton-shimmer skeleton-row"></div>
					{/each}
				{:else if announcements.length === 0}
					<div class="empty-state">
						<span class="material-icons-round">campaign</span>
						<p>Sin anuncios por ahora</p>
						<p class="empty-hint">
							{canPublish
								? 'Publica el primero para coordinar al equipo.'
								: 'La administración publicará novedades aquí.'}
						</p>
					</div>
				{:else}
					{#each announcements as ann (ann.id)}
						<article class="ann-card" in:fade={{ duration: 150 }}>
							<header class="ann-head">
								<div class="ann-title">
									{#if ann.pinned}<span class="material-icons-round pinned-icon">push_pin</span
										>{/if}
									<strong>{ann.title}</strong>
								</div>
								{#if canPublish}
									<div class="row-actions">
										<button
											class="icon-btn"
											title={ann.pinned ? 'Desfijar' : 'Fijar'}
											onclick={() => togglePin(ann)}
										>
											<span class="material-icons-round">{ann.pinned ? 'push_pin' : 'keep'}</span>
										</button>
										<button
											class="icon-btn danger"
											title="Eliminar"
											onclick={() => removeAnnouncement(ann)}
										>
											<span class="material-icons-round">delete</span>
										</button>
									</div>
								{/if}
							</header>
							<p class="ann-body">{ann.body}</p>
							<footer class="muted-note">
								Por {ann.author_name || 'Staff'} · {fmtDate(ann.created_at)}
							</footer>
						</article>
					{/each}
				{/if}
			</div>
		</section>

		<!-- ══ Barra lateral de accesos ══ -->
		<aside class="team-side">
			<div class="glass-card panel-card">
				<h2 class="panel-title"><span class="material-icons-round">bolt</span> Herramientas</h2>
				<a class="side-link" href="/studio/emotes">
					<span class="material-icons-round">mood</span>
					<div>
						<strong>Estudio Emotes</strong>
						<span class="muted-note">Crea emotes y stickers para el servidor</span>
					</div>
				</a>
				<a class="side-link" href="/explore">
					<span class="material-icons-round">explore</span>
					<div>
						<strong>Explorar</strong>
						<span class="muted-note">Vigila tendencias y tags</span>
					</div>
				</a>
				{#if staff.permissions.includes('users.view')}
					<a class="side-link" href="/admin/users">
						<span class="material-icons-round">people</span>
						<div>
							<strong>Usuarios</strong>
							<span class="muted-note">Consulta fichas de cualquier cuenta</span>
						</div>
					</a>
				{/if}
			</div>

			<div class="glass-card panel-card">
				<h2 class="panel-title"><span class="material-icons-round">info</span> Tu rol</h2>
				<p class="muted-note">
					Entras con rango <strong>{staff.label}</strong>. Cada acción que realices en el panel
					queda registrada en la auditoría del sistema.
				</p>
			</div>
		</aside>
	</div>
</div>

<style>
	.team-layout {
		display: grid;
		grid-template-columns: 1fr 300px;
		gap: 16px;
		align-items: start;
	}
	@media (max-width: 900px) {
		.team-layout {
			grid-template-columns: 1fr;
		}
	}

	.ann-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 14px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
	}

	.ann-card {
		padding: 14px 16px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
		background: var(--bg-overlay);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.ann-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.ann-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.92rem;
		color: var(--text-primary);
	}
	.pinned-icon {
		font-size: 15px;
		color: var(--aero-amber);
	}
	.ann-body {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-secondary);
		white-space: pre-wrap;
	}
	.row-actions {
		display: flex;
		gap: 6px;
	}

	.team-side {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.side-link {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 11px 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
		background: var(--bg-overlay);
		text-decoration: none;
		color: var(--text-primary);
		font-size: 0.86rem;
		transition: all var(--t-base);
	}
	.side-link:hover {
		border-color: var(--aero-sky);
		transform: translateY(-1px);
	}
	.side-link .material-icons-round {
		font-size: 20px;
		color: var(--aero-sky);
		flex-shrink: 0;
	}
	.side-link div {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
</style>
