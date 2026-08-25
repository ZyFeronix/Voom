<script>
	import { fade } from 'svelte/transition';
	import { users as usersApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { uiStore } from '$lib/stores/ui.svelte.js';
	import { goto } from '$app/navigation';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';
	import UserTitleBadge from '$lib/components/gamification/UserTitleBadge.svelte';
	import { formatHashtags } from '$lib/utils/textFormatting.js';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';
	import { onDestroy } from 'svelte';

	let { username, basicUser = null, align = 'auto', children } = $props();

	let isHovered = $state(false);
	let showCard = $state(false);
	let timer;
	let hideTimer;
	let triggerEl;
	let positionClass = $state('position-bottom');
	let alignClass = $state('align-left');

	let fullUser = $state();

	$effect.pre(() => {
		if (basicUser && !fullUser) {
			fullUser = basicUser;
		}
	});

	let cardStyle = $state('');

	function updatePosition() {
		if (!triggerEl) return;
		const rect = triggerEl.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;
		const cardWidth = 290;
		const estimatedHeight = 340;

		const spaceBelow = viewportHeight - rect.bottom;
		const spaceAbove = rect.top;

		let posClass = 'position-bottom';
		let verticalStyles = '';

		if (spaceBelow < estimatedHeight && spaceAbove > 200) {
			posClass = 'position-top';
			const bottom = Math.round(viewportHeight - rect.top + 8);
			verticalStyles = `bottom: ${bottom}px; top: auto; transform-origin: bottom center;`;
		} else {
			posClass = 'position-bottom';
			const top = Math.round(rect.bottom + 8);
			verticalStyles = `top: ${top}px; bottom: auto; transform-origin: top center;`;
		}

		let left = rect.left;
		if (align === 'right' || (align === 'auto' && left + cardWidth > viewportWidth - 16)) {
			left = Math.max(16, rect.right - cardWidth);
		}
		if (left < 16) {
			left = 16;
		}
		if (left + cardWidth > viewportWidth - 16) {
			left = Math.max(16, viewportWidth - cardWidth - 16);
		}

		positionClass = posClass;
		cardStyle = `position: fixed; ${verticalStyles} left: ${Math.round(left)}px; width: ${cardWidth}px; z-index: 99999;`;
	}

	function portal(node) {
		const target = document.body.firstElementChild || document.body;
		target.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			}
		};
	}

	function hoverParentEl() {
		return triggerEl?.closest('.aero-post-card, .reel-item') || null;
	}

	function cleanupZIndex() {
		const parent = hoverParentEl();
		if (parent) parent.classList.remove('has-active-hover-card');
	}

	onDestroy(() => {
		cleanupZIndex();
	});

	function handleWindowClick(e) {
		if (showCard && triggerEl && !triggerEl.contains(e.target)) {
			showCard = false;
			cleanupZIndex();
		}
	}

	function handleWindowScroll() {
		if (showCard) {
			showCard = false;
			cleanupZIndex();
		}
	}

	function handleNavigate(e) {
		e.stopPropagation();
		showCard = false;
		cleanupZIndex();
	}

	$effect(() => {
		if (showCard && triggerEl) {
			updatePosition();
			hoverParentEl()?.classList.add('has-active-hover-card');

			return () => {
				cleanupZIndex();
			};
		} else {
			cleanupZIndex();
		}
	});

	function handleMouseEnter() {
		clearTimeout(hideTimer);
		isHovered = true;
		timer = setTimeout(async () => {
			if (isHovered) {
				uiStore.closeAllPopovers();
				updatePosition();
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

<svelte:window
	onclick={handleWindowClick}
	onscroll={handleWindowScroll}
	onresize={updatePosition}
/>

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
			use:portal
			class="vs-hover-card glass-panel {positionClass} {alignClass}"
			style={cardStyle}
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
				<a
					href="/u/{username}"
					class="hc-header"
					style="position: relative; z-index: 0; display: block;"
					onclick={handleNavigate}
				>
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
				</a>
				<div class="hc-body" style="position: relative; z-index: 2;">
					<div class="hc-top-row">
						<a href="/u/{username}" onclick={handleNavigate} class="hc-avatar-link">
							<AeroAvatar
								src={fullUser.avatar_url}
								alt={username}
								size="lg"
								className="hc-avatar-override"
								online={fullUser.custom_status === 'online' || !fullUser.custom_status}
								away={fullUser.custom_status === 'away'}
								busy={fullUser.custom_status === 'busy'}
								isVtuber={fullUser.is_virtual}
							/>
						</a>

						{#if fullUser.id !== authStore.user?.id && authStore.isAuthenticated}
							<button
								class="btn-aero-primary hc-follow-btn {fullUser.is_following ? 'following' : ''}"
								onclick={toggleFollow}
							>
								{fullUser.is_following ? 'Siguiendo' : 'Seguir'}
							</button>
						{/if}
					</div>

					<a
						href="/u/{username}"
						class="hc-user-info text-decoration-none"
						onclick={handleNavigate}
					>
						<div class="hc-name-row">
							<span class="hc-name">{fullUser.display_name || fullUser.username}</span>
							<VerifiedBadge
								role={fullUser.role}
								isVerified={fullUser.is_verified == 1}
								size="16px"
								interactive={false}
							/>
							{#if fullUser.level}
								<LevelBadge level={fullUser.level} size="sm" showText={false} interactive={false} />
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
					</a>

					{#if fullUser.bio}
						<div class="hc-bio">{@html formatHashtags(fullUser.bio)}</div>
					{/if}

					<div class="hc-stats">
						<a href="/u/{username}" class="hc-stat text-decoration-none" onclick={handleNavigate}>
							<strong>{fullUser.following_count || 0}</strong> Siguiendo
						</a>
						<a href="/u/{username}" class="hc-stat text-decoration-none" onclick={handleNavigate}>
							<strong>{fullUser.follower_count || 0}</strong> Seguidores
						</a>
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
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow:
			0 12px 48px rgba(0, 0, 0, 0.5),
			0 0 0 1px var(--glass-border);
		background: color-mix(in srgb, var(--bg-surface-solid) 96%, transparent);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		cursor: default;
		text-align: left;
	}

	.hc-header {
		height: 90px;
		position: relative;
		background: var(--grad-primary);
		overflow: hidden;
		cursor: pointer;
		display: block;
	}
	.hc-header:hover .hc-cover-img {
		transform: scale(1.03);
	}
	.hc-cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center center;
		display: block;
		transition: transform var(--t-base);
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
		position: relative;
		z-index: 10;
	}

	.hc-avatar-link {
		display: inline-flex;
		border-radius: var(--radius-squircle);
		text-decoration: none;
		cursor: pointer;
		transition: transform var(--t-spring);
	}
	.hc-avatar-link:hover {
		transform: scale(1.05);
	}

	:global(.hc-avatar-override) {
		width: 68px !important;
		height: 68px !important;
		border: 3px solid var(--bg-surface) !important;
		background: var(--bg-canvas) !important;
		z-index: 2;
		box-shadow: var(--shadow-sm), var(--shadow-glow) !important;
	}

	.hc-follow-btn {
		padding: 6px 16px;
		font-size: 0.85rem;
		font-weight: 700;
		border-radius: var(--radius-md);
		z-index: 2;
		box-shadow: 0 4px 12px rgba(var(--accent-blue-rgb), 0.2);
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
		text-decoration: none;
		cursor: pointer;
	}
	.hc-user-info:hover .hc-name {
		color: var(--aero-blue);
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
		transition: color var(--t-fast);
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
		text-decoration: none;
		cursor: pointer;
		transition: color var(--t-fast);
	}
	.hc-stat:hover {
		color: var(--aero-blue);
	}
	.hc-stat:hover strong {
		color: var(--aero-blue);
	}
	.hc-stat strong {
		color: var(--text-primary);
		font-weight: 800;
		transition: color var(--t-fast);
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
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ══ Adaptación a Tema Claro (Light Theme) ══ */
	:global([data-theme='light']) .vs-hover-card {
		background: rgba(255, 255, 255, 0.98);
		border: 1px solid rgba(14, 165, 233, 0.25);
		box-shadow:
			0 16px 40px rgba(14, 165, 233, 0.15),
			0 4px 16px rgba(0, 0, 0, 0.08);
	}

	:global([data-theme='light']) .hc-follow-btn.following {
		background: rgba(14, 165, 233, 0.08);
		color: var(--text-primary);
		border-color: rgba(14, 165, 233, 0.25);
	}

	:global([data-theme='light']) .hc-follow-btn.following:hover {
		background: rgba(236, 72, 153, 0.1);
		color: var(--aero-rose);
		border-color: rgba(236, 72, 153, 0.3);
	}
</style>
