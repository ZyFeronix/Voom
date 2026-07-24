<script>
	import { fade } from 'svelte/transition';
	import { users as usersApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { goto } from '$app/navigation';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';
	import UserTitleBadge from '$lib/components/gamification/UserTitleBadge.svelte';
	import { formatHashtags } from '$lib/utils/textFormatting.js';
	import { onDestroy } from 'svelte';

	let { username, basicUser = null, children } = $props();

	let isHovered = $state(false);
	let showCard = $state(false);
	let timer;
	let hideTimer;
	let triggerEl;
	let positionClass = $state('position-bottom');

	let fullUser = $state();

	$effect.pre(() => {
		if (basicUser && !fullUser) {
			fullUser = basicUser;
		}
	});

	function cleanupZIndex() {
		if (triggerEl) {
			const postCard = triggerEl.closest('.aero-post-card');
			if (postCard) postCard.classList.remove('has-active-hover-card');
		}
	}

	onDestroy(() => {
		cleanupZIndex();
	});

	$effect(() => {
		if (showCard && triggerEl) {
			const rect = triggerEl.getBoundingClientRect();
			const viewportHeight = window.innerHeight;
			// The card is roughly 300px tall. Flip to top if no space below and there is space above.
			if (viewportHeight - rect.bottom < 320 && rect.top > 320) {
				positionClass = 'position-top';
			} else {
				positionClass = 'position-bottom';
			}

			const postCard = triggerEl.closest('.aero-post-card');
			if (postCard) postCard.classList.add('has-active-hover-card');
		}
	});

	function handleMouseEnter() {
		clearTimeout(hideTimer);
		isHovered = true;
		timer = setTimeout(async () => {
			if (isHovered) {
				showCard = true;
				if (!fullUser || !fullUser.bio || typeof fullUser.follower_count === 'undefined') {
					try {
						const data = await usersApi.get(username);
						if (data.user) {
							fullUser = { ...fullUser, ...data.user };
						}
					} catch (e) {
						console.error(e);
					}
				}
			}
		}, 450); // Debounce
	}

	function handleMouseLeave() {
		clearTimeout(timer);
		isHovered = false;
		hideTimer = setTimeout(() => {
			if (!isHovered) showCard = false;
		}, 300); // 300ms window to move mouse into card
	}

	function handleCardEnter() {
		clearTimeout(hideTimer);
		isHovered = true;
	}

	function handleCardLeave() {
		isHovered = false;
		hideTimer = setTimeout(() => {
			if (!isHovered) showCard = false;
		}, 300);
	}

	async function toggleFollow(e) {
		e.stopPropagation();
		e.preventDefault();
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}

		const wasFollowing = fullUser.is_following;
		fullUser.is_following = !wasFollowing;
		fullUser.follower_count += wasFollowing ? -1 : 1;

		try {
			if (wasFollowing) {
				await usersApi.unfollow(username);
			} else {
				await usersApi.follow(username);
			}
		} catch (_err) {
			// Revert on error
			fullUser.is_following = wasFollowing;
			fullUser.follower_count += wasFollowing ? 1 : -1;
		}
	}
</script>

<div
	bind:this={triggerEl}
	class="hover-trigger-wrap"
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	role="presentation"
>
	{@render children()}

	{#if showCard}
		<div
			class="vs-hover-card glass-panel {positionClass}"
			onmouseenter={handleCardEnter}
			onmouseleave={handleCardLeave}
			transition:fade={{ duration: 150 }}
			onoutroend={cleanupZIndex}
			onclick={(e) => e.stopPropagation()}
			role="button"
			tabindex="0"
			onkeydown={(_e) => {}}
		>
			{#if fullUser}
				<div class="hc-header" style="position: relative; z-index: 1;">
					{#if fullUser.cover_url}
						<img
							src={fullUser.cover_url}
							alt="Cover"
							class="hc-cover-img"
							width="290"
							height="85"
							loading="lazy"
							decoding="async"
						/>
					{:else}
						<div class="hc-cover-fallback"></div>
					{/if}
					<div class="hc-overlay"></div>
				</div>
				<div class="hc-body" style="position: relative; z-index: 1;">
					<div class="hc-top-row">
						{#if fullUser.avatar_url}
							<img
								src={fullUser.avatar_url}
								alt={username}
								class="hc-avatar"
								width="68"
								height="68"
								loading="lazy"
								decoding="async"
							/>
						{:else}
							<div class="hc-avatar hc-avatar-fallback">
								{(fullUser.display_name || fullUser.username || '?')[0].toUpperCase()}
							</div>
						{/if}

						{#if fullUser.id !== authStore.user?.id && authStore.isAuthenticated}
							<button
								class="btn-aero-primary hc-follow-btn {fullUser.is_following ? 'following' : ''}"
								onclick={toggleFollow}
							>
								{fullUser.is_following ? 'Siguiendo' : 'Seguir'}
							</button>
						{/if}
					</div>

					<div class="hc-user-info">
						<div class="hc-name-row">
							<span class="hc-name">{fullUser.display_name || fullUser.username}</span>
							<VerifiedBadge
								role={fullUser.role}
								isVerified={fullUser.is_verified == 1}
								size="16px"
							/>
							{#if fullUser.level}
								<LevelBadge level={fullUser.level} size="sm" showText={false} />
							{/if}
							{#if fullUser.title_text}
								<UserTitleBadge
									title={fullUser.title_text}
									color={fullUser.title_color}
									size="sm"
								/>
							{/if}
						</div>
						<span class="hc-handle">@{fullUser.username}</span>
					</div>

					{#if fullUser.bio}
						<div class="hc-bio">{@html formatHashtags(fullUser.bio)}</div>
					{/if}

					<div class="hc-stats">
						<div class="hc-stat">
							<strong>{fullUser.following_count || 0}</strong> Siguiendo
						</div>
						<div class="hc-stat">
							<strong>{fullUser.follower_count || 0}</strong> Seguidores
						</div>
					</div>

					<div class="hc-level">
						<span class="material-icons-round text-amber-400" style="font-size: 18px;"
							>military_tech</span
						>
						<div class="hc-level-bar-wrap">
							<span class="hc-level-text">Nivel {fullUser.level || 1}</span>
						</div>
						<span class="hc-level-xp">{fullUser.xp_points || 0} XP</span>
					</div>
				</div>
			{:else}
				<div class="hc-loading" style="position: relative; z-index: 1;">
					<div class="loading-spinner"></div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.hover-trigger-wrap {
		position: relative;
		display: inline-flex; /* important so it doesn't break flex layouts */
	}

	.vs-hover-card {
		position: absolute;
		left: 0;
		width: 290px;
		border-radius: 16px;
		overflow: hidden;
		z-index: 100;
		box-shadow:
			0 10px 40px rgba(0, 0, 0, 0.4),
			0 0 0 1px var(--glass-border);
		background: color-mix(in srgb, var(--bg-surface-solid) 96%, transparent);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		cursor: default;
		text-align: left;
	}

	.vs-hover-card.position-bottom {
		top: 100%;
		margin-top: 8px;
	}

	.vs-hover-card.position-top {
		bottom: 100%;
		margin-bottom: 8px;
		transform-origin: bottom center;
	}

	.hc-header {
		height: 85px;
		position: relative;
		background: var(--bg-overlay);
	}
	.hc-cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.hc-cover-fallback {
		width: 100%;
		height: 100%;
		background: var(--grad-primary);
		opacity: 0.8;
	}
	.hc-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.7));
	}

	.hc-body {
		padding: 16px;
		position: relative;
	}

	.hc-top-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		margin-top: -48px;
		margin-bottom: 12px;
	}

	.hc-avatar {
		width: 68px;
		height: 68px;
		border-radius: 50%;
		border: 3px solid var(--bg-surface);
		object-fit: cover;
		background: var(--bg-canvas);
		z-index: 2;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}
	.hc-avatar-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 24px;
		font-weight: 800;
		color: #fff;
		background: var(--grad-primary);
	}

	.hc-follow-btn {
		padding: 6px 16px;
		font-size: 0.85rem;
		font-weight: 700;
		border-radius: 20px;
		z-index: 2;
		box-shadow: 0 4px 12px rgba(27, 133, 243, 0.2);
	}
	.hc-follow-btn.following {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
		border: 1px solid var(--border-subtle);
		box-shadow: none;
	}
	.hc-follow-btn.following:hover {
		background: rgba(236, 72, 153, 0.1);
		color: var(--aero-rose);
		border-color: rgba(236, 72, 153, 0.3);
	}

	.hc-user-info {
		display: flex;
		flex-direction: column;
		margin-bottom: 12px;
	}
	.hc-name-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.hc-name {
		font-size: 1.15rem;
		font-weight: 800;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.hc-handle {
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.hc-bio {
		font-size: 0.9rem;
		line-height: 1.4;
		color: var(--text-secondary);
		margin-bottom: 14px;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.hc-stats {
		display: flex;
		gap: 16px;
		margin-bottom: 16px;
	}
	.hc-stat {
		font-size: 0.9rem;
		color: var(--text-muted);
	}
	.hc-stat strong {
		color: var(--text-primary);
		font-weight: 800;
	}

	.hc-level {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-top: 14px;
		border-top: 1px solid var(--border-subtle);
	}
	.hc-level-text {
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--text-primary);
	}
	.hc-level-xp {
		font-size: 0.8rem;
		color: var(--aero-blue);
		font-weight: 700;
		margin-left: auto;
	}

	.hc-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 150px;
	}
	.loading-spinner {
		width: 28px;
		height: 28px;
		border: 3px solid var(--border-subtle);
		border-top-color: var(--aero-sky);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
