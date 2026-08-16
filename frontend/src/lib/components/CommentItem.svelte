<script>
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { posts as postsApi } from '$lib/api.js';
	import CommentItem from './CommentItem.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
	import KlipyPicker from '$lib/components/KlipyPicker.svelte';
	import { slide } from 'svelte/transition';
	import { expoOut } from 'svelte/easing';
	import { compressImage } from '$lib/utils/imageCompression.js';
	import { formatHashtags } from '$lib/utils/textFormatting.js';
	import HashtagTextarea from '$lib/components/HashtagTextarea.svelte';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';
	import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';
	import AnonIdentityModal from '$lib/components/AnonIdentityModal.svelte';
	import { getAnonIdentity } from '$lib/stores/anonIdentity.svelte.js';
	import { mediaViewer } from '$lib/stores/mediaViewer.svelte.js';
	import { generateLikeSparkles } from '$lib/utils/likeSparkles.js';

	let { comment, postId, postIsAnonymous = false, onReload, depth = 0 } = $props();

	let isAnonContext = $derived(
		Boolean(postIsAnonymous || comment.is_anonymous == 1 || comment.is_anonymous === true)
	);
	let myAnonUsername = $state(null);
	let anonIdentityLoaded = $state(false);
	let showAnonIdentityModal = $state(false);

	async function ensureAnonIdentity() {
		if (!anonIdentityLoaded) {
			const ident = await getAnonIdentity();
			myAnonUsername = ident?.anon_username || null;
			anonIdentityLoaded = true;
		}
		return myAnonUsername;
	}

	$effect(() => {
		if (showReplyInput && isAnonContext) {
			ensureAnonIdentity();
		}
	});

	let showReplyInput = $state(false);
	let replyText = $state('');
	let submittingReply = $state(false);
	let showReplyEmojis = $state(false);
	let showReplyGifs = $state(false);
	let showReplyMedia = $state(false);
	let attachedReplyGif = $state('');

	let replyFileInput = $state(null);
	let attachedReplyImage = $state('');
	let uploadingReplyImage = $state(false);

	let isEditing = $state(false);
	let parsedData = $derived(() => {
		let text = comment.body || '';
		let mediaUrl = '';
		let isGif = false;

		const gifMatch = text.match(/\[GIF\](.*)$/);
		if (gifMatch) {
			mediaUrl = getProxiedMediaUrl(gifMatch[1]);
			text = text.replace(gifMatch[0], '');
			isGif = true;
		} else {
			const imgMatch = text.match(/\[IMG\](.*)$/);
			if (imgMatch) {
				mediaUrl = getProxiedMediaUrl(imgMatch[1]);
				text = text.replace(imgMatch[0], '');
			}
		}
		return { text, mediaUrl, isGif };
	});
	// svelte-ignore state_referenced_locally
	let editText = $state(parsedData().text);
	let submittingEdit = $state(false);

	// svelte-ignore state_referenced_locally
	let liked = $state(comment.user_has_liked || false);
	// svelte-ignore state_referenced_locally
	let likeCount = $state(comment.like_count || 0);
	let isAnimatingLike = $state(false);
	let isAnimatingUnlike = $state(false);
	let likeParticles = $state([]);
	let animLikeTimeout = null;

	$effect(() => {
		editText = parsedData().text;
		liked = comment.user_has_liked || false;
		likeCount = comment.like_count || 0;
	});

	let showMenu = $state(false);

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
		if (!authStore.isAuthenticated) return;
		const prev = liked;
		liked = !liked;
		likeCount += liked ? 1 : -1;

		if (animLikeTimeout) clearTimeout(animLikeTimeout);

		if (liked) {
			isAnimatingLike = true;
			isAnimatingUnlike = false;
			likeParticles = generateLikeSparkles(7, 16);
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
			if (liked) await postsApi.comments.like(postId, comment.id);
			else await postsApi.comments.unlike(postId, comment.id);
		} catch {
			liked = prev;
			likeCount += liked ? 1 : -1;
		}
	}

	async function submitReply() {
		if ((!replyText.trim() && !attachedReplyGif && !attachedReplyImage) || submittingReply) return;
		if (isAnonContext) {
			const ident = await ensureAnonIdentity();
			if (!ident) {
				showAnonIdentityModal = true;
				return;
			}
		}
		submittingReply = true;
		try {
			let finalBody = replyText.trim();
			if (attachedReplyGif) {
				finalBody += `\n[GIF]${attachedReplyGif}`;
			}
			if (attachedReplyImage) {
				finalBody += `\n[IMG]${attachedReplyImage}`;
			}
			await postsApi.comments.create(postId, { body: finalBody, parent_id: comment.id });
			replyText = '';
			attachedReplyGif = '';
			attachedReplyImage = '';
			showReplyInput = false;
			onReload();
		} catch (err) {
			if (err?.code === 'ANON_IDENTITY_REQUIRED' || err?.message?.includes('identidad anónima')) {
				showAnonIdentityModal = true;
			} else {
				console.error('Error posting reply:', err);
			}
		} finally {
			submittingReply = false;
		}
	}

	async function handleReplyImageSelect(e) {
		const file = e.target.files[0];
		if (!file) return;

		uploadingReplyImage = true;
		try {
			const compressedFile = await compressImage(file);
			const fd = new FormData();
			fd.append('media', compressedFile);
			const res = await postsApi.uploadMedia(fd);
			attachedReplyImage = res.media?.[0]?.url || res.url;
		} catch (err) {
			console.error('Error uploading reply image:', err);
			alert('Error al subir la imagen');
		} finally {
			uploadingReplyImage = false;
			if (replyFileInput) replyFileInput.value = '';
		}
	}

	async function submitEdit() {
		if (!editText.trim() || submittingEdit) return;
		submittingEdit = true;
		try {
			await postsApi.comments.update(postId, comment.id, { body: editText.trim() });
			isEditing = false;
			onReload?.();
		} catch (err) {
			console.error('Error editing comment:', err);
		} finally {
			submittingEdit = false;
		}
	}

	async function handleDelete() {
		try {
			await postsApi.comments.delete(postId, comment.id);
			onReload?.();
		} catch (err) {
			console.error('Error deleting comment:', err);
		}
	}
</script>

<div
	class="comment-item-container"
	class:is-anon-comment={isAnonContext}
	class:is-reply={comment.parent_id || depth > 0}
	id="comment-{comment.id}"
>
	<div class="comment-item">
		{#if comment.is_anonymous}
			<div class="comment-avatar-link comment-anon-avatar" title="Identidad oculta">
				<span class="material-icons-round" style="font-size:15px">visibility_off</span>
			</div>
		{:else}
			<a href="/u/{comment.username}" class="comment-avatar-link">
				<AeroAvatar
					src={comment.avatar_url}
					alt={comment.username}
					size="sm"
					showPresence={false}
				/>
			</a>
		{/if}

		<div class="comment-body">
			<div class="comment-header">
				{#if comment.is_anonymous}
					<span class="comment-author comment-anon-author"
						>{comment.display_name === 'Usuario Anónimo'
							? 'Usuario Anónimo'
							: `@${comment.display_name}`}</span
					>
					<span class="comment-anon-badge">
						<span class="material-icons-round" style="font-size:12px">theater_comedy</span>
						Anónimo
					</span>
				{:else}
					<a href="/u/{comment.username}" class="comment-author"
						>{comment.display_name || comment.username}</a
					>
					<VerifiedBadge role={comment.role} isVerified={comment.is_verified == 1} size="14px" />
				{/if}
				<span class="comment-time">{relativeTime(comment.created_at)}</span>

				{#if comment.is_owner || (comment.user_id && Number(comment.user_id) === Number(authStore.user?.id))}
					<div class="options-wrapper" style="position: relative; margin-left: auto;">
						<button class="menu-btn" onclick={() => (showMenu = !showMenu)}>
							<span class="material-icons-round text-[18px]">more_vert</span>
						</button>
						{#if showMenu}
							<div class="dropdown-menu">
								<button
									onclick={() => {
										isEditing = true;
										showMenu = false;
									}}
									class="dropdown-item"
								>
									<span class="material-icons-round text-[14px]">edit</span> Editar
								</button>
								<button
									onclick={() => {
										handleDelete();
										showMenu = false;
									}}
									class="dropdown-item danger"
								>
									<span class="material-icons-round text-[14px]">delete</span> Eliminar
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			{#if isEditing}
				<div class="edit-mode mt-1">
					<div class="edit-mode-header">
						<span class="material-icons-round edit-mode-icon">edit</span>
						<span class="edit-mode-label">Editando comentario</span>
					</div>
					<textarea
						id="edit_comment_{comment.id}"
						name="edit_comment_{comment.id}"
						bind:value={editText}
						onkeydown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								submitEdit();
							}
						}}
						class="edit-textarea"
						rows="2"
					></textarea>
					<div class="edit-actions">
						<button
							onclick={() => {
								isEditing = false;
								editText = comment.body;
							}}
							class="edit-cancel-btn">Cancelar</button
						>
						<button
							onclick={submitEdit}
							disabled={submittingEdit || !editText.trim()}
							class="edit-save-btn"
						>
							{#if submittingEdit}
								<span class="mini-spinner"></span>
							{:else}
								<span class="material-icons-round" style="font-size:14px">check</span>
							{/if}
							Guardar
						</button>
					</div>
				</div>
			{:else}
				<p class="comment-text">{@html formatHashtags(parsedData().text)}</p>
				{#if parsedData().mediaUrl}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="comment-gif-wrapper is-clickable"
						onclick={() =>
							mediaViewer.openImage(
								parsedData().mediaUrl,
								parsedData().isGif ? 'GIF' : 'Imagen adjunta'
							)}
						title="Ver imagen completa"
					>
						<img
							src={getProxiedMediaUrl(parsedData().mediaUrl)}
							alt={parsedData().isGif ? 'GIF' : 'Adjunto'}
							class="comment-gif {parsedData().isGif ? '' : 'object-cover'}"
							loading="lazy"
							decoding="async"
							crossorigin="anonymous"
							referrerpolicy="no-referrer"
						/>
					</div>
				{/if}
			{/if}

			<div class="comment-actions">
				<div class="flex items-center gap-3">
					<div class="like-btn-wrapper">
						<button
							class="like-btn flex items-center gap-1.5"
							class:liked
							onclick={toggleLike}
							aria-label="{liked ? 'Quitar me gusta' : 'Dar me gusta'}{likeCount > 0
								? ' ' + likeCount
								: ''}"
						>
							<div class="like-icon-wrap" style="width: 16px; height: 16px;">
								{#if isAnimatingLike}
									<span class="like-ring" style="width: 12px; height: 12px;"></span>
									<span class="like-ring-glow" style="width: 22px; height: 22px;"></span>
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
									class="material-icons-round like-icon"
									class:liked-icon={liked}
									class:heart-pop={isAnimatingLike}
									class:heart-unpop={isAnimatingUnlike}
									style="font-size:15px">{liked ? 'favorite' : 'favorite_border'}</span
								>
							</div>
							<span
								class="like-count font-medium"
								class:liked-count={liked}
								class:count-bump={isAnimatingLike}
								>{#if likeCount > 0}{likeCount}{/if}</span
							>
						</button>
					</div>
					<button class="reply-btn ml-2" onclick={() => (showReplyInput = !showReplyInput)}>
						Responder
					</button>
				</div>
			</div>
		</div>
	</div>

	{#if showReplyInput}
		<div class="reply-composer-wrap" transition:slide={{ duration: 280, easing: expoOut }}>
			<div class="reply-composer-card" class:is-anon={isAnonContext}>
				<!-- Top Bar: Identity info + Close button -->
				<div class="reply-composer-header">
					<div class="reply-identity-info">
						{#if isAnonContext}
							<span class="material-icons-round text-sm" style="color: var(--anon-accent, #818cf8);"
								>visibility_off</span
							>
							<span class="text-xs text-muted">Respondiendo como</span>
							{#if myAnonUsername}
								<span class="anon-handle-tag">@{myAnonUsername}</span>
							{:else}
								<button
									type="button"
									class="anon-create-tag-btn"
									onclick={() => (showAnonIdentityModal = true)}
								>
									+ Crear @Nombre
								</button>
							{/if}
						{:else}
							<span class="text-xs text-muted"
								>Respondiendo a <strong class="text-main">@{comment.username || 'usuario'}</strong
								></span
							>
						{/if}
					</div>
					<button
						type="button"
						class="reply-composer-close"
						onclick={() => {
							showReplyInput = false;
							replyText = '';
							attachedReplyGif = '';
							attachedReplyImage = '';
							showReplyGifs = false;
							showReplyEmojis = false;
							showReplyMedia = false;
						}}
						title="Cancelar respuesta"
					>
						<span class="material-icons-round" style="font-size: 16px;">close</span>
					</button>
				</div>

				<!-- Attached Previews -->
				{#if attachedReplyGif || attachedReplyImage}
					<div class="flex items-center gap-2 mb-2 px-1">
						{#if attachedReplyGif}
							<div
								class="flex items-center gap-2 p-1.5 pr-3 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-xl text-xs font-bold text-fuchsia-400 w-fit shadow-md"
							>
								<img
									src={getProxiedMediaUrl(attachedReplyGif)}
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
									onclick={() => (attachedReplyGif = '')}
								>
									<span class="material-icons-round text-[14px]">close</span>
								</button>
							</div>
						{/if}

						{#if attachedReplyImage}
							<div
								class="flex items-center gap-2 p-1.5 pr-3 bg-slate-800/80 border border-white/10 rounded-xl shadow-md w-fit backdrop-blur-md"
							>
								<img
									src={attachedReplyImage}
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
									onclick={() => (attachedReplyImage = '')}
								>
									<span class="material-icons-round text-[14px]">close</span>
								</button>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Input row with Avatar + Textarea + Action Tools -->
				<div class="reply-input-row">
					{#if isAnonContext}
						<div
							class="comment-anon-avatar mini shrink-0"
							title="Identidad anónima"
							style="flex: 0 0 28px; min-width: 28px; min-height: 28px;"
						>
							<span class="material-icons-round" style="font-size:14px">visibility_off</span>
						</div>
					{:else}
						<AeroAvatar
							src={authStore.user?.avatar_url}
							alt={authStore.user?.username || 'U'}
							size="xs"
							showPresence={false}
							className="flex-shrink-0"
						/>
					{/if}

					<div class="reply-field-wrapper">
						<HashtagTextarea
							bind:value={replyText}
							onkeydown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									submitReply();
								}
							}}
							placeholder={isAnonContext
								? 'Escribe tu respuesta anónima...'
								: 'Escribe tu respuesta...'}
							class="aero-textarea pr-[140px]"
							style="--hashtag-padding: 9px 140px 9px 12px; --hashtag-font-size: 0.84rem; --hashtag-line-height: 1.4;"
							rows={1}
						/>

						<div class="reply-actions-cluster">
							<button
								type="button"
								class="reply-tool-btn"
								onclick={() => {
									showReplyGifs = !showReplyGifs;
									showReplyEmojis = false;
									showReplyMedia = false;
								}}
								title="GIFs"
							>
								<span class="material-icons-round" style="font-size: 20px;">gif_box</span>
							</button>

							<button
								type="button"
								class="reply-tool-btn"
								onclick={() => {
									showReplyEmojis = !showReplyEmojis;
									showReplyGifs = false;
									showReplyMedia = false;
								}}
								title="Emojis"
							>
								<span class="material-icons-round" style="font-size: 18px;">mood</span>
							</button>

							<button
								type="button"
								class="reply-tool-btn"
								onclick={() => {
									showReplyMedia = !showReplyMedia;
									showReplyGifs = false;
									showReplyEmojis = false;
								}}
								disabled={uploadingReplyImage}
								title="Foto"
							>
								{#if uploadingReplyImage}
									<span class="material-icons-round animate-spin" style="font-size: 18px;"
										>autorenew</span
									>
								{:else}
									<span class="material-icons-round" style="font-size: 18px;"
										>add_photo_alternate</span
									>
								{/if}
							</button>

							<button
								type="button"
								class="reply-send-btn"
								disabled={(!replyText.trim() && !attachedReplyGif && !attachedReplyImage) ||
									submittingReply}
								onclick={submitReply}
								title="Enviar respuesta"
							>
								<span class="material-icons-round" style="font-size: 16px;">send</span>
							</button>
						</div>
						<input
							type="file"
							bind:this={replyFileInput}
							accept="image/*,video/*"
							style="display: none;"
							onchange={handleReplyImageSelect}
						/>
					</div>
				</div>

				<!-- Expandable media/emoji panels -->
				{#if showReplyMedia}
					<div transition:slide={{ duration: 300, easing: expoOut }} class="mt-2">
						<div class="post-nested-panel p-3">
							<div
								role="button"
								tabindex="0"
								class="media-dropzone py-4"
								onclick={() => replyFileInput.click()}
								onkeydown={(e) => e.key === 'Enter' && replyFileInput.click()}
								ondragover={(e) => e.preventDefault()}
								ondrop={(e) => {
									e.preventDefault();
									if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
										replyFileInput.files = e.dataTransfer.files;
										handleReplyImageSelect({ target: replyFileInput });
										showReplyMedia = false;
									}
								}}
							>
								<div class="dropzone-icon" style="width: 36px; height: 36px;">
									<span
										class="material-icons-round"
										style="color: rgba(34,211,238,0.8); font-size: 20px;">cloud_upload</span
									>
								</div>
								<p class="dropzone-text" style="font-size: 0.75rem;">
									Arrastra o selecciona imagen/video
								</p>
							</div>
						</div>
					</div>
				{/if}

				{#if showReplyEmojis}
					<div transition:slide={{ duration: 300, easing: expoOut }} class="mt-2">
						<div class="post-nested-panel p-2 flex justify-center">
							<TwemojiPicker
								variant="inline"
								onSelect={(emoji) => {
									replyText += emoji;
								}}
								onClose={() => (showReplyEmojis = false)}
							/>
						</div>
					</div>
				{/if}

				{#if showReplyGifs}
					<div transition:slide={{ duration: 300, easing: expoOut }} class="mt-2">
						<div class="post-nested-panel p-2 flex justify-center">
							<KlipyPicker
								onClose={() => (showReplyGifs = false)}
								onSelect={(url, _gif) => {
									attachedReplyGif = url;
									showReplyGifs = false;
								}}
							/>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if comment.replies && comment.replies.length > 0}
		<div
			class="replies-container"
			style="margin-left: {depth === 0 ? '36px' : '0px'}; padding-left: {depth === 0
				? '12px'
				: '0px'}; border-left: {depth === 0 ? '2px solid var(--border-glass)' : 'none'};"
		>
			{#each comment.replies as reply}
				<!-- Recursive call for nested comments -->
				<CommentItem
					comment={reply}
					{postId}
					postIsAnonymous={isAnonContext}
					{onReload}
					depth={depth + 1}
				/>
			{/each}
		</div>
	{/if}

	<AnonIdentityModal
		open={showAnonIdentityModal}
		onClose={() => {
			showAnonIdentityModal = false;
		}}
		onCreated={(username) => {
			myAnonUsername = username;
			anonIdentityLoaded = true;
			showAnonIdentityModal = false;
			submitReply();
		}}
	/>
</div>

<style>
	/* ── Container ── */
	.comment-item-container {
		margin-bottom: 14px;
		position: relative;
	}
	.comment-item-container.is-reply {
		margin-top: 6px;
		margin-bottom: 6px;
	}

	/* ── Layout: Avatar + Body ── */
	.comment-item {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}

	/* ── Avatar ── */
	.comment-avatar-link {
		flex-shrink: 0;
		display: block;
		text-decoration: none;
		line-height: 0;
	}

	/* Avatar + identidad anónima (comentarios en posts anónimos) */
	.comment-anon-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(34, 211, 238, 0.22))
		);
		border: 1px solid var(--anon-border, rgba(129, 140, 248, 0.45));
		color: var(--anon-accent, #818cf8);
		box-shadow: 0 0 10px rgba(99, 102, 241, 0.25);
	}
	.comment-anon-author {
		color: var(--anon-text, #4338ca);
		cursor: default;
	}
	.comment-anon-author:hover {
		color: var(--anon-text, #4338ca);
		text-decoration: none;
	}
	.comment-anon-badge {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 1px 7px;
		border-radius: var(--radius-full);
		background: var(--anon-bg, rgba(99, 102, 241, 0.14));
		border: 1px solid var(--anon-border, rgba(129, 140, 248, 0.35));
		color: var(--anon-text, #4338ca);
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	/* ── Body Bubble ── */
	.comment-body {
		flex: 1;
		min-width: 0;
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		border-top-color: var(--glass-border-t);
		padding: 12px 16px;
		border-radius: var(--radius-md);
		border-top-left-radius: 6px;
		box-shadow: var(--shadow-xs), var(--glass-inset-highlight);
		transition: all 0.2s ease;
	}

	.post-nested-panel {
		background: var(--bg-surface-hover, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
	}

	/* ── Header: Author + Time ── */
	.comment-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}
	.comment-author {
		font-weight: 700;
		font-size: 0.82rem;
		color: var(--text-primary);
		text-decoration: none;
		transition: color 0.15s ease;
	}
	.comment-author:hover {
		color: var(--aero-blue);
		text-decoration: underline;
	}
	.comment-time {
		font-size: 0.68rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	/* ── Text ── */
	.comment-text {
		font-size: 0.88rem;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* ── Actions Row ── */
	.comment-actions {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
		font-size: 0.75rem;
	}

	/* ── Like button ── */
	.like-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 3px 8px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 600;
		transition: all 0.15s ease;
	}
	.like-btn:hover {
		background: rgba(236, 72, 153, 0.08);
		color: var(--aero-rose);
	}
	.like-btn:active {
		transform: scale(0.92);
	}
	.like-icon {
		font-size: 16px;
		transition: color 0.15s ease;
	}
	.liked-icon {
		color: var(--aero-rose, #ec4899);
	}
	.liked-count {
		color: var(--aero-rose, #ec4899);
	}

	/* ── Reply button ── */
	.reply-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 3px 8px;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 700;
		transition: all 0.15s ease;
	}
	.reply-btn:hover {
		background: rgba(74, 171, 223, 0.08);
		color: var(--aero-blue);
	}
	.reply-btn:active {
		transform: scale(0.95);
	}

	/* ── Dropdown Menu ── */
	.dropdown-menu {
		position: absolute;
		right: 0;
		top: 100%;
		margin-top: 6px;
		min-width: 140px;
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--border-glass);
		border-radius: var(--radius-sm);
		overflow: hidden;
		z-index: var(--z-dropdown);
		box-shadow: var(--shadow-lg);
		animation: menuSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}
	@keyframes menuSlideIn {
		from {
			opacity: 0;
			transform: translateY(-8px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	.dropdown-item {
		width: 100%;
		text-align: left;
		padding: 10px 14px;
		background: transparent;
		border: none;
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.8rem;
		font-weight: 500;
	}
	.dropdown-item:hover {
		background: rgba(74, 171, 223, 0.1);
		color: var(--aero-blue);
	}
	.dropdown-item.danger {
		color: var(--aero-rose);
	}
	.dropdown-item.danger:hover {
		background: rgba(232, 74, 114, 0.1);
	}

	/* ── Menu button ── */
	.menu-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}
	.menu-btn:hover {
		background: var(--bg-overlay);
		color: var(--text-primary);
	}
	.menu-btn:active {
		transform: scale(0.92);
	}

	/* ── Replies Threading ── */
	.replies-container {
		margin-top: 10px;
		margin-left: 46px;
		padding-left: 14px;
		border-left: 2px solid var(--border-glass);
		position: relative;
		overflow: visible !important;
		height: auto !important;
		max-height: none !important;
	}
	.replies-container::before {
		content: '';
		position: absolute;
		top: 0;
		left: -2px;
		width: 2px;
		height: 100%;
		background: linear-gradient(to bottom, var(--aero-blue) 0%, transparent 100%);
		opacity: 0.4;
	}
	/* Smaller avatars for nested replies */
	.replies-container :global(.comment-avatar-img),
	.replies-container :global(.comment-avatar-fallback) {
		width: 28px;
		height: 28px;
		min-width: 28px;
		font-size: 0.7rem;
	}

	/* ── Edit Mode ── */
	.edit-mode {
		background: rgba(74, 171, 223, 0.06);
		border: 1px solid rgba(74, 171, 223, 0.2);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
		animation: slideDown 0.25s ease;
	}
	.edit-mode-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
	}
	.edit-mode-icon {
		font-size: 14px;
		color: var(--aero-blue);
	}
	.edit-mode-label {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--aero-blue);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.edit-textarea {
		width: 100%;
		background: var(--bg-surface);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-sm);
		padding: 8px 10px;
		font-family: inherit;
		font-size: 0.85rem;
		color: var(--text-primary);
		resize: none;
		outline: none;
		line-height: 1.4;
	}
	.edit-textarea:focus {
		border-color: var(--aero-sky);
		box-shadow: 0 0 0 2px rgba(74, 171, 223, 0.15);
	}
	.edit-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 8px;
	}
	.edit-cancel-btn {
		background: transparent;
		border: 1px solid var(--border-subtle);
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 600;
		padding: 4px 12px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.2s;
	}
	.edit-cancel-btn:hover {
		background: var(--bg-overlay);
		color: var(--text-primary);
	}
	.edit-save-btn {
		background: var(--grad-primary);
		border: none;
		color: #fff;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 4px 14px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 4px;
		transition: all 0.2s;
		box-shadow: 0 2px 8px rgba(46, 134, 232, 0.3);
	}
	.edit-save-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(46, 134, 232, 0.4);
	}
	.edit-save-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.mini-spinner {
		display: inline-block;
		width: 12px;
		height: 12px;
		position: relative;
		background: rgba(255, 255, 255, 0.2);
		border-radius: var(--radius-squircle);
		animation: squircle-pulse 1.2s var(--ease-spring) infinite alternate;
	}
	.mini-spinner::after {
		content: '';
		position: absolute;
		inset: 1px;
		border-radius: inherit;
		background: #fff;
		opacity: 0.8;
		filter: blur(1px);
		animation: squircle-glow 1.2s var(--ease-spring) infinite alternate;
	}
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.liked-icon {
		filter: drop-shadow(0 0 5px rgba(236, 72, 153, 0.5));
	}

	.comment-gif-wrapper {
		margin-top: 12px;
		margin-bottom: 8px;
		border-radius: var(--radius-md);
		overflow: hidden;
		max-width: 100%;
		width: fit-content;
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		background: rgba(0, 0, 0, 0.15);
		transition:
			filter 0.2s ease,
			border-color 0.2s ease;
	}

	.comment-gif-wrapper.is-clickable {
		cursor: pointer;
	}

	.comment-gif-wrapper.is-clickable:hover {
		filter: brightness(1.05);
		border-color: rgba(27, 133, 243, 0.4);
	}

	.comment-gif {
		display: block;
		max-width: 100%;
		max-height: 260px;
		width: auto;
		height: auto;
		border-radius: var(--radius-md);
	}

	.comment-gif.object-cover {
		object-fit: cover;
		width: 100%;
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

	/* ── Anonymous Comment Theming ── */
	.comment-item-container.is-anon-comment .comment-body {
		background: var(--bg-surface);
		border: 1px solid var(--anon-border, rgba(129, 140, 248, 0.25));
		border-top: 1px solid var(--anon-border-active, rgba(168, 85, 247, 0.45));
		box-shadow:
			var(--shadow-xs),
			0 2px 10px rgba(99, 102, 241, 0.06);
	}
	.comment-item-container.is-anon-comment .replies-container {
		border-left: 2px solid var(--anon-border, rgba(129, 140, 248, 0.35));
	}
	.comment-item-container.is-anon-comment .replies-container::before {
		background: linear-gradient(to bottom, var(--anon-accent, #818cf8) 0%, transparent 100%);
	}
	.comment-item-container.is-anon-comment .reply-btn:hover {
		background: var(--anon-bg, rgba(99, 102, 241, 0.12));
		color: var(--anon-accent, #818cf8);
	}
	.comment-item-container.is-anon-comment .like-btn:hover {
		background: var(--anon-bg, rgba(99, 102, 241, 0.12));
		color: var(--anon-accent, #818cf8);
	}
	.comment-item-container.is-anon-comment .dropdown-item:hover {
		background: var(--anon-bg, rgba(99, 102, 241, 0.12));
		color: var(--anon-accent, #818cf8);
	}

	/* ── Modern Reply Composer ── */
	.reply-composer-wrap {
		margin-left: 44px;
		margin-top: 8px;
		margin-bottom: 12px;
	}
	@media (max-width: 640px) {
		.reply-composer-wrap {
			margin-left: 16px;
		}
	}
	.reply-composer-card {
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-top-color: var(--glass-border-t);
		border-radius: var(--radius-md);
		padding: 10px 12px;
		box-shadow: var(--shadow-xs), var(--glass-inset-highlight);
		transition: border-color var(--t-fast);
	}
	.reply-composer-card.is-anon {
		border-color: var(--anon-border, rgba(129, 140, 248, 0.3));
		border-top-color: var(--anon-border-active, rgba(168, 85, 247, 0.5));
		box-shadow:
			var(--shadow-xs),
			0 2px 12px rgba(99, 102, 241, 0.08);
	}
	.reply-composer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--border-subtle);
	}
	.reply-identity-info {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
	}
	.anon-handle-tag {
		font-weight: 700;
		color: var(--anon-accent, #818cf8);
		background: var(--anon-bg, rgba(99, 102, 241, 0.12));
		padding: 2px 8px;
		border-radius: var(--radius-full);
		border: 1px solid var(--anon-border, rgba(129, 140, 248, 0.3));
	}
	.anon-create-tag-btn {
		font-weight: 700;
		font-size: 0.72rem;
		color: var(--anon-accent, #818cf8);
		background: var(--anon-bg, rgba(99, 102, 241, 0.12));
		padding: 2px 8px;
		border-radius: var(--radius-full);
		border: 1px dashed var(--anon-border, rgba(129, 140, 248, 0.5));
		cursor: pointer;
		transition: background var(--t-fast);
	}
	.anon-create-tag-btn:hover {
		background: var(--anon-bg, rgba(99, 102, 241, 0.2));
	}
	.reply-composer-close {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 3px;
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--t-fast);
	}
	.reply-composer-close:hover {
		background: var(--bg-overlay);
		color: var(--text-primary);
	}
	.reply-input-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.comment-anon-avatar.mini {
		width: 28px;
		height: 28px;
		min-width: 28px;
		min-height: 28px;
		font-size: 13px;
	}
	.reply-field-wrapper {
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
		min-height: 40px;
		background: var(--bg-input-tint);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-xs), var(--glass-inset-highlight);
		transition:
			border-color var(--t-fast),
			box-shadow var(--t-fast);
	}
	.reply-field-wrapper:focus-within {
		border-color: var(--aero-sky);
		box-shadow:
			0 0 0 3px rgba(46, 134, 232, 0.12),
			var(--shadow-xs);
	}
	.reply-composer-card.is-anon .reply-field-wrapper:focus-within {
		border-color: var(--anon-accent, #818cf8);
		box-shadow:
			0 0 0 3px var(--anon-bg, rgba(99, 102, 241, 0.15)),
			0 0 14px rgba(99, 102, 241, 0.2);
	}
	.reply-actions-cluster {
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		gap: 2px;
		z-index: 5;
	}
	.reply-tool-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-squircle);
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--t-fast);
	}
	.reply-tool-btn:hover {
		background: var(--bg-surface);
		color: var(--text-primary);
	}
	.reply-composer-card.is-anon .reply-tool-btn:hover {
		color: var(--anon-accent, #818cf8);
	}
	.reply-send-btn {
		width: 30px;
		height: 30px;
		border-radius: var(--radius-squircle);
		background: linear-gradient(135deg, var(--aero-sky), var(--aero-blue));
		color: #fff;
		border: none;
		box-shadow: 0 2px 8px rgba(var(--accent-blue-rgb), 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--t-fast) var(--ease-spring);
	}
	.reply-composer-card.is-anon .reply-send-btn {
		background: var(--anon-gradient, linear-gradient(135deg, #6366f1, #a855f7));
		border: 1px solid var(--anon-border-active, rgba(168, 85, 247, 0.7));
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
	}
	.reply-send-btn:not(:disabled):hover {
		transform: scale(1.1);
		box-shadow: 0 4px 14px rgba(var(--accent-blue-rgb), 0.4);
	}
	.reply-composer-card.is-anon .reply-send-btn:not(:disabled):hover {
		box-shadow: 0 4px 14px rgba(99, 102, 241, 0.45);
	}
	.reply-send-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		background: var(--bg-overlay);
		color: var(--text-muted);
		box-shadow: none;
	}
</style>
