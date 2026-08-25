/**
 * Performance & Optimization Store (Svelte 5 Runes)
 * VSocial Engine - Gestor centralizado de rendimiento, aceleración de GPU,
 * perfiles de bajo consumo, optimización de DOM y diagnósticos en tiempo real.
 */

// ── Variables de Estado Reactivo (Svelte 5 Runes) ──────────────────────────
let _perfProfile = $state('balanced'); // 'lite' | 'balanced' | 'high' | 'custom'
let _perfMode = $state(false); // Bandera booleana para perfiles Lite / bajo consumo
let _glassBlur = $state('subtle'); // 'full' | 'subtle' | 'none'
let _reduceMotion = $state(false);
let _disableLiquidBg = $state(false);
let _disableNoise = $state(true); // Desactivar ruido SVG por defecto optimiza notablemente
let _simplifyShadows = $state(false);
let _contentVisibility = $state(true); // Defer renderizado de tarjetas fuera de pantalla
let _videoAutoplay = $state('wifi'); // 'always' | 'wifi' | 'never'
let _dataSaver = $state(false);
let _viewTransitions = $state('fast'); // 'enabled' | 'fast' | 'disabled'
let _fpsHud = $state(false);
let _gpuAcceleration = $state(true); // Aceleración GPU por capas (will-change / translateZ)
let _routePreload = $state('hover'); // 'hover' | 'tap' | 'off'
let _disableHoverGlow = $state(false); // Suprime cálculos de iluminación en hover

let _hardwareInfo = $state({
	cores: 4,
	memoryGB: null,
	gpuVendor: 'Desconocido',
	gpuRenderer: 'Aceleración estándar',
	connectionType: '4g',
	downlink: null,
	rtt: null,
	screenRefreshRate: 60,
	batteryLevel: null,
	batteryCharging: null,
	storageUsedMB: null,
	storageTotalMB: null,
	isLowEnd: false,
	recommendedProfile: 'balanced',
	detected: false
});

let _benchmarkState = $state({
	isRunning: false,
	progress: 0,
	fps: 0,
	minFps: 0,
	avgFps: 0,
	frameTimeMs: 0,
	droppedFrames: 0,
	score: null,
	recommendedProfile: null
});

// Listener cleanup references
let _batteryUnsub = null;
let _connectionUnsub = null;

/**
 * Sincroniza todos los atributos de rendimiento directamente en <html> y <body> para que
 * las reglas CSS de alto rendimiento respondan de manera inmediata y sin repintados dobles.
 */
function syncDomAttributes() {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;

	const isLite = _perfProfile === 'lite';
	root.setAttribute('data-perf-mode', isLite ? 'true' : 'false');
	root.setAttribute('data-perf-profile', _perfProfile);
	root.setAttribute('data-glass-blur', _glassBlur);
	root.setAttribute('data-reduced-motion', _reduceMotion ? 'true' : 'false');
	root.setAttribute('data-disable-liquid-bg', _disableLiquidBg || isLite ? 'true' : 'false');
	root.setAttribute('data-disable-noise', _disableNoise || isLite ? 'true' : 'false');
	root.setAttribute('data-simplify-shadows', _simplifyShadows || isLite ? 'true' : 'false');
	root.setAttribute('data-content-visibility', _contentVisibility ? 'true' : 'false');
	root.setAttribute('data-video-autoplay', _videoAutoplay);
	root.setAttribute('data-data-saver', _dataSaver ? 'true' : 'false');
	root.setAttribute('data-view-transitions', _viewTransitions);
	root.setAttribute('data-fps-hud', _fpsHud ? 'true' : 'false');
	root.setAttribute('data-gpu-acceleration', _gpuAcceleration && !isLite ? 'true' : 'false');
	root.setAttribute('data-disable-hover-glow', _disableHoverGlow || isLite ? 'true' : 'false');

	if (document.body) {
		document.body.setAttribute('data-sveltekit-preload-data', _routePreload);
	}
}

/**
 * Detecta si la configuración actual coincide con alguno de los presets predefinidos.
 */
function calculateCurrentProfile() {
	if (
		_glassBlur === 'none' &&
		!_reduceMotion &&
		_disableLiquidBg &&
		_disableNoise &&
		_simplifyShadows &&
		_contentVisibility &&
		_videoAutoplay === 'never' &&
		_dataSaver &&
		!_gpuAcceleration &&
		_routePreload === 'off' &&
		_disableHoverGlow
	) {
		return 'lite';
	}
	if (
		_glassBlur === 'subtle' &&
		!_reduceMotion &&
		!_disableLiquidBg &&
		_disableNoise &&
		!_simplifyShadows &&
		_contentVisibility &&
		_videoAutoplay === 'wifi' &&
		!_dataSaver &&
		_viewTransitions === 'fast' &&
		_gpuAcceleration &&
		_routePreload === 'hover' &&
		!_disableHoverGlow
	) {
		return 'balanced';
	}
	if (
		_glassBlur === 'full' &&
		!_reduceMotion &&
		!_disableLiquidBg &&
		!_disableNoise &&
		!_simplifyShadows &&
		!_contentVisibility &&
		_videoAutoplay === 'always' &&
		!_dataSaver &&
		_viewTransitions === 'enabled' &&
		_gpuAcceleration &&
		_routePreload === 'hover' &&
		!_disableHoverGlow
	) {
		return 'high';
	}
	return 'custom';
}

export const perfStore = {
	// Getters
	get perfProfile() {
		return _perfProfile;
	},
	get perfMode() {
		return _perfProfile === 'lite';
	},
	get glassBlur() {
		return _glassBlur;
	},
	get reduceMotion() {
		return _reduceMotion;
	},
	get disableLiquidBg() {
		return _disableLiquidBg;
	},
	get disableNoise() {
		return _disableNoise;
	},
	get simplifyShadows() {
		return _simplifyShadows;
	},
	get contentVisibility() {
		return _contentVisibility;
	},
	get videoAutoplay() {
		return _videoAutoplay;
	},
	get dataSaver() {
		return _dataSaver;
	},
	get viewTransitions() {
		return _viewTransitions;
	},
	get fpsHud() {
		return _fpsHud;
	},
	get gpuAcceleration() {
		return _gpuAcceleration;
	},
	get routePreload() {
		return _routePreload;
	},
	get disableHoverGlow() {
		return _disableHoverGlow;
	},
	get hardwareInfo() {
		return _hardwareInfo;
	},
	get benchmarkState() {
		return _benchmarkState;
	},

	/**
	 * Inicializa el store desde localStorage y ejecuta el diagnóstico de hardware.
	 */
	init() {
		if (typeof window === 'undefined') return;

		// Idempotente: layout, LiquidBackground y componentes de gamificación
		// llaman init() en el mismo arranque. Re-ejecutar detectHardware()/
		// measureScreenRefreshRate() crearía varios contextos WebGL y varios
		// bucles rAF de medición por carga de página; con la primera pasada
		// basta y a las siguientes solo les corresponde re-sincronizar DOM.
		if (this._initialized) {
			syncDomAttributes();
			return;
		}
		this._initialized = true;

		try {
			// Migración legacy: si solo existe la bandera antigua perf_mode=true,
			// se interpreta como perfil Lite canónico (y applyPreset persiste las
			// claves nuevas). Antes quedaba un estado híbrido sin efecto real.
			const savedProfile =
				localStorage.getItem('vsocial_perf_profile') ||
				(localStorage.getItem('vsocial_perf_mode') === 'true' ? 'lite' : null);
			const savedBlur = localStorage.getItem('vsocial_glass_blur');
			const savedMotion = localStorage.getItem('vsocial_reduce_motion');
			const savedBg = localStorage.getItem('vsocial_disable_liquid_bg');
			const savedNoise = localStorage.getItem('vsocial_disable_noise');
			const savedShadows = localStorage.getItem('vsocial_simplify_shadows');
			const savedContentVis = localStorage.getItem('vsocial_content_visibility');
			const savedAutoplay = localStorage.getItem('vsocial_video_autoplay');
			const savedDataSaver = localStorage.getItem('vsocial_data_saver');
			const savedTransitions = localStorage.getItem('vsocial_view_transitions');
			const savedFpsHud = localStorage.getItem('vsocial_fps_hud');
			const savedGpu = localStorage.getItem('vsocial_gpu_acceleration');
			const savedPreload = localStorage.getItem('vsocial_route_preload');
			const savedHoverGlow = localStorage.getItem('vsocial_disable_hover_glow');

			if (savedProfile) _perfProfile = savedProfile;
			_perfMode = _perfProfile === 'lite';
			if (savedBlur) _glassBlur = savedBlur;
			if (savedMotion !== null) _reduceMotion = savedMotion === 'true';
			if (savedBg !== null) _disableLiquidBg = savedBg === 'true';
			if (savedNoise !== null) _disableNoise = savedNoise === 'true';
			if (savedShadows !== null) _simplifyShadows = savedShadows === 'true';
			if (savedContentVis !== null) _contentVisibility = savedContentVis === 'true';
			if (savedAutoplay) _videoAutoplay = savedAutoplay;
			if (savedDataSaver !== null) _dataSaver = savedDataSaver === 'true';
			if (savedTransitions) {
				_viewTransitions = savedTransitions;
			}
			if (savedFpsHud !== null) _fpsHud = savedFpsHud === 'true';
			if (savedGpu !== null) _gpuAcceleration = savedGpu === 'true';
			if (savedPreload) _routePreload = savedPreload;
			if (savedHoverGlow !== null) _disableHoverGlow = savedHoverGlow === 'true';

			// Migración: un perfil guardado (lite/balanced/high) es la fuente canónica
			// de TODOS sus valores. Re-aplicarlo repara combinaciones escritas por
			// versiones anteriores del store — p. ej. balanced con simplify_shadows
			// activado, que aplanaba la luminosidad y hacía perder los efectos clave
			// del modo. Si el perfil es 'custom', se respetan los ajustes individuales.
			if (savedProfile === 'lite' || savedProfile === 'balanced' || savedProfile === 'high') {
				this.applyPreset(savedProfile);
			}

			// Diagnóstico de hardware + medición de Hz: crean un contexto WebGL y
			// animan un rAF propio durante ~500ms. Se difieren a tiempo libre para
			// que nunca compitan con el arranque/primera pintura (donde más pesan
			// justamente en los equipos modestos que usan el perfil Lite).
			const whenIdle =
				typeof requestIdleCallback === 'function'
					? (cb) => requestIdleCallback(cb, { timeout: 2000 })
					: (cb) => setTimeout(cb, 1200);
			whenIdle(() => {
				this.detectHardware();
				this.measureScreenRefreshRate();
			});
			syncDomAttributes();
		} catch (_e) {
			console.warn('[perfStore] Error reading performance settings from localStorage');
		}
	},

	/**
	 * Diagnostica los componentes de hardware (CPU, RAM, GPU, Red, Batería y Almacenamiento).
	 */
	detectHardware() {
		if (typeof window === 'undefined' || typeof navigator === 'undefined') return _hardwareInfo;

		const cores = navigator.hardwareConcurrency || 4;
		const memoryGB = navigator.deviceMemory || null;

		// Extracción de GPU / WebGL Vendor y Renderer
		let gpuVendor = 'Genérica / Desconocida';
		let gpuRenderer = 'Renderizador estándar';
		try {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
			if (gl) {
				const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
				if (debugInfo) {
					gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || gpuVendor;
					gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || gpuRenderer;
				} else {
					gpuVendor = gl.getParameter(gl.VENDOR) || gpuVendor;
					gpuRenderer = gl.getParameter(gl.RENDERER) || gpuRenderer;
				}
			}
		} catch (_glErr) {}

		// Extracción de Estado de Red
		const connection =
			navigator.connection || navigator.mozConnection || navigator.webkitConnection;
		const connectionType = connection?.effectiveType || '4g';
		const downlink = connection?.downlink || null;
		const rtt = connection?.rtt || null;

		// Listener reactivo de red
		if (connection && !_connectionUnsub) {
			const handleConnChange = () => {
				_hardwareInfo.connectionType = connection.effectiveType || '4g';
				_hardwareInfo.downlink = connection.downlink || null;
				_hardwareInfo.rtt = connection.rtt || null;
			};
			connection.addEventListener('change', handleConnChange);
			_connectionUnsub = () => connection.removeEventListener('change', handleConnChange);
		}

		// Heurística de perfil recomendado
		const isLowEnd =
			cores <= 4 ||
			(memoryGB !== null && memoryGB <= 4) ||
			connectionType === '2g' ||
			connectionType === '3g' ||
			/mali|adreno\s*(3|4|5)|intel\s*hd\s*graphics/i.test(gpuRenderer);

		const recommendedProfile = isLowEnd
			? 'lite'
			: cores >= 8 && (!memoryGB || memoryGB >= 8)
				? 'high'
				: 'balanced';

		_hardwareInfo = {
			..._hardwareInfo,
			cores,
			memoryGB,
			gpuVendor,
			gpuRenderer,
			connectionType,
			downlink,
			rtt,
			isLowEnd,
			recommendedProfile,
			detected: true
		};

		// Consulta asíncrona y listener de Batería (si el navegador lo soporta)
		if (typeof navigator.getBattery === 'function' && !_batteryUnsub) {
			navigator
				.getBattery()
				.then((battery) => {
					const updateBattery = () => {
						_hardwareInfo.batteryLevel = Math.round(battery.level * 100);
						_hardwareInfo.batteryCharging = battery.charging;

						if (!battery.charging && battery.level <= 0.2) {
							_hardwareInfo.isLowEnd = true;
						}
					};
					updateBattery();
					battery.addEventListener('levelchange', updateBattery);
					battery.addEventListener('chargingchange', updateBattery);
					_batteryUnsub = () => {
						battery.removeEventListener('levelchange', updateBattery);
						battery.removeEventListener('chargingchange', updateBattery);
					};
				})
				.catch(() => {});
		}

		// Consulta asíncrona de Almacenamiento Local
		this.refreshStorageEstimate();

		return _hardwareInfo;
	},

	/**
	 * Mide con precisión la tasa de refresco nativa de la pantalla (Hz).
	 */
	measureScreenRefreshRate() {
		if (typeof window === 'undefined' || !window.requestAnimationFrame) return;

		let frames = 0;
		let startTime = null;

		const checkHz = (timestamp) => {
			if (!startTime) startTime = timestamp;
			frames++;

			const elapsed = timestamp - startTime;
			if (elapsed < 500) {
				requestAnimationFrame(checkHz);
			} else {
				const calculatedHz = Math.round((frames * 1000) / elapsed);
				// Normalizar a estándares comunes (60, 75, 90, 120, 144, 240)
				let normalizedHz = 60;
				if (calculatedHz >= 200) normalizedHz = 240;
				else if (calculatedHz >= 135) normalizedHz = 144;
				else if (calculatedHz >= 110) normalizedHz = 120;
				else if (calculatedHz >= 85) normalizedHz = 90;
				else if (calculatedHz >= 70) normalizedHz = 75;
				else if (calculatedHz >= 50) normalizedHz = 60;
				else normalizedHz = calculatedHz;

				_hardwareInfo.screenRefreshRate = normalizedHz;
			}
		};

		requestAnimationFrame(checkHz);
	},

	/**
	 * Actualiza la estimación de almacenamiento de la API StorageManager.
	 */
	async refreshStorageEstimate() {
		if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
			try {
				const estimate = await navigator.storage.estimate();
				_hardwareInfo.storageUsedMB = estimate.usage
					? Math.round((estimate.usage / (1024 * 1024)) * 10) / 10
					: null;
				_hardwareInfo.storageTotalMB = estimate.quota
					? Math.round((estimate.quota / (1024 * 1024)) * 10) / 10
					: null;
			} catch (_e) {}
		}
	},

	/**
	 * Ejecuta un benchmark interactivo de 3 segundos midiendo estabilidad y FPS en vivo.
	 */
	async runBenchmark() {
		if (typeof window === 'undefined' || _benchmarkState.isRunning) return null;

		_benchmarkState = {
			isRunning: true,
			progress: 0,
			fps: 0,
			minFps: 999,
			avgFps: 0,
			frameTimeMs: 0,
			droppedFrames: 0,
			score: null,
			recommendedProfile: null
		};

		return new Promise((resolve) => {
			const durationMs = 3000;
			let start = null;
			let lastFrame = null;
			let frameCount = 0;
			const frameTimes = [];
			let dropped = 0;

			const step = (now) => {
				if (!start) {
					start = now;
					lastFrame = now;
				}

				const delta = now - lastFrame;
				lastFrame = now;
				frameCount++;

				if (delta > 0) {
					frameTimes.push(delta);
					if (delta > 25) dropped++; // Frame > 25ms (caída visible)
				}

				const elapsed = now - start;
				_benchmarkState.progress = Math.min(100, Math.round((elapsed / durationMs) * 100));

				if (elapsed < durationMs) {
					requestAnimationFrame(step);
				} else {
					const avgDelta = frameTimes.reduce((a, b) => a + b, 0) / (frameTimes.length || 1);
					const calculatedFps = Math.round((frameCount * 1000) / elapsed);
					const maxDelta = Math.max(...frameTimes, 16.6);
					const calculatedMinFps = Math.max(1, Math.round(1000 / maxDelta));

					// Puntuación de 0 a 100 basada en FPS, fluidez y frames caídos
					const targetFps = _hardwareInfo.screenRefreshRate || 60;
					const fpsRatio = Math.min(1.2, calculatedFps / targetFps);
					const dropPenalty = Math.min(30, dropped * 3);
					const score = Math.max(10, Math.min(100, Math.round(fpsRatio * 100 - dropPenalty)));

					let recProfile = 'balanced';
					if (score < 60 || calculatedFps < 45 || dropped > 8) {
						recProfile = 'lite';
					} else if (score >= 88 && calculatedFps >= 58 && dropped <= 2) {
						recProfile = 'high';
					}

					_benchmarkState = {
						isRunning: false,
						progress: 100,
						fps: calculatedFps,
						minFps: calculatedMinFps,
						avgFps: calculatedFps,
						frameTimeMs: Math.round(avgDelta * 10) / 10,
						droppedFrames: dropped,
						score,
						recommendedProfile: recProfile
					};

					resolve(_benchmarkState);
				}
			};

			requestAnimationFrame(step);
		});
	},

	// ── Setters y Acciones ───────────────────────────────────────────────────

	setPerfMode(enabled) {
		if (enabled) {
			this.applyPreset('lite');
		} else {
			this.applyPreset('balanced');
		}
	},

	setPerfProfile(profile) {
		this.applyPreset(profile);
	},

	setGlassBlur(mode) {
		_glassBlur = mode;
		this._persistKey('vsocial_glass_blur', _glassBlur);
		this._updateProfileState();
	},

	setReduceMotion(enabled) {
		_reduceMotion = !!enabled;
		this._persistKey('vsocial_reduce_motion', _reduceMotion ? 'true' : 'false');
		this._updateProfileState();
	},

	setDisableLiquidBg(enabled) {
		_disableLiquidBg = !!enabled;
		this._persistKey('vsocial_disable_liquid_bg', _disableLiquidBg ? 'true' : 'false');
		this._updateProfileState();
	},

	setDisableNoise(enabled) {
		_disableNoise = !!enabled;
		this._persistKey('vsocial_disable_noise', _disableNoise ? 'true' : 'false');
		this._updateProfileState();
	},

	setSimplifyShadows(enabled) {
		_simplifyShadows = !!enabled;
		this._persistKey('vsocial_simplify_shadows', _simplifyShadows ? 'true' : 'false');
		this._updateProfileState();
	},

	setContentVisibility(enabled) {
		_contentVisibility = !!enabled;
		this._persistKey('vsocial_content_visibility', _contentVisibility ? 'true' : 'false');
		this._updateProfileState();
	},

	setVideoAutoplay(mode) {
		_videoAutoplay = mode;
		this._persistKey('vsocial_video_autoplay', _videoAutoplay);
		this._updateProfileState();
	},

	setDataSaver(enabled) {
		_dataSaver = !!enabled;
		this._persistKey('vsocial_data_saver', _dataSaver ? 'true' : 'false');
		this._updateProfileState();
	},

	setViewTransitions(mode) {
		_viewTransitions = mode;
		this._persistKey('vsocial_view_transitions', _viewTransitions);
		this._updateProfileState();
	},

	setFpsHud(enabled) {
		_fpsHud = !!enabled;
		this._persistKey('vsocial_fps_hud', _fpsHud ? 'true' : 'false');
		syncDomAttributes();
	},

	setGpuAcceleration(enabled) {
		_gpuAcceleration = !!enabled;
		this._persistKey('vsocial_gpu_acceleration', _gpuAcceleration ? 'true' : 'false');
		this._updateProfileState();
	},

	setRoutePreload(mode) {
		_routePreload = mode;
		this._persistKey('vsocial_route_preload', _routePreload);
		this._updateProfileState();
	},

	setDisableHoverGlow(enabled) {
		_disableHoverGlow = !!enabled;
		this._persistKey('vsocial_disable_hover_glow', _disableHoverGlow ? 'true' : 'false');
		this._updateProfileState();
	},

	/**
	 * Aplica un preset integral (Lite, Balanced, High).
	 */
	applyPreset(presetId) {
		_perfProfile = presetId;

		if (presetId === 'lite') {
			_perfMode = true;
			_glassBlur = 'none';
			_reduceMotion = false;
			_disableLiquidBg = true;
			_disableNoise = true;
			_simplifyShadows = true;
			_contentVisibility = true;
			_videoAutoplay = 'never';
			_dataSaver = true;
			_viewTransitions = 'disabled'; // el más barato (fundido lineal de rescate, 0.16s)
			_gpuAcceleration = false;
			_routePreload = 'off';
			_disableHoverGlow = true;
		} else if (presetId === 'balanced') {
			_perfMode = false;
			_glassBlur = 'subtle';
			_reduceMotion = false;
			_disableLiquidBg = false;
			_disableNoise = true;
			_simplifyShadows = false; // Equilibrado conserva su nivel propio de luminosidad (3B); simplificar es cosa de Lite
			_contentVisibility = true;
			_videoAutoplay = 'wifi';
			_dataSaver = false;
			_viewTransitions = 'fast';
			_gpuAcceleration = true;
			_routePreload = 'hover';
			_disableHoverGlow = false;
		} else if (presetId === 'high') {
			_perfMode = false;
			_glassBlur = 'full';
			_reduceMotion = false;
			_disableLiquidBg = false;
			_disableNoise = false;
			_simplifyShadows = false;
			_contentVisibility = false;
			_videoAutoplay = 'always';
			_dataSaver = false;
			_viewTransitions = 'enabled';
			_gpuAcceleration = true;
			_routePreload = 'hover';
			_disableHoverGlow = false;
		}

		this._persistAll();
		syncDomAttributes();
	},

	/**
	 * Restablece los valores a los predeterminados equilibrados de fábrica.
	 */
	resetDefaults() {
		this.applyPreset('balanced');
	},

	/**
	 * Aplica la configuración recomendada de acuerdo al diagnóstico de hardware.
	 */
	applyRecommendedSettings() {
		const rec = _hardwareInfo.recommendedProfile || 'balanced';
		this.applyPreset(rec);
		return rec;
	},

	/**
	 * Verifica si la reproducción de video automática está permitida en el entorno actual.
	 */
	allowsAutoplay() {
		if (_videoAutoplay === 'never') return false;
		if (_videoAutoplay === 'always') return true;
		// 'wifi': no reproducir automáticamente si estamos en conexiones lentas o datos móviles 2g/3g
		const conn = _hardwareInfo.connectionType;
		if (conn === '2g' || conn === '3g' || conn === 'slow-2g') return false;
		return true;
	},

	/**
	 * Limpia cachés temporales en localStorage, sessionStorage y CacheStorage API sin cerrar sesión.
	 */
	async clearLocalCache() {
		if (typeof window === 'undefined') return { keysRemoved: 0, cachesCleared: 0 };
		let keysRemoved = 0;
		let cachesCleared = 0;

		try {
			// Claves críticas a preservar (sesión, tema, usuario, preferencias de UI
			// y ajustes de rendimiento). Antes solo se protegían las de rendimiento:
			// la limpieza borraba consentimiento de cookies, micrófono seleccionado,
			// sonido de chat, borradores, volumen de reels, etc.
			const preserveKeys = new Set([
				'vsocial_token',
				'vsocial_user',
				'vsocial_theme',
				'vsocial_cookie_consent',
				'vsocial_pwa_dismissed',
				'vsocial_saved_identifier',
				'vsocial_mic_id',
				'vsocial_chat_sound',
				'vs_sidebar_expanded',
				'vsocial_lb_deltas_v1',
				'vsocial_post_create_draft',
				'vsocial_reel_volume',
				'vsocial_reel_muted',
				'vsocial_reel_autonext',
				'vsocial_perf_profile',
				'vsocial_perf_mode',
				'vsocial_glass_blur',
				'vsocial_reduce_motion',
				'vsocial_disable_liquid_bg',
				'vsocial_disable_noise',
				'vsocial_simplify_shadows',
				'vsocial_content_visibility',
				'vsocial_video_autoplay',
				'vsocial_data_saver',
				'vsocial_view_transitions',
				'vsocial_fps_hud',
				'vsocial_gpu_acceleration',
				'vsocial_route_preload',
				'vsocial_disable_hover_glow'
			]);

			// Limpieza de claves de caché en localStorage
			const keysToClean = [];
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i);
				if (k && !preserveKeys.has(k)) {
					keysToClean.push(k);
				}
			}
			for (const k of keysToClean) {
				localStorage.removeItem(k);
				keysRemoved++;
			}

			// Limpieza de sessionStorage
			sessionStorage.clear();

			// Limpieza profunda de Cache Storage API (Service Worker / Media caches)
			if (typeof window.caches !== 'undefined') {
				try {
					const cacheNames = await window.caches.keys();
					for (const name of cacheNames) {
						await window.caches.delete(name);
						cachesCleared++;
					}
				} catch (_cErr) {}
			}

			await this.refreshStorageEstimate();
		} catch (_e) {
			console.warn('[perfStore] Error during cache cleanup');
		}

		return { keysRemoved, cachesCleared };
	},

	_updateProfileState() {
		_perfProfile = calculateCurrentProfile();
		_perfMode = _perfProfile === 'lite';
		this._persistKey('vsocial_perf_profile', _perfProfile);
		syncDomAttributes();
	},

	_persistKey(key, value) {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(key, value);
		}
	},

	_persistAll() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem('vsocial_perf_profile', _perfProfile);
		localStorage.setItem('vsocial_glass_blur', _glassBlur);
		localStorage.setItem('vsocial_reduce_motion', _reduceMotion ? 'true' : 'false');
		localStorage.setItem('vsocial_disable_liquid_bg', _disableLiquidBg ? 'true' : 'false');
		localStorage.setItem('vsocial_disable_noise', _disableNoise ? 'true' : 'false');
		localStorage.setItem('vsocial_simplify_shadows', _simplifyShadows ? 'true' : 'false');
		localStorage.setItem('vsocial_content_visibility', _contentVisibility ? 'true' : 'false');
		localStorage.setItem('vsocial_video_autoplay', _videoAutoplay);
		localStorage.setItem('vsocial_data_saver', _dataSaver ? 'true' : 'false');
		localStorage.setItem('vsocial_view_transitions', _viewTransitions);
		localStorage.setItem('vsocial_fps_hud', _fpsHud ? 'true' : 'false');
		localStorage.setItem('vsocial_gpu_acceleration', _gpuAcceleration ? 'true' : 'false');
		localStorage.setItem('vsocial_route_preload', _routePreload);
		localStorage.setItem('vsocial_disable_hover_glow', _disableHoverGlow ? 'true' : 'false');
	}
};
