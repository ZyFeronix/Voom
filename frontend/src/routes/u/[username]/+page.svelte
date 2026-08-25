<script>
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		users as usersApi,
		messages as messagesApi,
		posts as postsApi,
		reels as reelsApi
	} from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import PostCard from '$lib/components/PostCard.svelte';
	import Portal from '$lib/components/Portal.svelte';
	import ProfileHeaderCard from '$lib/components/profile/ProfileHeaderCard.svelte';
	import ProfileThemeShell from '$lib/components/profile/ProfileThemeShell.svelte';
	import ProfileBlocks from '$lib/components/profile/ProfileBlocks.svelte';
	import ActivityHistory from '$lib/components/ActivityHistory.svelte';
	import ImageCropperModal from '$lib/components/ImageCropperModal.svelte';

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

	let reels = $state([]);
	let reelsPage = $state(1);
	let hasMoreReels = $state(true);
	let loadingReels = $state(false);
	let loadingMoreReels = $state(false);

	let activeTab = $state('posts'); // 'posts', 'reposts', 'reels', 'about', 'history', 'trash'
	let loading = $state(true);
	let deletedPosts = $state([]);

	const formatCount = (n) =>
		Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

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

	let tabKey = $state(0);
	function selectTab(tabId) {
		activeTab = tabId;
		tabKey++;
		if (activeTab === 'reposts') loadReposts();
		if (activeTab === 'reels') loadReels();
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

	async function loadReels() {
		loadingReels = true;
		reelsPage = 1;
		hasMoreReels = true;
		try {
			const data = await reelsApi.byUser(username, { page: 1, limit: 12 });
			const list = data.data || [];
			reels = list;
			if (list.length < 12) hasMoreReels = false;
		} catch (e) {
			console.error('Failed to load reels:', e);
			reels = [];
		} finally {
			loadingReels = false;
		}
	}

	async function loadMoreReels() {
		if (loadingMoreReels || !hasMoreReels || loadingReels) return;
		loadingMoreReels = true;
		try {
			const nextPage = reelsPage + 1;
			const data = await reelsApi.byUser(username, { page: nextPage, limit: 12 });
			const list = data.data || [];
			if (list.length === 0) {
				hasMoreReels = false;
			} else {
				reels = [...reels, ...list];
				reelsPage = nextPage;
				if (list.length < 12) hasMoreReels = false;
			}
		} catch (e) {
			console.error('Failed to load more reels:', e);
		} finally {
			loadingMoreReels = false;
		}
	}

	function infiniteScrollReels(node) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !loadingMoreReels && hasMoreReels && !loadingReels) {
					loadMoreReels();
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

	let profileBlocks = $derived.by(() => {
		const raw = user?.customization?.blocks_layout;
		if (!raw) return [];
		try {
			const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
			return Array.isArray(arr) ? arr : [];
		} catch {
			return [];
		}
	});
</script>

<svelte:head>
	<title>{user ? user.display_name : 'Cargando perfil...'} — VSocial</title>
</svelte:head>

<ProfileThemeShell customization={user?.customization}>
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
			<!-- Cabecera del perfil — componente compartido con el editor (/settings/design) -->
			<ProfileHeaderCard
				{user}
				postsCount={posts.length}
				{followersCount}
				{followingState}
				{activeTab}
				{isOwnProfile}
				onTabSelect={selectTab}
				onAvatarCamera={() => avatarInput?.click()}
				onCoverCamera={() => coverInput?.click()}
				onStartDm={startDirectMessage}
				onToggleFollow={toggleFollow}
			/>

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
						{:else if activeTab === 'reels'}
							{#if loadingReels}
								<div class="glass-card empty-posts-box">
									<span class="material-icons-round notif-pulse" style="color: var(--aero-rose);"
										>smart_display</span
									>
									<p>Cargando reels...</p>
								</div>
							{:else if reels.length === 0}
								<div class="glass-card empty-posts-box">
									<span class="material-icons-round" style="color: var(--aero-rose);"
										>smart_display</span
									>
									<p>Este creador no ha subido reels todavía.</p>
								</div>
							{:else}
								<div class="profile-reels-grid">
									{#each reels as reel (reel.id)}
										<a
											href="/reels?id={reel.id}"
											class="reel-tile"
											title={reel.caption || `@${reel.username}`}
										>
											{#if reel.thumbnail_url}
												<img src={reel.thumbnail_url} alt="" loading="lazy" />
											{:else}
												<video src={reel.video_url} muted preload="metadata" playsinline></video>
											{/if}
											<span class="reel-tile-overlay">
												<span class="material-icons-round">play_arrow</span>
											</span>
											{#if reel.like_count > 0 || reel.comment_count > 0}
												<span class="reel-tile-stats">
													{#if reel.like_count > 0}
														<span class="reel-tile-stat">
															<span class="material-icons-round">favorite</span>
															{formatCount(reel.like_count)}
														</span>
													{/if}
													{#if reel.comment_count > 0}
														<span class="reel-tile-stat">
															<span class="material-icons-round">chat_bubble</span>
															{formatCount(reel.comment_count)}
														</span>
													{/if}
												</span>
											{/if}
										</a>
									{/each}
								</div>
								{#if hasMoreReels}
									<div
										class="text-center py-4"
										use:infiniteScrollReels
										style="min-height: 40px; display: flex; align-items: center; justify-content: center;"
									>
										{#if loadingMoreReels}
											<span
												class="material-icons-round notif-pulse"
												style="color: var(--aero-rose); font-size: 24px;">sync</span
											>
										{/if}
									</div>
								{/if}
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

			<!-- Bloques personalizados del perfil (bio, enlaces, mini-feed, galería) -->
			<ProfileBlocks username={user.username} blocks={profileBlocks} />
		{/if}
	</div>
</ProfileThemeShell>

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
		<!-- Portal: el cropper es fixed y dentro de la tarjeta glass (backdrop-filter)
		     quedaría anclado a la tarjeta, fuera del viewport. -->
		<Portal>
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
		</Portal>
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

	/* Los estilos de .profile-custom-wrapper, .has-bg-image, .force-dark y
	   .force-light viven en ProfileThemeShell.svelte (fuente única compartida
	   con el editor de diseño). Aquí solo queda el layout interno. */

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

	@media (max-width: 768px) {
		/* Portada más baja en móvil: el header queda más compacto y los tabs no
		   caen detrás de la barra de navegación flotante (antes se mezclaban
		   sus etiquetas con las del nav y el perfil parecía roto). */
		.profile-container {
			padding-bottom: 116px;
		}
	}

	@media (max-width: 576px) {
		.profile-container {
			padding-top: 6px; /* el py-6 de Tailwind (24px) sobra en móvil */
		}
	}

	.profile-content-area {
		padding: 24px;
		/* El .glass-panel > * global da z-index: 3 al contenido, creando un
		   stacking context que atrapa al modal (su z-index 500 queda local y
		   los tabs sticky z-40 lo tapan al scrollear). Sin z-index el modal
		   fixed escapa y compite a nivel de página. */
		z-index: auto;
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

	/* ── Reels del creador (cuadrícula estilo Instagram) ── */
	.profile-reels-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 10px;
	}
	.reel-tile {
		position: relative;
		display: block;
		aspect-ratio: 9 / 16;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: #000000;
		border: 1px solid var(--border-subtle);
		text-decoration: none;
		transition:
			transform 0.2s var(--ease-spring),
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}
	.reel-tile:hover {
		transform: translateY(-2px);
		border-color: rgba(236, 72, 153, 0.5);
		box-shadow: 0 8px 22px rgba(236, 72, 153, 0.18);
	}
	.reel-tile img,
	.reel-tile video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.reel-tile-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.25);
		opacity: 0;
		transition: opacity 0.2s ease;
	}
	.reel-tile:hover .reel-tile-overlay {
		opacity: 1;
	}
	.reel-tile-overlay .material-icons-round {
		color: #ffffff;
		font-size: 40px;
		text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
	}
	.reel-tile-stats {
		position: absolute;
		bottom: 6px;
		left: 6px;
		right: 6px;
		display: flex;
		gap: 8px;
		color: #ffffff;
		font-size: 0.68rem;
		font-weight: 700;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
	}
	.reel-tile-stat {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
	.reel-tile-stat .material-icons-round {
		font-size: 13px;
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
</style>
