<script>
	/**
	 * SurfacePanel — control de superficies Frutiger Aero (pestaña «Aplicación»):
	 * opacidad de tarjetas (< 95% = cristal translúcido con el blur existente)
	 * y geometría de bordes (redefine --radius-* en toda la interfaz).
	 */
	import FancySlider from '$lib/components/ui/FancySlider.svelte';
	import {
		appearanceStore,
		BORDER_RADIUS_OPTIONS,
		CARD_OPACITY_MIN,
		CARD_OPACITY_MAX
	} from '$lib/stores/appearance.svelte.js';

	const OPACITY_PRESETS = [
		{ label: 'Sólido', value: 100, desc: '100% opaco' },
		{ label: 'Equilibrado', value: 85, desc: 'Recomendado' },
		{ label: 'Cristal', value: 65, desc: 'Translúcido' },
		{ label: 'Etéreo', value: 45, desc: 'Máximo aero' }
	];

	const RADIUS_HINTS = {
		sharp: 'Bordes rectos y modernos estilo Metro / Win11 nítido.',
		modern: 'Curvatura sutil y técnica para alta densidad (10px).',
		rounded: 'Curvatura equilibrada predeterminada de Voom! (20px).',
		bubble: 'Curvatura orgánica pronunciada estilo Frutiger Aero (28px).'
	};

	function stepOpacity(delta) {
		const current = appearanceStore.cardOpacity;
		const next = Math.min(CARD_OPACITY_MAX, Math.max(CARD_OPACITY_MIN, current + delta));
		appearanceStore.setCardOpacity(next);
	}
</script>

<div class="surface-panel">
	<!-- 02.1: Translucidez del cristal -->
	<div class="surface-block">
		<div class="subfield-header">
			<span class="subfield-title">Translucidez del cristal</span>
			<div class="opacity-value-wrap">
				<span class="prop-value">{appearanceStore.cardOpacity}%</span>
				{#if appearanceStore.cardOpacity !== 85}
					<button
						type="button"
						class="btn-reset-opacity"
						onclick={() => appearanceStore.setCardOpacity(85)}
						title="Restablecer nivel equilibrado recomendado (85%)"
					>
						<span class="material-icons-round">restart_alt</span>
						<span>85%</span>
					</button>
				{/if}
			</div>
		</div>

		<!-- Stepper fino [-] [ Slider ] [+] -->
		<div class="opacity-stepper-row">
			<button
				type="button"
				class="stepper-btn"
				onclick={() => stepOpacity(-5)}
				disabled={appearanceStore.cardOpacity <= CARD_OPACITY_MIN}
				title="Aumentar transparencia (-5% opacidad)"
				aria-label="Aumentar transparencia"
			>
				<span class="material-icons-round">remove</span>
			</button>

			<div class="slider-fill-wrap">
				<FancySlider
					id="card-opacity"
					min={CARD_OPACITY_MIN}
					max={CARD_OPACITY_MAX}
					step={5}
					bind:value={appearanceStore.cardOpacity}
					label="Opacidad de las tarjetas y paneles de la aplicación"
				/>
			</div>

			<button
				type="button"
				class="stepper-btn"
				onclick={() => stepOpacity(5)}
				disabled={appearanceStore.cardOpacity >= CARD_OPACITY_MAX}
				title="Reducir transparencia (+5% opacidad)"
				aria-label="Reducir transparencia"
			>
				<span class="material-icons-round">add</span>
			</button>
		</div>

		<!-- Chips de acceso rápido -->
		<div class="opacity-chips-row" role="group" aria-label="Niveles predefinidos de opacidad">
			{#each OPACITY_PRESETS as preset (preset.value)}
				{@const isActive = appearanceStore.cardOpacity === preset.value}
				<button
					type="button"
					class="opacity-chip"
					class:active={isActive}
					onclick={() => appearanceStore.setCardOpacity(preset.value)}
				>
					{#if isActive}
						<span class="material-icons-round chip-check" aria-hidden="true">check</span>
					{/if}
					<span class="chip-name">{preset.label}</span>
					<span class="chip-pct">{preset.value}%</span>
				</button>
			{/each}
		</div>

		<p class="hint">
			{#if appearanceStore.cardOpacity >= 95}
				Sólido estándar. Baja del 95% para ver el fondo o wallpaper a través de las tarjetas.
			{:else}
				Cristal translúcido activo: el fondo se transparenta con desenfoque suave tipo líquido.
			{/if}
		</p>
	</div>

	<!-- 02.2: Geometría de bordes -->
	<div class="surface-block">
		<div class="subfield-header">
			<span class="subfield-title">Geometría de bordes</span>
			<span class="prop-value">{appearanceStore.borderRadius}</span>
		</div>
		<div class="radius-row" role="group" aria-label="Geometría de bordes">
			{#each BORDER_RADIUS_OPTIONS as r (r.id)}
				{@const isSel = appearanceStore.borderRadius === r.id}
				<button
					type="button"
					class="radius-card-btn"
					class:active={isSel}
					onclick={() => appearanceStore.setBorderRadius(r.id)}
					title="{r.name}: {r.desc}"
				>
					<span class="radius-mini-preview preview-{r.id}" aria-hidden="true"></span>
					<span class="radius-btn-label">
						<span class="material-icons-round radius-icon">{r.icon}</span>
						<span>{r.name}</span>
					</span>
				</button>
			{/each}
		</div>
		<p class="hint">
			{RADIUS_HINTS[appearanceStore.borderRadius] ||
				'Define la curvatura en tarjetas, botones y cajas de diálogo.'}
		</p>
	</div>

	<!-- 02.3: Brillo especular de cristal (Aero Gloss) -->
	<div class="surface-block">
		<div class="subfield-header">
			<span class="subfield-title">Brillo especular de cristal (Aero Gloss)</span>
			<span class="gloss-status-pill" class:active={appearanceStore.aeroGloss}>
				<span class="material-icons-round gloss-pill-icon">
					{appearanceStore.aeroGloss ? 'auto_awesome' : 'blur_off'}
				</span>
				<span>{appearanceStore.aeroGloss ? 'Activo' : 'Desactivado'}</span>
			</span>
		</div>

		<div class="gloss-toggle-card">
			<div class="gloss-info">
				<span
					class="material-icons-round gloss-main-icon"
					class:active={appearanceStore.aeroGloss}
					aria-hidden="true"
				>
					flare
				</span>
				<div class="gloss-text-col">
					<span class="gloss-label">Reflejo y bisel de luz superior</span>
					<span class="gloss-desc">
						Firma visual Aero: resalta los bordes superiores con refracción especular 3D.
					</span>
				</div>
			</div>

			<button
				type="button"
				role="switch"
				aria-checked={appearanceStore.aeroGloss}
				class="aero-switch-btn"
				class:checked={appearanceStore.aeroGloss}
				onclick={() => appearanceStore.setAeroGloss(!appearanceStore.aeroGloss)}
				title={appearanceStore.aeroGloss
					? 'Desactivar brillo especular Aero'
					: 'Activar brillo especular Aero'}
				aria-label="Alternar brillo especular Aero"
			>
				<span class="switch-thumb">
					<span class="material-icons-round switch-thumb-icon" aria-hidden="true">
						{appearanceStore.aeroGloss ? 'check' : 'close'}
					</span>
				</span>
			</button>
		</div>

		<p class="hint">
			{appearanceStore.aeroGloss
				? 'Efecto activo: amplifica el bisel de luz y reflejo especular en todas las tarjetas de cristal.'
				: 'Efecto desactivado: superficies translúcidas limpias sin reflejo especular en el borde superior.'}
		</p>
	</div>
</div>

<style>
	.surface-panel {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.surface-block {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
	}
	.subfield-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.subfield-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-main);
	}
	.opacity-value-wrap {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.prop-value {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		padding: 2px 7px;
		border-radius: 6px;
		border: 1px solid var(--border-subtle);
	}
	.btn-reset-opacity {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.05));
		color: var(--text-muted);
		font-size: 0.72rem;
		font-family: var(--font-mono);
		padding: 2px 7px;
		border-radius: 999px;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.btn-reset-opacity:hover {
		color: var(--accent-blue-light, #2eb4ff);
		border-color: var(--accent-blue-base, #1b85f3);
	}
	.btn-reset-opacity .material-icons-round {
		font-size: 13px;
	}

	.opacity-stepper-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
	}
	.stepper-btn {
		flex: 0 0 34px;
		width: 34px;
		height: 34px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s var(--ease-spring);
	}
	.stepper-btn:hover:not(:disabled) {
		color: var(--text-main);
		border-color: var(--accent-blue-base, #1b85f3);
		transform: scale(1.08);
	}
	.stepper-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.stepper-btn .material-icons-round {
		font-size: 16px;
	}
	.slider-fill-wrap {
		flex: 1 1 0%;
		min-width: 0;
	}

	.opacity-chips-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}
	.opacity-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 7px 6px;
		border-radius: var(--radius-sm, 10px);
		border: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface) 80%, transparent);
		color: var(--text-secondary);
		font-size: 0.74rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.18s var(--ease-spring);
	}
	.opacity-chip:hover:not(.active) {
		color: var(--text-main);
		border-color: color-mix(in srgb, var(--accent-blue-base, #1b85f3) 50%, transparent);
		transform: translateY(-1px);
	}
	.opacity-chip.active {
		border-color: var(--accent-blue-base, #1b85f3);
		background: color-mix(in srgb, var(--accent-blue-base, #1b85f3) 14%, var(--bg-surface));
		color: var(--text-main);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--accent-blue-base, #1b85f3) 25%, transparent);
		font-weight: 750;
	}
	.chip-check {
		font-size: 13px;
		color: var(--accent-blue-base, #1b85f3);
	}
	.chip-pct {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--text-muted);
	}

	.hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	/* Geometría de bordes */
	.radius-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}
	.radius-card-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 10px 6px;
		border-radius: var(--radius-sm, 10px);
		border: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface) 80%, transparent);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.18s var(--ease-spring);
	}
	.radius-card-btn:hover:not(.active) {
		color: var(--text-main);
		border-color: color-mix(in srgb, var(--accent-blue-base, #1b85f3) 50%, transparent);
		transform: translateY(-1px);
	}
	.radius-card-btn.active {
		border-color: var(--accent-blue-base, #1b85f3);
		background: color-mix(in srgb, var(--accent-blue-base, #1b85f3) 14%, var(--bg-surface));
		color: var(--text-main);
		box-shadow: 0 2px 10px color-mix(in srgb, var(--accent-blue-base, #1b85f3) 25%, transparent);
		font-weight: 750;
	}
	.radius-mini-preview {
		width: 24px;
		height: 18px;
		border: 2px solid currentColor;
		opacity: 0.7;
	}
	.preview-sharp {
		border-radius: 2px;
	}
	.preview-modern {
		border-radius: 5px;
	}
	.preview-rounded {
		border-radius: 9px;
	}
	.preview-bubble {
		border-radius: 12px;
	}
	.radius-card-btn.active .radius-mini-preview {
		opacity: 1;
		border-color: var(--accent-blue-base, #1b85f3);
	}
	.radius-btn-label {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 0.74rem;
	}
	.radius-icon {
		font-size: 14px;
	}

	/* 02.3 Aero Gloss */
	.gloss-status-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 999px;
		border: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		color: var(--text-muted);
		transition: all 0.2s ease;
	}
	.gloss-status-pill.active {
		color: var(--aero-mint, #00d4aa);
		border-color: color-mix(in srgb, var(--aero-mint, #00d4aa) 40%, transparent);
		background: color-mix(in srgb, var(--aero-mint, #00d4aa) 10%, transparent);
		box-shadow: 0 0 8px color-mix(in srgb, var(--aero-mint, #00d4aa) 20%, transparent);
	}
	.gloss-pill-icon {
		font-size: 13px;
	}

	.gloss-toggle-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		border-radius: var(--radius-md, 14px);
		border: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface) 80%, transparent);
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.gloss-toggle-card:hover {
		border-color: color-mix(in srgb, var(--accent-blue-base, #1b85f3) 40%, transparent);
	}

	.gloss-info {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		flex: 1;
	}
	.gloss-main-icon {
		font-size: 22px;
		color: var(--text-muted);
		transition:
			color 0.2s var(--ease-spring),
			transform 0.2s var(--ease-spring);
	}
	.gloss-main-icon.active {
		color: var(--accent-blue-base, #1b85f3);
		transform: rotate(15deg) scale(1.1);
		filter: drop-shadow(
			0 0 6px color-mix(in srgb, var(--accent-blue-base, #1b85f3) 60%, transparent)
		);
	}

	.gloss-text-col {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.gloss-label {
		font-size: 0.82rem;
		font-weight: 750;
		color: var(--text-main);
	}
	.gloss-desc {
		font-size: 0.72rem;
		color: var(--text-muted);
		line-height: 1.35;
	}

	/* Aero Switch Button */
	.aero-switch-btn {
		position: relative;
		width: 48px;
		height: 28px;
		border-radius: 999px;
		border: 1px solid var(--border-subtle);
		background: var(--bg-input, rgba(0, 0, 0, 0.2));
		cursor: pointer;
		padding: 2px;
		flex-shrink: 0;
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		outline: none;
	}
	.aero-switch-btn:focus-visible {
		box-shadow: 0 0 0 2px var(--accent-blue-base, #1b85f3);
	}
	.aero-switch-btn.checked {
		background: linear-gradient(
			135deg,
			var(--accent-blue-base, #1b85f3),
			var(--accent-blue-light, #2eb4ff)
		);
		border-color: color-mix(in srgb, var(--accent-blue-base, #1b85f3) 50%, white);
		box-shadow: 0 2px 10px color-mix(in srgb, var(--accent-blue-base, #1b85f3) 40%, transparent);
	}

	.switch-thumb {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #ffffff;
		color: #64748b;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
		transform: translateX(0);
		transition:
			transform 0.2s var(--ease-spring),
			color 0.2s ease;
	}
	.aero-switch-btn.checked .switch-thumb {
		transform: translateX(20px);
		color: var(--accent-blue-base, #1b85f3);
	}
	.switch-thumb-icon {
		font-size: 13px;
		font-weight: 700;
	}
</style>
