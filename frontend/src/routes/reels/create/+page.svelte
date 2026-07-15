<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { goto } from '$app/navigation';
  import { reels as reelsApi } from '$lib/api.js';
  import { authStore } from '$lib/stores/auth.svelte.js';

  let selectedFile = $state(null);
  let preview = $state(null);
  let caption = $state('');
  let uploading = $state(false);
  let error = $state('');
  let fileInput;
  let isDragging = $state(false);

  onMount(() => {
    if (!authStore.isAuthenticated) goto('/login');
  });

  function handleFile(e) {
    const file = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      error = 'Formato inválido. Solo se permiten archivos de video.';
      return;
    }
    
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      error = 'El video es demasiado grande. El límite es 100MB.';
      return;
    }

    error = '';
    selectedFile = file;
    if (preview) URL.revokeObjectURL(preview);
    preview = URL.createObjectURL(file);
  }

  function handleDragOver(e) { e.preventDefault(); isDragging = true; }
  function handleDragLeave() { isDragging = false; }
  function handleDrop(e) { e.preventDefault(); isDragging = false; handleFile(e); }

  function discardVideo() {
    selectedFile = null;
    if (preview) URL.revokeObjectURL(preview);
    preview = null;
    caption = '';
    error = '';
  }

  async function handlePublish() {
    if (!selectedFile || uploading) return;
    uploading = true;
    error = '';

    try {
      const fd = new FormData();
      fd.append('video', selectedFile);
      fd.append('caption', caption);

      await reelsApi.create(fd);
      goto('/reels');
    } catch (err) {
      error = err?.message || 'Error al publicar el reel. Intenta de nuevo.';
    } finally {
      uploading = false;
    }
  }

  function syncBackdrop(e) {
    const mainVideo = e.target;
    const backdropVideo = mainVideo.parentElement.querySelector('.backdrop-video');
    if (backdropVideo && Math.abs(backdropVideo.currentTime - mainVideo.currentTime) > 0.5) {
      backdropVideo.currentTime = mainVideo.currentTime;
    }
  }
</script>

<svelte:head><title>Studio | V-SOCIAL</title></svelte:head>

<div class="cinematic-creator-wrapper" class:split-mode={selectedFile}>

  <a href="/reels" class="back-floating-btn" aria-label="Volver">
    <span class="material-icons-round">arrow_back</span>
  </a>

  {#if error}
    <div class="error-toast" transition:fly={{y: -20}}>
      <span class="material-icons-round">error</span> {error}
      <button onclick={() => error = ''}><span class="material-icons-round text-sm">close</span></button>
    </div>
  {/if}

  {#if !selectedFile}
    <!-- FASE 1: Dropzone Masiva -->
    <div class="phase-1-upload" out:fade={{duration: 200}}>
      <div 
        class="massive-dropzone"
        class:dragging={isDragging}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
        onclick={() => fileInput.click()}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } }}
        role="button"
        tabindex="0"
      >
        <div class="glow-ring">
          <span class="material-icons-round">movie_creation</span>
        </div>
        <h1 class="hero-title">Sube tu próximo éxito</h1>
        <p class="hero-subtitle">Arrastra tu video aquí o haz clic para explorar.</p>
        <span class="format-info">MP4, WebM (Máximo 100MB)</span>
      </div>
    </div>

  {:else}
    <!-- FASE 2: Cinematic Editor (Split Layout) -->
    <div class="phase-2-editor" in:fade={{duration: 400, delay: 200}}>
      
      <!-- Columna Izquierda: Video (Inmersivo) -->
      <div class="video-preview-column">
        <video src={preview} class="backdrop-video" autoplay loop muted playsinline>
          <track kind="captions" />
        </video>
        <div class="dark-overlay"></div>
        <div class="main-video-container">
          <video 
            src={preview} 
            class="main-video" 
            autoplay loop playsinline controls
            ontimeupdate={syncBackdrop}
          >
            <track kind="captions" />
          </video>
        </div>
      </div>

      <!-- Columna Derecha: Consola Neo-Aero (Sidebar) -->
      <div class="creator-side-console" in:fly={{x: 200, duration: 600, easing: cubicOut, delay: 300}}>
        <div class="console-header">
          <h2>Editar Detalles</h2>
          <button class="discard-btn" onclick={discardVideo} disabled={uploading}>
            <span class="material-icons-round">delete_outline</span> Descartar
          </button>
        </div>

        <div class="console-body">
          <label for="caption" class="input-label">Descripción</label>
          <div class="textarea-wrapper">
            <textarea 
              id="caption"
              bind:value={caption} 
              placeholder="Escribe algo impactante para acompañar tu video..." 
              class="cinematic-textarea" 
              rows="6" 
              maxlength="2200"
              disabled={uploading}
            ></textarea>
            <div class="char-count" class:near-limit={caption.length > 2100}>
              {caption.length} / 2200
            </div>
          </div>
          
          <div class="info-block">
            <span class="material-icons-round">info</span>
            <p>Los videos públicos pueden ser vistos y compartidos por cualquier usuario en V-SOCIAL.</p>
          </div>
        </div>

        <div class="console-footer">
          <button class="publish-hero-btn" onclick={handlePublish} disabled={uploading}>
            {#if uploading}
              <div class="loading-spinner"></div> Procesando...
            {:else}
              <span class="material-icons-round">rocket_launch</span> Compartir Reel
            {/if}
          </button>
        </div>
      </div>
      
    </div>
  {/if}

  <input type="file" bind:this={fileInput} accept="video/mp4,video/webm,video/quicktime" style="display:none" onchange={handleFile} />
</div>

<style>
  .cinematic-creator-wrapper {
    width: 100%;
    height: calc(100vh - 64px); /* Desktop nav offset */
    background: #05070a;
    position: relative;
    overflow: hidden;
    transition: all 0.4s;
  }

  @media (max-width: 768px) {
    .cinematic-creator-wrapper {
      height: 100dvh;
      position: fixed; top: 0; left: 0; z-index: 50;
    }
  }

  .back-floating-btn {
    position: absolute;
    top: 24px; left: 24px; z-index: 100;
    width: 44px; height: 44px; border-radius: 50%;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    backdrop-filter: blur(8px); color: #fff;
    display: flex; align-items: center; justify-content: center;
    text-decoration: none; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }
  .back-floating-btn:hover { background: rgba(255,255,255,0.15); transform: scale(1.05); }

  .error-toast {
    position: absolute; top: 24px; left: 50%; transform: translateX(-50%); z-index: 110;
    background: rgba(232, 74, 114, 0.2); border: 1px solid var(--aero-rose);
    backdrop-filter: blur(10px); color: #fff; padding: 12px 24px; border-radius: 30px;
    display: flex; align-items: center; gap: 12px; font-weight: 700;
    box-shadow: 0 10px 30px rgba(232, 74, 114, 0.3);
  }
  .error-toast button { background: none; border: none; color: #fff; cursor: pointer; padding: 0; display: flex; }

  /* ── Phase 1: Massive Dropzone ── */
  .phase-1-upload {
    width: 100%; height: 100%; position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at center, rgba(46, 134, 232, 0.08) 0%, transparent 70%);
    padding: 24px; z-index: 10;
  }

  .massive-dropzone {
    width: 100%; max-width: 800px; height: 60vh; min-height: 400px;
    border-radius: 40px; background: rgba(255,255,255,0.02);
    border: 2px dashed rgba(255,255,255,0.15);
    display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
    cursor: pointer; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative; overflow: hidden;
  }
  .massive-dropzone::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.05), transparent);
    opacity: 0; transition: opacity 0.4s; pointer-events: none;
  }
  .massive-dropzone:hover, .massive-dropzone.dragging {
    border-color: var(--aero-sky); background: rgba(255,255,255,0.05);
    box-shadow: 0 0 50px rgba(46, 134, 232, 0.15), inset 0 0 30px rgba(46, 134, 232, 0.1); transform: scale(1.02);
  }
  .massive-dropzone:hover::before, .massive-dropzone.dragging::before { opacity: 1; }

  .glow-ring {
    width: 100px; height: 100px; border-radius: 50%; background: rgba(46, 134, 232, 0.1);
    display: flex; align-items: center; justify-content: center;
    color: var(--aero-sky); margin-bottom: 32px; box-shadow: 0 0 30px rgba(46, 134, 232, 0.3);
    transition: transform 0.4s;
  }
  .glow-ring .material-icons-round { font-size: 48px; }
  .massive-dropzone:hover .glow-ring { transform: scale(1.1); background: rgba(46, 134, 232, 0.2); }

  .hero-title { font-family: var(--font-display); font-size: 2.5rem; color: #fff; font-weight: 800; margin: 0 0 16px; text-shadow: 0 4px 20px rgba(0,0,0,0.5); }
  @media (max-width: 768px) { .hero-title { font-size: 1.8rem; } }
  .hero-subtitle { font-size: 1.1rem; color: rgba(255,255,255,0.6); margin: 0 0 24px; }
  .format-info { font-size: 0.85rem; color: rgba(255,255,255,0.3); font-family: var(--font-mono, monospace); }


  /* ── Phase 2: Cinematic Editor (Split Layout) ── */
  .phase-2-editor {
    width: 100%; height: 100%; position: absolute; inset: 0;
    display: flex; flex-direction: row; overflow: hidden;
  }
  @media (max-width: 1024px) {
    .phase-2-editor { flex-direction: column; }
  }

  .video-preview-column {
    flex: 1; position: relative; display: flex; justify-content: center; align-items: center;
    overflow: hidden; background: #000;
  }
  @media (max-width: 1024px) { .video-preview-column { flex: 1.5; } } /* En tablet/movil ocupa más espacio */

  .backdrop-video {
    position: absolute; inset: -10%; width: 120%; height: 120%;
    object-fit: cover; filter: blur(50px) brightness(0.3) saturate(1.2);
    z-index: 1; pointer-events: none;
  }

  .dark-overlay {
    position: absolute; inset: 0; background: rgba(0,0,0,0.4);
    z-index: 2; pointer-events: none;
  }

  .main-video-container {
    position: relative; z-index: 3; width: 100%; height: 100%;
    display: flex; justify-content: center; align-items: center;
  }

  .main-video {
    width: 100%; height: 90%; max-width: 450px;
    object-fit: contain; border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.8);
    background: #000;
  }

  /* ── Creator Side Console (Sidebar) ── */
  .creator-side-console {
    width: 450px; flex-shrink: 0;
    background: rgba(10, 12, 16, 0.65);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-left: 1px solid rgba(255,255,255,0.08);
    display: flex; flex-direction: column;
    z-index: 10; box-shadow: -10px 0 50px rgba(0,0,0,0.8);
    position: relative;
  }
  .creator-side-console::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.03), transparent);
    pointer-events: none;
  }
  @media (max-width: 1024px) {
    .creator-side-console {
      width: 100%; flex: 1; border-left: none; border-top: 1px solid rgba(255,255,255,0.15);
      border-top-left-radius: 32px; border-top-right-radius: 32px;
    }
  }

  .console-header { display: flex; justify-content: space-between; align-items: center; padding: 24px 32px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .console-header h2 { margin: 0; font-size: 1.2rem; color: #fff; font-weight: 800; font-family: var(--font-display); }
  
  .discard-btn {
    background: rgba(232, 74, 114, 0.05); color: var(--aero-rose);
    border: 1px solid rgba(232, 74, 114, 0.2); padding: 8px 16px; border-radius: 20px;
    font-size: 0.85rem; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; gap: 6px; transition: all 0.2s;
  }
  .discard-btn:hover:not(:disabled) { background: rgba(232, 74, 114, 0.15); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(232, 74, 114, 0.2); }
  .discard-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .console-body { flex: 1; padding: 32px; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; position: relative; z-index: 2; }
  
  .input-label { font-size: 0.95rem; font-weight: 700; color: rgba(255,255,255,0.9); display: block; margin-bottom: 8px; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
  .textarea-wrapper { position: relative; }
  
  .cinematic-textarea {
    width: 100%; background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
    padding: 16px; padding-bottom: 32px;
    color: #fff; font-size: 1rem; resize: none; transition: all 0.3s;
    line-height: 1.5; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
  }
  .cinematic-textarea:focus { border-color: var(--aero-sky); outline: none; background: rgba(0,0,0,0.5); box-shadow: inset 0 2px 10px rgba(0,0,0,0.6), 0 0 15px rgba(46, 134, 232, 0.15); }
  .cinematic-textarea:disabled { opacity: 0.6; }
  
  .char-count { position: absolute; bottom: 12px; right: 16px; font-size: 0.75rem; color: rgba(255,255,255,0.5); font-family: var(--font-mono); }
  .char-count.near-limit { color: var(--aero-rose); font-weight: 800; }

  .info-block { display: flex; gap: 12px; padding: 16px; background: rgba(46, 134, 232, 0.08); border: 1px solid rgba(46, 134, 232, 0.2); border-radius: 12px; color: rgba(255,255,255,0.8); font-size: 0.85rem; line-height: 1.4; backdrop-filter: blur(4px); }
  .info-block .material-icons-round { color: var(--aero-sky); font-size: 20px; }

  .console-footer { padding: 24px 32px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.3); position: relative; z-index: 2; }
  .publish-hero-btn {
    width: 100%; background: linear-gradient(135deg, var(--aero-blue), var(--aero-sky));
    border: none; padding: 20px; border-radius: 20px;
    color: #fff; font-size: 1.1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;
    display: flex; align-items: center; justify-content: center; gap: 12px;
    cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 10px 30px rgba(46, 134, 232, 0.3);
  }
  .publish-hero-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(46, 134, 232, 0.5); }
  .publish-hero-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; filter: grayscale(50%); }

  .loading-spinner {
    width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3);
    border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
