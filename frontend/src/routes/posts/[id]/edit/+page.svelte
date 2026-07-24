<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { posts as postsApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';

	let post = $state(null);
	let bodyText = $state('');
	let privacy = $state('public');
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let success = $state('');
	let showDeleteConfirm = $state(false);
	let deleting = $state(false);

	const postId = $derived(page.params.id);

	onMount(async () => {
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}
		try {
			const data = await postsApi.get(postId);
			post = data.post;
			if (post.user_id !== authStore.user?.id && !authStore.isAdmin) {
				goto('/feed');
				return;
			}
			bodyText = post.body || post.content || '';
			privacy = post.privacy || 'public';
		} catch (_err) {
			error = 'No se pudo cargar la publicacion.';
		} finally {
			loading = false;
		}
	});

	async function handleSave() {
		if (!bodyText.trim() || saving) return;
		saving = true;
		error = '';
		success = '';
		try {
			await postsApi.update(postId, { body: bodyText.trim(), privacy });
			success = 'Publicacion actualizada con exito.';
			setTimeout(() => goto(`/feed`), 1200);
		} catch (err) {
			error = err?.message || 'Error al guardar.';
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (deleting) return;
		deleting = true;
		try {
			await postsApi.delete(postId);
			goto('/feed');
		} catch (err) {
			error = err?.message || 'Error al eliminar.';
			deleting = false;
		}
	}
</script>

<svelte:head><title>Editar Post — VSocial</title></svelte:head>

<div class="edit-container">
	<div class="edit-card glass-panel">
		<div class="edit-header">
			<a href="/feed" class="back-link"><span class="material-icons-round">arrow_back</span></a>
			<h1 class="edit-title">Editar Publicacion</h1>
			<button
				class="btn-aero-primary save-btn"
				disabled={!bodyText.trim() || saving}
				onclick={handleSave}
			>
				{#if saving}
					<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;"></span>
				{:else}
					<span class="material-icons-round" style="font-size:16px">check</span>
				{/if}
				Guardar
			</button>
		</div>

		{#if error}
			<div class="alert alert-error">
				<span class="material-icons-round">error_outline</span>{error}
			</div>
		{/if}
		{#if success}
			<div class="alert alert-success">
				<span class="material-icons-round">check_circle</span>{success}
			</div>
		{/if}

		{#if loading}
			<div class="loading-state">
				<span class="loading loading-spinner"></span>
				<span>Cargando publicacion...</span>
			</div>
		{:else if post}
			<div class="post-meta">
				<span class="meta-author">@{post.username}</span>
				<span class="meta-dot">·</span>
				<span class="meta-date"
					>{new Date(post.created_at).toLocaleDateString('es', {
						day: 'numeric',
						month: 'short',
						year: 'numeric'
					})}</span
				>
			</div>

			<textarea
				bind:value={bodyText}
				class="edit-textarea"
				rows="6"
				placeholder="Escribe tu publicacion..."
			></textarea>

			{#if post.media && post.media.length > 0}
				<div class="media-preview">
					<span class="option-label">Medios adjuntos ({post.media.length})</span>
					<div class="media-grid">
						{#each post.media as m}
							<div class="media-thumb">
								{#if m.media_type === 'video'}
									<span class="material-icons-round">videocam</span>
								{:else}
									<img src={m.media_url} alt="" />
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="edit-options">
				<div class="option-group">
					<label class="option-label" for="privacy-select">Privacidad</label>
					<select id="privacy-select" bind:value={privacy} class="privacy-select">
						<option value="public">Publico</option>
						<option value="followers">Solo seguidores</option>
						<option value="private">Privado</option>
					</select>
				</div>
			</div>

			<div class="danger-zone">
				{#if !showDeleteConfirm}
					<button
						class="btn-aero-danger"
						onclick={() => (showDeleteConfirm = true)}
						style="padding:8px 16px;font-size:0.8rem;"
					>
						<span class="material-icons-round" style="font-size:16px">delete</span> Eliminar publicacion
					</button>
				{:else}
					<div class="delete-confirm">
						<p class="confirm-text">
							Esta accion es irreversible. Seguro que deseas eliminar esta publicacion?
						</p>
						<div class="confirm-actions">
							<button
								class="btn-aero-secondary"
								onclick={() => (showDeleteConfirm = false)}
								style="padding:6px 14px;font-size:0.8rem;">Cancelar</button
							>
							<button
								class="btn-aero-danger"
								onclick={handleDelete}
								disabled={deleting}
								style="padding:6px 14px;font-size:0.8rem;"
							>
								{#if deleting}Eliminando...{:else}Si, eliminar{/if}
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.edit-container {
		max-width: 640px;
		margin: 0 auto;
		padding: 24px 16px;
	}
	.edit-card {
		padding: 24px;
		border-radius: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.edit-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.back-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		color: var(--text-secondary);
		text-decoration: none;
		transition: all 0.2s;
	}
	.back-link:hover {
		background: var(--bg-overlay);
		color: var(--aero-blue);
	}
	.edit-title {
		flex: 1;
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}
	.save-btn {
		padding: 8px 20px;
		font-size: 0.85rem;
	}
	.alert {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 12px;
		font-size: 0.8rem;
		font-weight: 600;
	}
	.alert-error {
		background: rgba(232, 74, 114, 0.08);
		border: 1px solid rgba(232, 74, 114, 0.2);
		color: var(--aero-rose);
	}
	.alert-success {
		background: rgba(61, 199, 154, 0.08);
		border: 1px solid rgba(61, 199, 154, 0.2);
		color: var(--aero-mint);
	}
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 40px;
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	.post-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
	}
	.meta-author {
		color: var(--aero-blue);
		font-weight: 700;
	}
	.meta-dot {
		color: var(--text-muted);
	}
	.meta-date {
		color: var(--text-muted);
	}
	.edit-textarea {
		width: 100%;
		min-height: 120px;
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		border-radius: 14px;
		padding: 14px;
		font-family: var(--font-sans);
		font-size: 1rem;
		color: var(--text-primary);
		resize: vertical;
		outline: none;
		line-height: 1.5;
		transition: border-color 0.3s;
	}
	.edit-textarea:focus {
		border-color: var(--aero-sky);
		box-shadow: 0 0 0 3px rgba(74, 171, 223, 0.12);
	}
	.option-label {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 4px;
		display: block;
	}
	.media-preview {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.media-grid {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.media-thumb {
		width: 64px;
		height: 64px;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--glass-border);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--glass-bg);
		color: var(--text-muted);
	}
	.media-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.edit-options {
		display: flex;
		gap: 16px;
		align-items: center;
		flex-wrap: wrap;
		padding-top: 8px;
		border-top: 1px solid var(--border-subtle);
	}
	.option-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.privacy-select {
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		border-radius: 8px;
		padding: 6px 10px;
		font-size: 0.8rem;
		color: var(--text-primary);
		outline: none;
		cursor: pointer;
	}
	.danger-zone {
		padding-top: 16px;
		border-top: 1px solid rgba(232, 74, 114, 0.15);
	}
	.delete-confirm {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.confirm-text {
		font-size: 0.85rem;
		color: var(--aero-rose);
		margin: 0;
		font-weight: 600;
	}
	.confirm-actions {
		display: flex;
		gap: 10px;
	}
	.loading-spinner {
		display: inline-block;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.75s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
