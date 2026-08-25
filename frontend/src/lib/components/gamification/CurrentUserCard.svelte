<script>
	import LevelBadge from './LevelBadge.svelte';
	import UserTitleBadge from './UserTitleBadge.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';
	import { levelProgress } from '$lib/utils/xp.js';

	/**
	 * CurrentUserCard.svelte — HUD de mando "estás aquí" de la Arena V-SOCIAL.
	 *
	 * - Glassmorphism 2.0 y estética Neo-Aero.
	 * - Adaptación multitema completa (Light, Dark, Midnight).
	 * - Modos de rendimiento (Lite, No-Blur, Simplificar Sombras, Reducir Movimiento).
	 */
	let { user, rank, type = 'level', delta = null } = $props();

	let beaconAccent = $derived(
		type === 'streak'
			? 'var(--lb-streak)'
			: type === 'creators'
				? 'var(--lb-creator)'
				: 'var(--lb-self)'
	);

	let isTop3 = $derived(rank <= 3);
	let rankColor = $derived(
		rank === 1
			? 'var(--lb-gold)'
			: rank === 2
				? 'var(--lb-silver)'
				: rank === 3
					? 'var(--lb-bronze)'
					: beaconAccent
	);

	let progress = $derived(type === 'level' ? levelProgress(user.xp_points, user.level) : null);

	let ariaLabel = $derived.by(() => {
		const base = `Tu posición: puesto ${rank}`;
		if (type === 'streak') return `${base}, racha actual de ${user.checkin_streak || 0} días`;
		if (type === 'creators')
			return `${base}, ${(user.engagement || 0).toLocaleString('es')} interacciones en 30 días`;
		if (progress?.isMax)
			return `${base}, nivel ${user.level || 1} máximo, ${(user.xp_points || 0).toLocaleString('es')} XP`;
		return `${base}, nivel ${user.level || 1}, ${progress?.pct ?? 0}% hacia el nivel ${(user.level || 1) + 1}`;
	});
</script>

<div class="lb-beacon-dock">
	<a
		href="/u/{user.username}"
		class="lb-beacon"
		aria-label={ariaLabel}
		style="--beacon-accent: {beaconAccent}; --rank-color: {rankColor};"
	>
		<!-- Reflejo especular superior / brillo de borde Neo-Aero -->
		<div class="beacon-specular" aria-hidden="true"></div>

		<!-- ══ Fila Principal: Rango, Avatar, Identidad y Stats ══ -->
		<div class="beacon-main">
			<!-- Medallón / Insignia de puesto -->
			<div
				class="beacon-rank"
				class:is-top3={isTop3}
				class:is-gold={rank === 1}
				class:is-silver={rank === 2}
				class:is-bronze={rank === 3}
			>
				{#if isTop3}
					<span class="material-icons-round rank-trophy" aria-hidden="true">
						{rank === 1 ? 'emoji_events' : 'workspace_premium'}
					</span>
				{/if}
				<span class="rank-num">
					{#if !isTop3}<i>#</i>{/if}{rank}
				</span>
			</div>

			<!-- Avatar con anillo de cristal y presencia -->
			<div class="beacon-avatar-wrap">
				<AeroAvatar
					src={user.avatar_url}
					alt={user.username}
					size="md"
					className="beacon-avatar-el"
					online={user.custom_status === 'online' || !user.custom_status}
					away={user.custom_status === 'away'}
					busy={user.custom_status === 'busy'}
					isVtuber={user.is_virtual}
				/>
			</div>

			<!-- Info del usuario: "TÚ", Nombre, Verificación, Delta -->
			<div class="beacon-identity">
				<div class="identity-header">
					<span class="you-pill">Tú</span>
					<span class="identity-name">{user.display_name || user.username}</span>
					<VerifiedBadge role={user.role} isVerified={!!user.is_verified} size="14px" />
					{#if delta != null && delta !== 0}
						<span
							class="delta-pill"
							class:is-up={delta > 0}
							title="{delta > 0 ? 'Subiste' : 'Bajaste'} {Math.abs(delta)} puestos"
						>
							{delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
						</span>
					{/if}
				</div>

				{#if type !== 'level'}
					<div class="identity-meta">
						{#if user.title_text}
							<UserTitleBadge title={user.title_text} color={user.title_color} size="sm" />
						{:else}
							<span class="identity-handle">@{user.username}</span>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Pozo de stats (Nivel + XP / Racha / Creadores) -->
			<div class="beacon-stats">
				{#if type === 'level'}
					<div class="stat-pill">
						<LevelBadge level={user.level || 1} size="sm" />
						<span class="stat-divider" aria-hidden="true"></span>
						<div class="stat-values">
							<span class="stat-amount">{(user.xp_points || 0).toLocaleString('es')}</span>
							<span class="stat-unit">XP</span>
						</div>
					</div>
				{:else if type === 'streak'}
					<div class="stat-pill stat-pill--streak">
						<span class="material-icons-round stat-icon" aria-hidden="true"
							>local_fire_department</span
						>
						<div class="stat-values">
							<span class="stat-amount">{user.checkin_streak || 0}</span>
							<span class="stat-unit">{user.checkin_streak === 1 ? 'día' : 'días'}</span>
						</div>
					</div>
				{:else}
					<div class="stat-pill stat-pill--creators">
						<span class="material-icons-round stat-icon" aria-hidden="true">auto_awesome</span>
						<div class="stat-values">
							<span class="stat-amount">{(user.engagement || 0).toLocaleString('es')}</span>
							<span class="stat-unit">interacciones</span>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- ══ Fila de Trayectoria: Barra de XP con diseño pulido (Solo Niveles) ══ -->
		{#if type === 'level' && progress}
			<div class="beacon-progress-section">
				<div class="progress-info">
					<div class="progress-left">
						<span class="level-indicator">Nv {user.level || 1}</span>
						{#if !progress.isMax}
							<span class="progress-fraction">
								{progress.into.toLocaleString('es')}
								<span class="fraction-sep">/</span>
								{progress.span.toLocaleString('es')} XP
							</span>
						{/if}
					</div>

					<div class="progress-right">
						{#if progress.isMax}
							<span class="level-target level-target--max">
								<span class="material-icons-round" aria-hidden="true">military_tech</span>
								Nivel Máximo
							</span>
						{:else}
							<span class="progress-pct">{progress.pct}%</span>
							<span class="level-target">
								<span class="target-arrow" aria-hidden="true">▸</span>
								Nv {(user.level || 1) + 1}
							</span>
						{/if}
					</div>
				</div>

				<div class="progress-track" role="presentation">
					<div class="progress-fill" class:is-max={progress.isMax} style="width: {progress.pct}%">
						<span class="progress-glow-tip" aria-hidden="true"></span>
					</div>
				</div>
			</div>
		{/if}
	</a>
</div>

<style>
	/* ══ Dock contenedor anclado al pie de la pantalla ══ */
	.lb-beacon-dock {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 50;
		padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
		pointer-events: none;
	}

	/* ══ HUD Beacon Principal ══ */
	.lb-beacon {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 720px;
		margin: 0 auto;
		padding: 12px 16px 14px 14px;
		border-radius: 20px;
		border: 1px solid transparent;
		background:
			linear-gradient(
					var(--lb-card-bg, rgba(14, 34, 54, 0.75)),
					var(--lb-card-bg, rgba(14, 34, 54, 0.75))
				)
				padding-box,
			linear-gradient(
					135deg,
					rgba(255, 255, 255, 0.35) 0%,
					color-mix(in srgb, var(--beacon-accent) 55%, transparent) 40%,
					color-mix(in srgb, var(--rank-color) 45%, transparent) 75%,
					rgba(255, 255, 255, 0.15) 100%
				)
				border-box;
		box-shadow:
			0 14px 38px rgba(0, 0, 0, 0.38),
			0 4px 14px rgba(0, 0, 0, 0.22),
			0 0 24px color-mix(in srgb, var(--beacon-accent) 24%, transparent),
			inset 0 1px 1.5px rgba(255, 255, 255, 0.3),
			inset 0 -1px 2px rgba(0, 0, 0, 0.25);
		backdrop-filter: var(--lb-glass-blur, blur(18px) saturate(1.3));
		-webkit-backdrop-filter: var(--lb-glass-blur, blur(18px) saturate(1.3));
		text-decoration: none;
		overflow: hidden;
		pointer-events: auto;
		transition:
			transform 0.24s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
			box-shadow 0.24s ease;
	}

	.lb-beacon:hover {
		transform: translateY(-3px);
		box-shadow:
			0 20px 48px rgba(0, 0, 0, 0.44),
			0 6px 18px rgba(0, 0, 0, 0.28),
			0 0 32px color-mix(in srgb, var(--beacon-accent) 38%, transparent),
			inset 0 1px 2px rgba(255, 255, 255, 0.42),
			inset 0 -1px 2px rgba(0, 0, 0, 0.3);
	}

	.lb-beacon:focus-visible {
		outline: 2px solid var(--aero-sky, #2eb4ff);
		outline-offset: 3px;
	}

	/* Reflejo especular superior */
	.beacon-specular {
		position: absolute;
		top: 0;
		left: 8%;
		right: 8%;
		height: 1.5px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.8) 25%,
			color-mix(in srgb, var(--beacon-accent) 85%, #fff) 50%,
			rgba(255, 255, 255, 0.8) 75%,
			transparent 100%
		);
		opacity: 0.9;
		pointer-events: none;
	}

	/* ══ Fila Principal ══ */
	.beacon-main {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	/* ══ Medallón / Placa de Puesto ══ */
	.beacon-rank {
		flex: 0 0 42px;
		min-width: 42px;
		min-height: 42px;
		height: 42px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		border: 1px solid color-mix(in srgb, var(--rank-color) 50%, rgba(255, 255, 255, 0.4));
		background:
			radial-gradient(
					circle at 35% 25%,
					color-mix(in srgb, var(--rank-color) 25%, rgba(255, 255, 255, 0.25)),
					transparent 65%
				)
				padding-box,
			linear-gradient(
					135deg,
					color-mix(in srgb, var(--rank-color) 18%, rgba(255, 255, 255, 0.08)),
					color-mix(in srgb, var(--rank-color) 6%, rgba(0, 0, 0, 0.2))
				)
				padding-box;
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.35),
			inset 0 -1.5px 3px rgba(0, 0, 0, 0.25),
			0 2px 8px rgba(0, 0, 0, 0.2),
			0 0 12px color-mix(in srgb, var(--rank-color) 30%, transparent);
	}

	.beacon-rank.is-top3 {
		background:
			radial-gradient(
					circle at 35% 20%,
					color-mix(in srgb, var(--rank-color) 45%, rgba(255, 255, 255, 0.5)),
					transparent 68%
				)
				padding-box,
			linear-gradient(
					135deg,
					color-mix(in srgb, var(--rank-color) 36%, rgba(255, 255, 255, 0.12)),
					color-mix(in srgb, var(--rank-color) 14%, rgba(0, 0, 0, 0.3))
				)
				padding-box;
	}

	.beacon-rank.is-gold {
		border-color: rgba(255, 220, 80, 0.75);
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.6),
			inset 0 -2px 4px rgba(0, 0, 0, 0.3),
			0 0 16px rgba(255, 210, 61, 0.45);
	}

	.beacon-rank.is-silver {
		border-color: rgba(230, 237, 245, 0.7);
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.55),
			inset 0 -2px 4px rgba(0, 0, 0, 0.3),
			0 0 16px rgba(230, 237, 245, 0.4);
	}

	.beacon-rank.is-bronze {
		border-color: rgba(255, 140, 56, 0.7);
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.5),
			inset 0 -2px 4px rgba(0, 0, 0, 0.3),
			0 0 16px rgba(255, 140, 56, 0.4);
	}

	.rank-trophy {
		font-size: 13px;
		line-height: 1;
		color: #fff;
		margin-bottom: -1px;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
	}

	.rank-num {
		font-family: var(--font-display, sans-serif);
		font-size: 1.15rem;
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.03em;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
		text-shadow:
			0 1px 0 rgba(255, 255, 255, 0.2),
			0 -1px 1px rgba(0, 0, 0, 0.4);
	}

	.beacon-rank.is-top3 .rank-num {
		font-size: 1.05rem;
		color: #fff;
	}

	.rank-num i {
		font-style: normal;
		font-size: 0.65em;
		margin-right: 1px;
		opacity: 0.7;
	}

	/* ══ Avatar Wrapper ══ */
	.beacon-avatar-wrap {
		flex: 0 0 42px;
		min-width: 42px;
		min-height: 42px;
		display: flex;
		align-items: center;
		justify-content: center;
		filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25));
	}

	:global(.beacon-avatar-el) {
		width: 42px !important;
		height: 42px !important;
	}

	/* ══ Identidad del Usuario ══ */
	.beacon-identity {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 3px;
		min-width: 0;
		flex: 1 1 auto;
	}

	.identity-header {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.you-pill {
		flex-shrink: 0;
		padding: 2px 7px;
		border-radius: var(--radius-full, 9999px);
		font-family: var(--font-display, sans-serif);
		font-size: 0.62rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #fff;
		background: linear-gradient(135deg, var(--beacon-accent), var(--aero-sky, #2eb4ff));
		box-shadow: 0 2px 8px color-mix(in srgb, var(--beacon-accent) 45%, transparent);
	}

	.identity-name {
		font-family: var(--font-sans, sans-serif);
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.delta-pill {
		flex-shrink: 0;
		padding: 1.5px 6px;
		border-radius: var(--radius-full, 9999px);
		font-family: var(--font-sans, sans-serif);
		font-size: 0.62rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: var(--aero-coral, #f472b6);
		background: color-mix(in srgb, var(--aero-coral, #f472b6) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--aero-coral, #f472b6) 30%, transparent);
	}

	.delta-pill.is-up {
		color: var(--aero-mint, #00d4aa);
		background: color-mix(in srgb, var(--aero-mint, #00d4aa) 12%, transparent);
		border-color: color-mix(in srgb, var(--aero-mint, #00d4aa) 30%, transparent);
	}

	.identity-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.identity-handle {
		font-size: 0.74rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ══ Pozo de Stats ══ */
	.beacon-stats {
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.stat-pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		border-radius: var(--radius-full, 9999px);
		border: 1px solid color-mix(in srgb, var(--beacon-accent) 35%, rgba(255, 255, 255, 0.15));
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--beacon-accent) 14%, rgba(255, 255, 255, 0.05)),
			color-mix(in srgb, var(--beacon-accent) 6%, transparent)
		);
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.18),
			0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.stat-divider {
		width: 1px;
		height: 16px;
		background: color-mix(in srgb, var(--text-primary) 18%, transparent);
	}

	.stat-values {
		display: inline-flex;
		align-items: baseline;
		gap: 4px;
	}

	.stat-amount {
		font-family: var(--font-display, sans-serif);
		font-weight: 800;
		font-size: 0.94rem;
		line-height: 1;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.stat-unit {
		font-size: 0.58rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
	}

	.stat-icon {
		font-size: 18px;
		line-height: 1;
	}

	.stat-pill--streak .stat-icon {
		color: var(--lb-streak, #f97316);
		filter: drop-shadow(0 0 6px var(--lb-streak-glow, rgba(249, 115, 22, 0.5)));
	}

	.stat-pill--creators .stat-icon {
		color: var(--lb-creator, #f472b6);
		filter: drop-shadow(0 0 6px var(--lb-creator-glow, rgba(244, 114, 182, 0.5)));
	}

	/* ══ Fila de Trayectoria / Progreso XP ══ */
	.beacon-progress-section {
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding-top: 2px;
	}

	.progress-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 2px;
		font-size: 0.72rem;
		line-height: 1;
	}

	.progress-left {
		display: inline-flex;
		align-items: center;
		gap: 7px;
	}

	.level-indicator {
		font-family: var(--font-display, sans-serif);
		font-weight: 800;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--aero-sky, #2eb4ff);
		font-variant-numeric: tabular-nums;
	}

	.progress-fraction {
		font-family: var(--font-sans, sans-serif);
		font-weight: 600;
		font-size: 0.68rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.fraction-sep {
		opacity: 0.45;
		margin: 0 1px;
	}

	.progress-right {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.progress-pct {
		font-family: var(--font-display, sans-serif);
		font-weight: 700;
		font-size: 0.68rem;
		color: var(--aero-mint, #00d4aa);
		font-variant-numeric: tabular-nums;
	}

	.level-target {
		font-family: var(--font-display, sans-serif);
		font-weight: 800;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-variant-numeric: tabular-nums;
	}

	.level-target--max {
		color: var(--lb-gold, #ffd23d);
	}

	.level-target--max .material-icons-round {
		font-size: 13px;
	}

	.target-arrow {
		font-size: 0.65rem;
		color: var(--beacon-accent);
		opacity: 0.85;
	}

	/* Pista y relleno de la barra */
	.progress-track {
		position: relative;
		width: 100%;
		height: 6px;
		border-radius: var(--radius-full, 9999px);
		background: rgba(0, 0, 0, 0.35);
		box-shadow:
			inset 0 1px 2px rgba(0, 0, 0, 0.5),
			0 1px 0 rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}

	.progress-fill {
		position: relative;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--aero-sky, #2eb4ff), var(--aero-mint, #00d4aa));
		box-shadow:
			0 0 10px rgba(46, 180, 255, 0.6),
			inset 0 1px 1px rgba(255, 255, 255, 0.45);
		transition: width 0.65s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
	}

	.progress-fill.is-max {
		background: linear-gradient(90deg, var(--lb-gold, #ffd23d), var(--aero-amber, #f5a623));
		box-shadow:
			0 0 12px var(--lb-gold-glow, rgba(255, 210, 61, 0.6)),
			inset 0 1px 1px rgba(255, 255, 255, 0.5);
	}

	/* Punta luminosa pulsante del progreso */
	.progress-glow-tip {
		position: absolute;
		right: 0;
		top: 50%;
		width: 4px;
		height: 4px;
		transform: translate(50%, -50%);
		border-radius: var(--radius-full, 9999px);
		background: #fff;
		box-shadow:
			0 0 4px #fff,
			0 0 8px var(--aero-mint, #00d4aa);
		animation: tip-breathe 2.4s ease-in-out infinite;
	}

	@keyframes tip-breathe {
		0%,
		100% {
			opacity: 0.7;
			transform: translate(50%, -50%) scale(1);
		}
		50% {
			opacity: 1;
			transform: translate(50%, -50%) scale(1.3);
		}
	}

	/* ══ Adaptación al Tema Claro (Light Theme) ══ */
	:global([data-theme='light']) .lb-beacon {
		background:
			linear-gradient(rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.92)) padding-box,
			linear-gradient(
					135deg,
					rgba(255, 255, 255, 0.9) 0%,
					color-mix(in srgb, var(--beacon-accent) 45%, rgba(0, 0, 0, 0.1)) 40%,
					color-mix(in srgb, var(--rank-color) 40%, rgba(0, 0, 0, 0.08)) 75%,
					rgba(255, 255, 255, 0.6) 100%
				)
				border-box;
		box-shadow:
			0 10px 30px rgba(0, 0, 0, 0.08),
			0 2px 8px rgba(0, 0, 0, 0.04),
			0 0 16px color-mix(in srgb, var(--beacon-accent) 16%, transparent),
			inset 0 1px 1.5px rgba(255, 255, 255, 0.9);
	}

	:global([data-theme='light']) .beacon-rank {
		background: linear-gradient(
				135deg,
				color-mix(in srgb, var(--rank-color) 25%, #fff),
				color-mix(in srgb, var(--rank-color) 12%, #fff)
			)
			padding-box;
		border-color: color-mix(in srgb, var(--rank-color) 50%, rgba(0, 0, 0, 0.12));
		box-shadow:
			0 2px 6px rgba(0, 0, 0, 0.06),
			inset 0 1px 1px #fff;
	}

	:global([data-theme='light']) .beacon-rank .rank-num {
		color: color-mix(in srgb, var(--rank-color) 65%, #0f172a);
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
	}

	:global([data-theme='light']) .beacon-rank.is-top3 .rank-num {
		color: color-mix(in srgb, var(--rank-color) 75%, #0f172a);
	}

	:global([data-theme='light']) .rank-trophy {
		color: color-mix(in srgb, var(--rank-color) 80%, #0f172a);
		filter: drop-shadow(0 1px 1px rgba(255, 255, 255, 0.7));
	}

	:global([data-theme='light']) .stat-pill {
		background: color-mix(in srgb, var(--beacon-accent) 8%, #fff);
		border-color: color-mix(in srgb, var(--beacon-accent) 35%, rgba(0, 0, 0, 0.12));
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.04),
			inset 0 1px 1px #fff;
	}

	:global([data-theme='light']) .progress-track {
		background: rgba(0, 0, 0, 0.08);
		box-shadow:
			inset 0 1px 2px rgba(0, 0, 0, 0.12),
			0 1px 0 #fff;
	}

	:global([data-theme='light']) .level-indicator {
		color: color-mix(in srgb, var(--aero-sky, #2eb4ff) 75%, #0f172a);
	}

	/* ══ Modos de Rendimiento ══ */
	:global([data-perf-mode='true']) .lb-beacon,
	:global([data-glass-blur='none']) .lb-beacon {
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
	}

	:global([data-perf-mode='true']) .progress-glow-tip,
	:global([data-reduced-motion='true']) .progress-glow-tip {
		animation: none !important;
	}

	:global([data-simplify-shadows='true']) .lb-beacon {
		box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.1)) !important;
	}

	:global([data-disable-hover-glow='true']) .lb-beacon:hover {
		transform: none !important;
	}

	/* ══ Responsive ══ */
	@media (max-width: 580px) {
		.lb-beacon {
			padding: 10px 12px 11px;
			gap: 8px;
			border-radius: 16px;
		}

		.beacon-main {
			gap: 9px;
		}

		.beacon-rank {
			flex: 0 0 36px;
			min-width: 36px;
			min-height: 36px;
			height: 36px;
			border-radius: 10px;
		}

		.rank-num {
			font-size: 0.98rem;
		}

		.beacon-rank.is-top3 .rank-num {
			font-size: 0.9rem;
		}

		.rank-trophy {
			font-size: 11px;
		}

		.beacon-avatar-wrap {
			flex: 0 0 36px;
			min-width: 36px;
			min-height: 36px;
		}

		:global(.beacon-avatar-el) {
			width: 36px !important;
			height: 36px !important;
		}

		.identity-name {
			font-size: 0.88rem;
		}

		.stat-pill {
			padding: 4px 8px;
			gap: 5px;
		}

		.stat-amount {
			font-size: 0.85rem;
		}

		.stat-unit {
			display: none;
		}

		.stat-divider {
			display: none;
		}

		.progress-fraction {
			display: none;
		}
	}

	@media (max-width: 400px) {
		.you-pill {
			display: none;
		}
		.delta-pill {
			display: none;
		}
	}

	/* Anclaje del dock según estado de la sidebar en desktop */
	@media (min-width: 768px) {
		.lb-beacon-dock {
			left: 16rem;
		}
		:global(.vs-shell--collapsed) .lb-beacon-dock {
			left: 5rem;
		}
	}

	/* En móvil se eleva sobre la barra de navegación inferior */
	@media (max-width: 768px) {
		.lb-beacon-dock {
			bottom: calc(84px + env(safe-area-inset-bottom, 0px));
		}
	}
</style>
