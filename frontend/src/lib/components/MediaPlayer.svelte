<script module>
	// Registro global de players activos: garantiza que solo uno reproduzca a la vez
	// y evita que decenas de <video> del feed decodifiquen en paralelo (causa de trabones).
	const activePlayers = new Set();

	function pauseOthers(current) {
		for (const el of activePlayers) {
			if (el !== current && !el.paused) {
				try {
					el.pause();
				} catch (_) {}
			}
		}
	}
</script>

<script>
	import { onDestroy } from 'svelte';
	import { activity as activityApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { perfStore } from '$lib/stores/perf.svelte.js';

	/**
	 * MediaPlayer — Reproductor unificado de Voom! (Glassmorphism 2.0 / Neo-Aero).
	 *
	 * API pública (drop-in compatible con feed, lightbox, stories y chat):
	 *   src, type ('video'|'audio'), poster, class, autoplay, entityId, entityType.
	 *
	 * Capacidades: dock de cristal flotante, gestos de doble toque lateral (±10s)
	 * y central (fullscreen), PiP, velocidades 0.5x–2x, bucle, atajos de teclado,
	 * Media Session del SO, autoplay por IntersectionObserver (umbral 35%) con
	 * exclusividad de reproducción y tracking de vistas (≥3s o ≥25%).
	 */

	let {
		src,
		type = 'video',
		poster = null,
		class: className = '',
		autoplay = false,
		entityId = null,
		entityType = null,
		aspectRatio = null
	} = $props();

	let effectiveAutoplay = $derived(autoplay && perfStore.allowsAutoplay());
	// Ahorro de datos: pospone la descarga hasta que el usuario pulse reproducir.
	// 'metadata' (por defecto) descarga cabeceras + primer fotograma; 'none' no
	// descarga nada hasta play() explícito.
	let effectivePreload = $derived(perfStore.dataSaver ? 'none' : 'metadata');

	// Normalizar el ratio de aspecto pasado por props (ej. '16:9', '9:16', '1/1', etc.)
	function formatAspect(val) {
		if (!val) return '';
		if (typeof val === 'number') return `${val}`;
		const str = String(val).trim();
		if (str.includes(':')) return str.replace(':', ' / ');
		return str;
	}

	let initialAspect = $derived(formatAspect(aspectRatio));
	let effectiveAspect = $derived(stageAspect || initialAspect || '');

	// Preview instantánea: sin thumbnail del servidor, el fragmento temporal
	// '#t=0.001' obliga al navegador a pintar el primer fotograma real durante
	// el preload="metadata" en lugar de dejar un lienzo negro.
	let playbackSrc = $derived.by(() => {
		if (!src || type !== 'video' || poster) return src;
		return /#t=/i.test(src) ? src : `${src}#t=0.001`;
	});

	// ── Estado del medio ─────────────────────────────────────────────────────
	let playerWrapper = $state();
	let videoElement = $state();
	let paused = $state(true);
	let currentTime = $state(0);
	let duration = $state(0);
	let volume = $state(1);
	let muted = $state(false);

	// ── UI de controles ──────────────────────────────────────────────────────
	let showControls = $state(true);
	let hideTimeout;
	let showSettings = $state(false);
	let playbackRate = $state(1);
	let showRemaining = $state(false);
	let isLooping = $state(false);
	let isFullscreen = $state(false);

	// ── Panel "Acerca de" ────────────────────────────────────────────────────
	let showAbout = $state(false);
	let aboutClosing = $state(false);
	let aboutCloseTimer;

	function openAbout() {
		clearTimeout(aboutCloseTimer);
		aboutClosing = false;
		showAbout = true;
	}
	function closeAbout() {
		if (!showAbout) return;
		// Dispara la animación de fade-out y desmonta al terminar
		aboutClosing = true;
		clearTimeout(aboutCloseTimer);
		aboutCloseTimer = setTimeout(() => {
			showAbout = false;
			aboutClosing = false;
		}, 260);
	}

	// ── Buffer / hover de la línea de tiempo ─────────────────────────────────
	let buffered = $state();
	let isBuffering = $state(false);
	let timelineHoverPercent = $state(0);
	let isHoveringTimeline = $state(false);

	// ── Dimensiones del medio: evita colapso vertical antes de metadata ──────
	let hasDimensions = $state(false);
	let stageAspect = $state('');

	// ── Iluminación ambiental reactiva (Ultra-fluida a 60 FPS, bajo consumo) ──
	// Ajuste "Luz ambiental de vídeo": cada fotograma reproducido se redibuja en
	// un canvas por cada player visible. En feeds con varios vídeos eso es GPU/CPU
	// continua; desactivarlo lo elimina sin tocar los controles del reproductor.
	let ambientCanvas = $state();
	let activeAmbientCallback = null;

	function startAmbientSync() {
		if (!perfStore.videoAmbientLight) return;
		if (!videoElement || !ambientCanvas) return;
		stopAmbientSync();

		const w = videoElement.videoWidth || 32;
		const h = videoElement.videoHeight || 32;
		const targetH = Math.round((32 * h) / (w || 1)) || 32;
		if (ambientCanvas.width !== 32 || ambientCanvas.height !== targetH) {
			ambientCanvas.width = 32;
			ambientCanvas.height = targetH;
		}

		const ctx = ambientCanvas.getContext('2d', {
			alpha: false,
			willReadFrequently: false,
			desynchronized: true
		});
		if (!ctx) return;

		let isRunning = true;

		function drawFrame() {
			if (!isRunning || !videoElement || videoElement.paused || videoElement.ended) return;

			if (videoElement.readyState >= 2 || videoElement.currentTime > 0) {
				try {
					ctx.drawImage(videoElement, 0, 0, ambientCanvas.width, ambientCanvas.height);
				} catch (_) {}
			}

			if (
				'requestVideoFrameCallback' in HTMLVideoElement.prototype &&
				videoElement.requestVideoFrameCallback
			) {
				const handle = videoElement.requestVideoFrameCallback(drawFrame);
				activeAmbientCallback = { type: 'rvfc', handle };
			} else {
				const handle = requestAnimationFrame(drawFrame);
				activeAmbientCallback = { type: 'raf', handle };
			}
		}

		drawFrame();
	}

	function stopAmbientSync() {
		if (activeAmbientCallback) {
			if (
				activeAmbientCallback.type === 'rvfc' &&
				videoElement &&
				'cancelVideoFrameCallback' in videoElement
			) {
				videoElement.cancelVideoFrameCallback(activeAmbientCallback.handle);
			} else if (activeAmbientCallback.type === 'raf') {
				cancelAnimationFrame(activeAmbientCallback.handle);
			}
			activeAmbientCallback = null;
		}
	}

	function drawSingleAmbientFrame() {
		if (!perfStore.videoAmbientLight) return;
		if (!videoElement || !ambientCanvas) return;
		try {
			const w = videoElement.videoWidth || 32;
			const h = videoElement.videoHeight || 32;
			const targetH = Math.round((32 * h) / (w || 1)) || 32;
			if (ambientCanvas.width !== 32 || ambientCanvas.height !== targetH) {
				ambientCanvas.width = 32;
				ambientCanvas.height = targetH;
			}
			const ctx = ambientCanvas.getContext('2d', {
				alpha: false,
				willReadFrequently: false,
				desynchronized: true
			});
			if (ctx && (videoElement.readyState >= 1 || videoElement.videoWidth > 0)) {
				ctx.drawImage(videoElement, 0, 0, ambientCanvas.width, ambientCanvas.height);
			}
		} catch (_) {}
	}

	$effect(() => {
		if (ambientCanvas && videoElement && type === 'video') {
			drawSingleAmbientFrame();
		}
	});

	// ── Menús y feedback gestual ─────────────────────────────────────────────
	let contextMenu = $state({ show: false, x: 0, y: 0 });
	let centerAction = $state({ show: false, icon: 'play_arrow', id: 0 });
	let sideRipple = $state({ show: false, side: 'left', id: 0 });
	let centerActionCounter = 0;
	let sideRippleCounter = 0;

	// ── Rendimiento: pausar fuera de viewport + reanudar ─────────────────────
	let wasPlayingBeforeHidden = false;
	let viewLogged = false;

	// ── Arrastre (timeline / volumen) ────────────────────────────────────────
	let isDraggingTimeline = $state(false);
	let isDraggingVolume = $state(false);
	let isDraggingAudioTimeline = $state(false);
	let timelineRect = null;
	let volumeRect = null;
	let audioTimelineRect = null;
	let wasPausedBeforeDrag = false;

	// ── Detección de toques: simple vs doble por zonas laterales ─────────────
	const SINGLE_TAP_DELAY = 260;
	const DOUBLE_TAP_WINDOW = 260;
	let tapTimer;
	let lastTapTime = 0;
	let tapStartX = 0;
	let tapStartY = 0;

	// Soporte Picture-in-Picture (SSR-safe)
	let pipSupported = $derived(
		typeof document !== 'undefined' && !!document.pictureInPictureEnabled
	);

	// ── Derivados ────────────────────────────────────────────────────────────
	let progressPercentage = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
	let volumePercentage = $derived(muted ? 0 : volume * 100);
	let hoverTime = $derived(duration * timelineHoverPercent);
	let remainingTime = $derived(Math.max(0, duration - currentTime));
	// El tooltip se amarra a [8%, 92%] para no desbordar los bordes del track
	let tooltipPercent = $derived(Math.min(92, Math.max(8, timelineHoverPercent * 100)));
	let cursorHidden = $derived(
		type === 'video' &&
			!showControls &&
			!paused &&
			!showSettings &&
			!contextMenu.show &&
			!isDraggingTimeline &&
			!isDraggingAudioTimeline
	);

	let bufferPercentage = $derived.by(() => {
		if (!buffered || buffered.length === 0 || duration === 0) return 0;
		// Rango de búfer más lejano descargado
		let maxBuffer = 0;
		for (let i = 0; i < buffered.length; i++) {
			if (buffered[i].end > maxBuffer) {
				maxBuffer = buffered[i].end;
			}
		}
		return (maxBuffer / duration) * 100;
	});

	const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

	// ── Feedback central (morph play/pausa/skip) ─────────────────────────────
	function triggerCenterAnimation(icon) {
		const id = ++centerActionCounter;
		centerAction = { show: true, icon, id };
		setTimeout(() => {
			// Solo ocultar si sigue siendo la misma animación (no una más reciente)
			if (centerAction.id === id) {
				centerAction = { ...centerAction, show: false };
			}
		}, 600);
	}

	// ── Ripple lateral estilo TikTok para el seek por doble toque ────────────
	function triggerSideRipple(side) {
		const id = ++sideRippleCounter;
		sideRipple = { show: true, side, id };
		setTimeout(() => {
			if (sideRipple.id === id) {
				sideRipple = { ...sideRipple, show: false };
			}
		}, 620);
	}

	// ── Play / pausa ─────────────────────────────────────────────────────────
	function togglePlay(e) {
		if (e) e.stopPropagation();
		if (!videoElement) return;
		if (paused) {
			videoElement.play();
			triggerCenterAnimation('play_arrow');
		} else {
			videoElement.pause();
			triggerCenterAnimation('pause');
		}
	}

	// ── Registro de visualización (una sola vez, tras ~3s o 25% reproducido) ─
	function maybeLogView() {
		if (viewLogged || !entityId || !entityType || !authStore?.isAuthenticated) return;
		if (currentTime < 3 && progressPercentage < 25) return;
		viewLogged = true;
		activityApi.view({ entity_type: entityType, entity_id: entityId }).catch(() => {});
	}

	// ── Skip ±N segundos ─────────────────────────────────────────────────────
	function skip(seconds) {
		if (!videoElement || !duration) return;
		videoElement.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
		currentTime = videoElement.currentTime;
		triggerCenterAnimation(seconds > 0 ? 'forward_10' : 'replay_10');
	}

	// ── Gestos sobre el escenario: toque simple = play/pausa, doble por zonas ─
	function handleStagePointerDown(e) {
		tapStartX = e.clientX;
		tapStartY = e.clientY;
	}

	function handleStageTap(e) {
		if (!playerWrapper) return;
		// Descartar arrastres/scrolls: solo toques limpios disparan acciones
		if (Math.abs(e.clientX - tapStartX) > 12 || Math.abs(e.clientY - tapStartY) > 12) return;

		const now = performance.now();

		// Un toque sobre el video cierra primero los menús abiertos (sin alternar playback)
		if (contextMenu.show) {
			contextMenu.show = false;
			lastTapTime = now;
			return;
		}
		if (showSettings) {
			showSettings = false;
			lastTapTime = now;
			return;
		}

		const isDoubleTap = type === 'video' && now - lastTapTime <= DOUBLE_TAP_WINDOW;
		lastTapTime = now;
		clearTimeout(tapTimer);

		if (isDoubleTap) {
			const rect = playerWrapper.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const width = rect.width || 1;
			if (x < width / 3) {
				skip(-10);
				triggerSideRipple('left');
			} else if (x > (width * 2) / 3) {
				skip(10);
				triggerSideRipple('right');
			} else {
				toggleFullscreen();
			}
			return;
		}

		// Toque simple: decidir tras la ventana de doble toque (evita play/pausa fantasma)
		tapTimer = setTimeout(() => {
			tapTimer = undefined;
			togglePlay();
		}, SINGLE_TAP_DELAY);
	}

	// ── Visibilidad automática de controles ──────────────────────────────────
	function handleMouseMove() {
		if (type === 'audio') return;
		showControls = true;
		clearTimeout(hideTimeout);
		if (!paused && !showSettings && !isDraggingTimeline && !contextMenu.show) {
			hideTimeout = setTimeout(() => {
				showControls = false;
			}, 2500);
		}
	}

	function handleMouseLeave() {
		if (type === 'audio') return;
		if (!paused && !showSettings && !isDraggingTimeline && !contextMenu.show) {
			showControls = false;
		}
		showSettings = false;
	}

	$effect(() => {
		if (paused) {
			showControls = true;
			clearTimeout(hideTimeout);
		} else {
			handleMouseMove();
		}
	});

	// Ratio nativo del medio una vez conocida la metadata (estabiliza la caja)
	function syncStageAspect(el) {
		if (!el) return;
		const w = el.videoWidth || 0;
		const h = el.videoHeight || 0;
		if (w > 0 && h > 0) {
			stageAspect = `${w} / ${h}`;
			hasDimensions = true;
		}
		// Sin poster: forzar la decodificación del fotograma inicial en navegadores
		// que requieren seek real para pintar el lienzo con preload="metadata".
		if (!poster && el.paused && el.currentTime === 0) {
			try {
				el.currentTime = 0.001;
			} catch (_) {}
		}
		drawSingleAmbientFrame();
	}

	// Cambio de fuente: volver al estado de carga (ratio garantizado) hasta nueva metadata
	$effect(() => {
		void src;
		hasDimensions = false;
		stageAspect = '';
		stopAmbientSync();
	});

	// ── Enlace al elemento <video>/<audio> ───────────────────────────────────
	$effect(() => {
		if (videoElement) {
			if (videoElement.readyState >= 1) {
				duration = videoElement.duration || 0;
				currentTime = videoElement.currentTime || 0;
				syncStageAspect(videoElement);
			}
			isLooping = !!videoElement.loop;
			const el = videoElement;
			activePlayers.add(el);

			const updateMeta = () => {
				duration = el.duration || 0;
				syncStageAspect(el);
			};
			const updateTime = () => {
				if (!isDraggingTimeline && !isDraggingAudioTimeline) {
					currentTime = el.currentTime || 0;
				}
				maybeLogView();
			};
			// Al reproducir, pausar cualquier otro player activo (solo uno suena a la vez)
			const onPlay = () => {
				pauseOthers(el);
				syncMediaSession();
				startAmbientSync();
			};
			const onPause = () => {
				syncMediaSession();
				stopAmbientSync();
				drawSingleAmbientFrame();
			};
			const onLoadedData = () => {
				syncStageAspect(el);
				drawSingleAmbientFrame();
			};
			const onCanPlay = () => {
				syncStageAspect(el);
				drawSingleAmbientFrame();
			};
			const onSeeked = () => {
				drawSingleAmbientFrame();
			};

			el.addEventListener('loadedmetadata', updateMeta);
			el.addEventListener('loadeddata', onLoadedData);
			el.addEventListener('canplay', onCanPlay);
			el.addEventListener('canplaythrough', onCanPlay);
			el.addEventListener('seeked', onSeeked);
			el.addEventListener('durationchange', updateMeta);
			el.addEventListener('timeupdate', updateTime);
			el.addEventListener('play', onPlay);
			el.addEventListener('pause', onPause);
			return () => {
				el.removeEventListener('loadedmetadata', updateMeta);
				el.removeEventListener('loadeddata', onLoadedData);
				el.removeEventListener('canplay', onCanPlay);
				el.removeEventListener('canplaythrough', onCanPlay);
				el.removeEventListener('seeked', onSeeked);
				el.removeEventListener('durationchange', updateMeta);
				el.removeEventListener('timeupdate', updateTime);
				el.removeEventListener('play', onPlay);
				el.removeEventListener('pause', onPause);
				stopAmbientSync();
				activePlayers.delete(el);
			};
		}
	});

	// ── IntersectionObserver: pausar fuera de viewport, reanudar al volver ───
	$effect(() => {
		if (!playerWrapper || type === 'audio') return;
		const wrapper = playerWrapper;
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry.isIntersecting) {
					// Fuera de vista: si estaba reproduciendo, pausar y recordar
					if (videoElement && !videoElement.paused) {
						wasPlayingBeforeHidden = true;
						videoElement.pause();
					}
				} else if (wasPlayingBeforeHidden && videoElement) {
					// De vuelta a la vista: reanudar solo si el usuario no lo había pausado
					wasPlayingBeforeHidden = false;
					videoElement.play().catch(() => {});
				}
			},
			{ threshold: 0.35 }
		);
		observer.observe(wrapper);
		return () => observer.disconnect();
	});

	// ── Media Session API: controles del SO / auriculares ────────────────────
	function syncMediaSession() {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !videoElement) return;
		try {
			navigator.mediaSession.playbackState = videoElement.paused ? 'paused' : 'playing';
		} catch (_) {}
	}

	$effect(() => {
		if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || type === 'audio')
			return;
		const ms = navigator.mediaSession;
		const handlers = {
			play: () => videoElement?.play(),
			pause: () => videoElement?.pause(),
			seekbackward: () => skip(-10),
			seekforward: () => skip(10)
		};
		for (const [action, fn] of Object.entries(handlers)) {
			try {
				ms.setActionHandler(action, fn);
			} catch (_) {}
		}
		return () => {
			for (const action of Object.keys(handlers)) {
				try {
					ms.setActionHandler(action, null);
				} catch (_) {}
			}
		};
	});

	// ── Estado reactivo de pantalla completa (icono, controles fijos) ────────
	$effect(() => {
		if (!playerWrapper) return;
		const wrapper = playerWrapper;
		const syncFs = () => {
			isFullscreen =
				document.fullscreenElement === wrapper || document.webkitFullscreenElement === wrapper;
			if (isFullscreen) showControls = true;
		};
		document.addEventListener('fullscreenchange', syncFs);
		document.addEventListener('webkitfullscreenchange', syncFs);
		syncFs();
		return () => {
			document.removeEventListener('fullscreenchange', syncFs);
			document.removeEventListener('webkitfullscreenchange', syncFs);
		};
	});

	function formatTime(seconds) {
		if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	// ── Arrastres: timeline, audio-timeline y volumen ────────────────────────
	function onWindowPointerMove(e) {
		if (isDraggingTimeline && timelineRect) {
			const x = e.clientX - timelineRect.left;
			const percent = Math.max(0, Math.min(1, x / timelineRect.width));
			currentTime = percent * duration;
			timelineHoverPercent = percent;
			if (videoElement) videoElement.currentTime = currentTime;
		}
		if (isDraggingAudioTimeline && audioTimelineRect) {
			const x = e.clientX - audioTimelineRect.left;
			const percent = Math.max(0, Math.min(1, x / audioTimelineRect.width));
			currentTime = percent * duration;
			if (videoElement) videoElement.currentTime = currentTime;
		}
		if (isDraggingVolume && volumeRect) {
			const x = e.clientX - volumeRect.left;
			const percent = Math.max(0, Math.min(1, x / volumeRect.width));
			volume = percent;
			muted = volume === 0;
		}
	}

	function onWindowPointerUp() {
		if (isDraggingTimeline || isDraggingAudioTimeline) {
			isDraggingTimeline = false;
			isDraggingAudioTimeline = false;
			if (!wasPausedBeforeDrag && videoElement) videoElement.play();
		}
		if (isDraggingVolume) {
			isDraggingVolume = false;
		}
	}

	function startTimelineDrag(e) {
		e.preventDefault();
		timelineRect = e.currentTarget.getBoundingClientRect();
		isDraggingTimeline = true;
		wasPausedBeforeDrag = paused;
		paused = true;
		onWindowPointerMove(e);
	}

	function startVolumeDrag(e) {
		e.preventDefault();
		volumeRect = e.currentTarget.getBoundingClientRect();
		isDraggingVolume = true;
		onWindowPointerMove(e);
	}

	function startAudioTimelineDrag(e) {
		e.preventDefault();
		audioTimelineRect = e.currentTarget.getBoundingClientRect();
		isDraggingAudioTimeline = true;
		wasPausedBeforeDrag = paused;
		paused = true;
		onWindowPointerMove(e);
	}

	// ── Volumen / silencio ───────────────────────────────────────────────────
	function toggleMute(e) {
		if (e) e.stopPropagation();
		muted = !muted;
		if (!muted && volume === 0) volume = 1;
	}

	// ── Pantalla completa ────────────────────────────────────────────────────
	function toggleFullscreen(e) {
		if (e) e.stopPropagation();
		if (!playerWrapper) return;
		if (isFullscreen) {
			if (document.exitFullscreen) {
				document.exitFullscreen().catch(() => {});
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			}
		} else if (playerWrapper.requestFullscreen) {
			playerWrapper.requestFullscreen().catch(() => {});
		} else if (playerWrapper.webkitRequestFullscreen) {
			playerWrapper.webkitRequestFullscreen();
		}
		showSettings = false;
		contextMenu.show = false;
	}

	// ── Atajos de teclado (solo cuando el foco vive dentro del player) ───────
	function handleKeyDown(e) {
		if (
			!playerWrapper?.contains(document.activeElement) &&
			document.activeElement !== playerWrapper
		)
			return;

		switch (e.key) {
			case 'Escape':
				if (showAbout) {
					e.preventDefault();
					closeAbout();
				} else if (showSettings) {
					showSettings = false;
				} else if (contextMenu.show) {
					contextMenu.show = false;
				}
				break;
			case ' ':
			case 'k':
				e.preventDefault();
				togglePlay();
				break;
			case 'f':
				e.preventDefault();
				toggleFullscreen();
				break;
			case 'm':
				e.preventDefault();
				toggleMute();
				break;
			case 'ArrowRight':
				e.preventDefault();
				if (videoElement) {
					videoElement.currentTime = Math.min(duration, currentTime + 5);
					currentTime = videoElement.currentTime;
					triggerCenterAnimation('forward_5');
				}
				break;
			case 'ArrowLeft':
				e.preventDefault();
				if (videoElement) {
					videoElement.currentTime = Math.max(0, currentTime - 5);
					currentTime = videoElement.currentTime;
					triggerCenterAnimation('replay_5');
				}
				break;
			case 'ArrowUp':
				e.preventDefault();
				volume = Math.min(1, volume + 0.1);
				if (volume > 0) muted = false;
				break;
			case 'ArrowDown':
				e.preventDefault();
				volume = Math.max(0, volume - 0.1);
				if (volume === 0) muted = true;
				break;
		}
		handleMouseMove();
	}

	function changeSpeed(speed) {
		playbackRate = speed;
		if (videoElement) videoElement.playbackRate = speed;
		showSettings = false;
	}

	function setLoop(value, closeMenus = true) {
		isLooping = value;
		if (videoElement) videoElement.loop = value;
		if (closeMenus) {
			closeContextMenu();
			showSettings = false;
		}
	}

	// Navegación de la timeline con teclado (accesibilidad)
	function handleTimelineKey(e) {
		switch (e.key) {
			case 'ArrowRight':
				e.preventDefault();
				skip(5);
				break;
			case 'ArrowLeft':
				e.preventDefault();
				skip(-5);
				break;
			case 'Home':
				e.preventDefault();
				if (videoElement) {
					videoElement.currentTime = 0;
					currentTime = 0;
				}
				break;
			case 'End':
				e.preventDefault();
				if (videoElement && duration) {
					videoElement.currentTime = duration;
					currentTime = duration;
				}
				break;
		}
	}

	async function togglePiP(e) {
		if (e) e.stopPropagation();
		try {
			if (document.pictureInPictureElement) {
				await document.exitPictureInPicture();
			} else if (videoElement?.requestPictureInPicture) {
				await videoElement.requestPictureInPicture();
			}
		} catch (_) {}
		showSettings = false;
		contextMenu.show = false;
	}

	function handleContextMenu(e) {
		if (type === 'audio') return;
		e.preventDefault();
		const wrapperRect = playerWrapper.getBoundingClientRect();
		let x = e.clientX - wrapperRect.left;
		let y = e.clientY - wrapperRect.top;

		if (x + 210 > wrapperRect.width) x = wrapperRect.width - 210;
		if (y + 160 > wrapperRect.height) y = wrapperRect.height - 160;

		contextMenu = { show: true, x, y };
	}

	function closeContextMenu() {
		contextMenu.show = false;
	}

	async function copyVideoUrl() {
		try {
			await navigator.clipboard.writeText(window.location.href);
		} catch (_err) {}
		closeContextMenu();
	}

	// Limpieza de timers al desmontar (evita fugas entre posts virtualizados)
	onDestroy(() => {
		clearTimeout(hideTimeout);
		clearTimeout(tapTimer);
		clearTimeout(aboutCloseTimer);
		stopAmbientSync();
	});
</script>

<svelte:window
	onkeydown={handleKeyDown}
	onclick={() => {
		closeContextMenu();
		showSettings = false;
	}}
	onpointermove={onWindowPointerMove}
	onpointerup={onWindowPointerUp}
/>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	bind:this={playerWrapper}
	class="media-player-wrapper {className} {type}"
	class:is-fullscreen={isFullscreen}
	class:awaiting-meta={!hasDimensions && !initialAspect && type === 'video'}
	role="region"
	aria-label="Reproductor multimedia"
	tabindex="0"
	onmousemove={handleMouseMove}
	onmouseleave={handleMouseLeave}
	oncontextmenu={handleContextMenu}
	style="--mp-aspect: {effectiveAspect || 'auto'}; cursor: {cursorHidden ? 'none' : 'default'};"
>
	{#if type === 'video'}
		<!-- Escenario táctil: toques simples y dobles por zonas. El ratio vive en
		     la custom property --mp-aspect del wrapper (auto / inicial → nativo real). -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="v-stage" onclick={handleStageTap} onpointerdown={handleStagePointerDown}>
			<!-- Canvas ambiental: perfectamente alineado con las dimensiones y coordenadas del vídeo,
			     proyectando el resplandor de forma simétrica y natural hacia los márgenes letterbox/pillarbox -->
			<canvas bind:this={ambientCanvas} class="ambient-canvas" aria-hidden="true"></canvas>

			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={videoElement}
				src={playbackSrc}
				{poster}
				autoplay={effectiveAutoplay}
				bind:paused
				bind:volume
				bind:muted
				bind:buffered
				onwaiting={() => (isBuffering = true)}
				onplaying={() => {
					isBuffering = false;
					startAmbientSync();
				}}
				onpause={() => {
					stopAmbientSync();
					drawSingleAmbientFrame();
				}}
				oncanplay={() => {
					isBuffering = false;
					syncStageAspect(videoElement);
					drawSingleAmbientFrame();
				}}
				onloadedmetadata={() => {
					syncStageAspect(videoElement);
					drawSingleAmbientFrame();
				}}
				onloadeddata={() => {
					syncStageAspect(videoElement);
					drawSingleAmbientFrame();
				}}
				onseeked={() => {
					syncStageAspect(videoElement);
					drawSingleAmbientFrame();
				}}
				ontimeupdate={() => {
					if (videoElement?.paused) drawSingleAmbientFrame();
				}}
				class="v-native-video"
				preload={effectivePreload}
				playsinline
			></video>
		</div>

		<!-- Skeleton glass mientras no existen dimensiones ni poster ni aspect ratio inicial -->
		{#if type === 'video' && !hasDimensions && !poster && !initialAspect}
			<div class="v-skeleton" aria-hidden="true"></div>
		{/if}

		<!-- Ripple lateral estilo TikTok (seek ±10s por doble toque) -->
		{#if sideRipple.show}
			<div class="v-side-ripple {sideRipple.side}" aria-hidden="true">
				<span class="v-side-ring"></span>
				<span class="material-icons-round"
					>{sideRipple.side === 'left' ? 'replay_10' : 'forward_10'}</span
				>
			</div>
		{/if}

		<!-- Feedback central morph (play/pausa/skip) -->
		{#if centerAction.show}
			<div class="v-center-pop" aria-hidden="true">
				<span class="material-icons-round">{centerAction.icon}</span>
			</div>
		{/if}

		{#if isBuffering}
			<div class="v-buffer-card" aria-hidden="true">
				<div class="v-buffer-ring"></div>
			</div>
		{/if}

		<!-- Botón central de reproducción en reposo -->
		{#if paused && !isBuffering}
			<button class="v-idle-play" onclick={togglePlay} aria-label="Reproducir">
				<span class="material-icons-round">play_arrow</span>
			</button>
		{/if}

		<!-- Capa de controles: scrim + dock de cristal + ajustes -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="v-controls-overlay"
			class:visible={showControls}
			onclick={(e) => e.stopPropagation()}
		>
			<div class="v-scrim" aria-hidden="true"></div>

			<div class="v-deck">
				<!-- Línea de tiempo -->
				<div
					class="v-timeline-container"
					role="slider"
					tabindex="0"
					aria-label="Barra de progreso"
					aria-valuemin="0"
					aria-valuemax={duration}
					aria-valuenow={currentTime}
					onkeydown={handleTimelineKey}
					onpointerenter={() => (isHoveringTimeline = true)}
					onpointerleave={() => (isHoveringTimeline = false)}
					onpointermove={(e) => {
						const rect = e.currentTarget.getBoundingClientRect();
						timelineHoverPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
					}}
					onpointerdown={startTimelineDrag}
				>
					<div class="v-timeline-track">
						<div class="v-timeline-buffer" style="width: {bufferPercentage}%"></div>
						<div class="v-timeline-progress" style="width: {progressPercentage}%"></div>
						<div class="v-timeline-thumb" style="left: {progressPercentage}%"></div>
						{#if isHoveringTimeline && duration > 0}
							<div class="v-timeline-tooltip" style="left: {tooltipPercent}%">
								{formatTime(hoverTime)}
							</div>
						{/if}
					</div>
				</div>

				<!-- Fila de controles -->
				<div class="v-buttons-row">
					<button
						class="v-ctrl-btn v-ctrl-play"
						onclick={togglePlay}
						aria-label={paused ? 'Reproducir' : 'Pausar'}
					>
						<span class="material-icons-round">{paused ? 'play_arrow' : 'pause'}</span>
					</button>

					<button
						class="v-ctrl-btn v-hide-narrow"
						onclick={() => skip(-10)}
						aria-label="Retroceder 10 segundos"
					>
						<span class="material-icons-round">replay_10</span>
					</button>
					<button
						class="v-ctrl-btn v-hide-narrow"
						onclick={() => skip(10)}
						aria-label="Avanzar 10 segundos"
					>
						<span class="material-icons-round">forward_10</span>
					</button>

					<div class="v-vol-group">
						<button
							class="v-ctrl-btn"
							onclick={toggleMute}
							aria-label={muted || volume === 0 ? 'Activar sonido' : 'Silenciar'}
						>
							<span class="material-icons-round"
								>{muted || volume === 0
									? 'volume_off'
									: volume < 0.5
										? 'volume_down'
										: 'volume_up'}</span
							>
						</button>
						<div class="v-vol-slider-container">
							<div
								class="v-vol-track"
								role="slider"
								tabindex="-1"
								aria-label="Volumen"
								aria-valuemin="0"
								aria-valuemax="100"
								aria-valuenow={Math.round(volumePercentage)}
								onpointerdown={startVolumeDrag}
							>
								<div class="v-vol-progress" style="width: {volumePercentage}%"></div>
								<div class="v-vol-thumb" style="left: {volumePercentage}%"></div>
							</div>
						</div>
					</div>

					<button
						class="v-time-display"
						onclick={() => (showRemaining = !showRemaining)}
						title="Alternar tiempo restante"
					>
						{#if showRemaining}
							-{formatTime(remainingTime)}
						{:else}
							{formatTime(currentTime)} <span class="v-time-sep">/</span> {formatTime(duration)}
						{/if}
					</button>

					<span class="v-spacer"></span>

					{#if pipSupported}
						<button
							class="v-ctrl-btn v-hide-narrow"
							onclick={togglePiP}
							aria-label="Picture in Picture"
						>
							<span class="material-icons-round">picture_in_picture_alt</span>
						</button>
					{/if}
					<button
						class="v-ctrl-btn"
						class:active={showSettings}
						onclick={() => (showSettings = !showSettings)}
						aria-label="Configuración"
					>
						<span class="material-icons-round v-gear" class:spin={showSettings}>settings</span>
					</button>
					<button class="v-ctrl-btn" onclick={toggleFullscreen} aria-label="Pantalla completa">
						<span class="material-icons-round"
							>{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span
						>
					</button>
				</div>
			</div>

			<!-- Menú de ajustes -->
			{#if showSettings}
				<div class="v-settings-menu">
					<div class="v-menu-header">Velocidad</div>
					<div class="v-speed-grid">
						{#each SPEED_OPTIONS as speed (speed)}
							<button
								class="v-speed-chip"
								class:active={playbackRate === speed}
								onclick={() => changeSpeed(speed)}
							>
								{speed}x
							</button>
						{/each}
					</div>
					<div class="v-menu-divider"></div>
					<button class="v-set-row" onclick={() => setLoop(!isLooping, false)}>
						<span class="material-icons-round">loop</span>
						<span class="v-set-label">Bucle</span>
						<span class="v-switch" class:on={isLooping} aria-hidden="true"></span>
					</button>
					{#if pipSupported}
						<button class="v-set-row" onclick={togglePiP}>
							<span class="material-icons-round">picture_in_picture_alt</span>
							<span class="v-set-label">Picture-in-Picture</span>
						</button>
					{/if}
					<button
						class="v-set-row"
						onclick={(e) => {
							e.stopPropagation();
							openAbout();
							showSettings = false;
						}}
					>
						<span class="material-icons-round">info</span>
						<span class="v-set-label">Acerca de este reproductor</span>
					</button>
				</div>
			{/if}
		</div>

		<!-- Menú contextual (clic derecho) -->
		{#if contextMenu.show}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="v-context-menu"
				style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
				onclick={(e) => e.stopPropagation()}
			>
				<button class="v-context-item" onclick={() => setLoop(!isLooping)}>
					<span class="material-icons-round">loop</span>
					<span>{isLooping ? 'Desactivar bucle' : 'Bucle'}</span>
				</button>
				<button class="v-context-item" onclick={copyVideoUrl}>
					<span class="material-icons-round">link</span>
					<span>Copiar URL del video</span>
				</button>
				{#if pipSupported}
					<button class="v-context-item" onclick={togglePiP}>
						<span class="material-icons-round">picture_in_picture_alt</span>
						<span>Picture in Picture</span>
					</button>
				{/if}
				<div class="v-menu-divider"></div>
				<button
					class="v-context-item"
					onclick={(e) => {
						e.stopPropagation();
						openAbout();
						closeContextMenu();
					}}
				>
					<span class="material-icons-round">info</span>
					<span>Acerca de este reproductor</span>
				</button>
			</div>
		{/if}
	{:else}
		<!-- Píldora de audio (mensajes / chat rápido) -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="v-audio-pill" onclick={(e) => e.stopPropagation()}>
			<audio
				bind:this={videoElement}
				{src}
				autoplay={effectiveAutoplay}
				bind:paused
				bind:volume
				bind:muted
				preload={effectivePreload}
				crossorigin="anonymous"
			></audio>

			<button
				class="v-audio-play"
				onclick={togglePlay}
				aria-label={paused ? 'Reproducir audio' : 'Pausar audio'}
			>
				<span class="material-icons-round">{paused ? 'play_arrow' : 'pause'}</span>
			</button>

			<!-- Ecualizador decorativo: solo anima mientras suena (transform-only) -->
			<div class="v-audio-eq" class:playing={!paused} aria-hidden="true">
				<span></span><span></span><span></span><span></span>
			</div>

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="v-audio-timeline"
				class:dragging={isDraggingAudioTimeline}
				onpointerdown={startAudioTimelineDrag}
			>
				<div class="v-audio-track">
					<div class="v-audio-progress" style="width: {progressPercentage}%"></div>
					<div class="v-audio-thumb" style="left: {progressPercentage}%"></div>
				</div>
			</div>

			<span class="v-audio-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
		</div>
	{/if}

	<!-- Panel "Acerca de" estilo macOS con marca Neo-Aero -->
	{#if showAbout}
		<div
			class="v-about-backdrop"
			class:closing={aboutClosing}
			onclick={(e) => {
				e.stopPropagation();
				closeAbout();
			}}
			role="presentation"
		>
			<div
				class="v-about-panel"
				class:closing={aboutClosing}
				role="dialog"
				tabindex="-1"
				aria-label="Acerca de este reproductor"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => {
					if (e.key === 'Escape') closeAbout();
				}}
			>
				<button class="v-about-close" onclick={closeAbout} aria-label="Cerrar"></button>
				<div class="v-about-logo">
					<span class="material-icons-round">play_circle</span>
				</div>
				<div class="v-about-title">Reproductor de Voom!</div>
				<div class="v-about-sub">Neo-Aero · Glassmorphism 2.0</div>
				<div class="v-about-shortcuts">
					<span class="v-about-kbd"><kbd>Espacio/K</kbd> Reproducir</span>
					<span class="v-about-kbd"><kbd>F</kbd> Pantalla completa</span>
					<span class="v-about-kbd"><kbd>M</kbd> Silenciar</span>
					<span class="v-about-kbd"><kbd>&#8592;/&#8594;</kbd> ±5 s</span>
					<span class="v-about-kbd"><kbd>Doble toque</kbd> ±10 s</span>
				</div>
				<div class="v-about-info" class:closing={aboutClosing}>
					<div class="v-about-version">Versión v0.6.0-beta.2</div>
					<div class="v-about-copy">© 2026 Voom! · AGPLv3</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* ═══════════════════════════ Base del reproductor ════════════════════════ */
	.media-player-wrapper {
		/* Tokens locales del player (cristal inmersivo oscuro que respeta el nivel de rendimiento) */
		--mp-blur: var(--glass-blur, blur(14px) saturate(1.15));
		--mp-glass-strong: rgba(6, 12, 21, 0.84);
		--mp-glass: rgba(10, 20, 34, 0.58);
		--mp-border: rgba(255, 255, 255, 0.14);
		--mp-border-t: rgba(255, 255, 255, 0.32);
		--mp-text: #f4f9ff;
		--mp-text-dim: rgba(226, 240, 252, 0.66);
		--mp-accent: var(--accent-blue-light, #2eb4ff);
		--mp-grad: var(--grad-primary, linear-gradient(90deg, #0ea5e9, #10b981));
		--mp-font-mono: ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Consolas, monospace;

		position: relative;
		width: 100%;
		border-radius: var(--radius-md);
		overflow: hidden;
		clip-path: inset(0 round var(--radius-md));
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		isolation: isolate;
		border: 1px solid rgba(120, 170, 220, 0.16);
		box-shadow: 0 10px 30px rgba(2, 8, 15, 0.35);
		outline: none;
		container-type: inline-size;
		contain: paint;
		transform: translateZ(0);

		/* Tokens geométricos del player: ratio + tope de altura del escenario */
		--mp-max-h: min(75vh, 650px);
	}

	.media-player-wrapper:focus-visible {
		border-color: var(--mp-accent);
		box-shadow:
			0 0 0 2px rgba(46, 180, 255, 0.35),
			0 10px 30px rgba(2, 8, 15, 0.35);
	}

	/* Cuando el player es un video de feed (no reels), dejar que el padre controle la altura */
	.media-player-wrapper.video-solo,
	.media-player-wrapper.video-grid {
		max-height: none;
	}

	/* ═══ Iluminación ambiental reactiva (Ultra-fluida y delimitada al marco) ═ */
	.ambient-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		filter: blur(28px) brightness(0.7) saturate(1.4);
		z-index: 1;
		pointer-events: none;
		transform: scale(1.35, 1) translateZ(0);
		transform-origin: center center;
		will-change: transform;
		contain: strict;
		opacity: 1;
		transition: opacity 0.3s ease;
	}

	:global([data-perf-mode='true']) .ambient-canvas {
		filter: blur(16px) brightness(0.7) saturate(1.4);
		transform: scale(1.25, 1) translateZ(0);
	}

	/* ═══════════════════════════ Escenario del video ═════════════════════════ */
	/* Ratio dinámico multiformato (16:9 / 9:16 / 4:3 / 1:1) con contención
	   ergonómica. REGLA CLAVE: el tope de altura (--mp-max-h) vive EN EL MISMO
	   elemento que el aspect-ratio; así la caja se encoge a sí misma y el
	   contenido hace letterbox con object-fit:contain — jamás se recorta. Es
	   inerte cuando el contexto impone altura definida (grid, fullscreen). */
	.v-stage {
		width: 100%;
		height: 100%;
		aspect-ratio: var(--mp-aspect, auto);
		max-height: var(--mp-max-h);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: inherit;
		position: relative;
		z-index: 2;
		overflow: hidden;
		border-radius: inherit;
	}

	.v-native-video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		background: transparent;
		position: relative;
		z-index: 2;
	}

	/* ═══ Estado de carga: suelo mínimo hasta que exista metadata ═════════════ */
	/* Sin dimensiones intrínsecas el <video> colapsa (300×150 por defecto):
	   aquí solo se garantiza una altura mínima neutral mientras se resuelve la metadata
	   sin asumir un ratio forzado de 16/9. Al cargar metadata, syncStageAspect() fija
	   el ratio nativo exacto en --mp-aspect sin saltos bruscos. */
	.media-player-wrapper.awaiting-meta .v-stage {
		min-height: 200px;
	}

	/* ═══ Skeleton de carga (shimmer transform-only) ══════════════════════════ */
	.v-skeleton {
		position: absolute;
		inset: 0;
		z-index: 2;
		overflow: hidden;
		background: linear-gradient(160deg, rgba(14, 24, 38, 0.9) 0%, rgba(4, 10, 18, 0.95) 100%);
		pointer-events: none;
	}

	.v-skeleton::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -70%;
		width: 70%;
		transform: skewX(-12deg);
		background: linear-gradient(
			100deg,
			transparent 0%,
			rgba(255, 255, 255, 0.06) 55%,
			rgba(46, 180, 255, 0.06) 68%,
			transparent 100%
		);
		animation: vShimmer 1.7s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}

	@keyframes vShimmer {
		from {
			transform: translateX(0) skewX(-12deg);
		}
		to {
			transform: translateX(250%) skewX(-12deg);
		}
	}

	/* ═══════════════════════════ Scrims (opacidad pura) ══════════════════════ */
	.v-scrim {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.32s cubic-bezier(0.4, 0, 0.2, 1);
		background:
			linear-gradient(to bottom, rgba(2, 10, 18, 0.42) 0%, transparent 17%),
			linear-gradient(to top, rgba(2, 10, 18, 0.68) 0%, transparent 32%);
	}

	.v-controls-overlay.visible .v-scrim {
		opacity: 1;
	}

	/* ═══════════════════════════ Capa de controles ═══════════════════════════ */
	.v-controls-overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		overflow: hidden;
	}

	/* Dock de cristal flotante (Neo-Aero): borde especular superior + volumen interno */
	.v-deck {
		position: relative;
		margin: 0 12px 12px;
		padding: 2px 12px 7px;
		border-radius: var(--radius-lg);
		background: linear-gradient(to top, var(--mp-glass-strong), var(--mp-glass));
		border: 1px solid var(--mp-border);
		border-top-color: var(--mp-border-t);
		box-shadow:
			0 14px 36px rgba(2, 8, 15, 0.45),
			inset 0 1px 1px rgba(255, 255, 255, 0.16);
		backdrop-filter: var(--mp-blur);
		-webkit-backdrop-filter: var(--mp-blur);
		display: flex;
		flex-direction: column;
		gap: 2px;
		pointer-events: auto;
		/* Entrada/salida solo con transform + opacity (+visibility) */
		transform: translateY(16px);
		opacity: 0;
		visibility: hidden;
		transition:
			transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1),
			opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0.42s;
	}

	.v-controls-overlay.visible .v-deck {
		transform: translateY(0);
		opacity: 1;
		visibility: visible;
	}

	/* ═══════════════════════════ Línea de tiempo ═════════════════════════════ */
	.v-timeline-container {
		width: 100%;
		height: 22px;
		display: flex;
		align-items: center;
		cursor: pointer;
		position: relative;
		touch-action: none;
		outline: none;
	}

	.v-timeline-container:focus-visible .v-timeline-thumb {
		transform: translate(-50%, -50%) scale(1);
		box-shadow:
			0 0 0 2px var(--mp-accent),
			0 0 12px rgba(46, 180, 255, 0.55);
	}

	.v-timeline-track {
		width: 100%;
		height: 4px;
		background: rgba(255, 255, 255, 0.18);
		border-radius: 99px;
		position: relative;
		transition: height 0.22s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.v-timeline-container:hover .v-timeline-track,
	.v-timeline-container:focus-visible .v-timeline-track {
		height: 7px;
	}

	.v-timeline-buffer {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		background: rgba(255, 255, 255, 0.32);
		border-radius: inherit;
		transition: width 0.25s linear;
	}

	.v-timeline-progress {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		background: var(--mp-grad);
		border-radius: inherit;
		box-shadow: 0 0 12px rgba(14, 165, 233, 0.5);
	}

	.v-timeline-thumb {
		position: absolute;
		top: 50%;
		width: 13px;
		height: 13px;
		background: #fff;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		transform: translate(-50%, -50%) scale(0);
		transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow:
			0 0 0 4px rgba(46, 180, 255, 0.35),
			0 0 12px rgba(46, 180, 255, 0.45);
		pointer-events: none;
	}

	.v-timeline-container:hover .v-timeline-thumb,
	.v-timeline-container:focus-visible .v-timeline-thumb,
	.v-timeline-container:active .v-timeline-thumb {
		transform: translate(-50%, -50%) scale(1);
	}

	.v-timeline-tooltip {
		position: absolute;
		bottom: 190%;
		transform: translateX(-50%);
		background: rgba(6, 12, 21, 0.9);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.14);
		color: #fff;
		padding: 3px 8px;
		border-radius: var(--radius-xs);
		font-size: 0.74rem;
		font-family: var(--mp-font-mono);
		font-weight: 500;
		pointer-events: none;
		white-space: nowrap;
		box-shadow: 0 6px 16px rgba(2, 8, 15, 0.4);
		animation: vFadeScale 0.16s cubic-bezier(0.22, 1, 0.36, 1);
	}

	@keyframes vFadeScale {
		from {
			opacity: 0;
			transform: translateX(-50%) scale(0.92);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) scale(1);
		}
	}

	/* ═══════════════════════════ Fila de botones ═════════════════════════════ */
	.v-buttons-row {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.v-spacer {
		flex: 1;
	}

	.v-ctrl-btn {
		background: transparent;
		border: none;
		color: var(--mp-text);
		width: 38px;
		height: 38px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		flex-shrink: 0;
		transition:
			background 0.18s ease,
			transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.v-ctrl-btn:hover {
		background: rgba(255, 255, 255, 0.14);
	}

	.v-ctrl-btn:active {
		transform: scale(0.86);
	}

	.v-ctrl-btn.active {
		background: rgba(255, 255, 255, 0.16);
		color: #fff;
	}

	.v-ctrl-btn:focus-visible,
	.v-speed-chip:focus-visible,
	.v-set-row:focus-visible,
	.v-context-item:focus-visible,
	.v-idle-play:focus-visible,
	.v-time-display:focus-visible,
	.v-audio-play:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--mp-accent);
	}

	.v-ctrl-btn .material-icons-round {
		font-size: 23px;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
	}

	.v-gear {
		transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.v-gear.spin {
		transform: rotate(45deg);
	}

	/* Botón de play principal: acento con gradiente de la casa */
	.v-ctrl-play .material-icons-round {
		font-size: 27px;
		background: var(--mp-grad);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		text-shadow: none;
		filter: drop-shadow(0 0 8px rgba(46, 180, 255, 0.45));
	}

	/* Tiempo (mono, clicable para alternar restante) */
	.v-time-display {
		background: transparent;
		border: none;
		color: var(--mp-text);
		font-family: var(--mp-font-mono);
		font-size: 0.78rem;
		font-weight: 500;
		margin-left: 6px;
		padding: 4px 6px;
		border-radius: var(--radius-xs);
		cursor: pointer;
		user-select: none;
		white-space: nowrap;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
		transition: opacity 0.18s;
	}

	.v-time-display:hover {
		opacity: 0.85;
	}

	.v-time-sep {
		color: var(--mp-text-dim);
		margin: 0 2px;
	}

	/* ═══════════════════════════ Grupo de volumen ════════════════════════════ */
	.v-vol-group {
		display: flex;
		align-items: center;
		border-radius: var(--radius-md);
	}

	.v-vol-slider-container {
		width: 0;
		height: 36px;
		overflow: hidden;
		display: flex;
		align-items: center;
		opacity: 0;
		margin-left: 0;
		transition:
			width 0.3s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.25s ease,
			margin 0.3s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.v-vol-group:hover .v-vol-slider-container,
	.v-vol-group:focus-within .v-vol-slider-container {
		width: 60px;
		opacity: 1;
		margin-left: 2px;
	}

	.v-vol-track {
		width: 50px;
		height: 4px;
		background: rgba(255, 255, 255, 0.24);
		border-radius: 99px;
		position: relative;
		cursor: pointer;
		display: flex;
		align-items: center;
		touch-action: none;
	}

	.v-vol-progress {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: var(--mp-grad);
		border-radius: inherit;
	}

	.v-vol-thumb {
		position: absolute;
		width: 11px;
		height: 11px;
		background: #fff;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		transform: translate(-50%, 0);
		top: calc(50% - 5.5px);
		box-shadow: 0 0 6px rgba(46, 180, 255, 0.5);
	}

	/* En pantallas táctiles no existe hover: ocultar el slider expandible */
	@media (hover: none) {
		.v-vol-slider-container {
			display: none;
		}
	}

	/* ═══════════════════ Botón central de reproducción en reposo ═════════════ */
	.v-idle-play {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 86px;
		height: 86px;
		transform: translate(-50%, -50%);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: linear-gradient(160deg, rgba(16, 30, 48, 0.72), rgba(6, 12, 21, 0.66));
		backdrop-filter: var(--mp-blur);
		-webkit-backdrop-filter: var(--mp-blur);
		border: 1px solid var(--mp-border-t);
		color: #fff;
		cursor: pointer;
		z-index: 10;
		animation: vIdleIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
		box-shadow:
			0 18px 44px rgba(2, 8, 15, 0.5),
			inset 0 1px 1px rgba(255, 255, 255, 0.22),
			0 0 32px rgba(46, 180, 255, 0.18);
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.v-idle-play:hover {
		transform: translate(-50%, -50%) scale(1.06);
	}

	.v-idle-play:active {
		transform: translate(-50%, -50%) scale(0.94);
	}

	.v-idle-play .material-icons-round {
		font-size: 50px;
		background: var(--mp-grad);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	@keyframes vIdleIn {
		from {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.55);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}

	/* ═══════════════════ Ripples laterales (doble toque ±10s) ════════════════ */
	.v-side-ripple {
		position: absolute;
		top: 50%;
		width: 96px;
		height: 96px;
		margin-top: -48px;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		z-index: 6;
		color: #fff;
		animation: vRipplePop 0.62s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}

	.v-side-ripple.left {
		left: 10%;
	}

	.v-side-ripple.right {
		right: 10%;
	}

	.v-side-ring {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(8, 16, 27, 0.55) 0%, transparent 72%);
		border: 1.5px solid rgba(255, 255, 255, 0.35);
	}

	.v-side-ring::after {
		content: '';
		position: absolute;
		inset: -6px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.28);
		animation: vRingPulse 0.62s ease-out forwards;
	}

	.v-side-ripple .material-icons-round {
		font-size: 34px;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.65);
	}

	@keyframes vRipplePop {
		0% {
			opacity: 0;
			transform: scale(0.5);
		}
		30% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: scale(1.25);
		}
	}

	@keyframes vRingPulse {
		from {
			transform: scale(0.75);
			opacity: 0.9;
		}
		to {
			transform: scale(1.4);
			opacity: 0;
		}
	}

	/* ═══════════════════ Feedback central morph ══════════════════════════════ */
	.v-center-pop {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 76px;
		height: 76px;
		margin: -38px 0 0 -38px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: rgba(8, 16, 27, 0.55);
		backdrop-filter: blur(10px) saturate(1.1);
		-webkit-backdrop-filter: blur(10px) saturate(1.1);
		color: #fff;
		pointer-events: none;
		z-index: 7;
		animation: vCenterPop 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}

	.v-center-pop .material-icons-round {
		font-size: 40px;
	}

	@keyframes vCenterPop {
		0% {
			opacity: 0.95;
			transform: scale(0.62);
		}
		55% {
			opacity: 1;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(1.18);
		}
	}

	/* ═══════════════════ Spinner de carga (anillo cónico, GPU-only) ══════════ */
	.v-buffer-card {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 64px;
		height: 64px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: rgba(8, 16, 27, 0.55);
		backdrop-filter: blur(10px) saturate(1.1);
		-webkit-backdrop-filter: blur(10px) saturate(1.1);
		border: 1px solid rgba(255, 255, 255, 0.16);
		z-index: 8;
		pointer-events: none;
	}

	.v-buffer-ring {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: conic-gradient(
			from 0deg,
			transparent 40deg,
			var(--mp-accent) 320deg,
			#ffffff 360deg
		);
		-webkit-mask: radial-gradient(
			farthest-side,
			transparent calc(100% - 4px),
			#000 calc(100% - 3px)
		);
		mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
		animation: vSpin 0.85s linear infinite;
	}

	@keyframes vSpin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ═══════════════════════════ Menú de ajustes ═════════════════════════════ */
	.v-settings-menu {
		position: absolute;
		right: 24px;
		bottom: 104px;
		width: min(268px, calc(100% - 36px));
		background: var(--mp-glass-strong);
		backdrop-filter: var(--mp-blur);
		-webkit-backdrop-filter: var(--mp-blur);
		border: 1px solid var(--mp-border);
		border-top-color: var(--mp-border-t);
		border-radius: var(--radius-lg);
		box-shadow:
			0 18px 44px rgba(2, 8, 15, 0.5),
			inset 0 1px 1px rgba(255, 255, 255, 0.14);
		padding: 12px;
		color: var(--mp-text);
		z-index: 20;
		pointer-events: auto;
		transform-origin: bottom right;
		animation: vMenuIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}

	@keyframes vMenuIn {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.93);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.v-menu-header {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--mp-text-dim);
		text-transform: uppercase;
		letter-spacing: 0.07em;
		margin-bottom: 8px;
	}

	.v-speed-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}

	.v-speed-chip {
		padding: 6px 0;
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		background: rgba(255, 255, 255, 0.07);
		color: var(--mp-text);
		font-family: var(--mp-font-mono);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.18s,
			transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
			border-color 0.18s,
			box-shadow 0.18s;
	}

	.v-speed-chip:hover {
		background: rgba(255, 255, 255, 0.14);
		transform: translateY(-1px);
	}

	/* Chip activo: borde gradiente padding-box/border-box (técnica avatar-ring) */
	.v-speed-chip.active {
		background:
			linear-gradient(var(--mp-glass-strong), var(--mp-glass-strong)) padding-box,
			var(--mp-grad) border-box;
		border-color: transparent;
		color: #fff;
		box-shadow: 0 0 14px rgba(46, 180, 255, 0.28);
	}

	.v-set-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 9px 10px;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--mp-text);
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		text-align: left;
		transition: background 0.18s;
	}

	.v-set-row:hover {
		background: rgba(255, 255, 255, 0.09);
	}

	.v-set-row .material-icons-round {
		font-size: 19px;
		color: var(--mp-text-dim);
	}

	.v-set-label {
		flex: 1;
	}

	.v-switch {
		width: 34px;
		height: 19px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.16);
		position: relative;
		flex-shrink: 0;
		transition: background 0.2s;
	}

	.v-switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.v-switch.on {
		background: var(--aero-blue, #1b85f3);
	}

	.v-switch.on::after {
		transform: translateX(15px);
	}

	.v-menu-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.12);
		margin: 8px 2px;
	}

	/* ═══════════════════════════ Menú contextual ═════════════════════════════ */
	.v-context-menu {
		position: absolute;
		background: var(--mp-glass-strong);
		backdrop-filter: var(--mp-blur);
		-webkit-backdrop-filter: var(--mp-blur);
		border: 1px solid var(--mp-border);
		border-top-color: var(--mp-border-t);
		border-radius: var(--radius-md);
		padding: 6px;
		min-width: 200px;
		box-shadow:
			0 18px 44px rgba(2, 8, 15, 0.5),
			inset 0 1px 1px rgba(255, 255, 255, 0.14);
		display: flex;
		flex-direction: column;
		gap: 2px;
		z-index: 30;
		animation: vMenuSoft 0.16s cubic-bezier(0.22, 1, 0.36, 1);
		transform-origin: top left;
	}

	@keyframes vMenuSoft {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.v-context-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		background: transparent;
		border: none;
		color: var(--mp-text);
		font-size: 0.84rem;
		border-radius: var(--radius-xs);
		cursor: pointer;
		text-align: left;
		transition: background 0.18s;
	}

	.v-context-item:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	.v-context-item .material-icons-round {
		font-size: 18px;
		color: var(--mp-text-dim);
	}

	/* ═══════════════════════════ Píldora de audio ════════════════════════════ */
	.media-player-wrapper.audio {
		background: transparent;
		border-radius: var(--radius-xl);
		overflow: visible;
		border: none;
		box-shadow: none;
		display: block;
		max-height: none;
		contain: none;
	}

	.v-audio-pill {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		max-width: 340px;
		padding: 9px 16px 9px 9px;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, rgba(10, 20, 34, 0.78), rgba(6, 12, 21, 0.66));
		backdrop-filter: var(--mp-blur);
		-webkit-backdrop-filter: var(--mp-blur);
		border: 1px solid var(--mp-border);
		border-top-color: var(--mp-border-t);
		box-shadow:
			0 6px 18px rgba(2, 8, 15, 0.28),
			inset 0 1px 1px rgba(255, 255, 255, 0.14);
		color: var(--mp-text);
	}

	.v-audio-play {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--mp-grad);
		color: #fff;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow:
			0 4px 14px rgba(14, 165, 233, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.35);
		transition: transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.v-audio-play:hover {
		transform: scale(1.08);
	}

	.v-audio-play:active {
		transform: scale(0.92);
	}

	.v-audio-play .material-icons-round {
		font-size: 20px;
	}

	/* Ecualizador: barras que solo respiran mientras suena el audio */
	.v-audio-eq {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 18px;
		flex-shrink: 0;
	}

	.v-audio-eq span {
		width: 3.5px;
		height: 100%;
		border-radius: 99px;
		background: var(--mp-grad);
		transform-origin: bottom;
		transform: scaleY(0.3);
	}

	.v-audio-eq.playing span {
		animation: vEq 1.05s ease-in-out infinite;
	}

	.v-audio-eq.playing span:nth-child(1) {
		animation-delay: 0s;
	}

	.v-audio-eq.playing span:nth-child(2) {
		animation-delay: 0.22s;
	}

	.v-audio-eq.playing span:nth-child(3) {
		animation-delay: 0.44s;
	}

	.v-audio-eq.playing span:nth-child(4) {
		animation-delay: 0.66s;
	}

	@keyframes vEq {
		0%,
		100% {
			transform: scaleY(0.3);
		}
		50% {
			transform: scaleY(1);
		}
	}

	.v-audio-timeline {
		flex: 1;
		min-width: 0;
		height: 32px;
		display: flex;
		align-items: center;
		cursor: pointer;
		touch-action: none;
		padding: 4px 0;
	}

	.v-audio-track {
		width: 100%;
		height: 5px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 99px;
		position: relative;
		transition: height 0.2s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.v-audio-timeline:hover .v-audio-track,
	.v-audio-timeline.dragging .v-audio-track {
		height: 8px;
	}

	.v-audio-progress {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		background: var(--mp-grad);
		border-radius: inherit;
	}

	.v-audio-thumb {
		position: absolute;
		top: 50%;
		width: 13px;
		height: 13px;
		background: #fff;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		transform: translate(-50%, -50%);
		box-shadow:
			0 0 0 3px rgba(46, 180, 255, 0.35),
			0 1px 5px rgba(0, 0, 0, 0.35);
		transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.v-audio-timeline:hover .v-audio-thumb {
		transform: translate(-50%, -50%) scale(1.15);
	}

	.v-audio-timeline.dragging .v-audio-thumb {
		transform: translate(-50%, -50%) scale(1.35);
	}

	.v-audio-time {
		font-size: 0.74rem;
		font-family: var(--mp-font-mono);
		color: var(--mp-text-dim);
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* ═══════════════════ Panel "Acerca de" (marca macOS + Neo-Aero) ══════════ */
	.v-about-backdrop {
		position: absolute;
		inset: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(2, 8, 15, 0.45);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		animation: vBackdropIn 0.22s ease forwards;
	}

	.v-about-backdrop.closing {
		animation: vBackdropOut 0.26s ease forwards;
	}

	@keyframes vBackdropIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes vBackdropOut {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	.v-about-panel {
		position: relative;
		width: min(320px, 84%);
		padding: 30px 24px 20px;
		text-align: center;
		border-radius: var(--radius-xl);
		background: linear-gradient(160deg, rgba(20, 34, 52, 0.92) 0%, rgba(8, 14, 24, 0.94) 100%);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-top-color: rgba(255, 255, 255, 0.28);
		box-shadow:
			0 24px 60px rgba(2, 8, 15, 0.55),
			inset 0 1px 0 rgba(255, 255, 255, 0.14);
		backdrop-filter: blur(14px) saturate(1.1);
		-webkit-backdrop-filter: blur(14px) saturate(1.1);
		color: var(--mp-text);
		animation: vPanelIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}

	.v-about-panel.closing {
		animation: vPanelOut 0.26s cubic-bezier(0.4, 0, 1, 1) forwards;
	}

	@keyframes vPanelIn {
		0% {
			opacity: 0;
			transform: scale(0.9) translateY(8px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	@keyframes vPanelOut {
		0% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
		100% {
			opacity: 0;
			transform: scale(0.94) translateY(6px);
		}
	}

	.v-about-close {
		position: absolute;
		top: 12px;
		left: 12px;
		width: 13px;
		height: 13px;
		border-radius: 50%;
		border: none;
		background: #ff5f57;
		box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.2);
		cursor: pointer;
		padding: 0;
		transition: filter 0.15s;
	}

	.v-about-close:hover {
		filter: brightness(1.15);
	}

	.v-about-logo {
		width: 68px;
		height: 68px;
		margin: 0 auto 14px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--mp-grad);
		box-shadow:
			0 8px 22px rgba(14, 165, 233, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.4);
	}

	.v-about-logo .material-icons-round {
		font-size: 38px;
		color: #fff;
	}

	.v-about-title {
		font-size: 1.05rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.v-about-sub {
		font-size: 0.74rem;
		color: var(--mp-text-dim);
		font-weight: 500;
		margin-top: 2px;
	}

	.v-about-shortcuts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: center;
		margin: 14px 0 4px;
	}

	.v-about-kbd {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.67rem;
		color: var(--mp-text-dim);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 3px 9px;
		border-radius: 999px;
	}

	.v-about-kbd kbd {
		font-family: var(--mp-font-mono);
		color: var(--mp-text);
		font-size: 0.64rem;
		background: rgba(255, 255, 255, 0.1);
		padding: 1px 5px;
		border-radius: 5px;
		border: 1px solid rgba(255, 255, 255, 0.14);
	}

	.v-about-info {
		margin-top: 12px;
		transition: opacity 0.22s ease;
	}

	.v-about-info.closing {
		opacity: 0;
	}

	.v-about-version {
		font-size: 0.8rem;
		color: rgba(244, 249, 255, 0.6);
		font-weight: 500;
		margin-bottom: 4px;
	}

	.v-about-copy {
		font-size: 0.68rem;
		color: rgba(244, 249, 255, 0.4);
		letter-spacing: 0.02em;
	}

	/* ═══════════════════ Variantes de contexto ═══════════════════════════════ */

	/* Grid vertical (multi-media): dock compacto, sin controles secundarios */
	.media-player-wrapper.video-grid .v-hide-narrow {
		display: none;
	}

	.media-player-wrapper.video-grid .v-deck {
		margin: 0 8px 8px;
		padding: 2px 8px 5px;
		border-radius: var(--radius-md);
	}

	.media-player-wrapper.video-grid .v-timeline-container {
		height: 18px;
	}

	/* Botón central compacto en grid corto: nunca invade el dock inferior */
	.media-player-wrapper.video-grid .v-idle-play {
		width: 64px;
		height: 64px;
	}

	.media-player-wrapper.video-grid .v-idle-play .material-icons-round {
		font-size: 38px;
	}

	/* Pantalla completa: más aire, dock ampliado, todos los controles visibles.
	   El escenario recupera todo el viewport: sin tope de altura. */
	.media-player-wrapper.is-fullscreen {
		border-radius: 0;
		border: none;
		max-height: none;
	}

	.media-player-wrapper.is-fullscreen .v-stage {
		max-height: none;
	}

	.media-player-wrapper.is-fullscreen .v-hide-narrow {
		/* !important para ganar al @container de formatos estrechos */
		display: inline-flex !important;
	}

	.media-player-wrapper.is-fullscreen .v-deck {
		margin: 0 clamp(16px, 4vw, 40px) clamp(16px, 4vw, 32px);
		padding: 6px 18px 12px;
		border-radius: var(--radius-xl);
	}

	.media-player-wrapper.is-fullscreen .v-settings-menu {
		right: clamp(28px, 5vw, 56px);
		bottom: clamp(96px, 12vh, 140px);
	}

	/* ═══ Formatos estrechos: compacción por ancho DEL reproductor ════════════ */
	/* Container query: responde al ancho del player (no del viewport). Burbujas
	   de chat, grids multi-media y verticales 9:16 en móvil compactan solos sus
	   controles secundarios; el dock siempre cabe junto al timeline y al tiempo. */
	@container (max-width: 400px) {
		.v-hide-narrow {
			display: none !important;
		}

		.v-deck {
			margin: 0 8px 8px;
			padding: 2px 8px 6px;
			border-radius: var(--radius-md);
		}

		.v-time-display {
			font-size: 0.72rem;
		}

		.v-settings-menu {
			right: 14px;
			bottom: 88px;
		}
	}

	/* Extremo (burbujas de chat muy angostas): ocultar hasta el reloj */
	@container (max-width: 280px) {
		.v-time-display {
			display: none !important;
		}

		.v-idle-play {
			width: 64px;
			height: 64px;
		}

		.v-idle-play .material-icons-round {
			font-size: 38px;
		}
	}
</style>
