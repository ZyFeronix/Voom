<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { posts as postsApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';
	import QuoteCard from '$lib/components/QuoteCard.svelte';

	const privacyOptions = [
		{ value: 'public', label: 'Público', icon: 'public' },
		{ value: 'followers', label: 'Solo seguidores', icon: 'group' },
		{ value: 'private', label: 'Privado', icon: 'lock' }
	];

	const MAX_CHARS = 3000;

	let post = $state(null);
	let bodyText = $state('');
	let privacy = $state('public');
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let success = $state('');
	let showDeleteConfirm = $state(false);
	let deleting = $state(false);

	// ── Reordenamiento de medios (portada / primera imagen) ──
	let mediaList = $state([]); // [{ id, media_type, media_url }] en orden de visualización
	let dragMediaIndex = $state(-1);
	let dragOverIndex = $state(-1);

	const postId = $derived(page.params.id);
	const charCount = $derived(bodyText.length);
	const charPercentage = $derived(Math.min(100, (charCount / MAX_CHARS) * 100));
	const charColor = $derived(
		charCount > MAX_CHARS ? '#f43f5e' : charCount > MAX_CHARS * 0.9 ? '#f59e0b' : '#38bdf8'
	);
	const privacyLabel = $derived(
		post?.is_anonymous
			? 'Anónima'
			: privacyOptions.find((o) => o.value === privacy)?.label || 'Público'
	);

	onMount(async () => {
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}
		try {
			const data = await postsApi.get(postId);
			post = data.post;
			if (
				!post.is_author &&
				Number(post.user_id) !== Number(authStore.user?.id) &&
				!authStore.isAdmin
			) {
				goto('/feed');
				return;
			}
			bodyText = post.body || post.content || '';
			privacy = post.privacy || 'public';
			mediaList = (post.media || []).map((m) => ({
				id: m.id,
				media_type: m.media_type,
				media_url: m.media_url
			}));
		} catch (_err) {
			error = 'No se pudo cargar la publicación.';
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
			await postsApi.update(postId, {
				body: bodyText.trim(),
				privacy: post?.is_anonymous ? 'public' : privacy,
				media_order: mediaList.map((m) => m.id)
			});
			success = 'Publicación actualizada con éxito.';
			setTimeout(() => goto(`/posts/${postId}`), 1200);
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

	// ── Drag & Drop: reordenar medios ──
	function handleMediaDragStart(e, idx) {
		dragMediaIndex = idx;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(idx));
		}
	}

	function handleMediaDragOver(e, idx) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		if (dragOverIndex !== idx) dragOverIndex = idx;
	}

	function handleMediaDrop(e, targetIdx) {
		e.preventDefault();
		const fromIdx =
			dragMediaIndex >= 0
				? dragMediaIndex
				: parseInt(e.dataTransfer?.getData('text/plain') || '-1');
		dragMediaIndex = -1;
		dragOverIndex = -1;
		if (fromIdx < 0 || fromIdx === targetIdx || fromIdx >= mediaList.length) return;
		const next = [...mediaList];
		const [moved] = next.splice(fromIdx, 1);
		next.splice(targetIdx, 0, moved);
		mediaList = next;
	}

	function handleMediaDragEnd() {
		dragMediaIndex = -1;
		dragOverIndex = -1;
	}
</script>

<svelte:head><title>Editar Publicación — Voom!</title></svelte:head>

<div class="edit-wrapper">
	<!-- Top Bar / Back Navigation -->
	<header class="edit-topbar glass-panel">
		<div class="topbar-left">
			<a href="/feed" class="back-btn" title="Volver al Feed" aria-label="Volver al feed">
				<span class="material-icons-round">arrow_back</span>
			</a>
			<div class="title-group">
				<h1 class="edit-title">
					<span class="title-icon-chip" aria-hidden="true">
						<span class="material-icons-round">edit_note</span>
					</span>
					<span>Editar Publicación</span>
				</h1>
				<div class="edit-subtitle-row">
					<span class="text-xs text-muted">Centro de Autoría Virtual</span>
				</div>
			</div>
		</div>

		<div class="topbar-right">
			<button
				type="button"
				class="btn-aero-primary save-btn"
				disabled={!bodyText.trim() || saving}
				onclick={handleSave}
			>
				{#if saving}
					<span class="loading-spinner"></span>
					<span>Guardando...</span>
				{:else}
					<span class="material-icons-round" style="font-size:16px">check</span>
					<span>Guardar</span>
				{/if}
			</button>
		</div>
	</header>

	<!-- Status Toasts -->
	{#if error}
		<div class="status-toast error-toast animate-slide-in-up" role="status" aria-live="assertive">
			<span class="material-icons-round">error_outline</span>
			<span>{error}</span>
			<button
				type="button"
				class="toast-close"
				onclick={() => (error = '')}
				aria-label="Cerrar aviso"
			>
				<span class="material-icons-round">close</span>
			</button>
		</div>
	{/if}

	{#if success}
		<div class="status-toast success-toast animate-slide-in-up" role="status" aria-live="polite">
			<span class="material-icons-round">check_circle</span>
			<span>{success}</span>
		</div>
	{/if}

	{#if loading}
		<div class="loading-state glass-panel">
			<span class="loading-spinner"></span>
			<span>Cargando publicación...</span>
		</div>
	{:else if post}
		<!-- Author Card -->
		<div class="author-card glass-panel">
			<a class="author-link" href="/u/{post.username}">
				<AeroAvatar
					src={post.is_anonymous ? null : post.avatar_url}
					alt={post.is_anonymous ? 'Anónimo' : post.display_name || post.username}
					size="md"
				/>
				<div class="author-meta">
					<span class="author-name">
						{post.is_anonymous ? 'Autor Anónimo' : post.display_name || post.username}
					</span>
					<span class="author-username">@{post.username}</span>
				</div>
			</a>
			<div class="author-right">
				<span class="privacy-chip" title="Privacidad de la publicación">
					<span class="material-icons-round">
						{post.is_anonymous ? 'visibility_off' : 'public'}
					</span>
					{privacyLabel}
				</span>
				<span class="meta-date"
					>{new Date(post.created_at).toLocaleDateString('es', {
						day: 'numeric',
						month: 'short',
						year: 'numeric'
					})}</span
				>
			</div>
		</div>

		<!-- Content Editor Card -->
		<section class="editor-card glass-panel" aria-label="Editor de contenido">
			<div class="card-heading">
				<span class="material-icons-round card-heading-icon">subject</span>
				<div>
					<h2 class="card-title">Contenido</h2>
					<p class="card-subtitle">Edita el texto de tu publicación</p>
				</div>
			</div>
			<textarea
				bind:value={bodyText}
				class="edit-textarea"
				rows="6"
				maxlength={MAX_CHARS}
				placeholder="Escribe tu publicación..."
			></textarea>
			<div class="char-counter">
				<div class="char-track">
					<div class="char-fill" style="width: {charPercentage}%; background: {charColor}"></div>
				</div>
				<span class="char-num" style="color: {charColor}">{charCount} / {MAX_CHARS}</span>
			</div>
		</section>

		<!-- Post citado (solo lectura: la cita se preserva automáticamente al guardar) -->
		{#if post.quoted_post}
			<section class="quote-card-wrap glass-panel" aria-label="Publicación citada">
				<div class="card-heading">
					<span class="material-icons-round card-heading-icon">format_quote</span>
					<div>
						<h2 class="card-title">Publicación citada</h2>
						<p class="card-subtitle">La cita original se conserva al guardar los cambios</p>
					</div>
				</div>
				<QuoteCard quote={post.quoted_post} />
			</section>
		{/if}

		<!-- Attached Media Card (arrastra para reordenar; el primero es la portada) -->
		{#if mediaList.length > 0}
			<section class="media-card glass-panel" aria-label="Medios adjuntos">
				<div class="card-heading">
					<span class="material-icons-round card-heading-icon">photo_library</span>
					<div>
						<h2 class="card-title">Medios adjuntos</h2>
						<p class="card-subtitle">
							Arrastra para reordenar — el primero es la portada ({mediaList.length}
							{mediaList.length === 1 ? 'archivo' : 'archivos'})
						</p>
					</div>
				</div>
				<div class="media-preview-grid grid-count-{Math.min(4, mediaList.length)}">
					{#each mediaList as m, idx}
						<div
							class="media-thumb-box"
							class:dragging={dragMediaIndex === idx}
							class:drag-over={dragOverIndex === idx && dragMediaIndex !== idx}
							draggable="true"
							role="button"
							tabindex="0"
							title="Arrastra para reordenar"
							ondragstart={(e) => handleMediaDragStart(e, idx)}
							ondragover={(e) => handleMediaDragOver(e, idx)}
							ondrop={(e) => handleMediaDrop(e, idx)}
							ondragend={handleMediaDragEnd}
						>
							{#if m.media_type === 'video'}
								<video src={m.media_url} muted preload="metadata" playsinline></video>
								<span class="video-badge">
									<span class="material-icons-round">play_arrow</span>
								</span>
							{:else}
								<img src={m.media_url} alt={`Medio ${idx + 1}`} loading="lazy" />
							{/if}
							{#if idx === 0}
								<span class="cover-badge">
									<span class="material-icons-round">star</span> Portada
								</span>
							{/if}
							<span class="drag-handle" aria-hidden="true">
								<span class="material-icons-round">drag_indicator</span>
							</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Options Card -->
		<section class="options-card glass-panel" aria-label="Opciones de la publicación">
			<div class="card-heading">
				<span class="material-icons-round card-heading-icon">tune</span>
				<div>
					<h2 class="card-title">Opciones</h2>
					<p class="card-subtitle">Quién puede ver esta publicación</p>
				</div>
			</div>
			<div class="option-group">
				{#if post.is_anonymous}
					<div
						class="anon-privacy-info flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold select-none"
					>
						<span class="material-icons-round">visibility_off</span>
						<span>Público (Publicación Anónima)</span>
					</div>
				{:else}
					<CustomSelect id="privacy-select" bind:value={privacy} options={privacyOptions} />
				{/if}
			</div>
		</section>

		<!-- Danger Zone -->
		<section class="danger-card" aria-label="Zona de peligro">
			<div class="danger-heading">
				<span class="material-icons-round">report</span>
				<div>
					<h2 class="danger-title">Zona de peligro</h2>
					<p class="danger-subtitle">Eliminar esta publicación es irreversible</p>
				</div>
			</div>
			{#if !showDeleteConfirm}
				<button class="btn-aero-danger" onclick={() => (showDeleteConfirm = true)}>
					<span class="material-icons-round">delete</span> Eliminar publicación
				</button>
			{:else}
				<div class="delete-confirm">
					<p class="confirm-text">
						Esta acción es irreversible. ¿Seguro que deseas eliminar esta publicación?
					</p>
					<div class="confirm-actions">
						<button class="btn-aero-secondary" onclick={() => (showDeleteConfirm = false)}>
							Cancelar
						</button>
						<button class="btn-aero-danger" onclick={handleDelete} disabled={deleting}>
							{#if deleting}Eliminando...{:else}Sí, eliminar{/if}
						</button>
					</div>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.edit-wrapper {
		min-height: calc(100vh - 64px);
		max-width: 760px;
		margin: 0 auto;
		padding: 20px 16px 60px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* ── Top Bar ── */
	.edit-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		position: sticky;
		top: 8px;
		z-index: 40;
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-border);
		border-top-color: var(--glass-border-t);
		border-radius: var(--radius-xl);
		padding: 12px 14px;
		background:
			var(--accent-gradient) top left / 100% 2px no-repeat,
			var(--bg-surface);
		box-shadow: var(--glass-inset);
	}
	.topbar-left {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		color: var(--text-primary);
		text-decoration: none;
		transition: all var(--t-fast);
		cursor: pointer;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--glass-inset-highlight);
	}
	.back-btn:hover {
		background: var(--bg-surface-hover);
		transform: translateX(-2px);
		border-color: rgba(var(--accent-blue-rgb), 0.5);
		color: var(--aero-sky);
	}
	.title-group {
		min-width: 0;
	}
	.edit-title {
		font-family: var(--font-display);
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.2;
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 1.2rem;
	}
	.title-icon-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		flex: 0 0 auto;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--grad-primary);
		color: #fff;
		box-shadow: 0 2px 10px rgba(var(--accent-blue-rgb), 0.35);
	}
	.title-icon-chip .material-icons-round {
		font-size: 17px;
	}
	.edit-subtitle-row {
		display: flex;
		align-items: center;
		margin-top: 2px;
	}
	.save-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		font-family: var(--font-display);
		font-size: 0.9rem;
		font-weight: 700;
		white-space: nowrap;
	}
	.save-btn .loading-spinner {
		width: 14px;
		height: 14px;
		border-width: 2px;
	}

	/* ── Toasts ── */
	.status-toast {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		font-size: 0.85rem;
		font-weight: 600;
		border-radius: var(--radius-md);
		box-shadow: 0 8px 24px rgba(2, 12, 27, 0.18);
	}
	.error-toast {
		background: rgba(244, 63, 94, 0.15);
		border: 1px solid rgba(244, 63, 94, 0.35);
		color: #fb7185;
	}
	.success-toast {
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.35);
		color: #34d399;
	}
	.toast-close {
		margin-left: auto;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		display: flex;
	}

	/* ── Loading ── */
	.loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 40px;
		color: var(--text-muted);
		font-size: 0.85rem;
		border-radius: var(--radius-xl);
	}

	/* ── Author Card ── */
	.author-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 16px;
		border-radius: var(--radius-xl);
	}
	.author-link {
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
		min-width: 0;
	}
	.author-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.author-name {
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.author-username {
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.author-right {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 0 0 auto;
	}
	.privacy-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		border-radius: var(--radius-full);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 700;
	}
	.privacy-chip .material-icons-round {
		font-size: 14px;
		color: var(--aero-blue);
	}
	.meta-date {
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
	}

	/* ── Shared card heading ── */
	.card-heading {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.card-heading-icon {
		font-size: 20px;
		color: var(--aero-blue);
		margin-top: 2px;
	}
	.card-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-primary);
	}
	.card-subtitle {
		margin: 2px 0 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	/* ── Editor Card ── */
	.editor-card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 18px 20px;
		border-radius: var(--radius-xl);
	}
	.edit-textarea {
		width: 100%;
		min-height: 150px;
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		padding: 14px;
		font-family: var(--font-sans);
		font-size: 1rem;
		color: var(--text-primary);
		resize: vertical;
		outline: none;
		line-height: 1.55;
		transition:
			border-color 0.3s,
			box-shadow 0.3s;
		box-sizing: border-box;
	}
	.edit-textarea:focus {
		border-color: var(--aero-sky);
		box-shadow: 0 0 0 3px rgba(74, 171, 223, 0.12);
	}
	.char-counter {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.char-track {
		flex: 1;
		height: 4px;
		border-radius: var(--radius-full);
		background: rgba(0, 0, 0, 0.08);
		overflow: hidden;
	}
	:global([data-theme='dark']) .char-track {
		background: rgba(255, 255, 255, 0.08);
	}
	.char-fill {
		height: 100%;
		border-radius: var(--radius-full);
		transition:
			width 0.25s ease,
			background 0.25s ease;
	}
	.char-num {
		font-size: 0.7rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* ── Media Card ── */
	.media-card {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 18px 20px;
		border-radius: var(--radius-xl);
	}
	.media-preview-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.media-preview-grid.grid-count-1 {
		grid-template-columns: 1fr;
	}
	.media-preview-grid.grid-count-3 .media-thumb-box:first-child {
		grid-row: span 2;
	}
	.media-preview-grid.grid-count-4 {
		grid-template-rows: 1fr 1fr;
	}
	.media-thumb-box {
		position: relative;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: #000;
	}
	.media-preview-grid.grid-count-1 .media-thumb-box {
		aspect-ratio: auto;
		max-height: 420px;
	}
	.media-thumb-box img,
	.media-thumb-box video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.media-preview-grid.grid-count-1 .media-thumb-box img,
	.media-preview-grid.grid-count-1 .media-thumb-box video {
		width: auto;
		max-width: 100%;
		height: auto;
		max-height: 420px;
		margin: 0 auto;
	}
	.video-badge {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.25);
		pointer-events: none;
	}
	.video-badge .material-icons-round {
		color: #fff;
		font-size: 34px;
		text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
	}

	/* ── Reordenamiento drag & drop ── */
	.media-thumb-box {
		cursor: grab;
	}
	.media-thumb-box:active {
		cursor: grabbing;
	}
	.media-thumb-box.dragging {
		opacity: 0.45;
		transform: scale(0.97);
	}
	.media-thumb-box.drag-over {
		outline: 3px solid var(--aero-blue, #38bdf8);
		outline-offset: -3px;
		border-radius: var(--radius-sm);
	}
	.cover-badge {
		position: absolute;
		top: 8px;
		left: 8px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px;
		border-radius: var(--radius-full);
		background: rgba(10, 20, 40, 0.7);
		backdrop-filter: blur(6px);
		color: #fff;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		pointer-events: none;
	}
	.cover-badge .material-icons-round {
		font-size: 12px;
		color: #fbbf24;
	}
	.drag-handle {
		position: absolute;
		bottom: 8px;
		right: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-full);
		background: rgba(10, 20, 40, 0.6);
		backdrop-filter: blur(6px);
		color: rgba(255, 255, 255, 0.85);
		pointer-events: none;
	}
	.drag-handle .material-icons-round {
		font-size: 16px;
	}

	/* ── Post citado ── */
	.quote-card-wrap {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 18px 20px;
		border-radius: var(--radius-xl);
	}
	.quote-card-wrap :global(.quote-card) {
		margin: 0;
		width: 100%;
	}

	/* ── Options Card ── */
	.options-card {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 18px 20px;
		border-radius: var(--radius-xl);
	}
	.option-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.anon-privacy-info {
		background: var(--anon-bg, rgba(99, 102, 241, 0.12));
		border: 1px solid var(--anon-border, rgba(99, 102, 241, 0.35));
		color: var(--anon-text, #4338ca);
	}

	/* ── Danger Zone ── */
	.danger-card {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 18px 20px;
		border-radius: var(--radius-xl);
		background: rgba(244, 63, 94, 0.05);
		border: 1px solid rgba(244, 63, 94, 0.18);
	}
	.danger-heading {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.danger-heading .material-icons-round {
		font-size: 20px;
		color: var(--aero-rose, #fb7185);
		margin-top: 2px;
	}
	.danger-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--aero-rose, #fb7185);
	}
	.danger-subtitle {
		margin: 2px 0 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.btn-aero-danger {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 18px;
		border-radius: var(--radius-md);
		font-size: 0.85rem;
		font-weight: 700;
		background: rgba(244, 63, 94, 0.12);
		border: 1px solid rgba(244, 63, 94, 0.35);
		color: var(--aero-rose, #fb7185);
		cursor: pointer;
		transition: all var(--t-fast);
	}
	.btn-aero-danger:hover:not(:disabled) {
		background: rgba(244, 63, 94, 0.2);
		border-color: rgba(244, 63, 94, 0.55);
	}
	.btn-aero-danger:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.delete-confirm {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.confirm-text {
		font-size: 0.85rem;
		color: var(--text-primary);
		margin: 0;
		font-weight: 600;
	}
	.confirm-actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.confirm-actions .btn-aero-secondary,
	.confirm-actions .btn-aero-danger {
		padding: 8px 16px;
		font-size: 0.8rem;
	}

	.loading-spinner {
		display: inline-block;
		width: 18px;
		height: 18px;
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

	/* ── Responsive ── */
	@media (max-width: 576px) {
		.edit-wrapper {
			padding: 12px 12px 60px;
			gap: 12px;
		}
		.edit-topbar {
			position: sticky;
			top: 0;
			padding: 10px 12px;
		}
		.edit-title {
			font-size: 1.05rem;
		}
		.save-btn {
			padding: 9px 14px;
			font-size: 0.85rem;
		}
		.author-card {
			flex-direction: column;
			align-items: flex-start;
		}
		.author-right {
			width: 100%;
			justify-content: space-between;
		}
		.editor-card,
		.media-card,
		.options-card,
		.danger-card {
			padding: 16px;
		}
		.edit-textarea {
			min-height: 130px;
			font-size: 0.95rem;
		}
	}
</style>
