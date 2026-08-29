<script>
	/**
	 * TypographyDensityPanel — escala tipográfica global, fuente de la app y
	 * densidad de la interfaz (pestaña «Aplicación» de /settings/design).
	 * Todo escribe directo en el appearance store (aplicación en vivo +
	 * autosave debouncado). La fuente «custom» reutiliza la subida al perfil:
	 * si el perfil no tiene ninguna, la opción queda deshabilitada con hint.
	 */
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import {
		appearanceStore,
		APP_FONT_OPTIONS,
		DENSITY_OPTIONS,
		FONT_SCALE_MIN,
		FONT_SCALE_MAX
	} from '$lib/stores/appearance.svelte.js';

	let { onGoToProfileTab } = $props();

	const SCALE_PRESETS = [
		{ label: 'Compacto', value: 0.9, pct: '90%' },
		{ label: 'Normal', value: 1.0, pct: '100%' },
		{ label: 'Medio', value: 1.1, pct: '110%' },
		{ label: 'Grande', value: 1.2, pct: '120%' }
	];

	function stepScale(delta) {
		const current = appearanceStore.fontScale;
		const next =
			Math.round(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, current + delta)) * 100) / 100;
		appearanceStore.setFontScale(next);
	}

	let hasCustomFont = $derived(
		!!(appearanceStore.customFontFamily && appearanceStore.customFontUrl)
	);

	let fontOptions = $derived(
		APP_FONT_OPTIONS.map((f) => ({
			value: f.id,
			label: f.name,
			desc:
				f.id === 'custom'
					? hasCustomFont
						? f.desc
						: 'Sube una fuente en la pestaña Perfil'
					: f.desc,
			disabled: f.id === 'custom' && !hasCustomFont
		}))
	);

	const scalePct = $derived(Math.round(appearanceStore.fontScale * 100));
</script>

<div class="typo-density">
	<div class="typo-group-head">
		<h3 class="props-title"><span class="sec-num">03</span> Tipografía y Densidad</h3>
	</div>

	<!-- 03.1: Escala Tipográfica -->
	<section class="props-section section-scale">
		<div class="prop-row-header">
			<h4 class="props-subtitle">Escala del texto</h4>
			<div class="scale-indicators">
				<span class="prop-value">{scalePct}%</span>
				{#if Math.abs(appearanceStore.fontScale - 1) > 0.01}
					<button
						type="button"
						class="btn-reset-scale"
						onclick={() => appearanceStore.setFontScale(1)}
						title="Restablecer tamaño normal (100%)"
					>
						<span class="material-icons-round">restart_alt</span>
						<span>100%</span>
					</button>
				{/if}
			</div>
		</div>

		<!-- Control de ajuste fino: Botones paso a paso + Slider continuo -->
		<div class="scale-stepper-row">
			<button
				type="button"
				class="scale-step-btn"
				onclick={() => stepScale(-0.05)}
				disabled={appearanceStore.fontScale <= FONT_SCALE_MIN}
				title="Reducir tamaño del texto (-5%)"
				aria-label="Reducir tamaño del texto"
			>
				<span class="material-icons-round">remove</span>
			</button>

			<div class="scale-slider-track-wrap">
				<input
					id="font-scale-slider"
					name="font-scale-slider"
					type="range"
					class="aero-range-slider"
					min={FONT_SCALE_MIN}
					max={FONT_SCALE_MAX}
					step="0.05"
					value={appearanceStore.fontScale}
					oninput={(e) => appearanceStore.setFontScale(Number(e.target.value))}
					aria-label="Escala del texto de la aplicación"
				/>
				<div class="scale-ticks" aria-hidden="true">
					<span class="tick" style="left: 0%;"></span>
					<span class="tick tick-center" style="left: 37.5%;"></span>
					<span class="tick" style="left: 100%;"></span>
				</div>
			</div>

			<button
				type="button"
				class="scale-step-btn"
				onclick={() => stepScale(0.05)}
				disabled={appearanceStore.fontScale >= FONT_SCALE_MAX}
				title="Aumentar tamaño del texto (+5%)"
				aria-label="Aumentar tamaño del texto"
			>
				<span class="material-icons-round">add</span>
			</button>
		</div>

		<!-- Presets rápidos para selección instantánea con un clic -->
		<div class="scale-presets-row" role="group" aria-label="Niveles predefinidos de escala">
			{#each SCALE_PRESETS as preset (preset.value)}
				{@const isActive = Math.abs(appearanceStore.fontScale - preset.value) < 0.02}
				<button
					type="button"
					class="scale-preset-chip"
					class:active={isActive}
					onclick={() => appearanceStore.setFontScale(preset.value)}
				>
					{#if isActive}
						<span class="material-icons-round chip-check" aria-hidden="true">check</span>
					{/if}
					<span>{preset.label}</span>
					<span class="preset-pct">{preset.pct}</span>
				</button>
			{/each}
		</div>

		<!-- Caja de muestra en vivo -->
		<div
			class="sample-box glass-panel"
			style="font-size: calc(1rem * {appearanceStore.fontScale});"
		>
			<div class="sample-chars" aria-hidden="true">Aa Bb Gg 123 &amp; @ #</div>
			<p class="sample-text">
				Así se leerán tus publicaciones, comentarios y menús con la escala seleccionada.
			</p>
		</div>
	</section>

	<!-- 03.2: Tipografía de la interfaz (Elevación z-index prioritaria) -->
	<section class="props-section section-font">
		<h4 class="props-subtitle">Tipografía de la interfaz</h4>
		<CustomSelect
			id="app-font-select"
			options={fontOptions}
			value={appearanceStore.appFont}
			onchange={(v) => appearanceStore.setAppFont(v)}
		/>
		{#if !hasCustomFont}
			<p class="hint">
				¿Quieres usar tu propia tipografía en toda la app? Súbela en la pestaña
				<button type="button" class="link-btn" onclick={() => onGoToProfileTab?.()}>Perfil</button>
				y aparecerá aquí como «Mi fuente».
			</p>
		{/if}
	</section>

	<!-- 03.3: Densidad de la interfaz -->
	<section class="props-section section-density">
		<h4 class="props-subtitle">Densidad de la interfaz</h4>
		<div class="density-row" role="group" aria-label="Densidad de la interfaz">
			{#each DENSITY_OPTIONS as d (d.id)}
				<button
					type="button"
					class="seg-btn"
					class:active={appearanceStore.density === d.id}
					onclick={() => appearanceStore.setDensity(d.id)}
				>
					<span class="material-icons-round seg-icon">{d.icon}</span>
					<span class="seg-name">{d.name}</span>
				</button>
			{/each}
		</div>
		<p class="hint">
			{appearanceStore.density === 'compact'
				? 'Compacta: mayor densidad de datos y menos espaciado vertical.'
				: appearanceStore.density === 'roomy'
					? 'Amplia: mayor respiración, ideal para lectura descansada y pantallas grandes.'
					: 'Cómoda: el equilibrio predeterminado recomendado para Voom!.'}
		</p>
	</section>
</div>

<style>
	.typo-density {
		display: flex;
		flex-direction: column;
		gap: 26px;
		position: relative;
		z-index: 50;
	}

	.props-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	/* Capas de apilamiento para evitar que menús desplegables se tapen */
	.section-scale {
		position: relative;
		z-index: 10;
	}
	.section-font {
		position: relative;
		z-index: 60;
	}
	.section-density {
		position: relative;
		z-index: 5;
	}

	.props-subtitle {
		margin: 0;
		font-size: 0.84rem;
		font-weight: 750;
		color: var(--text-main);
	}

	.prop-row-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 0;
	}

	.props-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.76rem;
		text-transform: uppercase;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin: 0;
	}

	.sec-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 18px;
		padding: 0 5px;
		border-radius: 6px;
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: white;
		background: linear-gradient(
			135deg,
			var(--accent-blue-base, var(--aero-blue)),
			var(--accent-blue-light, var(--aero-sky))
		);
		box-shadow: 0 2px 6px
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 35%, transparent);
	}

	.scale-indicators {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.prop-value {
		font-family: var(--font-mono, monospace);
		font-size: 0.82rem;
		color: var(--accent-blue-base, var(--aero-blue));
		font-weight: 800;
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 10%, transparent);
		padding: 2px 8px;
		border-radius: 6px;
		border: 1px solid color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 25%, transparent);
	}

	.btn-reset-scale {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 7px;
		border-radius: 6px;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.btn-reset-scale:hover {
		color: var(--text-main);
		border-color: var(--accent-blue-base, var(--aero-blue));
		background: var(--bg-surface-hover);
	}
	.btn-reset-scale .material-icons-round {
		font-size: 13px;
	}

	/* ── Stepper row ── */
	.scale-stepper-row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
	}

	.scale-step-btn {
		flex: 0 0 34px;
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-main);
		cursor: pointer;
		transition: all 0.15s var(--ease-spring);
	}
	.scale-step-btn:hover:not(:disabled) {
		transform: scale(1.1);
		border-color: var(--accent-blue-base, var(--aero-blue));
		color: var(--accent-blue-base, var(--aero-blue));
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}
	.scale-step-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.scale-step-btn .material-icons-round {
		font-size: 18px;
	}

	.scale-slider-track-wrap {
		flex: 1;
		position: relative;
		display: flex;
		align-items: center;
		height: 34px;
	}

	/* Slider nativo range con estilo Aero */
	.aero-range-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-main) 14%, transparent);
		outline: none;
		cursor: pointer;
		position: relative;
		z-index: 2;
		transition: background 0.15s ease;
	}
	.aero-range-slider:focus-visible {
		box-shadow: 0 0 0 3px
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 40%, transparent);
	}

	/* Webkit Thumb */
	.aero-range-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #ffffff;
		border: 2.5px solid var(--accent-blue-base, var(--aero-blue));
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.3),
			0 0 10px color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 50%, transparent);
		cursor: pointer;
		transition:
			transform 0.12s var(--ease-spring),
			box-shadow 0.15s ease;
	}
	.aero-range-slider::-webkit-slider-thumb:hover {
		transform: scale(1.2);
		box-shadow:
			0 3px 12px rgba(0, 0, 0, 0.4),
			0 0 16px color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 70%, transparent);
	}
	.aero-range-slider:active::-webkit-slider-thumb {
		transform: scale(0.95);
	}

	/* Firefox Thumb */
	.aero-range-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #ffffff;
		border: 2.5px solid var(--accent-blue-base, var(--aero-blue));
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		cursor: pointer;
	}

	.scale-ticks {
		position: absolute;
		left: 10px;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
		z-index: 1;
	}
	.scale-ticks .tick {
		position: absolute;
		width: 2px;
		height: 6px;
		background: color-mix(in srgb, var(--text-main) 30%, transparent);
		border-radius: 1px;
		transform: translate(-50%, -50%);
	}
	.scale-ticks .tick-center {
		height: 10px;
		background: var(--accent-blue-base, var(--aero-blue));
		opacity: 0.8;
	}

	/* ── Preset Chips ── */
	.scale-presets-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}

	.scale-preset-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 7px 4px;
		border-radius: var(--radius-sm, 10px);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-secondary);
		font-size: 0.74rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s var(--ease-spring);
		position: relative;
	}
	.scale-preset-chip:hover:not(.active) {
		color: var(--text-main);
		border-color: var(--accent-blue-base, var(--aero-blue));
		background: var(--bg-surface-hover);
		transform: translateY(-1px);
	}
	.scale-preset-chip.active {
		background: color-mix(
			in srgb,
			var(--accent-blue-base, var(--aero-blue)) 14%,
			var(--bg-surface)
		);
		border-color: var(--accent-blue-base, var(--aero-blue));
		color: var(--accent-blue-base, var(--aero-blue));
		box-shadow: 0 0 0 1.5px var(--accent-blue-base, var(--aero-blue));
		font-weight: 800;
	}
	.scale-preset-chip .preset-pct {
		font-size: 0.64rem;
		opacity: 0.75;
		font-family: var(--font-mono, monospace);
	}
	.chip-check {
		position: absolute;
		top: 2px;
		right: 3px;
		font-size: 11px;
		color: var(--accent-blue-base, var(--aero-blue));
	}

	/* Caja de muestra tipográfica */
	.sample-box {
		padding: 14px 16px;
		border-radius: var(--radius-md, 14px);
		border: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface) 75%, transparent);
		backdrop-filter: var(--glass-blur, blur(14px));
		display: flex;
		flex-direction: column;
		gap: 6px;
		transition: font-size 0.2s ease;
	}

	.sample-chars {
		font-family: var(--font-display, inherit);
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--accent-blue-base, var(--aero-blue));
		opacity: 0.9;
		line-height: 1.2;
	}

	.sample-text {
		margin: 0;
		line-height: 1.5;
		color: var(--text-main);
		font-size: 0.88em;
	}

	.hint {
		margin: 2px 0 0;
		font-size: 0.76rem;
		color: var(--text-muted);
		line-height: 1.45;
	}

	.link-btn {
		background: transparent;
		border: none;
		padding: 0;
		color: var(--accent-blue-base, var(--aero-blue));
		font-weight: 700;
		font-size: inherit;
		text-decoration: underline;
		cursor: pointer;
		display: inline;
		transition: color 0.15s ease;
	}
	.link-btn:hover {
		color: var(--accent-blue-light, var(--aero-sky));
	}

	/* Fila de botones segmentados para la densidad */
	.density-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
		padding: 4px;
		background: var(--bg-input, rgba(0, 0, 0, 0.12));
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md, 14px);
	}

	.seg-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		padding: 8px 12px;
		border-radius: var(--radius-sm, 10px);
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.18s var(--ease-spring);
		white-space: nowrap;
	}

	.seg-btn:hover:not(.active) {
		color: var(--text-main);
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.05));
	}

	.seg-btn.active {
		background: linear-gradient(
			135deg,
			var(--accent-blue-base, var(--aero-blue)),
			var(--accent-blue-light, var(--aero-sky))
		);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.25);
		box-shadow:
			0 4px 14px color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 40%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.35);
		transform: translateY(-1px);
	}

	.seg-icon {
		font-size: 17px;
	}

	@media (max-width: 480px) {
		.scale-presets-row {
			grid-template-columns: repeat(2, 1fr);
		}
		.seg-btn {
			padding: 7px 8px;
			font-size: 0.75rem;
			gap: 4px;
		}
		.seg-icon {
			font-size: 15px;
		}
	}
</style>
