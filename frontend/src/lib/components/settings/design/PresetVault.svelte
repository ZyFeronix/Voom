<script>
	/**
	 * PresetVault — bóveda de presets Frutiger Aero de 1 clic (pestaña
	 * «Aplicación» de /settings/design). Cada tarjeta aplica en lote acento,
	 * geometría, opacidad de cristal, gloss, fuente, densidad y MODO de
	 * wallpaper vía appearanceStore.applyPreset (1 solo PUT debouncado). Los
	 * controles inferiores se sincronizan solos porque leen del store.
	 */
	import { appearanceStore, APP_PRESETS } from '$lib/stores/appearance.svelte.js';

	const RADIUS_SAMPLE = {
		sharp: '2px',
		modern: '8px',
		rounded: '14px',
		bubble: '20px'
	};

	const RADIUS_LABELS = {
		sharp: '90° Sharp',
		modern: '8px Suave',
		rounded: '14px Aero',
		bubble: '20px Bubble'
	};
</script>

<div class="preset-vault" role="group" aria-label="Presets estéticos Frutiger Aero">
	{#each APP_PRESETS as preset (preset.id)}
		{@const active = appearanceStore.activePreset === preset.id}
		<button
			type="button"
			class="preset-card"
			class:active
			style="--preset-accent: {preset.accentColor};"
			onclick={() => appearanceStore.applyPreset(preset.id)}
			title="{preset.name} — {preset.desc}"
		>
			<div class="preset-preview-wrap">
				<span
					class="preset-preview"
					class:no-gloss={preset.aeroGloss === false}
					style="
						border-radius: {RADIUS_SAMPLE[preset.borderRadius] || '12px'};
						--preview-accent: {preset.accentColor};
					"
				>
					<span class="gloss-reflection" aria-hidden="true"></span>
					<span class="material-icons-round preview-icon" aria-hidden="true">{preset.icon}</span>
					<span class="preview-glow" aria-hidden="true"></span>
				</span>

				{#if active}
					<span class="active-badge" aria-label="Preset activo">
						<span class="material-icons-round">check</span>
					</span>
				{/if}
			</div>

			<div class="preset-info">
				<span class="preset-name">
					{preset.name}
				</span>
				<span class="preset-desc truncate" title={preset.desc}>{preset.desc}</span>
			</div>

			<div class="preset-pill-tag">
				<span class="pill-dot" aria-hidden="true"></span>
				<span>{RADIUS_LABELS[preset.borderRadius] || preset.borderRadius}</span>
			</div>
		</button>
	{/each}
</div>

<style>
	.preset-vault {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(124px, 1fr);
		gap: 12px;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		padding: 12px 6px 16px 6px;
		margin: -8px -6px 0 -6px;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--accent-blue-base, #1b85f3) 40%, transparent)
			transparent;
	}

	.preset-vault::-webkit-scrollbar {
		height: 6px;
	}
	.preset-vault::-webkit-scrollbar-track {
		background: transparent;
	}
	.preset-vault::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, var(--accent-blue-base, #1b85f3) 30%, transparent);
		border-radius: 999px;
	}
	.preset-vault::-webkit-scrollbar-thumb:hover {
		background: var(--accent-blue-base, #1b85f3);
	}

	.preset-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 14px 10px 12px;
		border-radius: var(--radius-lg, 18px);
		border: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface) 75%, transparent);
		backdrop-filter: var(--glass-blur, blur(14px) saturate(1.2));
		-webkit-backdrop-filter: var(--glass-blur, blur(14px) saturate(1.2));
		color: var(--text-main);
		cursor: pointer;
		text-align: center;
		scroll-snap-align: start;
		overflow: hidden;
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.04),
			inset 0 1px 1px rgba(255, 255, 255, 0.45);
		transition:
			transform 0.26s cubic-bezier(0.34, 1.56, 0.64, 1),
			border-color 0.2s ease,
			box-shadow 0.22s ease,
			background 0.2s ease;
		will-change: transform, box-shadow;
	}

	/* Sheen especular en diagonal al hacer hover */
	.preset-card::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			115deg,
			transparent 20%,
			rgba(255, 255, 255, 0.32) 50%,
			transparent 80%
		);
		transform: translateX(-120%);
		transition: transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
		pointer-events: none;
		z-index: 2;
	}

	.preset-card:hover {
		transform: translateY(-3px) scale(1.02);
		border-color: color-mix(
			in srgb,
			var(--preset-accent, var(--accent-blue-base)) 60%,
			var(--border-subtle)
		);
		box-shadow:
			0 8px 22px color-mix(in srgb, var(--preset-accent, var(--accent-blue-base)) 24%, transparent),
			0 2px 6px rgba(0, 0, 0, 0.06),
			inset 0 1px 2px rgba(255, 255, 255, 0.7);
		background: color-mix(
			in srgb,
			var(--preset-accent, var(--accent-blue-base)) 7%,
			var(--bg-surface)
		);
	}

	.preset-card:hover::before {
		transform: translateX(120%);
	}

	.preset-card:active {
		transform: translateY(-1px) scale(0.96);
		transition-duration: 0.12s;
	}

	.preset-card.active {
		border-color: var(--preset-accent, var(--accent-blue-base));
		background: color-mix(
			in srgb,
			var(--preset-accent, var(--accent-blue-base)) 14%,
			var(--bg-surface)
		);
		box-shadow:
			0 0 0 1.5px var(--preset-accent, var(--accent-blue-base)),
			0 8px 26px color-mix(in srgb, var(--preset-accent, var(--accent-blue-base)) 36%, transparent),
			inset 0 1px 2px rgba(255, 255, 255, 0.65);
	}

	.preset-preview-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 2px;
	}

	/* Miniatura tipo Gel Button / Vista Orb 3D */
	.preset-preview {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 38px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.45);
		background:
			linear-gradient(
				180deg,
				rgba(255, 255, 255, 0.25) 0%,
				rgba(255, 255, 255, 0.05) 50%,
				transparent 100%
			),
			linear-gradient(
				145deg,
				var(--preview-accent, #0ea5e9),
				color-mix(in srgb, var(--preview-accent, #0ea5e9) 45%, #031525)
			);
		box-shadow:
			0 4px 14px color-mix(in srgb, var(--preview-accent, #0ea5e9) 42%, transparent),
			inset 0 1px 2px rgba(255, 255, 255, 0.85),
			inset 0 -2px 5px rgba(0, 0, 0, 0.3);
		transition:
			transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
			box-shadow 0.3s ease;
	}

	.preset-card:hover .preset-preview {
		transform: scale(1.08) translateY(-1px);
		box-shadow:
			0 6px 18px color-mix(in srgb, var(--preview-accent, #0ea5e9) 55%, transparent),
			inset 0 1px 2px rgba(255, 255, 255, 0.95),
			inset 0 -2px 5px rgba(0, 0, 0, 0.35);
	}

	/* Domo reflectivo curvo superior de cristal */
	.gloss-reflection {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 52%;
		background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.78) 0%,
			rgba(255, 255, 255, 0.22) 80%,
			rgba(255, 255, 255, 0) 100%
		);
		border-radius: inherit;
		border-bottom-left-radius: 50% 4px;
		border-bottom-right-radius: 50% 4px;
		pointer-events: none;
		z-index: 2;
	}

	/* Resplandor bioluminiscente inferior */
	.preview-glow {
		position: absolute;
		bottom: -2px;
		left: 15%;
		right: 15%;
		height: 10px;
		background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.6) 0%, transparent 70%);
		pointer-events: none;
		z-index: 1;
	}

	.preset-preview.no-gloss .gloss-reflection {
		display: none;
	}

	.preview-icon {
		color: #ffffff;
		font-size: 20px;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45));
		z-index: 3;
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.preset-card:hover .preview-icon {
		transform: scale(1.12);
	}

	/* Badge de estado activo con animación resorte (spring) */
	.active-badge {
		position: absolute;
		top: -5px;
		right: -6px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: linear-gradient(135deg, #00d4aa 0%, #00b894 100%);
		color: #03241d;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--bg-surface-solid, #ffffff);
		box-shadow:
			0 2px 8px rgba(0, 212, 170, 0.5),
			inset 0 1px 1px rgba(255, 255, 255, 0.7);
		z-index: 5;
		animation: badgePop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	.active-badge .material-icons-round {
		font-size: 13px;
		font-weight: 900;
	}

	@keyframes badgePop {
		0% {
			transform: scale(0) rotate(-25deg);
			opacity: 0;
		}
		70% {
			transform: scale(1.25) rotate(6deg);
		}
		100% {
			transform: scale(1) rotate(0deg);
			opacity: 1;
		}
	}

	.preset-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		min-width: 0;
	}

	.preset-name {
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--text-main);
		letter-spacing: -0.01em;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.preset-desc {
		font-size: 0.68rem;
		color: var(--text-secondary);
		opacity: 0.85;
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.preset-pill-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.62rem;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--preset-accent, var(--accent-blue-base)) 10%, transparent);
		color: color-mix(in srgb, var(--preset-accent, var(--accent-blue-base)) 85%, var(--text-main));
		border: 1px solid
			color-mix(in srgb, var(--preset-accent, var(--accent-blue-base)) 24%, transparent);
		margin-top: 2px;
		white-space: nowrap;
	}

	.pill-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--preset-accent, var(--accent-blue-base));
		box-shadow: 0 0 5px var(--preset-accent, var(--accent-blue-base));
	}

	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
