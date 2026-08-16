<script>
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly, scale, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import { reels as reelsApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';

	// ── Modos de Ingesta ──────────────────────────────────────────────────────
	let activeIngestTab = $state('upload'); // 'upload' | 'camera'
	let selectedFile = $state(null);
	let preview = $state(null);
	let videoDuration = $state(0);
	let _videoWidth = $state(0);
	let _videoHeight = $state(0);
	let isDragging = $state(false);

	// ── Modo Grabación en Vivo (Cámara / Mic) ─────────────────────────────────
	let cameraStream = $state(null);
	let mediaRecorder = null;
	let recordedChunks = [];
	let isCameraActive = $state(false);
	let isRecording = $state(false);
	let isRecordingPaused = $state(false);
	let recordingTime = $state(0);
	let recordingTimerInterval = null;
	let countdownValue = $state(0);
	let countdownTimer = null;
	let availableVideoDevices = $state([]);
	let availableAudioDevices = $state([]);
	let selectedVideoDeviceId = $state('');
	let selectedAudioDeviceId = $state('');
	let micAudioLevel = $state(0);
	let audioContext = null;
	let analyserNode = null;
	let audioAnimFrame = null;
	let cameraVideoEl = $state();

	// ── Controles de Reproducción y Viewport ──────────────────────────────────
	let videoPlayerEl = $state(null);
	let ambientCanvasEl = $state(null);
	let ambientAnimId = null;
	let rvfcHandle = null;
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let volume = $state(1);
	let isMuted = $state(false);
	let playbackRate = $state(1.0);
	let fitMode = $state('cover'); // 'cover' | 'contain'
	let showSafeZones = $state(false);
	let showShortcutsModal = $state(false);
	let showDiscardModal = $state(false);

	// ── Filtros Visuales / Color Grading ──────────────────────────────────────
	let activeFilter = $state('normal');
	const FILTERS = [
		{ id: 'normal', name: 'Original', css: 'none', icon: 'auto_awesome' },
		{
			id: 'cyber',
			name: 'Cyber Neon',
			css: 'contrast(1.25) saturate(1.4) hue-rotate(15deg) brightness(1.05)',
			icon: 'bolt'
		},
		{
			id: 'aero',
			name: 'Aero Glow',
			css: 'brightness(1.1) saturate(1.25) contrast(1.08) drop-shadow(0 0 8px rgba(46,180,255,0.25))',
			icon: 'blur_on'
		},
		{
			id: 'vintage',
			name: 'Tokyo Retro',
			css: 'sepia(0.28) contrast(1.15) saturate(1.15) brightness(1.02)',
			icon: 'camera_roll'
		},
		{
			id: 'mint',
			name: 'Emerald Mint',
			css: 'hue-rotate(-20deg) saturate(1.3) contrast(1.12)',
			icon: 'park'
		},
		{
			id: 'noir',
			name: 'Noir Dramático',
			css: 'grayscale(1) contrast(1.45) brightness(0.95)',
			icon: 'contrast'
		},
		{
			id: 'sunset',
			name: 'Sunset Glow',
			css: 'saturate(1.45) sepia(0.18) hue-rotate(-10deg) contrast(1.1)',
			icon: 'wb_sunny'
		}
	];

	// ── Overlays de Texto en Pantalla ─────────────────────────────────────────
	let hasTextOverlay = $state(false);
	let overlayText = $state('');
	let overlayColor = $state('#FFFFFF');
	let overlayFont = $state('modern');
	let overlayBgStyle = $state('pill'); // 'pill' | 'solid' | 'neon' | 'none'
	let overlayAlign = $state('center'); // 'left' | 'center' | 'right'
	let overlayPosX = $state(50); // porcentaje 0..100
	let overlayPosY = $state(45); // porcentaje 0..100
	let isDraggingText = $state(false);
	let videoContainerRef = $state();

	const FONTS = [
		{
			id: 'modern',
			label: 'Modern Display',
			style: 'font-family: var(--font-display); font-weight: 900; letter-spacing: 0.5px;'
		},
		{
			id: 'bold',
			label: 'Inter Sans',
			style: 'font-family: var(--font-sans); font-weight: 800;'
		},
		{
			id: 'neon',
			label: 'Neon Glow',
			style:
				'font-family: var(--font-sans); font-weight: 900; text-shadow: 0 0 10px currentColor, 0 0 20px currentColor;'
		},
		{
			id: 'typewriter',
			label: 'Typewriter',
			style: 'font-family: "Courier New", monospace; font-weight: 700;'
		},
		{
			id: 'serif',
			label: 'Elegance',
			style: 'font-family: Georgia, serif; font-style: italic; font-weight: 700;'
		},
		{
			id: 'impact',
			label: 'Hero Impact',
			style: 'font-family: Impact, sans-serif; text-transform: uppercase; letter-spacing: 1px;'
		}
	];

	const TEXT_COLORS = [
		'#FFFFFF',
		'#111111',
		'#2EB4FF',
		'#00D4AA',
		'#F5A623',
		'#EC4899',
		'#FF4444',
		'#A855F7'
	];

	// ── Selector de Portada (Thumbnail Extractor) ─────────────────────────────
	let thumbnailDataUrl = $state(null);
	let _isCapturingThumbnail = $state(false);
	let _customThumbnailFile = $state(null);
	let thumbnailSource = $state('auto'); // 'auto' | 'custom'

	// ── Consola de Creador & Metadatos ────────────────────────────────────────
	let activeConsoleTab = $state('details'); // 'details' | 'studio' | 'settings'
	let caption = $state('');
	let soundTitle = $state('');
	let privacySetting = $state('public'); // 'public' | 'followers' | 'private'
	let allowComments = $state(true);
	let allowSharing = $state(true);
	let isSensitiveContent = $state(false);

	// ── Estado de Publicación & Feedback ──────────────────────────────────────
	let uploading = $state(false);
	let uploadProgress = $state(0);
	let error = $state('');
	let success = $state(false);

	// Refs
	let fileInput = $state();
	let customThumbInput = $state();
	let centerRipple = $state({ show: false, icon: 'play_arrow', id: 0 });

	// ── Derived ───────────────────────────────────────────────────────────────
	const selectedFontObj = $derived(FONTS.find((f) => f.id === overlayFont) ?? FONTS[0]);
	const selectedFilterObj = $derived(FILTERS.find((f) => f.id === activeFilter) ?? FILTERS[0]);

	const textOverlayComputedStyle = $derived.by(() => {
		let style = `top: ${overlayPosY}%; left: ${overlayPosX}%; transform: translate(-50%, -50%); `;
		style += `color: ${overlayColor}; text-align: ${overlayAlign}; ${selectedFontObj.style} `;

		if (overlayBgStyle === 'pill') {
			style +=
				'background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); padding: 8px 18px; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 4px 20px rgba(0,0,0,0.5);';
		} else if (overlayBgStyle === 'solid') {
			style +=
				'background: #000000; padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 4px 15px rgba(0,0,0,0.7);';
		} else if (overlayBgStyle === 'neon') {
			style += `background: rgba(0,0,0,0.4); border: 2px solid ${overlayColor}; box-shadow: 0 0 15px ${overlayColor}; padding: 8px 16px; border-radius: 12px;`;
		} else {
			style +=
				'background: transparent; text-shadow: 0 2px 10px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9); padding: 4px 8px;';
		}
		return style;
	});

	const canPublish = $derived(selectedFile && !uploading);

	// ── Iluminación Cinematográfica Ambiente (YouTube Ambient Mode) ───────────
	function renderAmbientFrame() {
		if (!ambientCanvasEl || !videoPlayerEl || videoPlayerEl.readyState < 2) return;
		try {
			const ctx = ambientCanvasEl.getContext('2d', { willReadFrequently: false, alpha: false });
			if (!ctx) return;

			if (activeFilter !== 'normal' && selectedFilterObj.css !== 'none') {
				ctx.filter = selectedFilterObj.css;
			} else {
				ctx.filter = 'none';
			}

			ctx.drawImage(videoPlayerEl, 0, 0, ambientCanvasEl.width, ambientCanvasEl.height);
		} catch (_err) {}
	}

	function startAmbientLoop() {
		stopAmbientLoop();
		if (!videoPlayerEl || videoPlayerEl.paused || videoPlayerEl.ended) return;

		if (
			'requestVideoFrameCallback' in HTMLVideoElement.prototype &&
			videoPlayerEl.requestVideoFrameCallback
		) {
			const onFrame = () => {
				if (!videoPlayerEl || videoPlayerEl.paused || videoPlayerEl.ended) return;
				renderAmbientFrame();
				rvfcHandle = videoPlayerEl.requestVideoFrameCallback(onFrame);
			};
			rvfcHandle = videoPlayerEl.requestVideoFrameCallback(onFrame);
		} else {
			const loop = () => {
				if (!videoPlayerEl || videoPlayerEl.paused || videoPlayerEl.ended) return;
				renderAmbientFrame();
				ambientAnimId = requestAnimationFrame(loop);
			};
			ambientAnimId = requestAnimationFrame(loop);
		}
	}

	function stopAmbientLoop() {
		if (ambientAnimId) {
			cancelAnimationFrame(ambientAnimId);
			ambientAnimId = null;
		}
		if (rvfcHandle !== null && videoPlayerEl && 'cancelVideoFrameCallback' in videoPlayerEl) {
			videoPlayerEl.cancelVideoFrameCallback(rvfcHandle);
			rvfcHandle = null;
		}
	}

	$effect(() => {
		if (activeFilter && videoPlayerEl) {
			renderAmbientFrame();
		}
	});

	// ── Lifecycle ─────────────────────────────────────────────────────────────
	onMount(async () => {
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}
		soundTitle = `Audio original - @${authStore.user?.username || 'creador'}`;
		await enumerateDevices();
		window.addEventListener('keydown', handleGlobalKeydown);

		const handleVisibility = () => {
			if (document.hidden) {
				stopAmbientLoop();
			} else if (isPlaying && videoPlayerEl && !videoPlayerEl.paused) {
				startAmbientLoop();
			}
		};
		document.addEventListener('visibilitychange', handleVisibility);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	});

	onDestroy(() => {
		stopAmbientLoop();
		stopCameraStream();
		if (preview) URL.revokeObjectURL(preview);
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleGlobalKeydown);
		}
	});

	// ── Enumerate Devices ─────────────────────────────────────────────────────
	async function enumerateDevices() {
		if (!navigator.mediaDevices?.enumerateDevices) return;
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			availableVideoDevices = devices.filter((d) => d.kind === 'videoinput');
			availableAudioDevices = devices.filter((d) => d.kind === 'audioinput');

			if (availableVideoDevices.length > 0 && !selectedVideoDeviceId) {
				selectedVideoDeviceId = availableVideoDevices[0].deviceId;
			}
			if (availableAudioDevices.length > 0 && !selectedAudioDeviceId) {
				selectedAudioDeviceId = availableAudioDevices[0].deviceId;
			}
		} catch (_e) {}
	}

	// ── Manejo de Archivos ────────────────────────────────────────────────────
	function processVideoFile(file) {
		if (!file) return;
		if (!file.type.startsWith('video/')) {
			error = 'Formato no soportado. Sube un archivo de video (MP4, WebM, MOV).';
			return;
		}
		if (file.size > 100 * 1024 * 1024) {
			error = 'El video supera el límite de 100MB.';
			return;
		}

		error = '';
		selectedFile = file;
		if (preview) URL.revokeObjectURL(preview);
		preview = URL.createObjectURL(file);

		setTimeout(() => {
			if (videoPlayerEl) {
				videoPlayerEl.currentTime = 0;
			}
		}, 100);
	}

	function handleFileInput(e) {
		const file = e.target.files?.[0];
		processVideoFile(file);
	}

	function handleDragOver(e) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(e) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files?.[0];
		processVideoFile(file);
	}

	// ── Cámara & Grabación en Vivo ────────────────────────────────────────────
	async function startCamera() {
		error = '';
		try {
			stopCameraStream();
			const constraints = {
				video: selectedVideoDeviceId
					? {
							deviceId: { exact: selectedVideoDeviceId },
							width: { ideal: 1080 },
							height: { ideal: 1920 }
						}
					: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
				audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true
			};

			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			cameraStream = stream;
			isCameraActive = true;

			if (cameraVideoEl) {
				cameraVideoEl.srcObject = stream;
				cameraVideoEl.play().catch(() => {});
			}

			setupAudioAnalyser(stream);
			await enumerateDevices();
		} catch (err) {
			console.error('Camera access error:', err);
			error = 'No se pudo acceder a la cámara/micrófono. Verifica los permisos de tu navegador.';
			isCameraActive = false;
		}
	}

	function setupAudioAnalyser(stream) {
		try {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			if (!AudioCtx) return;
			audioContext = new AudioCtx();
			analyserNode = audioContext.createAnalyser();
			analyserNode.fftSize = 64;

			const source = audioContext.createMediaStreamSource(stream);
			source.connect(analyserNode);

			const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
			const updateLevel = () => {
				if (!isCameraActive) return;
				analyserNode.getByteFrequencyData(dataArray);
				let sum = 0;
				for (let i = 0; i < dataArray.length; i++) {
					sum += dataArray[i];
				}
				const avg = sum / dataArray.length;
				micAudioLevel = Math.min(100, Math.round((avg / 128) * 100));
				audioAnimFrame = requestAnimationFrame(updateLevel);
			};
			updateLevel();
		} catch (_e) {}
	}

	function stopCameraStream() {
		if (cameraStream) {
			cameraStream.getTracks().forEach((track) => track.stop());
			cameraStream = null;
		}
		if (audioAnimFrame) {
			cancelAnimationFrame(audioAnimFrame);
			audioAnimFrame = null;
		}
		if (audioContext && audioContext.state !== 'closed') {
			audioContext.close().catch(() => {});
			audioContext = null;
		}
		isCameraActive = false;
		isRecording = false;
		isRecordingPaused = false;
		clearInterval(recordingTimerInterval);
		clearTimeout(countdownTimer);
		countdownValue = 0;
	}

	function startCountdownAndRecord() {
		countdownValue = 3;
		countdownTimer = setInterval(() => {
			countdownValue -= 1;
			if (countdownValue <= 0) {
				clearInterval(countdownTimer);
				countdownValue = 0;
				beginActualRecording();
			}
		}, 1000);
	}

	function beginActualRecording() {
		if (!cameraStream) return;
		recordedChunks = [];

		let mimeType = 'video/webm;codecs=vp9,opus';
		if (!MediaRecorder.isTypeSupported(mimeType)) {
			mimeType = 'video/webm';
			if (!MediaRecorder.isTypeSupported(mimeType)) {
				mimeType = 'video/mp4';
			}
		}

		try {
			mediaRecorder = new MediaRecorder(cameraStream, { mimeType });
		} catch (_e) {
			mediaRecorder = new MediaRecorder(cameraStream);
		}

		mediaRecorder.ondataavailable = (e) => {
			if (e.data && e.data.size > 0) {
				recordedChunks.push(e.data);
			}
		};

		mediaRecorder.onstop = () => {
			const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
			const recordedFile = new File([blob], `reel_capture_${Date.now()}.webm`, {
				type: blob.type
			});
			stopCameraStream();
			processVideoFile(recordedFile);
		};

		mediaRecorder.start(1000);
		isRecording = true;
		isRecordingPaused = false;
		recordingTime = 0;

		recordingTimerInterval = setInterval(() => {
			recordingTime += 1;
			if (recordingTime >= 90) {
				stopRecording();
			}
		}, 1000);
	}

	function pauseResumeRecording() {
		if (!mediaRecorder) return;
		if (isRecordingPaused) {
			mediaRecorder.resume();
			isRecordingPaused = false;
		} else {
			mediaRecorder.pause();
			isRecordingPaused = true;
		}
	}

	function stopRecording() {
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
		}
		clearInterval(recordingTimerInterval);
		isRecording = false;
	}

	// ── Player Controls ───────────────────────────────────────────────────────
	function triggerCenterRipple(icon) {
		const id = ++centerRipple.id;
		centerRipple = { show: true, icon, id };
		setTimeout(() => {
			if (centerRipple.id === id) {
				centerRipple = { ...centerRipple, show: false };
			}
		}, 550);
	}

	function togglePlay() {
		if (!videoPlayerEl) return;
		if (videoPlayerEl.paused) {
			videoPlayerEl.play().catch(() => {});
			isPlaying = true;
			startAmbientLoop();
			triggerCenterRipple('play_arrow');
		} else {
			videoPlayerEl.pause();
			isPlaying = false;
			stopAmbientLoop();
			renderAmbientFrame();
			triggerCenterRipple('pause');
		}
	}

	function handleVideoLoadedMetadata() {
		if (!videoPlayerEl) return;
		videoDuration = videoPlayerEl.duration || 0;
		_videoWidth = videoPlayerEl.videoWidth || 0;
		_videoHeight = videoPlayerEl.videoHeight || 0;
		videoPlayerEl.volume = isMuted ? 0 : volume;
		videoPlayerEl.playbackRate = playbackRate;

		setTimeout(() => {
			captureCurrentFrameAsThumbnail();
			renderAmbientFrame();
		}, 100);
	}

	function handleVideoTimeUpdate() {
		if (!videoPlayerEl) return;
		currentTime = videoPlayerEl.currentTime;
		if (videoPlayerEl.paused) {
			renderAmbientFrame();
		}
	}

	function handleTimelineSeek(e) {
		if (!videoPlayerEl || videoDuration === 0) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const clickPos = (e.clientX - rect.left) / rect.width;
		const targetTime = Math.max(0, Math.min(videoDuration, clickPos * videoDuration));
		videoPlayerEl.currentTime = targetTime;
		currentTime = targetTime;
		renderAmbientFrame();
	}

	function setSpeed(rate) {
		playbackRate = rate;
		if (videoPlayerEl) {
			videoPlayerEl.playbackRate = rate;
		}
	}

	function toggleMute() {
		isMuted = !isMuted;
		if (videoPlayerEl) {
			videoPlayerEl.muted = isMuted;
		}
	}

	function handleVolumeChange(e) {
		volume = parseFloat(e.target.value);
		isMuted = volume === 0;
		if (videoPlayerEl) {
			videoPlayerEl.volume = volume;
			videoPlayerEl.muted = isMuted;
		}
	}

	// ── Selector de Portada ───────────────────────────────────────────────────
	function captureCurrentFrameAsThumbnail() {
		if (!videoPlayerEl || !videoPlayerEl.videoWidth) return;
		_isCapturingThumbnail = true;
		try {
			const canvas = document.createElement('canvas');
			canvas.width = videoPlayerEl.videoWidth;
			canvas.height = videoPlayerEl.videoHeight;
			const ctx = canvas.getContext('2d');

			if (activeFilter !== 'normal' && selectedFilterObj.css !== 'none') {
				ctx.filter = selectedFilterObj.css;
			}
			ctx.drawImage(videoPlayerEl, 0, 0, canvas.width, canvas.height);

			thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.85);
			thumbnailSource = 'auto';
		} catch (err) {
			console.error('Thumbnail capture error:', err);
		} finally {
			_isCapturingThumbnail = false;
		}
	}

	function handleCustomThumbnailUpload(e) {
		const file = e.target.files?.[0];
		if (!file || !file.type.startsWith('image/')) return;
		_customThumbnailFile = file;
		const reader = new FileReader();
		reader.onload = (ev) => {
			thumbnailDataUrl = ev.target.result;
			thumbnailSource = 'custom';
		};
		reader.readAsDataURL(file);
	}

	// ── Text Overlay Drag ─────────────────────────────────────────────────────
	function onTextPointerDown(e) {
		if (!videoContainerRef) return;
		isDraggingText = true;
		e.target.setPointerCapture(e.pointerId);
	}

	function onTextPointerMove(e) {
		if (!isDraggingText || !videoContainerRef) return;
		const rect = videoContainerRef.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * 100;
		const y = ((e.clientY - rect.top) / rect.height) * 100;
		overlayPosX = Math.max(5, Math.min(95, x));
		overlayPosY = Math.max(5, Math.min(95, y));
	}

	function onTextPointerUp(e) {
		isDraggingText = false;
		try {
			e.target.releasePointerCapture(e.pointerId);
		} catch (_e) {}
	}

	// ── Quick Hashtags & Emojis ───────────────────────────────────────────────
	const POPULAR_HASHTAGS = [
		'#fyp',
		'#viral',
		'#vcreator',
		'#shorts',
		'#reels',
		'#anime',
		'#gaming',
		'#music',
		'#dance',
		'#humor'
	];

	const QUICK_EMOJIS = ['🔥', '✨', '🚀', '💖', '😂', '🎬', '🎧', '👏', '⚡', '👀'];

	function insertHashtag(tag) {
		if (!caption.includes(tag)) {
			caption = caption ? `${caption.trim()} ${tag} ` : `${tag} `;
		}
	}

	function insertEmoji(emoji) {
		caption += emoji;
	}

	// ── Atajos Globales ───────────────────────────────────────────────────────
	function handleGlobalKeydown(e) {
		if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
		if (e.key === ' ' || e.code === 'Space') {
			e.preventDefault();
			togglePlay();
		} else if (e.key === 'm' || e.key === 'M') {
			e.preventDefault();
			toggleMute();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			if (videoPlayerEl) {
				videoPlayerEl.currentTime = Math.max(0, videoPlayerEl.currentTime - 1);
				renderAmbientFrame();
			}
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			if (videoPlayerEl) {
				videoPlayerEl.currentTime = Math.min(videoDuration, videoPlayerEl.currentTime + 1);
				renderAmbientFrame();
			}
		}
	}

	function formatTime(seconds) {
		if (isNaN(seconds) || seconds < 0) return '00:00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		const ms = Math.floor((seconds % 1) * 10);
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
	}

	// ── Descartar ─────────────────────────────────────────────────────────────
	function confirmDiscard() {
		stopAmbientLoop();
		selectedFile = null;
		if (preview) URL.revokeObjectURL(preview);
		preview = null;
		caption = '';
		thumbnailDataUrl = null;
		_customThumbnailFile = null;
		hasTextOverlay = false;
		overlayText = '';
		error = '';
		showDiscardModal = false;
		if (fileInput) fileInput.value = '';
	}

	// ── Publicar ──────────────────────────────────────────────────────────────
	async function handlePublish() {
		if (!canPublish) return;
		uploading = true;
		uploadProgress = 15;
		error = '';

		try {
			const fd = new FormData();
			fd.append('video', selectedFile);
			fd.append('caption', caption.trim());
			fd.append('duration_seconds', Math.round(videoDuration) || 0);

			if (thumbnailDataUrl) {
				fd.append('thumbnail', thumbnailDataUrl);
			}

			const progressInterval = setInterval(() => {
				if (uploadProgress < 85) uploadProgress += 15;
			}, 250);

			await reelsApi.create(fd);

			clearInterval(progressInterval);
			uploadProgress = 100;
			success = true;

			setTimeout(() => {
				goto('/reels');
			}, 900);
		} catch (err) {
			error = err?.message || 'Error al publicar el reel. Intenta nuevamente.';
			uploading = false;
			uploadProgress = 0;
		}
	}
</script>

<svelte:head>
	<title>Studio Reels | V-SOCIAL</title>
	<meta
		name="description"
		content="Crea y comparte reels con herramientas profesionales en V-SOCIAL."
	/>
</svelte:head>

<div class="studio-root" class:has-video={selectedFile}>
	<!-- ── Integrated Studio Header ──────────────────────────────────────── -->
	<header class="studio-header glass-panel">
		<div class="header-brand-side">
			<a
				href="/reels"
				class="studio-back-btn"
				aria-label="Volver a Reels"
				style="flex: 0 0 38px; min-width: 38px; min-height: 38px;"
				onclick={(e) => {
					if (selectedFile) {
						e.preventDefault();
						showDiscardModal = true;
					}
				}}
			>
				<span class="material-icons-round">arrow_back</span>
			</a>

			<div class="header-divider"></div>

			<div class="header-titles">
				<div class="badge-title">
					<div class="studio-logo-badge">
						<span class="material-icons-round">movie_creation</span>
					</div>
					<span class="title-text">STUDIO REELS</span>
					<span class="pro-tag">PRO</span>
				</div>
				<span class="subtitle-text">
					{#if selectedFile}
						Edición & Renderizado 9:16
					{:else}
						Creación y producción de videos verticales
					{/if}
				</span>
			</div>
		</div>

		<!-- Center Contextual Studio Status / Workflow Pill -->
		<div class="header-center-info">
			{#if selectedFile}
				<div class="studio-status-pill active-edit">
					<span class="status-live-dot edit-mode"></span>
					<span class="material-icons-round pill-icon">tune</span>
					<span class="status-pill-text">Edición 9:16</span>
					<span class="status-meta-tag">Timeline</span>
				</div>
			{:else}
				<div class="studio-status-pill import-mode">
					<span class="status-live-dot ready"></span>
					<span class="material-icons-round pill-icon">cloud_upload</span>
					<span class="status-pill-text">Estudio de Creación</span>
					<span class="status-meta-tag">9:16 FHD</span>
				</div>
			{/if}
		</div>

		<div class="header-actions-side">
			<button
				class="studio-icon-btn"
				onclick={() => (showShortcutsModal = true)}
				title="Atajos de teclado"
				aria-label="Atajos de teclado"
			>
				<span class="material-icons-round">keyboard</span>
				<span class="btn-kbd-label">Atajos</span>
			</button>

			{#if selectedFile}
				<button
					class="studio-discard-action"
					onclick={() => (showDiscardModal = true)}
					disabled={uploading}
				>
					<span class="material-icons-round">delete_outline</span>
					<span>Descartar</span>
				</button>
			{/if}
		</div>
	</header>

	<!-- ── Error Toast ────────────────────────────────────────────────────── -->
	{#if error}
		<div class="studio-error-toast" transition:fly={{ y: -20, duration: 250, easing: cubicOut }}>
			<span class="material-icons-round error-icon">error_outline</span>
			<span class="error-msg">{error}</span>
			<button class="error-close-btn" onclick={() => (error = '')} aria-label="Cerrar error">
				<span class="material-icons-round">close</span>
			</button>
		</div>
	{/if}

	<!-- ── FASE 1: Ingesta (Upload & Live Cam) ─────────────────────────────── -->
	{#if !selectedFile}
		<main class="studio-ingest-stage" in:fade={{ duration: 250 }}>
			{#if activeIngestTab === 'upload'}
				<!-- Upload Card -->
				<div class="upload-studio-card glass-panel" in:fade={{ duration: 200 }}>
					<div
						class="studio-dropzone"
						class:dragging={isDragging}
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={handleDrop}
						onclick={() => fileInput.click()}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								fileInput.click();
							}
						}}
						role="button"
						tabindex="0"
					>
						<div class="dropzone-icon-halo">
							<span class="material-icons-round">movie_creation</span>
						</div>
						<h1 class="dropzone-title">Sube tu próximo éxito a V-SOCIAL</h1>
						<p class="dropzone-desc">
							Arrastra tu video aquí o haz clic para explorar tus archivos.
						</p>

						<div class="specs-pills-row">
							<div class="spec-pill">
								<span class="material-icons-round">stay_current_portrait</span>
								<span>9:16 Vertical</span>
							</div>
							<div class="spec-pill">
								<span class="material-icons-round">high_quality</span>
								<span>Hasta 1080×1920</span>
							</div>
							<div class="spec-pill">
								<span class="material-icons-round">sd_storage</span>
								<span>MP4, WebM (Máx 100MB)</span>
							</div>
							<div class="spec-pill">
								<span class="material-icons-round">timer</span>
								<span>Hasta 90 seg</span>
							</div>
						</div>

						<button class="btn-aero-primary browse-action-btn" type="button">
							<span class="material-icons-round">folder_open</span>
							<span>Explorar Archivo</span>
						</button>
					</div>

					<!-- Compact Tips Grid -->
					<div class="studio-guidelines-row">
						<div class="guide-item">
							<span class="material-icons-round guide-icon">trending_up</span>
							<div class="guide-text">
								<strong>Engancha en 3 segundos</strong>
								<span>Usa movimiento inicial para retener atención.</span>
							</div>
						</div>
						<div class="guide-item">
							<span class="material-icons-round guide-icon">graphic_eq</span>
							<div class="guide-text">
								<strong>Audio & Ritmo</strong>
								<span>El sonido nítido triplica las interacciones.</span>
							</div>
						</div>
						<div class="guide-item">
							<span class="material-icons-round guide-icon">military_tech</span>
							<div class="guide-text">
								<strong>Gana +5 XP</strong>
								<span>Recompensa automática al compartir tu Reel.</span>
							</div>
						</div>
					</div>
				</div>
			{:else}
				<!-- Live Camera Studio -->
				<div class="camera-stage-card glass-panel" in:fade={{ duration: 200 }}>
					<div class="camera-viewport-box">
						<video bind:this={cameraVideoEl} autoplay playsinline muted class="camera-stream-video"
						></video>

						<!-- Camera HUD -->
						<div class="camera-hud-layer">
							<div class="hud-top-bar">
								{#if isRecording}
									<div class="recording-badge" class:paused={isRecordingPaused}>
										<span class="rec-pulsing-dot"></span>
										<span>{isRecordingPaused ? 'PAUSADO' : 'GRABANDO'}</span>
										<span class="timer-tag">{formatTime(recordingTime)} / 01:30</span>
									</div>
								{:else}
									<div class="standby-tag">
										<span class="material-icons-round">videocam</span>
										<span>VISTA PREVIA EN VIVO</span>
									</div>
								{/if}

								<!-- Audio Meter -->
								<div class="mic-level-meter" title="Nivel de micrófono">
									<span class="material-icons-round mic-ico">mic</span>
									<div class="meter-track">
										<div class="meter-fill" style="width: {micAudioLevel}%;"></div>
									</div>
								</div>
							</div>

							<!-- Countdown 3s -->
							{#if countdownValue > 0}
								<div class="countdown-modal" transition:scale={{ duration: 200 }}>
									<span class="countdown-val">{countdownValue}</span>
									<span class="countdown-text">¡Prepárate!</span>
								</div>
							{/if}

							<!-- Bottom Controls -->
							<div class="hud-bottom-bar">
								<div class="device-selects-row">
									{#if availableVideoDevices.length > 1}
										<select
											class="hud-device-dropdown"
											bind:value={selectedVideoDeviceId}
											onchange={startCamera}
											disabled={isRecording}
										>
											{#each availableVideoDevices as dev, idx}
												<option value={dev.deviceId}>
													📹 {dev.label || `Cámara ${idx + 1}`}
												</option>
											{/each}
										</select>
									{/if}

									{#if availableAudioDevices.length > 1}
										<select
											class="hud-device-dropdown"
											bind:value={selectedAudioDeviceId}
											onchange={startCamera}
											disabled={isRecording}
										>
											{#each availableAudioDevices as dev, idx}
												<option value={dev.deviceId}>
													🎙️ {dev.label || `Micrófono ${idx + 1}`}
												</option>
											{/each}
										</select>
									{/if}
								</div>

								<div class="record-shutter-row">
									{#if !isRecording}
										<button
											class="shutter-circle-btn"
											onclick={startCountdownAndRecord}
											aria-label="Iniciar grabación"
										>
											<div class="shutter-red-inner"></div>
										</button>
									{:else}
										<button
											class="shutter-pause-btn"
											onclick={pauseResumeRecording}
											title={isRecordingPaused ? 'Reanudar' : 'Pausar'}
											aria-label={isRecordingPaused ? 'Reanudar' : 'Pausar'}
										>
											<span class="material-icons-round">
												{isRecordingPaused ? 'play_arrow' : 'pause'}
											</span>
										</button>

										<button
											class="shutter-circle-btn is-recording"
											onclick={stopRecording}
											aria-label="Detener y editar"
										>
											<div class="shutter-stop-square"></div>
										</button>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</main>
	{:else}
		<!-- ── FASE 2: Studio Split Editor ───────────────────────────────────── -->
		<div class="studio-editor-stage" in:fade={{ duration: 300 }}>
			<!-- ── Left: Video Canvas & Viewport Controls ── -->
			<section class="editor-viewport-column">
				<!-- ── Cinematic Ambient Lighting (YouTube Ambient Mode) ── -->
				<div class="ambient-cinematic-glow-wrap" aria-hidden="true">
					<canvas
						bind:this={ambientCanvasEl}
						class="ambient-cinematic-canvas"
						width="64"
						height="36"
					></canvas>
					<div class="ambient-radial-vignette"></div>
				</div>

				<div class="viewport-center-stack">
					<!-- Vertical 9:16 Phone Mockup Frame -->
					<div class="phone-canvas-frame" bind:this={videoContainerRef}>
						<video
							bind:this={videoPlayerEl}
							src={preview}
							class="canvas-video-player fit-{fitMode}"
							style="filter: {selectedFilterObj.css};"
							playsinline
							loop
							onclick={togglePlay}
							onloadedmetadata={handleVideoLoadedMetadata}
							ontimeupdate={handleVideoTimeUpdate}
							onplay={() => {
								isPlaying = true;
								startAmbientLoop();
							}}
							onpause={() => {
								isPlaying = false;
								stopAmbientLoop();
								renderAmbientFrame();
							}}
							onseeked={renderAmbientFrame}
							onended={() => {
								isPlaying = false;
								stopAmbientLoop();
							}}
						>
							<track kind="captions" />
						</video>

						<!-- Central Tap Ripple -->
						{#if centerRipple.show}
							<div class="tap-ripple-circle" transition:scale={{ duration: 200 }}>
								<span class="material-icons-round">{centerRipple.icon}</span>
							</div>
						{/if}

						<!-- On-Screen Draggable Text Overlay -->
						{#if hasTextOverlay && overlayText.trim()}
							<div
								class="screen-text-overlay"
								style={textOverlayComputedStyle}
								role="button"
								tabindex="0"
								onpointerdown={onTextPointerDown}
								onpointermove={onTextPointerMove}
								onpointerup={onTextPointerUp}
							>
								{overlayText}
							</div>
						{/if}

						<!-- Safe-Zone Overlay Grid -->
						{#if showSafeZones}
							<div class="safezone-guide-overlay" in:fade={{ duration: 150 }}>
								<div class="safezone-boundary">
									<span class="safezone-pill">Zona Segura de Contenido</span>
								</div>

								<!-- Mock Feed UI Right Stack -->
								<div class="mock-ui-right-stack">
									<div class="mock-avatar-circle">
										<span class="material-icons-round">account_circle</span>
										<div class="mock-add-dot">+</div>
									</div>
									<div class="mock-action-btn">
										<span class="material-icons-round">favorite</span>
										<small>18.4K</small>
									</div>
									<div class="mock-action-btn">
										<span class="material-icons-round">comment</span>
										<small>942</small>
									</div>
									<div class="mock-action-btn">
										<span class="material-icons-round">bookmark</span>
										<small>420</small>
									</div>
									<div class="mock-action-btn">
										<span class="material-icons-round">share</span>
										<small>Share</small>
									</div>
									<div class="mock-disc-icon">
										<span class="material-icons-round">graphic_eq</span>
									</div>
								</div>

								<!-- Mock Feed Bottom Bar -->
								<div class="mock-ui-bottom-bar">
									<div class="mock-user-tag">@{authStore.user?.username || 'usuario'}</div>
									<div class="mock-caption-preview">
										{caption || 'Tu descripción aparecerá aquí en el feed...'}
									</div>
									<div class="mock-sound-tag">
										<span class="material-icons-round">music_note</span>
										{soundTitle || 'Audio original'}
									</div>
								</div>
							</div>
						{/if}

						<!-- Floating Timecode Badge -->
						<div class="timecode-pill">
							{formatTime(currentTime)} / {formatTime(videoDuration)}
						</div>
					</div>

					<!-- Viewport Tools Quick Bar -->
					<div class="viewport-quick-tools glass-panel">
						<button
							class="v-tool-btn"
							class:active={showSafeZones}
							onclick={() => (showSafeZones = !showSafeZones)}
							title="Guía de Zona Segura (TikTok/Shorts)"
						>
							<span class="material-icons-round">grid_view</span>
							<span>Zona Segura</span>
						</button>

						<button
							class="v-tool-btn"
							class:active={hasTextOverlay}
							onclick={() => {
								hasTextOverlay = !hasTextOverlay;
								if (hasTextOverlay && !overlayText) overlayText = 'Texto en Reel ✨';
								activeConsoleTab = 'studio';
							}}
							title="Añadir texto en pantalla"
						>
							<span class="material-icons-round">title</span>
							<span>Texto</span>
						</button>

						<button
							class="v-tool-btn"
							class:active={fitMode === 'contain'}
							onclick={() => (fitMode = fitMode === 'cover' ? 'contain' : 'cover')}
							title="Ajuste de video (Cover / Contain)"
						>
							<span class="material-icons-round">
								{fitMode === 'cover' ? 'crop_free' : 'fullscreen'}
							</span>
							<span>{fitMode === 'cover' ? 'Llenar' : 'Ajustar'}</span>
						</button>

						<button
							class="v-tool-btn"
							onclick={captureCurrentFrameAsThumbnail}
							title="Capturar fotograma actual como portada"
						>
							<span class="material-icons-round">camera_enhance</span>
							<span>Portada</span>
						</button>

						<div class="v-tool-divider"></div>

						<!-- Playback Speed -->
						<div class="speed-pills-row">
							{#each [0.5, 1.0, 1.5, 2.0] as rate}
								<button
									class="speed-select-btn"
									class:active={playbackRate === rate}
									onclick={() => setSpeed(rate)}
								>
									{rate}x
								</button>
							{/each}
						</div>
					</div>

					<!-- Scrubber Timeline Bar -->
					<div class="studio-scrubber-bar glass-panel">
						<button class="scrub-play-btn" onclick={togglePlay} aria-label="Reproducir o pausar">
							<span class="material-icons-round">{isPlaying ? 'pause' : 'play_arrow'}</span>
						</button>

						<div
							class="scrub-track-area"
							onclick={handleTimelineSeek}
							onkeydown={(e) => e.key === 'Enter' && handleTimelineSeek(e)}
							role="slider"
							tabindex="0"
							aria-valuemin="0"
							aria-valuemax={videoDuration}
							aria-valuenow={currentTime}
						>
							<div
								class="scrub-progress-fill"
								style="width: {videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0}%;"
							></div>
							<div
								class="scrub-thumb-dot"
								style="left: {videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0}%;"
							></div>
						</div>

						<div class="audio-control-cluster">
							<button
								class="audio-mute-toggle"
								onclick={toggleMute}
								title={isMuted ? 'Activar sonido' : 'Silenciar'}
								aria-label="Silenciar"
							>
								<span class="material-icons-round">
									{isMuted || volume === 0 ? 'volume_off' : 'volume_up'}
								</span>
							</button>
							<input
								type="range"
								min="0"
								max="1.5"
								step="0.05"
								value={isMuted ? 0 : volume}
								oninput={handleVolumeChange}
								class="audio-slider-input"
								title="Volumen del Reel"
							/>
						</div>
					</div>
				</div>
			</section>

			<!-- ── Right: Creator Console Sidebar ── -->
			<aside class="editor-console-sidebar glass-panel">
				<!-- Console Navigation Tabs -->
				<nav class="console-tabs-header">
					<button
						class="console-nav-tab"
						class:active={activeConsoleTab === 'details'}
						onclick={() => (activeConsoleTab = 'details')}
					>
						<span class="material-icons-round">edit_note</span>
						<span>Detalles</span>
					</button>
					<button
						class="console-nav-tab"
						class:active={activeConsoleTab === 'studio'}
						onclick={() => (activeConsoleTab = 'studio')}
					>
						<span class="material-icons-round">auto_fix_high</span>
						<span>Filtros & Texto</span>
					</button>
					<button
						class="console-nav-tab"
						class:active={activeConsoleTab === 'settings'}
						onclick={() => (activeConsoleTab = 'settings')}
					>
						<span class="material-icons-round">tune</span>
						<span>Ajustes</span>
					</button>
				</nav>

				<!-- Scrollable Tab Pane Body -->
				<div class="console-body-scroll">
					<!-- TAB 1: Detalles & Copywriting -->
					{#if activeConsoleTab === 'details'}
						<div class="console-pane" in:fade={{ duration: 180 }}>
							<!-- Caption Input -->
							<div class="control-group">
								<div class="field-label-row">
									<label for="reel-caption-input" class="field-label">
										<span class="material-icons-round">description</span>
										<span>Descripción & Hashtags</span>
									</label>
									<span class="char-limit-indicator" class:near-max={caption.length > 2100}>
										{caption.length} / 2200
									</span>
								</div>

								<div class="caption-editor-wrapper">
									<textarea
										id="reel-caption-input"
										bind:value={caption}
										placeholder="Escribe una descripción atractiva, cuenta una historia o haz una pregunta a tu comunidad..."
										class="caption-textarea"
										rows="4"
										maxlength="2200"
										disabled={uploading}
									></textarea>

									<!-- Emoji Bar -->
									<div class="quick-emojis-bar">
										{#each QUICK_EMOJIS as emoji}
											<button
												type="button"
												class="quick-emoji-btn"
												onclick={() => insertEmoji(emoji)}
											>
												{emoji}
											</button>
										{/each}
									</div>
								</div>
							</div>

							<!-- Hashtags Cloud -->
							<div class="control-group">
								<span class="field-sublabel">Hashtags recomendados</span>
								<div class="hashtags-pills-cloud">
									{#each POPULAR_HASHTAGS as tag}
										<button
											type="button"
											class="hashtag-bubble"
											class:active={caption.includes(tag)}
											onclick={() => insertHashtag(tag)}
										>
											{tag}
										</button>
									{/each}
								</div>
							</div>

							<!-- Audio Title -->
							<div class="control-group">
								<label for="sound-title-field" class="field-label">
									<span class="material-icons-round">graphic_eq</span>
									<span>Nombre de la Pista / Audio</span>
								</label>
								<div class="icon-input-wrap">
									<span class="material-icons-round lead-icon">music_note</span>
									<input
										id="sound-title-field"
										type="text"
										bind:value={soundTitle}
										placeholder="Audio original - @usuario"
										class="studio-text-input"
										maxlength="100"
									/>
								</div>
							</div>

							<!-- Thumbnail Preview Card -->
							<div class="control-group">
								<div class="field-label-row">
									<span class="field-label">
										<span class="material-icons-round">image</span>
										<span>Portada del Reel</span>
									</span>
									<button
										type="button"
										class="text-link-btn"
										onclick={() => customThumbInput.click()}
									>
										Subir personalizada
									</button>
								</div>

								<div class="cover-thumbnail-card">
									{#if thumbnailDataUrl}
										<div class="cover-thumb-preview">
											<img src={thumbnailDataUrl} alt="Portada Reel" class="cover-img" />
											<span class="cover-source-tag">
												{thumbnailSource === 'custom' ? 'Personalizada' : 'Fotograma'}
											</span>
										</div>
									{:else}
										<div class="cover-thumb-empty">
											<span class="material-icons-round">photo_size_select_actual</span>
											<span>Generando...</span>
										</div>
									{/if}

									<div class="cover-actions-col">
										<button
											type="button"
											class="btn-aero-secondary capture-btn"
											onclick={captureCurrentFrameAsThumbnail}
										>
											<span class="material-icons-round">refresh</span>
											<span>Capturar fotograma actual</span>
										</button>
										<p class="cover-instructions">
											Desplaza el video al segundo deseado para capturar la portada ideal.
										</p>
									</div>
								</div>
							</div>
						</div>
					{:else if activeConsoleTab === 'studio'}
						<!-- TAB 2: Filtros & Editor de Texto -->
						<div class="console-pane" in:fade={{ duration: 180 }}>
							<!-- Filter Presets -->
							<div class="control-group">
								<span class="field-label">
									<span class="material-icons-round">palette</span>
									<span>Filtros de Color Grading</span>
								</span>
								<div class="filters-cards-grid">
									{#each FILTERS as f}
										<button
											type="button"
											class="filter-preset-card"
											class:active={activeFilter === f.id}
											onclick={() => (activeFilter = f.id)}
										>
											<div class="filter-preview-circle" style="filter: {f.css};">
												<span class="material-icons-round">{f.icon}</span>
											</div>
											<span class="filter-label">{f.name}</span>
										</button>
									{/each}
								</div>
							</div>

							<!-- Text Overlays -->
							<div class="control-group group-divider">
								<div class="field-label-row">
									<span class="field-label">
										<span class="material-icons-round">title</span>
										<span>Texto en Pantalla</span>
									</span>
									<label class="aero-switch">
										<input type="checkbox" bind:checked={hasTextOverlay} />
										<span class="switch-rail"></span>
									</label>
								</div>

								{#if hasTextOverlay}
									<div class="text-studio-box" transition:slide={{ duration: 200 }}>
										<input
											type="text"
											bind:value={overlayText}
											placeholder="Escribe el texto para el video..."
											class="studio-text-input"
											maxlength="80"
										/>

										<!-- Font Selector -->
										<div class="studio-subgroup">
											<span class="studio-sub-label">Tipografía</span>
											<div class="fonts-chips-row">
												{#each FONTS as font}
													<button
														type="button"
														class="font-bubble"
														class:active={overlayFont === font.id}
														onclick={() => (overlayFont = font.id)}
													>
														{font.label}
													</button>
												{/each}
											</div>
										</div>

										<!-- Color Palette -->
										<div class="studio-subgroup">
											<span class="studio-sub-label">Color del texto</span>
											<div class="colors-palette-dots">
												{#each TEXT_COLORS as col}
													<button
														type="button"
														class="color-circle"
														class:active={overlayColor === col}
														style="background: {col};"
														onclick={() => (overlayColor = col)}
														aria-label="Color {col}"
														title="Color {col}"
													></button>
												{/each}
											</div>
										</div>

										<!-- Color & Background Styles + Alignment -->
										<div class="style-options-row mt-1">
											<div class="bg-styles-section">
												<span class="studio-sub-label">Fondo de texto</span>
												<div class="bg-styles-pill-group">
													<button
														type="button"
														class="bg-style-pill"
														class:active={overlayBgStyle === 'pill'}
														onclick={() => (overlayBgStyle = 'pill')}
													>
														Píldora
													</button>
													<button
														type="button"
														class="bg-style-pill"
														class:active={overlayBgStyle === 'solid'}
														onclick={() => (overlayBgStyle = 'solid')}
													>
														Sólido
													</button>
													<button
														type="button"
														class="bg-style-pill"
														class:active={overlayBgStyle === 'neon'}
														onclick={() => (overlayBgStyle = 'neon')}
													>
														Neón
													</button>
													<button
														type="button"
														class="bg-style-pill"
														class:active={overlayBgStyle === 'none'}
														onclick={() => (overlayBgStyle = 'none')}
													>
														Texto
													</button>
												</div>
											</div>

											<div class="align-section">
												<span class="studio-sub-label">Alineación</span>
												<div class="align-btn-group">
													<button
														type="button"
														class="align-btn"
														class:active={overlayAlign === 'left'}
														onclick={() => (overlayAlign = 'left')}
														aria-label="Alinear a la izquierda"
														title="Izquierda"
													>
														<span class="material-icons-round">format_align_left</span>
													</button>
													<button
														type="button"
														class="align-btn"
														class:active={overlayAlign === 'center'}
														onclick={() => (overlayAlign = 'center')}
														aria-label="Centrar texto"
														title="Centro"
													>
														<span class="material-icons-round">format_align_center</span>
													</button>
													<button
														type="button"
														class="align-btn"
														class:active={overlayAlign === 'right'}
														onclick={() => (overlayAlign = 'right')}
														aria-label="Alinear a la derecha"
														title="Derecha"
													>
														<span class="material-icons-round">format_align_right</span>
													</button>
												</div>
											</div>
										</div>

										<p class="drag-instruction-hint">
											<span class="material-icons-round" style="font-size: 14px;">touch_app</span>
											<span>Arrastra el texto libremente sobre el video para ubicarlo.</span>
										</p>
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<!-- TAB 3: Ajustes de Audiencia & Privacidad -->
						<div class="console-pane" in:fade={{ duration: 180 }}>
							<!-- Privacy -->
							<div class="control-group">
								<span class="field-label">
									<span class="material-icons-round">visibility</span>
									<span>¿Quién puede ver este Reel?</span>
								</span>
								<div class="privacy-cards-stack">
									<label class="privacy-card" class:active={privacySetting === 'public'}>
										<input type="radio" name="privacy" value="public" bind:group={privacySetting} />
										<div class="privacy-card-body">
											<span class="material-icons-round p-icon">public</span>
											<div>
												<div class="p-title">Público (Recomendado)</div>
												<div class="p-desc">Visible para todos en el Feed y búsqueda.</div>
											</div>
										</div>
									</label>

									<label class="privacy-card" class:active={privacySetting === 'followers'}>
										<input
											type="radio"
											name="privacy"
											value="followers"
											bind:group={privacySetting}
										/>
										<div class="privacy-card-body">
											<span class="material-icons-round p-icon">group</span>
											<div>
												<div class="p-title">Solo Seguidores</div>
												<div class="p-desc">Únicamente tus seguidores podrán verlo.</div>
											</div>
										</div>
									</label>

									<label class="privacy-card" class:active={privacySetting === 'private'}>
										<input
											type="radio"
											name="privacy"
											value="private"
											bind:group={privacySetting}
										/>
										<div class="privacy-card-body">
											<span class="material-icons-round p-icon">lock</span>
											<div>
												<div class="p-title">Privado</div>
												<div class="p-desc">Solo tú podrás ver este Reel.</div>
											</div>
										</div>
									</label>
								</div>
							</div>

							<!-- Permissions Switches -->
							<div class="control-group group-divider">
								<span class="field-label">Permisos e Interactividad</span>

								<div class="permission-switch-row">
									<div class="perm-info">
										<span class="material-icons-round">forum</span>
										<div>
											<div class="perm-title">Permitir Comentarios</div>
											<div class="perm-desc">Los usuarios pueden dejar opiniones.</div>
										</div>
									</div>
									<label class="aero-switch">
										<input type="checkbox" bind:checked={allowComments} />
										<span class="switch-rail"></span>
									</label>
								</div>

								<div class="permission-switch-row">
									<div class="perm-info">
										<span class="material-icons-round">share</span>
										<div>
											<div class="perm-title">Permitir Compartir</div>
											<div class="perm-desc">Compartir en historias y mensajes.</div>
										</div>
									</div>
									<label class="aero-switch">
										<input type="checkbox" bind:checked={allowSharing} />
										<span class="switch-rail"></span>
									</label>
								</div>

								<div class="permission-switch-row">
									<div class="perm-info">
										<span class="material-icons-round">warning_amber</span>
										<div>
											<div class="perm-title">Aviso de Contenido Sensible</div>
											<div class="perm-desc">Advertencia previa antes de reproducir.</div>
										</div>
									</div>
									<label class="aero-switch">
										<input type="checkbox" bind:checked={isSensitiveContent} />
										<span class="switch-rail"></span>
									</label>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Console Bottom Publish Action -->
				<footer class="console-footer-dock">
					<div class="xp-gain-badge">
						<span class="material-icons-round">stars</span>
						<span>Ganas <strong>+5 XP</strong> al compartir</span>
					</div>

					<button
						class="btn-aero-primary publish-reel-btn"
						onclick={handlePublish}
						disabled={!canPublish || uploading}
					>
						{#if uploading}
							<div class="aero-spinner"></div>
							<span>Subiendo Reel ({uploadProgress}%)...</span>
						{:else if success}
							<span class="material-icons-round">check_circle</span>
							<span>¡Publicado con éxito!</span>
						{:else}
							<span class="material-icons-round">rocket_launch</span>
							<span>Compartir Reel</span>
						{/if}
					</button>
				</footer>
			</aside>
		</div>
	{/if}

	<!-- Hidden Inputs -->
	<input
		type="file"
		bind:this={fileInput}
		accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
		style="display:none"
		onchange={handleFileInput}
	/>

	<input
		type="file"
		bind:this={customThumbInput}
		accept="image/jpeg,image/png,image/webp"
		style="display:none"
		onchange={handleCustomThumbnailUpload}
	/>

	<!-- ── Modal: Atajos de Teclado ──────────────────────────────────────── -->
	{#if showShortcutsModal}
		<div class="studio-modal-backdrop" transition:fade={{ duration: 150 }}>
			<div
				class="studio-modal-card glass-panel"
				transition:scale={{ duration: 200, easing: cubicOut }}
			>
				<div class="modal-top-row">
					<div class="modal-title-wrap">
						<span class="material-icons-round modal-ico">keyboard</span>
						<h3>Atajos de Teclado del Studio</h3>
					</div>
					<button
						class="modal-close-btn"
						onclick={() => (showShortcutsModal = false)}
						aria-label="Cerrar modal"
					>
						<span class="material-icons-round">close</span>
					</button>
				</div>

				<div class="modal-shortcuts-table">
					<div class="shortcut-row">
						<span>Reproducir / Pausar video</span>
						<kbd class="key-pill">Espacio</kbd>
					</div>
					<div class="shortcut-row">
						<span>Silenciar / Activar audio</span>
						<kbd class="key-pill">M</kbd>
					</div>
					<div class="shortcut-row">
						<span>Retroceder 1 segundo</span>
						<kbd class="key-pill">← Flecha Izq</kbd>
					</div>
					<div class="shortcut-row">
						<span>Avanzar 1 segundo</span>
						<kbd class="key-pill">→ Flecha Der</kbd>
					</div>
				</div>

				<button class="btn-aero-primary modal-ok-btn" onclick={() => (showShortcutsModal = false)}>
					Entendido
				</button>
			</div>
		</div>
	{/if}

	<!-- ── Modal: Confirmar Descartar ────────────────────────────────────── -->
	{#if showDiscardModal}
		<div class="studio-modal-backdrop" transition:fade={{ duration: 150 }}>
			<div
				class="studio-modal-card glass-panel"
				transition:scale={{ duration: 200, easing: cubicOut }}
			>
				<div class="modal-top-row">
					<div class="modal-title-wrap danger-title">
						<span class="material-icons-round modal-ico">warning_amber</span>
						<h3>¿Descartar este Reel?</h3>
					</div>
					<button
						class="modal-close-btn"
						onclick={() => (showDiscardModal = false)}
						aria-label="Cerrar modal"
					>
						<span class="material-icons-round">close</span>
					</button>
				</div>

				<p class="modal-warn-text">
					Se perderá el video cargado, tus textos en pantalla, filtros y la descripción redactada.
					Esta acción no se puede deshacer.
				</p>

				<div class="modal-actions-row">
					<button class="btn-aero-ghost" onclick={() => (showDiscardModal = false)}>
						Seguir editando
					</button>
					<button class="btn-aero-danger" onclick={confirmDiscard}> Descartar Reel </button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* ── Contenedor Raíz Studio ────────────────────────────────────────── */
	.studio-root {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		user-select: none;
		font-family: var(--font-sans);
		color: var(--text-primary);
		background: transparent;
	}

	/* ── Header Integrado (Studio Top Bar) ─────────────────────────────── */
	.studio-header {
		flex: 0 0 auto;
		width: 100%;
		height: 58px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 20px;
		margin: 0;
		border: none;
		border-bottom: 1px solid var(--border-subtle);
		border-radius: 0;
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		box-shadow:
			0 1px 0 var(--border-subtle),
			0 4px 16px rgba(0, 0, 0, 0.03);
		position: relative;
		z-index: 30;
	}
	.studio-header::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			var(--glass-border-t) 25%,
			rgba(var(--accent-blue-rgb), 0.35) 50%,
			var(--glass-border-t) 75%,
			transparent 100%
		);
		pointer-events: none;
	}

	.header-brand-side {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.studio-back-btn {
		flex: 0 0 38px;
		min-width: 38px;
		min-height: 38px;
		border-radius: var(--radius-md);
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		transition: all 0.22s var(--ease-spring);
		cursor: pointer;
		box-shadow: var(--glass-inset);
	}
	.studio-back-btn:hover {
		background: var(--bg-surface-hover);
		border-color: var(--aero-blue);
		color: var(--aero-blue);
		box-shadow: 0 4px 14px rgba(var(--accent-blue-rgb), 0.25);
		transform: translateY(-1px) scale(1.04);
	}
	.studio-back-btn:active {
		transform: scale(0.96);
	}
	.studio-back-btn .material-icons-round {
		font-size: 20px;
	}

	.header-divider {
		width: 1px;
		height: 24px;
		background: var(--border-subtle);
		margin: 0 2px;
	}

	.header-titles {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.badge-title {
		font-family: var(--font-display);
		font-size: 0.92rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 7px;
		line-height: 1.1;
	}

	.studio-logo-badge {
		width: 26px;
		height: 26px;
		border-radius: var(--radius-xs);
		background: linear-gradient(
			135deg,
			rgba(var(--accent-blue-rgb), 0.16),
			rgba(var(--aero-mint-rgb), 0.14)
		);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.28);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--aero-blue);
		flex-shrink: 0;
		box-shadow: 0 2px 8px rgba(var(--accent-blue-rgb), 0.15);
	}
	.studio-logo-badge .material-icons-round {
		font-size: 15px;
	}

	.title-text {
		color: var(--text-primary);
	}

	.pulse-indicator {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--aero-mint);
		box-shadow: 0 0 8px var(--aero-mint);
		animation: pulse-dot 2s infinite ease-in-out;
	}
	@keyframes pulse-dot {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.3);
			opacity: 0.6;
		}
	}

	.pro-tag {
		font-size: 0.6rem;
		font-weight: 900;
		color: #ffffff;
		background: var(--accent-gradient);
		padding: 1px 6px;
		border-radius: var(--radius-xs);
		letter-spacing: 0.06em;
		box-shadow: 0 2px 6px rgba(var(--aero-mint-rgb), 0.25);
	}

	.subtitle-text {
		font-size: 0.7rem;
		color: var(--text-muted);
		font-weight: 500;
		line-height: 1;
	}

	/* Center Contextual Studio Status / Workflow Pill */
	.header-center-info {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.studio-status-pill {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px;
		border-radius: var(--radius-full);
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.15);
		transition: all 0.25s var(--ease-spring);
	}
	.studio-status-pill:hover {
		background: var(--bg-surface-hover);
		border-color: rgba(var(--accent-blue-rgb), 0.35);
	}

	.status-live-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.status-live-dot.ready {
		background: var(--aero-mint);
		box-shadow: 0 0 8px var(--aero-mint);
		animation: pulse-dot 2.5s infinite ease-in-out;
	}
	.status-live-dot.edit-mode {
		background: var(--aero-sky);
		box-shadow: 0 0 8px var(--aero-sky);
		animation: pulse-dot 2s infinite ease-in-out;
	}

	.pill-icon {
		font-size: 15px;
		color: var(--aero-blue);
	}

	.status-pill-text {
		font-size: 0.76rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: 0.02em;
	}

	.status-meta-tag {
		font-size: 0.62rem;
		font-weight: 800;
		color: var(--aero-blue);
		background: rgba(var(--accent-blue-rgb), 0.1);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.22);
		padding: 1px 5px;
		border-radius: 4px;
		font-family: var(--font-mono, monospace);
	}

	.header-actions-side {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.studio-icon-btn {
		height: 36px;
		padding: 0 12px;
		border-radius: var(--radius-md);
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
		box-shadow: var(--glass-inset);
		font-size: 0.8rem;
		font-weight: 600;
	}
	.studio-icon-btn:hover {
		background: var(--bg-surface-hover);
		border-color: var(--aero-blue);
		color: var(--aero-blue);
		transform: translateY(-1px);
		box-shadow: 0 4px 14px rgba(var(--accent-blue-rgb), 0.15);
	}
	.studio-icon-btn:active {
		transform: scale(0.96);
	}
	.studio-icon-btn .material-icons-round {
		font-size: 17px;
	}

	.btn-kbd-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-secondary);
	}
	.studio-icon-btn:hover .btn-kbd-label {
		color: var(--aero-blue);
	}

	.studio-discard-action {
		flex: 0 0 auto;
		height: 36px;
		min-height: 36px;
		padding: 0 14px;
		border-radius: var(--radius-md);
		background: rgba(var(--aero-rose-rgb), 0.1);
		border: 1px solid rgba(var(--aero-rose-rgb), 0.28);
		color: var(--aero-rose);
		font-weight: 700;
		font-size: 0.8rem;
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}
	.studio-discard-action:hover:not(:disabled) {
		background: rgba(var(--aero-rose-rgb), 0.18);
		border-color: var(--aero-rose);
		transform: translateY(-1px);
	}
	.studio-discard-action:active:not(:disabled) {
		transform: scale(0.96);
	}
	.studio-discard-action .material-icons-round {
		font-size: 17px;
	}

	@media (max-width: 768px) {
		.studio-header {
			margin: 0;
			padding: 0 12px;
			height: 54px;
			border-radius: 0;
		}
		.header-center-info {
			display: none;
		}
		.subtitle-text {
			display: none;
		}
		.header-divider {
			display: none;
		}
		.btn-kbd-label {
			display: none;
		}
	}

	/* ── Error Toast ───────────────────────────────────────────────────── */
	.studio-error-toast {
		position: absolute;
		top: 68px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		background: rgba(var(--aero-rose-rgb), 0.15);
		border: 1px solid var(--aero-rose);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		color: var(--text-primary);
		padding: 10px 18px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		gap: 10px;
		box-shadow: 0 10px 30px rgba(var(--aero-rose-rgb), 0.25);
		max-width: 90%;
	}
	.error-icon {
		color: var(--aero-rose);
		font-size: 20px;
	}
	.error-msg {
		font-size: 0.85rem;
		font-weight: 600;
	}
	.error-close-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		padding: 0;
	}

	/* ── FASE 1: Ingest Stage ──────────────────────────────────────────── */
	.studio-ingest-stage {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 20px 32px 20px;
		overflow-y: auto;
	}

	.upload-studio-card {
		width: 100%;
		max-width: 780px;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		padding: 28px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		box-shadow: var(--glass-inset), var(--glass-shadow);
	}

	.studio-dropzone {
		width: 100%;
		min-height: 290px;
		border-radius: var(--radius-lg);
		background: var(--bg-surface2);
		border: 2px dashed rgba(var(--accent-blue-rgb), 0.35);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 28px 24px;
		cursor: pointer;
		transition: all 0.3s var(--ease-spring);
	}
	.studio-dropzone:hover,
	.studio-dropzone.dragging {
		border-color: var(--aero-blue);
		background: rgba(var(--accent-blue-rgb), 0.08);
		transform: scale(1.01);
		box-shadow: 0 0 24px rgba(var(--accent-blue-rgb), 0.15);
	}

	.dropzone-icon-halo {
		width: 64px;
		height: 64px;
		border-radius: var(--radius-squircle);
		background: rgba(var(--accent-blue-rgb), 0.12);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.28);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--aero-blue);
		margin-bottom: 14px;
		box-shadow: 0 4px 16px rgba(var(--accent-blue-rgb), 0.2);
		transition: transform 0.25s var(--ease-spring);
	}
	.dropzone-icon-halo .material-icons-round {
		font-size: 32px;
	}
	.studio-dropzone:hover .dropzone-icon-halo {
		transform: scale(1.08);
		background: rgba(var(--accent-blue-rgb), 0.2);
	}

	.dropzone-title {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0 0 6px;
	}
	.dropzone-desc {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin: 0 0 20px;
	}

	.specs-pills-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		margin-bottom: 22px;
	}
	.spec-pill {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		padding: 6px 14px;
		border-radius: var(--radius-full);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		gap: 6px;
		box-shadow: var(--glass-inset);
	}
	.spec-pill .material-icons-round {
		font-size: 15px;
		color: var(--aero-blue);
	}

	.browse-action-btn {
		padding: 12px 28px;
		font-size: 0.92rem;
		font-weight: 800;
		display: flex;
		align-items: center;
		gap: 8px;
		border-radius: var(--radius-full);
		box-shadow: var(--shadow-btn-primary);
	}

	.studio-guidelines-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}
	@media (max-width: 768px) {
		.studio-guidelines-row {
			grid-template-columns: 1fr;
		}
	}

	.guide-item {
		padding: 12px 14px;
		border-radius: var(--radius-md);
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		gap: 12px;
		box-shadow: var(--glass-inset);
		transition: all 0.2s var(--ease-spring);
	}
	.guide-item:hover {
		background: var(--bg-surface-hover);
		border-color: rgba(var(--accent-blue-rgb), 0.3);
		transform: translateY(-1px);
	}
	.guide-icon {
		color: var(--aero-blue);
		font-size: 20px;
		background: rgba(var(--accent-blue-rgb), 0.12);
		padding: 8px;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}
	.guide-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.guide-text strong {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.guide-text span {
		font-size: 0.7rem;
		color: var(--text-muted);
		line-height: 1.25;
	}

	/* Live Camera Stage */
	.camera-stage-card {
		width: 100%;
		max-width: 400px;
		height: calc(100vh - 160px);
		max-height: 600px;
		background: #000;
		border-radius: var(--radius-xl);
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.15);
		position: relative;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
	}

	.camera-viewport-box {
		width: 100%;
		height: 100%;
		position: relative;
	}
	.camera-stream-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scaleX(-1);
	}

	.camera-hud-layer {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 16px;
		background: linear-gradient(
			to bottom,
			rgba(0, 0, 0, 0.55) 0%,
			transparent 25%,
			transparent 70%,
			rgba(0, 0, 0, 0.7) 100%
		);
		pointer-events: none;
	}

	.hud-top-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		pointer-events: auto;
	}

	.recording-badge {
		background: rgba(236, 72, 153, 0.2);
		border: 1px solid var(--aero-rose);
		color: #ffffff;
		padding: 4px 10px;
		border-radius: var(--radius-full);
		font-weight: 800;
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		gap: 6px;
		backdrop-filter: blur(8px);
	}
	.recording-badge.paused {
		border-color: var(--aero-amber);
		color: var(--aero-amber);
	}
	.rec-pulsing-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--aero-rose);
		box-shadow: 0 0 8px var(--aero-rose);
		animation: pulse-dot 1s infinite;
	}

	.standby-tag {
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: rgba(255, 255, 255, 0.8);
		padding: 4px 10px;
		border-radius: var(--radius-full);
		font-size: 0.72rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 5px;
		backdrop-filter: blur(8px);
	}

	.mic-level-meter {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(0, 0, 0, 0.5);
		padding: 4px 8px;
		border-radius: var(--radius-full);
		backdrop-filter: blur(8px);
	}
	.mic-ico {
		font-size: 15px;
		color: var(--aero-mint);
	}
	.meter-track {
		width: 40px;
		height: 5px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		overflow: hidden;
	}
	.meter-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--aero-mint), var(--aero-amber), var(--aero-rose));
		transition: width 0.08s linear;
	}

	.countdown-modal {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.countdown-val {
		font-family: var(--font-display);
		font-size: 4.5rem;
		font-weight: 900;
		color: #ffffff;
		text-shadow: 0 0 25px rgba(46, 180, 255, 0.8);
	}
	.countdown-text {
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 2px;
		color: var(--aero-sky);
		font-size: 0.85rem;
	}

	.hud-bottom-bar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		pointer-events: auto;
	}

	.device-selects-row {
		display: flex;
		gap: 6px;
		width: 100%;
		max-width: 300px;
	}
	.hud-device-dropdown {
		flex: 1;
		background: rgba(0, 0, 0, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: #ffffff;
		padding: 5px 8px;
		border-radius: var(--radius-sm);
		font-size: 0.72rem;
		backdrop-filter: blur(10px);
		outline: none;
	}

	.record-shutter-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
	}

	.shutter-circle-btn {
		width: 68px;
		height: 68px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		border: 3px solid #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.25s var(--ease-spring);
		box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
	}
	.shutter-circle-btn:hover {
		transform: scale(1.06);
	}
	.shutter-red-inner {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: var(--aero-rose);
		transition: all 0.25s var(--ease-spring);
	}
	.shutter-stop-square {
		width: 22px;
		height: 22px;
		border-radius: 5px;
		background: var(--aero-rose);
	}

	.shutter-pause-btn {
		flex: 0 0 40px;
		min-width: 40px;
		min-height: 40px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.25);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
	}
	.shutter-pause-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		transform: scale(1.05);
	}

	/* ── FASE 2: Studio Split Editor Layout ────────────────────────────── */
	.studio-editor-stage {
		flex: 1;
		display: flex;
		overflow: hidden;
		position: relative;
	}
	@media (max-width: 1024px) {
		.studio-editor-stage {
			flex-direction: column;
			overflow-y: auto;
		}
	}

	/* Viewport Column */
	.editor-viewport-column {
		flex: 1;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: #030712;
		padding: 16px;
	}
	@media (max-width: 1024px) {
		.editor-viewport-column {
			flex: 0 0 auto;
			min-height: 480px;
			padding: 10px;
		}
	}

	/* ── Cinematic Ambient Lighting (YouTube Ambient Mode) ─────────────── */
	.ambient-cinematic-glow-wrap {
		position: absolute;
		inset: -15%;
		width: 130%;
		height: 130%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		pointer-events: none;
		z-index: 1;
	}

	.ambient-cinematic-canvas {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(80px) saturate(1.75) brightness(0.65);
		opacity: 0.9;
		transform: scale(1.1) translateZ(0);
		will-change: transform, opacity;
		transition: opacity 0.4s var(--ease-out);
		mask-image: radial-gradient(ellipse 70% 65% at 50% 50%, black 25%, transparent 80%);
		-webkit-mask-image: radial-gradient(ellipse 70% 65% at 50% 50%, black 25%, transparent 80%);
	}

	.ambient-radial-vignette {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			circle at center,
			rgba(0, 0, 0, 0.1) 0%,
			rgba(0, 0, 0, 0.6) 65%,
			rgba(3, 7, 18, 0.95) 100%
		);
		pointer-events: none;
		z-index: 2;
	}

	.viewport-center-stack {
		position: relative;
		z-index: 5;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		max-width: 440px;
	}

	.phone-canvas-frame {
		width: 100%;
		height: calc(100vh - 210px);
		max-height: 560px;
		position: relative;
		border-radius: var(--radius-xl);
		background: #000000;
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	@media (max-width: 768px) {
		.phone-canvas-frame {
			height: 55vh;
			border-radius: var(--radius-lg);
		}
	}

	.canvas-video-player {
		width: 100%;
		height: 100%;
		cursor: pointer;
	}
	.canvas-video-player.fit-cover {
		object-fit: cover;
	}
	.canvas-video-player.fit-contain {
		object-fit: contain;
	}

	.tap-ripple-circle {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(10px);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		pointer-events: none;
		z-index: 15;
	}
	.tap-ripple-circle .material-icons-round {
		font-size: 34px;
	}

	.screen-text-overlay {
		position: absolute;
		z-index: 20;
		cursor: grab;
		user-select: none;
		touch-action: none;
		max-width: 85%;
		word-break: break-word;
	}
	.screen-text-overlay:active {
		cursor: grabbing;
	}

	/* Safe-Zone Overlay */
	.safezone-guide-overlay {
		position: absolute;
		inset: 0;
		z-index: 25;
		pointer-events: none;
	}
	.safezone-boundary {
		position: absolute;
		inset: 14px;
		border: 1.5px dashed rgba(46, 180, 255, 0.65);
		border-radius: 14px;
	}
	.safezone-pill {
		position: absolute;
		top: 6px;
		left: 10px;
		font-size: 0.62rem;
		font-weight: 800;
		color: var(--aero-sky);
		background: rgba(0, 0, 0, 0.75);
		padding: 2px 6px;
		border-radius: 4px;
	}

	.mock-ui-right-stack {
		position: absolute;
		right: 10px;
		bottom: 80px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		opacity: 0.65;
	}
	.mock-avatar-circle {
		position: relative;
		color: rgba(255, 255, 255, 0.85);
	}
	.mock-avatar-circle .material-icons-round {
		font-size: 30px;
	}
	.mock-add-dot {
		position: absolute;
		bottom: -2px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--aero-rose);
		color: #fff;
		font-size: 9px;
		font-weight: 900;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.mock-action-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: #fff;
		font-size: 0.62rem;
		font-weight: 700;
	}
	.mock-action-btn .material-icons-round {
		font-size: 24px;
	}
	.mock-disc-icon {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #111;
		border: 2px solid rgba(255, 255, 255, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--aero-mint);
		animation: spin-disc 4s linear infinite;
	}
	@keyframes spin-disc {
		to {
			transform: rotate(360deg);
		}
	}

	.mock-ui-bottom-bar {
		position: absolute;
		left: 16px;
		right: 60px;
		bottom: 16px;
		display: flex;
		flex-direction: column;
		gap: 3px;
		opacity: 0.75;
	}
	.mock-user-tag {
		font-weight: 800;
		font-size: 0.8rem;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
	}
	.mock-caption-preview {
		font-size: 0.72rem;
		line-height: 1.3;
		max-height: 28px;
		overflow: hidden;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
	}
	.mock-sound-tag {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.68rem;
		color: rgba(255, 255, 255, 0.8);
	}
	.mock-sound-tag .material-icons-round {
		font-size: 13px;
	}

	.timecode-pill {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 10;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.15);
		padding: 3px 8px;
		border-radius: var(--radius-full);
		font-size: 0.72rem;
		font-family: var(--font-mono, monospace);
		color: rgba(255, 255, 255, 0.9);
	}

	/* Viewport Quick Tools */
	.viewport-quick-tools {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		margin-top: 10px;
		border-radius: var(--radius-md);
		background: rgba(12, 20, 30, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.v-tool-btn {
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.7);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		cursor: pointer;
		font-size: 0.65rem;
		font-weight: 700;
		padding: 3px 6px;
		border-radius: var(--radius-sm);
		transition: all 0.2s;
	}
	.v-tool-btn .material-icons-round {
		font-size: 18px;
	}
	.v-tool-btn:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.08);
	}
	.v-tool-btn.active {
		color: var(--aero-sky);
		background: rgba(46, 180, 255, 0.15);
	}

	.v-tool-divider {
		width: 1px;
		height: 20px;
		background: rgba(255, 255, 255, 0.15);
	}

	.speed-pills-row {
		display: flex;
		gap: 3px;
	}
	.speed-select-btn {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.7);
		padding: 3px 6px;
		border-radius: var(--radius-full);
		font-size: 0.68rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.2s;
	}
	.speed-select-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}
	.speed-select-btn.active {
		background: var(--aero-blue);
		color: #ffffff;
		border-color: var(--aero-sky);
	}

	/* Scrubber Timeline Bar */
	.studio-scrubber-bar {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 12px;
		margin-top: 6px;
		border-radius: var(--radius-md);
		background: rgba(12, 20, 30, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.scrub-play-btn {
		flex: 0 0 32px;
		min-width: 32px;
		min-height: 32px;
		border-radius: 50%;
		background: var(--aero-blue);
		border: none;
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: transform 0.2s var(--ease-spring);
	}
	.scrub-play-btn:hover {
		transform: scale(1.08);
	}

	.scrub-track-area {
		flex: 1;
		height: 6px;
		background: rgba(255, 255, 255, 0.15);
		border-radius: 3px;
		position: relative;
		cursor: pointer;
	}
	.scrub-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--aero-blue), var(--aero-sky));
		border-radius: 3px;
	}
	.scrub-thumb-dot {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
	}

	.audio-control-cluster {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.audio-mute-toggle {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		display: flex;
		padding: 0;
	}
	.audio-slider-input {
		width: 50px;
		accent-color: var(--aero-sky);
		cursor: pointer;
	}

	/* ── Right: Creator Console Sidebar ────────────────────────────────── */
	.editor-console-sidebar {
		width: 420px;
		flex-shrink: 0;
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: none;
		border-left: 1px solid var(--border-subtle);
		border-radius: 0;
		display: flex;
		flex-direction: column;
		z-index: 20;
		box-shadow: -10px 0 40px rgba(0, 0, 0, 0.15);
	}
	@media (max-width: 1024px) {
		.editor-console-sidebar {
			width: 100%;
			flex: 1;
			border: none;
			border-top: 1px solid var(--border-subtle);
			border-radius: 24px 24px 0 0;
		}
	}

	.console-tabs-header {
		display: flex;
		border-bottom: 1px solid var(--border-subtle);
		padding: 6px 14px;
		gap: 4px;
		background: var(--bg-surface2);
	}
	.console-nav-tab {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--text-muted);
		padding: 8px;
		border-radius: var(--radius-md);
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		transition: all 0.2s;
	}
	.console-nav-tab .material-icons-round {
		font-size: 17px;
	}
	.console-nav-tab:hover {
		color: var(--text-primary);
		background: var(--bg-surface-hover);
	}
	.console-nav-tab.active {
		color: var(--aero-sky);
		background: rgba(var(--accent-sky-rgb), 0.12);
		box-shadow: inset 0 -2px 0 var(--aero-sky);
	}

	.console-body-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 18px 18px 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		scrollbar-width: thin;
		scrollbar-color: var(--border-subtle) transparent;
	}
	.console-body-scroll::-webkit-scrollbar {
		width: 5px;
	}
	.console-body-scroll::-webkit-scrollbar-track {
		background: transparent;
	}
	.console-body-scroll::-webkit-scrollbar-thumb {
		background: var(--border-subtle);
		border-radius: var(--radius-full);
	}
	.console-body-scroll::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted);
	}

	.console-pane {
		display: flex;
		flex-direction: column;
		gap: 18px;
		width: 100%;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.group-divider {
		border-top: 1px solid var(--border-subtle);
		padding-top: 16px;
		margin-top: 4px;
	}

	.field-label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.field-label {
		font-size: 0.84rem;
		font-weight: 800;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 7px;
		letter-spacing: -0.01em;
	}
	.field-label .material-icons-round {
		font-size: 18px;
		color: var(--aero-sky);
		filter: drop-shadow(0 1px 4px rgba(46, 180, 255, 0.25));
	}
	.field-sublabel {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.char-limit-indicator {
		font-size: 0.72rem;
		font-family: var(--font-mono, monospace);
		color: var(--text-muted);
		background: var(--bg-surface2);
		padding: 2px 8px;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
		font-weight: 600;
		transition: all 0.2s;
	}
	.char-limit-indicator.near-max {
		color: var(--aero-rose);
		font-weight: 800;
		border-color: rgba(236, 72, 153, 0.4);
		background: rgba(236, 72, 153, 0.1);
	}

	.caption-editor-wrapper {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
		border-radius: var(--radius-md);
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
		overflow: hidden;
		cursor: var(--cursor-text, text);
		transition:
			border-color 0.2s var(--ease-out),
			box-shadow 0.2s var(--ease-out);
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	.caption-editor-wrapper:focus-within {
		border-color: var(--aero-sky);
		box-shadow:
			0 0 0 1px var(--aero-sky),
			0 4px 18px rgba(46, 180, 255, 0.18);
		background: var(--bg-input);
	}

	.caption-textarea {
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
		display: block;
		min-height: 96px;
		max-height: 220px;
		background: transparent;
		border: none;
		padding: 12px 14px;
		color: var(--text-primary);
		caret-color: var(--accent-blue-base, #1b85f3);
		cursor: var(--cursor-text, text);
		font-size: 0.88rem;
		line-height: 1.5;
		resize: none;
		outline: none;
		font-family: var(--font-sans);
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border-subtle) transparent;
	}
	.caption-textarea::-webkit-scrollbar {
		width: 4px;
	}
	.caption-textarea::-webkit-scrollbar-track {
		background: transparent;
	}
	.caption-textarea::-webkit-scrollbar-thumb {
		background: var(--border-subtle);
		border-radius: var(--radius-full);
	}
	.caption-textarea::placeholder {
		color: var(--text-muted);
		opacity: 0.85;
	}

	.quick-emojis-bar {
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 4px 8px;
		background: var(--bg-surface2);
		border-top: 1px solid var(--border-subtle);
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		box-sizing: border-box;
		width: 100%;
		min-height: 36px;
	}
	.quick-emojis-bar::-webkit-scrollbar {
		display: none;
	}
	.quick-emoji-btn {
		flex: 0 0 28px;
		width: 28px;
		height: 28px;
		min-width: 28px;
		min-height: 28px;
		background: transparent;
		border: none;
		font-size: 1.05rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		border-radius: var(--radius-xs);
		transition:
			transform 0.18s var(--ease-spring),
			background-color 0.15s;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.quick-emoji-btn:hover {
		transform: scale(1.2);
		background: var(--bg-surface-hover);
	}
	.quick-emoji-btn:active {
		transform: scale(0.95);
	}

	.hashtags-pills-cloud {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.hashtag-bubble {
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		padding: 4px 11px;
		border-radius: var(--radius-full);
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}
	.hashtag-bubble:hover {
		background: rgba(46, 180, 255, 0.12);
		border-color: var(--aero-sky);
		color: var(--text-primary);
		transform: translateY(-1px);
	}
	.hashtag-bubble.active {
		background: var(--aero-blue);
		color: #ffffff;
		border-color: var(--aero-sky);
		box-shadow: 0 2px 10px rgba(27, 133, 243, 0.35);
		transform: translateY(-1px);
	}

	.icon-input-wrap {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
		box-sizing: border-box;
	}
	.lead-icon {
		position: absolute;
		left: 12px;
		color: var(--text-muted);
		font-size: 18px;
		pointer-events: none;
	}
	.studio-text-input {
		width: 100%;
		box-sizing: border-box;
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 10px 14px;
		color: var(--text-primary);
		caret-color: var(--accent-blue-base, #1b85f3);
		cursor: var(--cursor-text, text);
		font-size: 0.86rem;
		outline: none;
		transition:
			border-color 0.2s var(--ease-out),
			box-shadow 0.2s var(--ease-out);
	}
	.icon-input-wrap .studio-text-input {
		padding-left: 38px;
	}
	.studio-text-input:focus {
		border-color: var(--aero-sky);
		box-shadow:
			0 0 0 1px var(--aero-sky),
			0 4px 18px rgba(46, 180, 255, 0.18);
		background: var(--bg-input);
	}

	/* Cover Thumbnail */
	.cover-thumbnail-card {
		display: flex;
		gap: 14px;
		padding: 14px;
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		align-items: center;
		transition: border-color 0.2s;
	}
	.cover-thumb-preview {
		width: 68px;
		height: 96px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		position: relative;
		background: #000;
		border: 1px solid var(--border-subtle);
		flex-shrink: 0;
		box-shadow: var(--shadow-sm);
	}
	.cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.cover-source-tag {
		position: absolute;
		bottom: 3px;
		left: 3px;
		right: 3px;
		background: rgba(0, 0, 0, 0.78);
		backdrop-filter: blur(4px);
		font-size: 0.52rem;
		text-align: center;
		padding: 2px 4px;
		border-radius: 3px;
		color: var(--aero-sky);
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}
	.cover-thumb-empty {
		width: 68px;
		height: 96px;
		border-radius: var(--radius-sm);
		background: var(--bg-surface-hover);
		border: 1px dashed var(--border-subtle);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		font-size: 0.62rem;
		color: var(--text-muted);
		text-align: center;
		padding: 6px;
		flex-shrink: 0;
	}
	.cover-actions-col {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 8px;
		flex: 1;
	}
	.capture-btn {
		padding: 7px 12px;
		font-size: 0.75rem;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
		border-radius: var(--radius-sm);
	}
	.capture-btn .material-icons-round {
		font-size: 15px;
	}
	.cover-instructions {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.35;
	}
	.text-link-btn {
		background: none;
		border: none;
		color: var(--aero-sky);
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		padding: 0;
		transition: color 0.15s;
	}
	.text-link-btn:hover {
		color: var(--accent-blue-light);
		text-decoration: underline;
	}

	/* Filters Grid */
	.filters-cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
		gap: 9px;
	}
	.filter-preset-card {
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 10px 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
		cursor: pointer;
		transition: all 0.22s var(--ease-spring);
	}
	.filter-preset-card:hover {
		background: var(--bg-surface-hover);
		transform: translateY(-2px);
		border-color: rgba(255, 255, 255, 0.15);
		box-shadow: var(--shadow-sm);
	}
	.filter-preset-card.active {
		border-color: var(--aero-sky);
		background: rgba(46, 180, 255, 0.12);
		box-shadow: 0 0 16px rgba(46, 180, 255, 0.25);
		transform: translateY(-2px);
	}
	.filter-preview-circle {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: linear-gradient(135deg, #1b85f3, #ec4899);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		transition: transform 0.2s var(--ease-spring);
	}
	.filter-preset-card:hover .filter-preview-circle {
		transform: scale(1.08);
	}
	.filter-preview-circle .material-icons-round {
		font-size: 17px;
	}
	.filter-label {
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--text-secondary);
		text-align: center;
	}
	.filter-preset-card.active .filter-label {
		color: var(--text-primary);
	}

	/* Text Studio Box */
	.text-studio-box {
		padding: 16px;
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		margin-top: 8px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.05);
	}
	.studio-subgroup {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.studio-sub-label {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.fonts-chips-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.font-bubble {
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		padding: 5px 11px;
		border-radius: var(--radius-full);
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}
	.font-bubble:hover {
		background: var(--bg-surface-hover);
		color: var(--text-primary);
		transform: translateY(-1px);
	}
	.font-bubble.active {
		background: var(--aero-blue);
		color: #ffffff;
		border-color: var(--aero-sky);
		box-shadow: 0 2px 10px rgba(27, 133, 243, 0.35);
	}
	.style-options-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
		width: 100%;
	}
	.colors-palette-dots {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.color-circle {
		flex: 0 0 24px;
		min-width: 24px;
		min-height: 24px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.3);
		cursor: pointer;
		transition:
			transform 0.18s var(--ease-spring),
			box-shadow 0.18s ease;
		padding: 0;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
	}
	.color-circle:hover {
		transform: scale(1.2);
	}
	.color-circle.active {
		transform: scale(1.25);
		border-color: #ffffff;
		box-shadow:
			0 0 0 2px var(--bg-surface2),
			0 0 0 4px var(--aero-blue),
			0 2px 8px rgba(0, 0, 0, 0.35);
	}

	.bg-styles-section {
		flex: 1 1 160px;
		min-width: 160px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bg-styles-pill-group {
		display: flex;
		gap: 3px;
		background: var(--bg-input);
		padding: 3px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
	}
	.bg-style-pill {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		padding: 6px 8px;
		border-radius: 4px;
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		text-align: center;
		transition: all 0.2s var(--ease-spring);
	}
	.bg-style-pill:hover {
		color: var(--text-primary);
		background: var(--bg-surface-hover);
	}
	.bg-style-pill.active {
		background: var(--aero-blue);
		color: #ffffff;
		box-shadow: 0 2px 8px rgba(27, 133, 243, 0.35);
	}

	.align-section {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.align-btn-group {
		display: flex;
		gap: 3px;
		background: var(--bg-input);
		padding: 3px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
	}
	.align-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
		padding: 0;
	}
	.align-btn .material-icons-round {
		font-size: 18px;
	}
	.align-btn:hover {
		color: var(--text-primary);
		background: var(--bg-surface-hover);
	}
	.align-btn.active {
		background: var(--aero-blue);
		color: #ffffff;
		box-shadow: 0 2px 8px rgba(27, 133, 243, 0.35);
	}

	.drag-instruction-hint {
		font-size: 0.72rem;
		color: var(--aero-sky);
		margin: 2px 0 0;
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
	}

	/* Privacy */
	.privacy-cards-stack {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.privacy-card {
		display: flex;
		align-items: center;
		padding: 12px 14px;
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 0.22s var(--ease-spring);
	}
	.privacy-card input {
		display: none;
	}
	.privacy-card:hover {
		background: var(--bg-surface-hover);
		transform: translateY(-1px);
		border-color: rgba(255, 255, 255, 0.12);
	}
	.privacy-card.active {
		border-color: var(--aero-sky);
		background: rgba(46, 180, 255, 0.1);
		box-shadow: 0 0 14px rgba(46, 180, 255, 0.15);
		transform: translateY(-1px);
	}
	.privacy-card-body {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.p-icon {
		color: var(--aero-sky);
		font-size: 22px;
		filter: drop-shadow(0 1px 4px rgba(46, 180, 255, 0.25));
		flex-shrink: 0;
	}
	.p-title {
		font-size: 0.84rem;
		font-weight: 800;
		color: var(--text-primary);
	}
	.p-desc {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-top: 1px;
	}

	/* Switches */
	.permission-switch-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		transition: background 0.15s;
	}
	.permission-switch-row:hover {
		background: var(--bg-surface-hover);
	}
	.perm-info {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.perm-info .material-icons-round {
		color: var(--aero-blue);
		font-size: 19px;
	}
	.perm-title {
		font-size: 0.84rem;
		font-weight: 800;
		color: var(--text-primary);
	}
	.perm-desc {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.aero-switch {
		position: relative;
		display: inline-block;
		width: 42px;
		height: 24px;
		flex-shrink: 0;
	}
	.aero-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}
	.switch-rail {
		position: absolute;
		cursor: pointer;
		inset: 0;
		background-color: var(--bg-input);
		transition: all 0.25s var(--ease-spring);
		border-radius: 24px;
		border: 1px solid var(--border-subtle);
	}
	.switch-rail:before {
		position: absolute;
		content: '';
		height: 18px;
		width: 18px;
		left: 2px;
		bottom: 2px;
		background-color: var(--text-secondary);
		transition:
			transform 0.25s var(--ease-spring),
			background-color 0.2s;
		border-radius: 50%;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
	}
	input:checked + .switch-rail {
		background-color: var(--aero-blue);
		border-color: var(--aero-sky);
		box-shadow: 0 0 10px rgba(27, 133, 243, 0.4);
	}
	input:checked + .switch-rail:before {
		transform: translateX(18px);
		background-color: #ffffff;
	}

	/* Console Footer Dock */
	.console-footer-dock {
		padding: 16px 20px;
		border-top: 1px solid var(--border-subtle);
		background: var(--bg-surface2);
		display: flex;
		flex-direction: column;
		gap: 10px;
		flex-shrink: 0;
	}

	.xp-gain-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		font-size: 0.75rem;
		color: var(--aero-mint);
		background: rgba(var(--aero-mint-rgb), 0.08);
		border: 1px solid rgba(var(--aero-mint-rgb), 0.2);
		padding: 4px 10px;
		border-radius: var(--radius-full);
	}
	.xp-gain-badge .material-icons-round {
		font-size: 15px;
	}

	.publish-reel-btn {
		width: 100%;
		min-height: 46px;
		padding: 12px 18px;
		font-size: 0.95rem;
		font-weight: 900;
		letter-spacing: 0.5px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}
	.publish-reel-btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
		filter: grayscale(40%);
	}

	.aero-spinner {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	/* ── Modales ───────────────────────────────────────────────────────── */
	.studio-modal-backdrop {
		position: fixed;
		inset: 0;
		background: var(--bg-overlay);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		z-index: 150;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.studio-modal-card {
		width: 100%;
		max-width: 440px;
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xl);
		padding: 20px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		gap: 14px;
		color: var(--text-primary);
	}
	.modal-top-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.modal-title-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.modal-title-wrap h3 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--text-primary);
	}
	.modal-ico {
		color: var(--aero-blue);
		font-size: 22px;
	}
	.modal-title-wrap.danger-title .modal-ico {
		color: var(--aero-rose);
	}
	.modal-close-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		padding: 0;
	}
	.modal-close-btn:hover {
		color: var(--text-primary);
	}

	.modal-shortcuts-table {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.shortcut-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 7px 10px;
		background: var(--bg-surface2);
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		color: var(--text-secondary);
	}
	.key-pill {
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
		padding: 2px 7px;
		border-radius: 4px;
		font-size: 0.72rem;
		font-family: var(--font-mono, monospace);
		color: var(--text-primary);
	}

	.modal-warn-text {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.45;
		margin: 0;
	}
	.modal-actions-row {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 6px;
	}
	.modal-ok-btn {
		width: 100%;
		margin-top: 6px;
	}

	.mb-3 {
		margin-bottom: 10px;
	}
	.mt-3 {
		margin-top: 10px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
