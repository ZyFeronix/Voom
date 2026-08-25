<script>
	import LevelBadge from './LevelBadge.svelte';
	import UserTitleBadge from './UserTitleBadge.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';

	/**
	 * PodiumCard.svelte — podio físico de la Arena V-SOCIAL.
	 * El avatar sobre pedestal de cristal cuya altura codifica el puesto;
	 * la cara frontal lleva la posición grabada y la placa de estadísticas.
	 *
	 * - Adaptación multitema completa (Light, Dark, Midnight) con alto contraste.
	 * - Modos de rendimiento (Lite, No-Blur, Simplificar Sombras, Reducir Movimiento).
	 */
	let { user, rank, type = 'level', delay = 0 } = $props();

	const rankData = {
		1: {
			color: 'var(--lb-gold)',
			glow: 'var(--lb-gold-glow)',
			icon: 'emoji_events',
			label: 'Campeón',
			avatar: 84,
			pedestal: 148,
			nameSize: '1.08rem'
		},
		2: {
			color: 'var(--lb-silver)',
			glow: 'var(--lb-silver-glow)',
			icon: 'workspace_premium',
			label: 'Subcampeón',
			avatar: 70,
			pedestal: 112,
			nameSize: '1rem'
		},
		3: {
			color: 'var(--lb-bronze)',
			glow: 'var(--lb-bronze-glow)',
			icon: 'workspace_premium',
			label: 'Tercer lugar',
			avatar: 62,
			pedestal: 88,
			nameSize: '0.95rem'
		}
	};

	let rData = $derived(rankData[rank] || rankData[3]);
	let isFirst = $derived(rank === 1);
	let initial = $derived((user.display_name || user.username || '?').charAt(0).toUpperCase());

	// Presencia: mapeo custom_status → variante de dot.
	let presenceClass = $derived.by(() => {
		const s = user.custom_status || 'online';
		return s === 'invisible' || s === 'offline' ? 'is-offline' : `is-${s}`;
	});

	// Chispas deterministas: ráfaga de celebración solo para el campeón.
	const sparks = Array.from({ length: 6 }, (_, i) => {
		const angle = (i / 6) * Math.PI * 2;
		return {
			tx: `${Math.cos(angle) * 52}px`,
			ty: `${Math.sin(angle) * 52 - 14}px`,
			delay: `${420 + i * 70}ms`
		};
	});

	let ariaLabel = $derived.by(() => {
		const who = user.display_name || user.username;
		if (type === 'streak')
			return `${rData.label}: puesto ${rank}, ${who}, racha de ${user.checkin_streak || 0} días`;
		if (type === 'creators')
			return `${rData.label}: puesto ${rank}, ${who}, ${(user.engagement || 0).toLocaleString('es')} interacciones este mes`;
		return `${rData.label}: puesto ${rank}, ${who}, nivel ${user.level || 1}, ${user.xp_points || 0} puntos de experiencia`;
	});
</script>

<article
	class="podium-card"
	class:is-first={isFirst}
	style="--rank-color: {rData.color}; --rank-glow: {rData.glow}; --ped-h: {rData.pedestal}px; --dly: {delay}ms;"
	aria-label={ariaLabel}
>
	<!-- Escenario flotante: trofeo + avatar sobre el pedestal -->
	<div class="pc-stage">
		{#if isFirst}
			<div class="spark-field" aria-hidden="true">
				{#each sparks as s (s.delay)}
					<span class="spark" style="--tx: {s.tx}; --ty: {s.ty}; animation-delay: {s.delay};"
					></span>
				{/each}
			</div>
		{/if}

		<div class="pc-trophy" aria-hidden="true">
			<div class="trophy-medal">
				<span class="material-icons-round trophy-icon">{rData.icon}</span>
			</div>
		</div>

		<a href="/u/{user.username}" class="pc-avatar-link" tabindex="-1" aria-hidden="true">
			<div
				class="pc-avatar {presenceClass}"
				style="flex: 0 0 {rData.avatar}px; width: {rData.avatar}px; height: {rData.avatar}px;"
			>
				{#if user.avatar_url}
					<img
						src={user.avatar_url}
						alt=""
						width={rData.avatar}
						height={rData.avatar}
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<span class="pc-avatar-letter">{initial}</span>
				{/if}
				<span class="presence-dot" title="Estado: {user.custom_status || 'online'}"></span>
			</div>
		</a>
	</div>

	<!-- Placa de identidad -->
	<a
		href="/u/{user.username}"
		class="pc-id"
		style="--name-size: {rData.nameSize};"
		title={user.display_name || user.username}
	>
		<span class="pc-name">
			<span class="pc-name-text">{user.display_name || user.username}</span>
			<VerifiedBadge role={user.role} isVerified={!!user.is_verified} size="14px" />
		</span>
	</a>
	<div class="pc-title">
		{#if user.title_text}
			<UserTitleBadge title={user.title_text} color={user.title_color} size="sm" />
		{:else}
			<span class="pc-handle">@{user.username}</span>
		{/if}
	</div>

	<!-- Pedestal -->
	<div class="pc-pedestal">
		<span class="pc-num" aria-hidden="true"><i>#</i>{rank}</span>

		<div
			class="pc-stat"
			class:is-streak={type === 'streak'}
			class:is-creators={type === 'creators'}
		>
			{#if type === 'level'}
				<LevelBadge level={user.level || 1} size="sm" />
				<span class="pc-stat__value">{(user.xp_points || 0).toLocaleString('es')}</span>
				<span class="pc-stat__unit">XP</span>
			{:else if type === 'streak'}
				<span class="material-icons-round pc-stat__icon">local_fire_department</span>
				<span class="pc-stat__value">{user.checkin_streak || 0}</span>
				<span class="pc-stat__unit">{user.checkin_streak === 1 ? 'día' : 'días'}</span>
			{:else}
				<span class="material-icons-round pc-stat__icon">auto_awesome</span>
				<span class="pc-stat__value">{(user.engagement || 0).toLocaleString('es')}</span>
				<span class="pc-stat__unit">interacciones</span>
			{/if}
		</div>

		{#if isFirst}
			<span class="pc-sheen" aria-hidden="true"></span>
		{/if}
	</div>
</article>

<style>
	.podium-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		z-index: 10;
		animation: pc-rise 0.7s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) backwards;
		animation-delay: var(--dly);
		transition: transform 0.35s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
	}
	@keyframes pc-rise {
		from {
			opacity: 0;
			transform: translateY(26px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Aura de piso bajo cada columna del podio */
	.podium-card::before {
		content: '';
		position: absolute;
		bottom: -10px;
		left: 50%;
		width: 88%;
		height: 34px;
		transform: translateX(-50%);
		background: radial-gradient(ellipse 50% 50% at 50% 50%, var(--rank-color), transparent 72%);
		filter: blur(18px);
		opacity: 0.22;
		transition: opacity 0.3s ease;
		pointer-events: none;
	}
	.podium-card:hover::before {
		opacity: 0.4;
	}
	.podium-card:hover {
		transform: translateY(-5px);
	}

	/* ── Escenario ── */
	.pc-stage {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 10px;
		z-index: 20;
	}

	.spark-field {
		position: absolute;
		top: -12px;
		left: 50%;
		width: 0;
		height: 0;
		z-index: 30;
	}
	.spark {
		position: absolute;
		top: 0;
		left: 0;
		width: 5px;
		height: 5px;
		border-radius: var(--radius-full, 9999px);
		background: var(--lb-gold);
		box-shadow: 0 0 8px var(--lb-gold);
		opacity: 0;
		animation: pc-spark 900ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
	}
	@keyframes pc-spark {
		0% {
			transform: translate(0, 0) scale(1);
			opacity: 1;
		}
		100% {
			transform: translate(var(--tx), var(--ty)) scale(0);
			opacity: 0;
		}
	}

	.pc-trophy {
		position: absolute;
		top: -30px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 32;
	}
	.is-first .pc-trophy {
		top: -40px;
	}
	.trophy-medal {
		width: 42px;
		height: 42px;
		border-radius: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
		background: radial-gradient(
			circle at 30% 28%,
			color-mix(in srgb, var(--rank-color) 48%, rgba(255, 255, 255, 0.75)),
			color-mix(in srgb, var(--rank-color) 28%, var(--lb-medal-shadow, rgba(0, 0, 0, 0.5))) 85%
		);
		border: 1px solid color-mix(in srgb, var(--rank-color) 60%, rgba(255, 255, 255, 0.7));
		box-shadow:
			inset 0 2px 4px rgba(255, 255, 255, 0.55),
			inset 0 -3px 6px rgba(0, 0, 0, 0.45),
			0 4px 12px rgba(0, 0, 0, 0.28),
			0 0 18px var(--rank-glow);
	}
	.is-first .trophy-medal {
		width: 52px;
		height: 52px;
	}

	.trophy-icon {
		font-size: 22px;
		width: 1em;
		height: 1em;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6));
		position: relative;
		z-index: 2;
	}
	.is-first .trophy-icon {
		font-size: 28px;
	}

	/* Avatar con anillo cónico del color del puesto */
	.pc-avatar-link {
		display: block;
		margin-top: 14px;
		border-radius: 20px;
	}
	.pc-avatar-link:focus-visible {
		outline: 2px solid var(--aero-sky, #2eb4ff);
		outline-offset: 4px;
		border-radius: 20px;
	}
	.pc-avatar {
		position: relative;
		flex-shrink: 0;
		border-radius: 20px;
		padding: 3px;
		background: conic-gradient(
			from 140deg,
			var(--rank-color),
			rgba(255, 255, 255, 0.35),
			var(--rank-color)
		);
		box-shadow:
			0 6px 16px rgba(0, 0, 0, 0.32),
			inset 0 2px 4px rgba(0, 0, 0, 0.3);
	}
	.pc-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 17px;
		background: var(--bg-surface);
	}
	.pc-avatar-letter {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 17px;
		font-family: var(--font-display, sans-serif);
		font-weight: 800;
		font-size: clamp(1.5rem, 200%, 2.2rem);
		color: #fff;
		background: linear-gradient(135deg, var(--rank-color), rgba(0, 0, 0, 0.35));
	}

	.presence-dot {
		position: absolute;
		bottom: 1px;
		right: 1px;
		width: 15px;
		height: 15px;
		border-radius: var(--radius-full, 9999px);
		border: 2.5px solid var(--lb-card-bg, var(--bg-surface));
		pointer-events: none;
	}
	.pc-avatar.is-online .presence-dot {
		background: var(--aero-mint, #00d4aa);
		box-shadow: 0 0 8px rgba(0, 212, 170, 0.65);
	}
	.pc-avatar.is-away .presence-dot {
		background: var(--aero-amber, #f5a623);
		box-shadow: 0 0 8px rgba(245, 166, 35, 0.6);
	}
	.pc-avatar.is-busy .presence-dot {
		background: var(--aero-coral, #f472b6);
		box-shadow: 0 0 8px rgba(244, 114, 182, 0.6);
	}
	.pc-avatar.is-offline .presence-dot {
		background: var(--text-muted);
		box-shadow: none;
	}

	/* ── Identidad ── */
	.pc-id {
		text-decoration: none;
		max-width: 100%;
	}
	.pc-id:focus-visible {
		outline: 2px solid var(--aero-sky, #2eb4ff);
		outline-offset: 3px;
		border-radius: var(--radius-xs, 6px);
	}
	.pc-name {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		max-width: 100%;
		font-family: var(--font-display, sans-serif);
		font-size: var(--name-size, 1rem);
		font-weight: 800;
		line-height: 1.2;
		color: var(--text-primary);
	}
	.pc-name-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 128px;
	}
	.pc-id:hover .pc-name-text {
		color: var(--aero-sky, #2eb4ff);
	}
	.pc-title {
		margin-top: 3px;
		min-height: 20px;
	}
	.pc-handle {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	/* ── Pedestal ── */
	.pc-pedestal {
		position: relative;
		width: 100%;
		height: var(--ped-h);
		margin-top: 9px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		border: 1.5px solid transparent;
		border-radius: var(--radius-md, 14px) var(--radius-md, 14px) var(--radius-sm, 10px)
			var(--radius-sm, 10px);
		background:
			linear-gradient(
					color-mix(in srgb, var(--rank-color) 7%, transparent),
					var(--lb-card-bg, rgba(14, 34, 54, 0.75))
				)
				padding-box,
			linear-gradient(
					180deg,
					var(--rank-color) 0%,
					rgba(255, 255, 255, 0.4) 30%,
					rgba(255, 255, 255, 0.1) 70%,
					color-mix(in srgb, var(--rank-color) 45%, transparent) 100%
				)
				border-box;
		backdrop-filter: var(--lb-glass-blur, blur(16px));
		-webkit-backdrop-filter: var(--lb-glass-blur, blur(16px));
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.25),
			inset 0 -10px 22px color-mix(in srgb, var(--rank-color) 14%, transparent),
			0 10px 26px rgba(0, 0, 0, 0.16),
			0 0 22px var(--rank-glow);
		overflow: hidden;
	}

	/* Numeración grabada en la cara frontal */
	.pc-num {
		position: absolute;
		top: 6px;
		font-family: var(--font-display, sans-serif);
		font-weight: 900;
		font-size: calc(var(--ped-h) * 0.34);
		line-height: 1;
		letter-spacing: -0.04em;
		color: color-mix(in srgb, var(--rank-color) 38%, transparent);
		text-shadow:
			0 1px 0 rgba(255, 255, 255, 0.22),
			0 -1px 1px rgba(0, 0, 0, 0.28);
		user-select: none;
		pointer-events: none;
	}
	.pc-num i {
		font-style: normal;
		font-size: 0.62em;
		vertical-align: 0.28em;
		opacity: 0.85;
	}

	/* Placa de estadísticas embebida */
	.pc-stat {
		position: relative;
		z-index: 5;
		display: flex;
		align-items: baseline;
		justify-content: center;
		flex-wrap: wrap;
		gap: 5px;
		width: calc(100% - 16px);
		margin-bottom: 10px;
		padding: 8px 6px;
		border-radius: var(--radius-sm, 10px);
		background: color-mix(in srgb, var(--bg-canvas, #000) 22%, transparent);
		border: 1px solid color-mix(in srgb, var(--rank-color) 40%, transparent);
		box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.14);
	}
	.pc-stat__icon {
		align-self: center;
		font-size: 17px;
		color: var(--rank-color);
	}
	.pc-stat__value {
		font-family: var(--font-display, sans-serif);
		font-weight: 900;
		font-size: 1.02rem;
		line-height: 1;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}
	.pc-stat__unit {
		font-size: 0.58rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.13em;
		color: var(--text-secondary);
	}
	.pc-stat.is-streak {
		border-color: color-mix(in srgb, var(--lb-streak) 55%, transparent);
	}
	.pc-stat.is-streak .pc-stat__value {
		text-shadow: 0 0 10px var(--lb-streak-glow);
	}
	.pc-stat.is-streak .pc-stat__icon {
		color: var(--lb-streak);
	}
	.pc-stat.is-creators {
		border-color: color-mix(in srgb, var(--lb-creator) 55%, transparent);
	}
	.pc-stat.is-creators .pc-stat__icon {
		color: var(--lb-creator);
	}

	/* Barrido especular periódico: exclusivo del campeón */
	.pc-sheen {
		position: absolute;
		inset: 0;
		z-index: 8;
		pointer-events: none;
		overflow: hidden;
		border-radius: inherit;
	}
	.pc-sheen::after {
		content: '';
		position: absolute;
		top: -20%;
		bottom: -20%;
		left: 0;
		width: 46%;
		background: linear-gradient(
			105deg,
			transparent 0%,
			rgba(255, 255, 255, 0.05) 40%,
			rgba(255, 255, 255, 0.22) 50%,
			rgba(255, 255, 255, 0.05) 60%,
			transparent 100%
		);
		transform: translateX(-160%) skewX(-12deg);
		animation: pc-sheen-sweep 6.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}
	@keyframes pc-sheen-sweep {
		0%,
		55% {
			transform: translateX(-160%) skewX(-12deg);
		}
		85%,
		100% {
			transform: translateX(320%) skewX(-12deg);
		}
	}

	/* ══ Adaptación al Tema Claro (Light Theme) ══ */
	:global([data-theme='light']) .pc-pedestal {
		background:
			linear-gradient(color-mix(in srgb, var(--rank-color) 12%, #fff), rgba(255, 255, 255, 0.88))
				padding-box,
			linear-gradient(
					180deg,
					var(--rank-color) 0%,
					rgba(255, 255, 255, 0.8) 35%,
					color-mix(in srgb, var(--rank-color) 45%, rgba(0, 0, 0, 0.1)) 100%
				)
				border-box;
		box-shadow:
			inset 0 1px 1.5px rgba(255, 255, 255, 0.9),
			0 8px 22px rgba(0, 0, 0, 0.08),
			0 0 14px color-mix(in srgb, var(--rank-color) 25%, transparent);
	}

	:global([data-theme='light']) .pc-num {
		color: color-mix(in srgb, var(--rank-color) 60%, #1e293b);
		text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
	}

	:global([data-theme='light']) .pc-stat {
		background: rgba(255, 255, 255, 0.85);
		border-color: color-mix(in srgb, var(--rank-color) 40%, rgba(0, 0, 0, 0.12));
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	:global([data-theme='light']) .trophy-medal {
		background: radial-gradient(
			circle at 30% 28%,
			color-mix(in srgb, var(--rank-color) 40%, #fff),
			color-mix(in srgb, var(--rank-color) 25%, #f1f5f9) 85%
		);
		border-color: color-mix(in srgb, var(--rank-color) 55%, rgba(0, 0, 0, 0.15));
		box-shadow:
			inset 0 1px 2px rgba(255, 255, 255, 0.9),
			0 3px 10px rgba(0, 0, 0, 0.12);
	}

	:global([data-theme='light']) .trophy-icon {
		color: color-mix(in srgb, var(--rank-color) 80%, #0f172a);
		filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.6));
	}

	/* ══ Modos de Rendimiento ══ */
	:global([data-perf-mode='true']) .pc-pedestal,
	:global([data-glass-blur='none']) .pc-pedestal {
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
	}

	:global([data-perf-mode='true']) .podium-card,
	:global([data-reduced-motion='true']) .podium-card {
		animation: none !important;
	}

	:global([data-perf-mode='true']) .spark-field,
	:global([data-perf-mode='true']) .pc-sheen,
	:global([data-reduced-motion='true']) .spark-field,
	:global([data-reduced-motion='true']) .pc-sheen {
		display: none !important;
	}

	:global([data-perf-mode='true']) .podium-card::before,
	:global([data-simplify-shadows='true']) .podium-card::before {
		filter: none !important;
		opacity: 0.15 !important;
	}

	:global([data-simplify-shadows='true']) .pc-pedestal {
		box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.1)) !important;
	}

	:global([data-disable-hover-glow='true']) .podium-card:hover {
		transform: none !important;
	}

	@media (max-width: 480px) {
		.pc-name-text {
			max-width: 92px;
		}
		.pc-stat__unit {
			display: none;
		}
	}
</style>
