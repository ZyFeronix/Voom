<script>
	import { fade, scale, slide } from 'svelte/transition';
	import { backOut, expoOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	import {
		feed as feedApi,
		users as usersApi,
		stories as storiesApi,
		posts as postsApi
	} from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import PostCard from '$lib/components/PostCard.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import QuickChatWidget from '$lib/components/QuickChatWidget.svelte';
	import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
	import KlipyPicker from '$lib/components/KlipyPicker.svelte';
	import HashtagTextarea from '$lib/components/HashtagTextarea.svelte';
	import CheckinButton from '$lib/components/gamification/CheckinButton.svelte';
	import { compressImage } from '$lib/utils/imageCompression.js';
	import VoiceRecorder from '$lib/components/VoiceRecorder.svelte';
	import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';
	import AnonIdentityModal from '$lib/components/AnonIdentityModal.svelte';
	import { getAnonIdentity } from '$lib/stores/anonIdentity.svelte.js';

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
	let innerWidth = $state(1024);
	let leftColHeight = $state(0);

	let posts = $state([]);
	let suggestedCreators = $state([]);
	let suggestionOffset = $state(0);
	let isRotatingSug = $state(false);
	let isHoveringSug = $state(false);
	let displayedSuggestions = $derived.by(() => {
		if (!suggestedCreators.length) return [];
		if (suggestedCreators.length <= 4) return suggestedCreators;
		const list = [];
		for (let i = 0; i < 4; i++) {
			list.push(suggestedCreators[(suggestionOffset + i) % suggestedCreators.length]);
		}
		return list;
	});
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

	// ── Frutiger Aqua / Eco Algorithm State & Presets ────────────────────────
	let showAlgorithmModal = $state(false);
	let showCustomSliders = $state(false);

	const ALGO_PRESETS = [
		{
			id: 'eco',
			name: 'Eco Balance',
			icon: 'eco',
			tag: 'Recomendado',
			desc: 'Equilibrio armónico y orgánico entre novedad, tus gustos y diversidad.',
			mode: 'intelligent',
			weights: {
				interests: 50,
				interactions: 45,
				social: 35,
				popularity: 30,
				recency: 55,
				diversity: 40
			},
			color: '#10b981'
		},
		{
			id: 'fresh',
			name: 'Radar / Fresco',
			icon: 'schedule',
			tag: 'Cronológico',
			desc: 'Línea de tiempo cronológica en tiempo real con máxima frescura.',
			mode: 'radar',
			weights: {
				interests: 20,
				interactions: 20,
				social: 30,
				popularity: 10,
				recency: 95,
				diversity: 25
			},
			color: '#38bdf8'
		},
		{
			id: 'smart',
			name: 'Inteligente AI',
			icon: 'auto_awesome',
			tag: 'Predictivo',
			desc: 'Optimizado según tus interacciones y afinidad con creadores.',
			mode: 'intelligent',
			weights: {
				interests: 80,
				interactions: 70,
				social: 50,
				popularity: 35,
				recency: 40,
				diversity: 20
			},
			color: '#a855f7'
		},
		{
			id: 'viral',
			name: 'Tendencias & Viral',
			icon: 'local_fire_department',
			tag: 'Popular',
			desc: 'Lo más comentado, votado y compartido de la comunidad.',
			mode: 'intelligent',
			weights: {
				interests: 35,
				interactions: 75,
				social: 40,
				popularity: 90,
				recency: 50,
				diversity: 30
			},
			color: '#f59e0b'
		}
	];

	async function selectPreset(preset) {
		globalFeedMode = preset.mode;
		userWeights = { ...preset.weights };
		await updateWeightsAndReload();
	}

	async function resetWeights() {
		userWeights = {
			interests: 50,
			interactions: 45,
			social: 35,
			popularity: 30,
			recency: 55,
			diversity: 40
		};
		globalFeedMode = 'intelligent';
		await updateWeightsAndReload();
	}

	// Tabs and attachments
	let activeFeedArea = $state('all'); // 'all' (Para Ti), 'following' (Siguiendo), 'anonymous' (Rincón Anónimo)
	let isAnonymousPost = $state(false);
	let attachedGif = $state('');
	let attachedMusic = $state(null);
	let pollAttached = $state(false);
	let pollQuestion = $state('');
	let pollOptions = $state(['', '']);

	let myAnonUsername = $state(null);
	let anonIdentityLoaded = $state(false);
	let showAnonIdentityModal = $state(false);
	let pendingAnonPublish = $state(false);

	async function ensureAnonIdentity() {
		if (!anonIdentityLoaded) {
			const ident = await getAnonIdentity();
			myAnonUsername = ident?.anon_username || null;
			anonIdentityLoaded = true;
		}
		return myAnonUsername;
	}

	// Activa el modo anónimo (pide la identidad anónima permanente la primera vez)
	async function enableAnonMode() {
		const ident = await ensureAnonIdentity();
		if (!ident) {
			pendingAnonPublish = false;
			showAnonIdentityModal = true;
			return;
		}
		isAnonymousPost = true;
	}

	function setFeedArea(area) {
		if (activeFeedArea === area) return;
		activeFeedArea = area;
		if (area === 'anonymous') {
			isAnonymousPost = true;
			ensureAnonIdentity().then((ident) => {
				if (!ident) {
					showAnonIdentityModal = true;
				}
			});
		}
		loadPosts(true);
	}

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
	let sugRotationInterval = null;

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

		// Auto-rotate suggestions smoothly every 90 seconds (1.5 min) if user isn't hovering
		sugRotationInterval = setInterval(() => {
			if (!isHoveringSug && !document.hidden && suggestedCreators.length > 4) {
				rotateSuggestions();
			}
		}, 90000);

		// Al volver a foco tras estar oculta, dispara un poll inmediato para alcanzar posts nuevos.
		const onVisibilityChange = () => {
			if (!document.hidden) pollNewPosts();
		};
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			clearInterval(storyInterval);
			clearInterval(pollInterval);
			clearInterval(sugRotationInterval);
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
				algo: activeFeedArea === 'following' ? 'following' : globalFeedMode
			};
			if (activeFeedArea === 'following') {
				params.area = 'following';
			} else if (activeFeedArea === 'anonymous') {
				params.area = 'anonymous';
			}
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
			const params = {
				limit: 10,
				algo: activeFeedArea === 'following' ? 'following' : globalFeedMode,
				since_id: maxId
			};
			if (activeFeedArea === 'following') {
				params.area = 'following';
			} else if (activeFeedArea === 'anonymous') {
				params.area = 'anonymous';
			}
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

		if (isAnonymousPost) {
			const ident = await ensureAnonIdentity();
			if (!ident) {
				pendingAnonPublish = true;
				showAnonIdentityModal = true;
				return;
			}
		}

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
				media_urls: uploadedMedia,
				is_anonymous: isAnonymousPost ? 1 : 0
			};

			if (pollAttached && pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2) {
				payload.poll = {
					question: pollQuestion.trim(),
					options: pollOptions.filter((o) => o.trim())
				};
			}

			await postsApi.create(payload);
			if (isAnonymousPost && activeFeedArea === 'following') {
				setFeedArea('anonymous');
			} else {
				await loadPosts(true);
			}

			// Reset
			newPostText = '';
			if (activeFeedArea !== 'anonymous') {
				isAnonymousPost = false;
			}
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
			if (err?.code === 'ANON_IDENTITY_REQUIRED' || err?.message?.includes('identidad anónima')) {
				pendingAnonPublish = true;
				showAnonIdentityModal = true;
			} else {
				postError = err?.message ?? 'Error al publicar. Inténtalo de nuevo.';
			}
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
		const stepTime = 200;

		storyInterval = setInterval(() => {
			if (typeof document !== 'undefined' && document.hidden) return;
			storyElapsed += stepTime;
			storyProgress = Math.min(100, (storyElapsed / storyDuration) * 100);

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

	function rotateSuggestions() {
		if (suggestedCreators.length <= 4) return;
		isRotatingSug = true;
		suggestionOffset = (suggestionOffset + 4) % suggestedCreators.length;
		if (suggestionOffset === 0) {
			loadSuggestions().catch(() => {});
		}
		setTimeout(() => {
			isRotatingSug = false;
		}, 400);
	}
</script>

<svelte:head>
	<title>Feed - VSocial</title>
</svelte:head>

<svelte:window bind:scrollY bind:innerWidth />

<div class="feed-shell mx-auto px-4 lg:px-8 py-6">
	<div class="feed-grid grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
		<!-- Left Column (Quick Chat & Footer Links - Rock-Solid & Stable) -->
		<div class="feed-col-left hidden lg:block lg:col-span-3 h-full">
			<div
				bind:clientHeight={leftColHeight}
				class="sticky transition-all duration-300 ease-in-out space-y-4"
				style="top: 70px;"
			>
				<!-- Quick Chat Widget (Always visible) -->
				<QuickChatWidget />

				<!-- Quick stats/footer (Stable, no scroll jitter) -->
				<div class="glass-panel p-4 text-xs text-muted flex flex-col items-center text-center">
					<div class="flex flex-wrap justify-center gap-3 mb-2 font-semibold">
						<a href="/about" class="hover:text-primary transition-colors decoration-none"
							>Acerca de</a
						>
						<span class="opacity-30">•</span>
						<a href="/about" class="hover:text-primary transition-colors decoration-none">Ayuda</a>
						<span class="opacity-30">•</span>
						<a href="/privacy" class="hover:text-primary transition-colors decoration-none"
							>Privacidad</a
						>
						<span class="opacity-30">•</span>
						<a href="/terms" class="hover:text-primary transition-colors decoration-none"
							>Condiciones</a
						>
					</div>
					<p class="opacity-50 text-[10px]">© 2026 VSocial Inc.</p>
				</div>
			</div>
			<!-- close sticky wrapper -->
		</div>

		<!-- Center Column (Feed posts & Create Box) -->
		<div class="feed-col-center col-span-1 lg:col-span-6 space-y-4">
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
						style="flex: 0 0 110px; width: 110px; height: 160px; scroll-snap-align: start; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--glass-border); background-color: var(--bg-surface);"
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
							style="position: absolute; top: 94px; left: 50%; transform: translateX(-50%); width: 32px; height: 32px; border-radius: var(--radius-squircle); corner-shape: squircle; background: var(--grad-primary, linear-gradient(to top right, #22d3ee, #3b82f6)); border: 3px solid var(--bg-surface); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.4); z-index: 10;"
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
										<video
											src={userStory.items[0].media_url}
											class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
											muted
											playsinline
											preload="metadata"
										></video>
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
									style="width: 36px; height: 36px; border-radius: var(--radius-squircle); corner-shape: squircle; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid rgba(255,255,255,0.15); box-shadow: 0 2px 8px rgba(0,0,0,0.5); background: var(--grad-primary, linear-gradient(to top right, #22d3ee, #3b82f6));"
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
									style="width:44px;height:44px;border-radius: var(--radius-squircle); corner-shape: squircle;background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.2);display:flex;align-items:center;justify-content:center;margin-bottom:0.75rem;"
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

			<!-- Create Post Box / Modern Creator Studio -->
			{#if authStore.isAuthenticated}
				<div
					class="composer-card p-4 sm:p-5 mb-5 relative"
					style="position: relative; z-index: {showEmojis ||
					showGifModal ||
					showMediaModal ||
					showMusicModal ||
					showPollModal ||
					showVoiceModal
						? 50
						: 10};"
				>
					<form onsubmit={handleCreatePost} class="flex flex-col">
						{#if postError}
							<div
								class="flex items-start gap-2 p-3 rounded-xl error-banner text-xs font-semibold mb-3"
							>
								<span class="material-icons-round text-sm shrink-0">error_outline</span>
								<span>{postError}</span>
							</div>
						{/if}

						{#if isAnonymousPost}
							<div
								class="anon-mode-pill flex items-center justify-between p-2.5 rounded-xl mb-3"
								transition:slide={{ duration: 300 }}
							>
								<div class="flex items-center gap-2 text-xs font-semibold">
									<span class="material-icons-round anon-icon text-base">theater_comedy</span>
									<span class="anon-mode-text">
										<strong>Modo Anónimo Activo:</strong> Tu nombre y avatar no serán visibles para la
										comunidad.
									</span>
								</div>
								{#if myAnonUsername}
									<span class="anon-composer-identity" title="Tu identidad anónima permanente">
										<span class="material-icons-round" style="font-size:13px">masks</span>
										Publicarás como @{myAnonUsername}
									</span>
								{/if}
								<button
									type="button"
									class="anon-mode-deactivate"
									onclick={() => (isAnonymousPost = false)}
								>
									Desactivar
								</button>
							</div>
						{/if}

						<!-- Composer Header: User identity + Privacy Selector -->
						<div class="composer-user-row flex items-center justify-between gap-3 mb-3">
							<div class="flex items-center gap-3">
								{#if isAnonymousPost}
									<div
										class="anon-composer-avatar"
										title="Modo Anónimo Activo"
										style="flex: 0 0 44px; min-width: 44px; min-height: 44px;"
									>
										<span class="material-icons-round text-lg">visibility_off</span>
									</div>
								{:else if authStore.user?.avatar_url}
									<img
										src={authStore.user.avatar_url}
										alt={authStore.user.username}
										class="composer-user-avatar w-11 h-11 squircle object-cover"
										style="flex: 0 0 44px; min-width: 44px; min-height: 44px;"
										width="44"
										height="44"
										loading="lazy"
										decoding="async"
									/>
								{:else}
									<div
										class="vs-avatar-letter avatar-md composer-user-avatar"
										style="flex: 0 0 44px; min-width: 44px; min-height: 44px;"
									>
										{(authStore.user?.display_name ||
											authStore.user?.username ||
											'?')[0].toUpperCase()}
									</div>
								{/if}

								<div class="flex flex-col">
									<div class="flex items-center gap-1.5 font-bold text-xs text-main">
										{#if isAnonymousPost}
											<span class="anon-user-title">Publicación Anónima</span>
										{:else}
											<span class="truncate max-w-[180px] sm:max-w-[240px]">
												{authStore.user?.display_name || authStore.user?.username}
											</span>
											{#if authStore.user?.is_verified}
												<VerifiedBadge />
											{/if}
										{/if}
									</div>

									<button
										type="button"
										class="composer-privacy-btn flex items-center gap-1 mt-0.5"
										class:anon={isAnonymousPost}
										onclick={() => (isAnonymousPost ? (isAnonymousPost = false) : enableAnonMode())}
										title="Alternar entre modo Público y Anónimo"
									>
										{#if isAnonymousPost}
											<span class="material-icons-round text-[13px] anon-privacy-icon"
												>theater_comedy</span
											>
											<span>100% Anónimo</span>
										{:else}
											<span class="material-icons-round text-[13px] text-cyan-400">public</span>
											<span>Público</span>
										{/if}
										<span class="material-icons-round text-[13px] opacity-60">swap_horiz</span>
									</button>
								</div>
							</div>

							{#if isAnonymousPost}
								<div
									class="anon-active-tag hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
								>
									<span class="anon-pulse-dot"></span>
									<span>Secreto</span>
								</div>
							{/if}
						</div>

						<!-- Input Box -->
						<div class="composer-input-wrapper mb-3">
							<HashtagTextarea
								id="new_post_text"
								bind:value={newPostText}
								onkeydown={handleKeyDown}
								placeholder={isAnonymousPost
									? '¿Qué secreto o confesión quieres compartir anónimamente?'
									: composerPlaceholder}
								rows={3}
								class="feed-post-composer-input"
							/>
						</div>

						<!-- Attachments Display -->
						{#if attachedGif}
							<div
								class="gif-attachment-preview self-start mb-3"
								transition:slide={{ duration: 300, easing: expoOut }}
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
							<div class="media-preview-grid mb-3">
								{#each selectedFiles as item, idx}
									<div class="media-preview-item">
										{#if item.file.type.startsWith('video/')}
											<video
												src={item.previewUrl}
												class="preview-thumb"
												muted
												playsinline
												preload="metadata"
											></video>
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
								class="flex flex-col gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 self-start w-full max-w-sm mb-3"
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
								class="composer-attached-music flex items-center gap-1.5 p-2 rounded-xl text-xs font-bold self-start mb-3"
							>
								<span class="material-icons-round text-sm">music_note</span>
								<span>Audio: {attachedMusic.title} - {attachedMusic.artist}</span>
								<button
									type="button"
									class="bg-transparent border-none cursor-pointer text-muted hover:text-main"
									onclick={() => (attachedMusic = null)}
								>
									<span class="material-icons-round text-[10px]">close</span>
								</button>
							</div>
						{/if}

						{#if attachedVoiceNote}
							<div
								class="flex items-center gap-1.5 p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-xs font-bold text-cyan-400 self-start mb-3"
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

						<!-- Bottom Bar: Toolbar & Action Buttons -->
						<div
							class="composer-bottom-bar flex flex-wrap items-center justify-between gap-2 pt-3 border-t relative"
							style="border-top-color: var(--border-glass);"
						>
							<div class="composer-tools flex items-center gap-1 flex-wrap">
								<button
									type="button"
									class="tool-btn tool-media"
									title="Añadir fotos o videos"
									onclick={toggleMediaPanel}
								>
									<span class="material-icons-round">image</span>
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
									class="tool-btn tool-gif"
									title="Añadir GIF animado"
									onclick={toggleGifPanel}
								>
									<span class="material-icons-round">gif_box</span>
								</button>

								<button
									type="button"
									class="tool-btn tool-emoji"
									title="Emojis y Stickers"
									onclick={toggleEmojiPanel}
								>
									<span class="material-icons-round">mood</span>
								</button>

								<button
									type="button"
									class="tool-btn tool-poll"
									title="Crear Encuesta"
									onclick={togglePollPanel}
								>
									<span class="material-icons-round">poll</span>
								</button>

								<button
									type="button"
									class="tool-btn tool-voice"
									title="Nota de Voz"
									onclick={toggleVoicePanel}
								>
									<span class="material-icons-round">mic</span>
								</button>

								<button
									type="button"
									class="tool-btn tool-anon"
									class:active={isAnonymousPost}
									title="Publicar como Anónimo"
									onclick={() => (isAnonymousPost ? (isAnonymousPost = false) : enableAnonMode())}
								>
									<span class="material-icons-round">visibility_off</span>
								</button>
							</div>

							<div class="composer-actions flex items-center gap-2 ml-auto">
								<a
									href="/posts/create"
									class="tool-btn-advanced"
									title="Editor Avanzado con fondos y opciones completas"
								>
									<span class="material-icons-round text-base">tune</span>
								</a>

								<button
									type="submit"
									disabled={posting ||
										(!newPostText.trim() &&
											selectedFiles.length === 0 &&
											!pollAttached &&
											!attachedGif &&
											!attachedVoiceNote)}
									class="composer-publish-btn flex items-center gap-1.5"
								>
									{#if posting}
										<span class="material-icons-round text-sm animate-spin">sync</span>
										<span>Publicando</span>
									{:else}
										<span>Publicar</span>
										<span class="material-icons-round text-sm">send</span>
									{/if}
								</button>
							</div>
						</div>

						<!-- Inline Modals -->
						{#if showVoiceModal}
							<div
								transition:slide={{ duration: 300, easing: expoOut }}
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
							<div transition:slide={{ duration: 300, easing: expoOut }} class="mt-3">
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
							<div transition:slide={{ duration: 300, easing: expoOut }} class="mt-3">
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
							<div transition:slide={{ duration: 300, easing: expoOut }} class="mt-3">
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

						{#if showPollModal}
							<div transition:slide={{ duration: 300, easing: expoOut }} class="mt-3">
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
				</div>
			{/if}

			<!-- Feed Area Navigation Tabs & Frutiger Aqua Algorithm Pill -->
			<div class="feed-area-nav mb-4 hide-scrollbar">
				<button
					type="button"
					class="feed-area-btn flex-1"
					class:active={activeFeedArea === 'all'}
					onclick={() => setFeedArea('all')}
				>
					<span class="material-icons-round text-base tab-icon">auto_awesome</span>
					<span>Para Ti</span>
				</button>
				<button
					type="button"
					class="feed-area-btn feed-area-following flex-1"
					class:active={activeFeedArea === 'following'}
					onclick={() => setFeedArea('following')}
				>
					<span class="material-icons-round text-base tab-icon">people</span>
					<span>Siguiendo</span>
				</button>
				<button
					type="button"
					class="feed-area-btn feed-area-anon flex-1"
					class:active={activeFeedArea === 'anonymous'}
					onclick={() => setFeedArea('anonymous')}
				>
					<span class="material-icons-round text-base tab-icon">theater_comedy</span>
					<span>Rincón Anónimo</span>
					<span class="anon-mini-badge hidden sm:inline-flex">Anónimo</span>
				</button>

				<div class="feed-nav-divider" aria-hidden="true"></div>

				<!-- Frutiger Aqua Algorithm Quick Pill -->
				<button
					type="button"
					class="aqua-algo-btn"
					class:active={showAlgorithmModal}
					onclick={() => (showAlgorithmModal = true)}
					title="Sintonizador de Algoritmo (Frutiger Aqua/Eco)"
				>
					<span class="material-icons-round text-base aqua-icon">water_drop</span>
					<span class="hidden sm:inline">Algoritmo</span>
					<span class="aqua-chip-badge">
						{#if globalFeedMode === 'radar'}
							Radar
						{:else if userWeights.recency >= 80}
							Fresco
						{:else if userWeights.popularity >= 75}
							Viral
						{:else if userWeights.interests >= 70}
							AI
						{:else}
							Eco
						{/if}
					</span>
				</button>
			</div>

			{#if activeFeedArea === 'anonymous'}
				<!-- Anonymous Area Hero Banner -->
				<div
					class="anon-area-hero glass-panel p-4 mb-4 relative overflow-hidden"
					transition:slide={{ duration: 400, easing: expoOut }}
				>
					<div
						class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10"
					>
						<div class="flex items-center gap-3">
							<div class="anon-hero-icon shrink-0">
								<span class="material-icons-round text-2xl">theater_comedy</span>
							</div>
							<div>
								<h3 class="text-sm font-bold text-main flex items-center gap-2">
									Rincón Anónimo
									<span class="anon-badge text-[9px] py-0.5 px-2">100% Anónimo</span>
								</h3>
								<p class="text-xs text-muted">
									Preguntas, secretos y confesiones sin revelar tu identidad. Tu post se publica de
									forma pública, con un username anónimo exclusivo. Respeta a la comunidad.
								</p>
							</div>
						</div>
						<button
							type="button"
							class="btn-aero-primary text-xs py-1.5 px-3 shrink-0 flex items-center gap-1.5 ml-auto sm:ml-0"
							onclick={async () => {
								await enableAnonMode();
								if (isAnonymousPost) {
									const textarea = document.getElementById('new_post_text');
									if (textarea) {
										textarea.focus();
										textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
									}
								}
							}}
						>
							<span class="material-icons-round text-sm">edit_note</span>
							<span>Publicar Secreto</span>
						</button>
					</div>
				</div>
			{/if}

			<!-- Feed Posts -->
			<div class="space-y-4">
				{#if loading}
					<!-- Skeleton Loading -->
					{#each Array(3) as _}
						<div class="glass-panel p-5 space-y-4 animate-pulse">
							<div class="flex gap-3">
								<div class="w-10 h-10 squircle bg-white/40"></div>
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
						<div class="feed-post-wrap" in:fade={{ duration: 150 }}>
							<PostCard {post} onDelete={handlePostDeleted} />
						</div>
					{/each}

					<!-- Load More / Sentinel -->
					{#if hasMore}
						<div class="text-center py-6" use:infiniteScroll>
							{#if postsLoading}
								<div
									class="inline-block px-5 py-2.5 rounded-full"
									style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);"
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
		<div class="feed-col-right hidden lg:block lg:col-span-3 h-full">
			<div
				class="sticky transition-all duration-300 ease-in-out flex flex-col gap-4"
				style="top: 70px; {leftColHeight ? `height: ${leftColHeight}px;` : ''}"
			>
				<!-- Gamification Checkin (solo si el botón realmente se va a mostrar) -->
				{#if gamificationEnabled && authStore.isAuthenticated && checkinState.loaded && checkinState.canCheckin}
					<div
						class="transition-all duration-500 ease-in-out overflow-hidden flex-shrink-0"
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
				<div class="glass-panel p-4 flex-shrink-0">
					<h3 class="text-xs font-bold uppercase tracking-wider text-muted mb-3 px-0.5">
						Tendencias hoy
					</h3>

					<div class="space-y-2.5">
						{#each trendingTags.slice(0, 3) as tag}
							<div class="group cursor-pointer">
								<a href="/explore?q=%23{tag.tag}" class="block text-decoration-none">
									<p
										class="font-bold text-sm text-main hover:text-blue-500 transition leading-snug"
									>
										#{tag.tag}
									</p>
									<p class="text-[10px] text-muted mt-0.5 leading-snug">
										{tag.posts.toLocaleString()} publicaciones
									</p>
								</a>
							</div>
						{/each}
					</div>
				</div>

				<!-- Sugerencias Card -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="glass-panel p-4 relative group/sug sug-card flex-1 flex flex-col min-h-0"
					onmouseenter={() => (isHoveringSug = true)}
					onmouseleave={() => (isHoveringSug = false)}
				>
					<!-- Luces volumétricas de fondo (adaptables por opacidad) -->
					<div
						class="absolute -top-10 -right-10 w-40 h-40 squircle blur-3xl opacity-20 dark:opacity-10 transition-all duration-700 group-hover/sug:opacity-30 group-hover/sug:scale-110"
						style="background: var(--primary); z-index: 0; pointer-events: none;"
					></div>
					<div
						class="absolute -bottom-10 -left-10 w-40 h-40 squircle blur-3xl opacity-15 dark:opacity-5 transition-all duration-700 group-hover/sug:opacity-25 group-hover/sug:scale-110"
						style="background: var(--aero-sky); z-index: 0; pointer-events: none;"
					></div>

					<div
						class="flex justify-between items-center mb-3 relative z-10 flex-shrink-0"
						style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;"
					>
						<h3
							class="text-xs font-black uppercase tracking-widest flex items-center gap-2"
							style="color: var(--text-main);"
						>
							<span class="material-icons-round text-sm" style="color: var(--primary);"
								>auto_awesome</span
							> Sugerencias
						</h3>
						<div class="flex items-center gap-1.5">
							{#if suggestedCreators.length > 4}
								<button
									type="button"
									onclick={rotateSuggestions}
									class="p-1 rounded-full transition-all hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer"
									style="background: var(--glass-surface); border: 1px solid var(--glass-border); color: var(--text-muted); width: 24px; height: 24px;"
									title="Rotar sugerencias"
									aria-label="Rotar sugerencias"
								>
									<span
										class="material-icons-round text-xs transition-transform duration-500 {isRotatingSug
											? 'rotate-180 text-primary'
											: ''}"
										style="display: inline-block;"
									>
										autorenew
									</span>
								</button>
							{/if}
							<a
								href="/explore"
								class="text-[10px] font-bold uppercase px-3 py-1 rounded-full transition-all hover:scale-105"
								style="background: var(--glass-surface); border: 1px solid var(--glass-border); color: var(--text-primary);"
								>Ver más</a
							>
						</div>
					</div>

					<div class="sug-list relative z-10 flex-1 min-h-0 overflow-y-auto">
						{#each displayedSuggestions as creator (creator.id || creator.username)}
							<div
								class="sug-creator-item flex items-center justify-between gap-2.5 p-2 -mx-1.5 rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer flex-shrink-0"
								in:fade={{ duration: 250 }}
							>
								<a
									href="/u/{creator.username}"
									class="flex items-center gap-2.5 min-w-0 text-decoration-none flex-1"
								>
									<div
										class="relative flex-shrink-0"
										style="flex: 0 0 40px; min-width: 40px; min-height: 40px; width: 40px; height: 40px;"
									>
										{#if creator.avatar_url}
											<img
												src={creator.avatar_url}
												alt={creator.username}
												class="w-10 h-10 squircle object-cover shadow-sm transition-transform hover:scale-105 flex-shrink-0"
												style="width: 40px; height: 40px; border: 2px solid var(--glass-border);"
												width="40"
												height="40"
												loading="lazy"
												decoding="async"
											/>
										{:else}
											<div
												class="w-10 h-10 squircle flex items-center justify-center flex-shrink-0 shadow-sm transition-transform hover:scale-105"
												style="width: 40px; height: 40px; min-width: 40px; min-height: 40px; background: var(--grad-primary); border: 2px solid var(--glass-highlight);"
											>
												<span class="text-white font-black text-xs drop-shadow-md">
													{creator.display_name
														? creator.display_name[0].toUpperCase()
														: creator.username[0].toUpperCase()}
												</span>
											</div>
										{/if}
									</div>
									<div class="min-w-0 flex-1">
										<p
											class="font-bold text-[13px] truncate transition-colors leading-snug"
											style="color: var(--text-main);"
										>
											{creator.display_name || creator.username}
										</p>
										<p
											class="text-[11px] truncate leading-snug"
											style="color: var(--text-muted); font-weight: 500;"
										>
											@{creator.username}
										</p>
									</div>
								</a>
								<button
									onclick={() => toggleFollowSuggested(creator.username)}
									class="btn-aero-primary {creator.is_following ? 'following' : ''} flex-shrink-0"
									style="padding: 0 10px; height: 30px; font-size: 0.72rem; min-width: 78px;"
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
								class="h-full bg-white"
								style="width: {i < selectedStoryIndex
									? 100
									: i === selectedStoryIndex
										? storyProgress
										: 0}%; transition: width 200ms linear;"
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
								class="w-8 h-8 squircle object-cover border border-white/20"
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
							? 'background:rgba(0,0,0,0.6);backdrop-filter:blur(10px);padding:10px 18px;border-radius: var(--radius-sm);border:1px solid rgba(255,255,255,0.12);'
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
          border-radius: var(--radius-squircle); corner-shape: squircle;
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

<AnonIdentityModal
	open={showAnonIdentityModal}
	onClose={() => {
		showAnonIdentityModal = false;
		pendingAnonPublish = false;
	}}
	onCreated={(username) => {
		myAnonUsername = username;
		anonIdentityLoaded = true;
		showAnonIdentityModal = false;
		if (pendingAnonPublish) {
			pendingAnonPublish = false;
			isAnonymousPost = true;
		}
	}}
/>

<!-- Frutiger Aqua / Eco Algorithm Tuner Modal -->
{#if showAlgorithmModal}
	<div
		class="aqua-modal-backdrop"
		transition:fade={{ duration: 200 }}
		onclick={(e) => {
			if (e.target === e.currentTarget) showAlgorithmModal = false;
		}}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onkeydown={(e) => {
			if (e.key === 'Escape') showAlgorithmModal = false;
		}}
	>
		<div
			class="aqua-modal-card custom-scrollbar"
			transition:scale={{ duration: 240, start: 0.94, easing: backOut }}
		>
			<!-- Aqua Glossy Header -->
			<div class="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-cyan-500/20">
				<div class="flex items-center gap-2.5">
					<div class="aqua-modal-icon-badge">
						<span class="material-icons-round text-xl text-cyan-400">water_drop</span>
					</div>
					<div>
						<h2 class="text-sm font-bold text-main flex items-center gap-1.5 font-display">
							Sintonizador de Algoritmo
							<span class="aqua-eco-tag">Frutiger Aqua</span>
						</h2>
						<p class="text-[11px] text-muted">
							Personaliza el flujo y balance de contenido de tu Para Ti
						</p>
					</div>
				</div>
				<button
					type="button"
					class="aqua-close-btn"
					onclick={() => (showAlgorithmModal = false)}
					aria-label="Cerrar"
				>
					<span class="material-icons-round text-base">close</span>
				</button>
			</div>

			<!-- Presets Section -->
			<div class="space-y-2 mb-4">
				<div
					class="text-[10px] font-bold uppercase tracking-wider text-muted px-1 flex items-center gap-1.5"
				>
					<span class="material-icons-round text-xs text-cyan-400">tune</span>
					Modos & Presets de Feed
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
					{#each ALGO_PRESETS as preset}
						{@const isSelected =
							(preset.mode === 'radar' && globalFeedMode === 'radar') ||
							(preset.id === 'eco' &&
								globalFeedMode === 'intelligent' &&
								userWeights.interests === 50 &&
								userWeights.recency === 55) ||
							(preset.id === 'smart' &&
								globalFeedMode === 'intelligent' &&
								userWeights.interests === 80) ||
							(preset.id === 'viral' &&
								globalFeedMode === 'intelligent' &&
								userWeights.popularity === 90)}
						<button
							type="button"
							class="aqua-preset-card"
							class:active={isSelected}
							onclick={() => selectPreset(preset)}
						>
							<div class="flex items-center justify-between mb-1">
								<span
									class="flex items-center gap-1.5 font-bold text-xs"
									style="color: {preset.color};"
								>
									<span class="material-icons-round text-sm">{preset.icon}</span>
									{preset.name}
								</span>
								{#if isSelected}
									<span class="active-dot"></span>
								{:else}
									<span
										class="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-muted font-semibold"
									>
										{preset.tag}
									</span>
								{/if}
							</div>
							<p class="text-[10px] text-muted leading-tight m-0">
								{preset.desc}
							</p>
						</button>
					{/each}
				</div>
			</div>

			<!-- Custom Weight Sliders Collapsible (Frutiger Aqua) -->
			<div class="aqua-custom-box mb-4">
				<button
					type="button"
					class="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-main bg-transparent border-none cursor-pointer hover:bg-white/5 transition"
					onclick={() => (showCustomSliders = !showCustomSliders)}
				>
					<span class="flex items-center gap-1.5 text-cyan-400">
						<span class="material-icons-round text-sm">tune</span>
						<span>Ajuste Fino de Porcentajes</span>
					</span>
					<span
						class="material-icons-round text-sm text-muted transition-transform duration-200"
						style="transform: rotate({showCustomSliders ? '180deg' : '0deg'});"
					>
						expand_more
					</span>
				</button>

				{#if showCustomSliders}
					<div class="pt-2 px-1 space-y-2.5" transition:slide={{ duration: 250 }}>
						{#each [{ id: 'interests', label: 'Intereses / Temas', color: '#06B6D4' }, { id: 'interactions', label: 'Interacción / Likes', color: '#10B981' }, { id: 'social', label: 'Círculo Social', color: '#8B5CF6' }, { id: 'popularity', label: 'Popularidad / Viral', color: '#F59E0B' }, { id: 'recency', label: 'Novedad / Reciente', color: '#3B82F6' }, { id: 'diversity', label: 'Diversidad / Descubrimiento', color: '#EC4899' }] as stat}
							<div class="flex flex-col gap-1 group">
								<div
									class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider px-1"
								>
									<span class="flex items-center gap-1.5 text-muted">
										<span
											class="w-2 h-2 squircle"
											style="background: {stat.color}; box-shadow: 0 0 6px {stat.color};"
										></span>
										{stat.label}
									</span>
									<span class="font-mono text-[10px] font-bold" style="color: {stat.color};">
										{userWeights[stat.id]}%
									</span>
								</div>
								<div class="aqua-slider-track">
									<div
										class="aqua-slider-fill"
										style="width: {userWeights[
											stat.id
										]}%; background: {stat.color}; box-shadow: 0 0 8px {stat.color};"
									></div>
									<input
										type="range"
										min="0"
										max="100"
										value={userWeights[stat.id]}
										oninput={(e) => {
											userWeights[stat.id] = parseInt(e.target.value);
										}}
										onchange={updateWeightsAndReload}
										class="aqua-range-input"
									/>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Modal Footer: Reset, Link to /settings, and Done -->
			<div
				class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-cyan-500/20"
			>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="aqua-text-btn"
						onclick={resetWeights}
						title="Restablecer a valores óptimos de fábrica"
					>
						<span class="material-icons-round text-xs">restart_alt</span>
						<span>Restablecer</span>
					</button>
					<a
						href="/settings"
						class="aqua-text-btn text-decoration-none"
						onclick={() => (showAlgorithmModal = false)}
					>
						<span class="material-icons-round text-xs">settings</span>
						<span>Ajustes Completos</span>
					</a>
				</div>

				<button
					type="button"
					class="btn-aero-primary text-xs py-1.5 px-4 shadow-md font-bold"
					onclick={() => (showAlgorithmModal = false)}
				>
					Listo
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.feed-post-wrap {
		position: relative;
	}

	.feed-col-right .sticky {
		min-height: 500px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.sug-card {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.sug-list {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.25rem;
		overflow-y: auto;
	}
	.sug-list::-webkit-scrollbar {
		width: 4px;
	}
	.sug-list::-webkit-scrollbar-track {
		background: transparent;
	}
	.sug-list::-webkit-scrollbar-thumb {
		background: rgba(14, 165, 233, 0.25);
		border-radius: var(--radius-sm);
	}
	.sug-list::-webkit-scrollbar-thumb:hover {
		background: rgba(14, 165, 233, 0.5);
	}
	:global([data-theme='dark']) .sug-list::-webkit-scrollbar-thumb,
	:global([data-theme='midnight']) .sug-list::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.15);
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

	/* ── Modern Creator Studio (Composer Card) ── */
	.composer-card {
		position: relative;
		background: var(--bg-surface);
		border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.12));
		backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2));
		-webkit-backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2));
		border-radius: var(--radius-xl, 22px);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.12),
			var(--glass-inset-highlight);
		transition:
			border-color 0.25s var(--ease-out),
			box-shadow 0.25s var(--ease-out);
	}
	.composer-card:focus-within {
		border-color: rgba(27, 133, 243, 0.4);
		box-shadow:
			0 10px 36px rgba(27, 133, 243, 0.12),
			var(--glass-inset-highlight);
	}

	.composer-user-avatar {
		border: 2px solid rgba(255, 255, 255, 0.15);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transition: transform 0.2s var(--ease-out);
	}
	.composer-user-avatar:hover {
		transform: scale(1.05);
	}

	.anon-composer-avatar {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(168, 85, 247, 0.14) 100%)
		);
		border: 2px solid var(--anon-border, rgba(168, 85, 247, 0.3));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--anon-accent, #818cf8);
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12);
		flex-shrink: 0;
	}

	.anon-user-title {
		color: var(--anon-text, #4338ca);
	}

	.anon-privacy-icon {
		color: var(--anon-accent, #6366f1);
	}

	.composer-privacy-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: var(--radius-full, 9999px);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-muted);
		background: var(--bg-overlay, rgba(255, 255, 255, 0.05));
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
		width: fit-content;
	}
	.composer-privacy-btn:hover {
		color: var(--text-primary);
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.1));
		border-color: var(--border-subtle);
	}
	.composer-privacy-btn.anon {
		color: var(--anon-text, #4338ca);
		background: var(--anon-bg, rgba(99, 102, 241, 0.1));
		border-color: var(--anon-border, rgba(168, 85, 247, 0.25));
	}

	.anon-active-tag {
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.1) 100%)
		);
		border: 1px solid var(--anon-border, rgba(168, 85, 247, 0.25));
		color: var(--anon-text, #4338ca);
		box-shadow: 0 1px 4px rgba(99, 102, 241, 0.1);
	}
	.anon-pulse-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full, 9999px);
		background: var(--anon-accent, #818cf8);
	}

	.anon-mode-pill {
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.06) 100%)
		);
		border: 1px solid var(--anon-border, rgba(99, 102, 241, 0.22));
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.06);
	}
	.anon-mode-text {
		color: var(--anon-text, var(--text-secondary));
	}
	.anon-mode-pill .anon-icon {
		color: var(--anon-accent, #4f46e5);
	}
	.anon-mode-deactivate {
		font-size: 0.75rem;
		color: var(--anon-text, #4f46e5);
		background: transparent;
		border: none;
		cursor: pointer;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: var(--radius-xs);
		transition: all 0.15s ease;
	}
	.anon-mode-deactivate:hover {
		color: var(--text-primary);
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.1));
	}
	.anon-composer-identity {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 10px;
		border-radius: var(--radius-full);
		background: var(--anon-bg, rgba(99, 102, 241, 0.1));
		border: 1px solid var(--anon-border, rgba(129, 140, 248, 0.25));
		color: var(--anon-text, #4338ca);
		font-size: 0.72rem;
		font-weight: 700;
	}

	.composer-attached-music {
		background: var(--anon-bg, rgba(99, 102, 241, 0.12));
		border: 1px solid var(--anon-border, rgba(99, 102, 241, 0.35));
		color: var(--anon-text, #4338ca);
	}

	/* ── Textarea Input Box ── */
	.composer-input-wrapper {
		position: relative;
		border-radius: var(--radius-md, 14px);
		background: var(--bg-overlay, rgba(255, 255, 255, 0.03));
		border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.08));
		box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.08);
		transition: all 0.2s var(--ease-out);
		overflow: hidden;
	}
	.composer-input-wrapper:focus-within {
		background: var(--bg-surface, rgba(255, 255, 255, 0.05));
		border-color: rgba(27, 133, 243, 0.4);
		box-shadow:
			0 0 0 3px rgba(27, 133, 243, 0.12),
			inset 0 1px 3px rgba(0, 0, 0, 0.05);
	}
	:global(.composer-input-wrapper .hashtag-wrapper) {
		width: 100%;
		min-height: 80px;
	}
	:global(.composer-input-wrapper .hashtag-backdrop),
	:global(.composer-input-wrapper .hashtag-input) {
		padding: 12px 14px !important;
		font-size: 0.95rem !important;
		line-height: 1.55 !important;
	}

	/* ── Toolbar Icon Buttons ── */
	.composer-tools {
		display: flex;
		align-items: center;
		gap: 3px;
	}
	.tool-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}
	.tool-btn .material-icons-round {
		font-size: 20px;
		transition:
			transform 0.2s var(--ease-spring),
			color 0.2s ease;
	}
	.tool-btn:hover {
		transform: translateY(-2px) scale(1.08);
		background: var(--bg-surface-hover, var(--bg-overlay));
		border-color: var(--border-subtle);
	}
	.tool-btn:active {
		transform: scale(0.92);
	}

	/* Hover colors */
	.tool-media:hover {
		color: var(--aero-mint, #00d4aa);
		border-color: rgba(0, 212, 170, 0.35);
		background: rgba(0, 212, 170, 0.1);
	}
	.tool-gif:hover {
		color: var(--aero-amber, #f5a623);
		border-color: rgba(245, 166, 35, 0.35);
		background: rgba(245, 166, 35, 0.1);
	}
	.tool-emoji:hover {
		color: var(--aero-sky, #2eb4ff);
		border-color: rgba(46, 180, 255, 0.35);
		background: rgba(46, 180, 255, 0.1);
	}
	.tool-poll:hover {
		color: var(--aero-blue, #1b85f3);
		border-color: rgba(27, 133, 243, 0.35);
		background: rgba(27, 133, 243, 0.1);
	}
	.tool-voice:hover {
		color: var(--accent-blue-base, #1b85f3);
		border-color: rgba(27, 133, 243, 0.35);
		background: rgba(27, 133, 243, 0.1);
	}

	.tool-anon:hover {
		color: var(--anon-accent-hover, #6366f1);
		border-color: var(--anon-border, rgba(99, 102, 241, 0.4));
		background: var(--anon-bg, rgba(99, 102, 241, 0.12));
	}
	.tool-anon.active {
		color: var(--anon-text, #4338ca);
		border-color: var(--anon-border-active, rgba(168, 85, 247, 0.5));
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.2) 100%)
		);
		box-shadow: 0 2px 12px rgba(99, 102, 241, 0.25);
	}

	.tool-btn-advanced {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
		background: var(--bg-overlay, rgba(255, 255, 255, 0.05));
		color: var(--text-muted);
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}
	.tool-btn-advanced:hover {
		color: var(--text-primary);
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.1));
		border-color: var(--border-subtle);
		transform: translateY(-1.5px);
	}
	.tool-btn-advanced:active {
		transform: scale(0.92);
	}

	/* ── Publish Button ── */
	.composer-publish-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 20px;
		border-radius: var(--radius-full, 9999px);
		border: 1px solid rgba(255, 255, 255, 0.35);
		background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%);
		color: #ffffff;
		font-family: var(--font-sans);
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		cursor: pointer;
		box-shadow:
			0 4px 18px rgba(14, 165, 233, 0.35),
			inset 0 1px 1px rgba(255, 255, 255, 0.4);
		transition: all 0.2s var(--ease-spring);
	}
	.composer-publish-btn:hover:not(:disabled) {
		transform: translateY(-1.5px);
		box-shadow:
			0 6px 24px rgba(14, 165, 233, 0.45),
			inset 0 1px 1px rgba(255, 255, 255, 0.6);
		filter: brightness(1.06);
	}
	.composer-publish-btn:active:not(:disabled) {
		transform: scale(0.96);
	}
	.composer-publish-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		filter: grayscale(0.5);
		box-shadow: none;
	}

	/* ── Feed Area Nav Tabs (Segmented Control) ── */
	.feed-area-nav {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur, blur(14px) saturate(1.2));
		-webkit-backdrop-filter: var(--glass-blur, blur(14px) saturate(1.2));
		border-radius: var(--radius-xl, 20px);
		box-shadow: var(--shadow-sm, 0 4px 16px rgba(0, 0, 0, 0.04)), var(--glass-inset-highlight);
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	.feed-area-nav::-webkit-scrollbar {
		display: none;
	}

	.feed-area-btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 38px;
		padding: 0 14px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-lg, 14px);
		color: var(--text-secondary);
		cursor: pointer;
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 0.8125rem;
		white-space: nowrap;
		user-select: none;
		transition:
			background 0.2s var(--ease-out),
			border-color 0.2s var(--ease-out),
			color 0.2s var(--ease-out),
			box-shadow 0.2s var(--ease-out),
			transform 0.15s var(--ease-spring);
	}
	.feed-area-btn .tab-icon {
		font-size: 18px;
		line-height: 1;
		color: var(--icon-muted);
		transition:
			transform 0.2s var(--ease-spring),
			color 0.2s ease,
			filter 0.2s ease;
	}

	.feed-area-btn:not(.active):hover {
		color: var(--text-primary);
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.06));
		border-color: transparent;
	}
	.feed-area-btn:not(.active):hover .tab-icon {
		color: var(--text-primary);
		transform: scale(1.1);
	}
	.feed-area-btn:active {
		transform: scale(0.98);
	}

	/* Active Tab States */
	.feed-area-btn.active {
		font-weight: 700;
		color: var(--text-primary);
		background: linear-gradient(
			135deg,
			rgba(var(--accent-blue-rgb), 0.16) 0%,
			rgba(46, 180, 255, 0.1) 100%
		);
		border-color: rgba(var(--accent-blue-rgb), 0.32);
		box-shadow:
			0 2px 8px rgba(var(--accent-blue-rgb), 0.18),
			var(--glass-inset-highlight);
	}
	.feed-area-btn.active .tab-icon {
		color: var(--accent-blue-base, #1b85f3);
		filter: drop-shadow(0 0 6px rgba(var(--accent-blue-rgb), 0.4));
	}
	.feed-area-btn.active:hover {
		filter: brightness(1.06);
	}

	.feed-area-btn.feed-area-following.active {
		background: linear-gradient(135deg, rgba(0, 212, 170, 0.16) 0%, rgba(14, 165, 233, 0.1) 100%);
		border-color: rgba(0, 212, 170, 0.35);
		color: var(--text-primary);
		box-shadow:
			0 2px 8px rgba(0, 212, 170, 0.18),
			var(--glass-inset-highlight);
	}
	.feed-area-btn.feed-area-following.active .tab-icon {
		color: #00d4aa;
		filter: drop-shadow(0 0 6px rgba(0, 212, 170, 0.4));
	}

	.feed-area-btn.feed-area-anon.active {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%);
		border-color: rgba(168, 85, 247, 0.35);
		color: var(--text-primary);
		box-shadow:
			0 2px 8px rgba(168, 85, 247, 0.2),
			var(--glass-inset-highlight);
	}
	.feed-area-btn.feed-area-anon.active .tab-icon {
		color: #a855f7;
		filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.4));
	}

	.feed-nav-divider {
		width: 1px;
		height: 22px;
		background: var(--border-subtle);
		opacity: 0.7;
		flex-shrink: 0;
		margin: 0 2px;
	}

	.anon-mini-badge {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 2px 7px;
		border-radius: var(--radius-full, 9999px);
		background: rgba(168, 85, 247, 0.12);
		border: 1px solid rgba(168, 85, 247, 0.25);
		color: #a855f7;
		line-height: 1;
	}
	:global([data-theme='dark']) .anon-mini-badge,
	:global([data-theme='midnight']) .anon-mini-badge {
		color: #c084fc;
		background: rgba(168, 85, 247, 0.18);
		border-color: rgba(168, 85, 247, 0.3);
	}

	.anon-area-hero {
		border: 1px solid var(--anon-border, rgba(99, 102, 241, 0.2));
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(34, 211, 238, 0.03) 100%)
		);
	}

	.anon-hero-icon {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(34, 211, 238, 0.12))
		);
		border: 1px solid var(--anon-border, rgba(99, 102, 241, 0.25));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--anon-accent, #818cf8);
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12);
	}

	.anon-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.08))
		);
		color: var(--anon-text, #4338ca);
		border: 1px solid var(--anon-border, rgba(168, 85, 247, 0.25));
		box-shadow: 0 1px 4px rgba(99, 102, 241, 0.08);
	}

	/* Attachment previews (GIF + media files) */
	.gif-attachment-preview {
		position: relative;
		width: fit-content;
		max-width: 220px;
		border-radius: var(--radius-md);
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
		border-radius: var(--radius-xs);
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
		border-radius: var(--radius-sm);
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
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
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
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
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
		border-radius: var(--radius-sm);
		margin: 4px 0;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb);
		border-radius: var(--radius-sm);
		border: none;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--scrollbar-thumb-hover);
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

	/* ── Frutiger Aqua Algorithm Button & Modal (Aero / Eco) ── */
	.aqua-algo-btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 38px;
		padding: 0 12px;
		background: linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%);
		border: 1px solid rgba(6, 182, 212, 0.28);
		color: var(--text-primary);
		cursor: pointer;
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 0.8125rem;
		white-space: nowrap;
		border-radius: var(--radius-lg, 14px);
		box-shadow:
			0 2px 8px rgba(6, 182, 212, 0.12),
			var(--glass-inset-highlight);
		transition:
			background 0.2s var(--ease-out),
			border-color 0.2s var(--ease-out),
			box-shadow 0.2s var(--ease-out),
			transform 0.15s var(--ease-spring);
		user-select: none;
		flex-shrink: 0;
	}
	.aqua-algo-btn:hover {
		background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%);
		border-color: rgba(6, 182, 212, 0.5);
		box-shadow:
			0 2px 12px rgba(6, 182, 212, 0.22),
			var(--glass-inset-highlight);
	}
	.aqua-algo-btn:active {
		transform: scale(0.98);
	}
	.aqua-algo-btn.active {
		background: linear-gradient(135deg, rgba(6, 182, 212, 0.28) 0%, rgba(16, 185, 129, 0.22) 100%);
		border-color: rgba(6, 182, 212, 0.7);
		box-shadow:
			0 0 16px rgba(6, 182, 212, 0.3),
			var(--glass-inset-highlight);
	}
	.aqua-algo-btn .aqua-icon {
		font-size: 18px;
		line-height: 1;
		color: #06b6d4;
		filter: drop-shadow(0 0 6px rgba(6, 182, 212, 0.45));
		transition: transform 0.25s var(--ease-spring);
	}
	.aqua-algo-btn:hover .aqua-icon {
		transform: scale(1.12) rotate(12deg);
	}
	.aqua-chip-badge {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 2px 7px;
		border-radius: var(--radius-full, 9999px);
		background: rgba(6, 182, 212, 0.15);
		border: 1px solid rgba(6, 182, 212, 0.35);
		color: #0891b2;
		line-height: 1;
	}
	:global([data-theme='dark']) .aqua-chip-badge,
	:global([data-theme='midnight']) .aqua-chip-badge {
		color: #22d3ee;
		background: rgba(6, 182, 212, 0.22);
		border-color: rgba(6, 182, 212, 0.4);
	}

	/* Aqua Modal Container */
	.aqua-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1050;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(12px) saturate(1.25);
		-webkit-backdrop-filter: blur(12px) saturate(1.25);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}
	.aqua-modal-card {
		width: 100%;
		max-width: 520px;
		max-height: 90vh;
		overflow-y: auto;
		background: var(--bg-surface);
		border: 1px solid rgba(6, 182, 212, 0.35);
		border-radius: var(--radius-xl, 24px);
		box-shadow:
			0 20px 50px rgba(0, 0, 0, 0.35),
			0 0 35px rgba(6, 182, 212, 0.15),
			inset 0 1px 2px rgba(255, 255, 255, 0.5);
		padding: 1.5rem;
		position: relative;
	}

	.aqua-modal-icon-badge {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%);
		border: 1px solid rgba(6, 182, 212, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(6, 182, 212, 0.2);
		flex-shrink: 0;
	}

	.aqua-eco-tag {
		font-size: 0.62rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 7px;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
		border: 1px solid rgba(6, 182, 212, 0.4);
		color: #06b6d4;
	}
	:global([data-theme='dark']) .aqua-eco-tag,
	:global([data-theme='midnight']) .aqua-eco-tag {
		color: #22d3ee;
	}

	.aqua-close-btn {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--border-subtle);
		color: var(--text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
	}
	.aqua-close-btn:hover {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
		border-color: rgba(239, 68, 68, 0.3);
	}

	.aqua-preset-card {
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface2, rgba(255, 255, 255, 0.04));
		border-radius: var(--radius-md, 14px);
		padding: 0.85rem 1rem;
		cursor: pointer;
		transition: all 0.22s var(--ease-spring);
		text-align: left;
		position: relative;
		overflow: hidden;
	}
	.aqua-preset-card:hover {
		border-color: rgba(6, 182, 212, 0.45);
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(6, 182, 212, 0.15);
	}
	.aqua-preset-card.active {
		border-color: rgba(6, 182, 212, 0.7);
		background: linear-gradient(135deg, rgba(6, 182, 212, 0.14) 0%, rgba(16, 185, 129, 0.1) 100%);
		box-shadow:
			0 0 20px rgba(6, 182, 212, 0.2),
			inset 0 1px 1px rgba(255, 255, 255, 0.4);
	}
	.aqua-preset-card .active-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #06b6d4;
		box-shadow: 0 0 10px #06b6d4;
	}

	.aqua-custom-box {
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface2, rgba(255, 255, 255, 0.03));
		border-radius: var(--radius-md, 14px);
		padding: 0.5rem;
	}

	/* Frutiger Aqua Range Sliders */
	.aqua-slider-track {
		position: relative;
		width: 100%;
		height: 10px;
		border-radius: 9999px;
		background: var(--bg-input, rgba(0, 0, 0, 0.15));
		border: 1px solid var(--border-subtle);
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
		overflow: hidden;
	}
	.aqua-slider-fill {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		border-radius: 9999px;
		transition: width 0.08s ease-out;
		box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.5);
	}
	.aqua-range-input {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
		z-index: 10;
		margin: 0;
	}

	.aqua-text-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: transparent;
		border: 1px solid transparent;
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 700;
		padding: 4px 8px;
		border-radius: var(--radius-xs);
		cursor: pointer;
		transition: all 0.2s;
	}
	.aqua-text-btn:hover {
		color: #06b6d4;
		background: rgba(6, 182, 212, 0.08);
		border-color: rgba(6, 182, 212, 0.2);
	}
</style>
