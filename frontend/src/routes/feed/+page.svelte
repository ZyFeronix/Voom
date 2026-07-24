<script>
	import { fade, scale, slide } from 'svelte/transition';
	import { backOut, cubicInOut, expoOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { ensureVidstack } from '$lib/utils/vidstack.js';
	import { page } from '$app/state';

	import {
		feed as feedApi,
		users as usersApi,
		stories as storiesApi,
		posts as postsApi,
		reels as reelsApi
	} from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import PostCard from '$lib/components/PostCard.svelte';
	import QuickChatWidget from '$lib/components/QuickChatWidget.svelte';
	import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
	import KlipyPicker from '$lib/components/KlipyPicker.svelte';
	import HashtagTextarea from '$lib/components/HashtagTextarea.svelte';
	import CheckinButton from '$lib/components/gamification/CheckinButton.svelte';
	import { compressImage } from '$lib/utils/imageCompression.js';
	import VoiceRecorder from '$lib/components/VoiceRecorder.svelte';
	import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';

	// ── Runes State ──────────────────────────────────────────────────────────
	let { data: _data } = $props();
	const parseBool = (val) => val !== '0' && val !== false && val !== 'false';
	let settings = $derived(page.data.globalSettings || {});
	let storiesEnabled = $derived(parseBool(settings.stories_enabled ?? true));
	let gamificationEnabled = $derived(parseBool(settings.gamification_enabled ?? true));
	let platformMode = $derived(settings.platform_mode || 'custom');

	// Placeholder del composer adaptado al modo de plataforma activo.
	const MODE_PLACEHOLDERS = {
		twitter: '¿Qué está pasando?!',
		threads: 'Empieza un hilo...',
		instagram: 'Comparte un momento...',
		facebook: '¿Qué estás pensando?',
		custom: '¿Qué está pasando en tu mundo virtual hoy?'
	};
	let composerPlaceholder = $derived(MODE_PLACEHOLDERS[platformMode] || MODE_PLACEHOLDERS.custom);
	let scrollY = $state(0);
	let lastScrollY = $state(0);
	let innerWidth = $state(1024);
	let scrollDirection = $state('up'); // 'up' or 'down'

	function handleWindowScroll() {
		if (Math.abs(scrollY - lastScrollY) < 15) return; // threshold to prevent jitter
		if (scrollY > lastScrollY && scrollY > 100) {
			scrollDirection = 'down';
		} else if (scrollY < lastScrollY) {
			scrollDirection = 'up';
		}
		lastScrollY = scrollY;
	}

	let posts = $state([]);
	let suggestedCreators = $state([]);
	let activeStories = $state([]);
	let trendingTags = $state([]);

	let loading = $state(true);
	let postsLoading = $state(false);
	let cursor = $state('');
	let hasMore = $state(true);
	let newPostText = $state('');
	let posting = $state(false);
	let postError = $state('');
	let globalFeedMode = $state('intelligent');
	let userWeights = $state({
		interests: 50,
		interactions: 40,
		social: 30,
		popularity: 20,
		recency: 70,
		diversity: 15
	});

	// Tabs and attachments
	let activeTab = $state('post'); // 'post', 'story', 'reel'
	let attachedGif = $state('');
	let attachedMusic = $state(null);
	let pollAttached = $state(false);
	let pollQuestion = $state('');
	let pollOptions = $state(['', '']);

	// Quick Story state
	let quickStoryFileInput = $state(null);
	let quickStoryFile = $state(null);
	let quickStoryPreview = $state(null);
	let quickStoryBgColor = $state('#00E5FF');
	let quickStoryText = $state('');
	let quickStoryTextColor = $state('#FFFFFF');
	let publishingStory = $state(false);

	function safeSlide(node, params) {
		if (!node.offsetParent) return { duration: 0 };
		return slide(node, params);
	}

	// Quick Reel state
	let quickReelFileInput = $state(null);
	let quickReelFile = $state(null);
	let quickReelPreview = $state(null);
	let quickReelCaption = $state('');
	let quickReelSpeed = $state('1x');
	let quickReelFilter = $state('none');
	let publishingReel = $state(false);

	// Quick Post Modals & Pickers
	let showEmojis = $state(false);
	let showPollModal = $state(false);
	let showMusicModal = $state(false);
	let showGifModal = $state(false);
	let showMediaModal = $state(false);
	let showVoiceModal = $state(false);
	let attachedVoiceNote = $state(null);

	let fileInput = $state(null);
	let selectedFiles = $state([]);

	// Story Creation
	let storyFileInput = $state(null);
	let uploadingStory = $state(false);

	// Story Caption Modal State
	let showStoryCaptionModal = $state(false);
	let pendingStoryFile = $state(null);
	let storyCaptionText = $state('');

	// Story Viewer Modal
	let selectedStoryUser = $state(null);
	let selectedStoryIndex = $state(0);
	let storyProgress = $state(0);
	let storyInterval = null;
	let storyPaused = $state(false);
	let storyElapsed = 0; // ms transcurridos del item actual
	let storyDuration = 5000; // duración total del item actual (ms)
	let storyVideoEl = $state(null);
	let showDeleteStoryConfirm = $state(false);

	// Gamification Check-in State
	let checkinState = $state({
		canCheckin: false,
		nextCheckin: null,
		streak: 0,
		loaded: false
	});
	let checkinLoading = $state(false);

	// ── Intersection Observer (Scroll Infinito) ──────────────────────────────
	function infiniteScroll(node) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !postsLoading && hasMore) {
					loadPosts(false);
				}
			},
			{ rootMargin: '400px' }
		);

		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	let pollInterval = null;

	// ── Lifecycle ────────────────────────────────────────────────────────────
	onMount(() => {
		loading = true;
		Promise.all([
			loadPreferences().then(() => loadPosts(true)),
			loadSuggestions(),
			loadStories(),
			loadCheckinStatus(),
			loadTrendingTags()
		])
			.catch((err) => console.error('Error on mount:', err))
			.finally(() => {
				loading = false;
				// Start smart polling
				pollInterval = setInterval(pollNewPosts, 15000);
			});

		// Carga diferida de vidstack en paralelo a los datos del feed (fire-and-forget):
		// va a su propio chunk (vendor-vidstack) y sus custom elements (previews de story-tray
		// y compositor) se "upgradean" retroactivamente al resolver, sin bloquear el feed.
		ensureVidstack().catch((err) => console.error('vidstack lazy load failed:', err));

		// Al volver a foco tras estar oculta, dispara un poll inmediato para alcanzar posts nuevos.
		const onVisibilityChange = () => {
			if (!document.hidden) pollNewPosts();
		};
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			clearInterval(storyInterval);
			clearInterval(pollInterval);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	// ── Functions ────────────────────────────────────────────────────────────
	async function loadPreferences() {
		try {
			const res = await feedApi.preferences.get();
			if (res.preferences) {
				globalFeedMode = res.preferences.feed_mode || 'intelligent';
				userWeights = res.preferences.weights || {
					interests: 50,
					interactions: 40,
					social: 30,
					popularity: 20,
					recency: 70,
					diversity: 15
				};
			}
		} catch (err) {
			console.warn('Failed to load preferences:', err);
		}
	}

	let updatingWeights = $state(false);

	async function updateWeightsAndReload() {
		if (updatingWeights) return;
		updatingWeights = true;
		try {
			const payload = {
				feed_mode: globalFeedMode,
				w_interests: userWeights.interests,
				w_interactions: userWeights.interactions,
				w_social: userWeights.social,
				w_popularity: userWeights.popularity,
				w_recency: userWeights.recency,
				w_diversity: userWeights.diversity
			};
			await feedApi.preferences.update(payload);
			await loadPosts(true);
		} catch (err) {
			console.error('Error updating weights:', err);
		} finally {
			updatingWeights = false;
		}
	}

	async function loadPosts(reset = false) {
		if (postsLoading) return;
		postsLoading = true;
		if (reset) {
			cursor = '';
			hasMore = true;
			// Note: We don't empty the posts array here so that Svelte can diff
			// the old and new arrays when the data arrives, causing a fluid crossfade/slide.
		}

		try {
			const params = {
				limit: 10,
				algo: globalFeedMode
			};
			if (cursor) params.cursor = cursor;

			const data = await feedApi.get(params);

			const newPosts = data.posts || [];
			// If no posts came back, we're definitely at the end regardless of API flag
			hasMore = newPosts.length > 0 ? !!data.has_more : false;

			if (reset) {
				posts = newPosts;
			} else {
				// Filter out duplicates that might occur due to randomized feed scoring
				const existingIds = new Set(posts.map((p) => p.id));
				const uniqueNewPosts = newPosts.filter((p) => !existingIds.has(p.id));

				// If we received posts but they were ALL duplicates, we've exhausted unique content
				if (newPosts.length > 0 && uniqueNewPosts.length === 0) {
					hasMore = false;
				} else {
					posts = [...posts, ...uniqueNewPosts];
				}
			}
			cursor = data.next_cursor || '';
		} catch (err) {
			console.error('Error loading posts:', err);
			hasMore = false; // On error, stop trying
		} finally {
			postsLoading = false;
		}
	}

	async function pollNewPosts() {
		// Skip polling cuando la pestaña está oculta: ahorra CPU/red en segundo plano.
		// Al volver a ser visible, onVisibilityChange dispara un poll inmediato para "alcanzar".
		if (document.hidden) return;
		if (postsLoading || posts.length === 0) return;
		try {
			const maxId = Math.max(...posts.map((p) => p.id));
			const params = { limit: 10, algo: globalFeedMode, since_id: maxId };
			const data = await feedApi.get(params);

			const newPosts = data.posts || [];
			if (newPosts.length > 0) {
				// Filter out any duplicates just in case
				const existingIds = new Set(posts.map((p) => p.id));
				const uniqueNewPosts = newPosts.filter((p) => !existingIds.has(p.id));

				if (uniqueNewPosts.length > 0) {
					// Prepend new posts fluidly
					posts = [...uniqueNewPosts, ...posts];
				}
			}
		} catch (err) {
			console.error('Error polling new posts:', err);
		}
	}

	async function loadSuggestions() {
		try {
			const data = await usersApi.suggestedCreators();
			suggestedCreators = data.users || [];
		} catch (err) {
			console.error('Error loading suggestions:', err);
		}
	}

	async function loadTrendingTags() {
		try {
			const data = await feedApi.trendingTags();
			// Map 'name' to 'tag' for frontend display
			trendingTags = (data.tags || []).map((t) => ({ tag: t.name, posts: t.post_count }));
		} catch (err) {
			console.error('Error loading trending tags:', err);
		}
	}

	async function loadStories() {
		try {
			const data = await storiesApi.feed();
			activeStories = data.stories || [];
		} catch (err) {
			console.error('Error loading stories:', err);
		}
	}

	async function loadCheckinStatus() {
		if (!authStore.isAuthenticated) return;
		try {
			const res = await fetch('/api/gamification/checkin', {
				headers: { Authorization: `Bearer ${authStore.token}` }
			});
			if (res.ok) {
				const data = await res.json();
				checkinState = { ...data, loaded: true };
			}
		} catch (err) {
			console.error('Error loading checkin status:', err);
		}
	}

	async function handleCheckin() {
		if (checkinLoading) return;
		checkinLoading = true;
		try {
			const res = await fetch('/api/gamification/checkin', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authStore.token}`,
					'Content-Type': 'application/json'
				}
			});
			const data = await res.json();
			if (data.success) {
				checkinState = {
					canCheckin: false,
					nextCheckin: data.nextCheckinAt,
					streak: data.newStreak,
					loaded: true
				};
				if (data.leveledUp) {
					alert(`¡Felicidades! Has subido al nivel ${data.newLevel}`);
				}
			} else {
				alert(data.message || 'Error en check-in');
			}
		} catch (_err) {
			alert('Error de conexión al procesar check-in');
		} finally {
			checkinLoading = false;
		}
	}

	function handlePostDeleted(id) {
		posts = posts.filter((p) => p.id !== id);
	}

	async function handleCreatePost(e) {
		e.preventDefault();
		if (
			!newPostText.trim() &&
			selectedFiles.length === 0 &&
			!pollAttached &&
			!attachedVoiceNote &&
			!attachedGif
		)
			return;

		posting = true;
		postError = '';

		try {
			let uploadedMedia = [];
			if (selectedFiles.length > 0 || attachedVoiceNote) {
				const fd = new FormData();
				selectedFiles.forEach((item) => fd.append('media', item.file));
				if (attachedVoiceNote) {
					fd.append('media', attachedVoiceNote, 'voice_note.webm');
				}
				const res = await postsApi.uploadMedia(fd);
				uploadedMedia = res.media || [];
				if (!res.media && res.url) {
					uploadedMedia = [res]; // fallback format
				}
			}

			let finalBody = newPostText.trim();
			if (attachedGif) {
				uploadedMedia.push({ url: attachedGif, type: 'image' });
			}
			if (attachedMusic) {
				finalBody += `\n🎵 Escuchando: ${attachedMusic.title} - ${attachedMusic.artist}`;
			}

			const payload = {
				body: finalBody,
				media_urls: uploadedMedia
			};

			if (pollAttached && pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2) {
				payload.poll = {
					question: pollQuestion.trim(),
					options: pollOptions.filter((o) => o.trim())
				};
			}

			await postsApi.create(payload);
			if (posts.length === 0) {
				await loadPosts(true);
			} else {
				await pollNewPosts();
			}

			// Reset
			newPostText = '';
			selectedFiles.forEach((item) => {
				if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
			});
			selectedFiles = [];
			attachedGif = '';
			attachedMusic = null;
			pollAttached = false;
			pollQuestion = '';
			pollOptions = ['', ''];
			showMusicModal = false;
			showPollModal = false;
			showEmojis = false;
			showMediaModal = false;
			showVoiceModal = false;
			attachedVoiceNote = null;
		} catch (err) {
			postError = err?.message ?? 'Error al publicar. Inténtalo de nuevo.';
		} finally {
			posting = false;
		}
	}

	function toggleMediaPanel() {
		showMediaModal = !showMediaModal;
		if (showMediaModal) {
			showGifModal = false;
			showMusicModal = false;
			showPollModal = false;
			showEmojis = false;
			showVoiceModal = false;
		}
	}

	function toggleVoicePanel() {
		showVoiceModal = !showVoiceModal;
		if (showVoiceModal) {
			showMediaModal = false;
			showGifModal = false;
			showMusicModal = false;
			showPollModal = false;
			showEmojis = false;
		}
	}

	function toggleGifPanel() {
		showGifModal = !showGifModal;
		if (showGifModal) {
			showMediaModal = false;
			showMusicModal = false;
			showPollModal = false;
			showEmojis = false;
			showVoiceModal = false;
		}
	}

	function toggleMusicPanel() {
		showMusicModal = !showMusicModal;
		if (showMusicModal) {
			showMediaModal = false;
			showGifModal = false;
			showPollModal = false;
			showEmojis = false;
			showVoiceModal = false;
		}
	}

	function togglePollPanel() {
		showPollModal = !showPollModal;
		if (showPollModal) {
			showMediaModal = false;
			showGifModal = false;
			showMusicModal = false;
			showEmojis = false;
			showVoiceModal = false;
		}
	}

	function toggleEmojiPanel() {
		showEmojis = !showEmojis;
		if (showEmojis) {
			showMediaModal = false;
			showGifModal = false;
			showMusicModal = false;
			showPollModal = false;
			showVoiceModal = false;
		}
	}

	function insertEmoji(emoji) {
		const textarea = document.getElementById('new_post_text');
		if (textarea) {
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			newPostText = newPostText.substring(0, start) + emoji + newPostText.substring(end);
			setTimeout(() => {
				textarea.focus();
				textarea.setSelectionRange(start + emoji.length, start + emoji.length);
			}, 0);
		} else {
			newPostText += emoji;
		}
	}

	function handleKeyDown(e) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleCreatePost(e);
		}
	}

	async function handleFileSelect(e) {
		const files = Array.from(e.target.files);
		// Comprimir todas las imagenes concurrentemente
		const processed = await Promise.all(
			files.map(async (file) => {
				let finalFile = file;
				try {
					finalFile = await compressImage(file);
				} catch (err) {
					console.error('Error compressing image:', err); // fallback al original si falla
				}
				return { file: finalFile, previewUrl: URL.createObjectURL(finalFile) };
			})
		);
		selectedFiles = [...selectedFiles, ...processed];
		showMediaModal = false;
		if (e.target) e.target.value = '';
	}

	function removeSelectedFile(idx) {
		const item = selectedFiles[idx];
		if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
		selectedFiles = selectedFiles.filter((_, i) => i !== idx);
	}

	async function handleQuickStoryFileSelect(e) {
		const file = e.target.files[0];
		if (!file) return;
		try {
			quickStoryFile = await compressImage(file);
		} catch (err) {
			console.error('Error compressing image:', err);
			quickStoryFile = file;
		}
		quickStoryPreview = URL.createObjectURL(quickStoryFile);
	}

	function handleQuickReelFileSelect(e) {
		const file = e.target.files[0];
		if (!file) return;
		if (!file.type.startsWith('video/')) {
			alert('Solo se permiten archivos de video para reels.');
			return;
		}
		quickReelFile = file;
		quickReelPreview = URL.createObjectURL(file);
	}

	async function handleCreateQuickStory(e) {
		e.preventDefault();
		if (!quickStoryFile && !quickStoryText) return;
		publishingStory = true;
		postError = '';

		try {
			const fd = new FormData();
			if (quickStoryFile) {
				fd.append('media', quickStoryFile);
			} else {
				throw new Error('Carga una foto o video para tu historia.');
			}
			fd.append('background_color', quickStoryBgColor);

			let elements = [];
			if (quickStoryText) {
				elements.push({ type: 'text', content: quickStoryText, color: quickStoryTextColor });
			}
			fd.append('caption', quickStoryText + '\n[METADATA]' + JSON.stringify(elements));

			await storiesApi.create(fd);

			// Reset
			quickStoryFile = null;
			quickStoryPreview = null;
			quickStoryText = '';
			activeTab = 'post';
			await loadStories();
		} catch (err) {
			postError = err.message || 'Error al crear historia.';
		} finally {
			publishingStory = false;
		}
	}

	async function handleCreateQuickReel(e) {
		e.preventDefault();
		if (!quickReelFile) return;
		publishingReel = true;
		postError = '';

		try {
			const fd = new FormData();
			fd.append('video', quickReelFile);
			fd.append('caption', quickReelCaption);

			let elements = [
				{ type: 'filter', filterId: quickReelFilter },
				{ type: 'speed', speedValue: quickReelSpeed }
			];
			fd.append('elements', JSON.stringify(elements));

			await reelsApi.create(fd);

			// Reset
			quickReelFile = null;
			quickReelPreview = null;
			quickReelCaption = '';
			activeTab = 'post';
			alert('¡Reel publicado con éxito!');
		} catch (err) {
			postError = err.message || 'Error al publicar reel.';
		} finally {
			publishingReel = false;
		}
	}

	async function handleStoryUpload(e) {
		const file = e.target.files[0];
		if (!file) return;

		try {
			pendingStoryFile = await compressImage(file);
		} catch (err) {
			console.error('Error compressing image:', err);
			pendingStoryFile = file;
		}

		if (storyFileInput) storyFileInput.value = '';
	}

	async function submitStoryCaption() {
		if (!pendingStoryFile) return;
		showStoryCaptionModal = false;
		uploadingStory = true;
		try {
			const fd = new FormData();
			fd.append('media', pendingStoryFile);
			fd.append('caption', storyCaptionText);
			fd.append('background_color', '#00E5FF');

			await storiesApi.create(fd);
			await loadStories();
		} catch (err) {
			alert('Error al crear la historia: ' + err.message);
		} finally {
			uploadingStory = false;
			pendingStoryFile = null;
			storyCaptionText = '';
		}
	}

	function cancelStoryCaption() {
		showStoryCaptionModal = false;
		pendingStoryFile = null;
		storyCaptionText = '';
	}

	// ── Story Viewer Functions ───────────────────────────────────────────────
	function openStory(userStory) {
		selectedStoryUser = userStory;
		selectedStoryIndex = 0;
		storyProgress = 0;
		startStoryTimer();
	}

	function startStoryTimer(durationOverride = null) {
		clearInterval(storyInterval);
		storyPaused = false;
		const item = selectedStoryUser?.items[selectedStoryIndex];
		if (!item) return;

		if (item.media_type === 'video' && !durationOverride) {
			storyProgress = 0;
			storyElapsed = 0;
			return;
		}

		storyDuration = durationOverride || 5000;
		storyElapsed = 0;
		storyProgress = 0;
		runStoryInterval();
	}

	function runStoryInterval() {
		clearInterval(storyInterval);
		const stepTime = 50;

		storyInterval = setInterval(() => {
			storyElapsed += stepTime;
			storyProgress = (storyElapsed / storyDuration) * 100;

			if (storyElapsed >= storyDuration) {
				nextStoryItem();
			}
		}, stepTime);
	}

	function pauseStoryTimer() {
		if (storyPaused || !selectedStoryUser) return;
		storyPaused = true;
		clearInterval(storyInterval);
		storyInterval = null;
		if (storyVideoEl) storyVideoEl.pause();
	}

	function resumeStoryTimer() {
		if (!storyPaused || !selectedStoryUser) return;
		storyPaused = false;
		const item = selectedStoryUser?.items[selectedStoryIndex];
		if (item?.media_type === 'video') {
			storyVideoEl?.play?.();
			return;
		}
		runStoryInterval();
	}

	function nextStoryItem() {
		if (!selectedStoryUser) return;
		if (selectedStoryIndex < selectedStoryUser.items.length - 1) {
			selectedStoryIndex += 1;
			storyProgress = 0;
			startStoryTimer();
		} else {
			closeStory();
		}
	}

	function prevStoryItem() {
		if (!selectedStoryUser) return;
		if (selectedStoryIndex > 0) {
			selectedStoryIndex -= 1;
			storyProgress = 0;
			startStoryTimer();
		} else {
			storyProgress = 0;
			startStoryTimer();
		}
	}

	function closeStory() {
		selectedStoryUser = null;
		showDeleteStoryConfirm = false;
		storyPaused = false;
		clearInterval(storyInterval);
	}

	// ── Tap vs. mantener presionado en las zonas del visor ──────────────────
	let storyHoldTimeout = null;
	let storyHeldPaused = false; // true cuando el hold ya disparó la pausa
	const STORY_HOLD_MS = 200; // umbral para distinguir tap de mantener presionado

	let storyPointerActive = false; // hay un gesto de pausa/tap en curso

	function onStoryZonePointerDown(e) {
		// Solo click izquierdo del ratón (button 0) o toque/lápiz.
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		e.currentTarget.setPointerCapture?.(e.pointerId);
		storyPointerActive = true;
		storyHeldPaused = false;
		clearTimeout(storyHoldTimeout);
		storyHoldTimeout = setTimeout(() => {
			storyHeldPaused = true;
			pauseStoryTimer();
		}, STORY_HOLD_MS);
	}

	function onStoryZonePointerUp(e) {
		if (!storyPointerActive) return;
		storyPointerActive = false;
		clearTimeout(storyHoldTimeout);
		const dir = e.currentTarget.getAttribute('aria-label') === 'Item anterior' ? 'prev' : 'next';
		if (storyHeldPaused) {
			// Se soltó tras mantener presionado: reanudar sin navegar.
			resumeStoryTimer();
		} else {
			// Tap/click corto: navegar.
			if (dir === 'prev') prevStoryItem();
			else nextStoryItem();
		}
		storyHeldPaused = false;
	}

	function onStoryZonePointerCancel() {
		if (!storyPointerActive) return;
		storyPointerActive = false;
		clearTimeout(storyHoldTimeout);
		if (storyHeldPaused) resumeStoryTimer();
		storyHeldPaused = false;
	}

	function promptDeleteStory(e) {
		if (e) {
			e.stopPropagation();
			e.preventDefault();
		}
		clearInterval(storyInterval); // pause
		showDeleteStoryConfirm = true;
	}

	function cancelDeleteStory() {
		showDeleteStoryConfirm = false;
		startStoryTimer(); // resume
	}

	async function deleteCurrentStory() {
		if (!selectedStoryUser || !selectedStoryUser.items[selectedStoryIndex]) return;
		const storyId = selectedStoryUser.items[selectedStoryIndex].id;

		showDeleteStoryConfirm = false;

		try {
			clearInterval(storyInterval); // pause while deleting
			await storiesApi.delete(storyId);

			// Update local state by removing the item
			selectedStoryUser.items.splice(selectedStoryIndex, 1);

			if (selectedStoryUser.items.length === 0) {
				// User has no stories left
				activeStories = activeStories.filter((u) => u.username !== selectedStoryUser.username);
				closeStory();
			} else {
				// Show previous or next
				if (selectedStoryIndex >= selectedStoryUser.items.length) {
					selectedStoryIndex = selectedStoryUser.items.length - 1;
				}
				storyProgress = 0;
				startStoryTimer();
			}
		} catch (err) {
			alert('Error al eliminar la historia: ' + err.message);
			startStoryTimer(); // resume
		}
	}

	async function toggleFollowSuggested(username) {
		try {
			const idx = suggestedCreators.findIndex((c) => c.username === username);
			if (idx === -1) return;

			const isFollowing = suggestedCreators[idx].is_following;
			if (isFollowing) {
				await usersApi.unfollow(username);
				suggestedCreators[idx].is_following = false;
				suggestedCreators[idx].follower_count = Math.max(
					0,
					(suggestedCreators[idx].follower_count || 0) - 1
				);
			} else {
				await usersApi.follow(username);
				suggestedCreators[idx].is_following = true;
				suggestedCreators[idx].follower_count = (suggestedCreators[idx].follower_count || 0) + 1;
			}
		} catch (err) {
			console.error('Error toggling follow:', err);
		}
	}
</script>

<svelte:head>
	<title>Feed - VSocial</title>
</svelte:head>

<svelte:window bind:scrollY bind:innerWidth onscroll={handleWindowScroll} />

<div class="feed-shell mx-auto px-4 lg:px-8 py-6">
	<div class="feed-grid grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
		<!-- Left Column (suggested creators, static link to create, algorithm filter) -->
		<div class="feed-col-left hidden lg:block lg:col-span-3">
			<div class="sticky transition-all duration-300 ease-in-out" style="top: 70px;">
				<!-- Algoritmo Toggle Card (Smart Scroll UP) -->
				{#if scrollDirection === 'up' && innerWidth >= 1024}
					<div transition:safeSlide={{ duration: 400, easing: cubicInOut }} class="mb-3">
						<div class="glass-panel p-3">
							<div class="flex flex-col gap-0">
								{#if globalFeedMode === 'retention'}
									<button
										class="feed-filter-btn flex items-center gap-2 w-full p-2 rounded-xl text-left border-none font-semibold transition"
										style="background: var(--grad-primary); color: #FFF; box-shadow: 0 4px 15px rgba(0, 119, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.3);"
									>
										<span class="material-icons-round text-[18px]">auto_awesome</span>
										<span class="text-sm">Inteligente</span>
									</button>
								{:else if globalFeedMode === 'radar'}
									<button
										class="feed-filter-btn flex items-center gap-2 w-full p-2 rounded-xl text-left border-none font-semibold transition"
										style="background: var(--grad-primary); color: #FFF; box-shadow: 0 4px 15px rgba(0, 119, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.3);"
									>
										<span class="material-icons-round text-[18px]">schedule</span>
										<span class="text-sm">Línea de Tiempo</span>
									</button>
								{:else}
									<div
										class="feed-filter-btn flex items-center justify-between w-full p-2.5 rounded-xl border-none"
										style="background: var(--grad-primary); box-shadow: 0 4px 14px rgba(46,134,232,0.28), inset 0 1px 1px rgba(255,255,255,0.2);"
									>
										<div class="flex items-center gap-2 text-white">
											<span class="material-icons-round text-[16px]">tune</span>
											<span class="text-xs font-bold tracking-wide uppercase">A Tu Elección</span>
										</div>
										<span
											class="text-[9px] font-mono text-white opacity-90 px-1.5 py-0.5 rounded border border-white/20"
											style="background: rgba(255,255,255,0.15);">ACTIVO</span
										>
									</div>
									<div class="flex flex-col gap-1.5 mt-3">
										{#each [{ id: 'interests', label: 'Intereses', color: '#1B85F3' }, { id: 'interactions', label: 'Interacción', color: '#10B981' }, { id: 'social', label: 'Social', color: '#8B5CF6' }, { id: 'popularity', label: 'Popularidad', color: '#F59E0B' }, { id: 'recency', label: 'Novedad', color: '#EF4444' }, { id: 'diversity', label: 'Diversidad', color: '#EC4899' }] as stat}
											<div class="flex flex-col gap-0.5 group">
												<div
													class="flex justify-between items-center text-[10px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider px-1"
												>
													<span class="flex items-center gap-1.5"
														><span
															class="w-1.5 h-1.5 rounded-full"
															style="background: {stat.color}; box-shadow: 0 0 5px {stat.color};"
														></span>
														{stat.label}</span
													>
													<span
														class="text-slate-500 group-hover:text-slate-800 dark:text-white/60 dark:group-hover:text-white transition-colors duration-300 font-mono shadow-glow text-[9px]"
														>{userWeights[stat.id]}%</span
													>
												</div>
												<div
													class="relative w-full h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-black/25 border border-slate-300 dark:border-white/5 shadow-inner"
												>
													<div
														class="absolute top-0 left-0 h-full rounded-full transition-all duration-75 ease-out"
														style="width: {userWeights[
															stat.id
														]}%; background: {stat.color}; box-shadow: 0 0 10px {stat.color}, inset 0 1px 1px rgba(255,255,255,0.4);"
													></div>
													<input
														type="range"
														min="0"
														max="100"
														value={userWeights[stat.id]}
														oninput={(e) => (userWeights[stat.id] = parseInt(e.target.value))}
														onchange={updateWeightsAndReload}
														class="absolute top-0 left-0 w-full h-full opacity-0 z-10"
													/>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				<!-- Quick Chat Widget (Always visible) -->
				<QuickChatWidget />

				<!-- Quick stats/footer (Smart Scroll DOWN) -->
				{#if scrollDirection === 'down' && innerWidth >= 1024}
					<div transition:safeSlide={{ duration: 400, easing: cubicInOut }} class="mt-6">
						<div class="glass-panel p-4 text-xs text-muted flex flex-col items-center text-center">
							<div class="flex flex-wrap justify-center gap-3 mb-2 font-semibold">
								<a href="/" class="hover:text-primary transition-colors decoration-none"
									>Acerca de</a
								>
								<span class="opacity-30">•</span>
								<a href="/" class="hover:text-primary transition-colors decoration-none">Ayuda</a>
								<span class="opacity-30">•</span>
								<a href="/" class="hover:text-primary transition-colors decoration-none"
									>Privacidad</a
								>
								<span class="opacity-30">•</span>
								<a href="/" class="hover:text-primary transition-colors decoration-none"
									>Condiciones</a
								>
							</div>
							<p class="opacity-50 text-[10px]">© 2026 VSocial Inc.</p>
						</div>
					</div>
				{/if}
			</div>
			<!-- close sticky wrapper -->
		</div>

		<!-- Center Column (Feed posts & Create Box) -->
		<div class="feed-col-center col-span-1 lg:col-span-6 space-y-4">
			<!-- Mobile Algorithm Selector (hidden on desktop) -->
			<div class="lg:hidden flex justify-center py-2 w-full px-4">
				{#if globalFeedMode === 'retention'}
					<div
						class="w-full text-center py-2 rounded-xl text-[13px] font-bold text-white shadow-lg flex justify-center items-center gap-2"
						style="background: var(--grad-primary);"
					>
						<span class="material-icons-round text-[16px]">auto_awesome</span> Inteligente
					</div>
				{:else if globalFeedMode === 'radar'}
					<div
						class="w-full text-center py-2 rounded-xl text-[13px] font-bold text-white shadow-lg flex justify-center items-center gap-2"
						style="background: var(--grad-primary);"
					>
						<span class="material-icons-round text-[16px]">schedule</span> Línea de Tiempo
					</div>
				{:else}
					<div class="w-full flex flex-col gap-2">
						<div
							class="w-full text-center py-2 rounded-xl text-[13px] font-bold text-white shadow-lg flex justify-center items-center gap-2"
							style="background: var(--grad-primary);"
						>
							<span class="material-icons-round text-[16px]">tune</span> A tu elección
						</div>
						<div class="flex flex-wrap justify-center gap-1.5 px-2">
							<span
								class="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white font-bold tracking-wider"
								>INT {userWeights.interests}%</span
							>
							<span
								class="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white font-bold tracking-wider"
								>NOV {userWeights.recency}%</span
							>
							<span
								class="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white font-bold tracking-wider"
								>SOC {userWeights.social}%</span
							>
							<span
								class="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white font-bold tracking-wider"
								>INTX {userWeights.interactions}%</span
							>
						</div>
					</div>
				{/if}
			</div>

			<div
				class="transition-all duration-500 ease-in-out overflow-hidden {storiesEnabled
					? ''
					: 'pointer-events-none'}"
				style="max-height: {storiesEnabled
					? showStoryCaptionModal
						? '700px'
						: '300px'
					: '0'}; opacity: {storiesEnabled ? '1' : '0'}; margin-bottom: {storiesEnabled
					? '1.5rem'
					: '0'};"
			>
				<!-- Stories bar -->
				<div
					class="glass-panel p-4 overflow-x-auto flex gap-3 items-center hide-scrollbar"
					style="scroll-snap-type: x mandatory;"
				>
					<!-- Create Story slot -->
					<button
						onclick={() => {
							showStoryCaptionModal = !showStoryCaptionModal;
							pendingStoryFile = null;
							storyCaptionText = '';
						}}
						disabled={uploadingStory}
						class="relative flex-shrink-0 cursor-pointer focus:outline-none group shadow-lg hover:shadow-cyan-500/20 transition-all duration-300"
						style="flex: 0 0 110px; width: 110px; height: 160px; scroll-snap-align: start; border-radius: 16px; overflow: hidden; border: 1px solid var(--glass-border); background-color: var(--bg-surface);"
					>
						<!-- Top area: User's Profile Picture -->
						<div
							style="position: absolute; top: 0; left: 0; right: 0; height: 110px; background-color: var(--bg-input-tint); overflow: hidden;"
						>
							{#if authStore.user && authStore.user.avatar_url}
								<img
									src={authStore.user.avatar_url}
									alt="Tu foto"
									style="width: 100%; height: 100%; object-fit: cover;"
									class="group-hover:scale-105 transition-transform duration-500"
									width="110"
									height="110"
									loading="lazy"
									decoding="async"
								/>
							{:else if authStore.user}
								<div
									style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--bg-input-tint);"
								>
									<span style="font-size: 3rem; font-weight: bold; color: var(--border-subtle);">
										{authStore.user.username[0].toUpperCase()}
									</span>
								</div>
							{/if}
						</div>

						<!-- Bottom area: Solid dark with text -->
						<div
							style="position: absolute; bottom: 0; left: 0; right: 0; height: 50px; background-color: var(--bg-surface); display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 8px;"
						>
							<span style="font-size: 11px; font-weight: bold; color: var(--text-primary);"
								>Crear Historia</span
							>
						</div>

						<!-- The Floating '+' Button -->
						<div
							style="position: absolute; top: 94px; left: 50%; transform: translateX(-50%); width: 32px; height: 32px; border-radius: 50%; background: var(--grad-primary, linear-gradient(to top right, #22d3ee, #3b82f6)); border: 3px solid var(--bg-surface); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.4); z-index: 10;"
							class="group-hover:scale-110 transition-transform duration-300"
						>
							<span
								class="material-icons-round"
								style="color: white; font-size: 18px; font-weight: bold;"
							>
								{uploadingStory ? 'autorenew' : 'add'}
							</span>
						</div>

						<!-- Hover Overlay -->
						<div
							class="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300 pointer-events-none z-20"
						></div>
					</button>
					<input
						type="file"
						id="story_file_input"
						name="story_file_input"
						bind:this={storyFileInput}
						accept="image/*,video/*"
						style="display:none"
						onchange={handleStoryUpload}
					/>

					<!-- Active stories -->
					{#each activeStories as userStory}
						<button
							onclick={() => openStory(userStory)}
							class="relative flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer border border-white/10 hover:border-cyan-400/50 hover:-translate-y-1 transition-all duration-300 focus:outline-none group shadow-lg"
							style="flex: 0 0 110px; width: 110px; height: 160px; scroll-snap-align: start;"
						>
							<!-- Background Media -->
							{#if userStory.items && userStory.items.length > 0 && userStory.items[0].media_url}
								{#if userStory.items[0].media_type === 'video'}
									{#if storiesEnabled}
										<media-player
											src={userStory.items[0].media_url}
											class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
											muted
											playsInline
										>
											<media-outlet></media-outlet>
										</media-player>
									{/if}
								{:else}
									<img
										src={userStory.items[0].media_url}
										class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
										alt="story"
										width="110"
										height="160"
										loading="lazy"
										decoding="async"
									/>
								{/if}
							{:else}
								<!-- Text-only or missing media fallback -->
								<div
									class="absolute inset-0 bg-gradient-to-br from-indigo-900 to-slate-900 flex items-center justify-center"
								>
									{#if userStory.avatar_url}
										<img
											src={userStory.avatar_url}
											class="w-full h-full object-cover opacity-40 blur-sm scale-110"
											alt=""
											width="110"
											height="160"
											loading="lazy"
											decoding="async"
										/>
									{:else}
										<span class="text-white/10 font-bold text-[5rem]">
											{userStory.username[0].toUpperCase()}
										</span>
									{/if}
								</div>
							{/if}

							<!-- Gradient Overlay -->
							<div
								class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-90 group-hover:opacity-100 transition-opacity"
							></div>

							<!-- User Info (Avatar + Username) -->
							<div
								style="position: absolute; bottom: 12px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; z-index: 10; padding: 0 8px;"
							>
								<div
									style="width: 36px; height: 36px; border-radius: 50%; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid rgba(255,255,255,0.15); box-shadow: 0 2px 8px rgba(0,0,0,0.5); background: var(--grad-primary, linear-gradient(to top right, #22d3ee, #3b82f6));"
								>
									{#if userStory.avatar_url}
										<img
											src={userStory.avatar_url}
											alt={userStory.username}
											style="width: 100%; height: 100%; object-fit: cover;"
											width="36"
											height="36"
											loading="lazy"
											decoding="async"
										/>
									{:else}
										<span
											style="color: #fff; font-weight: bold; font-size: 15px; font-family: sans-serif;"
										>
											{userStory.username[0].toUpperCase()}
										</span>
									{/if}
								</div>
								<span
									style="font-size: 11px; font-weight: bold; color: #fff; text-align: center; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 3px rgba(0,0,0,0.8);"
									>@{userStory.username}</span
								>
							</div>
						</button>
					{/each}
				</div>

				<!-- Story Caption Inline Panel -->
				{#if showStoryCaptionModal}
					<div
						transition:slide={{ duration: 400, easing: expoOut }}
						class="dropdown-panel mt-2"
						style="min-height: max-content; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--bg-surface2); padding: 16px; width: 100%; box-shadow: 0 16px 48px rgba(0,0,0,0.25);"
					>
						<div class="panel-header flex justify-between items-center mb-4">
							<h3 class="text-xs font-bold uppercase text-muted flex items-center gap-2">
								<span class="material-icons-round text-primary text-sm">auto_stories</span>
								Nueva Historia
							</h3>
							<button
								type="button"
								class="bg-transparent border-none cursor-pointer text-muted hover:text-rose-500"
								onclick={cancelStoryCaption}
							>
								<span class="material-icons-round text-sm">close</span>
							</button>
						</div>

						{#if !pendingStoryFile}
							<div
								role="button"
								tabindex="0"
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') storyFileInput.click();
								}}
								onclick={() => storyFileInput.click()}
								ondragover={(e) => e.preventDefault()}
								ondrop={(e) => {
									e.preventDefault();
									if (e.dataTransfer.files && e.dataTransfer.files[0]) {
										pendingStoryFile = e.dataTransfer.files[0];
									}
								}}
								style="
                width: 100%;
                border-radius: 1rem;
                border: 1px solid rgba(34,211,238,0.15);
                background: linear-gradient(135deg, rgba(34,211,238,0.04) 0%, rgba(59,130,246,0.04) 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2.5rem 1rem;
                cursor: pointer;
                transition: all 0.25s;
                box-shadow: inset 0 0 0 1px rgba(34,211,238,0.08);
              "
								onmouseenter={(e) => {
									e.currentTarget.style.borderColor = 'rgba(34,211,238,0.4)';
									e.currentTarget.style.background =
										'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(59,130,246,0.08) 100%)';
									e.currentTarget.style.boxShadow =
										'inset 0 0 0 1px rgba(34,211,238,0.15), 0 0 20px rgba(34,211,238,0.08)';
								}}
								onmouseleave={(e) => {
									e.currentTarget.style.borderColor = 'rgba(34,211,238,0.15)';
									e.currentTarget.style.background =
										'linear-gradient(135deg, rgba(34,211,238,0.04) 0%, rgba(59,130,246,0.04) 100%)';
									e.currentTarget.style.boxShadow = 'inset 0 0 0 1px rgba(34,211,238,0.08)';
								}}
							>
								<div
									style="width:44px;height:44px;border-radius:50%;background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.2);display:flex;align-items:center;justify-content:center;margin-bottom:0.75rem;"
								>
									<span
										class="material-icons-round"
										style="color: rgba(34,211,238,0.8); font-size: 22px;">cloud_upload</span
									>
								</div>
								<p
									style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);text-align:center;"
								>
									Arrastra imágenes/videos o haz clic
								</p>
							</div>
						{:else}
							<p class="text-xs text-muted mb-2">
								Introduce un pie de foto para tu historia (opcional):
							</p>
							<input
								type="text"
								class="aero-input w-full mb-3 text-xs py-1.5 px-3"
								placeholder="Escribe algo increíble..."
								bind:value={storyCaptionText}
								onkeydown={(e) => e.key === 'Enter' && submitStoryCaption()}
							/>
							<div class="flex justify-between items-center mt-2">
								<span
									class="text-[10px] text-cyan-400 flex items-center gap-1 font-semibold bg-cyan-400/10 px-2 py-1 rounded-md"
								>
									<span class="material-icons-round text-[14px]">check_circle</span>
									Archivo seleccionado
								</span>
								<div class="flex gap-2">
									<button
										class="btn-aero-secondary text-xs py-1.5 px-4"
										onclick={() => (pendingStoryFile = null)}>Cambiar archivo</button
									>
									<button
										class="btn-aero-primary text-xs py-1.5 px-4 shadow-lg"
										onclick={submitStoryCaption}>Aceptar</button
									>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Create Post Box -->
			{#if authStore.isAuthenticated}
				<div
					class="glass-panel p-5"
					style="container-type: inline-size; position: relative; z-index: {showEmojis ||
					showGifModal
						? 50
						: 10};"
				>
					<!-- Quick Creator Tabs -->
					<div
						class="flex gap-4 border-b border-glass-border pb-3 mb-4 text-xs font-bold uppercase tracking-wider"
					>
						<button
							type="button"
							class="tab-btn flex items-center gap-1.5 pb-2 transition border-b-2"
							style="
                border-color: {activeTab === 'post' ? 'var(--aero-blue)' : 'transparent'};
                color: {activeTab === 'post' ? 'var(--aero-sky)' : 'var(--text-muted)'};
                background: none; border: none; cursor: pointer; padding: 0 4px;
              "
							onclick={() => (activeTab = 'post')}
						>
							<span class="material-icons-round text-sm">feed</span>
							Publicación
						</button>
					</div>

					{#if activeTab === 'post'}
						<form onsubmit={handleCreatePost} class="flex flex-col">
							{#if postError}
								<div
									class="flex items-start gap-2 p-3 rounded-xl error-banner text-xs font-semibold mb-4"
								>
									<span class="material-icons-round text-sm shrink-0">error_outline</span>
									<span>{postError}</span>
								</div>
							{/if}

							<div class="flex gap-3 mb-4">
								{#if authStore.user?.avatar_url}
									<img
										src={authStore.user.avatar_url}
										alt={authStore.user.username}
										class="w-10 h-10 rounded-full object-cover"
										width="40"
										height="40"
										loading="lazy"
										decoding="async"
									/>
								{:else}
									<div class="vs-avatar-letter avatar-md">
										{(authStore.user?.display_name ||
											authStore.user?.username ||
											'?')[0].toUpperCase()}
									</div>
								{/if}
								<div
									class="post-textarea-wrapper"
									style="z-index: {showEmojis
										? 110
										: 60}; display: flex; flex-direction: column; gap: 10px;"
								>
									<div class="relative w-full">
										<HashtagTextarea
											id="new_post_text"
											bind:value={newPostText}
											onkeydown={handleKeyDown}
											placeholder={composerPlaceholder}
											rows={3}
											class="aero-textarea feed-post-textarea"
											style="background: var(--bg-overlay); border: 1px solid var(--border-glass);"
										/>

										<button
											type="button"
											class="post-emoji-btn"
											onclick={toggleEmojiPanel}
											title="Emojis"
										>
											<span class="material-icons-round text-muted hover:text-cyan-400 transition"
												>mood</span
											>
										</button>
									</div>

									<!-- Attachments Display -->
									{#if attachedGif}
										<div
											class="gif-attachment-preview self-start"
											transition:slide={{ duration: 650, easing: expoOut }}
										>
											<img
												src={getProxiedMediaUrl(attachedGif)}
												alt="GIF adjunto"
												class="gif-attachment-thumb"
												width="220"
												height="160"
												loading="lazy"
												decoding="async"
												crossorigin="anonymous"
												referrerpolicy="no-referrer"
											/>
											<span class="gif-attachment-label">GIF</span>
											<button
												type="button"
												class="remove-media-btn"
												onclick={() => (attachedGif = '')}
												aria-label="Quitar GIF"
											>
												<span class="material-icons-round text-sm">close</span>
											</button>
										</div>
									{/if}

									{#if selectedFiles.length > 0}
										<div class="media-preview-grid">
											{#each selectedFiles as item, idx}
												<div class="media-preview-item">
													{#if item.file.type.startsWith('video/')}
														<media-player
															src={item.previewUrl}
															class="preview-thumb"
															muted
															playsInline
														>
															<media-outlet></media-outlet>
														</media-player>
														<span class="media-type-badge"
															><span class="material-icons-round text-xs">videocam</span></span
														>
													{:else}
														<img
															src={item.previewUrl}
															alt=""
															class="preview-thumb"
															width="76"
															height="76"
															loading="lazy"
															decoding="async"
														/>
													{/if}
													<button
														type="button"
														class="remove-media-btn"
														onclick={() => removeSelectedFile(idx)}
														aria-label="Quitar archivo"
													>
														<span class="material-icons-round text-sm">close</span>
													</button>
												</div>
											{/each}
										</div>
									{/if}

									{#if pollAttached}
										<div
											class="flex flex-col gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 self-start w-full max-w-sm"
										>
											<div class="flex justify-between items-center">
												<span class="flex items-center gap-1.5"
													><span class="material-icons-round text-sm">poll</span> Encuesta</span
												>
												<button
													type="button"
													class="bg-transparent border-none cursor-pointer text-muted hover:text-white"
													onclick={() => {
														pollAttached = false;
														pollQuestion = '';
														pollOptions = ['', ''];
													}}
												>
													<span class="material-icons-round text-[10px]">close</span>
												</button>
											</div>
											<div class="truncate font-semibold text-main">
												{pollQuestion || '(Sin pregunta)'}
											</div>
											<div class="flex flex-col gap-1 text-[10px] text-muted pl-4">
												{#each pollOptions.filter((o) => o.trim()) as opt}
													<div>• {opt}</div>
												{/each}
											</div>
										</div>
									{/if}

									{#if attachedMusic}
										<div
											class="flex items-center gap-1.5 p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs font-bold text-indigo-400 self-start"
										>
											<span class="material-icons-round text-sm">music_note</span>
											<span>Audio: {attachedMusic.title} - {attachedMusic.artist}</span>
											<button
												type="button"
												class="bg-transparent border-none cursor-pointer text-muted hover:text-white"
												onclick={() => (attachedMusic = null)}
											>
												<span class="material-icons-round text-[10px]">close</span>
											</button>
										</div>
									{/if}

									{#if attachedVoiceNote}
										<div
											class="flex items-center gap-1.5 p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-xs font-bold text-cyan-400 self-start"
										>
											<span class="material-icons-round text-sm">mic</span>
											<span>Nota de voz grabada</span>
											<button
												type="button"
												class="bg-transparent border-none cursor-pointer text-muted hover:text-white"
												onclick={() => (attachedVoiceNote = null)}
											>
												<span class="material-icons-round text-[10px]">close</span>
											</button>
										</div>
									{/if}
								</div>
							</div>

							<div
								class="flex flex-wrap items-center justify-between gap-2 border-t pt-3 mt-1 relative"
								style="border-top-color: var(--border-glass);"
							>
								<div class="composer-toolbar">
									<button
										type="button"
										class="toolbar-btn toolbar-img"
										title="Añadir multimedia"
										onclick={toggleMediaPanel}
									>
										<span class="material-icons-round">perm_media</span>
										<span class="toolbar-label">Multimedia</span>
									</button>
									<input
										type="file"
										id="post_file_input"
										name="post_file_input"
										bind:this={fileInput}
										multiple
										accept="image/*,video/*"
										style="display: none"
										onchange={handleFileSelect}
									/>

									<button
										type="button"
										class="toolbar-btn toolbar-gif"
										title="Añadir GIF"
										onclick={toggleGifPanel}
									>
										<span class="material-icons-round">gif_box</span>
										<span class="toolbar-label">GIF</span>
									</button>
									<button
										type="button"
										class="toolbar-btn toolbar-music"
										title="Añadir Música"
										onclick={toggleMusicPanel}
									>
										<span class="material-icons-round">music_note</span>
										<span class="toolbar-label">Música</span>
									</button>
									<button
										type="button"
										class="toolbar-btn toolbar-voice"
										title="Añadir Nota de Voz"
										onclick={toggleVoicePanel}
									>
										<span class="material-icons-round">mic</span>
										<span class="toolbar-label">Voz</span>
									</button>
									<button
										type="button"
										class="toolbar-btn toolbar-poll"
										title="Añadir encuesta"
										onclick={togglePollPanel}
									>
										<span class="material-icons-round">poll</span>
										<span class="toolbar-label">Encuesta</span>
									</button>
								</div>

								<div class="flex gap-2 shrink-0 mt-2 sm:mt-0 ml-auto">
									<a
										href="/posts/create"
										class="btn-aero-secondary btn-radius-sm flex items-center gap-1"
										style="padding: 6px 12px; font-size: 0.85rem; text-decoration: none;"
									>
										<span class="material-icons-round text-sm">settings</span>
										<span class="hidden sm:inline">Avanzado</span>
									</a>
									<button
										type="submit"
										disabled={posting ||
											(!newPostText.trim() &&
												selectedFiles.length === 0 &&
												!pollAttached &&
												!attachedGif &&
												!attachedVoiceNote)}
										class="btn-aero-primary btn-radius-sm"
										style="padding: 6px 16px; font-size: 0.85rem;"
									>
										{#if posting}
											Publicando...
										{:else}
											Publicar
										{/if}
									</button>
								</div>
							</div>

							<!-- Inline Dropdown Panels -->
							{#if showVoiceModal}
								<div
									transition:slide={{ duration: 400, easing: expoOut }}
									class="mt-3 flex justify-center"
									style="position: relative; z-index: 70;"
								>
									<VoiceRecorder
										onrecorded={(blob) => {
											attachedVoiceNote = blob;
											showVoiceModal = false;
										}}
										oncancel={() => {
											showVoiceModal = false;
										}}
									/>
								</div>
							{/if}

							{#if showMediaModal}
								<div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
									<div class="glass-panel p-4" style="min-height: max-content;">
										<div
											role="button"
											tabindex="0"
											class="media-dropzone"
											onclick={() => fileInput.click()}
											onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
											ondragover={(e) => e.preventDefault()}
											ondrop={(e) => {
												e.preventDefault();
												if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
													fileInput.files = e.dataTransfer.files;
													handleFileSelect({ target: fileInput });
													showMediaModal = false;
												}
											}}
										>
											<div class="dropzone-icon">
												<span
													class="material-icons-round"
													style="color: rgba(34,211,238,0.8); font-size: 22px;">cloud_upload</span
												>
											</div>
											<p class="dropzone-text">Arrastra imágenes/videos o haz clic</p>
										</div>
									</div>
								</div>
							{/if}

							{#if showEmojis}
								<div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
									<div
										class="glass-panel p-4"
										style="position: relative; display: flex; justify-content: center; min-height: max-content;"
									>
										<TwemojiPicker
											variant="inline"
											onSelect={insertEmoji}
											onClose={() => (showEmojis = false)}
										/>
									</div>
								</div>
							{/if}

							{#if showGifModal}
								<div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
									<div
										class="glass-panel p-4"
										style="position: relative; display: flex; justify-content: center; min-height: max-content;"
									>
										<KlipyPicker
											onClose={() => (showGifModal = false)}
											onSelect={(url, _gif) => {
												attachedGif = url;
												showGifModal = false;
											}}
										/>
									</div>
								</div>
							{/if}

							{#if showMusicModal}
								<div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
									<div class="glass-panel p-4 w-full" style="min-height: max-content;">
										<div class="panel-header flex justify-between items-center mb-3">
											<span class="panel-title text-xs font-bold uppercase text-muted"
												>Añadir Música</span
											>
											<button
												type="button"
												class="bg-transparent border-none cursor-pointer text-muted hover:text-rose-500"
												onclick={() => (showMusicModal = false)}
												><span class="material-icons-round text-sm">close</span></button
											>
										</div>
										<input
											type="text"
											id="music_search"
											name="music_search"
											class="aero-input w-full mb-3 text-xs py-1.5 px-3"
											placeholder="Buscar canción o artista..."
										/>
										<div class="flex flex-col gap-1.5">
											<button
												type="button"
												class="flex items-center gap-2.5 text-left p-2.5 bg-surface border border-subtle cursor-pointer hover:bg-white/5 rounded-xl transition w-full"
												onclick={() => {
													attachedMusic = { title: 'Lo-Fi Beats', artist: 'Chill Study Vibes' };
													showMusicModal = false;
												}}
											>
												<div
													class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
													style="background: linear-gradient(135deg, #d946ef, #9333ea);"
												>
													<span class="material-icons-round text-white text-xs">play_arrow</span>
												</div>
												<div class="flex flex-col min-w-0">
													<span class="font-bold text-xs text-main truncate">Lo-Fi Beats</span><span
														class="text-[10px] text-muted truncate">Chill Study Vibes</span
													>
												</div>
											</button>
											<button
												type="button"
												class="flex items-center gap-2.5 text-left p-2.5 bg-surface border border-subtle cursor-pointer hover:bg-white/5 rounded-xl transition w-full"
												onclick={() => {
													attachedMusic = { title: 'Synthwave Mix', artist: 'Retro 80s' };
													showMusicModal = false;
												}}
											>
												<div
													class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
													style="background: linear-gradient(135deg, #3b82f6, #22d3ee);"
												>
													<span class="material-icons-round text-white text-xs">play_arrow</span>
												</div>
												<div class="flex flex-col min-w-0">
													<span class="font-bold text-xs text-main truncate">Synthwave Mix</span
													><span class="text-[10px] text-muted truncate">Retro 80s</span>
												</div>
											</button>
										</div>
									</div>
								</div>
							{/if}

							{#if showPollModal}
								<div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
									<div class="glass-panel p-4 w-full" style="min-height: max-content;">
										<div class="panel-header flex justify-between items-center mb-3">
											<span class="panel-title text-xs font-bold uppercase text-muted"
												>Crear Encuesta</span
											>
											<button
												type="button"
												class="bg-transparent border-none cursor-pointer text-muted hover:text-rose-500"
												onclick={() => (showPollModal = false)}
												><span class="material-icons-round text-sm">close</span></button
											>
										</div>
										<div class="flex flex-col gap-1.5 mb-3">
											<input
												type="text"
												id="poll_question"
												name="poll_question"
												class="aero-input w-full text-xs py-1.5 px-3"
												placeholder="Pregunta..."
												bind:value={pollQuestion}
											/>
											<input
												type="text"
												id="poll_opt_0"
												name="poll_opt_0"
												class="aero-input w-full text-xs py-1.5 px-3"
												placeholder="Opción 1"
												bind:value={pollOptions[0]}
											/>
											<input
												type="text"
												id="poll_opt_1"
												name="poll_opt_1"
												class="aero-input w-full text-xs py-1.5 px-3"
												placeholder="Opción 2"
												bind:value={pollOptions[1]}
											/>
											{#each pollOptions.slice(2) as _opt, idx}
												<div class="flex items-center gap-1.5">
													<input
														type="text"
														id={`poll_opt_${idx + 2}`}
														name={`poll_opt_${idx + 2}`}
														class="aero-input flex-1 text-xs py-1.5 px-3"
														placeholder={`Opción ${idx + 3}`}
														bind:value={pollOptions[idx + 2]}
													/>
													<button
														type="button"
														class="bg-transparent border-none cursor-pointer text-muted hover:text-rose-500"
														onclick={() =>
															(pollOptions = pollOptions.filter((_, i) => i !== idx + 2))}
													>
														<span class="material-icons-round text-sm">close</span>
													</button>
												</div>
											{/each}
											{#if pollOptions.length < 6}
												<button
													type="button"
													class="text-cyan-400 hover:text-cyan-300 text-[10px] font-semibold text-left bg-transparent border-none cursor-pointer mt-1"
													onclick={() => (pollOptions = [...pollOptions, ''])}
													>+ Añadir otra opción</button
												>
											{/if}
										</div>
										<button
											type="button"
											class="btn-aero-primary w-full py-2 text-xs font-bold shadow-lg"
											onclick={() => {
												pollAttached = true;
												showPollModal = false;
											}}>Adjuntar Encuesta</button
										>
									</div>
								</div>
							{/if}
						</form>
					{:else if activeTab === 'story'}
						<form onsubmit={handleCreateQuickStory} class="flex flex-col gap-4">
							{#if postError}
								<div
									class="flex items-start gap-2 p-3 rounded-xl error-banner text-xs font-semibold"
								>
									<span class="material-icons-round text-sm shrink-0">error_outline</span>
									<span>{postError}</span>
								</div>
							{/if}

							<div class="flex gap-3">
								{#if authStore.user?.avatar_url}
									<img
										src={authStore.user.avatar_url}
										alt={authStore.user.username}
										class="w-10 h-10 rounded-full object-cover"
										width="40"
										height="40"
										loading="lazy"
										decoding="async"
									/>
								{:else}
									<div class="vs-avatar-letter avatar-md">
										{(authStore.user?.display_name ||
											authStore.user?.username ||
											'?')[0].toUpperCase()}
									</div>
								{/if}
								<div class="post-textarea-wrapper">
									<textarea
										id="quick_story_text"
										name="quick_story_text"
										bind:value={quickStoryText}
										placeholder="Mensaje de tu historia..."
										class="aero-input w-full text-sm"
										rows="3"
										maxlength="60"
									></textarea>
								</div>
							</div>

							<div
								class="flex items-center justify-between border-t pt-3 mt-1 relative"
								style="border-top-color: var(--border-glass);"
							>
								<div class="flex items-center gap-2 flex-wrap">
									<button
										type="button"
										class="toolbar-btn toolbar-img"
										onclick={() => quickStoryFileInput.click()}
									>
										<span class="material-icons-round">image</span>
										<span class="text-xs font-bold">Foto/Video</span>
									</button>
									<input
										type="file"
										bind:this={quickStoryFileInput}
										accept="image/*,video/*"
										style="display:none"
										onchange={handleQuickStoryFileSelect}
									/>

									{#if !quickStoryPreview}
										<div class="flex gap-1.5 items-center ml-2">
											{#each ['#00E5FF', '#FF6B6B', '#6C5CE7', '#FDCB6E', '#00B894'] as c}
												<button
													type="button"
													aria-label="Color de fondo {c}"
													class="w-5 h-5 rounded-full border-2"
													style="background: {c}; border-color: {quickStoryBgColor === c
														? 'var(--aero-blue)'
														: 'transparent'};"
													onclick={() => (quickStoryBgColor = c)}
												></button>
											{/each}
										</div>
									{/if}
								</div>

								{#if quickStoryPreview}
									<div
										class="relative w-12 h-12 rounded-lg overflow-hidden border border-glass-border"
									>
										<img
											src={quickStoryPreview}
											alt="Preview"
											class="w-full h-full object-cover"
											width="48"
											height="48"
											loading="lazy"
											decoding="async"
										/>
										<button
											type="button"
											class="absolute top-0 right-0 bg-black/60 text-white rounded-full p-0.5"
											onclick={() => {
												quickStoryFile = null;
												quickStoryPreview = null;
											}}
										>
											<span class="material-icons-round text-[10px]">close</span>
										</button>
									</div>
								{/if}

								<button
									type="submit"
									disabled={publishingStory || (!quickStoryFile && !quickStoryText)}
									class="btn-aero-primary"
									style="padding: 6px 20px; font-size: 0.85rem;"
								>
									{publishingStory ? 'Publicando...' : 'Publicar Historia'}
								</button>
							</div>
						</form>
					{:else if activeTab === 'reel'}
						<form onsubmit={handleCreateQuickReel} class="flex flex-col gap-4">
							{#if postError}
								<div
									class="flex items-start gap-2 p-3 rounded-xl error-banner text-xs font-semibold"
								>
									<span class="material-icons-round text-sm shrink-0">error_outline</span>
									<span>{postError}</span>
								</div>
							{/if}

							<div class="flex gap-3">
								{#if authStore.user?.avatar_url}
									<img
										src={authStore.user.avatar_url}
										alt={authStore.user.username}
										class="w-10 h-10 rounded-full object-cover"
										width="40"
										height="40"
										loading="lazy"
										decoding="async"
									/>
								{:else}
									<div class="vs-avatar-letter avatar-md">
										{(authStore.user?.display_name ||
											authStore.user?.username ||
											'?')[0].toUpperCase()}
									</div>
								{/if}
								<div class="post-textarea-wrapper">
									<textarea
										bind:value={quickReelCaption}
										placeholder="Descripción de tu Reel..."
										class="aero-textarea w-full text-sm"
										rows="2"
										maxlength="200"
									></textarea>
								</div>
							</div>

							<div
								class="flex items-center justify-between border-t pt-3 mt-1 relative"
								style="border-top-color: var(--border-glass);"
							>
								<div class="flex items-center gap-2 flex-wrap">
									<button
										type="button"
										class="toolbar-btn toolbar-img"
										onclick={() => quickReelFileInput.click()}
									>
										<span class="material-icons-round">movie</span>
										<span class="text-xs font-bold">Video Vertical</span>
									</button>
									<input
										type="file"
										bind:this={quickReelFileInput}
										accept="video/*"
										style="display:none"
										onchange={handleQuickReelFileSelect}
									/>

									<select bind:value={quickReelSpeed} class="vs-input py-1 px-2 text-[10px] w-auto">
										<option value="0.5x">0.5x</option>
										<option value="1x">1x</option>
										<option value="1.5x">1.5x</option>
										<option value="2x">2x</option>
									</select>

									<select
										bind:value={quickReelFilter}
										class="vs-input py-1 px-2 text-[10px] w-auto"
									>
										<option value="none">Normal</option>
										<option value="vintage">Vintage</option>
										<option value="cyberpunk">Cyberpunk</option>
										<option value="dreamy">Dreamy</option>
										<option value="bw">B&W</option>
									</select>
								</div>

								{#if quickReelPreview}
									<div
										class="relative w-12 h-12 rounded-lg overflow-hidden border border-glass-border"
									>
										<media-player
											src={quickReelPreview}
											class="w-full h-full object-cover"
											muted
											playsInline
										>
											<media-outlet></media-outlet>
										</media-player>
										<button
											type="button"
											class="absolute top-0 right-0 bg-black/60 text-white rounded-full p-0.5"
											onclick={() => {
												quickReelFile = null;
												quickReelPreview = null;
											}}
										>
											<span class="material-icons-round text-[10px]">close</span>
										</button>
									</div>
								{/if}

								<button
									type="submit"
									disabled={publishingReel || !quickReelFile}
									class="btn-aero-primary"
									style="padding: 6px 20px; font-size: 0.85rem;"
								>
									{publishingReel ? 'Publicando...' : 'Publicar Reel'}
								</button>
							</div>
						</form>
					{/if}
				</div>
			{/if}

			<!-- Feed Posts -->
			<div class="space-y-4">
				{#if loading}
					<!-- Skeleton Loading -->
					{#each Array(3) as _}
						<div class="glass-panel p-5 space-y-4 animate-pulse">
							<div class="flex gap-3">
								<div class="w-10 h-10 rounded-full bg-white/40"></div>
								<div class="flex-1 space-y-2 py-1">
									<div class="h-3 bg-white/40 rounded w-1/4"></div>
									<div class="h-2 bg-white/40 rounded w-1/6"></div>
								</div>
							</div>
							<div class="space-y-2">
								<div class="h-3 bg-white/40 rounded w-full"></div>
								<div class="h-3 bg-white/40 rounded w-5/6"></div>
							</div>
						</div>
					{/each}
				{:else if posts.length === 0}
					<div class="glass-panel p-12 text-center">
						<span class="material-icons-round text-5xl text-muted mb-3">feed</span>
						<h3 class="font-bold text-lg text-main mb-1">Tu feed está vacío</h3>
						<p class="text-xs text-muted max-w-xs mx-auto">
							Sigue a otros creadores o cambia al feed inteligente para ver contenido destacado.
						</p>
					</div>
				{:else}
					{#each posts as post (post.id)}
						<div class="feed-post-wrap" in:slide={{ duration: 500, easing: expoOut }}>
							<PostCard {post} onDelete={handlePostDeleted} />
						</div>
					{/each}

					<!-- Load More / Sentinel -->
					{#if hasMore}
						<div class="text-center py-6" use:infiniteScroll>
							{#if postsLoading}
								<div
									class="inline-block px-5 py-2.5 rounded-full"
									style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px);"
								>
									<span
										class="animate-pulse text-aero-blue text-[11px] font-black tracking-[0.2em] uppercase"
										>Sincronizando...</span
									>
								</div>
							{/if}
						</div>
					{:else}
						<p class="text-center text-xs text-muted py-6 font-semibold" style="line-height: 1.6;">
							Has llegado al final.<br />
							¡Sigue a más personas para ver más publicaciones!
						</p>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Right Column (trending and secondary suggestions) -->
		<div class="feed-col-right hidden lg:block lg:col-span-3">
			<div
				class="sticky transition-all duration-300 ease-in-out space-y-6 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-120px)] custom-scrollbar"
				style="top: 70px;"
			>
				<!-- Gamification Checkin (solo si el botón realmente se va a mostrar) -->
				{#if gamificationEnabled && authStore.isAuthenticated && checkinState.loaded && checkinState.canCheckin}
					<div
						class="transition-all duration-500 ease-in-out overflow-hidden"
						style="max-height: 200px;"
					>
						<CheckinButton
							streak={checkinState.streak}
							canCheckin={checkinState.canCheckin}
							nextCheckin={checkinState.nextCheckin}
							disabled={checkinLoading}
							oncheckin={handleCheckin}
						/>
					</div>
				{/if}

				<!-- Trending Hashtags Card -->
				<div class="glass-panel p-5">
					<h3 class="text-xs font-bold uppercase tracking-wider text-muted mb-4 px-1">
						Tendencias hoy
					</h3>

					<div class="space-y-4">
						{#each trendingTags as tag}
							<div class="group cursor-pointer">
								<a href="/explore?q=%23{tag.tag}" class="block text-decoration-none">
									<p class="font-bold text-sm text-main hover:text-blue-500 transition">
										#{tag.tag}
									</p>
									<p class="text-[10px] text-muted mt-0.5">
										{tag.posts.toLocaleString()} publicaciones
									</p>
								</a>
							</div>
						{/each}
					</div>
				</div>

				<!-- Sugerencias Card -->
				<div class="glass-panel p-5 relative group/sug">
					<!-- Luces volumétricas de fondo (adaptables por opacidad) -->
					<div
						class="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20 dark:opacity-10 transition-all duration-700 group-hover/sug:opacity-30 group-hover/sug:scale-110"
						style="background: var(--primary); z-index: 0; pointer-events: none;"
					></div>
					<div
						class="absolute -bottom-10 -left-10 w-40 h-40 rounded-full blur-3xl opacity-15 dark:opacity-5 transition-all duration-700 group-hover/sug:opacity-25 group-hover/sug:scale-110"
						style="background: var(--aero-sky); z-index: 0; pointer-events: none;"
					></div>

					<div
						class="flex justify-between items-center mb-5 relative z-10"
						style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;"
					>
						<h3
							class="text-xs font-black uppercase tracking-widest flex items-center gap-2"
							style="color: var(--text-main);"
						>
							<span class="material-icons-round text-sm" style="color: var(--primary);"
								>auto_awesome</span
							> Sugerencias
						</h3>
						<a
							href="/explore"
							class="text-[10px] font-bold uppercase px-3 py-1 rounded-full transition-all hover:scale-105"
							style="background: var(--glass-surface); border: 1px solid var(--glass-border); color: var(--text-primary);"
							>Ver más</a
						>
					</div>

					<div class="space-y-3 relative z-10">
						{#each suggestedCreators as creator}
							<div
								class="sug-creator-item flex items-center justify-between gap-3 p-2.5 -mx-2 rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
							>
								<a
									href="/u/{creator.username}"
									class="flex items-center gap-3 min-w-0 text-decoration-none flex-1"
								>
									<div class="relative" style="flex: 0 0 44px; min-width: 44px; min-height: 44px;">
										{#if creator.avatar_url}
											<img
												src={creator.avatar_url}
												alt={creator.username}
												class="w-11 h-11 rounded-full object-cover shadow-sm transition-transform hover:scale-105"
												style="border: 2px solid var(--glass-border);"
												width="44"
												height="44"
												loading="lazy"
												decoding="async"
											/>
										{:else}
											<div
												class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm transition-transform hover:scale-105"
												style="background: var(--grad-primary); border: 2px solid var(--glass-highlight);"
											>
												<span class="text-white font-black text-sm drop-shadow-md">
													{creator.display_name
														? creator.display_name[0].toUpperCase()
														: creator.username[0].toUpperCase()}
												</span>
											</div>
										{/if}
									</div>
									<div class="min-w-0 flex-1">
										<p
											class="font-bold text-[13px] truncate transition-colors"
											style="color: var(--text-main);"
										>
											{creator.display_name || creator.username}
										</p>
										<p
											class="text-[11px] truncate"
											style="color: var(--text-muted); font-weight: 500;"
										>
											@{creator.username}
										</p>
									</div>
								</a>
								<button
									onclick={() => toggleFollowSuggested(creator.username)}
									class="btn-aero-primary {creator.is_following ? 'following' : ''} flex-shrink-0"
									style="padding: 0 12px; height: 32px; font-size: 0.75rem; min-width: 85px;"
								>
									{creator.is_following ? 'Siguiendo' : 'Seguir'}
								</button>
							</div>
						{/each}
					</div>
				</div>
			</div>
			<!-- close sticky wrapper -->
		</div>
	</div>
</div>

<!-- Story Viewer Modal Overlay -->
{#if selectedStoryUser}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
		style="z-index: 9999;"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeStory();
		}}
		transition:fade={{ duration: 150 }}
	>
		<!-- Close button -->
		<button
			onclick={closeStory}
			class="absolute top-4 right-4 text-white hover:text-cyan-400 p-2 bg-white/10 border-none rounded-full cursor-pointer transition"
		>
			<span class="material-icons-round text-2xl">close</span>
		</button>

		<!-- Navigation buttons -->
		<button
			onclick={prevStoryItem}
			class="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-cyan-400 p-3 bg-white/10 border-none rounded-full cursor-pointer transition hidden md:block"
		>
			<span class="material-icons-round text-2xl">chevron_left</span>
		</button>
		<button
			onclick={nextStoryItem}
			class="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-cyan-400 p-3 bg-white/10 border-none rounded-full cursor-pointer transition hidden md:block"
		>
			<span class="material-icons-round text-2xl">chevron_right</span>
		</button>

		<!-- Modal Box -->
		<div
			class="relative bg-neutral-900 rounded-2xl border border-white/15 overflow-hidden flex flex-col shadow-2xl"
			style="height: 90vh; max-height: 820px; max-width: 100%; aspect-ratio: 9 / 16;"
			transition:scale={{ duration: 250, start: 0.95, easing: backOut }}
		>
			<!-- Top header and progress bar -->
			<div class="px-4 pt-4 pb-2 z-10 space-y-3 flex-shrink-0">
				<!-- Progress bar container -->
				<div class="flex gap-1">
					{#each selectedStoryUser.items as _item, i}
						<div class="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
							<div
								class="h-full bg-white transition-all duration-75"
								style="width: {i < selectedStoryIndex
									? 100
									: i === selectedStoryIndex
										? storyProgress
										: 0}%"
							></div>
						</div>
					{/each}
				</div>

				<!-- User info -->
				<div class="flex items-center justify-between w-full">
					<div class="flex items-center gap-2">
						{#if selectedStoryUser.avatar_url}
							<img
								src={selectedStoryUser.avatar_url}
								alt={selectedStoryUser.username}
								class="w-8 h-8 rounded-full object-cover border border-white/20"
								width="32"
								height="32"
								loading="lazy"
								decoding="async"
							/>
						{:else}
							<div class="vs-avatar-letter avatar-sm">
								{selectedStoryUser.username[0].toUpperCase()}
							</div>
						{/if}
						<span class="font-bold text-sm text-white">@{selectedStoryUser.username}</span>
					</div>

					{#if authStore.user && selectedStoryUser.username === authStore.user.username}
						<button
							class="text-white/90 hover:text-rose-400 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full transition duration-300 backdrop-blur-md pointer-events-auto shadow-lg"
							onclick={promptDeleteStory}
							aria-label="Eliminar Historia"
							title="Eliminar Historia"
						>
							<span class="material-icons-round" style="font-size:16px;">delete_outline</span>
							<span class="text-xs font-bold tracking-wide">Eliminar</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- Story Media + text overlay -->
			<div
				class="relative flex-1 z-0 flex items-center justify-center overflow-hidden"
				style={selectedStoryUser.items[selectedStoryIndex].media_type === 'text' ||
				!selectedStoryUser.items[selectedStoryIndex].media_url
					? 'background:' +
						(selectedStoryUser.items[selectedStoryIndex].background_color || '#1B85F3')
					: ''}
			>
				{#if selectedStoryUser.items[selectedStoryIndex].media_type === 'video'}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						bind:this={storyVideoEl}
						src={selectedStoryUser.items[selectedStoryIndex].media_url}
						autoplay
						playsinline
						class="w-full h-full object-contain"
						onloadedmetadata={(e) => startStoryTimer(e.currentTarget.duration * 1000)}
					></video>
				{:else if selectedStoryUser.items[selectedStoryIndex].media_url && selectedStoryUser.items[selectedStoryIndex].media_type !== 'text'}
					<img
						src={selectedStoryUser.items[selectedStoryIndex].media_url}
						alt="Historia"
						class="w-full h-full object-contain"
						loading="lazy"
						decoding="async"
					/>
				{/if}

				<!-- Caption overlay with text_meta styles -->
				{#if selectedStoryUser.items[selectedStoryIndex].caption}
					{@const meta = (() => {
						try {
							return JSON.parse(selectedStoryUser.items[selectedStoryIndex].text_meta || '{}');
						} catch {
							return {};
						}
					})()}
					{@const fontMap = {
						modern: 'font-family:var(--font-display,sans-serif);font-weight:900;',
						serif: 'font-family:Georgia,serif;font-style:italic;',
						typewriter: "font-family:'Courier New',monospace;font-weight:bold;",
						neon: 'font-weight:800;',
						cursive: 'font-family:cursive;font-weight:600;'
					}}
					<div
						style="
              position: absolute;
              top: {meta.posY ?? 80}%;
              left: {meta.posX ?? 50}%;
              transform: translate(-50%, -50%);
              width: 86%;
              z-index: 5;
              font-size: 1.3rem;
              line-height: 1.35;
              word-break: break-word;
              pointer-events: none;
              color: {meta.color || '#ffffff'};
              text-align: {meta.align || 'center'};
              {fontMap[meta.font] || fontMap.modern}
              {meta.bg
							? 'background:rgba(0,0,0,0.6);backdrop-filter:blur(10px);padding:10px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);'
							: 'text-shadow:0 2px 12px rgba(0,0,0,0.9),0 1px 4px rgba(0,0,0,0.8);'}
            "
					>
						{selectedStoryUser.items[selectedStoryIndex].caption}
					</div>
				{/if}

				<!-- Bottom controls (Tap left/right on mobile) -->
				<div class="absolute inset-0 flex">
					<!-- Left click zone -->
					<button
						onpointerdown={onStoryZonePointerDown}
						onpointerup={onStoryZonePointerUp}
						onpointercancel={onStoryZonePointerCancel}
						oncontextmenu={(e) => e.preventDefault()}
						class="flex-1 h-full opacity-0 cursor-west-resize bg-transparent border-none touch-none select-none"
						aria-label="Item anterior"
					></button>
					<!-- Right click zone -->
					<button
						onpointerdown={onStoryZonePointerDown}
						onpointerup={onStoryZonePointerUp}
						onpointercancel={onStoryZonePointerCancel}
						oncontextmenu={(e) => e.preventDefault()}
						class="flex-1 h-full opacity-0 cursor-east-resize bg-transparent border-none touch-none select-none"
						aria-label="Item siguiente"
					></button>
				</div>
			</div>

			<!-- Bottom branding -->
			<div class="p-4 z-10 flex-shrink-0 flex flex-col items-center justify-center min-h-[44px]">
				<p
					class="text-[10px] text-center font-bold tracking-wide"
					style="color: rgba(255, 255, 255, 0.5);"
				>
					Historias de VSocial • Desaparecen en 24h
				</p>
			</div>
		</div>
	</div>

	<!-- Delete Story Confirmation Modal — rendered at top level above story viewer -->
{/if}

{#if showDeleteStoryConfirm}
	<div
		class="fixed inset-0 flex items-center justify-center p-6"
		style="z-index: 9999; background: rgba(0,0,0,0.65); backdrop-filter: blur(8px);"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="w-full max-w-sm"
			style="
          background: linear-gradient(135deg, rgba(30,14,50,0.97) 0%, rgba(15,23,42,0.97) 100%);
          border: 1px solid rgba(251,113,133,0.25);
          border-radius: 1.5rem;
          padding: 2rem;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.05), 0 32px 64px rgba(0,0,0,0.6), 0 0 40px rgba(225,29,72,0.12);
          text-align: center;
        "
			transition:scale={{ duration: 220, start: 0.92 }}
		>
			<!-- Icon -->
			<div
				style="
          width: 56px; height: 56px;
          border-radius: 50%;
          background: rgba(225, 29, 72, 0.15);
          border: 1px solid rgba(251,113,133,0.3);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1.25rem;
          box-shadow: 0 0 20px rgba(225,29,72,0.2);
        "
			>
				<span class="material-icons-round" style="color: #fb7185; font-size: 26px;"
					>delete_forever</span
				>
			</div>

			<!-- Text -->
			<h3
				style="color: #fff; font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; font-family: var(--font-display);"
			>
				¿Eliminar esta historia?
			</h3>
			<p
				style="color: rgba(255,255,255,0.5); font-size: 0.82rem; line-height: 1.5; margin-bottom: 1.75rem;"
			>
				Esta acción es permanente y no se puede deshacer.
			</p>

			<!-- Buttons -->
			<div style="display: flex; gap: 0.75rem;">
				<button
					onclick={cancelDeleteStory}
					style="
              flex: 1;
              padding: 0.7rem 1rem;
              border-radius: 0.875rem;
              border: 1px solid rgba(255,255,255,0.1);
              background: rgba(255,255,255,0.06);
              color: rgba(255,255,255,0.7);
              font-weight: 600;
              font-size: 0.85rem;
              cursor: pointer;
              font-family: var(--font-display);
              transition: all 0.2s;
            "
					onmouseenter={(e) => {
						e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
						e.currentTarget.style.color = '#fff';
					}}
					onmouseleave={(e) => {
						e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
						e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
					}}
				>
					Cancelar
				</button>
				<button
					onclick={deleteCurrentStory}
					style="
              flex: 1;
              padding: 0.7rem 1rem;
              border-radius: 0.875rem;
              border: 1px solid rgba(251,113,133,0.3);
              background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
              color: #fff;
              font-weight: 700;
              font-size: 0.85rem;
              cursor: pointer;
              font-family: var(--font-display);
              box-shadow: 0 4px 16px rgba(225,29,72,0.35);
              transition: all 0.2s;
            "
					onmouseenter={(e) => {
						e.currentTarget.style.transform = 'translateY(-1px)';
						e.currentTarget.style.boxShadow = '0 6px 20px rgba(225,29,72,0.5)';
					}}
					onmouseleave={(e) => {
						e.currentTarget.style.transform = '';
						e.currentTarget.style.boxShadow = '0 4px 16px rgba(225,29,72,0.35)';
					}}
				>
					Eliminar
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Optimización de render del feed: el navegador salta layout/paint/render de los
	   wrappers fuera de pantalla (la lista se monta completa y sin techo). El `auto`
	   de contain-intrinsic-size recuerda la última altura medida de cada tarjeta para
	   evitar saltos de scroll tras la primera pasada. Invisible en desktop (lo off-screen
	   nunca se ve). */
	.feed-post-wrap {
		content-visibility: auto;
		contain-intrinsic-size: auto 600px;
	}
	.sug-creator-item:hover {
		background: var(--glass-surface);
		box-shadow: inset 0 0 0 1px var(--glass-highlight);
	}
	.text-main {
		color: var(--text-primary);
	}
	.text-muted {
		color: var(--text-muted);
	}

	.text-decoration-none {
		text-decoration: none;
	}
	.error-banner {
		background: rgba(232, 74, 114, 0.08);
		border: 1px solid rgba(232, 74, 114, 0.25);
		color: var(--aero-rose);
	}
	.cursor-pointer {
		cursor: pointer;
	}

	/* ── Composer Toolbar ── */
	.composer-toolbar {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.toolbar-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 10px;
		border-radius: 10px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.18s var(--ease-out);
		font-family: var(--font-sans);
		font-size: 0.72rem;
		font-weight: 600;
	}
	.toolbar-btn .material-icons-round {
		font-size: 20px;
		transition: color 0.18s ease;
	}
	.toolbar-label {
		display: none;
	}
	@container (min-width: 580px) {
		.toolbar-label {
			display: inline;
		}
	}
	.toolbar-btn:hover {
		background: var(--bg-overlay);
		border-color: var(--border-glass);
		transform: translateY(-1px);
	}
	.toolbar-btn:active {
		transform: scale(0.95);
	}
	/* Color-coded hover states */
	.toolbar-img:hover {
		color: var(--aero-mint);
		border-color: rgba(61, 199, 154, 0.25);
	}
	.toolbar-img:hover .material-icons-round {
		color: var(--aero-mint);
	}
	.toolbar-gif:hover {
		color: var(--aero-amber);
		border-color: rgba(232, 160, 35, 0.25);
	}
	.toolbar-gif:hover .material-icons-round {
		color: var(--aero-amber);
	}
	.toolbar-music:hover {
		color: var(--aero-indigo);
		border-color: rgba(91, 114, 204, 0.25);
	}
	.toolbar-music:hover .material-icons-round {
		color: var(--aero-indigo);
	}
	.toolbar-poll:hover {
		color: var(--aero-blue);
		border-color: rgba(46, 134, 232, 0.25);
	}
	.toolbar-poll:hover .material-icons-round {
		color: var(--aero-blue);
	}

	.feed-filter-btn:not([style*='var(--grad-primary)']):hover {
		background: var(--bg-overlay) !important;
		color: var(--aero-blue) !important;
	}

	/* Attachment previews (GIF + media files) */
	.gif-attachment-preview {
		position: relative;
		width: fit-content;
		max-width: 220px;
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid rgba(232, 121, 249, 0.3);
		box-shadow: var(--shadow-sm);
	}
	.gif-attachment-thumb {
		display: block;
		width: 100%;
		max-height: 160px;
		object-fit: cover;
	}
	.gif-attachment-label {
		position: absolute;
		bottom: 6px;
		left: 6px;
		padding: 1px 7px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.65);
		color: #fff;
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		pointer-events: none;
	}
	.media-preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
		gap: 10px;
		animation: fadeIn 0.2s ease;
	}
	.media-preview-item {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		aspect-ratio: 1;
		box-shadow: var(--shadow-sm);
		background: var(--bg-overlay);
	}
	.preview-thumb {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.media-type-badge {
		position: absolute;
		bottom: 6px;
		left: 6px;
		padding: 3px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.remove-media-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		border: none;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 0.2s;
		z-index: 2;
	}
	.remove-media-btn:hover {
		background: rgba(232, 74, 114, 0.9);
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.9);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Custom scrollbar-none utility */
	.overflow-x-auto {
		scrollbar-width: none; /* Firefox */
	}
	.overflow-x-auto::-webkit-scrollbar {
		display: none; /* Safari and Chrome */
	}

	/* Custom scrollbar for sticky sidebar */
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
	}
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: var(--scrollbar-track);
		border-radius: 10px;
		margin: 4px 0;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb);
		border-radius: 10px;
		border: none;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--scrollbar-thumb-hover);
	}

	.post-textarea-wrapper {
		position: relative;
		width: 100%;
		min-width: 0;
		flex: 1;
	}
	.post-emoji-btn {
		position: absolute;
		bottom: 8px;
		right: 8px;
		background: transparent;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		z-index: 20;
		pointer-events: auto;
		transition:
			background 0.2s,
			color 0.2s;
	}
	.post-emoji-btn:hover {
		background: rgba(255, 255, 255, 0.08);
	}
	@keyframes popUp {
		from {
			opacity: 0;
			transform: scale(0.92) translateY(6px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
</style>
