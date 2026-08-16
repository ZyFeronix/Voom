<script>
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	let {
		imageFile,
		aspectRatio = 1, // 1 for Avatar (1:1), ~3.2 for Cover (16:5)
		shape = 'auto', // 'circle' | 'rect' | 'auto'
		cropType = 'general', // 'avatar' | 'cover' | 'post' | 'general'
		title = '',
		subtitle = '',
		onCrop,
		onCancel
	} = $props();

	let imageUrl = $state('');
	let imgRef = $state(null);
	let containerRef = $state(null);

	let zoom = $state(1);
	let minZoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let rotation = $state(0); // 0, 90, 180, 270

	let isDragging = $state(false);
	let startX = $state(0);
	let startY = $state(0);
	let startPanX = $state(0);
	let startPanY = $state(0);

	// Multi-touch pinch zoom
	const activePointers = new Map();
	let initialPinchDistance = 0;
	let initialPinchZoom = 1;

	let processing = $state(false);
	let imageLoaded = $state(false);
	let showGrid = $state(true);
	let showCoverAvatarSilhouette = $state(true);

	let effectiveShape = $derived(shape === 'auto' ? (aspectRatio === 1 ? 'circle' : 'rect') : shape);
	let isWideAspect = $derived(aspectRatio >= 2);

	let modalTitle = $derived(
		title ||
			(cropType === 'avatar' || effectiveShape === 'circle'
				? 'Ajustar Foto de Perfil'
				: cropType === 'cover' || isWideAspect
					? 'Ajustar Portada de Perfil'
					: 'Ajustar Imagen')
	);

	let modalSubtitle = $derived(
		subtitle ||
			(cropType === 'avatar' || effectiveShape === 'circle'
				? 'Centra y escala tu avatar • Proporción 1:1'
				: cropType === 'cover' || isWideAspect
					? 'Encuadra tu banner panorámico • Proporción 16:5'
					: 'Arrastra y ajusta el encuadre perfecto')
	);

	let maxZoom = $derived(minZoom * 4);
	let zoomProgress = $derived(
		maxZoom > minZoom
			? Math.min(100, Math.max(0, ((zoom - minZoom) / (maxZoom - minZoom)) * 100))
			: 0
	);

	$effect(() => {
		if (imageFile) {
			const url = URL.createObjectURL(imageFile);
			imageUrl = url;
			imageLoaded = false;
			rotation = 0;
			panX = 0;
			panY = 0;
			return () => URL.revokeObjectURL(url);
		}
	});

	function getEffectiveImgDimensions() {
		if (!imgRef) return { width: 1, height: 1 };
		const isRotated90 = rotation === 90 || rotation === 270;
		return {
			width: isRotated90 ? imgRef.naturalHeight : imgRef.naturalWidth,
			height: isRotated90 ? imgRef.naturalWidth : imgRef.naturalHeight
		};
	}

	function updateDimensions(forceCenter = false) {
		if (!imgRef || !containerRef || !imageLoaded) return;

		const cWidth = containerRef.clientWidth;
		const cHeight = containerRef.clientHeight || cWidth / aspectRatio;
		const { width: iWidth, height: iHeight } = getEffectiveImgDimensions();

		if (!cWidth || !cHeight || !iWidth || !iHeight) {
			requestAnimationFrame(() => updateDimensions(forceCenter));
			return;
		}

		// Calculate minZoom so the effective image area covers the container completely
		const nextMinZoom = Math.max(cWidth / iWidth, cHeight / iHeight);
		minZoom = nextMinZoom;

		if (zoom < minZoom || forceCenter) {
			zoom = minZoom;
			panX = 0;
			panY = 0;
		}

		clampPan();
	}

	function onImageLoad() {
		imageLoaded = true;
		requestAnimationFrame(() => {
			updateDimensions(true);
		});
	}

	function clampPan() {
		if (!imgRef || !containerRef) return;
		const cWidth = containerRef.clientWidth;
		const cHeight = containerRef.clientHeight || cWidth / aspectRatio;
		const { width: iWidth, height: iHeight } = getEffectiveImgDimensions();

		const curZoom = Math.max(minZoom, zoom);
		const scaledW = iWidth * curZoom;
		const scaledH = iHeight * curZoom;

		const maxPanX = Math.max(0, (scaledW - cWidth) / 2);
		const maxPanY = Math.max(0, (scaledH - cHeight) / 2);

		panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
		panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
	}

	function onWheel(e) {
		e.preventDefault();
		const delta = e.deltaY > 0 ? -0.1 : 0.1;
		const newZoom = Math.min(maxZoom, Math.max(minZoom, zoom + delta * zoom));
		zoom = newZoom;
		clampPan();
	}

	function pointerDown(e) {
		activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

		if (activePointers.size === 1) {
			isDragging = true;
			startX = e.clientX;
			startY = e.clientY;
			startPanX = panX;
			startPanY = panY;
		} else if (activePointers.size === 2) {
			// Multi-touch pinch start
			const pts = Array.from(activePointers.values());
			initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
			initialPinchZoom = zoom;
			isDragging = false;
		}

		if (containerRef) {
			containerRef.setPointerCapture(e.pointerId);
		}
	}

	function pointerMove(e) {
		if (!activePointers.has(e.pointerId)) return;
		activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

		if (activePointers.size === 1 && isDragging) {
			panX = startPanX + (e.clientX - startX);
			panY = startPanY + (e.clientY - startY);
			clampPan();
		} else if (activePointers.size === 2 && initialPinchDistance > 0) {
			const pts = Array.from(activePointers.values());
			const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
			const pinchFactor = currentDist / initialPinchDistance;
			zoom = Math.min(maxZoom, Math.max(minZoom, initialPinchZoom * pinchFactor));
			clampPan();
		}
	}

	function pointerUp(e) {
		activePointers.delete(e.pointerId);
		if (activePointers.size === 1) {
			const remaining = Array.from(activePointers.values())[0];
			startX = remaining.x;
			startY = remaining.y;
			startPanX = panX;
			startPanY = panY;
			isDragging = true;
		} else if (activePointers.size === 0) {
			isDragging = false;
		}

		if (containerRef && containerRef.hasPointerCapture(e.pointerId)) {
			containerRef.releasePointerCapture(e.pointerId);
		}
	}

	function handleZoomSlider(e) {
		zoom = parseFloat(e.target.value);
		clampPan();
	}

	function zoomStep(factor) {
		zoom = Math.min(maxZoom, Math.max(minZoom, zoom * factor));
		clampPan();
	}

	function rotate(direction = 1) {
		rotation = (rotation + direction * 90 + 360) % 360;
		updateDimensions(false);
	}

	function resetTransform() {
		rotation = 0;
		panX = 0;
		panY = 0;
		updateDimensions(true);
	}

	function handleKeydown(e) {
		if (e.key === 'Escape' && !processing) {
			onCancel();
		} else if (e.key === 'r' || e.key === 'R') {
			rotate(1);
		} else if (e.key === '+' || e.key === '=') {
			zoomStep(1.15);
		} else if (e.key === '-' || e.key === '_') {
			zoomStep(0.87);
		} else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
			e.preventDefault();
			const step = e.shiftKey ? 20 : 6;
			if (e.key === 'ArrowUp') panY += step;
			if (e.key === 'ArrowDown') panY -= step;
			if (e.key === 'ArrowLeft') panX += step;
			if (e.key === 'ArrowRight') panX -= step;
			clampPan();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		if (containerRef && typeof ResizeObserver !== 'undefined') {
			const ro = new ResizeObserver(() => {
				updateDimensions(false);
			});
			ro.observe(containerRef);
			return () => {
				window.removeEventListener('keydown', handleKeydown);
				ro.disconnect();
			};
		}
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	async function crop() {
		if (!imgRef || !containerRef || processing) return;
		processing = true;

		try {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			const cWidth = containerRef.clientWidth;

			// Output canvas dimensions
			let outWidth = 1024;
			let outHeight = 1024;

			if (effectiveShape === 'circle' || aspectRatio === 1) {
				outWidth = 1024;
				outHeight = 1024;
			} else if (isWideAspect) {
				outWidth = 1920;
				outHeight = Math.round(1920 / aspectRatio);
			} else {
				outWidth = Math.min(1920, Math.max(800, Math.round(cWidth * 2)));
				outHeight = Math.round(outWidth / aspectRatio);
			}

			canvas.width = outWidth;
			canvas.height = outHeight;

			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			ctx.clearRect(0, 0, outWidth, outHeight);

			const scaleToCanvas = outWidth / cWidth;

			// Canvas transform mapping: Center -> Pan -> Rotate -> Scale
			ctx.save();
			ctx.translate(outWidth / 2, outHeight / 2);
			ctx.translate(panX * scaleToCanvas, panY * scaleToCanvas);
			ctx.rotate((rotation * Math.PI) / 180);
			ctx.scale(zoom * scaleToCanvas, zoom * scaleToCanvas);

			// Draw image centered around (0, 0)
			ctx.drawImage(imgRef, -imgRef.naturalWidth / 2, -imgRef.naturalHeight / 2);
			ctx.restore();

			const mime =
				imageFile.type === 'image/png' || imageFile.type === 'image/webp'
					? imageFile.type
					: 'image/jpeg';
			const quality = mime === 'image/png' ? undefined : 0.95;
			const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';

			canvas.toBlob(
				(blob) => {
					if (blob) {
						const filename = `cropped_${Date.now()}.${ext}`;
						const croppedFile = new File([blob], filename, {
							type: mime,
							lastModified: Date.now()
						});
						onCrop(croppedFile);
					}
					processing = false;
				},
				mime,
				quality
			);
		} catch (err) {
			console.error('Error cropping image:', err);
			processing = false;
		}
	}
</script>

<div
	class="cropper-overlay"
	transition:fade={{ duration: 220 }}
	role="dialog"
	aria-modal="true"
	aria-labelledby="cropper-title"
>
	<div
		class="cropper-modal glass-panel"
		class:wide-modal={isWideAspect}
		transition:scale={{ duration: 280, easing: cubicOut, start: 0.94 }}
	>
		<!-- Header -->
		<div class="cropper-header">
			<div class="cropper-header-title-group">
				<div class="cropper-badge-icon">
					<span class="material-icons-round">
						{cropType === 'avatar' || effectiveShape === 'circle'
							? 'account_circle'
							: cropType === 'cover' || isWideAspect
								? 'panorama'
								: 'crop'}
					</span>
				</div>
				<div>
					<h3 id="cropper-title" class="cropper-title">{modalTitle}</h3>
					<p class="cropper-subtitle">{modalSubtitle}</p>
				</div>
			</div>
			<button
				class="btn-icon-close"
				onclick={onCancel}
				aria-label="Cerrar ventana de ajuste"
				disabled={processing}
			>
				<span class="material-icons-round">close</span>
			</button>
		</div>

		<!-- Body -->
		<div class="cropper-body">
			<!-- Visual Viewport Container -->
			<div class="cropper-container-wrapper" class:circle-mask-mode={effectiveShape === 'circle'}>
				<div
					class="cropper-container"
					role="region"
					aria-label="Área de ajuste e interactividad de imagen"
					bind:this={containerRef}
					style="aspect-ratio: {aspectRatio};"
					onwheel={onWheel}
					onpointerdown={pointerDown}
					onpointermove={pointerMove}
					onpointerup={pointerUp}
					onpointercancel={pointerUp}
				>
					{#if imageUrl}
						<img
							src={imageUrl}
							alt="Previsualización para recorte"
							bind:this={imgRef}
							onload={onImageLoad}
							style="
								position: absolute;
								top: 50%;
								left: 50%;
								width: {imgRef?.naturalWidth || 'auto'}px;
								height: {imgRef?.naturalHeight || 'auto'}px;
								max-width: none !important;
								max-height: none !important;
								transform: translate(-50%, -50%) translate3d({panX}px, {panY}px, 0) rotate({rotation}deg) scale({zoom});
								transform-origin: center center;
							"
							class="cropper-img"
							draggable="false"
						/>
					{/if}

					<!-- Avatar Circular Stencil Mask -->
					{#if effectiveShape === 'circle'}
						<div class="avatar-circular-mask" aria-hidden="true">
							<svg class="avatar-mask-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
								<defs>
									<mask id="avatar-circle-cutout">
										<rect width="100" height="100" fill="white" />
										<circle cx="50" cy="50" r="49" fill="black" />
									</mask>
								</defs>
								<rect
									width="100"
									height="100"
									fill="rgba(5, 12, 22, 0.68)"
									mask="url(#avatar-circle-cutout)"
								/>
							</svg>
							<div class="avatar-circle-ring"></div>
						</div>
					{/if}

					<!-- Cover Avatar Silhouette Watermark (shows where the avatar overlaps on profile) -->
					{#if isWideAspect && showCoverAvatarSilhouette}
						<div class="cover-avatar-silhouette" aria-hidden="true">
							<div class="silhouette-circle">
								<span class="material-icons-round">account_circle</span>
							</div>
							<span class="silhouette-label">Avatar</span>
						</div>
					{/if}

					<!-- Composition Grid (Rule of Thirds) -->
					{#if showGrid}
						<div class="cropper-grid" aria-hidden="true">
							<div class="grid-line v-line" style="left: 33.33%;"></div>
							<div class="grid-line v-line" style="left: 66.66%;"></div>
							<div class="grid-line h-line" style="top: 33.33%;"></div>
							<div class="grid-line h-line" style="top: 66.66%;"></div>
						</div>
					{/if}

					<!-- Corner Frame Brackets -->
					<div class="corner-bracket bracket-tl" aria-hidden="true"></div>
					<div class="corner-bracket bracket-tr" aria-hidden="true"></div>
					<div class="corner-bracket bracket-bl" aria-hidden="true"></div>
					<div class="corner-bracket bracket-br" aria-hidden="true"></div>

					<!-- Interactive Gesture Hint Badge -->
					<div class="gesture-hint-pill" aria-hidden="true">
						<span class="material-icons-round hint-icon">touch_app</span>
						<span>Arrastra para mover • Rueda o pellizca para zoom</span>
					</div>
				</div>
			</div>

			<!-- Toolbar Controls -->
			<div class="cropper-toolbar">
				<!-- Zoom Control Section -->
				<div class="zoom-control-group">
					<button
						type="button"
						class="btn-tool-pill"
						onclick={() => zoomStep(0.85)}
						title="Reducir zoom (-)"
						aria-label="Reducir zoom"
					>
						<span class="material-icons-round">zoom_out</span>
					</button>

					<div class="slider-wrapper">
						<input
							type="range"
							min={minZoom}
							max={maxZoom}
							step={(maxZoom - minZoom) / 200 || 0.005}
							value={zoom}
							oninput={handleZoomSlider}
							class="aero-zoom-slider"
							style="--progress: {zoomProgress}%;"
							aria-label="Nivel de aumento"
						/>
					</div>

					<button
						type="button"
						class="btn-tool-pill"
						onclick={() => zoomStep(1.15)}
						title="Aumentar zoom (+)"
						aria-label="Aumentar zoom"
					>
						<span class="material-icons-round">zoom_in</span>
					</button>

					<span class="zoom-value-badge">{Math.round((zoom / minZoom) * 100)}%</span>
				</div>

				<!-- Quick Action Tools (Rotate, Center/Reset, Grid toggle) -->
				<div class="tool-actions-group">
					<button
						type="button"
						class="btn-tool-action"
						onclick={() => rotate(1)}
						title="Rotar 90° hacia la derecha (R)"
						aria-label="Rotar 90 grados"
					>
						<span class="material-icons-round">rotate_right</span>
						<span class="tool-label">Rotar</span>
					</button>

					<button
						type="button"
						class="btn-tool-action"
						onclick={resetTransform}
						title="Restablecer posición y escala"
						aria-label="Centrar y reajustar imagen"
					>
						<span class="material-icons-round">filter_center_focus</span>
						<span class="tool-label">Centrar</span>
					</button>

					<button
						type="button"
						class="btn-tool-action"
						class:active={showGrid}
						onclick={() => (showGrid = !showGrid)}
						title="Alternar cuadrícula de tercios"
						aria-label="Alternar cuadrícula de composición"
					>
						<span class="material-icons-round">{showGrid ? 'grid_on' : 'grid_off'}</span>
						<span class="tool-label">Guías</span>
					</button>

					{#if isWideAspect}
						<button
							type="button"
							class="btn-tool-action"
							class:active={showCoverAvatarSilhouette}
							onclick={() => (showCoverAvatarSilhouette = !showCoverAvatarSilhouette)}
							title="Mostrar/Ocultar posición del avatar en perfil"
							aria-label="Alternar silueta de avatar"
						>
							<span class="material-icons-round">account_box</span>
							<span class="tool-label">Avatar</span>
						</button>
					{/if}
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="cropper-footer">
			<button class="btn-aero-ghost" onclick={onCancel} disabled={processing}> Cancelar </button>
			<button class="btn-aero-primary btn-apply-crop" onclick={crop} disabled={processing}>
				{#if processing}
					<span class="loading-spinner loading-spinner-sm"></span>
					<span>Procesando...</span>
				{:else}
					<span class="material-icons-round">check</span>
					<span>Aplicar y Guardar</span>
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.cropper-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal-backdrop, 500);
		background: color-mix(in srgb, #000000 65%, transparent);
		backdrop-filter: blur(16px) saturate(1.2);
		-webkit-backdrop-filter: blur(16px) saturate(1.2);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		user-select: none;
	}

	.cropper-modal {
		width: 100%;
		max-width: 540px;
		max-height: calc(100vh - 32px);
		border-radius: var(--radius-xl);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		box-shadow:
			0 24px 60px rgba(0, 0, 0, 0.45),
			0 0 0 1px var(--glass-border),
			var(--glass-inset-highlight);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		transition: max-width var(--t-spring);
	}

	.cropper-modal.wide-modal {
		max-width: 720px;
	}

	/* Header */
	.cropper-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 24px;
		border-bottom: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface2) 65%, transparent);
		position: relative;
	}

	.cropper-header-title-group {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.cropper-badge-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--aero-blue) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--aero-blue) 30%, transparent);
		color: var(--aero-blue);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
		box-shadow: 0 4px 12px color-mix(in srgb, var(--aero-blue) 20%, transparent);
		flex-shrink: 0;
	}

	.cropper-title {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.15rem;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.25;
	}

	.cropper-subtitle {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 2px 0 0 0;
		line-height: 1.2;
	}

	.btn-icon-close {
		background: color-mix(in srgb, var(--text-primary) 6%, transparent);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-full);
		transition:
			background var(--t-fast),
			color var(--t-fast),
			transform var(--t-fast);
	}

	.btn-icon-close:hover {
		background: color-mix(in srgb, var(--text-primary) 12%, transparent);
		color: var(--text-primary);
		transform: scale(1.05);
	}

	.btn-icon-close:active {
		transform: scale(0.95);
	}

	/* Body */
	.cropper-body {
		padding: 20px 24px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		overflow-y: auto;
	}

	/* Container Wrapper */
	.cropper-container-wrapper {
		width: 100%;
		border-radius: var(--radius-lg);
		padding: 4px;
		background: color-mix(in srgb, var(--bg-surface2) 80%, transparent);
		border: 1px solid var(--border-subtle);
		box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.cropper-container {
		width: 100%;
		position: relative;
		overflow: hidden;
		background: #090e17;
		background-image:
			radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
			radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
		background-size:
			20px 20px,
			10px 10px;
		background-position:
			0 0,
			10px 10px;
		border-radius: calc(var(--radius-lg) - 3px);
		cursor: grab;
		touch-action: none;
		user-select: none;
	}

	.cropper-container:active {
		cursor: grabbing;
	}

	.cropper-img {
		pointer-events: none;
		user-select: none;
		-webkit-user-drag: none;
		will-change: transform;
		transition: filter var(--t-fast);
	}

	/* Avatar Circular Stencil Mask */
	.avatar-circular-mask {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 2;
	}

	.avatar-mask-svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.avatar-circle-ring {
		position: absolute;
		inset: 1%;
		border-radius: 50%;
		border: 2px dashed rgba(46, 180, 255, 0.85);
		box-shadow:
			0 0 16px rgba(27, 133, 243, 0.45),
			inset 0 0 16px rgba(27, 133, 243, 0.25);
		pointer-events: none;
	}

	/* Cover Avatar Silhouette (Preview placement overlay) */
	.cover-avatar-silhouette {
		position: absolute;
		bottom: 12px;
		left: 16px;
		z-index: 3;
		pointer-events: none;
		display: flex;
		align-items: center;
		gap: 8px;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: var(--radius-full);
		padding: 4px 10px 4px 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	}

	.silhouette-circle {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--aero-blue) 40%, #000);
		border: 1.5px solid rgba(255, 255, 255, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-size: 18px;
	}

	.silhouette-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #ffffff;
		letter-spacing: 0.02em;
	}

	/* Composition Grid */
	.cropper-grid {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 2;
	}

	.grid-line {
		position: absolute;
		background: rgba(255, 255, 255, 0.3);
		box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
	}

	.v-line {
		top: 0;
		bottom: 0;
		width: 1px;
	}

	.h-line {
		left: 0;
		right: 0;
		height: 1px;
	}

	/* Corner Brackets */
	.corner-bracket {
		position: absolute;
		width: 14px;
		height: 14px;
		border-color: rgba(255, 255, 255, 0.85);
		border-style: solid;
		pointer-events: none;
		z-index: 2;
		filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
	}

	.bracket-tl {
		top: 8px;
		left: 8px;
		border-width: 2px 0 0 2px;
	}
	.bracket-tr {
		top: 8px;
		right: 8px;
		border-width: 2px 2px 0 0;
	}
	.bracket-bl {
		bottom: 8px;
		left: 8px;
		border-width: 0 0 2px 2px;
	}
	.bracket-br {
		bottom: 8px;
		right: 8px;
		border-width: 0 2px 2px 0;
	}

	/* Gesture Hint */
	.gesture-hint-pill {
		position: absolute;
		bottom: 8px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 3;
		pointer-events: none;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-full);
		padding: 3px 10px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.9);
		white-space: nowrap;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.hint-icon {
		font-size: 14px;
		color: var(--accent-blue-light, #2eb4ff);
	}

	/* Toolbar Controls */
	.cropper-toolbar {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.zoom-control-group {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 14px;
		background: color-mix(in srgb, var(--bg-surface2) 70%, transparent);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
	}

	.btn-tool-pill {
		background: color-mix(in srgb, var(--text-primary) 6%, transparent);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--t-fast);
		flex-shrink: 0;
	}

	.btn-tool-pill:hover {
		background: color-mix(in srgb, var(--aero-blue) 20%, transparent);
		border-color: var(--aero-blue);
		color: var(--aero-blue);
		transform: scale(1.05);
	}

	.btn-tool-pill:active {
		transform: scale(0.95);
	}

	.slider-wrapper {
		flex: 1;
		display: flex;
		align-items: center;
	}

	.aero-zoom-slider {
		width: 100%;
		height: 6px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--text-primary) 15%, transparent);
		outline: none;
		-webkit-appearance: none;
		appearance: none;
		cursor: pointer;
		position: relative;
	}

	.aero-zoom-slider::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(
			to right,
			var(--aero-blue) 0%,
			var(--aero-sky) var(--progress, 0%),
			color-mix(in srgb, var(--text-primary) 15%, transparent) var(--progress, 0%)
		);
	}

	.aero-zoom-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--aero-blue);
		box-shadow:
			0 0 10px rgba(27, 133, 243, 0.6),
			0 2px 6px rgba(0, 0, 0, 0.4);
		border: 2px solid #ffffff;
		cursor: pointer;
		margin-top: -6px;
		transition: transform var(--t-fast);
	}

	.aero-zoom-slider::-webkit-slider-thumb:hover {
		transform: scale(1.15);
	}

	.aero-zoom-slider::-moz-range-track {
		height: 6px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--text-primary) 15%, transparent);
	}

	.aero-zoom-slider::-moz-range-progress {
		height: 6px;
		border-radius: 3px;
		background: var(--accent-gradient);
	}

	.aero-zoom-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--aero-blue);
		box-shadow:
			0 0 10px rgba(27, 133, 243, 0.6),
			0 2px 6px rgba(0, 0, 0, 0.4);
		border: 2px solid #ffffff;
		cursor: pointer;
	}

	.zoom-value-badge {
		font-size: 0.75rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--text-secondary);
		min-width: 42px;
		text-align: right;
		flex-shrink: 0;
	}

	.tool-actions-group {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.btn-tool-action {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 14px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--bg-surface2) 80%, transparent);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--t-fast);
	}

	.btn-tool-action:hover {
		background: color-mix(in srgb, var(--aero-blue) 15%, var(--bg-surface2));
		border-color: color-mix(in srgb, var(--aero-blue) 40%, transparent);
		color: var(--text-primary);
		transform: translateY(-1px);
	}

	.btn-tool-action.active {
		background: color-mix(in srgb, var(--aero-blue) 20%, transparent);
		border-color: var(--aero-blue);
		color: var(--aero-blue);
	}

	.btn-tool-action:active {
		transform: translateY(1px);
	}

	.btn-tool-action .material-icons-round {
		font-size: 18px;
	}

	/* Footer */
	.cropper-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		padding: 16px 24px;
		border-top: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface2) 65%, transparent);
	}

	.btn-apply-crop {
		min-height: 40px;
		padding: 0 20px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9rem;
		font-weight: 700;
	}

	.loading-spinner-sm {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		display: inline-block;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 600px) {
		.cropper-header {
			padding: 14px 16px;
		}
		.cropper-body {
			padding: 14px 16px;
			gap: 14px;
		}
		.cropper-footer {
			padding: 14px 16px;
		}
		.gesture-hint-pill {
			display: none;
		}
		.tool-label {
			display: none;
		}
		.btn-tool-action {
			padding: 8px 10px;
		}
	}
</style>
