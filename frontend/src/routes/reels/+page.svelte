<script>
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly, scale, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { reels as reelsApi, users as usersApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { generateLikeSparkles } from '$lib/utils/likeSparkles.js';

	// ── Feed State ─────────────────────────────────────────────────────────────
	let reels = $state([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let hasMore = $state(true);
	let currentPage = $state(1);
	let activeReelIndex = $state(0);
	let isPlaying = $state(false);
	let activeReelProgress = $state(0);
	let activeCurrentTime = $state(0);
	let activeDuration = $state(0);

	// ── Audio & Volume Memory ──────────────────────────────────────────────────
	let globalVolume = $state(0.7);
	let isMuted = $state(false);
	let autoplayBlocked = $state(false);

	// ── Playback Settings & Modals ─────────────────────────────────────────────
	let playbackRate = $state(1.0);
	let fitMode = $state('cover'); // 'cover' | 'contain'
	let ambientEnabled = $state(true);
	let autoScrollNext = $state(false);
	let isFastForwarding = $state(false);
	let showOptionsMenu = $state(false);
	let showContextMenu = $state(false);
	let contextMenuPos = $state({ x: 0, y: 0 });
	let isFloatingPiPActive = $state(false);
	// Referencias no-reactivas al documento PiP y su video
	let pipWindow = null;
	let pipVideoEl = null;
	let lastPipReelId = null;
	let pipAbortController = null;

	let showShareModal = $state(false);
	let showShortcutsModal = $state(false);
	let showDeleteModal = $state(false);
	let reelToDelete = $state(null);
	let expandedCaptions = $state({}); // reelId -> bool

	// ── Feedback Toasts & Center Flash ─────────────────────────────────────────
	let toastMessage = $state('');
	let toastType = $state('info'); // 'info' | 'success' | 'error'
	let toastTimeout = null;

	let centerFlash = $state({ show: false, icon: 'play_arrow', id: 0 });
	let centerFlashTimeout = null;

	// ── Heart & Note Particles ────────────────────────────────────────────────
	let floatingHearts = $state([]);
	let heartIdCounter = 0;
	let floatingNotes = $state([]);
	let noteIdCounter = 0;
	let noteInterval = null;

	// ── Scrubber & Gestures ────────────────────────────────────────────────────
	let isScrubbing = $state(false);
	let scrubPreviewTime = $state(0);
	let scrubHoverX = $state(0);
	let isHoveringScrubber = $state(false);
	let longPressTimeout = null;
	let clickTimeout = null;
	let isLongPressActive = false;

	// ── Comments Drawer State ──────────────────────────────────────────────────
	let showCommentsModal = $state(false);
	let activeCommentReel = $state(null);
	let activeCommentReelId = $state(null);
	let commentsList = $state([]);
	let loadingComments = $state(false);
	let commentText = $state('');
	let replyTo = $state(null);
	let commentToDelete = $state(null);
	let commentCountDeltas = $state({});

	// Quick Emoji Palette
	const QUICK_EMOJIS = ['❤️', '🔥', '😂', '👏', '😍', '✨', '🙌', '💯'];

	// ── Follow Optimistic Map ──────────────────────────────────────────────────
	let followStatusMap = $state({}); // username -> boolean

	// ── DOM References & Trackers ──────────────────────────────────────────────
	let reelContainerEl = $state(null);
	let videoElements = [];
	let canvasElements = [];
	let activeVideoFrameCallbacks = new Map();

	function trackReel(node, idx) {
		const video = node.querySelector('video.main-video');
		const canvas = node.querySelector('canvas.ambient-canvas');
		videoElements[idx] = video;
		canvasElements[idx] = canvas;

		return {
			update(newIdx) {
				videoElements[newIdx] = video;
				canvasElements[newIdx] = canvas;
			},
			destroy() {
				videoElements[idx] = null;
				canvasElements[idx] = null;
				stopAmbientSync(video);
			}
		};
	}

	// ── Lifecycle & Init ───────────────────────────────────────────────────────
	onMount(async () => {
		// Restore user preferences
		try {
			if (typeof localStorage !== 'undefined') {
				const savedVol = localStorage.getItem('vsocial_reel_volume');
				if (savedVol !== null) globalVolume = parseFloat(savedVol);
				const savedMuted = localStorage.getItem('vsocial_reel_muted');
				if (savedMuted !== null) isMuted = savedMuted === 'true';
				const savedFit = localStorage.getItem('vsocial_reel_fit');
				if (savedFit) fitMode = savedFit;
				const savedAmbient = localStorage.getItem('vsocial_reel_ambient');
				if (savedAmbient !== null) ambientEnabled = savedAmbient === 'true';
				const savedAutoNext = localStorage.getItem('vsocial_reel_autonext');
				if (savedAutoNext !== null) autoScrollNext = savedAutoNext === 'true';
			}
		} catch (_e) {}

		// Load Initial Feed
		await loadFeed();

		// Start musical notes generator
		noteInterval = setInterval(() => {
			if (isPlaying && reels[activeReelIndex]) {
				spawnMusicNote();
			}
		}, 1400);

		// Global keyboard event listener
		window.addEventListener('keydown', handleGlobalKeydown);
	});

	onDestroy(() => {
		if (noteInterval) clearInterval(noteInterval);
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleGlobalKeydown);
		}
		// Cleanup all ambient loops
		videoElements.forEach((v) => stopAmbientSync(v));
	});

	async function loadFeed(isNextPage = false) {
		if (isNextPage) {
			if (loadingMore || !hasMore) return;
			loadingMore = true;
		} else {
			loading = true;
		}

		try {
			let feedData = [];
			const pageToFetch = isNextPage ? currentPage + 1 : 1;
			const idParam = !isNextPage ? $page.url.searchParams.get('id') : null;

			if (idParam && !isNextPage) {
				const reelData = await reelsApi.get(idParam).catch(() => null);
				if (reelData && reelData.reel) {
					feedData.push(reelData.reel);
				}
			}

			const res = await reelsApi.feed({ page: pageToFetch, limit: 10 });
			const items = res.data || [];
			hasMore = res.has_more ?? items.length === 10;
			currentPage = pageToFetch;

			const existingId = idParam ? parseInt(idParam) : null;
			const filtered = items.filter((r) => r.id !== existingId);

			if (isNextPage) {
				reels = [...reels, ...filtered];
			} else {
				reels = [...feedData, ...filtered];
			}

			// Pre-fill follow map
			reels.forEach((r) => {
				if (followStatusMap[r.username] === undefined) {
					followStatusMap[r.username] = !!r.is_following;
				}
			});

			// Direct jump to comment if hash exists
			if (
				idParam &&
				!isNextPage &&
				typeof window !== 'undefined' &&
				window.location.hash.startsWith('#comment-')
			) {
				setTimeout(() => {
					toggleComments(existingId);
				}, 200);
			}
		} catch (err) {
			console.error('Error loading reels feed:', err);
			showToast('Error al cargar los reels. Intenta de nuevo.', 'error');
		} finally {
			loading = false;
			loadingMore = false;
		}
	}

	// ── Intersection Observer (Active Reel Management) ─────────────────────────
	$effect(() => {
		if (reels.length === 0 || typeof document === 'undefined') return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const idx = Number(entry.target.dataset.index);
					const video = videoElements[idx];

					if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
						if (activeReelIndex !== idx) {
							// Pause previous active video
							const prevVideo = videoElements[activeReelIndex];
							if (prevVideo && !prevVideo.paused) {
								prevVideo.pause();
								stopAmbientSync(prevVideo);
							}

							activeReelIndex = idx;
							activeReelProgress = 0;

							if (video) {
								video.currentTime = 0;
								video.playbackRate = playbackRate;
								video.volume = isMuted ? 0 : globalVolume;
								video.muted = isMuted;

								if (!isFloatingPiPActive) {
									const playPromise = video.play();
									if (playPromise !== undefined) {
										playPromise
											.then(() => {
												isPlaying = true;
												autoplayBlocked = false;
												startAmbientSync(video, canvasElements[idx]);
												logView(reels[idx]?.id);
											})
											.catch((err) => {
												if (err.name === 'NotAllowedError') {
													autoplayBlocked = true;
													// Try muted autoplay
													video.muted = true;
													video.play().catch(() => {});
												}
											});
									}
								} else {
									video.pause();
									logView(reels[idx]?.id);
								}
							}

							// Auto-load next batch when near end
							if (idx >= reels.length - 2 && hasMore && !loadingMore) {
								loadFeed(true);
							}
						}
					} else {
						// Video is offscreen: strictly pause and unload heavy memory
						if (video && !video.paused) {
							video.pause();
							stopAmbientSync(video);
						}
					}
				});
			},
			{
				root: reelContainerEl,
				threshold: [0.2, 0.55, 0.8]
			}
		);

		// Observe all item elements
		setTimeout(() => {
			if (!reelContainerEl) return;
			const items = reelContainerEl.querySelectorAll('.reel-item');
			items.forEach((item) => observer.observe(item));
		}, 80);

		return () => observer.disconnect();
	});

	// ── Ambient Lighting Engine (Low-Res Throttled Canvas) ─────────────────────
	function startAmbientSync(video, canvas) {
		if (!video || !canvas || !ambientEnabled) return;
		stopAmbientSync(video);

		if (canvas.width !== 64) {
			canvas.width = 64;
			canvas.height = 114;
		}

		const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
		if (!ctx) return;

		let isRunning = true;

		function drawFrame() {
			if (!isRunning || video.paused || video.ended) return;
			if (video.readyState >= 2) {
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
			}

			if (
				'requestVideoFrameCallback' in HTMLVideoElement.prototype &&
				video.requestVideoFrameCallback
			) {
				const handle = video.requestVideoFrameCallback(drawFrame);
				activeVideoFrameCallbacks.set(video, { type: 'rvfc', handle });
			} else {
				const handle = requestAnimationFrame(drawFrame);
				activeVideoFrameCallbacks.set(video, { type: 'raf', handle });
			}
		}

		drawFrame();
	}

	function stopAmbientSync(video) {
		if (!video) return;
		const record = activeVideoFrameCallbacks.get(video);
		if (record) {
			if (record.type === 'rvfc' && 'cancelVideoFrameCallback' in video) {
				video.cancelVideoFrameCallback(record.handle);
			} else if (record.type === 'raf') {
				cancelAnimationFrame(record.handle);
			}
			activeVideoFrameCallbacks.delete(video);
		}
	}

	// ── View Tracking (Spam-safe) ──────────────────────────────────────────────
	let loggedViews = new Set();
	function logView(reelId) {
		if (!reelId || loggedViews.has(reelId)) return;
		loggedViews.add(reelId);
		reelsApi.view(reelId).catch(() => {});
	}

	// ── Playback Controls & Video Time ─────────────────────────────────────────
	function handleTimeUpdate(e) {
		const video = e.target;
		if (video.duration && !isScrubbing) {
			activeCurrentTime = video.currentTime;
			activeDuration = video.duration;
			activeReelProgress = (video.currentTime / video.duration) * 100;
		}
	}

	function handleVideoEnded(_reel, index) {
		if (autoScrollNext && index < reels.length - 1) {
			scrollToReel(index + 1);
		}
	}

	function togglePlayPause(index = activeReelIndex) {
		if (isFloatingPiPActive && pipVideoEl) {
			if (pipVideoEl.paused) {
				pipVideoEl.play().catch(() => {});
				isPlaying = true;
			} else {
				pipVideoEl.pause();
				isPlaying = false;
			}
			return;
		}

		const video = videoElements[index];
		if (!video) return;

		if (video.paused) {
			video.play().then(() => {
				isPlaying = true;
				autoplayBlocked = false;
				triggerCenterFlash('play_arrow');
				startAmbientSync(video, canvasElements[index]);
			});
		} else {
			video.pause();
			isPlaying = false;
			triggerCenterFlash('pause');
			stopAmbientSync(video);
		}
	}

	function triggerCenterFlash(icon) {
		centerFlash = { show: true, icon, id: Date.now() };
		if (centerFlashTimeout) clearTimeout(centerFlashTimeout);
		centerFlashTimeout = setTimeout(() => {
			centerFlash.show = false;
		}, 600);
	}

	// ── Gestures: Long Press (2X Speed) & Double-Tap (Like) ────────────────────
	function handlePointerDown(e, reel, index) {
		if (e.button !== 0) return; // solo clic izquierdo
		if (isFloatingPiPActive && index === activeReelIndex) return; // pip activo: ignorar
		isLongPressActive = false;

		longPressTimeout = setTimeout(() => {
			isLongPressActive = true;
			activateFastForward(index);
		}, 320);
	}

	function handlePointerUp(_e, reel, index) {
		if (_e.button !== 0) return; // solo clic izquierdo
		if (isFloatingPiPActive && index === activeReelIndex) return; // pip activo: no duplicar

		if (longPressTimeout) {
			clearTimeout(longPressTimeout);
			longPressTimeout = null;
		}

		if (isLongPressActive) {
			deactivateFastForward(index);
			isLongPressActive = false;
			return;
		}

		// Handle Single or Double Tap
		if (clickTimeout) {
			clearTimeout(clickTimeout);
			clickTimeout = null;
			// Double tap!
			const rect = videoElements[index]?.getBoundingClientRect();
			const x = rect ? _e.clientX - rect.left : 150;
			const y = rect ? _e.clientY - rect.top : 250;
			handleDoubleTapLike(reel, index, x, y);
		} else {
			clickTimeout = setTimeout(() => {
				clickTimeout = null;
				togglePlayPause(index);
			}, 240);
		}
	}

	function handlePointerCancel(_e, _reel, index) {
		if (longPressTimeout) {
			clearTimeout(longPressTimeout);
			longPressTimeout = null;
		}
		if (isLongPressActive) {
			deactivateFastForward(index);
			isLongPressActive = false;
		}
	}

	function activateFastForward(index) {
		const video = videoElements[index];
		if (!video) return;
		isFastForwarding = true;
		video.playbackRate = 2.0;
	}

	function deactivateFastForward(index) {
		const video = videoElements[index];
		if (!video) return;
		isFastForwarding = false;
		video.playbackRate = playbackRate;
	}

	// ── Like Interaction (Double-Tap & Heart Burst) ────────────────────────────
	async function handleDoubleTapLike(reel, index, x, y) {
		spawnFloatingHeart(x, y);

		if (!authStore.isAuthenticated) {
			showToast('Inicia sesión para interactuar', 'info');
			return;
		}

		if (!reel.user_liked) {
			reel.user_liked = true;
			reel.like_count = (reel.like_count || 0) + 1;
			reel.is_animating_like = true;
			reel.is_animating_unlike = false;
			reel.like_particles = generateLikeSparkles(8, 26);
			setTimeout(() => {
				reel.is_animating_like = false;
				reel.like_particles = [];
			}, 650);

			try {
				await reelsApi.like(reel.id);
			} catch (_err) {
				reel.user_liked = false;
				reel.like_count = Math.max(0, (reel.like_count || 1) - 1);
				showToast('Error al dar like', 'error');
			}
		}
	}

	async function handleLikeButton(reel, index, e) {
		if (e) e.stopPropagation();
		if (!authStore.isAuthenticated) {
			showToast('Inicia sesión para dar like', 'info');
			goto('/login');
			return;
		}

		const prev = !!reel.user_liked;
		reel.user_liked = !prev;
		reel.like_count = (reel.like_count || 0) + (prev ? -1 : 1);

		if (!prev) {
			reel.is_animating_like = true;
			reel.is_animating_unlike = false;
			reel.like_particles = generateLikeSparkles(8, 26);
			setTimeout(() => {
				reel.is_animating_like = false;
				reel.like_particles = [];
			}, 650);
			spawnFloatingHeart(180, 300);
		} else {
			reel.is_animating_like = false;
			reel.is_animating_unlike = true;
			reel.like_particles = [];
			setTimeout(() => {
				reel.is_animating_unlike = false;
			}, 350);
		}

		try {
			if (prev) {
				await reelsApi.unlike(reel.id);
			} else {
				await reelsApi.like(reel.id);
			}
		} catch (_err) {
			reel.user_liked = prev;
			reel.like_count = (reel.like_count || 0) + (prev ? 1 : -1);
			showToast('Error al actualizar like', 'error');
		}
	}

	function spawnFloatingHeart(x, y) {
		const id = heartIdCounter++;
		const rot = (Math.random() * 30 - 15).toFixed(1);
		const sparkles = generateLikeSparkles(6, 48);
		floatingHearts = [...floatingHearts, { id, x, y, rot, sparkles }];
		setTimeout(() => {
			floatingHearts = floatingHearts.filter((h) => h.id !== id);
		}, 1000);
	}

	function spawnMusicNote() {
		const id = noteIdCounter++;
		const symbols = ['♪', '♫', '♬', '♩'];
		const symbol = symbols[Math.floor(Math.random() * symbols.length)];
		floatingNotes = [...floatingNotes, { id, symbol }];
		setTimeout(() => {
			floatingNotes = floatingNotes.filter((n) => n.id !== id);
		}, 1800);
	}

	// ── Creator Follow Action ──────────────────────────────────────────────────
	async function toggleFollowCreator(username, e) {
		if (e) e.stopPropagation();
		if (!authStore.isAuthenticated) {
			showToast('Inicia sesión para seguir creadores', 'info');
			goto('/login');
			return;
		}
		if (authStore.user?.username === username) {
			showToast('Es tu propio perfil', 'info');
			return;
		}

		const isCurrentlyFollowing = !!followStatusMap[username];
		followStatusMap[username] = !isCurrentlyFollowing;

		try {
			if (isCurrentlyFollowing) {
				await usersApi.unfollow(username);
				showToast(`Dejaste de seguir a @${username}`, 'info');
			} else {
				await usersApi.follow(username);
				showToast(`¡Ahora sigues a @${username}!`, 'success');
			}
		} catch (_err) {
			followStatusMap[username] = isCurrentlyFollowing;
			showToast('Error al seguir usuario', 'error');
		}
	}

	// ── Scrubber & Progress Dragging ───────────────────────────────────────────
	function handleScrubberMouseDown(e) {
		isScrubbing = true;
		seekToMousePos(e);
	}

	function handleScrubberMouseMove(e) {
		const rect = e.currentTarget.getBoundingClientRect();
		const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		scrubHoverX = e.clientX - rect.left;
		scrubPreviewTime = pct * (activeDuration || 1);

		if (isScrubbing) {
			seekToMousePos(e);
		}
	}

	function handleScrubberMouseUp() {
		if (isScrubbing) {
			isScrubbing = false;
			const video = videoElements[activeReelIndex];
			if (video && isPlaying) video.play().catch(() => {});
		}
	}

	function seekToMousePos(e) {
		const bar = e.currentTarget.closest('.progress-bar-interactive');
		if (!bar) return;
		const rect = bar.getBoundingClientRect();
		const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		const video = videoElements[activeReelIndex];
		if (video && video.duration) {
			video.currentTime = pct * video.duration;
			activeCurrentTime = video.currentTime;
			activeReelProgress = pct * 100;
		}
	}

	// ── Volume & Mute ──────────────────────────────────────────────────────────
	function toggleMute() {
		isMuted = !isMuted;
		if (!isMuted && globalVolume === 0) globalVolume = 0.5;
		applyVolumeToAll();
		saveVolumePrefs();
	}

	function handleVolumeChange(e) {
		globalVolume = parseFloat(e.target.value);
		isMuted = globalVolume === 0;
		applyVolumeToAll();
		saveVolumePrefs();
	}

	function applyVolumeToAll() {
		videoElements.forEach((video) => {
			if (video) {
				video.volume = isMuted ? 0 : globalVolume;
				video.muted = isMuted;
			}
		});
	}

	function saveVolumePrefs() {
		try {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem('vsocial_reel_volume', globalVolume.toString());
				localStorage.setItem('vsocial_reel_muted', isMuted.toString());
			}
		} catch (_e) {}
	}

	// ── Document Picture-in-Picture (ventana flotante con diseño completo estilo TikTok) ──
	async function enableFloatingPiP() {
		if (typeof window === 'undefined') return;
		const video = videoElements[activeReelIndex];
		const reel = reels[activeReelIndex];
		if (!video || !reel) return;
		showOptionsMenu = false;
		showContextMenu = false;

		// Document PiP API — ventana OS real con HTML/CSS completo (Chrome / Edge 116+)
		if ('documentPictureInPicture' in window) {
			try {
				pipWindow = await window.documentPictureInPicture.requestWindow({
					width: 360,
					height: 640
				});
				if (pipAbortController) pipAbortController.abort();
				pipAbortController = new AbortController();
				_pipInjectContent(pipWindow, reel, video, pipAbortController.signal);
				video.pause();
				isFloatingPiPActive = true;
				pipWindow.addEventListener(
					'pagehide',
					() => {
						_pipRestoreMain();
					},
					{ signal: pipAbortController.signal }
				);
				showToast('Reproductor flotante activado', 'info');
				return;
			} catch (_e) {
				// Fallback a video PiP
			}
		}

		// Fallback: video PiP nativo (navegadores antiguos o sin Document PiP)
		if (document.pictureInPictureEnabled) {
			try {
				await video.requestPictureInPicture();
				isFloatingPiPActive = true;
				video.addEventListener(
					'leavepictureinpicture',
					() => {
						isFloatingPiPActive = false;
					},
					{ once: true }
				);
				showToast('Reproductor flotante activado', 'info');
			} catch (_e) {
				showToast('No se pudo activar el reproductor flotante', 'error');
			}
		} else {
			showToast('Tu navegador no soporta PiP', 'error');
		}
	}

	async function disableFloatingPiP() {
		if (pipAbortController) {
			pipAbortController.abort();
			pipAbortController = null;
		}
		if (pipWindow) {
			try {
				pipWindow.close();
			} catch (_e) {}
			return;
		}
		try {
			if (document.pictureInPictureElement) await document.exitPictureInPicture();
		} catch (_e) {}
		isFloatingPiPActive = false;
	}

	function _pipRestoreMain() {
		if (pipAbortController) {
			pipAbortController.abort();
			pipAbortController = null;
		}
		isFloatingPiPActive = false;
		lastPipReelId = null;
		const mainVideo = videoElements[activeReelIndex];
		if (mainVideo) {
			if (pipVideoEl) mainVideo.currentTime = pipVideoEl.currentTime;
			mainVideo.volume = isMuted ? 0 : globalVolume;
			mainVideo.muted = isMuted;
			mainVideo.playbackRate = playbackRate;
			if (isPlaying) mainVideo.play().catch(() => {});
		}
		pipWindow = null;
		pipVideoEl = null;
	}

	function _pipInjectContent(win, reel, sourceVideo, signal) {
		const doc = win.document;
		const theme = document.documentElement.getAttribute('data-theme') || 'dark';

		// Inyectar fuentes e iconos directamente en el documento PiP
		const fontLinks = [
			'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@500;600;700;800;900&display=swap',
			'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
		];
		fontLinks.forEach((href) => {
			const link = doc.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			doc.head.appendChild(link);
		});

		// Heredar stylesheets del documento principal
		document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
			if (node.href && !fontLinks.includes(node.href)) {
				const link = doc.createElement('link');
				link.rel = 'stylesheet';
				link.href = node.href;
				doc.head.appendChild(link);
			}
		});

		// Inyectar CSS completo Neo-Aero / TikTok
		const style = doc.createElement('style');
		style.textContent = _pipGetCSS(theme);
		doc.head.appendChild(style);

		// Inyectar HTML estructurado
		doc.body.innerHTML = _pipGetHTML(reel);

		// Configurar elemento de video
		pipVideoEl = doc.querySelector('.pip-v');
		lastPipReelId = reel.id;
		pipVideoEl.src = sourceVideo.src;
		pipVideoEl.currentTime = sourceVideo.currentTime;
		pipVideoEl.volume = isMuted ? 0 : globalVolume;
		pipVideoEl.muted = isMuted;
		pipVideoEl.playbackRate = playbackRate;
		if (isPlaying) pipVideoEl.play().catch(() => {});

		_pipBindControls(win, reel, signal);
	}

	function _pipGetCSS(_theme) {
		return `
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{width:100%;height:100%;background:#000;overflow:hidden;font-family:'Inter','Outfit',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;}
.pip-root{position:relative;width:100%;height:100dvh;background:#000;user-select:none;overflow:hidden;cursor:pointer;}
.pip-v{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:#000;}

/* Degradados cinematográficos para máxima legibilidad */
.pip-grad-top{position:absolute;top:0;left:0;right:0;height:120px;background:linear-gradient(to bottom,rgba(0,0,0,.75) 0%,rgba(0,0,0,.35) 60%,transparent 100%);z-index:2;pointer-events:none;}
.pip-grad-bot{position:absolute;bottom:0;left:0;right:0;height:240px;background:linear-gradient(to top,rgba(0,0,0,.88) 0%,rgba(0,0,0,.5) 55%,transparent 100%);z-index:2;pointer-events:none;}

/* Top Bar */
.pip-topbar{position:absolute;top:0;left:0;right:0;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;z-index:20;pointer-events:none;}
.pip-topbar-left{display:flex;align-items:center;gap:6px;pointer-events:auto;}
.pip-logo-pill{display:flex;align-items:center;gap:4px;background:rgba(0,0,0,.5);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.18);padding:3px 8px;border-radius:999px;color:#2eb4ff;font-weight:800;font-size:0.7rem;letter-spacing:0.5px;}
.pip-logo-pill .material-icons-round{font-size:14px;}
.pip-topbar-right{display:flex;align-items:center;gap:6px;pointer-events:auto;}

/* Botones redondos de acción */
.pip-ibtn{width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.5);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.2);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,transform .18s cubic-bezier(.34,1.56,.64,1);outline:none;}
.pip-ibtn:hover{background:rgba(255,255,255,.25);transform:scale(1.1);}
.pip-ibtn:active{transform:scale(0.92);}
.pip-ibtn .material-icons-round{font-size:18px;}
.pip-speed-txt{font-size:0.75rem;font-weight:800;}

/* Centro Play Triangle Overlay (Estilo TikTok) */
.pip-center-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:15;pointer-events:none;transition:opacity .25s ease,transform .25s cubic-bezier(.34,1.56,.64,1);}
.pip-center-play.hidden{opacity:0;transform:scale(0.8);visibility:hidden;}
.pip-play-triangle{width:76px;height:76px;border-radius:50%;background:rgba(0,0,0,.45);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:2px solid rgba(255,255,255,.4);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 36px rgba(0,0,0,.6),inset 0 1px 2px rgba(255,255,255,.3);}
.pip-play-triangle .material-icons-round{font-size:48px;margin-left:4px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5));}

/* Capa de corazones animados para doble tap */
.pip-hearts-layer{position:absolute;inset:0;pointer-events:none;z-index:25;overflow:hidden;}
.pip-heart-burst{position:absolute;color:#f43f5e;font-size:56px;transform:translate(-50%,-50%) scale(0);animation:pipHeartAnim .85s cubic-bezier(.34,1.56,.64,1) forwards;filter:drop-shadow(0 4px 14px rgba(244,63,94,.6));}
@keyframes pipHeartAnim{0%{transform:translate(-50%,-50%) scale(0) rotate(-12deg);opacity:1;}40%{transform:translate(-50%,-50%) scale(1.3) rotate(8deg);opacity:1;}100%{transform:translate(-50%,-120%) scale(1.6) rotate(16deg);opacity:0;}}

/* Barra lateral derecha de acciones (TikTok Right Rail) */
.pip-rail{position:absolute;right:8px;bottom:32px;display:flex;flex-direction:column;align-items:center;gap:12px;z-index:20;pointer-events:auto;}
.pip-rail-item{display:flex;flex-direction:column;align-items:center;gap:2px;}
.pip-rail-btn{width:42px;height:42px;border-radius:50%;background:rgba(0,0,0,.45);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.18);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,transform .18s cubic-bezier(.34,1.56,.64,1),color .15s;outline:none;}
.pip-rail-btn:hover:not(:disabled){background:rgba(255,255,255,.22);transform:scale(1.12);}
.pip-rail-btn:active:not(:disabled){transform:scale(0.92);}
.pip-rail-btn:disabled{opacity:.3;cursor:not-allowed;}
.pip-rail-btn .material-icons-round{font-size:24px;}
.pip-rail-btn.active-like{color:#f43f5e;background:rgba(244,63,94,.18);border-color:rgba(244,63,94,.4);}
.pip-rail-btn.active-save{color:#f59e0b;background:rgba(245,158,11,.18);border-color:rgba(245,158,11,.4);}
.pip-rail-count{font-size:0.7rem;font-weight:800;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8);line-height:1;}

/* Avatar en el Rail */
.pip-avatar-wrap{position:relative;width:44px;height:44px;border-radius:50%;padding:2px;background:linear-gradient(135deg,#0ea5e9,#10b981);cursor:pointer;margin-bottom:2px;}
.pip-avatar-img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;}
.pip-avatar-fallback{width:100%;height:100%;border-radius:50%;background:#1e293b;display:none;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:0.95rem;}

/* Disco de Vinilo Giratorio */
.pip-vinyl-wrap{margin-top:2px;cursor:pointer;}
.pip-vinyl-disc{width:38px;height:38px;border-radius:50%;background:radial-gradient(circle,#222 35%,#000 65%,#333 100%);border:2px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.7);animation:pipSpin 4s linear infinite;animation-play-state:paused;}
.pip-vinyl-disc.playing{animation-play-state:running;}
.pip-vinyl-thumb{width:22px;height:22px;border-radius:50%;object-fit:cover;}
.pip-vinyl-note{font-size:16px;color:#2eb4ff;display:none;}
@keyframes pipSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}

/* Información inferior izquierda */
.pip-bottom-info{position:absolute;bottom:14px;left:0;right:64px;padding:0 12px;z-index:20;pointer-events:auto;}
.pip-user-row{display:flex;align-items:center;gap:4px;margin-bottom:4px;}
.pip-uname{font-size:0.9rem;font-weight:800;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.8);cursor:pointer;}
.pip-verified-ic{font-size:16px;color:#38bdf8;}
.pip-caption{font-size:0.75rem;color:rgba(255,255,255,.92);line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:6px;text-shadow:0 1px 4px rgba(0,0,0,.75);}
.pip-tag{color:#38bdf8;font-weight:700;}
.pip-mention{color:#a78bfa;font-weight:700;}
.pip-music-row{display:flex;align-items:center;gap:4px;color:rgba(255,255,255,.85);font-size:0.72rem;font-weight:600;}
.pip-music-ic{font-size:14px;color:#2eb4ff;}
.pip-music-marquee{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;text-shadow:0 1px 3px rgba(0,0,0,.8);}

/* Timeline / Progress Scrubber en el fondo */
.pip-scrubber-track{position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(255,255,255,.25);z-index:30;cursor:pointer;transition:height .15s ease;}
.pip-scrubber-track:hover{height:8px;}
.pip-scrubber-fill{height:100%;background:#ffffff;border-radius:0 999px 999px 0;transition:width .1s linear;pointer-events:none;}
.pip-time-tooltip{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#fff;padding:2px 8px;border-radius:6px;font-size:0.68rem;font-weight:800;pointer-events:none;opacity:0;transition:opacity .15s ease;white-space:nowrap;}
.pip-scrubber-track:hover .pip-time-tooltip{opacity:1;}

/* Toast Feedback */
.pip-toast{position:absolute;top:54px;left:50%;transform:translateX(-50%) translateY(-10px);background:rgba(0,0,0,.82);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.2);color:#fff;padding:5px 14px;border-radius:999px;font-size:0.75rem;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.6);z-index:40;opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s cubic-bezier(.34,1.56,.64,1);}
.pip-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
`;
	}

	function _pipFormatCaption(text) {
		if (!text) return '';
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/(#[\wñáéíóúÁÉÍÓÚ]+)/g, '<span class="pip-tag">$1</span>')
			.replace(/(@[\wñáéíóúÁÉÍÓÚ_]+)/g, '<span class="pip-mention">$1</span>');
	}

	function _pipGetHTML(reel) {
		const u = reel.username || '';
		const isLiked = !!reel.user_liked;
		const likeCount = formatCount(reel.like_count || 0);
		const saveCount = formatCount(reel.bookmark_count || reel.comment_count || 0);
		const shareCount = formatCount(reel.share_count || 0);
		const captionHtml = _pipFormatCaption(reel.caption || reel.description || '');
		const musicTitle = reel.audio_title || 'Sonido original - @' + u;

		return `
<div class="pip-root" id="pip-root">
  <video class="pip-v" playsinline loop preload="auto"></video>
  <div class="pip-grad-top"></div>
  <div class="pip-grad-bot"></div>

  <!-- Top Bar -->
  <div class="pip-topbar">
    <div class="pip-topbar-left">
      <div class="pip-logo-pill">
        <span class="material-icons-round">smart_display</span>
        <span>REELS</span>
      </div>
    </div>
    <div class="pip-topbar-right">
      <button class="pip-ibtn" id="pip-speed-btn" title="Velocidad de reproducción">
        <span class="pip-speed-txt" id="pip-speed-txt">1x</span>
      </button>
      <button class="pip-ibtn" id="pip-mute-btn" title="Silenciar / Activar sonido">
        <span class="material-icons-round" id="pip-mute-ic">${isMuted ? 'volume_off' : 'volume_up'}</span>
      </button>
    </div>
  </div>

  <!-- Centro Play Triangle Indicator (TikTok Style) -->
  <div class="pip-center-play ${isPlaying ? 'hidden' : ''}" id="pip-center-play">
    <div class="pip-play-triangle">
      <span class="material-icons-round">play_arrow</span>
    </div>
  </div>

  <!-- Capa de Corazones Flotantes (Double Click) -->
  <div class="pip-hearts-layer" id="pip-hearts-layer"></div>

  <!-- Barra Lateral Derecha de Acciones (TikTok Right Rail) -->
  <div class="pip-rail" id="pip-rail">
    <!-- Subir / Anterior Reel -->
    <div class="pip-rail-item">
      <button class="pip-rail-btn" id="pip-prev-btn" title="Reel anterior">
        <span class="material-icons-round">keyboard_arrow_up</span>
      </button>
    </div>

    <!-- Bajar / Siguiente Reel -->
    <div class="pip-rail-item">
      <button class="pip-rail-btn" id="pip-next-btn" title="Siguiente reel">
        <span class="material-icons-round">keyboard_arrow_down</span>
      </button>
    </div>

    <!-- Avatar Creador -->
    <div class="pip-rail-item">
      <div class="pip-avatar-wrap" id="pip-avatar-wrap" title="@${u}">
        <img class="pip-avatar-img" id="pip-avatar-img" src="${reel.avatar_url || ''}" alt="${u}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
        <div class="pip-avatar-fallback" id="pip-avatar-fb">${(u || '?')[0].toUpperCase()}</div>
      </div>
    </div>

    <!-- Like Button -->
    <div class="pip-rail-item">
      <button class="pip-rail-btn ${isLiked ? 'active-like' : ''}" id="pip-like-btn" title="Me gusta">
        <span class="material-icons-round" id="pip-like-ic">${isLiked ? 'favorite' : 'favorite_border'}</span>
      </button>
      <span class="pip-rail-count" id="pip-like-count">${likeCount}</span>
    </div>

    <!-- Guardar / Bookmark -->
    <div class="pip-rail-item">
      <button class="pip-rail-btn" id="pip-save-btn" title="Guardar">
        <span class="material-icons-round" id="pip-save-ic">bookmark</span>
      </button>
      <span class="pip-rail-count" id="pip-save-count">${saveCount}</span>
    </div>

    <!-- Compartir -->
    <div class="pip-rail-item">
      <button class="pip-rail-btn" id="pip-share-btn" title="Copiar enlace">
        <span class="material-icons-round">share</span>
      </button>
      <span class="pip-rail-count" id="pip-share-count">${shareCount}</span>
    </div>

    <!-- Disco de Vinilo Giratorio -->
    <div class="pip-rail-item pip-vinyl-wrap" id="pip-vinyl-wrap" title="${musicTitle}">
      <div class="pip-vinyl-disc ${isPlaying ? 'playing' : ''}" id="pip-vinyl">
        <img class="pip-vinyl-thumb" id="pip-vinyl-thumb" src="${reel.avatar_url || ''}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
        <span class="material-icons-round pip-vinyl-note">music_note</span>
      </div>
    </div>
  </div>

  <!-- Información Inferior Izquierda -->
  <div class="pip-bottom-info">
    <div class="pip-user-row">
      <span class="pip-uname" id="pip-uname">@${u}</span>
      ${reel.is_verified ? '<span class="material-icons-round pip-verified-ic" id="pip-verified-ic" title="Verificado">verified</span>' : '<span class="material-icons-round pip-verified-ic" id="pip-verified-ic" style="display:none">verified</span>'}
    </div>
    <div class="pip-caption" id="pip-caption">${captionHtml}</div>
    <div class="pip-music-row">
      <span class="material-icons-round pip-music-ic">music_note</span>
      <div class="pip-music-marquee">
        <span id="pip-music-title">${musicTitle}</span>
      </div>
    </div>
  </div>

  <!-- Timeline Scrubber Bar -->
  <div class="pip-scrubber-track" id="pip-scrubber">
    <div class="pip-scrubber-fill" id="pip-prog-fill" style="width:0%"></div>
    <div class="pip-time-tooltip" id="pip-time-tip">0:00 / 0:00</div>
  </div>

  <!-- Toast Notification Pill -->
  <div class="pip-toast" id="pip-toast">¡Enlace copiado!</div>
</div>`;
	}

	function _pipBindControls(win, _reel, signal) {
		const d = win.document;
		const video = d.querySelector('.pip-v');
		const root = d.getElementById('pip-root');
		const centerPlay = d.getElementById('pip-center-play');
		const muteBtn = d.getElementById('pip-mute-btn');
		const muteIc = d.getElementById('pip-mute-ic');
		const speedBtn = d.getElementById('pip-speed-btn');
		const speedTxt = d.getElementById('pip-speed-txt');
		const prevBtn = d.getElementById('pip-prev-btn');
		const nextBtn = d.getElementById('pip-next-btn');
		const likeBtn = d.getElementById('pip-like-btn');
		const likeIc = d.getElementById('pip-like-ic');
		const likeCountEl = d.getElementById('pip-like-count');
		const saveBtn = d.getElementById('pip-save-btn');
		const shareBtn = d.getElementById('pip-share-btn');
		const vinyl = d.getElementById('pip-vinyl');
		const progFill = d.getElementById('pip-prog-fill');
		const scrubber = d.getElementById('pip-scrubber');
		const timeTip = d.getElementById('pip-time-tip');
		const heartsLayer = d.getElementById('pip-hearts-layer');
		const toastEl = d.getElementById('pip-toast');

		let toastTimeout = null;
		function showPipToast(msg) {
			toastEl.textContent = msg;
			toastEl.classList.add('show');
			clearTimeout(toastTimeout);
			toastTimeout = setTimeout(() => {
				toastEl.classList.remove('show');
			}, 1800);
		}

		function spawnPipHeart(x, y) {
			const heart = d.createElement('span');
			heart.className = 'material-icons-round pip-heart-burst';
			heart.textContent = 'favorite';
			heart.style.left = `${x}px`;
			heart.style.top = `${y}px`;
			heartsLayer.appendChild(heart);
			setTimeout(() => {
				try {
					heart.remove();
				} catch (_e) {}
			}, 900);
		}

		// ── Play / Pause Toggle ──────────────────────────────────────────────────
		function togglePlay() {
			if (video.paused) {
				video
					.play()
					.then(() => {
						isPlaying = true;
						centerPlay.classList.add('hidden');
						if (vinyl) vinyl.classList.add('playing');
					})
					.catch(() => {});
			} else {
				video.pause();
				isPlaying = false;
				centerPlay.classList.remove('hidden');
				if (vinyl) vinyl.classList.remove('playing');
			}
		}

		const opts = signal ? { signal } : undefined;

		// Sincronizar eventos nativos del video
		video.addEventListener(
			'play',
			() => {
				isPlaying = true;
				centerPlay.classList.add('hidden');
				if (vinyl) vinyl.classList.add('playing');
			},
			opts
		);
		video.addEventListener(
			'pause',
			() => {
				isPlaying = false;
				centerPlay.classList.remove('hidden');
				if (vinyl) vinyl.classList.remove('playing');
			},
			opts
		);

		// Clic en la pantalla: single click = play/pause, double click = like
		let pipClickTimer = null;
		root.addEventListener(
			'click',
			(e) => {
				// Ignorar si se hizo clic en botones de la barra superior o lateral
				if (
					e.target.closest(
						'.pip-ibtn, .pip-rail-btn, .pip-scrubber-track, .pip-avatar-wrap, .pip-uname'
					)
				) {
					return;
				}
				if (pipClickTimer) {
					clearTimeout(pipClickTimer);
					pipClickTimer = null;
					// Doble Clic = Like + Heart
					spawnPipHeart(e.clientX, e.clientY);
					const currentReel = reels[activeReelIndex];
					if (currentReel && !currentReel.user_liked) {
						handleLikeButton(currentReel, activeReelIndex);
						likeBtn.classList.add('active-like');
						likeIc.textContent = 'favorite';
						likeCountEl.textContent = formatCount(currentReel.like_count);
					}
				} else {
					pipClickTimer = setTimeout(() => {
						pipClickTimer = null;
						togglePlay();
					}, 220);
				}
			},
			opts
		);

		// ── Mute / Volume ────────────────────────────────────────────────────────
		muteBtn.addEventListener(
			'click',
			(e) => {
				e.stopPropagation();
				toggleMute();
				video.muted = isMuted;
				video.volume = isMuted ? 0 : globalVolume;
				muteIc.textContent = isMuted ? 'volume_off' : 'volume_up';
				showPipToast(isMuted ? '🔇 Silenciado' : '🔊 Sonido activado');
			},
			opts
		);

		// ── Speed Control ────────────────────────────────────────────────────────
		speedBtn.addEventListener(
			'click',
			(e) => {
				e.stopPropagation();
				const rates = [1.0, 1.25, 1.5, 2.0, 0.5];
				const curIdx = rates.indexOf(playbackRate);
				const nextRate = rates[(curIdx + 1) % rates.length];
				setSpeed(nextRate);
				video.playbackRate = nextRate;
				speedTxt.textContent = `${nextRate}x`;
				showPipToast(`Velocidad: ${nextRate}x`);
			},
			opts
		);

		// ── Like Button ──────────────────────────────────────────────────────────
		likeBtn.addEventListener(
			'click',
			async (e) => {
				e.stopPropagation();
				const currentReel = reels[activeReelIndex];
				if (!currentReel) return;
				await handleLikeButton(currentReel, activeReelIndex);
				if (currentReel.user_liked) {
					likeBtn.classList.add('active-like');
					likeIc.textContent = 'favorite';
					spawnPipHeart(win.innerWidth / 2, win.innerHeight / 2);
					showPipToast('❤️ ¡Me gusta!');
				} else {
					likeBtn.classList.remove('active-like');
					likeIc.textContent = 'favorite_border';
				}
				likeCountEl.textContent = formatCount(currentReel.like_count);
			},
			opts
		);

		// ── Bookmark / Save Button ───────────────────────────────────────────────
		saveBtn.addEventListener(
			'click',
			(e) => {
				e.stopPropagation();
				saveBtn.classList.toggle('active-save');
				const isSaved = saveBtn.classList.contains('active-save');
				showPipToast(isSaved ? '🔖 Guardado' : 'Guardado removido');
			},
			opts
		);

		// ── Share Button (Copy Link) ─────────────────────────────────────────────
		shareBtn.addEventListener(
			'click',
			async (e) => {
				e.stopPropagation();
				const currentReel = reels[activeReelIndex];
				if (!currentReel) return;
				const url = `${window.location.origin}/reels?id=${currentReel.id}`;
				try {
					await navigator.clipboard.writeText(url);
					showPipToast('📋 ¡Enlace copiado!');
				} catch (_err) {
					showPipToast('Compartir reel');
				}
				reelsApi.share(currentReel.id).catch(() => {});
				currentReel.share_count = (currentReel.share_count || 0) + 1;
				const scEl = d.getElementById('pip-share-count');
				if (scEl) scEl.textContent = formatCount(currentReel.share_count);
			},
			opts
		);

		// ── Navigation Buttons ───────────────────────────────────────────────────
		prevBtn.disabled = activeReelIndex === 0;
		nextBtn.disabled = activeReelIndex >= reels.length - 1;
		prevBtn.addEventListener(
			'click',
			(e) => {
				e.stopPropagation();
				if (activeReelIndex > 0) scrollToReel(activeReelIndex - 1);
			},
			opts
		);
		nextBtn.addEventListener(
			'click',
			(e) => {
				e.stopPropagation();
				if (activeReelIndex < reels.length - 1) scrollToReel(activeReelIndex + 1);
			},
			opts
		);

		// ── Scrubber & Progress Timeline ─────────────────────────────────────────
		video.addEventListener(
			'timeupdate',
			() => {
				if (video.duration) {
					const pct = (video.currentTime / video.duration) * 100;
					progFill.style.width = `${pct}%`;
					timeTip.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
				}
			},
			opts
		);

		scrubber.addEventListener(
			'click',
			(e) => {
				e.stopPropagation();
				if (!video.duration) return;
				const rect = scrubber.getBoundingClientRect();
				const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
				video.currentTime = pos * video.duration;
			},
			opts
		);
	}

	// Sincroniza dinámicamente el reproductor PiP cuando cambia el reel activo en la página principal
	$effect(() => {
		if (!isFloatingPiPActive || !pipVideoEl || !pipWindow) return;
		const reel = reels[activeReelIndex];
		if (!reel) return;

		const d = pipWindow.document;

		// Solo actualizar video src cuando efectivamente cambia de reel
		if (lastPipReelId !== reel.id) {
			lastPipReelId = reel.id;
			pipVideoEl.src = reel.video_url;
			pipVideoEl.currentTime = 0;
			if (isPlaying) {
				pipVideoEl.play().catch(() => {});
			}
		}

		// Actualizar textos y meta
		const un = d.getElementById('pip-uname');
		if (un) un.textContent = '@' + (reel.username || '');
		const verifiedIc = d.getElementById('pip-verified-ic');
		if (verifiedIc) verifiedIc.style.display = reel.is_verified ? 'inline-block' : 'none';

		const cap = d.getElementById('pip-caption');
		if (cap) cap.innerHTML = _pipFormatCaption(reel.caption || reel.description || '');

		const musicTitle = d.getElementById('pip-music-title');
		if (musicTitle)
			musicTitle.textContent = reel.audio_title || 'Sonido original - @' + (reel.username || '');

		// Actualizar avatar
		const avatarImg = d.getElementById('pip-avatar-img');
		const avatarFb = d.getElementById('pip-avatar-fb');
		if (avatarImg && avatarFb) {
			if (reel.avatar_url) {
				avatarImg.src = reel.avatar_url;
				avatarImg.style.display = 'block';
				avatarFb.style.display = 'none';
			} else {
				avatarImg.style.display = 'none';
				avatarFb.style.display = 'flex';
				avatarFb.textContent = (reel.username || '?')[0].toUpperCase();
			}
		}

		// Actualizar vinilo
		const vinylThumb = d.getElementById('pip-vinyl-thumb');
		if (vinylThumb && reel.avatar_url) {
			vinylThumb.src = reel.avatar_url;
			vinylThumb.style.display = 'block';
		}

		// Actualizar contadores y estados
		const likeBtn = d.getElementById('pip-like-btn');
		const likeIc = d.getElementById('pip-like-ic');
		const likeCount = d.getElementById('pip-like-count');
		if (likeBtn && likeIc && likeCount) {
			if (reel.user_liked) {
				likeBtn.classList.add('active-like');
				likeIc.textContent = 'favorite';
			} else {
				likeBtn.classList.remove('active-like');
				likeIc.textContent = 'favorite_border';
			}
			likeCount.textContent = formatCount(reel.like_count || 0);
		}

		const shareCount = d.getElementById('pip-share-count');
		if (shareCount) shareCount.textContent = formatCount(reel.share_count || 0);

		// Actualizar botones de navegación
		const prev = d.getElementById('pip-prev-btn');
		const next = d.getElementById('pip-next-btn');
		if (prev) prev.disabled = activeReelIndex === 0;
		if (next) next.disabled = activeReelIndex >= reels.length - 1;
	});

	function handleContextMenu(e, reel, i) {
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}
		if (i !== undefined && i !== activeReelIndex) {
			scrollToReel(i);
		}
		const menuWidth = 320;
		const menuHeight = 380;
		const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

		let x = e ? e.clientX : winW / 2;
		let y = e ? e.clientY : winH / 2;

		if (x + menuWidth > winW) x = Math.max(10, winW - menuWidth - 16);
		if (y + menuHeight > winH) y = Math.max(10, winH - menuHeight - 16);

		contextMenuPos = { x, y };
		showContextMenu = true;
		showOptionsMenu = false;
	}

	function toggleFitMode() {
		fitMode = fitMode === 'cover' ? 'contain' : 'cover';
		try {
			localStorage.setItem('vsocial_reel_fit', fitMode);
		} catch (_e) {}
		showToast(`Ajuste: ${fitMode === 'cover' ? 'Rellenar pantalla' : 'Ajustar completo'}`, 'info');
	}

	function toggleAmbientMode() {
		ambientEnabled = !ambientEnabled;
		try {
			localStorage.setItem('vsocial_reel_ambient', ambientEnabled.toString());
		} catch (_e) {}
		if (ambientEnabled) {
			const video = videoElements[activeReelIndex];
			const canvas = canvasElements[activeReelIndex];
			if (video && canvas) {
				startAmbientSync(video, canvas);
			}
			showToast('Iluminación ambiental activada', 'info');
		} else {
			stopAmbientSync(videoElements[activeReelIndex]);
			showToast('Iluminación ambiental desactivada', 'info');
		}
	}

	function toggleAutoScrollNext() {
		autoScrollNext = !autoScrollNext;
		try {
			localStorage.setItem('vsocial_reel_autonext', autoScrollNext.toString());
		} catch (_e) {}
		showToast(
			autoScrollNext
				? 'Auto-reproducir siguiente: Activado'
				: 'Auto-reproducir siguiente: Desactivado',
			'info'
		);
	}

	function markNotInterested() {
		showToast('No te mostraremos más reels similares', 'info');
		showOptionsMenu = false;
		showContextMenu = false;
		if (activeReelIndex < reels.length - 1) {
			scrollToReel(activeReelIndex + 1);
		}
	}

	function reportReel() {
		showToast('Reel reportado para revisión', 'success');
		showOptionsMenu = false;
		showContextMenu = false;
	}

	function downloadVideo(reel) {
		if (!reel?.video_url) return;
		const a = document.createElement('a');
		a.href = reel.video_url;
		a.download = `v-social-reel-${reel.username || 'video'}-${reel.id}.mp4`;
		a.target = '_blank';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		showToast('Iniciando descarga del reel...', 'success');
		showOptionsMenu = false;
		showContextMenu = false;
	}

	function unlockAutoplayAudio() {
		isMuted = false;
		if (globalVolume === 0) globalVolume = 0.7;
		autoplayBlocked = false;
		applyVolumeToAll();
		saveVolumePrefs();
		const video = videoElements[activeReelIndex];
		if (video) video.play().catch(() => {});
	}

	// ── Speed & Navigation ─────────────────────────────────────────────────────
	function setSpeed(rate) {
		playbackRate = rate;
		const video = videoElements[activeReelIndex];
		if (video) video.playbackRate = rate;
		showToast(`Velocidad: ${rate}x`, 'info');
	}

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().catch(() => {});
		} else {
			document.exitFullscreen().catch(() => {});
		}
	}

	// ── Keyboard Navigation ────────────────────────────────────────────────────
	function handleGlobalKeydown(e) {
		// Ignore if typing in an input/textarea
		const tag = e.target?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

		switch (e.key) {
			case 'ArrowDown':
			case 'j':
			case 'J':
				e.preventDefault();
				if (activeReelIndex < reels.length - 1) scrollToReel(activeReelIndex + 1);
				break;
			case 'ArrowUp':
			case 'k':
			case 'K':
				e.preventDefault();
				if (activeReelIndex > 0) scrollToReel(activeReelIndex - 1);
				break;
			case ' ':
				e.preventDefault();
				togglePlayPause();
				break;
			case 'm':
			case 'M':
				e.preventDefault();
				toggleMute();
				break;
			case 'l':
			case 'L':
				if (reels[activeReelIndex]) {
					e.preventDefault();
					handleLikeButton(reels[activeReelIndex], activeReelIndex);
				}
				break;
			case 'c':
			case 'C':
				if (reels[activeReelIndex]) {
					e.preventDefault();
					toggleComments(reels[activeReelIndex].id);
				}
				break;
			case 'f':
			case 'F':
				e.preventDefault();
				toggleFullscreen();
				break;
			case 'ArrowRight':
				e.preventDefault();
				seekRelative(3);
				break;
			case 'ArrowLeft':
				e.preventDefault();
				seekRelative(-3);
				break;
			case '>':
				e.preventDefault();
				cycleSpeed(1);
				break;
			case '<':
				e.preventDefault();
				cycleSpeed(-1);
				break;
			case '?':
				e.preventDefault();
				showShortcutsModal = !showShortcutsModal;
				break;
		}
	}

	function scrollToReel(index) {
		if (index < 0 || index >= reels.length) return;
		activeReelIndex = index;
		if (!reelContainerEl) return;
		const items = reelContainerEl.querySelectorAll('.reel-item');
		if (items[index]) {
			items[index].scrollIntoView({ behavior: 'smooth' });
		}
	}

	function seekRelative(deltaSecs) {
		const video = videoElements[activeReelIndex];
		if (!video || !video.duration) return;
		video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + deltaSecs));
		triggerCenterFlash(deltaSecs > 0 ? 'fast_forward' : 'fast_rewind');
	}

	const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
	function cycleSpeed(direction) {
		const currIdx = SPEEDS.indexOf(playbackRate);
		let nextIdx = (currIdx + direction + SPEEDS.length) % SPEEDS.length;
		setSpeed(SPEEDS[nextIdx]);
	}

	// ── Share & Copy ───────────────────────────────────────────────────────────
	function openShare(reel, e) {
		if (e) e.stopPropagation();
		showShareModal = true;
		reelsApi.share(reel.id).catch(() => {});
		reel.share_count = (reel.share_count || 0) + 1;
	}

	async function copyReelLink(reel) {
		const url = `${window.location.origin}/reels?id=${reel.id}`;
		try {
			await navigator.clipboard.writeText(url);
			showToast('¡Enlace copiado al portapapeles!', 'success');
			showShareModal = false;
		} catch (_e) {
			showToast('No se pudo copiar el enlace', 'error');
		}
	}

	async function shareNative(reel) {
		const url = `${window.location.origin}/reels?id=${reel.id}`;
		if (navigator.share) {
			try {
				await navigator.share({
					title: `Reel de @${reel.username} en VSocial`,
					text: reel.caption || '¡Mira este reel en VSocial!',
					url
				});
				showShareModal = false;
			} catch (_err) {}
		} else {
			copyReelLink(reel);
		}
	}

	// ── Delete Reel ────────────────────────────────────────────────────
	function promptDeleteReel(reel, e) {
		if (e) e.stopPropagation();
		reelToDelete = reel;
		showDeleteModal = true;
		showOptionsMenu = false;
	}

	async function confirmDeleteReel() {
		if (!reelToDelete) return;
		const id = reelToDelete.id;
		showDeleteModal = false;
		try {
			await reelsApi.delete(id);
			showToast('Reel eliminado con éxito', 'success');
			reels = reels.filter((r) => r.id !== id);
			if (activeReelIndex >= reels.length && reels.length > 0) {
				activeReelIndex = reels.length - 1;
			}
		} catch (_err) {
			showToast('Error al eliminar el reel', 'error');
		} finally {
			reelToDelete = null;
		}
	}

	// ── Comments Drawer & Real-Time Sync ───────────────────────────────────────
	function toggleComments(reelId, e) {
		if (e) e.stopPropagation();

		if (showCommentsModal && activeCommentReelId === reelId) {
			closeComments();
			return;
		}

		const reel = reels.find((r) => r.id === reelId);
		activeCommentReel = reel;
		activeCommentReelId = reelId;
		showCommentsModal = true;
		loadingComments = true;
		replyTo = null;
		commentText = '';

		reelsApi.comments
			.list(reelId)
			.then((res) => {
				commentsList = res.comments || [];
				// Auto-heal delta
				const actual = commentsList.length;
				const dbCount = reel.comment_count ?? 0;
				commentCountDeltas[reelId] = actual - dbCount;
			})
			.catch((err) => {
				console.error(err);
				showToast('Error al cargar comentarios', 'error');
				commentsList = [];
			})
			.finally(() => {
				loadingComments = false;
			});
	}

	function closeComments() {
		showCommentsModal = false;
		activeCommentReelId = null;
		commentText = '';
		replyTo = null;
	}

	function appendEmoji(emoji) {
		commentText += emoji;
	}

	function initiateReply(comment) {
		const rootId = comment.parent_id ? comment.parent_id : comment.id;
		replyTo = { id: comment.id, root_id: rootId, username: comment.username };
		setTimeout(() => {
			const inputEl = document.querySelector('.aero-comment-input');
			if (inputEl) inputEl.focus();
		}, 60);
	}

	function cancelReply() {
		replyTo = null;
	}

	async function handleCommentSubmit() {
		if (!commentText.trim()) return;
		if (!authStore.isAuthenticated) {
			showToast('Inicia sesión para comentar', 'info');
			goto('/login');
			return;
		}

		const text = commentText.trim();
		const parentId = replyTo ? replyTo.root_id : null;
		const replyToId = replyTo ? replyTo.id : null;

		const payload = { body: text };
		if (parentId) payload.parent_id = parentId;
		if (replyToId && replyToId !== parentId) payload.reply_to_id = replyToId;

		try {
			const res = await reelsApi.comments.create(activeCommentReel.id, payload);

			const newComment = {
				id: res.comment_id || Date.now(),
				reel_id: activeCommentReel.id,
				user_id: authStore.user.id,
				body: text,
				parent_id: parentId,
				reply_to_id: replyToId,
				created_at: new Date().toISOString(),
				username: authStore.user.username,
				avatar_url: authStore.user.avatar_url,
				like_count: 0,
				has_liked: false
			};

			commentsList = [...commentsList, newComment];

			// Update count delta
			const reelId = activeCommentReel.id;
			commentCountDeltas[reelId] = (commentCountDeltas[reelId] ?? 0) + 1;

			commentText = '';
			replyTo = null;

			// Auto-scroll comments
			setTimeout(() => {
				const listEl = document.querySelector('.comments-scroll-body');
				if (listEl) listEl.scrollTop = listEl.scrollHeight;
			}, 100);
		} catch (_err) {
			showToast('Error al publicar comentario', 'error');
		}
	}

	async function handleCommentLike(comment) {
		if (!authStore.isAuthenticated) {
			showToast('Inicia sesión para interactuar', 'info');
			goto('/login');
			return;
		}

		const original = commentsList.find((c) => c.id === comment.id);
		if (!original) return;

		const prevLiked = original.has_liked;
		original.has_liked = !prevLiked;
		original.like_count = (original.like_count || 0) + (prevLiked ? -1 : 1);

		try {
			if (prevLiked) {
				await reelsApi.comments.unlike(activeCommentReel.id, original.id);
			} else {
				await reelsApi.comments.like(activeCommentReel.id, original.id);
			}
		} catch (_err) {
			original.has_liked = prevLiked;
			original.like_count = (original.like_count || 0) + (prevLiked ? 1 : -1);
			showToast('Error al dar like al comentario', 'error');
		}
	}

	async function deleteComment(commentId) {
		try {
			await reelsApi.comments.delete(activeCommentReel.id, commentId);
			const res = await reelsApi.comments.list(activeCommentReel.id);
			commentsList = res.comments || [];
			const reelId = activeCommentReel.id;
			commentCountDeltas[reelId] = commentsList.length - (activeCommentReel.comment_count ?? 0);
			showToast('Comentario eliminado', 'info');
		} catch (_err) {
			showToast('Error al eliminar comentario', 'error');
		} finally {
			commentToDelete = null;
		}
	}

	let threadedComments = $derived.by(() => {
		const map = new Map(
			commentsList.map((c) => [c.id, { ...c, reply_to_username: null, replies: [] }])
		);
		const roots = [];

		commentsList.forEach((c) => {
			const current = map.get(c.id);
			if (!current) return;

			if (c.parent_id && map.has(c.parent_id)) {
				if (c.reply_to_id && map.has(c.reply_to_id)) {
					const target = map.get(c.reply_to_id);
					current.reply_to_username = target?.username;
					target?.replies.push(current);
				} else {
					map.get(c.parent_id).replies.push(current);
				}
			} else {
				roots.push(current);
			}
		});
		return roots;
	});

	// ── Formatting Helpers ─────────────────────────────────────────────────────
	function formatCount(num) {
		if (!num || num < 0) return '0';
		if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + 'M';
		if (num >= 1_000) return (num / 1_000).toFixed(1).replace('.0', '') + 'k';
		return String(num);
	}

	function formatTime(seconds) {
		if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s < 10 ? '0' : ''}${s}`;
	}

	function parseCaptionTokens(text) {
		if (!text) return [];
		const parts = text.split(/((?:#[a-zA-Z0-9_\u00C0-\u017F]+)|(?:@[a-zA-Z0-9_]+))/g);
		return parts.map((part) => {
			if (part.startsWith('#')) {
				return { type: 'tag', text: part, tag: part.slice(1) };
			}
			if (part.startsWith('@')) {
				return { type: 'mention', text: part, username: part.slice(1) };
			}
			return { type: 'text', text: part };
		});
	}

	function showToast(msg, type = 'info') {
		toastMessage = msg;
		toastType = type;
		if (toastTimeout) clearTimeout(toastTimeout);
		toastTimeout = setTimeout(() => {
			toastMessage = '';
		}, 3000);
	}
</script>

<svelte:head>
	<title>Reels | VSocial</title>
</svelte:head>

<div class="reels-master-viewport" class:comments-open={showCommentsModal}>
	<!-- Toast Notifications -->
	{#if toastMessage}
		<div
			class="reels-global-toast {toastType}"
			in:fly={{ y: -20, duration: 300 }}
			out:fade={{ duration: 150 }}
		>
			<span class="material-icons-round">
				{toastType === 'success' ? 'check_circle' : toastType === 'error' ? 'error' : 'info'}
			</span>
			<span>{toastMessage}</span>
		</div>
	{/if}

	<!-- Autoplay Sound Blocked Banner -->
	{#if autoplayBlocked}
		<button class="autoplay-unmute-banner" onclick={unlockAutoplayAudio} in:fade>
			<span class="material-icons-round">volume_off</span>
			<span>Audio silenciado. Toca para activar sonido</span>
		</button>
	{/if}

	<!-- Fast Forward 2X HUD Indicator (Long-Press) -->
	{#if isFastForwarding}
		<div class="fast-forward-hud" in:scale={{ duration: 150, start: 0.8 }} out:fade>
			<span class="material-icons-round">fast_forward</span>
			<span>2X VELOCIDAD</span>
		</div>
	{/if}

	<!-- Top Controls (Audio & Actions) -->
	<header class="reels-top-bar">
		<!-- Left Controls: Volume & Shortcuts -->
		<div class="top-left-cluster">
			<div class="volume-pill-capsule">
				<button
					class="vol-icon-btn"
					onclick={toggleMute}
					aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
				>
					<span class="material-icons-round">
						{isMuted || globalVolume === 0
							? 'volume_off'
							: globalVolume > 0.5
								? 'volume_up'
								: 'volume_down'}
					</span>
				</button>

				<div class="vol-slider-wrap">
					<input
						type="range"
						min="0"
						max="1"
						step="0.01"
						value={isMuted ? 0 : globalVolume}
						oninput={handleVolumeChange}
						class="aero-vol-slider"
						aria-label="Control de volumen"
					/>
				</div>
			</div>

			<button
				class="aero-pill-btn icon-only"
				onclick={() => (showShortcutsModal = true)}
				title="Atajos de teclado (?)"
				aria-label="Atajos de teclado"
			>
				<span class="material-icons-round">keyboard</span>
			</button>
		</div>

		<!-- Right Controls: Create Reel Button -->
		<div class="top-actions-cluster">
			<a href="/reels/create" class="btn-create-pill" title="Crear Reel">
				<span class="material-icons-round">add_circle</span>
				<span class="create-text">Crear</span>
			</a>
		</div>
	</header>

	<!-- Desktop Navigation Floating Chevrons -->
	<div class="desktop-reel-nav">
		<button
			class="nav-chevron-btn"
			disabled={activeReelIndex === 0}
			onclick={() => scrollToReel(activeReelIndex - 1)}
			title="Reel anterior (↑)"
		>
			<span class="material-icons-round">keyboard_arrow_up</span>
		</button>
		<button
			class="nav-chevron-btn"
			disabled={activeReelIndex >= reels.length - 1}
			onclick={() => scrollToReel(activeReelIndex + 1)}
			title="Siguiente reel (↓)"
		>
			<span class="material-icons-round">keyboard_arrow_down</span>
		</button>
	</div>

	<!-- Main Feed Container -->
	{#if loading}
		<div class="reels-loading-screen">
			<div class="pulse-reel-spinner">
				<span class="material-icons-round spin-slow">smart_display</span>
			</div>
			<p>Cargando reels vibrantes...</p>
		</div>
	{:else if reels.length === 0}
		<div class="reels-empty-screen">
			<span class="material-icons-round empty-icon">movie</span>
			<h3>Aún no hay reels</h3>
			<p>Sé el primero en compartir un momento inolvidable con la comunidad.</p>
			<a href="/reels/create" class="btn-primary-aero">
				<span class="material-icons-round">add</span> Crear Primer Reel
			</a>
		</div>
	{:else}
		<div class="reels-feed-column">
			<div class="reels-snap-viewport" bind:this={reelContainerEl}>
				{#each reels as reel, i (reel.id)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="reel-item"
						class:active={i === activeReelIndex}
						data-index={i}
						use:trackReel={i}
						oncontextmenu={(e) => handleContextMenu(e, reel, i)}
					>
						{#if Math.abs(i - activeReelIndex) <= 2}
							<!-- YouTube Shorts Style Ambient Glow Canvas -->
							<canvas class="ambient-canvas" class:ambient-hidden={!ambientEnabled}></canvas>
						{/if}

						<div class="vignette-overlay-top"></div>
						<div class="vignette-overlay-bottom"></div>

						<!-- Core Video Card Frame -->
						<div class="reel-frame-wrapper" class:contain-mode={fitMode === 'contain'}>
							<!-- Touch / Pointer Gesture Layer -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div
								class="gesture-interaction-area"
								onpointerdown={(e) => handlePointerDown(e, reel, i)}
								onpointerup={(e) => handlePointerUp(e, reel, i)}
								onpointercancel={(e) => handlePointerCancel(e, reel, i)}
								oncontextmenu={(e) => e.preventDefault()}
							>
								{#if Math.abs(i - activeReelIndex) <= 2}
									<video
										src={reel.video_url}
										class="main-video"
										class:fit-cover={fitMode === 'cover'}
										class:fit-contain={fitMode === 'contain'}
										class:video-disabled-blur={isFloatingPiPActive && i === activeReelIndex}
										loop={!autoScrollNext}
										playsinline
										preload={Math.abs(i - activeReelIndex) <= 1 ? 'auto' : 'none'}
										ontimeupdate={i === activeReelIndex ? handleTimeUpdate : null}
										onended={() => handleVideoEnded(reel, i)}
									>
										<track kind="captions" />
									</video>
								{:else}
									<div class="main-video-placeholder" aria-hidden="true"></div>
								{/if}

								<!-- Inactive overlay when floating player is active: pointer-events: none para no capturar clics -->
								{#if isFloatingPiPActive && i === activeReelIndex}
									<div
										class="pip-disabled-overlay"
										style="pointer-events: none;"
										transition:fade={{ duration: 200 }}
									>
										<div class="pip-disabled-glass-card">
											<div class="pip-badge-pill">
												<span class="material-icons-round">picture_in_picture_alt</span>
												<span>REPRODUCTOR FLOTANTE ACTIVO</span>
											</div>
											<p class="pip-subtext">
												El video se está reproduciendo en la ventana flotante.
											</p>
											<button
												class="btn-restore-pip-action"
												style="pointer-events: auto;"
												onclick={disableFloatingPiP}
											>
												<span class="material-icons-round">open_in_new</span>
												Desactivar
											</button>
										</div>
									</div>
								{/if}

								<!-- Center Flash Pulse Icon (Play / Pause / Seek) -->
								{#if centerFlash.show && i === activeReelIndex}
									<div class="center-flash-overlay">
										<div class="flash-icon-squircle">
											<span class="material-icons-round">{centerFlash.icon}</span>
										</div>
									</div>
								{/if}

								<!-- Floating Hearts Array (Double Tap Like) -->
								{#if i === activeReelIndex}
									{#each floatingHearts as heart (heart.id)}
										<div
											class="floating-heart"
											style="left: {heart.x}px; top: {heart.y}px; --rot: {heart.rot}deg;"
										>
											<div class="floating-heart-halo"></div>
											{#if heart.sparkles}
												<div class="floating-heart-sparks">
													{#each heart.sparkles as spk (spk.id)}
														<span
															class="sparkle-dot"
															style="--spk-angle: {spk.angle}deg; --spk-dist: {spk.dist}px; --spk-size: {spk.size}px; --spk-color: {spk.color}; --spk-delay: {spk.delay}ms;"
														></span>
													{/each}
												</div>
											{/if}
											<span class="material-icons-round">favorite</span>
										</div>
									{/each}
								{/if}

								<!-- Bottom Info Overlay (Creator, Caption, Audio Track) -->
								<div class="bottom-creator-overlay" onclick={(e) => e.stopPropagation()}>
									<div class="creator-meta-line">
										<a href="/u/{reel.username}" class="creator-name-link">
											@{reel.username}
										</a>
										{#if reel.is_verified}
											<span class="material-icons-round verified-icon" title="Verificado"
												>verified</span
											>
										{/if}

										<!-- Inline Follow Button -->
										{#if authStore.user?.username !== reel.username}
											<button
												class="btn-inline-follow"
												class:following={followStatusMap[reel.username]}
												onclick={(e) => toggleFollowCreator(reel.username, e)}
											>
												{followStatusMap[reel.username] ? 'Siguiendo' : 'Seguir'}
											</button>
										{/if}
									</div>

									<!-- Caption with #hashtag & @mention highlighting -->
									{#if reel.caption}
										<div class="caption-container">
											<p class="caption-text" class:expanded={expandedCaptions[reel.id]}>
												{#each parseCaptionTokens(reel.caption) as token}
													{#if token.type === 'tag'}
														<a
															href="/explore?q={encodeURIComponent(token.text)}"
															class="caption-tag">{token.text}</a
														>
													{:else if token.type === 'mention'}
														<a href="/u/{token.username}" class="caption-mention">{token.text}</a>
													{:else}
														<span>{token.text}</span>
													{/if}
												{/each}
											</p>
											{#if reel.caption.length > 80}
												<button
													class="caption-more-btn"
													onclick={() => (expandedCaptions[reel.id] = !expandedCaptions[reel.id])}
												>
													{expandedCaptions[reel.id] ? 'menos' : 'más'}
												</button>
											{/if}
										</div>
									{/if}

									<!-- Audio Sound Ticker & Marquee -->
									<div class="sound-track-ticker">
										<span class="material-icons-round music-icon">music_note</span>
										<div class="marquee-track">
											<span class="marquee-text">
												Sonido original — @{reel.username} • VSocial Sound Audio Track
											</span>
										</div>
									</div>
								</div>
							</div>

							<!-- Floating Right Action Sidebar (TikTok & Instagram Style) -->
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<aside class="right-action-sidebar" onclick={(e) => e.stopPropagation()}>
								<!-- Creator Avatar with Follow Badge -->
								<div class="avatar-action-wrapper">
									<a href="/u/{reel.username}" class="creator-avatar-bubble">
										{#if reel.avatar_url}
											<img src={reel.avatar_url} alt={reel.username} loading="lazy" />
										{:else}
											<span class="avatar-letter">{(reel.username || '?')[0].toUpperCase()}</span>
										{/if}
									</a>
									{#if authStore.user?.username !== reel.username && !followStatusMap[reel.username]}
										<button
											class="avatar-follow-plus"
											onclick={(e) => toggleFollowCreator(reel.username, e)}
											title="Seguir"
										>
											<span class="material-icons-round">add</span>
										</button>
									{/if}
								</div>

								<!-- Like Action -->
								<button
									class="action-bubble-btn"
									class:active={reel.user_liked}
									onclick={(e) => handleLikeButton(reel, i, e)}
									title="Me gusta (L)"
								>
									<div class="icon-wrap">
										{#if reel.is_animating_like}
											<span class="like-ring" style="width: 24px; height: 24px;"></span>
											<span class="like-ring-glow" style="width: 40px; height: 40px;"></span>
											<span class="like-sparkles">
												{#each reel.like_particles || [] as p (p.id)}
													<span
														class="sparkle-dot"
														style="--spk-angle: {p.angle}deg; --spk-dist: {p.dist}px; --spk-size: {p.size}px; --spk-color: {p.color}; --spk-delay: {p.delay}ms;"
													></span>
												{/each}
											</span>
										{/if}
										<span
											class="material-icons-round {reel.is_animating_like
												? 'heart-pop'
												: ''} {reel.is_animating_unlike ? 'heart-unpop' : ''}"
										>
											{reel.user_liked ? 'favorite' : 'favorite_border'}
										</span>
									</div>
									<span class="action-count {reel.is_animating_like ? 'count-bump' : ''}"
										>{formatCount(reel.like_count)}</span
									>
								</button>

								<!-- Comments Action -->
								<button
									class="action-bubble-btn"
									onclick={(e) => toggleComments(reel.id, e)}
									title="Comentarios (C)"
								>
									<div class="icon-wrap">
										<span class="material-icons-round">chat_bubble_outline</span>
									</div>
									<span class="action-count">
										{formatCount((reel.comment_count ?? 0) + (commentCountDeltas[reel.id] ?? 0))}
									</span>
								</button>

								<!-- Share Action -->
								<button
									class="action-bubble-btn"
									onclick={(e) => openShare(reel, e)}
									title="Compartir"
								>
									<div class="icon-wrap">
										<span class="material-icons-round">share</span>
									</div>
									<span class="action-count">{formatCount(reel.share_count)}</span>
								</button>

								<!-- More Options Action (...) -->
								<button
									class="action-bubble-btn"
									onclick={() => (showOptionsMenu = true)}
									title="Opciones"
								>
									<div class="icon-wrap">
										<span class="material-icons-round">more_horiz</span>
									</div>
									<span class="action-label">Más</span>
								</button>

								<!-- Spinning Vinyl Music Disc (TikTok Signature) -->
								<div
									class="spinning-disc-container"
									class:playing={isPlaying && i === activeReelIndex}
								>
									<div class="vinyl-disc">
										{#if reel.avatar_url}
											<img src={reel.avatar_url} alt="" class="disc-art" />
										{:else}
											<span class="material-icons-round disc-note">music_note</span>
										{/if}
									</div>

									<!-- Floating Notes Emitter -->
									{#if i === activeReelIndex}
										{#each floatingNotes as note (note.id)}
											<span class="floating-note">{note.symbol}</span>
										{/each}
									{/if}
								</div>
							</aside>
						</div>

						<!-- Precision Interactive Scrubber / Timeline (YouTube & Instagram) -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="progress-bar-interactive"
							class:hovered={isHoveringScrubber || isScrubbing}
							onmouseenter={() => (isHoveringScrubber = true)}
							onmouseleave={() => (isHoveringScrubber = false)}
							onmousedown={handleScrubberMouseDown}
							onmousemove={handleScrubberMouseMove}
							onmouseup={handleScrubberMouseUp}
						>
							{#if (isHoveringScrubber || isScrubbing) && i === activeReelIndex}
								<div class="time-preview-tooltip" style="left: {scrubHoverX}px;">
									{formatTime(isScrubbing ? activeCurrentTime : scrubPreviewTime)} / {formatTime(
										activeDuration
									)}
								</div>
							{/if}

							<div class="track-bg">
								<div
									class="track-fill"
									style="width: {i === activeReelIndex ? activeReelProgress : 0}%"
								></div>
								<div
									class="scrubber-head"
									style="left: {i === activeReelIndex ? activeReelProgress : 0}%"
								></div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Comments Drawer (Sliding Panel on Desktop, Bottom Sheet on Mobile) -->
		{#if showCommentsModal}
			<div
				class="reels-comments-drawer"
				in:fly={{ x: 420, duration: 350, easing: cubicOut }}
				out:fly={{ x: 420, duration: 250 }}
			>
				<div class="drawer-header">
					<div class="header-title-group">
						<span class="material-icons-round title-icon">chat</span>
						<h3>Comentarios</h3>
						<span class="count-pill">{commentsList.length}</span>
					</div>
					<button class="drawer-close-btn" onclick={closeComments} aria-label="Cerrar comentarios">
						<span class="material-icons-round">close</span>
					</button>
				</div>

				<div class="comments-scroll-body">
					{#if loadingComments}
						<div class="comments-loader">
							<span class="loading loading-spinner text-primary"></span>
							<p>Cargando opiniones...</p>
						</div>
					{:else if threadedComments.length === 0}
						<div class="comments-empty-state">
							<span class="material-icons-round">mode_comment</span>
							<h4>Sin comentarios todavía</h4>
							<p>¡Sé el primero en dejar tu huella en este reel!</p>
						</div>
					{:else}
						{#snippet commentNode(node, depth = 0)}
							{@const MAX_DEPTH = 2}
							<div class="comment-item-card" class:is-reply={depth > 0}>
								<a href="/u/{node.username}" class="comment-user-avatar">
									{#if node.avatar_url}
										<img src={node.avatar_url} alt={node.username} />
									{:else}
										<span>{(node.username || '?')[0].toUpperCase()}</span>
									{/if}
								</a>

								<div class="comment-main-body">
									<div class="comment-author-row">
										<a href="/u/{node.username}" class="comment-author-link">@{node.username}</a>
										{#if depth > 0}
											<span class="reply-badge">respuesta</span>
										{/if}
									</div>

									<p class="comment-text-content">
										{#if node.reply_to_username}
											<a href="/u/{node.reply_to_username}" class="mention-pill"
												>@{node.reply_to_username}</a
											>{' '}
										{/if}
										{node.body || node.comment}
									</p>

									<div class="comment-footer-actions">
										<button class="btn-reply-action" onclick={() => initiateReply(node)}>
											Responder
										</button>
										{#if authStore.user?.username === node.username || authStore.isAdmin || authStore.isModerator}
											<button class="btn-delete-action" onclick={() => (commentToDelete = node.id)}>
												Eliminar
											</button>
										{/if}
									</div>
								</div>

								<div class="comment-like-col">
									<button
										class="comment-heart-btn"
										class:liked={node.has_liked}
										onclick={() => handleCommentLike(node)}
									>
										<span class="material-icons-round">
											{node.has_liked ? 'favorite' : 'favorite_border'}
										</span>
										<span class="like-num">{node.like_count || 0}</span>
									</button>
								</div>
							</div>

							{#if node.replies && node.replies.length > 0}
								<div class="nested-replies-block" class:deep={depth >= MAX_DEPTH}>
									{#each node.replies as child}
										{@render commentNode(child, depth + 1)}
									{/each}
								</div>
							{/if}
						{/snippet}

						{#each threadedComments as rootComment}
							{@render commentNode(rootComment, 0)}
						{/each}
					{/if}
				</div>

				<!-- Quick Emojis & Comment Input Area -->
				<div class="comment-composer-container">
					{#if replyTo}
						<div class="reply-indicator-banner" transition:slide={{ duration: 150 }}>
							<span>Respondiendo a <strong>@{replyTo.username}</strong></span>
							<button onclick={cancelReply} aria-label="Cancelar respuesta">
								<span class="material-icons-round">close</span>
							</button>
						</div>
					{/if}

					<!-- Quick 1-Tap Emoji Row -->
					<div class="quick-emojis-bar">
						{#each QUICK_EMOJIS as emoji}
							<button class="quick-emoji-btn" onclick={() => appendEmoji(emoji)}>
								{emoji}
							</button>
						{/each}
					</div>

					{#if authStore.isAuthenticated}
						<form
							class="comment-form"
							onsubmit={(e) => {
								e.preventDefault();
								handleCommentSubmit();
							}}
						>
							<input
								type="text"
								placeholder={replyTo ? 'Escribe una respuesta...' : 'Deja tu comentario...'}
								bind:value={commentText}
								class="aero-comment-input"
								maxlength="500"
							/>
							<button
								type="submit"
								disabled={!commentText.trim()}
								class="aero-comment-send"
								aria-label="Enviar"
							>
								<span class="material-icons-round">send</span>
							</button>
						</form>
					{:else}
						<div class="login-to-comment-box">
							<a href="/login" class="login-btn-link">Inicia sesión</a> para unirte a la conversación.
						</div>
					{/if}
				</div>
			</div>

			<!-- Mobile Backdrop -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="mobile-comments-backdrop"
				onclick={closeComments}
				transition:fade={{ duration: 200 }}
			></div>
		{/if}
	{/if}

	<!-- Share Modal / Popover -->
	{#if showShareModal && reels[activeReelIndex]}
		{@const activeReel = reels[activeReelIndex]}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-backdrop-blur" onclick={() => (showShareModal = false)} transition:fade>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="share-card-modal"
				onclick={(e) => e.stopPropagation()}
				in:scale={{ duration: 250, start: 0.9 }}
			>
				<div class="share-modal-header">
					<h3>Compartir Reel</h3>
					<button class="btn-close-round" onclick={() => (showShareModal = false)}>
						<span class="material-icons-round">close</span>
					</button>
				</div>

				<div class="share-grid-actions">
					<button class="share-platform-btn" onclick={() => shareNative(activeReel)}>
						<div class="platform-icon-circle native">
							<span class="material-icons-round">share</span>
						</div>
						<span>Compartir</span>
					</button>

					<button class="share-platform-btn" onclick={() => copyReelLink(activeReel)}>
						<div class="platform-icon-circle copy">
							<span class="material-icons-round">content_copy</span>
						</div>
						<span>Copiar link</span>
					</button>

					<a
						href="https://api.whatsapp.com/send?text={encodeURIComponent(
							`¡Mira este reel en VSocial! ${typeof window !== 'undefined' ? window.location.origin : ''}/reels?id=${activeReel.id}`
						)}"
						target="_blank"
						rel="noopener noreferrer"
						class="share-platform-btn"
					>
						<div class="platform-icon-circle whatsapp">
							<span class="material-icons-round">chat</span>
						</div>
						<span>WhatsApp</span>
					</a>

					<a
						href="https://t.me/share/url?url={encodeURIComponent(
							`${typeof window !== 'undefined' ? window.location.origin : ''}/reels?id=${activeReel.id}`
						)}&text={encodeURIComponent(activeReel.caption || 'Reel en VSocial')}"
						target="_blank"
						rel="noopener noreferrer"
						class="share-platform-btn"
					>
						<div class="platform-icon-circle telegram">
							<span class="material-icons-round">send</span>
						</div>
						<span>Telegram</span>
					</a>

					<a
						href="https://twitter.com/intent/tweet?text={encodeURIComponent(
							`Mira este reel en VSocial: ${typeof window !== 'undefined' ? window.location.origin : ''}/reels?id=${activeReel.id}`
						)}"
						target="_blank"
						rel="noopener noreferrer"
						class="share-platform-btn"
					>
						<div class="platform-icon-circle twitter">
							<span class="material-icons-round">flutter_dash</span>
						</div>
						<span>X / Twitter</span>
					</a>
				</div>
			</div>
		</div>
	{/if}

	<!-- More Options Menu Modal (TikTok 3-Dots Style - Real Controls) -->
	{#if showOptionsMenu && reels[activeReelIndex]}
		{@const currentReel = reels[activeReelIndex]}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-backdrop-blur" onclick={() => (showOptionsMenu = false)} transition:fade>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="tiktok-menu-card"
				onclick={(e) => e.stopPropagation()}
				in:scale={{ duration: 200, start: 0.92 }}
			>
				<!-- Velocidad Section -->
				<div class="tt-speed-section">
					<div class="tt-speed-header">
						<div class="tt-row-label">
							<span class="material-icons-round">speed</span>
							<span>Velocidad</span>
						</div>
						<span class="tt-speed-current-badge">
							{playbackRate === 1 ? '1.0x (Normal)' : `${playbackRate}x`}
						</span>
					</div>
					<div class="tt-speed-pills-bar">
						{#each SPEEDS as speed}
							<button
								class="tt-speed-pill-btn"
								class:active={playbackRate === speed}
								onclick={() => setSpeed(speed)}
							>
								{speed === 1 ? '1x' : `${speed}x`}
							</button>
						{/each}
					</div>
				</div>

				<!-- Reproductor flotante -->
				<button
					class="tt-menu-item"
					onclick={() => {
						enableFloatingPiP();
						showOptionsMenu = false;
					}}
				>
					<div class="tt-item-left">
						<span class="material-icons-round">picture_in_picture_alt</span>
						<span>Reproductor flotante</span>
					</div>
				</button>

				<!-- Ajuste de Video -->
				<button class="tt-menu-item" onclick={toggleFitMode}>
					<div class="tt-item-left">
						<span class="material-icons-round">
							{fitMode === 'cover' ? 'crop_free' : 'aspect_ratio'}
						</span>
						<span>Ajuste de pantalla</span>
					</div>
					<div class="tt-item-right">
						<span>{fitMode === 'cover' ? 'Rellenar' : 'Ajustar'}</span>
						<span class="material-icons-round arrow-icon">chevron_right</span>
					</div>
				</button>

				<!-- Iluminación Ambiental -->
				<button class="tt-menu-item" onclick={toggleAmbientMode}>
					<div class="tt-item-left">
						<span class="material-icons-round">
							{ambientEnabled ? 'blur_on' : 'blur_off'}
						</span>
						<span>Iluminación ambiental</span>
					</div>
					<div class="tt-item-right">
						<span>{ambientEnabled ? 'Activada' : 'Desactivada'}</span>
					</div>
				</button>

				<!-- Auto-reproducir siguiente -->
				<button class="tt-menu-item" onclick={toggleAutoScrollNext}>
					<div class="tt-item-left">
						<span class="material-icons-round">
							{autoScrollNext ? 'autorenew' : 'replay'}
						</span>
						<span>Auto-siguiente</span>
					</div>
					<div class="tt-item-right">
						<span>{autoScrollNext ? 'Activado' : 'Bucle'}</span>
					</div>
				</button>

				<hr class="tt-menu-divider" />

				<!-- No me interesa -->
				<button class="tt-menu-item" onclick={markNotInterested}>
					<div class="tt-item-left">
						<span class="material-icons-round">heart_broken</span>
						<span>No me interesa</span>
					</div>
				</button>

				<!-- Denunciar -->
				<button class="tt-menu-item" onclick={reportReel}>
					<div class="tt-item-left">
						<span class="material-icons-round">flag</span>
						<span>Denunciar</span>
					</div>
				</button>

				{#if authStore.user?.username === currentReel.username || authStore.isAdmin || authStore.isModerator}
					<hr class="tt-menu-divider" />
					<button
						class="tt-menu-item danger"
						onclick={(e) => {
							showOptionsMenu = false;
							promptDeleteReel(currentReel, e);
						}}
					>
						<div class="tt-item-left">
							<span class="material-icons-round">delete_forever</span>
							<span>Eliminar Reel</span>
						</div>
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Right Click Context Menu (TikTok Context Menu Style - Real Controls) -->
	{#if showContextMenu && reels[activeReelIndex]}
		{@const ctxReel = reels[activeReelIndex]}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="context-menu-backdrop"
			onclick={() => (showContextMenu = false)}
			oncontextmenu={(e) => handleContextMenu(e, reels[activeReelIndex], activeReelIndex)}
		>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="tiktok-context-menu"
				style="left: {contextMenuPos.x}px; top: {contextMenuPos.y}px;"
				onclick={(e) => e.stopPropagation()}
				oncontextmenu={(e) => e.preventDefault()}
				in:scale={{ duration: 150, start: 0.95 }}
			>
				<!-- Velocidad Section -->
				<div class="tt-speed-section">
					<div class="tt-speed-header">
						<div class="tt-row-label">
							<span class="material-icons-round">speed</span>
							<span>Velocidad</span>
						</div>
						<span class="tt-speed-current-badge">
							{playbackRate === 1 ? '1.0x (Normal)' : `${playbackRate}x`}
						</span>
					</div>
					<div class="tt-speed-pills-bar">
						{#each SPEEDS as speed}
							<button
								class="tt-speed-pill-btn"
								class:active={playbackRate === speed}
								onclick={() => {
									setSpeed(speed);
									showContextMenu = false;
								}}
							>
								{speed === 1 ? '1x' : `${speed}x`}
							</button>
						{/each}
					</div>
				</div>

				<!-- Reproductor flotante -->
				<button
					class="tt-menu-item"
					onclick={() => {
						enableFloatingPiP();
						showContextMenu = false;
					}}
				>
					<div class="tt-item-left">
						<span class="material-icons-round">picture_in_picture_alt</span>
						<span>Reproductor flotante</span>
					</div>
				</button>

				<!-- Ajuste de Video -->
				<button
					class="tt-menu-item"
					onclick={() => {
						toggleFitMode();
						showContextMenu = false;
					}}
				>
					<div class="tt-item-left">
						<span class="material-icons-round">
							{fitMode === 'cover' ? 'crop_free' : 'aspect_ratio'}
						</span>
						<span>Ajuste de pantalla</span>
					</div>
					<div class="tt-item-right">
						<span>{fitMode === 'cover' ? 'Rellenar' : 'Ajustar'}</span>
					</div>
				</button>

				<!-- Iluminación Ambiental -->
				<button
					class="tt-menu-item"
					onclick={() => {
						toggleAmbientMode();
						showContextMenu = false;
					}}
				>
					<div class="tt-item-left">
						<span class="material-icons-round">
							{ambientEnabled ? 'blur_on' : 'blur_off'}
						</span>
						<span>Iluminación ambiental</span>
					</div>
					<div class="tt-item-right">
						<span>{ambientEnabled ? 'Activada' : 'Desactivada'}</span>
					</div>
				</button>

				<hr class="tt-menu-divider" />

				<!-- Descargar vídeo -->
				<button class="tt-menu-item" onclick={() => downloadVideo(ctxReel)}>
					<div class="tt-item-left">
						<span class="material-icons-round">download</span>
						<span>Descargar vídeo</span>
					</div>
				</button>

				<!-- Compartir -->
				<button
					class="tt-menu-item"
					onclick={(e) => {
						showContextMenu = false;
						openShare(ctxReel, e);
					}}
				>
					<div class="tt-item-left">
						<span class="material-icons-round">share</span>
						<span>Compartir</span>
					</div>
				</button>

				<!-- Copiar enlace -->
				<button
					class="tt-menu-item"
					onclick={() => {
						showContextMenu = false;
						copyReelLink(ctxReel);
					}}
				>
					<div class="tt-item-left">
						<span class="material-icons-round">content_copy</span>
						<span>Copiar enlace</span>
					</div>
				</button>

				{#if authStore.user?.username === ctxReel.username || authStore.isAdmin || authStore.isModerator}
					<hr class="tt-menu-divider" />
					<button
						class="tt-menu-item danger"
						onclick={(e) => {
							showContextMenu = false;
							promptDeleteReel(ctxReel, e);
						}}
					>
						<div class="tt-item-left">
							<span class="material-icons-round">delete_forever</span>
							<span>Eliminar Reel</span>
						</div>
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Keyboard Shortcuts Modal -->
	{#if showShortcutsModal}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-backdrop-blur" onclick={() => (showShortcutsModal = false)} transition:fade>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="shortcuts-card-modal"
				onclick={(e) => e.stopPropagation()}
				in:scale={{ duration: 250, start: 0.9 }}
			>
				<div class="shortcuts-header">
					<span class="material-icons-round text-primary">keyboard</span>
					<h3>Atajos de Teclado</h3>
					<button class="btn-close-round" onclick={() => (showShortcutsModal = false)}>
						<span class="material-icons-round">close</span>
					</button>
				</div>

				<div class="shortcuts-grid">
					<div class="shortcut-item">
						<kbd>↑</kbd> o <kbd>W</kbd>
						<span>Reel anterior</span>
					</div>
					<div class="shortcut-item">
						<kbd>↓</kbd> o <kbd>S</kbd>
						<span>Siguiente reel</span>
					</div>
					<div class="shortcut-item">
						<kbd>Espacio</kbd>
						<span>Reproducir / Pausa</span>
					</div>
					<div class="shortcut-item">
						<kbd>M</kbd>
						<span>Silenciar / Activar sonido</span>
					</div>
					<div class="shortcut-item">
						<kbd>L</kbd>
						<span>Me gusta (Like)</span>
					</div>
					<div class="shortcut-item">
						<kbd>C</kbd>
						<span>Abrir / Cerrar comentarios</span>
					</div>
					<div class="shortcut-item">
						<kbd>→</kbd> / <kbd>←</kbd>
						<span>Adelantar / Retroceder 3s</span>
					</div>
					<div class="shortcut-item">
						<kbd>&gt;</kbd> / <kbd>&lt;</kbd>
						<span>Aumentar / Reducir velocidad</span>
					</div>
					<div class="shortcut-item">
						<kbd>F</kbd>
						<span>Pantalla completa</span>
					</div>
					<div class="shortcut-item">
						<kbd>?</kbd>
						<span>Abrir esta ayuda</span>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Delete Reel Confirmation Modal -->
	{#if showDeleteModal && reelToDelete}
		<div class="modal-backdrop-blur" transition:fade>
			<div class="confirm-dialog-card" in:fly={{ y: 20, duration: 250 }}>
				<div class="danger-icon-circle">
					<span class="material-icons-round">delete_outline</span>
				</div>
				<h4>¿Eliminar este Reel?</h4>
				<p>El reel y todos sus comentarios se eliminarán de forma permanente.</p>
				<div class="confirm-actions-row">
					<button class="btn-cancel" onclick={() => (showDeleteModal = false)}>Cancelar</button>
					<button class="btn-confirm-delete" onclick={confirmDeleteReel}>Eliminar</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Delete Comment Confirmation Modal -->
	{#if commentToDelete}
		<div class="modal-backdrop-blur" transition:fade>
			<div class="confirm-dialog-card" in:fly={{ y: 20, duration: 250 }}>
				<h4>¿Eliminar comentario?</h4>
				<p>Esta acción no se puede deshacer.</p>
				<div class="confirm-actions-row">
					<button class="btn-cancel" onclick={() => (commentToDelete = null)}>Cancelar</button>
					<button class="btn-confirm-delete" onclick={() => deleteComment(commentToDelete)}>
						Eliminar
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* ── Master Fullscreen Layout ─────────────────────────────────────────── */
	.reels-master-viewport {
		--aero-blue: #1b85f3;
		--aero-sky: #2eb4ff;
		--aero-rose: #f43f5e;
		--bg-dark-void: #060b11;

		position: absolute;
		inset: 0;
		background: var(--bg-dark-void);
		display: flex;
		overflow: hidden;
		user-select: none;
	}

	@media (max-width: 768px) {
		.reels-master-viewport {
			position: fixed;
			z-index: 50;
		}
	}

	/* ── Global Floating Toasts ───────────────────────────────────────────── */
	.reels-global-toast {
		position: absolute;
		top: 24px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1000;
		background: rgba(15, 23, 42, 0.88);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		padding: 10px 22px;
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		gap: 10px;
		color: #ffffff;
		font-weight: 700;
		font-size: 0.92rem;
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
	}
	.reels-global-toast.success {
		border-color: rgba(0, 212, 170, 0.4);
		color: #00d4aa;
	}
	.reels-global-toast.error {
		border-color: rgba(244, 63, 94, 0.4);
		color: #f43f5e;
	}

	/* Autoplay Unmute Prompt */
	.autoplay-unmute-banner {
		position: absolute;
		top: 80px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 990;
		background: rgba(27, 133, 243, 0.9);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: #fff;
		padding: 8px 18px;
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 700;
		font-size: 0.88rem;
		cursor: pointer;
		box-shadow: 0 6px 20px rgba(27, 133, 243, 0.4);
		animation: pulse-banner 2s infinite;
	}
	@keyframes pulse-banner {
		0%,
		100% {
			transform: translateX(-50%) scale(1);
		}
		50% {
			transform: translateX(-50%) scale(1.04);
		}
	}

	/* Fast Forward 2X HUD Badge */
	.fast-forward-hud {
		position: absolute;
		top: 30px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 950;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(14px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 8px 20px;
		border-radius: var(--radius-full);
		color: var(--aero-sky);
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 900;
		letter-spacing: 0.05em;
		box-shadow: 0 0 20px rgba(46, 180, 255, 0.4);
	}

	/* ── Top Bar ──────────────────────────────────────────────────────────── */
	.reels-top-bar {
		position: absolute;
		top: 20px;
		left: 20px;
		right: 20px;
		z-index: 100;
		display: flex;
		justify-content: space-between;
		align-items: center;
		pointer-events: none;
		transition: right 0.4s var(--ease-spring);
	}
	.reels-top-bar > * {
		pointer-events: auto;
	}
	@media (min-width: 769px) {
		.reels-master-viewport.comments-open .reels-top-bar {
			right: 464px;
		}
	}

	/* ── Volume Pill Capsule (Aero Style) ────────────────────────────────── */
	.volume-pill-capsule {
		display: flex;
		align-items: center;
		height: 44px;
		background: var(--bg-surface-solid);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--border-subtle);
		border-top: 1px solid var(--glass-border-t);
		border-radius: var(--radius-full);
		padding: 4px 14px 4px 4px;
		gap: 10px;
		box-shadow: var(--shadow-sm), var(--glass-inset-highlight);
		transition: all 0.25s var(--ease-spring);
	}
	.volume-pill-capsule:hover {
		background: var(--bg-surface-hover);
		border-color: rgba(var(--accent-blue-rgb), 0.35);
		box-shadow:
			0 6px 20px rgba(0, 0, 0, 0.2),
			var(--glass-inset-highlight);
	}
	.vol-icon-btn {
		width: 36px;
		height: 36px;
		flex: 0 0 36px;
		min-width: 36px;
		min-height: 36px;
		border-radius: 50%;
		background: rgba(var(--accent-blue-rgb), 0.12);
		border: none;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			transform 0.2s var(--ease-spring),
			background 0.2s,
			color 0.2s;
	}
	.vol-icon-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.25);
		color: var(--accent-blue-light);
		transform: scale(1.08);
	}
	.vol-slider-wrap {
		display: flex;
		align-items: center;
		width: 85px;
	}
	.aero-vol-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 5px;
		background: rgba(128, 128, 128, 0.25);
		border-radius: 999px;
		outline: none;
		cursor: pointer;
	}
	.aero-vol-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 18px;
		border-radius: 6px;
		background: var(--aero-sky, #2eb4ff);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
		cursor: pointer;
		transition: transform 0.15s ease;
	}
	.aero-vol-slider::-webkit-slider-thumb:hover {
		transform: scale(1.15);
	}

	/* ── Top Clusters & Aero Pill Buttons ────────────────────────────────── */
	.top-left-cluster,
	.top-actions-cluster {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.aero-pill-btn {
		height: 44px;
		min-height: 44px;
		padding: 0 18px;
		border-radius: var(--radius-full);
		background: var(--bg-surface-solid);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--border-subtle);
		border-top: 1px solid var(--glass-border-t);
		color: var(--text-primary);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.9rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		cursor: pointer;
		text-decoration: none;
		position: relative;
		overflow: hidden;
		box-shadow: var(--shadow-sm), var(--glass-inset-highlight);
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base),
			background var(--t-base),
			border-color var(--t-base),
			color var(--t-base);
		transform: translateZ(0);
	}
	.aero-pill-btn::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 45%;
		background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.35) 0%,
			rgba(255, 255, 255, 0.02) 100%
		);
		border-radius: var(--radius-full) var(--radius-full) 0 0;
		pointer-events: none;
		z-index: 1;
	}
	.aero-pill-btn:hover {
		transform: translateY(-2px) scale(1.06);
		background: var(--bg-surface-hover);
		color: var(--accent-blue-light);
		border-color: rgba(var(--accent-blue-rgb), 0.45);
		box-shadow:
			0 6px 20px rgba(var(--accent-blue-rgb), 0.35),
			var(--glass-inset-highlight);
	}
	.aero-pill-btn:active {
		transform: translateY(1px) scale(0.96);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
	}
	.aero-pill-btn:focus-visible {
		outline: 2px solid var(--accent-blue-base);
		outline-offset: 2px;
	}
	.aero-pill-btn.icon-only {
		width: 44px;
		padding: 0;
		flex: 0 0 44px;
		min-width: 44px;
		min-height: 44px;
	}
	.aero-pill-btn.icon-only .material-icons-round {
		font-size: 1.35rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 2;
	}

	.btn-create-pill {
		height: 44px;
		padding: 0 18px;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, var(--aero-blue), var(--aero-sky));
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: #ffffff;
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 800;
		font-size: 0.9rem;
		text-decoration: none;
		box-shadow: 0 6px 20px rgba(27, 133, 243, 0.4);
		transition: all 0.25s var(--ease-spring);
	}
	.btn-create-pill:hover {
		transform: translateY(-2px) scale(1.04);
		box-shadow: 0 8px 25px rgba(27, 133, 243, 0.6);
	}

	/* ── Desktop Chevrons ─────────────────────────────────────────────────── */
	.desktop-reel-nav {
		position: absolute;
		right: 32px;
		top: 50%;
		transform: translateY(-50%);
		z-index: 90;
		display: flex;
		flex-direction: column;
		gap: 16px;
		transition:
			right 0.4s var(--ease-spring),
			opacity 0.3s ease,
			transform 0.4s var(--ease-spring);
	}
	@media (max-width: 960px) {
		.desktop-reel-nav {
			display: none;
		}
	}
	@media (min-width: 961px) {
		.reels-master-viewport.comments-open .desktop-reel-nav {
			right: 464px;
		}
	}
	@media (max-width: 1100px) {
		.reels-master-viewport.comments-open .desktop-reel-nav {
			opacity: 0;
			pointer-events: none;
		}
	}
	.nav-chevron-btn {
		width: 48px;
		height: 48px;
		flex: 0 0 48px;
		min-width: 48px;
		min-height: 48px;
		border-radius: var(--radius-squircle);
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		border-top: 1px solid var(--glass-border-t);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		color: var(--text-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.25s var(--ease-spring);
		box-shadow: var(--shadow-sm), var(--glass-inset-highlight);
	}
	.nav-chevron-btn:not(:disabled):hover {
		background: var(--bg-surface-hover);
		color: var(--accent-blue-light);
		border-color: rgba(var(--accent-blue-rgb), 0.4);
		transform: scale(1.1);
		box-shadow: 0 6px 20px rgba(var(--accent-blue-rgb), 0.35);
	}
	.nav-chevron-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		color: var(--text-muted);
		background: var(--glass-bg);
		border-color: var(--border-subtle);
		box-shadow: none;
	}

	/* ── Loading & Empty Screens ──────────────────────────────────────────── */
	.reels-loading-screen,
	.reels-empty-screen {
		flex: 1;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		color: #ffffff;
		text-align: center;
		padding: 24px;
	}
	.pulse-reel-spinner {
		width: 80px;
		height: 80px;
		border-radius: var(--radius-squircle);
		background: rgba(27, 133, 243, 0.15);
		border: 1px solid rgba(27, 133, 243, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--aero-sky);
	}
	.pulse-reel-spinner .material-icons-round {
		font-size: 40px;
	}
	.empty-icon {
		font-size: 64px;
		color: var(--aero-sky);
		opacity: 0.8;
	}
	.btn-primary-aero {
		padding: 12px 28px;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, var(--aero-blue), var(--aero-sky));
		color: #ffffff;
		font-weight: 800;
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 8px;
		box-shadow: 0 6px 20px rgba(27, 133, 243, 0.4);
	}

	/* ── Feed Column & Viewport ───────────────────────────────────────────── */
	.reels-feed-column {
		flex: 1;
		height: 100%;
		position: relative;
		overflow: hidden;
		display: flex;
		justify-content: center;
		background: #000000;
	}

	.reels-snap-viewport {
		height: 100%;
		width: 100%;
		overflow-y: scroll;
		scroll-snap-type: y mandatory;
		scrollbar-width: none;
		-ms-overflow-style: none;
		position: relative;
		display: flex;
		flex-direction: column;
	}
	.reels-snap-viewport::-webkit-scrollbar {
		display: none;
	}

	.reel-item {
		width: 100%;
		height: 100%;
		flex: 0 0 100%;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		display: flex;
		justify-content: center;
		align-items: center;
		background: #000000;
		position: relative;
		overflow: hidden;
	}

	/* Ambient Lighting Glow Canvas */
	.ambient-canvas {
		position: absolute;
		inset: -15%;
		width: 130%;
		height: 130%;
		object-fit: cover;
		filter: blur(45px) brightness(0.4) saturate(1.4);
		z-index: 1;
		pointer-events: none;
		transform: scale(1.1);
		transition: opacity 0.3s ease;
	}
	.ambient-canvas.ambient-hidden {
		display: none;
		opacity: 0;
	}

	/* Vignettes */
	.vignette-overlay-top {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 140px;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6) 0%, transparent 100%);
		z-index: 2;
		pointer-events: none;
	}
	.vignette-overlay-bottom {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 280px;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, transparent 100%);
		z-index: 2;
		pointer-events: none;
	}

	/* Core Reel Frame Wrapper */
	.reel-frame-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 3;
		transition: transform 0.4s var(--ease-spring);
	}

	@media (min-width: 769px) {
		.reel-frame-wrapper {
			width: 420px;
			height: calc(100% - 40px);
			max-height: 860px;
		}
		.reels-master-viewport.comments-open .reel-frame-wrapper {
			transform: translateX(-180px);
		}
		.gesture-interaction-area {
			border-radius: var(--radius-lg);
			overflow: hidden;
			box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7);
			border: 1px solid rgba(255, 255, 255, 0.1);
		}
	}

	.gesture-interaction-area {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		background: #000000;
		cursor: pointer;
	}

	.main-video,
	.main-video-placeholder {
		width: 100%;
		height: 100%;
		display: block;
		background: #000000;
		transition:
			filter 0.3s ease,
			transform 0.3s ease;
	}
	.main-video.fit-cover {
		object-fit: cover;
	}
	.main-video.fit-contain {
		object-fit: contain;
	}
	.main-video.video-disabled-blur {
		filter: blur(18px) brightness(0.35);
		transform: scale(1.04);
		pointer-events: none;
	}

	/* Inactive Base Reel Overlay when Floating Player is active */
	.pip-disabled-overlay {
		position: absolute;
		inset: 0;
		z-index: 25;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		padding: 24px;
	}
	.pip-disabled-glass-card {
		background: rgba(15, 23, 42, 0.88);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: var(--radius-lg);
		padding: 24px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 12px;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
		max-width: 300px;
	}
	.pip-badge-pill {
		display: flex;
		align-items: center;
		gap: 8px;
		background: rgba(27, 133, 243, 0.2);
		border: 1px solid rgba(46, 180, 255, 0.4);
		padding: 6px 14px;
		border-radius: var(--radius-full);
		color: var(--aero-sky);
		font-size: 0.82rem;
		font-weight: 900;
		letter-spacing: 0.04em;
	}
	.pip-badge-pill .material-icons-round {
		font-size: 18px;
	}
	.pip-subtext {
		color: #94a3b8;
		font-size: 0.82rem;
		margin: 0;
		line-height: 1.4;
	}
	.btn-restore-pip-action {
		margin-top: 4px;
		padding: 8px 22px;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, var(--aero-blue), var(--aero-sky));
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: #ffffff;
		font-size: 0.88rem;
		font-weight: 800;
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(27, 133, 243, 0.4);
		transition: all 0.2s var(--ease-spring);
	}
	.btn-restore-pip-action:hover {
		transform: scale(1.06);
		box-shadow: 0 6px 20px rgba(27, 133, 243, 0.6);
	}

	/* Center Flash Animation */
	.center-flash-overlay {
		position: absolute;
		inset: 0;
		z-index: 10;
		pointer-events: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.flash-icon-squircle {
		width: 90px;
		height: 90px;
		border-radius: var(--radius-squircle);
		background: rgba(10, 16, 26, 0.6);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		animation: pulse-flash 0.55s var(--ease-spring) forwards;
	}
	.flash-icon-squircle .material-icons-round {
		font-size: 52px;
	}
	@keyframes pulse-flash {
		0% {
			transform: scale(0.6);
			opacity: 0;
		}
		40% {
			transform: scale(1.15);
			opacity: 1;
		}
		100% {
			transform: scale(1.4);
			opacity: 0;
		}
	}

	/* Double Tap Floating Heart */
	.floating-heart {
		position: absolute;
		z-index: 30;
		color: var(--aero-rose);
		pointer-events: none;
		display: flex;
		align-items: center;
		justify-content: center;
		transform: translate(-50%, -50%) scale(0) rotate(var(--rot, 0deg));
		animation: vsHeartExplode 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	.floating-heart-halo {
		position: absolute;
		width: 110px;
		height: 110px;
		border-radius: 50%;
		border: 4px solid var(--aero-rose, #ec4899);
		animation: vsRingBurst 0.6s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
		pointer-events: none;
	}
	.floating-heart-sparks {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0;
		height: 0;
		pointer-events: none;
	}
	.floating-spark-dot {
		position: absolute;
		top: 0;
		left: 0;
		width: 6px;
		height: 6px;
		background: var(--spk-color, #f43f5e);
		border-radius: 50%;
		box-shadow: 0 0 8px var(--spk-color, #f43f5e);
		animation: vsSparkleFly 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	.floating-heart .material-icons-round {
		font-size: 96px;
		filter: drop-shadow(0 0 28px rgba(244, 63, 94, 0.9))
			drop-shadow(0 0 6px rgba(236, 72, 153, 0.8));
	}
	@keyframes vsHeartExplode {
		0% {
			transform: translate(-50%, -50%) scale(0) rotate(var(--rot, 0deg));
			opacity: 0;
		}
		15% {
			transform: translate(-50%, -50%) scale(1.35) rotate(var(--rot, 0deg));
			opacity: 1;
		}
		35% {
			transform: translate(-50%, -50%) scale(1.15) rotate(var(--rot, 0deg));
			opacity: 1;
		}
		70% {
			transform: translate(-50%, -120%) scale(1.3) rotate(var(--rot, 0deg));
			opacity: 0.9;
		}
		100% {
			transform: translate(-50%, -200%) scale(1.5) rotate(var(--rot, 0deg));
			opacity: 0;
		}
	}

	/* ── Bottom Creator Overlay ───────────────────────────────────────────── */
	.bottom-creator-overlay {
		position: absolute;
		left: 16px;
		right: 80px;
		bottom: 24px;
		z-index: 15;
		display: flex;
		flex-direction: column;
		gap: 8px;
		color: #ffffff;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
		pointer-events: none;
	}
	@media (min-width: 769px) {
		.bottom-creator-overlay {
			right: 16px;
			bottom: 18px;
		}
	}
	.bottom-creator-overlay > * {
		pointer-events: auto;
	}

	.creator-meta-line {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.creator-name-link {
		font-size: 1.05rem;
		font-weight: 800;
		color: #ffffff;
		text-decoration: none;
		letter-spacing: -0.01em;
	}
	.creator-name-link:hover {
		text-decoration: underline;
	}
	.verified-icon {
		font-size: 16px;
		color: var(--aero-sky);
	}
	.btn-inline-follow {
		padding: 3px 12px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.4);
		backdrop-filter: blur(8px);
		color: #ffffff;
		font-size: 0.78rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}
	.btn-inline-follow:hover {
		background: #ffffff;
		color: #000000;
	}
	.btn-inline-follow.following {
		background: transparent;
		border-color: rgba(255, 255, 255, 0.3);
		color: rgba(255, 255, 255, 0.8);
	}

	.caption-container {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
	}
	.caption-text {
		font-size: 0.92rem;
		line-height: 1.4;
		margin: 0;
		color: rgba(255, 255, 255, 0.95);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.caption-text.expanded {
		-webkit-line-clamp: unset;
		max-height: 200px;
		overflow-y: auto;
	}
	.caption-tag,
	.caption-mention {
		color: var(--aero-sky);
		font-weight: 700;
		text-decoration: none;
	}
	.caption-tag:hover,
	.caption-mention:hover {
		text-decoration: underline;
	}
	.caption-more-btn {
		background: none;
		border: none;
		padding: 0;
		color: rgba(255, 255, 255, 0.6);
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
	}

	.sound-track-ticker {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.82rem;
		color: rgba(255, 255, 255, 0.9);
		overflow: hidden;
		width: 100%;
		max-width: 260px;
	}
	.music-icon {
		font-size: 16px;
		color: var(--aero-sky);
	}
	.marquee-track {
		overflow: hidden;
		white-space: nowrap;
		position: relative;
	}
	.marquee-text {
		display: inline-block;
		animation: marquee-scroll 12s linear infinite;
	}
	@keyframes marquee-scroll {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-50%);
		}
	}

	/* ── Floating Right Action Sidebar ────────────────────────────────────── */
	.right-action-sidebar {
		position: absolute;
		right: 14px;
		bottom: 70px;
		z-index: 20;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		pointer-events: auto;
	}
	@media (min-width: 769px) {
		.right-action-sidebar {
			right: -72px;
			bottom: 12px;
		}
	}

	.avatar-action-wrapper {
		position: relative;
		margin-bottom: 6px;
	}
	.creator-avatar-bubble {
		width: 48px;
		height: 48px;
		flex: 0 0 48px;
		min-width: 48px;
		min-height: 48px;
		border-radius: var(--radius-squircle);
		border: 2px solid #ffffff;
		background: #0f172a;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
		text-decoration: none;
		transition: transform 0.2s var(--ease-spring);
	}
	.creator-avatar-bubble:hover {
		transform: scale(1.08);
	}
	.creator-avatar-bubble img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.avatar-letter {
		color: #ffffff;
		font-weight: 900;
		font-size: 1.1rem;
	}
	.avatar-follow-plus {
		position: absolute;
		bottom: -6px;
		left: 50%;
		transform: translateX(-50%);
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--aero-rose);
		border: 2px solid #000000;
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(244, 63, 94, 0.6);
		transition: transform 0.2s var(--ease-spring);
	}
	.avatar-follow-plus:hover {
		transform: translateX(-50%) scale(1.2);
	}
	.avatar-follow-plus .material-icons-round {
		font-size: 14px;
		font-weight: 900;
	}

	.action-bubble-btn {
		background: none;
		border: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		color: #ffffff;
		cursor: pointer;
		transition: transform 0.2s var(--ease-spring);
	}
	.action-bubble-btn:hover {
		transform: scale(1.1);
	}
	.action-bubble-btn:active {
		transform: scale(0.9);
	}
	.action-bubble-btn .icon-wrap {
		width: 44px;
		height: 44px;
		flex: 0 0 44px;
		min-width: 44px;
		min-height: 44px;
		border-radius: var(--radius-squircle);
		background: rgba(10, 16, 26, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
		transition: all 0.2s;
	}
	.action-bubble-btn .material-icons-round {
		font-size: 26px;
	}
	.action-bubble-btn.active .icon-wrap {
		background: rgba(244, 63, 94, 0.2);
		border-color: rgba(244, 63, 94, 0.5);
		color: var(--aero-rose);
		box-shadow: 0 0 20px rgba(244, 63, 94, 0.5);
	}
	.action-count,
	.action-label {
		font-size: 0.75rem;
		font-weight: 800;
		color: #ffffff;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
	}

	/* Spinning Vinyl Record */
	.spinning-disc-container {
		position: relative;
		width: 44px;
		height: 44px;
		margin-top: 4px;
	}
	.vinyl-disc {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: radial-gradient(circle, #1a1a1a 30%, #000000 70%);
		border: 2px solid rgba(255, 255, 255, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
	}
	.spinning-disc-container.playing .vinyl-disc {
		animation: spin-vinyl 4s linear infinite;
	}
	@keyframes spin-vinyl {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
	.disc-art {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		object-fit: cover;
	}
	.disc-note {
		font-size: 18px;
		color: var(--aero-sky);
	}
	.floating-note {
		position: absolute;
		top: -10px;
		right: 10px;
		font-size: 18px;
		color: var(--aero-sky);
		pointer-events: none;
		animation: float-note 1.8s ease-out forwards;
	}
	@keyframes float-note {
		0% {
			transform: translate(0, 0) scale(0.6) rotate(0deg);
			opacity: 1;
		}
		100% {
			transform: translate(-30px, -60px) scale(1.4) rotate(-30deg);
			opacity: 0;
		}
	}

	/* ── Precision Interactive Scrubber ───────────────────────────────────── */
	.progress-bar-interactive {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 12px;
		z-index: 30;
		cursor: pointer;
		display: flex;
		align-items: flex-end;
	}
	.track-bg {
		width: 100%;
		height: 3px;
		background: rgba(255, 255, 255, 0.2);
		position: relative;
		transition: height 0.15s ease;
	}
	.progress-bar-interactive.hovered .track-bg {
		height: 6px;
	}
	.track-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--aero-blue), var(--aero-sky), #ffffff);
		position: absolute;
		left: 0;
		top: 0;
	}
	.scrubber-head {
		position: absolute;
		top: 50%;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.9);
		transform: translate(-50%, -50%) scale(0);
		transition: transform 0.15s var(--ease-spring);
	}
	.progress-bar-interactive.hovered .scrubber-head {
		transform: translate(-50%, -50%) scale(1);
	}
	.time-preview-tooltip {
		position: absolute;
		bottom: 20px;
		transform: translateX(-50%);
		background: rgba(10, 16, 26, 0.85);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 4px 10px;
		border-radius: var(--radius-xs);
		color: #ffffff;
		font-size: 0.75rem;
		font-weight: 800;
		pointer-events: none;
		white-space: nowrap;
	}

	/* ── Comments Drawer ──────────────────────────────────────────────────── */
	.reels-comments-drawer {
		width: 440px;
		height: 100%;
		background: var(--bg-surface-solid, #0f172a);
		border-left: 1px solid var(--border-subtle);
		box-shadow: -10px 0 40px rgba(0, 0, 0, 0.35);
		z-index: 150;
		display: flex;
		flex-direction: column;
		position: absolute;
		right: 0;
		top: 0;
		color: var(--text-primary);
	}
	@media (max-width: 768px) {
		.reels-comments-drawer {
			width: 100%;
			height: 75vh;
			top: auto;
			bottom: 0;
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
			border-top: 1px solid var(--border-subtle);
			border-left: none;
		}
	}

	.drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--bg-surface);
	}
	.header-title-group {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.header-title-group h3 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 800;
		color: var(--text-primary);
		font-family: var(--font-display);
	}
	.title-icon {
		color: var(--accent-blue-base);
		font-size: 1.3rem;
	}
	.count-pill {
		background: rgba(var(--accent-blue-rgb), 0.12);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.2);
		padding: 2px 9px;
		border-radius: var(--radius-full);
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--accent-blue-base);
	}
	.drawer-close-btn {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s var(--ease-spring);
	}
	.drawer-close-btn:hover {
		background: var(--bg-surface-hover);
		color: var(--text-primary);
		border-color: rgba(var(--accent-blue-rgb), 0.4);
		transform: scale(1.05);
	}

	.comments-scroll-body {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.comments-loader,
	.comments-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		color: var(--text-muted);
		padding: 60px 0;
		text-align: center;
	}
	.comments-empty-state h4 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 700;
	}
	.comments-empty-state p {
		margin: 0;
		font-size: 0.85rem;
	}

	.comment-item-card {
		display: flex;
		gap: 12px;
	}
	.comment-user-avatar {
		width: 36px;
		height: 36px;
		flex: 0 0 36px;
		min-width: 36px;
		min-height: 36px;
		border-radius: var(--radius-squircle);
		background: var(--bg-surface-hover);
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		color: var(--text-primary);
		font-weight: 800;
		text-decoration: none;
	}
	.comment-user-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.comment-main-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.comment-author-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.comment-author-link {
		color: var(--text-primary);
		font-size: 0.85rem;
		font-weight: 800;
		text-decoration: none;
		transition: color 0.15s;
	}
	.comment-author-link:hover {
		color: var(--accent-blue-base);
	}
	.reply-badge {
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--accent-blue-base);
		background: rgba(var(--accent-blue-rgb), 0.12);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.25);
		padding: 1px 6px;
		border-radius: var(--radius-xs);
	}
	.comment-text-content {
		margin: 0;
		font-size: 0.92rem;
		color: var(--text-primary);
		line-height: 1.45;
		word-break: break-word;
	}
	.mention-pill {
		color: var(--accent-blue-base);
		font-weight: 700;
		text-decoration: none;
	}
	.comment-footer-actions {
		display: flex;
		gap: 12px;
		margin-top: 2px;
	}
	.btn-reply-action,
	.btn-delete-action {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.15s;
	}
	.btn-reply-action:hover {
		color: var(--accent-blue-base);
	}
	.btn-delete-action:hover {
		color: var(--aero-rose);
	}

	.comment-like-col {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.comment-heart-btn {
		background: none;
		border: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			transform 0.15s var(--ease-spring),
			color 0.15s;
	}
	.comment-heart-btn:hover {
		transform: scale(1.15);
	}
	.comment-heart-btn.liked {
		color: var(--aero-rose);
	}
	.comment-heart-btn .material-icons-round {
		font-size: 18px;
	}
	.like-num {
		font-size: 0.72rem;
		font-weight: 700;
		color: inherit;
	}

	.nested-replies-block {
		margin-left: 36px;
		padding-left: 12px;
		border-left: 2px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-top: 10px;
	}
	.nested-replies-block.deep {
		margin-left: 0;
		border-left: none;
		padding-left: 0;
	}

	/* Composer Container */
	.comment-composer-container {
		padding: 14px 18px 18px;
		border-top: 1px solid var(--border-subtle);
		background: var(--bg-surface-solid);
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
		display: flex;
		flex-direction: column;
		gap: 10px;
		position: relative;
		z-index: 10;
	}
	.reply-indicator-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 12px;
		background: rgba(var(--accent-sky-rgb), 0.12);
		border: 1px solid rgba(var(--accent-sky-rgb), 0.25);
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		color: var(--accent-blue-base);
		font-weight: 600;
	}
	.reply-indicator-banner strong {
		color: var(--text-primary);
		font-weight: 800;
	}
	.reply-indicator-banner button {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		padding: 2px;
		border-radius: var(--radius-xs);
		transition:
			color 0.15s,
			background 0.15s;
	}
	.reply-indicator-banner button:hover {
		color: var(--aero-rose);
		background: rgba(244, 63, 94, 0.15);
	}

	.quick-emojis-bar {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scrollbar-width: none;
		padding: 2px 0 4px;
	}
	.quick-emojis-bar::-webkit-scrollbar {
		display: none;
	}
	.quick-emoji-btn {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		font-size: 1.2rem;
		padding: 4px 10px;
		border-radius: var(--radius-md);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
		transition:
			transform 0.2s var(--ease-spring),
			background 0.15s,
			border-color 0.15s,
			box-shadow 0.15s;
		user-select: none;
	}
	.quick-emoji-btn:hover {
		transform: translateY(-2px) scale(1.18);
		background: var(--bg-surface-hover);
		border-color: rgba(var(--accent-sky-rgb), 0.45);
		box-shadow: 0 4px 12px rgba(var(--accent-blue-rgb), 0.18);
	}
	.quick-emoji-btn:active {
		transform: scale(0.95);
	}

	.comment-form {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.aero-comment-input {
		flex: 1;
		background: var(--bg-input);
		border: 1.5px solid var(--border-subtle);
		padding: 10px 18px;
		border-radius: var(--radius-full);
		color: var(--text-primary);
		font-size: 0.92rem;
		outline: none;
		box-shadow: var(--input-shadow-inner);
		transition:
			border-color 0.2s,
			box-shadow 0.2s,
			background 0.2s;
	}
	.aero-comment-input::placeholder {
		color: var(--text-muted);
		opacity: 0.75;
	}
	.aero-comment-input:focus {
		border-color: var(--accent-blue-base);
		background: var(--bg-surface-solid);
		box-shadow:
			0 0 0 3px rgba(var(--accent-blue-rgb), 0.18),
			var(--input-shadow-inner);
	}
	.aero-comment-send {
		width: 42px;
		height: 42px;
		flex: 0 0 42px;
		min-width: 42px;
		min-height: 42px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--aero-blue), var(--aero-sky));
		border: 1px solid rgba(255, 255, 255, 0.25);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(var(--accent-blue-rgb), 0.35);
		transition:
			transform 0.2s var(--ease-spring),
			box-shadow 0.2s,
			background 0.2s,
			color 0.2s,
			opacity 0.2s;
	}
	.aero-comment-send:not(:disabled):hover {
		transform: scale(1.08) translateY(-1px);
		box-shadow: 0 6px 20px rgba(var(--accent-blue-rgb), 0.5);
	}
	.aero-comment-send:not(:disabled):active {
		transform: scale(0.94);
	}
	.aero-comment-send:disabled {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		color: var(--text-muted);
		opacity: 0.7;
		box-shadow: none;
		cursor: not-allowed;
	}
	.login-to-comment-box {
		padding: 14px;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.88rem;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.login-btn-link {
		color: var(--accent-blue-base);
		font-weight: 800;
		text-decoration: none;
	}
	.login-btn-link:hover {
		text-decoration: underline;
		color: var(--accent-blue-light);
	}

	.mobile-comments-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
		z-index: 90;
	}
	@media (min-width: 769px) {
		.mobile-comments-backdrop {
			display: none;
		}
	}

	/* ── Modals & Backdrop Blur ───────────────────────────────────────────── */
	.modal-backdrop-blur {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.share-card-modal,
	.options-card-modal,
	.shortcuts-card-modal,
	.confirm-dialog-card {
		background: rgba(15, 23, 42, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-lg);
		padding: 24px;
		width: 100%;
		max-width: 440px;
		color: #ffffff;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
	}

	.share-modal-header,
	.shortcuts-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}
	.share-modal-header h3,
	.shortcuts-header h3 {
		margin: 0;
		font-weight: 800;
		font-size: 1.15rem;
	}

	.btn-close-round {
		background: rgba(255, 255, 255, 0.1);
		border: none;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		color: #ffffff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Share Grid */
	.share-grid-actions {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
	}
	.share-platform-btn {
		background: none;
		border: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		color: #ffffff;
		cursor: pointer;
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 700;
	}
	.platform-icon-circle {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.2s var(--ease-spring);
	}
	.share-platform-btn:hover .platform-icon-circle {
		transform: scale(1.12);
	}
	.platform-icon-circle.native {
		background: linear-gradient(135deg, #1b85f3, #2eb4ff);
	}
	.platform-icon-circle.copy {
		background: #334155;
	}
	.platform-icon-circle.whatsapp {
		background: #25d366;
	}
	.platform-icon-circle.telegram {
		background: #0088cc;
	}
	.platform-icon-circle.twitter {
		background: #000000;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	/* ── TikTok 3-Dots Card (Image 3) & Right-Click Context Menu (Image 4) ── */
	.context-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 2500;
		background: transparent;
	}

	.tiktok-menu-card,
	.tiktok-context-menu {
		background: rgba(18, 22, 34, 0.96);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-lg, 20px);
		padding: 12px 10px;
		width: 320px;
		max-width: calc(100vw - 32px);
		color: #ffffff;
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.85),
			0 0 25px rgba(27, 133, 243, 0.15);
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.tiktok-context-menu {
		position: fixed;
		z-index: 2600;
	}

	.tt-speed-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px 10px 10px;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.06);
		margin-bottom: 4px;
	}
	.tt-speed-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.tt-row-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9rem;
		font-weight: 700;
		color: #ffffff;
		white-space: nowrap;
	}
	.tt-row-label .material-icons-round {
		font-size: 20px;
		color: var(--aero-sky);
	}
	.tt-speed-current-badge {
		font-size: 0.76rem;
		font-weight: 800;
		color: var(--aero-sky);
		background: rgba(46, 180, 255, 0.12);
		padding: 2px 8px;
		border-radius: 999px;
		border: 1px solid rgba(46, 180, 255, 0.25);
		white-space: nowrap;
	}
	.tt-speed-pills-bar {
		display: flex;
		width: 100%;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 3px;
		gap: 2px;
		box-sizing: border-box;
	}
	.tt-speed-pill-btn {
		flex: 1 1 0;
		min-width: 0;
		padding: 6px 0;
		border-radius: 7px;
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.65);
		font-size: 0.75rem;
		font-weight: 700;
		text-align: center;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}
	.tt-speed-pill-btn:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.12);
	}
	.tt-speed-pill-btn.active {
		background: #ffffff;
		color: #000000;
		font-weight: 900;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
	}

	.tt-menu-item {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		border-radius: 12px;
		background: none;
		border: none;
		color: #ffffff;
		cursor: pointer;
		font-size: 0.92rem;
		font-weight: 600;
		text-align: left;
		transition: all 0.15s ease;
	}
	.tt-menu-item:hover {
		background: rgba(255, 255, 255, 0.1);
		transform: translateX(2px);
	}
	.tt-menu-item.danger {
		color: var(--aero-rose);
	}
	.tt-menu-item.danger:hover {
		background: rgba(244, 63, 94, 0.15);
	}
	.tt-item-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.tt-item-left .material-icons-round {
		font-size: 20px;
		color: #cbd5e1;
	}
	.tt-menu-item.danger .tt-item-left .material-icons-round {
		color: var(--aero-rose);
	}
	.tt-item-right {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--aero-sky);
		font-size: 0.82rem;
		font-weight: 700;
	}
	.tt-item-right .arrow-icon {
		font-size: 16px;
	}
	.tt-menu-divider {
		border: none;
		height: 1px;
		background: rgba(255, 255, 255, 0.1);
		margin: 5px 4px;
	}

	/* Shortcuts Grid */
	.shortcuts-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.shortcut-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
	}
	.shortcut-item kbd {
		background: rgba(255, 255, 255, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.3);
		padding: 3px 8px;
		border-radius: 6px;
		font-weight: 800;
		font-size: 0.8rem;
	}

	/* Confirm Dialog */
	.confirm-dialog-card {
		text-align: center;
		max-width: 360px;
	}
	.danger-icon-circle {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: rgba(244, 63, 94, 0.15);
		color: var(--aero-rose);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 16px;
	}
	.confirm-dialog-card h4 {
		margin: 0 0 8px;
		font-size: 1.15rem;
	}
	.confirm-dialog-card p {
		margin: 0 0 20px;
		font-size: 0.88rem;
		color: #94a3b8;
	}
	.confirm-actions-row {
		display: flex;
		gap: 12px;
	}
	.confirm-actions-row button {
		flex: 1;
		padding: 10px;
		border-radius: var(--radius-sm);
		font-weight: 800;
		cursor: pointer;
		border: none;
	}
	.btn-cancel {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}
	.btn-confirm-delete {
		background: var(--aero-rose);
		color: #ffffff;
	}

	/* ── Light Theme Adaptations ─────────────────────────────────────────── */
	:global([data-theme='light']) .share-card-modal,
	:global([data-theme='light']) .options-card-modal,
	:global([data-theme='light']) .shortcuts-card-modal,
	:global([data-theme='light']) .confirm-dialog-card {
		background: rgba(255, 255, 255, 0.95);
		border-color: rgba(14, 165, 233, 0.25);
		color: #0f172a;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
	}
	:global([data-theme='light']) .btn-close-round {
		background: rgba(0, 0, 0, 0.06);
		color: #0f172a;
	}
	:global([data-theme='light']) .btn-close-round:hover {
		background: rgba(0, 0, 0, 0.12);
	}
	:global([data-theme='light']) .shortcut-item kbd {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.15);
		color: #0f172a;
	}
	:global([data-theme='light']) .btn-cancel {
		background: rgba(0, 0, 0, 0.07);
		color: #0f172a;
	}
	:global([data-theme='light']) .confirm-dialog-card p {
		color: #475569;
	}
</style>
