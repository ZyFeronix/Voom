<script>
	import LevelBadge from './LevelBadge.svelte';
	import UserTitleBadge from './UserTitleBadge.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';

	let { user, rank, type = 'level' } = $props();

	const rankData = {
		1: {
			color: 'var(--lb-gold)',
			glow: 'var(--lb-gold-glow)',
			icon: 'emoji_events',
			label: 'Campeón'
		},
		2: {
			color: 'var(--lb-silver)',
			glow: 'var(--lb-silver-glow)',
			icon: 'workspace_premium',
			label: 'Subcampeón'
		},
		3: {
			color: 'var(--lb-bronze)',
			glow: 'var(--lb-bronze-glow)',
			icon: 'workspace_premium',
			label: 'Tercer lugar'
		}
	};

	let rData = $derived(rankData[rank] || rankData[3]);
	let initial = $derived((user.display_name || user.username || '?').charAt(0).toUpperCase());
	let isFirst = $derived(rank === 1);

	// Deterministic spark positions so the burst doesn't reshuffle on re-render.
	const sparks = Array.from({ length: 6 }, (_, i) => {
		const angle = (i / 6) * Math.PI * 2;
		return {
			tx: `${Math.cos(angle) * 46}px`,
			ty: `${Math.sin(angle) * 46}px`,
			delay: `${i * 60}ms`
		};
	});

	let ariaLabel = $derived(
		type === 'level'
			? `Puesto ${rank}, ${user.display_name || user.username}, nivel ${user.level || 1}, ${user.xp_points || 0} puntos de experiencia`
			: `Puesto ${rank}, ${user.display_name || user.username}, racha de ${user.checkin_streak || 0} días`
	);
</script>

<article
	class="podium-card {isFirst ? 'is-first' : ''}"
	style="--rank-color: {rData.color}; --rank-glow: {rData.glow};"
	aria-label={ariaLabel}
>
	<div class="aura-glow lb-motion" aria-hidden="true"></div>

	<!-- Spark burst on mount -->
	<div class="spark-field" aria-hidden="true">
		{#each sparks as s}
			<span class="spark lb-motion" style="--tx: {s.tx}; --ty: {s.ty}; animation-delay: {s.delay};"
			></span>
		{/each}
	</div>

	<div class="card-glass">
		<div class="avatar-section">
			<div class="floating-trophy" aria-hidden="true">
				<div class="trophy-medal">
					<span class="material-icons-round trophy-icon">{rData.icon}</span>
				</div>
			</div>

			<div class="avatar-ring lb-motion">
				<a href="/u/{user.username}" class="avatar-link" aria-hidden="true" tabindex="-1">
					{#if user.avatar_url}
						<img
							src={user.avatar_url}
							alt=""
							class="avatar-img"
							width="72"
							height="72"
							loading="lazy"
							decoding="async"
						/>
					{:else}
						<div class="avatar-letter">{initial}</div>
					{/if}
				</a>
			</div>
		</div>

		<div class="rank-badge">
			<span class="rank-hash">#</span>{rank}
		</div>

		<div class="user-info">
			<a href="/u/{user.username}" class="user-name" title={user.display_name}>
				<span class="user-name-text">{user.display_name || user.username}</span>
				<VerifiedBadge role={user.role} isVerified={!!user.is_verified} size="15px" />
			</a>
			{#if user.title_text}
				<div class="user-title">
					<UserTitleBadge title={user.title_text} color={user.title_color} size="sm" />
				</div>
			{:else}
				<span class="user-handle">@{user.username}</span>
			{/if}
		</div>

		<div class="stats-box">
			{#if type === 'level'}
				<div class="stats-row">
					<LevelBadge level={user.level || 1} />
					<span class="stat-xp">{(user.xp_points || 0).toLocaleString('es')} XP</span>
				</div>
			{:else}
				<div class="stats-row stats-row--streak">
					<span class="material-icons-round streak-icon">local_fire_department</span>
					<span class="streak-count">{user.checkin_streak || 0}</span>
					<span class="streak-label">Días</span>
				</div>
			{/if}
		</div>
	</div>
</article>

<style>
	.podium-card {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 145px;
		height: 240px;
		transition: transform 0.4s var(--ease-spring);
		z-index: 10;
	}
	.podium-card.is-first {
		width: 168px;
		height: 288px;
	}
	.podium-card:hover,
	.podium-card:focus-within {
		z-index: 40;
		transform: translateY(-8px);
	}

	.aura-glow {
		position: absolute;
		inset: 20px;
		top: 40px;
		background: var(--rank-color);
		filter: blur(28px);
		opacity: 0.16;
		border-radius: 50%;
		z-index: 0;
		animation: lb-pulse-ring 5s ease-in-out infinite;
	}
	.podium-card:hover .aura-glow {
		opacity: 0.32;
	}

	/* Spark burst */
	.spark-field {
		position: absolute;
		top: 8px;
		left: 50%;
		width: 0;
		height: 0;
		z-index: 25;
	}
	.spark {
		position: absolute;
		top: 0;
		left: 0;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--rank-color);
		box-shadow: 0 0 8px var(--rank-color);
		opacity: 0;
		animation: lb-particle-burst 900ms var(--ease-out) forwards;
	}

	.card-glass {
		position: relative;
		z-index: 10;
		width: 100%;
		height: 100%;
		border: 1.5px solid transparent;
		background:
			linear-gradient(var(--lb-card-bg), var(--lb-card-bg)) padding-box,
			linear-gradient(
					175deg,
					var(--rank-color) 0%,
					rgba(255, 255, 255, 0.45) 35%,
					rgba(255, 255, 255, 0.12) 65%,
					color-mix(in srgb, var(--rank-color) 50%, transparent) 100%
				)
				border-box;
		backdrop-filter: var(--lb-glass-blur);
		-webkit-backdrop-filter: var(--lb-glass-blur);
		border-radius: 20px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-shadow:
			var(--shadow-lg),
			0 0 24px var(--rank-glow),
			inset 0 1px 1px rgba(255, 255, 255, 0.15);
	}
	.card-glass::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 42%);
		pointer-events: none;
		border-radius: 20px;
	}

	.avatar-section {
		position: relative;
		z-index: 10;
		margin-top: -35px;
		margin-bottom: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.floating-trophy {
		position: absolute;
		top: -48px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 30;
	}
	.is-first .floating-trophy {
		top: -62px;
	}

	.trophy-medal {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: radial-gradient(
			circle at 30% 30%,
			color-mix(in srgb, var(--rank-color) 50%, rgba(255, 255, 255, 0.7)),
			color-mix(in srgb, var(--rank-color) 30%, rgba(15, 23, 42, 0.6)) 85%
		);
		border: 1px solid color-mix(in srgb, var(--rank-color) 65%, rgba(255, 255, 255, 0.7));
		box-shadow:
			inset 0 2px 4px rgba(255, 255, 255, 0.6),
			inset 0 -3px 6px rgba(0, 0, 0, 0.5),
			inset 0 0 10px var(--rank-glow),
			0 4px 12px rgba(0, 0, 0, 0.3),
			0 0 20px var(--rank-glow);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
	}
	.is-first .trophy-medal {
		width: 56px;
		height: 56px;
	}

	/* Inner reflective metallic rim */
	.trophy-medal::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		padding: 2px;
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.8),
			rgba(255, 255, 255, 0) 40%,
			rgba(0, 0, 0, 0.5)
		);
		-webkit-mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		pointer-events: none;
	}

	/* Sweeping shine effect */
	.trophy-medal::after {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: linear-gradient(
			to bottom right,
			rgba(255, 255, 255, 0) 40%,
			rgba(255, 255, 255, 0.4) 45%,
			rgba(255, 255, 255, 0.8) 50%,
			rgba(255, 255, 255, 0.4) 55%,
			rgba(255, 255, 255, 0) 60%
		);
		transform: rotate(35deg) translateY(-100%);
		animation: lb-medal-shine 6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
		pointer-events: none;
	}

	@keyframes lb-medal-shine {
		0%,
		30% {
			transform: rotate(35deg) translateY(-100%);
		}
		70%,
		100% {
			transform: rotate(35deg) translateY(100%);
		}
	}

	.trophy-icon {
		font-size: 24px;
		line-height: 1;
		letter-spacing: normal;
		width: 1em;
		height: 1em;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff; /* fallback */
		background: linear-gradient(
			135deg,
			#ffffff 0%,
			var(--rank-color) 45%,
			color-mix(in srgb, var(--rank-color) 30%, #000) 100%
		);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6));
		z-index: 10;
		position: relative;
	}
	.is-first .trophy-icon {
		font-size: 32px;
	}

	.avatar-ring {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		padding: 3px;
		background: conic-gradient(
			from 140deg,
			var(--rank-color),
			rgba(255, 255, 255, 0.25),
			var(--rank-color)
		);
		box-shadow:
			0 5px 15px rgba(0, 0, 0, 0.35),
			inset 0 2px 4px rgba(0, 0, 0, 0.35);
		animation: lb-pulse-ring 4s ease-in-out infinite;
	}
	.is-first .avatar-ring {
		width: 88px;
		height: 88px;
	}

	.avatar-link {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		overflow: hidden;
	}
	.avatar-img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
		background: var(--bg-surface);
	}
	.avatar-letter {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.8rem;
		color: #fff;
		background: linear-gradient(135deg, var(--rank-color), rgba(0, 0, 0, 0.3));
	}
	.is-first .avatar-letter {
		font-size: 2.4rem;
	}

	.rank-badge {
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-weight: 900;
		color: var(--text-primary);
		line-height: 1;
		margin-bottom: 8px;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
	}
	.is-first .rank-badge {
		font-size: 2.3rem;
	}
	.rank-hash {
		color: var(--rank-color);
		font-size: 0.7em;
		margin-right: 1px;
	}

	.user-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		margin-bottom: 12px;
		position: relative;
		z-index: 10;
	}
	.user-name {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 2px;
		max-width: 100%;
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 800;
		color: var(--text-primary);
		text-decoration: none;
		margin-bottom: 3px;
	}
	.is-first .user-name {
		font-size: 1.12rem;
	}
	.user-name-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 110px;
	}
	.user-name:hover .user-name-text {
		color: var(--aero-sky);
	}
	.user-name:focus-visible {
		outline: 2px solid var(--accent-cyan);
		outline-offset: 3px;
		border-radius: 6px;
	}

	.user-title {
		margin-top: 2px;
	}
	.user-handle {
		font-size: 0.8rem;
		color: var(--text-muted);
		max-width: 90%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stats-box {
		width: 100%;
		margin-top: auto;
		border-radius: 12px;
		border: 1px solid transparent;
		background:
			linear-gradient(var(--lb-stats-bg), var(--lb-stats-bg)) padding-box,
			linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05)) border-box;
		position: relative;
		z-index: 10;
	}
	.stats-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		width: 100%;
		padding: 8px 12px;
	}
	.stat-xp {
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.stats-row--streak {
		justify-content: center;
	}
	.streak-icon {
		color: var(--lb-streak);
		font-size: 15px;
	}
	.streak-count {
		color: var(--lb-streak);
		font-weight: 800;
		font-size: 0.95rem;
		text-shadow: 0 0 6px rgba(249, 115, 22, 0.5);
	}
	.streak-label {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-weight: 700;
		color: var(--text-muted);
	}

	/* [VSocial: reduced-motion removido — aura-glow/avatar-ring/spark siempre animados] */
</style>
