<script>
	import LevelBadge from './LevelBadge.svelte';
	import UserTitleBadge from './UserTitleBadge.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';

	let { user, rank, type = 'level', isCurrentUser = false } = $props();

	let initial = $derived((user.display_name || user.username || '?').charAt(0).toUpperCase());

	// Tier accent by rank band — mirrors the aurora pillar segments.
	let tier = $derived.by(() => {
		if (rank <= 10) return 'rising'; // mint
		if (rank <= 50) return 'climbing'; // sky
		return 'base';
	});
	let accent = $derived(
		tier === 'rising'
			? 'var(--lb-rising)'
			: tier === 'climbing'
				? 'var(--lb-climbing)'
				: 'var(--text-muted)'
	);

	let ariaLabel = $derived(
		type === 'level'
			? `Puesto ${rank}, ${user.display_name || user.username}, nivel ${user.level || 1}, ${user.xp_points || 0} XP`
			: `Puesto ${rank}, ${user.display_name || user.username}, racha de ${user.checkin_streak || 0} días`
	);
</script>

<a
	href="/u/{user.username}"
	class="lb-row {isCurrentUser ? 'is-self' : ''}"
	style="--row-accent: {accent};"
	aria-label={ariaLabel}
	aria-current={isCurrentUser ? 'true' : undefined}
>
	<span class="lb-row__rank" aria-hidden="true">{rank}</span>

	<div class="lb-row__avatar">
		{#if user.avatar_url}
			<img
				src={user.avatar_url}
				alt=""
				class="avatar-img"
				width="46"
				height="46"
				loading="lazy"
				decoding="async"
			/>
		{:else}
			<div class="avatar-letter">{initial}</div>
		{/if}
	</div>

	<div class="lb-row__id">
		<span class="lb-row__name">
			<span class="name-text">{user.display_name || user.username}</span>
			<VerifiedBadge role={user.role} isVerified={!!user.is_verified} size="14px" />
		</span>
		{#if user.title_text}
			<UserTitleBadge title={user.title_text} color={user.title_color} size="sm" />
		{:else}
			<span class="lb-row__handle">@{user.username}</span>
		{/if}
	</div>

	<div class="lb-row__stat">
		{#if type === 'level'}
			<LevelBadge level={user.level || 1} size="sm" />
			<span class="stat-xp">{(user.xp_points || 0).toLocaleString('es')} XP</span>
		{:else}
			<div class="streak-chip">
				<span class="material-icons-round streak-icon">local_fire_department</span>
				<span class="streak-count">{user.checkin_streak || 0}</span>
			</div>
		{/if}
	</div>
</a>

<style>
	.lb-row {
		position: relative;
		display: grid;
		grid-template-columns: 34px auto 1fr auto;
		align-items: center;
		gap: 14px;
		padding: 12px 16px 12px 12px;
		border-radius: var(--radius-lg, 18px);
		border: 1px solid transparent;
		background:
			linear-gradient(var(--lb-card-bg), var(--lb-card-bg)) padding-box,
			linear-gradient(
					135deg,
					color-mix(in srgb, var(--row-accent) 45%, rgba(255, 255, 255, 0.25)),
					rgba(255, 255, 255, 0.08) 50%,
					color-mix(in srgb, var(--row-accent) 25%, transparent)
				)
				border-box;
		box-shadow: var(--shadow-sm);
		backdrop-filter: var(--lb-glass-blur);
		-webkit-backdrop-filter: var(--lb-glass-blur);
		text-decoration: none;
		overflow: hidden;
		transition:
			transform 0.22s var(--ease-spring),
			background 0.22s ease,
			box-shadow 0.22s ease;
	}

	/* Left accent bar tinted by tier with smooth gradient */
	.lb-row::before {
		content: '';
		position: absolute;
		left: 0;
		top: 12px;
		bottom: 12px;
		width: 3px;
		border-radius: 3px;
		background: linear-gradient(
			180deg,
			var(--row-accent) 0%,
			color-mix(in srgb, var(--row-accent) 40%, transparent) 100%
		);
		opacity: 0.75;
		transition:
			opacity 0.22s ease,
			top 0.22s ease,
			bottom 0.22s ease;
	}

	.lb-row:hover {
		transform: translateY(-3px);
		background:
			linear-gradient(var(--lb-card-bg), var(--lb-card-bg)) padding-box,
			linear-gradient(
					135deg,
					color-mix(in srgb, var(--row-accent) 80%, #fff),
					rgba(255, 255, 255, 0.2) 50%,
					color-mix(in srgb, var(--row-accent) 50%, transparent)
				)
				border-box;
		box-shadow:
			var(--shadow-md),
			0 0 18px color-mix(in srgb, var(--row-accent) 25%, transparent);
	}
	.lb-row:hover::before {
		opacity: 1;
		top: 6px;
		bottom: 6px;
	}

	.lb-row:focus-visible {
		outline: 2px solid var(--accent-cyan);
		outline-offset: 2px;
	}

	/* Current user highlight with smooth gradient border */
	.lb-row.is-self {
		background:
			linear-gradient(
					color-mix(in srgb, var(--lb-self) 14%, var(--lb-card-bg)),
					color-mix(in srgb, var(--lb-self) 14%, var(--lb-card-bg))
				)
				padding-box,
			linear-gradient(
					135deg,
					var(--lb-self),
					rgba(255, 255, 255, 0.35) 50%,
					color-mix(in srgb, var(--lb-self) 40%, transparent)
				)
				border-box;
		box-shadow:
			var(--shadow-md),
			0 0 22px color-mix(in srgb, var(--lb-self) 30%, transparent);
	}
	.lb-row.is-self::before {
		background: linear-gradient(
			180deg,
			#fff 0%,
			var(--lb-self) 50%,
			color-mix(in srgb, var(--lb-self) 30%, transparent) 100%
		);
		opacity: 1;
	}

	.lb-row__rank {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 900;
		color: var(--row-accent);
		text-align: center;
		font-variant-numeric: tabular-nums;
		opacity: 0.85;
	}

	.lb-row__avatar {
		width: 46px;
		height: 46px;
		border-radius: 50%;
		padding: 2px;
		background: linear-gradient(135deg, var(--row-accent), transparent);
		flex-shrink: 0;
	}
	.avatar-img,
	.avatar-letter {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}
	.avatar-letter {
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.1rem;
		color: #fff;
		background: linear-gradient(135deg, var(--row-accent), rgba(0, 0, 0, 0.35));
	}

	.lb-row__id {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.lb-row__name {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-primary);
		min-width: 0;
	}
	.name-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lb-row__handle {
		font-size: 0.8rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lb-row__stat {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}
	.stat-xp {
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
	}
	.streak-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		border-radius: 999px;
		border: 1px solid transparent;
		background:
			linear-gradient(
					color-mix(in srgb, var(--lb-streak) 12%, transparent),
					color-mix(in srgb, var(--lb-streak) 12%, transparent)
				)
				padding-box,
			linear-gradient(135deg, #fb923c, color-mix(in srgb, var(--lb-streak) 40%, transparent))
				border-box;
	}
	.streak-icon {
		color: var(--lb-streak);
		font-size: 16px;
	}
	.streak-count {
		color: var(--lb-streak);
		font-weight: 800;
		font-size: 0.92rem;
	}

	@media (max-width: 420px) {
		.lb-row {
			gap: 10px;
			padding-right: 12px;
		}
		.lb-row__avatar {
			width: 40px;
			height: 40px;
		}
	}

	/* [VSocial: reduced-motion removido — lb-row hover siempre activo] */
</style>
