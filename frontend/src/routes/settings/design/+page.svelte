<script>
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { users as usersApi, media as mediaApi } from '$lib/api.js';
  import { authStore } from '$lib/stores/auth.svelte.js';

  let saving = $state(false);
  let message = $state({ type: '', text: '' });
  let loading = $state(true);

  // Panel State
  let activeTab = $state('style'); // 'style', 'blocks'
  let panelOpen = $state(true);
  let showAdvancedCSS = $state(false); // Modal state for Power CSS

  // Customization State
  let primaryColor = $state('#1b85f3');
  let bgColor = $state(''); // Empty inherits from theme
  let bgImageUrl = $state('');
  let glassBlur = $state(15);
  let glassOpacity = $state(0.8);
  let fontFamily = $state('');
  let customFontUrl = $state('');
  let customCss = $state('');
  
  // Blocks State
  let blocksLayout = $state([]);
  let initialLoadDone = $state(false);

  const BASE_BLOCKS = [
    { id: 'bio', type: 'text', label: 'Biografía / Texto Libre', content: 'Este es un bloque de texto que puedes personalizar en tu perfil.', enabled: true },
    { id: 'social', type: 'links', label: 'Mis Redes Sociales', links: [{title: 'Instagram', url: '#'}, {title: 'Twitter', url: '#'}], enabled: true },
    { id: 'feed', type: 'feed', label: 'Línea de Tiempo (Feed)', enabled: true },
    { id: 'photos', type: 'photos', label: 'Galería Destacada', enabled: false }
  ];

  // Load user customization when auth is ready
  $effect(() => {
    if (authStore.user?.username && !initialLoadDone) {
      initialLoadDone = true;
      loading = true;
      usersApi.get(authStore.user.username).then(res => {
        if (res?.user?.customization) {
          const c = res.user.customization;
          primaryColor = c.primary_color || '#1b85f3';
          bgColor = c.bg_color || '';
          bgImageUrl = c.bg_image_url || '';
          glassBlur = c.glass_blur !== undefined ? c.glass_blur : 15;
          glassOpacity = c.glass_opacity !== undefined ? c.glass_opacity : 0.8;
          fontFamily = c.font_family || '';
          customFontUrl = c.custom_font_url || '';
          customCss = c.custom_css || '';
          
          if (c.blocks_layout) {
            try {
              let savedBlocks = typeof c.blocks_layout === 'string' ? JSON.parse(c.blocks_layout) : c.blocks_layout;
              if (savedBlocks && savedBlocks.length > 0) {
                blocksLayout = savedBlocks;
                const existingIds = new Set(blocksLayout.map(b => b.id));
                for (const b of BASE_BLOCKS) {
                  if (!existingIds.has(b.id)) {
                    blocksLayout.push({ ...b, enabled: false });
                  }
                }
              } else {
                blocksLayout = JSON.parse(JSON.stringify(BASE_BLOCKS));
              }
            } catch(e) {
              console.error("Error parsing blocks", e);
              blocksLayout = JSON.parse(JSON.stringify(BASE_BLOCKS));
            }
          } else {
            blocksLayout = JSON.parse(JSON.stringify(BASE_BLOCKS));
          }
        } else {
          blocksLayout = JSON.parse(JSON.stringify(BASE_BLOCKS));
        }
      }).catch(err => {
        console.error("Failed to load customization:", err);
        blocksLayout = JSON.parse(JSON.stringify(BASE_BLOCKS));
      }).finally(() => {
        loading = false;
      });
    }
  });

  async function handleFontUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    saving = true;
    message = { type: '', text: '' };
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('context', 'font');
      const res = await mediaApi.upload(fd);
      if (res.success) {
        customFontUrl = res.url;
        if (!fontFamily) fontFamily = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '');
        message = { type: 'success', text: 'Fuente subida con éxito' };
        setTimeout(() => message = { type: '', text: '' }, 3000);
      }
    } catch (err) {
      message = { type: 'error', text: err?.message || 'Error al subir la fuente' };
    } finally {
      saving = false;
    }
  }

  async function saveDesign() {
    saving = true;
    message = { type: '', text: '' };
    try {
      await usersApi.updateCustomization({
        primary_color: primaryColor,
        bg_color: bgColor,
        bg_image_url: bgImageUrl,
        glass_blur: glassBlur,
        glass_opacity: glassOpacity,
        font_family: fontFamily,
        custom_font_url: customFontUrl,
        custom_css: customCss,
        blocks_layout: JSON.stringify(blocksLayout)
      });
      message = { type: 'success', text: '¡Guardado con éxito!' };
      setTimeout(() => message = { type: '', text: '' }, 3000);
    } catch (err) {
      message = { type: 'error', text: err?.message || 'Error al guardar diseño' };
    } finally {
      saving = false;
    }
  }

  function moveBlockUp(index) {
    if (index === 0) return;
    const temp = blocksLayout[index];
    blocksLayout[index] = blocksLayout[index - 1];
    blocksLayout[index - 1] = temp;
  }

  function moveBlockDown(index) {
    if (index === blocksLayout.length - 1) return;
    const temp = blocksLayout[index];
    blocksLayout[index] = blocksLayout[index + 1];
    blocksLayout[index + 1] = temp;
  }

  function toggleBlock(index) {
    blocksLayout[index].enabled = !blocksLayout[index].enabled;
  }

  function addLink(block) {
    if (!block.links) block.links = [];
    block.links.push({title: 'Nuevo Enlace', url: 'https://'});
    blocksLayout = [...blocksLayout];
  }
  function removeLink(block, linkIndex) {
    block.links.splice(linkIndex, 1);
    blocksLayout = [...blocksLayout];
  }
</script>

<svelte:head>
  <title>Editor de Diseño — VSocial</title>
  {#if customFontUrl}
    <style>
      @font-face {
        font-family: '{fontFamily || "CustomFont"}';
        src: url('{customFontUrl}');
        font-display: swap;
      }
    </style>
  {/if}
  {#if customCss && !showAdvancedCSS}
    <style>{customCss}</style>
  {/if}
</svelte:head>

<!-- Global CSS Injection during preview so it applies to the canvas -->
{#if customCss}
  <div style="display:none;">
    <style>{customCss}</style>
  </div>
{/if}

<div class="immersive-canvas profile-custom-wrapper" style="
  {bgColor ? `background-color: ${bgColor};` : ''}
  {bgImageUrl ? `background-image: url('${bgImageUrl}'); background-size: cover; background-position: center; background-attachment: fixed;` : ''}
  {bgColor ? `--bg-main: ${bgColor};` : ''}
  --accent-blue-base: {primaryColor};
  --glass-blur: blur({glassBlur}px) saturate(1.2);
  font-family: {fontFamily ? `'${fontFamily}', sans-serif` : 'inherit'};
">

  <!-- Profile Preview Container -->
  <main class="profile-preview-wrapper">
    <div class="profile-preview-mockup">
      <!-- Profile Header Mockup -->
      <div class="profile-header-card glass-panel mockup-card">
        <div class="profile-cover" style="
          height: 140px; 
          background: {authStore.user?.cover_url ? `url('${authStore.user.cover_url}') center/cover` : 'rgba(0,0,0,0.1)'}; 
          border-radius: var(--radius-md) var(--radius-md) 0 0;
        "></div>
        <div class="profile-header px-6 pb-6 relative" style="margin-top: -40px;">
          <div class="flex items-end justify-between">
            <div class="flex gap-4 items-end">
              <div class="avatar-mockup glass-card flex items-center justify-center text-3xl font-bold overflow-hidden" style="width: 100px; height: 100px; border-radius: 50%; background: var(--bg-surface); border: 2px solid var(--border-subtle); box-shadow: var(--shadow-md);">
                {#if authStore.user?.avatar_url}
                  <img src={authStore.user.avatar_url} alt="Avatar" class="w-full h-full object-cover" />
                {:else}
                  {authStore.user?.display_name?.[0] || 'U'}
                {/if}
              </div>
              <div class="pb-2">
                <h1 class="text-3xl font-bold" style="color: var(--text-primary);">{authStore.user?.display_name || 'Tu Nombre'}</h1>
                <p style="color: var(--text-secondary);">@{authStore.user?.username || 'usuario'}</p>
              </div>
            </div>
            <div class="pb-2 flex gap-2">
              <button class="btn-aero-secondary">Mensaje</button>
              <button class="btn-aero-primary">Seguir</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Blocks Render Area -->
      <div class="blocks-preview-area mt-4 flex flex-col gap-4">
        {#each blocksLayout as block (block.id)}
          {#if block.enabled}
            <div class="glass-card mockup-card p-6" transition:fade>
              {#if block.type === 'text'}
                <h3 class="text-lg font-bold text-main mb-2">Sobre Mí</h3>
                <p style="font-size: 1.05rem; line-height: 1.6; color: var(--text-secondary); white-space: pre-wrap;">{block.content}</p>
              {:else if block.type === 'links'}
                <h3 class="text-lg font-bold text-main mb-2">Mis Enlaces</h3>
                <div class="flex gap-2 flex-wrap">
                  {#each (block.links || []) as link}
                    <span class="aero-badge-virtual px-3 py-1 cursor-pointer">{link.title || 'Enlace'}</span>
                  {/each}
                </div>
              {:else if block.type === 'feed'}
                <h3 class="text-lg font-bold text-main mb-4">Últimas Publicaciones</h3>
                <div class="glass-panel p-4 rounded-xl opacity-60">
                  <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 rounded-full bg-black/5" style="{authStore.user?.avatar_url ? `background: url('${authStore.user.avatar_url}') center/cover` : ''}"></div>
                    <div class="w-32 h-4 rounded-full bg-black/5"></div>
                  </div>
                  <div class="w-full h-24 rounded-lg bg-black/5"></div>
                </div>
              {:else if block.type === 'photos'}
                <h3 class="text-lg font-bold text-main mb-4">Galería</h3>
                <div class="grid grid-cols-3 gap-2">
                  <div class="aspect-square rounded-lg bg-black/5"></div>
                  <div class="aspect-square rounded-lg bg-black/5"></div>
                  <div class="aspect-square rounded-lg bg-black/5"></div>
                </div>
              {/if}
            </div>
          {/if}
        {/each}
        {#if blocksLayout.length > 0 && !blocksLayout.some(b => b.enabled)}
          <div class="glass-card mockup-card p-8 text-center text-muted">
            <span class="material-icons-round text-4xl mb-2 opacity-50">layers_clear</span>
            <p>No tienes ningún bloque activo. Tu perfil se verá vacío.</p>
          </div>
        {/if}
      </div>
    </div>
  </main>

  <!-- Floating Properties Panel -->
  {#if panelOpen}
    <aside class="floating-properties-panel glass-panel shadow-neon" transition:slide={{ axis: 'x', duration: 300 }}>
      
      <!-- Top Action Bar inside the panel -->
      <div class="panel-top-actions glass-panel">
        <a href="/settings" class="btn-icon" title="Volver a Ajustes">
          <span class="material-icons-round">arrow_back</span>
        </a>
        <h2 class="panel-title text-[1.1rem] font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">Re-Designer</h2>
        <a href="/u/{authStore.user?.username}" class="btn-icon" target="_blank" title="Ver Perfil Público">
          <span class="material-icons-round">visibility</span>
        </a>
      </div>

      <!-- Panel Header Tabs -->
      <div class="panel-tabs">
        <button class:active={activeTab === 'style'} onclick={() => activeTab = 'style'}>Estética</button>
        <button class:active={activeTab === 'blocks'} onclick={() => activeTab = 'blocks'}>Bloques</button>
      </div>

      <div class="panel-content">
        {#if message.text}
          <div class="alert {message.type === 'error' ? 'alert-error' : 'alert-success'} mb-4 text-sm font-semibold py-3 text-center">
            {message.text}
          </div>
        {/if}

        {#if activeTab === 'style'}
          <!-- STYLE TAB -->
          <div class="props-section">
            <h4 class="props-title">Colores Globales</h4>
            <div class="prop-row">
              <label for="primary-color">Color Neón (Primario)</label>
              <div class="flex items-center gap-2">
                 <span class="text-xs text-muted uppercase font-mono">{primaryColor}</span>
                 <input id="primary-color" name="primary-color" type="color" bind:value={primaryColor} class="color-picker-mini" />
              </div>
            </div>
            <div class="prop-row">
              <label for="bg-color">Color de Fondo</label>
              <div class="flex items-center gap-2">
                 <span class="text-xs text-muted uppercase font-mono">{bgColor || 'Tema'}</span>
                 <input id="bg-color" name="bg-color" type="color" bind:value={bgColor} class="color-picker-mini" />
                 {#if bgColor}
                   <button class="btn-icon" style="width:24px;height:24px;min-height:24px" onclick={() => bgColor = ''} title="Restablecer a Tema">
                     <span class="material-icons-round text-[14px]">refresh</span>
                   </button>
                 {/if}
              </div>
            </div>
          </div>
          <div class="props-section mt-6">
            <h4 class="props-title">Fondo Inmersivo</h4>
            <div class="prop-col">
              <label for="bg-image">URL de Imagen (Fija)</label>
              <input id="bg-image" name="bg-image" type="text" bind:value={bgImageUrl} class="aero-input-sm" placeholder="https://..." />
            </div>
          </div>
          <div class="props-section mt-6">
            <h4 class="props-title">Física del Cristal</h4>
            <div class="prop-col">
              <label for="glass-blur" class="flex justify-between"><span>Intensidad de Blur</span> <span class="font-bold text-primary">{glassBlur}px</span></label>
              <input id="glass-blur" name="glass-blur" type="range" min="0" max="40" bind:value={glassBlur} class="range range-primary range-xs" />
              <span class="text-[10px] text-muted italic mt-1">* Solo es visible si hay una imagen de fondo u otros elementos detrás del panel.</span>
            </div>
            <div class="prop-col mt-3">
              <span class="flex justify-between text-muted text-xs italic">La Opacidad del panel actualmente hereda del tema de usuario.</span>
            </div>
          </div>
          <div class="props-section mt-6">
            <h4 class="props-title">Tipografía (.otf / .ttf)</h4>
            <div class="prop-col">
              <div class="relative w-full border-2 border-dashed border-blue-500/30 rounded-xl bg-blue-500/5 hover:bg-blue-500/10 transition-colors cursor-pointer group flex flex-col items-center justify-center py-6">
                <input id="font-upload" name="font-upload" type="file" accept=".otf,.ttf,.woff2" onchange={handleFontUpload} class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <span class="material-icons-round text-3xl text-blue-500/70 group-hover:text-blue-500 mb-2 transition-colors">font_download</span>
                <span class="text-sm font-bold text-main group-hover:text-blue-500 transition-colors">Sube o suelta una fuente aquí</span>
                <span class="text-xs text-muted mt-1">.otf, .ttf, o .woff2</span>
              </div>
              {#if customFontUrl}
                <div class="mt-3 flex gap-2 items-center">
                  <label for="font-family" class="sr-only">Nombre de fuente</label>
                  <input id="font-family" name="font-family" type="text" bind:value={fontFamily} class="aero-input-sm flex-1" placeholder="Nombre de tu fuente" />
                </div>
              {/if}
            </div>
          </div>
          
          <div class="mt-8 text-center">
            <button class="btn-advanced" onclick={() => showAdvancedCSS = true}>
              <span class="material-icons-round text-[16px]">code</span>
              Modo Avanzado (CSS)
            </button>
          </div>

        {:else if activeTab === 'blocks'}
          <!-- BLOCKS TAB -->
          <div class="props-section">
            <h4 class="props-title mb-2">Estructura del Perfil</h4>
            <p class="text-xs text-muted mb-4 leading-tight">Activa o desactiva los bloques de tu perfil. Despliega para editar su contenido.</p>
            
            {#if blocksLayout.length === 0}
               <p class="text-center text-muted text-sm mt-8">Cargando bloques...</p>
            {/if}

            <div class="blocks-list">
              {#each blocksLayout as block, i}
                <div class="block-editor-card glass-card {block.enabled ? 'is-active' : 'is-inactive'} flex flex-col">
                  
                  <div class="flex items-center justify-between w-full">
                    <div class="block-info flex-1">
                      <span class="block-icon material-icons-round">{block.type === 'text' ? 'notes' : block.type === 'links' ? 'link' : block.type === 'feed' ? 'dynamic_feed' : 'collections'}</span>
                      <span class="block-label truncate">{block.label}</span>
                    </div>
                    
                      <label class="sr-only" for="block-enable-{i}">Enable block {block.label}</label>
                      <input id="block-enable-{i}" name="block-enable-{i}" type="checkbox" class="toggle toggle-primary toggle-sm mr-2" checked={block.enabled} onchange={() => toggleBlock(i)} />
                      
                      <div class="order-arrows flex flex-col">
                        <button class="arrow-btn" disabled={i === 0} onclick={() => moveBlockUp(i)}>
                          <span class="material-icons-round text-[14px]">expand_less</span>
                        </button>
                        <button class="arrow-btn" disabled={i === blocksLayout.length - 1} onclick={() => moveBlockDown(i)}>
                          <span class="material-icons-round text-[14px]">expand_more</span>
                        </button>
                      </div>
                    </div>
                  <!-- EDITOR EN LÍNEA DEL BLOQUE -->
                  {#if block.enabled}
                    <div class="w-full mt-3 pt-3 border-t" style="border-color: rgba(255,255,255,0.1);">
                      {#if block.type === 'text'}
                        <label for="block-content-{i}" class="text-xs text-muted mb-1 block">Contenido del Texto</label>
                        <textarea id="block-content-{i}" name="block-content-{i}" bind:value={block.content} class="aero-textarea w-full text-sm p-2 bg-black/10 border-white/5 rounded-md" rows="2" placeholder="Escribe algo sobre ti..."></textarea>
                      {:else if block.type === 'links'}
                        <span class="text-xs text-muted mb-2 block">Lista de Enlaces</span>
                        <div class="flex flex-col gap-2">
                           {#each (block.links || []) as link, li}
                              <div class="flex gap-1 items-center">
                                <label for="link-title-{i}-{li}" class="sr-only">Title</label>
                                <input id="link-title-{i}-{li}" name="link-title-{i}-{li}" type="text" bind:value={link.title} placeholder="Título" class="aero-input-sm w-24 bg-black/10" />
                                <label for="link-url-{i}-{li}" class="sr-only">URL</label>
                                <input id="link-url-{i}-{li}" name="link-url-{i}-{li}" type="url" bind:value={link.url} placeholder="https://" class="aero-input-sm flex-1 bg-black/10" />
                                <button class="btn-icon bg-red-500/10 text-red-400 hover:bg-red-500/20" style="width:28px;height:28px" onclick={() => removeLink(block, li)}>
                                  <span class="material-icons-round text-sm">close</span>
                                </button>
                              </div>
                           {/each}
                           <button class="btn-aero-secondary text-xs py-1 mt-1 border-dashed" onclick={() => addLink(block)}>+ Añadir Enlace</button>
                        </div>
                      {:else}
                         <p class="text-xs text-muted italic text-center">Este bloque se llena automáticamente con tu contenido real.</p>
                      {/if}
                    </div>
                  {/if}
                  
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- BOTTOM SAVE BUTTON -->
      <div class="panel-footer glass-panel">
        <button class="btn-aero-primary w-full" onclick={saveDesign} disabled={saving} style="padding: 12px; font-size: 0.95rem; font-weight: 700;">
          {#if saving}
            <span class="loading loading-spinner loading-sm mr-2"></span>
          {/if}
          {saving ? 'Aplicando...' : 'Guardar Diseño'}
        </button>
      </div>
    </aside>
  {/if}

  <!-- Toggle Panel Button (Visible when closed) -->
  {#if !panelOpen}
    <button class="btn-toggle-panel glass-card shadow-neon" onclick={() => panelOpen = true} transition:fade>
      <span class="material-icons-round">palette</span>
    </button>
  {:else}
    <button class="btn-close-panel glass-card" onclick={() => panelOpen = false} transition:fade>
      <span class="material-icons-round">close</span>
    </button>
  {/if}
</div>

<!-- ADVANCED CSS MODAL -->
{#if showAdvancedCSS}
<div class="advanced-css-modal" transition:fade>
  <div class="advanced-css-content glass-panel shadow-neon">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold flex items-center gap-2">
        <span class="material-icons-round text-primary">terminal</span>
        Power User CSS
      </h2>
      <button class="btn-icon" onclick={() => showAdvancedCSS = false}>
        <span class="material-icons-round">close</span>
      </button>
    </div>
    
    <div class="glass-panel p-4 rounded-lg mb-4 text-sm leading-relaxed" style="background: rgba(27,133,243,0.08); border-color: rgba(27,133,243,0.15);">
      <p class="font-bold text-main mb-2">¡Zona de Riesgo! Inyección de CSS Directo</p>
      <p class="text-muted mb-2">Usa esto solo si sabes lo que haces. Para evitar romper la estructura global de la red social, tus reglas deben estar precedidas por <code class="bg-black/10 px-1 rounded font-mono text-primary">.profile-custom-wrapper</code>.</p>
      <p class="text-muted font-mono text-xs bg-black/10 p-2 rounded">
        .profile-custom-wrapper .glass-card {`{\n  border-radius: 0;\n  box-shadow: 10px 10px 0 #1b85f3;\n}`}
      </p>
    </div>

    <textarea 
      bind:value={customCss} 
      class="aero-textarea code-editor" 
      placeholder="/* Escribe tus reglas CSS aquí */"
      spellcheck="false"
    ></textarea>

    <div class="flex justify-end mt-4">
      <button class="btn-aero-primary" onclick={() => showAdvancedCSS = false}>Confirmar Inyección</button>
    </div>
  </div>
</div>
{/if}

<style>
  .immersive-canvas {
    position: relative;
    width: 100%;
    min-height: calc(100vh - 4rem);
    overflow: hidden;
    z-index: 10;
    transition: background 0.4s ease;
    box-shadow: var(--shadow-md);
  }

  /* --- Preview Area --- */
  .profile-preview-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 40px 20px 100px;
  }
  .profile-preview-mockup {
    max-width: 700px;
    margin: 0 auto;
    /* Optional: shift left slightly to make room for panel */
    transform: translateX(-160px); 
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @media (max-width: 1200px) {
    .profile-preview-mockup { transform: translateX(0); }
  }

  .mockup-card {
    box-shadow: var(--shadow-sm);
  }

  /* --- Floating Properties Panel --- */
  .floating-properties-panel {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 400px;
    height: calc(100% - 40px);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 105;
    background: var(--bg-surface);
    backdrop-filter: blur(28px) saturate(1.5);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
  }

  /* Top Actions inside panel */
  .panel-top-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--glass-border);
    background: rgba(0,0,0,0.1);
  }
  .panel-title {
    font-size: 1.1rem;
    font-weight: 800;
    margin: 0;
    color: var(--text-primary);
  }
  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-surface);
    color: var(--text-main);
    text-decoration: none;
    transition: all 0.2s;
    border: 1px solid var(--glass-border);
    cursor: pointer;
  }
  .btn-icon:hover {
    background: var(--bg-surface-hover);
    transform: scale(1.05);
    color: var(--accent-blue-base);
  }

  /* Tabs */
  .panel-tabs {
    display: flex;
    background: rgba(0,0,0,0.03);
    border-bottom: 1px solid var(--glass-border);
  }
  .panel-tabs button {
    flex: 1;
    padding: 14px 0;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }
  .panel-tabs button:hover {
    color: var(--text-main);
    background: rgba(0,0,0,0.05);
  }
  .panel-tabs button.active {
    color: var(--accent-blue-base);
    border-bottom-color: var(--accent-blue-base);
    background: rgba(0,0,0,0.1);
  }

  /* Panel Content */
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }
  
  /* Footer Save */
  .panel-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--glass-border);
    background: rgba(0,0,0,0.1);
  }
  
  .props-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 800;
    color: var(--text-muted);
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  .prop-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .prop-row label, .prop-col label {
    font-size: 0.85rem;
    font-weight: 650;
    color: var(--text-main);
  }
  .prop-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .color-picker-mini {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    padding: 0;
    cursor: pointer;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
  }

  .aero-input-sm {
    background: var(--bg-input);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    font-size: 0.85rem;
    color: var(--text-primary);
    width: 100%;
    transition: all 0.2s;
  }
  .aero-input-sm:focus {
    outline: none;
    border-color: var(--accent-blue-base);
    box-shadow: 0 0 0 3px rgba(27, 133, 243, 0.15);
  }
  .aero-textarea {
    background: var(--bg-input);
    border: 1px solid var(--glass-border);
    color: var(--text-primary);
    outline: none;
    resize: vertical;
    transition: all 0.2s;
  }
  .aero-textarea:focus {
    border-color: var(--accent-blue-base);
    box-shadow: 0 0 0 3px rgba(27, 133, 243, 0.15);
  }

  /* Block Editor Card */
  .block-editor-card {
    padding: 14px 16px;
    margin-bottom: 12px;
    border-radius: var(--radius-sm);
    transition: all 0.2s;
    border: 1px solid var(--glass-border);
  }
  .block-editor-card.is-inactive {
    opacity: 0.6;
    background: rgba(0,0,0,0.02);
  }
  .block-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .block-icon {
    color: var(--text-muted);
    font-size: 22px;
  }
  .is-active .block-icon {
    color: var(--accent-blue-base);
  }
  .block-label {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-main);
  }
  
  .arrow-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  .arrow-btn:hover:not(:disabled) {
    background: rgba(0,0,0,0.08);
    color: var(--text-main);
  }
  .arrow-btn:disabled {
    opacity: 0.2;
    cursor: default;
  }

  .btn-advanced {
    background: transparent;
    border: 1px dashed var(--accent-blue-base);
    color: var(--accent-blue-base);
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-advanced:hover {
    background: rgba(27,133,243,0.1);
  }

  /* Modal Advanced CSS */
  .advanced-css-modal {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(10px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .advanced-css-content {
    width: 100%;
    max-width: 700px;
    padding: 30px;
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
  }
  .code-editor {
    font-family: 'Fira Code', 'Courier New', Courier, monospace;
    font-size: 0.85rem;
    min-height: 350px;
    width: 100%;
    background: #0d1117 !important;
    color: #e6edf3;
    padding: 20px;
    border-radius: var(--radius-md);
    border: 1px solid rgba(255,255,255,0.1);
    resize: vertical;
    line-height: 1.5;
  }
  .code-editor:focus {
    border-color: var(--accent-blue-base);
    box-shadow: var(--neon-primary);
    outline: none;
  }

  /* Floating Toggle Buttons */
  .btn-close-panel {
    position: absolute;
    top: 20px;
    right: 436px; /* 400px panel + 20px margin + 16px gap */
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--bg-surface);
    border: 1px solid var(--glass-border);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-muted);
    z-index: 106;
    box-shadow: var(--shadow-md);
  }
  .btn-close-panel:hover {
    color: var(--text-main);
    background: var(--bg-surface-hover);
  }

  .btn-toggle-panel {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--bg-surface);
    border: 1px solid var(--glass-border);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--accent-blue-base);
    z-index: 106;
    box-shadow: var(--shadow-lg);
  }
  .btn-toggle-panel:hover {
    transform: scale(1.05);
  }
</style>
