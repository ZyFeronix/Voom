<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { posts as postsApi } from '$lib/api.js';
  import { authStore } from '$lib/stores/auth.svelte.js';
  import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
  import KlipyPicker from '$lib/components/KlipyPicker.svelte';
  import CustomSelect from '$lib/components/CustomSelect.svelte';

  // ── Estado del contenido ────────────────────────────────────────────────
  let bodyText     = $state('');
  let selectedFiles = $state([]);   // File[]
  let uploadedMedia = $state([]);   // { url, type, klipy? }[]
  let privacy      = $state('public');
  let mood         = $state('');
  let posting      = $state(false);
  let error        = $state('');
  let dragOver     = $state(false);

  // ── Paneles activos ─────────────────────────────────────────────────────
  let activePanel = $state('');  // '' | 'emoji' | 'gif' | 'poll' | 'location' | 'schedule'

  // ── Poll ─────────────────────────────────────────────────────────────────
  let pollQuestion = $state('');
  let pollOptions  = $state(['', '']);
  let pollDuration = $state(24);
  const pollDurations = [
    { value: 1,   label: '1 hora' },
    { value: 6,   label: '6 horas' },
    { value: 24,  label: '24 horas' },
    { value: 72,  label: '3 días' },
    { value: 168, label: '7 días' }
  ];

  // ── Ubicación ─────────────────────────────────────────────────────────────
  let locationName  = $state('');
  let locationQuery = $state('');

  // ── Programación ─────────────────────────────────────────────────────────
  let scheduledAt  = $state('');
  let isScheduled  = $state(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  let fileInput;

  // ── Constantes ────────────────────────────────────────────────────────────
  const moods = [
    { id: 'happy',       label: 'Feliz',       icon: '😄' },
    { id: 'creative',    label: 'Creativo',    icon: '🎨' },
    { id: 'gaming',      label: 'Jugando',     icon: '🎮' },
    { id: 'music',       label: 'Música',      icon: '🎵' },
    { id: 'thinking',    label: 'Pensando',    icon: '🤔' },
    { id: 'excited',     label: 'Emocionado',  icon: '🔥' },
    { id: 'traveling',   label: 'Viajando',    icon: '✈️' },
    { id: 'celebrating', label: 'Celebrando',  icon: '🥳' },
    { id: 'working',     label: 'Trabajando',  icon: '💻' },
    { id: 'eating',      label: 'Comiendo',    icon: '🍔' }
  ];

  const privacyOptions = [
    { value: 'public',    label: 'Público' },
    { value: 'followers', label: 'Solo seguidores' },
    { value: 'private',   label: 'Privado' }
  ];

  const DOCK_ACTIONS = [
    { id: 'emoji',    icon: 'emoji_emotions', label: 'Emoji',    color: 'amber' },
    { id: 'gif',      icon: 'gif_box',         label: 'GIF',      color: 'fuchsia' },
    { id: 'poll',     icon: 'poll',            label: 'Encuesta', color: 'emerald' },
    { id: 'location', icon: 'location_on',     label: 'Ubicación', color: 'sky' },
    { id: 'schedule', icon: 'schedule',        label: 'Programar', color: 'indigo' }
  ];

  // ── Derived ───────────────────────────────────────────────────────────────
  const canPost = $derived(
    bodyText.trim().length > 0 ||
    selectedFiles.length > 0   ||
    uploadedMedia.length > 0   ||
    pollQuestion.trim().length > 0
  );

  const totalMedia = $derived(selectedFiles.length + uploadedMedia.length);

  const selectedMood = $derived(moods.find(m => m.id === mood) ?? null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(() => {
    if (!authStore.isAuthenticated) goto('/login');
  });

  // ── Helpers de archivo ────────────────────────────────────────────────────
  function processFiles(rawFiles) {
    const allowed = Array.from(rawFiles).filter(
      f => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    selectedFiles = [...selectedFiles, ...allowed];
  }

  function handleFiles(e) { processFiles(e.target.files || []); }
  function handleDrop(e) {
    e.preventDefault();
    dragOver = false;
    processFiles(e.dataTransfer?.files || []);
  }
  function removeFile(idx) { selectedFiles = selectedFiles.filter((_, i) => i !== idx); }
  function removeUploadedMedia(idx) { uploadedMedia = uploadedMedia.filter((_, i) => i !== idx); }

  // ── Helpers de Poll ───────────────────────────────────────────────────────
  function addPollOption() { if (pollOptions.length < 6) pollOptions = [...pollOptions, '']; }
  function removePollOption(idx) {
    if (pollOptions.length > 2) pollOptions = pollOptions.filter((_, i) => i !== idx);
  }
  function updatePollOption(idx, val) {
    pollOptions = pollOptions.map((o, i) => i === idx ? val : o);
  }

  // ── Toggle panel ─────────────────────────────────────────────────────────
  function togglePanel(id) { activePanel = activePanel === id ? '' : id; }

  // ── Publicar ──────────────────────────────────────────────────────────────
  async function handlePost() {
    if (!canPost || posting) return;
    posting = true;
    error = '';

    try {
      let media = [...uploadedMedia];
      if (selectedFiles.length > 0) {
        const fd = new FormData();
        selectedFiles.forEach(f => fd.append('media', f));
        const res = await postsApi.uploadMedia(fd);
        media = [...media, ...(res.media || [])];
      }

      const postData = {
        body: bodyText.trim(),
        media_urls: media,
        privacy,
        mood: mood || null,
        scheduled_at: isScheduled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        location_name: locationName || null
      };

      if (activePanel === 'poll' && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) {
        postData.poll = {
          question: pollQuestion.trim(),
          options:  pollOptions.filter(o => o.trim()),
          duration_hours: pollDuration
        };
      }

      await postsApi.create(postData);
      goto('/feed');
    } catch (err) {
      error = err?.message || 'Error al publicar.';
    } finally {
      posting = false;
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlePost();
    }
  }

  // ── URL de objeto para previews (revocar al desmontar no es crítico en esta page) ──
  function objectUrl(file) { return URL.createObjectURL(file); }
</script>

<svelte:head>
  <title>Nueva Publicación — VSocial</title>
  <meta name="description" content="Crea y comparte una publicación en VSocial." />
</svelte:head>

<div class="pc-root">
  <div class="pc-layout">

    <!-- ── Columna Izquierda: Editor ────────────────────────────────── -->
    <aside class="pc-editor glass-panel">

      <!-- Header -->
      <div class="pc-editor-header">
        <a href="/feed" class="pc-back" aria-label="Volver al feed">
          <span class="material-icons-round">arrow_back</span>
        </a>
        <h1 class="pc-editor-title">Nueva Publicación</h1>
      </div>

      <!-- Error -->
      {#if error}
        <div class="pc-error" role="alert">
          <span class="material-icons-round">error_outline</span>
          <span>{error}</span>
          <button onclick={() => error = ''} aria-label="Cerrar error">
            <span class="material-icons-round">close</span>
          </button>
        </div>
      {/if}

      <!-- Textarea principal -->
      <div class="pc-compose-box glass-card">
        {#if authStore.user?.avatar_url}
          <img src={authStore.user.avatar_url} alt="" class="pc-composer-avatar" />
        {:else}
          <div class="pc-composer-avatar pc-avatar-fallback">
            {(authStore.user?.display_name?.[0] ?? 'U').toUpperCase()}
          </div>
        {/if}
        <textarea
          id="post-body-input"
          bind:value={bodyText}
          onkeydown={handleKeyDown}
          placeholder="¿Qué está pasando en tu mundo?"
          class="pc-textarea"
          rows="5"
          aria-label="Contenido de la publicación"
        ></textarea>
      </div>

      <!-- Dock de acciones -->
      <div class="pc-dock">
        {#each DOCK_ACTIONS as action}
          <button
            type="button"
            class="pc-dock-btn"
            class:active={activePanel === action.id}
            onclick={() => togglePanel(action.id)}
            aria-label={action.label}
            aria-pressed={activePanel === action.id}
          >
            <span class="pc-dock-icon {action.color} material-icons-round">{action.icon}</span>
            <span class="pc-dock-label">{action.label}</span>
            {#if activePanel === action.id}
              <span class="pc-dock-pip" aria-hidden="true"></span>
            {/if}
          </button>
        {/each}
      </div>

      <!-- ── Paneles expandibles ──────────────────────────────────── -->

      {#if activePanel === 'emoji'}
        <div class="pc-panel">
          <TwemojiPicker
            onClose={() => activePanel = ''}
            onSelect={(emoji) => { bodyText += emoji; activePanel = ''; }}
          />
        </div>
      {/if}

      {#if activePanel === 'gif'}
        <div class="pc-panel">
          <KlipyPicker
            onClose={() => activePanel = ''}
            onSelect={(url) => {
              uploadedMedia = [...uploadedMedia, { url, type: 'image', klipy: true }];
              activePanel = '';
            }}
          />
        </div>
      {/if}

      {#if activePanel === 'poll'}
        <div class="pc-panel pc-panel-form">
          <div class="pc-panel-header">
            <span class="material-icons-round pc-panel-icon emerald">poll</span>
            <span class="pc-panel-title">Crear Encuesta</span>
            <button class="pc-panel-close" onclick={() => activePanel = ''} aria-label="Cerrar">
              <span class="material-icons-round">close</span>
            </button>
          </div>

          <input
            type="text"
            bind:value={pollQuestion}
            placeholder="Haz una pregunta..."
            class="pc-input"
            maxlength="100"
          />

          <div class="pc-poll-options">
            {#each pollOptions as opt, i}
              <div class="pc-poll-row">
                <span class="pc-poll-num">{i + 1}</span>
                <input
                  type="text"
                  value={opt}
                  oninput={(e) => updatePollOption(i, e.target.value)}
                  placeholder="Opción {i + 1}"
                  class="pc-input"
                  maxlength="40"
                />
                {#if pollOptions.length > 2}
                  <button class="pc-poll-remove" onclick={() => removePollOption(i)} aria-label="Eliminar opción">
                    <span class="material-icons-round">close</span>
                  </button>
                {/if}
              </div>
            {/each}
          </div>

          {#if pollOptions.length < 6}
            <button class="pc-poll-add" onclick={addPollOption}>
              <span class="material-icons-round">add</span> Añadir opción
            </button>
          {/if}

          <div class="pc-poll-duration">
            <label class="pc-poll-duration-label" for="poll-duration">
              <span class="material-icons-round">timer</span> Duración
            </label>
            <select id="poll-duration" bind:value={pollDuration} class="pc-select">
              {#each pollDurations as dur}
                <option value={dur.value}>{dur.label}</option>
              {/each}
            </select>
          </div>
        </div>
      {/if}

      {#if activePanel === 'location'}
        <div class="pc-panel pc-panel-form">
          <div class="pc-panel-header">
            <span class="material-icons-round pc-panel-icon sky">location_on</span>
            <span class="pc-panel-title">Ubicación</span>
            <button class="pc-panel-close" onclick={() => activePanel = ''} aria-label="Cerrar">
              <span class="material-icons-round">close</span>
            </button>
          </div>

          <input
            type="text"
            bind:value={locationQuery}
            placeholder="Escribe el nombre del lugar..."
            class="pc-input"
            autocomplete="off"
          />

          {#if locationQuery.trim()}
            <div class="pc-location-actions">
              <button
                class="pc-location-confirm"
                onclick={() => { locationName = locationQuery.trim(); activePanel = ''; }}
              >
                <span class="material-icons-round">check</span>
                Usar "{locationQuery.trim()}"
              </button>
            </div>
          {/if}

          {#if locationName}
            <div class="pc-location-active">
              <span class="material-icons-round">location_on</span>
              <span>{locationName}</span>
              <button onclick={() => { locationName = ''; locationQuery = ''; }} aria-label="Quitar ubicación">
                <span class="material-icons-round">close</span>
              </button>
            </div>
          {/if}
        </div>
      {/if}

      {#if activePanel === 'schedule'}
        <div class="pc-panel pc-panel-form">
          <div class="pc-panel-header">
            <span class="material-icons-round pc-panel-icon indigo">schedule</span>
            <span class="pc-panel-title">Programar publicación</span>
            <button class="pc-panel-close" onclick={() => activePanel = ''} aria-label="Cerrar">
              <span class="material-icons-round">close</span>
            </button>
          </div>

          <label class="pc-toggle">
            <input type="checkbox" bind:checked={isScheduled} />
            <span class="pc-toggle-track"></span>
            <span class="pc-toggle-label">Activar programación</span>
          </label>

          {#if isScheduled}
            <div class="pc-schedule-input">
              <label class="pc-sub-label" for="scheduled-at">Fecha y hora de publicación</label>
              <input
                id="scheduled-at"
                type="datetime-local"
                bind:value={scheduledAt}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                class="pc-input"
              />
            </div>
          {/if}

          <button
            class="pc-btn-primary mt-2"
            onclick={() => activePanel = ''}
          >
            Confirmar
          </button>
        </div>
      {/if}

      <!-- ── Mood selector ──────────────────────────────────────── -->
      <div class="pc-section">
        <p class="pc-section-label">
          <span class="material-icons-round">mood</span>
          Estado de ánimo
        </p>
        <div class="pc-mood-scroll">
          {#each moods as m}
            <button
              class="pc-mood-pill"
              class:active={mood === m.id}
              onclick={() => mood = mood === m.id ? '' : m.id}
              title={m.label}
            >
              <span class="pc-mood-icon">{m.icon}</span>
              <span class="pc-mood-label">{m.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- ── Media adjunta ────────────────────────────────────────── -->
      <div class="pc-section">
        <p class="pc-section-label">
          <span class="material-icons-round">attach_file</span>
          Archivos adjuntos
          {#if totalMedia > 0}<span class="pc-badge">{totalMedia}</span>{/if}
        </p>

        <!-- Dropzone -->
        <div
          class="pc-dropzone"
          class:drag-active={dragOver}
          role="button"
          tabindex="0"
          ondragover={(e) => { e.preventDefault(); dragOver = true; }}
          ondragleave={() => dragOver = false}
          ondrop={handleDrop}
          onclick={() => fileInput.click()}
          onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
        >
          <span class="material-icons-round pc-dz-icon">cloud_upload</span>
          <span class="pc-dz-text">Arrastra o haz clic</span>
          <span class="pc-dz-hint">Imágenes y videos · Múltiples permitidos</span>
        </div>
        <input
          type="file"
          bind:this={fileInput}
          multiple
          accept="image/*,video/*"
          style="display:none"
          onchange={handleFiles}
        />

        <!-- Grid de thumbs -->
        {#if totalMedia > 0}
          <div class="pc-media-grid">
            {#each uploadedMedia as media, idx}
              <div class="pc-thumb" class:klipy={media.klipy}>
                <img src={media.url} alt="" />
                {#if media.klipy}
                  <span class="pc-thumb-badge">GIF</span>
                {/if}
                <button class="pc-thumb-remove" onclick={() => removeUploadedMedia(idx)} aria-label="Quitar">
                  <span class="material-icons-round">close</span>
                </button>
              </div>
            {/each}
            {#each selectedFiles as file, idx}
              <div class="pc-thumb">
                {#if file.type.startsWith('video/')}
                  <!-- Thumbnail de video: sin controles, solo preview muted -->
                  <video src={objectUrl(file)} muted playsinline preload="metadata" class="pc-thumb-video"></video>
                  <span class="pc-thumb-badge video-badge">
                    <span class="material-icons-round">videocam</span>
                  </span>
                {:else}
                  <img src={objectUrl(file)} alt="" />
                {/if}
                <button class="pc-thumb-remove" onclick={() => removeFile(idx)} aria-label="Quitar">
                  <span class="material-icons-round">close</span>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="pc-flex-grow"></div>

      <!-- ── Footer: privacidad + publicar ───────────────────────── -->
      <div class="pc-footer">
        <!-- Tags activos -->
        <div class="pc-active-tags">
          {#if locationName}
            <span class="pc-tag sky">
              <span class="material-icons-round">location_on</span>
              {locationName}
              <button onclick={() => { locationName = ''; locationQuery = ''; }} aria-label="Quitar ubicación">×</button>
            </span>
          {/if}
          {#if isScheduled && scheduledAt}
            <span class="pc-tag indigo">
              <span class="material-icons-round">schedule</span>
              {new Date(scheduledAt).toLocaleDateString('es', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
              <button onclick={() => { isScheduled = false; scheduledAt = ''; }} aria-label="Quitar programación">×</button>
            </span>
          {/if}
          {#if selectedMood}
            <span class="pc-tag amber">
              {selectedMood.icon} {selectedMood.label}
              <button onclick={() => mood = ''} aria-label="Quitar mood">×</button>
            </span>
          {/if}
        </div>

        <div class="pc-footer-actions">
          <div class="pc-privacy-wrap">
            <CustomSelect bind:value={privacy} options={privacyOptions} placeholder="Público" />
          </div>

          <button
            class="pc-publish"
            disabled={!canPost || posting}
            onclick={handlePost}
            aria-label="Publicar"
          >
            {#if posting}
              <span class="pc-spinner"></span>
              Publicando...
            {:else}
              <span class="material-icons-round">send</span>
              Publicar
            {/if}
          </button>
        </div>

        <p class="pc-shortcut-hint">
          <span class="material-icons-round">keyboard</span>
          Ctrl+Enter para publicar rápido
        </p>
      </div>
    </aside>

    <!-- ── Columna Derecha: Vista Previa Live ─────────────────────── -->
    <section class="pc-preview-col">
      <div class="pc-preview-inner">
        <p class="pc-preview-label">
          <span class="material-icons-round">preview</span>
          Vista previa en vivo
        </p>

        <article class="pc-preview-card">
          <!-- Header del post -->
          <div class="pc-prev-header">
            {#if authStore.user?.avatar_url}
              <img src={authStore.user.avatar_url} alt="" class="pc-prev-avatar" />
            {:else}
              <div class="pc-prev-avatar pc-prev-avatar-fallback">
                {(authStore.user?.display_name?.[0] ?? 'U').toUpperCase()}
              </div>
            {/if}

            <div class="pc-prev-meta">
              <div class="pc-prev-name-row">
                <span class="pc-prev-name">{authStore.user?.display_name ?? authStore.user?.username ?? 'Tú'}</span>
                {#if authStore.user?.is_verified}
                  <span class="material-icons-round pc-verified">verified</span>
                {/if}
                {#if selectedMood}
                  <span class="pc-prev-mood">{selectedMood.icon} {selectedMood.label}</span>
                {/if}
              </div>
              <div class="pc-prev-sub">
                <span>@{authStore.user?.username ?? 'usuario'} · ahora</span>
                {#if locationName}
                  <span class="pc-prev-location">
                    <span class="material-icons-round">location_on</span>{locationName}
                  </span>
                {/if}
              </div>
            </div>

            <div class="pc-prev-privacy">
              <span class="material-icons-round">
                {privacy === 'public' ? 'public' : privacy === 'followers' ? 'group' : 'lock'}
              </span>
            </div>
          </div>

          <!-- Cuerpo del post -->
          {#if bodyText.trim()}
            <p class="pc-prev-body">{bodyText}</p>
          {:else}
            <p class="pc-prev-body pc-prev-empty">Escribe algo para verlo aquí...</p>
          {/if}

          <!-- Poll preview -->
          {#if activePanel === 'poll' && pollQuestion.trim()}
            <div class="pc-prev-poll">
              <p class="pc-prev-poll-q">{pollQuestion}</p>
              <div class="pc-prev-poll-opts">
                {#each pollOptions.filter(o => o.trim()) as opt}
                  <div class="pc-prev-poll-opt">
                    <span>{opt}</span>
                    <span class="material-icons-round">radio_button_unchecked</span>
                  </div>
                {/each}
              </div>
              {#if isScheduled && scheduledAt}
                <p class="pc-prev-poll-info">
                  <span class="material-icons-round">timer</span>
                  {pollDurations.find(d => d.value === pollDuration)?.label ?? '24 horas'}
                </p>
              {/if}
            </div>
          {/if}

          <!-- Media previews -->
          {#if totalMedia > 0}
            <div
              class="pc-prev-media"
              class:grid-single={totalMedia === 1}
              class:grid-multi={totalMedia > 1}
            >
              {#each uploadedMedia as media}
                <div class="pc-prev-media-item">
                  <img src={media.url} alt="" />
                  {#if media.klipy}
                    <span class="pc-prev-badge">GIF</span>
                  {/if}
                </div>
              {/each}
              {#each selectedFiles as file}
                <div class="pc-prev-media-item">
                  {#if file.type.startsWith('video/')}
                    <video src={objectUrl(file)} muted playsinline preload="metadata" class="pc-prev-video"></video>
                    <span class="pc-prev-badge">
                      <span class="material-icons-round">videocam</span>
                    </span>
                  {:else}
                    <img src={objectUrl(file)} alt="" />
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <!-- Acciones del post (decorativas) -->
          <div class="pc-prev-actions">
            <span class="pc-prev-action">
              <span class="material-icons-round">favorite_border</span> 0
            </span>
            <span class="pc-prev-action">
              <span class="material-icons-round">chat_bubble_outline</span> 0
            </span>
            <span class="pc-prev-action">
              <span class="material-icons-round">share</span> Compartir
            </span>
            <span class="pc-prev-action">
              <span class="material-icons-round">bookmark_border</span>
            </span>
          </div>
        </article>
      </div>
    </section>

  </div>
</div>

<style>
  /* ── Root ──────────────────────────────────────────────────────── */
  .pc-root {
    min-height: calc(100vh - 64px);
    background: transparent;
    font-family: var(--font-sans);
  }

  .pc-layout {
    display: flex;
    min-height: calc(100vh - 64px);
  }

  /* ── Editor (columna izquierda) ──────────────────────────────── */
  .pc-editor {
    width: 440px;
    flex-shrink: 0;
    border-radius: 0;
    border-right: 1px solid var(--glass-border);
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    overflow-y: auto;
    position: sticky;
    top: 64px;
    height: calc(100vh - 64px);
    scrollbar-width: thin;
  }

  /* Header */
  .pc-editor-header {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .pc-back {
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
  .pc-back:hover { background: var(--bg-surface2); transform: translateX(-2px); }

  .pc-editor-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.3rem;
    font-weight: 800;
    color: var(--text-primary);
  }

  /* Error bar */
  .pc-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(232, 74, 114, 0.1);
    border: 1px solid rgba(232, 74, 114, 0.25);
    color: var(--aero-rose, #e84a72);
    font-size: 0.82rem;
  }
  .pc-error .material-icons-round { font-size: 18px; }
  .pc-error button {
    margin-left: auto;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    opacity: 0.7;
  }
  .pc-error button:hover { opacity: 1; }

  /* Compose box */
  .pc-compose-box {
    display: flex;
    gap: 12px;
    padding: 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    background: var(--bg-overlay);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .pc-compose-box:focus-within {
    border-color: var(--aero-blue);
    box-shadow: 0 0 0 3px rgba(27, 133, 243, 0.12);
  }

  .pc-composer-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--glass-border);
    flex-shrink: 0;
  }
  .pc-avatar-fallback {
    background: var(--grad-primary, linear-gradient(135deg, #1B85F3, #00E5FF));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 800;
    font-size: 1rem;
  }

  .pc-textarea {
    flex: 1;
    background: transparent;
    border: none;
    resize: none;
    font-size: 1rem;
    color: var(--text-primary);
    font-family: var(--font-sans);
    outline: none;
    line-height: 1.55;
    min-height: 80px;
  }
  .pc-textarea::placeholder { color: var(--text-muted); opacity: 0.65; }

  /* ── Dock ─────────────────────────────────────────────────────── */
  .pc-dock {
    display: flex;
    gap: 6px;
    padding: 10px 8px;
    border-radius: 20px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.08);
    backdrop-filter: blur(12px);
  }

  .pc-dock-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex: 1;
    padding: 12px 6px 10px;
    border-radius: 14px;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    position: relative;
    transition: background 0.2s, transform 0.2s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s, box-shadow 0.2s;
  }
  .pc-dock-btn:hover {
    background: rgba(255,255,255,0.06);
    transform: translateY(-3px);
    box-shadow: 0 6px 14px rgba(0,0,0,0.15);
  }
  .pc-dock-btn.active {
    background: rgba(74, 171, 223, 0.1);
    border-color: rgba(74, 171, 223, 0.28);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(74, 171, 223, 0.2);
  }
  .pc-dock-btn:active { transform: scale(0.93); }

  .pc-dock-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 13px;
    font-size: 22px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.08);
    transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
  }
  .pc-dock-btn:hover .pc-dock-icon { transform: scale(1.08); background: rgba(255,255,255,0.09); }
  .pc-dock-btn.active .pc-dock-icon { transform: scale(1.1); }

  .pc-dock-icon.amber   { color: #fbbf24; }
  .pc-dock-icon.fuchsia { color: #e879f9; }
  .pc-dock-icon.emerald { color: #34d399; }
  .pc-dock-icon.sky     { color: #38bdf8; }
  .pc-dock-icon.indigo  { color: #818cf8; }

  .pc-dock-btn.active .pc-dock-icon.amber   { background: rgba(251,191,36,0.12); border-color: rgba(251,191,36,0.3); }
  .pc-dock-btn.active .pc-dock-icon.fuchsia { background: rgba(232,121,249,0.12); border-color: rgba(232,121,249,0.3); }
  .pc-dock-btn.active .pc-dock-icon.emerald { background: rgba(52,211,153,0.12); border-color: rgba(52,211,153,0.3); }
  .pc-dock-btn.active .pc-dock-icon.sky     { background: rgba(56,189,248,0.12); border-color: rgba(56,189,248,0.3); }
  .pc-dock-btn.active .pc-dock-icon.indigo  { background: rgba(129,140,248,0.12); border-color: rgba(129,140,248,0.3); }

  .pc-dock-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-muted);
    white-space: nowrap;
    transition: color 0.2s;
  }
  .pc-dock-btn:hover .pc-dock-label,
  .pc-dock-btn.active .pc-dock-label { color: var(--text-primary); }

  .pc-dock-pip {
    position: absolute;
    top: 5px; right: 7px;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--aero-rose, #e84a72);
    box-shadow: 0 0 5px var(--aero-rose, #e84a72);
    animation: pcPing 1.2s ease infinite;
  }
  @keyframes pcPing { 75%, 100% { transform: scale(2.2); opacity: 0; } }

  /* ── Paneles expandibles ─────────────────────────────────────── */
  .pc-panel {
    border-radius: 16px;
    border: 1px solid var(--glass-border);
    background: var(--bg-surface2);
    overflow: hidden;
    animation: pcSlideIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes pcSlideIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .pc-panel-form {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .pc-panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-subtle);
  }
  .pc-panel-icon { font-size: 18px; }
  .pc-panel-icon.emerald { color: #34d399; }
  .pc-panel-icon.sky     { color: #38bdf8; }
  .pc-panel-icon.indigo  { color: #818cf8; }

  .pc-panel-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-primary);
    flex: 1;
  }
  .pc-panel-close {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }
  .pc-panel-close:hover { background: rgba(232,74,114,0.1); color: var(--aero-rose, #e84a72); }
  .pc-panel-close .material-icons-round { font-size: 16px; }

  /* Inputs */
  .pc-input {
    width: 100%;
    padding: 9px 12px;
    border-radius: 10px;
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    font-size: 0.85rem;
    font-family: var(--font-sans);
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }
  .pc-input:focus {
    outline: none;
    border-color: var(--aero-blue);
    box-shadow: 0 0 0 3px rgba(27,133,243,0.15);
  }

  /* Poll */
  .pc-poll-options { display: flex; flex-direction: column; gap: 8px; }
  .pc-poll-row { display: flex; align-items: center; gap: 8px; }
  .pc-poll-num {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .pc-poll-remove {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    flex-shrink: 0;
  }
  .pc-poll-remove:hover { color: var(--aero-rose, #e84a72); }
  .pc-poll-remove .material-icons-round { font-size: 16px; }
  .pc-poll-add {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 10px;
    background: transparent;
    border: 1px dashed var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s, background 0.2s;
    width: 100%;
    justify-content: center;
  }
  .pc-poll-add:hover { border-color: var(--aero-blue); color: var(--aero-blue); background: rgba(27,133,243,0.05); }
  .pc-poll-add .material-icons-round { font-size: 16px; }

  .pc-poll-duration {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 10px;
    border-top: 1px solid var(--border-subtle);
  }
  .pc-poll-duration-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .pc-poll-duration-label .material-icons-round { font-size: 14px; }

  .pc-select {
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    font-size: 0.8rem;
    cursor: pointer;
  }
  .pc-select:focus { outline: none; border-color: var(--aero-blue); }

  /* Location */
  .pc-location-actions { display: flex; }
  .pc-location-confirm {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 10px;
    background: rgba(56,189,248,0.1);
    border: 1px solid rgba(56,189,248,0.25);
    color: #38bdf8;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    width: 100%;
    justify-content: center;
  }
  .pc-location-confirm:hover { background: rgba(56,189,248,0.2); }
  .pc-location-confirm .material-icons-round { font-size: 16px; }

  .pc-location-active {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(56,189,248,0.08);
    border: 1px solid rgba(56,189,248,0.2);
    color: #38bdf8;
    font-size: 0.82rem;
    font-weight: 600;
  }
  .pc-location-active .material-icons-round { font-size: 16px; }
  .pc-location-active button {
    margin-left: auto;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 0.9rem;
    opacity: 0.7;
  }
  .pc-location-active button:hover { opacity: 1; }

  /* Schedule */
  .pc-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }
  .pc-toggle input { display: none; }
  .pc-toggle-track {
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--border-subtle);
    position: relative;
    flex-shrink: 0;
    transition: background 0.25s;
  }
  .pc-toggle-track::after {
    content: '';
    position: absolute;
    top: 3px; left: 3px;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
  }
  .pc-toggle input:checked ~ .pc-toggle-track { background: var(--aero-blue); }
  .pc-toggle input:checked ~ .pc-toggle-track::after { transform: translateX(16px); }
  .pc-toggle-label { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); }

  .pc-schedule-input { display: flex; flex-direction: column; gap: 4px; }
  .pc-sub-label { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); }

  .pc-btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    border-radius: 10px;
    background: var(--grad-primary, linear-gradient(135deg, #1B85F3, #00E5FF));
    border: none;
    color: #fff;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .pc-btn-primary:hover { opacity: 0.9; }
  .mt-2 { margin-top: 8px; }

  /* ── Sección genérica ─────────────────────────────────────────── */
  .pc-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .pc-section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0;
  }
  .pc-section-label .material-icons-round { font-size: 14px; color: var(--aero-blue); }

  .pc-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--aero-blue);
    color: #fff;
    font-size: 0.6rem;
    font-weight: 800;
  }

  /* ── Mood scroll ─────────────────────────────────────────────── */
  .pc-mood-scroll {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
  }
  .pc-mood-scroll::-webkit-scrollbar { display: none; }

  .pc-mood-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 999px;
    border: 1px solid var(--glass-border);
    background: var(--bg-overlay);
    color: var(--text-primary);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
    font-size: 0.82rem;
  }
  .pc-mood-pill:hover { border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
  .pc-mood-pill.active {
    border-color: var(--aero-blue);
    background: rgba(27,133,243,0.12);
    color: var(--aero-sky, #00E5FF);
    box-shadow: 0 4px 12px rgba(27,133,243,0.25);
    transform: translateY(-2px);
  }
  .pc-mood-icon { font-size: 1.1rem; }
  .pc-mood-label { font-weight: 600; }

  /* ── Dropzone ────────────────────────────────────────────────── */
  .pc-dropzone {
    border: 2px dashed var(--border-subtle);
    border-radius: 14px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    text-align: center;
    transition: border-color 0.2s, background 0.2s;
  }
  .pc-dropzone:hover,
  .pc-dropzone.drag-active {
    border-color: var(--aero-blue);
    background: rgba(27,133,243,0.04);
  }
  .pc-dz-icon { font-size: 2rem; color: var(--text-muted); margin-bottom: 2px; }
  .pc-dropzone:hover .pc-dz-icon { color: var(--aero-blue); }
  .pc-dz-text { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
  .pc-dz-hint { font-size: 0.7rem; color: var(--text-muted); }

  /* ── Media grid de thumbs ─────────────────────────────────────── */
  .pc-media-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
    gap: 8px;
  }
  .pc-thumb {
    position: relative;
    border-radius: 10px;
    overflow: hidden;
    aspect-ratio: 1;
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
  }
  .pc-thumb img,
  .pc-thumb-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .pc-thumb-badge {
    position: absolute;
    bottom: 4px;
    left: 4px;
    padding: 2px 5px;
    border-radius: 5px;
    background: rgba(0,0,0,0.65);
    color: #fff;
    font-size: 0.6rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .pc-thumb-badge .material-icons-round { font-size: 11px; }
  .video-badge { padding: 2px; border-radius: 50%; }

  .pc-thumb-remove {
    position: absolute;
    top: 4px; right: 4px;
    width: 20px; height: 20px;
    border-radius: 50%;
    background: rgba(0,0,0,0.6);
    border: none;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;
    opacity: 0;
  }
  .pc-thumb:hover .pc-thumb-remove { opacity: 1; }
  .pc-thumb-remove:hover { background: rgba(232,74,114,0.85); }
  .pc-thumb-remove .material-icons-round { font-size: 13px; }

  .pc-flex-grow { flex: 1; }

  /* ── Footer ──────────────────────────────────────────────────── */
  .pc-footer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 14px;
    border-top: 1px solid var(--border-subtle);
  }

  .pc-active-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 0;
  }
  .pc-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    border: 1px solid transparent;
  }
  .pc-tag .material-icons-round { font-size: 13px; }
  .pc-tag button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0 0 0 2px;
    font-size: 0.85rem;
    opacity: 0.7;
    color: inherit;
    line-height: 1;
  }
  .pc-tag button:hover { opacity: 1; }
  .pc-tag.sky    { background: rgba(56,189,248,0.1); border-color: rgba(56,189,248,0.25); color: #38bdf8; }
  .pc-tag.indigo { background: rgba(129,140,248,0.1); border-color: rgba(129,140,248,0.25); color: #818cf8; }
  .pc-tag.amber  { background: rgba(251,191,36,0.1); border-color: rgba(251,191,36,0.25); color: #fbbf24; }

  .pc-footer-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pc-privacy-wrap { width: 150px; flex-shrink: 0; }

  .pc-publish {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border-radius: 12px;
    background: var(--grad-primary, linear-gradient(135deg, #1B85F3, #00E5FF));
    border: none;
    color: #fff;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(27,133,243,0.35);
    transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
  }
  .pc-publish:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
  .pc-publish:not(:disabled):hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 22px rgba(27,133,243,0.45); }
  .pc-publish:not(:disabled):active { transform: scale(0.97); }

  .pc-spinner {
    display: inline-block;
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: pcSpin 0.7s linear infinite;
  }
  @keyframes pcSpin { to { transform: rotate(360deg); } }

  .pc-shortcut-hint {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.68rem;
    color: var(--text-muted);
    margin: 0;
    justify-content: center;
  }
  .pc-shortcut-hint .material-icons-round { font-size: 13px; }

  /* ── Preview column ──────────────────────────────────────────── */
  .pc-preview-col {
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 24px;
    background: radial-gradient(ellipse at 50% 30%, rgba(27,133,243,0.04) 0%, transparent 70%);
    overflow-y: auto;
  }

  .pc-preview-inner {
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .pc-preview-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-muted);
    margin: 0;
    justify-content: center;
  }
  .pc-preview-label .material-icons-round { font-size: 14px; }

  /* Card de preview */
  .pc-preview-card {
    background: var(--glass-bg);
    backdrop-filter: blur(24px) saturate(1.4);
    -webkit-backdrop-filter: blur(24px) saturate(1.4);
    border: 1px solid var(--glass-border);
    border-top-color: var(--glass-border-t, rgba(255,255,255,0.15));
    border-radius: var(--radius-lg, 20px);
    padding: 20px;
    box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.08);
    animation: pcCardIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes pcCardIn {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: none; }
  }

  .pc-prev-header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 12px;
  }

  .pc-prev-avatar {
    width: 42px; height: 42px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--glass-border);
    flex-shrink: 0;
  }
  .pc-prev-avatar-fallback {
    background: var(--grad-primary, linear-gradient(135deg,#1B85F3,#00E5FF));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 800;
    font-size: 1rem;
  }

  .pc-prev-meta { flex: 1; min-width: 0; }
  .pc-prev-name-row {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }
  .pc-prev-name { font-weight: 700; font-size: 0.9rem; color: var(--text-primary); }
  .pc-verified  { font-size: 16px !important; color: #3b82f6; }
  .pc-prev-mood {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
    padding: 2px 8px;
    border-radius: 12px;
  }
  .pc-prev-sub {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 2px;
  }
  .pc-prev-sub span { font-size: 0.72rem; color: var(--text-muted); }
  .pc-prev-location {
    display: flex;
    align-items: center;
    gap: 2px;
    color: #38bdf8 !important;
    font-weight: 600;
  }
  .pc-prev-location .material-icons-round { font-size: 12px; }

  .pc-prev-privacy {
    color: var(--text-muted);
    opacity: 0.5;
  }
  .pc-prev-privacy .material-icons-round { font-size: 16px; }

  .pc-prev-body {
    font-size: 0.92rem;
    color: var(--text-primary);
    white-space: pre-wrap;
    line-height: 1.55;
    margin: 0 0 12px;
  }
  .pc-prev-empty { color: var(--text-muted); font-style: italic; }

  /* Poll preview */
  .pc-prev-poll {
    background: var(--bg-overlay);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    padding: 14px;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .pc-prev-poll-q { font-weight: 700; font-size: 0.85rem; color: var(--text-primary); margin: 0; }
  .pc-prev-poll-opts { display: flex; flex-direction: column; gap: 6px; }
  .pc-prev-poll-opt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-surface2);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  .pc-prev-poll-opt .material-icons-round { font-size: 14px; color: var(--text-muted); }
  .pc-prev-poll-info {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.68rem;
    color: var(--text-muted);
    margin: 0;
  }
  .pc-prev-poll-info .material-icons-round { font-size: 12px; }

  /* Media preview en la card */
  .pc-prev-media {
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 12px;
    max-height: 320px;
  }
  .pc-prev-media.grid-single .pc-prev-media-item { aspect-ratio: 16/9; }
  .pc-prev-media.grid-multi {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
  }
  .pc-prev-media.grid-multi .pc-prev-media-item { aspect-ratio: 1; }

  .pc-prev-media-item {
    position: relative;
    background: var(--bg-overlay);
    overflow: hidden;
  }
  .pc-prev-media-item img,
  .pc-prev-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .pc-prev-badge {
    position: absolute;
    top: 6px; right: 6px;
    padding: 3px 7px;
    border-radius: 6px;
    background: rgba(0,0,0,0.65);
    color: #fff;
    font-size: 0.62rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .pc-prev-badge .material-icons-round { font-size: 12px; }

  /* Action bar */
  .pc-prev-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
  }
  .pc-prev-action {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    cursor: default;
  }
  .pc-prev-action .material-icons-round { font-size: 18px; }

  /* ── Responsive ──────────────────────────────────────────────── */
  @media (max-width: 1024px) {
    .pc-editor { width: 380px; }
  }

  @media (max-width: 768px) {
    .pc-layout { flex-direction: column; }
    .pc-editor {
      width: 100%;
      position: static;
      height: auto;
      border-right: none;
      border-bottom: 1px solid var(--glass-border);
    }
    .pc-preview-col { padding: 20px 16px; }
  }
</style>
