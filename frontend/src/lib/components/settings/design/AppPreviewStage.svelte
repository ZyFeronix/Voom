<script>
	/**
	 * AppPreviewStage — Escenario interactivo de previsualización en vivo de la
	 * apariencia global de Voom! (pestaña «Aplicación» de /settings/design).
	 *
	 * Reacciona dinámicamente al appearanceStore:
	 *  - Color de acento (--accent-blue-base, gradientes y sombras de neón).
	 *  - Escala tipográfica y fuente activa.
	 *  - Densidad de interfaz (compact / cozy / roomy).
	 *  - Wallpaper activo con oscurecimiento (dim).
	 */
	import { appearanceStore, APP_PRESETS } from '$lib/stores/appearance.svelte.js';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';

	let liked = $state(false);
	let likesCount = $state(42);
	let commentsCount = $state(18);
	let shared = $state(false);
	let activeSampleNav = $state('feed');

	// Dominio reactivo de la barra de URL del mockup: refleja el host real en el
	// que corre la app (p. ej. el túnel actual o voom.social).
	let siteHost = $derived(typeof window !== 'undefined' ? window.location.host : '');

	const activePresetObj = $derived(APP_PRESETS.find((p) => p.id === appearanceStore.activePreset));

	function toggleLike() {
		liked = !liked;
		likesCount += liked ? 1 : -1;
	}

	function handleShare() {
		shared = true;
		setTimeout(() => {
			shared = false;
		}, 2000);
	}

	const densityPadding = $derived.by(() => {
		switch (appearanceStore.density) {
			case 'compact':
				return '12px 14px';
			case 'roomy':
				return '22px 24px';
			default:
				return '16px 18px';
		}
	});

	const densityGap = $derived.by(() => {
		switch (appearanceStore.density) {
			case 'compact':
				return '8px';
			case 'roomy':
				return '16px';
			default:
				return '12px';
		}
	});
</script>

<aside class="app-preview-stage" aria-label="Previsualización en vivo de la interfaz">
	<div class="stage-frame glass-panel">
		<!-- Barra superior simulada de ventana -->
		<header class="stage-topbar">
			<div class="window-dots" aria-hidden="true">
				<span class="dot red"></span>
				<span class="dot yellow"></span>
				<span class="dot green"></span>
			</div>
			<div class="stage-url-bar">
				<span class="material-icons-round lock-icon" aria-hidden="true">lock</span>
				<span class="url-text">{siteHost}/{activeSampleNav}</span>
			</div>
			<div class="stage-topbar-right">
				{#if activePresetObj}
					<span class="stage-preset-badge" title="Preset aplicado">
						<span class="material-icons-round badge-ico">auto_awesome</span>
						<span>{activePresetObj.name}</span>
					</span>
				{/if}
				<div class="stage-sync-badge">
					<span class="sync-dot"></span>
					<span>En vivo</span>
				</div>
			</div>
		</header>

		<!-- Lienzo de la simulación -->
		<div class="stage-canvas" class:has-wallpaper={!!appearanceStore.wallpaperUrl}>
			{#if appearanceStore.wallpaperUrl}
				<div
					class="stage-wallpaper mode-{appearanceStore.wallpaperMode}"
					style="background-image: url('{appearanceStore.wallpaperUrl}');"
					aria-hidden="true"
				></div>
				<div
					class="stage-wallpaper-dim"
					style="background: rgba(0, 0, 0, {appearanceStore.wallpaperDim / 100});"
					aria-hidden="true"
				></div>
			{/if}

			<div
				class="stage-content"
				style:--density-gap={densityGap}
				style="font-size: calc(1rem * {appearanceStore.fontScale});"
			>
				<!-- Mini navbar simulado -->
				<div
					class="sample-navbar glass-card"
					style="background: {appearanceStore.cardOpacity < 100
						? `color-mix(in srgb, var(--bg-surface-solid) ${appearanceStore.cardOpacity}%, transparent)`
						: 'var(--bg-surface)'}; backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2)); -webkit-backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2));"
				>
					<div class="navbar-brand">
						<span class="brand-sparkle material-icons-round" aria-hidden="true">flare</span>
						<span class="brand-name">Voom!</span>
					</div>
					<div class="navbar-actions" role="tablist">
						<button
							type="button"
							class="nav-chip"
							class:active={activeSampleNav === 'feed'}
							onclick={() => (activeSampleNav = 'feed')}
						>
							Feed
						</button>
						<button
							type="button"
							class="nav-chip"
							class:active={activeSampleNav === 'explore'}
							onclick={() => (activeSampleNav = 'explore')}
						>
							Explorar
						</button>
					</div>
				</div>

				<!-- Tarjeta de publicación de ejemplo -->
				<article
					class="sample-card glass-card"
					style="padding: {densityPadding}; background: {appearanceStore.cardOpacity < 100
						? `color-mix(in srgb, var(--bg-surface-solid) ${appearanceStore.cardOpacity}%, transparent)`
						: 'var(--bg-surface)'}; backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2)); -webkit-backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2));"
				>
					<div class="sample-card-head">
						<div class="sample-avatar" style="flex: 0 0 44px; min-width: 44px; min-height: 44px;">
							<span>VV</span>
							<span class="avatar-status-dot" aria-hidden="true"></span>
						</div>
						<div class="sample-author-info">
							<div class="author-row">
								<span class="author-name">Valeria Vance</span>
								<VerifiedBadge isVerified={true} size="15px" />
							</div>
							<span class="author-meta">@valeria · hace 15m</span>
						</div>
						<span class="more-icon material-icons-round" aria-hidden="true">more_horiz</span>
					</div>

					<p class="sample-post-text">
						¡Explorando la nueva estética <strong>Neo-Aero</strong> en Voom!! Los reflejos de
						cristal líquido y la fluidez del diseño se sienten impecables. ✨
						<span class="tag">#Voom!</span>
						<span class="tag">#Glassmorphism</span>
					</p>

					<div class="sample-media-box">
						<div class="media-sheen" aria-hidden="true"></div>
						<div class="media-badge">
							<span class="material-icons-round">photo_camera</span>
							<span>Diseño en tiempo real</span>
						</div>
					</div>

					<footer class="sample-card-actions">
						<button
							type="button"
							class="sample-act-btn"
							class:active-like={liked}
							onclick={toggleLike}
							aria-label="Dar me gusta"
						>
							<span class="material-icons-round">{liked ? 'favorite' : 'favorite_border'}</span>
							<span>{likesCount}</span>
						</button>
						<button
							type="button"
							class="sample-act-btn"
							onclick={() => commentsCount++}
							title="Añadir comentario simulado"
							aria-label="Comentarios"
						>
							<span class="material-icons-round">chat_bubble_outline</span>
							<span>{commentsCount}</span>
						</button>
						<button
							type="button"
							class="sample-act-btn"
							class:active-shared={shared}
							onclick={handleShare}
							title="Simular compartir publicación"
							aria-label="Compartir"
						>
							<span class="material-icons-round">{shared ? 'check' : 'share'}</span>
							<span>{shared ? '¡Copiado!' : '7'}</span>
						</button>
					</footer>
				</article>

				<!-- Botones y estados de demostración -->
				<div
					class="sample-ui-strip glass-card"
					style="background: {appearanceStore.cardOpacity < 100
						? `color-mix(in srgb, var(--bg-surface-solid) ${appearanceStore.cardOpacity}%, transparent)`
						: 'var(--bg-surface)'}; backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2)); -webkit-backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2));"
				>
					<span class="strip-label">Botones del sistema</span>
					<div class="strip-buttons">
						<button type="button" class="btn-aero-primary sample-btn">
							<span class="material-icons-round">rocket_launch</span>
							<span>Acción primaria</span>
						</button>
						<button type="button" class="btn-aero-secondary sample-btn">
							<span>Secundario</span>
						</button>
					</div>
				</div>
			</div>
		</div>

		<footer class="stage-footer">
			<span class="material-icons-round" aria-hidden="true">info</span>
			<span>Muestra en vivo del acento, escala, fuente y densidad seleccionados.</span>
		</footer>
	</div>
</aside>

<style>
	.app-preview-stage {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 480px;
		margin: 0 auto;
		position: sticky;
		top: 16px;
	}

	.stage-frame {
		border-radius: var(--radius-lg, 22px);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		box-shadow:
			0 16px 40px rgba(0, 0, 0, 0.28),
			0 0 0 1px var(--border-subtle);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.stage-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface) 85%, transparent);
		backdrop-filter: var(--glass-blur, blur(14px));
		gap: 10px;
	}

	.window-dots {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}
	.dot.red {
		background: #ff5f56;
	}
	.dot.yellow {
		background: #ffbd2e;
	}
	.dot.green {
		background: #27c93f;
	}

	.stage-url-bar {
		flex: 1;
		max-width: 210px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: var(--bg-input, rgba(0, 0, 0, 0.15));
		border: 1px solid var(--border-subtle);
		border-radius: 999px;
		padding: 4px 10px;
		font-size: 0.72rem;
		font-family: var(--font-mono, monospace);
		color: var(--text-muted);
	}
	.lock-icon {
		font-size: 11px;
		color: var(--aero-mint, #00d4aa);
	}

	.stage-topbar-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.stage-preset-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--accent-blue-light, #2eb4ff);
		background: color-mix(in srgb, var(--accent-blue-base, #1b85f3) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent-blue-base, #1b85f3) 30%, transparent);
		padding: 2px 7px;
		border-radius: 999px;
	}
	.stage-preset-badge .badge-ico {
		font-size: 11px;
	}

	.stage-sync-badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--aero-mint, #00d4aa);
	}
	.sync-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--aero-mint, #00d4aa);
		box-shadow: 0 0 6px var(--aero-mint, #00d4aa);
	}

	.stage-canvas {
		position: relative;
		padding: 16px;
		overflow: hidden;
		min-height: 480px;
		background:
			radial-gradient(
				circle 320px at 85% 15%,
				color-mix(in srgb, var(--accent-blue-base, #1b85f3) 22%, transparent),
				transparent 70%
			),
			radial-gradient(
				circle 280px at 15% 85%,
				color-mix(in srgb, var(--aero-mint, #00d4aa) 18%, transparent),
				transparent 70%
			),
			var(--bg-canvas, transparent);
	}

	.stage-wallpaper {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		z-index: 1;
		transition:
			background-size 0.2s ease,
			background-repeat 0.2s ease,
			opacity 0.2s ease;
	}
	.stage-wallpaper.mode-tile {
		background-size: auto;
		background-repeat: repeat;
		image-rendering: pixelated;
	}
	.stage-wallpaper.mode-fit {
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
	}
	.stage-wallpaper.mode-cover {
		background-size: cover;
		background-repeat: no-repeat;
		background-position: center;
	}

	.stage-wallpaper-dim {
		position: absolute;
		inset: 0;
		z-index: 2;
		transition: background 0.2s ease;
	}

	.stage-content {
		position: relative;
		z-index: 3;
		display: flex;
		flex-direction: column;
		gap: var(--density-gap, 12px);
	}

	/* Mini Navbar */
	.sample-navbar {
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		border-radius: var(--radius-md, 14px);
		transition:
			border-radius 0.2s ease,
			background 0.2s ease;
	}
	.navbar-brand {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 800;
		font-size: 0.84rem;
		letter-spacing: 0.04em;
		color: var(--text-main);
	}
	.brand-sparkle {
		font-size: 16px;
		color: var(--accent-blue-base, var(--aero-blue));
	}
	.navbar-actions {
		display: flex;
		gap: 6px;
	}
	.nav-chip {
		border: 1px solid transparent;
		background: transparent;
		font-size: 0.72rem;
		font-weight: 650;
		padding: 3px 10px;
		border-radius: 999px;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s var(--ease-spring);
	}
	.nav-chip:hover:not(.active) {
		color: var(--text-main);
		background: var(--bg-surface-hover);
	}
	.nav-chip.active {
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 14%, transparent);
		color: var(--accent-blue-base, var(--aero-blue));
		border: 1px solid color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 30%, transparent);
	}

	/* Sample Card */
	.sample-card {
		position: relative;
		overflow: hidden;
		border-radius: var(--radius-lg, 20px);
		display: flex;
		flex-direction: column;
		gap: 10px;
		transition:
			padding 0.2s ease,
			border-radius 0.2s ease,
			background 0.2s ease;
	}

	/* Reflejo especular superior Frutiger Aero (Windows 7 / Aqua) */
	.sample-navbar::after,
	.sample-card::after,
	.sample-ui-strip::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		border-top-left-radius: inherit;
		border-top-right-radius: inherit;
		background: var(
			--specular-line,
			linear-gradient(90deg, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.15) 100%)
		);
		pointer-events: none;
		z-index: 4;
		opacity: var(--gloss-strength, 1);
		transition: opacity 0.2s ease;
	}

	.sample-card-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.sample-avatar {
		border-radius: 50%;
		background: linear-gradient(
			135deg,
			var(--accent-blue-base, var(--aero-blue)),
			var(--aero-sky, #2eb4ff)
		);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: 0.85rem;
		position: relative;
		box-shadow: 0 2px 8px
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 35%, transparent);
	}
	.avatar-status-dot {
		position: absolute;
		bottom: 1px;
		right: 1px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--aero-mint, #00d4aa);
		border: 2px solid var(--bg-surface);
	}

	.sample-author-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.author-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.author-name {
		font-size: 0.88rem;
		font-weight: 750;
		color: var(--text-main);
	}
	.author-meta {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.more-icon {
		font-size: 18px;
		color: var(--text-muted);
	}

	.sample-post-text {
		margin: 0;
		font-size: 0.86rem;
		line-height: 1.5;
		color: var(--text-main);
	}
	.sample-post-text .tag {
		color: var(--accent-blue-base, var(--aero-blue));
		font-weight: 600;
	}

	.sample-media-box {
		height: 110px;
		border-radius: var(--radius-md, 14px);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 30%, transparent),
			color-mix(in srgb, var(--aero-mint, #00d4aa) 20%, transparent)
		);
		border: 1px solid var(--border-subtle);
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.media-sheen {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			120deg,
			transparent 30%,
			rgba(255, 255, 255, 0.12) 50%,
			transparent 70%
		);
		pointer-events: none;
	}
	.media-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(10px);
		color: white;
		font-size: 0.76rem;
		font-weight: 700;
	}
	.media-badge .material-icons-round {
		font-size: 15px;
		color: var(--aero-sky, #2eb4ff);
	}

	.sample-card-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-top: 4px;
		border-top: 1px solid var(--border-subtle);
	}
	.sample-act-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		border-radius: 999px;
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.78rem;
		font-weight: 650;
		cursor: pointer;
		transition: all 0.15s var(--ease-spring);
	}
	.sample-act-btn:hover {
		background: var(--bg-surface-hover);
		color: var(--text-main);
		transform: scale(1.05);
	}
	.sample-act-btn .material-icons-round {
		font-size: 16px;
	}
	.sample-act-btn.active-like {
		color: var(--aero-rose, #ec4899);
	}
	.sample-act-btn.active-like .material-icons-round {
		color: var(--aero-rose, #ec4899);
	}
	.sample-act-btn.active-shared {
		color: var(--aero-mint, #00d4aa);
	}
	.sample-act-btn.active-shared .material-icons-round {
		color: var(--aero-mint, #00d4aa);
	}

	/* UI Strip */
	.sample-ui-strip {
		padding: 12px 14px;
		border-radius: var(--radius-md, 14px);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.strip-label {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 800;
		color: var(--text-muted);
	}
	.strip-buttons {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.sample-btn {
		padding: 7px 14px;
		font-size: 0.78rem;
		font-weight: 700;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.sample-btn .material-icons-round {
		font-size: 14px;
	}

	.stage-footer {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 10px 14px;
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		border-top: 1px solid var(--border-subtle);
		font-size: 0.72rem;
		color: var(--text-muted);
		line-height: 1.4;
	}
	.stage-footer .material-icons-round {
		font-size: 15px;
		color: var(--accent-blue-base, var(--aero-blue));
		flex-shrink: 0;
	}
</style>
