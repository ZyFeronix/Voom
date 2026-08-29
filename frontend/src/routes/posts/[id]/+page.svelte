<script>
	import { goto } from '$app/navigation';
	import PostCard from '$lib/components/PostCard.svelte';
	let { data } = $props();

	// Volver atrás conservando el feed (scroll + posts cargados vía snapshot).
	function goBack() {
		if (history.length > 1) {
			history.back();
		} else {
			goto('/feed');
		}
	}
</script>

<svelte:head>
	<title>Publicación | Voom!</title>
</svelte:head>

<!-- Barra de retroceso sticky (bajo el TopBar global) -->
<div class="post-backbar">
	<button type="button" class="post-back-btn" onclick={goBack} aria-label="Volver al feed">
		<span class="material-icons-round">arrow_back</span>
	</button>
	<div class="post-back-info">
		<span class="post-back-title">Publicación</span>
		{#if data.post?.username}
			<span class="post-back-author">@{data.post.username}</span>
		{/if}
	</div>
</div>

<div class="post-content max-w-2xl mx-auto px-3 sm:px-4 animate-fade-in">
	<PostCard post={data.post} />
</div>

<style>
	/* Barra de retroceso: cristal compacto, pegada bajo el TopBar (58px) */
	.post-backbar {
		position: sticky;
		top: 58px;
		z-index: 40;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		background: color-mix(in srgb, var(--bg-sidebar) 88%, transparent);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border-bottom: 1px solid var(--glass-border-t);
	}
	.post-back-btn {
		flex: 0 0 36px;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-full);
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background var(--t-base),
			border-color var(--t-base),
			transform 0.15s var(--ease-spring);
	}
	.post-back-btn:hover {
		background: var(--bg-surface-hover);
		border-color: rgba(var(--accent-blue-rgb), 0.35);
	}
	.post-back-btn:active {
		transform: scale(0.94);
	}
	.post-back-info {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		min-width: 0;
	}
	.post-back-title {
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-primary);
	}
	.post-back-author {
		font-size: 0.72rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Separación clara bajo la barra de retroceso (CSS propio, no depende de
	   utilidades de Tailwind que el dev server pueda no regenerar). */
	.post-content {
		padding-top: 1.5rem;
		padding-bottom: 2.5rem;
	}
</style>
