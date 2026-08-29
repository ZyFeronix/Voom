<script>
	import { onMount } from 'svelte';
	import { fade, scale, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { customAssets } from '$lib/api.js';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';

	// ---- State ----
	let isAuthResolving = $state(true);
	let activeTab = $state('emote'); // 'emoji' | 'emote' | 'sticker' | 'gif'
	let filterType = $state('all'); // 'all' | 'emoji' | 'emote' | 'sticker' | 'gif'
	let searchQuery = $state('');

	// Upload Form State
	let assetName = $state('');
	let shortcode = $state('');
	let selectedFile = $state(null);
	let filePreviewUrl = $state(null);
	let isSubmitting = $state(false);
	let uploadError = $state(null);
	let uploadSuccess = $state(null);
	let isDragging = $state(false);

	// Simulator State
	let simulatorTab = $state('chat'); // 'chat' | 'comment' | 'reaction'
	let simTestText = $state('¡Probando la nueva expresión en directo!');

	// Client-side image dimension analysis
	let detectedDimensions = $state({
		width: 0,
		height: 0,
		ratio: '',
		isSquare: false,
		sizeBytes: 0,
		mimeType: '',
		hasTransparency: false,
		isValidForType: false,
		validationErrors: []
	});

	// Asset Library
	let assets = $state([]);
	let isLoadingAssets = $state(true);
	let copiedShortcode = $state(null);
	let deleteModalAsset = $state(null);
	let isDeleting = $state(false);

	// Exact technical specifications
	const SPECS = {
		emoji: {
			id: 'emoji',
			title: 'Emoji Personalizado',
			icon: 'mood',
			color: '#00d4aa',
			colorRgb: '0, 212, 170',
			targetDims: '64×64 o 128×128 px',
			ratio: '1:1 (Estrictamente Cuadrado)',
			minDims: '32×32 px',
			maxDims: '128×128 px',
			maxSizeText: '256 KB',
			maxBytes: 256 * 1024,
			formats: 'PNG, WEBP (Fondo Transparente)',
			allowedMimes: ['image/png', 'image/webp'],
			strictSquare: true,
			useCase: 'Texto en línea, reacciones rápidas, estados y comentarios.',
			ruleTip: 'Diseña con trazos limpios para que se aprecie nítido en tamaños pequeños.'
		},
		emote: {
			id: 'emote',
			title: 'Emote de Stream / Chat',
			icon: 'military_tech',
			color: '#1b85f3',
			colorRgb: '27, 133, 243',
			targetDims: '112×112 px (Tier Estándar)',
			ratio: '1:1 (Estrictamente Cuadrado)',
			minDims: '28×28 px',
			maxDims: '128×128 px',
			maxSizeText: '512 KB',
			maxBytes: 512 * 1024,
			formats: 'PNG, WEBP, GIF Estático o Animado',
			allowedMimes: ['image/png', 'image/webp', 'image/gif'],
			strictSquare: true,
			useCase: 'Reacciones visuales en directo, celebraciones de chat y zumbidos.',
			ruleTip: 'El estándar de 112×112 px asegura compatibilidad perfecta con el chat rápido.'
		},
		sticker: {
			id: 'sticker',
			title: 'Sticker de Mensajería',
			icon: 'auto_awesome',
			color: '#f5a623',
			colorRgb: '245, 166, 35',
			targetDims: '320×320 px (Hasta 512×512 px)',
			ratio: '1:1 o Proporcional',
			minDims: '128×128 px',
			maxDims: '512×512 px',
			maxSizeText: '1 MB (1024 KB)',
			maxBytes: 1024 * 1024,
			formats: 'PNG, WEBP, GIF',
			allowedMimes: ['image/png', 'image/webp', 'image/gif'],
			strictSquare: false,
			useCase: 'Pegatinas de alta definición para chats privados, grupos y feed.',
			ruleTip: 'Añade un borde blanco sutil (stroke de 2-4px) para destacar sobre cualquier fondo.'
		},
		gif: {
			id: 'gif',
			title: 'GIF Animado / Expresión',
			icon: 'gif_box',
			color: '#ec4899',
			colorRgb: '236, 72, 153',
			targetDims: '256×256 px o 320×320 px',
			ratio: '1:1 o 4:3 (Máx 480×480 px)',
			minDims: '64×64 px',
			maxDims: '480×480 px',
			maxSizeText: '2.5 MB (2560 KB)',
			maxBytes: 2560 * 1024,
			formats: 'GIF, WEBP Animado',
			allowedMimes: ['image/gif', 'image/webp'],
			strictSquare: false,
			useCase: 'Loops de animación expresivos para momentos épicos y hype.',
			ruleTip: 'Optimiza los fotogramas (máx. 60 frames) para mantener la fluidez a 60fps.'
		}
	};

	let currentSpec = $derived(SPECS[activeTab] || SPECS.emote);

	let assetCounts = $derived.by(() => {
		return {
			all: assets.length,
			emoji: assets.filter((a) => a.asset_type === 'emoji').length,
			emote: assets.filter((a) => a.asset_type === 'emote').length,
			sticker: assets.filter((a) => a.asset_type === 'sticker').length,
			gif: assets.filter((a) => a.asset_type === 'gif').length
		};
	});

	let filteredAssets = $derived.by(() => {
		return assets.filter((item) => {
			const matchesFilter = filterType === 'all' || item.asset_type === filterType;
			const matchesSearch =
				!searchQuery ||
				item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.shortcode.toLowerCase().includes(searchQuery.toLowerCase());
			return matchesFilter && matchesSearch;
		});
	});

	let cleanShortcode = $derived((shortcode || '').toLowerCase().replace(/[^a-z0-9_]/g, ''));

	let formattedShortcodePreview = $derived.by(() => {
		const clean = cleanShortcode || 'mi_expresion';
		return `:${clean}:`;
	});

	onMount(async () => {
		if (authStore.loading) {
			await new Promise((resolve) => {
				const check = setInterval(() => {
					if (!authStore.loading) {
						clearInterval(check);
						resolve();
					}
				}, 30);
			});
		}

		isAuthResolving = false;

		if (!authStore.isAuthenticated) {
			goto('/login', { replaceState: true });
			return;
		}

		if (authStore.isTeamOrHigher) {
			await loadAssets();
		}
	});

	async function loadAssets() {
		isLoadingAssets = true;
		try {
			const res = await customAssets.list();
			if (res && res.assets) {
				assets = res.assets;
			}
		} catch (err) {
			console.error('Error al cargar activos:', err);
		} finally {
			isLoadingAssets = false;
		}
	}

	function handleShortcodeInput(e) {
		const raw = e.target.value;
		shortcode = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
	}

	function handleFileSelect(e) {
		const file = e.target?.files?.[0] || e.dataTransfer?.files?.[0];
		if (!file) return;
		processSelectedFile(file);
	}

	function clearSelectedFile() {
		if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
		filePreviewUrl = null;
		selectedFile = null;
		uploadError = null;
		uploadSuccess = null;
		detectedDimensions = {
			width: 0,
			height: 0,
			ratio: '',
			isSquare: false,
			sizeBytes: 0,
			mimeType: '',
			hasTransparency: false,
			isValidForType: false,
			validationErrors: []
		};
	}

	function processSelectedFile(file) {
		uploadError = null;
		uploadSuccess = null;
		selectedFile = file;

		if (!assetName) {
			const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
			assetName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
		}

		if (!shortcode) {
			const cleanCode = file.name
				.replace(/\.[^/.]+$/, '')
				.replace(/[^a-zA-Z0-9_]/g, '_')
				.toLowerCase();
			shortcode = cleanCode;
		}

		if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
		filePreviewUrl = URL.createObjectURL(file);

		const img = new Image();
		img.onload = () => {
			const w = img.naturalWidth;
			const h = img.naturalHeight;
			const isSquare = w === h;
			const ratio = isSquare ? '1:1' : `${w}:${h}`;
			const sizeBytes = file.size;
			const mimeType = file.type;

			let hasTransparency = false;
			try {
				const canvas = document.createElement('canvas');
				canvas.width = Math.min(w, 64);
				canvas.height = Math.min(h, 64);
				const ctx = canvas.getContext('2d', { willReadFrequently: true });
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
				for (let i = 3; i < imgData.length; i += 4) {
					if (imgData[i] < 250) {
						hasTransparency = true;
						break;
					}
				}
			} catch (_) {}

			const errors = [];
			if (currentSpec.strictSquare && !isSquare) {
				errors.push(`Debe ser estrictamente cuadrada (1:1). Medidas actuales: ${w}×${h} px.`);
			}
			if (w < parseInt(currentSpec.minDims) || h < parseInt(currentSpec.minDims)) {
				errors.push(`Las dimensiones son menores al mínimo requerido (${currentSpec.minDims}).`);
			}
			if (w > parseInt(currentSpec.maxDims) || h > parseInt(currentSpec.maxDims)) {
				errors.push(`Las dimensiones superan el máximo permitido (${currentSpec.maxDims}).`);
			}
			if (sizeBytes > currentSpec.maxBytes) {
				errors.push(
					`El archivo supera el peso máximo permitido (${currentSpec.maxSizeText}). Peso actual: ${(sizeBytes / 1024).toFixed(1)} KB.`
				);
			}
			if (!currentSpec.allowedMimes.includes(mimeType)) {
				errors.push(`Formato "${mimeType}" no admitido para ${currentSpec.title}.`);
			}

			detectedDimensions = {
				width: w,
				height: h,
				ratio,
				isSquare,
				sizeBytes,
				mimeType,
				hasTransparency,
				isValidForType: errors.length === 0,
				validationErrors: errors
			};
		};
		img.onerror = () => {
			uploadError = 'No se pudo leer el archivo de imagen. Formato no compatible.';
		};
		img.src = filePreviewUrl;
	}

	async function handleSubmit(e) {
		e.preventDefault();
		uploadError = null;
		uploadSuccess = null;

		if (!selectedFile) {
			uploadError = 'Por favor selecciona un archivo para subir.';
			return;
		}

		if (detectedDimensions.validationErrors.length > 0) {
			uploadError = detectedDimensions.validationErrors[0];
			return;
		}

		isSubmitting = true;

		try {
			const fd = new FormData();
			fd.append('file', selectedFile);
			fd.append('name', assetName.trim());
			fd.append('shortcode', cleanShortcode);
			fd.append('asset_type', activeTab);

			const res = await customAssets.upload(fd);
			if (res && res.success) {
				uploadSuccess = res.message || '¡Activo subido y verificado con éxito!';
				if (res.asset) {
					assets = [res.asset, ...assets];
				}
				resetUploadForm();
			}
		} catch (err) {
			uploadError = err.message || 'Error al subir el activo. Verifica las medidas.';
		} finally {
			isSubmitting = false;
		}
	}

	function resetUploadForm() {
		assetName = '';
		shortcode = '';
		selectedFile = null;
		if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
		filePreviewUrl = null;
		detectedDimensions = {
			width: 0,
			height: 0,
			ratio: '',
			isSquare: false,
			sizeBytes: 0,
			mimeType: '',
			hasTransparency: false,
			isValidForType: false,
			validationErrors: []
		};
	}

	function copyShortcode(code) {
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			navigator.clipboard.writeText(code);
			copiedShortcode = code;
			setTimeout(() => {
				if (copiedShortcode === code) copiedShortcode = null;
			}, 2500);
		}
	}

	async function confirmDeleteAsset() {
		if (!deleteModalAsset) return;
		isDeleting = true;
		try {
			await customAssets.delete(deleteModalAsset.id);
			assets = assets.filter((a) => a.id !== deleteModalAsset.id);
			deleteModalAsset = null;
		} catch (err) {
			alert(err.message || 'Error al eliminar activo');
		} finally {
			isDeleting = false;
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Escape' && deleteModalAsset) {
			deleteModalAsset = null;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Estudio Experimental de Emotes & Stickers — Voom!</title>
	<meta
		name="description"
		content="Laboratorio de pre-producción exclusivo para el Equipo Voom!: subida y calibración de emotes, stickers, emojis y GIFs con medidas exactas."
	/>
</svelte:head>

{#if isAuthResolving || authStore.loading}
	<div class="studio-container" in:fade={{ duration: 150 }}>
		<div class="studio-header glass-panel studio-skeleton-card">
			<div class="sk-pill"></div>
			<div class="sk-title"></div>
			<div class="sk-desc"></div>
		</div>
		<div class="specs-section glass-panel studio-skeleton-card">
			<div class="sk-grid">
				<div class="sk-block"></div>
				<div class="sk-block"></div>
				<div class="sk-block"></div>
				<div class="sk-block"></div>
			</div>
		</div>
	</div>
{:else if !authStore.isTeamOrHigher}
	<div class="studio-container" in:fade={{ duration: 250, easing: cubicOut }}>
		<div class="restricted-shield glass-panel" in:scale={{ duration: 250 }}>
			<div class="shield-badge">
				<span class="material-icons-round shield-icon">military_tech</span>
			</div>
			<h1 class="shield-title">Acceso Restringido: Solo Equipo Voom!</h1>
			<p class="shield-desc">
				Este estudio es un <strong>laboratorio de pre-producción experimental</strong> reservado
				exclusivamente para miembros verificados del <strong>Equipo Voom!</strong> y rangos superiores
				de administración y soporte.
			</p>
			<div class="shield-role-info">
				<div class="shield-role-row">
					<span class="material-icons-round">lock</span>
					<span>Insignia requerida: <strong>Equipo Voom!</strong> (militar tech) o Staff</span>
				</div>
				<div class="shield-role-row">
					<span class="material-icons-round">block</span>
					<span>No disponible para cuentas estándar, verificadas comunes o institucionales.</span>
				</div>
			</div>
			<div class="shield-actions">
				<a href="/feed" class="btn-aero-primary">
					<span class="material-icons-round">arrow_back</span>
					<span>Volver al Feed</span>
				</a>
				<a href="/about/verified" class="btn-aero-secondary">
					<span class="material-icons-round">verified</span>
					<span>Conocer Insignias</span>
				</a>
			</div>
		</div>
	</div>
{:else}
	<div class="studio-container" in:fade={{ duration: 250, easing: cubicOut }}>
		<!-- Top Breadcrumb Navigation -->
		<nav class="studio-top-nav" aria-label="Navegación del Estudio">
			<a href="/feed" class="nav-back-link">
				<span class="material-icons-round">arrow_back</span>
				<span>Volver al Feed</span>
			</a>
			<div class="nav-breadcrumbs">
				<span class="breadcrumb-item">Estudio Voom!</span>
				<span class="breadcrumb-sep">/</span>
				<span class="breadcrumb-active">Emotes & Expresiones</span>
			</div>
		</nav>

		<!-- Main Studio Header -->
		<header class="studio-header glass-panel">
			<div class="header-left">
				<div class="team-hero-badge">
					<span class="material-icons-round">military_tech</span>
					<span>EQUIPO Voom!</span>
				</div>
				<div class="header-title-wrap">
					<h1 class="studio-title">
						Estudio Experimental de Emotes & Expresiones
						<span class="exp-pill">PRE-PRODUCCIÓN</span>
					</h1>
					<p class="studio-subtitle">
						Calibrador milimétrico, subida y validación en tiempo real para Emojis, Emotes, Stickers
						y GIFs animados.
					</p>
				</div>
			</div>
			<div class="header-stats">
				<div class="stat-box">
					<span class="stat-num">{assets.length}</span>
					<span class="stat-lbl">Total Registrados</span>
				</div>
				<div class="stat-box">
					<span class="stat-num">4</span>
					<span class="stat-lbl">Formatos</span>
				</div>
			</div>
		</header>

		<!-- Spec Selector Tabs -->
		<section class="specs-section glass-panel">
			<div class="section-top-bar">
				<div class="section-title-wrap">
					<div class="section-icon-box">
						<span class="material-icons-round section-icon">straighten</span>
					</div>
					<div>
						<h2 class="section-title">Medidas Exactas y Especificaciones Técnicas</h2>
						<p class="section-sub">
							Selecciona la categoría para inspeccionar los estándares milimétricos y reglas de
							renderizado.
						</p>
					</div>
				</div>
			</div>

			<div class="specs-nav">
				{#each Object.values(SPECS) as spec}
					<button
						type="button"
						class="spec-tab-btn"
						class:active={activeTab === spec.id}
						style="--tab-color: {spec.color}; --tab-rgb: {spec.colorRgb};"
						onclick={() => {
							activeTab = spec.id;
							if (selectedFile) processSelectedFile(selectedFile);
						}}
					>
						<div class="spec-tab-header">
							<span class="material-icons-round spec-icon" style="color: {spec.color}"
								>{spec.icon}</span
							>
							<span class="spec-tab-count">{assetCounts[spec.id]}</span>
						</div>
						<span class="spec-tab-title">{spec.title}</span>
						<span class="spec-tab-dim">{spec.targetDims.split(' ')[0]}</span>
					</button>
				{/each}
			</div>

			<!-- Active Spec Detailed Card -->
			<div
				class="spec-detail-card glass-card"
				style="--active-color: {currentSpec.color}; --active-rgb: {currentSpec.colorRgb};"
				in:fade={{ duration: 200 }}
			>
				<div class="spec-card-grid">
					<div class="spec-metric">
						<span class="metric-label">Dimensión Exacta / Objetivo</span>
						<span class="metric-val spec-accent-text">{currentSpec.targetDims}</span>
					</div>
					<div class="spec-metric">
						<span class="metric-label">Relación de Aspecto</span>
						<span class="metric-val">{currentSpec.ratio}</span>
					</div>
					<div class="spec-metric">
						<span class="metric-label">Rango Permitido</span>
						<span class="metric-val">{currentSpec.minDims} a {currentSpec.maxDims}</span>
					</div>
					<div class="spec-metric">
						<span class="metric-label">Peso Máximo de Archivo</span>
						<span class="metric-val">{currentSpec.maxSizeText}</span>
					</div>
					<div class="spec-metric">
						<span class="metric-label">Formatos Admitidos</span>
						<span class="metric-val">{currentSpec.formats}</span>
					</div>
					<div class="spec-metric">
						<span class="metric-label">Caso de Uso Principal</span>
						<span class="metric-val metric-use">{currentSpec.useCase}</span>
					</div>
				</div>
				<div class="spec-tip-bar">
					<span class="material-icons-round tip-icon">tips_and_updates</span>
					<span><strong>Recomendación del Arquitecto:</strong> {currentSpec.ruleTip}</span>
				</div>
			</div>
		</section>

		<!-- Upload & Live Simulator Workbench -->
		<div class="workbench-grid">
			<!-- Upload & Real-Time Inspector Form -->
			<div class="upload-panel glass-panel">
				<div class="panel-header">
					<div class="panel-icon-box">
						<span class="material-icons-round panel-icon">cloud_upload</span>
					</div>
					<div>
						<h2 class="panel-title">Laboratorio de Carga & Calibración</h2>
						<p class="panel-sub">
							Inspección automática de píxeles, canal alfa y relación de aspecto.
						</p>
					</div>
				</div>

				<form onsubmit={handleSubmit} class="upload-form">
					<!-- Drag & Drop Dropzone -->
					<div
						class="dropzone"
						class:dragging={isDragging}
						class:has-file={!!selectedFile}
						role="region"
						aria-label="Zona de carga de archivo de imagen"
						ondragover={(e) => {
							e.preventDefault();
							isDragging = true;
						}}
						ondragleave={() => (isDragging = false)}
						ondrop={(e) => {
							e.preventDefault();
							isDragging = false;
							handleFileSelect(e);
						}}
					>
						<input
							type="file"
							id="asset-file-input"
							accept={currentSpec.allowedMimes.join(',')}
							onchange={handleFileSelect}
							class="file-input-hidden"
						/>
						{#if filePreviewUrl}
							<div class="preview-stage" in:scale={{ duration: 180 }}>
								<div class="stage-checkerboard preview-frame">
									<img
										src={filePreviewUrl}
										alt="Vista previa"
										class="uploaded-preview-img"
										style="max-height: 140px; max-width: 140px;"
									/>
								</div>
								<div class="preview-controls">
									<label for="asset-file-input" class="btn-action-pill btn-change-file">
										<span class="material-icons-round">sync</span>
										<span>Cambiar</span>
									</label>
									<button
										type="button"
										class="btn-action-pill btn-remove-file"
										onclick={clearSelectedFile}
										title="Descartar archivo seleccionado"
									>
										<span class="material-icons-round">close</span>
										<span>Descartar</span>
									</button>
								</div>
							</div>
						{:else}
							<label for="asset-file-input" class="dropzone-label">
								<div class="drop-icon-wrap" style="color: {currentSpec.color}">
									<span class="material-icons-round">{currentSpec.icon}</span>
								</div>
								<span class="drop-text-main">
									Arrastra tu archivo aquí o <span class="highlight">explora tu equipo</span>
								</span>
								<span class="drop-text-sub">
									{currentSpec.formats} • Medida recomendada {currentSpec.targetDims}
								</span>
							</label>
						{/if}
					</div>

					<!-- Real-Time Dimension & Compliance Feedback -->
					{#if selectedFile && detectedDimensions.width > 0}
						<div class="measurement-feedback glass-card" in:slide={{ duration: 250 }}>
							<div class="feedback-header">
								<span class="material-icons-round">analytics</span>
								<span>Reporte de Inspección Milimétrica</span>
							</div>

							<div class="feedback-pills">
								<!-- Dimension Pill -->
								<div
									class="metric-pill"
									class:valid={detectedDimensions.isValidForType}
									class:invalid={!detectedDimensions.isValidForType}
								>
									<span class="material-icons-round"
										>{detectedDimensions.isValidForType ? 'check_circle' : 'error'}</span
									>
									<span>
										Medida: <strong
											>{detectedDimensions.width}×{detectedDimensions.height} px</strong
										>
									</span>
								</div>

								<!-- Aspect Ratio Pill -->
								<div
									class="metric-pill"
									class:valid={!currentSpec.strictSquare || detectedDimensions.isSquare}
									class:invalid={currentSpec.strictSquare && !detectedDimensions.isSquare}
								>
									<span class="material-icons-round"
										>{!currentSpec.strictSquare || detectedDimensions.isSquare
											? 'aspect_ratio'
											: 'error'}</span
									>
									<span>Ratio: <strong>{detectedDimensions.ratio}</strong></span>
								</div>

								<!-- File Size Pill -->
								<div
									class="metric-pill"
									class:valid={detectedDimensions.sizeBytes <= currentSpec.maxBytes}
									class:invalid={detectedDimensions.sizeBytes > currentSpec.maxBytes}
								>
									<span class="material-icons-round">data_usage</span>
									<span>
										Peso: <strong>{(detectedDimensions.sizeBytes / 1024).toFixed(1)} KB</strong>
									</span>
								</div>

								<!-- Transparency Pill -->
								<div
									class="metric-pill"
									class:valid={detectedDimensions.hasTransparency}
									class:neutral={!detectedDimensions.hasTransparency}
								>
									<span class="material-icons-round"
										>{detectedDimensions.hasTransparency ? 'opacity' : 'texture'}</span
									>
									<span>
										{detectedDimensions.hasTransparency ? 'Fondo Alfa Transparente' : 'Fondo Opaco'}
									</span>
								</div>
							</div>

							{#if detectedDimensions.validationErrors.length > 0}
								<div class="errors-list">
									{#each detectedDimensions.validationErrors as err}
										<div class="error-item">
											<span class="material-icons-round">warning</span>
											<span>{err}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Form Inputs -->
					<div class="form-inputs-row">
						<div class="input-group">
							<label for="asset-name" class="input-label">Nombre del Activo</label>
							<input
								type="text"
								id="asset-name"
								bind:value={assetName}
								placeholder="Ej. Pepe Fuego"
								class="aero-input"
								maxlength="64"
								required
							/>
						</div>

						<div class="input-group">
							<label for="asset-shortcode" class="input-label">Código Corto (Shortcode)</label>
							<div class="shortcode-input-wrapper">
								<span class="code-bracket">:</span>
								<input
									type="text"
									id="asset-shortcode"
									value={shortcode}
									oninput={handleShortcodeInput}
									placeholder="pepe_fuego"
									class="shortcode-field"
									maxlength="32"
									required
								/>
								<span class="code-bracket">:</span>
							</div>
							<span class="input-hint">Solo letras minúsculas, números y guiones bajos.</span>
						</div>
					</div>

					{#if uploadError}
						<div class="alert-box alert-error" in:fade>
							<span class="material-icons-round">error</span>
							<span>{uploadError}</span>
						</div>
					{/if}

					{#if uploadSuccess}
						<div class="alert-box alert-success" in:fade>
							<span class="material-icons-round">verified</span>
							<span>{uploadSuccess}</span>
						</div>
					{/if}

					<!-- Submit Button -->
					<div class="form-actions">
						<button
							type="submit"
							class="btn-aero-primary submit-btn"
							disabled={isSubmitting ||
								!selectedFile ||
								detectedDimensions.validationErrors.length > 0}
						>
							{#if isSubmitting}
								<span class="material-icons-round spin">sync</span>
								<span>Verificando y Guardando...</span>
							{:else}
								<span class="material-icons-round">verified_user</span>
								<span>Registrar y Publicar en Pre-Producción</span>
							{/if}
						</button>
					</div>
				</form>
			</div>

			<!-- Live Expression Simulator -->
			<div class="simulator-panel glass-panel">
				<div class="panel-header">
					<div class="panel-icon-box">
						<span class="material-icons-round panel-icon">preview</span>
					</div>
					<div>
						<h2 class="panel-title">Simulador de Interfaz en Vivo</h2>
						<p class="panel-sub">Comprueba el renderizado en chat, comentarios y reacciones.</p>
					</div>
				</div>

				<!-- Simulator Tabs -->
				<div class="sim-tabs">
					<button
						type="button"
						class="sim-tab"
						class:active={simulatorTab === 'chat'}
						onclick={() => (simulatorTab = 'chat')}
					>
						<span class="material-icons-round">chat</span>
						<span>Burbuja de Chat</span>
					</button>
					<button
						type="button"
						class="sim-tab"
						class:active={simulatorTab === 'comment'}
						onclick={() => (simulatorTab = 'comment')}
					>
						<span class="material-icons-round">forum</span>
						<span>Comentario</span>
					</button>
					<button
						type="button"
						class="sim-tab"
						class:active={simulatorTab === 'reaction'}
						onclick={() => (simulatorTab = 'reaction')}
					>
						<span class="material-icons-round">add_reaction</span>
						<span>Reacción</span>
					</button>
				</div>

				<!-- Interactive test message bar -->
				<div class="sim-test-input-wrap">
					<span class="material-icons-round sim-test-icon">edit_note</span>
					<input
						type="text"
						bind:value={simTestText}
						placeholder="Escribe un mensaje para simular..."
						class="sim-test-input"
						maxlength="120"
					/>
				</div>

				<!-- Simulator Stage -->
				<div class="sim-viewport glass-card">
					{#if simulatorTab === 'chat'}
						<div class="sim-chat-container">
							<!-- Other user message -->
							<div class="sim-msg incoming">
								<div class="sim-avatar-wrap">
									<AeroAvatar alt="V-Bot" size="sm" />
								</div>
								<div class="sim-bubble">
									<div class="sim-author">V-Bot</div>
									<div class="sim-text">
										¿Cómo quedó la calibración del nuevo emote para el stream?
									</div>
								</div>
							</div>

							<!-- My Message with custom asset -->
							<div class="sim-msg outgoing">
								<div class="sim-bubble outgoing-bubble">
									<div class="sim-text">
										{simTestText}
										{#if filePreviewUrl}
											<span class="sim-asset-container {activeTab}">
												<img
													src={filePreviewUrl}
													alt="Emote"
													class="inline-sim-asset asset-{activeTab}"
												/>
											</span>
										{:else}
											<span class="sim-shortcode-tag">{formattedShortcodePreview}</span>
										{/if}
									</div>
									<div class="sim-meta">15:00 ✓✓</div>
								</div>
								<div class="sim-avatar-wrap">
									<AeroAvatar
										src={authStore.user?.avatar_url}
										alt={authStore.user?.display_name || authStore.user?.username || 'Tú'}
										size="sm"
									/>
								</div>
							</div>
						</div>
					{:else if simulatorTab === 'comment'}
						<div class="sim-comment-container">
							<div class="sim-comment-item">
								<div class="sim-avatar-wrap">
									<AeroAvatar
										src={authStore.user?.avatar_url}
										alt={authStore.user?.display_name || authStore.user?.username || 'Tú'}
										size="md"
									/>
								</div>
								<div class="sim-comment-content">
									<div class="sim-comment-header">
										<span class="sim-comment-user">
											{authStore.user?.display_name || authStore.user?.username || 'Equipo Voom!'}
										</span>
										<VerifiedBadge
											role={authStore.user?.role || 'team'}
											isVerified={true}
											size="15px"
										/>
										<span class="sim-time-tag">Hace 2m</span>
									</div>
									<div class="sim-comment-body">
										<p class="sim-comment-text">{simTestText}</p>
										{#if filePreviewUrl}
											<div class="comment-asset-display">
												<img
													src={filePreviewUrl}
													alt="Asset"
													class="comment-sim-asset asset-{activeTab}"
												/>
											</div>
										{:else}
											<span class="sim-shortcode-tag">{formattedShortcodePreview}</span>
										{/if}
									</div>
								</div>
							</div>
						</div>
					{:else if simulatorTab === 'reaction'}
						<div class="sim-reaction-container">
							<p class="sim-reaction-prompt">Reacción interactiva en publicación:</p>
							<div class="sim-post-dummy">
								<div class="dummy-post-header">
									<AeroAvatar alt="Voom! Core" size="sm" />
									<div>
										<span class="dummy-author">Voom! Engine</span>
										<span class="dummy-handle">@voom_official</span>
									</div>
								</div>
								<p class="dummy-post-text">
									🚀 Nuevo despliegue del motor de expresiones a 60 FPS con Neo-Aero glass.
								</p>
								<div class="reaction-pills-row">
									<div class="reaction-pill active-pill">
										{#if filePreviewUrl}
											<img
												src={filePreviewUrl}
												alt="Reacción"
												class="pill-sim-asset asset-{activeTab}"
											/>
										{:else}
											<span class="material-icons-round pill-icon">military_tech</span>
										{/if}
										<span class="pill-count">12</span>
									</div>
									<div class="reaction-pill">
										<span>🔥</span>
										<span class="pill-count">48</span>
									</div>
									<div class="reaction-pill">
										<span>⚡</span>
										<span class="pill-count">24</span>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Custom Assets Vault / Gallery -->
		<section class="vault-section glass-panel">
			<div class="vault-top-bar">
				<div class="vault-title-wrap">
					<div class="section-icon-box">
						<span class="material-icons-round section-icon">inventory_2</span>
					</div>
					<div>
						<h2 class="section-title">Bóveda de Activos en Pre-Producción</h2>
						<p class="section-sub">
							Colección verificada de expresiones subidas por el equipo. Haz clic para copiar el
							código corto.
						</p>
					</div>
				</div>

				<div class="vault-controls">
					<!-- Search -->
					<div class="vault-search">
						<span class="material-icons-round search-icon">search</span>
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Buscar por nombre o :shortcode:..."
							class="vault-search-input"
						/>
						{#if searchQuery}
							<button
								type="button"
								class="btn-clear-search"
								onclick={() => (searchQuery = '')}
								title="Limpiar búsqueda"
							>
								<span class="material-icons-round">close</span>
							</button>
						{/if}
					</div>

					<!-- Filter Pills with Dynamic Counts -->
					<div class="filter-pills">
						<button
							class="filter-pill"
							class:active={filterType === 'all'}
							onclick={() => (filterType = 'all')}
						>
							<span>Todos</span>
							<span class="filter-count">({assetCounts.all})</span>
						</button>
						<button
							class="filter-pill"
							class:active={filterType === 'emoji'}
							onclick={() => (filterType = 'emoji')}
						>
							<span>Emojis</span>
							<span class="filter-count">({assetCounts.emoji})</span>
						</button>
						<button
							class="filter-pill"
							class:active={filterType === 'emote'}
							onclick={() => (filterType = 'emote')}
						>
							<span>Emotes</span>
							<span class="filter-count">({assetCounts.emote})</span>
						</button>
						<button
							class="filter-pill"
							class:active={filterType === 'sticker'}
							onclick={() => (filterType = 'sticker')}
						>
							<span>Stickers</span>
							<span class="filter-count">({assetCounts.sticker})</span>
						</button>
						<button
							class="filter-pill"
							class:active={filterType === 'gif'}
							onclick={() => (filterType = 'gif')}
						>
							<span>GIFs</span>
							<span class="filter-count">({assetCounts.gif})</span>
						</button>
					</div>
				</div>
			</div>

			<!-- Assets Grid -->
			{#if isLoadingAssets}
				<div class="loading-state glass-card">
					<span class="material-icons-round spin">sync</span>
					<span>Cargando expresiones de pre-producción...</span>
				</div>
			{:else if filteredAssets.length === 0}
				<div class="empty-vault glass-card">
					<div class="empty-icon-wrap">
						<span class="material-icons-round empty-icon">sentiment_dissatisfied</span>
					</div>
					<h3 class="empty-title">No se encontraron activos</h3>
					<p class="empty-desc">
						{#if searchQuery || filterType !== 'all'}
							No hay resultados que coincidan con los filtros actuales.
						{:else}
							Aún no has registrado expresiones en esta categoría. ¡Usa el panel de carga superior
							para añadir la primera!
						{/if}
					</p>
				</div>
			{:else}
				<div class="assets-grid">
					{#each filteredAssets as item (item.id)}
						<div class="asset-card glass-card" in:scale={{ duration: 200 }}>
							<div class="asset-card-thumb-wrap stage-checkerboard">
								<img src={item.url} alt={item.name} class="asset-card-img" />
								<span
									class="asset-type-badge badge-{item.asset_type}"
									style="--badge-color: {SPECS[item.asset_type]?.color ||
										'var(--accent-blue-base)'}"
								>
									{item.asset_type.toUpperCase()}
								</span>
							</div>

							<div class="asset-card-body">
								<div class="asset-card-title-row">
									<h4 class="asset-card-name" title={item.name}>{item.name}</h4>
								</div>

								<div class="asset-specs-strip">
									<span class="spec-pill">{item.width}×{item.height} px</span>
									<span class="spec-pill">{(item.size_bytes / 1024).toFixed(1)} KB</span>
									{#if item.is_animated}
										<span class="spec-pill anim-pill">ANIMADO</span>
									{/if}
								</div>

								<div class="shortcode-copy-row">
									<button
										type="button"
										class="copy-code-btn"
										class:copied={copiedShortcode === item.shortcode}
										onclick={() => copyShortcode(item.shortcode)}
										title="Copiar código corto"
									>
										<span class="code-text">{item.shortcode}</span>
										<span class="material-icons-round icon-copy">
											{copiedShortcode === item.shortcode ? 'check' : 'content_copy'}
										</span>
									</button>

									{#if authStore.user?.id === item.user_id || authStore.isAdmin}
										<button
											type="button"
											class="btn-delete-asset"
											onclick={() => (deleteModalAsset = item)}
											title="Eliminar activo"
										>
											<span class="material-icons-round">delete_outline</span>
										</button>
									{/if}
								</div>

								<div class="asset-author-row">
									<AeroAvatar
										src={item.avatar_url}
										alt={item.display_name || item.username}
										size="sm"
									/>
									<span class="author-label">@{item.username}</span>
									<VerifiedBadge role={item.author_role} isVerified={true} size="14px" />
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if deleteModalAsset}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-backdrop"
		onclick={(e) => {
			if (e.target === e.currentTarget) deleteModalAsset = null;
		}}
		in:fade={{ duration: 150 }}
	>
		<div class="modal-box glass-panel" in:scale={{ duration: 200, start: 0.95 }}>
			<div class="modal-header">
				<div class="modal-icon-wrap">
					<span class="material-icons-round modal-icon-warn">warning</span>
				</div>
				<h3 class="modal-title">¿Eliminar {deleteModalAsset.name}?</h3>
			</div>
			<p class="modal-text">
				Esta acción eliminará el archivo del servidor y el código corto
				<code>{deleteModalAsset.shortcode}</code> dejará de estar disponible en el chat y comentarios.
			</p>
			<div class="modal-actions">
				<button
					type="button"
					class="btn-aero-secondary"
					onclick={() => (deleteModalAsset = null)}
					disabled={isDeleting}
				>
					Cancelar
				</button>
				<button
					type="button"
					class="btn-aero-danger"
					onclick={confirmDeleteAsset}
					disabled={isDeleting}
				>
					{#if isDeleting}
						<span class="material-icons-round spin">sync</span>
						<span>Eliminando...</span>
					{:else}
						<span>Eliminar Definitivamente</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.studio-container {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px 16px 80px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	/* Top Navigation / Breadcrumbs */
	.studio-top-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 4px;
		gap: 16px;
		flex-wrap: wrap;
	}
	.nav-back-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--text-secondary);
		font-size: 13.5px;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.2s var(--ease-spring);
		padding: 6px 12px;
		border-radius: var(--radius-full);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
	}
	.nav-back-link:hover {
		color: var(--accent-blue-base);
		transform: translateX(-3px);
		border-color: var(--accent-blue-base);
	}
	.nav-breadcrumbs {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-secondary);
	}
	.breadcrumb-item {
		opacity: 0.7;
	}
	.breadcrumb-sep {
		opacity: 0.4;
	}
	.breadcrumb-active {
		font-weight: 700;
		color: var(--text-primary);
	}

	/* Shimmer Skeleton Placeholder */
	.studio-skeleton-card {
		padding: 28px 32px;
		border-radius: var(--radius-xl);
		display: flex;
		flex-direction: column;
		gap: 14px;
		animation: skPulse 1.8s ease-in-out infinite;
	}
	.sk-pill {
		width: 140px;
		height: 24px;
		border-radius: var(--radius-full);
		background: var(--bg-surface-hover);
	}
	.sk-title {
		width: 60%;
		height: 32px;
		border-radius: var(--radius-md);
		background: var(--bg-surface-hover);
	}
	.sk-desc {
		width: 80%;
		height: 18px;
		border-radius: var(--radius-sm);
		background: var(--bg-surface-hover);
	}
	.sk-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}
	.sk-block {
		height: 80px;
		border-radius: var(--radius-md);
		background: var(--bg-surface-hover);
	}
	@keyframes skPulse {
		0%,
		100% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
	}

	/* Restricted Shield */
	.restricted-shield {
		padding: 48px 32px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		border-radius: var(--radius-xl);
		margin-top: 40px;
	}
	.shield-badge {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: rgba(var(--aero-mint-rgb, 0, 212, 170), 0.15);
		border: 2px solid var(--aero-mint);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 0 25px rgba(var(--aero-mint-rgb, 0, 212, 170), 0.35);
		flex: 0 0 80px;
		min-width: 80px;
		min-height: 80px;
	}
	.shield-icon {
		font-size: 44px;
		color: var(--aero-mint);
	}
	.shield-title {
		font-family: var(--font-display);
		font-size: 26px;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}
	.shield-desc {
		font-size: 15px;
		color: var(--text-secondary);
		max-width: 580px;
		line-height: 1.6;
		margin: 0;
	}
	.shield-role-info {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px 20px;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		font-size: 13.5px;
		color: var(--text-secondary);
		text-align: left;
	}
	.shield-role-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.shield-role-row .material-icons-round {
		font-size: 18px;
		color: var(--accent-blue-base);
		flex: 0 0 18px;
	}
	.shield-actions {
		display: flex;
		gap: 16px;
		margin-top: 10px;
		flex-wrap: wrap;
		justify-content: center;
	}

	/* Studio Header */
	.studio-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 28px 32px;
		border-radius: var(--radius-xl);
		gap: 24px;
		flex-wrap: wrap;
	}
	.header-left {
		display: flex;
		flex-direction: column;
		gap: 10px;
		flex: 1;
		min-width: 280px;
	}
	.team-hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		border-radius: var(--radius-full);
		background: rgba(var(--aero-mint-rgb, 0, 212, 170), 0.15);
		border: 1px solid rgba(var(--aero-mint-rgb, 0, 212, 170), 0.4);
		color: var(--aero-mint);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		width: fit-content;
	}
	.team-hero-badge .material-icons-round {
		font-size: 16px;
	}
	.studio-title {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.exp-pill {
		font-size: 10px;
		font-weight: 800;
		padding: 3px 8px;
		border-radius: var(--radius-xs);
		background: var(--accent-gradient);
		color: #ffffff;
		letter-spacing: 0.06em;
	}
	.studio-subtitle {
		font-size: 14px;
		color: var(--text-secondary);
		margin: 4px 0 0;
		line-height: 1.5;
	}
	.header-stats {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
	}
	.stat-box {
		padding: 14px 22px;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 110px;
		box-shadow: var(--shadow-sm);
	}
	.stat-num {
		font-size: 24px;
		font-weight: 800;
		color: var(--text-primary);
		font-family: var(--font-display);
	}
	.stat-lbl {
		font-size: 11px;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}

	/* Section Title & Icons */
	.section-icon-box,
	.panel-icon-box {
		width: 44px;
		height: 44px;
		min-width: 44px;
		min-height: 44px;
		flex: 0 0 44px;
		border-radius: var(--radius-md);
		background: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.12);
		border: 1px solid rgba(var(--accent-blue-rgb, 27, 133, 243), 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent-blue-base);
	}
	.section-icon,
	.panel-icon {
		font-size: 24px;
	}

	/* Specs Section */
	.specs-section {
		padding: 24px 28px;
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.section-top-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.section-title-wrap {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.section-title {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}
	.section-sub {
		font-size: 13px;
		color: var(--text-secondary);
		margin: 2px 0 0;
	}
	.specs-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 12px;
	}
	.spec-tab-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		padding: 14px 18px;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		cursor: pointer;
		transition: all 0.25s var(--ease-spring);
		text-align: left;
		position: relative;
	}
	.spec-tab-btn:hover {
		background: var(--bg-surface-hover);
		transform: translateY(-2px);
		border-color: var(--tab-color);
	}
	.spec-tab-btn.active {
		background: rgba(var(--tab-rgb), 0.12);
		border-color: var(--tab-color);
		box-shadow: 0 4px 20px rgba(var(--tab-rgb), 0.22);
	}
	.spec-tab-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}
	.spec-tab-header .spec-icon {
		font-size: 22px;
	}
	.spec-tab-count {
		font-size: 11px;
		font-weight: 800;
		padding: 2px 7px;
		border-radius: var(--radius-full);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
	}
	.spec-tab-btn.active .spec-tab-count {
		background: var(--tab-color);
		color: #ffffff;
		border-color: transparent;
	}
	.spec-tab-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--text-primary);
	}
	.spec-tab-dim {
		font-size: 11.5px;
		color: var(--text-secondary);
		font-family: var(--font-mono, monospace);
	}

	/* Spec Detail Card */
	.spec-detail-card {
		padding: 22px;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: 16px;
		border-left: 4px solid var(--active-color);
	}
	.spec-card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 16px 22px;
	}
	.spec-metric {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.metric-label {
		font-size: 11.5px;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 600;
	}
	.metric-val {
		font-size: 14px;
		font-weight: 700;
		color: var(--text-primary);
	}
	.spec-accent-text {
		color: var(--active-color);
	}
	.metric-use {
		font-weight: 500;
		font-size: 13px;
		line-height: 1.4;
	}
	.spec-tip-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-radius: var(--radius-sm);
		background: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.1);
		border: 1px solid rgba(var(--aero-amber-rgb, 245, 166, 35), 0.28);
		font-size: 13px;
		color: var(--text-primary);
	}
	.tip-icon {
		font-size: 20px;
		color: var(--aero-amber);
		flex: 0 0 20px;
	}

	/* Workbench Grid */
	.workbench-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
	}
	@media (max-width: 900px) {
		.workbench-grid {
			grid-template-columns: 1fr;
		}
	}

	.upload-panel,
	.simulator-panel {
		padding: 24px 28px;
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.panel-header {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.panel-title {
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}
	.panel-sub {
		font-size: 12.5px;
		color: var(--text-secondary);
		margin: 2px 0 0;
	}

	/* Dropzone */
	.dropzone {
		position: relative;
		border: 2px dashed var(--border-subtle);
		border-radius: var(--radius-lg);
		padding: 24px;
		background: var(--bg-surface);
		transition: all 0.25s var(--ease-spring);
		cursor: pointer;
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 190px;
	}
	.dropzone:hover,
	.dropzone.dragging {
		border-color: var(--accent-blue-base);
		background: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.06);
	}
	.file-input-hidden {
		display: none;
	}
	.dropzone-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 8px;
		cursor: pointer;
		width: 100%;
	}
	.drop-icon-wrap .material-icons-round {
		font-size: 44px;
	}
	.drop-text-main {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
	}
	.drop-text-main .highlight {
		color: var(--accent-blue-base);
		text-decoration: underline;
	}
	.drop-text-sub {
		font-size: 12px;
		color: var(--text-secondary);
	}

	/* Theme-Aware Checkerboard Pattern for transparency */
	.stage-checkerboard {
		background-color: var(--bg-surface);
		background-image:
			linear-gradient(45deg, var(--border-subtle) 25%, transparent 25%),
			linear-gradient(-45deg, var(--border-subtle) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, var(--border-subtle) 75%),
			linear-gradient(-45deg, transparent 75%, var(--border-subtle) 75%);
		background-size: 16px 16px;
		background-position:
			0 0,
			0 8px,
			8px -8px,
			-8px 0px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.preview-frame {
		padding: 16px;
		min-width: 140px;
		min-height: 140px;
		border: 1px solid var(--border-subtle);
		box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.08);
	}
	.preview-stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	.uploaded-preview-img {
		object-fit: contain;
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
	}
	.preview-controls {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.btn-action-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: var(--radius-full);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}
	.btn-action-pill:hover {
		background: var(--bg-surface-hover);
		transform: translateY(-1px);
	}
	.btn-change-file:hover {
		border-color: var(--accent-blue-base);
		color: var(--accent-blue-base);
	}
	.btn-remove-file:hover {
		border-color: #ef4444;
		color: #ef4444;
	}

	/* Measurement Feedback Card */
	.measurement-feedback {
		padding: 16px 18px;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.feedback-header {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
	}
	.feedback-header .material-icons-round {
		font-size: 18px;
		color: var(--aero-mint);
	}
	.feedback-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.metric-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: var(--radius-sm);
		font-size: 12px;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-secondary);
	}
	.metric-pill .material-icons-round {
		font-size: 15px;
	}
	.metric-pill.valid {
		border-color: rgba(var(--aero-mint-rgb, 0, 212, 170), 0.45);
		background: rgba(var(--aero-mint-rgb, 0, 212, 170), 0.12);
		color: var(--aero-mint);
	}
	.metric-pill.invalid {
		border-color: rgba(239, 68, 68, 0.45);
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}
	.errors-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 4px;
	}
	.error-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: #ef4444;
		background: rgba(239, 68, 68, 0.08);
		padding: 6px 10px;
		border-radius: var(--radius-xs);
		border-left: 3px solid #ef4444;
	}
	.error-item .material-icons-round {
		font-size: 16px;
		flex: 0 0 16px;
	}

	/* Form Inputs */
	.form-inputs-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-top: 14px;
	}
	@media (max-width: 600px) {
		.form-inputs-row {
			grid-template-columns: 1fr;
		}
	}
	.input-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.input-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
	}
	.input-hint {
		font-size: 11px;
		color: var(--text-secondary);
		opacity: 0.8;
	}
	.aero-input {
		padding: 10px 14px;
		border-radius: var(--radius-md);
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		font-size: 14px;
		outline: none;
		transition: all 0.2s;
	}
	.aero-input:focus {
		border-color: var(--accent-blue-base);
		box-shadow: 0 0 0 3px rgba(var(--accent-blue-rgb, 27, 133, 243), 0.15);
	}
	.shortcode-input-wrapper {
		display: flex;
		align-items: center;
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 0 10px;
		transition: all 0.2s;
	}
	.shortcode-input-wrapper:focus-within {
		border-color: var(--accent-blue-base);
		box-shadow: 0 0 0 3px rgba(var(--accent-blue-rgb, 27, 133, 243), 0.15);
	}
	.shortcode-input-wrapper .code-bracket {
		color: var(--accent-blue-base);
		font-weight: 800;
		font-size: 16px;
		user-select: none;
	}
	.shortcode-field {
		border: none !important;
		background: transparent !important;
		padding: 10px 6px;
		width: 100%;
		color: var(--text-primary);
		font-family: var(--font-mono, monospace);
		font-size: 14px;
		outline: none;
	}
	.form-actions {
		margin-top: 18px;
	}
	.submit-btn {
		width: 100%;
		padding: 12px 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.25s var(--ease-spring);
	}
	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none !important;
		box-shadow: none !important;
	}

	/* Alerts */
	.alert-box {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		border-radius: var(--radius-md);
		font-size: 13px;
		margin-top: 12px;
	}
	.alert-error {
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.35);
		color: #ef4444;
	}
	.alert-success {
		background: rgba(var(--aero-mint-rgb, 0, 212, 170), 0.12);
		border: 1px solid rgba(var(--aero-mint-rgb, 0, 212, 170), 0.35);
		color: var(--aero-mint);
	}

	/* Simulator Stage */
	.sim-tabs {
		display: flex;
		gap: 8px;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 12px;
		flex-wrap: wrap;
	}
	.sim-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: var(--radius-sm);
		background: transparent;
		border: none;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s;
	}
	.sim-tab.active {
		background: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.15);
		color: var(--accent-blue-base);
	}
	.sim-tab .material-icons-round {
		font-size: 16px;
	}

	.sim-test-input-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
	}
	.sim-test-icon {
		font-size: 18px;
		color: var(--text-secondary);
	}
	.sim-test-input {
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-primary);
		font-size: 13px;
		width: 100%;
	}

	.sim-viewport {
		min-height: 280px;
		padding: 20px;
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.sim-chat-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.sim-msg {
		display: flex;
		gap: 10px;
		max-width: 85%;
		align-items: flex-end;
	}
	.sim-msg.incoming {
		align-self: flex-start;
	}
	.sim-msg.outgoing {
		align-self: flex-end;
		justify-content: flex-end;
	}
	.sim-avatar-wrap {
		flex: 0 0 32px;
		min-width: 32px;
		min-height: 32px;
	}
	.sim-bubble {
		padding: 10px 14px;
		border-radius: 16px 16px 16px 4px;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		font-size: 13.5px;
		color: var(--text-primary);
	}
	.outgoing-bubble {
		border-radius: 16px 16px 4px 16px;
		background: linear-gradient(
			135deg,
			var(--accent-blue-base) 0%,
			var(--accent-blue-dark, #1265c2) 100%
		);
		color: #ffffff;
		border: none;
		box-shadow: 0 4px 14px rgba(var(--accent-blue-rgb, 27, 133, 243), 0.3);
	}
	.sim-author {
		font-size: 11px;
		font-weight: 700;
		color: var(--accent-blue-base);
		margin-bottom: 2px;
	}
	.sim-meta {
		font-size: 10px;
		opacity: 0.7;
		text-align: right;
		margin-top: 4px;
	}
	.sim-asset-container {
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
		margin: 0 4px;
	}
	.sim-asset-container.sticker,
	.sim-asset-container.gif {
		display: block;
		margin: 8px 0;
	}
	.inline-sim-asset {
		object-fit: contain;
	}
	.inline-sim-asset.asset-emoji {
		width: 24px;
		height: 24px;
	}
	.inline-sim-asset.asset-emote {
		width: 32px;
		height: 32px;
	}
	.inline-sim-asset.asset-sticker {
		width: 90px;
		height: 90px;
		filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.2));
	}
	.inline-sim-asset.asset-gif {
		width: 130px;
		height: 130px;
		border-radius: var(--radius-sm);
	}
	.sim-shortcode-tag {
		display: inline-block;
		padding: 2px 8px;
		border-radius: var(--radius-xs);
		background: rgba(0, 0, 0, 0.25);
		font-family: var(--font-mono, monospace);
		font-size: 12px;
		color: #ffffff;
		margin: 0 3px;
	}

	/* Comment Simulator */
	.sim-comment-item {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.sim-comment-content {
		flex: 1;
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
	}
	.sim-comment-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}
	.sim-comment-user {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
	}
	.sim-time-tag {
		font-size: 11px;
		color: var(--text-secondary);
		opacity: 0.7;
	}
	.sim-comment-text {
		margin: 0 0 6px;
		font-size: 13.5px;
		color: var(--text-primary);
	}
	.comment-asset-display {
		margin-top: 6px;
	}
	.comment-sim-asset {
		object-fit: contain;
	}
	.comment-sim-asset.asset-emoji {
		width: 28px;
		height: 28px;
	}
	.comment-sim-asset.asset-emote {
		width: 36px;
		height: 36px;
	}
	.comment-sim-asset.asset-sticker {
		width: 100px;
		height: 100px;
	}
	.comment-sim-asset.asset-gif {
		width: 140px;
		height: 140px;
		border-radius: var(--radius-sm);
	}

	/* Reaction Simulator */
	.sim-reaction-prompt {
		font-size: 12px;
		color: var(--text-secondary);
		margin-bottom: 8px;
		font-weight: 600;
	}
	.sim-post-dummy {
		padding: 16px;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.dummy-post-header {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.dummy-author {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
		display: block;
	}
	.dummy-handle {
		font-size: 11px;
		color: var(--text-secondary);
		display: block;
	}
	.dummy-post-text {
		font-size: 13.5px;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.4;
	}
	.reaction-pills-row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.reaction-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		border-radius: var(--radius-full);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		font-size: 12px;
		color: var(--text-secondary);
		transition: all 0.2s var(--ease-spring);
	}
	.reaction-pill.active-pill {
		background: rgba(var(--aero-mint-rgb, 0, 212, 170), 0.15);
		border-color: var(--aero-mint);
		color: var(--aero-mint);
	}
	.pill-sim-asset {
		width: 20px;
		height: 20px;
		object-fit: contain;
	}
	.pill-icon {
		font-size: 18px;
	}

	/* Vault Section */
	.vault-section {
		padding: 28px 32px;
		border-radius: var(--radius-xl);
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.vault-top-bar {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 20px;
		flex-wrap: wrap;
	}
	.vault-title-wrap {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.vault-controls {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-end;
	}
	@media (max-width: 800px) {
		.vault-controls {
			align-items: flex-start;
			width: 100%;
		}
	}
	.vault-search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		border-radius: var(--radius-md);
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
		min-width: 280px;
	}
	.vault-search-input {
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-primary);
		font-size: 13px;
		width: 100%;
	}
	.search-icon {
		font-size: 18px;
		color: var(--text-secondary);
	}
	.btn-clear-search {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		padding: 0;
	}
	.btn-clear-search .material-icons-round {
		font-size: 16px;
	}
	.filter-pills {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.filter-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 14px;
		border-radius: var(--radius-full);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}
	.filter-pill:hover {
		background: var(--bg-surface-hover);
		border-color: var(--accent-blue-base);
	}
	.filter-pill.active {
		background: var(--accent-blue-base);
		color: #ffffff;
		border-color: var(--accent-blue-base);
		box-shadow: 0 4px 14px rgba(var(--accent-blue-rgb, 27, 133, 243), 0.3);
	}
	.filter-count {
		font-size: 11px;
		opacity: 0.85;
	}

	/* Assets Grid */
	.assets-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 20px;
	}
	.asset-card {
		padding: 16px;
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
		gap: 12px;
		transition:
			transform 0.25s var(--ease-spring),
			box-shadow 0.25s;
	}
	.asset-card:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-md);
		border-color: var(--accent-blue-base);
	}
	.asset-card-thumb-wrap {
		position: relative;
		height: 130px;
		width: 100%;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
	}
	.asset-card-img {
		max-height: 96px;
		max-width: 96px;
		object-fit: contain;
		filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.2));
	}
	.asset-type-badge {
		position: absolute;
		top: 8px;
		left: 8px;
		font-size: 10px;
		font-weight: 800;
		padding: 3px 8px;
		border-radius: var(--radius-xs);
		background: var(--badge-color);
		color: #ffffff;
		letter-spacing: 0.05em;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}
	.asset-type-badge.badge-emoji {
		background: #00d4aa;
		color: #042f2e;
	}
	.asset-type-badge.badge-emote {
		background: #1b85f3;
		color: #ffffff;
	}
	.asset-type-badge.badge-sticker {
		background: #f5a623;
		color: #451a03;
	}
	.asset-type-badge.badge-gif {
		background: #ec4899;
		color: #ffffff;
	}

	.asset-card-body {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.asset-card-name {
		font-size: 14px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.asset-specs-strip {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.spec-pill {
		font-size: 11px;
		padding: 2px 7px;
		border-radius: var(--radius-xs);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		font-family: var(--font-mono, monospace);
	}
	.spec-pill.anim-pill {
		background: rgba(var(--aero-rose-rgb, 236, 72, 153), 0.15);
		border-color: rgba(var(--aero-rose-rgb, 236, 72, 153), 0.35);
		color: var(--aero-rose);
		font-weight: 700;
	}
	.shortcode-copy-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.copy-code-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		border-radius: var(--radius-sm);
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}
	.copy-code-btn:hover {
		border-color: var(--accent-blue-base);
		background: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.1);
	}
	.copy-code-btn.copied {
		border-color: var(--aero-mint);
		background: rgba(var(--aero-mint-rgb, 0, 212, 170), 0.15);
	}
	.code-text {
		font-family: var(--font-mono, monospace);
		font-size: 12px;
		color: var(--accent-blue-base);
		font-weight: 700;
	}
	.copy-code-btn.copied .code-text {
		color: var(--aero-mint);
	}
	.icon-copy {
		font-size: 15px;
		color: var(--text-secondary);
	}
	.btn-delete-asset {
		padding: 6px;
		border-radius: var(--radius-sm);
		background: transparent;
		border: 1px solid transparent;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.btn-delete-asset:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.12);
		border-color: rgba(239, 68, 68, 0.3);
	}
	.asset-author-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-secondary);
		padding-top: 4px;
		border-top: 1px solid var(--border-subtle);
	}
	.author-label {
		font-weight: 600;
	}

	/* Empty State */
	.empty-vault,
	.loading-state {
		padding: 48px 32px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		border-radius: var(--radius-lg);
		color: var(--text-secondary);
	}
	.empty-icon-wrap {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--bg-surface-hover);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.empty-icon {
		font-size: 36px;
		opacity: 0.6;
	}
	.empty-title {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}
	.empty-desc {
		font-size: 13.5px;
		max-width: 480px;
		margin: 0;
		line-height: 1.5;
	}

	/* Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(10px);
		z-index: var(--z-modal-backdrop, 500);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.modal-box {
		width: 100%;
		max-width: 460px;
		padding: 28px;
		border-radius: var(--radius-xl);
		display: flex;
		flex-direction: column;
		gap: 18px;
		z-index: var(--z-modal-content, 600);
		box-shadow: var(--shadow-lg);
	}
	.modal-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.modal-icon-wrap {
		width: 40px;
		height: 40px;
		min-width: 40px;
		min-height: 40px;
		border-radius: var(--radius-md);
		background: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.modal-icon-warn {
		font-size: 24px;
		color: var(--aero-amber);
	}
	.modal-title {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}
	.modal-text {
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0;
	}
	.modal-text code {
		color: var(--accent-blue-base);
		background: var(--bg-surface);
		padding: 2px 6px;
		border-radius: var(--radius-xs);
		font-family: var(--font-mono, monospace);
		font-weight: 700;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 8px;
		flex-wrap: wrap;
	}

	/* Spin */
	.spin {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}
</style>
