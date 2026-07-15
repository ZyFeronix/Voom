<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { stories as storiesApi } from '$lib/api.js';
  import { authStore } from '$lib/stores/auth.svelte.js';
  import 'vidstack/define/media-player.js';
	import 'vidstack/define/media-outlet.js';
	import 'vidstack/define/media-community-skin.js';
    
  let selectedFile = $state(null);
  let preview = $state(null);
  let uploading = $state(false);
  let error = $state('');

  // Story config
  let bgColor = $state('#00E5FF'); // Cyan default
  const colors = ['#00E5FF', '#FF6B6B', '#6C5CE7', '#FDCB6E', '#00B894', '#E84A72', '#2E86E8', '#4A4A4A', '#FF3366', '#1EE3CF'];

  // Overlays
  let overlayText = $state('');
  let overlayTextColor = $state('#FFFFFF');
  const textColors = ['#FFFFFF', '#000000', '#FF6B6B', '#FDCB6E', '#00E5FF'];

  // Font styles
  let selectedFont = $state('modern'); // 'modern', 'serif', 'typewriter', 'neon', 'cursive'
  let textBackground = $state(false);
  const fonts = [
    { id: 'modern', name: 'Outfit' },
    { id: 'serif', name: 'Elegante' },
    { id: 'typewriter', name: 'Máquina' },
    { id: 'neon', name: 'Neón' },
    { id: 'cursive', name: 'Cursiva' }
  ];

  // Stickers
  let selectedSticker = $state(null);
  let stickerConfig = $state({});
  const stickers = [
    { id: 'location', icon: 'location_on', label: 'Ubicación', desc: 'Añade donde estás' },
    { id: 'poll', icon: 'poll', label: 'Encuesta', desc: 'Haz una pregunta' },
    { id: 'mention', icon: 'alternate_email', label: 'Mención', desc: 'Etiqueta a un amigo' },
    { id: 'music', icon: 'music_note', label: 'Música', desc: 'Añade una pista' },
    { id: 'hashtag', icon: 'tag', label: 'Hashtag', desc: 'Tendencias' }
  ];

  let fileInput;

  onMount(() => {
    if (!authStore.isAuthenticated) goto('/login');
  });

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      error = 'Solo imágenes o videos para historias.';
      return;
    }
    error = '';
    selectedFile = file;
    preview = URL.createObjectURL(file);
  }

  function addSticker(sticker) {
    selectedSticker = sticker;
    if (sticker.id === 'poll') {
      stickerConfig = { question: '¿Qué opinas?', options: ['Sí', 'No'] };
    } else {
      stickerConfig = { value: '' };
    }
  }

  function removeSticker() {
    selectedSticker = null;
    stickerConfig = {};
  }

  async function handlePublish() {
    if ((!selectedFile && !overlayText && !selectedSticker) || uploading) return;
    uploading = true;
    error = '';

    try {
      const fd = new FormData();
      if (selectedFile) fd.append('media', selectedFile);
      fd.append('bg_color', bgColor);
      
      let elements = [];
      if (overlayText) elements.push({ type: 'text', content: overlayText, color: overlayTextColor });
      if (selectedSticker) elements.push({ type: selectedSticker.id, ...stickerConfig });
      
      fd.append('elements', JSON.stringify(elements));

      await storiesApi.create(fd);
      goto('/feed');
    } catch (err) {
      error = err?.message || 'Error al publicar historia.';
    } finally {
      uploading = false;
    }
  }
</script>

<svelte:head><title>Crear Historia — VSocial</title></svelte:head>

<div class="creator-container">
  <div class="creator-layout">
    
    <!-- Left Sidebar: Edición Visual -->
    <div class="tools-sidebar glass-panel">
      <div class="tools-header">
        <span class="material-icons-round">auto_awesome</span>
        <h3>Diseño de Historia</h3>
      </div>

      <!-- Stickers -->
      <div class="tool-section">
        <div class="tool-title"><span class="material-icons-round text-[16px] text-fuchsia-400">emoji_emotions</span> Stickers Mágicos</div>
        <div class="sticker-grid">
          {#each stickers as sticker}
            <button class="sticker-item" class:selected={selectedSticker?.id === sticker.id} onclick={() => addSticker(sticker)}>
              <span class="material-icons-round sticker-icon">{sticker.icon}</span>
              <span class="sticker-label">{sticker.label}</span>
              <span class="sticker-desc">{sticker.desc}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Color de Fondo -->
      {#if !preview}
      <div class="tool-section mt-4">
        <div class="tool-title"><span class="material-icons-round text-[16px] text-amber-400">palette</span> Color de Fondo</div>
        <div class="color-picker-row">
          {#each colors as c}
            <button class="color-swatch" class:selected={bgColor === c} style="background:{c}" onclick={() => bgColor = c} aria-label="Color {c}"></button>
          {/each}
        </div>
      </div>
      {/if}

      <!-- Texto Principal -->
      <div class="tool-section mt-4">
        <div class="tool-title"><span class="material-icons-round text-[16px] text-aero-blue">text_format</span> Mensaje de la Historia</div>
        <input type="text" bind:value={overlayText} placeholder="¿Qué está pasando?" class="vs-input" maxlength="60" style="margin-bottom: 10px;" />
        <div class="color-row">
          {#each textColors as c}
            <button class="color-dot" class:selected={overlayTextColor === c} style="background:{c}" onclick={() => overlayTextColor = c} aria-label="Color de texto {c}"></button>
          {/each}
        </div>
      </div>

      <!-- Estilos de Texto -->
      <div class="tool-section mt-4">
        <div class="tool-title"><span class="material-icons-round text-[16px] text-emerald-400">text_fields</span> Estilo de Texto</div>
        <div class="font-selector-chips">
          {#each fonts as f}
            <button 
              type="button"
              class="font-chip" 
              class:selected={selectedFont === f.id} 
              onclick={() => selectedFont = f.id}
            >
              {f.name}
            </button>
          {/each}
        </div>
        <label class="aero-switch mt-3">
          <input type="checkbox" bind:checked={textBackground} />
          <span class="switch-slider"></span>
          <span class="toggle-label">Resaltado de texto</span>
        </label>
      </div>

      <div class="upload-box-small mt-4">
        <p class="text-xs text-muted mb-2">O sube una foto / video:</p>
        <button class="btn-aero-secondary w-full" style="padding: 8px;" onclick={() => fileInput.click()}>
          <span class="material-icons-round text-sm">upload_file</span> Cargar Archivo
        </button>
      </div>

    </div>

    <!-- Center: Vista Previa Principal -->
    <div class="preview-section">
      <div class="video-container glass-panel" style="background: {preview ? 'transparent' : bgColor}">
        
        {#if preview}
          <!-- Blurred backdrop for beautiful portrait display -->
          {#if selectedFile?.type?.startsWith('video/')}
            <media-player src={preview} class="backdrop-media" autoplay loop muted playsInline>
              <media-outlet></media-outlet>
            </media-player>
            <media-player src={preview} loop class="main-media" autoplay muted playsInline>
              <media-outlet></media-outlet>
              <media-community-skin></media-community-skin>
            </media-player>
          {:else}
            <img src={preview} alt="" class="backdrop-media" />
            <img src={preview} alt="Story preview" class="main-media" />
          {/if}
          <button class="icon-btn close-btn" onclick={() => { selectedFile = null; preview = null; }} aria-label="Quitar multimedia">
            <span class="material-icons-round">close</span>
          </button>
        {/if}

        {#if !preview && !overlayText && !selectedSticker}
          <div class="empty-state-prompt">
            <div class="upload-icon-pulse" style="background: rgba(255,255,255,0.1); box-shadow: 0 0 20px rgba(255,255,255,0.15);">
              <span class="material-icons-round" style="font-size: 3rem; color: #fff;">amp_stories</span>
            </div>
            <h2>Tu Historia</h2>
            <p>Diseña tu historia con las herramientas de la izquierda</p>
          </div>
        {/if}

        <!-- Overlays Renderizados con Estilo de Fuente y Fondo -->
        {#if overlayText}
          <div 
            class="media-text-overlay slide-in font-{selectedFont}" 
            class:has-bg={textBackground}
            style="color: {overlayTextColor};"
          >
            {overlayText}
          </div>
        {/if}

        <!-- Sticker Preview (Widget Profesional e Interactivo) -->
        {#if selectedSticker}
          <div class="sticker-preview-overlay slide-in">
            {#if selectedSticker.id === 'poll'}
              <div class="poll-sticker-widget glass-card">
                <div class="poll-question">{stickerConfig.question || '¿Qué opinas?'}</div>
                <div class="poll-answers">
                  <div class="poll-btn">{stickerConfig.options?.[0] || 'Sí'}</div>
                  <div class="poll-btn">{stickerConfig.options?.[1] || 'No'}</div>
                </div>
              </div>
            {:else if selectedSticker.id === 'location'}
              <div class="location-sticker-widget">
                <span class="material-icons-round text-blue-500">location_on</span>
                <span class="font-bold text-sm">{stickerConfig.value || 'Tu Ubicación'}</span>
              </div>
            {:else if selectedSticker.id === 'mention'}
              <div class="mention-sticker-widget">
                <span class="font-bold text-sm">@{stickerConfig.value || 'usuario'}</span>
              </div>
            {:else if selectedSticker.id === 'hashtag'}
              <div class="hashtag-sticker-widget">
                <span class="font-bold text-sm">#{stickerConfig.value || 'hashtag'}</span>
              </div>
            {:else if selectedSticker.id === 'music'}
              <div class="music-sticker-widget glass-card">
                <span class="material-icons-round spinning-music-icon">music_note</span>
                <div class="music-info">
                  <span class="music-title">{stickerConfig.value || 'Pista de Audio'}</span>
                  <span class="music-artist">Artista Relacionado</span>
                </div>
              </div>
            {/if}
          </div>
        {/if}
        
      </div>
      <input type="file" bind:this={fileInput} accept="image/*,video/*" style="display:none" onchange={handleFile} />
    </div>

    <!-- Right Sidebar: Panel de Configuración -->
    <div class="details-section glass-panel">
      <div class="details-header">
        <a href="/feed" class="back-link" aria-label="Link"><span class="material-icons-round">arrow_back</span></a>
        <h3>Tu Historia</h3>
        <div class="ephemeral-badge">
          <span class="material-icons-round text-[12px]">timer</span> 24h
        </div>
      </div>
      
      {#if error}
        <div class="error-bar">
          <span class="material-icons-round">error</span>
          <span>{error}</span>
        </div>
      {/if}

      <!-- Configuración del Sticker Activo -->
      {#if selectedSticker}
        <div class="sticker-config-panel form-group slide-in">
          <div class="sticker-config-header">
            <span class="material-icons-round text-sm" style="color: var(--aero-blue)">{selectedSticker.icon}</span>
            <span class="font-bold text-xs uppercase text-muted">Ajustar {selectedSticker.label}</span>
            <button class="sticker-remove-btn" onclick={removeSticker} title="Eliminar Sticker">
              <span class="material-icons-round text-[14px]">close</span>
            </button>
          </div>

          {#if selectedSticker.id === 'poll'}
            <input type="text" bind:value={stickerConfig.question} placeholder="Escribe tu pregunta..." class="vs-input mb-2" maxlength="40" />
            <div class="flex gap-2">
              <input type="text" bind:value={stickerConfig.options[0]} placeholder="Opción 1" class="vs-input flex-1" />
              <input type="text" bind:value={stickerConfig.options[1]} placeholder="Opción 2" class="vs-input flex-1" />
            </div>
          {:else if selectedSticker.id === 'music'}
            <input type="text" bind:value={stickerConfig.value} placeholder="Buscar canción..." class="vs-input" />
          {:else}
            <input type="text" bind:value={stickerConfig.value} placeholder="Escribe algo aquí..." class="vs-input" />
          {/if}
        </div>
      {/if}

      <div style="flex: 1;"></div>

      <p class="text-xs text-muted mb-3 text-center">Tu historia será visible por 24 horas.</p>

      <button class="btn-aero-primary publish-btn" onclick={handlePublish} disabled={(!selectedFile && !overlayText && !selectedSticker) || uploading} aria-label="Action button">
        {#if uploading}
          <div class="loading-spinner"></div> Publicando...
        {:else}
          <span class="material-icons-round text-sm mr-2">send</span> Añadir a tu historia
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .creator-container {
    height: 100vh;
    background: var(--bg-canvas);
    overflow: hidden;
  }

  .creator-layout {
    display: flex;
    height: 100%;
  }

  /* ── 3-Column Layout ── */
  .tools-sidebar {
    width: 320px;
    background: var(--glass-bg);
    border-right: 1px solid var(--glass-border);
    display: flex;
    flex-direction: column;
    padding: 24px;
    border-radius: 0;
    overflow-y: auto;
  }

  .preview-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at center, rgba(108, 92, 231, 0.05) 0%, transparent 70%);
    position: relative;
    padding: 20px;
  }

  .details-section {
    width: 340px;
    background: var(--glass-bg);
    border-left: 1px solid var(--glass-border);
    display: flex;
    flex-direction: column;
    padding: 24px;
    border-radius: 0;
  }

  /* ── Left Tools Sidebar ── */
  .tools-header { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; color: var(--text-primary); }
  .tools-header h3 { margin: 0; font-family: var(--font-display); font-size: 1.2rem; }
  
  .tool-section { margin-bottom: 20px; }
  .tool-section .tool-title { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 12px; text-transform: uppercase; }
  
  .sticker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .sticker-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; border-radius: 12px; background: var(--bg-overlay); border: 1px solid var(--border-subtle); cursor: pointer; transition: all 0.2s; }
  .sticker-item:hover { background: var(--bg-surface2); border-color: var(--aero-blue); transform: translateY(-2px); }
  .sticker-item.selected { background: rgba(74, 171, 223, 0.15); border-color: var(--aero-blue); box-shadow: 0 4px 14px rgba(46, 134, 232, 0.25); transform: translateY(-2px); }
  .sticker-icon { font-size: 1.8rem; color: var(--aero-blue); margin-bottom: 4px; }
  .sticker-label { font-size: 0.8rem; font-weight: 700; color: var(--text-primary); }
  .sticker-desc { font-size: 0.6rem; color: var(--text-muted); text-align: center; line-height: 1.2; }

  .color-picker-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .color-swatch { width: 32px; height: 32px; border-radius: 50%; border: 3px solid transparent; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
  .color-swatch:hover { transform: scale(1.15); }
  .color-swatch.selected { border-color: #fff; box-shadow: 0 0 0 2px var(--aero-blue); transform: scale(1.1); }

  .color-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .color-dot { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
  .color-dot:hover { transform: scale(1.15); }
  .color-dot.selected { border-color: #fff; box-shadow: 0 0 0 2px var(--aero-blue); }

  /* ── Center Preview ── */
  .video-container {
    position: relative;
    height: 100%;
    max-height: 80vh;
    aspect-ratio: 9/16;
    border-radius: 28px;
    overflow: hidden;
    box-shadow: var(--glass-shadow), var(--glass-inset), 0 20px 50px rgba(0,0,0,0.3);
    transition: background 0.3s ease, border-color 0.3s ease;
    border: 1px solid var(--glass-border);
    border-top-color: var(--glass-border-t);
  }

  .video-container::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 100%);
    pointer-events: none;
    z-index: 8;
  }

  .backdrop-media {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(24px) brightness(0.4) saturate(1.3);
    transform: scale(1.15);
    z-index: 1;
    pointer-events: none;
  }
  .main-media { position: relative; width: 100%; height: 100%; object-fit: contain; z-index: 2; }
  
  .empty-state-prompt { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; z-index: 5; }
  .empty-state-prompt h2 { color: #fff; margin-top: 1.5rem; font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; }
  .empty-state-prompt p { color: rgba(255,255,255,0.6); font-size: 0.85rem; margin-top: 0.5rem; max-width: 220px; line-height: 1.4; }
  
  .upload-icon-pulse {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulseGlowWhite 2s infinite;
  }

  @keyframes pulseGlowWhite {
    0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.2); }
    70% { box-shadow: 0 0 0 15px rgba(255, 255, 255, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
  }

  .close-btn { position: absolute; top: 16px; left: 16px; background: rgba(0,0,0,0.5); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(10px); transition: background 0.2s; z-index: 10; }
  .close-btn:hover { background: rgba(0,0,0,0.8); }

  .media-text-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 2.2rem;
    pointer-events: none;
    text-align: center;
    width: 90%;
    letter-spacing: -0.02em;
    z-index: 5;
    transition: all 0.2s ease;
  }

  /* Font classes */
  .media-text-overlay.font-modern {
    font-family: var(--font-display);
    font-weight: 900;
    text-shadow: 0 2px 10px rgba(0,0,0,0.8);
  }
  .media-text-overlay.font-serif {
    font-family: 'Georgia', serif;
    font-style: italic;
    text-shadow: 0 2px 8px rgba(0,0,0,0.8);
  }
  .media-text-overlay.font-typewriter {
    font-family: 'Courier New', monospace;
    font-weight: bold;
    text-shadow: 0 2px 6px rgba(0,0,0,0.8);
  }
  .media-text-overlay.font-neon {
    font-family: var(--font-sans);
    font-weight: 800;
    text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 2px 5px rgba(0,0,0,0.6);
  }
  .media-text-overlay.font-cursive {
    font-family: cursive;
    font-weight: 600;
    text-shadow: 0 2px 8px rgba(0,0,0,0.8);
  }

  .media-text-overlay.has-bg {
    background: rgba(0, 0, 0, 0.62);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 10px 18px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    width: auto;
    max-width: 90%;
    box-sizing: border-box;
    text-shadow: none !important;
  }

  .sticker-preview-overlay {
    position: absolute;
    top: 25%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 6;
    width: 80%;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  /* Interactive Stickers widgets styling */
  .poll-sticker-widget {
    background: var(--glass-bg);
    backdrop-filter: blur(25px);
    -webkit-backdrop-filter: blur(25px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    padding: 16px;
    width: 100%;
    max-width: 220px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .poll-question {
    color: var(--text-primary);
    font-weight: 800;
    font-family: var(--font-display);
    font-size: 0.9rem;
    text-align: center;
    word-break: break-word;
  }
  .poll-answers {
    display: flex;
    gap: 8px;
    width: 100%;
  }
  .poll-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.9);
    color: #111;
    font-weight: 800;
    font-size: 0.85rem;
    padding: 10px;
    border-radius: var(--radius-sm);
    text-align: center;
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  }

  .location-sticker-widget {
    background: #fff;
    color: #2E86E8;
    padding: 10px 18px;
    border-radius: 30px;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 8px 24px rgba(46,134,232,0.3);
  }

  .mention-sticker-widget {
    background: linear-gradient(135deg, #00E5FF 0%, #2E86E8 100%);
    color: #fff;
    padding: 10px 20px;
    border-radius: 30px;
    box-shadow: 0 8px 24px rgba(0, 229, 255, 0.3);
  }

  .hashtag-sticker-widget {
    background: linear-gradient(135deg, #FF6B6B 0%, #E84A72 100%);
    color: #fff;
    padding: 10px 20px;
    border-radius: 30px;
    box-shadow: 0 8px 24px rgba(232, 74, 114, 0.3);
  }

  .music-sticker-widget {
    background: var(--glass-bg);
    backdrop-filter: blur(25px);
    -webkit-backdrop-filter: blur(25px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 12px;
    width: 100%;
    max-width: 220px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.25);
  }
  .spinning-music-icon {
    font-size: 28px;
    color: var(--aero-blue);
    animation: rotateVinyl 4s linear infinite;
  }
  .music-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .music-title {
    font-weight: 800;
    font-size: 0.82rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .music-artist {
    font-size: 0.68rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  @keyframes rotateVinyl {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .font-selector-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .font-chip {
    padding: 6px 12px;
    border-radius: 20px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--glass-border);
    color: var(--text-primary);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .font-chip:hover {
    background: rgba(255,255,255,0.08);
  }
  .font-chip.selected {
    background: rgba(74, 171, 223, 0.2);
    border-color: var(--aero-blue);
    color: var(--aero-sky);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin-top: 10px;
  }
  .toggle-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .vs-checkbox {
    width: 15px;
    height: 15px;
    accent-color: var(--aero-blue);
    cursor: pointer;
  }

  .slide-in { animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
  @keyframes slideIn { from { opacity: 0; transform: translate(-50%, -20px) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }

  /* ── Right Details ── */
  .details-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .details-header h3 { margin: 0; font-family: var(--font-display); font-size: 1.3rem; flex: 1; }
  .back-link { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.05); color: var(--text-primary); text-decoration: none; transition: background 0.2s; }
  .back-link:hover { background: rgba(255,255,255,0.1); }
  
  .ephemeral-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; background: rgba(232, 74, 114, 0.1); border: 1px solid rgba(232, 74, 114, 0.3); color: var(--aero-rose); font-size: 0.7rem; font-weight: 700; animation: pulseGlow 3s infinite; }

  .sticker-config-panel { background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 12px; padding: 14px; margin-bottom: 20px; }
  .sticker-config-header { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-subtle); }
  .sticker-remove-btn { margin-left: auto; width: 24px; height: 24px; border-radius: 50%; background: rgba(232, 74, 114, 0.1); border: none; color: var(--aero-rose); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
  .sticker-remove-btn:hover { background: rgba(232, 74, 114, 0.2); transform: scale(1.1); }

  .publish-btn { width: 100%; padding: 16px; font-size: 1.05rem; border-radius: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .loading-spinner { display: inline-block; width: 18px; height: 18px; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.75s linear infinite; margin-right: 8px; }
  
  .error-bar { background: rgba(232, 74, 114, 0.1); color: var(--aero-rose); padding: 12px; border-radius: 12px; margin-bottom: 16px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; }

  @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(232, 74, 114, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(232, 74, 114, 0); } 100% { box-shadow: 0 0 0 0 rgba(232, 74, 114, 0); } }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 1000px) {
    .creator-layout { flex-direction: column; overflow-y: auto; }
    .tools-sidebar, .details-section { width: 100%; border: none; border-bottom: 1px solid var(--glass-border); }
    .preview-section { padding: 40px 20px; }
  }
</style>
