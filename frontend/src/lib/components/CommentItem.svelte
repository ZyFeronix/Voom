<script>
  import { authStore } from '$lib/stores/auth.svelte.js';
  import { posts as postsApi } from '$lib/api.js';
  import CommentItem from './CommentItem.svelte';
  import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
  import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
  import KlipyPicker from '$lib/components/KlipyPicker.svelte';
  import { slide, fade } from 'svelte/transition';
  import { compressImage } from '$lib/utils/imageCompression.js';
  import { formatHashtags } from '$lib/utils/textFormatting.js';
  import HashtagTextarea from '$lib/components/HashtagTextarea.svelte';

  let { comment, postId, onReload, depth = 0 } = $props();

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
			mediaUrl = gifMatch[1];
			text = text.replace(gifMatch[0], '');
			isGif = true;
		} else {
			const imgMatch = text.match(/\[IMG\](.*)$/);
			if (imgMatch) {
				mediaUrl = imgMatch[1];
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
  let likeAnim = $state(false);
  let likeParticles = $state([]);

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
    if (liked) {
      likeAnim = true;
      likeParticles = Array.from({ length: 5 }, (_, i) => ({
        id: Date.now() + i,
        angle: (i * 72) + Math.random() * 30,
        distance: 15 + Math.random() * 10,
        delay: i * 30
      }));
      setTimeout(() => { likeAnim = false; likeParticles = []; }, 500);
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
      console.error('Error posting reply:', err);
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
      console.error("Error uploading reply image:", err);
      alert("Error al subir la imagen");
    } finally {
      uploadingReplyImage = false;
      if (replyFileInput) replyFileInput.value = '';
    }
  }

  function handleReplyKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitReply();
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

<div class="comment-item-container" class:is-reply={comment.parent_id} id="comment-{comment.id}">
  <div class="comment-item">
    <a href="/u/{comment.username}" class="comment-avatar-link">
      {#if comment.avatar_url}
        <img src={comment.avatar_url} alt="" class="comment-avatar-img" />
      {:else}
        <div class="comment-avatar-fallback">{(comment.display_name || comment.username || '?')[0].toUpperCase()}</div>
      {/if}
    </a>
    
    <div class="comment-body">
      <div class="comment-header">
        <a href="/u/{comment.username}" class="comment-author">{comment.display_name || comment.username}</a>
        <VerifiedBadge role={comment.role} isVerified={comment.is_verified == 1} size="14px" />
        <span class="comment-time">{relativeTime(comment.created_at)}</span>
        
        {#if comment.user_id === authStore.user?.id}
          <div class="options-wrapper" style="position: relative; margin-left: auto;">
            <button class="menu-btn" onclick={() => showMenu = !showMenu}>
              <span class="material-icons-round text-[18px]">more_vert</span>
            </button>
            {#if showMenu}
              <div class="dropdown-menu">
                <button onclick={() => { isEditing = true; showMenu = false; }} class="dropdown-item">
                  <span class="material-icons-round text-[14px]">edit</span> Editar
                </button>
                <button onclick={() => { handleDelete(); showMenu = false; }} class="dropdown-item danger">
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
          <textarea id="edit_comment_{comment.id}" name="edit_comment_{comment.id}" bind:value={editText} onkeydown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); } }} class="edit-textarea" rows="2"></textarea>
          <div class="edit-actions">
            <button onclick={() => { isEditing = false; editText = comment.body; }} class="edit-cancel-btn">Cancelar</button>
            <button onclick={submitEdit} disabled={submittingEdit || !editText.trim()} class="edit-save-btn">
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
          <div class="comment-gif-wrapper">
            <img src={parsedData().mediaUrl} alt={parsedData().isGif ? 'GIF' : 'Adjunto'} class="comment-gif {parsedData().isGif ? '' : 'object-cover'}" loading="lazy" />
          </div>
        {/if}
      {/if}

      <div class="comment-actions">
        <div class="flex items-center gap-3">
          <div class="like-btn-wrapper">
            <button class="like-btn flex items-center gap-1.5" onclick={toggleLike}>
              <span class="material-icons-round like-icon {likeAnim ? 'heart-pop' : ''}" class:liked-icon={liked} style="font-size:15px">{liked ? 'favorite' : 'favorite_border'}</span>
              <span class="like-count font-medium" class:liked-count={liked}>{#if likeCount > 0}{likeCount}{/if}</span>
            </button>
            {#each likeParticles as p (p.id)}
              <span
                class="like-particle"
                style="--angle: {p.angle}deg; --dist: {p.distance}px; animation-delay: {p.delay}ms;"
              >♥</span>
            {/each}
          </div>
          <button class="reply-btn ml-2" onclick={() => showReplyInput = !showReplyInput}>Responder</button>
        </div>
      </div>

      {#if showReplyInput}
        <div class="reply-input-wrapper mt-3 relative" transition:fade={{duration: 150}}>
          <div class="flex gap-2">
            {#if authStore.user?.avatar_url}
              <img src={authStore.user.avatar_url} alt="" class="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            {:else}
              <div class="vs-avatar-letter avatar-sm">
                {(authStore.user?.display_name || authStore.user?.username || 'U')[0].toUpperCase()}
              </div>
            {/if}
            <div class="flex-1 flex flex-col gap-2">
              {#if attachedReplyGif || attachedReplyImage}
                <div class="flex items-center gap-2">
                  {#if attachedReplyGif}
                    <div class="flex items-center gap-1.5 p-1.5 pr-3 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-xl text-xs font-bold text-fuchsia-400 w-fit shadow-md">
                      <span class="material-icons-round text-sm">gif_box</span>
                      <span>GIF Adjunto</span>
                      <button class="bg-transparent border-none cursor-pointer text-muted hover:text-white" onclick={() => attachedReplyGif = ''}>
                        <span class="material-icons-round text-[12px]">close</span>
                      </button>
                    </div>
                  {/if}

                  {#if attachedReplyImage}
                    <div class="flex items-center gap-2 p-1.5 pr-3 bg-slate-800/80 border border-white/10 rounded-xl shadow-md w-fit backdrop-blur-md">
                      <img src={attachedReplyImage} alt="Preview" class="w-10 h-10 object-cover rounded-lg" />
                      <span class="text-xs font-medium text-white/80">Imagen Adjunta</span>
                      <button type="button" class="bg-transparent border-none cursor-pointer text-muted hover:text-white" onclick={() => attachedReplyImage = ''}>
                        <span class="material-icons-round text-[14px]">close</span>
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}

              <div class="relative comment-input-wrapper">
                <HashtagTextarea
                  bind:value={replyText}
                  onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
                  placeholder="Añadir una respuesta..."
                  class="aero-textarea pr-[150px]"
                  style="--hashtag-padding: 11px 150px 11px 16px; --hashtag-font-size: 0.88rem; --hashtag-line-height: 1.4;"
                  rows={1}
                />
              
              <button class="comment-gif-btn" onclick={() => {showReplyGifs = !showReplyGifs; showReplyEmojis = false; showReplyMedia = false;}}>
                <span class="material-icons-round text-muted hover:text-fuchsia-400 transition text-[22px]">gif_box</span>
              </button>

              <button class="comment-emoji-btn" onclick={() => {showReplyEmojis = !showReplyEmojis; showReplyGifs = false; showReplyMedia = false;}}>
                <span class="material-icons-round text-muted hover:text-cyan-400 transition text-[20px]">mood</span>
              </button>

              <button
                type="button"
                class="comment-photo-btn"
                onclick={() => {showReplyMedia = !showReplyMedia; showReplyGifs = false; showReplyEmojis = false;}}
                disabled={uploadingReplyImage}
              >
                {#if uploadingReplyImage}
                  <span class="material-icons-round text-cyan-400 animate-spin text-[20px]">autorenew</span>
                {:else}
                  <span class="material-icons-round hover:text-green-400 transition text-[20px]">add_photo_alternate</span>
                {/if}
              </button>
              <input type="file" bind:this={replyFileInput} accept="image/*,video/*" style="display: none;" onchange={handleReplyImageSelect} />

              <button class="comment-submit-btn" disabled={(!replyText.trim() && !attachedReplyGif && !attachedReplyImage) || submittingReply} onclick={submitReply}>
                <span class="material-icons-round">send</span>
              </button>
            </div>

            {#if showReplyMedia}
              <div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
                <div class="glass-panel p-4">
                  <div 
                    role="button" 
                    tabindex="0" 
                    class="media-dropzone"
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
                    <div class="dropzone-icon">
                      <span class="material-icons-round" style="color: rgba(34,211,238,0.8); font-size: 22px;">cloud_upload</span>
                    </div>
                    <p class="dropzone-text">Arrastra imágenes/videos o haz clic</p>
                  </div>
                </div>
              </div>
            {/if}

            {#if showReplyEmojis}
              <div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
                <div class="glass-panel p-4" style="position: relative; display: flex; justify-content: center;">
                  <TwemojiPicker 
                    variant="inline"
                    onSelect={(emoji) => { replyText += emoji; }}
                    onClose={() => showReplyEmojis = false}
                  />
                </div>
              </div>
            {/if}

            {#if showReplyGifs}
              <div transition:slide={{ duration: 400, easing: expoOut }} class="mt-3">
                <div class="glass-panel p-4" style="position: relative; display: flex; justify-content: center;">
                  <KlipyPicker 
                    onClose={() => showReplyGifs = false} 
                    onSelect={(url, gif) => { attachedReplyGif = url; showReplyGifs = false; }} 
                  />
                </div>
              </div>
            {/if}
          </div>
          </div>
          <div class="reply-cancel-row">
            <button onclick={() => { showReplyInput = false; replyText = ''; attachedReplyGif = ''; showReplyGifs = false; showReplyEmojis = false; showReplyMedia = false; }} class="reply-cancel-btn">Cancelar</button>
          </div>

        </div>
      {/if}
    </div>
  </div>

  {#if comment.replies && comment.replies.length > 0}
    <div class="replies-container" style="margin-left: {depth === 0 ? '36px' : '0px'}; padding-left: {depth === 0 ? '12px' : '0px'}; border-left: {depth === 0 ? '2px solid var(--border-glass)' : 'none'};">
      {#each comment.replies as reply}
        <!-- Recursive call for nested comments -->
        <CommentItem comment={reply} {postId} {onReload} depth={depth + 1} />
      {/each}
    </div>
  {/if}
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
  .comment-avatar-img {
    width: 36px;
    height: 36px;
    min-width: 36px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border-glass);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .comment-avatar-link:hover .comment-avatar-img {
    border-color: var(--aero-sky);
    box-shadow: 0 0 0 2px rgba(74, 171, 223, 0.2);
  }
  .comment-avatar-fallback {
    width: 36px;
    height: 36px;
    min-width: 36px;
    border-radius: 50%;
    background: var(--grad-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 800;
    font-size: 0.9rem;
    border: 2px solid var(--border-glass);
    transition: border-color 0.2s ease;
  }
  .comment-avatar-link:hover .comment-avatar-fallback {
    border-color: var(--aero-sky);
  }

  /* ── Body Bubble ── */
  .comment-body {
    flex: 1;
    min-width: 0;
    background: var(--glass-bg);
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border: 1px solid var(--glass-border);
    border-top-color: var(--glass-border-t);
    padding: 12px 16px;
    border-radius: 18px;
    border-top-left-radius: 6px;
    box-shadow: var(--shadow-xs), var(--glass-inset-highlight);
    transition: all 0.2s ease;
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
    border-radius: 8px;
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
  .liked-icon { color: var(--aero-rose, #ec4899); }
  .liked-count { color: var(--aero-rose, #ec4899); }

  /* ── Reply button ── */
  .reply-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 8px;
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
    background: var(--bg-surface);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border-glass);
    border-radius: 12px;
    overflow: hidden;
    z-index: var(--z-dropdown);
    box-shadow: var(--shadow-lg);
    animation: menuSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes menuSlideIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
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
    border-radius: 50%;
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
    border-radius: 10px;
    padding: 10px 12px;
    animation: slideDown 0.25s ease;
  }
  .edit-mode-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .edit-mode-icon { font-size: 14px; color: var(--aero-blue); }
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
    border-radius: 8px;
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
    border-radius: 8px;
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
    border-radius: 8px;
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
  .edit-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .mini-spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Reply Zone ── */
  .reply-input-wrapper {
    background: var(--bg-input-tint);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    padding: 10px 12px;
    animation: slideDown 0.2s ease;
    box-shadow: var(--shadow-xs);
  }

  .reply-cancel-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 6px;
  }
  .reply-cancel-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 6px;
    transition: color 0.2s;
  }
  .reply-cancel-btn:hover { color: var(--text-primary); }

  /* ── Heart Animation ── */
  .heart-pop {
    animation: heartExplosion 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    transform-origin: center;
  }
  @keyframes heartExplosion {
    0% { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
    20% { transform: scale(1.8) rotate(-15deg); filter: drop-shadow(0 0 12px var(--aero-rose, #ec4899)); color: var(--aero-rose, #ec4899); }
    40% { transform: scale(0.8) rotate(10deg); filter: drop-shadow(0 0 6px var(--aero-rose, #ec4899)); color: var(--aero-rose, #ec4899); }
    60% { transform: scale(1.3) rotate(-5deg); color: var(--aero-rose, #ec4899); }
    80% { transform: scale(1.05); color: var(--aero-coral, #f472b6); }
    100% { transform: scale(1) rotate(0); filter: drop-shadow(0 0 0 transparent); color: var(--aero-rose, #ec4899); }
  }

  .like-btn-wrapper {
    position: relative;
    display: inline-flex;
  }
  .like-particle {
    position: absolute;
    top: 50%;
    left: 50%;
    font-size: 9px;
    color: var(--aero-rose, #ec4899);
    pointer-events: none;
    animation: particleBurst 0.55s ease-out forwards;
    transform-origin: center;
    text-shadow: 0 0 4px rgba(236, 72, 153, 0.5);
  }
  @keyframes particleBurst {
    0% {
      opacity: 1;
      transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) scale(1);
    }
    50% {
      opacity: 0.8;
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) rotate(var(--angle)) translateY(calc(var(--dist) * -1)) scale(0.3);
    }
  }

  /* ── Reply Advanced Input (Aero) ── */
  .comment-input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    background: var(--bg-input-tint);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1.5px solid var(--glass-border);
    border-radius: 22px;
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    box-shadow: var(--shadow-xs), var(--glass-inset-highlight);
  }
  .comment-input-wrapper:focus-within {
    border-color: var(--aero-sky);
    box-shadow: 0 0 0 3px rgba(46, 134, 232, 0.10), var(--shadow-xs);
  }

  .comment-gif-wrapper {
    margin-top: 12px;
    margin-bottom: 8px;
    border-radius: 14px;
    overflow: hidden;
    max-width: 100%;
    width: fit-content;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    background: rgba(0, 0, 0, 0.15);
  }

  .comment-gif {
    display: block;
    max-width: 100%;
    max-height: 260px;
    width: auto;
    height: auto;
    border-radius: 14px;
  }

  .comment-gif.object-cover {
    object-fit: cover;
    width: 100%;
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
    border-radius: 50%;
    cursor: pointer;
    transition: background var(--t-fast);
    color: var(--text-muted);
  }
  .comment-gif-btn:hover { background: var(--bg-surface); }
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
    border-radius: 50%;
    cursor: pointer;
    transition: background var(--t-fast);
    color: var(--text-muted);
  }
  .comment-emoji-btn:hover { background: var(--bg-surface); }

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
    border-radius: 8px;
    cursor: pointer;
    transition: background var(--t-fast);
    color: var(--text-muted);
  }
  .comment-photo-btn:hover { background: var(--bg-surface); }

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
    border-radius: 50%;
    background: rgba(34,211,238,0.1);
    border: 1px solid rgba(34,211,238,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.75rem;
  }
  .dropzone-text {
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(255,255,255,0.5);
    text-align: center;
  }

  .comment-submit-btn {
    position: absolute;
    right: 5px;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--aero-sky), var(--aero-blue));
    color: white;
    border: none;
    box-shadow: 0 3px 10px rgba(27, 133, 243, 0.3);
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
    transform: translateY(-50%) scale(1.1);
    box-shadow: 0 6px 16px rgba(27, 133, 243, 0.4);
  }
  .comment-submit-btn:not(:disabled):active {
    transform: translateY(-50%) scale(0.94);
    box-shadow: 0 2px 6px rgba(27, 133, 243, 0.25);
  }
  .comment-submit-btn:disabled {
    background: var(--bg-overlay);
    color: var(--text-muted);
    box-shadow: none;
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
