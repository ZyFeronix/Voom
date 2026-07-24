<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		feed as feedApi,
		users as usersApi,
		marketplace as marketplaceApi,
		reels as reelsApi
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

	const categories = [
		{ id: 'all', name: 'Todo' },
		{ id: 'gaming', name: 'Gaming' },
		{ id: 'art', name: 'Arte Digital' },
		{ id: 'music', name: 'Música' },
		{ id: 'vtubing', name: 'VTubing' },
		{ id: 'streaming', name: 'Streaming' }
	];

	// Derived: Current search query in URL
	let urlQuery = $derived(page.url.searchParams.get('q') || '');

	// ── Watch URL Query changes ──────────────────────────────────────────────
	$effect(() => {
		searchQuery = urlQuery;
		loadExploreData();
	});

	// ── Lifecycle ────────────────────────────────────────────────────────────
	onMount(() => {
		searchQuery = urlQuery;
		// Let $effect handle the initial load
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
	<title>{urlQuery ? `Buscar: ${urlQuery}` : 'Explorar'} EVSocial</title>
</svelte:head>

<div class="explore-container">
	<!-- Search Header -->
	<div class="glass-card search-header">
		<div class="bubble-decoration"></div>
		<div class="search-header-inner">
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

	<!-- Category Filter Chips -->
	<div class="category-chips">
		{#each categories as cat}
			<button
				onclick={() => selectCategory(cat.id)}
				class="chip"
				class:active={activeCategory === cat.id}
			>
				{cat.name}
			</button>
		{/each}
	</div>

	<!-- Tab selector -->
	<div class="tabs-container">
		{#each [{ id: 'todo', label: 'Todo' }, { id: 'people', label: 'Creadores' }, { id: 'posts', label: 'Publicaciones' }, { id: 'reels', label: 'Reels' }, { id: 'marketplace', label: 'Marketplace' }] as tab}
			<button
				onclick={() => selectTab(tab.id)}
				class="tab-button"
				class:active={activeTab === tab.id}
			>
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
			<div class="results-container">
				<!-- Creators Grid -->
				{#if (activeTab === 'todo' || activeTab === 'people') && creators.length > 0}
					<div>
						<h2 class="section-title">
							<span class="material-icons-round" style="color: var(--primary);">people</span>
							Creadores
						</h2>
						<div class="creators-grid">
							{#each creators as creator}
								<div class="glass-card creator-card">
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
							<span class="material-icons-round" style="color: var(--secondary);">explore</span>
							Publicaciones recomendadas
						</h2>
						<div class="posts-grid">
							{#each posts as post}
								<PostCard {post} onDelete={() => (posts = posts.filter((p) => p.id !== post.id))} />
							{/each}
						</div>
					</div>
				{/if}

				<!-- Marketplace Listings Grid -->
				{#if activeTab === 'marketplace'}
					<div>
						<h2 class="section-title">
							<span class="material-icons-round" style="color: var(--accent);">shopping_bag</span>
							Modelos y Diseños
						</h2>
						{#if marketplaceItems.length === 0}
							<div class="glass-card empty-state">
								<span class="material-icons-round">shopping_bag</span>
								<p>No se encontraron productos en esta categoría.</p>
							</div>
						{:else}
							<div class="market-grid">
								{#each marketplaceItems as item}
									<div class="glass-card market-card">
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
												${item.price} USD
											</span>
										</div>
										<div class="market-info">
											<div>
												<h3 class="market-title">{item.title}</h3>
												<p class="market-desc">{item.description}</p>
											</div>
											<div class="market-footer">
												<span class="seller-tag">Por @{item.seller_username || item.username}</span>
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
							<span class="material-icons-round" style="color: var(--danger);">smart_display</span>
							Reels populares
						</h2>
						{#if reelsList.length === 0}
							<div class="glass-card empty-state">
								<span class="material-icons-round">smart_display</span>
								<p>No hay videos en este momento.</p>
							</div>
						{:else}
							<div class="reels-grid">
								{#each reelsList as reel}
									<a href="/reels" class="reel-card">
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
											<span class="material-icons-round">play_arrow</span>
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
							No pudimos encontrar nada que coincida con tu búsqueda. Revisa la ortografía o intenta
							buscar otro término.
						</p>
					</div>
				{/if}
			</div>
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
		border-radius: 20px;
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
		border-radius: 50%;
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

	.header-title {
		font-size: 2rem;
		font-weight: 900;
		color: var(--text-main);
		margin: 0 0 8px 0;
		text-shadow: 0 2px 10px rgba(0, 119, 255, 0.12);
	}

	.header-subtitle {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0 0 20px 0;
	}

	.search-form {
		display: flex;
		gap: 12px;
		width: 100%;
	}

	.search-input-wrapper {
		position: relative;
		flex: 1;
	}

	.search-input-wrapper :global(.material-icons-round) {
		position: absolute;
		left: 14px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
	}

	.search-input-wrapper input {
		padding-left: 44px;
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
		padding: 8px 18px;
		border-radius: 20px;
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		background: var(--glass-bg);
		color: var(--text-secondary);
		border: 1px solid var(--glass-border);
		cursor: pointer;
		transition: all var(--t-fast);
	}

	.chip:hover {
		background: var(--bg-overlay);
		color: var(--text-primary);
		transform: translateY(-1px);
	}

	.chip.active {
		background: var(--grad-primary);
		color: white;
		font-weight: 700;
		border-color: transparent;
		box-shadow: 0 4px 12px rgba(46, 134, 232, 0.25);
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
		padding: 12px 20px;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-muted);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition: all var(--t-fast);
		white-space: nowrap;
	}

	.tab-button:hover {
		color: var(--text-primary);
	}

	.tab-button.active {
		color: var(--aero-blue);
		font-weight: 700;
		border-bottom-color: var(--aero-blue);
	}

	.loading-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 20px;
	}

	.loading-skeleton {
		padding: 16px;
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.skeleton-media {
		aspect-ratio: 16/9;
		background: var(--border-subtle);
		border-radius: 12px;
		animation: pulse 1.5s infinite ease-in-out;
	}

	.skeleton-line {
		height: 12px;
		background: var(--border-subtle);
		border-radius: 4px;
		animation: pulse 1.5s infinite ease-in-out;
	}

	.skeleton-line.short {
		width: 50%;
	}

	.skeleton-line.long {
		width: 80%;
	}

	@keyframes pulse {
		0% {
			opacity: 0.6;
		}
		50% {
			opacity: 0.3;
		}
		100% {
			opacity: 0.6;
		}
	}

	.results-container {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.section-title {
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--text-main);
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 16px 0;
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
		padding: 16px;
		border-radius: 16px;
		transition: all 0.3s ease;
	}

	.creator-card:hover {
		border-color: rgba(0, 229, 255, 0.3);
		transform: translateY(-2px);
	}

	.creator-info {
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
		min-width: 0;
	}

	.creator-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #000;
		font-weight: bold;
		font-size: 1.2rem;
		flex-shrink: 0;
		overflow: hidden;
	}

	.creator-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
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

	@media (max-width: 768px) {
		.posts-grid {
			grid-template-columns: 1fr;
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
		border-radius: 20px;
		overflow: hidden;
		transition: all 0.3s ease;
		height: 100%;
	}

	.market-card:hover {
		border-color: rgba(0, 229, 255, 0.4);
		box-shadow: 0 4px 15px rgba(0, 119, 255, 0.08);
		transform: translateY(-3px);
	}

	.market-media {
		aspect-ratio: 16/9;
		width: 100%;
		background: rgba(0, 229, 255, 0.1);
		position: relative;
	}

	.market-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
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
		padding: 6px 12px;
		border-radius: 8px;
		background: var(--bg-overlay);
		font-weight: 700;
		font-size: 0.8rem;
		color: var(--aero-rose);
		border: 1px solid var(--border-subtle);
		backdrop-filter: blur(8px);
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
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.reels-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 16px;
	}

	.reel-card {
		border-radius: 16px;
		overflow: hidden;
		aspect-ratio: 9/16;
		position: relative;
		text-decoration: none;
		border: 1px solid rgba(0, 119, 255, 0.1);
		transition: all 0.3s ease;
	}

	.reel-card:hover {
		border-color: rgba(0, 229, 255, 0.4);
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
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.75rem;
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
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 119, 255, 0.08) 100%);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.reel-bg .material-icons-round {
		color: rgba(0, 119, 255, 0.2);
		font-size: 2.5rem;
		transition: transform 0.3s;
	}

	.reel-card:hover .reel-bg .material-icons-round {
		transform: scale(1.15);
		color: var(--text-muted);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px;
		text-align: center;
		border-radius: 20px;
	}

	.empty-state .material-icons-round {
		font-size: 4rem;
		color: rgba(0, 119, 255, 0.15);
		margin-bottom: 16px;
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
