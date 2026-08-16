<script>
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { expoOut } from 'svelte/easing';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		feed as feedApi,
		users as usersApi,
		marketplace as marketplaceApi,
		reels as reelsApi,
		tags as tagsApi
	} from '$lib/api.js';
	import PostCard from '$lib/components/PostCard.svelte';
	import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';

	// ── Runes State ──────────────────────────────────────────────────────────
	let searchQuery = $state('');
	let activeTab = $state('todo'); // 'todo', 'people', 'posts', 'reels', 'marketplace'
	let activeCategory = $state('all');

	let loading = $state(false);
	let creators = $state([]);
	let posts = $state([]);
	let marketplaceItems = $state([]);
	let reelsList = $state([]);

	// Tags reales gestionados por administración (/admin/tags). Cada tag filtra
	// los posts que usan el hashtag #slug en el backend (api/feed explore).
	let exploreTags = $state([]);

	// Definición puramente visual de las pestañas (iconos Material)
	const tabs = [
		{ id: 'todo', label: 'Todo', icon: 'dynamic_feed' },
		{ id: 'people', label: 'Creadores', icon: 'people' },
		{ id: 'posts', label: 'Publicaciones', icon: 'article' },
		{ id: 'reels', label: 'Reels', icon: 'smart_display' },
		{ id: 'marketplace', label: 'Marketplace', icon: 'shopping_bag' }
	];

	// Derived: Current search query in URL
	let urlQuery = $derived(page.url.searchParams.get('q') || '');

	// ── Watch URL Query changes ──────────────────────────────────────────────
	$effect(() => {
		searchQuery = urlQuery;
		loadExploreData();
	});

	// ── Lifecycle ────────────────────────────────────────────────────────────
	onMount(async () => {
		searchQuery = urlQuery;
		// Let $effect handle the initial load
		try {
			const res = await tagsApi.list();
			exploreTags = res.tags || [];
		} catch (err) {
			console.error('Error cargando tags:', err);
		}
	});

	// ── Actions ──────────────────────────────────────────────────────────────
	async function loadExploreData() {
		loading = true;
		try {
			if (searchQuery.trim()) {
				// Search mode
				if (activeTab === 'people' || activeTab === 'todo') {
					const userRes = await usersApi.search(searchQuery);
					creators = userRes.users || [];
				}

				if (activeTab === 'posts' || activeTab === 'todo') {
					const feedRes = await feedApi.explore({
						q: searchQuery,
						category: activeCategory !== 'all' ? activeCategory : undefined
					});
					posts = feedRes.posts || [];
				}

				if (activeTab === 'marketplace') {
					// marketplaceApi.search already implemented in api.js and backend
					const marketRes = await marketplaceApi.search(searchQuery);
					marketplaceItems = marketRes.data || [];
				}
			} else {
				// Normal explore mode: el feed y los creadores sugeridos son independientes → paralelo.
				const [feedRes, userRes] = await Promise.all([
					feedApi.explore({
						category: activeCategory !== 'all' ? activeCategory : undefined
					}),
					usersApi.suggestedCreators()
				]);
				posts = feedRes.posts || [];
				creators = (userRes.users || []).slice(0, 6);

				// Load mock reels/marketplace items for explore content
				if (activeTab === 'reels') {
					const reelsRes = await reelsApi.feed();
					reelsList = reelsRes.data || [];
				}
				if (activeTab === 'marketplace') {
					const marketRes = await marketplaceApi.list();
					marketplaceItems = marketRes.data || [];
				}
			}
		} catch (err) {
			console.error('Error fetching explore data:', err);
		} finally {
			loading = false;
		}
	}

	function handleSearchSubmit(e) {
		e.preventDefault();
		const params = new URLSearchParams(page.url.searchParams);
		if (searchQuery.trim()) {
			params.set('q', searchQuery.trim());
		} else {
			params.delete('q');
		}
		goto(`/explore?${params.toString()}`);
	}

	function selectTab(tab) {
		if (!document.startViewTransition) {
			activeTab = tab;
			loadExploreData();
			return;
		}
		document.startViewTransition(() => {
			activeTab = tab;
			loadExploreData();
		});
	}

	function selectCategory(catId) {
		if (!document.startViewTransition) {
			activeCategory = catId;
			loadExploreData();
			return;
		}
		document.startViewTransition(() => {
			activeCategory = catId;
			loadExploreData();
		});
	}

	async function handleFollow(username) {
		try {
			const idx = creators.findIndex((c) => c.username === username);
			if (idx === -1) return;
			const c = creators[idx];
			if (c.is_following) {
				await usersApi.unfollow(username);
				creators[idx].is_following = false;
			} else {
				await usersApi.follow(username);
				creators[idx].is_following = true;
			}
		} catch (err) {
			console.error(err);
		}
	}
</script>

<svelte:head>
	<title>{urlQuery ? `Buscar: ${urlQuery}` : 'Explorar'} — VSocial</title>
</svelte:head>

<div class="explore-container">
	<!-- Search Header -->
	<div class="glass-card search-header">
		<div class="bubble-decoration"></div>
		<div class="search-header-inner">
			<span class="header-chip">
				<span class="material-icons-round">explore</span>
				Explorar
			</span>
			<h1 class="header-title">Descubre contenido increíble</h1>
			<p class="header-subtitle">
				Busca VTubers, posts de tus temas favoritos, assets de diseño y más.
			</p>

			<form onsubmit={handleSearchSubmit} class="search-form">
				<div class="search-input-wrapper">
					<span class="material-icons-round">search</span>
					<input
						type="text"
						placeholder="Buscar hashtags, creadores, modelos Live2D..."
						bind:value={searchQuery}
						class="aero-input"
					/>
				</div>
				<button type="submit" class="btn-aero-primary">Buscar</button>
			</form>
		</div>
	</div>

	<!-- Category Filter Chips (tags reales desde /api/tags, gestionados en /admin/tags) -->
	<div class="category-chips">
		<button
			onclick={() => selectCategory('all')}
			class="chip"
			class:active={activeCategory === 'all'}
		>
			<span class="material-icons-round">grid_view</span>
			Todo
		</button>
		{#each exploreTags as cat}
			<button
				onclick={() => selectCategory(cat.slug)}
				class="chip"
				class:active={activeCategory === cat.slug}
			>
				<span class="material-icons-round">{cat.icon || 'sell'}</span>
				{cat.name}
			</button>
		{/each}
	</div>

	<!-- Tab selector -->
	<div class="tabs-container">
		{#each tabs as tab}
			<button
				onclick={() => selectTab(tab.id)}
				class="tab-button"
				class:active={activeTab === tab.id}
			>
				<span class="material-icons-round">{tab.icon}</span>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Content Transition Wrapper -->
	<div class="explore-content relative w-full h-full flex flex-col">
		<!-- Loading State -->
		{#if loading}
			<div class="loading-grid">
				{#each Array(3) as _}
					<div class="glass-card loading-skeleton">
						<div class="skeleton-media"></div>
						<div class="skeleton-line short"></div>
						<div class="skeleton-line long"></div>
					</div>
				{/each}
			</div>
		{:else}
			<!-- Results / Content display -->
			{#key `${activeTab}-${activeCategory}`}
				<div class="results-container" in:fly={{ y: 15, duration: 280, easing: expoOut }}>
					<!-- Creators Grid -->
					{#if (activeTab === 'todo' || activeTab === 'people') && creators.length > 0}
						<div>
							<h2 class="section-title">
								<span class="material-icons-round" style="color: var(--aero-blue);">people</span>
								Creadores
							</h2>
							<div class="creators-grid">
								{#each creators as creator, i}
									<div
										class="glass-card creator-card"
										in:fly={{ y: 12, duration: 240, delay: Math.min(i * 30, 180), easing: expoOut }}
									>
										<a href="/u/{creator.username}" class="creator-info">
											<div class="creator-avatar">
												{#if creator.avatar_url}
													<img
														src={creator.avatar_url}
														alt={creator.display_name}
														width="48"
														height="48"
														loading="lazy"
														decoding="async"
													/>
												{:else}
													<span>{creator.display_name[0].toUpperCase()}</span>
												{/if}
											</div>
											<div class="creator-details">
												<p class="creator-name">
													{creator.display_name}
													{#if creator.is_verified}
														<span class="aero-badge-verified">✓</span>
													{/if}
												</p>
												<p class="creator-username">@{creator.username}</p>
												{#if creator.is_vtuber}
													<span
														class="aero-badge-virtual"
														style="margin-top: 4px; align-self: flex-start;">VTuber</span
													>
												{/if}
											</div>
										</a>
										<button
											onclick={() => handleFollow(creator.username)}
											class="btn-aero-secondary btn-sm"
											style="padding: 6px 12px; font-size: 0.75rem;"
										>
											{creator.is_following ? 'Siguiendo' : 'Seguir'}
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Posts List -->
					{#if (activeTab === 'todo' || activeTab === 'posts') && posts.length > 0}
						<div>
							<h2 class="section-title">
								<span class="material-icons-round" style="color: var(--aero-mint);">explore</span>
								Publicaciones recomendadas
							</h2>
							<div class="posts-grid">
								{#each posts as post (post.id)}
									<div in:fade={{ duration: 150 }}>
										<PostCard
											{post}
											onDelete={() => (posts = posts.filter((p) => p.id !== post.id))}
										/>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Marketplace Listings Grid -->
					{#if activeTab === 'marketplace'}
						<div>
							<h2 class="section-title">
								<span class="material-icons-round" style="color: var(--aero-sky);"
									>shopping_bag</span
								>
								Modelos y Diseños
							</h2>
							{#if marketplaceItems.length === 0}
								<div class="glass-card empty-state">
									<span class="material-icons-round">shopping_bag</span>
									<p>No se encontraron productos en esta categoría.</p>
								</div>
							{:else}
								<div class="market-grid">
									{#each marketplaceItems as item, i}
										<div
											class="glass-card market-card"
											in:fly={{
												y: 12,
												duration: 240,
												delay: Math.min(i * 30, 180),
												easing: expoOut
											}}
										>
											<div class="market-media">
												{#if item.media_url || item.image_url}
													<img
														src={getProxiedMediaUrl(item.media_url || item.image_url)}
														alt={item.title}
														class="market-img"
														width="400"
														height="225"
														loading="lazy"
														decoding="async"
														crossorigin="anonymous"
														referrerpolicy="no-referrer"
													/>
												{:else}
													<div class="market-placeholder">
														<span class="material-icons-round">design_services</span>
													</div>
												{/if}
												<span class="price-tag">
													<span class="material-icons-round">sell</span>
													${item.price} USD
												</span>
											</div>
											<div class="market-info">
												<div>
													<h3 class="market-title">{item.title}</h3>
													<p class="market-desc">{item.description}</p>
												</div>
												<div class="market-footer">
													<span class="seller-tag">
														<span class="material-icons-round">storefront</span>
														Por @{item.seller_username || item.username}
													</span>
													<a
														href="/marketplace"
														class="btn-aero-secondary"
														style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none;"
														>Ver oferta</a
													>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Reels List Grid -->
					{#if activeTab === 'reels'}
						<div>
							<h2 class="section-title">
								<span class="material-icons-round" style="color: var(--aero-rose);"
									>smart_display</span
								>
								Reels populares
							</h2>
							{#if reelsList.length === 0}
								<div class="glass-card empty-state">
									<span class="material-icons-round">smart_display</span>
									<p>No hay videos en este momento.</p>
								</div>
							{:else}
								<div class="reels-grid">
									{#each reelsList as reel, i}
										<a
											href="/reels"
											class="reel-card"
											in:fly={{
												y: 12,
												duration: 240,
												delay: Math.min(i * 30, 180),
												easing: expoOut
											}}
										>
											<div class="reel-overlay">
												<div class="reel-likes">
													<span class="material-icons-round">favorite</span>
													<span>{reel.like_count || 0}</span>
												</div>
												<div>
													<p class="reel-author">@{reel.username}</p>
													<p class="reel-desc">{reel.description}</p>
												</div>
											</div>
											<div class="reel-bg">
												{#if reel.thumbnail_url}
													<img
														src={getProxiedMediaUrl(reel.thumbnail_url)}
														alt={reel.description}
														class="reel-thumb"
														loading="lazy"
														decoding="async"
													/>
												{:else if reel.video_url}
													<video
														src={reel.video_url}
														class="reel-thumb"
														muted
														playsinline
														preload="metadata"
													/>
												{/if}
												<span class="reel-play">
													<span class="material-icons-round">play_arrow</span>
												</span>
											</div>
										</a>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Empty State -->
					{#if creators.length === 0 && posts.length === 0 && marketplaceItems.length === 0 && reelsList.length === 0}
						<div class="glass-card empty-state">
							<span class="material-icons-round">search_off</span>
							<h3>Sin resultados</h3>
							<p>
								No pudimos encontrar nada que coincida con tu búsqueda. Revisa la ortografía o
								intenta buscar otro término.
							</p>
						</div>
					{/if}
				</div>
			{/key}
			<!-- end results-container -->
		{/if}
		<!-- end if loading -->
	</div>
	<!-- end explore-content -->
</div>

<!-- end explore-container -->

<style>
	.explore-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 24px 16px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.search-header {
		position: relative;
		overflow: hidden;
		padding: 32px 24px;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.bubble-decoration {
		position: absolute;
		top: -48px;
		left: -48px;
		width: 144px;
		height: 144px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: rgba(0, 229, 255, 0.15);
		filter: blur(40px);
		pointer-events: none;
	}

	.search-header-inner {
		position: relative;
		z-index: 10;
		max-width: 600px;
		width: 100%;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.header-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 14px;
		margin-bottom: 14px;
		border-radius: var(--radius-full);
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
		color: var(--aero-blue);
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		box-shadow: var(--glass-inset);
	}

	.header-chip .material-icons-round {
		font-size: 0.95rem;
	}

	.header-title {
		font-family: var(--font-display);
		font-size: 2.1rem;
		font-weight: 900;
		letter-spacing: -0.02em;
		background: var(--grad-primary);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
		margin: 0 0 8px 0;
	}

	.header-subtitle {
		font-size: 0.88rem;
		color: var(--text-muted);
		max-width: 460px;
		margin: 0 0 22px 0;
	}

	.search-form {
		display: flex;
		gap: 12px;
		width: 100%;
	}

	.search-input-wrapper {
		position: relative;
		flex: 1;
		min-width: 0;
	}

	.search-input-wrapper :global(.material-icons-round) {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		background: var(--bg-overlay);
		color: var(--aero-blue);
		font-size: 1rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.search-input-wrapper input {
		padding-left: 48px;
		width: 100%;
	}

	.category-chips {
		display: flex;
		gap: 10px;
		overflow-x: auto;
		padding-bottom: 4px;
		scrollbar-width: none;
	}

	.category-chips::-webkit-scrollbar {
		display: none;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: var(--radius-full);
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		background: var(--glass-bg);
		color: var(--text-secondary);
		border: 1px solid var(--glass-border);
		cursor: pointer;
		transition:
			transform var(--t-fast),
			box-shadow var(--t-fast),
			background var(--t-fast),
			color var(--t-fast),
			border-color var(--t-fast);
	}

	.chip .material-icons-round {
		font-size: 0.95rem;
		opacity: 0.85;
	}

	.chip:hover {
		background: var(--bg-overlay);
		color: var(--text-primary);
		border-color: rgba(var(--accent-blue-rgb), 0.35);
		transform: translateY(-1px);
	}

	.chip:active {
		transform: translateY(0) scale(0.96);
	}

	.chip.active {
		background: var(--grad-primary);
		color: white;
		font-weight: 700;
		border-color: transparent;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.35),
			0 4px 12px rgba(46, 134, 232, 0.25);
	}

	.chip.active .material-icons-round {
		opacity: 1;
	}

	.tabs-container {
		display: flex;
		border-bottom: 1px solid var(--border-subtle);
		overflow-x: auto;
		scrollbar-width: none;
		gap: 8px;
	}

	.tabs-container::-webkit-scrollbar {
		display: none;
	}

	.tab-button {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 12px 16px;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-muted);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition:
			color var(--t-fast),
			background var(--t-fast);
		white-space: nowrap;
	}

	.tab-button .material-icons-round {
		font-size: 1.05rem;
		opacity: 0.8;
	}

	.tab-button:hover {
		color: var(--text-primary);
		background: var(--bg-overlay);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
	}

	.tab-button::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 16px;
		right: 16px;
		height: 3px;
		border-radius: var(--radius-full) var(--radius-full) 0 0;
		background: var(--grad-primary);
		transform: scaleX(0);
		transform-origin: center;
		transition: transform var(--t-base);
	}

	.tab-button.active {
		color: var(--aero-blue);
		font-weight: 700;
	}

	.tab-button.active::after {
		transform: scaleX(1);
	}

	.tab-button.active .material-icons-round {
		opacity: 1;
	}

	.loading-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 20px;
	}

	.loading-skeleton {
		padding: 16px;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.skeleton-media,
	.skeleton-line {
		position: relative;
		overflow: hidden;
		background: var(--bg-overlay);
	}

	.skeleton-media::after,
	.skeleton-line::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.35) 50%,
			transparent 100%
		);
		transform: translateX(-100%);
		animation: shimmer 1.6s infinite ease-in-out;
	}

	.skeleton-media {
		aspect-ratio: 16/9;
		border-radius: var(--radius-sm);
	}

	.skeleton-line {
		height: 12px;
		border-radius: var(--radius-xs);
	}

	.skeleton-line.short {
		width: 50%;
	}

	.skeleton-line.long {
		width: 80%;
	}

	@keyframes shimmer {
		100% {
			transform: translateX(100%);
		}
	}

	.results-container {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.section-title {
		position: relative;
		padding-left: 14px;
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--text-main);
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 16px 0;
	}

	.section-title::before {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		width: 5px;
		height: 68%;
		border-radius: var(--radius-full);
		background: var(--grad-primary);
	}

	.section-title .material-icons-round {
		width: 30px;
		height: 30px;
		border-radius: var(--radius-sm);
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
	}

	.creators-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
	}

	.creator-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px;
		border-radius: var(--radius-md);
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base),
			border-color var(--t-base);
	}

	.creator-card:hover {
		border-color: rgba(var(--accent-blue-rgb), 0.35);
		transform: translateY(-2px);
		box-shadow: var(--glass-inset-highlight);
	}

	.creator-info {
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
		min-width: 0;
	}

	.creator-avatar {
		width: 52px;
		height: 52px;
		padding: 2px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: linear-gradient(135deg, var(--aero-sky) 0%, var(--aero-mint) 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-shadow: 0 2px 8px rgba(var(--accent-blue-rgb), 0.18);
	}

	.creator-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: calc(var(--radius-squircle) - 1px);
		corner-shape: squircle;
	}

	.creator-avatar > span {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--grad-primary);
		border-radius: calc(var(--radius-squircle) - 1px);
		corner-shape: squircle;
		color: #fff;
		font-weight: 700;
		font-size: 1.1rem;
	}

	.creator-details {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.creator-name {
		font-weight: 700;
		color: var(--text-main);
		font-size: 0.9rem;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.creator-username {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.posts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
		gap: 20px;
	}

	/* ── Optimización visual de las PostCard dentro del grid de /explore ──
	   PostCard declara margin-bottom: 2rem (diseñado para el feed en columna);
	   dentro de un grid eso dobla el espaciado entre filas y desalinea las
	   tarjetas. Aquí se neutraliza y se adapta la tarjeta al contexto grid
	   SIN tocar el componente compartido (el feed conserva su estilo). */
	.explore-container :global(.posts-grid .aero-post-card) {
		margin-bottom: 0;
		border-radius: var(--radius-md);
	}

	/* Hover coherente con el resto de tarjetas de /explore (micro-interacción
	   barata: transform + borde, sin blur ni efectos costosos) */
	.explore-container :global(.posts-grid .aero-post-card:hover) {
		border-color: rgba(var(--accent-blue-rgb), 0.35);
		box-shadow: var(--glass-inset-highlight);
	}

	/* Entrada en cascada al renderizar la lista (opacity + transform puro,
	   compositor-only: no repinta ni añade blur) */
	.explore-container :global(.posts-grid .animate-slide-in-up) {
		animation: explore-post-rise 0.4s var(--ease-out) both;
		animation-delay: 0s;
	}

	.explore-container :global(.posts-grid .aero-post-card:nth-child(2)) {
		animation-delay: 0.06s;
	}

	.explore-container :global(.posts-grid .aero-post-card:nth-child(3)) {
		animation-delay: 0.12s;
	}

	.explore-container :global(.posts-grid .aero-post-card:nth-child(4)) {
		animation-delay: 0.18s;
	}

	.explore-container :global(.posts-grid .aero-post-card:nth-child(5)) {
		animation-delay: 0.24s;
	}

	.explore-container :global(.posts-grid .aero-post-card:nth-child(n + 6)) {
		animation-delay: 0.3s;
	}

	@keyframes explore-post-rise {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 768px) {
		/* minmax(0, 1fr) permite que las tarjetas (PostCard con media de ancho
		   intrínseco grande) se encojan en vez de desbordar en pantallas ≤340px */
		.posts-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 560px) {
		.explore-container {
			padding: 16px 12px;
			gap: 18px;
		}

		.search-header {
			padding: 24px 16px;
		}

		.header-title {
			font-size: 1.55rem;
		}

		.search-form {
			flex-direction: column;
		}
	}

	.market-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 20px;
	}

	.market-card {
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-md);
		overflow: hidden;
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base),
			border-color var(--t-base);
		height: 100%;
	}

	.market-card:hover {
		border-color: rgba(var(--accent-blue-rgb), 0.4);
		box-shadow:
			0 10px 24px rgba(var(--accent-blue-rgb), 0.12),
			var(--glass-inset-highlight);
		transform: translateY(-3px);
	}

	.market-media {
		aspect-ratio: 16/9;
		width: 100%;
		background: rgba(0, 229, 255, 0.1);
		position: relative;
		overflow: hidden;
	}

	.market-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform var(--t-slow);
	}

	.market-card:hover .market-img {
		transform: scale(1.04);
	}

	.market-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 119, 255, 0.06) 100%);
		color: var(--text-muted);
	}

	.price-tag {
		position: absolute;
		top: 12px;
		right: 12px;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px;
		border-radius: var(--radius-full);
		background: var(--bg-overlay);
		font-weight: 700;
		font-size: 0.78rem;
		color: var(--aero-rose);
		border: 1px solid rgba(236, 72, 153, 0.35);
		backdrop-filter: blur(8px);
		box-shadow: 0 2px 10px rgba(236, 72, 153, 0.15);
	}

	.price-tag .material-icons-round {
		font-size: 0.9rem;
	}

	.market-info {
		padding: 16px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		flex: 1;
		gap: 16px;
	}

	.market-title {
		font-weight: 700;
		color: var(--text-main);
		font-size: 1rem;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.market-desc {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 4px 0 0 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.market-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-top: 1px solid rgba(0, 119, 255, 0.1);
		padding-top: 12px;
	}

	.seller-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.seller-tag .material-icons-round {
		font-size: 0.85rem;
		opacity: 0.8;
	}

	.reels-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 16px;
	}

	.reel-card {
		border-radius: var(--radius-md);
		overflow: hidden;
		aspect-ratio: 9/16;
		position: relative;
		text-decoration: none;
		border: 1px solid rgba(var(--accent-blue-rgb), 0.15);
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base),
			border-color var(--t-base);
	}

	.reel-card:hover {
		border-color: rgba(var(--accent-blue-rgb), 0.45);
		box-shadow: 0 8px 20px rgba(var(--accent-blue-rgb), 0.18);
		transform: translateY(-2px);
	}

	.reel-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgba(0, 0, 0, 0.85) 0%,
			rgba(0, 0, 0, 0) 50%,
			rgba(0, 0, 0, 0.4) 100%
		);
		z-index: 10;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 12px;
	}

	.reel-likes {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		gap: 5px;
		padding: 4px 10px;
		border-radius: var(--radius-full);
		background: rgba(0, 0, 0, 0.35);
		backdrop-filter: blur(6px);
		font-size: 0.75rem;
		font-weight: 600;
		color: #fff;
	}

	.reel-likes :global(.material-icons-round) {
		font-size: 0.85rem;
		color: var(--aero-rose);
	}

	.reel-author {
		font-weight: 700;
		font-size: 0.8rem;
		color: #fff;
		margin: 0;
	}

	.reel-desc {
		font-size: 0.7rem;
		color: rgba(255, 255, 255, 0.85);
		margin: 2px 0 0 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.reel-bg {
		position: relative;
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 119, 255, 0.08) 100%);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.reel-thumb {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.reel-play {
		position: relative;
		z-index: 2;
		width: 52px;
		height: 52px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
		transition: transform var(--t-spring);
	}

	.reel-play .material-icons-round {
		color: var(--aero-blue);
		font-size: 1.9rem;
		margin-left: 3px; /* compensa el centrado óptico del icono play */
	}

	.reel-card:hover .reel-play {
		transform: scale(1.12);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px;
		text-align: center;
		border-radius: var(--radius-md);
	}

	.empty-state .material-icons-round {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-full);
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
		box-shadow: var(--glass-inset);
		color: var(--aero-blue);
		font-size: 1.7rem;
		margin-bottom: 18px;
	}

	.empty-state h3 {
		font-size: 1.2rem;
		color: var(--text-main);
		margin: 0 0 8px 0;
	}

	.empty-state p {
		font-size: 0.8rem;
		color: var(--text-muted);
		max-width: 360px;
		margin: 0;
	}
</style>
