<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { users as usersApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';

	let username = $derived($page.params.username);

	// Tabs: 'verified', 'followers', 'following'
	let activeTab = $state('followers');

	let user = $state(null);
	let followers = $state([]);
	let following = $state([]);
	let loading = $state(true);
	let error = $state(null);

	let verifiedFollowers = $derived(followers.filter((f) => f.is_verified == 1));

	let currentList = $derived(
		activeTab === 'verified' ? verifiedFollowers : activeTab === 'followers' ? followers : following
	);

	let debugStep = $state('init');

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const tabParam = urlParams.get('tab');
		if (tabParam && ['verified', 'followers', 'following'].includes(tabParam)) {
			activeTab = tabParam;
		}
		loadData(username);
	});

	// Re-load if username changes in URL without full reload
	$effect(() => {
		loadData(username);
	});

	async function loadData(u) {
		if (!u) return; // safety
		loading = true;
		error = null;
		debugStep = 'start';

		const timeoutId = setTimeout(() => {
			if (loading) {
				error = 'Tiempo de espera agotado al cargar la red. Step: ' + debugStep;
				loading = false;
			}
		}, 8000);

		try {
			debugStep = 'fetching_user';
			const data = await usersApi.get(u);
			user = data.user;

			debugStep = 'fetching_network';
			const [followersData, followingData] = await Promise.all([
				usersApi.followers(u),
				usersApi.following(u)
			]);

			debugStep = 'processing';
			followers = followersData.followers || [];
			following = followingData.following || [];

			debugStep = 'done';
		} catch (e) {
			console.error('Failed to load network data:', e);
			error = (e.message || 'Error desconocido') + ' (Step: ' + debugStep + ')';
		} finally {
			clearTimeout(timeoutId);
			loading = false;
		}
	}

	function setTab(tab) {
		activeTab = tab;
		// Update URL silently
		const url = new URL(window.location);
		url.searchParams.set('tab', tab);
		replaceState(url, {});
	}

	async function toggleFollow(targetUser, e) {
		e.preventDefault();
		e.stopPropagation();
		if (!targetUser) return;

		const currentlyFollowing = targetUser.is_following;
		targetUser.is_following = !currentlyFollowing;

		try {
			if (currentlyFollowing) {
				await usersApi.unfollow(targetUser.username);
				// Remove from list immediately if we are in 'following' tab
				if (activeTab === 'following') {
					following = following.filter((u) => u.id !== targetUser.id);
				}
			} else {
				await usersApi.follow(targetUser.username);
			}
		} catch (err) {
			console.error('Action failed:', err);
			// Revert optimistic update
			targetUser.is_following = currentlyFollowing;
			error = 'No se pudo completar la acción.';
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
	<div class="network-header glass-panel">
		<button class="back-btn interactive" onclick={() => history.back()} aria-label="Volver">
			<span class="material-icons-round">arrow_back</span>
		</button>
		<div class="header-info">
			<h1 class="header-name">
				{user ? user.display_name : username}
				{#if user && user.is_verified == 1}
					<VerifiedBadge role={user.role} isVerified={true} size="16px" interactive={false} />
				{/if}
			</h1>
			<span class="header-handle">@{user ? user.username : username}</span>
		</div>
	</div>

	<nav class="network-tabs glass-panel">
		<button
			class="tab-btn"
			class:active={activeTab === 'verified'}
			onclick={() => setTab('verified')}
		>
			Seguidores verificados
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'followers'}
			onclick={() => setTab('followers')}
		>
			Seguidores
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === 'following'}
			onclick={() => setTab('following')}
		>
			Siguiendo
		</button>
	</nav>

	<main class="network-list">
		{#if loading}
			<div class="loading-state">
				<span class="loading loading-spinner text-primary"></span>
				<p>Cargando red... ({debugStep})</p>
			</div>
		{:else if error}
			<div class="error-state glass-card">
				<span class="material-icons-round">error_outline</span>
				<p>{error}</p>
			</div>
		{:else if currentList.length === 0}
			<div class="empty-state">
				<p>
					{#if activeTab === 'verified'}
						No hay seguidores verificados aún.
					{:else if activeTab === 'followers'}
						No hay seguidores aún.
					{:else}
						No está siguiendo a nadie aún.
					{/if}
				</p>
			</div>
		{:else}
			<div class="user-list">
				{#each currentList as u (u.id || u.username)}
					<a href="/u/{u.username}" class="user-card glass-panel interactive">
						<div class="user-avatar">
							{#if u.avatar_url}
								<img
									src={u.avatar_url}
									alt="Avatar de {u.display_name || u.username}"
									crossorigin="anonymous"
								/>
							{:else}
								<div class="avatar-fallback">
									{(u.display_name || u.username || '?').charAt(0).toUpperCase()}
								</div>
							{/if}
						</div>
						<div class="user-info">
							<div class="user-name-row">
								<span class="user-name">{u.display_name || u.username}</span>
								{#if u.is_verified == 1}
									<VerifiedBadge
										role={u.role || 'user'}
										isVerified={true}
										size="16px"
										interactive={false}
									/>
								{/if}
								{#if u.level != null}
									<LevelBadge level={u.level} size="sm" />
								{/if}
							</div>
							<span class="user-handle">@{u.username}</span>
						</div>

						{#if authStore.user?.username !== u.username}
							<button
								class={u.is_following
									? 'btn-aero-secondary following-btn'
									: 'btn-aero-primary follow-btn'}
								onclick={(e) => toggleFollow(u, e)}
							>
								{u.is_following ? 'Siguiendo' : 'Seguir'}
							</button>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</main>
</div>

<style>
	.network-container {
		max-width: 600px;
		margin: 0 auto;
		min-height: 100vh;
		padding-bottom: 80px; /* space for mobile nav */
	}

	.network-header {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 12px 20px;
		position: sticky;
		top: 0;
		z-index: 50;
		border-radius: 0 0 16px 16px;
		border-top: none;
		margin-bottom: 4px;
		/* Extra glass intensity for header */
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
	}

	.back-btn {
		background: none;
		border: none;
		color: var(--text-primary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		transition: background var(--t-fast);
	}
	.back-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.header-info {
		display: flex;
		flex-direction: column;
	}
	.header-name {
		font-size: 1.1rem;
		font-weight: 700;
		margin: 0;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.header-handle {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.network-tabs {
		display: flex;
		justify-content: space-between;
		border-radius: 16px;
		margin-bottom: 12px;
		overflow: hidden;
		position: sticky;
		top: 68px; /* Below header */
		z-index: 40;
	}

	.tab-btn {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-secondary);
		font-weight: 600;
		font-size: 0.95rem;
		padding: 14px 10px;
		cursor: pointer;
		transition: all var(--t-fast);
		position: relative;
		border-bottom: 3px solid transparent;
	}
	.tab-btn:hover {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-primary);
	}
	.tab-btn.active {
		color: var(--text-primary);
	}
	.tab-btn.active::after {
		content: '';
		position: absolute;
		bottom: -3px;
		left: 0;
		right: 0;
		height: 3px;
		background: var(--aero-primary);
		box-shadow: var(--neon-primary);
		border-radius: 3px 3px 0 0;
	}

	.network-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0 4px;
	}

	.loading-state,
	.empty-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		color: var(--text-secondary);
		gap: 12px;
		text-align: center;
	}

	.user-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.user-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-radius: 16px;
		text-decoration: none;
		transition:
			transform var(--t-fast),
			box-shadow var(--t-fast),
			background var(--t-fast);

		/* PostCard-like Topbar glass effect and overlap prevention */
		position: relative;
		z-index: 2;
		isolation: isolate;
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur, blur(24px) saturate(1.8));
		-webkit-backdrop-filter: var(--glass-blur, blur(24px) saturate(1.8));
	}
	.user-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
		background: var(--bg-surface-hover);
	}

	.user-avatar {
		width: 44px;
		height: 44px;
		flex: 0 0 44px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--grad-primary);
		border: 1px solid var(--glass-border);
	}
	.user-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.avatar-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: bold;
		font-size: 1.2rem;
	}

	.user-info {
		flex: 1;
		min-width: 0; /* allows text truncation */
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.user-name-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.user-name {
		font-weight: 700;
		color: var(--text-primary);
		font-size: 1rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.user-handle {
		color: var(--text-secondary);
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.follow-btn,
	.following-btn {
		padding: 6px 16px;
		font-size: 0.85rem;
		border-radius: 20px;
		font-weight: 600;
		white-space: nowrap;
	}
	.following-btn {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
		box-shadow: none;
	}

	@media (max-width: 576px) {
		.network-container {
			padding-top: 0;
		}
		.network-header {
			border-radius: 0;
		}
		.network-tabs {
			border-radius: 0;
			top: 60px; /* Adjust if mobile top bar is present */
		}
		.tab-btn {
			font-size: 0.85rem;
			padding: 12px 6px;
		}
		.user-card {
			border-radius: 0;
			border-left: none;
			border-right: none;
		}
	}
</style>
