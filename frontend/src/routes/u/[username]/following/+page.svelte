<script>
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { users as usersApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';

	let username = $derived(page.params.username);

	// Tabs: 'following', 'followers', 'verified'
	let initialTab = $derived(
		page.url.searchParams.get('tab') &&
			['verified', 'followers', 'following'].includes(page.url.searchParams.get('tab'))
			? page.url.searchParams.get('tab')
			: 'following'
	);
	let activeTab = $state('following');
	let searchQuery = $state('');

	let user = $state(null);
	let followers = $state([]);
	let following = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let togglingFollowIds = $state(new Set());

	function hasBadge(u) {
		if (!u) return false;
		const isV = u.is_verified == 1 || u.is_verified === true || u.is_verified === '1';
		if (isV) return true;
		const role = u.role;
		if (!role || role === 'user') return false;
		return [
			'super_admin',
			'admin',
			'moderator',
			'support',
			'team',
			'government',
			'gov',
			'official',
			'institutional',
			'legal'
		].includes(role);
	}

	let verifiedUsers = $derived.by(() => {
		const map = new Map();
		for (const u of following) {
			if (hasBadge(u)) {
				map.set(u.id, { ...u, is_following: true });
			}
		}
		for (const u of followers) {
			if (hasBadge(u)) {
				if (map.has(u.id)) {
					const existing = map.get(u.id);
					map.set(u.id, {
						...existing,
						...u,
						is_following: existing.is_following || u.is_following
					});
				} else {
					map.set(u.id, { ...u });
				}
			}
		}
		return Array.from(map.values());
	});

	let baseList = $derived(
		activeTab === 'verified' ? verifiedUsers : activeTab === 'followers' ? followers : following
	);

	let filteredList = $derived(
		searchQuery.trim() === ''
			? baseList
			: baseList.filter((u) => {
					const q = searchQuery.toLowerCase().trim();
					const name = (u.display_name || '').toLowerCase();
					const handle = (u.username || '').toLowerCase();
					const bio = (u.bio || '').toLowerCase();
					return name.includes(q) || handle.includes(q) || bio.includes(q);
				})
	);

	onMount(() => {
		activeTab = initialTab;
		if (username) {
			loadData(username);
		}

		const handlePopState = () => {
			const tabParam = new URL(window.location.href).searchParams.get('tab');
			if (tabParam && ['verified', 'followers', 'following'].includes(tabParam)) {
				activeTab = tabParam;
			} else {
				activeTab = 'following';
			}
		};
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	});

	let prevUsername = $state('');
	$effect(() => {
		const currentU = username;
		if (currentU && currentU !== prevUsername) {
			prevUsername = currentU;
			loadData(currentU);
		}
	});

	async function loadData(u) {
		if (!u) return;
		loading = true;
		error = null;

		try {
			const [userData, followersData, followingData] = await Promise.all([
				usersApi.get(u),
				usersApi.followers(u),
				usersApi.following(u)
			]);

			user = userData.user;
			followers = (followersData.followers || []).map((f) => ({
				...f,
				is_following: f.is_following === 1 || f.is_following === true || f.is_following === '1'
			}));
			following = (followingData.following || []).map((f) => ({
				...f,
				is_following: f.is_following === 1 || f.is_following === true || f.is_following === '1'
			}));
		} catch (e) {
			console.error('[UserFollowing] Failed to load network data:', e);
			error = e.message || 'Error al cargar los datos de red.';
		} finally {
			loading = false;
		}
	}

	function setTab(tab) {
		if (activeTab === tab) return;
		activeTab = tab;
		searchQuery = '';

		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.set('tab', tab);
			window.history.replaceState(null, '', url.toString());
		}
	}

	async function toggleFollow(targetUser, e) {
		e.preventDefault();
		e.stopPropagation();
		if (!targetUser || !targetUser.username || togglingFollowIds.has(targetUser.id)) return;

		const currentlyFollowing = !!targetUser.is_following;
		const targetId = targetUser.id;

		togglingFollowIds.add(targetId);
		togglingFollowIds = new Set(togglingFollowIds);

		targetUser.is_following = !currentlyFollowing;
		followers = followers.map((u) =>
			u.id === targetId ? { ...u, is_following: !currentlyFollowing } : u
		);
		following = following.map((u) =>
			u.id === targetId ? { ...u, is_following: !currentlyFollowing } : u
		);

		try {
			if (currentlyFollowing) {
				await usersApi.unfollow(targetUser.username);
			} else {
				await usersApi.follow(targetUser.username);
			}
		} catch (err) {
			console.error('[UserFollowing] Action failed:', err);
			targetUser.is_following = currentlyFollowing;
			followers = followers.map((u) =>
				u.id === targetId ? { ...u, is_following: currentlyFollowing } : u
			);
			following = following.map((u) =>
				u.id === targetId ? { ...u, is_following: currentlyFollowing } : u
			);
		} finally {
			togglingFollowIds.delete(targetId);
			togglingFollowIds = new Set(togglingFollowIds);
		}
	}
</script>

<svelte:head>
	<title>{user ? user.display_name : username} - Red | VSocial</title>
</svelte:head>

<div
	class="network-container {user?.customization?.bg_color ? 'has-custom-bg' : ''}"
	style={user?.customization?.bg_color ? `background-color: ${user.customization.bg_color}` : ''}
>
	<!-- ══ HEADER PRINCIPAL ══ -->
	<header class="network-header glass-panel">
		<button class="back-btn interactive" onclick={() => history.back()} aria-label="Volver atrás">
			<span class="material-icons-round">arrow_back</span>
		</button>
		<div class="header-info">
			<h1 class="header-name">
				<span>{user ? user.display_name : username}</span>
				{#if user && hasBadge(user)}
					<VerifiedBadge
						role={user.role || 'user'}
						isVerified={user.is_verified == 1 ||
							user.is_verified === true ||
							user.is_verified === '1'}
						size="18px"
						interactive={true}
					/>
				{/if}
			</h1>
			<span class="header-handle">@{user ? user.username : username}</span>
		</div>
	</header>

	<!-- ══ PESTAÑAS NEO-AERO ══ -->
	<nav class="network-tabs glass-panel" aria-label="Filtro de conexiones">
		<button
			class="tab-btn"
			class:active={activeTab === 'following'}
			onclick={() => setTab('following')}
		>
			<span class="material-icons-round tab-icon">people</span>
			<span class="tab-label">Siguiendo</span>
			<span class="tab-badge">{following.length}</span>
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'followers'}
			onclick={() => setTab('followers')}
		>
			<span class="material-icons-round tab-icon">group</span>
			<span class="tab-label">Seguidores</span>
			<span class="tab-badge">{followers.length}</span>
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'verified'}
			onclick={() => setTab('verified')}
		>
			<span class="material-icons-round tab-icon text-aero-sky">verified</span>
			<span class="tab-label">Verificados</span>
			<span class="tab-badge verified-badge">{verifiedUsers.length}</span>
		</button>
	</nav>

	<!-- ══ BUSCADOR RÁPIDO EN VIVO ══ -->
	{#if !loading && baseList.length > 0}
		<div class="network-search-wrap glass-panel">
			<span class="material-icons-round search-icon">search</span>
			<input
				type="search"
				bind:value={searchQuery}
				placeholder="Filtrar por nombre, usuario o biografía..."
				class="network-search-input"
				aria-label="Buscar en esta lista"
			/>
			{#if searchQuery.trim().length > 0}
				<button
					class="clear-search-btn"
					onclick={() => (searchQuery = '')}
					aria-label="Limpiar búsqueda"
				>
					<span class="material-icons-round">close</span>
				</button>
			{/if}
		</div>
	{/if}

	<!-- ══ LISTA DE USUARIOS / ESTADOS ══ -->
	<main class="network-list">
		{#if loading}
			<div class="skeletons-list" in:fade={{ duration: 150 }}>
				{#each Array(5) as _, _i}
					<div class="user-card-skeleton glass-panel">
						<div
							class="skeleton-avatar"
							style="flex: 0 0 44px; min-width: 44px; min-height: 44px;"
						></div>
						<div class="skeleton-info">
							<div class="skeleton-line title"></div>
							<div class="skeleton-line handle"></div>
						</div>
						<div class="skeleton-btn"></div>
					</div>
				{/each}
			</div>
		{:else if error}
			<div class="state-card error-state glass-card" in:fade={{ duration: 180 }}>
				<div class="state-icon-box error">
					<span class="material-icons-round">error_outline</span>
				</div>
				<h3 class="state-title">Error al cargar la red</h3>
				<p class="state-desc">{error}</p>
				<button class="btn-aero-primary retry-btn" onclick={() => loadData(username)}>
					<span class="material-icons-round">refresh</span>
					<span>Reintentar</span>
				</button>
			</div>
		{:else}
			{#key `${activeTab}-${searchQuery}`}
				<div class="tab-pane-transition" in:fade={{ duration: 180 }}>
					{#if filteredList.length === 0}
						<div class="state-card empty-state glass-card">
							{#if searchQuery.trim().length > 0}
								<div class="state-icon-box search">
									<span class="material-icons-round">person_search</span>
								</div>
								<h3 class="state-title">Sin coincidencias</h3>
								<p class="state-desc">
									No se encontraron usuarios que coincidan con "<strong>{searchQuery}</strong>".
								</p>
								<button class="btn-aero-secondary clear-btn" onclick={() => (searchQuery = '')}>
									<span>Mostrar todos ({baseList.length})</span>
								</button>
							{:else if activeTab === 'following'}
								<div class="state-icon-box">
									<span class="material-icons-round">person_outline</span>
								</div>
								<h3 class="state-title">No sigue a nadie aún</h3>
								<p class="state-desc">Este creador no sigue a otros perfiles actualmente.</p>
							{:else if activeTab === 'followers'}
								<div class="state-icon-box">
									<span class="material-icons-round">group_outline</span>
								</div>
								<h3 class="state-title">Sin seguidores aún</h3>
								<p class="state-desc">¡Sé la primera persona en seguir a este creador!</p>
							{:else}
								<div class="state-icon-box verified">
									<span class="material-icons-round">verified</span>
								</div>
								<h3 class="state-title">Sin usuarios con insignia</h3>
								<p class="state-desc">
									No hay perfiles verificados ni miembros oficiales en la red de este creador.
								</p>
							{/if}
						</div>
					{:else}
						<div class="user-list">
							{#each filteredList as u, idx (u.id || u.username)}
								<div class="user-card glass-panel" style="--item-idx: {Math.min(idx, 8)};">
									<a
										href="/u/{u.username}"
										class="user-avatar-wrap interactive"
										style="flex: 0 0 44px; min-width: 44px; min-height: 44px;"
										title="Ver perfil de @{u.username}"
									>
										{#if u.avatar_url}
											<img
												src={u.avatar_url}
												alt="Avatar de {u.display_name || u.username}"
												class="user-avatar-img"
												crossorigin="anonymous"
												loading="lazy"
											/>
										{:else}
											<div class="avatar-fallback">
												{(u.display_name || u.username || '?').charAt(0).toUpperCase()}
											</div>
										{/if}
									</a>

									<a href="/u/{u.username}" class="user-details-link interactive">
										<div class="user-name-row">
											<span class="user-display-name">{u.display_name || u.username}</span>
											<VerifiedBadge
												role={u.role || 'user'}
												isVerified={u.is_verified == 1 ||
													u.is_verified === true ||
													u.is_verified === '1'}
												size="16px"
												interactive={true}
											/>
											{#if u.level != null}
												<LevelBadge level={u.level} size="sm" />
											{/if}
										</div>
										<span class="user-handle">@{u.username}</span>
										{#if u.bio}
											<p class="user-bio">{u.bio}</p>
										{/if}
									</a>

									{#if authStore.user?.username !== u.username}
										<button
											class={u.is_following
												? 'btn-aero-secondary following-toggle-btn active'
												: 'btn-aero-primary following-toggle-btn'}
											onclick={(e) => toggleFollow(u, e)}
											disabled={togglingFollowIds.has(u.id)}
											aria-label={u.is_following ? 'Dejar de seguir' : 'Seguir usuario'}
										>
											{#if togglingFollowIds.has(u.id)}
												<span class="material-icons-round spin-icon" style="font-size: 14px;"
													>autorenew</span
												>
											{:else}
												<span class="material-icons-round" style="font-size: 15px;">
													{u.is_following ? 'check' : 'person_add'}
												</span>
											{/if}
											<span>{u.is_following ? 'Siguiendo' : 'Seguir'}</span>
										</button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/key}
		{/if}
	</main>
</div>

<style>
	/* ════════════════════════════════════════════════════════════════════════
	   USER NETWORK PAGE (U/[USERNAME]/FOLLOWING) — NEO-AERO GLASS 2.0
	   ════════════════════════════════════════════════════════════════════════ */

	.network-container {
		max-width: 640px;
		margin: 0 auto;
		min-height: 100vh;
		padding: 16px 12px 90px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		box-sizing: border-box;
	}

	/* ─── Header ────────────────────────────────────────────────────────── */
	.network-header {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 14px 18px;
		border-radius: var(--radius-lg);
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		box-shadow: var(--glass-shadow), var(--glass-inset-highlight);
		position: sticky;
		top: 68px;
		z-index: 30;
	}

	.back-btn {
		background: var(--bg-surface-hover);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		flex: 0 0 38px;
		min-width: 38px;
		min-height: 38px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		transition: all var(--t-fast);
		box-shadow: var(--shadow-xs);
	}
	.back-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		border-color: var(--aero-blue);
		transform: scale(1.05);
	}
	.back-btn:active {
		transform: scale(0.95);
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.header-name {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 800;
		margin: 0;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 6px;
		letter-spacing: -0.01em;
	}
	.header-handle {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	/* ─── Tabs ──────────────────────────────────────────────────────────── */
	.network-tabs {
		display: flex;
		gap: 6px;
		padding: 6px;
		border-radius: var(--radius-lg);
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		box-shadow: var(--glass-shadow), var(--glass-inset-highlight);
		position: sticky;
		top: 136px;
		z-index: 25;
	}

	.tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-weight: 600;
		font-size: 0.88rem;
		padding: 10px 8px;
		cursor: pointer;
		transition: all 0.25s var(--ease-spring);
		position: relative;
		user-select: none;
	}
	.tab-btn:hover {
		background: var(--bg-surface-hover);
		color: var(--text-primary);
		transform: translateY(-1px);
	}
	.tab-btn:active {
		transform: scale(0.97);
	}
	.tab-btn.active {
		background: var(--grad-primary);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.25);
		box-shadow:
			0 4px 14px rgba(27, 133, 243, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.4);
		font-weight: 700;
		transform: none;
	}

	.tab-icon {
		font-size: 18px;
	}

	.tab-badge {
		font-size: 0.72rem;
		font-weight: 800;
		padding: 1px 7px;
		border-radius: var(--radius-full);
		background: rgba(0, 0, 0, 0.15);
		color: inherit;
		border: 1px solid rgba(255, 255, 255, 0.15);
		line-height: 1.4;
	}
	.tab-btn.active .tab-badge {
		background: rgba(255, 255, 255, 0.25);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.4);
	}

	/* ─── Search Bar ────────────────────────────────────────────────────── */
	.network-search-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 14px;
		border-radius: var(--radius-full);
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-xs);
		transition:
			border-color var(--t-fast),
			box-shadow var(--t-fast);
	}
	.network-search-wrap:focus-within {
		border-color: var(--aero-blue);
		box-shadow: 0 0 0 3px rgba(27, 133, 243, 0.15);
	}
	.search-icon {
		font-size: 20px;
		color: var(--text-muted);
	}
	.network-search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		font-size: 0.88rem;
		color: var(--text-primary);
		font-family: var(--font-sans);
	}
	.network-search-input::placeholder {
		color: var(--text-muted);
	}
	.clear-search-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2px;
		border-radius: 50%;
		transition: color var(--t-fast);
	}
	.clear-search-btn:hover {
		color: var(--text-primary);
	}

	/* ─── List & User Cards ─────────────────────────────────────────────── */
	.network-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
	}

	.tab-pane-transition {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
	}

	.user-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	@keyframes cardSlideIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.user-card {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		box-shadow: var(--shadow-sm), var(--glass-inset-highlight);
		border: 1px solid var(--border-subtle);
		animation: cardSlideIn 0.3s var(--ease-spring) backwards;
		animation-delay: calc(var(--item-idx, 0) * 25ms);
		transition:
			transform var(--t-fast),
			box-shadow var(--t-fast),
			background var(--t-fast),
			border-color var(--t-fast);
	}
	.user-card:hover {
		transform: translateY(-2px);
		box-shadow:
			var(--shadow-md),
			0 6px 20px rgba(27, 133, 243, 0.12);
		background: var(--bg-surface-hover);
		border-color: rgba(46, 180, 255, 0.35);
	}

	.user-avatar-wrap {
		width: 44px;
		height: 44px;
		flex: 0 0 44px;
		min-width: 44px;
		min-height: 44px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		overflow: hidden;
		background: var(--grad-primary);
		border: 1px solid var(--glass-border);
		box-shadow: var(--shadow-xs);
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
	}
	.user-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.avatar-fallback {
		color: #ffffff;
		font-weight: 800;
		font-size: 1.15rem;
		font-family: var(--font-display);
	}

	.user-details-link {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-decoration: none;
	}
	.user-name-row {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.user-display-name {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.user-handle {
		font-size: 0.8rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.user-bio {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin: 2px 0 0;
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.following-toggle-btn {
		padding: 7px 16px;
		font-size: 0.82rem;
		font-weight: 700;
		border-radius: var(--radius-full);
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		flex-shrink: 0;
		cursor: pointer;
		transition: all var(--t-fast);
	}
	.following-toggle-btn.active {
		background: rgba(255, 255, 255, 0.08);
		border-color: var(--border-subtle);
		color: var(--text-secondary);
		box-shadow: none;
	}
	.following-toggle-btn.active:hover {
		background: rgba(236, 72, 153, 0.12);
		border-color: rgba(236, 72, 153, 0.35);
		color: var(--aero-rose);
	}

	/* ─── Skeletons ──────────────────────────────────────────────────────── */
	.skeletons-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.user-card-skeleton {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
	}
	.skeleton-avatar {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--bg-surface-hover);
		animation: skeletonPulse 1.5s ease-in-out infinite alternate;
	}
	.skeleton-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.skeleton-line {
		height: 12px;
		border-radius: var(--radius-xs);
		background: var(--bg-surface-hover);
		animation: skeletonPulse 1.5s ease-in-out infinite alternate;
	}
	.skeleton-line.title {
		width: 40%;
	}
	.skeleton-line.handle {
		width: 25%;
	}
	.skeleton-btn {
		width: 80px;
		height: 32px;
		border-radius: var(--radius-full);
		background: var(--bg-surface-hover);
		animation: skeletonPulse 1.5s ease-in-out infinite alternate;
	}

	@keyframes skeletonPulse {
		0% {
			opacity: 0.4;
		}
		100% {
			opacity: 0.9;
		}
	}

	/* ─── State Cards (Empty / Error) ────────────────────────────────────── */
	.state-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		text-align: center;
		gap: 14px;
		border-radius: var(--radius-lg);
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--glass-shadow);
	}
	.state-icon-box {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: rgba(27, 133, 243, 0.1);
		color: var(--aero-blue);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28px;
		border: 1px solid rgba(27, 133, 243, 0.25);
		box-shadow: 0 4px 14px rgba(27, 133, 243, 0.15);
	}
	.state-icon-box.verified {
		background: rgba(46, 180, 255, 0.12);
		color: var(--aero-sky);
		border-color: rgba(46, 180, 255, 0.3);
	}
	.state-icon-box.error {
		background: rgba(236, 72, 153, 0.12);
		color: var(--aero-rose);
		border-color: rgba(236, 72, 153, 0.3);
	}
	.state-title {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}
	.state-desc {
		font-size: 0.88rem;
		color: var(--text-secondary);
		max-width: 360px;
		margin: 0;
		line-height: 1.45;
	}
	.retry-btn,
	.clear-btn {
		margin-top: 6px;
		padding: 10px 20px;
		font-size: 0.88rem;
		font-weight: 700;
		border-radius: var(--radius-full);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.spin-icon {
		animation: vsSpin 1s linear infinite;
	}
	@keyframes vsSpin {
		100% {
			transform: rotate(360deg);
		}
	}

	/* ─── Responsive ─────────────────────────────────────────────────────── */
	@media (max-width: 600px) {
		.network-container {
			padding: 10px 8px 85px;
			gap: 10px;
		}
		.network-header {
			top: 60px;
			padding: 12px 14px;
			border-radius: var(--radius-md);
		}
		.network-tabs {
			top: 124px;
			padding: 4px;
			border-radius: var(--radius-md);
		}
		.tab-btn {
			padding: 8px 4px;
			font-size: 0.8rem;
			gap: 4px;
		}
		.tab-icon {
			font-size: 16px;
		}
		.tab-badge {
			font-size: 0.65rem;
			padding: 0 5px;
		}
		.user-card {
			padding: 10px 12px;
			gap: 10px;
		}
		.following-toggle-btn {
			padding: 6px 12px;
			font-size: 0.78rem;
		}
	}
</style>
