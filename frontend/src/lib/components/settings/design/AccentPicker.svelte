<script>
	/**
	 * AccentPicker — selector de color de acento GLOBAL (pestaña «Aplicación»).
	 * Escribe directo en el appearance store (aplicación en vivo + autosave
	 * debouncado). Incluye paleta derivada en vivo y badges de contraste WCAG:
	 *  · Botón: texto blanco (#fff) SOBRE el acento (umbral AA 4.5).
	 *  · Claro/Oscuro: acento usado como texto/enlace sobre fondos aproximados
	 *    de cada modo — avisa si el acento es ilegible como enlace en claro.
	 */
	import {
		appearanceStore,
		ACCENT_SWATCHES,
		deriveAccentPalette,
		contrastRatio
	} from '$lib/stores/appearance.svelte.js';

	const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

	let hexInput = $state(appearanceStore.accentColor);

	$effect(() => {
		hexInput = appearanceStore.accentColor;
	});

	let validAccent = $derived(
		hexInput.trim() !== '' && HEX_RE.test(hexInput.trim()) ? hexInput.trim().toLowerCase() : ''
	);
	let palette = $derived(validAccent ? deriveAccentPalette(validAccent) : null);

	// Contrastes del acento activo (el heredado también se evalúa para orientar).
	let evalAccent = $derived(validAccent || appearanceStore.accentColor || '');
	let btnWhite = $derived(evalAccent ? contrastRatio('#ffffff', evalAccent) : 0);
	let onLight = $derived(evalAccent ? contrastRatio(evalAccent, '#f2fafc') : 0);
	let onDark = $derived(evalAccent ? contrastRatio(evalAccent, '#08131f') : 0);

	function commitHex() {
		if (hexInput.trim() === '') {
			appearanceStore.setAccent('');
			return;
		}
		if (!appearanceStore.setAccent(hexInput)) hexInput = appearanceStore.accentColor;
	}

	function pickSwatch(color) {
		if (appearanceStore.setAccent(color)) hexInput = color;
	}
</script>

<div class="accent-picker">
	<div class="prop-col">
		<label class="prop-row" for="app-accent-hex">
			<span>Selector y código hexadecimal</span>
			<div class="accent-val-group">
				<span class="prop-value"
					>{validAccent || appearanceStore.accentColor || 'Predeterminado'}</span
				>
				{#if appearanceStore.accentColor && appearanceStore.accentColor.toLowerCase() !== '#1b85f3'}
					<button
						type="button"
						class="btn-reset-accent"
						onclick={() => {
							hexInput = '';
							appearanceStore.setAccent('');
						}}
						title="Restablecer color de acento predeterminado (#1b85f3)"
					>
						<span class="material-icons-round">restart_alt</span>
						<span>Reset</span>
					</button>
				{/if}
			</div>
		</label>

		<div class="hex-field">
			<label class="hex-chip-wrap" title="Haz clic para abrir el selector de color">
				<input
					type="color"
					class="native-color-picker"
					value={HEX_RE.test(hexInput) && hexInput.length === 7 ? hexInput : '#00d4aa'}
					oninput={(e) => {
						hexInput = e.target.value;
						appearanceStore.setAccent(hexInput);
					}}
				/>
				<span
					class="hex-chip"
					style="background: {HEX_RE.test(hexInput)
						? hexInput
						: 'var(--accent-blue-base, #1b85f3)'};"
					aria-hidden="true"
				>
					<span class="material-icons-round chip-icon" aria-hidden="true">colorize</span>
				</span>
			</label>

			<div class="hex-input-group">
				<span class="hex-prefix" aria-hidden="true">#</span>
				<input
					id="app-accent-hex"
					name="app-accent-hex"
					type="text"
					class="hex-input"
					placeholder="00d4aa"
					value={hexInput.startsWith('#') ? hexInput.slice(1) : hexInput}
					maxlength="6"
					spellcheck="false"
					oninput={(e) => {
						const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '');
						const val = raw ? '#' + raw : '';
						hexInput = val;
						if (raw.length === 6 || raw.length === 3) {
							appearanceStore.setAccent(val);
						}
					}}
					onchange={commitHex}
				/>
			</div>

			<button
				type="button"
				class="btn-icon reset-accent-btn"
				class:active={appearanceStore.accentColor === ''}
				onclick={() => {
					appearanceStore.setAccent('');
					hexInput = '';
				}}
				title="Restablecer al acento del tema"
				aria-label="Restablecer al acento del tema"
			>
				<span class="material-icons-round">restart_alt</span>
			</button>
		</div>
		<p class="hint">
			Define el color de botones, destellos, bordes y enlaces activos de toda la aplicación.
		</p>
	</div>

	<div class="swatches-grid" role="group" aria-label="Acentos predefinidos">
		{#each ACCENT_SWATCHES as color (color)}
			{@const isSelected = appearanceStore.accentColor.toLowerCase() === color.toLowerCase()}
			<button
				type="button"
				class="swatch-btn"
				class:selected={isSelected}
				style="--swatch-bg: {color};"
				onclick={() => pickSwatch(color)}
				title="Usar color {color}"
				aria-label="Usar color {color}"
			>
				{#if isSelected}
					<span class="material-icons-round check-mark" aria-hidden="true">check</span>
				{/if}
			</button>
		{/each}
	</div>

	{#if palette}
		<div class="prop-col derived-box glass-card">
			<span class="mini-label">Paleta derivada en tiempo real</span>
			<div class="palette-strip" aria-hidden="true">
				<span style="background: {palette.base};" title="Base"></span>
				<span style="background: {palette.light};" title="Claro"></span>
				<span style="background: {palette.bright};" title="Brillante"></span>
				<span style="background: {palette.mid};" title="Medio"></span>
				<span style="background: {palette.dark};" title="Profundo"></span>
			</div>
			<div class="grad-preview" style="background: {palette.gradient};">
				<span class="grad-label">Gradiente de botón Aero</span>
			</div>
		</div>
	{/if}

	{#if evalAccent}
		<div class="wcag-section" aria-label="Contraste de accesibilidad WCAG">
			<span class="mini-label">Accesibilidad y Contraste (WCAG)</span>
			<div class="wcag-row">
				<div
					class="wcag-pill"
					class:ok={btnWhite >= 4.5}
					class:warn={btnWhite < 4.5 && btnWhite >= 3}
					class:bad={btnWhite < 3}
					title="Contraste de texto blanco sobre el botón de acento. AA exige ≥ 4.5."
				>
					<span class="material-icons-round wcag-icon">
						{btnWhite >= 4.5 ? 'check_circle' : btnWhite >= 3 ? 'warning' : 'cancel'}
					</span>
					<span>Botón: {btnWhite.toFixed(1)}:1</span>
				</div>

				<div
					class="wcag-pill"
					class:ok={onLight >= 4.5}
					class:warn={onLight < 4.5 && onLight >= 3}
					class:bad={onLight < 3}
					title="Contraste del acento como enlace sobre fondos claros."
				>
					<span class="material-icons-round wcag-icon">
						{onLight >= 4.5 ? 'check_circle' : onLight >= 3 ? 'warning' : 'cancel'}
					</span>
					<span>Fondo claro: {onLight.toFixed(1)}:1</span>
				</div>

				<div
					class="wcag-pill"
					class:ok={onDark >= 4.5}
					class:warn={onDark < 4.5 && onDark >= 3}
					class:bad={onDark < 3}
					title="Contraste del acento como enlace sobre fondos oscuros."
				>
					<span class="material-icons-round wcag-icon">
						{onDark >= 4.5 ? 'check_circle' : onDark >= 3 ? 'warning' : 'cancel'}
					</span>
					<span>Fondo oscuro: {onDark.toFixed(1)}:1</span>
				</div>
			</div>

			{#if onLight < 3}
				<p class="field-error">
					<span class="material-icons-round">info</span>
					Este acento es muy claro sobre el tema claro. Los textos y enlaces podrían tener poco contraste.
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.accent-picker {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.prop-col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.prop-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.84rem;
		font-weight: 650;
		color: var(--text-main);
	}

	.accent-val-group {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.btn-reset-accent {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.05));
		color: var(--text-muted);
		font-size: 0.7rem;
		font-family: var(--font-mono);
		padding: 2px 7px;
		border-radius: 999px;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.btn-reset-accent:hover {
		color: var(--accent-blue-light, #2eb4ff);
		border-color: var(--accent-blue-base, #1b85f3);
	}
	.btn-reset-accent .material-icons-round {
		font-size: 13px;
	}

	.hex-field {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.hex-chip-wrap {
		position: relative;
		width: 44px;
		height: 38px;
		border-radius: var(--radius-sm, 10px);
		border: 1px solid var(--border-subtle);
		overflow: hidden;
		cursor: pointer;
		flex-shrink: 0;
		transition: transform 0.15s var(--ease-spring);
	}
	.hex-chip-wrap:hover {
		transform: scale(1.06);
		border-color: var(--accent-blue-base, var(--aero-blue));
	}

	.native-color-picker {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
		height: 100%;
		z-index: 2;
	}

	.hex-chip {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4);
	}

	.chip-icon {
		font-size: 16px;
		color: white;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
		opacity: 0.85;
		transition: transform 0.15s var(--ease-spring);
	}
	.hex-chip-wrap:hover .chip-icon {
		transform: scale(1.2);
		opacity: 1;
	}

	.hex-input-group {
		flex: 1;
		display: flex;
		align-items: center;
		background: var(--bg-input, rgba(0, 0, 0, 0.15));
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm, 10px);
		padding: 0 10px;
		transition: border-color 0.15s ease;
	}
	.hex-input-group:focus-within {
		border-color: var(--accent-blue-base, var(--aero-blue));
		box-shadow: 0 0 0 2px
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 25%, transparent);
	}

	.hex-prefix {
		font-family: var(--font-mono, monospace);
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-muted);
		margin-right: 2px;
	}

	.hex-input {
		flex: 1;
		min-width: 0;
		padding: 8px 0;
		background: transparent;
		border: none;
		color: var(--text-main);
		font-family: var(--font-mono, monospace);
		font-size: 0.88rem;
		font-weight: 600;
		outline: none;
	}

	.reset-accent-btn {
		width: 38px;
		height: 38px;
		border-radius: var(--radius-sm, 10px);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}
	.reset-accent-btn:hover {
		color: var(--accent-blue-base, var(--aero-blue));
		background: var(--bg-surface-hover);
		transform: scale(1.05);
	}
	.reset-accent-btn.active {
		color: var(--accent-blue-base, var(--aero-blue));
		border-color: var(--accent-blue-base, var(--aero-blue));
	}

	.hint {
		margin: 0;
		font-size: 0.76rem;
		color: var(--text-muted);
		line-height: 1.45;
	}

	.mini-label {
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 800;
		font-size: 0.68rem;
		color: var(--text-muted);
	}

	/* Swatches Grid */
	.swatches-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 8px;
	}

	.swatch-btn {
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--swatch-bg);
		border: 2px solid transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			transform 0.18s var(--ease-spring),
			border-color 0.15s ease,
			box-shadow 0.18s ease;
		box-shadow:
			0 2px 8px color-mix(in srgb, var(--swatch-bg) 35%, transparent),
			inset 0 1px 1px rgba(255, 255, 255, 0.4);
		position: relative;
	}
	.swatch-btn:hover {
		transform: scale(1.18);
		box-shadow: 0 4px 14px color-mix(in srgb, var(--swatch-bg) 50%, transparent);
	}
	.swatch-btn.selected {
		border-color: #ffffff;
		transform: scale(1.12);
		box-shadow:
			0 0 0 2px var(--swatch-bg),
			0 4px 16px color-mix(in srgb, var(--swatch-bg) 60%, transparent);
	}

	.check-mark {
		font-size: 16px;
		color: white;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
	}

	/* Paleta derivada */
	.derived-box {
		padding: 12px 14px;
		border-radius: var(--radius-md, 14px);
		gap: 8px;
	}

	.palette-strip {
		display: flex;
		height: 22px;
		border-radius: var(--radius-xs, 8px);
		overflow: hidden;
		border: 1px solid var(--border-subtle);
	}
	.palette-strip span {
		flex: 1;
	}

	.grad-preview {
		height: 32px;
		border-radius: var(--radius-xs, 8px);
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3);
	}
	.grad-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: white;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
	}

	/* WCAG Section */
	.wcag-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 4px;
	}

	.wcag-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.wcag-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono, monospace);
		font-size: 0.72rem;
		font-weight: 600;
		padding: 5px 10px;
		border-radius: 999px;
		border: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface) 80%, transparent);
		color: var(--text-secondary);
	}
	.wcag-pill.ok {
		color: var(--aero-mint, #00d4aa);
		border-color: color-mix(in srgb, var(--aero-mint, #00d4aa) 40%, transparent);
		background: color-mix(in srgb, var(--aero-mint, #00d4aa) 10%, transparent);
	}
	.wcag-pill.warn {
		color: var(--aero-amber, #f5a623);
		border-color: color-mix(in srgb, var(--aero-amber, #f5a623) 40%, transparent);
		background: color-mix(in srgb, var(--aero-amber, #f5a623) 10%, transparent);
	}
	.wcag-pill.bad {
		color: var(--aero-rose, #ec4899);
		border-color: color-mix(in srgb, var(--aero-rose, #ec4899) 40%, transparent);
		background: color-mix(in srgb, var(--aero-rose, #ec4899) 10%, transparent);
	}
	.wcag-icon {
		font-size: 14px;
	}

	.field-error {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 4px 0 0;
		font-size: 0.75rem;
		color: var(--aero-rose, #ec4899);
		line-height: 1.4;
	}
	.field-error .material-icons-round {
		font-size: 15px;
		flex-shrink: 0;
	}
</style>
