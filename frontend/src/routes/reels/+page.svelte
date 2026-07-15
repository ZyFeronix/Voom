<script>
  import { fade, fly } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { onMount, tick } from 'svelte';
  import { reels as reelsApi, activity as activityApi } from '$lib/api.js';
  import { authStore } from '$lib/stores/auth.svelte.js';
  import { goto } from '$app/navigation';

  // ── Runes State ──────────────────────────────────────────────────────────
  let reels = $state([]);
  let loading = $state(true);
  
  // Audio State
  let globalVolume = $state(0.45);
  let showVolumeSlider = $state(false);
  let previousVolume = $state(0.5);

  // Global Error Toast
  let errorMessage = $state('');
  
  // Active reel tracking
  let activeReelIndex = $state(0);
  let activeReelProgress = $state(0);
  
  // Flash Animation State
  let flashAnimIndex = $state(-1);
  let flashAnimIcon = $state('');
  let flashTimeout = null;
  
  // Comments Modal
  let showCommentsModal = $state(false);
  let activeCommentReel = $state(null);
  let commentText = $state('');
  let commentsList = $state([]);
  let loadingComments = $state(false);
  let replyTo = $state(null);
  let commentToDelete = $state(null);

  // Heart Animation
  let floatingHearts = $state([]);
  let heartIdCounter = 0;

  // Svelte 5: use trackReel action instead of bind:this for non-reactive array
  let reelElements = [];
  function trackReel(node, idx) {
    reelElements[idx] = node;
    return {
      update(newIdx) { reelElements[newIdx] = node; },
      destroy() { reelElements[idx] = null; }
    };
  }

  // activeCommentReelId: primitive $state so $derived always has a clean reactive primitive to track.
  // This is more reliable than reading .id off a $state object reference.
  let activeCommentReelId = $state(null);
  let activeReelLive = $derived(
    activeCommentReelId ? (reels.find(r => r.id === activeCommentReelId) ?? null) : null
  );

  // Comment count adjustments: reelId -> delta (+1 per new, -N per delete).
  // Completely decoupled from reels[] mutations — always reactive, never stale.
  let commentCountDeltas = $state({});

  import { page } from '$app/stores';

  onMount(async () => {
    loading = true;
    try {
      let feedData = [];
      const idParam = $page.url.searchParams.get('id');
      
      if (idParam) {
        // Fetch the specific reel first
        const reelData = await reelsApi.get(idParam).catch(() => null);
        if (reelData && reelData.reel) {
          feedData.push(reelData.reel);
        }
      }

      const data = await reelsApi.feed();
      const existingId = idParam ? parseInt(idParam) : null;
      
      // Añadir el resto de reels descartando duplicado si coincide con el solicitado
      feedData = [...feedData, ...data.data.filter(r => r.id !== existingId)];
      reels = feedData;

      if (idParam && typeof window !== 'undefined' && window.location.hash.startsWith('#comment-')) {
        setTimeout(() => { toggleComments(existingId); }, 100);
      }
    } catch (err) {
      console.error('Failed to load reels feed:', err);
      showError('Error al cargar el feed. Intenta de nuevo.');
    } finally {
      loading = false;
    }
  });

  $effect(() => {
    const vol = globalVolume;
    if (typeof document !== 'undefined') {
      document.querySelectorAll('video.main-video').forEach(video => {
        video.volume = vol;
        video.muted = vol === 0;
      });
      document.querySelectorAll('video.backdrop-video').forEach(video => {
        video.volume = 0;
        video.muted = true;
      });
    }
  });

  $effect(() => {
    if (reels.length > 0) {
      const observerOptions = {
        root: document.querySelector('.reel-container'),
        rootMargin: '0px',
        threshold: 0.6
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const mainVideo = entry.target.querySelector('.main-video');
          const backdropVideo = entry.target.querySelector('.backdrop-video');
          const index = Number(entry.target.dataset.index);

          if (entry.isIntersecting) {
            if (activeReelIndex !== index) {
              activeReelIndex = index;
              activeReelProgress = 0;
              
              if (mainVideo) {
                mainVideo.currentTime = 0;
                const playPromise = mainVideo.play();
                if (playPromise !== undefined) playPromise.catch(() => {});
              }
              if (backdropVideo) {
                backdropVideo.currentTime = 0;
                const playPromise = backdropVideo.play();
                if (playPromise !== undefined) playPromise.catch(() => {});
              }

              if (reels[index]) {
                reelsApi.view(reels[index].id).catch(() => {});
              }
            } else {
              // Ensure it plays if already active
              if (mainVideo && mainVideo.paused) mainVideo.play().catch(()=>{});
              if (backdropVideo && backdropVideo.paused) backdropVideo.play().catch(()=>{});
            }
          } else {
            if (mainVideo) mainVideo.pause();
            if (backdropVideo) backdropVideo.pause();
          }
        });
      }, observerOptions);

      setTimeout(() => {
        reelElements.forEach(el => {
          if (el) observer.observe(el);
        });
      }, 50);

      return () => observer.disconnect();
    }
  });

  // Auto-reload comments when the active reel changes while the panel is open
  $effect(() => {
    const idx = activeReelIndex;
    if (!showCommentsModal || reels.length === 0) return;
    const newReel = reels[idx];
    if (!newReel || newReel.id === activeCommentReelId) return;

    // Switch to the new reel's comments without closing the panel
    activeCommentReel = newReel;
    activeCommentReelId = newReel.id;
    loadingComments = true;
    commentsList = [];
    replyTo = null;
    commentText = '';

    reelsApi.comments.list(newReel.id).then(res => {
      commentsList = res.comments || [];
    }).catch(() => {
      commentsList = [];
    }).finally(() => {
      loadingComments = false;
      if (typeof window !== 'undefined' && window.location.hash.startsWith('#comment-')) {
        setTimeout(() => {
          const el = document.getElementById(window.location.hash.substring(1));
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'background-color 0.5s';
            el.style.backgroundColor = 'var(--glass-highlight)';
            setTimeout(() => { el.style.backgroundColor = ''; }, 2000);
          }
        }, 100);
      }
    });
  });

  function showError(msg) {
    errorMessage = msg;
    setTimeout(() => { errorMessage = ''; }, 3000);
  }

  function triggerFlash(index, iconName) {
    flashAnimIndex = index;
    flashAnimIcon = iconName;
    if (flashTimeout) clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => {
      flashAnimIndex = -1;
    }, 600);
  }

  let clickTimeout = null;

  function handleVideoInteraction(e, reel, index) {
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      handleDoubleTapLike(reel, x, y, index);
    } else {
      clickTimeout = setTimeout(() => {
        clickTimeout = null;
        togglePlayPause(index);
      }, 250);
    }
  }

  function togglePlayPause(index) {
    const el = reelElements[index];
    if (!el) return;
    const mainVideo = el.querySelector('.main-video');
    const backdropVideo = el.querySelector('.backdrop-video');
    
    if (mainVideo) {
      if (mainVideo.paused) {
        mainVideo.play();
        backdropVideo?.play();
        triggerFlash(index, 'play_arrow');
      } else {
        mainVideo.pause();
        backdropVideo?.pause();
        triggerFlash(index, 'pause');
      }
    }
  }

  function handleVolumeChange(e) {
    globalVolume = parseFloat(e.target.value);
  }

  function toggleMute() {
    if (globalVolume > 0) {
      previousVolume = globalVolume;
      globalVolume = 0;
    } else {
      globalVolume = previousVolume || 0.5;
    }
  }

  function spawnHeartAnimation(x, y) {
    const id = heartIdCounter++;
    floatingHearts = [...floatingHearts, { id, x, y }];
    setTimeout(() => {
      floatingHearts = floatingHearts.filter(h => h.id !== id);
    }, 1000);
  }

  let viewedReels = new Set();
  function handlePlay(reelId) {
    if (!authStore.isAuthenticated) return;
    if (viewedReels.has(reelId)) return;
    
    viewedReels.add(reelId);
    activityApi.view({ entity_type: 'reel', entity_id: reelId }).catch(() => {});
  }

  async function handleDoubleTapLike(reel, localX, localY, index) {
    if (!authStore.isAuthenticated) { goto('/login'); return; }
    
    spawnHeartAnimation(localX, localY);
    
    if (!reels[index].user_liked) {
      reels[index].user_liked = true;
      reels[index].like_count += 1;
      try { 
        await reelsApi.like(reel.id); 
      } catch (err) { 
        showError(`Error like: ${err.message || 'Desconocido'}`);
        reels[index].user_liked = false;
        reels[index].like_count -= 1;
      }
    }
  }

  async function handleLikeButton(reel, index, e) {
    if (e) e.stopPropagation();
    if (!authStore.isAuthenticated) { goto('/login'); return; }

    const prevLiked = reels[index].user_liked;
    const change = prevLiked ? -1 : 1;
    
    reels[index].user_liked = !prevLiked;
    reels[index].like_count += change;

    try {
      if (prevLiked) await reelsApi.unlike(reel.id);
      else await reelsApi.like(reel.id);
    } catch (err) {
      showError(`Error unlike/like: ${err.message || 'Desconocido'}`);
      reels[index].user_liked = prevLiked;
      reels[index].like_count -= change;
    }
  }

  function handleTimeUpdate(e) {
    const video = e.target;
    if (video.duration) {
      activeReelProgress = (video.currentTime / video.duration) * 100;
    }
  }

  function toggleComments(reelId, e) {
    if (e) e.stopPropagation();
    
    if (showCommentsModal && activeCommentReelId === reelId) {
      closeComments();
      return;
    }

    const reel = reels.find(r => r.id === reelId);
    activeCommentReel = reel;
    activeCommentReelId = reelId;  // primitive ID for clean $derived tracking
    showCommentsModal = true;
    loadingComments = true;
    replyTo = null;
    commentText = '';
    
    reelsApi.comments.list(reelId).then(res => {
      commentsList = res.comments || [];
      // Auto-heal logic
      const actualCount = commentsList.length;
      const dbCount = reel.comment_count ?? 0;
      commentCountDeltas[reelId] = actualCount - dbCount;
    }).catch(err => {
      console.error(err);
      showError(`Error cargar comentarios: ${err.message}`);
      commentsList = [];
    }).finally(() => {
      loadingComments = false;
    });
  }

  function closeComments() {
    showCommentsModal = false;
    activeCommentReelId = null;
    commentText = '';
    replyTo = null;
  }

  function requestDeleteComment(commentId) {
    commentToDelete = commentId;
  }

  function cancelDeleteComment() {
    commentToDelete = null;
  }

  async function deleteComment() {
    if (!commentToDelete) return;
    const commentId = commentToDelete;
    commentToDelete = null;
    try {
      await reelsApi.comments.delete(activeCommentReel.id, commentId);
      
      // Re-fetch comments to ensure exact state matching DB (including cascades)
      const res = await reelsApi.comments.list(activeCommentReel.id);
      commentsList = res.comments || [];
      
      const reelId = activeCommentReel.id;
      const actualCount = commentsList.length;
      commentCountDeltas = { ...commentCountDeltas, [reelId]: actualCount - (activeCommentReel.comment_count ?? 0) };
    } catch (err) {
      showError('Error al eliminar comentario');
    }
  }

  async function handleCommentLike(comment) {
    if (!authStore.isAuthenticated) return goto('/login');
    
    // Svelte 5: Modify the object in the original state array to trigger reactivity
    const originalComment = commentsList.find(c => c.id === comment.id);
    if (!originalComment) return;

    const prevLiked = originalComment.has_liked;
    originalComment.has_liked = !prevLiked;
    originalComment.like_count = (originalComment.like_count || 0) + (prevLiked ? -1 : 1);
    
    try {
      if (prevLiked) {
        await reelsApi.comments.unlike(activeCommentReel.id, originalComment.id);
      } else {
        await reelsApi.comments.like(activeCommentReel.id, originalComment.id);
      }
    } catch (err) {
      originalComment.has_liked = prevLiked;
      originalComment.like_count = (originalComment.like_count || 0) + (prevLiked ? 1 : -1);
      showError('Error al dar like al comentario');
    }
  }

  function initiateReply(comment) {
    const rootId = comment.parent_id ? comment.parent_id : comment.id;
    replyTo = { id: comment.id, root_id: rootId, username: comment.username };
    // Do NOT pre-fill @mention — the "Respondiendo a" banner provides the visual cue.
    // The mention will be injected by the derived state via reply_to_username field.
    commentText = '';
    
    setTimeout(() => {
      const inputEl = document.querySelector('.aero-input');
      if (inputEl) inputEl.focus();
    }, 50);
  }

  async function handleCommentSubmit() {
    if (!commentText.trim()) return;
    if (!authStore.isAuthenticated) return goto('/login');

    const newText = commentText.trim();
    const parentId = replyTo ? replyTo.root_id : null;
    const replyToId = replyTo ? replyTo.id : null;
    
    const payload = { body: newText };
    if (parentId) payload.parent_id = parentId;
    if (replyToId && replyToId !== parentId) payload.reply_to_id = replyToId;
    
    try {
      const res = await reelsApi.comments.create(activeCommentReel.id, payload);
      
      const newComment = {
        id: res.comment_id || Date.now(),
        reel_id: activeCommentReel.id,
        user_id: authStore.user.id,
        body: newText,
        parent_id: parentId,
        reply_to_id: replyToId,
        created_at: new Date().toISOString(),
        username: authStore.user.username,
        avatar_url: authStore.user.avatar_url,
        like_count: 0,
        has_liked: false
      };
      
      commentsList = [...commentsList, newComment];
      
      // Update delta map for icon counter
      const reelId = activeCommentReel.id;
      commentCountDeltas = { ...commentCountDeltas, [reelId]: (commentCountDeltas[reelId] ?? 0) + 1 };
      
      commentText = '';
      replyTo = null;
      
      // Auto-scroll
      setTimeout(() => {
        const area = document.querySelector('.comments-list-area');
        if (area) area.scrollTop = area.scrollHeight;
      }, 100);
      
    } catch (err) {
      showError('Error al publicar comentario');
    }
  }

  function cancelReply() {
    replyTo = null;
    commentText = '';
  }

  function getInitials(name) { return (name || '?')[0].toUpperCase(); }

  let threadedComments = $derived.by(() => {
    // Clone each comment into a node with metadata. Never mutate .body.
    const map = new Map(commentsList.map(c => [c.id, { ...c, reply_to_username: null, replies: [] }]));
    const roots = [];

    commentsList.forEach(c => {
      const current = map.get(c.id);
      if (!current) return;

      if (c.parent_id && map.has(c.parent_id)) {
        if (c.reply_to_id && map.has(c.reply_to_id)) {
          // Sub-reply: attach to the specific comment being replied to (creates depth 2)
          const target = map.get(c.reply_to_id);
          current.reply_to_username = target.username;
          target.replies.push(current);
        } else {
          // Direct reply to root: attach to parent_id (depth 1)
          map.get(c.parent_id).replies.push(current);
        }
      } else {
        roots.push(current);
      }
    });
    return roots;
  });

  function syncBackdrop(e) {
    const mainVideo = e.target;
    const el = reelElements[activeReelIndex];
    if (!el) return;
    const backdropVideo = el.querySelector('.backdrop-video');
    if (backdropVideo && Math.abs(backdropVideo.currentTime - mainVideo.currentTime) > 0.5) {
      backdropVideo.currentTime = mainVideo.currentTime;
    }
  }
</script>

<svelte:head>
  <title>Reels | VSocial</title>
</svelte:head>

<div class="tiktok-master-layout" class:comments-open={showCommentsModal}>
  
  {#if errorMessage}
    <div class="global-error-toast" transition:fly={{y: -20, duration: 300}}>
      <span class="material-icons-round">error</span> {errorMessage}
    </div>
  {/if}

  <div class="top-controls" role="group" onmouseenter={() => showVolumeSlider = true} onmouseleave={() => showVolumeSlider = false}>
    <button onclick={toggleMute} class="aero-btn volume-btn" aria-label={globalVolume === 0 ? 'Activar sonido' : 'Silenciar'}>
      <span class="material-icons-round">{globalVolume === 0 ? 'volume_off' : (globalVolume > 0.5 ? 'volume_up' : 'volume_down')}</span>
    </button>
    {#if showVolumeSlider}
      <div class="volume-slider-container" transition:fade={{duration: 150}}>
        <input type="range" min="0" max="1" step="0.01" value={globalVolume} oninput={handleVolumeChange} class="volume-slider" />
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="loading-state">
      <span class="loading loading-spinner text-primary"></span>
      <span>Cargando reels...</span>
    </div>
  {:else if reels.length === 0}
    <div class="empty-state">
      <span class="material-icons-round">smart_display</span>
      <h3>Sin videos</h3>
    </div>
  {:else}
    <div class="reels-feed-column">
      <div class="reel-container">
        {#each reels as reel, i (reel.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="reel-item" data-index={i} use:trackReel={i}>
            <video src={reel.video_url} class="backdrop-video" loop muted playsinline>
              <track kind="captions" />
            </video>
            
            <div class="gradient-overlay-top"></div>
            <div class="gradient-overlay-bottom"></div>

            <div class="reel-content-wrapper">
               <!-- svelte-ignore a11y_click_events_have_key_events -->
               <div class="interaction-layer" onclick={(e) => handleVideoInteraction(e, reel, i)}>
                 <video 
                   src={reel.video_url} 
                   class="main-video" 
                   loop playsinline
                   ontimeupdate={(e) => { handleTimeUpdate(e); syncBackdrop(e); }}
                   onplay={() => handlePlay(reel.id)}
                 >
                   <track kind="captions" />
                 </video>

                 {#if flashAnimIndex === i}
                   <div class="flash-anim-overlay">
                     <div class="flash-icon">
                       <span class="material-icons-round">{flashAnimIcon}</span>
                     </div>
                   </div>
                 {/if}

                 {#if i === activeReelIndex}
                   {#each floatingHearts as heart (heart.id)}
                     <div class="floating-heart" style="left: {heart.x}px; top: {heart.y}px;">
                       <span class="material-icons-round">favorite</span>
                     </div>
                   {/each}
                 {/if}

                 <!-- Bottom Info Panel (Inside Interaction layer to float over video) -->
                 <div class="bottom-info-panel" onclick={(e) => e.stopPropagation()}>
                   <div class="creator-name-row">
                     <a href="/u/{reel.username}" class="creator-link">@{reel.username}</a>
                     {#if reel.is_verified == 1}
                       <span class="material-icons-round verified-badge">verified</span>
                     {/if}
                   </div>
                   {#if reel.caption}
                     <p class="caption-text">{reel.caption}</p>
                   {/if}
                 </div>
               </div>

               <!-- Sidebar Actions (Outside interaction layer on desktop) -->
               <div class="right-actions-sidebar">
                 <a href="/u/{reel.username}" class="creator-avatar">
                   {#if reel.avatar_url}
                     <img src={reel.avatar_url} alt={reel.username} />
                   {:else}
                     <span class="initials">{getInitials(reel.username)}</span>
                   {/if}
                   <div class="follow-badge"><span class="material-icons-round">add</span></div>
                 </a>

                 <button class="clean-action-btn" class:liked={reel.user_liked} onclick={(e) => handleLikeButton(reel, i, e)}>
                   <span class="material-icons-round icon-outline">favorite</span>
                   <span class="action-label">{reel.like_count}</span>
                 </button>

                 <button class="clean-action-btn" onclick={(e) => toggleComments(reel.id, e)}>
                   <span class="material-icons-round icon-outline">chat_bubble</span>
                   <span class="action-label">{(reel.comment_count ?? 0) + (commentCountDeltas[reel.id] ?? 0)}</span>
                 </button>

                 <button class="clean-action-btn" onclick={(e) => e.stopPropagation()}>
                   <span class="material-icons-round">share</span>
                   <span class="action-label">Share</span>
                 </button>
               </div>
            </div>

            <!-- Progress Bar -->
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: {i === activeReelIndex ? activeReelProgress : 0}%"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    {#if showCommentsModal}
      <div class="reels-comments-column" in:fly={{x: 400, duration: 400, easing: cubicOut}} out:fly={{x: 400, duration: 300}}>
        <div class="comments-slide-panel">
          <div class="modal-header">
            <h3>Comentarios ({commentsList.length})</h3>
            <button class="close-btn" onclick={closeComments}>
              <span class="material-icons-round">close</span>
            </button>
          </div>

          <div class="comments-list-area">
            {#if loadingComments}
              <div class="loader-container">
                <span class="loading loading-spinner text-primary"></span>
              </div>
            {:else if threadedComments.length === 0}
              <div class="empty-comments">Sé el primero en comentar.</div>
            {:else}
              {#snippet commentNode(node, depth = 0)}
                {@const MAX_DEPTH = 2}
                <div class="comment-root" class:is-reply={depth > 0}>
                  <a href="/u/{node.username}" class="comment-avatar" class:small={depth > 0}>
                    {#if node.avatar_url}
                      <img src={node.avatar_url} alt={node.username} />
                    {:else}
                      <span class="avatar-initials">{getInitials(node.username)}</span>
                    {/if}
                  </a>
                  <div class="comment-content">
                    <div class="author-row">
                      <a href="/u/{node.username}" class="author-name">@{node.username}</a>
                      {#if depth > 0}
                        <span class="depth-badge">respuesta</span>
                      {/if}
                    </div>
                    <div class="body-text">
                      {#if node.reply_to_username}
                        <a href="/u/{node.reply_to_username}" class="mention-tag">@{node.reply_to_username}</a>{' '}
                      {/if}{node.body || node.comment}
                    </div>
                    <div class="comment-actions">
                      <button class="reply-action" onclick={() => initiateReply(node)}>Responder</button>
                      {#if authStore.user?.username === node.username || authStore.user?.role === 'admin' || authStore.user?.role === 'super_admin'}
                        <button class="delete-action" onclick={() => requestDeleteComment(node.id)}>Eliminar</button>
                      {/if}
                    </div>
                  </div>
                  <div class="comment-likes">
                    <button class="clean-action-btn like-comment-btn" onclick={() => handleCommentLike(node)}>
                      <span class="material-icons-round" style="color: {node.has_liked ? '#e84a72' : '#888'}; font-size: {depth > 0 ? '16px' : '20px'};">
                        {node.has_liked ? 'favorite' : 'favorite_border'}
                      </span>
                      <span class="like-count">{node.like_count || 0}</span>
                    </button>
                  </div>
                </div>

                {#if node.replies && node.replies.length > 0}
                  {#if depth < MAX_DEPTH}
                    <!-- Create indentation wrapper only when below max depth -->
                    <div class="comment-replies">
                      {#each node.replies as child}
                        {@render commentNode(child, depth + 1)}
                      {/each}
                    </div>
                  {:else}
                    <!-- At MAX_DEPTH: render flat without extra wrapper — breaks margin accumulation -->
                    {#each node.replies as child}
                      {@render commentNode(child, MAX_DEPTH)}
                    {/each}
                  {/if}
                {/if}
              {/snippet}

              {#each threadedComments as thread}
                <div class="comment-thread">
                  {@render commentNode(thread)}
                </div>
              {/each}
            {/if}
          </div>

          {#if authStore.isAuthenticated}
            <div class="comment-input-area">
              {#if replyTo}
                <div class="replying-to">
                  <span>Respondiendo a @{replyTo.username}</span>
                  <button onclick={cancelReply}><span class="material-icons-round">close</span></button>
                </div>
              {/if}
              <form onsubmit={(e) => { e.preventDefault(); handleCommentSubmit(); }} class="input-form">
                <input 
                  type="text" 
                  placeholder={replyTo ? "Añadir respuesta..." : "Añadir comentario..."} 
                  bind:value={commentText} 
                  class="aero-input"
                />
                <button type="submit" disabled={!commentText.trim()} class="btn-aero-primary send-btn" aria-label="Enviar comentario">
                  <span class="material-icons-round">arrow_upward</span>
                </button>
              </form>
            </div>
          {:else}
            <div class="login-prompt">
              <a href="/login">Inicia Sesión</a> para comentar.
            </div>
          {/if}

          {#if commentToDelete}
            <div class="delete-confirm-overlay" transition:fade={{duration: 150}}>
              <div class="delete-confirm-modal" in:fly={{y: 20, duration: 250}}>
                <h4>¿Eliminar comentario?</h4>
                <p>Esta acción no se puede deshacer.</p>
                <div class="confirm-actions">
                  <button class="btn-cancel" onclick={cancelDeleteComment}>Cancelar</button>
                  <button class="btn-delete" onclick={deleteComment}>Eliminar</button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if showCommentsModal}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="mobile-comment-backdrop" onclick={closeComments} transition:fade={{duration: 200}}></div>
    {/if}
  {/if}
</div>

<style>
  .tiktok-master-layout {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: #05131a;
    display: flex; overflow: hidden; margin: 0; padding: 0;
  }

  @media (max-width: 768px) {
    .tiktok-master-layout { position: fixed; z-index: 50; }
  }

  .global-error-toast {
    position: absolute; top: 24px; left: 50%; transform: translateX(-50%); z-index: 999;
    background: rgba(232, 74, 114, 0.95); backdrop-filter: blur(8px);
    padding: 12px 24px; border-radius: 30px; display: flex; align-items: center; gap: 8px;
    color: #fff; font-weight: 700; box-shadow: 0 10px 30px rgba(232, 74, 114, 0.4);
  }

  .top-controls {
    position: absolute; top: 24px; left: 24px; z-index: 100;
    display: flex; align-items: center; gap: 12px;
  }
  .aero-btn {
    width: 44px; height: 44px; border-radius: 50%;
    background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);
    backdrop-filter: blur(8px); color: #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }
  .aero-btn:hover { background: rgba(0,0,0,0.7); transform: scale(1.05); }
  
  .volume-slider-container {
    background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
    padding: 0 16px; border-radius: 22px; height: 44px;
    display: flex; align-items: center; border: 1px solid rgba(255,255,255,0.1);
  }
  
  /* Styled minimalist volume slider */
  .volume-slider {
    -webkit-appearance: none; width: 100px; height: 4px; background: rgba(255,255,255,0.3);
    border-radius: 2px; outline: none; cursor: pointer;
  }
  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 14px; height: 14px; border-radius: 50%;
    background: #fff; cursor: pointer; border: none;
    box-shadow: 0 0 10px rgba(255,255,255,0.5);
  }

  .reels-feed-column {
    flex: 1; height: 100%; position: relative; overflow: hidden;
    display: flex; justify-content: center; background: #000;
  }
  
  .reels-comments-column {
    width: 450px; height: 100%; background: var(--bg-surface);
    border-left: 1px solid rgba(255,255,255,0.1);
    box-shadow: -10px 0 40px rgba(0,0,0,0.5);
    z-index: 10; flex-shrink: 0;
    position: absolute; right: 0; top: 0;
  }
  @media (max-width: 768px) {
    .reels-comments-column { width: 100%; position: absolute; right: 0; bottom: 0; height: 70vh; border-radius: 20px 20px 0 0; }
  }

  .reel-container {
    height: 100%; width: 100%; overflow-y: scroll; scroll-snap-type: y mandatory;
    scrollbar-width: none; -ms-overflow-style: none; position: relative;
    display: flex; flex-direction: column;
  }
  .reel-container::-webkit-scrollbar { display: none; }

  .reel-item {
    width: 100%; height: 100%; flex: 0 0 100%; scroll-snap-align: start; scroll-snap-stop: always;
    display: flex; justify-content: center; align-items: center;
    background: #000; position: relative; overflow: hidden;
  }

  .backdrop-video {
    position: absolute; inset: -10%; width: 120%; height: 120%;
    object-fit: cover; filter: blur(35px) brightness(0.25);
    z-index: 1; pointer-events: none; transform: scale(1.1); border: none; outline: none;
  }

  .gradient-overlay-top {
    position: absolute; top: 0; left: 0; width: 100%; height: 120px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%);
    z-index: 2; pointer-events: none;
  }
  .gradient-overlay-bottom {
    position: absolute; bottom: 0; left: 0; width: 100%; height: 250px;
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
    z-index: 2; pointer-events: none;
  }

  /* Center Wrapper */
  .reel-content-wrapper {
    position: relative; width: 100%; height: 100%;
    display: flex; justify-content: center; align-items: center;
    z-index: 3;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .interaction-layer {
    position: relative; width: 100%; height: 100%;
    display: flex; justify-content: center; align-items: center; cursor: pointer;
  }

  .main-video {
    max-width: 100%; max-height: 100%; width: auto; height: auto;
    object-fit: contain;
    border: none !important; outline: none !important; box-shadow: none !important;
    display: block;
  }

  @media (min-width: 769px) {
    .reel-content-wrapper {
      width: 400px; height: calc(100% - 60px);
    }
    .tiktok-master-layout.comments-open .reel-content-wrapper {
      transform: translateX(-150px);
    }
    .interaction-layer {
      border-radius: 20px; overflow: hidden;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
      background: #000; border: 1px solid rgba(255,255,255,0.05);
    }
  }

  .flash-anim-overlay {
    position: absolute; inset: 0; z-index: 4; pointer-events: none;
    display: flex; align-items: center; justify-content: center;
  }
  .flash-icon {
    width: 90px; height: 90px; border-radius: 50%; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; color: #fff;
    animation: flash-pulse 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .flash-icon .material-icons-round { font-size: 50px; }
  @keyframes flash-pulse { 0% { transform: scale(0.5); opacity: 0; } 30% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }

  .right-actions-sidebar {
    position: absolute; right: 16px; bottom: 80px; z-index: 10;
    display: flex; flex-direction: column; align-items: center; gap: 20px;
    pointer-events: auto;
  }
  @media (min-width: 769px) {
    .right-actions-sidebar { position: absolute; right: -70px; bottom: 20px; }
  }

  .creator-avatar {
    position: relative; width: 44px; height: 44px; border-radius: 50%; border: 2px solid #fff; overflow: visible;
    background: var(--bg-surface); display: flex; align-items: center; justify-content: center; text-decoration: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4); margin-bottom: 12px; transition: transform 0.2s;
  }
  .creator-avatar:hover { transform: scale(1.05); }
  .creator-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
  .initials { font-weight: 800; color: #fff; font-size: 1rem; }
  .follow-badge {
    position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 20px; height: 20px;
    border-radius: 50%; background: var(--aero-rose); display: flex; align-items: center; justify-content: center; color: #fff; border: 2px solid #000;
  }
  .follow-badge .material-icons-round { font-size: 14px; font-weight: 900; }

  .clean-action-btn { background: none; border: none; padding: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; color: #fff; cursor: pointer; transition: transform 0.2s; }
  .clean-action-btn .material-icons-round { font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)); transition: color 0.2s, -webkit-text-stroke 0.2s; }
  .clean-action-btn .icon-outline { color: transparent; -webkit-text-stroke: 2px rgba(255, 255, 255, 0.9); }
  .clean-action-btn:hover { transform: scale(1.1); }
  .clean-action-btn:active { transform: scale(0.9); }
  .clean-action-btn.liked .icon-outline { color: #f43f5e; -webkit-text-stroke: 0px transparent; filter: drop-shadow(0 0 10px rgba(244,63,94,0.5)); }
  .action-label { font-size: 0.8rem; font-weight: 800; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }

  .bottom-info-panel {
    position: absolute; left: 16px; bottom: 32px; right: 80px; z-index: 10;
    display: flex; flex-direction: column; gap: 8px;
    text-shadow: 0 1px 4px rgba(0,0,0,0.8); pointer-events: none;
  }
  @media (min-width: 769px) { .bottom-info-panel { right: 16px; bottom: 16px; } }

  .creator-name-row { display: flex; align-items: center; gap: 6px; pointer-events: auto; }
  .creator-link { font-weight: 800; font-size: 1.05rem; color: #fff; text-decoration: none; text-shadow: 0 1px 4px rgba(0,0,0,0.8); }
  .creator-link:hover { text-decoration: underline; }
  .verified-badge { font-size: 16px; color: var(--aero-sky); filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }
  .caption-text {
    font-size: 0.95rem; color: rgba(255,255,255,0.95); line-height: 1.4; margin: 0; text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; pointer-events: auto;
  }

  .progress-bar-container { position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: rgba(255,255,255,0.1); z-index: 20; overflow: hidden; border: none; margin: 0; padding: 0; }
  .progress-bar-fill { height: 100%; background: #fff; box-shadow: 0 0 10px rgba(255,255,255,0.8); transition: width 0.1s linear; }

  .floating-heart { position: absolute; z-index: 9999; color: #f43f5e; pointer-events: none; transform: translate(-50%, -50%) scale(0); animation: heart-burst 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
  .floating-heart .material-icons-round { font-size: 90px; text-shadow: 0 0 30px rgba(244, 63, 94, 0.8); }
  @keyframes heart-burst { 0% { transform: translate(-50%, -50%) scale(0) rotate(-15deg); opacity: 0; } 15% { transform: translate(-50%, -50%) scale(1.3) rotate(10deg); opacity: 1; } 30% { transform: translate(-50%, -50%) scale(1) rotate(-5deg); opacity: 1; } 100% { transform: translate(-50%, -200%) scale(1.5) rotate(15deg); opacity: 0; } }

  .comments-slide-panel { display: flex; flex-direction: column; height: 100%; width: 100%; background: var(--bg-surface); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .modal-header h3 { font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0; }
  .close-btn { background: rgba(255,255,255,0.05); border: none; width: 36px; height: 36px; border-radius: 50%; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .close-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
  
  .comments-list-area { flex: 1; overflow-y: auto; padding: 16px 24px; display: flex; flex-direction: column; gap: 20px; }
  .comments-list-area::-webkit-scrollbar { width: 6px; }
  .comments-list-area::-webkit-scrollbar-track { background: transparent; }
  .comments-list-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
  .comments-list-area::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
  .empty-comments { text-align: center; color: var(--text-muted); padding: 40px 0; font-size: 0.95rem; }
  .loader-container { display: flex; justify-content: center; padding: 40px; }
  
  .comment-thread { display: flex; flex-direction: column; gap: 12px; }
  .comment-root { display: flex; gap: 12px; }
  .comment-avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; overflow: hidden; flex-shrink: 0; text-decoration: none; }
  .comment-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .comment-avatar.small { width: 28px; height: 28px; font-size: 0.8rem; }
  
  .comment-content { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .author-row { font-size: 0.85rem; font-weight: 700; color: var(--text-muted); }
  .body-text { font-size: 0.95rem; color: var(--text-primary); line-height: 1.4; word-break: break-word; }
  .comment-actions { display: flex; gap: 12px; margin-top: 4px; }
  .reply-action, .delete-action { background: transparent; border: none; padding: 0; font-size: 0.8rem; color: var(--text-muted); cursor: pointer; text-align: left; font-weight: 600; transition: color 0.2s; }
  .reply-action:hover { color: #fff; }
  .delete-action:hover { color: #f43f5e; }
  
  .delete-confirm-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 50; display: flex; align-items: center; justify-content: center; }
  .delete-confirm-modal { background: var(--bg-surface); padding: 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); width: 80%; max-width: 300px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); text-align: center; }
  .delete-confirm-modal h4 { margin: 0 0 8px 0; color: #fff; font-size: 1.1rem; }
  .delete-confirm-modal p { margin: 0 0 20px 0; color: var(--text-muted); font-size: 0.9rem; }
  .confirm-actions { display: flex; gap: 12px; }
  .confirm-actions button { flex: 1; padding: 10px; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; }
  .btn-cancel { background: rgba(255,255,255,0.1); color: #fff; }
  .btn-cancel:hover { background: rgba(255,255,255,0.15); }
  .btn-delete { background: #f43f5e; color: #fff; }
  .btn-delete:hover { background: #e11d48; }
  
  .comment-replies {
    margin-left: 48px;  /* Fixed, non-cumulative — only created below MAX_DEPTH */
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-left: 1px solid rgba(255,255,255,0.06);
    padding-left: 16px;
  }
  
  .comment-input-area { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); }
  .replying-to { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; padding: 6px 12px; background: rgba(255,255,255,0.05); border-radius: 12px; }
  .replying-to button { background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; padding: 2px; border-radius: 50%; }
  .replying-to button:hover { color: #fff; background: rgba(255,255,255,0.1); }
  .replying-to button span { font-size: 14px; }
  
  .input-form { display: flex; gap: 12px; align-items: center; }
  .aero-input { flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); padding: 12px 20px; border-radius: 24px; color: #fff; font-size: 0.95rem; outline: none; transition: border-color 0.2s; }
  .aero-input:focus { border-color: rgba(255,255,255,0.3); }
  .send-btn { width: 44px; height: 44px; border-radius: 50%; background: var(--aero-primary); border: none; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: transform 0.2s; }
  .send-btn:not(:disabled):hover { transform: scale(1.05); }
  .send-btn:disabled { opacity: 0.5; cursor: not-allowed; background: rgba(255,255,255,0.1); }
  
  .login-prompt { padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.95rem; border-top: 1px solid rgba(255,255,255,0.05); }
  .login-prompt a { color: var(--aero-primary); font-weight: 700; text-decoration: none; }
  .login-prompt a:hover { text-decoration: underline; }
  
  .mobile-comment-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 5; }
  @media (min-width: 769px) { .mobile-comment-backdrop { display: none; } }

  /* ── Mention & threading styles ───────────────────────────────────── */
  .mention-tag {
    color: var(--aero-primary, #1b85f3);
    font-weight: 700;
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .mention-tag:hover { opacity: 0.8; text-decoration: underline; }

  .author-name {
    color: var(--text-muted);
    font-weight: 700;
    font-size: 0.85rem;
    text-decoration: none;
    transition: color 0.15s;
  }
  .author-name:hover { color: #fff; }

  .depth-badge {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--aero-primary, #1b85f3);
    background: rgba(27, 133, 243, 0.12);
    border: 1px solid rgba(27, 133, 243, 0.25);
    border-radius: 6px;
    padding: 1px 6px;
    margin-left: 6px;
    vertical-align: middle;
    letter-spacing: 0.02em;
  }

  .avatar-initials {
    font-weight: 800;
    font-size: 0.9rem;
    color: #fff;
    pointer-events: none;
  }

  .comment-root.is-reply { opacity: 0.95; }
  .comment-root.is-reply .comment-avatar { width: 28px; height: 28px; font-size: 0.8rem; }
</style>
