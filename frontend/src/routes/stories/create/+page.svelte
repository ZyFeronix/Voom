<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { stories as storiesApi } from '$lib/api.js';
  import { authStore } from '$lib/stores/auth.svelte.js';

  // ── Estado principal ──────────────────────────────────────────────────────
  let selectedFile = $state(null);
  let preview      = $state(null);
  let previewType  = $state('image'); // 'image' | 'video'
  let uploading    = $state(false);
  let error        = $state('');
  let success      = $state(false);
  let isDragging   = $state(false);

  // ── Configuración de la historia ─────────────────────────────────────────
  let caption       = $state('');
  let bgColor       = $state('#1B85F3');
  let textColor     = $state('#FFFFFF');
  let selectedFont  = $state('modern');
  let textBg        = $state(false);

  const BG_COLORS = [
    '#1B85F3', '#00E5FF', '#6C5CE7', '#E84A72',
    '#00B894', '#FDCB6E', '#FF6B6B', '#2d3436',
    '#0984e3', '#e17055'
  ];

  const TEXT_COLORS = ['#FFFFFF', '#111111', '#1B85F3', '#E84A72', '#FDCB6E', '#00E5FF'];

  const FONTS = [
    { id: 'modern',      label: 'Moderno',      style: 'font-family: var(--font-display); font-weight: 900;' },
    { id: 'serif',       label: 'Elegante',     style: 'font-family: Georgia, serif; font-style: italic;' },
    { id: 'typewriter',  label: 'Máquina',      style: 'font-family: "Courier New", monospace; font-weight: bold;' },
    { id: 'neon',        label: 'Neón',         style: 'font-family: var(--font-sans); font-weight: 800;' },
    { id: 'cursive',     label: 'Cursiva',      style: 'font-family: cursive; font-weight: 600;' }
  ];

  // ── Refs ──────────────────────────────────────────────────────────────────
  let fileInput;

  // ── Derived ───────────────────────────────────────────────────────────────
  const canPublish = $derived(
    (selectedFile !== null || caption.trim().length > 0) && !uploading
  );

  const currentFont = $derived(
    FONTS.find(f => f.id === selectedFont) ?? FONTS[0]
  );

  const textOverlayStyle = $derived(
    `color: ${textColor}; ${currentFont.style}` +
    (textBg
      ? ' background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); padding: 10px 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12);'
      : ` text-shadow: 0 2px 12px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.8);`)
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(() => {
    if (!authStore.isAuthenticated) goto('/login');
  });

  // ── Handlers de archivo ───────────────────────────────────────────────────
  function processFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      error = 'Solo se permiten imágenes o videos.';
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      error = 'El archivo no puede superar los 100 MB.';
      return;
    }
    error = '';
    selectedFile = file;
    previewType  = file.type.startsWith('video/') ? 'video' : 'image';
    if (preview) URL.revokeObjectURL(preview);
    preview = URL.createObjectURL(file);
  }

  function handleFileInput(e) {
    processFile(e.target.files?.[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    isDragging = false;
    processFile(e.dataTransfer?.files?.[0]);
  }

  function handleDragOver(e) {
    e.preventDefault();
    isDragging = true;
  }

  function clearMedia() {
    selectedFile = null;
    if (preview) URL.revokeObjectURL(preview);
    preview = null;
    fileInput.value = '';
  }

  // ── Publicar ──────────────────────────────────────────────────────────────
  async function handlePublish() {
    if (!canPublish) return;
    uploading = true;
    error = '';

    try {
      const fd = new FormData();
      if (selectedFile) fd.append('media', selectedFile);
      fd.append('caption', caption.trim());
      fd.append('background_color', bgColor);
      // Enviamos los metadatos de texto como un JSON extra para si en el futuro se renderiza server-side
      fd.append('text_meta', JSON.stringify({
        color: textColor,
        font: selectedFont,
        bg: textBg
      }));

      await storiesApi.create(fd);
      success = true;
      setTimeout(() => goto('/feed'), 1200);
    } catch (err) {
      error = err?.message || 'Error al publicar la historia. Intenta de nuevo.';
      uploading = false;
    }
  }
</script>

<svelte:head>
  <title>Nueva Historia — VSocial</title>
  <meta name="description" content="Crea y comparte una historia en VSocial. Visible por 24 horas." />
</svelte:head>

<div class="sc-root">
  <!-- ── Barra Superior ────────────────────────────────────────────────── -->
  <header class="sc-topbar glass-panel">
    <a href="/feed" class="sc-back" aria-label="Volver al feed">
      <span class="material-icons-round">arrow_back</span>
    </a>
    <div class="sc-topbar-center">
      <span class="material-icons-round sc-topbar-icon">amp_stories</span>
      <h1 class="sc-topbar-title">Nueva Historia</h1>
      <span class="sc-badge-24h">
        <span class="material-icons-round">timer</span>24h
      </span>
    </div>
    <button
      class="sc-publish-btn"
      onclick={handlePublish}
      disabled={!canPublish}
      aria-label="Publicar historia"
    >
      {#if uploading}
        <span class="sc-spinner"></span>
      {:else if success}
        <span class="material-icons-round">check</span>
      {:else}
        <span class="material-icons-round">send</span>
        <span class="sc-publish-label">Publicar</span>
      {/if}
    </button>
  </header>

  <div class="sc-body">
    <!-- ── Panel de Herramientas (Izquierda) ─────────────────────────── -->
    <aside class="sc-tools glass-panel">
      <section class="sc-section">
        <p class="sc-section-title">
          <span class="material-icons-round">image</span>
          Contenido
        </p>

        <!-- Drop zone -->
        {#if !preview}
          <div
            class="sc-dropzone"
            class:dragging={isDragging}
            role="button"
            tabindex="0"
            onclick={() => fileInput.click()}
            onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
            ondrop={handleDrop}
            ondragover={handleDragOver}
            ondragleave={() => isDragging = false}
          >
            <span class="material-icons-round sc-dz-icon">cloud_upload</span>
            <p class="sc-dz-text">Arrastra aquí o haz clic</p>
            <p class="sc-dz-hint">Imagen o video · Máx. 100 MB</p>
          </div>
        {:else}
          <div class="sc-file-chip">
            <span class="material-icons-round sc-fc-icon">{previewType === 'video' ? 'videocam' : 'image'}</span>
            <span class="sc-fc-name">{selectedFile?.name}</span>
            <button class="sc-fc-remove" onclick={clearMedia} aria-label="Quitar archivo">
              <span class="material-icons-round">close</span>
            </button>
          </div>
        {/if}

        <input
          type="file"
          bind:this={fileInput}
          accept="image/*,video/*"
          style="display:none"
          onchange={handleFileInput}
        />
      </section>

      <!-- Fondo (solo sin media, o con media para tinting) -->
      {#if !preview || previewType !== 'video'}
      <section class="sc-section">
        <p class="sc-section-title">
          <span class="material-icons-round">palette</span>
          {preview ? 'Fondo de Texto' : 'Color de Fondo'}
        </p>
        <div class="sc-color-row">
          {#each BG_COLORS as c}
            <button
              class="sc-color-swatch"
              class:active={bgColor === c}
              style="background:{c}"
              onclick={() => bgColor = c}
              aria-label="Color {c}"
            ></button>
          {/each}
        </div>
      </section>
      {/if}

      <!-- Texto / Caption -->
      <section class="sc-section">
        <p class="sc-section-title">
          <span class="material-icons-round">text_format</span>
          Mensaje
        </p>
        <textarea
          class="sc-textarea"
          bind:value={caption}
          placeholder="¿Qué está pasando? (opcional)"
          maxlength="80"
          rows="3"
        ></textarea>
        <p class="sc-char-count">{caption.length}/80</p>

        <!-- Color de texto -->
        {#if caption.trim()}
        <div class="sc-subsection">
          <p class="sc-sub-label">Color del texto</p>
          <div class="sc-color-row">
            {#each TEXT_COLORS as c}
              <button
                class="sc-color-dot"
                class:active={textColor === c}
                style="background:{c}"
                onclick={() => textColor = c}
                aria-label="Color texto {c}"
              ></button>
            {/each}
          </div>
        </div>

        <!-- Estilo de fuente -->
        <div class="sc-subsection">
          <p class="sc-sub-label">Estilo de fuente</p>
          <div class="sc-font-chips">
            {#each FONTS as f}
              <button
                class="sc-font-chip"
                class:active={selectedFont === f.id}
                onclick={() => selectedFont = f.id}
              >{f.label}</button>
            {/each}
          </div>
        </div>

        <!-- Resaltado -->
        <label class="sc-toggle">
          <input type="checkbox" bind:checked={textBg} />
          <span class="sc-toggle-track"></span>
          <span class="sc-toggle-label">Resaltar texto</span>
        </label>
        {/if}
      </section>
    </aside>

    <!-- ── Vista Previa Central ──────────────────────────────────────── -->
    <main class="sc-preview-area">
      <div
        class="sc-phone-frame"
        style="background: {preview ? '#000' : bgColor}"
        ondrop={handleDrop}
        ondragover={handleDragOver}
        ondragleave={() => isDragging = false}
        role="presentation"
      >

        <!-- Estado vacío: sin media ni caption -->
        {#if !preview && !caption.trim()}
          <div class="sc-empty" onclick={() => fileInput.click()} role="button" tabindex="0">
            <div class="sc-empty-icon">
              <span class="material-icons-round">add_photo_alternate</span>
            </div>
            <p class="sc-empty-hint">Toca para añadir<br/>una foto o video</p>
          </div>

        {:else}
          <!-- Media con fondo desenfocado -->
          {#if preview}
            {#if previewType === 'video'}
              <video
                src={preview}
                class="sc-backdrop"
                muted
                loop
                autoplay
                playsinline
              ></video>
              <video
                src={preview}
                class="sc-main-media"
                controls
                loop
                playsinline
              ></video>
            {:else}
              <img src={preview} alt="" class="sc-backdrop" />
              <img src={preview} alt="Preview de la historia" class="sc-main-media" />
            {/if}

            <!-- Botón quitar media dentro del frame -->
            <button class="sc-remove-media" onclick={clearMedia} aria-label="Quitar media">
              <span class="material-icons-round">close</span>
            </button>
          {/if}

          <!-- Overlay de texto -->
          {#if caption.trim()}
            <div class="sc-text-overlay" style={textOverlayStyle}>
              {caption}
            </div>
          {/if}
        {/if}

        <!-- Gradiente superior decorativo -->
        <div class="sc-top-gradient" aria-hidden="true"></div>

        <!-- Indicador de duración -->
        <div class="sc-duration-pill" aria-hidden="true">
          <span class="material-icons-round">timer</span> 24h
        </div>

      </div>

      <p class="sc-preview-hint">Vista previa de la historia</p>
    </main>

    <!-- ── Panel Derecho: Resumen y Publicación ───────────────────────── -->
    <aside class="sc-info glass-panel">
      <div class="sc-info-author">
        {#if authStore.user?.avatar_url}
          <img src={authStore.user.avatar_url} alt="Avatar" class="sc-avatar" />
        {:else}
          <div class="sc-avatar sc-avatar-fallback">
            {(authStore.user?.display_name?.[0] ?? 'U').toUpperCase()}
          </div>
        {/if}
        <div class="sc-info-name">
          <span class="sc-info-display">{authStore.user?.display_name ?? 'Tú'}</span>
          <span class="sc-info-username">@{authStore.user?.username ?? 'usuario'}</span>
        </div>
      </div>

      <div class="sc-info-rows">
        <div class="sc-info-row">
          <span class="material-icons-round sc-ir-icon">visibility</span>
          <div>
            <span class="sc-ir-label">Visibilidad</span>
            <span class="sc-ir-value">Todos tus seguidores</span>
          </div>
        </div>
        <div class="sc-info-row">
          <span class="material-icons-round sc-ir-icon">schedule</span>
          <div>
            <span class="sc-ir-label">Duración</span>
            <span class="sc-ir-value">24 horas</span>
          </div>
        </div>
        <div class="sc-info-row">
          <span class="material-icons-round sc-ir-icon">
            {selectedFile ? (previewType === 'video' ? 'videocam' : 'image') : 'text_fields'}
          </span>
          <div>
            <span class="sc-ir-label">Tipo</span>
            <span class="sc-ir-value">
              {selectedFile ? (previewType === 'video' ? 'Video' : 'Imagen') : (caption.trim() ? 'Solo texto' : '—')}
            </span>
          </div>
        </div>
      </div>

      <!-- Error -->
      {#if error}
        <div class="sc-error" role="alert">
          <span class="material-icons-round">error_outline</span>
          <span>{error}</span>
        </div>
      {/if}

      <!-- Éxito -->
      {#if success}
        <div class="sc-success" role="status">
          <span class="material-icons-round">check_circle</span>
          <span>¡Historia publicada! Redirigiendo...</span>
        </div>
      {/if}

      <div class="sc-spacer"></div>

      <p class="sc-disclaimer">Tu historia desaparecerá automáticamente en 24 horas. No aparecerá en tu perfil permanente.</p>

      <button
        class="sc-submit"
        onclick={handlePublish}
        disabled={!canPublish}
        aria-label="Añadir a historia"
      >
        {#if uploading}
          <span class="sc-spinner"></span>
          Publicando...
        {:else if success}
          <span class="material-icons-round">check</span>
          ¡Publicada!
        {:else}
          <span class="material-icons-round">send</span>
          Añadir a tu historia
        {/if}
      </button>
    </aside>
  </div>
</div>

<style>
  /* ── Layout base ─────────────────────────────────────────────── */
  .sc-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-canvas);
    font-family: var(--font-sans);
  }

  /* ── Topbar ──────────────────────────────────────────────────── */
  .sc-topbar {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    border-radius: 0;
    border-bottom: 1px solid var(--glass-border);
    gap: 12px;
    flex-shrink: 0;
    z-index: 10;
  }

  .sc-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    text-decoration: none;
    flex-shrink: 0;
    transition: background 0.2s, transform 0.2s;
  }
  .sc-back:hover { background: var(--bg-surface2); transform: scale(1.05); }

  .sc-topbar-center {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .sc-topbar-icon { color: var(--aero-blue); font-size: 20px; }

  .sc-topbar-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    font-family: var(--font-display);
    color: var(--text-primary);
  }

  .sc-badge-24h {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 8px;
    border-radius: 20px;
    background: rgba(232, 74, 114, 0.1);
    border: 1px solid rgba(232, 74, 114, 0.3);
    color: var(--aero-rose, #e84a72);
    font-size: 0.65rem;
    font-weight: 700;
  }
  .sc-badge-24h .material-icons-round { font-size: 12px; }

  .sc-publish-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border-radius: 20px;
    background: var(--grad-primary, linear-gradient(135deg, #1B85F3, #00E5FF));
    border: none;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 14px rgba(27, 133, 243, 0.35);
    flex-shrink: 0;
  }
  .sc-publish-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
  .sc-publish-btn:not(:disabled):hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(27, 133, 243, 0.45); }

  .sc-publish-label { display: none; }
  @media (min-width: 640px) { .sc-publish-label { display: inline; } }

  /* ── 3-Columnas ──────────────────────────────────────────────── */
  .sc-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ── Sidebar Izquierda: Herramientas ────────────────────────── */
  .sc-tools {
    width: 300px;
    flex-shrink: 0;
    border-radius: 0;
    border-right: 1px solid var(--glass-border);
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    scrollbar-width: thin;
  }

  .sc-section {
    padding: 16px 0;
    border-bottom: 1px solid var(--border-subtle);
  }
  .sc-section:last-child { border-bottom: none; }

  .sc-section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 12px;
  }
  .sc-section-title .material-icons-round { font-size: 14px; color: var(--aero-blue); }

  /* Drop zone */
  .sc-dropzone {
    border: 2px dashed var(--border-subtle);
    border-radius: 14px;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    text-align: center;
  }
  .sc-dropzone:hover,
  .sc-dropzone.dragging {
    border-color: var(--aero-blue);
    background: rgba(27, 133, 243, 0.06);
  }
  .sc-dz-icon { font-size: 2rem; color: var(--aero-blue); opacity: 0.7; }
  .sc-dz-text { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin: 0; }
  .sc-dz-hint { font-size: 0.72rem; color: var(--text-muted); margin: 0; }

  /* File chip — muestra el archivo seleccionado */
  .sc-file-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(27, 133, 243, 0.08);
    border: 1px solid rgba(27, 133, 243, 0.2);
  }
  .sc-fc-icon { font-size: 18px; color: var(--aero-blue); }
  .sc-fc-name {
    flex: 1;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sc-fc-remove {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 50%;
    transition: color 0.2s, background 0.2s;
  }
  .sc-fc-remove:hover { color: var(--aero-rose, #e84a72); background: rgba(232,74,114,0.1); }
  .sc-fc-remove .material-icons-round { font-size: 16px; }

  /* Colores */
  .sc-color-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .sc-color-swatch {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .sc-color-swatch:hover { transform: scale(1.15); }
  .sc-color-swatch.active {
    border-color: #fff;
    box-shadow: 0 0 0 2px var(--aero-blue), 0 4px 12px rgba(0,0,0,0.3);
    transform: scale(1.1);
  }

  .sc-color-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.18s, box-shadow 0.18s;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  }
  .sc-color-dot:hover { transform: scale(1.2); }
  .sc-color-dot.active { border-color: #fff; box-shadow: 0 0 0 2px var(--aero-blue); transform: scale(1.1); }

  /* Textarea */
  .sc-textarea {
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    font-size: 0.85rem;
    font-family: var(--font-sans);
    resize: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .sc-textarea:focus {
    outline: none;
    border-color: var(--aero-blue);
    box-shadow: 0 0 0 3px rgba(27, 133, 243, 0.15);
  }
  .sc-char-count { font-size: 0.68rem; color: var(--text-muted); margin: 4px 0 0; text-align: right; }

  .sc-subsection { margin-top: 12px; }
  .sc-sub-label { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); margin: 0 0 8px; }

  /* Chips de fuente */
  .sc-font-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .sc-font-chip {
    padding: 5px 11px;
    border-radius: 20px;
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }
  .sc-font-chip:hover { background: var(--bg-surface2); }
  .sc-font-chip.active {
    background: rgba(27, 133, 243, 0.15);
    border-color: var(--aero-blue);
    color: var(--aero-sky, #00E5FF);
  }

  /* Toggle resaltado */
  .sc-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin-top: 12px;
  }
  .sc-toggle input { display: none; }
  .sc-toggle-track {
    width: 34px;
    height: 18px;
    border-radius: 9px;
    background: var(--border-subtle);
    position: relative;
    transition: background 0.25s;
    flex-shrink: 0;
  }
  .sc-toggle-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .sc-toggle input:checked ~ .sc-toggle-track { background: var(--aero-blue); }
  .sc-toggle input:checked ~ .sc-toggle-track::after { transform: translateX(16px); }
  .sc-toggle-label { font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); }

  /* ── Centro: Vista Previa ─────────────────────────────────────── */
  .sc-preview-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    gap: 12px;
    background: radial-gradient(ellipse at center, rgba(27, 133, 243, 0.04) 0%, transparent 70%);
    overflow: hidden;
  }

  .sc-phone-frame {
    position: relative;
    width: 100%;
    max-width: 280px;
    aspect-ratio: 9 / 16;
    border-radius: 24px;
    overflow: hidden;
    border: 1px solid var(--glass-border);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.06) inset,
      0 20px 60px rgba(0,0,0,0.35),
      0 8px 20px rgba(0,0,0,0.2);
    transition: background 0.4s ease;
  }

  /* Backdrop desenfocado */
  .sc-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(20px) brightness(0.35) saturate(1.4);
    transform: scale(1.1);
    z-index: 1;
    pointer-events: none;
  }

  /* Media principal */
  .sc-main-media {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    z-index: 2;
    display: block;
  }

  /* Overlay de texto */
  .sc-text-overlay {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    text-align: center;
    width: 86%;
    font-size: 1.3rem;
    line-height: 1.3;
    word-break: break-word;
    pointer-events: none;
    animation: scTextIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes scTextIn {
    from { opacity: 0; transform: translateX(-50%) scale(0.88); }
    to   { opacity: 1; transform: translateX(-50%) scale(1); }
  }

  /* Estado vacío */
  .sc-empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    cursor: pointer;
    z-index: 3;
  }
  .sc-empty-icon {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: scPulse 2.5s infinite;
  }
  .sc-empty-icon .material-icons-round { font-size: 2.2rem; color: #fff; }
  .sc-empty-hint {
    color: rgba(255,255,255,0.75);
    font-size: 0.82rem;
    font-weight: 600;
    text-align: center;
    line-height: 1.5;
    margin: 0;
  }
  @keyframes scPulse {
    0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.25); }
    70%  { box-shadow: 0 0 0 14px rgba(255,255,255,0); }
    100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
  }

  /* Gradiente superior decorativo */
  .sc-top-gradient {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 35%;
    background: linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%);
    z-index: 4;
    pointer-events: none;
  }

  /* Píldora de duración */
  .sc-duration-pill {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 8px;
    border-radius: 20px;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(10px);
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    z-index: 6;
  }
  .sc-duration-pill .material-icons-round { font-size: 11px; }

  /* Botón quitar media dentro del frame */
  .sc-remove-media {
    position: absolute;
    top: 10px;
    left: 10px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(10px);
    border: none;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 7;
    transition: background 0.2s, transform 0.2s;
  }
  .sc-remove-media:hover { background: rgba(232,74,114,0.7); transform: scale(1.08); }
  .sc-remove-media .material-icons-round { font-size: 16px; }

  .sc-preview-hint {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin: 0;
    text-align: center;
  }

  /* ── Panel Derecho ───────────────────────────────────────────── */
  .sc-info {
    width: 280px;
    flex-shrink: 0;
    border-radius: 0;
    border-left: 1px solid var(--glass-border);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .sc-info-author {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 16px;
  }

  .sc-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--glass-border);
    flex-shrink: 0;
  }
  .sc-avatar-fallback {
    background: var(--grad-primary, linear-gradient(135deg, #1B85F3, #00E5FF));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 800;
    font-size: 1.1rem;
  }
  .sc-info-name { display: flex; flex-direction: column; }
  .sc-info-display { font-size: 0.88rem; font-weight: 700; color: var(--text-primary); }
  .sc-info-username { font-size: 0.75rem; color: var(--text-muted); }

  .sc-info-rows { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
  .sc-info-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
  }
  .sc-ir-icon { font-size: 18px; color: var(--aero-blue); flex-shrink: 0; }
  .sc-info-row > div { display: flex; flex-direction: column; }
  .sc-ir-label { font-size: 0.65rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .sc-ir-value { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); }

  /* Error / Éxito */
  .sc-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(232,74,114,0.1);
    border: 1px solid rgba(232,74,114,0.25);
    color: var(--aero-rose, #e84a72);
    font-size: 0.82rem;
    font-weight: 500;
    margin-bottom: 12px;
  }
  .sc-error .material-icons-round { font-size: 18px; flex-shrink: 0; }

  .sc-success {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(0,184,148,0.1);
    border: 1px solid rgba(0,184,148,0.25);
    color: #00b894;
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 12px;
    animation: scTextIn 0.35s ease;
  }
  .sc-success .material-icons-round { font-size: 18px; flex-shrink: 0; }

  .sc-spacer { flex: 1; }

  .sc-disclaimer {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-align: center;
    margin: 0 0 14px;
    line-height: 1.5;
  }

  /* Botón principal de publicar */
  .sc-submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px;
    border-radius: 14px;
    background: var(--grad-primary, linear-gradient(135deg, #1B85F3, #00E5FF));
    border: none;
    color: #fff;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(27, 133, 243, 0.35);
    transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
  }
  .sc-submit:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
  .sc-submit:not(:disabled):hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 8px 28px rgba(27, 133, 243, 0.45); }
  .sc-submit:not(:disabled):active { transform: scale(0.97); }

  /* Spinner */
  .sc-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: scSpin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes scSpin { to { transform: rotate(360deg); } }

  /* ── Responsive ──────────────────────────────────────────────── */
  @media (max-width: 1024px) {
    .sc-info { width: 240px; }
    .sc-tools { width: 260px; }
  }

  @media (max-width: 768px) {
    .sc-body {
      flex-direction: column;
      overflow-y: auto;
    }
    .sc-tools {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--glass-border);
      max-height: 50vh;
    }
    .sc-preview-area {
      padding: 16px;
      min-height: 60vw;
    }
    .sc-phone-frame {
      max-width: 200px;
    }
    .sc-info {
      width: 100%;
      border-left: none;
      border-top: 1px solid var(--glass-border);
    }
  }
</style>
