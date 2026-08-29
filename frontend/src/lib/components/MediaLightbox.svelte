<script>
	/**
	 * MediaLightbox.svelte - Visor de Medios Universal Glassmorphism 2.0 / Neo-Aero para Voom!
	 *
	 * Características:
	 * - Diseño Split-View 100% integrado al sistema de diseño Voom! y respetuoso con los temas (Light, Dark, Midnight).
	 * - Motor de Zoom fluido y continuo (1x a 4x) con interpolación suave en rueda y doble click.
	 * - Paneo libre con física de inercia, fricción y contención estricta de límites (la imagen nunca se pierde).
	 * - Doble click para zoom suave (1x <-> 2.2x).
	 * - Swipe vertical hacia abajo para descartar suavemente cuando scale === 1x.
	 * - Columna lateral con diseño, tipografía y compositor idénticos a PostCard (emojis, gifs, fotos).
	 * - Compatibilidad universal con posts, avatares, fotos de portada e imágenes de comentarios.
	 */

	import { fade, scale as svelteScale, slide } from 'svelte/transition';
	import { cubicOut, expoOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { mediaViewer } from '$lib/stores/mediaViewer.svelte.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { posts as postsApi } from '$lib/api.js';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';
	import CommentItem from '$lib/components/CommentItem.svelte';
	import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
	import KlipyPicker from '$lib/components/KlipyPicker.svelte';
	import HashtagTextarea from '$lib/components/HashtagTextarea.svelte';
	import AnonIdentityModal from '$lib/components/AnonIdentityModal.svelte';
	import QuoteCard from '$lib/components/QuoteCard.svelte';
	import MediaPlayer from '$lib/components/MediaPlayer.svelte';
	import { getAnonIdentity } from '$lib/stores/anonIdentity.svelte.js';
	import { compressImage } from '$lib/utils/imageCompression.js';
	import { formatHashtags } from '$lib/utils/textFormatting.js';
	import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';
	import { generateLikeSparkles } from '$lib/utils/likeSparkles.js';

	// ── Post & Social State ──────────────────────────────────────────────────
	let post = $derived(mediaViewer.activePost);
	let liked = $state(false);
	let likeCount = $state(0);
	let isAnimatingLike = $state(false);
	let isAnimatingUnlike = $state(false);
	let likeParticles = $state([]);
	let animLikeTimeout = null;
	let shared = $state(false);
	let shareCount = $state(0);
	let saved = $state(false);
	let copySuccess = $state(false);

	// ── Comments State ───────────────────────────────────────────────────────
	let comments = $state([]);
	let commentsLoading = $state(false);
	let commentText = $state('');
	let submittingComment = $state(false);
	let showCommentEmojis = $state(false);
	let showCommentGifs = $state(false);
	let showCommentMedia = $state(false);
	let attachedCommentGif = $state('');
	let attachedCommentImage = $state('');
	let uploadingCommentImage = $state(false);
	let commentFileInput = $state(null);
	let commentPollInterval = null;
	let mobileCommentsOpen = $state(false);
	let mobileShareOpen = $state(false);
	let desktopShareOpen = $state(false);
	let moreMenuOpen = $state(false);
	let shareBtnEl = $state(null);
	let desktopShareMenuStyle = $state({});

	// Abre/cierra el menú de compartir de escritorio anclado al botón (fijo al viewport
	// para que no se desplace con el contenido del sidebar). Siempre abre hacia ARRIBA:
	// debajo del botón está el compositor de comentarios y abrirlo ahí lo taparía.
	function toggleDesktopShare() {
		desktopShareOpen = !desktopShareOpen;
		if (desktopShareOpen && shareBtnEl) {
			const r = shareBtnEl.getBoundingClientRect();
			const menuHeight = 150;
			const left = `${Math.max(8, r.right - 260)}px`;
			// El borde inferior del menú queda 6px por encima del botón; si no cabe
			// entero, se clampa para que el menú siga visible dentro del viewport.
			const bottom = Math.min(window.innerHeight - r.top + 6, window.innerHeight - menuHeight - 8);
			desktopShareMenuStyle = {
				bottom: `${Math.max(8, bottom)}px`,
				left
			};
		}
	}

	// ── Anon Identity ────────────────────────────────────────────────────────
	let myAnonUsername = $state(null);
	let anonIdentityLoaded = $state(false);
	let showAnonIdentityModal = $state(false);
	let pendingAnonComment = $state(false);

	// ── Zoom & Pan Physics Engine ────────────────────────────────────────────
	let zoomScale = $state(1);
	let targetZoomScale = $state(1);
	let translateX = $state(0);
	let translateY = $state(0);
	let isDragging = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let lastPointerX = 0;
	let lastPointerY = 0;
	let velocityX = 0;
	let velocityY = 0;
	let lastTime = 0;
	let animFrameId = null;
	let stageEl = $state(null);
	let imageEl = $state(null);
	let touchDistanceStart = 0;
	let touchScaleStart = 1;
	let dismissOffsetY = $state(0);
	let isDismissing = $state(false);

	// Reset transform whenever current image changes
	$effect(() => {
		if (mediaViewer.currentIndex !== undefined) {
			resetTransform();
		}
	});

	// Close media lightbox whenever route navigation occurs
	afterNavigate(() => {
		if (mediaViewer.isOpen) {
			mediaViewer.close();
		}
	});

	// Lock viewport & master scrollbar when lightbox is open (Twitter/X style)
	$effect(() => {
		if (mediaViewer.isOpen) {
			if (typeof document !== 'undefined') {
				document.documentElement.classList.add('is-lightbox-open');
				document.body.classList.add('is-lightbox-open');
				document.documentElement.style.overflow = 'hidden';
				document.body.style.overflow = 'hidden';
			}
		} else {
			if (typeof document !== 'undefined') {
				document.documentElement.classList.remove('is-lightbox-open');
				document.body.classList.remove('is-lightbox-open');
				document.documentElement.style.overflow = '';
				document.body.style.overflow = '';
			}
		}

		return () => {
			if (typeof document !== 'undefined') {
				document.documentElement.classList.remove('is-lightbox-open');
				document.body.classList.remove('is-lightbox-open');
				document.documentElement.style.overflow = '';
				document.body.style.overflow = '';
			}
		};
	});

	function resetTransform() {
		cancelInertia();
		zoomScale = 1;
		targetZoomScale = 1;
		translateX = 0;
		translateY = 0;
		dismissOffsetY = 0;
		isDragging = false;
	}

	function cancelInertia() {
		if (animFrameId) {
			cancelAnimationFrame(animFrameId);
			animFrameId = null;
		}
	}

	function clampBounds(x, y, s) {
		if (!stageEl || !imageEl || s <= 1) {
			return { x: 0, y: 0 };
		}
		const stageRect = stageEl.getBoundingClientRect();
		const imgRect = imageEl.getBoundingClientRect();
		const currentW = (imgRect.width / zoomScale) * s;
		const currentH = (imgRect.height / zoomScale) * s;

		const maxDistX = Math.max(0, (currentW - stageRect.width) / 2 + 30);
		const maxDistY = Math.max(0, (currentH - stageRect.height) / 2 + 30);

		return {
			x: Math.max(-maxDistX, Math.min(maxDistX, x)),
			y: Math.max(-maxDistY, Math.min(maxDistY, y))
		};
	}

	function handleWheel(e) {
		if (mediaViewer.currentItem?.type === 'video') return;
		e.preventDefault();

		// Smooth continuous zoom
		const zoomFactor = Math.exp(-e.deltaY * 0.0018);
		targetZoomScale = Math.max(1, Math.min(4, targetZoomScale * zoomFactor));

		zoomScale = targetZoomScale;

		if (zoomScale <= 1.01) {
			zoomScale = 1;
			targetZoomScale = 1;
			translateX = 0;
			translateY = 0;
		} else {
			const clamped = clampBounds(translateX, translateY, zoomScale);
			translateX = clamped.x;
			translateY = clamped.y;
		}
	}

	function handleDoubleClick() {
		if (mediaViewer.currentItem?.type === 'video') return;
		if (zoomScale > 1.1) {
			resetTransform();
		} else {
			targetZoomScale = 2.2;
			zoomScale = 2.2;
			translateX = 0;
			translateY = 0;
		}
	}

	function handlePointerDown(e) {
		if (e.button !== 0 && e.pointerType === 'mouse') return;
		cancelInertia();
		isDragging = true;
		dragStartX = e.clientX - translateX;
		dragStartY = e.clientY - translateY;
		lastPointerX = e.clientX;
		lastPointerY = e.clientY;
		lastTime = performance.now();
		velocityX = 0;
		velocityY = 0;
		isDismissing = false;

		try {
			e.target.setPointerCapture?.(e.pointerId);
		} catch {}
	}

	function handlePointerMove(e) {
		if (!isDragging) return;

		const now = performance.now();
		const dt = Math.max(1, now - lastTime);
		lastTime = now;

		const currentX = e.clientX;
		const currentY = e.clientY;

		velocityX = ((currentX - lastPointerX) / dt) * 16;
		velocityY = ((currentY - lastPointerY) / dt) * 16;
		lastPointerX = currentX;
		lastPointerY = currentY;

		if (zoomScale > 1) {
			const rawX = currentX - dragStartX;
			const rawY = currentY - dragStartY;
			const clamped = clampBounds(rawX, rawY, zoomScale);
			translateX = clamped.x;
			translateY = clamped.y;
		} else {
			// Swipe down to dismiss gesture
			const diffY = currentY - dragStartY;
			if (diffY > 0) {
				dismissOffsetY = diffY;
				isDismissing = true;
			}
		}
	}

	function handlePointerUp(e) {
		if (!isDragging) return;
		isDragging = false;

		try {
			e.target.releasePointerCapture?.(e.pointerId);
		} catch {}

		if (isDismissing) {
			if (dismissOffsetY > 110) {
				mediaViewer.close();
			} else {
				dismissOffsetY = 0;
			}
			isDismissing = false;
			return;
		}

		if (zoomScale > 1) {
			startInertia();
		}
	}

	function startInertia() {
		cancelInertia();
		const friction = 0.92;

		function step() {
			if (Math.abs(velocityX) < 0.1 && Math.abs(velocityY) < 0.1) {
				animFrameId = null;
				return;
			}

			velocityX *= friction;
			velocityY *= friction;

			const targetX = translateX + velocityX;
			const targetY = translateY + velocityY;
			const clamped = clampBounds(targetX, targetY, zoomScale);

			if (clamped.x !== targetX) velocityX = 0;
			if (clamped.y !== targetY) velocityY = 0;

			translateX = clamped.x;
			translateY = clamped.y;

			animFrameId = requestAnimationFrame(step);
		}

		animFrameId = requestAnimationFrame(step);
	}

	// Touch pinch-to-zoom
	function handleTouchStart(e) {
		if (e.touches.length === 2) {
			touchDistanceStart = Math.hypot(
				e.touches[0].clientX - e.touches[1].clientX,
				e.touches[0].clientY - e.touches[1].clientY
			);
			touchScaleStart = zoomScale;
		}
	}

	function handleTouchMove(e) {
		if (e.touches.length === 2 && touchDistanceStart > 0) {
			const dist = Math.hypot(
				e.touches[0].clientX - e.touches[1].clientX,
				e.touches[0].clientY - e.touches[1].clientY
			);
			const factor = dist / touchDistanceStart;
			targetZoomScale = Math.max(1, Math.min(4, touchScaleStart * factor));
			zoomScale = targetZoomScale;
		}
	}

	// ── Post Synchronization & Comments ───────────────────────────────────────
	let lastLoadedPostId = null;

	$effect(() => {
		const isOpen = mediaViewer.isOpen;
		const currentPost = mediaViewer.activePost;
		const postId = currentPost?.id;

		if (isOpen && currentPost && postId) {
			if (lastLoadedPostId !== postId) {
				lastLoadedPostId = postId;
				liked = Boolean(currentPost.user_liked);
				likeCount = currentPost.like_count || 0;
				shared = Boolean(currentPost.user_shared);
				shareCount = currentPost.share_count || 0;
				saved = Boolean(currentPost.user_saved);
				desktopShareOpen = false;

				if (currentPost.is_anonymous) {
					getAnonIdentity().then((ident) => {
						myAnonUsername = ident?.anon_username || null;
						anonIdentityLoaded = true;
					});
				}

				untrack(() => loadComments());
				clearInterval(commentPollInterval);
				commentPollInterval = setInterval(() => {
					if (typeof document !== 'undefined' && !document.hidden) {
						loadComments(true);
					}
				}, 8000);
			}
		} else if (!isOpen) {
			lastLoadedPostId = null;
			clearInterval(commentPollInterval);
			commentPollInterval = null;
			comments = [];
			commentText = '';
			attachedCommentGif = '';
			attachedCommentImage = '';
			showCommentEmojis = false;
			showCommentGifs = false;
			showCommentMedia = false;
			resetTransform();
		}

		return () => {
			if (commentPollInterval) clearInterval(commentPollInterval);
			cancelInertia();
		};
	});

	async function loadComments(isBackgroundPoll = false) {
		if (!mediaViewer.activePost?.id || commentsLoading) return;
		if (!isBackgroundPoll && comments.length === 0) {
			commentsLoading = true;
		}
		try {
			const data = await postsApi.comments.list(mediaViewer.activePost.id);
			const loaded = data.comments || [];
			const map = {};
			const topLevel = [];

			loaded.forEach((c) => {
				c.replies = [];
				map[c.id] = c;
			});

			loaded.forEach((c) => {
				if (c.parent_id && map[c.parent_id]) {
					map[c.parent_id].replies.push(c);
				} else {
					topLevel.push(c);
				}
			});

			comments = topLevel;
		} catch (err) {
			console.error('Error loading comments in lightbox:', err);
		} finally {
			commentsLoading = false;
		}
	}

	async function toggleLike() {
		if (!authStore.isAuthenticated) {
			window.location.href = '/login';
			return;
		}
		if (!mediaViewer.activePost?.id) return;

		const prevLiked = liked;
		liked = !liked;
		likeCount += liked ? 1 : -1;

		if (animLikeTimeout) clearTimeout(animLikeTimeout);

		if (liked) {
			isAnimatingLike = true;
			isAnimatingUnlike = false;
			likeParticles = generateLikeSparkles(8, 22);
			animLikeTimeout = setTimeout(() => {
				isAnimatingLike = false;
				likeParticles = [];
			}, 650);
		} else {
			isAnimatingLike = false;
			isAnimatingUnlike = true;
			likeParticles = [];
			animLikeTimeout = setTimeout(() => {
				isAnimatingUnlike = false;
			}, 350);
		}

		mediaViewer.updateActivePost({ user_liked: liked, like_count: likeCount });

		try {
			if (liked) await postsApi.like(mediaViewer.activePost.id);
			else await postsApi.unlike(mediaViewer.activePost.id);
		} catch {
			liked = prevLiked;
			likeCount += liked ? 1 : -1;
			mediaViewer.updateActivePost({ user_liked: liked, like_count: likeCount });
		}
	}

	async function toggleShare() {
		if (!authStore.isAuthenticated) {
			window.location.href = '/login';
			return;
		}
		if (!mediaViewer.activePost?.id) return;

		const prevShared = shared;
		shared = !shared;
		shareCount += shared ? 1 : -1;

		mediaViewer.updateActivePost({ user_shared: shared, share_count: shareCount });

		try {
			if (shared) await postsApi.share(mediaViewer.activePost.id);
			else await postsApi.unshare(mediaViewer.activePost.id);
		} catch {
			shared = prevShared;
			shareCount += shared ? 1 : -1;
			mediaViewer.updateActivePost({ user_shared: shared, share_count: shareCount });
		}
	}

	async function toggleSave() {
		if (!authStore.isAuthenticated) {
			window.location.href = '/login';
			return;
		}
		if (!mediaViewer.activePost?.id) return;

		const prevSaved = saved;
		saved = !saved;
		mediaViewer.updateActivePost({ user_saved: saved });

		try {
			if (saved) await postsApi.save(mediaViewer.activePost.id);
			else await postsApi.unsave(mediaViewer.activePost.id);
		} catch {
			saved = prevSaved;
			mediaViewer.updateActivePost({ user_saved: saved });
		}
	}

	async function submitComment() {
		if ((!commentText.trim() && !attachedCommentGif && !attachedCommentImage) || submittingComment)
			return;
		if (!mediaViewer.activePost?.id) return;

		if (mediaViewer.activePost.is_anonymous) {
			if (!anonIdentityLoaded) {
				const ident = await getAnonIdentity();
				myAnonUsername = ident?.anon_username || null;
				anonIdentityLoaded = true;
			}
			if (!myAnonUsername) {
				pendingAnonComment = true;
				showAnonIdentityModal = true;
				return;
			}
		}

		submittingComment = true;
		try {
			let finalBody = commentText.trim();
			if (attachedCommentGif) finalBody += `\n[GIF]${attachedCommentGif}`;
			if (attachedCommentImage) finalBody += `\n[IMG]${attachedCommentImage}`;

			await postsApi.comments.create(mediaViewer.activePost.id, { body: finalBody });
			commentText = '';
			attachedCommentGif = '';
			attachedCommentImage = '';
			showCommentEmojis = false;
			showCommentGifs = false;
			showCommentMedia = false;

			const newCount = (mediaViewer.activePost.comment_count || 0) + 1;
			mediaViewer.updateActivePost({ comment_count: newCount });
			await loadComments();
		} catch (err) {
			if (err?.status === 403 || err?.code === 'ANON_IDENTITY_REQUIRED') {
				pendingAnonComment = true;
				showAnonIdentityModal = true;
			} else {
				console.error('Error posting comment in lightbox:', err);
			}
		} finally {
			submittingComment = false;
		}
	}

	function focusComposer() {
		const el = document.getElementById('lightbox_comment_input');
		if (el) {
			el.focus();
			el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	function handleKeydown(e) {
		if (!mediaViewer.isOpen) return;

		const tag = document.activeElement?.tagName?.toLowerCase();
		const isInput = tag === 'input' || tag === 'textarea';

		if (e.key === 'Escape') {
			e.preventDefault();
			if (mobileShareOpen) {
				mobileShareOpen = false;
			} else if (mobileCommentsOpen) {
				mobileCommentsOpen = false;
			} else if (desktopShareOpen) {
				desktopShareOpen = false;
			} else if (showCommentEmojis || showCommentGifs || showCommentMedia) {
				showCommentEmojis = false;
				showCommentGifs = false;
				showCommentMedia = false;
			} else {
				mediaViewer.close();
			}
		} else if (
			e.key === 'ArrowRight' &&
			!isInput &&
			!showCommentEmojis &&
			!showCommentGifs &&
			!showCommentMedia
		) {
			e.preventDefault();
			mediaViewer.next();
		} else if (
			e.key === 'ArrowLeft' &&
			!isInput &&
			!showCommentEmojis &&
			!showCommentGifs &&
			!showCommentMedia
		) {
			e.preventDefault();
			mediaViewer.prev();
		}
	}

	function handleCommentKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submitComment();
		}
	}

	async function handleCommentImageSelect(e) {
		const file = e.target.files[0];
		if (!file) return;

		uploadingCommentImage = true;
		try {
			const compressedFile = await compressImage(file);
			const fd = new FormData();
			fd.append('media', compressedFile);
			const res = await postsApi.uploadMedia(fd);
			attachedCommentImage = res.media?.[0]?.url || res.url;
		} catch (err) {
			console.error('Error uploading comment image:', err);
		} finally {
			uploadingCommentImage = false;
			if (commentFileInput) commentFileInput.value = '';
		}
	}

	function copyPostLink() {
		if (!mediaViewer.activePost?.id) return;
		const url = `${window.location.origin}/posts/${mediaViewer.activePost.id}`;
		navigator.clipboard.writeText(url);
		copySuccess = true;
		setTimeout(() => {
			copySuccess = false;
		}, 2000);
	}

	// Citar el post: abre el compositor con el post original referenciado.
	function quotePost() {
		if (!mediaViewer.activePost?.id) return;
		const id = mediaViewer.activePost.id;
		mediaViewer.close();
		goto(`/posts/create?quote=${id}`);
	}

	function downloadCurrentMedia() {
		if (!mediaViewer.currentItem?.url) return;
		const a = document.createElement('a');
		a.href = mediaViewer.currentItem.url;
		a.download = `vsocial-${Date.now()}`;
		a.target = '_blank';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function formatTimestamp(dateStr) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString('es-ES', {
			hour: '2-digit',
			minute: '2-digit',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if mediaViewer.isOpen}
	<div
		class="vs-lightbox-container"
		transition:fade={{ duration: 200, easing: cubicOut }}
		role="dialog"
		aria-modal="true"
		aria-label="Visor Multimedia"
	>
		<!-- Capa de fondo con blur translúcido -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="vs-lightbox-backdrop" onclick={() => mediaViewer.close()}></div>

		<!-- Botón de Cerrar Superior Izquierdo [✕] -->
		<button
			type="button"
			class="vs-lightbox-close-btn"
			onclick={() => mediaViewer.close()}
			title="Cerrar (Esc)"
			aria-label="Cerrar"
		>
			<span class="material-icons-round">close</span>
		</button>

		<!-- Menú "..." Superior Derecho (visible solo en móvil) -->
		{#if mediaViewer.contextType === 'post' && post}
			<div class="vs-lightbox-more-wrap">
				<button
					type="button"
					class="vs-lightbox-more-btn"
					onclick={() => (moreMenuOpen = !moreMenuOpen)}
					title="Más opciones"
					aria-label="Más opciones"
					aria-expanded={moreMenuOpen}
				>
					<span class="material-icons-round">more_horiz</span>
				</button>
				{#if moreMenuOpen}
					<div
						class="vs-lightbox-more-menu glass-panel"
						transition:fade={{ duration: 120 }}
						role="menu"
					>
						<button type="button" role="menuitem" onclick={toggleSave}>
							<span class="material-icons-round">{saved ? 'bookmark' : 'bookmark_border'}</span>
							{saved ? 'Quitar guardado' : 'Guardar'}
						</button>
						<button type="button" role="menuitem" onclick={copyPostLink}>
							<span class="material-icons-round">{copySuccess ? 'check' : 'link'}</span>
							{copySuccess ? 'Enlace copiado' : 'Copiar enlace'}
						</button>
						<button type="button" role="menuitem" onclick={downloadCurrentMedia}>
							<span class="material-icons-round">file_download</span>
							Descargar original
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Layout Split Container -->
		<div class="vs-lightbox-content" class:has-sidebar={mediaViewer.contextType === 'post' && post}>
			<!-- 1. Lienzo Multimedia Izquierdo / Central -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="vs-media-canvas"
				bind:this={stageEl}
				onwheel={handleWheel}
				ontouchstart={handleTouchStart}
				ontouchmove={handleTouchMove}
			>
				<!-- Flecha Anterior Izquierda -->
				{#if mediaViewer.totalItems > 1}
					<button
						type="button"
						class="vs-canvas-nav-arrow prev"
						onclick={(e) => {
							e.stopPropagation();
							mediaViewer.prev();
						}}
						title="Anterior (Flecha izquierda)"
						aria-label="Anterior"
					>
						<span class="material-icons-round">chevron_left</span>
					</button>
				{/if}

				<!-- Display del Media Activo -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="vs-media-viewport"
					onclick={(e) => {
						if (e.target === e.currentTarget && zoomScale === 1) mediaViewer.close();
					}}
				>
					{#if mediaViewer.currentItem}
						{#key mediaViewer.currentIndex}
							<div
								class="vs-media-frame"
								class:is-panning={isDragging}
								in:svelteScale={{ start: 0.98, duration: 200, easing: expoOut }}
								style="transform: translate3d({translateX}px, {translateY +
									dismissOffsetY}px, 0) scale({zoomScale}); transform-origin: center center;"
							>
								{#if mediaViewer.currentItem.type === 'video'}
									<MediaPlayer
										src={mediaViewer.currentItem.url}
										type="video"
										class="vs-lightbox-video"
										autoplay={true}
										aspectRatio={mediaViewer.currentItem.aspect_ratio ||
											(mediaViewer.currentItem.width && mediaViewer.currentItem.height
												? `${mediaViewer.currentItem.width} / ${mediaViewer.currentItem.height}`
												: null)}
									/>
								{:else}
									<img
										bind:this={imageEl}
										src={mediaViewer.currentItem.url}
										alt={mediaViewer.currentItem.alt || 'Multimedia'}
										class="vs-lightbox-image"
										draggable="false"
										ondblclick={handleDoubleClick}
										onpointerdown={handlePointerDown}
										onpointermove={handlePointerMove}
										onpointerup={handlePointerUp}
										onpointercancel={handlePointerUp}
									/>
								{/if}
							</div>
						{/key}
					{/if}
				</div>

				<!-- Flecha Siguiente Derecha -->
				{#if mediaViewer.totalItems > 1}
					<button
						type="button"
						class="vs-canvas-nav-arrow next"
						onclick={(e) => {
							e.stopPropagation();
							mediaViewer.next();
						}}
						title="Siguiente (Flecha derecha)"
						aria-label="Siguiente"
					>
						<span class="material-icons-round">chevron_right</span>
					</button>
				{/if}

				<!-- Barra móvil de acciones inferiores (oculta en desktop) -->
				{#if mediaViewer.contextType === 'post' && post}
					<div class="vs-mobile-action-bar">
						<button
							type="button"
							class="vs-mobile-btn {liked ? 'is-liked' : ''}"
							onclick={toggleLike}
							aria-label="{liked ? 'Quitar me gusta' : 'Dar me gusta'}{likeCount > 0
								? ' ' + likeCount
								: ''}"
						>
							<div class="like-icon-wrap" style="width: 20px; height: 20px;">
								{#if isAnimatingLike}
									<span class="like-ring"></span>
									<span class="like-ring-glow"></span>
									<span class="like-sparkles">
										{#each likeParticles as p (p.id)}
											<span
												class="sparkle-dot"
												style="--spk-angle: {p.angle}deg; --spk-dist: {p.dist}px; --spk-size: {p.size}px; --spk-color: {p.color}; --spk-delay: {p.delay}ms;"
											></span>
										{/each}
									</span>
								{/if}
								<span
									class="material-icons-round {isAnimatingLike
										? 'heart-pop'
										: ''} {isAnimatingUnlike ? 'heart-unpop' : ''}"
									>{liked ? 'favorite' : 'favorite_border'}</span
								>
							</div>
							<span class={isAnimatingLike ? 'count-bump' : ''}>{likeCount}</span>
						</button>
						<button
							type="button"
							class="vs-mobile-btn {shared ? 'is-shared' : ''}"
							onclick={() => (mobileShareOpen = true)}
							aria-label="Compartir"
						>
							<span class="material-icons-round">repeat</span>
							<span>{shareCount}</span>
						</button>
						<button
							type="button"
							class="vs-mobile-btn vs-mobile-comments-btn"
							onclick={() => (mobileCommentsOpen = true)}
						>
							<span class="material-icons-round">chat_bubble_outline</span>
							<span>Comentarios ({post.comment_count || comments.length})</span>
						</button>
					</div>
				{/if}
			</div>

			<!-- 2. Sidebar Social Derecho (Exacto al ADN visual de PostCard) -->
			{#if mediaViewer.contextType === 'post' && post}
				<aside class="vs-sidebar-panel glass-panel">
					<!-- Cabecera del Autor (Exacta a PostCard) -->
					<div class="vs-author-card">
						{#if post.is_anonymous}
							<div class="flex items-center gap-3">
								<div
									class="vs-anon-avatar-circle"
									style="flex: 0 0 40px; width: 40px; height: 40px;"
								>
									<span class="material-icons-round">visibility_off</span>
								</div>
								<div class="user-meta">
									<div class="flex items-center gap-1.5">
										<span class="font-semibold text-sm text-main">Anónimo</span>
										<span class="anon-badge">Incógnito</span>
									</div>
									<div class="flex items-center gap-1 text-xs text-muted">
										<span>Identidad Oculta</span>
										<span>·</span>
										<time datetime={post.created_at}>{formatTimestamp(post.created_at)}</time>
									</div>
								</div>
							</div>
						{:else}
							<div class="flex items-center gap-3 min-w-0 flex-1" style="flex: 1; min-width: 0;">
								<a
									href="/u/{post.username}"
									class="block text-decoration-none flex-shrink-0"
									onclick={() => mediaViewer.close()}
									tabindex="-1"
								>
									<AeroAvatar
										src={post.avatar_url}
										alt={post.username}
										size="md"
										isVtuber={post.is_virtual}
									/>
								</a>
								<div class="user-meta min-w-0 flex-1" style="flex: 1; min-width: 0;">
									<div class="flex items-center gap-1.5 flex-wrap">
										<a
											href="/u/{post.username}"
											class="font-semibold text-sm text-main hover:text-blue-500 transition-colors truncate text-decoration-none"
											onclick={() => mediaViewer.close()}
										>
											{post.display_name || post.username}
										</a>
										<VerifiedBadge
											role={post.role}
											isVerified={post.is_verified == 1}
											size="16px"
											interactive={true}
										/>
										{#if post.level}
											<LevelBadge
												level={post.level}
												size="sm"
												showText={false}
												interactive={true}
											/>
										{/if}
									</div>
									<div class="flex items-center gap-1 text-xs text-muted truncate">
										<a
											href="/u/{post.username}"
											class="text-muted hover:text-main transition-colors text-decoration-none"
											onclick={() => mediaViewer.close()}
										>
											@{post.username}
										</a>
										<span>·</span>
										<time datetime={post.created_at}>{formatTimestamp(post.created_at)}</time>
									</div>
								</div>
							</div>
						{/if}
					</div>

					<!-- Scrollable Content: Post Body + Action Bar + Composer + Comments -->
					<div
						class="vs-sidebar-scrollable-body"
						class:is-picker-open={showCommentEmojis || showCommentGifs || showCommentMedia}
					>
						<!-- Texto del Post -->
						{#if post.content}
							<div class="vs-post-text-content">
								{@html formatHashtags(post.content)}
							</div>
						{/if}

						<!-- Post citado (estilo X / Bluesky) -->
						{#if post.quoted_post}
							<QuoteCard quote={post.quoted_post} />
						{/if}

						<!-- Barra de Acciones (Exacta a PostCard) -->
						<div class="action-bar flex items-center justify-between">
							<div class="flex items-center gap-1">
								<!-- Like -->
								<div class="like-btn-wrapper">
									<button
										onclick={toggleLike}
										class="action-btn {liked ? 'liked' : ''}"
										aria-label="Me gusta"
									>
										<div class="like-icon-wrap">
											{#if isAnimatingLike}
												<span class="like-ring"></span>
												<span class="like-ring-glow"></span>
												<span class="like-sparkles">
													{#each likeParticles as p (p.id)}
														<span
															class="sparkle-dot"
															style="--spk-angle: {p.angle}deg; --spk-dist: {p.dist}px; --spk-size: {p.size}px; --spk-color: {p.color}; --spk-delay: {p.delay}ms;"
														></span>
													{/each}
												</span>
											{/if}
											<span
												class="material-icons-round text-[18px] icon {isAnimatingLike
													? 'heart-pop'
													: ''} {isAnimatingUnlike ? 'heart-unpop' : ''}"
												>{liked ? 'favorite' : 'favorite_border'}</span
											>
										</div>
										<span class="count {isAnimatingLike ? 'count-bump' : ''}"
											>{likeCount > 0 ? likeCount.toLocaleString() : ''}</span
										>
									</button>
								</div>

								<!-- Comment -->
								<button
									onclick={focusComposer}
									class="action-btn"
									title="Comentar"
									aria-label="Comentar"
								>
									<span class="material-icons-round text-[18px] icon">chat_bubble_outline</span>
									<span class="count"
										>{post.comment_count || comments.length > 0
											? (post.comment_count || comments.length).toLocaleString()
											: ''}</span
									>
								</button>

								<!-- Share / Repost (menú desktop: Repostear o Citar) -->
								<div class="vs-share-wrap">
									{#if desktopShareOpen}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											class="vs-share-dismiss-layer"
											onclick={() => (desktopShareOpen = false)}
										></div>
									{/if}
									<button
										bind:this={shareBtnEl}
										onclick={toggleDesktopShare}
										class="action-btn {shared ? 'shared' : ''}"
										title="Compartir"
										aria-label="Compartir"
										aria-haspopup="menu"
										aria-expanded={desktopShareOpen}
									>
										<span class="material-icons-round text-[18px] icon">repeat</span>
										<span class="count">{shareCount > 0 ? shareCount.toLocaleString() : ''}</span>
									</button>
									{#if desktopShareOpen}
										<div
											class="vs-desktop-share-menu glass-panel"
											style={desktopShareMenuStyle}
											transition:fade={{ duration: 120 }}
											role="menu"
										>
											<button
												type="button"
												role="menuitem"
												onclick={() => {
													desktopShareOpen = false;
													toggleShare();
												}}
											>
												<span class="material-icons-round"
													>{shared ? 'check_circle' : 'repeat'}</span
												>
												<span class="vs-share-menu-text">
													<strong>Repostear</strong>
													<small
														>{shared
															? 'Ya reposteado — toca para deshacer'
															: 'Comparte este post en tu perfil'}</small
													>
												</span>
											</button>
											<button
												type="button"
												role="menuitem"
												onclick={() => {
													desktopShareOpen = false;
													quotePost();
												}}
											>
												<span class="material-icons-round">format_quote</span>
												<span class="vs-share-menu-text">
													<strong>Citar</strong>
													<small>Añade tu comentario sobre este post</small>
												</span>
											</button>
										</div>
									{/if}
								</div>

								<!-- Bookmark / Save -->
								<button
									onclick={toggleSave}
									class="action-btn {saved ? 'saved' : ''}"
									title="Guardar"
									aria-label="Guardar"
								>
									<span class="material-icons-round text-[18px] icon"
										>{saved ? 'bookmark' : 'bookmark_border'}</span
									>
								</button>
							</div>

							<!-- Copy link -->
							<button
								onclick={copyPostLink}
								class="action-btn"
								title="Copiar enlace"
								aria-label="Copiar enlace"
							>
								<span class="material-icons-round text-[18px] icon"
									>{copySuccess ? 'check' : 'ios_share'}</span
								>
							</button>
						</div>

						<div class="vs-section-separator"></div>

						<!-- Caja de Comentarios Neo-Aero (Mismo patrón que PostCard) -->
						<div class="comments-composer-row">
							<div class="composer-avatar-col" style="flex: 0 0 36px; min-width: 36px;">
								{#if post.is_anonymous}
									<div class="vs-anon-avatar-circle" style="width: 36px; height: 36px;">
										<span class="material-icons-round text-[16px]">visibility_off</span>
									</div>
								{:else if authStore.user?.avatar_url}
									<img
										src={authStore.user.avatar_url}
										alt="Tú"
										class="w-9 h-9 squircle border border-white/20 object-cover"
										style="flex: 0 0 36px; min-width: 36px; min-height: 36px;"
									/>
								{:else}
									<div
										class="vs-avatar-letter avatar-sm"
										style="flex: 0 0 36px; min-width: 36px; min-height: 36px;"
									>
										{(authStore.user?.display_name ||
											authStore.user?.username ||
											'U')[0].toUpperCase()}
									</div>
								{/if}
							</div>

							<div class="composer-body-col" style="flex: 1; min-width: 0;">
								<!-- Previews -->
								{#if attachedCommentGif || attachedCommentImage}
									<div class="flex items-center gap-2 mb-2">
										{#if attachedCommentGif}
											<div
												class="flex items-center gap-2 p-1.5 pr-3 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-xl text-xs font-bold text-fuchsia-400 w-fit shadow-md"
											>
												<img
													src={getProxiedMediaUrl(attachedCommentGif)}
													alt="GIF"
													class="w-10 h-10 object-cover rounded-lg"
												/>
												<span>GIF Adjunto</span>
												<button
													type="button"
													class="bg-transparent border-none cursor-pointer text-muted hover:text-white"
													onclick={() => (attachedCommentGif = '')}
												>
													<span class="material-icons-round text-[14px]">close</span>
												</button>
											</div>
										{/if}
										{#if attachedCommentImage}
											<div
												class="flex items-center gap-2 p-1.5 pr-3 bg-slate-800/80 border border-white/10 rounded-xl shadow-md w-fit backdrop-blur-md"
											>
												<img
													src={attachedCommentImage}
													alt="Preview"
													class="w-10 h-10 object-cover rounded-lg"
												/>
												<span class="text-xs font-medium text-white/80">Imagen Adjunta</span>
												<button
													type="button"
													class="bg-transparent border-none cursor-pointer text-muted hover:text-white"
													onclick={() => (attachedCommentImage = '')}
												>
													<span class="material-icons-round text-[14px]">close</span>
												</button>
											</div>
										{/if}
									</div>
								{/if}

								<div class="comment-input-wrapper" style="overflow: visible;">
									<HashtagTextarea
										id="lightbox_comment_input"
										bind:value={commentText}
										onkeydown={handleCommentKeydown}
										placeholder={post?.is_anonymous
											? 'Escribe un comentario anónimo...'
											: 'Escribe un comentario...'}
										class="aero-textarea pr-[150px]"
										style="--hashtag-padding: 11px 150px 11px 16px; --hashtag-font-size: 0.88rem; --hashtag-line-height: 1.4;"
										rows={1}
									/>

									<button
										type="button"
										class="comment-gif-btn"
										style="right: 110px;"
										onclick={() => {
											showCommentGifs = !showCommentGifs;
											showCommentEmojis = false;
											showCommentMedia = false;
										}}
										title="GIFs"
									>
										<span
											class="material-icons-round text-muted hover:text-fuchsia-400 transition text-[22px]"
											>gif_box</span
										>
									</button>

									<button
										type="button"
										class="comment-emoji-btn"
										style="right: 76px;"
										onclick={() => {
											showCommentEmojis = !showCommentEmojis;
											showCommentGifs = false;
											showCommentMedia = false;
										}}
										title="Emojis"
									>
										<span
											class="material-icons-round text-muted hover:text-cyan-400 transition text-[20px]"
											>mood</span
										>
									</button>

									<button
										type="button"
										class="comment-photo-btn"
										style="right: 42px;"
										onclick={() => {
											showCommentMedia = !showCommentMedia;
											showCommentGifs = false;
											showCommentEmojis = false;
										}}
										disabled={uploadingCommentImage}
										title="Multimedia"
									>
										{#if uploadingCommentImage}
											<span class="material-icons-round text-cyan-400 animate-spin text-[20px]"
												>autorenew</span
											>
										{:else}
											<span class="material-icons-round hover:text-green-400 transition text-[20px]"
												>add_photo_alternate</span
											>
										{/if}
									</button>
									<input
										type="file"
										bind:this={commentFileInput}
										accept="image/*,video/*"
										style="display: none;"
										onchange={handleCommentImageSelect}
									/>

									<button
										type="button"
										class="comment-submit-btn"
										disabled={(!commentText.trim() &&
											!attachedCommentGif &&
											!attachedCommentImage) ||
											submittingComment}
										onclick={submitComment}
										title="Enviar comentario"
									>
										<span class="material-icons-round text-[17px]">send</span>
									</button>
								</div>

								<!-- Deslizadores Expandibles -->
								{#if showCommentMedia}
									<div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
										<div class="post-nested-panel p-4" style="min-height: max-content;">
											<div
												role="button"
												tabindex="0"
												class="media-dropzone"
												onclick={() => commentFileInput?.click()}
												onkeydown={(e) => e.key === 'Enter' && commentFileInput?.click()}
												ondragover={(e) => e.preventDefault()}
												ondrop={(e) => {
													e.preventDefault();
													if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
														commentFileInput.files = e.dataTransfer.files;
														handleCommentImageSelect({ target: commentFileInput });
														showCommentMedia = false;
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

								{#if showCommentEmojis}
									<div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
										<div
											class="post-nested-panel p-4"
											style="position: relative; display: flex; justify-content: center; min-height: max-content;"
										>
											<TwemojiPicker
												variant="inline"
												onSelect={(emoji) => {
													commentText += emoji;
												}}
												onClose={() => (showCommentEmojis = false)}
											/>
										</div>
									</div>
								{/if}

								{#if showCommentGifs}
									<div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
										<div
											class="post-nested-panel p-4"
											style="position: relative; display: flex; justify-content: center; min-height: max-content;"
										>
											<KlipyPicker
												onClose={() => (showCommentGifs = false)}
												onSelect={(url, _gif) => {
													attachedCommentGif = url;
													showCommentGifs = false;
												}}
											/>
										</div>
									</div>
								{/if}
							</div>
						</div>

						<div class="vs-section-separator"></div>

						<!-- Hilo de Respuestas -->
						<div class="vs-comments-list-section">
							{#if commentsLoading && comments.length === 0}
								<div class="vs-comments-skeleton">
									<div class="vs-skeleton-bar"></div>
									<div class="vs-skeleton-bar short"></div>
								</div>
							{:else if comments.length === 0}
								<div class="vs-empty-comments-box">
									<span class="material-icons-round vs-empty-icon">chat_bubble_outline</span>
									<p>Sé el primero en responder a esta publicación.</p>
								</div>
							{:else}
								{#each comments as c (c.id)}
									<CommentItem
										comment={c}
										postId={post.id}
										postIsAnonymous={post.is_anonymous}
										onReload={loadComments}
									/>
								{/each}
							{/if}
						</div>
					</div>
				</aside>
			{/if}

			<!-- 3. Información para Avatar o Portada (Modo Perfil) -->
			{#if (mediaViewer.contextType === 'profile_avatar' || mediaViewer.contextType === 'profile_cover') && mediaViewer.activeUser}
				<div class="vs-profile-floating-card glass-panel" transition:fade={{ duration: 200 }}>
					<div class="vs-profile-card-content">
						<a
							href="/u/{mediaViewer.activeUser.username}"
							class="vs-profile-text-meta text-decoration-none"
							onclick={() => mediaViewer.close()}
						>
							<h3>
								{mediaViewer.activeUser.display_name || mediaViewer.activeUser.username}
							</h3>
							<p>
								{mediaViewer.contextType === 'profile_avatar'
									? 'Foto de perfil'
									: 'Foto de portada'} (@{mediaViewer.activeUser.username})
							</p>
						</a>
						<button
							type="button"
							class="btn-aero-primary vs-profile-download-btn"
							onclick={downloadCurrentMedia}
						>
							<span class="material-icons-round">file_download</span>
							<span>Descargar original</span>
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Mobile Comments Sheet (estilo X: post citado + "Respondiendo a" + compositor) -->
		{#if mobileCommentsOpen && mediaViewer.contextType === 'post' && post}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="vs-mobile-sheet-backdrop" onclick={() => (mobileCommentsOpen = false)}></div>
			<div class="vs-mobile-sheet-drawer" transition:slide={{ axis: 'y', duration: 250 }}>
				<div class="vs-mobile-sheet-top">
					<div class="vs-mobile-sheet-pill"></div>
					<div class="vs-mobile-sheet-title-row">
						<h3>Respondiendo a @{post.username || post.display_name}</h3>
						<div class="vs-mobile-sheet-title-actions">
							{#if (post.comment_count || 0) > 0}
								<span class="vs-mobile-sheet-count">{post.comment_count}</span>
							{/if}
							<button
								type="button"
								class="aero-icon-btn"
								onclick={() => (mobileCommentsOpen = false)}
								aria-label="Cerrar"
							>
								<span class="material-icons-round">close</span>
							</button>
						</div>
					</div>
				</div>

				<!-- Post original citado (contexto de la respuesta) -->
				<div class="vs-reply-original-post">
					<div class="vs-reply-original-avatar">
						{#if post.is_anonymous}
							<div class="vs-anon-avatar-circle">
								<span class="material-icons-round">visibility_off</span>
							</div>
						{:else if post.avatar_url}
							<img src={post.avatar_url} alt={post.username} loading="lazy" />
						{:else}
							<div class="vs-avatar-letter avatar-sm">
								{(post.display_name || post.username || '?').charAt(0).toUpperCase()}
							</div>
						{/if}
					</div>
					<div class="vs-reply-original-meta">
						<span class="vs-reply-original-name">{post.display_name || post.username}</span>
						<span class="vs-reply-original-user">@{post.username}</span>
						<span class="vs-reply-original-sep">·</span>
						<time datetime={post.created_at}>{formatTimestamp(post.created_at)}</time>
					</div>
					{#if post.body || post.content}
						<p class="vs-reply-original-text">
							{@html formatHashtags(post.body || post.content || '')}
						</p>
					{/if}
					{#if post.quoted_post}
						<QuoteCard quote={post.quoted_post} />
					{/if}
					{#if post.media && post.media.length > 0}
						<div class="vs-reply-original-media">
							{#if post.media[0].media_type === 'video' || post.media[0].media_type === 'audio'}
								<video
									src={getProxiedMediaUrl(post.media[0].media_url)}
									muted
									playsinline
									preload="metadata"
								></video>
								<span class="vs-reply-original-media-badge">
									<span class="material-icons-round">play_circle_fill</span>
								</span>
							{:else}
								<img
									src={getProxiedMediaUrl(post.media[0].media_url)}
									alt="Multimedia de @{post.username}"
									loading="lazy"
									decoding="async"
								/>
							{/if}
						</div>
					{/if}

					<!-- Mini barra de acciones del post original -->
					<div class="vs-reply-actions">
						<button
							type="button"
							class="vs-reply-action-btn {liked ? 'is-liked' : ''}"
							onclick={toggleLike}
							aria-label="Me gusta"
						>
							<span class="material-icons-round">{liked ? 'favorite' : 'favorite_border'}</span>
							<span>{likeCount}</span>
						</button>
						<button
							type="button"
							class="vs-reply-action-btn {shared ? 'is-shared' : ''}"
							onclick={() => {
								mobileShareOpen = true;
							}}
							aria-label="Compartir"
						>
							<span class="material-icons-round">repeat</span>
							<span>{shareCount}</span>
						</button>
						<button
							type="button"
							class="vs-reply-action-btn {saved ? 'is-saved' : ''}"
							onclick={toggleSave}
							aria-label="Guardar"
						>
							<span class="material-icons-round">{saved ? 'bookmark' : 'bookmark_border'}</span>
							<span>{saved ? 'Guardado' : 'Guardar'}</span>
						</button>
						<button
							type="button"
							class="vs-reply-action-btn"
							onclick={copyPostLink}
							aria-label="Copiar enlace"
						>
							<span class="material-icons-round">{copySuccess ? 'check' : 'ios_share'}</span>
							<span>{copySuccess ? 'Copiado' : 'Copiar'}</span>
						</button>
					</div>
				</div>

				<div class="vs-mobile-sheet-body">
					{#if commentsLoading && comments.length === 0}
						<div class="vs-comments-skeleton">
							<div class="vs-skeleton-bar"></div>
							<div class="vs-skeleton-bar short"></div>
						</div>
					{:else if comments.length === 0}
						<div class="vs-mobile-sheet-empty">
							<span class="material-icons-round vs-mobile-sheet-empty-icon"
								>chat_bubble_outline</span
							>
							<p>Sé el primero en responder a esta publicación.</p>
						</div>
					{:else}
						{#each comments as c (c.id)}
							<CommentItem
								comment={c}
								postId={post.id}
								postIsAnonymous={post.is_anonymous}
								onReload={loadComments}
							/>
						{/each}
					{/if}
				</div>

				<div class="vs-mobile-sheet-footer">
					<textarea
						bind:value={commentText}
						placeholder="Postea tu respuesta"
						onkeydown={handleCommentKeydown}
						class="vs-mobile-sheet-input vs-mobile-sheet-textarea"
						rows="1"
					></textarea>
					<button
						type="button"
						class="btn-aero-primary"
						disabled={!commentText.trim() || submittingComment}
						onclick={submitComment}
					>
						Responder
					</button>
				</div>
			</div>
		{/if}

		<!-- Mobile Share Sheet: elegir entre Repostear o Citar -->
		{#if mobileShareOpen && mediaViewer.contextType === 'post' && post}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="vs-mobile-sheet-backdrop" onclick={() => (mobileShareOpen = false)}></div>
			<div
				class="vs-mobile-share-sheet"
				transition:slide={{ axis: 'y', duration: 220 }}
				role="menu"
			>
				<div class="vs-mobile-sheet-pill"></div>
				<h3 class="vs-mobile-share-title">Compartir publicación</h3>
				<button
					type="button"
					class="vs-share-option"
					role="menuitem"
					onclick={() => {
						toggleShare();
						mobileShareOpen = false;
					}}
				>
					<span class="vs-share-option-icon">
						<span class="material-icons-round">{shared ? 'check_circle' : 'repeat'}</span>
					</span>
					<span class="vs-share-option-text">
						<strong>Repostear</strong>
						<small
							>{shared
								? 'Ya reposteado — toca para deshacer'
								: 'Comparte este post en tu perfil'}</small
						>
					</span>
				</button>
				<button type="button" class="vs-share-option" role="menuitem" onclick={quotePost}>
					<span class="vs-share-option-icon">
						<span class="material-icons-round">format_quote</span>
					</span>
					<span class="vs-share-option-text">
						<strong>Citar</strong>
						<small>Añade tu comentario sobre este post</small>
					</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- Modal de identidad anónima si se requiere -->
	{#if showAnonIdentityModal}
		<AnonIdentityModal
			onSuccess={(anonUser) => {
				myAnonUsername = anonUser;
				anonIdentityLoaded = true;
				showAnonIdentityModal = false;
				if (pendingAnonComment) {
					pendingAnonComment = false;
					submitComment();
				}
			}}
			onClose={() => {
				showAnonIdentityModal = false;
				pendingAnonComment = false;
			}}
		/>
	{/if}
{/if}

<style>
	:global(html.is-lightbox-open),
	:global(body.is-lightbox-open) {
		overflow: hidden !important;
		scrollbar-gutter: auto !important;
	}

	.vs-lightbox-container {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		width: 100vw;
		height: 100vh;
		z-index: var(--z-critical, 1000);
		display: flex;
		overflow: hidden;
		user-select: none;
		contain: layout style paint;
		font-family: var(--font-sans);
	}

	.vs-lightbox-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(2, 6, 12, 0.88);
		backdrop-filter: var(--glass-blur, blur(24px) saturate(1.3));
		-webkit-backdrop-filter: var(--glass-blur, blur(24px) saturate(1.3));
		z-index: 1;
	}

	.vs-lightbox-backdrop::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image: var(--noise-texture);
		opacity: 0.03;
		pointer-events: none;
	}

	/* Botón Cerrar [✕] en la esquina superior izquierda */
	.vs-lightbox-close-btn {
		position: absolute;
		top: 18px;
		left: 18px;
		z-index: 60;
		width: 42px;
		height: 42px;
		border-radius: var(--radius-full, 9999px);
		background: rgba(15, 23, 42, 0.75);
		backdrop-filter: var(--glass-blur, blur(16px));
		-webkit-backdrop-filter: var(--glass-blur, blur(16px));
		border: 1px solid rgba(255, 255, 255, 0.18);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: var(--shadow-sm), var(--shadow-glow);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			background-color 0.2s ease,
			transform 0.15s ease;
	}

	.vs-lightbox-close-btn:hover {
		background: rgba(27, 133, 243, 0.85);
		border-color: var(--accent-blue-base, #1b85f3);
		color: #ffffff;
		box-shadow: 0 0 20px rgba(27, 133, 243, 0.5);
		transform: scale(1.05);
	}

	/* Contenedor Split */
	.vs-lightbox-content {
		position: relative;
		z-index: 10;
		width: 100%;
		height: 100%;
		display: flex;
		overflow: hidden;
	}

	/* 1. Canvas Multimedia */
	.vs-media-canvas {
		position: relative;
		flex: 1;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		touch-action: none;
	}

	.vs-media-viewport {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		box-sizing: border-box;
	}

	.vs-media-frame {
		max-width: 100%;
		max-height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		will-change: transform;
		transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.vs-media-frame.is-panning {
		transition: none !important;
	}

	.vs-lightbox-image {
		max-width: 100%;
		max-height: 92vh;
		object-fit: contain;
		border-radius: var(--radius-md, 16px);
		box-shadow:
			0 10px 36px rgba(0, 0, 0, 0.35),
			0 0 30px rgba(56, 189, 248, 0.15);
		cursor: grab;
		touch-action: none;
		user-select: none;
		-webkit-user-drag: none;
	}

	.vs-lightbox-image:active {
		cursor: grabbing;
	}

	:global(.vs-lightbox-video) {
		max-width: 100%;
		max-height: 92vh;
		border-radius: var(--radius-md, 16px);
		overflow: hidden;
	}

	/* Flechas de Navegación */
	.vs-canvas-nav-arrow {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 46px;
		height: 46px;
		border-radius: 50%;
		background: rgba(15, 23, 42, 0.75);
		backdrop-filter: var(--glass-blur, blur(16px));
		-webkit-backdrop-filter: var(--glass-blur, blur(16px));
		border: 1px solid rgba(255, 255, 255, 0.18);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 30;
		box-shadow: var(--shadow-sm), var(--shadow-glow);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			background-color 0.2s ease,
			transform 0.15s ease;
	}

	.vs-canvas-nav-arrow:hover {
		background: rgba(27, 133, 243, 0.85);
		border-color: var(--accent-blue-base, #1b85f3);
		color: #ffffff;
		box-shadow: 0 0 20px rgba(27, 133, 243, 0.5);
		transform: translateY(-50%) scale(1.06);
	}

	.vs-canvas-nav-arrow.prev {
		left: 24px;
	}

	.vs-canvas-nav-arrow.next {
		right: 24px;
	}

	/* Menú "..." superior derecho: oculto en desktop, visible en móvil */
	.vs-lightbox-more-wrap {
		display: none;
	}

	/* Mobile Bar: OCULTA POR DEFECTO EN DESKTOP */
	.vs-mobile-action-bar {
		display: none;
	}

	/* 2. Sidebar Social Derecho (Glassmorphism 2.0) */
	.vs-sidebar-panel {
		width: 400px;
		max-width: 400px;
		height: 100%;
		background: var(--bg-surface-solid, var(--bg-surface));
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border-left: 1px solid var(--border-subtle);
		border-radius: 0;
		display: flex;
		flex-direction: column;
		z-index: 20;
		box-sizing: border-box;
		color: var(--text-primary);
		font-family: var(--font-sans);
		overscroll-behavior: contain;
	}

	:global([data-theme='light']) .vs-sidebar-panel {
		background: #f8fafc;
		border-left: 1px solid rgba(14, 165, 233, 0.25);
		box-shadow: var(--shadow-lg), var(--shadow-glow);
	}

	:global([data-theme='dark']) .vs-sidebar-panel {
		background: rgba(12, 35, 55, 0.88);
		border-left: 1px solid rgba(255, 255, 255, 0.12);
	}

	:global([data-theme='midnight']) .vs-sidebar-panel {
		background: rgba(6, 12, 24, 0.92);
		border-left: 1px solid rgba(160, 210, 255, 0.1);
	}

	.vs-author-card {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-subtle);
	}

	:global([data-theme='light']) .vs-sidebar-panel .vs-author-card {
		background: #ffffff;
		border-bottom: 1px solid rgba(14, 165, 233, 0.18);
	}

	.text-main {
		color: var(--text-primary);
	}

	.text-muted {
		color: var(--text-muted);
	}

	.anon-badge {
		font-size: 0.7rem;
		background: rgba(99, 102, 241, 0.15);
		border: 1px solid rgba(99, 102, 241, 0.3);
		color: #a5b4fc;
		padding: 1px 6px;
		border-radius: 4px;
	}

	.vs-anon-avatar-circle {
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
	}

	/* Scroll Area */
	.vs-sidebar-scrollable-body {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
		padding: 10px 16px;
		gap: 6px;
		overscroll-behavior: contain;
		scrollbar-width: thin;
	}

	.vs-sidebar-scrollable-body::-webkit-scrollbar {
		width: 6px;
	}

	.vs-sidebar-scrollable-body::-webkit-scrollbar-track {
		background: transparent;
	}

	.vs-sidebar-scrollable-body::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
		border-radius: var(--radius-sm);
	}

	.vs-sidebar-scrollable-body.is-picker-open {
		overflow-y: hidden;
	}

	.vs-post-text-content {
		font-size: 0.92rem;
		line-height: 1.45;
		color: var(--text-primary);
		word-break: break-word;
		user-select: text;
		padding: 2px 0;
	}

	.vs-section-separator {
		height: 1px;
		background: var(--border-subtle);
		margin: 2px 0;
		opacity: 0.5;
	}

	/* Barra de Acciones (Exacta a PostCard) */
	.action-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 2px 0;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 8px;
		border-radius: var(--radius-sm);
		background: transparent;
		border: none;
		color: var(--text-secondary);
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		transition:
			background var(--t-fast),
			color var(--t-fast),
			box-shadow var(--t-fast);
	}

	.action-btn:hover {
		background: var(--bg-overlay, rgba(255, 255, 255, 0.06));
		color: var(--aero-blue, #1b85f3);
		box-shadow: 0 0 12px rgba(27, 133, 243, 0.15);
	}

	.action-btn:active {
		transform: scale(0.94);
	}

	.action-btn.liked {
		color: var(--aero-rose, #ec4899);
		background: rgba(236, 72, 153, 0.08);
	}
	.action-btn.liked:hover {
		background: rgba(236, 72, 153, 0.15);
		color: var(--aero-rose, #ec4899);
		box-shadow: 0 0 14px rgba(236, 72, 153, 0.25);
	}
	.action-btn.liked .icon {
		filter: drop-shadow(0 0 6px rgba(236, 72, 153, 0.5));
	}

	.action-btn.shared {
		color: #10b981;
	}

	.action-btn.saved {
		color: var(--accent-blue-base, #1b85f3);
	}

	/* Menú de compartir en desktop: Repostear / Citar */
	.vs-share-wrap {
		position: relative;
		display: inline-flex;
	}

	.vs-share-dismiss-layer {
		position: fixed;
		inset: 0;
		/* Por encima de los iconos del compositor (z-index 10/20) para que un clic
		   en la textarea cierre el menú; el menú queda aún por encima (z-index 60). */
		z-index: 50;
		background: transparent;
		cursor: default;
	}

	.vs-share-wrap .action-btn {
		position: relative;
		/* Por encima de la capa de cierre para poder seguir pulsando el botón */
		z-index: 51;
	}

	.vs-desktop-share-menu {
		position: fixed;
		min-width: 250px;
		/* Sobre los iconos de la textarea (10/20): el menú nunca queda detrás */
		z-index: 60;
		padding: 6px;
		border-radius: var(--radius-lg, 14px);
		background: var(--bg-surface-solid, #0f172a);
		box-shadow: var(--shadow-lg), var(--shadow-glow);
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 70vh;
		overflow-y: auto;
	}

	:global([data-theme='light']) .vs-desktop-share-menu {
		background: #ffffff;
		border: 1px solid rgba(14, 165, 233, 0.2);
		box-shadow: var(--shadow-lg), var(--shadow-glow);
	}

	.vs-desktop-share-menu button {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border: none;
		background: none;
		color: var(--text-primary, #e2e8f0);
		font-size: 0.85rem;
		font-weight: 600;
		border-radius: var(--radius-md, 10px);
		cursor: pointer;
		text-align: left;
		font-family: var(--font-sans);
	}

	.vs-desktop-share-menu button:hover {
		background: rgba(var(--accent-blue-rgb, 46, 134, 232), 0.12);
	}

	.vs-desktop-share-menu button .material-icons-round {
		font-size: 18px;
		color: var(--accent-blue-base, #1b85f3);
	}

	.vs-share-menu-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.vs-share-menu-text strong {
		font-size: 0.85rem;
	}

	.vs-share-menu-text small {
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--text-muted, #94a3b8);
	}

	/* Composer Row (Exacto a PostCard) */
	.comments-composer-row {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		margin: 2px 0;
	}

	.comment-input-wrapper {
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
		min-height: 44px;
		background: var(--bg-input-tint, rgba(255, 255, 255, 0.04));
		border: 1.5px solid var(--glass-border, var(--border-subtle));
		border-radius: var(--radius-lg, 16px);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		box-shadow: var(--shadow-xs), var(--glass-inset-highlight);
	}

	.comment-input-wrapper:focus-within {
		border-color: var(--aero-sky, var(--accent-blue-base, #1b85f3));
		box-shadow:
			0 0 0 3px rgba(46, 134, 232, 0.1),
			var(--shadow-xs);
	}

	/* OJO: esta regla debe ir acotada a los textareas de comentarios (dentro de
	   .comment-input-wrapper). Como MediaLightbox está montado en el layout raíz,
	   un selector global sin ancestro rompía TODOS los .aero-textarea de la app
	   (p. ej. la biografía de Ajustes quedaba sin fondo ni borde). */
	:global(.comment-input-wrapper .aero-textarea) {
		width: 100%;
		background: transparent !important;
		border: none !important;
		color: var(--text-primary) !important;
		font-size: 0.88rem !important;
		resize: none !important;
		outline: none !important;
		font-family: var(--font-sans) !important;
	}

	.comment-gif-btn {
		position: absolute;
		right: 110px;
		top: 50%;
		transform: translateY(-50%);
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		cursor: pointer !important;
		transition: background var(--t-fast);
		color: var(--text-muted);
		z-index: 10;
	}

	.comment-gif-btn:hover {
		background: var(--bg-surface);
	}

	.comment-emoji-btn {
		position: absolute;
		right: 76px;
		top: 50%;
		transform: translateY(-50%);
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		cursor: pointer !important;
		transition: background var(--t-fast);
		color: var(--text-muted);
		z-index: 10;
	}

	.comment-emoji-btn:hover {
		background: var(--bg-surface);
	}

	.comment-photo-btn {
		position: absolute;
		right: 42px;
		top: 50%;
		transform: translateY(-50%);
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer !important;
		transition: background var(--t-fast);
		color: var(--text-muted);
		z-index: 10;
	}

	.comment-photo-btn:hover {
		background: var(--bg-surface);
	}

	.comment-submit-btn {
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		width: 32px;
		height: 32px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: linear-gradient(135deg, var(--aero-sky, #38bdf8), var(--aero-blue, #1b85f3));
		color: white;
		border: none;
		box-shadow: 0 3px 10px rgba(27, 133, 243, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer !important;
		transition: box-shadow 0.2s ease;
		z-index: 20;
		pointer-events: auto;
	}

	.comment-submit-btn:not(:disabled):hover {
		box-shadow: 0 0 16px rgba(27, 133, 243, 0.5);
	}

	.comment-submit-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed !important;
		background: var(--bg-overlay, rgba(255, 255, 255, 0.1));
		color: var(--text-muted);
		box-shadow: none;
	}

	.post-nested-panel {
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--glass-border, var(--border-subtle));
		border-radius: var(--radius-md);
	}

	:global([data-theme='light']) .vs-sidebar-panel .comment-input-wrapper {
		background: #ffffff;
		border: 1.5px solid rgba(14, 165, 233, 0.28);
		box-shadow: var(--input-shadow-inner);
	}

	:global([data-theme='light']) .vs-sidebar-panel .comment-gif-btn:hover,
	:global([data-theme='light']) .vs-sidebar-panel .comment-emoji-btn:hover,
	:global([data-theme='light']) .vs-sidebar-panel .comment-photo-btn:hover {
		background: #e0f2fe;
		color: var(--accent-blue-base, #1b85f3);
	}

	:global([data-theme='light']) .vs-sidebar-panel .post-nested-panel {
		background: #ffffff;
		border: 1px solid rgba(14, 165, 233, 0.2);
		box-shadow: var(--shadow-sm);
	}

	.media-dropzone {
		width: 100%;
		border-radius: 1rem;
		border: 1px solid rgba(34, 211, 238, 0.15);
		background: linear-gradient(135deg, rgba(34, 211, 238, 0.04) 0%, rgba(59, 130, 246, 0.04) 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2.5rem 1rem;
		cursor: pointer;
		transition: 0.25s;
		box-shadow: rgba(34, 211, 238, 0.08) 0px 0px 0px 1px inset;
	}

	.media-dropzone:hover {
		background: linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
	}

	:global([data-theme='light']) .vs-sidebar-panel .media-dropzone {
		background: rgba(14, 165, 233, 0.04);
		border: 1px dashed rgba(14, 165, 233, 0.35);
	}

	.dropzone-icon {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: rgba(34, 211, 238, 0.1);
		border: 1px solid rgba(34, 211, 238, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.75rem;
	}

	:global([data-theme='light']) .vs-sidebar-panel .dropzone-icon {
		background: rgba(14, 165, 233, 0.12);
		border-color: rgba(14, 165, 233, 0.3);
		color: var(--accent-blue-base, #1b85f3);
	}

	.dropzone-text {
		font-size: 0.8rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.5);
		text-align: center;
	}

	:global([data-theme='light']) .vs-sidebar-panel .dropzone-text {
		color: #475569;
	}

	/* Comments List */
	.vs-comments-list-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.vs-empty-comments-box {
		padding: 24px 0;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.85rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.vs-empty-icon {
		font-size: 1.8rem;
		opacity: 0.4;
	}

	.vs-comments-skeleton {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 0;
	}

	.vs-skeleton-bar {
		height: 14px;
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.08));
		border-radius: 4px;
		animation: pulse 1.5s infinite;
	}

	.vs-skeleton-bar.short {
		width: 60%;
	}

	/* Profile Card */
	.vs-profile-floating-card {
		position: absolute;
		bottom: 24px;
		left: 0;
		right: 0;
		margin-inline: auto;
		width: fit-content;
		max-width: min(calc(100vw - 32px), 520px);
		box-sizing: border-box;
		z-index: 25;
		padding: 14px 20px;
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		border-radius: var(--radius-lg, 20px);
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		box-shadow: var(--shadow-lg), var(--shadow-glow);
		pointer-events: auto;
		transform: none;
	}

	.vs-profile-card-content {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
		justify-content: space-between;
	}

	.vs-profile-text-meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
		max-width: 280px;
	}

	.vs-profile-text-meta h3 {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.vs-profile-text-meta p {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.vs-profile-download-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		padding: 8px 16px;
		font-size: 0.85rem;
		font-weight: 600;
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.vs-profile-floating-card {
			bottom: 16px;
			padding: 10px 14px;
			max-width: calc(100vw - 24px);
		}

		.vs-profile-card-content {
			gap: 10px;
		}

		.vs-profile-text-meta {
			max-width: 160px;
		}

		.vs-profile-download-btn {
			padding: 6px 10px;
			font-size: 0.78rem;
		}
	}

	/* Responsive Mobile */
	@media (max-width: 1024px) {
		.vs-sidebar-panel {
			display: none;
		}

		.vs-lightbox-more-wrap {
			display: block;
			position: absolute;
			top: 18px;
			right: 18px;
			z-index: 60;
		}

		.vs-lightbox-more-btn {
			width: 42px;
			height: 42px;
			border-radius: var(--radius-full, 9999px);
			background: rgba(15, 23, 42, 0.75);
			backdrop-filter: var(--glass-blur, blur(16px));
			-webkit-backdrop-filter: var(--glass-blur, blur(16px));
			border: 1px solid rgba(255, 255, 255, 0.12);
			color: #fff;
		}

		.vs-lightbox-more-menu {
			position: absolute;
			top: calc(100% + 8px);
			right: 0;
			min-width: 190px;
			padding: 6px;
			border-radius: var(--radius-lg, 14px);
			background: var(--bg-surface-solid, #0f172a);
			box-shadow: var(--shadow-lg), var(--shadow-glow);
			display: flex;
			flex-direction: column;
		}
		.vs-lightbox-more-menu button {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 10px 12px;
			border: none;
			background: none;
			color: var(--text-primary, #e2e8f0);
			font-size: 0.85rem;
			font-weight: 600;
			border-radius: var(--radius-md, 10px);
			cursor: pointer;
			text-align: left;
		}
		.vs-lightbox-more-menu button:hover {
			background: rgba(var(--accent-blue-rgb, 46, 134, 232), 0.12);
		}
		.vs-lightbox-more-menu button .material-icons-round {
			font-size: 18px;
		}

		.vs-mobile-action-bar {
			display: flex;
			align-items: center;
			gap: 12px;
			position: absolute;
			bottom: 20px;
			left: 50%;
			transform: translateX(-50%);
			background: var(--bg-surface);
			backdrop-filter: var(--glass-blur);
			border: 1px solid var(--border-subtle);
			border-radius: var(--radius-full, 9999px);
			padding: 6px 14px;
			z-index: 30;
		}

		.vs-mobile-btn {
			display: flex;
			align-items: center;
			gap: 6px;
			background: none;
			border: none;
			color: var(--text-primary);
			font-size: 0.85rem;
			font-weight: 600;
			cursor: pointer;
			padding: 6px 8px;
		}

		.vs-mobile-btn.is-liked {
			color: #f43f5e;
		}

		.vs-mobile-btn.is-shared {
			color: #10b981;
		}

		.vs-mobile-comments-btn {
			background: var(--bg-overlay, rgba(255, 255, 255, 0.1));
			border-radius: var(--radius-full, 9999px);
			padding: 6px 12px;
		}
	}

	.vs-mobile-sheet-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		z-index: 200;
	}

	.vs-mobile-sheet-drawer {
		position: fixed;
		inset: 0;
		height: 100dvh;
		height: 100vh;
		background: var(--bg-surface-solid, #0f172a);
		z-index: 201;
		display: flex;
		flex-direction: column;
		color: var(--text-primary);
	}

	.vs-mobile-sheet-top {
		flex-shrink: 0;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		background: var(--bg-surface-solid, #0f172a);
	}

	.vs-mobile-sheet-pill {
		width: 36px;
		height: 4px;
		background: var(--text-muted);
		opacity: 0.4;
		border-radius: 2px;
	}

	.vs-mobile-sheet-title-row {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.vs-mobile-sheet-title-row h3 {
		font-size: 1rem;
		color: var(--text-primary);
		margin: 0;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.vs-mobile-sheet-title-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.vs-mobile-sheet-count {
		background: rgba(var(--accent-blue-rgb, 46, 134, 232), 0.12);
		border: 1px solid rgba(var(--accent-blue-rgb, 46, 134, 232), 0.2);
		padding: 2px 9px;
		border-radius: var(--radius-full, 9999px);
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--accent-blue-base, #1b85f3);
	}

	.vs-mobile-sheet-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.vs-mobile-sheet-empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 40px 24px;
		color: var(--text-muted);
		text-align: center;
	}
	.vs-mobile-sheet-empty-icon {
		font-size: 2.4rem;
		opacity: 0.35;
	}
	.vs-mobile-sheet-empty p {
		margin: 0;
		font-size: 0.9rem;
	}

	.vs-mobile-sheet-footer {
		flex-shrink: 0;
		display: flex;
		gap: 8px;
		padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid var(--border-subtle);
		background: var(--bg-surface-solid, #0f172a);
	}

	.vs-mobile-sheet-input {
		flex: 1;
		background: var(--bg-input-tint, rgba(255, 255, 255, 0.08));
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full, 9999px);
		padding: 8px 14px;
		color: var(--text-primary);
		font-size: 0.875rem;
	}

	.vs-mobile-sheet-input:focus {
		outline: none;
		border-color: var(--accent-blue-base, #1b85f3);
	}

	.vs-mobile-sheet-textarea {
		resize: none;
		min-height: 40px;
		max-height: 120px;
		line-height: 1.4;
	}

	/* Post original citado en el compositor de respuesta */
	.vs-reply-original-post {
		flex-shrink: 0;
		max-height: 42vh;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-subtle);
		background: rgba(var(--accent-blue-rgb, 46, 134, 232), 0.04);
	}
	.vs-reply-original-avatar {
		flex: 0 0 32px;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-squircle, 10px);
		overflow: hidden;
		background: var(--grad-primary, linear-gradient(135deg, #2e86e8, #1b85f3));
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
	}
	.vs-reply-original-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.vs-reply-original-avatar .material-icons-round {
		font-size: 16px;
	}
	.vs-reply-original-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		min-width: 0;
		font-size: 0.8rem;
	}
	.vs-reply-original-name {
		font-weight: 700;
		color: var(--text-primary, #fff);
	}
	.vs-reply-original-user,
	.vs-reply-original-sep,
	.vs-reply-original-meta time {
		color: var(--text-muted, #94a3b8);
	}
	.vs-reply-original-text {
		width: 100%;
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-secondary, #cbd5e1);
	}
	.vs-reply-original-media {
		position: relative;
		width: 100%;
		margin-top: 2px;
		max-height: 220px;
		border-radius: var(--radius-lg, 14px);
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.06));
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.vs-reply-original-media img,
	.vs-reply-original-media video {
		width: 100%;
		max-height: 220px;
		object-fit: cover;
		display: block;
	}
	.vs-reply-original-media-badge {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		color: rgba(255, 255, 255, 0.92);
	}
	.vs-reply-original-media-badge .material-icons-round {
		font-size: 44px;
		filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
	}
	/* Mini barra de acciones del post original */
	.vs-reply-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px;
		width: 100%;
		margin-top: 2px;
	}
	.vs-reply-action-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		background: none;
		border: none;
		color: var(--text-muted, #94a3b8);
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		padding: 6px 10px;
		border-radius: var(--radius-full, 9999px);
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}
	.vs-reply-action-btn:hover {
		background: rgba(var(--accent-blue-rgb, 46, 134, 232), 0.1);
		color: var(--text-primary);
	}
	.vs-reply-action-btn .material-icons-round {
		font-size: 17px;
	}
	.vs-reply-action-btn.is-liked {
		color: #f43f5e;
	}
	.vs-reply-action-btn.is-shared {
		color: #10b981;
	}
	.vs-reply-action-btn.is-saved {
		color: var(--accent-blue-base, #1b85f3);
	}

	/* Hoja de compartir: Repostear / Citar */
	.vs-mobile-share-sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--bg-surface-solid, #0f172a);
		border-top: 1px solid var(--border-subtle);
		border-top-left-radius: 20px;
		border-top-right-radius: 20px;
		z-index: 201;
		display: flex;
		flex-direction: column;
		padding: 12px 12px calc(20px + env(safe-area-inset-bottom, 0px));
		gap: 4px;
		color: var(--text-primary);
	}
	.vs-mobile-share-title {
		margin: 2px 6px 8px;
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-primary);
		font-family: var(--font-display);
		text-align: center;
	}
	.vs-share-option {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px;
		border: none;
		background: none;
		color: var(--text-primary, #fff);
		border-radius: var(--radius-md, 10px);
		cursor: pointer;
		text-align: left;
		font-family: var(--font-sans);
	}
	.vs-share-option:hover {
		background: rgba(var(--accent-blue-rgb, 46, 134, 232), 0.1);
	}
	.vs-share-option-icon {
		width: 42px;
		height: 42px;
		flex: 0 0 42px;
		border-radius: var(--radius-full, 9999px);
		background: rgba(var(--accent-blue-rgb, 46, 134, 232), 0.12);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent-blue-base, #1b85f3);
	}
	.vs-share-option-icon .material-icons-round {
		font-size: 20px;
	}
	.vs-share-option-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.vs-share-option-text strong {
		font-size: 0.92rem;
	}
	.vs-share-option-text small {
		font-size: 0.75rem;
		color: var(--text-muted, #94a3b8);
	}
</style>
