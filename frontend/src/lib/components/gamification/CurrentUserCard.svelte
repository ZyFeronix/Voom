<script>
	import LevelBadge from './LevelBadge.svelte';
	import UserTitleBadge from './UserTitleBadge.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';

	// The persistent "you are here" beacon, pinned to the bottom of the viewport.
	let { user, rank, type = 'level' } = $props();

	let beaconAccent = $derived(type === 'streak' ? 'var(--lb-streak)' : 'var(--lb-self)');

	// Medalla para el podio (top 3) vs. hash normal
	let isTop3 = $derived(rank <= 3);
	let rankColor = $derived(
		rank === 1
			? 'var(--lb-gold)'
			: rank === 2
				? 'var(--lb-silver)'
				: rank === 3
					? 'var(--lb-bronze)'
					: 'var(--beacon-accent)'
	);
</script>

<div class="lb-beacon-dock">
	<a
		href="/u/{user.username}"
		class="lb-beacon"
		aria-label="Tu posición: puesto {rank}"
		style="--beacon-accent: {beaconAccent}; --rank-color: {rankColor};"
	>
		<span class="beacon-topline" aria-hidden="true"></span>
		<span class="beacon-sweep lb-motion" aria-hidden="true"></span>

		<div class="beacon-rank" class:is-top3={isTop3}>
			<span class="beacon-rank__medal" aria-hidden="true">
				{#if isTop3}
					<span class="material-icons-round beacon-rank__trophy">emoji_events</span>
				{/if}
				<span class="beacon-rank__num"><span class="beacon-rank__hash">#</span>{rank}</span>
			</span>
			<span class="beacon-rank__label">Tu rango</span>
		</div>

		<div class="beacon-avatar-wrapper">
			<AeroAvatar
				src={user.avatar_url}
				alt={user.username}
				size="lg"
				className="beacon-avatar"
				online={user.custom_status === 'online' || !user.custom_status}
				away={user.custom_status === 'away'}
				busy={user.custom_status === 'busy'}
				isVtuber={user.is_virtual}
			/>
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
		padding: 13px 20px;
		border-radius: var(--radius-squircle, 24px);
		corner-shape: squircle;
		border: 1.5px solid transparent;
		background:
			linear-gradient(var(--lb-card-bg), var(--lb-card-bg)) padding-box,
			linear-gradient(
					135deg,
					var(--beacon-accent) 0%,
					rgba(255, 255, 255, 0.5) 30%,
					color-mix(in srgb, var(--beacon-accent) 30%, transparent) 70%,
					var(--beacon-accent) 100%
				)
				border-box;
		box-shadow:
			0 14px 40px color-mix(in srgb, var(--beacon-accent) 34%, transparent),
			0 2px 8px rgba(0, 0, 0, 0.18),
			var(--glass-inset, inset 0 1px 1px rgba(255, 255, 255, 0.18)),
			inset 0 0 0 1px rgba(255, 255, 255, 0.04);
		backdrop-filter: blur(26px) saturate(1.4);
		-webkit-backdrop-filter: blur(26px) saturate(1.4);
		text-decoration: none;
		overflow: hidden;
		pointer-events: auto;
		transition:
			transform 0.24s var(--ease-spring),
			box-shadow 0.24s ease,
			background 0.3s ease;
	}
	.lb-beacon:hover {
		transform: translateY(-3px);
		box-shadow:
			0 18px 48px color-mix(in srgb, var(--beacon-accent) 46%, transparent),
			0 3px 10px rgba(0, 0, 0, 0.2),
			var(--glass-inset, inset 0 1px 1px rgba(255, 255, 255, 0.2));
	}
	.lb-beacon:focus-visible {
		outline: 2px solid var(--accent-cyan);
		outline-offset: 3px;
	}

	/* Fina línea de acento luminosa en el borde superior del beacon */
	.beacon-topline {
		position: absolute;
		top: 0;
		left: 12%;
		right: 12%;
		height: 1.5px;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--beacon-accent) 90%, #fff) 50%,
			transparent
		);
		opacity: 0.8;
		pointer-events: none;
	}

	/* Light sweep that periodically crosses the beacon.
	   left: 0 ancla el barrido al ancho completo del beacon (antes, al ser el
	   primer ítem del grid sin left, empezaba en el padding y no salía del todo
	   por la derecha). */
	.beacon-sweep {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 150%;
		background: linear-gradient(
			110deg,
			transparent 0%,
			rgba(255, 255, 255, 0) 30%,
			rgba(255, 255, 255, 0.06) 45%,
			rgba(255, 255, 255, 0.18) 50%,
			color-mix(in srgb, var(--beacon-accent) 8%, transparent) 55%,
			rgba(255, 255, 255, 0) 70%,
			transparent 100%
		);
		animation: beacon-sheen 8s cubic-bezier(0.3, 0, 0.2, 1) infinite;
		pointer-events: none;
	}

	@keyframes beacon-sheen {
		0% {
			transform: translateX(-100%);
		}
		45%,
		100% {
			transform: translateX(75%);
		}
	}

	.beacon-rank {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		line-height: 1;
	}
	.beacon-rank__medal {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 52px;
		height: 44px;
		padding: 0 12px;
		border-radius: var(--radius-squircle, 14px);
		corner-shape: squircle;
		border: 1px solid color-mix(in srgb, var(--rank-color) 55%, rgba(255, 255, 255, 0.5));
		background: linear-gradient(
				color-mix(in srgb, var(--rank-color) 18%, var(--lb-card-bg)),
				color-mix(in srgb, var(--rank-color) 8%, var(--lb-card-bg))
			)
			padding-box;
		box-shadow:
			inset 0 1px 2px rgba(255, 255, 255, 0.35),
			inset 0 -2px 5px rgba(0, 0, 0, 0.28),
			0 0 16px color-mix(in srgb, var(--rank-color) 40%, transparent);
		overflow: hidden;
	}
	.beacon-rank.is-top3 .beacon-rank__medal {
		background: radial-gradient(
				circle at 30% 25%,
				color-mix(in srgb, var(--rank-color) 55%, rgba(255, 255, 255, 0.6)),
				color-mix(in srgb, var(--rank-color) 30%, var(--lb-medal-shadow, rgba(15, 23, 42, 0.6))) 90%
			)
			padding-box;
	}
	.beacon-rank__trophy {
		font-size: 15px;
		margin-right: 3px;
		color: #fff;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
	}
	.beacon-rank__num {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 900;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}
	.beacon-rank.is-top3 .beacon-rank__num {
		color: #fff;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
	}
	.beacon-rank__hash {
		font-size: 0.68em;
		color: var(--rank-color);
		margin-right: 1px;
	}
	.beacon-rank.is-top3 .beacon-rank__hash {
		color: rgba(255, 255, 255, 0.9);
	}
	.beacon-rank__label {
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-weight: 800;
		color: var(--beacon-accent);
	}

	:global(.beacon-avatar) {
		width: 48px !important;
		height: 48px !important;
		border: 2px solid transparent;
		background: linear-gradient(135deg, var(--beacon-accent), rgba(255, 255, 255, 0.25)) !important;
		flex-shrink: 0;
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
		color: var(--text-secondary);
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
			linear-gradient(
					135deg,
					color-mix(in srgb, var(--lb-streak) 70%, #fff),
					color-mix(in srgb, var(--lb-streak) 45%, transparent)
				)
				border-box;
		transition: transform 0.24s var(--ease-spring);
	}
	.lb-beacon:hover .streak-chip {
		transform: scale(1.08);
	}
	.streak-icon {
		color: var(--text-primary);
		font-size: 17px;
	}
	.streak-count {
		color: var(--text-primary);
		font-weight: 800;
		font-size: 1rem;
		text-shadow: 0 0 8px var(--lb-streak-glow, rgba(249, 115, 22, 0.5));
	}

	@media (max-width: 480px) {
		.lb-beacon {
			gap: 10px;
			padding: 10px 14px;
		}
		.you-pill {
			display: none;
		}
		.beacon-rank__medal {
			min-width: 44px;
			height: 38px;
			padding: 0 8px;
		}
		.beacon-rank__num {
			font-size: 1.15rem;
		}
		.beacon-rank__trophy {
			display: none;
		}
	}

	/* En escritorio el contenido va desplazado por la barra lateral; centrar el
	   dock en el viewport desalinea el beacon respecto a la columna de contenido.
	   Anclamos el dock al área de contenido (mismo patrón que .messages-container). */
	@media (min-width: 768px) {
		.lb-beacon-dock {
			left: 16rem; /* Sidebar expandida */
		}
		:global(.vs-shell--collapsed) .lb-beacon-dock {
			left: 5rem; /* Sidebar colapsada */
		}
	}

	/* En móvil la barra de navegación inferior (z-index 200) tapa el beacon
	   (z-index 50). Levantamos el dock por encima de la barra para que la
	   tarjeta de posición siempre sea visible y clicable. */
	@media (max-width: 768px) {
		.lb-beacon-dock {
			bottom: calc(88px + env(safe-area-inset-bottom, 0px));
		}
	}

	/* [VSocial: reduced-motion removido — beacon-sweep siempre animado] */
</style>
