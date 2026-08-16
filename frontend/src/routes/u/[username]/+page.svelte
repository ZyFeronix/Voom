<script>
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { users as usersApi, messages as messagesApi, posts as postsApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import PostCard from '$lib/components/PostCard.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';
	import UserTitleBadge from '$lib/components/gamification/UserTitleBadge.svelte';
	import { formatHashtags } from '$lib/utils/textFormatting.js';
	import ActivityHistory from '$lib/components/ActivityHistory.svelte';
	import ImageCropperModal from '$lib/components/ImageCropperModal.svelte';
	import { mediaViewer } from '$lib/stores/mediaViewer.svelte.js';

	// ── Runes State ──────────────────────────────────────────────────────────
	let username = $derived(page.params.username);
	let user = $state(null);
	let posts = $state([]);
	let postsPage = $state(1);
	let hasMorePosts = $state(true);
	let loadingMorePosts = $state(false);

	let reposts = $state([]);
	let repostsPage = $state(1);
	let hasMoreReposts = $state(true);
	let loadingMoreReposts = $state(false);
	let loadingReposts = $state(false);
	let activeTab = $state('posts'); // 'posts', 'reposts', 'about', 'history', 'trash'
	let loading = $state(true);
	let deletedPosts = $state([]);

	// ── Cropper State for Profile Direct Upload ──
	let cropFile = $state(null);
	let cropType = $state(null);
	let cropRatio = $state(1);
	let avatarInput = $state(null);
	let coverInput = $state(null);
	let savingMedia = $state(false);

	function handleAvatarChange(e) {
		const file = e.target.files[0];
		if (!file || savingMedia) return;
		cropFile = file;
		cropType = 'avatar';
		cropRatio = 1;
		e.target.value = '';
	}

	function handleCoverChange(e) {
		const file = e.target.files[0];
		if (!file || savingMedia) return;
		cropFile = file;
		cropType = 'cover';
		cropRatio = 16 / 5;
		e.target.value = '';
	}

	async function handleCrop(croppedFile) {
		const type = cropType;
		cropFile = null;
		cropType = null;
		savingMedia = true;

		try {
			const fd = new FormData();
			if (type === 'avatar') {
				fd.append('avatar', croppedFile);
				const res = await usersApi.uploadAvatar(fd);
				if (res.success) {
					if (user) user.avatar_url = res.avatar_url;
					authStore.updateUser({ avatar_url: res.avatar_url });
				}
			} else if (type === 'cover') {
				fd.append('cover', croppedFile);
				const res = await usersApi.uploadCover(fd);
				if (res.success) {
					if (user) user.cover_url = res.cover_url;
					authStore.updateUser({ cover_url: res.cover_url });
				}
			}
		} catch (err) {
			console.error('Error al subir imagen:', err);
		} finally {
			savingMedia = false;
		}
	}

	function cancelCrop() {
		cropFile = null;
		cropType = null;
	}

	// ── Gamification XP Logic ──
	const XP_PER_LEVEL_FACTOR = 100;
	let currentXp = $derived(user?.xp_points || 0);
	let currentLevel = $derived(user?.level || 1);
	let currentLevelBaseXp = $derived(
		currentLevel <= 1 ? 0 : Math.pow(currentLevel - 1, 2) * XP_PER_LEVEL_FACTOR
	);
	let nextLevelBaseXp = $derived(Math.pow(currentLevel, 2) * XP_PER_LEVEL_FACTOR);
	let xpIntoLevel = $derived(currentXp - currentLevelBaseXp);
	let xpRequiredForNext = $derived(nextLevelBaseXp - currentLevelBaseXp);
	let xpPercentage = $derived(Math.min(100, Math.max(0, (xpIntoLevel / xpRequiredForNext) * 100)));

	let tabKey = $state(0);
	function selectTab(tabId) {
		activeTab = tabId;
		tabKey++;
		if (activeTab === 'reposts') loadReposts();
		if (activeTab === 'trash' && deletedPosts.length === 0) loadTrash();
	}
	let loadingTrash = $state(false);
	let restoreError = $state('');

	let isOwnProfile = $derived(authStore.isAuthenticated && authStore.user?.username === username);
	let followingState = $state(false);
	let followersCount = $state(0);

	// ── Watch Username changes ───────────────────────────────────────────────
	$effect(() => {
		if (username) {
			loadUserProfile();
		}
	});

	// ── Lifecycle ────────────────────────────────────────────────────────────
	onMount(() => {
		loadUserProfile();
	});

	// ── Actions ──────────────────────────────────────────────────────────────
	async function loadUserProfile() {
		loading = true;
		postsPage = 1;
		hasMorePosts = true;
		try {
			// Fetch user profile y posts en paralelo: ambos dependen solo del username (ya conocido),
			// no hay dependencia entre las llamadas, así que se lanzan a la vez en lugar de secuencial.
			const [data, postsData] = await Promise.all([
				usersApi.get(username),
				usersApi.posts(username, { page: 1, limit: 10 })
			]);
			user = data.user;
			followingState = user.is_following || false;
			followersCount = user.follower_count || 0;

			posts = postsData.posts || [];
			if (posts.length < 10) hasMorePosts = false;
		} catch (err) {
			console.error('Failed to load user profile:', err);
			// Fallback mockup profile
			user = {
				id: 99,
				username,
				display_name: username.charAt(0).toUpperCase() + username.slice(1),
				bio: 'Creador de contenido virtual oficial en VSocial. ¡Bienvenidos a mi perfil!',
				location: 'Internet',
				website: 'https://vsocial.app',
				joined_at: new Date().toISOString(),
				avatar_url: null,
				cover_url: null,
				posts_count: 8,
				followers_count: 520,
				following_count: 180,
				is_virtual: true,
				is_verified: true,
				vtuber_profile: {
					character_name: username.charAt(0).toUpperCase() + username.slice(1) + ' Live',
					lore: 'Una guardiana cibernética del año 2099 enviada al presente para compartir buena música.',
					model_creator: '@Live2DBuilder',
					software: 'VTube Studio + OBS'
				},
				interests: ['Gaming', 'Anime', 'Música', 'Live2D'],
				level: 15,
				xp_points: 2250,
				title_text: 'Leyenda',
				title_color: 'purple'
			};
			followersCount = user.followers_count;
		} finally {
			loading = false;
		}
	}

	async function toggleFollow() {
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}

		try {
			if (followingState) {
				await usersApi.unfollow(username);
				followingState = false;
				followersCount = Math.max(0, followersCount - 1);
			} else {
				await usersApi.follow(username);
				followingState = true;
				followersCount += 1;
			}
		} catch (err) {
			console.error('Follow toggle error:', err);
		}
	}

	async function startDirectMessage() {
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}

		try {
			await messagesApi.conversations.create({ user_id: user.id });
			goto('/messages');
		} catch (err) {
			console.error('DM initiation error:', err);
		}
	}

	async function loadMorePosts() {
		if (loadingMorePosts || !hasMorePosts || loading) return;
		loadingMorePosts = true;
		try {
			const nextPage = postsPage + 1;
			const data = await usersApi.posts(username, { page: nextPage, limit: 10 });
			const newPosts = data.posts || [];
			if (newPosts.length === 0) {
				hasMorePosts = false;
			} else {
				posts = [...posts, ...newPosts];
				postsPage = nextPage;
				if (newPosts.length < 10) hasMorePosts = false;
			}
		} catch (e) {
			console.error('Failed to load more posts:', e);
		} finally {
			loadingMorePosts = false;
		}
	}

	async function loadReposts() {
		loadingReposts = true;
		repostsPage = 1;
		hasMoreReposts = true;
		try {
			const data = await usersApi.reposts(username, { page: 1, limit: 10 });
			const list = data.reposts || data.posts || [];
			reposts = list;
			if (list.length < 10) hasMoreReposts = false;
		} catch (e) {
			console.error('Failed to load reposts:', e);
			reposts = [];
		} finally {
			loadingReposts = false;
		}
	}

	async function loadMoreReposts() {
		if (loadingMoreReposts || !hasMoreReposts || loadingReposts) return;
		loadingMoreReposts = true;
		try {
			const nextPage = repostsPage + 1;
			const data = await usersApi.reposts(username, { page: nextPage, limit: 10 });
			const list = data.reposts || data.posts || [];
			if (list.length === 0) {
				hasMoreReposts = false;
			} else {
				reposts = [...reposts, ...list];
				repostsPage = nextPage;
				if (list.length < 10) hasMoreReposts = false;
			}
		} catch (e) {
			console.error('Failed to load more reposts:', e);
		} finally {
			loadingMoreReposts = false;
		}
	}

	function infiniteScrollPosts(node) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !loadingMorePosts && hasMorePosts && !loading) {
					loadMorePosts();
				}
			},
			{ rootMargin: '300px' }
		);
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	function infiniteScrollReposts(node) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !loadingMoreReposts && hasMoreReposts && !loadingReposts) {
					loadMoreReposts();
				}
			},
			{ rootMargin: '300px' }
		);
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	async function loadTrash() {
		loadingTrash = true;
		try {
			const data = await usersApi.posts(username, { status: 'deleted' });
			deletedPosts = data.posts || [];
		} catch (e) {
			console.error('Failed to load trash:', e);
		} finally {
			loadingTrash = false;
		}
	}

	async function restorePost(postId) {
		restoreError = '';
		try {
			await postsApi.restore(postId);
			deletedPosts = deletedPosts.filter((p) => p.id !== postId);
			user.post_count = (user.post_count || 0) + 1;
			const postsData = await usersApi.posts(username);
			posts = postsData.posts || [];
		} catch (e) {
			console.error('Failed to restore post:', e);
			restoreError = 'Error al restaurar el post. Por favor intenta de nuevo.';
			setTimeout(() => (restoreError = ''), 4000);
		}
	}

	function getLuminance(hex) {
		if (!hex) return 0;
		hex = hex.replace('#', '');
		if (hex.length === 3)
			hex = hex
				.split('')
				.map((c) => c + c)
				.join('');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		return (r * 299 + g * 587 + b * 114) / 1000;
	}

	let hasCustomBg = $derived(
		!!(user?.customization?.bg_color || user?.customization?.bg_image_url)
	);
	let isLightBg = $derived(
		user?.customization?.bg_image_url
			? false
			: user?.customization?.bg_color
				? getLuminance(user.customization.bg_color) > 150
				: false
	);
</script>

<svelte:head>
	<title>{user ? user.display_name : 'Cargando perfil...'} — VSocial</title>
	{#if user?.customization?.custom_font_url}
		{@html `<style>
      @font-face {
        font-family: '${user.customization.font_family}';
        src: url('${user.customization.custom_font_url}');
        font-display: swap;
      }
    </style>`}
	{/if}
	{#if user?.customization?.custom_css}
		{@html `<style>${user.customization.custom_css}</style>`}
	{/if}
</svelte:head>

<div
	class="profile-custom-wrapper {hasCustomBg ? (isLightBg ? 'force-light' : 'force-dark') : ''}"
	style:--bg-main={user?.customization?.bg_color || undefined}
	style:--accent-blue-base={user?.customization?.primary_color || undefined}
	style:--glass-blur={user?.customization?.glass_blur
		? `blur(${user.customization.glass_blur}px) saturate(1.2)`
		: undefined}
	style:--font-sans={user?.customization?.font_family
		? `'${user.customization.font_family}', sans-serif`
		: undefined}
	style:--font-display={user?.customization?.font_family
		? `'${user.customization.font_family}', sans-serif`
		: undefined}
	style={user?.customization?.bg_image_url
		? `background: url('${user.customization.bg_image_url}') center/cover fixed !important;`
		: ''}
>
	<div class="profile-container px-4 py-6">
		{#if loading}
			<!-- Loading State -->
			<div class="profile-loading">
				<span class="loading loading-spinner text-primary"></span>
				<span>Cargando perfil virtual...</span>
			</div>
		{:else if !user}
			<div class="glass-card error-profile-box">
				<span class="material-icons-round">person_off</span>
				<h2>Usuario no encontrado</h2>
				<p>El perfil que buscas no existe o ha sido eliminado.</p>
			</div>
		{:else}
			<!-- Profile Banner & Info -->
			<div class="profile-header-card glass-panel">
				<!-- Banner/Cover Image -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="profile-cover {user.cover_url ? 'is-expandable' : ''}"
					onclick={() => {
						if (user.cover_url) mediaViewer.openProfileCover(user);
					}}
					title={user.cover_url ? 'Ver foto de portada completa' : ''}
				>
					{#if user.cover_url}
						<img
							src={user.cover_url}
							alt="Cover"
							width="1200"
							height="180"
							loading="eager"
							fetchpriority="high"
							decoding="async"
						/>
					{/if}
					<div class="cover-glow-bubble"></div>

					{#if isOwnProfile}
						<button
							type="button"
							class="profile-cover-camera-btn"
							onclick={(e) => {
								e.stopPropagation();
								coverInput?.click();
							}}
							title="Cambiar portada (16:5)"
							aria-label="Cambiar foto de portada"
						>
							<span class="material-icons-round">photo_camera</span>
							<span class="btn-text">Cambiar portada</span>
						</button>
					{/if}
				</div>

				<!-- Avatar & Basic Info -->
				<div class="profile-header">
					<div class="avatar-and-names">
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="profile-avatar {user.avatar_url ? 'is-expandable' : ''}"
							onclick={() => {
								if (user.avatar_url) mediaViewer.openProfileAvatar(user);
							}}
							title={user.avatar_url ? 'Ver foto de perfil completa' : ''}
						>
							{#if user.avatar_url}
								<img
									src={user.avatar_url}
									alt="Avatar de {user.display_name}"
									crossorigin="anonymous"
									width="84"
									height="84"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<div class="avatar-initials-fallback">
									{user.display_name.charAt(0).toUpperCase()}
								</div>
							{/if}

							{#if isOwnProfile}
								<button
									type="button"
									class="profile-avatar-camera-btn"
									onclick={(e) => {
										e.stopPropagation();
										avatarInput?.click();
									}}
									title="Cambiar foto de perfil (1:1)"
									aria-label="Cambiar foto de perfil"
								>
									<span class="material-icons-round">photo_camera</span>
								</button>
							{/if}
						</div>
						<div class="profile-credentials">
							<div class="display-name-row">
								<h1 class="profile-display-name">{user.display_name}</h1>
								<VerifiedBadge
									role={user.role}
									isVerified={user.is_verified == 1}
									size="24px"
									interactive={true}
								/>
								{#if user.level != null}
									<LevelBadge level={user.level || 1} size="md" />
								{/if}
								{#if user.title_text}
									<UserTitleBadge title={user.title_text} color={user.title_color} size="md" />
								{/if}
								{#if user.is_virtual}
									<span class="aero-badge-virtual">VTuber</span>
								{/if}
							</div>
							<p class="profile-username">@{user.username}</p>
						</div>
					</div>

					<div class="profile-actions-row">
						{#if isOwnProfile}
							<a
								href="/settings"
								class="btn-aero-secondary"
								style="white-space: nowrap; flex: 0 0 auto; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 20px; font-size: 0.9rem;"
							>
								<span class="material-icons-round text-[18px]">settings</span> Editar perfil
							</a>
						{:else}
							<button
								onclick={startDirectMessage}
								class="btn-aero-secondary"
								style="white-space: nowrap; flex: 0 0 auto; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 20px; font-size: 0.9rem;"
							>
								<span class="material-icons-round text-[18px]">message</span> Mensaje
							</button>
							<button
								class="profile-follow-btn"
								class:following={followingState}
								onclick={toggleFollow}
							>
								{followingState ? 'Siguiendo' : 'Seguir'}
							</button>
						{/if}

						{#if user && user.payment_link}
							<a
								href={user.payment_link}
								target="_blank"
								rel="noopener noreferrer nofollow"
								class="btn-aero-primary profile-pay-btn"
								title="Apoyar a {user.display_name || user.username}"
							>
								<span class="material-icons-round text-[18px]">payments</span> Apoyar
							</a>
						{/if}
					</div>
				</div>

				<!-- User Stats Row -->
				<div class="profile-stats-bar">
					<div class="stat-col">
						<span class="stat-num">{posts.length}</span>
						<span class="stat-label">Publicaciones</span>
					</div>
					<a href="/u/{user.username}/following?tab=followers" class="stat-col interactive"
						><span class="stat-num">{followersCount}</span>
						<span class="stat-label">Seguidores</span></a
					>
					<a href="/u/{user.username}/following?tab=following" class="stat-col interactive"
						><span class="stat-num">{user.following_count || 0}</span>
						<span class="stat-label">Siguiendo</span></a
					>
				</div>

				<!-- XP Progress Bar -->
				<div class="profile-xp-container">
					<div class="profile-xp-header">
						<span class="xp-current">{currentXp} XP</span>
						<span class="xp-level">Lv. {currentLevel + 1} ({nextLevelBaseXp} XP)</span>
					</div>
					<div class="xp-bar-track">
						<div class="xp-bar-fill" style="width: {xpPercentage}%"></div>
					</div>
				</div>

				<!-- Bio / Info Section -->
				<div class="profile-details-block">
					{#if user.bio}
						<p class="profile-bio">{@html formatHashtags(user.bio)}</p>
					{/if}

					<div class="profile-meta-row">
						{#if user.location}
							<span class="meta-item">
								<span class="material-icons-round" style="font-size: 0.9rem;">place</span>
								{user.location}
							</span>
						{/if}
						{#if user.website}
							<span class="meta-item">
								<span class="material-icons-round" style="font-size: 0.9rem;">link</span>
								<a href={user.website} target="_blank" rel="noopener noreferrer" class="meta-link"
									>{user.website}</a
								>
							</span>
						{/if}
						<span class="meta-item">
							<span class="material-icons-round" style="font-size: 0.9rem;">calendar_today</span>
							Se unió en {new Date(
								user.created_at || user.joined_at || Date.now()
							).toLocaleDateString('es', { month: 'long', year: 'numeric' })}
						</span>
					</div>
				</div>

				<!-- Tab selectors -->
				<div class="tabs-container">
					{#each [{ id: 'posts', label: 'Posts' }, { id: 'reposts', label: 'Reposts' }, { id: 'about', label: 'Sobre mí' }, ...(isOwnProfile ? [{ id: 'history', label: 'Historial' }, { id: 'trash', label: 'Papelera' }] : [])] as tab}
						<button
							onclick={() => selectTab(tab.id)}
							class="tab-button"
							class:active={activeTab === tab.id}
						>
							{tab.label}
						</button>
					{/each}
				</div>

				<!-- Tab Content Area -->
				<div class="smooth-transition-wrapper profile-content-area">
					{#key tabKey}
						<div
							in:fade={{ duration: 250, delay: 100 }}
							out:fade={{ duration: 150 }}
							class="smooth-transition-content"
						>
							{#if activeTab === 'posts'}
								{#if posts.length === 0}
									<div class="glass-card empty-posts-box">
										<span class="material-icons-round">feed</span>
										<p>Este creador no ha publicado nada todavía.</p>
									</div>
								{:else}
									<div class="profile-posts-list">
										{#each posts as post (post.id)}
											<PostCard
												{post}
												onDelete={() => (posts = posts.filter((p) => p.id !== post.id))}
											/>
										{/each}
										{#if hasMorePosts}
											<div
												class="text-center py-4"
												use:infiniteScrollPosts
												style="min-height: 40px; display: flex; align-items: center; justify-content: center;"
											>
												{#if loadingMorePosts}
													<span
														class="material-icons-round notif-pulse"
														style="color: var(--aero-blue); font-size: 24px;">sync</span
													>
												{/if}
											</div>
										{/if}
									</div>
								{/if}
							{:else if activeTab === 'reposts'}
								{#if loadingReposts}
									<div class="glass-card empty-posts-box">
										<span
											class="material-icons-round notif-pulse"
											style="color: var(--aero-mint, #00d4aa);">repeat</span
										>
										<p>Cargando reposteos...</p>
									</div>
								{:else if reposts.length === 0}
									<div class="glass-card empty-posts-box">
										<span class="material-icons-round" style="color: var(--aero-mint, #00d4aa);"
											>repeat</span
										>
										<p>Este usuario no ha reposteado ninguna publicación todavía.</p>
									</div>
								{:else}
									<div class="profile-posts-list">
										{#each reposts as post (post.id + '-' + (post.reposted_by?.id || 'r'))}
											<PostCard
												{post}
												onDelete={() => (reposts = reposts.filter((p) => p.id !== post.id))}
											/>
										{/each}
										{#if hasMoreReposts}
											<div
												class="text-center py-4"
												use:infiniteScrollReposts
												style="min-height: 40px; display: flex; align-items: center; justify-content: center;"
											>
												{#if loadingMoreReposts}
													<span
														class="material-icons-round notif-pulse"
														style="color: var(--aero-mint); font-size: 24px;">sync</span
													>
												{/if}
											</div>
										{/if}
									</div>
								{/if}
							{:else if activeTab === 'about'}
								<div class="about-grid">
									<!-- Lore & Description Card -->
									<div class="about-main-info">
										<div class="glass-card about-card">
											<h3 class="about-card-title">Biografía</h3>
											<p class="about-card-desc">{user.bio || 'Sin biografía disponible.'}</p>
										</div>

										{#if user.is_virtual && user.vtuber_profile}
											<div class="glass-card about-card" style="margin-top: 16px;">
												<h3 class="about-card-title">Ficha Virtual</h3>
												<div class="setup-details">
													<div class="setup-row">
														<span class="setup-label">Personaje</span>
														<span class="setup-val" style="color: var(--secondary);"
															>{user.vtuber_profile.character_name || user.display_name}</span
														>
													</div>
													{#if user.vtuber_profile.lore}
														<div class="setup-row" style="margin-top: 12px;">
															<span class="setup-label">Historia / Lore</span>
															<p class="about-card-desc" style="margin-top: 2px;">
																{user.vtuber_profile.lore}
															</p>
														</div>
													{/if}
												</div>
											</div>
										{/if}
									</div>

									<!-- Technical Setup Card -->
									<div class="about-side-info">
										{#if user.is_virtual && user.vtuber_profile}
											<div class="glass-card about-card">
												<h3 class="about-card-title">Setup Técnico</h3>
												<div
													class="setup-details"
													style="display: flex; flex-direction: column; gap: 12px;"
												>
													{#if user.vtuber_profile.model_creator}
														<div class="setup-row">
															<span class="setup-label">Artista / Rigging:</span>
															<span class="setup-val">{user.vtuber_profile.model_creator}</span>
														</div>
													{/if}
													{#if user.vtuber_profile.software}
														<div class="setup-row">
															<span class="setup-label">Software Utilizado:</span>
															<span class="setup-val">{user.vtuber_profile.software}</span>
														</div>
													{/if}
												</div>
											</div>
										{/if}

										<!-- Interests -->
										{#if user.interests && user.interests.length > 0}
											<div class="glass-card about-card" style="margin-top: 16px;">
												<h3 class="about-card-title">Temas de Interés</h3>
												<div class="tags-row">
													{#each user.interests as interest}
														<span class="interest-tag">
															{interest}
														</span>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								</div>
							{:else if activeTab === 'history' && isOwnProfile}
								<div class="glass-card about-card" style="padding: 0;">
									<ActivityHistory />
								</div>
							{:else if activeTab === 'trash'}
								{#if loadingTrash}
									<div class="profile-loading">
										<span class="loading loading-spinner text-primary"></span>
										<span>Cargando papelera...</span>
									</div>
								{:else if deletedPosts.length === 0}
									<div class="glass-card empty-posts-box">
										<span class="material-icons-round">delete_outline</span>
										<p>No tienes publicaciones en la papelera.</p>
									</div>
								{:else}
									<div class="profile-posts-list">
										<div
											class="glass-panel p-4 mb-4 flex items-center gap-3 text-sm rounded-lg"
											style="background: rgba(46, 134, 232, 0.05); border-color: rgba(46, 134, 232, 0.1);"
										>
											<span class="material-icons-round text-[20px] text-primary">info</span>
											<span class="text-muted"
												>Los posts eliminados permanecerán aquí durante 30 días antes de ser
												eliminados permanentemente.</span
											>
										</div>

										{#if restoreError}
											<div
												class="glass-panel p-3 mb-4 flex items-center gap-2 text-sm rounded-lg"
												style="background: rgba(232, 74, 114, 0.1); border-color: rgba(232, 74, 114, 0.2); color: var(--aero-rose);"
											>
												<span class="material-icons-round text-[18px]">error_outline</span>
												{restoreError}
											</div>
										{/if}

										{#each deletedPosts as post (post.id)}
											<div class="glass-panel p-4 flex justify-between items-center mb-3">
												<div class="min-w-0 flex-1 mr-4">
													<p class="text-sm text-main truncate font-semibold mb-1">
														Post #{post.id}
													</p>
													<p class="text-xs text-muted truncate">
														{post.body || (post.media?.length ? '[Multimedia]' : 'Sin contenido')}
													</p>
												</div>
												<button
													onclick={() => restorePost(post.id)}
													class="btn-aero-primary"
													style="padding: 6px 14px; font-size: 0.8rem;">Restaurar</button
												>
											</div>
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/key}
				</div>
			</div>
		{/if}
	</div>
</div>

{#if isOwnProfile}
	<input
		id="profile-avatar-upload"
		name="profile-avatar-upload"
		type="file"
		accept="image/*"
		bind:this={avatarInput}
		onchange={handleAvatarChange}
		style="display: none;"
	/>
	<input
		id="profile-cover-upload"
		name="profile-cover-upload"
		type="file"
		accept="image/*"
		bind:this={coverInput}
		onchange={handleCoverChange}
		style="display: none;"
	/>

	{#if cropFile}
		<ImageCropperModal
			imageFile={cropFile}
			aspectRatio={cropRatio}
			shape={cropType === 'avatar' ? 'circle' : 'rect'}
			{cropType}
			title={cropType === 'avatar' ? 'Ajustar Foto de Perfil' : 'Ajustar Portada de Perfil'}
			subtitle={cropType === 'avatar'
				? 'Centra y escala tu avatar • Proporción 1:1'
				: 'Encuadra tu banner panorámico • Proporción 16:5'}
			onCrop={handleCrop}
			onCancel={cancelCrop}
		/>
	{/if}
{/if}

<style>
	/* ── Silky smooth crossfader ── */
	.smooth-transition-wrapper {
		display: grid;
		grid-template-columns: 1fr;
		width: 100%;
	}
	.smooth-transition-content {
		grid-column: 1;
		grid-row: 1;
		width: 100%;
	}

	.profile-custom-wrapper {
		background-color: var(--bg-main, transparent);
		min-height: calc(100vh - 70px);
		transition: background-color 0.3s ease;
	}

	.force-dark {
		--text-primary: #ffffff;
		--text-main: #ffffff;
		--text-secondary: rgba(255, 255, 255, 0.7);
		--text-muted: rgba(255, 255, 255, 0.5);
		--border-subtle: rgba(255, 255, 255, 0.15);
		--glass-border: rgba(255, 255, 255, 0.15);
	}

	.force-light {
		--text-primary: #111111;
		--text-main: #000000;
		--text-secondary: rgba(0, 0, 0, 0.7);
		--text-muted: rgba(0, 0, 0, 0.5);
		--border-subtle: rgba(0, 0, 0, 0.15);
		--glass-border: rgba(0, 0, 0, 0.15);
	}

	.profile-container {
		max-width: 800px;
		margin: 0 auto;
		padding-bottom: 48px;
	}

	.profile-loading {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 12px;
		padding: 64px;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.error-profile-box {
		padding: 48px;
		text-align: center;
		border-radius: var(--radius-lg);
		margin: 24px 16px;
	}

	.error-profile-box .material-icons-round {
		font-size: 4rem;
		color: var(--aero-rose);
		margin-bottom: 16px;
		opacity: 0.85;
	}

	.error-profile-box h2 {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-main);
		margin: 0 0 8px 0;
	}

	.error-profile-box p {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
	}

	.profile-header-card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.profile-cover {
		width: 100%;
		height: 200px;
		background: var(--grad-primary);
		border-top-left-radius: var(--radius-lg);
		border-top-right-radius: var(--radius-lg);
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
		position: relative;
		overflow: hidden;
		box-shadow: inset 0 -20px 50px rgba(0, 0, 0, 0.15);
	}

	.profile-cover.is-expandable {
		cursor: pointer;
	}

	.profile-cover.is-expandable:hover img {
		filter: brightness(1.04);
		transition: filter 0.25s ease;
	}

	.profile-cover-camera-btn {
		position: absolute;
		top: 14px;
		right: 14px;
		z-index: 8;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: #ffffff;
		border-radius: var(--radius-full);
		padding: 6px 14px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
		transition:
			background var(--t-fast),
			border-color var(--t-fast),
			transform var(--t-fast);
	}

	.profile-cover-camera-btn:hover {
		background: var(--aero-blue);
		border-color: #ffffff;
		transform: translateY(-1px);
	}

	.profile-cover-camera-btn:active {
		transform: translateY(1px);
	}

	.profile-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center center;
		opacity: 1; /* override the container opacity for images */
		display: block;
	}

	.cover-glow-bubble {
		position: absolute;
		bottom: -40px;
		right: 40px;
		width: 140px;
		height: 140px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: rgba(255, 255, 255, 0.25);
		filter: blur(40px);
		pointer-events: none;
	}

	.profile-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px 0;
		position: relative;
		z-index: 10;
		gap: 16px;
		flex-wrap: wrap;
	}

	@media (max-width: 576px) {
		.profile-header {
			flex-direction: column;
			align-items: flex-start;
			padding: 0 16px 12px;
			gap: 12px;
		}
	}

	.avatar-and-names {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: -50px;
	}

	@media (max-width: 576px) {
		.avatar-and-names {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
			margin-top: 0;
		}
	}

	.profile-avatar {
		width: 84px;
		height: 84px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		padding: 3px;
		background: var(--bg-surface);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
		overflow: hidden;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		transition: box-shadow 0.25s ease;
	}

	.profile-avatar.is-expandable {
		cursor: pointer;
	}

	.profile-avatar.is-expandable:hover {
		box-shadow: 0 0 16px rgba(27, 133, 243, 0.35);
	}

	.profile-avatar-camera-btn {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		border: none;
		border-radius: inherit;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-size: 24px;
		opacity: 0;
		cursor: pointer;
		transition: opacity var(--t-fast);
		z-index: 5;
	}

	.profile-avatar:hover .profile-avatar-camera-btn,
	.profile-avatar-camera-btn:focus-visible {
		opacity: 1;
	}

	@media (max-width: 576px) {
		.profile-avatar {
			margin-top: -42px;
		}
	}

	.profile-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center center;
		border-radius: calc(var(--radius-squircle) - 2px);
		corner-shape: squircle;
		display: block;
	}

	.avatar-initials-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--grad-primary);
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		color: #fff;
		font-size: 2rem;
		font-weight: 900;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.profile-credentials {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 36px;
	}

	@media (max-width: 576px) {
		.profile-credentials {
			margin-top: 0;
		}
	}

	.display-name-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.profile-display-name {
		font-size: 1.4rem;
		font-weight: 900;
		color: var(--text-primary);
		margin: 0;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
	}

	.profile-username {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}

	.profile-actions-row {
		display: flex;
		gap: 10px;
		margin-top: 10px;
		flex-wrap: wrap;
	}

	.profile-pay-btn {
		white-space: nowrap;
		flex: 0 0 auto;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 0 20px;
		font-size: 0.9rem;
	}

	@media (max-width: 576px) {
		.profile-actions-row {
			margin-top: 0;
		}
	}

	.profile-stats-bar {
		display: flex;
		justify-content: flex-start;
		gap: 24px;
		padding: 14px 24px;
		border-top: 1px solid var(--border-subtle);
		border-bottom: 1px solid var(--border-subtle);
		margin: 20px 24px 0 24px;
		font-size: 0.85rem;
	}

	@media (max-width: 576px) {
		.profile-stats-bar {
			justify-content: space-around;
			gap: 0;
			margin: 16px 16px 0 16px;
			padding: 12px 0;
		}
	}

	.stat-col {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		border-radius: var(--radius-sm);
		padding: 4px 8px;
		transition: background var(--t-fast);
	}
	.stat-col.interactive:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	@media (max-width: 576px) {
		.stat-col {
			flex-direction: column;
			gap: 2px;
		}
	}

	.stat-num {
		font-weight: 900;
		color: var(--text-main);
		font-size: 0.95rem;
	}

	@media (max-width: 576px) {
		.stat-num {
			font-size: 1rem;
		}
	}

	.stat-label {
		color: var(--text-muted);
	}

	.profile-xp-container {
		padding: 16px 24px;
		margin: 0 24px;
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	@media (max-width: 576px) {
		.profile-xp-container {
			margin: 0 16px;
			padding: 12px 0;
		}
	}

	.profile-xp-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-weight: 600;
	}

	.xp-current {
		color: var(--aero-blue);
		font-weight: 800;
	}

	.xp-level {
		font-family: var(--font-sans);
		opacity: 0.8;
	}

	.xp-bar-track {
		width: 100%;
		height: 8px;
		background: rgba(0, 0, 0, 0.08);
		border-radius: var(--radius-sm);
		overflow: hidden;
		position: relative;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	:global([data-theme='dark']) .xp-bar-track {
		background: rgba(255, 255, 255, 0.06);
	}

	.xp-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--aero-sky), var(--aero-blue));
		border-radius: var(--radius-sm);
		box-shadow: 0 0 12px rgba(var(--accent-blue-rgb), 0.35);
		transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.profile-details-block {
		padding: 0 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 16px;
	}

	@media (max-width: 576px) {
		.profile-details-block {
			padding: 0 16px;
		}
	}

	.profile-bio {
		font-size: 0.85rem;
		color: var(--text-primary);
		line-height: 1.5;
		margin: 0;
		max-width: 640px;
	}

	.profile-meta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.meta-link {
		color: var(--aero-sky);
		text-decoration: none;
		font-weight: 600;
	}

	.meta-link:hover {
		text-decoration: underline;
	}

	.tabs-container {
		margin: 24px 24px 0 24px;
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		gap: 12px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tabs-container::-webkit-scrollbar {
		display: none;
	}

	@media (max-width: 576px) {
		.tabs-container {
			margin: 16px 16px 0 16px;
		}
	}

	.tab-button {
		padding: 12px 20px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-muted);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.tab-button:hover {
		color: var(--text-main);
	}

	.tab-button.active {
		color: var(--aero-blue);
		font-weight: 700;
		border-bottom-color: var(--aero-blue);
		text-shadow: 0 0 8px rgba(46, 134, 232, 0.3);
	}

	.profile-content-area {
		padding: 24px;
	}

	@media (max-width: 576px) {
		.profile-content-area {
			padding: 16px;
		}
	}

	.empty-posts-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px;
		text-align: center;
		color: var(--text-muted);
	}

	.empty-posts-box .material-icons-round {
		font-size: 2.5rem;
		margin-bottom: 8px;
		opacity: 0.4;
	}

	.profile-posts-list {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.about-grid {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 20px;
		align-items: start;
	}

	@media (max-width: 768px) {
		.about-grid {
			grid-template-columns: 1fr;
		}
	}

	.about-card {
		padding: 20px;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.about-card-title {
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--text-main);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 0;
	}

	.about-card-desc {
		font-size: 0.8rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.setup-details {
		display: flex;
		flex-direction: column;
	}

	.setup-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.setup-label {
		font-size: 0.65rem;
		color: var(--text-muted);
		text-transform: uppercase;
		font-weight: 700;
		letter-spacing: 0.5px;
	}

	.setup-val {
		font-size: 0.8rem;
		color: var(--text-main);
		font-weight: 650;
	}

	.tags-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.interest-tag {
		padding: 4px 10px;
		border-radius: var(--radius-sm);
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		color: var(--aero-sky);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.profile-follow-btn {
		background: var(--grad-primary);
		color: var(--text-on-accent, white);
		font-size: 0.9rem;
		font-weight: 700;
		padding: 0 16px;
		border-radius: var(--radius-xl);
		border: 1px solid transparent;
		box-shadow:
			0 4px 12px rgba(14, 165, 233, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.3);
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		cursor: pointer;
		min-width: 110px;
		min-height: 44px;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}
	.profile-follow-btn:hover {
		transform: translateY(-2px) scale(1.02);
		box-shadow:
			0 6px 16px rgba(14, 165, 233, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.4);
		background: var(--grad-primary-hover, linear-gradient(135deg, #0ea5e9, #3b82f6));
	}
	.profile-follow-btn:active {
		transform: translateY(1px) scale(0.98);
		box-shadow: 0 2px 8px rgba(14, 165, 233, 0.2);
	}
	.profile-follow-btn.following {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
		border: 1px solid rgba(255, 255, 255, 0.2);
		box-shadow: none;
		text-shadow: none;
	}
	.profile-follow-btn.following:hover {
		background: rgba(244, 63, 94, 0.1);
		color: var(--rose-500, #f43f5e);
		border-color: rgba(244, 63, 94, 0.3);
		box-shadow: 0 0 12px rgba(244, 63, 94, 0.1);
	}
</style>
