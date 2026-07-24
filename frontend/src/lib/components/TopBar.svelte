<script>
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	let searchQuery = $state('');
	let searchFocused = $state(false);
	let dropdownOpen = $state(false);
	let dropdownRef = $state(null);
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

	function toggleDropdown() {
		dropdownOpen = !dropdownOpen;
	}

	onMount(() => {
		try {
			const saved = localStorage.getItem('vs_recent_searches');
			if (saved) recentSearches = JSON.parse(saved);
		} catch (_e) {}

		function handleClickOutside(e) {
			if (dropdownRef && !dropdownRef.contains(e.target)) {
				dropdownOpen = false;
			}
			if (searchWrapRef && !searchWrapRef.contains(e.target)) {
				searchFocused = false;
			}
		}
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<header class="vs-topbar" class:search-active={searchFocused}>
	<!-- Search -->
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
				placeholder={searchFocused ? 'Buscar' : 'Buscar creadores, posts…'}
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
												style="width:36px;height:36px;border-radius:50%;margin-right:12px;object-fit:cover;border:1px solid var(--border-subtle);"
												width="36"
												height="36"
												loading="lazy"
												decoding="async"
											/>
										{:else}
											<div
												style="width:36px;height:36px;border-radius:50%;margin-right:12px;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:bold;border:1px solid rgba(255,255,255,0.2);"
											>
												{(user.display_name || user.username)[0].toUpperCase()}
											</div>
										{/if}
										<div class="vs-search-user-info">
											<span class="vs-search-user-name">{user.display_name || user.username}</span>
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
										href={`/post/${post.id}`}
										class="vs-search-recent-item"
										onclick={() => (searchFocused = false)}
									>
										<span
											class="material-icons-round text-muted"
											style="font-size: 20px; margin-right: 12px; padding: 6px; background: var(--bg-overlay); border-radius: 50%;"
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
											style="width:36px;height:36px;border-radius:50%;margin-right:12px;object-fit:cover;border:1px solid var(--border-subtle);"
											width="36"
											height="36"
											loading="lazy"
											decoding="async"
										/>
									{:else}
										<div
											style="width:36px;height:36px;border-radius:50%;margin-right:12px;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:bold;border:1px solid rgba(255,255,255,0.2);"
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

	<!-- Right actions -->
	<div class="vs-actions">
		<!-- Theme toggle -->
		<ThemeSelector compact={true} align="right" />

		<!-- Avatar + Dropdown -->
		{#if authStore.user}
			<div class="vs-avatar-wrap" bind:this={dropdownRef}>
				<button class="vs-avatar-btn" onclick={toggleDropdown} aria-expanded={dropdownOpen}>
					{#if authStore.user.avatar_url}
						<img
							src={authStore.user.avatar_url}
							alt={authStore.user.username}
							class="vs-avatar-img"
							width="34"
							height="34"
							loading="lazy"
							decoding="async"
						/>
					{:else}
						<span class="vs-avatar-initial">
							{(authStore.user.display_name || authStore.user.username || '?')[0].toUpperCase()}
						</span>
					{/if}
					<span class="vs-avatar-online"></span>
				</button>

				{#if dropdownOpen}
					<div class="vs-dropdown">
						<div class="vs-dropdown-inner">
							<div class="vs-dropdown-header">
								<p class="vs-dd-name">{authStore.user.display_name || authStore.user.username}</p>
								<p class="vs-dd-handle">@{authStore.user.username}</p>
							</div>
							<div class="vs-dropdown-divider"></div>
							<a href={`/u/${authStore.user.username}`} class="vs-dd-item">
								<span class="material-icons-round" style="font-size:20px">person</span>
								Mi Perfil
							</a>
							<a href="/settings" class="vs-dd-item">
								<span class="material-icons-round" style="font-size:20px">settings</span>
								Ajustes
							</a>
							{#if authStore.isAdmin}
								<a href="/admin" class="vs-dd-item vs-dd-admin">
									<span class="material-icons-round" style="font-size:20px"
										>admin_panel_settings</span
									>
									Admin Panel
								</a>
							{/if}
							<div class="vs-dropdown-divider"></div>
							<button
								onclick={() => {
									dropdownOpen = false;
									authStore.logout().then(() => goto('/'));
								}}
								class="vs-dd-item vs-dd-logout"
							>
								<span class="material-icons-round" style="font-size:20px">logout</span>
								Cerrar sesión
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</header>

<style>
	/* ─── Topbar shell ───────────────────────────── */
	.vs-topbar {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky, 200);
		height: 58px;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 18px;
		transition: border-color var(--t-base);
	}
	.vs-topbar::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--bg-sidebar);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		will-change: transform;
		transform: translateZ(0);
		border-bottom: 1px solid var(--glass-border-t);
		box-shadow: 0 4px 16px rgba(46, 134, 232, 0.06);
		z-index: -1;
	}

	:global([data-theme='light']) .vs-topbar::before {
		/* Cristal skyblue saturado con esmeralda predominante, manteniendo translucidez */
		background: linear-gradient(90deg, rgba(16, 185, 129, 0.25) 0%, rgba(14, 165, 233, 0.35) 100%);
		box-shadow:
			0 4px 16px rgba(16, 185, 129, 0.12),
			0 1px 0 rgba(255, 255, 255, 0.6) inset;
	}

	/* ─── Search ────────────────────────────────── */
	.vs-search-wrap {
		position: relative;
		flex: 1;
		max-width: 380px;
		transition: flex 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.vs-search-inner {
		position: relative;
		display: flex;
		align-items: center;
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.04);
		transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
		overflow: hidden;
		height: 40px;
	}
	.vs-search-inner.focused {
		border-color: var(--aero-sky);
		background: var(--bg-surface);
		box-shadow:
			0 0 0 3px rgba(74, 171, 223, 0.16),
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
		transition: opacity 0.3s;
	}
	.vs-search-input::placeholder {
		color: var(--text-muted);
	}

	/* Search Dropdown */
	.vs-search-dropdown {
		position: absolute;
		top: calc(100% + 10px);
		left: 0;
		right: 0;
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-border-t);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
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
		background: rgba(255, 255, 255, 0.06);
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
		border-radius: 50%;
		transition: all var(--t-fast);
	}
	.vs-search-item-remove:hover {
		color: var(--aero-rose);
		background: rgba(236, 72, 153, 0.15);
	}

	.vs-search-footer {
		padding: 4px;
		margin-top: 8px;
		border-top: 1px solid var(--glass-border-t);
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

	/* Mobile Search Expandable */
	@media (max-width: 639px) {
		.vs-search-wrap {
			flex: 0 0 40px;
		}
		.vs-search-wrap:focus-within {
			flex: 1;
		}
		.vs-search-inner {
			cursor: pointer;
		}
		.vs-search-input {
			opacity: 0;
			cursor: pointer;
		}
		.vs-search-wrap:focus-within .vs-search-input {
			opacity: 1;
			cursor: text;
		}
		.vs-topbar.search-active .vs-actions {
			display: none;
		}
		.vs-topbar.search-active .vs-search-wrap {
			max-width: 100%;
		}
	}

	/* ─── Actions row ───────────────────────────── */
	.vs-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto;
	}
	/* ─── Avatar ────────────────────────────────── */
	.vs-avatar-wrap {
		position: relative;
	}
	.vs-avatar-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		position: relative;
		display: flex;
	}
	.vs-avatar-img {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--glass-border-t);
		box-shadow: var(--shadow-xs);
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base);
	}
	.vs-avatar-btn:hover .vs-avatar-img {
		transform: scale(1.06);
		box-shadow: 0 4px 12px rgba(46, 134, 232, 0.22);
	}
	.vs-avatar-initial {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-weight: 700;
		font-size: 0.84rem;
		border: 2px solid rgba(255, 255, 255, 0.5);
		transition: transform var(--t-spring);
	}
	.vs-avatar-btn:hover .vs-avatar-initial {
		transform: scale(1.06);
	}
	.vs-avatar-online {
		position: absolute;
		bottom: 1px;
		right: 1px;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--aero-mint);
		border: 2px solid var(--bg-canvas);
	}

	/* ─── Dropdown ──────────────────────────────── */
	.vs-dropdown {
		position: absolute;
		top: calc(100% + 10px);
		right: 0;
		z-index: var(--z-dropdown, 100);
		min-width: 200px;
		animation: slideInUp 0.22s var(--ease-out) both;

		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-border-t);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		will-change: transform, opacity;
	}
	.vs-dropdown-inner {
		padding: 12px;
		border-radius: var(--radius-lg);
	}
	.vs-dropdown-header {
		padding: 4px 12px 14px;
	}
	.vs-dd-name {
		font-size: 0.98rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.vs-dd-handle {
		font-size: 0.84rem;
		color: var(--text-muted);
		margin-top: 2px;
	}
	.vs-dropdown-divider {
		height: 1px;
		background: var(--border-subtle);
		margin: 4px 0;
	}
	.vs-dd-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-radius: var(--radius-sm);
		font-size: 0.94rem;
		line-height: 1;
		color: var(--text-secondary);
		text-decoration: none;
		transition:
			background var(--t-fast),
			color var(--t-fast);
		cursor: pointer;
		width: 100%;
		border: none;
		background: none;
		text-align: left;
		font-family: var(--font-sans);
	}
	.vs-dd-item:hover {
		background: rgba(46, 134, 232, 0.08);
		color: var(--aero-blue);
	}
	.vs-dd-admin {
		color: var(--aero-amber);
	}
	.vs-dd-admin:hover {
		background: rgba(232, 160, 35, 0.08);
		color: var(--aero-amber);
	}
	.vs-dd-logout {
		color: var(--aero-rose);
	}
	.vs-dd-logout:hover {
		background: rgba(232, 74, 114, 0.08);
		color: var(--aero-rose);
	}

	@keyframes glowPulse {
		0%,
		100% {
			box-shadow: 0 2px 6px rgba(232, 74, 114, 0.35);
		}
		50% {
			box-shadow: 0 2px 10px rgba(232, 74, 114, 0.55);
		}
	}

	@keyframes slideInUp {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
