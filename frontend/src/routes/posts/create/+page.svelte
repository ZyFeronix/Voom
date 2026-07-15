<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { posts as postsApi } from '$lib/api.js';
  import { authStore } from '$lib/stores/auth.svelte.js';
  import 'vidstack/define/media-player.js';
	import 'vidstack/define/media-outlet.js';
	import 'vidstack/define/media-community-skin.js';
      import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
  import KlipyPicker from '$lib/components/KlipyPicker.svelte';
  import CustomSelect from '$lib/components/CustomSelect.svelte';

  let bodyText = $state('');
  let showEmojis = $state(false);
  let showGifPanel = $state(false);
  let showPollCreator = $state(false);
  let gifSearch = $state('');
  const commonEmojis = ['😂','❤️','😍','🤣','😊','🙏','😭','🔥','🥰','👍','✨','🎉','👀','🙌','💯','🥺','🤍','🤩','💪','🙈','✨','🤔','🖤','🥳'];

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

  // Curated GIFs
  const gifCategories = [
    { name: 'Reacciones', gifs: ['🎉 Party', '👏 Clap', '😂 Laughing', '🔥 Fire', '💯 100', '🤯 Mind Blown', '😱 Shocked', '🥳 Celebrate', '💪 Strong', '🙌 Praise'] },
    { name: 'Emociones', gifs: ['❤️ Love', '🥰 Adore', '🥺 Plead', '😢 Cry', '😤 Angry', '🤔 Think', '😎 Cool', '🤩 Starstruck', '😬 Oops', '🫂 Hug'] },
    { name: 'Respuestas', gifs: ['👍 Yes', '👎 No', '🤷 Shrug', '✅ Agree', '❌ Disagree', '👀 Watching', '🫡 Salute', '🤝 Deal', '✌️ Peace', '🫶 Love'] }
  ];
  let selectedGif = $state('');
  let selectedFiles = $state([]);
  let uploadedMedia = $state([]);
  let privacy = $state('public');
  let mood = $state('');
  let posting = $state(false);
  let error = $state('');
  let dragOver = $state(false);
  let moodScrollerRef = $state(null);
  let isDraggingMood = $state(false);
  let moodStartX = 0;
  let moodScrollLeft = 0;

  function scrollMoods(direction) {
    if (moodScrollerRef) {
      moodScrollerRef.scrollBy({ left: direction * 200, behavior: 'smooth' });
    }
  }

  function handleMoodPointerDown(e) {
    if (!moodScrollerRef) return;
    isDraggingMood = true;
    moodStartX = e.pageX - moodScrollerRef.offsetLeft;
    moodScrollLeft = moodScrollerRef.scrollLeft;
  }
  function handleMoodPointerLeave() { isDraggingMood = false; }
  function handleMoodPointerUp() { isDraggingMood = false; }
  function handleMoodPointerMove(e) {
    if (!isDraggingMood || !moodScrollerRef) return;
    e.preventDefault();
    const x = e.pageX - moodScrollerRef.offsetLeft;
    const walk = (x - moodStartX) * 1.5;
    moodScrollerRef.scrollLeft = moodScrollLeft - walk;
  }

  // Advanced Location State
  let locationName = $state('');
  let showLocationPanel = $state(false);
  let locationQuery = $state('');
  let locationSuggestions = $derived(
    locationQuery.trim()
      ? [
          'Neo Tokyo',
          'Estudio VTuber',
          'Valhalla Café',
          'Akihabara Virtual',
          'La Luna',
          'Habitación Gamer',
          'Distrito Cyberpunk',
          'Estación Virtual'
        ].filter(loc => loc.toLowerCase().includes(locationQuery.toLowerCase()))
      : [
          'Neo Tokyo',
          'Estudio VTuber',
          'Valhalla Café',
          'Akihabara Virtual',
          'La Luna',
          'Habitación Gamer'
        ]
  );

  // Advanced Scheduling State
  let scheduledAt = $state('');
  let isScheduled = $state(false);
  let showSchedulePanel = $state(false);

  let fileInput;

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

  const privacyOptions = [
    { value: 'public', label: 'Público' },
    { value: 'followers', label: 'Solo seguidores' },
    { value: 'private', label: 'Privado' }
  ];

  const canPost = $derived(bodyText.trim().length > 0 || selectedFiles.length > 0 || uploadedMedia.length > 0 || pollQuestion.trim().length > 0);

  onMount(() => {
    if (!authStore.isAuthenticated) goto('/login');
  });

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    selectedFiles = [...selectedFiles, ...files];
  }

  function removeFile(idx) {
    selectedFiles = selectedFiles.filter((_, i) => i !== idx);
  }

  function handleDrop(e) {
    e.preventDefault();
    dragOver = false;
    const files = Array.from(e.dataTransfer.files || []);
    selectedFiles = [...selectedFiles, ...files];
  }

  function addPollOption() {
    if (pollOptions.length < 6) pollOptions = [...pollOptions, ''];
  }

  function removePollOption(idx) {
    if (pollOptions.length > 2) pollOptions = pollOptions.filter((_, i) => i !== idx);
  }

  function updatePollOption(idx, val) {
    pollOptions = pollOptions.map((o, i) => i === idx ? val : o);
  }

  function toggleGif(gif) {
    if (selectedGif === gif) {
      selectedGif = '';
    } else {
      selectedGif = gif;
      bodyText += ` [${gif}]`;
    }
    showGifPanel = false;
  }

  function togglePoll() {
    showPollCreator = !showPollCreator;
    if (showPollCreator) {
      showGifPanel = false;
      showEmojis = false;
      showLocationPanel = false;
      showSchedulePanel = false;
    }
  }

  function toggleEmojis() {
    showEmojis = !showEmojis;
    if (showEmojis) {
      showGifPanel = false;
      showPollCreator = false;
      showLocationPanel = false;
      showSchedulePanel = false;
    }
  }

  function toggleGifPanel() {
    showGifPanel = !showGifPanel;
    if (showGifPanel) {
      showEmojis = false;
      showPollCreator = false;
      showLocationPanel = false;
      showSchedulePanel = false;
    }
  }

  function toggleLocationPanel() {
    showLocationPanel = !showLocationPanel;
    if (showLocationPanel) {
      showGifPanel = false;
      showEmojis = false;
      showPollCreator = false;
      showSchedulePanel = false;
    }
  }

  function toggleSchedulePanel() {
    showSchedulePanel = !showSchedulePanel;
    if (showSchedulePanel) {
      showGifPanel = false;
      showEmojis = false;
      showPollCreator = false;
      showLocationPanel = false;
    }
  }

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

      if (showPollCreator && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) {
        postData.poll = {
          question: pollQuestion.trim(),
          options: pollOptions.filter(o => o.trim()),
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
</script>

<svelte:head>
  <title>Crear Post — VSocial</title>
</svelte:head>

<div class="creator-container">
  <div class="creator-layout">
    
    <!-- Left Sidebar: Edición & Ajustes -->
    <div class="tools-sidebar glass-panel">
      <div class="create-header mb-4">
        <a href="/feed" class="back-link" aria-label="Link">
          <span class="material-icons-round">arrow_back</span>
        </a>
        <h1 class="create-title text-main">Nueva Publicación</h1>
      </div>

      {#if error}
        <div class="error-bar mb-3">
          <span class="material-icons-round text-sm">error_outline</span>
          <span>{error}</span>
        </div>
      {/if}

      <!-- Contenido Principal -->
      <div class="tool-section mb-4">
        <label class="section-label" for="post-body-input">Contenido de la Publicación</label>
        <div class="textarea-wrapper glass-card p-3" style="border-radius: var(--radius-md); border: 1px solid var(--glass-border); background: var(--bg-overlay);">
          <textarea
            id="post-body-input"
            bind:value={bodyText}
            onkeydown={handleKeyDown}
            placeholder="¿Qué está pasando en tu mundo virtual?"
            class="post-textarea"
            rows="5"
          ></textarea>
        </div>
        <div class="action-dock mt-3">
          <button type="button" class="dock-btn" onclick={toggleEmojis} class:pressed={showEmojis} aria-label="Action button">
            <span class="dock-icon amber">emoji_emotions</span>
            <span class="dock-label">Emoji</span>
            {#if showEmojis}<span class="dock-ping" ></span>{/if}
          </button>
          <button type="button" class="dock-btn" onclick={toggleGifPanel} class:pressed={showGifPanel} aria-label="Action button">
            <span class="dock-icon fuchsia">gif_box</span>
            <span class="dock-label">GIF</span>
            {#if showGifPanel}<span class="dock-ping" ></span>{/if}
          </button>
          <button type="button" class="dock-btn" onclick={togglePoll} class:pressed={showPollCreator} aria-label="Action button">
            <span class="dock-icon emerald">poll</span>
            <span class="dock-label">Encuesta</span>
            {#if showPollCreator}<span class="dock-ping" ></span>{/if}
          </button>
          <button type="button" class="dock-btn" onclick={toggleLocationPanel} class:pressed={showLocationPanel} aria-label="Action button">
            <span class="dock-icon sky">location_on</span>
            <span class="dock-label">Ubicacion</span>
            {#if showLocationPanel}<span class="dock-ping" ></span>{/if}
          </button>
          <button type="button" class="dock-btn" onclick={toggleSchedulePanel} class:pressed={showSchedulePanel} aria-label="Action button">
            <span class="dock-icon indigo">schedule</span>
            <span class="dock-label">Programar</span>
            {#if showSchedulePanel}<span class="dock-ping" ></span>{/if}
          </button>
        </div>
        
        <!-- Paneles Desplegables de Botones (Ahora dentro de tool-section) -->
        {#if showEmojis}
          <div class="dropdown-panel animate-slide-in-up mt-3 relative" style="border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--bg-surface2); width: 100%; display: flex; justify-content: center; overflow: hidden; padding: 0; z-index: 10;">
            <TwemojiPicker 
              onClose={() => showEmojis = false}
              onSelect={(emoji) => { bodyText += emoji; showEmojis = false; }} 
            />
          </div>
        {/if}

        {#if showGifPanel}
          <div class="dropdown-panel animate-slide-in-up mt-3 relative" style="border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--bg-surface2); width: 100%; display: flex; justify-content: center; overflow: hidden; padding: 0; z-index: 10;">
            <KlipyPicker 
              onClose={() => showGifPanel = false}
              onSelect={(url, gif) => { 
                uploadedMedia.push({ url: url, type: 'image', klipy: true });
                showGifPanel = false; 
              }} 
            />
          </div>
        {/if}

        {#if showPollCreator}
          <div class="dropdown-panel glass-card aero-modal animate-slide-in-up mt-3 p-4 relative z-10">
            <div class="panel-header mb-3 flex justify-between items-center">
              <span class="panel-title text-main font-bold">Crear Encuesta</span>
              <button class="panel-close w-7 h-7 rounded-full bg-surface hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center transition border border-subtle" onclick={() => showPollCreator = false}><span class="material-icons-round text-sm">close</span></button>
            </div>
            <input type="text" bind:value={pollQuestion} placeholder="Pregunta algo..." class="vs-input mb-3 w-full aero-input" />
            <div class="poll-options-list flex flex-col gap-2">
              {#each pollOptions as opt, i}
                <div class="poll-option-row flex gap-2 items-center">
                  <span class="poll-num w-6 h-6 rounded-full bg-overlay border border-subtle flex items-center justify-center text-[10px] font-bold text-muted">{i + 1}</span>
                  <input type="text" value={opt} oninput={(e) => updatePollOption(i, e.target.value)} placeholder="Opción {i + 1}" class="vs-input flex-1 aero-input" />
                  {#if pollOptions.length > 2}
                    <button class="poll-remove-btn w-6 h-6 flex items-center justify-center text-muted hover:text-rose-500 transition" onclick={() => removePollOption(i)}><span class="material-icons-round text-sm">close</span></button>
                  {/if}
                </div>
              {/each}
            </div>
            {#if pollOptions.length < 6}
              <button class="poll-add-btn mt-3 w-full py-2 border border-dashed border-subtle rounded-xl text-muted text-sm font-bold hover:text-sky-400 hover:border-sky-400 transition hover:bg-sky-500/5 flex items-center justify-center gap-1" onclick={addPollOption} aria-label="Action button"><span class="material-icons-round text-sm">add</span> Añadir Opción</button>
            {/if}
            <div class="poll-duration-wrap mt-4 pt-3 border-t border-subtle flex items-center justify-between">
              <span class="text-xs font-bold text-muted uppercase tracking-wider">Duración</span>
              <select bind:value={pollDuration} class="vs-input aero-input py-1 px-3 w-auto text-sm">
                {#each pollDurations as dur}
                  <option value={dur.value}>{dur.label}</option>
                {/each}
              </select>
            </div>
          </div>
        {/if}

        {#if showLocationPanel}
          <div class="dropdown-panel glass-card aero-modal animate-slide-in-up mt-3 p-4 relative z-10">
            <div class="panel-header mb-3 flex justify-between items-center">
              <span class="panel-title text-main font-bold">Buscar Ubicación</span>
              <button class="panel-close w-7 h-7 rounded-full bg-surface hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center transition border border-subtle" onclick={() => showLocationPanel = false}><span class="material-icons-round text-sm">close</span></button>
            </div>
            <input 
              type="text" 
              bind:value={locationQuery} 
              placeholder="Escribe para buscar ubicación..." 
              class="vs-input aero-input mb-3 w-full" 
            />
            <div class="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {#each locationSuggestions as loc}
                <button 
                  type="button"
                  class="w-full text-left p-2.5 rounded-xl border border-subtle bg-surface hover:bg-sky-500/10 hover:border-sky-400 transition cursor-pointer text-sm text-main flex items-center gap-2"
                  onclick={() => { locationName = loc; showLocationPanel = false; }}
                >
                  <span class="material-icons-round text-xs text-muted">location_on</span>
                  <span>{loc}</span>
                </button>
              {/each}
              {#if locationSuggestions.length === 0 && locationQuery.trim()}
                <button 
                  type="button"
                  class="w-full text-left p-2.5 rounded-xl border border-dashed border-subtle bg-transparent hover:bg-sky-500/10 hover:border-sky-400 transition cursor-pointer text-sm text-main flex items-center gap-2"
                  onclick={() => { locationName = locationQuery.trim(); showLocationPanel = false; }}
                >
                  <span class="material-icons-round text-xs text-muted">add</span>
                  <span>Crear "{locationQuery.trim()}"</span>
                </button>
              {/if}
            </div>
          </div>
        {/if}

        {#if showSchedulePanel}
          <div class="dropdown-panel glass-card aero-modal animate-slide-in-up mt-3 p-4 relative z-10">
            <div class="panel-header mb-3 flex justify-between items-center">
              <span class="panel-title text-main font-bold">Programar Publicación</span>
              <button class="panel-close w-7 h-7 rounded-full bg-surface hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center transition border border-subtle" onclick={() => showSchedulePanel = false}><span class="material-icons-round text-sm">close</span></button>
            </div>
            <div class="flex flex-col gap-3">
              <label class="aero-switch cursor-pointer flex items-center gap-3 p-2 rounded-xl hover:bg-surface transition">
                <input type="checkbox" bind:checked={isScheduled} class="hidden-peer" />
                <span class="switch-slider w-10 h-5 rounded-full bg-overlay border border-subtle relative transition-colors duration-300 before:content-[''] before:absolute before:w-3 before:h-3 before:bg-white before:rounded-full before:top-[3px] before:left-[3px] before:transition-transform"></span>
                <span class="text-xs font-bold uppercase text-main">Activar Programación</span>
              </label>
              
              {#if isScheduled}
                <div class="flex flex-col gap-1 mt-2 p-3 bg-overlay border border-subtle rounded-xl">
                  <span class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Fecha y Hora de Publicación</span>
                  <input 
                    type="datetime-local" 
                    bind:value={scheduledAt} 
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    class="vs-input aero-input w-full" 
                  />
                </div>
              {/if}
              
              <button 
                type="button" 
                class="btn-aero-primary w-full py-2.5 font-bold shadow-lg mt-2 text-sm" 
                onclick={() => showSchedulePanel = false}
              >
                Confirmar Programación
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- Panel de Moods -->
      <div class="mood-section mb-4">
        <div class="section-label">MOOD:</div>
        <div class="mood-carousel">
          <button class="scroll-btn left" onclick={() => scrollMoods(-1)} aria-label="Anterior">
            <span class="material-icons-round">chevron_left</span>
          </button>
          
          <div 
            class="mood-scroller" 
            class:dragging={isDraggingMood}
            bind:this={moodScrollerRef}
            onpointerdown={handleMoodPointerDown}
            onpointerleave={handleMoodPointerLeave}
            onpointerup={handleMoodPointerUp}
            onpointermove={handleMoodPointerMove}
          >
            {#each moods as m}
              <button class="mood-pill" class:selected={mood === m.id} onclick={() => mood = mood === m.id ? '' : m.id}>
                <span class="m-icon">{m.icon}</span>
                <span class="m-label">{m.label}</span>
              </button>
            {/each}
          </div>

          <button class="scroll-btn right" onclick={() => scrollMoods(1)} aria-label="Siguiente">
            <span class="material-icons-round">chevron_right</span>
          </button>
        </div>
      </div>

      <!-- Drag & Drop Media Zone -->
      <div class="tool-section mb-4">
        <div class="section-label">Archivos Adjuntos</div>
        <div
          class="media-dropzone"
          class:drag-over={dragOver}
          ondragover={(e) => { e.preventDefault(); dragOver = true; }}
          ondragleave={() => dragOver = false}
          ondrop={handleDrop}
          role="button"
          tabindex="0"
          onclick={() => fileInput.click()}
          onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
        >
          <span class="material-icons-round dropzone-icon">cloud_upload</span>
          <p class="dropzone-text">Arrastra imágenes/videos o <span class="text-aero-blue">haz clic</span></p>
        </div>
        <input type="file" bind:this={fileInput} multiple accept="image/*,video/*" style="display:none" onchange={handleFiles} />
        
        {#if selectedFiles.length > 0 || uploadedMedia.length > 0}
          <div class="media-preview-grid mt-3">
            {#each uploadedMedia as media, idx}
              <div class="media-preview-item border-2 border-aero-blue">
                <img src={media.url} alt="" class="preview-thumb" />
                <button class="remove-media-btn" onclick={(e) => { e.stopPropagation(); uploadedMedia.splice(idx, 1); }}>
                  <span class="material-icons-round text-sm">close</span>
                </button>
              </div>
            {/each}
            {#each selectedFiles as file, idx}
              <div class="media-preview-item">
                {#if file.type.startsWith('video/')}
                  <media-player src={URL.createObjectURL(file)} class="preview-thumb" muted playsInline>
                    <media-outlet></media-outlet>
                  </media-player>
                {:else}
                  <img src={URL.createObjectURL(file)} alt="" class="preview-thumb" />
                {/if}
                <button class="remove-media-btn" onclick={(e) => { e.stopPropagation(); removeFile(idx); }}>
                  <span class="material-icons-round text-sm">close</span>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div style="flex: 1;"></div>

      <!-- Footer Actions -->
      <div class="create-footer mt-5 pt-4 border-t border-glass-border flex justify-between items-center gap-3">
        <div class="privacy-select-wrapper" style="width: 140px;">
          <CustomSelect bind:value={privacy} options={privacyOptions} placeholder="Público" />
        </div>
        
        <button class="btn-aero-primary px-6 publish-btn" disabled={!canPost || posting} onclick={handlePost} aria-label="Action button">
          {#if posting}
            <div class="loading-spinner"></div>
          {:else}
            <span class="material-icons-round text-sm mr-2">send</span> Publicar
          {/if}
        </button>
      </div>

    </div>

    <!-- Center/Right: Vista Previa en Vivo -->
    <div class="preview-section">
      <div class="preview-card-wrapper max-w-md w-full animate-slide-in-up">
        <div class="preview-label font-bold text-xs uppercase tracking-wider text-muted mb-4 text-center">Vista Previa en Vivo</div>
        
        <article class="preview-post-card" aria-label="Link">
          <!-- Header -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
              <!-- Avatar -->
              {#if authStore.user?.avatar_url}
                <div class="w-11 h-11 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
                  <img src={authStore.user.avatar_url} alt="" class="w-full h-full object-cover" />
                </div>
              {:else}
                <div class="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center border border-white/20 flex-shrink-0">
                  <span class="text-white font-bold">{(authStore.user?.username || '?')[0].toUpperCase()}</span>
                </div>
              {/if}
              
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-bold text-sm text-main">{authStore.user?.display_name || authStore.user?.username}</span>
                  {#if authStore.user?.is_verified}
                    <span class="material-icons-round text-[16px] text-blue-500">verified</span>
                  {/if}
                  {#if mood}
                    {@const selectedMood = moods.find(m => m.id === mood)}
                    {#if selectedMood}
                      <span class="post-mood-badge">
                        <span>{selectedMood.icon}</span>
                        <span>{selectedMood.label}</span>
                      </span>
                    {/if}
                  {/if}
                </div>
                <div class="flex flex-col">
                  <span class="text-[10px] text-muted">@{authStore.user?.username || 'usuario'} • Hace un momento</span>
                  {#if locationName}
                    <span class="text-[10px] text-sky-400 font-semibold flex items-center gap-0.5 mt-0.5">
                      <span class="material-icons-round text-xs">location_on</span>
                      {locationName}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          </div>

          <!-- Body -->
          {#if bodyText.trim()}
            <p class="post-body text-sm text-main my-3 whitespace-pre-wrap">{bodyText}</p>
          {:else}
            <p class="post-body text-sm text-muted my-3 italic">Escribe algo en la caja de texto para verlo aquí...</p>
          {/if}

          <!-- Poll Widget -->
          {#if showPollCreator && pollQuestion.trim()}
            <div class="poll-widget-container p-4 rounded-xl mb-4 bg-surface/30 border border-subtle max-w-sm">
              <div class="poll-question font-bold text-xs text-main mb-3">
                {pollQuestion}
              </div>
              <div class="flex flex-col gap-2">
                {#each pollOptions.filter(o => o.trim()) as option}
                  <div class="poll-option-btn w-full p-2.5 rounded-lg border border-subtle bg-surface/50 text-left font-semibold text-xs text-main flex justify-between items-center">
                    <span>{option}</span>
                    <span class="material-icons-round text-muted text-xs">radio_button_unchecked</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Media Previews -->
          {#if selectedFiles.length > 0 || uploadedMedia.length > 0}
            <div class="grid gap-2 rounded-xl overflow-hidden mt-3 max-h-[300px]" style="grid-template-columns: {selectedFiles.length + uploadedMedia.length > 1 ? '1fr 1fr' : '1fr'};">
              {#each uploadedMedia as media}
                <div class="relative aspect-video bg-neutral-900 flex items-center justify-center">
                  <img src={media.url} alt="" class="w-full h-full object-cover" />
                  {#if media.klipy}
                    <span class="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white font-bold tracking-wider">GIF</span>
                  {/if}
                </div>
              {/each}
              {#each selectedFiles as file}
                <div class="relative aspect-video bg-neutral-900 flex items-center justify-center">
                  {#if file.type.startsWith('video/')}
                    <media-player src={URL.createObjectURL(file)} class="w-full h-full object-cover" muted playsInline>
                      <media-outlet></media-outlet>
                    </media-player>
                    <span class="absolute top-2 right-2 bg-black/60 p-1 rounded-full"><span class="material-icons-round text-white text-xs">videocam</span></span>
                  {:else}
                    <img src={URL.createObjectURL(file)} alt="" class="w-full h-full object-cover" />
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <!-- Mock Actions -->
          <div class="action-bar flex justify-between border-t border-subtle pt-3 mt-4 text-xs text-muted font-semibold">
            <span class="flex items-center gap-1 cursor-pointer hover:text-rose-500 transition"><span class="material-icons-round text-sm">favorite_border</span> 0</span>
            <span class="flex items-center gap-1 cursor-pointer hover:text-blue-500 transition"><span class="material-icons-round text-sm">chat_bubble_outline</span> 0</span>
            <span class="flex items-center gap-1 cursor-pointer hover:text-green-500 transition"><span class="material-icons-round text-sm">share</span> Compartir</span>
            <span class="flex items-center gap-1 cursor-pointer hover:text-amber-500 transition"><span class="material-icons-round text-sm">bookmark_border</span> Guardar</span>
          </div>
        </article>
      </div>
    </div>

  </div>
</div>

<style>
  .creator-container {
    min-height: calc(100vh - 64px);
    background: transparent;
  }

  .creator-layout {
    display: flex;
    min-height: calc(100vh - 64px);
  }

  /* ── 2-Column Widescreen Layout ── */
  .tools-sidebar {
    width: 440px;
    background: var(--glass-bg);
    border-right: 1px solid var(--glass-border);
    display: flex;
    flex-direction: column;
    padding: 24px;
    border-radius: 0;
    overflow-y: auto;
    flex-shrink: 0;
    position: sticky;
    top: 64px;
    height: calc(100vh - 64px);
  }

  .preview-section {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at center, rgba(46, 134, 232, 0.05) 0%, transparent 70%);
    position: relative;
    padding: 40px 20px;
  }

  .create-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .back-link {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    text-decoration: none;
    transition: all 0.2s;
  }
  .back-link:hover {
    background: rgba(255,255,255,0.1);
    transform: translateX(-2px);
  }

  .create-title {
    font-family: var(--font-display);
    font-size: 1.35rem;
    margin: 0;
    flex: 1;
  }

  .tool-section { margin-bottom: 20px; width: 100%; }
  .section-label { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; }

  .post-textarea {
    width: 100%;
    background: transparent;
    border: none;
    resize: none;
    font-size: 1rem;
    color: var(--text-primary);
    outline: none;
    line-height: 1.5;
    font-family: var(--font-sans);
  }
  .post-textarea::placeholder { color: var(--text-muted); opacity: 0.6; }

  /* ── Dropdown Panels ── */
  .dropdown-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    padding: 16px;
    box-shadow: var(--glass-shadow);
  }



  /* Poll Panel */
  .poll-options-list { display: flex; flex-direction: column; gap: 8px; }
  .poll-option-row { display: flex; align-items: center; gap: 8px; }
  .poll-num { width: 24px; height: 24px; border-radius: 50%; background: var(--bg-overlay); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); }
  .poll-remove-btn { color: var(--text-muted); background: transparent; border: none; cursor: pointer; transition: color 0.2s; }
  .poll-remove-btn:hover { color: var(--aero-rose); }
  .poll-add-btn { display: flex; align-items: center; gap: 4px; background: transparent; border: 1px dashed var(--glass-border); border-radius: 8px; padding: 6px 12px; color: var(--text-muted); font-size: 0.8rem; font-weight: 600; cursor: pointer; margin-top: 8px; transition: all 0.2s; }
  .poll-add-btn:hover { border-color: var(--aero-blue); color: var(--aero-blue); background: rgba(74, 171, 223, 0.05); }

  /* ── Mood Section ── */
  .mood-section { width: 100%; }
  .mood-carousel { position: relative; display: flex; align-items: center; }
  
  .mood-scroller { 
    display: flex; gap: 10px; overflow-x: auto; padding: 0 32px 8px 32px; 
    scrollbar-width: none; flex: 1; -ms-overflow-style: none; scroll-behavior: smooth; 
    mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
    -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
    cursor: grab;
  }
  .mood-scroller.dragging { cursor: grabbing; scroll-behavior: auto; }
  .mood-scroller.dragging .mood-pill { pointer-events: none; }
  .mood-scroller::-webkit-scrollbar { display: none; }
  
  .mood-pill { 
    display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 9999px; 
    border: 1px solid var(--glass-border); background: var(--bg-overlay); color: var(--text-primary); 
    cursor: pointer; transition: all 0.2s; white-space: nowrap; box-shadow: var(--shadow-xs); 
  }
  .mood-pill:hover { border-color: rgba(255,255,255,0.2); background: var(--bg-surface-hover); transform: translateY(-2px); }
  .mood-pill.selected { border-color: var(--aero-blue); background: rgba(74, 171, 223, 0.15); box-shadow: 0 4px 14px rgba(74, 171, 223, 0.3); color: var(--aero-sky); transform: translateY(-2px); }
  .m-icon { font-size: 1.1rem; }
  .m-label { font-size: 0.8rem; font-weight: 600; }
  
  .scroll-btn {
    position: absolute;
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--bg-surface2); border: 1px solid var(--border-subtle);
    color: var(--text-secondary); cursor: pointer;
    z-index: 2;
    transition: all 0.2s;
    margin-top: -8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .scroll-btn:hover { background: var(--bg-overlay); color: var(--text-primary); border-color: var(--aero-blue); }
  .scroll-btn.left { left: 0; }
  .scroll-btn.right { right: 0; }

  /* ── Drag & Drop Area ── */
  .media-dropzone {
    border: 2px dashed var(--glass-border);
    border-radius: 16px;
    padding: 18px;
    text-align: center;
    background: var(--bg-overlay);
    transition: all 0.2s;
    cursor: pointer;
  }
  .media-dropzone:hover, .media-dropzone.drag-over {
    border-color: var(--aero-blue);
    background: rgba(74, 171, 223, 0.05);
  }
  .dropzone-icon { font-size: 2.2rem; color: var(--text-muted); margin-bottom: 4px; }
  .media-dropzone:hover .dropzone-icon { color: var(--aero-blue); }
  .dropzone-text { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; }

  /* ── Media Preview ── */
  .media-preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 10px; }
  .media-preview-item { position: relative; border-radius: 12px; overflow: hidden; aspect-ratio: 1; box-shadow: var(--shadow-sm); }
  .preview-thumb { width: 100%; height: 100%; object-fit: cover; }
  .remove-media-btn { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.6); border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; }
  .remove-media-btn:hover { background: rgba(232, 74, 114, 0.9); }

  /* ── Live Preview Card Stylings (VSocial lookalike) ── */
  .preview-card-wrapper {
    display: flex;
    flex-direction: column;
  }
  .preview-label {
    text-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }
  .preview-post-card {
    background: var(--glass-bg);
    backdrop-filter: blur(25px) saturate(1.4);
    -webkit-backdrop-filter: blur(25px) saturate(1.4);
    border: 1px solid var(--glass-border);
    border-top-color: var(--glass-border-t);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-lg), var(--glass-inset);
    width: 100%;
  }

  .text-main { color: var(--text-primary); }
  .text-muted { color: var(--text-muted); }

  .post-mood-badge {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    padding: 2px 8px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .poll-widget-container {
    background: var(--bg-overlay);
    backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border);
  }

  .poll-option-btn {
    transition: all 0.2s;
  }

  .action-bar {
    border-top: 1px solid var(--border-subtle);
  }

  /* ── Dock Action Bar ── */
  .action-dock {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 8px;
    padding: 12px 10px;
    border-radius: 24px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-sm), inset 0 1px 1px rgba(255,255,255,0.1);
    backdrop-filter: blur(12px);
  }

  .dock-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    padding: 16px 8px 14px 8px;
    border-radius: 16px;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    position: relative;
    transition: background 0.3s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.3s ease;
  }
  .dock-btn:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.05);
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.15);
  }
  .dock-btn.pressed {
    background: rgba(74,171,223,0.12);
    border-color: rgba(74,171,223,0.3);
    box-shadow: 0 8px 24px rgba(74,171,223,0.25), inset 0 0 16px rgba(74,171,223,0.1);
    transform: translateY(-2px);
  }
  .dock-btn:active {
    transform: scale(0.94) translateY(0px);
    background: rgba(255,255,255,0.1);
    box-shadow: none;
  }

  .dock-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 16px;
    font-family: 'Material Icons Round';
    font-size: 26px;
    line-height: 1;
    color: var(--text-secondary);
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: inset 0 1px 2px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.1);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    -webkit-font-smoothing: antialiased;
    font-feature-settings: 'liga';
  }
  .dock-btn:hover .dock-icon {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.15);
    transform: scale(1.08);
    box-shadow: inset 0 1px 3px rgba(255,255,255,0.2), 0 4px 8px rgba(0,0,0,0.15);
  }
  .dock-btn.pressed .dock-icon {
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transform: scale(1.1);
  }

  /* ── Icon accent colors ── */
  .dock-btn .dock-icon.amber  { color: #fbbf24; }
  .dock-btn .dock-icon.fuchsia{ color: #e879f9; }
  .dock-btn .dock-icon.emerald{ color: #34d399; }
  .dock-btn .dock-icon.sky    { color: #38bdf8; }
  .dock-btn .dock-icon.indigo { color: #818cf8; }

  .dock-btn.pressed .dock-icon.amber   { background: rgba(251, 191, 36, 0.12);  border-color: rgba(251,191,36,0.30); box-shadow: 0 0 10px rgba(251,191,36,0.20); }
  .dock-btn.pressed .dock-icon.fuchsia { background: rgba(232,121,249,0.12);  border-color: rgba(232,121,249,0.30); box-shadow: 0 0 10px rgba(232,121,249,0.20); }
  .dock-btn.pressed .dock-icon.emerald { background: rgba( 52,211,153,0.12);  border-color: rgba( 52,211,153,0.30); box-shadow: 0 0 10px rgba(52,211,153,0.20); }
  .dock-btn.pressed .dock-icon.sky     { background: rgba( 56,189,248,0.12);  border-color: rgba( 56,189,248,0.30); box-shadow: 0 0 10px rgba(56,189,248,0.20); }
  .dock-btn.pressed .dock-icon.indigo  { background: rgba(129,140,248,0.12);  border-color: rgba(129,140,248,0.30); box-shadow: 0 0 10px rgba(129,140,248,0.20); }

  .dock-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-muted);
    transition: color 0.3s ease, text-shadow 0.3s ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    line-height: 1.2;
  }
  .dock-btn:hover .dock-label {
    color: var(--text-primary);
  }
  .dock-btn.pressed .dock-label {
    color: var(--text-primary);
    text-shadow: 0 0 12px rgba(255,255,255,0.4);
  }

  .dock-ping {
    position: absolute;
    top: 4px;
    right: 6px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--aero-rose);
    box-shadow: 0 0 6px var(--aero-rose);
    animation: ping 1.2s cubic-bezier(0,0,0.2,1) infinite;
    pointer-events: none;
  }
  @keyframes ping {
    75%, 100% { transform: scale(2); opacity: 0; }
  }

  /* ── Footer / Submit ── */
  .publish-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-weight: 700;
  }
  .loading-spinner { display: inline-block; width: 18px; height: 18px; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.75s linear infinite; }
  .error-bar { background: rgba(232, 74, 114, 0.1); color: var(--aero-rose); padding: 10px 14px; border-radius: 12px; font-size: 0.8rem; display: flex; align-items: center; gap: 8px; }
  
  @keyframes popIn {
    0% { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 1000px) {
    .creator-layout { flex-direction: column; overflow-y: auto; }
    .tools-sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--glass-border); }
    .preview-section { padding: 40px 20px; }
  }
</style>
