<script>
	import LevelBadge from './LevelBadge.svelte';
	import UserTitleBadge from './UserTitleBadge.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';

	// The persistent "you are here" beacon, pinned to the bottom of the viewport.
	let { user, rank, type = 'level' } = $props();

	let initial = $derived((user.display_name || user.username || '?').charAt(0).toUpperCase());
	let beaconAccent = $derived(type === 'streak' ? 'var(--lb-streak)' : 'var(--lb-self)');
</script>

<div class="lb-beacon-dock">
	<a
		href="/u/{user.username}"
		class="lb-beacon"
		aria-label="Tu posición: puesto {rank}"
		style="--beacon-accent: {beaconAccent};"
	>
		<span class="beacon-sweep lb-motion" aria-hidden="true"></span>

		<div class="beacon-rank">
			<span class="beacon-rank__label">Tu rango</span>
			<span class="beacon-rank__value">#{rank}</span>
		</div>

		<div class="beacon-avatar">
			{#if user.avatar_url}
				<img
					src={user.avatar_url}
					alt=""
					class="avatar-img"
					width="48"
					height="48"
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<div class="avatar-letter">{initial}</div>
			{/if}
		</div>

		<div class="beacon-id">
			<span class="beacon-name">
				<span class="you-pill">Tú</span>
				<span class="name-text">{user.display_name || user.username}</span>
				<VerifiedBadge role={user.role} isVerified={!!user.is_verified} size="14px" />
			</span>
			{#if user.title_text}
				<UserTitleBadge title={user.title_text} color={user.title_color} size="sm" />
			{:else}
				<span class="beacon-handle">@{user.username}</span>
			{/if}
		</div>

		<div class="beacon-stat">
			{#if type === 'level'}
				<LevelBadge level={user.level || 1} size="md" />
				<span class="stat-xp">{(user.xp_points || 0).toLocaleString('es')} XP</span>
			{:else}
				<div class="streak-chip">
					<span class="material-icons-round streak-icon">local_fire_department</span>
					<span class="streak-count">{user.checkin_streak || 0}</span>
				</div>
			{/if}
		</div>
	</a>
</div>

<style>
	.lb-beacon-dock {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 50;
		padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
		pointer-events: none;
	}

	.lb-beacon {
		position: relative;
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		align-items: center;
		gap: 16px;
		max-width: 720px;
		margin: 0 auto;
		padding: 12px 18px;
		border-radius: var(--radius-xl, 24px);
		border: 1.5px solid transparent;
		background:
			linear-gradient(
					color-mix(in srgb, var(--beacon-accent) 14%, var(--lb-card-bg)),
					color-mix(in srgb, var(--beacon-accent) 14%, var(--lb-card-bg))
				)
				padding-box,
			linear-gradient(
					135deg,
					var(--beacon-accent) 0%,
					rgba(255, 255, 255, 0.45) 35%,
					color-mix(in srgb, var(--beacon-accent) 35%, transparent) 100%
				)
				border-box;
		box-shadow:
			0 12px 34px color-mix(in srgb, var(--beacon-accent) 35%, transparent),
			var(--glass-inset, inset 0 1px 1px rgba(255, 255, 255, 0.15));
		backdrop-filter: blur(24px) saturate(1.3);
		-webkit-backdrop-filter: blur(24px) saturate(1.3);
		text-decoration: none;
		overflow: hidden;
		pointer-events: auto;
		transition:
			transform 0.24s var(--ease-spring),
			box-shadow 0.24s ease,
			background 0.3s ease;
	}
	.lb-beacon:hover {
		transform: translateY(-2px);
		background:
			linear-gradient(
					color-mix(in srgb, var(--beacon-accent) 18%, var(--lb-card-bg)),
					color-mix(in srgb, var(--beacon-accent) 18%, var(--lb-card-bg))
				)
				padding-box,
			linear-gradient(
					135deg,
					#fff 0%,
					var(--beacon-accent) 40%,
					color-mix(in srgb, var(--beacon-accent) 50%, transparent) 100%
				)
				border-box;
		box-shadow: 0 16px 42px color-mix(in srgb, var(--beacon-accent) 45%, transparent);
	}
	.lb-beacon:focus-visible {
		outline: 2px solid var(--accent-cyan);
		outline-offset: 3px;
	}

	/* Light sweep that periodically crosses the beacon */
	.beacon-sweep {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 40%;
		background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.18), transparent);
		animation: lb-beacon-sweep 5.5s ease-in-out infinite;
		pointer-events: none;
	}

	.beacon-rank {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
	}
	.beacon-rank__label {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-weight: 800;
		color: var(--beacon-accent);
		margin-bottom: 3px;
	}
	.beacon-rank__value {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 900;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.beacon-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		padding: 2px;
		background: linear-gradient(135deg, var(--beacon-accent), rgba(255, 255, 255, 0.25));
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
		font-size: 1.15rem;
		color: #fff;
		background: linear-gradient(135deg, var(--beacon-accent), rgba(0, 0, 0, 0.3));
	}

	.beacon-id {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.beacon-name {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-primary);
		min-width: 0;
	}
	.you-pill {
		flex-shrink: 0;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 0.66rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #fff;
		background: var(--beacon-accent);
	}
	.name-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.beacon-handle {
		font-size: 0.8rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.beacon-stat {
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
		color: var(--beacon-accent);
	}
	.streak-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid transparent;
		background:
			linear-gradient(
					color-mix(in srgb, var(--lb-streak) 14%, transparent),
					color-mix(in srgb, var(--lb-streak) 14%, transparent)
				)
				padding-box,
			linear-gradient(135deg, #fb923c, color-mix(in srgb, var(--lb-streak) 45%, transparent))
				border-box;
	}
	.streak-icon {
		color: var(--lb-streak);
		font-size: 17px;
	}
	.streak-count {
		color: var(--lb-streak);
		font-weight: 800;
		font-size: 1rem;
	}

	@media (max-width: 480px) {
		.lb-beacon {
			gap: 10px;
			padding: 10px 14px;
		}
		.you-pill {
			display: none;
		}
		.beacon-rank__value {
			font-size: 1.35rem;
		}
	}

	/* [VSocial: reduced-motion removido — beacon-sweep siempre animado] */
</style>
