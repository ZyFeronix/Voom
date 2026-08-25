<script>
	/**
	 * ProfileBlocks — renderiza los bloques personalizados (blocks_layout) del
	 * perfil: bio, enlaces, mini-feed y galería de fotos.
	 *
	 * Es un componente compartido: lo usan el perfil público (/u/[username]) y
	 * el lienzo del editor (/settings/design), de modo que el preview del
	 * editor ES exactamente lo que se renderiza en el perfil real.
	 *
	 * Seguridad: el contenido de texto se renderiza como texto plano (nunca
	 * {@html}); los enlaces solo se convierten en <a> si son https válidos.
	 */
	import { users as usersApi } from '$lib/api.js';

	let {
		username = '',
		blocks = [],
		feedLimit = 3,
		highlightId = null,
		class: className = ''
	} = $props();

	let activeBlocks = $derived((Array.isArray(blocks) ? blocks : []).filter((b) => b && b.enabled));
	let needsPosts = $derived(activeBlocks.some((b) => b.type === 'feed' || b.type === 'photos'));

	let posts = $state([]);
	let postsLoading = $state(false);
	let postsLoaded = $state(false);

	$effect(() => {
		if (!needsPosts || !username || postsLoaded) return;
		postsLoaded = true;
		postsLoading = true;
		usersApi
			.posts(username, { limit: '12' })
			.then((res) => {
				posts = res?.posts ?? [];
			})
			.catch(() => {
				posts = [];
			})
			.finally(() => {
				postsLoading = false;
			});
	});

	let feedPosts = $derived(
		posts.slice(0, feedLimit).map((p) => ({
			id: p.id,
			body: String(p.body ?? '').slice(0, 220),
			created_at: p.created_at,
			like_count: p.like_count ?? 0,
			comment_count: p.comment_count ?? 0,
			thumb:
				p.media?.find((m) => m.media_type === 'image')?.media_url || p.media?.[0]?.media_url || ''
		}))
	);

	let photoUrls = $derived.by(() => {
		const urls = [];
		for (const post of posts) {
			for (const m of post.media || []) {
				if (m.media_type === 'image' && m.media_url) {
					urls.push({ url: m.media_url, postId: post.id });
					if (urls.length >= 9) return urls;
				}
			}
		}
		return urls;
	});

	function safeHref(url) {
		return /^https:\/\/\S+$/i.test(String(url ?? '')) ? String(url).trim() : null;
	}

	function formatDate(value) {
		try {
			return new Date(value + 'Z').toLocaleDateString('es-ES', {
				day: 'numeric',
				month: 'short'
			});
		} catch {
			return '';
		}
	}
</script>

{#if activeBlocks.length}
	<div class="profile-blocks {className}" aria-label="Secciones personalizadas del perfil">
		{#each activeBlocks as block (block.id)}
			{#if block.type === 'bio'}
				<section
					class="pb-card glass-card pb-bio"
					data-block-id={block.id}
					class:is-highlighted={highlightId === block.id}
				>
					<h3 class="pb-title">
						<span class="material-icons-round" aria-hidden="true">notes</span>
						Sobre mí
					</h3>
					<p class="pb-bio-text">{block.content || ''}</p>
				</section>
			{:else if block.type === 'links'}
				<section
					class="pb-card glass-card pb-links"
					aria-label="Mis enlaces"
					data-block-id={block.id}
					class:is-highlighted={highlightId === block.id}
				>
					<h3 class="pb-title">
						<span class="material-icons-round" aria-hidden="true">link</span>
						Mis enlaces
					</h3>
					<div class="pb-links-grid">
						{#each block.links ?? [] as link, i (i)}
							{@const href = safeHref(link.url)}
							{#if href}
								<a class="pb-link-chip" {href} target="_blank" rel="noopener noreferrer nofollow">
									<span class="material-icons-round" aria-hidden="true">open_in_new</span>
									{link.title || href}
								</a>
							{:else if link.title}
								<span class="pb-link-chip is-static">{link.title}</span>
							{/if}
						{/each}
						{#if !(block.links ?? []).length}
							<p class="pb-empty">Sin enlaces todavía.</p>
						{/if}
					</div>
				</section>
			{:else if block.type === 'feed'}
				<section
					class="pb-card glass-card pb-feed"
					data-block-id={block.id}
					class:is-highlighted={highlightId === block.id}
				>
					<h3 class="pb-title">
						<span class="material-icons-round" aria-hidden="true">dynamic_feed</span>
						Últimas publicaciones
					</h3>
					{#if postsLoading && !feedPosts.length}
						<div class="pb-skeleton-list">
							{#each Array(2) as _, i (i)}
								<div class="pb-skeleton-row">
									<div class="pb-skeleton-avatar"></div>
									<div class="pb-skeleton-lines"><span></span><span></span></div>
								</div>
							{/each}
						</div>
					{:else if !feedPosts.length}
						<p class="pb-empty">Aún no hay publicaciones.</p>
					{:else}
						<ul class="pb-feed-list">
							{#each feedPosts as post (post.id)}
								<li>
									<a class="pb-feed-item" href="/posts/{post.id}">
										{#if post.thumb}
											<img class="pb-feed-thumb" src={post.thumb} alt="" loading="lazy" />
										{/if}
										<div class="pb-feed-body">
											<p class="pb-feed-text">{post.body || '—'}</p>
											<span class="pb-feed-meta">
												<span class="material-icons-round" aria-hidden="true">favorite</span>
												{post.like_count}
												<span class="material-icons-round" aria-hidden="true"
													>chat_bubble_outline</span
												>
												{post.comment_count}
												{#if post.created_at}· {formatDate(post.created_at)}{/if}
											</span>
										</div>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{:else if block.type === 'photos'}
				<section
					class="pb-card glass-card pb-photos"
					data-block-id={block.id}
					class:is-highlighted={highlightId === block.id}
				>
					<h3 class="pb-title">
						<span class="material-icons-round" aria-hidden="true">collections</span>
						Galería
					</h3>
					{#if postsLoading && !photoUrls.length}
						<div class="pb-photo-grid">
							{#each Array(6) as _, i (i)}
								<div class="pb-photo-skeleton"></div>
							{/each}
						</div>
					{:else if !photoUrls.length}
						<p class="pb-empty">Aún no hay fotos que mostrar.</p>
					{:else}
						<div class="pb-photo-grid">
							{#each photoUrls as item, i (item.url + '-' + i)}
								<a class="pb-photo-cell" href="/posts/{item.postId}" title="Ver publicación">
									<img src={item.url} alt="" loading="lazy" />
								</a>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.profile-blocks {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-top: 16px;
	}

	.pb-card {
		padding: 20px 22px;
	}

	/* Resaltado de sincronía con el editor (solo se activa vía prop highlightId) */
	.pb-card.is-highlighted {
		outline: 2px solid var(--accent-blue-base, var(--aero-blue));
		outline-offset: 3px;
	}

	.pb-title {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 12px 0;
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-main);
	}

	.pb-title .material-icons-round {
		font-size: 18px;
		color: var(--accent-blue-base, var(--aero-blue));
	}

	.pb-bio-text {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.65;
		color: var(--text-secondary);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	/* ── Links ── */
	.pb-links-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.pb-link-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 999px;
		background: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.1);
		border: 1px solid rgba(var(--accent-blue-rgb, 27, 133, 243), 0.25);
		color: var(--text-main);
		font-size: 0.85rem;
		font-weight: 600;
		text-decoration: none;
		transition:
			transform 0.15s ease,
			background 0.15s ease;
	}
	a.pb-link-chip:hover {
		transform: translateY(-2px);
		background: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.18);
	}
	.pb-link-chip .material-icons-round {
		font-size: 14px;
		color: var(--accent-blue-base, var(--aero-blue));
	}
	.pb-link-chip.is-static {
		cursor: default;
		opacity: 0.75;
	}

	/* ── Feed ── */
	.pb-feed-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.pb-feed-item {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 12px 14px;
		border-radius: var(--radius-md, 14px);
		background: color-mix(in srgb, var(--bg-surface) 55%, transparent);
		border: 1px solid var(--border-subtle);
		text-decoration: none;
		transition:
			border-color 0.15s ease,
			transform 0.15s ease;
	}
	.pb-feed-item:hover {
		border-color: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.45);
		transform: translateX(3px);
	}
	.pb-feed-thumb {
		width: 52px;
		height: 52px;
		border-radius: 10px;
		object-fit: cover;
		flex-shrink: 0;
	}
	.pb-feed-body {
		min-width: 0;
	}
	.pb-feed-text {
		margin: 0 0 4px 0;
		font-size: 0.88rem;
		line-height: 1.45;
		color: var(--text-main);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.pb-feed-meta {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.pb-feed-meta .material-icons-round {
		font-size: 13px;
	}

	/* ── Photos ── */
	.pb-photo-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
	.pb-photo-cell {
		display: block;
		aspect-ratio: 1;
		border-radius: 10px;
		overflow: hidden;
	}
	.pb-photo-cell img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 0.25s ease;
	}
	.pb-photo-cell:hover img {
		transform: scale(1.06);
	}

	/* ── Estados vacíos / skeletons ── */
	.pb-empty {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-muted);
		font-style: italic;
	}
	.pb-skeleton-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.pb-skeleton-row {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.pb-skeleton-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--text-muted) 20%, transparent);
		animation: pb-pulse 1.4s ease-in-out infinite;
	}
	.pb-skeleton-lines {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.pb-skeleton-lines span {
		height: 10px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-muted) 20%, transparent);
		animation: pb-pulse 1.4s ease-in-out infinite;
	}
	.pb-skeleton-lines span:last-child {
		width: 60%;
	}
	.pb-photo-skeleton {
		aspect-ratio: 1;
		border-radius: 10px;
		background: color-mix(in srgb, var(--text-muted) 20%, transparent);
		animation: pb-pulse 1.4s ease-in-out infinite;
	}
	@keyframes pb-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}

	@media (max-width: 520px) {
		.pb-card {
			padding: 16px;
		}
	}
</style>
