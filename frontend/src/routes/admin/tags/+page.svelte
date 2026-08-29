<script>
	import { onMount } from 'svelte';
	import { tags as tagsApi } from '$lib/api.js';
	import { uiStore } from '$lib/stores/ui.svelte.js';
	import CustomSelect from '$lib/components/CustomSelect.svelte';

	const ICON_OPTIONS = [
		{ value: 'sell', label: 'Etiqueta' },
		{ value: 'sports_esports', label: 'Gaming' },
		{ value: 'palette', label: 'Arte' },
		{ value: 'music_note', label: 'Música' },
		{ value: 'auto_awesome', label: 'VTubing' },
		{ value: 'live_tv', label: 'Streaming' },
		{ value: 'movie', label: 'Cine' },
		{ value: 'photo_camera', label: 'Fotografía' },
		{ value: 'code', label: 'Código' },
		{ value: 'school', label: 'Educación' },
		{ value: 'fitness_center', label: 'Fitness' },
		{ value: 'restaurant', label: 'Comida' },
		{ value: 'pets', label: 'Mascotas' },
		{ value: 'favorite', label: 'Favorito' },
		{ value: 'star', label: 'Destacado' },
		{ value: 'videogame_asset', label: 'Videojuegos' },
		{ value: 'brush', label: 'Diseño' },
		{ value: 'mic', label: 'Podcast' },
		{ value: 'headphones', label: 'Audio' },
		{ value: 'public', label: 'Mundo' },
		{ value: 'rocket_launch', label: 'Lanzamiento' },
		{ value: 'science', label: 'Ciencia' },
		{ value: 'memory', label: 'Tecnología' },
		{ value: 'architecture', label: 'Arquitectura' }
	];

	let tags = $state([]);
	let loading = $state(true);
	let saving = $state(false);
	let errorMsg = $state('');
	let okMsg = $state('');

	// Formulario de creación
	let newName = $state('');
	let newIcon = $state('sell');

	// Edición inline
	let editingId = $state(null);
	let editName = $state('');
	let editIcon = $state('sell');

	async function loadTags() {
		loading = true;
		errorMsg = '';
		try {
			const res = await tagsApi.list();
			tags = res.tags || [];
		} catch (err) {
			errorMsg = err.message || 'No se pudieron cargar los tags';
		} finally {
			loading = false;
		}
	}

	onMount(loadTags);

	async function createTag() {
		if (!newName.trim()) {
			errorMsg = 'Escribe un nombre para el tag';
			return;
		}
		saving = true;
		errorMsg = '';
		okMsg = '';
		try {
			await tagsApi.create({ name: newName.trim(), icon: newIcon });
			okMsg = 'Tag creado correctamente';
			newName = '';
			newIcon = 'sell';
			await loadTags();
		} catch (err) {
			errorMsg = err.message || 'No se pudo crear el tag';
		} finally {
			saving = false;
		}
	}

	function startEdit(tag) {
		editingId = tag.id;
		editName = tag.name;
		editIcon = tag.icon || 'sell';
		errorMsg = '';
		okMsg = '';
	}

	async function saveEdit(tag) {
		if (!editName.trim()) {
			errorMsg = 'El nombre no puede estar vacío';
			return;
		}
		saving = true;
		errorMsg = '';
		okMsg = '';
		try {
			await tagsApi.update(tag.id, { name: editName.trim(), icon: editIcon });
			okMsg = 'Tag actualizado';
			editingId = null;
			await loadTags();
		} catch (err) {
			errorMsg = err.message || 'No se pudo actualizar el tag';
		} finally {
			saving = false;
		}
	}

	async function removeTag(tag) {
		const ok = await uiStore.requestConfirm({
			title: 'Eliminar tag',
			message: `¿Eliminar el tag "${tag.name}"? Los hashtags #${tag.slug} en los posts no se tocan.`,
			danger: true,
			confirmText: 'Eliminar'
		});
		if (!ok) return;
		saving = true;
		errorMsg = '';
		okMsg = '';
		try {
			await tagsApi.remove(tag.id);
			okMsg = 'Tag eliminado';
			await loadTags();
		} catch (err) {
			errorMsg = err.message || 'No se pudo eliminar el tag';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Tags | Voom! Admin</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title"><span class="material-icons-round">sell</span> Tags</h1>
	<p class="page-subtitle">
		Crea los tags que aparecen en /explore. Cada tag filtra los posts que usan el hashtag #slug (ej.
		#gaming).
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
			{okMsg}
		</div>
	{/if}

	<!-- Formulario de creación -->
	<div class="glass-card create-card">
		<h2 class="card-title">Crear tag</h2>
		<div class="create-row">
			<div class="field">
				<label class="field-label" for="tag-name">Nombre</label>
				<input
					id="tag-name"
					type="text"
					placeholder="Ej. Arte Digital"
					bind:value={newName}
					class="aero-input"
					onkeydown={(e) => e.key === 'Enter' && createTag()}
				/>
			</div>
			<div class="field">
				<span class="field-label">Icono</span>
				<CustomSelect options={ICON_OPTIONS} bind:value={newIcon} />
			</div>
			<button class="btn-aero-primary create-btn" onclick={createTag} disabled={saving}>
				{#if saving}
					<span class="material-icons-round spin">sync</span>
				{:else}
					<span class="material-icons-round">add</span>
				{/if}
				<span>Crear Tag</span>
			</button>
		</div>
	</div>

	<!-- Listado -->
	<div class="glass-card table-card">
		{#if loading && tags.length === 0}
			<div style="padding:20px">
				{#each Array(4) as _, i (i)}
					<div class="skeleton-shimmer skeleton-row"></div>
				{/each}
			</div>
		{:else if tags.length === 0}
			<div class="empty-state">
				<span class="material-icons-round">sell</span>
				<p>Todavía no hay tags. Crea el primero con el formulario de arriba.</p>
			</div>
		{:else}
			<div class="table-responsive">
				<table class="aero-table">
					<thead>
						<tr>
							<th>Icono</th>
							<th>Nombre</th>
							<th>Slug / Hashtag</th>
							<th style="text-align:center">Posts</th>
							<th style="text-align:right">Acciones</th>
						</tr>
					</thead>
					<tbody>
						{#each tags as tag}
							<tr>
								{#if editingId === tag.id}
									<td colspan="5">
										<div class="edit-row">
											<span class="material-icons-round edit-icon">{editIcon || 'sell'}</span>
											<input
												type="text"
												bind:value={editName}
												class="aero-input edit-name"
												placeholder="Nombre del tag"
												onkeydown={(e) => e.key === 'Enter' && saveEdit(tag)}
											/>
											<CustomSelect
												options={ICON_OPTIONS}
												bind:value={editIcon}
												fullWidth={false}
											/>
											<button
												class="btn-aero-primary btn-sm"
												onclick={() => saveEdit(tag)}
												disabled={saving}
											>
												Guardar
											</button>
											<button class="btn-aero-secondary btn-sm" onclick={() => (editingId = null)}>
												Cancelar
											</button>
										</div>
									</td>
								{:else}
									<td>
										<span class="tag-icon">
											<span class="material-icons-round">{tag.icon || 'sell'}</span>
										</span>
									</td>
									<td class="tag-name-cell">{tag.name}</td>
									<td>
										<code class="tag-slug">#{tag.slug}</code>
									</td>
									<td style="text-align:center">
										<span class="post-count">{tag.post_count ?? 0}</span>
									</td>
									<td>
										<div style="display:flex; gap:6px; justify-content:flex-end">
											<button class="icon-btn" title="Editar tag" onclick={() => startEdit(tag)}>
												<span class="material-icons-round">edit</span>
											</button>
											<button
												class="icon-btn danger"
												title="Eliminar tag"
												onclick={() => removeTag(tag)}
											>
												<span class="material-icons-round">delete</span>
											</button>
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<style>
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
		min-width: 180px;
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

	.tag-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: var(--radius-sm);
		background: var(--bg-input-tint, var(--bg-overlay));
		color: var(--aero-sky);
		font-size: 18px;
		border: 1px solid var(--glass-border);
	}
	.tag-name-cell {
		font-weight: 600;
	}
	.tag-slug {
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-xs);
		padding: 3px 8px;
		font-size: 0.78rem;
		color: var(--aero-mint);
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

	.edit-row {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.edit-icon {
		color: var(--aero-sky);
		font-size: 20px;
	}
	.edit-name {
		flex: 1;
		min-width: 160px;
		max-width: 260px;
		padding: 8px 12px;
	}
</style>
