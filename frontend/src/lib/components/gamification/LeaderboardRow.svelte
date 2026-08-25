<script>
	import LevelBadge from './LevelBadge.svelte';
	import UserTitleBadge from './UserTitleBadge.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import { levelProgress } from '$lib/utils/xp.js';

	/**
	 * LeaderboardRow.svelte — fila del ranking (puesto 4+).
	 * Incluye: medalla de puesto por tramo, delta ▲▼ vs la visita anterior,
	 * micro-barra de progreso XP al siguiente nivel (modo Niveles) y
	 * resaltado del texto buscado. Toda la fila es enlace al perfil.
	 *
	 * - Adaptación multitema (Light, Dark, Midnight).
	 * - Rendimiento optimizado con content-visibility diferido y perfiles Lite.
	 */
	let { user, rank, type = 'level', isCurrentUser = false, delta = null, query = '' } = $props();

	let initial = $derived((user.display_name || user.username || '?').charAt(0).toUpperCase());

	// Presencia: mapeo custom_status → variante de dot.
	let presenceClass = $derived.by(() => {
		const s = user.custom_status || 'online';
		return s === 'invisible' || s === 'offline' ? 'is-offline' : `is-${s}`;
	});

	// Acento por tramo de puesto — refleja las luces de la Arena.
	let tier = $derived.by(() => {
		if (rank <= 10) return 'rising'; // menta
		if (rank <= 25) return 'climbing'; // cielo
		return 'base';
	});
	let accent = $derived(
		tier === 'rising'
			? 'var(--lb-rising)'
			: tier === 'climbing'
				? 'var(--lb-climbing)'
				: 'var(--text-muted)'
	);

	// Progreso XP dentro del nivel actual (solo modo Niveles).
	let progress = $derived(type === 'level' ? levelProgress(user.xp_points, user.level) : null);

	// Resaltado insensible a mayúsculas del nombre/handle buscado.
	let nameParts = $derived.by(() => {
		const name = user.display_name || user.username || '';
		const q = (query || '').trim();
		if (!q) return [name];
		const idx = name.toLowerCase().indexOf(q.toLowerCase());
		if (idx === -1) return [name];
		return [name.slice(0, idx), name.slice(idx, idx + q.length), name.slice(idx + q.length)];
	});

	let ariaLabel = $derived.by(() => {
		const who = user.display_name || user.username;
		if (type === 'streak')
			return `Puesto ${rank}, ${who}, racha de ${user.checkin_streak || 0} días`;
		if (type === 'creators')
			return `Puesto ${rank}, ${who}, ${(user.engagement || 0).toLocaleString('es')} interacciones este mes`;
		return `Puesto ${rank}, ${who}, nivel ${user.level || 1}, ${user.xp_points || 0} XP`;
	});
</script>

<a
	href="/u/{user.username}"
	class="lb-row"
	class:is-self={isCurrentUser}
	style="--row-accent: {accent};"
	aria-label={ariaLabel}
	aria-current={isCurrentUser ? 'true' : undefined}
>
	<span class="lb-row__rank" aria-hidden="true">
		{rank}
		{#if delta != null && delta !== 0}
			<em class="delta" class:up={delta > 0} aria-hidden="true">
				{delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
			</em>
		{/if}
	</span>

	<div class="lb-row__avatar {presenceClass}">
		{#if user.avatar_url}
			<img
				src={user.avatar_url}
				alt=""
				width="44"
				height="44"
				loading="lazy"
				decoding="async"
				class="avatar-img"
			/>
		{:else}
			<div class="avatar-letter">{initial}</div>
		{/if}
		<span class="presence-dot" title="Estado: {user.custom_status || 'online'}"></span>
	</div>

	<div class="lb-row__id">
		<span class="lb-row__name">
			{#if nameParts.length === 3}
				{nameParts[0]}<mark class="hl">{nameParts[1]}</mark>{nameParts[2]}
			{:else}
				{nameParts[0]}
			{/if}
			<VerifiedBadge role={user.role} isVerified={!!user.is_verified} size="14px" />
		</span>
		<span class="lb-row__meta">
			{#if type === 'level'}
				<LevelBadge level={user.level || 1} size="sm" />
				<span
					class="xpbar"
					role="presentation"
					title="{progress?.pct}% hacia el nivel {(user.level || 1) + 1}"
				>
					<span class="xpbar__fill" style="width: {progress?.pct ?? 0}%"></span>
				</span>
			{:else if user.title_text}
				<UserTitleBadge title={user.title_text} color={user.title_color} size="sm" />
			{:else}
				<span class="lb-row__handle">@{user.username}</span>
			{/if}
		</span>
	</div>

	<div class="lb-row__stat">
		{#if type === 'level'}
			<span class="stat-value">{(user.xp_points || 0).toLocaleString('es')}</span>
			<span class="stat-unit">XP</span>
		{:else if type === 'streak'}
			<span class="chip chip--streak">
				<span class="material-icons-round">local_fire_department</span>
				{user.checkin_streak || 0}
			</span>
		{:else}
			<span class="chip chip--creators">
				<span class="material-icons-round">auto_awesome</span>
				{(user.engagement || 0).toLocaleString('es')}
			</span>
		{/if}
	</div>
</a>

<style>
	.lb-row {
		position: relative;
		display: grid;
		grid-template-columns: 40px auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 13px;
		padding: 11px 16px 11px 12px;
		border-radius: var(--radius-lg, 18px);
		border: 1px solid transparent;
		background:
			linear-gradient(
					var(--lb-card-bg, rgba(14, 34, 54, 0.65)),
					var(--lb-card-bg, rgba(14, 34, 54, 0.65))
				)
				padding-box,
			linear-gradient(
					135deg,
					color-mix(in srgb, var(--row-accent) 45%, rgba(255, 255, 255, 0.25)),
					rgba(255, 255, 255, 0.08) 50%,
					color-mix(in srgb, var(--row-accent) 22%, transparent)
				)
				border-box;
		box-shadow: var(--shadow-sm);
		backdrop-filter: var(--lb-glass-blur, blur(16px));
		-webkit-backdrop-filter: var(--lb-glass-blur, blur(16px));
		text-decoration: none;
		overflow: hidden;
		transition:
			transform 0.22s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
			box-shadow 0.22s ease,
			background 0.22s ease;
	}

	.lb-row:hover {
		transform: translateY(-3px);
		box-shadow:
			var(--shadow-md),
			0 0 18px color-mix(in srgb, var(--row-accent) 24%, transparent);
	}

	.lb-row:focus-visible {
		outline: 2px solid var(--aero-sky, #2eb4ff);
		outline-offset: 2px;
	}

	/* Fila del usuario autenticado */
	.lb-row.is-self {
		background:
			linear-gradient(
					color-mix(in srgb, var(--lb-self) 14%, var(--lb-card-bg, rgba(14, 34, 54, 0.65))),
					color-mix(in srgb, var(--lb-self) 14%, var(--lb-card-bg, rgba(14, 34, 54, 0.65)))
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

	/* ── Puesto + delta ── */
	.lb-row__rank {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		font-family: var(--font-display, sans-serif);
		font-size: 1.12rem;
		font-weight: 900;
		line-height: 1;
		color: var(--row-accent);
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.delta {
		font-style: normal;
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.delta.up {
		color: var(--aero-mint, #00d4aa);
	}
	.delta:not(.up) {
		color: var(--aero-coral, #f472b6);
	}

	/* ── Avatar ── */
	.lb-row__avatar {
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		position: relative;
		border-radius: 14px;
		padding: 2px;
		background: linear-gradient(135deg, var(--row-accent), transparent);
	}
	.presence-dot {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 12px;
		height: 12px;
		border-radius: var(--radius-full, 9999px);
		border: 2px solid var(--lb-card-bg, var(--bg-surface));
		pointer-events: none;
		z-index: 3;
	}
	.lb-row__avatar.is-online .presence-dot {
		background: var(--aero-mint, #00d4aa);
		box-shadow: 0 0 6px rgba(0, 212, 170, 0.6);
	}
	.lb-row__avatar.is-away .presence-dot {
		background: var(--aero-amber, #f5a623);
		box-shadow: 0 0 6px rgba(245, 166, 35, 0.55);
	}
	.lb-row__avatar.is-busy .presence-dot {
		background: var(--aero-coral, #f472b6);
		box-shadow: 0 0 6px rgba(244, 114, 182, 0.55);
	}
	.lb-row__avatar.is-offline .presence-dot {
		background: var(--text-muted);
		box-shadow: none;
	}
	.avatar-img,
	.avatar-letter {
		width: 100%;
		height: 100%;
		border-radius: 12px;
		object-fit: cover;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-surface);
	}
	.avatar-letter {
		font-family: var(--font-display, sans-serif);
		font-weight: 800;
		font-size: 1.05rem;
		color: #fff;
		background: linear-gradient(135deg, var(--row-accent), rgba(0, 0, 0, 0.35));
	}

	/* ── Identidad ── */
	.lb-row__id {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.lb-row__name {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-family: var(--font-sans, sans-serif);
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-primary);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hl {
		background: color-mix(in srgb, var(--aero-sky, #2eb4ff) 30%, transparent);
		color: inherit;
		border-radius: 3px;
		padding: 0 1px;
	}
	.lb-row__handle {
		font-size: 0.78rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Micro-barra de progreso al siguiente nivel */
	.lb-row__meta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.xpbar {
		flex: 0 1 84px;
		height: 4px;
		border-radius: var(--radius-full, 9999px);
		background: color-mix(in srgb, var(--text-primary) 10%, transparent);
		overflow: hidden;
	}
	.xpbar__fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--aero-sky, #2eb4ff), var(--aero-mint, #00d4aa));
		box-shadow: 0 0 6px rgba(46, 180, 255, 0.5);
		transition: width 0.6s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
	}

	/* ── Estadística ── */
	.lb-row__stat {
		display: inline-flex;
		align-items: baseline;
		gap: 4px;
	}
	.stat-value {
		font-family: var(--font-display, sans-serif);
		font-weight: 800;
		font-size: 0.92rem;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}
	.stat-unit {
		font-size: 0.58rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--text-secondary);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 11px;
		border-radius: var(--radius-full, 9999px);
		border: 1px solid transparent;
		font-weight: 800;
		font-size: 0.9rem;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
		transition: transform 0.22s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
	}
	.lb-row:hover .chip {
		transform: scale(1.06);
	}
	.chip .material-icons-round {
		font-size: 16px;
	}
	.chip--streak {
		background: color-mix(in srgb, var(--lb-streak) 13%, transparent);
		border-color: color-mix(in srgb, var(--lb-streak) 55%, transparent);
	}
	.chip--streak .material-icons-round {
		color: var(--lb-streak);
	}
	.chip--creators {
		background: color-mix(in srgb, var(--lb-creator) 13%, transparent);
		border-color: color-mix(in srgb, var(--lb-creator) 55%, transparent);
	}
	.chip--creators .material-icons-round {
		color: var(--lb-creator);
	}

	/* ══ Adaptación al Tema Claro (Light Theme) ══ */
	:global([data-theme='light']) .lb-row {
		background:
			linear-gradient(rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.88)) padding-box,
			linear-gradient(
					135deg,
					color-mix(in srgb, var(--row-accent) 55%, rgba(0, 0, 0, 0.1)),
					rgba(0, 0, 0, 0.06) 50%,
					color-mix(in srgb, var(--row-accent) 30%, rgba(0, 0, 0, 0.05))
				)
				border-box;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
	}

	:global([data-theme='light']) .lb-row.is-self {
		background:
			linear-gradient(
					color-mix(in srgb, var(--lb-self) 8%, #fff),
					color-mix(in srgb, var(--lb-self) 8%, #fff)
				)
				padding-box,
			linear-gradient(
					135deg,
					var(--lb-self),
					color-mix(in srgb, var(--lb-self) 60%, #fff) 50%,
					color-mix(in srgb, var(--lb-self) 35%, transparent)
				)
				border-box;
		box-shadow:
			0 4px 14px rgba(0, 0, 0, 0.06),
			0 0 12px color-mix(in srgb, var(--lb-self) 20%, transparent);
	}

	:global([data-theme='light']) .xpbar {
		background: rgba(0, 0, 0, 0.08);
	}

	/* ══ Modos de Rendimiento ══ */
	:global([data-content-visibility='true']) .lb-row,
	:global([data-perf-mode='true']) .lb-row {
		content-visibility: auto;
		contain-intrinsic-size: auto none auto 68px;
	}

	:global([data-perf-mode='true']) .lb-row,
	:global([data-glass-blur='none']) .lb-row {
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
	}

	:global([data-simplify-shadows='true']) .lb-row {
		box-shadow: var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.05)) !important;
	}

	:global([data-disable-hover-glow='true']) .lb-row:hover {
		transform: none !important;
	}

	@media (max-width: 420px) {
		.lb-row {
			grid-template-columns: 34px auto minmax(0, 1fr) auto;
			gap: 10px;
			padding-right: 12px;
		}
		.xpbar {
			flex-basis: 56px;
		}
	}
</style>
