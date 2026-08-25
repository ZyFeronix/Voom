<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { posts as postsApi, users as usersApi, feed as feedApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';
	import { escapeHtml, formatHashtags } from '$lib/utils/textFormatting.js';

	// Components
	import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
	import KlipyPicker from '$lib/components/KlipyPicker.svelte';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import VoiceRecorder from '$lib/components/VoiceRecorder.svelte';
	import ImageCropperModal from '$lib/components/ImageCropperModal.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';
	import UserTitleBadge from '$lib/components/gamification/UserTitleBadge.svelte';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';
	import QuoteCard from '$lib/components/QuoteCard.svelte';
	import AnonIdentityModal from '$lib/components/AnonIdentityModal.svelte';
	import { getAnonIdentity } from '$lib/stores/anonIdentity.svelte.js';

	// Main post state
	let bodyText = $state('');
	let privacy = $state('public');
	let isAnonymous = $state(false);

	// Post citado (vía /posts/create?quote=<id> desde "Citar" en el visor)
	let quotedPost = $state(null);
	let quoting = $state(false);

	// Identidad anónima permanente (necesaria para publicar de forma anónima)
	let myAnonUsername = $state(null);
	let showAnonIdentityModal = $state(false);
	let pendingAnonToggle = $state(false);
	let mood = $state('');
	let posting = $state(false);
	let error = $state('');
	let successToast = $state('');
	let activeMobileTab = $state('editor'); // 'editor' | 'preview'
	let activePanel = $state(null); // 'emoji' | 'gif' | 'poll' | 'voice' | 'music' | 'location' | 'schedule' | null

	// Files & Media state
	let fileInput = $state(null);
	let selectedFiles = $state([]); // [{ id, file, url, type, isVideo }]
	let uploadedMedia = $state([]); // [{ url, type, klipy }]

	// Voice Note state
	let voiceNoteBlob = $state(null);
	let voiceNoteUrl = $state('');
	let isPlayingVoiceNote = $state(false);
	let voiceAudioEl = $state(null);

	// Image Cropper Modal state
	let showCropper = $state(false);
	let fileToCrop = $state(null);
	let fileToCropIndex = $state(-1);

	// Music / Soundtrack state
	let attachedMusic = $state(null); // { title, artist, genre, icon }
	let musicInputTitle = $state('');
	let musicInputArtist = $state('');

	const musicPresets = [
		{ title: 'Cyber-Drive', artist: 'Neo Soundscapes', icon: 'electric_bolt', genre: 'Cyberpunk' },
		{ title: 'Midnight Ramen', artist: 'Lofi Girl Club', icon: 'headphones', genre: 'Lo-Fi' },
		{ title: 'Neon Horizon', artist: 'RetroWave 84', icon: 'nightlife', genre: 'Synthwave' },
		{ title: 'Virtual Idol BGM', artist: 'Hololive Beats', icon: 'mic', genre: 'VTuber' },
		{ title: 'Final Boss Rush', artist: 'Pixel Symphony', icon: 'sports_esports', genre: 'Gaming' },
		{
			title: 'Shonen Energy',
			artist: 'Anison Collective',
			icon: 'local_fire_department',
			genre: 'Anime'
		}
	];

	// Poll state
	let pollQuestion = $state('');
	let pollOptions = $state(['', '']);
	let pollDuration = $state(24);
	const pollDurations = [
		{ value: 1, label: '1 hora' },
		{ value: 6, label: '6 horas' },
		{ value: 24, label: '24 horas' },
		{ value: 72, label: '3 días' },
		{ value: 168, label: '7 días' }
	];

	// Location state
	let locationName = $state('');
	let locationQuery = $state('');
	const presetLocations = [
		'Neo Tokyo',
		'Estudio VTuber',
		'Valhalla Café',
		'Akihabara Virtual',
		'La Luna',
		'Habitación Gamer',
		'Distrito Cyberpunk',
		'Estación Virtual',
		'Mundo VRChat',
		'Metaverso Central'
	];
	let locationSuggestions = $derived(
		locationQuery.trim()
			? presetLocations.filter((loc) => loc.toLowerCase().includes(locationQuery.toLowerCase()))
			: presetLocations
	);

	// Scheduling state
	let isScheduled = $state(false);
	let scheduledAt = $state('');

	// Character counter (Max 3000 chars)
	const MAX_CHARS = 3000;
	let charCount = $derived(bodyText.length);
	let charPercentage = $derived(Math.min(100, (charCount / MAX_CHARS) * 100));
	let charColor = $derived(
		charCount > MAX_CHARS ? '#f43f5e' : charCount > MAX_CHARS * 0.9 ? '#f59e0b' : '#38bdf8'
	);

	// Total de adjuntos
	let mediaCount = $derived(selectedFiles.length + uploadedMedia.length);

	// Autocomplete state (@mentions & #hashtags)
	let textareaRef = $state(null);
	let showAutocomplete = $state(false);
	let autocompleteType = $state(null); // 'tag' | 'mention'
	let autocompleteOptions = $state([]);
	let autocompleteIndex = $state(0);
	let autocompleteMatchStart = 0;
	let autocompleteMatchEnd = 0;
	let cachedTrendingTags = [];

	// Auto-Draft state (LocalStorage)
	const DRAFT_KEY = 'vsocial_post_create_draft';
	let hasRestorableDraft = $state(false);
	let draftSavedNotice = $state(false);
	let draftNoticeTimeout = null;

	// Moods list
	const moods = [
		{ id: 'happy', label: 'Feliz', icon: '😄' },
		{ id: 'creative', label: 'Creativo', icon: '🎨' },
		{ id: 'gaming', label: 'Jugando', icon: '🎮' },
		{ id: 'music', label: 'Música', icon: '🎵' },
		{ id: 'thinking', label: 'Pensando', icon: '🤔' },
		{ id: 'excited', label: 'Emocionado', icon: '🔥' },
		{ id: 'traveling', label: 'Viajando', icon: '✈️' },
		{ id: 'celebrating', label: 'Celebrando', icon: '🥳' },
		{ id: 'working', label: 'Trabajando', icon: '💻' },
		{ id: 'eating', label: 'Comiendo', icon: '🍔' }
	];

	// Privacy options
	const privacyOptions = [
		{ value: 'public', label: 'Público' },
		{ value: 'followers', label: 'Solo seguidores' },
		{ value: 'private', label: 'Privado' }
	];

	// Drag-to-scroll for Moods
	let moodScrollerRef = $state(null);
	let isDraggingMood = false;
	let isScrollingMood = $state(false);
	let moodStartX = 0;
	let moodScrollLeft = 0;
	let moodVelocity = 0;
	let moodLastX = 0;
	let moodAnimationFrameId;
	let moodOverscroll = 0;
	let moodExactScroll = 0;

	function handleMoodPointerDown(e) {
		if (!moodScrollerRef) return;
		isDraggingMood = true;
		isScrollingMood = true;
		moodStartX = e.pageX - moodScrollerRef.offsetLeft;
		moodExactScroll = moodScrollerRef.scrollLeft;
		moodScrollLeft = moodExactScroll - moodOverscroll * 4;
		moodLastX = e.pageX;
		moodVelocity = 0;
		cancelAnimationFrame(moodAnimationFrameId);
	}
	function handleMoodPointerLeave() {
		if (isDraggingMood) {
			isDraggingMood = false;
			startMoodInertia();
		}
	}
	function handleMoodPointerUp() {
		if (isDraggingMood) {
			isDraggingMood = false;
			startMoodInertia();
		}
	}
	function handleMoodPointerMove(e) {
		if (!isDraggingMood || !moodScrollerRef) return;
		e.preventDefault();
		const x = e.pageX - moodScrollerRef.offsetLeft;
		const walk = (x - moodStartX) * 0.85;
		const targetScroll = moodScrollLeft - walk;
		const maxScroll = moodScrollerRef.scrollWidth - moodScrollerRef.clientWidth;

		if (targetScroll < 0) {
			moodExactScroll = 0;
			moodScrollerRef.scrollLeft = 0;
			moodOverscroll = -targetScroll * 0.25;
		} else if (targetScroll > maxScroll) {
			moodExactScroll = maxScroll;
			moodScrollerRef.scrollLeft = maxScroll;
			moodOverscroll = (maxScroll - targetScroll) * 0.25;
		} else {
			moodExactScroll = targetScroll;
			moodScrollerRef.scrollLeft = targetScroll;
			moodOverscroll = 0;
		}
		moodScrollerRef.style.transform = `translateX(${moodOverscroll}px)`;
		moodVelocity = (e.pageX - moodLastX) * 0.85;
		moodLastX = e.pageX;
	}

	function startMoodInertia() {
		if (!moodScrollerRef) return;
		const friction = 0.95;
		let overscrollVelocity = 0;

		function loop() {
			const maxScroll = moodScrollerRef.scrollWidth - moodScrollerRef.clientWidth;
			if (moodOverscroll !== 0 || overscrollVelocity !== 0) {
				if (moodVelocity !== 0) {
					overscrollVelocity += moodVelocity * 0.5;
					moodVelocity = 0;
				}
				overscrollVelocity -= moodOverscroll * 0.04;
				overscrollVelocity *= 0.88;
				moodOverscroll += overscrollVelocity;
				if (Math.abs(moodOverscroll) < 0.5 && Math.abs(overscrollVelocity) < 0.5) {
					moodOverscroll = 0;
					overscrollVelocity = 0;
				}
				moodScrollerRef.style.transform =
					moodOverscroll !== 0 ? `translateX(${moodOverscroll}px)` : '';
				if (moodOverscroll !== 0) {
					moodAnimationFrameId = requestAnimationFrame(loop);
				} else {
					isScrollingMood = false;
				}
				return;
			}
			if (Math.abs(moodVelocity) > 0.5) {
				moodExactScroll -= moodVelocity * 2;
				let nextOverscroll = 0;
				if (moodExactScroll < 0) {
					nextOverscroll = -moodExactScroll * 0.25;
					moodExactScroll = 0;
				} else if (moodExactScroll > maxScroll) {
					nextOverscroll = (moodExactScroll - maxScroll) * 0.25;
					moodExactScroll = maxScroll;
				}
				moodScrollerRef.scrollLeft = Math.round(moodExactScroll);
				if (nextOverscroll !== 0) {
					moodOverscroll = nextOverscroll;
					moodScrollerRef.style.transform = `translateX(${moodOverscroll}px)`;
				}
				moodVelocity *= friction;
				moodAnimationFrameId = requestAnimationFrame(loop);
				return;
			}
			isScrollingMood = false;
		}
		loop();
	}

	const canPost = $derived(
		(bodyText.trim().length > 0 && bodyText.length <= MAX_CHARS) ||
			selectedFiles.length > 0 ||
			uploadedMedia.length > 0 ||
			voiceNoteBlob !== null ||
			attachedMusic !== null ||
			(pollQuestion.trim().length > 0 && pollOptions.filter((o) => o.trim()).length >= 2)
	);

	// Rich formatted preview text for HTML display
	let formattedPreviewBody = $derived.by(() => {
		if (!bodyText.trim()) return '';
		let text = escapeHtml(bodyText);
		// Highlight #hashtags
		text = text.replace(/#(\w+)/g, '<span class="preview-hashtag">#$1</span>');
		// Highlight @mentions
		text = text.replace(/@([a-zA-Z0-9_]{3,32})/g, '<span class="preview-mention">@$1</span>');
		// Highlight links
		text = text.replace(/(https?:\/\/[^\s]+)/g, '<span class="preview-link">$1</span>');
		return text;
	});

	function isEmojiOnly(text) {
		if (!text) return false;
		const stripped = text.replace(/[\s\uFE0F]/g, '');
		if (!stripped) return false;
		if (!/^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u200D)+$/u.test(stripped))
			return false;
		if (typeof Intl !== 'undefined' && Intl.Segmenter) {
			return (
				[...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(stripped)].length <= 3
			);
		}
		return Array.from(stripped).length <= 5;
	}

	// Lifecycle & initialization
	onMount(async () => {
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}

		// Load anonymous identity if configured
		getAnonIdentity()
			.then((ident) => {
				myAnonUsername = ident?.anon_username || null;
			})
			.catch(() => {});

		// Load trending tags for instant hashtag autocomplete
		try {
			const tagRes = await feedApi.trendingTags();
			cachedTrendingTags = (tagRes.tags || []).map((t) => t.name || t.tag_name || t);
		} catch (_e) {}

		// Load quoted post if quote query param is present
		const quoteId = page.url.searchParams.get('quote');
		if (quoteId) {
			quoting = true;
			try {
				const res = await postsApi.get(quoteId);
				quotedPost = res?.post || res || null;
			} catch (_e) {
				quotedPost = null;
			} finally {
				quoting = false;
			}
		}

		// Check for previous saved draft in LocalStorage
		try {
			const rawDraft = localStorage.getItem(DRAFT_KEY);
			if (rawDraft) {
				const draft = JSON.parse(rawDraft);
				if (
					draft &&
					(draft.bodyText ||
						draft.mood ||
						draft.locationName ||
						draft.pollQuestion ||
						draft.attachedMusic)
				) {
					hasRestorableDraft = true;
				}
			}
		} catch (_e) {}
	});

	onDestroy(() => {
		// Clean up object URLs
		selectedFiles.forEach((item) => {
			if (item.url) URL.revokeObjectURL(item.url);
		});
		if (voiceNoteUrl) URL.revokeObjectURL(voiceNoteUrl);
		if (draftNoticeTimeout) clearTimeout(draftNoticeTimeout);
	});

	// Auto-Draft Debounced Save
	let draftDebounceTimer = null;
	function triggerDraftSave() {
		if (draftDebounceTimer) clearTimeout(draftDebounceTimer);
		draftDebounceTimer = setTimeout(() => {
			try {
				if (
					bodyText.trim() ||
					mood ||
					locationName ||
					pollQuestion.trim() ||
					attachedMusic ||
					isAnonymous
				) {
					const draftData = {
						bodyText,
						mood,
						privacy,
						isAnonymous,
						locationName,
						pollQuestion,
						pollOptions,
						pollDuration,
						attachedMusic,
						timestamp: Date.now()
					};
					localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
					draftSavedNotice = true;
					if (draftNoticeTimeout) clearTimeout(draftNoticeTimeout);
					draftNoticeTimeout = setTimeout(() => {
						draftSavedNotice = false;
					}, 2500);
				}
			} catch (_e) {}
		}, 800);
	}

	function restoreDraft() {
		try {
			const rawDraft = localStorage.getItem(DRAFT_KEY);
			if (rawDraft) {
				const draft = JSON.parse(rawDraft);
				if (draft.bodyText !== undefined) bodyText = draft.bodyText;
				if (draft.mood !== undefined) mood = draft.mood;
				if (draft.privacy !== undefined) privacy = draft.privacy;
				if (draft.isAnonymous !== undefined) isAnonymous = draft.isAnonymous;
				if (draft.locationName !== undefined) locationName = draft.locationName;
				if (draft.pollQuestion !== undefined) pollQuestion = draft.pollQuestion;
				if (draft.pollOptions !== undefined) pollOptions = draft.pollOptions;
				if (draft.pollDuration !== undefined) pollDuration = draft.pollDuration;
				if (draft.attachedMusic !== undefined) attachedMusic = draft.attachedMusic;
				if (pollQuestion.trim()) activePanel = 'poll';
				successToast = 'Borrador restaurado con éxito';
				setTimeout(() => {
					successToast = '';
				}, 3000);
			}
		} catch (_e) {}
		hasRestorableDraft = false;
	}

	function dismissDraft() {
		try {
			localStorage.removeItem(DRAFT_KEY);
		} catch (_e) {}
		hasRestorableDraft = false;
	}

	function clearDraftStorage() {
		try {
			localStorage.removeItem(DRAFT_KEY);
		} catch (_e) {}
		hasRestorableDraft = false;
		draftSavedNotice = false;
	}

	// Active panel toggler
	function togglePanel(panelName) {
		if (panelName === 'media') {
			fileInput?.click();
			return;
		}
		if (activePanel === panelName) {
			activePanel = null;
		} else {
			activePanel = panelName;
		}
	}

	// Autocomplete handling for @mentions and #hashtags
	async function checkAutocomplete() {
		if (!textareaRef) return;
		const cursor = textareaRef.selectionStart;
		const textBeforeCursor = bodyText.slice(0, cursor);

		// Match hashtag (#tag)
		const tagMatch = textBeforeCursor.match(/(^|\s)#([a-zA-Z0-9_]*)$/);
		if (tagMatch) {
			autocompleteType = 'tag';
			const query = tagMatch[2].toLowerCase();
			autocompleteMatchStart = cursor - tagMatch[2].length;
			autocompleteMatchEnd = cursor;

			const filtered = cachedTrendingTags.filter((t) => String(t).toLowerCase().includes(query));
			if (filtered.length > 0) {
				autocompleteOptions = filtered.slice(0, 6);
				showAutocomplete = true;
				autocompleteIndex = 0;
			} else if (query.length > 0) {
				autocompleteOptions = [query];
				showAutocomplete = true;
				autocompleteIndex = 0;
			} else {
				autocompleteOptions = cachedTrendingTags.slice(0, 6);
				showAutocomplete = autocompleteOptions.length > 0;
				autocompleteIndex = 0;
			}
			return;
		}

		// Match mention (@user)
		const mentionMatch = textBeforeCursor.match(/(^|\s)@([a-zA-Z0-9_]*)$/);
		if (mentionMatch) {
			autocompleteType = 'mention';
			const query = mentionMatch[2].toLowerCase();
			autocompleteMatchStart = cursor - mentionMatch[2].length;
			autocompleteMatchEnd = cursor;

			if (query.length >= 1) {
				try {
					const res = await usersApi.search(query, { limit: 5 });
					autocompleteOptions = (res.users || []).slice(0, 5);
					showAutocomplete = autocompleteOptions.length > 0;
					autocompleteIndex = 0;
				} catch (_e) {
					showAutocomplete = false;
				}
			} else {
				showAutocomplete = false;
			}
			return;
		}

		showAutocomplete = false;
	}

	function insertAutocomplete(item) {
		if (!textareaRef) return;
		const before = bodyText.slice(0, autocompleteMatchStart);
		const after = bodyText.slice(autocompleteMatchEnd);
		let insertedText = '';

		if (autocompleteType === 'tag') {
			const tagVal = typeof item === 'string' ? item : item.name || item;
			insertedText = tagVal + ' ';
		} else if (autocompleteType === 'mention') {
			const username = item.username || item;
			insertedText = username + ' ';
		}

		bodyText = before + insertedText + after;
		showAutocomplete = false;
		triggerDraftSave();

		setTimeout(() => {
			if (textareaRef) {
				textareaRef.focus();
				const nextPos = before.length + insertedText.length;
				textareaRef.setSelectionRange(nextPos, nextPos);
			}
		}, 10);
	}

	function handleTextareaKeyDown(e) {
		if (showAutocomplete && autocompleteOptions.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				autocompleteIndex = (autocompleteIndex + 1) % autocompleteOptions.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				autocompleteIndex =
					(autocompleteIndex - 1 + autocompleteOptions.length) % autocompleteOptions.length;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				insertAutocomplete(autocompleteOptions[autocompleteIndex]);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				showAutocomplete = false;
				return;
			}
		}

		if (e.key === 'Escape' && activePanel) {
			activePanel = null;
			return;
		}

		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handlePost();
		}
	}

	// Clipboard Paste handler (for images)
	function handlePaste(e) {
		const items = e.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					e.preventDefault();
					addFiles([file]);
				}
			}
		}
	}

	// Media Management
	function addFiles(files) {
		const newEntries = Array.from(files).map((file) => {
			const isVideo = file.type.startsWith('video/');
			const url = URL.createObjectURL(file);
			return {
				id: Math.random().toString(36).slice(2, 9),
				file,
				url,
				type: isVideo ? 'video' : 'image',
				isVideo
			};
		});
		selectedFiles = [...selectedFiles, ...newEntries];
	}

	function handleFileInputChange(e) {
		if (e.target.files) {
			addFiles(e.target.files);
			e.target.value = '';
		}
	}

	function removeSelectedFile(index) {
		const item = selectedFiles[index];
		if (item?.url) URL.revokeObjectURL(item.url);
		selectedFiles = selectedFiles.filter((_, i) => i !== index);
	}

	function removeUploadedMedia(index) {
		uploadedMedia = uploadedMedia.filter((_, i) => i !== index);
	}

	// Drag & Drop directo sobre la columna del editor
	let editorDragOver = $state(false);

	function handleEditorDragEnter(e) {
		e.preventDefault();
		editorDragOver = true;
	}

	function handleEditorDragOver(e) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
		editorDragOver = true;
	}

	function handleEditorDragLeave(e) {
		if (!e.currentTarget.contains(e.relatedTarget)) {
			editorDragOver = false;
		}
	}

	async function handleEditorDrop(e) {
		e.preventDefault();
		editorDragOver = false;
		if (e.dataTransfer?.files?.length) {
			addFiles(e.dataTransfer.files);
		}
	}

	// Image Cropper Integration
	function openCropperForFile(index) {
		const target = selectedFiles[index];
		if (!target || target.isVideo) return;
		fileToCrop = target.file;
		fileToCropIndex = index;
		showCropper = true;
	}

	function handleCroppedImage(croppedFile) {
		if (fileToCropIndex >= 0 && fileToCropIndex < selectedFiles.length) {
			const oldItem = selectedFiles[fileToCropIndex];
			if (oldItem.url) URL.revokeObjectURL(oldItem.url);

			const newUrl = URL.createObjectURL(croppedFile);
			selectedFiles[fileToCropIndex] = {
				...oldItem,
				file: croppedFile,
				url: newUrl
			};
		}
		showCropper = false;
		fileToCrop = null;
		fileToCropIndex = -1;
	}

	// Voice Recorder Handlers
	function handleVoiceRecorded(blob) {
		if (voiceNoteUrl) URL.revokeObjectURL(voiceNoteUrl);
		voiceNoteBlob = blob;
		voiceNoteUrl = URL.createObjectURL(blob);
		activePanel = null;
		successToast = 'Nota de voz grabada con éxito';
		setTimeout(() => {
			successToast = '';
		}, 3000);
	}

	function removeVoiceNote() {
		if (voiceAudioEl) {
			voiceAudioEl.pause();
			isPlayingVoiceNote = false;
		}
		if (voiceNoteUrl) URL.revokeObjectURL(voiceNoteUrl);
		voiceNoteBlob = null;
		voiceNoteUrl = '';
	}

	function toggleVoicePlayback() {
		if (!voiceAudioEl) return;
		if (isPlayingVoiceNote) {
			voiceAudioEl.pause();
			isPlayingVoiceNote = false;
		} else {
			voiceAudioEl.play();
			isPlayingVoiceNote = true;
		}
	}

	// Music Attachment Handlers
	function attachCustomMusic() {
		if (!musicInputTitle.trim()) return;
		attachedMusic = {
			title: musicInputTitle.trim(),
			artist: musicInputArtist.trim() || 'Artista Virtual',
			genre: 'Personalizado'
		};
		musicInputTitle = '';
		musicInputArtist = '';
		activePanel = null;
		triggerDraftSave();
	}

	function attachPresetMusic(preset) {
		attachedMusic = { ...preset };
		activePanel = null;
		triggerDraftSave();
	}

	function removeMusic() {
		attachedMusic = null;
		triggerDraftSave();
	}

	// Poll Handlers
	function addPollOption() {
		if (pollOptions.length < 6) {
			pollOptions = [...pollOptions, ''];
			triggerDraftSave();
		}
	}

	function removePollOption(index) {
		if (pollOptions.length > 2) {
			pollOptions = pollOptions.filter((_, i) => i !== index);
			triggerDraftSave();
		}
	}

	function updatePollOption(index, val) {
		pollOptions = pollOptions.map((o, i) => (i === index ? val : o));
		triggerDraftSave();
	}

	function clearPoll() {
		pollQuestion = '';
		pollOptions = ['', ''];
		activePanel = null;
		triggerDraftSave();
	}

	// Publicar anónimo requiere la identidad anónima permanente
	async function toggleAnonMode() {
		if (isAnonymous) {
			isAnonymous = false;
			triggerDraftSave();
			return;
		}
		const ident = await getAnonIdentity();
		myAnonUsername = ident?.anon_username || null;
		if (!myAnonUsername) {
			pendingAnonToggle = true;
			showAnonIdentityModal = true;
			return;
		}
		isAnonymous = true;
		triggerDraftSave();
	}

	// Main Post Creation Request
	async function handlePost() {
		if (!canPost || posting) return;

		if (isAnonymous) {
			const ident = await getAnonIdentity();
			myAnonUsername = ident?.anon_username || null;
			if (!myAnonUsername) {
				pendingAnonToggle = true;
				showAnonIdentityModal = true;
				return;
			}
		}

		posting = true;
		error = '';

		try {
			let mediaPayload = [...uploadedMedia];

			// Upload pending image & video files + voice note
			if (selectedFiles.length > 0 || voiceNoteBlob) {
				const fd = new FormData();
				selectedFiles.forEach((item) => fd.append('media', item.file));
				if (voiceNoteBlob) {
					fd.append('media', voiceNoteBlob, 'voice_note.webm');
				}
				const uploadRes = await postsApi.uploadMedia(fd);
				if (uploadRes.media) {
					mediaPayload = [...mediaPayload, ...uploadRes.media];
				}
			}

			// Format final body with attached music if present
			let finalBody = bodyText.trim();
			if (attachedMusic) {
				const musicNote = `\n🎵 Escuchando: ${attachedMusic.title} - ${attachedMusic.artist}`;
				if (!finalBody.includes(musicNote.trim())) {
					finalBody = (finalBody + '\n' + musicNote).trim();
				}
			}

			const postPayload = {
				body: finalBody,
				media_urls: mediaPayload,
				privacy: isAnonymous ? 'public' : privacy,
				is_anonymous: isAnonymous ? 1 : 0,
				mood: mood || null,
				scheduled_at: isScheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
				location_name: locationName || null,
				quote_id: quotedPost?.id ? Number(quotedPost.id) : null
			};

			// Attach poll if completed
			if (pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2) {
				postPayload.poll = {
					question: pollQuestion.trim(),
					options: pollOptions.filter((o) => o.trim()),
					duration_hours: pollDuration
				};
			}

			await postsApi.create(postPayload);
			clearDraftStorage();
			goto('/feed');
		} catch (err) {
			if (err?.code === 'ANON_IDENTITY_REQUIRED' || err?.message?.includes('identidad anónima')) {
				pendingAnonToggle = true;
				showAnonIdentityModal = true;
			} else {
				error = err?.message || 'Error al publicar. Por favor inténtalo de nuevo.';
			}
		} finally {
			posting = false;
		}
	}
</script>

<svelte:head>
	<title>Crear Publicación — V-SOCIAL</title>
</svelte:head>

<svelte:window
	onclick={(e) => {
		if (showAutocomplete && !e.target.closest('.autocomplete-dock')) {
			showAutocomplete = false;
		}
	}}
/>

<div class="creator-wrapper">
	<!-- Top Bar / Back Navigation -->
	<header class="creator-topbar glass-panel">
		<div class="topbar-left">
			<a href="/feed" class="back-btn" title="Volver al Feed" aria-label="Volver al Feed">
				<span class="material-icons-round">arrow_back</span>
			</a>
			<div class="title-group">
				<h1 class="creator-title">
					<span class="title-icon-chip" aria-hidden="true">
						<span class="material-icons-round">edit_note</span>
					</span>
					<span>Nueva Publicación</span>
				</h1>
				<div class="creator-subtitle-row">
					<span class="text-xs text-muted">Centro de Autoría Virtual</span>
					{#if draftSavedNotice}
						<span class="draft-indicator animate-pulse">
							<span class="draft-dot"></span> Guardado
						</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Mobile Tab Switcher (Visible on small screens) -->
		<div class="mobile-tabs-pill">
			<button
				type="button"
				class="mobile-tab-btn"
				class:active={activeMobileTab === 'editor'}
				onclick={() => (activeMobileTab = 'editor')}
			>
				<span class="material-icons-round text-sm">edit_note</span> Editor
			</button>
			<button
				type="button"
				class="mobile-tab-btn"
				class:active={activeMobileTab === 'preview'}
				onclick={() => (activeMobileTab = 'preview')}
			>
				<span class="material-icons-round text-sm">visibility</span> Vista Previa
			</button>
		</div>

		<div class="topbar-right">
			<button
				type="button"
				class="btn-aero-primary publish-action-btn"
				disabled={!canPost || posting}
				onclick={handlePost}
			>
				{#if posting}
					<span class="loading-spinner"></span>
					<span>Publicando...</span>
				{:else}
					<span class="material-icons-round text-sm">send</span>
					<span>{isScheduled ? 'Programar' : 'Publicar'}</span>
				{/if}
			</button>
		</div>
	</header>

	<!-- Restorable Draft Banner -->
	{#if hasRestorableDraft}
		<div class="draft-alert-banner glass-card animate-slide-in-up">
			<div class="draft-alert-content">
				<span class="material-icons-round draft-alert-icon">history_edu</span>
				<div>
					<div class="font-bold text-sm text-main">¿Deseas recuperar tu borrador anterior?</div>
					<div class="text-xs text-muted">Tienes contenido guardado de una sesión previa.</div>
				</div>
			</div>
			<div class="draft-alert-actions">
				<button type="button" class="btn-aero-ghost text-xs px-3 py-1.5" onclick={dismissDraft}>
					Descartar
				</button>
				<button type="button" class="btn-aero-primary text-xs px-3 py-1.5" onclick={restoreDraft}>
					Restaurar
				</button>
			</div>
		</div>
	{/if}

	<!-- Success / Error Toasts -->
	{#if error}
		<div class="status-toast error-toast animate-slide-in-up" role="status" aria-live="assertive">
			<span class="material-icons-round text-sm">error_outline</span>
			<span>{error}</span>
			<button
				type="button"
				class="toast-close"
				onclick={() => (error = '')}
				aria-label="Cerrar error"
			>
				<span class="material-icons-round text-xs">close</span>
			</button>
		</div>
	{/if}

	{#if successToast}
		<div class="status-toast success-toast animate-slide-in-up" role="status" aria-live="polite">
			<span class="material-icons-round text-sm">check_circle</span>
			<span>{successToast}</span>
		</div>
	{/if}

	<!-- Main 2-Column Responsive Grid Layout -->
	<main class="creator-grid">
		<!-- Left Column: Unified Studio Card -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<section
			class="editor-column"
			class:mobile-hidden={activeMobileTab !== 'editor'}
			aria-label="Editor de publicación (arrastra archivos aquí)"
			ondragenter={handleEditorDragEnter}
			ondragover={handleEditorDragOver}
			ondragleave={handleEditorDragLeave}
			ondrop={handleEditorDrop}
		>
			<div class="composer-studio-card glass-panel">
				{#if editorDragOver}
					<div class="editor-drag-overlay">
						<div class="editor-drag-badge">
							<span class="material-icons-round">add_photo_alternate</span>
							<span>Suelta para adjuntar imágenes o videos</span>
						</div>
					</div>
				{/if}

				<!-- Studio Header: Author info, Anonymous mode badge & Character gauge -->
				<div class="studio-header">
					<div class="author-mini-profile">
						{#if isAnonymous}
							<div
								class="anon-avatar-box"
								style="flex: 0 0 44px; min-width: 44px; min-height: 44px;"
							>
								<span class="material-icons-round text-indigo-400">visibility_off</span>
							</div>
							<div class="author-info-text">
								<div class="author-name-row">
									<span class="author-display-name"
										>{myAnonUsername ? `@${myAnonUsername}` : 'Modo Anónimo'}</span
									>
									<span class="stealth-badge">Stealth</span>
								</div>
								<div class="author-meta-row">
									<span>Identidad protegida en el feed</span>
								</div>
							</div>
						{:else}
							<div style="flex: 0 0 44px; min-width: 44px; min-height: 44px;">
								<AeroAvatar
									src={authStore.user?.avatar_url}
									alt={authStore.user?.username || 'Usuario'}
									size="md"
									showPresence={false}
								/>
							</div>
							<div class="author-info-text">
								<div class="author-name-row">
									<span class="author-display-name">
										{authStore.user?.display_name || authStore.user?.username || 'Usuario'}
									</span>
									<VerifiedBadge
										role={authStore.user?.role || 'user'}
										isVerified={authStore.user?.is_verified}
										size="14px"
										interactive={false}
									/>
									{#if authStore.userLevel || authStore.user?.level}
										<LevelBadge
											level={authStore.userLevel || authStore.user?.level}
											size="xs"
											interactive={false}
										/>
									{/if}
									{#if authStore.user?.title_text}
										<UserTitleBadge
											title={authStore.user.title_text}
											color={authStore.user.title_color || 'blue'}
											size="xs"
										/>
									{/if}
								</div>
								<div class="author-meta-row">
									<span class="author-handle">@{authStore.user?.username || 'usuario'}</span>
								</div>
							</div>
						{/if}
					</div>

					<div class="studio-header-right">
						<!-- Character Progress Gauge -->
						<div class="char-gauge-wrapper" title="{charCount} / {MAX_CHARS} caracteres">
							<svg class="char-svg" viewBox="0 0 36 36">
								<path
									class="char-circle-bg"
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
								/>
								<path
									class="char-circle-fill"
									stroke-dasharray="{charPercentage}, 100"
									style="stroke: {charColor};"
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
								/>
							</svg>
							<span class="char-text" style="color: {charColor};">
								{MAX_CHARS - charCount}
							</span>
						</div>
					</div>
				</div>

				<!-- Quoted post section (if quoting) -->
				{#if quoting}
					<div class="quote-loading-box glass-panel">
						<span class="loading-spinner"></span>
						<span>Cargando post citado...</span>
					</div>
				{:else if quotedPost}
					<div class="quoted-post-card glass-panel">
						<div class="quoted-post-header">
							<span class="quoted-post-title">
								<span class="material-icons-round">format_quote</span> Citando un post
							</span>
							<button
								type="button"
								class="quoted-post-remove"
								onclick={() => (quotedPost = null)}
								aria-label="Quitar cita"
								title="Quitar cita"
							>
								<span class="material-icons-round">close</span>
							</button>
						</div>
						<div class="quoted-post-body">
							<div class="quoted-post-avatar">
								{#if quotedPost.is_anonymous}
									<div class="vs-anon-avatar-circle">
										<span class="material-icons-round">visibility_off</span>
									</div>
								{:else if quotedPost.avatar_url}
									<img src={quotedPost.avatar_url} alt={quotedPost.username} loading="lazy" />
								{:else}
									<div class="vs-avatar-letter avatar-sm">
										{(quotedPost.display_name || quotedPost.username || '?')
											.charAt(0)
											.toUpperCase()}
									</div>
								{/if}
							</div>
							<div class="quoted-post-meta">
								<span class="quoted-post-name"
									>{quotedPost.display_name || quotedPost.username}</span
								>
								{#if quotedPost.is_verified == 1}
									<VerifiedBadge role={quotedPost.role} isVerified={true} size="14px" />
								{/if}
								<span class="quoted-post-user">@{quotedPost.username}</span>
								{#if quotedPost.created_at}
									<span class="quoted-post-user">·</span>
									<span class="quoted-post-user">
										{new Date(quotedPost.created_at).toLocaleDateString('es-ES', {
											day: 'numeric',
											month: 'short',
											year: 'numeric'
										})}
									</span>
								{/if}
							</div>
							<p class="quoted-post-text">
								{@html formatHashtags(quotedPost.body || quotedPost.content || '')}
							</p>
							{#if quotedPost.media && quotedPost.media.length > 0}
								<div class="quoted-post-media">
									{#if quotedPost.media[0].media_type === 'video' || quotedPost.media[0].media_type === 'audio'}
										<video
											src={getProxiedMediaUrl(quotedPost.media[0].media_url)}
											muted
											playsinline
											preload="metadata"
										></video>
										<span class="quoted-post-media-badge">
											<span class="material-icons-round">play_circle_fill</span>
										</span>
									{:else}
										<img
											src={getProxiedMediaUrl(quotedPost.media[0].media_url)}
											alt="Multimedia de @{quotedPost.username}"
											loading="lazy"
											decoding="async"
										/>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Text Input Area with Autocomplete Detection -->
				<div class="textarea-shell">
					<textarea
						bind:this={textareaRef}
						bind:value={bodyText}
						oninput={() => {
							checkAutocomplete();
							triggerDraftSave();
						}}
						onclick={checkAutocomplete}
						onkeyup={checkAutocomplete}
						onkeydown={handleTextareaKeyDown}
						onpaste={handlePaste}
						placeholder="¿Qué está pasando en tu mundo virtual? (Usa # para tags o @ para creadores)"
						class="creator-textarea"
						rows="5"
					></textarea>

					<!-- Mention & Hashtag Autocomplete Dock -->
					{#if showAutocomplete && autocompleteOptions.length > 0}
						<div class="autocomplete-dock glass-panel animate-scale-in">
							<div class="autocomplete-header">
								<span class="text-[10px] font-bold uppercase tracking-wider text-muted">
									{autocompleteType === 'tag' ? 'Sugerencias de #Hashtags' : 'Mencionar a @Usuario'}
								</span>
							</div>
							<div class="autocomplete-list custom-scrollbar">
								{#each autocompleteOptions as opt, i}
									<button
										type="button"
										class="autocomplete-item"
										class:selected={i === autocompleteIndex}
										onmousedown={(e) => {
											e.preventDefault();
											insertAutocomplete(opt);
										}}
									>
										{#if autocompleteType === 'tag'}
											<span class="autocomplete-icon tag-icon">#</span>
											<span class="font-semibold text-main">{opt}</span>
										{:else}
											<div
												class="w-6 h-6 rounded-full overflow-hidden bg-surface border border-subtle flex-shrink-0"
											>
												{#if opt.avatar_url}
													<img src={opt.avatar_url} alt="" class="w-full h-full object-cover" />
												{:else}
													<span
														class="text-xs font-bold flex items-center justify-center h-full text-muted"
													>
														{(opt.username || '?')[0].toUpperCase()}
													</span>
												{/if}
											</div>
											<div class="flex flex-col text-left">
												<span class="text-xs font-bold text-main"
													>{opt.display_name || opt.username}</span
												>
												<span class="text-[10px] text-muted">@{opt.username}</span>
											</div>
										{/if}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Rich Attachment Badges inside Composer -->
				{#if locationName || attachedMusic || (isScheduled && scheduledAt)}
					<div class="attached-meta-pills">
						{#if locationName}
							<div class="meta-pill location-pill">
								<span class="material-icons-round text-xs">location_on</span>
								<span>{locationName}</span>
								<button
									type="button"
									class="meta-pill-remove"
									onclick={() => {
										locationName = '';
										triggerDraftSave();
									}}
									aria-label="Quitar ubicación"
								>
									<span class="material-icons-round text-xs">close</span>
								</button>
							</div>
						{/if}

						{#if attachedMusic}
							<div class="meta-pill music-pill">
								<span class="material-icons-round text-xs">music_note</span>
								<span>{attachedMusic.title} - {attachedMusic.artist}</span>
								<button
									type="button"
									class="meta-pill-remove"
									onclick={removeMusic}
									aria-label="Quitar música"
								>
									<span class="material-icons-round text-xs">close</span>
								</button>
							</div>
						{/if}

						{#if isScheduled && scheduledAt}
							<div class="meta-pill schedule-pill">
								<span class="material-icons-round text-xs">schedule</span>
								<span
									>Programado: {new Date(scheduledAt).toLocaleString('es-ES', {
										dateStyle: 'short',
										timeStyle: 'short'
									})}</span
								>
								<button
									type="button"
									class="meta-pill-remove"
									onclick={() => {
										isScheduled = false;
										scheduledAt = '';
										triggerDraftSave();
									}}
									aria-label="Quitar programación"
								>
									<span class="material-icons-round text-xs">close</span>
								</button>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Attached Voice Note Player in Composer -->
				{#if voiceNoteBlob && voiceNoteUrl}
					<div class="attached-audio-card glass-card animate-slide-in-up">
						<audio
							bind:this={voiceAudioEl}
							src={voiceNoteUrl}
							onended={() => (isPlayingVoiceNote = false)}
							onpause={() => (isPlayingVoiceNote = false)}
							onplay={() => (isPlayingVoiceNote = true)}
							style="display: none;"
						></audio>
						<div class="audio-card-left">
							<button
								type="button"
								class="audio-play-btn"
								class:playing={isPlayingVoiceNote}
								onclick={toggleVoicePlayback}
								aria-label={isPlayingVoiceNote ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
							>
								<span class="material-icons-round">
									{isPlayingVoiceNote ? 'pause' : 'play_arrow'}
								</span>
							</button>
							<div>
								<div class="font-bold text-xs text-main flex items-center gap-1">
									<span class="material-icons-round text-sm text-rose-400">graphic_eq</span>
									<span>Nota de Voz Adjunta</span>
								</div>
								<div class="text-[10px] text-muted">Lista para reproducir y compartir</div>
							</div>
						</div>
						<button
							type="button"
							class="remove-audio-btn"
							onclick={removeVoiceNote}
							title="Eliminar audio"
							aria-label="Eliminar nota de voz"
						>
							<span class="material-icons-round text-sm">delete</span>
						</button>
					</div>
				{/if}

				<!-- Media Preview Grid inside Composer -->
				{#if selectedFiles.length > 0 || uploadedMedia.length > 0}
					{@const gridMediaCount = Math.min(4, selectedFiles.length + uploadedMedia.length)}
					<div class="media-preview-grid grid-count-{gridMediaCount}">
						<!-- Uploaded Media (e.g. GIFs) -->
						{#each uploadedMedia as media, idx}
							<div class="media-thumb-box is-gif">
								<img src={getProxiedMediaUrl(media.url)} alt="" class="thumb-img" loading="lazy" />
								<span class="gif-tag">GIF</span>
								<button
									type="button"
									class="remove-thumb-btn"
									onclick={() => removeUploadedMedia(idx)}
									title="Quitar GIF"
									aria-label="Quitar GIF"
								>
									<span class="material-icons-round text-xs">close</span>
								</button>
							</div>
						{/each}

						<!-- Local Files (Images & Videos) -->
						{#each selectedFiles as item, idx}
							<div class="media-thumb-box">
								{#if item.isVideo}
									<div class="video-thumb-overlay">
										<span class="material-icons-round video-thumb-icon">videocam</span>
									</div>
									<video src={item.url} class="thumb-img" muted playsinline></video>
								{:else}
									<img src={item.url} alt="" class="thumb-img" loading="lazy" />
									<button
										type="button"
										class="crop-thumb-btn"
										onclick={() => openCropperForFile(idx)}
										title="Recortar y ajustar imagen"
										aria-label="Recortar imagen"
									>
										<span class="material-icons-round text-xs">crop</span>
									</button>
								{/if}
								<button
									type="button"
									class="remove-thumb-btn"
									onclick={() => removeSelectedFile(idx)}
									title="Eliminar archivo"
									aria-label="Eliminar archivo"
								>
									<span class="material-icons-round text-xs">close</span>
								</button>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Integrated Mood Ribbon Bar -->
				<div class="mood-ribbon-section">
					<div class="mood-header">
						<span
							class="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1"
						>
							<span class="material-icons-round text-xs text-amber-400"
								>sentiment_satisfied_alt</span
							>
							<span>Estado de Ánimo:</span>
						</span>
						{#if mood}
							{@const currentMood = moods.find((m) => m.id === mood)}
							{#if currentMood}
								<button
									type="button"
									class="clear-mood-btn"
									onclick={() => {
										mood = '';
										triggerDraftSave();
									}}
								>
									{currentMood.icon}
									{currentMood.label} <span class="material-icons-round text-xs">close</span>
								</button>
							{/if}
						{/if}
					</div>

					<div class="mood-carousel-mask">
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="mood-scroller"
							class:dragging={isScrollingMood}
							bind:this={moodScrollerRef}
							onpointerdown={handleMoodPointerDown}
							onpointerleave={handleMoodPointerLeave}
							onpointerup={handleMoodPointerUp}
							onpointermove={handleMoodPointerMove}
						>
							{#each moods as m}
								<button
									type="button"
									class="mood-pill"
									class:selected={mood === m.id}
									onclick={() => {
										mood = mood === m.id ? '' : m.id;
										triggerDraftSave();
									}}
								>
									<span class="m-icon">{m.icon}</span>
									<span class="m-label">{m.label}</span>
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Hidden File Input -->
				<input
					type="file"
					bind:this={fileInput}
					multiple
					accept="image/*,video/*"
					style="display: none;"
					onchange={handleFileInputChange}
				/>

				<!-- Integrated Action Dock (8 Complete Tools) -->
				<div class="action-dock">
					<!-- 1. Foto / Video -->
					<button
						type="button"
						class="dock-btn"
						class:pressed={mediaCount > 0}
						onclick={() => togglePanel('media')}
						title="Adjuntar Fotos o Videos ({mediaCount} adjuntos)"
						aria-label="Adjuntar Fotos o Videos"
					>
						<span class="dock-icon cyan">
							add_photo_alternate
							{#if mediaCount > 0}
								<span class="dock-count-badge">{mediaCount}</span>
							{/if}
						</span>
						<span class="dock-label">Multimedia</span>
					</button>

					<!-- 2. Emoji -->
					<button
						type="button"
						class="dock-btn"
						class:pressed={activePanel === 'emoji'}
						onclick={() => togglePanel('emoji')}
						title="Añadir Emojis"
						aria-label="Añadir Emojis"
					>
						<span class="dock-icon amber">emoji_emotions</span>
						<span class="dock-label">Emoji</span>
					</button>

					<!-- 3. GIF -->
					<button
						type="button"
						class="dock-btn"
						class:pressed={activePanel === 'gif'}
						onclick={() => togglePanel('gif')}
						title="Buscar GIF animado"
						aria-label="Buscar GIF animado"
					>
						<span class="dock-icon fuchsia">gif_box</span>
						<span class="dock-label">GIF</span>
					</button>

					<!-- 4. Encuesta -->
					<button
						type="button"
						class="dock-btn"
						class:pressed={activePanel === 'poll' || (pollQuestion && pollOptions.length >= 2)}
						onclick={() => togglePanel('poll')}
						title="Crear Encuesta"
						aria-label="Crear Encuesta"
					>
						<span class="dock-icon emerald">poll</span>
						<span class="dock-label">Encuesta</span>
					</button>

					<!-- 5. Audio / Nota de voz -->
					<button
						type="button"
						class="dock-btn"
						class:pressed={activePanel === 'voice' || voiceNoteBlob !== null}
						onclick={() => togglePanel('voice')}
						title="Grabar Nota de Voz"
						aria-label="Grabar Nota de Voz"
					>
						<span class="dock-icon rose">mic</span>
						<span class="dock-label">Audio</span>
					</button>

					<!-- 6. Música / BGM -->
					<button
						type="button"
						class="dock-btn"
						class:pressed={activePanel === 'music' || attachedMusic !== null}
						onclick={() => togglePanel('music')}
						title="Añadir Música o BGM"
						aria-label="Añadir Música o BGM"
					>
						<span class="dock-icon purple">headphones</span>
						<span class="dock-label">Música</span>
					</button>

					<!-- 7. Lugar -->
					<button
						type="button"
						class="dock-btn"
						class:pressed={activePanel === 'location' || locationName}
						onclick={() => togglePanel('location')}
						title="Añadir Ubicación o Check-in"
						aria-label="Añadir Ubicación o Check-in"
					>
						<span class="dock-icon sky">location_on</span>
						<span class="dock-label">Lugar</span>
					</button>

					<!-- 8. Programar -->
					<button
						type="button"
						class="dock-btn"
						class:pressed={activePanel === 'schedule' || (isScheduled && scheduledAt)}
						onclick={() => togglePanel('schedule')}
						title="Programar Hora de Publicación"
						aria-label="Programar Hora de Publicación"
					>
						<span class="dock-icon indigo">schedule</span>
						<span class="dock-label">Programar</span>
					</button>
				</div>

				<!-- Expandable Dock Panels -->
				{#if activePanel === 'emoji'}
					<div class="expanded-panel glass-card animate-slide-in-up">
						<div class="panel-top">
							<span class="panel-heading">Selector de Emojis</span>
							<button
								type="button"
								class="panel-close-btn"
								onclick={() => (activePanel = null)}
								aria-label="Cerrar selector de emojis"
							>
								<span class="material-icons-round text-sm">close</span>
							</button>
						</div>
						<div class="emoji-picker-frame">
							<TwemojiPicker
								variant="inline"
								onClose={() => (activePanel = null)}
								onSelect={(emoji) => {
									if (textareaRef) {
										const cursor = textareaRef.selectionStart;
										bodyText = bodyText.slice(0, cursor) + emoji + bodyText.slice(cursor);
										triggerDraftSave();
										setTimeout(() => {
											textareaRef.focus();
											textareaRef.setSelectionRange(cursor + emoji.length, cursor + emoji.length);
										}, 10);
									} else {
										bodyText += emoji;
										triggerDraftSave();
									}
								}}
							/>
						</div>
					</div>
				{/if}

				{#if activePanel === 'gif'}
					<div class="expanded-panel glass-card animate-slide-in-up">
						<div class="panel-top">
							<span class="panel-heading">Buscar GIFs Animados</span>
							<button
								type="button"
								class="panel-close-btn"
								onclick={() => (activePanel = null)}
								aria-label="Cerrar buscador de GIFs"
							>
								<span class="material-icons-round text-sm">close</span>
							</button>
						</div>
						<div class="gif-picker-frame">
							<KlipyPicker
								onClose={() => (activePanel = null)}
								onSelect={(url) => {
									uploadedMedia = [...uploadedMedia, { url, type: 'image', klipy: true }];
									activePanel = null;
								}}
							/>
						</div>
					</div>
				{/if}

				{#if activePanel === 'poll'}
					<div class="expanded-panel glass-card animate-slide-in-up">
						<div class="panel-top">
							<span class="panel-heading">Configurar Encuesta</span>
							<button
								type="button"
								class="panel-close-btn"
								onclick={() => (activePanel = null)}
								aria-label="Cerrar panel de encuesta"
							>
								<span class="material-icons-round text-sm">close</span>
							</button>
						</div>
						<div class="poll-form">
							<input
								type="text"
								bind:value={pollQuestion}
								oninput={triggerDraftSave}
								placeholder="¿Cuál es la pregunta de tu encuesta?"
								class="aero-input w-full mb-3"
							/>
							<div class="poll-options-grid">
								{#each pollOptions as opt, i}
									<div class="poll-row">
										<span class="poll-index-badge">{i + 1}</span>
										<input
											type="text"
											value={opt}
											oninput={(e) => updatePollOption(i, e.target.value)}
											placeholder="Opción {i + 1}"
											class="aero-input flex-1"
										/>
										{#if pollOptions.length > 2}
											<button
												type="button"
												class="poll-del-btn"
												onclick={() => removePollOption(i)}
												title="Eliminar opción"
												aria-label="Eliminar opción {i + 1}"
											>
												<span class="material-icons-round text-sm">remove_circle_outline</span>
											</button>
										{/if}
									</div>
								{/each}
							</div>

							{#if pollOptions.length < 6}
								<button type="button" class="poll-add-option-btn" onclick={addPollOption}>
									<span class="material-icons-round text-sm">add</span> Añadir otra opción
								</button>
							{/if}

							<div class="poll-footer-controls">
								<div class="flex items-center justify-between w-full flex-wrap gap-2">
									<div class="flex items-center gap-2">
										<span class="text-xs font-bold text-muted uppercase">Duración:</span>
										<CustomSelect
											bind:value={pollDuration}
											options={pollDurations}
											size="sm"
											fullWidth={false}
										/>
									</div>
									<button
										type="button"
										class="btn-aero-ghost text-xs text-rose-400 py-1 px-2.5"
										onclick={clearPoll}
									>
										Quitar Encuesta
									</button>
								</div>
							</div>
						</div>
					</div>
				{/if}

				{#if activePanel === 'voice'}
					<div class="expanded-panel glass-card animate-slide-in-up">
						<div class="panel-top">
							<span class="panel-heading">Grabar Nota de Voz</span>
							<button
								type="button"
								class="panel-close-btn"
								onclick={() => (activePanel = null)}
								aria-label="Cerrar grabadora de voz"
							>
								<span class="material-icons-round text-sm">close</span>
							</button>
						</div>
						<div class="voice-recorder-frame">
							<VoiceRecorder
								onrecorded={handleVoiceRecorded}
								oncancel={() => (activePanel = null)}
							/>
						</div>
					</div>
				{/if}

				{#if activePanel === 'music'}
					<div class="expanded-panel glass-card animate-slide-in-up">
						<div class="panel-top">
							<span class="panel-heading">Añadir Música o BGM</span>
							<button
								type="button"
								class="panel-close-btn"
								onclick={() => (activePanel = null)}
								aria-label="Cerrar panel de música"
							>
								<span class="material-icons-round text-sm">close</span>
							</button>
						</div>
						<div class="music-presets-grid mb-3">
							{#each musicPresets as preset}
								<button type="button" class="preset-card" onclick={() => attachPresetMusic(preset)}>
									<span class="material-icons-round text-purple-400 text-base">{preset.icon}</span>
									<div class="overflow-hidden">
										<span class="preset-title">{preset.title}</span>
										<span class="preset-artist">{preset.artist} ({preset.genre})</span>
									</div>
								</button>
							{/each}
						</div>
						<div class="music-inputs-row">
							<input
								type="text"
								bind:value={musicInputTitle}
								placeholder="Canción / Pista personalizada..."
								class="aero-input flex-1"
							/>
							<input
								type="text"
								bind:value={musicInputArtist}
								placeholder="Artista / Creador..."
								class="aero-input flex-1"
							/>
							<button
								type="button"
								class="btn-aero-primary px-4 py-1.5 text-xs font-bold"
								onclick={attachCustomMusic}
							>
								Añadir
							</button>
						</div>
					</div>
				{/if}

				{#if activePanel === 'location'}
					<div class="expanded-panel glass-card animate-slide-in-up">
						<div class="panel-top">
							<span class="panel-heading">Check-in Virtual o Real</span>
							<button
								type="button"
								class="panel-close-btn"
								onclick={() => (activePanel = null)}
								aria-label="Cerrar selector de ubicación"
							>
								<span class="material-icons-round text-sm">close</span>
							</button>
						</div>
						<input
							type="text"
							bind:value={locationQuery}
							placeholder="Buscar o escribir nombre de lugar..."
							class="aero-input w-full mb-3"
						/>
						<div class="location-list custom-scrollbar max-h-44 overflow-y-auto">
							{#each locationSuggestions as loc}
								<button
									type="button"
									class="location-item"
									class:selected={locationName === loc}
									onclick={() => {
										locationName = loc;
										activePanel = null;
										triggerDraftSave();
									}}
								>
									<span class="material-icons-round text-xs text-sky-400">location_on</span>
									<span>{loc}</span>
								</button>
							{/each}

							{#if locationQuery.trim() && !presetLocations.includes(locationQuery.trim())}
								<button
									type="button"
									class="location-item custom-location-item"
									onclick={() => {
										locationName = locationQuery.trim();
										activePanel = null;
										triggerDraftSave();
									}}
								>
									<span class="material-icons-round text-xs text-emerald-400">add_location</span>
									<span>Usar "{locationQuery.trim()}"</span>
								</button>
							{/if}
						</div>
					</div>
				{/if}

				{#if activePanel === 'schedule'}
					<div class="expanded-panel glass-card animate-slide-in-up">
						<div class="panel-top">
							<span class="panel-heading">Programador de Publicaciones</span>
							<button
								type="button"
								class="panel-close-btn"
								onclick={() => (activePanel = null)}
								aria-label="Cerrar programador"
							>
								<span class="material-icons-round text-sm">close</span>
							</button>
						</div>
						<div class="schedule-form">
							<label class="schedule-toggle-row">
								<input
									type="checkbox"
									class="aero-toggle-switch"
									bind:checked={isScheduled}
									onchange={() => {
										if (isScheduled && !scheduledAt) {
											scheduledAt = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
										}
										triggerDraftSave();
									}}
								/>
								<span class="font-bold text-sm text-main">Activar lanzamiento programado</span>
							</label>

							{#if isScheduled}
								<div class="mt-3 p-3 bg-surface2 rounded-xl border border-subtle">
									<label
										class="text-[10px] font-bold uppercase text-muted block mb-1.5"
										for="schedule-datetime"
									>
										Fecha y hora local de publicación
									</label>
									<input
										id="schedule-datetime"
										type="datetime-local"
										bind:value={scheduledAt}
										min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
										class="aero-input w-full"
										onchange={triggerDraftSave}
									/>
									<span class="text-[11px] text-sky-400 mt-1 block">
										Se publicará automáticamente mediante el cron de V-SOCIAL.
									</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Studio Footer Toolbar: Privacy, Stealth Mode & Instant Publish CTA -->
				<div class="studio-footer-toolbar">
					<div class="footer-left">
						<div class="privacy-select-shell">
							{#if isAnonymous}
								<div
									class="privacy-anon-locked flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/25 cursor-default select-none"
									title="Las publicaciones anónimas son públicas y globales para toda la comunidad manteniendo tu identidad oculta."
								>
									<span class="material-icons-round text-sm">public</span>
									<span>Público</span>
								</div>
							{:else}
								<CustomSelect
									bind:value={privacy}
									options={privacyOptions}
									placeholder="Público"
									onchange={triggerDraftSave}
								/>
							{/if}
						</div>

						<button
							type="button"
							class="stealth-toggle-btn"
							class:active={isAnonymous}
							onclick={toggleAnonMode}
							title="Publicar de forma anónima"
							aria-label="Alternar modo anónimo"
						>
							<span class="material-icons-round text-sm">visibility_off</span>
							<span class="text-xs font-bold">Anónimo</span>
							{#if isAnonymous && myAnonUsername}
								<span class="stealth-identity-tag">@{myAnonUsername}</span>
							{/if}
						</button>
					</div>

					<div class="footer-right">
						<span class="text-[11px] text-muted desktop-only font-mono"> Atajo: Ctrl + Enter </span>
						<button
							type="button"
							class="btn-aero-primary publish-bottom-btn"
							disabled={!canPost || posting}
							onclick={handlePost}
						>
							{#if posting}
								<span class="loading-spinner"></span>
								<span>Publicando...</span>
							{:else}
								<span class="material-icons-round text-sm">send</span>
								<span>{isScheduled ? 'Programar' : 'Publicar'}</span>
							{/if}
						</button>
					</div>
				</div>
			</div>
		</section>

		<!-- Right Column: Live Fidelity Preview Matching PostCard -->
		<section class="preview-column" class:mobile-hidden={activeMobileTab !== 'preview'}>
			<div class="preview-sticky-wrapper animate-slide-in-up">
				<div class="preview-badge-header">
					<span class="live-dot" aria-hidden="true"></span>
					<span class="material-icons-round text-xs text-sky-400">visibility</span>
					<span class="preview-header-label">Vista Previa en Vivo</span>
				</div>

				<!-- Fidelity Post Article Card -->
				<article class="mock-post-card glass-panel" class:is-anonymous-post={isAnonymous}>
					<!-- Post Header -->
					<div class="mock-card-header">
						<div class="flex items-center gap-3">
							{#if isAnonymous}
								<div
									class="anon-avatar-wrapper"
									style="flex: 0 0 44px; min-width: 44px; min-height: 44px;"
								>
									<div class="anon-avatar-inner">
										<span class="material-icons-round text-xl">visibility_off</span>
									</div>
								</div>
								<div class="user-meta">
									<div class="flex items-center gap-1.5 flex-wrap">
										<span class="post-author-name font-bold text-[0.95rem] text-main">
											{myAnonUsername ? `@${myAnonUsername}` : 'Usuario Anónimo'}
										</span>
										<span class="anon-badge">
											<span class="material-icons-round text-xs">theater_comedy</span> Anónimo
										</span>
										<span
											class="anon-owner-pill"
											title="Tu publicación anónima (tu identidad real está oculta)"
										>
											<span class="material-icons-round text-[11px]">visibility_off</span> Tu post anónimo
										</span>
										{#if mood}
											{@const selectedMood = moods.find((m) => m.id === mood)}
											{#if selectedMood}
												<span class="post-mood-badge">
													<span>{selectedMood.icon}</span>
													<span>{selectedMood.label}</span>
												</span>
											{/if}
										{/if}
									</div>
									<div class="meta-row flex items-center gap-1 text-xs text-muted flex-wrap">
										<span>Identidad Oculta</span>
										<span>·</span>
										<span>Hace un momento</span>
									</div>
								</div>
							{:else}
								<div style="flex: 0 0 44px; min-width: 44px; min-height: 44px;">
									<AeroAvatar
										src={authStore.user?.avatar_url}
										alt={authStore.user?.username || 'Usuario'}
										size="md"
										showPresence={true}
										online={true}
										isVtuber={authStore.user?.is_virtual}
									/>
								</div>
								<div class="user-meta">
									<div class="flex items-center gap-1.5 flex-wrap">
										<span class="post-author-name font-bold text-[0.95rem] text-main">
											{authStore.user?.display_name || authStore.user?.username || 'Mi Perfil'}
										</span>
										<VerifiedBadge
											role={authStore.user?.role || 'user'}
											isVerified={authStore.user?.is_verified == 1 ||
												authStore.user?.is_verified === true}
											size="16px"
										/>
										{#if authStore.user?.level}
											<LevelBadge level={authStore.user.level} size="xs" interactive={false} />
										{/if}
										{#if authStore.user?.title_text}
											<UserTitleBadge
												title={authStore.user.title_text}
												color={authStore.user.title_color}
												size="xs"
											/>
										{/if}
										{#if mood}
											{@const selectedMood = moods.find((m) => m.id === mood)}
											{#if selectedMood}
												<span class="post-mood-badge">
													<span>{selectedMood.icon}</span>
													<span>{selectedMood.label}</span>
												</span>
											{/if}
										{/if}
									</div>

									<div class="meta-row flex items-center gap-1 text-xs text-muted flex-wrap">
										<span>@{authStore.user?.username || 'usuario'}</span>
										<span>·</span>
										<span>Hace un momento</span>
										{#if locationName}
											<span>·</span>
											<span
												class="text-[11px] text-sky-400 font-semibold flex items-center gap-0.5"
												title="Ubicación de check-in"
											>
												<span class="material-icons-round text-xs">location_on</span>
												{locationName}
											</span>
										{/if}
									</div>
								</div>
							{/if}
						</div>

						<!-- Mock Post More Menu Button -->
						<div class="mock-card-actions">
							<span class="mock-more-btn" title="Opciones (Vista previa)" aria-hidden="true">
								<span class="material-icons-round text-[18px]">more_horiz</span>
							</span>
						</div>
					</div>

					{#if isScheduled && scheduledAt}
						<div class="mock-schedule-banner animate-scale-in">
							<span class="material-icons-round text-sm">schedule</span>
							<span
								>Programado para: <strong
									>{new Date(scheduledAt).toLocaleString('es-ES', {
										dateStyle: 'medium',
										timeStyle: 'short'
									})}</strong
								></span
							>
						</div>
					{/if}

					<!-- Post Body -->
					<div class="mock-card-body">
						{#if formattedPreviewBody}
							<div class="post-text-content" class:emoji-only-text={isEmojiOnly(bodyText)}>
								{@html formattedPreviewBody}
							</div>
						{:else}
							<div class="post-text-placeholder">
								<div class="placeholder-icon-wrap">
									<span class="material-icons-round text-2xl text-sky-400">edit_note</span>
								</div>
								<p>
									Tu publicación aparecerá aquí en tiempo real con formato enriquecido, menciones y
									hashtags interactivos...
								</p>
							</div>
						{/if}
					</div>

					<!-- Quoted Post Card in Post Preview -->
					{#if quotedPost}
						<div class="mock-quote-wrapper">
							<QuoteCard quote={quotedPost} />
						</div>
					{/if}

					<!-- Music Banner in Post Preview -->
					{#if attachedMusic}
						<div class="mock-music-banner">
							<div class="mock-music-icon-wrap">
								<span class="material-icons-round text-purple-400 text-lg">headphones</span>
							</div>
							<div class="mock-music-info">
								<div class="mock-music-label">Escuchando BGM</div>
								<div class="mock-music-meta">
									<span class="mock-music-title">{attachedMusic.title}</span>
									{#if attachedMusic.artist}
										<span class="mock-music-artist">— {attachedMusic.artist}</span>
									{/if}
								</div>
							</div>
						</div>
					{/if}

					<!-- Poll Widget Preview -->
					{#if pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2}
						<div class="poll-widget-container p-4 rounded-2xl mb-4 max-w-md">
							<div class="poll-question font-bold text-sm text-main mb-3">
								{pollQuestion}
							</div>
							<div class="poll-options flex flex-col gap-2">
								{#each pollOptions.filter((o) => o.trim()) as opt}
									<div
										class="poll-option-btn w-full p-3 rounded-xl text-left font-semibold text-xs text-main flex justify-between items-center"
									>
										<span>{opt}</span>
										<span class="material-icons-round text-muted text-xs select-none"
											>radio_button_unchecked</span
										>
									</div>
								{/each}
							</div>
							<div
								class="flex justify-between items-center text-[10px] text-muted font-bold mt-3 pt-2 border-t border-glass-border"
							>
								<span>0 votos</span>
								<span>• Finaliza en {pollDuration} horas</span>
							</div>
						</div>
					{/if}

					<!-- Voice Note Audio Player in Post Preview -->
					{#if voiceNoteUrl}
						<div class="mock-voice-player">
							<button
								type="button"
								class="mock-voice-btn"
								onclick={toggleVoicePlayback}
								aria-label={isPlayingVoiceNote ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
							>
								<span class="material-icons-round text-base">
									{isPlayingVoiceNote ? 'pause' : 'play_arrow'}
								</span>
							</button>
							<div class="mock-voice-waveform">
								<div class="waveform-bars" class:is-playing={isPlayingVoiceNote}>
									<span class="bar" style="height: 40%; --bar-delay: 0.05s;"></span>
									<span class="bar" style="height: 80%; --bar-delay: 0.25s;"></span>
									<span class="bar" style="height: 60%; --bar-delay: 0.15s;"></span>
									<span class="bar" style="height: 100%; --bar-delay: 0.35s;"></span>
									<span class="bar" style="height: 70%; --bar-delay: 0.2s;"></span>
									<span class="bar" style="height: 45%; --bar-delay: 0.1s;"></span>
									<span class="bar" style="height: 90%; --bar-delay: 0.3s;"></span>
									<span class="bar" style="height: 50%; --bar-delay: 0.18s;"></span>
									<span class="bar" style="height: 75%; --bar-delay: 0.28s;"></span>
									<span class="bar" style="height: 35%; --bar-delay: 0.08s;"></span>
									<span class="bar" style="height: 85%; --bar-delay: 0.32s;"></span>
									<span class="bar" style="height: 60%; --bar-delay: 0.22s;"></span>
								</div>
								<div class="mock-voice-meta">
									<span class="mock-voice-tag">Nota de Voz</span>
									{#if isPlayingVoiceNote}
										<span class="mock-voice-status">Reproduciendo...</span>
									{/if}
								</div>
							</div>
						</div>
					{/if}

					<!-- Media Grid Preview -->
					{#if selectedFiles.length > 0 || uploadedMedia.length > 0}
						{@const allMedia = [
							...uploadedMedia.map((m) => ({ ...m, isUploaded: true, isVideo: false })),
							...selectedFiles.map((f) => ({ ...f, isUploaded: false }))
						]}
						{@const displayMedia = allMedia.slice(0, 4)}
						{@const remainingCount = allMedia.length - 4}
						<div class="mock-media-grid grid-count-{Math.min(4, allMedia.length)}">
							{#each displayMedia as item, idx}
								<div class="grid-media-cell">
									{#if item.isVideo}
										<!-- svelte-ignore a11y_media_has_caption -->
										<video src={item.url} class="grid-media-content" controls playsinline></video>
									{:else}
										<img
											src={item.isUploaded ? getProxiedMediaUrl(item.url) : item.url}
											alt="Media preview {idx + 1}"
											class="grid-media-content"
											loading="lazy"
										/>
									{/if}
									{#if item.klipy}
										<span class="grid-gif-tag">GIF</span>
									{/if}
									{#if idx === 3 && remainingCount > 0}
										<div class="grid-more-overlay">
											<span>+{remainingCount}</span>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<!-- Mock Interaction Footer Bar -->
					<div class="mock-card-footer">
						<div class="flex items-center gap-1">
							<div class="mock-stat-btn mock-like" title="Me gusta">
								<span class="material-icons-round text-[18px]">favorite_border</span>
								<span class="count">0</span>
							</div>
							<div class="mock-stat-btn mock-comment" title="Comentar">
								<span class="material-icons-round text-[18px]">chat_bubble_outline</span>
								<span class="count">0</span>
							</div>
							<div class="mock-stat-btn mock-repost" title="Compartir">
								<span class="material-icons-round text-[18px]">repeat</span>
								<span class="count">0</span>
							</div>
						</div>
						<div class="mock-stat-btn-save" title="Guardar">
							<span class="material-icons-round text-[18px]">bookmark_border</span>
						</div>
					</div>
				</article>
			</div>
		</section>
	</main>

	<!-- Image Cropper Modal Layer -->
	{#if showCropper && fileToCrop}
		<ImageCropperModal
			imageFile={fileToCrop}
			aspectRatio={1}
			shape="rect"
			cropType="post"
			title="Ajustar Imagen de Publicación"
			subtitle="Arrastra y ajusta el encuadre para tu publicación"
			onCrop={handleCroppedImage}
			onCancel={() => {
				showCropper = false;
				fileToCrop = null;
				fileToCropIndex = -1;
			}}
		/>
	{/if}

	<!-- Modal de identidad anónima permanente -->
	<AnonIdentityModal
		open={showAnonIdentityModal}
		onClose={() => {
			showAnonIdentityModal = false;
			pendingAnonToggle = false;
		}}
		onCreated={(username) => {
			myAnonUsername = username;
			showAnonIdentityModal = false;
			if (pendingAnonToggle) {
				pendingAnonToggle = false;
				isAnonymous = true;
				triggerDraftSave();
			}
		}}
	/>
</div>

<style>
	/* ── Layout Root ── */
	.creator-wrapper {
		min-height: calc(100vh - 64px);
		margin: 0 auto;
		padding: 20px 24px 60px 24px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		max-width: 1320px;
		gap: 18px;
	}

	/* ── Top Bar ── */
	.creator-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-border);
		border-top-color: var(--glass-border-t);
		position: relative;
		border-radius: var(--radius-xl);
		padding: 12px 18px;
		background:
			var(--accent-gradient) top left / 100% 2px no-repeat,
			var(--bg-surface);
		box-shadow: var(--shadow-sm), var(--glass-inset-highlight);
	}
	.topbar-left {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-primary);
		text-decoration: none;
		transition: all var(--t-fast);
		cursor: pointer;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-squircle);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--glass-inset-highlight);
	}
	.back-btn:hover {
		background: var(--bg-surface-hover);
		transform: translateX(-2px);
		border-color: rgba(var(--accent-blue-rgb), 0.5);
		color: var(--aero-sky);
		box-shadow: 0 0 14px rgba(var(--accent-blue-rgb), 0.28);
	}
	.back-btn:focus-visible {
		outline: 2px solid var(--aero-sky);
		outline-offset: 2px;
	}
	.title-group {
		display: flex;
		flex-direction: column;
	}
	.creator-title {
		font-family: var(--font-display);
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.2;
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 1.25rem;
	}
	.title-icon-chip {
		width: 32px;
		height: 32px;
		flex: 0 0 32px;
		border-radius: var(--radius-squircle);
		background: var(--grad-primary);
		color: #ffffff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 4px 12px rgba(var(--accent-blue-rgb), 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.4);
	}
	.title-icon-chip .material-icons-round {
		font-size: 18px;
	}
	.creator-subtitle-row {
		display: flex;
		align-items: center;
		margin-top: 2px;
		gap: 10px;
	}
	.draft-indicator {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-weight: 700;
		color: #10b981;
		background: rgba(16, 185, 129, 0.12);
		border-radius: var(--radius-full);
		border: 1px solid rgba(16, 185, 129, 0.25);
		padding: 2px 8px;
	}
	.draft-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #10b981;
		box-shadow: 0 0 6px #10b981;
		animation: livePulse 1.6s ease-in-out infinite;
	}

	/* ── Mobile Tab Switcher ── */
	.mobile-tabs-pill {
		display: none;
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		padding: 3px;
		gap: 4px;
	}
	.mobile-tab-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: var(--radius-full);
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		transition: all var(--t-fast);
	}
	.mobile-tab-btn.active {
		background: var(--aero-blue);
		color: #ffffff;
		box-shadow: 0 2px 8px rgba(27, 133, 243, 0.4);
	}
	.publish-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 22px;
		font-family: var(--font-display);
		font-size: 0.9rem;
		font-weight: 700;
	}
	.publish-action-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		filter: saturate(0.5);
		transform: none !important;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.08) !important;
	}

	/* ── Draft Recovery Banner ── */
	.draft-alert-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 18px;
		background: linear-gradient(90deg, rgba(27, 133, 243, 0.12), rgba(16, 185, 129, 0.12));
		border: 1px solid rgba(27, 133, 243, 0.3);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
	}
	.draft-alert-content {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.draft-alert-icon {
		font-size: 26px;
		color: var(--aero-sky);
	}
	.draft-alert-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* ── Status Toasts ── */
	.status-toast {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		font-size: 0.85rem;
		font-weight: 600;
		border-radius: var(--radius-md);
		box-shadow: 0 8px 24px rgba(2, 12, 27, 0.18);
	}
	.error-toast {
		background: rgba(244, 63, 94, 0.15);
		border: 1px solid rgba(244, 63, 94, 0.35);
		color: #fb7185;
	}
	.success-toast {
		background: rgba(16, 185, 129, 0.15);
		border: 1px solid rgba(16, 185, 129, 0.35);
		color: #34d399;
	}
	.toast-close {
		margin-left: auto;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
	}

	/* ── Main Responsive Grid ── */
	.creator-grid {
		display: grid;
		align-items: start;
		grid-template-columns: minmax(0, 1.28fr) minmax(0, 1fr);
		gap: 22px;
	}

	/* ── Editor Column ── */
	.editor-column {
		display: flex;
		flex-direction: column;
		position: relative;
		min-width: 0;
	}

	/* ── Unified Composer Studio Card ── */
	.composer-studio-card {
		position: relative;
		border-radius: var(--radius-xl);
		padding: 24px;
		background:
			var(--accent-gradient) top left / 100% 3px no-repeat,
			var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-border);
		border-top-color: var(--glass-border-t);
		box-shadow: var(--shadow-sm), var(--glass-inset-highlight);
		display: flex;
		flex-direction: column;
		gap: 16px;
		animation: cardIn 0.4s var(--ease-out) both;
	}

	/* Drag & Drop Overlay */
	.editor-drag-overlay {
		position: absolute;
		inset: 0;
		z-index: 90;
		border-radius: var(--radius-xl);
		background: color-mix(in srgb, var(--bg-surface) 85%, transparent);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		animation: editorDragFade 0.15s ease;
	}
	.editor-drag-badge {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 24px;
		border-radius: var(--radius-full);
		border: 2px dashed rgba(34, 211, 238, 0.7);
		background: rgba(34, 211, 238, 0.12);
		color: var(--aero-sky, #38bdf8);
		font-weight: 800;
		font-size: 0.9rem;
		box-shadow: 0 0 20px rgba(34, 211, 238, 0.4);
	}

	/* Studio Header */
	.studio-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 4px;
	}
	.author-mini-profile {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.author-info-text {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
		gap: 3px;
	}
	.author-name-row {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.author-display-name {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: -0.01em;
	}
	.author-name-row :global(.custom-badge-wrapper) {
		margin-left: 0;
		flex-shrink: 0;
	}
	.author-name-row :global(.level-badge-container) {
		margin-left: 0;
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
	}
	.author-name-row :global(.user-title-badge) {
		margin-left: 0;
		flex-shrink: 0;
	}
	.author-meta-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.78rem;
		line-height: 1.2;
		color: var(--text-muted);
	}
	.author-handle {
		font-weight: 500;
		color: var(--text-secondary);
	}
	.anon-avatar-box {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-squircle);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(34, 211, 238, 0.22))
		);
		border: 1px solid var(--anon-border, rgba(129, 140, 248, 0.45));
		box-shadow:
			0 4px 14px rgba(99, 102, 241, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.25);
		color: var(--anon-accent, #818cf8);
	}
	.stealth-badge {
		font-size: 10px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 6px;
		border-radius: var(--radius-full);
		background: var(--anon-bg, rgba(99, 102, 241, 0.2));
		color: var(--anon-text, #4338ca);
		border: 1px solid var(--anon-border, rgba(99, 102, 241, 0.4));
		box-shadow: 0 0 8px rgba(99, 102, 241, 0.2);
	}
	.studio-header-right {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}

	/* Circular Character Gauge */
	.char-gauge-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
	}
	.char-svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	.char-circle-bg {
		fill: none;
		stroke: var(--border-subtle);
		stroke-width: 3.5;
	}
	.char-circle-fill {
		fill: none;
		stroke-linecap: round;
		transition:
			stroke-dasharray 0.2s ease,
			stroke 0.2s ease;
		stroke-width: 3.5;
	}
	.char-text {
		position: absolute;
		font-weight: 800;
		font-family: monospace;
		font-size: 9.5px;
	}

	/* ── Quoted Post Container ── */
	.quote-loading-box {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px;
		font-size: 0.85rem;
		color: var(--text-muted);
		border-radius: var(--radius-md);
	}
	.quote-loading-box .loading-spinner {
		width: 18px;
		height: 18px;
		border-width: 2px;
	}
	.quoted-post-card {
		padding: 12px 14px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface2);
	}
	.quoted-post-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}
	.quoted-post-title {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--accent-blue-base);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.quoted-post-remove {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px;
		border-radius: var(--radius-xs);
		display: flex;
		align-items: center;
	}
	.quoted-post-remove:hover {
		color: var(--aero-rose);
	}
	.quoted-post-body {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.quoted-post-avatar {
		flex: 0 0 32px;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-squircle);
		overflow: hidden;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
	}
	.quoted-post-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.quoted-post-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		font-size: 0.82rem;
	}
	.quoted-post-name {
		font-weight: 700;
		color: var(--text-primary);
	}
	.quoted-post-user {
		color: var(--text-muted);
	}
	.quoted-post-text {
		width: 100%;
		margin: 4px 0 0 0;
		font-size: 0.85rem;
		color: var(--text-secondary);
		max-height: 72px;
		overflow: hidden;
	}
	.quoted-post-media {
		position: relative;
		width: 100%;
		margin-top: 8px;
		border-radius: var(--radius-md, 10px);
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.05));
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.quoted-post-media img,
	.quoted-post-media video {
		width: 100%;
		height: auto;
		max-height: 280px;
		object-fit: contain;
		display: block;
	}

	/* ── Textarea Shell & Autocomplete ── */
	.textarea-shell {
		position: relative;
		width: 100%;
	}
	.creator-textarea {
		width: 100%;
		border: 1px solid var(--border-subtle);
		padding: 16px 18px;
		font-family: var(--font-sans);
		line-height: 1.65;
		color: var(--text-primary);
		resize: vertical;
		outline: none;
		box-sizing: border-box;
		transition:
			border-color var(--t-fast),
			box-shadow var(--t-fast),
			background var(--t-fast);
		min-height: 140px;
		font-size: 1.02rem;
		border-radius: var(--radius-md);
		cursor: var(--cursor-text);
		background:
			linear-gradient(180deg, rgba(var(--accent-blue-rgb), 0.03), transparent 40%), var(--bg-input);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.04);
	}
	.creator-textarea::placeholder {
		color: var(--text-muted);
		opacity: 0.65;
	}
	.creator-textarea:focus {
		border-color: var(--aero-sky);
		background: var(--bg-input);
		box-shadow:
			0 0 0 3px rgba(0, 229, 255, 0.18),
			inset 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	/* Autocomplete Dock */
	.autocomplete-dock {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		max-height: 240px;
		z-index: 100;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		overflow: hidden;
		width: min(320px, calc(100vw - 32px));
		border-radius: var(--radius-md);
		box-shadow: 0 12px 32px rgba(2, 12, 27, 0.35);
	}
	.autocomplete-header {
		padding: 8px 12px;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--bg-overlay);
	}
	.autocomplete-list {
		padding: 4px;
		overflow-y: auto;
		max-height: 190px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.autocomplete-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: background var(--t-fast);
		width: 100%;
		border-radius: var(--radius-sm);
	}
	.autocomplete-item:hover,
	.autocomplete-item.selected {
		background: rgba(var(--accent-blue-rgb), 0.14);
	}
	.autocomplete-item:focus-visible {
		outline: 2px solid var(--aero-sky);
		outline-offset: -2px;
	}
	.autocomplete-icon.tag-icon {
		font-weight: 800;
		color: var(--aero-sky);
	}

	/* ── Attached Meta Pills ── */
	.attached-meta-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.meta-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border-radius: var(--radius-full);
		font-weight: 700;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		padding: 5px 12px;
		font-size: 0.76rem;
		box-shadow: var(--shadow-xs);
	}
	.location-pill {
		color: #38bdf8;
		border-color: rgba(56, 189, 248, 0.3);
		background: rgba(56, 189, 248, 0.08);
	}
	.music-pill {
		color: #c084fc;
		border-color: rgba(192, 132, 252, 0.3);
		background: rgba(192, 132, 252, 0.08);
	}
	.schedule-pill {
		color: #818cf8;
		border-color: rgba(129, 140, 248, 0.3);
		background: rgba(129, 140, 248, 0.08);
	}
	.meta-pill-remove {
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		display: flex;
		padding: 0;
	}

	/* ── Attached Audio Player ── */
	.attached-audio-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		border: 1px solid rgba(251, 113, 133, 0.3);
	}
	.audio-card-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.audio-play-btn {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: linear-gradient(135deg, #fb7185, #e11d48);
		border: none;
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(225, 29, 72, 0.35);
		transition: transform var(--t-fast);
	}
	.audio-play-btn:hover {
		transform: scale(1.08);
	}
	.remove-audio-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
	}
	.remove-audio-btn:hover {
		color: #f43f5e;
	}

	/* ── Media Thumbnails Grid in Composer ── */
	.media-preview-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-auto-rows: 1fr;
		gap: 6px;
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.media-preview-grid.grid-count-1 {
		grid-template-columns: 1fr;
	}
	.media-preview-grid.grid-count-3 .media-thumb-box:first-child {
		grid-row: span 2;
	}
	.media-preview-grid.grid-count-4 {
		grid-template-rows: 1fr 1fr;
	}
	.media-thumb-box {
		position: relative;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		background: #000000;
		border-radius: var(--radius-md);
		border-color: var(--glass-border);
		box-shadow: var(--shadow-sm);
	}
	.media-preview-grid.grid-count-1 .media-thumb-box {
		aspect-ratio: auto;
		max-height: 380px;
	}
	.thumb-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.gif-tag {
		position: absolute;
		bottom: 6px;
		left: 6px;
		background: rgba(0, 0, 0, 0.72);
		color: #ffffff;
		font-size: 9px;
		font-weight: 800;
		padding: 2px 6px;
		border-radius: var(--radius-xs);
	}
	.video-thumb-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.3);
		z-index: 2;
	}
	.video-thumb-icon {
		font-size: 24px;
		color: #ffffff;
	}
	.remove-thumb-btn,
	.crop-thumb-btn {
		position: absolute;
		top: 6px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.7);
		border: none;
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 5;
		transition: all var(--t-fast);
	}
	.remove-thumb-btn {
		right: 6px;
	}
	.remove-thumb-btn:hover {
		background: #f43f5e;
	}
	.crop-thumb-btn {
		left: 6px;
	}
	.crop-thumb-btn:hover {
		background: var(--aero-blue);
	}

	/* ── Mood Ribbon Section ── */
	.mood-ribbon-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 14px;
		border-radius: var(--radius-lg);
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
	}
	.mood-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.clear-mood-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.72rem;
		font-weight: 700;
		border-radius: var(--radius-full);
		cursor: pointer;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--glass-inset-highlight);
		color: var(--text-secondary);
		padding: 2px 8px;
	}
	.clear-mood-btn:hover {
		border-color: var(--aero-rose);
		color: var(--aero-rose);
	}
	.mood-carousel-mask {
		position: relative;
		mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
		-webkit-mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
	}
	.mood-scroller {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		padding: 3px 6px 4px 6px;
		scrollbar-width: none;
		cursor: grab;
	}
	.mood-scroller.dragging {
		cursor: grabbing;
	}
	.mood-scroller::-webkit-scrollbar {
		display: none;
	}
	.mood-pill {
		display: inline-flex;
		align-items: center;
		border-radius: var(--radius-full);
		color: var(--text-primary);
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--t-fast);
		gap: 6px;
		padding: 5px 12px 5px 6px;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-xs);
		font-size: 0.78rem;
		font-weight: 600;
	}
	.mood-pill:hover {
		background: var(--bg-surface-hover);
		transform: translateY(-1px);
		border-color: var(--aero-sky);
		box-shadow: 0 4px 12px rgba(var(--accent-blue-rgb), 0.2);
	}
	.mood-pill.selected {
		transform: translateY(-1px);
		background:
			linear-gradient(var(--bg-surface), var(--bg-surface)) padding-box,
			var(--grad-primary) border-box;
		border: 1px solid transparent;
		box-shadow: 0 4px 14px rgba(var(--accent-blue-rgb), 0.3);
		color: var(--text-primary);
	}
	.m-icon {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--bg-overlay);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		transition: transform var(--t-spring);
	}
	.mood-pill:hover .m-icon {
		transform: scale(1.15);
	}

	/* ── Action Dock (8 Complete Tools) ── */
	.action-dock {
		display: flex;
		align-items: stretch;
		justify-content: space-between;
		gap: 4px;
		padding: 6px 8px;
		border-radius: var(--radius-full);
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-xs);
	}
	.dock-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		border: 1px solid transparent;
		background: transparent;
		cursor: pointer;
		position: relative;
		transition: all var(--t-fast);
		border-radius: var(--radius-full);
		padding: 6px 4px;
		gap: 4px;
	}
	.dock-btn:hover {
		background: var(--bg-surface-hover);
		transform: translateY(-1px);
	}
	.dock-icon {
		position: relative;
		font-family: 'Material Icons Round';
		line-height: 1;
		font-size: 20px;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-full);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: all var(--t-spring);
	}
	.dock-count-badge {
		position: absolute;
		top: -3px;
		right: -3px;
		background: #0ea5e9;
		color: #ffffff;
		font-size: 9px;
		font-weight: 800;
		font-family: var(--font-sans);
		width: 15px;
		height: 15px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 0 6px rgba(14, 165, 233, 0.6);
	}
	.dock-label {
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--text-muted);
	}
	.dock-btn:hover .dock-label,
	.dock-btn.pressed .dock-label {
		color: var(--text-primary);
	}
	.dock-btn:focus-visible {
		outline: 2px solid var(--aero-sky);
		outline-offset: 2px;
	}
	.dock-icon.cyan {
		background: rgba(14, 165, 233, 0.14);
		color: #0ea5e9;
	}
	.dock-icon.amber {
		background: rgba(251, 191, 36, 0.14);
		color: #fbbf24;
	}
	.dock-icon.fuchsia {
		background: rgba(232, 121, 249, 0.14);
		color: #e879f9;
	}
	.dock-icon.emerald {
		background: rgba(52, 211, 153, 0.14);
		color: #34d399;
	}
	.dock-icon.rose {
		background: rgba(251, 113, 133, 0.14);
		color: #fb7185;
	}
	.dock-icon.purple {
		background: rgba(192, 132, 252, 0.14);
		color: #c084fc;
	}
	.dock-icon.sky {
		background: rgba(56, 189, 248, 0.14);
		color: #38bdf8;
	}
	.dock-icon.indigo {
		background: rgba(129, 140, 248, 0.14);
		color: #818cf8;
	}
	.dock-btn.pressed {
		background: rgba(var(--accent-blue-rgb), 0.1);
		border-color: rgba(var(--accent-blue-rgb), 0.35);
		box-shadow: 0 2px 10px rgba(var(--accent-blue-rgb), 0.2);
	}
	.dock-btn.pressed .dock-icon {
		transform: scale(1.08);
		box-shadow:
			0 0 0 3px rgba(var(--accent-blue-rgb), 0.18),
			0 4px 14px rgba(var(--accent-blue-rgb), 0.35);
	}

	/* ── Expanded Dock Panels ── */
	.expanded-panel {
		padding: 16px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background:
			var(--accent-gradient) top left / 100% 2px no-repeat,
			var(--bg-surface);
		box-shadow: var(--shadow-sm);
	}
	.panel-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}
	.panel-heading {
		font-weight: 800;
		color: var(--text-primary);
		font-size: 0.9rem;
	}
	.panel-close-btn {
		width: 24px;
		height: 24px;
		border-radius: var(--radius-sm);
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.panel-close-btn:hover {
		color: var(--text-primary);
		background: var(--bg-surface-hover);
	}

	/* Poll Styles */
	.poll-options-grid {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.poll-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.poll-index-badge {
		width: 24px;
		height: 24px;
		border-radius: var(--radius-squircle);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 800;
		background: rgba(var(--accent-blue-rgb), 0.12);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.25);
		color: var(--aero-sky);
	}
	.poll-del-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
	}
	.poll-del-btn:hover {
		color: #f43f5e;
	}
	.poll-add-option-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		margin-top: 10px;
		padding: 8px;
		border-radius: var(--radius-sm);
		border: 1px dashed var(--border-subtle);
		background: transparent;
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		transition: all var(--t-fast);
	}
	.poll-add-option-btn:hover {
		color: var(--aero-blue);
		background: rgba(27, 133, 243, 0.05);
		border-color: rgba(var(--accent-blue-rgb), 0.6);
		box-shadow: 0 2px 10px rgba(var(--accent-blue-rgb), 0.15);
	}
	.poll-footer-controls {
		margin-top: 14px;
		padding-top: 10px;
		border-top: 1px solid var(--border-subtle);
	}

	/* Music Panel Styles */
	.music-presets-grid {
		display: grid;
		gap: 8px;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
	}
	.preset-card {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border: 1px solid var(--border-subtle);
		cursor: pointer;
		text-align: left;
		transition: all var(--t-fast);
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
	}
	.preset-card:hover {
		background: rgba(192, 132, 252, 0.1);
		border-color: rgba(192, 132, 252, 0.6);
		box-shadow: 0 6px 18px rgba(192, 132, 252, 0.25);
	}
	.preset-title {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-primary);
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.preset-artist {
		font-size: 0.65rem;
		color: var(--text-muted);
		display: block;
	}
	.music-inputs-row {
		display: flex;
		gap: 8px;
		margin-top: 6px;
		flex-wrap: wrap;
	}

	/* Location Panel */
	.location-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.location-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		border: none;
		background: transparent;
		color: var(--text-primary);
		font-size: 0.85rem;
		text-align: left;
		cursor: pointer;
		transition: background var(--t-fast);
		border-radius: var(--radius-md);
	}
	.location-item:hover,
	.location-item.selected {
		background: rgba(56, 189, 248, 0.12);
	}
	.custom-location-item {
		border: 1px dashed rgba(16, 185, 129, 0.4);
		color: #34d399;
	}

	/* Schedule Form */
	.schedule-toggle-row {
		display: flex;
		align-items: center;
		cursor: pointer;
		gap: 12px;
		padding: 2px 0;
	}

	/* ── Studio Footer Toolbar ── */
	.studio-footer-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 14px;
		border-top: 1px solid var(--border-subtle);
		gap: 12px;
		flex-wrap: wrap;
	}
	.footer-left {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.privacy-select-shell {
		width: 140px;
	}
	.stealth-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--t-fast);
		border-radius: var(--radius-full);
		padding: 7px 14px;
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-xs);
	}
	.stealth-toggle-btn:hover {
		background: var(--anon-bg, rgba(99, 102, 241, 0.15));
		border-color: var(--anon-border, rgba(99, 102, 241, 0.5));
		color: var(--anon-text, #4338ca);
		transform: translateY(-1px);
	}
	.stealth-toggle-btn.active {
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(34, 211, 238, 0.18))
		);
		border-color: var(--anon-border-active, rgba(99, 102, 241, 0.55));
		color: var(--anon-text, #4338ca);
		box-shadow: 0 0 16px rgba(99, 102, 241, 0.25);
	}
	.stealth-identity-tag {
		padding: 2px 8px;
		border-radius: var(--radius-full);
		background: var(--anon-bg, rgba(99, 102, 241, 0.2));
		border: 1px solid var(--anon-border, rgba(129, 140, 248, 0.45));
		color: var(--anon-text, #4338ca);
		font-size: 0.7rem;
		font-weight: 800;
	}
	.footer-right {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-left: auto;
	}
	.desktop-only {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: var(--radius-full);
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		color: var(--text-muted);
		font-size: 11px;
	}
	.publish-bottom-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 18px;
		font-size: 0.85rem;
		font-weight: 700;
	}

	/* ── Live Fidelity Preview Column ── */
	.preview-column {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.preview-sticky-wrapper {
		position: sticky;
		top: 84px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.preview-badge-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}
	.preview-header-label {
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
	}
	.live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--aero-rose);
		box-shadow: 0 0 8px var(--aero-rose);
		animation: livePulse 1.8s ease-in-out infinite;
	}

	/* ── Mock Post Card & Live Preview Styling ── */
	.mock-post-card {
		position: relative;
		padding: 1.6rem;
		border-radius: var(--radius-xl);
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-border);
		border-top-color: var(--glass-border-t);
		box-shadow: var(--shadow-sm), var(--glass-inset-highlight);
		transition:
			border-color var(--t-base),
			box-shadow var(--t-base),
			transform var(--t-spring);
		isolation: isolate;
		overflow: hidden;
	}
	.mock-post-card.is-anonymous-post {
		border-color: var(--anon-border, rgba(99, 102, 241, 0.4));
		box-shadow:
			0 8px 32px rgba(99, 102, 241, 0.14),
			inset 0 1px 2px rgba(255, 255, 255, 0.3);
	}
	.mock-post-card:hover {
		border-color: rgba(27, 133, 243, 0.4);
		box-shadow:
			0 10px 30px rgba(27, 133, 243, 0.12),
			var(--glass-inset-highlight);
		transform: translateY(-2px);
	}
	.mock-card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 14px;
		gap: 12px;
	}
	.mock-card-actions {
		display: flex;
		align-items: center;
	}
	.mock-more-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		border-radius: var(--radius-squircle);
		cursor: default;
		opacity: 0.65;
	}
	.post-mood-badge {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-muted);
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		display: inline-flex;
		align-items: center;
		gap: 4px;
		box-shadow: var(--shadow-xs);
	}
	.meta-row {
		color: color-mix(in srgb, var(--text-primary) 56%, transparent) !important;
		letter-spacing: 0.008em;
		margin-top: 2px;
	}
	.post-author-name {
		letter-spacing: -0.013em;
		line-height: 1.3;
	}
	.mock-card-body {
		margin: 12px 0 14px 0;
	}
	.post-text-content {
		font-size: 0.95rem;
		font-weight: 450;
		line-height: 1.6;
		color: var(--text-primary);
		letter-spacing: 0.011em;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.emoji-only-text {
		font-size: 2.8rem !important;
		line-height: 1.25;
		text-align: center;
		padding: 0.8rem 0;
	}
	.post-text-placeholder {
		color: var(--text-muted);
		line-height: 1.5;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		text-align: center;
		padding: 32px 18px;
		font-size: 0.88rem;
		background: var(--bg-surface2);
		border: 1.5px dashed var(--border-subtle);
		border-radius: var(--radius-lg);
	}
	.placeholder-icon-wrap {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgba(var(--accent-blue-rgb), 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.mock-schedule-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 9px 13px;
		margin-bottom: 12px;
		border-radius: var(--radius-sm);
		background: rgba(14, 165, 233, 0.1);
		border: 1px solid rgba(14, 165, 233, 0.25);
		color: var(--aero-sky, #2eb4ff);
		font-size: 0.78rem;
		font-weight: 500;
		box-shadow: 0 2px 10px rgba(14, 165, 233, 0.08);
	}
	.mock-quote-wrapper {
		margin: 12px 0;
	}
	.mock-music-banner {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-radius: var(--radius-md);
		background: linear-gradient(
			135deg,
			rgba(192, 132, 252, 0.12) 0%,
			rgba(147, 51, 234, 0.06) 100%
		);
		border: 1px solid rgba(192, 132, 252, 0.28);
		margin: 12px 0;
		box-shadow: 0 4px 16px rgba(192, 132, 252, 0.12);
	}
	.mock-music-icon-wrap {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: rgba(192, 132, 252, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.mock-music-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.mock-music-label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #c084fc;
	}
	.mock-music-meta {
		font-size: 0.82rem;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.mock-music-title {
		font-weight: 700;
	}
	.mock-music-artist {
		color: var(--text-muted);
		font-weight: 500;
	}

	/* Mock Voice Player */
	.mock-voice-player {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 14px;
		border-radius: var(--radius-full);
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		margin: 12px 0;
		box-shadow: var(--shadow-sm);
	}
	.mock-voice-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--aero-rose, #ec4899) 0%, #f43f5e 100%);
		border: none;
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 2px 10px rgba(236, 72, 153, 0.35);
		transition: transform var(--t-spring);
		flex-shrink: 0;
	}
	.mock-voice-btn:hover {
		transform: scale(1.06);
	}
	.mock-voice-waveform {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
	}
	.waveform-bars {
		display: flex;
		align-items: center;
		gap: 3px;
		height: 22px;
		flex: 1;
	}
	.waveform-bars .bar {
		width: 3px;
		background: var(--aero-rose, #ec4899);
		border-radius: 3px;
		opacity: 0.65;
		transition:
			height 0.2s ease,
			opacity 0.2s ease;
	}
	.waveform-bars.is-playing .bar {
		opacity: 0.95;
		animation: voicePulse 1s ease-in-out infinite alternate;
		animation-delay: var(--bar-delay, 0s);
	}
	@keyframes voicePulse {
		0% {
			transform: scaleY(0.4);
		}
		100% {
			transform: scaleY(1.1);
		}
	}
	.mock-voice-meta {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex-shrink: 0;
	}
	.mock-voice-tag {
		font-size: 10px;
		font-weight: 700;
		color: var(--text-muted);
	}
	.mock-voice-status {
		font-size: 9px;
		color: var(--aero-rose);
		font-weight: 600;
	}

	/* Mock Media Grid */
	.mock-media-grid {
		display: grid;
		gap: 6px;
		overflow: hidden;
		margin: 12px 0;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		position: relative;
	}
	.mock-media-grid.grid-count-1 {
		display: block;
	}
	.mock-media-grid.grid-count-1 .grid-media-cell {
		aspect-ratio: auto;
		max-height: 440px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.mock-media-grid.grid-count-1 img.grid-media-content,
	.mock-media-grid.grid-count-1 video.grid-media-content {
		width: auto;
		max-width: 100%;
		max-height: 440px;
		margin: 0 auto;
		display: block;
		object-fit: contain;
		border-radius: var(--radius-sm);
	}
	.mock-media-grid.grid-count-2 {
		grid-template-columns: 1fr 1fr;
	}
	.mock-media-grid.grid-count-3 {
		grid-template-columns: 1fr 1fr;
	}
	.mock-media-grid.grid-count-3 .grid-media-cell:first-child {
		grid-row: span 2;
	}
	.mock-media-grid.grid-count-4 {
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
	}
	.grid-media-cell {
		position: relative;
		aspect-ratio: 16 / 9;
		background: #000000;
		overflow: hidden;
		border-radius: var(--radius-xs);
	}
	.mock-media-grid.grid-count-2 .grid-media-cell,
	.mock-media-grid.grid-count-4 .grid-media-cell {
		aspect-ratio: 1;
	}
	.mock-media-grid.grid-count-3 .grid-media-cell:not(:first-child) {
		aspect-ratio: 16 / 9;
	}
	.grid-media-content {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.grid-gif-tag {
		position: absolute;
		bottom: 8px;
		left: 8px;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(4px);
		color: #ffffff;
		font-size: 10px;
		font-weight: 800;
		padding: 2px 6px;
		border-radius: var(--radius-xs);
		letter-spacing: 0.05em;
	}
	.grid-more-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(6px);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		font-weight: 800;
		user-select: none;
	}

	/* Mock Card Footer */
	.mock-card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 12px;
		margin-top: 12px;
		border-top: 1px solid var(--border-subtle);
	}
	.mock-stat-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 10px;
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
		user-select: none;
		transition: all var(--t-fast);
	}
	.mock-stat-btn .count {
		font-size: 0.8rem;
	}
	.mock-stat-btn.mock-like:hover {
		color: var(--aero-rose, #ec4899);
		background: rgba(236, 72, 153, 0.08);
		transform: translateY(-1px);
	}
	.mock-stat-btn.mock-comment:hover {
		color: var(--aero-sky, #2eb4ff);
		background: rgba(46, 180, 255, 0.08);
		transform: translateY(-1px);
	}
	.mock-stat-btn.mock-repost:hover {
		color: var(--aero-mint, #00d4aa);
		background: rgba(0, 212, 170, 0.08);
		transform: translateY(-1px);
	}
	.mock-stat-btn-save {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6px;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all var(--t-fast);
	}
	.mock-stat-btn-save:hover {
		color: var(--aero-amber, #f5a623);
		background: rgba(245, 166, 35, 0.08);
		transform: translateY(-1px);
	}

	/* ── General Utilities ── */
	.text-main {
		color: var(--text-primary);
	}
	.text-muted {
		color: var(--text-muted);
	}
	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		display: inline-block;
	}

	/* Scoped Tailwind-like Utilities */
	.text-\[11px\] {
		font-size: 11px;
		line-height: 1.45;
	}
	.text-\[10px\] {
		font-size: 10px;
		line-height: 1.45;
	}
	.font-mono {
		font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
	}
	.w-6 {
		width: 1.5rem;
	}
	.h-6 {
		height: 1.5rem;
	}
	.max-h-44 {
		max-height: 11rem;
	}
	.py-1\.5 {
		padding-block: 0.375rem;
	}
	.px-2\.5 {
		padding-inline: 0.625rem;
	}
	.text-sky-400 {
		color: #38bdf8;
	}
	.text-emerald-400 {
		color: #34d399;
	}
	.text-indigo-400 {
		color: #818cf8;
	}
	.text-purple-400 {
		color: #c084fc;
	}
	.text-rose-400 {
		color: #fb7185;
	}
	.text-fuchsia-400 {
		color: #e879f9;
	}
	.text-amber-400 {
		color: #fbbf24;
	}
	.text-aero-blue {
		color: var(--aero-blue);
	}

	/* HTML Preview formatting */
	:global(.preview-hashtag) {
		color: var(--aero-sky);
		font-weight: 600;
	}
	:global(.preview-mention) {
		color: var(--aero-mint);
		font-weight: 600;
	}
	:global(.preview-link) {
		color: var(--aero-blue);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	/* Keyframes */
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes livePulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.55;
			transform: scale(0.85);
		}
	}
	@keyframes cardIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes editorDragFade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes dockIn {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	/* Responsive Queries */
	@media (max-width: 1000px) {
		.creator-wrapper {
			padding: 12px 14px 80px 14px;
		}
		.desktop-only {
			display: none;
		}
		.editor-column.mobile-hidden,
		.preview-column.mobile-hidden {
			display: none;
		}
		.creator-topbar {
			flex-wrap: wrap;
			gap: 10px;
		}
		.mobile-tabs-pill {
			display: flex;
			order: 3;
			width: 100%;
			justify-content: center;
		}
		.topbar-right {
			margin-left: auto;
		}
		.creator-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.creator-title {
			font-size: 1.1rem;
		}
		.title-icon-chip {
			width: 28px;
			height: 28px;
			flex-basis: 28px;
		}
		.title-icon-chip .material-icons-round {
			font-size: 16px;
		}
		.back-btn {
			width: 36px;
			height: 36px;
		}
		.action-dock {
			border-radius: var(--radius-md);
		}
		.dock-icon {
			width: 36px;
			height: 36px;
			font-size: 20px;
		}
		.music-inputs-row {
			flex-direction: column;
		}
		.music-inputs-row .btn-aero-primary {
			width: 100%;
		}
		.preview-sticky-wrapper {
			position: static;
		}
	}
	@media (max-width: 1280px) {
		.dock-label {
			display: none;
		}
		.dock-btn {
			padding: 7px 4px;
		}
	}
	@media (max-width: 480px) {
		.creator-subtitle-row {
			display: none;
		}
		.composer-studio-card {
			padding: 16px;
		}
		.mock-post-card {
			padding: 16px;
		}
		.publish-action-btn {
			padding: 9px 14px;
			font-size: 0.8rem;
		}
	}
</style>
