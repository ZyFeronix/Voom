<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	// En /explore la página trae su propio buscador protagonista (hero) y en
	// /marketplace hay un filtro propio "Buscar en la tienda": ocultamos el
	// buscador global ahí para no mostrar dos search bars en la misma pantalla.
	let hideSearch = $derived(
		page.url.pathname.startsWith('/explore') || page.url.pathname.startsWith('/marketplace')
	);

	let searchQuery = $state('');
	let searchFocused = $state(false);
	let searchWrapRef = $state(null);
	let recentSearches = $state([]);
	let searchResults = $state({ users: [], posts: [] });
	let isSearching = $state(false);
	let debounceTimer;

	$effect(() => {
		if (searchQuery.trim().length > 1) {
			isSearching = true;
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(async () => {
				try {
					const res = await fetch(
						`/api/search?q=${encodeURIComponent(searchQuery.trim())}&limit=4`
					);
					if (res.ok) {
						searchResults = await res.json();
					}
				} catch (_e) {
				} finally {
					isSearching = false;
				}
			}, 300);
		} else {
			searchResults = { users: [], posts: [] };
		}

		return () => clearTimeout(debounceTimer);
	});

	function saveToRecent(item) {
		const isString = typeof item === 'string';
		const itemId = isString ? item : item.type === 'user' ? item.username : item.id;

		recentSearches = recentSearches.filter((s) => {
			const sId = typeof s === 'string' ? s : s.type === 'user' ? s.username : s.id;
			return sId !== itemId;
		});

		recentSearches = [item, ...recentSearches].slice(0, 10);
		localStorage.setItem('vs_recent_searches', JSON.stringify(recentSearches));
	}

	function handleSearch(e) {
		if (e.key === 'Enter' && searchQuery.trim()) {
			const term = searchQuery.trim();
			saveToRecent(term);

			goto(`/explore?q=${encodeURIComponent(term)}`);
			searchFocused = false;
			e.target.blur();
		}
	}

	function removeRecent(index, e) {
		e.stopPropagation();
		e.preventDefault();
		recentSearches.splice(index, 1);
		recentSearches = [...recentSearches];
		localStorage.setItem('vs_recent_searches', JSON.stringify(recentSearches));
	}

	function clearRecent(e) {
		e.stopPropagation();
		e.preventDefault();
		recentSearches = [];
		localStorage.setItem('vs_recent_searches', JSON.stringify(recentSearches));
	}

	function triggerSearch(term) {
		saveToRecent(term);
		searchQuery = typeof term === 'string' ? term : '';

		if (typeof term === 'string') {
			goto(`/explore?q=${encodeURIComponent(term)}`);
		} else if (term.type === 'user') {
			goto(`/u/${term.username}`);
		}

		searchFocused = false;
	}

	onMount(() => {
		try {
			const saved = localStorage.getItem('vs_recent_searches');
			if (saved) recentSearches = JSON.parse(saved);
		} catch (_e) {}

		function handleClickOutside(e) {
			if (searchWrapRef && !searchWrapRef.contains(e.target)) {
				searchFocused = false;
			}
		}
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<header class="vs-topbar" class:search-active={searchFocused} class:no-search={hideSearch}>
	<!-- Search -->
	{#if !hideSearch}
		<div class="vs-search-wrap" bind:this={searchWrapRef}>
			<div class="vs-search-inner" class:focused={searchFocused}>
				<span class="material-icons-round vs-search-icon">search</span>
				<input
					type="search"
					id="global_search_input"
					name="global_search_input"
					bind:value={searchQuery}
					onfocus={() => (searchFocused = true)}
					onkeydown={handleSearch}
					placeholder={searchFocused ? 'Buscar' : 'Buscar creadores, posts, hashtags…'}
					class="vs-search-input"
					autocomplete="off"
				/>
			</div>

			{#if searchFocused}
				<div class="vs-search-dropdown glass-panel" transition:fly={{ y: -10, duration: 250 }}>
					{#if searchQuery.trim().length > 1}
						{#if isSearching}
							<div class="vs-search-empty">Buscando...</div>
						{:else if (!searchResults?.users || searchResults.users.length === 0) && (!searchResults?.posts || searchResults.posts.length === 0)}
							<div class="vs-search-empty">No se encontraron resultados para "{searchQuery}"</div>
						{:else}
							{#if searchResults?.users && searchResults.users.length > 0}
								<div class="vs-search-recent-header"><span>Personas</span></div>
								<div class="vs-search-recent-list">
									{#each searchResults.users as user}
										<a
											href={`/u/${user.username}`}
											class="vs-search-recent-item"
											onclick={() => {
												saveToRecent({ type: 'user', ...user });
												searchFocused = false;
											}}
										>
											{#if user.avatar_url}
												<img
													src={user.avatar_url}
													alt={user.username}
													style="width:36px;height:36px;border-radius: var(--radius-squircle); corner-shape: squircle;margin-right:12px;object-fit:cover;border:1px solid var(--border-subtle);"
													width="36"
													height="36"
													loading="lazy"
													decoding="async"
												/>
											{:else}
												<div
													style="width:36px;height:36px;border-radius: var(--radius-squircle); corner-shape: squircle;margin-right:12px;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:bold;border:1px solid rgba(255,255,255,0.2);"
												>
													{(user.display_name || user.username)[0].toUpperCase()}
												</div>
											{/if}
											<div class="vs-search-user-info">
												<span class="vs-search-user-name">{user.display_name || user.username}</span
												>
												<span class="vs-search-user-handle">@{user.username}</span>
											</div>
										</a>
									{/each}
								</div>
							{/if}
							{#if searchResults?.posts && searchResults.posts.length > 0}
								<div
									class="vs-search-recent-header"
									style="margin-top: 12px; border-top: 1px solid var(--border-subtle); padding-top: 12px;"
								>
									<span>Publicaciones</span>
								</div>
								<div class="vs-search-recent-list">
									{#each searchResults.posts as post}
										<a
											href={`/posts/${post.id}`}
											class="vs-search-recent-item"
											onclick={() => (searchFocused = false)}
										>
											<span
												class="material-icons-round text-muted"
												style="font-size: 20px; margin-right: 12px; padding: 6px; background: var(--bg-overlay); border-radius: var(--radius-squircle); corner-shape: squircle;"
												>article</span
											>
											<span class="vs-search-item-text"
												>{post.body.substring(0, 50)}{post.body.length > 50 ? '...' : ''}</span
											>
										</a>
									{/each}
								</div>
							{/if}
							<div class="vs-search-footer">
								<button class="vs-search-view-all" onclick={() => triggerSearch(searchQuery)}>
									Ver todos los resultados para "{searchQuery}"
								</button>
							</div>
						{/if}
					{:else if recentSearches.length === 0}
						<div class="vs-search-empty">Prueba a buscar personas, listas o palabras clave</div>
					{:else}
						<div class="vs-search-recent-header">
							<span>Recientes</span>
							<button class="vs-search-clear-btn" onclick={clearRecent}>Borrar todo</button>
						</div>
						<div class="vs-search-recent-list">
							{#each recentSearches as item, idx}
								{#if typeof item === 'string'}
									<div
										class="vs-search-recent-item"
										role="button"
										tabindex="0"
										onclick={() => triggerSearch(item)}
										onkeydown={(e) => e.key === 'Enter' && triggerSearch(item)}
									>
										<span
											class="material-icons-round text-muted"
											style="font-size: 18px; margin-right: 12px;">search</span
										>
										<span class="vs-search-item-text">{item}</span>
										<button
											class="vs-search-item-remove"
											onclick={(e) => removeRecent(idx, e)}
											title="Eliminar de recientes"
										>
											<span class="material-icons-round" style="font-size: 16px;">close</span>
										</button>
									</div>
								{:else if item.type === 'user'}
									<div
										class="vs-search-recent-item"
										style="position:relative;"
										role="button"
										tabindex="0"
										onclick={() => triggerSearch(item)}
										onkeydown={(e) => e.key === 'Enter' && triggerSearch(item)}
									>
										{#if item.avatar_url}
											<img
												src={item.avatar_url}
												alt={item.username}
												style="width:36px;height:36px;border-radius: var(--radius-squircle); corner-shape: squircle;margin-right:12px;object-fit:cover;border:1px solid var(--border-subtle);"
												width="36"
												height="36"
												loading="lazy"
												decoding="async"
											/>
										{:else}
											<div
												style="width:36px;height:36px;border-radius: var(--radius-squircle); corner-shape: squircle;margin-right:12px;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:bold;border:1px solid rgba(255,255,255,0.2);"
											>
												{(item.display_name || item.username)[0].toUpperCase()}
											</div>
										{/if}
										<div class="vs-search-user-info">
											<span class="vs-search-user-name">{item.display_name || item.username}</span>
											<span class="vs-search-user-handle">@{item.username}</span>
										</div>
										<button
											class="vs-search-item-remove"
											style="position:absolute; right:16px;"
											onclick={(e) => removeRecent(idx, e)}
											title="Eliminar de recientes"
										>
											<span class="material-icons-round" style="font-size: 16px;">close</span>
										</button>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Right actions -->
	<div class="vs-actions">
		<!-- Theme toggle -->
		<ThemeSelector compact={true} align="right" />
	</div>
</header>

<style>
	/* ─── Topbar shell ───────────────────────────── */
	.vs-topbar {
		position: sticky;
		top: 0;
		z-index: 500;
		height: 58px;
		/* Grid de 3 columnas: la del centro (buscador) queda centrada como el
		   boceto y es generosa (520px), con la columna izquierda de balance y
		   las acciones pegadas a la derecha. */
		display: grid;
		grid-template-columns: 1fr minmax(0, 520px) 1fr;
		align-items: center;
		gap: 12px;
		padding: 0 18px;
		background: var(--bg-sidebar);
		backdrop-filter: var(--glass-blur, blur(14px) saturate(1.2));
		border-bottom: 1px solid var(--border-subtle);
		transform: translateZ(0);
		transition:
			border-color var(--t-base),
			background-color var(--t-base);
	}

	:global([data-theme='light']) .vs-topbar {
		background: rgba(240, 252, 255, 0.75);
	}

	:global([data-theme='dark']) .vs-topbar {
		background: rgba(8, 28, 44, 0.65);
	}

	:global([data-theme='midnight']) .vs-topbar {
		background: rgba(4, 10, 20, 0.75);
	}

	/* Sin buscador (/explore trae el suyo en el hero): el grid se colapsa a dos
	   columnas y las acciones pasan a la segunda para no dejar el centro vacío. */
	.vs-topbar.no-search {
		grid-template-columns: 1fr auto;
	}
	.vs-topbar.no-search .vs-actions {
		grid-column: 2;
	}

	/* Sin buscador (/explore tiene el suyo en el hero): 2 columnas y las
	   acciones ancladas a la derecha, sin hueco central vacío. */
	.vs-topbar.no-search {
		grid-template-columns: 1fr auto;
	}
	.vs-topbar.no-search .vs-actions {
		grid-column: 2;
	}

	/* ─── Search ────────────────────────────────── */
	.vs-search-wrap {
		position: relative;
		grid-column: 2;
		width: 100%;
		justify-self: center;
		max-width: 520px;
		transition: flex 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.vs-search-inner {
		position: relative;
		display: flex;
		align-items: center;
		/* Cristal esmerilado: capa translúcida + desenfoque multi-capa */
		background: color-mix(in srgb, var(--bg-input) 85%, transparent);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-border-t);
		border-top-color: color-mix(in srgb, var(--glass-border-t) 75%, #fff);
		border-radius: var(--radius-full);
		box-shadow:
			var(--glass-inset-highlight),
			inset 0 1px 3px rgba(0, 0, 0, 0.04);
		transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
		overflow: hidden;
		height: 40px;
		will-change: transform;
		transform: translateZ(0);
	}
	.vs-search-inner.focused {
		border-color: var(--aero-sky);
		background: var(--bg-surface);
		box-shadow:
			0 0 0 3px rgba(74, 171, 223, 0.2),
			var(--glass-inset-highlight),
			inset 0 1px 3px rgba(0, 0, 0, 0.03);
	}
	.vs-search-icon {
		position: absolute;
		left: 11px;
		color: var(--text-muted);
		font-size: 18px;
		pointer-events: none;
		transition: color var(--t-base);
	}
	.vs-search-inner.focused .vs-search-icon {
		color: var(--aero-blue);
	}
	.vs-search-input {
		width: 100%;
		height: 100%;
		padding: 0 14px 0 38px;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: 0.88rem;
		font-weight: 450;
		letter-spacing: 0.011em;
		transition: opacity 0.3s;
	}
	.vs-search-input::placeholder {
		color: var(--text-muted);
		opacity: 0.85;
	}

	/* Search Dropdown */
	.vs-search-dropdown {
		position: absolute;
		top: calc(100% + 10px);
		left: 0;
		right: 0;
		background: var(--bg-surface-solid);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg), var(--shadow-glow);
		padding: 8px 0;
		z-index: var(--z-dropdown, 100);
		overflow: hidden;
		will-change: transform, opacity;
	}
	.vs-search-empty {
		padding: 12px 16px;
		color: var(--text-muted);
		font-size: 0.88rem;
		text-align: center;
	}
	.vs-search-recent-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 16px 8px;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.vs-search-clear-btn {
		background: none;
		border: none;
		color: var(--aero-sky);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		text-transform: none;
		letter-spacing: normal;
		transition: background var(--t-fast);
	}
	.vs-search-clear-btn:hover {
		background: rgba(46, 180, 255, 0.1);
	}
	.vs-search-recent-list {
		display: flex;
		flex-direction: column;
	}
	.vs-search-recent-item {
		display: flex;
		align-items: center;
		padding: 10px 16px;
		cursor: pointer;
		transition: background var(--t-fast);
		color: var(--text-secondary);
		text-decoration: none;
	}
	.vs-search-recent-item:hover,
	.vs-search-recent-item:focus {
		background: var(--bg-surface-hover);
		outline: none;
	}
	.vs-search-user-info {
		display: flex;
		flex-direction: column;
		justify-content: center;
		flex: 1;
		min-width: 0;
	}
	.vs-search-user-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.vs-search-user-handle {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-top: 2px;
	}
	.vs-search-item-text {
		flex: 1;
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.vs-search-item-remove {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		transition: all var(--t-fast);
	}
	.vs-search-item-remove:hover {
		color: var(--aero-rose);
		background: rgba(236, 72, 153, 0.15);
	}

	.vs-search-footer {
		padding: 4px;
		margin-top: 8px;
		border-top: 1px solid var(--border-subtle);
	}
	.vs-search-view-all {
		width: 100%;
		padding: 12px;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--aero-sky);
		border: none;
		font-weight: 700;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all var(--t-fast);
		text-align: center;
	}
	.vs-search-view-all:hover {
		background: rgba(74, 171, 223, 0.1);
	}

	/* Mobile Search - Desplegable No Invasivo */
	@media (max-width: 639px) {
		.vs-topbar {
			display: flex;
		}
		.vs-search-wrap {
			flex: 0 0 40px;
			height: 40px;
			position: static; /* Permite que el inner absoluto se guíe por el topbar */
		}
		.vs-search-inner {
			position: absolute;
			top: 9px;
			left: 18px;
			width: 40px;
			height: 40px;
			transition: all var(--t-spring);
			cursor: pointer;
			z-index: 101;
		}
		.vs-search-input {
			opacity: 0;
			cursor: pointer;
		}
		/* Al enfocar, se expande elegantemente sobre el header sin causar saltos en el layout */
		.vs-search-wrap:focus-within .vs-search-inner {
			width: calc(100% - 36px);
			background: var(--bg-surface-solid);
			box-shadow: var(--shadow-lg), var(--shadow-glow);
			border-color: var(--aero-sky);
		}
		.vs-search-wrap:focus-within .vs-search-input {
			opacity: 1;
			cursor: text;
		}
		/* El contenedor de resultados se ancla al topbar gracias al position: static del wrap */
		.vs-search-dropdown {
			left: 18px;
			right: 18px;
			width: auto;
			top: 64px; /* Debajo del topbar */
			z-index: 100;
		}
	}

	/* ─── Actions row ───────────────────────────── */
	.vs-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto; /* en móvil (flex) empuja las acciones a la derecha */
		grid-column: 3;
		justify-self: end;
	}

	/* Iconos de acción derecha: tile de 38px con cristal, radio y borde iguales
	   para la luna (:global porque el botón de tema vive en ThemeSelector). */
	:global(.vs-topbar .aero-icon-btn) {
		flex: 0 0 38px;
		width: 38px;
		height: 38px;
		min-width: 38px;
		min-height: 38px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition:
			background var(--t-base),
			border-color var(--t-base),
			box-shadow var(--t-base),
			transform var(--t-spring);
	}
	:global(.vs-topbar .aero-icon-theme) {
		color: var(--aero-blue);
	}
	:global(.vs-topbar .aero-icon-theme:hover),
	:global(.vs-topbar .aero-icon-theme.is-active) {
		background: var(--bg-surface-hover);
		color: var(--accent-blue-base);
		border-color: rgba(var(--accent-blue-rgb), 0.45);
		box-shadow: 0 0 12px rgba(var(--accent-blue-rgb), 0.25);
		transform: scale(1.06);
	}
</style>
