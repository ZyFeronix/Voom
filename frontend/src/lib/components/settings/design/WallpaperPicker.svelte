<script>
	/**
	 * WallpaperPicker — imagen de fondo GLOBAL de la app (pestaña «Aplicación»).
	 * Reutiliza el pipeline de subidas del editor (contexto 'post') y escribe
	 * en el appearance store. El oscurecimiento (dim) garantiza legibilidad;
	 * una imagen rota degrada a fondo transparente sin parches.
	 */
	import FancySlider from '$lib/components/ui/FancySlider.svelte';
	import { appearanceStore, WALLPAPER_MODE_OPTIONS } from '$lib/stores/appearance.svelte.js';
	import { media as mediaApi } from '$lib/api.js';

	let uploading = $state(false);
	let error = $state('');
	let isDraggingOver = $state(false);

	const DIM_PRESETS = [
		{ label: 'Sutil', value: 15 },
		{ label: 'Equilibrado', value: 30 },
		{ label: 'Profundo', value: 50 }
	];

	const MODE_HINTS = {
		cover: 'Modo cover: cubre todo el fondo de pantalla adaptándose a la resolución.',
		tile: 'Modo mosaico: ideal para burbujas, gotas, pixel art y patrones repetitivos en cuadrícula.',
		fit: 'Modo ajustar: la imagen completa cabe en pantalla centrada y sin recortarse.'
	};

	async function uploadFile(file) {
		if (!file) return;
		error = '';
		uploading = true;
		try {
			const fd = new FormData();
			fd.append('file', file);
			fd.append('context', 'post');
			const res = await mediaApi.upload(fd);
			if (!res?.success) throw new Error(res?.error || 'No se pudo subir la imagen.');
			appearanceStore.setWallpaper(res.url);
		} catch (err) {
			error = err?.message || 'Error al subir la imagen.';
		} finally {
			uploading = false;
		}
	}

	function handleFileInput(e) {
		const file = e.target.files?.[0];
		if (file) {
			e.target.value = '';
			void uploadFile(file);
		}
	}

	function handleDrop(e) {
		e.preventDefault();
		isDraggingOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file && file.type.startsWith('image/')) {
			void uploadFile(file);
		}
	}

	function handleDragOver(e) {
		e.preventDefault();
		isDraggingOver = true;
	}

	function handleDragLeave() {
		isDraggingOver = false;
	}

	function stepDim(delta) {
		const current = appearanceStore.wallpaperDim;
		const next = Math.min(70, Math.max(0, current + delta));
		appearanceStore.setWallpaperDim(next);
	}
</script>

<div class="wallpaper-picker">
	<section class="props-section">
		<h3 class="props-title"><span class="sec-num">04</span> Fondo de la aplicación</h3>

		{#if !appearanceStore.wallpaperUrl}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="upload-zone"
				class:busy={uploading}
				class:dragover={isDraggingOver}
				ondrop={handleDrop}
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
			>
				<input
					id="app-wallpaper-file"
					name="app-wallpaper-file"
					type="file"
					accept="image/png,image/jpeg,image/webp,image/gif"
					onchange={handleFileInput}
					disabled={uploading}
				/>
				<span class="material-icons-round upload-icon">
					{uploading ? 'hourglass_top' : 'wallpaper'}
				</span>
				<div class="upload-text">
					<span class="upload-title"
						>{uploading ? 'Subiendo imagen…' : 'Subir fondo para toda la app'}</span
					>
					<span class="upload-sub">Arrastra un archivo o haz clic aquí (JPG, PNG, WebP, GIF)</span>
				</div>
			</div>
			<p class="hint">Se mostrará como fondo fijo de la app detrás de los paneles de vidrio.</p>
		{:else}
			<div class="wp-preview-wrap glass-card">
				<div
					class="wp-preview mode-{appearanceStore.wallpaperMode}"
					style="background-image: url('{appearanceStore.wallpaperUrl}');"
					role="img"
					aria-label="Previsualización del fondo de la aplicación"
				></div>
				<span
					class="wp-dim-overlay"
					style="background: rgba(0, 0, 0, {appearanceStore.wallpaperDim / 100});"
				></span>
				<div class="wp-top-actions">
					<label class="btn-icon wp-replace-btn" title="Reemplazar imagen de fondo">
						<input
							type="file"
							accept="image/png,image/jpeg,image/webp,image/gif"
							onchange={handleFileInput}
							disabled={uploading}
							class="sr-only"
						/>
						<span class="material-icons-round">edit</span>
					</label>
					<button
						type="button"
						class="btn-icon danger wp-remove"
						onclick={() => appearanceStore.setWallpaper('')}
						title="Quitar fondo de la app"
						aria-label="Quitar fondo de la app"
					>
						<span class="material-icons-round">delete</span>
					</button>
				</div>
				<div class="wp-badge">
					<span class="material-icons-round">check_circle</span>
					<span>Fondo activo</span>
				</div>
			</div>

			<div class="dim-controls">
				<div class="prop-row" id="wallpaper-dim-label">
					<span class="subfield-title">Atenuación para legibilidad</span>
					<span class="prop-value">{appearanceStore.wallpaperDim}%</span>
				</div>
				<div class="dim-stepper-row">
					<button
						type="button"
						class="stepper-btn"
						onclick={() => stepDim(-5)}
						disabled={appearanceStore.wallpaperDim <= 0}
						title="Reducir atenuación (-5%)"
						aria-label="Reducir atenuación"
					>
						<span class="material-icons-round">remove</span>
					</button>

					<div class="slider-fill-wrap">
						<FancySlider
							id="wallpaper-dim"
							min={0}
							max={70}
							step={5}
							bind:value={appearanceStore.wallpaperDim}
							aria-labelledby="wallpaper-dim-label"
							label="Oscurecimiento del wallpaper para legibilidad"
						/>
					</div>

					<button
						type="button"
						class="stepper-btn"
						onclick={() => stepDim(5)}
						disabled={appearanceStore.wallpaperDim >= 70}
						title="Aumentar atenuación (+5%)"
						aria-label="Aumentar atenuación"
					>
						<span class="material-icons-round">add</span>
					</button>
				</div>

				<div class="dim-presets" role="group" aria-label="Niveles de atenuación rápidos">
					{#each DIM_PRESETS as preset (preset.value)}
						<button
							type="button"
							class="dim-preset-chip"
							class:active={appearanceStore.wallpaperDim === preset.value}
							onclick={() => appearanceStore.setWallpaperDim(preset.value)}
						>
							{preset.label} ({preset.value}%)
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Selector de modo de renderizado (Accesible tanto si hay wallpaper como si no) -->
		<div class="wp-mode-section">
			<div class="prop-row" id="wallpaper-mode-label">
				<span class="subfield-title">Modo de visualización</span>
				<span class="prop-value">{appearanceStore.wallpaperMode}</span>
			</div>
			<div class="wp-mode-row" role="group" aria-label="Modo de renderizado del fondo">
				{#each WALLPAPER_MODE_OPTIONS as mode (mode.id)}
					<button
						type="button"
						class="seg-btn"
						class:active={appearanceStore.wallpaperMode === mode.id}
						onclick={() => appearanceStore.setWallpaperMode(mode.id)}
						title="{mode.name}: {MODE_HINTS[mode.id]}"
					>
						<span class="material-icons-round seg-icon">{mode.icon}</span>
						<span>{mode.name}</span>
					</button>
				{/each}
			</div>
			<p class="hint">
				{MODE_HINTS[appearanceStore.wallpaperMode] ||
					'Define cómo se escala y repite la imagen en toda la ventana.'}
			</p>
		</div>

		{#if error}
			<p class="field-error">
				<span class="material-icons-round">error</span>
				{error}
			</p>
		{/if}
	</section>
</div>

<style>
	.wallpaper-picker {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.props-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
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

	.subfield-title {
		font-size: 0.84rem;
		font-weight: 700;
		color: var(--text-main);
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

	.upload-zone {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 24px 16px;
		border: 2px dashed
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 35%, transparent);
		border-radius: var(--radius-md, 14px);
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 4%, transparent);
		text-align: center;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.upload-zone:hover,
	.upload-zone.dragover {
		border-color: var(--accent-blue-base, var(--aero-blue));
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 10%, transparent);
		transform: translateY(-2px);
	}
	.upload-zone input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
		height: 100%;
	}
	.upload-zone.busy {
		opacity: 0.6;
		pointer-events: none;
	}

	.upload-icon {
		font-size: 32px;
		color: var(--accent-blue-base, var(--aero-blue));
	}

	.upload-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.upload-title {
		font-size: 0.84rem;
		font-weight: 750;
		color: var(--text-main);
	}
	.upload-sub {
		font-size: 0.74rem;
		color: var(--text-muted);
	}

	.wp-preview-wrap {
		position: relative;
		border-radius: var(--radius-md, 14px);
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-sm);
	}
	.wp-preview {
		display: block;
		width: 100%;
		height: 130px;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		transition:
			background-size 0.2s ease,
			background-repeat 0.2s ease;
	}
	.wp-preview.mode-tile {
		background-size: auto;
		background-repeat: repeat;
		image-rendering: pixelated;
	}
	.wp-preview.mode-fit {
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
		background-color: rgba(0, 0, 0, 0.4);
	}
	.wp-preview.mode-cover {
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
	}
	.wp-dim-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		transition: background 0.15s ease;
	}
	.wp-top-actions {
		position: absolute;
		top: 10px;
		right: 10px;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.wp-replace-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.65);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.wp-replace-btn:hover {
		background: var(--accent-blue-base, #1b85f3);
		transform: scale(1.1);
	}
	.wp-replace-btn .material-icons-round {
		font-size: 16px;
	}
	.wp-remove {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.65);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.2);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.wp-remove:hover {
		background: var(--aero-rose, #ec4899);
		transform: scale(1.1);
	}
	.wp-remove .material-icons-round {
		font-size: 16px;
	}

	.wp-badge {
		position: absolute;
		bottom: 10px;
		left: 10px;
		z-index: 5;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		color: var(--aero-mint, #00d4aa);
		font-size: 0.72rem;
		font-weight: 700;
	}
	.wp-badge .material-icons-round {
		font-size: 14px;
	}

	.dim-controls {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 4px;
	}

	.dim-stepper-row {
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

	.dim-presets {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.dim-preset-chip {
		background: var(--bg-input, rgba(0, 0, 0, 0.12));
		border: 1px solid var(--border-subtle);
		border-radius: 999px;
		padding: 4px 11px;
		font-size: 0.74rem;
		font-weight: 650;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.dim-preset-chip:hover {
		color: var(--text-main);
		border-color: var(--accent-blue-base, var(--aero-blue));
	}
	.dim-preset-chip.active {
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 18%, transparent);
		color: var(--accent-blue-base, var(--aero-blue));
		border-color: var(--accent-blue-base, var(--aero-blue));
	}

	/* Wallpaper Mode Section */
	.wp-mode-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 4px;
	}

	.wp-mode-row {
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
		gap: 6px;
		padding: 8px 10px;
		border-radius: var(--radius-sm, 10px);
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.78rem;
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
		font-size: 16px;
	}

	.prop-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.84rem;
		font-weight: 650;
		color: var(--text-main);
	}
	.prop-value {
		font-family: var(--font-mono, monospace);
		font-size: 0.78rem;
		color: var(--accent-blue-base, var(--aero-blue));
		font-weight: 700;
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 10%, transparent);
		padding: 2px 7px;
		border-radius: 6px;
		border: 1px solid color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 25%, transparent);
	}

	.hint {
		margin: 0;
		font-size: 0.76rem;
		color: var(--text-muted);
		line-height: 1.45;
	}

	.field-error {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 4px 0 0;
		font-size: 0.75rem;
		color: var(--aero-rose, #ec4899);
	}
	.field-error .material-icons-round {
		font-size: 15px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
