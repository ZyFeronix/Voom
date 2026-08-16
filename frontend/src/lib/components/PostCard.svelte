<script>
	import { fade, scale, slide, fly } from 'svelte/transition';
	import { untrack } from 'svelte';
	import { onMount } from 'svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';
	import UserTitleBadge from '$lib/components/gamification/UserTitleBadge.svelte';
	import HashtagTextarea from '$lib/components/HashtagTextarea.svelte';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';

	import { backOut, expoOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import { posts as postsApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import CommentItem from '$lib/components/CommentItem.svelte';
	import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
	import KlipyPicker from '$lib/components/KlipyPicker.svelte';
	import ProfileHoverCard from '$lib/components/ProfileHoverCard.svelte';
	import AnonIdentityModal from '$lib/components/AnonIdentityModal.svelte';
	import { getAnonIdentity } from '$lib/stores/anonIdentity.svelte.js';
	import { compressImage } from '$lib/utils/imageCompression.js';
	import { formatHashtags } from '$lib/utils/textFormatting.js';
	import MediaPlayer from '$lib/components/MediaPlayer.svelte';
	import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';
	import { mediaViewer } from '$lib/stores/mediaViewer.svelte.js';
	import { generateLikeSparkles } from '$lib/utils/likeSparkles.js';

	let { post, onDelete } = $props();

	// svelte-ignore state_referenced_locally
	let liked = $state(post.user_liked || false);
	// svelte-ignore state_referenced_locally
	let likeCount = $state(post.like_count || 0);
	let isAnimatingLike = $state(false);
	let isAnimatingUnlike = $state(false);
	let likeParticles = $state([]);
	let animLikeTimeout = null;
	// svelte-ignore state_referenced_locally
	let shared = $state(post.user_shared || false);
	// svelte-ignore state_referenced_locally
	let shareCount = $state(post.share_count || 0);
	let shareAnim = $state(false);
	// svelte-ignore state_referenced_locally
	let saved = $state(post.user_saved || false);
	let showComments = $state(false);

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

	let commentText = $state('');
	let submittingComment = $state(false);
	let showMenu = $state(false);
	let comments = $state([]);
	let commentsLoading = $state(false);
	let commentPollInterval = null;
	let newCommentCount = $state(0);

	let showCommentEmojis = $state(false);
	let showCommentGifs = $state(false);
	let showCommentMedia = $state(false);
	let attachedCommentGif = $state('');

	let commentFileInput = $state(null);
	let attachedCommentImage = $state('');
	let uploadingCommentImage = $state(false);

	let showDeleteModal = $state(false);
	let deleteError = $state('');

	// Identidad anónima del usuario actual (para comentar en posts anónimos)
	let myAnonUsername = $state(null);
	let anonIdentityLoaded = $state(false);
	let showAnonIdentityModal = $state(false);
	let pendingAnonComment = $state(false);

	// En posts anónimos los comentarios SIEMPRE son anónimos → cargamos la identidad al abrir
	$effect(() => {
		if (showComments && post?.is_anonymous) {
			getAnonIdentity().then((ident) => {
				myAnonUsername = ident?.anon_username || null;
				anonIdentityLoaded = true;
			});
		}
	});

	// Load comments when section opens and poll for updates
	$effect(() => {
		if (showComments) {
			untrack(() => loadComments());
			commentPollInterval = setInterval(loadComments, 8000);
		} else {
			clearInterval(commentPollInterval);
			commentPollInterval = null;
		}
		return () => clearInterval(commentPollInterval);
	});

	// Sincronizar cambios desde el Media Lightbox
	$effect(() => {
		return mediaViewer.onPostUpdated((updatedPost) => {
			if (updatedPost && updatedPost.id === post.id) {
				liked = Boolean(updatedPost.user_liked);
				likeCount = updatedPost.like_count !== undefined ? updatedPost.like_count : likeCount;
				shared = Boolean(updatedPost.user_shared);
				shareCount = updatedPost.share_count !== undefined ? updatedPost.share_count : shareCount;
				saved = Boolean(updatedPost.user_saved);
				if (updatedPost.comment_count !== undefined) {
					post = { ...post, comment_count: updatedPost.comment_count };
				}
			}
		});
	});

	async function loadComments() {
		if (typeof document !== 'undefined' && document.hidden) return;
		if (commentsLoading) return;
		if (!post?.id) return;
		commentsLoading = true;

		// Safety: never show loading skeleton more than 5s
		const safetyTimer = setTimeout(() => {
			commentsLoading = false;
		}, 5000);

		try {
			const data = await postsApi.comments.list(post.id);
			const loaded = data.comments || [];

			const commentMap = new Map();
			const topLevel = [];
			loaded.forEach((c) => {
				c.replies = [];
				commentMap.set(c.id, c);
			});
			loaded.forEach((c) => {
				if (c.parent_id) {
					const parent = commentMap.get(c.parent_id);
					if (parent) parent.replies.push(c);
					else topLevel.push(c);
				} else {
					topLevel.push(c);
				}
			});

			if (topLevel.length > comments.length && comments.length > 0) {
				newCommentCount = topLevel.length - comments.length;
			}
			comments = topLevel;
		} catch (err) {
			console.error('Error loading comments:', err);
		} finally {
			clearTimeout(safetyTimer);
			commentsLoading = false;
			if (typeof window !== 'undefined' && window.location.hash.startsWith('#comment-')) {
				setTimeout(() => {
					const el = document.getElementById(window.location.hash.substring(1));
					if (el) {
						el.scrollIntoView({ behavior: 'smooth', block: 'center' });
						el.style.transition = 'background-color 0.5s';
						el.style.backgroundColor = 'var(--glass-highlight)';
						setTimeout(() => {
							el.style.backgroundColor = '';
						}, 2000);
					}
				}, 100);
			}
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined' && window.location.hash.startsWith('#comment-')) {
			showComments = true;
		}
	});

	// Relative time formatter
	function relativeTime(dateStr) {
		if (!dateStr) return '';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'ahora';
		if (mins < 60) return `${mins}m`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d`;
		return new Date(dateStr).toLocaleDateString('es', { month: 'short', day: 'numeric' });
	}

	async function toggleLike() {
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}
		const prev = liked;
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

		try {
			if (liked) await postsApi.like(post.id);
			else await postsApi.unlike(post.id);
		} catch {
			liked = prev;
			likeCount += liked ? 1 : -1;
		}
	}

	async function toggleShare() {
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}
		const prevShared = shared;
		shared = !shared;
		shareCount += shared ? 1 : -1;
		if (shared) {
			shareAnim = true;
			setTimeout(() => {
				shareAnim = false;
			}, 600);
		}
		try {
			if (shared) await postsApi.share(post.id);
			else await postsApi.unshare(post.id);
		} catch {
			shared = prevShared;
			shareCount += shared ? 1 : -1;
		}
	}

	async function toggleSave() {
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}
		const savedPrev = saved;
		saved = !saved;
		try {
			if (saved) await postsApi.save(post.id);
			else await postsApi.unsave(post.id);
		} catch {
			saved = savedPrev;
		}
	}

	async function submitComment() {
		if ((!commentText.trim() && !attachedCommentGif && !attachedCommentImage) || submittingComment)
			return;

		// En posts anónimos los comentarios son SIEMPRE anónimos → se necesita la
		// identidad anónima permanente. Si no existe, abrimos el modal y al crearla
		// se reintenta automáticamente con el texto ya escrito.
		if (post?.is_anonymous) {
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
			if (attachedCommentGif) {
				finalBody += `\n[GIF]${attachedCommentGif}`;
			}
			if (attachedCommentImage) {
				finalBody += `\n[IMG]${attachedCommentImage}`;
			}
			await postsApi.comments.create(post.id, { body: finalBody });
			commentText = '';
			attachedCommentGif = '';
			attachedCommentImage = '';
			post = { ...post, comment_count: (post.comment_count || 0) + 1 };
			await loadComments();
			newCommentCount = 0;
		} catch (err) {
			// 403 ANON_IDENTITY_REQUIRED → forzar la creación de la identidad
			if (err?.status === 403 || err?.code === 'ANON_IDENTITY_REQUIRED') {
				pendingAnonComment = true;
				showAnonIdentityModal = true;
			} else {
				console.error('Error posting comment:', err);
			}
		} finally {
			submittingComment = false;
		}
	}

	function handleKeydown(e) {
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
			alert('Error al subir la imagen');
		} finally {
			uploadingCommentImage = false;
			if (commentFileInput) commentFileInput.value = '';
		}
	}

	function promptDelete() {
		showMenu = false;
		showDeleteModal = true;
	}

	async function executeDelete() {
		try {
			await postsApi.delete(post.id);
			showDeleteModal = false;
			onDelete?.(post.id);
		} catch (err) {
			console.error('Failed to delete post:', err);
			deleteError = 'Error al eliminar el post. Por favor intenta de nuevo.';
		}
	}

	async function handleVote(optionIndex) {
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}
		try {
			const res = await fetch(`/api/posts/${post.id}/vote`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authStore.token}`
				},
				body: JSON.stringify({ option_index: optionIndex })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to vote');
			if (data.poll) {
				post.poll = data.poll;
			}
		} catch (err) {
			console.error('Failed to vote:', err);
			alert(err.message || 'Error al registrar tu voto.');
		}
	}

	let cardRef;
</script>

<article
	bind:this={cardRef}
	class="aero-post-card animate-slide-in-up"
	style="position: relative; z-index: {showCommentEmojis || showCommentGifs || showMenu ? 40 : 2};"
>
	<!-- Repost Banner -->
	{#if post.reposted_by}
		<div class="repost-indicator-banner">
			<span class="material-icons-round repost-icon">repeat</span>
			<span>
				<a
					href={`/u/${post.reposted_by.username}`}
					class="repost-user-link"
					onclick={(e) => e.stopPropagation()}
				>
					{post.reposted_by.display_name || post.reposted_by.username}
				</a>
				reposteó
			</span>
		</div>
	{/if}

	<!-- Header -->
	<div class="flex items-start justify-between mb-3">
		{#if post.is_anonymous}
			<div class="flex items-center gap-3">
				<!-- Cyber Phantom / Anonymous Avatar -->
				<div class="anon-avatar-wrapper" style="flex: 0 0 44px; min-width: 44px; min-height: 44px;">
					<div class="anon-avatar-inner">
						<span class="material-icons-round text-xl">visibility_off</span>
					</div>
				</div>

				<!-- Name & meta -->
				<div class="user-meta">
					<div class="flex items-center gap-1.5 flex-wrap">
						<span class="font-semibold text-sm text-main tracking-wide">
							{post.display_name === 'Usuario Anónimo'
								? 'Usuario Anónimo'
								: `@${post.display_name}`}
						</span>
						<span class="anon-badge">
							<span class="material-icons-round text-xs">theater_comedy</span>
							Anónimo
						</span>
						{#if post.is_author}
							<span
								class="anon-owner-pill"
								title="Publicación visible globalmente · Tu identidad real está protegida y oculta para los demás"
							>
								<span class="material-icons-round text-[11px]">visibility_off</span> Tu post anónimo
							</span>
						{/if}
						{#if post.mood}
							<span class="post-mood-badge">
								{#if post.mood === 'happy'}😊 Feliz
								{:else if post.mood === 'creative'}🎨 Creativo
								{:else if post.mood === 'gaming'}🎮 Jugando
								{:else if post.mood === 'music'}🎵 Escuchando Musica
								{:else if post.mood === 'thinking'}🤔 Pensando
								{:else if post.mood === 'excited'}🔥 Emocionado
								{:else if post.mood === 'traveling'}✈️ Viajando
								{:else if post.mood === 'celebrating'}🥂 Celebrando
								{:else if post.mood === 'working'}💻 Trabajando
								{:else if post.mood === 'eating'}🍔 Comiendo
								{/if}
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-1 text-xs text-muted flex-wrap">
						<span>Identidad Oculta</span>
						<span>·</span>
						<time datetime={post.created_at}>{relativeTime(post.created_at)}</time>
					</div>
				</div>
			</div>
		{:else}
			<ProfileHoverCard
				username={post.username}
				basicUser={{
					id: post.user_id,
					username: post.username,
					display_name: post.display_name,
					avatar_url: post.avatar_url,
					is_verified: post.is_verified,
					level: post.level
				}}
			>
				<a href={`/u/${post.username}`} class="flex items-center gap-3 group text-decoration-none">
					<!-- Avatar -->
					<AeroAvatar
						src={post.avatar_url}
						alt={post.username}
						size="md"
						isVtuber={post.is_virtual}
					/>

					<!-- Name & meta -->
					<div class="user-meta">
						<div class="flex items-center gap-1">
							<span
								class="font-semibold text-sm text-main group-hover:text-blue-500 transition-colors"
							>
								{post.display_name || post.username}
							</span>
							<VerifiedBadge role={post.role} isVerified={post.is_verified == 1} size="16px" />
							{#if post.level}
								<LevelBadge level={post.level} size="sm" showText={false} />
							{/if}
							{#if post.title_text}
								<UserTitleBadge title={post.title_text} color={post.title_color} size="sm" />
							{/if}
							{#if post.mood}
								<span class="post-mood-badge">
									{#if post.mood === 'happy'}😊 Feliz
									{:else if post.mood === 'creative'}🎨 Creativo
									{:else if post.mood === 'gaming'}🎮 Jugando
									{:else if post.mood === 'music'}🎵 Escuchando Musica
									{:else if post.mood === 'thinking'}🤔 Pensando
									{:else if post.mood === 'excited'}🔥 Emocionado
									{:else if post.mood === 'traveling'}✈️ Viajando
									{:else if post.mood === 'celebrating'}🥂 Celebrando
									{:else if post.mood === 'working'}💻 Trabajando
									{:else if post.mood === 'eating'}🍔 Comiendo
									{/if}
								</span>
							{/if}
						</div>
						<div class="flex items-center gap-1 text-xs text-muted flex-wrap">
							<span>@{post.username}</span>
							<span>·</span>
							<time datetime={post.created_at}>{relativeTime(post.created_at)}</time>
							{#if post.location}
								<span>·</span>
								<span
									class="flex items-center gap-0.5 text-blue-500 font-semibold"
									title="Ubicación de check-in"
								>
									<span class="material-icons-round text-xs">location_on</span>
									{post.location}
								</span>
							{/if}
						</div>
					</div>
				</a>
			</ProfileHoverCard>
		{/if}

		<!-- Post menu -->
		<div class="relative">
			<button onclick={() => (showMenu = !showMenu)} class="aero-icon-btn btn-small">
				<span class="material-icons-round text-[18px]">more_horiz</span>
			</button>
			{#if showMenu}
				<div class="aero-dropdown-menu animate-slide-in-up">
					{#if post.is_author || (post.user_id && post.user_id === authStore.user?.id)}
						<button
							onclick={() => {
								showMenu = false;
								goto(`/posts/${post.id}/edit`);
							}}
							class="aero-dropdown-item"
						>
							<span class="material-icons-round text-[16px]">edit</span> Editar
						</button>
						<button onclick={promptDelete} class="aero-dropdown-item text-red-500">
							<span class="material-icons-round text-[16px]">delete</span> Eliminar
						</button>
					{:else}
						<button
							onclick={() => {
								showMenu = false;
							}}
							class="aero-dropdown-item"
						>
							<span class="material-icons-round text-[16px]">flag</span> Reportar
						</button>
					{/if}
					<button
						onclick={() => {
							showMenu = false;
						}}
						class="aero-dropdown-item"
					>
						<span class="material-icons-round text-[16px]">link</span> Copiar enlace
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Post Body -->
	{#if post.body}
		<p class="post-body" class:emoji-only-text={isEmojiOnly(post.body)}>
			{@html formatHashtags(post.body)}
		</p>
	{/if}

	<!-- Poll Widget -->
	{#if post.poll}
		{@const totalVotes = post.poll.options.reduce((acc, opt) => acc + opt.votes, 0)}
		{@const hasVoted = post.poll.voted_user_ids?.includes(authStore.user?.id)}
		{@const canVote = authStore.isAuthenticated && !hasVoted}
		<div class="poll-widget-container p-4 rounded-2xl mb-4 max-w-md">
			<div class="poll-question font-bold text-sm text-main mb-3">
				{post.poll.question}
			</div>

			<div class="poll-options flex flex-col gap-2">
				{#each post.poll.options as option, idx}
					{@const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0}

					{#if canVote}
						<button
							onclick={() => handleVote(idx)}
							class="poll-option-btn w-full p-3 rounded-xl text-left font-semibold text-xs text-main transition flex justify-between items-center"
						>
							<span>{option.text}</span>
							<span class="material-icons-round text-muted select-none">radio_button_unchecked</span
							>
						</button>
					{:else}
						<div
							class="poll-result-row relative w-full p-3 rounded-xl flex justify-between items-center overflow-hidden text-xs"
						>
							<div
								class="absolute inset-y-0 left-0 bg-aero-blue/15 transition-all duration-500"
								style="width: {percentage}%"
							></div>
							<span class="relative font-semibold text-main z-10 flex items-center gap-1.5">
								{option.text}
							</span>
							<span class="relative font-bold text-main z-10">{percentage}% ({option.votes})</span>
						</div>
					{/if}
				{/each}
			</div>

			<div
				class="flex justify-between items-center text-[10px] text-muted font-bold mt-3 pt-2 border-t border-glass-border"
			>
				<span>{totalVotes} votos</span>
				{#if hasVoted}
					<span class="text-emerald-500 flex items-center gap-0.5"
						><span class="material-icons-round text-[12px]">check_circle</span> Voto registrado</span
					>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Media grid -->
	{#if post.media && post.media.length > 0}
		<div class="media-container {post.media.length > 1 ? 'grid-2' : ''}">
			{#each post.media.slice(0, 4) as media, i}
				{#if media.media_type === 'video' || media.media_type === 'audio'}
					<MediaPlayer
						type={media.media_type}
						src={media.media_url}
						class="media-item video-media {post.media.length === 1 ? 'video-solo' : 'video-grid'}"
						entityId={post.id}
						entityType="video"
					/>
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<img
						src={getProxiedMediaUrl(media.media_url)}
						alt="Post media {i + 1}"
						loading="lazy"
						decoding="async"
						width={media.width || 800}
						height={media.height || 600}
						crossorigin="anonymous"
						referrerpolicy="no-referrer"
						class="media-item {post.media.length === 1
							? 'full-media'
							: 'square-media'} is-clickable"
						onclick={(e) => {
							e.stopPropagation();
							mediaViewer.openPostMedia(post, i);
						}}
					/>
					{#if i === 3 && post.media.length > 4}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="media-overlay is-clickable"
							onclick={(e) => {
								e.stopPropagation();
								mediaViewer.openPostMedia(post, 3);
							}}
						>
							<span>+{post.media.length - 4}</span>
						</div>
					{/if}
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Hashtags -->
	{#if post.hashtags && post.hashtags.length > 0}
		<div class="hashtags flex flex-wrap gap-1 mb-3">
			{#each post.hashtags as tag}
				<a href={`/explore?tag=${tag}`} class="aero-hashtag">#{tag}</a>
			{/each}
		</div>
	{/if}

	<!-- Action bar -->
	<div class="action-bar">
		<div class="flex items-center gap-1">
			<!-- Like -->
			<div class="like-btn-wrapper">
				<button
					onclick={toggleLike}
					class="action-btn {liked ? 'liked' : ''}"
					aria-label="{liked ? 'Quitar me gusta' : 'Dar me gusta'}{likeCount > 0
						? ' ' + likeCount.toLocaleString()
						: ''}"
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
				onclick={() => (showComments = !showComments)}
				class="action-btn"
				aria-label="Comentar{post.comment_count > 0
					? ' ' + post.comment_count.toLocaleString()
					: ''}"
			>
				<span class="material-icons-round text-[18px] icon">chat_bubble_outline</span>
				<span class="count"
					>{post.comment_count > 0 ? post.comment_count.toLocaleString() : ''}</span
				>
			</button>

			<!-- Share / Repost -->
			<button
				onclick={toggleShare}
				class="action-btn action-btn-share {shared ? 'shared' : ''} {shareAnim
					? 'share-bounce'
					: ''}"
				aria-label="{shared ? 'Deshacer repost' : 'Repostear'}{shareCount > 0
					? ' ' + shareCount.toLocaleString()
					: ''}"
			>
				<span class="material-icons-round text-[18px] icon">repeat</span>
				<span class="count">{shareCount > 0 ? shareCount.toLocaleString() : ''}</span>
			</button>
		</div>

		<!-- Save -->
		<button
			onclick={toggleSave}
			class="action-btn-save {saved ? 'saved' : ''}"
			aria-label={saved ? 'Quitar guardado' : 'Guardar'}
		>
			<span class="material-icons-round text-[20px] icon"
				>{saved ? 'bookmark' : 'bookmark_border'}</span
			>
		</button>
	</div>

	<!-- Comments section -->
	{#if showComments}
		<div
			class="comments-section mt-3"
			class:is-anon-section={post?.is_anonymous == 1 || post?.is_anonymous === true}
			transition:slide={{ duration: 350, easing: expoOut }}
		>
			{#if authStore.isAuthenticated}
				<div class="flex items-start gap-2 mb-4">
					{#if post?.is_anonymous}
						<div
							class="anon-comment-avatar"
							title="Comentarás de forma anónima"
							style="flex: 0 0 32px; min-width: 32px; min-height: 32px;"
						>
							<span class="material-icons-round" style="font-size:16px">visibility_off</span>
						</div>
					{:else if authStore.user?.avatar_url}
						<img
							src={authStore.user.avatar_url}
							alt="You"
							class="w-8 h-8 squircle border border-white object-cover"
							width="32"
							height="32"
							loading="lazy"
							decoding="async"
							style="flex: 0 0 32px; min-width: 32px; min-height: 32px;"
						/>
					{:else}
						<div
							class="vs-avatar-letter avatar-sm"
							style="flex: 0 0 32px; min-width: 32px; min-height: 32px;"
						>
							{(authStore.user?.display_name || authStore.user?.username || 'U')[0].toUpperCase()}
						</div>
					{/if}

					<div class="flex-1 flex flex-col">
						<!-- Previews (Above input) -->
						{#if attachedCommentGif || attachedCommentImage}
							<div class="flex items-center gap-2 mb-2">
								{#if attachedCommentGif}
									<div
										class="flex items-center gap-2 p-1.5 pr-3 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-xl text-xs font-bold text-fuchsia-400 w-fit shadow-md"
									>
										<img
											src={getProxiedMediaUrl(attachedCommentGif)}
											alt="GIF Preview"
											class="w-10 h-10 object-cover rounded-lg"
											width="40"
											height="40"
											loading="lazy"
											decoding="async"
											crossorigin="anonymous"
											referrerpolicy="no-referrer"
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
											width="40"
											height="40"
											loading="lazy"
											decoding="async"
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

						{#if post?.is_anonymous}
							<button
								type="button"
								class="anon-comment-identity-pill"
								onclick={() => {
									if (!myAnonUsername) showAnonIdentityModal = true;
								}}
								title="Tu identidad para comentarios anónimos (permanente)"
							>
								<span class="material-icons-round" style="font-size:13px">theater_comedy</span>
								{#if myAnonUsername}
									<span>Comentarás como <strong>@{myAnonUsername}</strong></span>
								{:else if anonIdentityLoaded}
									<span>Crea tu identidad anónima para comentar</span>
								{:else}
									<span>Comentario anónimo…</span>
								{/if}
							</button>
						{/if}

						<div class="comment-input-wrapper" style="overflow: visible;">
							<HashtagTextarea
								id="comment_input_{post.id}"
								bind:value={commentText}
								onkeydown={handleKeydown}
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
								onclick={submitComment}
								disabled={(!commentText.trim() && !attachedCommentGif && !attachedCommentImage) ||
									submittingComment}
								class="comment-submit-btn"
							>
								<span class="material-icons-round">send</span>
							</button>
						</div>

						{#if showCommentMedia}
							<div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
								<div class="post-nested-panel p-4" style="min-height: max-content;">
									<div
										role="button"
										tabindex="0"
										class="media-dropzone"
										onclick={() => commentFileInput.click()}
										onkeydown={(e) => e.key === 'Enter' && commentFileInput.click()}
										ondragover={(e) => e.preventDefault()}
										ondrop={(e) => {
											e.preventDefault();
											if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
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
			{/if}

			{#if newCommentCount > 0}
				<div class="new-comments-indicator">
					<span class="material-icons-round">arrow_upward</span>
					{newCommentCount} comentario{newCommentCount > 1 ? 's' : ''} nuevo{newCommentCount > 1
						? 's'
						: ''}
				</div>
			{/if}

			{#if commentsLoading && comments.length === 0}
				<div class="comments-loading-state">
					<div class="comment-skeleton">
						<div class="skeleton-avatar"></div>
						<div class="skeleton-lines">
							<div class="skeleton-line w-3/4"></div>
							<div class="skeleton-line w-1/2"></div>
						</div>
					</div>
					<div class="comment-skeleton">
						<div class="skeleton-avatar"></div>
						<div class="skeleton-lines">
							<div class="skeleton-line w-full"></div>
							<div class="skeleton-line w-2/3"></div>
						</div>
					</div>
				</div>
			{:else if comments.length > 0}
				<div class="comments-list">
					{#each comments.slice(-10) as comment, i (comment.id)}
						<div in:fly={{ y: 12, duration: 250, delay: Math.min(i * 30, 200), easing: expoOut }}>
							<CommentItem
								{comment}
								postId={post.id}
								postIsAnonymous={post?.is_anonymous == 1 || post?.is_anonymous === true}
								onReload={loadComments}
							/>
						</div>
					{/each}
				</div>
				{#if comments.length > 10}
					<div class="text-center py-2">
						<a
							href="/posts/{post.id}"
							class="text-blue-500 hover:underline font-semibold"
							style="font-size:0.8rem;">Ver los {comments.length} comentarios</a
						>
					</div>
				{/if}
			{:else}
				<p class="no-comments-text">Aun no hay comentarios. Se el primero.</p>
			{/if}
		</div>
	{/if}
</article>

{#if showDeleteModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="aero-modal-backdrop"
		onclick={(e) => {
			if (e.target === e.currentTarget) showDeleteModal = false;
		}}
		transition:fade={{ duration: 150 }}
	>
		<div
			class="aero-modal-content"
			transition:scale={{ duration: 250, start: 0.95, easing: backOut }}
			style="padding: 24px;"
		>
			<div class="flex items-center gap-3 mb-3">
				<div
					class="w-10 h-10 squircle flex items-center justify-center flex-shrink-0"
					style="background: rgba(232, 74, 114, 0.15); color: #e84a72;"
				>
					<span class="material-icons-round">warning</span>
				</div>
				<h3 class="font-bold text-lg text-main m-0">¿Eliminar post?</h3>
			</div>
			<p class="text-sm text-muted mb-6 leading-relaxed">
				¿Estás seguro que quieres eliminar este post? Al aceptar la eliminación, recuerda que puedes
				reestablecerlo en un plazo máximo de 30 días.
			</p>
			{#if deleteError}
				<p class="text-xs text-red-400 mb-4 bg-red-500/10 p-2 rounded-md">{deleteError}</p>
			{/if}
			<div class="flex gap-3 justify-end">
				<button
					onclick={() => {
						showDeleteModal = false;
						deleteError = '';
					}}
					class="btn-aero-secondary"
					style="padding: 8px 16px; font-size: 0.85rem;">Cancelar</button
				>
				<button
					onclick={executeDelete}
					class="btn-aero-danger"
					style="padding: 8px 16px; font-size: 0.85rem;">Eliminar</button
				>
			</div>
		</div>
	</div>
{/if}

<AnonIdentityModal
	open={showAnonIdentityModal}
	onClose={() => {
		showAnonIdentityModal = false;
		pendingAnonComment = false;
	}}
	onCreated={(_username) => {
		myAnonUsername = _username;
		anonIdentityLoaded = true;
		showAnonIdentityModal = false;
		if (pendingAnonComment) {
			pendingAnonComment = false;
			submitComment();
		}
	}}
/>

<style>
	/* PostCard overrides to match topbar effect & prevent overlap */
	.aero-post-card {
		position: relative;
		z-index: 2;
		background: var(--bg-surface);
		isolation: isolate;
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		border: 1px solid var(--glass-border);
		border-top-color: var(--glass-border-t);
		box-shadow: var(--glass-shadow), var(--glass-inset);
		margin-bottom: 2rem;
		transition:
			border-color 0.25s ease,
			box-shadow 0.25s ease;
	}

	.post-nested-panel {
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
	}

	.emoji-only-text {
		font-size: 3rem !important;
		line-height: 1.2;
		text-align: center;
		padding: 1rem 0;
	}

	.aero-post-card:hover {
		border-color: rgba(27, 133, 243, 0.35);
		box-shadow:
			0 0 20px rgba(27, 133, 243, 0.15),
			var(--glass-inset);
	}

	.text-main {
		color: var(--text-primary);
	}
	.text-muted {
		color: var(--text-muted);
	}

	.group:hover .text-main {
		color: var(--aero-blue);
	}

	.aero-icon-btn {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--t-fast);
	}

	.aero-icon-btn:hover {
		background: var(--bg-overlay);
		color: var(--aero-blue);
		box-shadow: var(--shadow-xs);
	}

	.btn-small {
		width: 28px;
		height: 28px;
	}

	.aero-dropdown-menu {
		position: absolute;
		right: 0;
		top: 100%;
		margin-top: 4px;
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--glass-border);
		border-top-color: var(--glass-border-t);
		border-radius: var(--radius-sm);
		padding: 4px;
		box-shadow: var(--shadow-md), var(--glass-inset);
		min-width: 140px;
		z-index: 100;
	}

	.aero-dropdown-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		border: none;
		background: transparent;
		text-align: left;
		font-size: 0.9rem;
		color: var(--text-secondary);
		border-radius: var(--radius-xs);
		cursor: pointer;
		transition:
			background var(--t-fast),
			color var(--t-fast);
	}

	.aero-dropdown-item:hover {
		background: var(--bg-overlay);
		color: var(--aero-blue);
	}

	.post-body {
		font-size: 0.95rem;
		color: var(--text-primary);
		line-height: 1.5;
		margin-bottom: 12px;
		white-space: pre-wrap;
	}

	.media-container {
		margin-bottom: 12px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		position: relative;
		/* Fix webkit border-radius overflow clip */
		transform: translateZ(0);
	}

	.grid-2 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 4px;
	}

	@media (min-width: 640px) {
		.grid-2 {
			grid-template-columns: 1fr 1fr;
		}
	}

	.media-item {
		display: block;
		border-radius: var(--radius-xs);
	}

	/* ── Imágenes únicas ── */
	.full-media {
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: 500px;
		margin: 0 auto;
		object-fit: cover;
		/* Evita que el ancho intrínseco de la imagen fuerce el min-content de la
		   tarjeta y la haga desbordar grids estrechos (min-width: auto) */
		min-width: 0;
	}

	/* ── Imágenes en grid ── */
	.square-media {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
	}

	/* ── Videos: sin wrapper forzado, el player define su propio tamaño ── */
	/* Video solo: ocupa el ancho completo, el MediaPlayer respeta el aspect-ratio nativo */
	:global(.video-solo) {
		width: 100% !important;
		height: auto !important;
		max-height: 560px !important;
		min-height: 200px !important;
		aspect-ratio: unset !important;
	}
	/* Video en grid: altura fija cómoda, sin recorte horizontal */
	:global(.video-grid) {
		width: 100% !important;
		height: 220px !important;
		min-height: 180px !important;
		max-height: 260px !important;
	}
	/* El video nativo dentro del player no debe estar forzado */
	:global(.video-solo .v-native-video),
	:global(.video-grid .v-native-video) {
		object-fit: contain !important;
		width: 100% !important;
		height: 100% !important;
	}

	.media-item.is-clickable {
		cursor: pointer;
		transition: filter 0.2s ease;
	}

	.media-item.is-clickable:hover {
		filter: brightness(1.05);
	}

	.media-overlay {
		position: absolute;
		bottom: 0;
		right: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(8px);
		color: white;
		padding: 6px 10px;
		border-top-left-radius: var(--radius-sm);
		font-weight: bold;
		user-select: none;
	}

	.media-overlay.is-clickable {
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.media-overlay.is-clickable:hover {
		background: var(--accent-blue-base, #1b85f3);
	}

	.aero-hashtag {
		color: var(--aero-blue);
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		font-weight: 500;
		text-decoration: none;
		transition: all var(--t-fast);
	}

	.aero-hashtag:hover {
		background: var(--aero-sky);
		color: white;
		box-shadow: 0 2px 5px rgba(74, 171, 223, 0.4);
	}

	.action-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 12px;
		border-top: 1px solid var(--border-subtle);
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 12px;
		border-radius: var(--radius-sm);
		background: transparent;
		border: none;
		color: var(--text-secondary);
		font-weight: 600;
		cursor: pointer;
		transition:
			transform var(--t-spring),
			background var(--t-fast),
			color var(--t-fast),
			box-shadow var(--t-fast);
		will-change: transform;
	}
	/* Press: feedback táctil suave */
	.action-btn:active {
		transform: scale(0.92);
	}
	.action-btn:hover {
		background: var(--bg-overlay);
		color: var(--aero-blue);
		box-shadow: 0 0 12px rgba(27, 133, 243, 0.15);
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

	.action-btn-save {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		padding: 6px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--t-fast);
	}

	.action-btn-save:hover {
		background: var(--bg-overlay);
		color: var(--aero-blue);
	}

	.action-btn-save.saved {
		color: var(--aero-blue);
		background: rgba(46, 134, 232, 0.08);
	}

	.repost-indicator-banner {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: -2px 0 10px 0;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border-subtle);
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--text-muted);
	}

	.repost-indicator-banner .repost-icon {
		font-size: 16px;
		color: var(--aero-mint, #00d4aa);
	}

	.repost-indicator-banner .repost-user-link {
		color: var(--text-secondary);
		font-weight: 600;
		text-decoration: none;
		transition: color var(--t-fast);
	}

	.repost-indicator-banner .repost-user-link:hover {
		color: var(--aero-mint, #00d4aa);
		text-decoration: underline;
	}

	.action-btn.shared {
		color: var(--aero-mint, #00d4aa);
		background: rgba(0, 212, 170, 0.08);
	}

	.action-btn.shared .icon {
		filter: drop-shadow(0 0 6px rgba(0, 212, 170, 0.5));
	}

	.action-btn.shared:hover {
		background: rgba(0, 212, 170, 0.15);
	}

	.share-bounce {
		animation: shareBounce 0.5s var(--ease-spring);
	}

	@keyframes shareBounce {
		0% {
			transform: scale(1);
		}
		30% {
			transform: scale(1.3) rotate(15deg);
		}
		60% {
			transform: scale(0.9) rotate(-5deg);
		}
		100% {
			transform: scale(1) rotate(0);
		}
	}

	.post-mood-badge {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-muted);
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		margin-left: 6px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.anon-avatar-wrapper {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(34, 211, 238, 0.14) 100%)
		);
		padding: 2px;
		box-shadow:
			0 2px 8px rgba(99, 102, 241, 0.12),
			inset 0 1px 1px rgba(255, 255, 255, 0.4);
		border: 1px solid var(--anon-border, rgba(255, 255, 255, 0.25));
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.anon-avatar-inner {
		width: 100%;
		height: 100%;
		border-radius: inherit;
		background: var(--bg-surface);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--anon-accent, #818cf8);
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

	.anon-owner-pill {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		font-size: 0.68rem;
		font-weight: 600;
		background: var(--anon-bg, rgba(99, 102, 241, 0.1));
		color: var(--anon-text, #4338ca);
		border: 1px solid var(--anon-border, rgba(168, 85, 247, 0.25));
		box-shadow: 0 1px 4px rgba(99, 102, 241, 0.08);
	}

	.comments-section {
		border-top: 1px solid var(--border-subtle);
		padding-top: 12px;
	}
	.comments-section.is-anon-section {
		border-top: 1px solid var(--anon-border, rgba(129, 140, 248, 0.25));
		background: linear-gradient(180deg, rgba(99, 102, 241, 0.03) 0%, rgba(168, 85, 247, 0.01) 100%);
		border-radius: 0 0 var(--radius-md) var(--radius-md);
		padding: 12px 8px 4px;
	}
	.comments-section.is-anon-section .comment-input-wrapper {
		border-color: var(--anon-border, rgba(129, 140, 248, 0.25));
		background: var(--anon-bg, rgba(99, 102, 241, 0.05));
	}
	.comments-section.is-anon-section .comment-input-wrapper:focus-within {
		border-color: var(--anon-accent, #818cf8);
		box-shadow:
			0 0 0 3px var(--anon-bg, rgba(99, 102, 241, 0.15)),
			0 0 16px rgba(99, 102, 241, 0.2);
	}
	.comments-section.is-anon-section .comment-submit-btn {
		background: var(--anon-gradient, linear-gradient(135deg, #6366f1, #a855f7));
		border: 1px solid var(--anon-border-active, rgba(168, 85, 247, 0.7));
		box-shadow: 0 3px 12px rgba(99, 102, 241, 0.35);
	}
	.comments-section.is-anon-section .comment-submit-btn:not(:disabled):hover {
		box-shadow: 0 0 18px rgba(168, 85, 247, 0.5);
		border-color: rgba(255, 255, 255, 0.6);
	}
	.comments-section.is-anon-section .comment-emoji-btn:hover,
	.comments-section.is-anon-section .comment-gif-btn:hover,
	.comments-section.is-anon-section .comment-photo-btn:hover {
		color: var(--anon-accent, #818cf8);
	}

	.comment-input-wrapper {
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
		min-height: 44px;
		background: var(--bg-input-tint);
		border: 1.5px solid var(--glass-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		box-shadow: var(--shadow-xs), var(--glass-inset-highlight);
	}

	.comment-input-wrapper:focus-within {
		border-color: var(--aero-sky);
		box-shadow:
			0 0 0 3px rgba(46, 134, 232, 0.1),
			var(--shadow-xs);
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
		cursor: pointer;
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
		cursor: pointer;
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
		cursor: pointer;
		transition: background var(--t-fast);
		color: var(--text-muted);
		z-index: 10;
	}

	.comment-photo-btn:hover {
		background: var(--bg-surface);
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
	.dropzone-text {
		font-size: 0.8rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.5);
		text-align: center;
	}

	.comment-submit-btn {
		position: absolute;
		right: 5px;
		top: 50%;
		transform: translateY(-50%);
		width: 32px;
		height: 32px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: linear-gradient(135deg, var(--aero-sky), var(--aero-blue));
		color: white;
		border: none;
		box-shadow: 0 3px 10px rgba(var(--accent-blue-rgb), 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
		z-index: 10;
	}
	.comment-submit-btn .material-icons-round {
		font-size: 17px;
		line-height: 1;
		display: block;
	}

	.comment-submit-btn:not(:disabled):hover {
		box-shadow: 0 0 16px rgba(var(--accent-blue-rgb), 0.5);
	}

	.comment-submit-btn:not(:disabled):active {
		transform: translateY(-50%) scale(0.96);
		box-shadow: 0 2px 6px rgba(var(--accent-blue-rgb), 0.25);
	}

	.comment-submit-btn:disabled {
		background: var(--bg-overlay);
		color: var(--text-muted);
		box-shadow: none;
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Animations */
	@keyframes slideInUp {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.animate-slide-in-up {
		animation: slideInUp 0.2s ease-out;
	}

	/* Real-time comments */
	.comments-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		height: auto !important;
		overflow: visible !important;
		max-height: none !important;
	}

	.no-comments-text {
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-muted);
		padding: 12px 0;
		margin: 0;
	}

	.new-comments-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 6px 12px;
		background: rgba(74, 171, 223, 0.08);
		border: 1px solid rgba(74, 171, 223, 0.2);
		border-radius: var(--radius-sm);
		color: var(--aero-blue);
		font-size: 0.75rem;
		font-weight: 700;
		margin-bottom: 8px;
		animation: pulse 2s ease-in-out infinite;
	}

	.new-comments-indicator .material-icons-round {
		font-size: 14px;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	/* Poll styling */
	.poll-widget-container {
		background: var(--bg-surface2);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-sm), var(--glass-inset);
	}
	.poll-option-btn {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
	}
	.poll-option-btn:hover {
		background: rgba(46, 134, 232, 0.08);
		border-color: var(--aero-blue);
		transform: translateY(-1px);
	}
	.poll-option-btn:active {
		transform: scale(0.98);
	}
	.poll-result-row {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
	}

	/* ── Comment Skeleton Loader ─────────────────────────────── */
	.comments-loading-state {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px 0;
	}

	.comment-skeleton {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}

	.skeleton-avatar {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: rgba(255, 255, 255, 0.06);
		flex-shrink: 0;
		background-image: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 0%,
			rgba(255, 255, 255, 0.12) 40%,
			rgba(255, 255, 255, 0.04) 80%
		);
		background-size: 200% 100%;
		animation: skeleton-shimmer 1.4s ease-in-out infinite;
	}

	.skeleton-lines {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 4px;
	}

	.skeleton-line {
		height: 10px;
		border-radius: var(--radius-xs);
		background: rgba(255, 255, 255, 0.06);
		background-image: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 0%,
			rgba(255, 255, 255, 0.12) 40%,
			rgba(255, 255, 255, 0.04) 80%
		);
		background-size: 200% 100%;
		animation: skeleton-shimmer 1.4s ease-in-out infinite;
	}

	.skeleton-line.w-3\/4 {
		width: 75%;
	}
	.skeleton-line.w-1\/2 {
		width: 50%;
	}
	.skeleton-line.w-full {
		width: 100%;
	}
	.skeleton-line.w-2\/3 {
		width: 66%;
	}

	.comment-skeleton:nth-child(2) .skeleton-avatar,
	.comment-skeleton:nth-child(2) .skeleton-line {
		animation-delay: 0.15s;
	}

	@keyframes skeleton-shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* ── Comentarios en posts anónimos ── */
	.anon-comment-avatar {
		border-radius: 50%;
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(34, 211, 238, 0.22))
		);
		border: 1px solid var(--anon-border, rgba(129, 140, 248, 0.45));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--anon-accent, #818cf8);
		box-shadow: 0 0 10px rgba(99, 102, 241, 0.25);
	}
	.anon-comment-identity-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
		padding: 5px 12px;
		border-radius: var(--radius-full);
		border: 1px solid var(--anon-border, rgba(129, 140, 248, 0.35));
		background: var(--anon-bg, rgba(99, 102, 241, 0.1));
		color: var(--anon-text, #4338ca);
		font-size: 0.74rem;
		cursor: pointer;
		transition: all var(--t-fast);
	}
	.anon-comment-identity-pill:hover {
		border-color: var(--anon-accent, rgba(129, 140, 248, 0.6));
		box-shadow: 0 0 12px rgba(99, 102, 241, 0.25);
	}
	.anon-comment-identity-pill strong {
		color: var(--anon-text, #4338ca);
	}
</style>
