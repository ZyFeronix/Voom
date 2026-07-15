<script>
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  
  // Drives CSS-only section crossfade — toggled on every section switch
  let sectionKey = $state(0);
  import { users as usersApi, feed as feedApi, auth as authApi } from '$lib/api.js';
  import { authStore } from '$lib/stores/auth.svelte.js';

  // ── Runes State ──────────────────────────────────────────────────────────
  let activeSection = $state('profile'); // 'profile', 'privacy', 'notifications', 'algorithm'
  let loading = $state(true);
  let saving = $state(false);
  let message = $state({ type: '', text: '' });

  function selectSection(section) {
    activeSection = section;
    sectionKey++;
    message = { type: '', text: '' };
  }

  // Profile fields
  let displayName = $state('');
  let bio = $state('');
  let location = $state('');
  let website = $state('');
  let avatarPreview = $state('');
  let coverPreview = $state('');
  
  // Media upload inputs
  let avatarInput = $state(null);
  let coverInput = $state(null);

  // Change Password fields
  let oldPassword = $state('');
  let newPassword = $state('');

  // Algorithm weight fields (coefficients)
  let wInterests = $state(50);
  let wInteractions = $state(40);
  let wSocial = $state(30);
  let wPopularity = $state(20);
  let wRecency = $state(70);
  let wDiversity = $state(15);
  let feedMode = $state('intelligent'); // 'retention', 'intelligent', or 'radar'
  let feedModeOpen = $state(false);
  const feedModeLabels = {
    'retention': 'Descubrimiento (Para Ti)',
    'intelligent': 'Feed Inteligente (Personalizado)',
    'radar': 'Radar en Vivo (Línea de Tiempo)'
  };

  // Privacy fields
  let profileVisibility = $state('public');
  let allowDMs = $state('everyone');
  let showOnlineStatus = $state(true);

  // Notification fields
  let notifyLikes = $state(true);
  let notifyComments = $state(true);
  let notifyFollows = $state(true);
  let notifyDMs = $state(true);

  // Derived: sum of algorithm weights for percentage calculations
  let totalWeight = $derived(
    Math.max(1, Number(wInterests) + Number(wInteractions) + Number(wSocial) + Number(wPopularity) + Number(wRecency) + Number(wDiversity))
  );

  // ── Lifecycle ────────────────────────────────────────────────────────────
  onMount(async () => {
    loading = true;
    try {
      // Load user profile defaults
      if (authStore.user) {
        displayName = authStore.user.display_name || '';
        bio = authStore.user.bio || '';
        location = authStore.user.location || '';
        website = authStore.user.website || '';
        avatarPreview = authStore.user.avatar_url || '';
        coverPreview = authStore.user.cover_url || '';
      }

      // Load algorithm preferences
      try {
        const prefRes = await feedApi.preferences.get();
        if (prefRes.preferences) {
          const p = prefRes.preferences;
          wInterests = p.w_interests ?? 50;
          wInteractions = p.w_interactions ?? 40;
          wSocial = p.w_social ?? 30;
          wPopularity = p.w_popularity ?? 20;
          wRecency = p.w_recency ?? 70;
          wDiversity = p.w_diversity ?? 15;
          feedMode = p.feed_mode ?? 'intelligent';
        }
      } catch (err) {
        console.warn('Algorithm preferences endpoint failed, using default state.');
      }

      // Load user general settings
      try {
        const settingsRes = await usersApi.settings.get();
        if (settingsRes.settings) {
          const s = settingsRes.settings;
          profileVisibility = s.profile_visibility ?? 'public';
          allowDMs = s.allow_dms ?? 'everyone';
          showOnlineStatus = s.show_online_status ?? true;
          notifyLikes = s.notify_likes ?? true;
          notifyComments = s.notify_comments ?? true;
          notifyFollows = s.notify_follows ?? true;
          notifyDMs = s.notify_dms ?? true;
        }
      } catch (err) {
        console.warn('General settings endpoint failed, using local mockup defaults.');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      loading = false;
    }
  });

  // ── Actions ──────────────────────────────────────────────────────────────
  async function saveProfile(e) {
    e.preventDefault();
    if (saving) return;
    saving = true;
    message = { type: '', text: '' };

    try {
      const payload = {
        display_name: displayName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim()
      };
      await usersApi.updateProfile(payload);
      authStore.updateUser(payload);
      message = { type: 'success', text: '¡Perfil actualizado con éxito!' };
    } catch (err) {
      message = { type: 'error', text: err?.message ?? 'Error al actualizar el perfil.' };
    } finally {
      saving = false;
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file || saving) return;

    saving = true;
    message = { type: '', text: '' };
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await usersApi.uploadAvatar(fd);
      if (res.success) {
        avatarPreview = res.avatar_url;
        authStore.updateUser({ avatar_url: res.avatar_url });
        message = { type: 'success', text: '¡Foto de perfil actualizada con éxito!' };
      }
    } catch (err) {
      message = { type: 'error', text: err?.message ?? 'Error al subir foto de perfil.' };
    } finally {
      saving = false;
    }
  }

  async function handleCoverChange(e) {
    const file = e.target.files[0];
    if (!file || saving) return;

    saving = true;
    message = { type: '', text: '' };
    try {
      const fd = new FormData();
      fd.append('cover', file);
      const res = await usersApi.uploadCover(fd);
      if (res.success) {
        coverPreview = res.cover_url;
        authStore.updateUser({ cover_url: res.cover_url });
        message = { type: 'success', text: '¡Portada del perfil actualizada con éxito!' };
      }
    } catch (err) {
      message = { type: 'error', text: err?.message ?? 'Error al subir portada.' };
    } finally {
      saving = false;
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (saving) return;
    saving = true;
    message = { type: '', text: '' };

    try {
      await authApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword
      });
      message = { type: 'success', text: '¡Contraseña actualizada con éxito!' };
      oldPassword = '';
      newPassword = '';
    } catch (err) {
      message = { type: 'error', text: err?.message ?? 'Error al actualizar contraseña.' };
    } finally {
      saving = false;
    }
  }

  async function saveAlgorithmSettings(e) {
    e.preventDefault();
    if (saving) return;
    saving = true;
    message = { type: '', text: '' };

    try {
      const payload = {
        w_interests: Number(wInterests),
        w_interactions: Number(wInteractions),
        w_social: Number(wSocial),
        w_popularity: Number(wPopularity),
        w_recency: Number(wRecency),
        w_diversity: Number(wDiversity),
        feed_mode: feedMode
      };
      await feedApi.preferences.update(payload);
      message = { type: 'success', text: '¡Preferencias del algoritmo guardadas con éxito!' };
    } catch (err) {
      message = { type: 'error', text: err?.message ?? 'Error al guardar las preferencias del feed.' };
    } finally {
      saving = false;
    }
  }

  async function saveGeneralSettings(e) {
    e.preventDefault();
    if (saving) return;
    saving = true;
    message = { type: '', text: '' };

    try {
      const payload = {
        profile_visibility: profileVisibility,
        allow_dms: allowDMs,
        show_online_status: showOnlineStatus,
        notify_likes: notifyLikes,
        notify_comments: notifyComments,
        notify_follows: notifyFollows,
        notify_dms: notifyDMs
      };
      await usersApi.settings.update(payload);
      message = { type: 'success', text: '¡Configuración general guardada con éxito!' };
    } catch (err) {
      message = { type: 'error', text: err?.message ?? 'Error al guardar la configuración.' };
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Ajustes  EVSocial</title>
</svelte:head>

<div class="settings-container">
  <div class="settings-layout">
    
    <!-- Left Sidebar Categories -->
    <div class="settings-sidebar glass-card">
      <h2 class="sidebar-section-title">Ajustes</h2>
      
      <button
        onclick={() => selectSection('profile')}
        class="sidebar-btn"
        class:active={activeSection === 'profile'}
      >
        <span class="material-icons-round">person</span>
        <span>Editar Perfil</span>
      </button>

      <a href="/settings/design" class="sidebar-btn" style="text-decoration: none;">
        <span class="material-icons-round">palette</span>
        <span>Diseño del Perfil</span>
      </a>

      <button
        onclick={() => selectSection('algorithm')}
        class="sidebar-btn"
        class:active={activeSection === 'algorithm'}
      >
        <span class="material-icons-round">auto_awesome</span>
        <span>Feed & Algoritmo</span>
      </button>

      <button
        onclick={() => selectSection('privacy')}
        class="sidebar-btn"
        class:active={activeSection === 'privacy'}
      >
        <span class="material-icons-round">lock</span>
        <span>Privacidad</span>
      </button>

      <button
        onclick={() => selectSection('notifications')}
        class="sidebar-btn"
        class:active={activeSection === 'notifications'}
      >
        <span class="material-icons-round">notifications</span>
        <span>Notificaciones</span>
      </button>
    </div>

    <!-- Right Sidebar Content Box -->
    <div class="settings-content-panel">
      <div class="glass-card panel-card" class:is-saving={saving}>
        
        <!-- Status Alert Messages -->
        {#if message.text}
          <div
            class="alert-box"
            class:success={message.type === 'success'}
            class:error={message.type === 'error'}
            in:fade={{ duration: 250 }}
            out:fade={{ duration: 200 }}
          >
            <span class="material-icons-round">
              {message.type === 'success' ? 'check_circle_outline' : 'error_outline'}
            </span>
            <span>{message.text}</span>
          </div>
        {/if}

        <div class="smooth-transition-wrapper">
          {#key sectionKey + (loading ? '-loading' : '-loaded')}
            <div
              in:fade={{ duration: 250, delay: 100 }}
              out:fade={{ duration: 150 }}
              class="smooth-transition-content"
            >
              {#if loading}
                <div class="panel-loading">
                  <span class="loading loading-spinner text-primary"></span>
                  <span>Cargando ajustes...</span>
                </div>
              {:else if activeSection === 'profile'}
                  <div class="section-content">
              <div>
                <h3 class="section-title">Editar Perfil</h3>
                <p class="section-subtitle">Controla tu identidad pública y fotos en VSocial.</p>
              </div>

              <!-- Media Uploads Section -->
              <div class="media-uploads-row">
                <!-- Avatar Upload -->
                <div class="avatar-upload-box">
                  <div class="profile-avatar-circle">
                    {#if avatarPreview}
                      <img src={avatarPreview} alt="Avatar preview" />
                    {:else}
                      <span>{displayName[0]?.toUpperCase() || '?'}</span>
                    {/if}
                  </div>
                  <input
                    id="avatar-upload"
                    name="avatar-upload"
                    type="file"
                    accept="image/*"
                    bind:this={avatarInput}
                    onchange={handleAvatarChange}
                    style="display: none;"
                  />
                  <button type="button" class="btn-aero-secondary btn-xs" onclick={() => avatarInput.click()}>
                    Cambiar avatar
                  </button>
                </div>

                <!-- Cover Upload -->
                <div class="cover-upload-box">
                  <div class="profile-cover-preview">
                    {#if coverPreview}
                      <img src={coverPreview} alt="Cover preview" />
                    {:else}
                      <div class="no-cover-placeholder">Sin portada de perfil</div>
                    {/if}
                  </div>
                  <input
                    id="cover-upload"
                    name="cover-upload"
                    type="file"
                    accept="image/*"
                    bind:this={coverInput}
                    onchange={handleCoverChange}
                    style="display: none;"
                  />
                  <button type="button" class="btn-aero-secondary btn-xs" onclick={() => coverInput.click()}>
                    Cambiar portada
                  </button>
                </div>
              </div>

              <!-- General Form -->
              <form onsubmit={saveProfile} class="form-container">
                <div class="form-group">
                  <label for="displayName" class="form-label">Nombre de pantalla</label>
                  <input
                    id="displayName"
                    type="text"
                    required
                    bind:value={displayName}
                    class="aero-input"
                  />
                </div>

                <div class="form-group">
                  <label for="bio" class="form-label">Biografía</label>
                  <textarea
                    id="bio"
                    rows="3"
                    bind:value={bio}
                    placeholder="Cuéntale al mundo sobre tu avatar virtual..."
                    class="aero-textarea"
                  ></textarea>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="location" class="form-label">Ubicación</label>
                    <input
                      id="location"
                      type="text"
                      bind:value={location}
                      placeholder="Metaverso, Twitch, Japón..."
                      class="aero-input"
                    />
                  </div>
                  <div class="form-group">
                    <label for="website" class="form-label">Sitio Web</label>
                    <input
                      id="website"
                      type="url"
                      bind:value={website}
                      placeholder="https://tuchanal.com"
                      class="aero-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  class="btn-aero-primary"
                  style="margin-top: 12px; padding: 10px 24px;"
                >
                  <span class="btn-spinner" class:show={saving}>
                    <span class="loading loading-spinner loading-xs"></span>
                  </span>
                  <span>Guardar Perfil</span>
                </button>
              </form>
            </div>

          <!-- SECTION 2: FEED & ALGORITHM (UNIQUE FEATURE) -->
          {:else if activeSection === 'algorithm'}
            <div class="section-content">
              <div>
                <h3 class="section-title">Algoritmo del Feed</h3>
                <p class="section-subtitle">Controla exactamente cómo se prioriza el contenido en tu página de inicio.</p>
              </div>

              <!-- Bar Chart weight distribution visualization -->
              <div class="chart-container">
                <h4 class="chart-title">Distribución de Pesos</h4>
                <div class="chart-bars">
                  {#each [
                    { label: 'Intereses', val: wInterests, color: 'linear-gradient(to top, #00E5FF, #0077FF)' },
                    { label: 'Interacciones', val: wInteractions, color: 'linear-gradient(to top, #7000ff, #f000ff)' },
                    { label: 'Social', val: wSocial, color: 'linear-gradient(to top, #ec4899, #f43f5e)' },
                    { label: 'Popularidad', val: wPopularity, color: 'linear-gradient(to top, #ef4444, #f97316)' },
                    { label: 'Recencia', val: wRecency, color: 'linear-gradient(to top, #10b981, #059669)' },
                    { label: 'Diversidad', val: wDiversity, color: 'linear-gradient(to top, #f59e0b, #d97706)' }
                  ] as bar}
                    {@const pct = (bar.val / totalWeight) * 100}
                    <div class="bar-col">
                      <span class="bar-pct-text">{pct.toFixed(0)}%</span>
                      <div 
                        class="bar-fill" 
                        style="height: {pct}%; background: {bar.color};"
                      ></div>
                    </div>
                  {/each}
                </div>
                <div class="chart-labels-row">
                  <span>Intereses</span>
                  <span>Interac.</span>
                  <span>Social</span>
                  <span>Popular</span>
                  <span>Recencia</span>
                  <span>Diversidad</span>
                </div>
              </div>

              <form onsubmit={saveAlgorithmSettings} class="form-container">
                <!-- Sliders grid -->
                <div class="sliders-grid" style={feedMode !== 'intelligent' ? 'opacity: 0.5; pointer-events: none;' : ''}>
                  <!-- Interests -->
                  <div class="slider-group">
                    <div class="slider-header">
                      <span>Intereses Temáticos</span>
                      <span class="slider-value-text">{wInterests}</span>
                    </div>
                    <p class="slider-desc">Prioriza contenido que coincide con tus categorías de interés.</p>
                    <input type="range" min="0" max="100" bind:value={wInterests} class="aero-range" />
                  </div>

                  <!-- Interactions -->
                  <div class="slider-group">
                    <div class="slider-header">
                      <span>Interacciones Previas</span>
                      <span class="slider-value-text">{wInteractions}</span>
                    </div>
                    <p class="slider-desc">Publicaciones de creadores con los que interactúas o chateas.</p>
                    <input type="range" min="0" max="100" bind:value={wInteractions} class="aero-range" />
                  </div>

                  <!-- Social Connections -->
                  <div class="slider-group">
                    <div class="slider-header">
                      <span>Círculo Social</span>
                      <span class="slider-value-text">{wSocial}</span>
                    </div>
                    <p class="slider-desc">Prioriza publicaciones de personas que sigues directamente.</p>
                    <input type="range" min="0" max="100" bind:value={wSocial} class="aero-range" />
                  </div>

                  <!-- Popularity -->
                  <div class="slider-group">
                    <div class="slider-header">
                      <span>Popularidad del Post</span>
                      <span class="slider-value-text">{wPopularity}</span>
                    </div>
                    <p class="slider-desc">Favorece publicaciones virales con mucha actividad en la red.</p>
                    <input type="range" min="0" max="100" bind:value={wPopularity} class="aero-range" />
                  </div>

                  <!-- Recency -->
                  <div class="slider-group">
                    <div class="slider-header">
                      <span>Recencia / Tiempo</span>
                      <span class="slider-value-text">{wRecency}</span>
                    </div>
                    <p class="slider-desc">Favorece publicaciones de las últimas horas.</p>
                    <input type="range" min="0" max="100" bind:value={wRecency} class="aero-range" />
                  </div>

                  <!-- Diversity -->
                  <div class="slider-group">
                    <div class="slider-header">
                      <span>Diversidad de Creadores</span>
                      <span class="slider-value-text">{wDiversity}</span>
                    </div>
                    <p class="slider-desc">Evita mostrar demasiadas publicaciones seguidas del mismo usuario.</p>
                    <input type="range" min="0" max="100" bind:value={wDiversity} class="aero-range" />
                  </div>
                </div>

                <div class="algo-footer">
                  <div class="algo-mode-wrapper">
                    <span class="form-label" style="margin-bottom: 0;">Modo del Feed:</span>
                    <div class="custom-select-wrapper" style="position: relative; width: 280px;">
                      <button 
                        type="button" 
                        class="aero-select" 
                        style="width: 100%; text-align: left; display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding-right: 12px; margin: 0;"
                        onclick={(e) => { e.preventDefault(); feedModeOpen = !feedModeOpen; }}
                      >
                        {feedModeLabels[feedMode] || 'Seleccionar...'}
                        <span class="material-icons-round" style="font-size: 1.2rem;">expand_more</span>
                      </button>
                      
                      {#if feedModeOpen}
                        <div class="custom-select-menu animate-slide-in-up">
                          <button type="button" class="custom-select-item {feedMode === 'retention' ? 'active' : ''}" onclick={() => { feedMode = 'retention'; feedModeOpen = false; }}>Descubrimiento (Para Ti)</button>
                          <button type="button" class="custom-select-item {feedMode === 'intelligent' ? 'active' : ''}" onclick={() => { feedMode = 'intelligent'; feedModeOpen = false; }}>Feed Inteligente (Personalizado)</button>
                          <button type="button" class="custom-select-item {feedMode === 'radar' ? 'active' : ''}" onclick={() => { feedMode = 'radar'; feedModeOpen = false; }}>Radar en Vivo (Línea de Tiempo)</button>
                        </div>
                      {/if}
                    </div>
                  </div>
                  <button
                    type="submit"
                    class="btn-aero-primary"
                    style="padding: 10px 24px;"
                  >
                    <span class="btn-spinner" class:show={saving}>
                      <span class="loading loading-spinner loading-xs"></span>
                    </span>
                    <span>Guardar Preferencias</span>
                  </button>
                </div>
              </form>
            </div>

          <!-- SECTION 3: PRIVACY -->
          {:else if activeSection === 'privacy'}
            <div class="section-content">
              <div>
                <h3 class="section-title">Privacidad</h3>
                <p class="section-subtitle">Controla tu visibilidad y cambia tu contraseña.</p>
              </div>

              <form onsubmit={saveGeneralSettings} class="form-container">
                <!-- Visibilidad de Perfil -->
                <div class="radio-settings-group">
                  <span class="form-label">Quién puede ver tu perfil</span>
                  <div class="radio-options">
                    <label class="radio-option">
                      <input type="radio" name="visibility" value="public" bind:group={profileVisibility} />
                      <span>Público (Cualquier usuario o visitante)</span>
                    </label>
                    <label class="radio-option">
                      <input type="radio" name="visibility" value="followers" bind:group={profileVisibility} />
                      <span>Solo Seguidores</span>
                    </label>
                    <label class="radio-option">
                      <input type="radio" name="visibility" value="friends" bind:group={profileVisibility} />
                      <span>Solo Amigos (Mutuo follow)</span>
                    </label>
                  </div>
                </div>

                <!-- DM Settings -->
                <div class="radio-settings-group border-top">
                  <span class="form-label">Mensajería Directa</span>
                  <div class="radio-options">
                    <label class="radio-option">
                      <input type="radio" name="dms" value="everyone" bind:group={allowDMs} />
                      <span>Todos pueden enviarme DMs</span>
                    </label>
                    <label class="radio-option">
                      <input type="radio" name="dms" value="followers" bind:group={allowDMs} />
                      <span>Solo creadores que sigo</span>
                    </label>
                    <label class="radio-option">
                      <input type="radio" name="dms" value="none" bind:group={allowDMs} />
                      <span>Nadie (Desactivar DMs entrantes)</span>
                    </label>
                  </div>
                </div>

                <!-- Online Status toggle -->
                <div class="toggle-settings-group border-top">
                  <div class="toggle-details">
                    <span class="toggle-title">Mostrar estado de conexión</span>
                    <span class="toggle-desc">Permite que tus amigos vean cuándo estás en línea.</span>
                  </div>
                  <input type="checkbox" bind:checked={showOnlineStatus} class="aero-toggle-switch" />
                </div>

                <button
                  type="submit"
                  class="btn-aero-primary"
                  style="padding: 10px 24px; align-self: flex-start;"
                >
                  <span class="btn-spinner" class:show={saving}>
                    <span class="loading loading-spinner loading-xs"></span>
                  </span>
                  <span>Guardar Privacidad</span>
                </button>
              </form>

              <!-- Change Password Form -->
              <div class="change-password-section border-top">
                <h3 class="section-title" style="font-size: 0.95rem; margin-top: 16px;">Cambiar Contraseña</h3>
                <p class="section-subtitle" style="margin-bottom: 16px;">Actualiza tus credenciales de seguridad.</p>
                
                <form onsubmit={handleChangePassword} class="form-container" style="max-width: 340px;">
                  <div class="form-group">
                    <label for="oldPassword" class="form-label" style="font-size: 0.65rem;">Contraseña Actual</label>
                    <input
                      id="oldPassword"
                      type="password"
                      required
                      bind:value={oldPassword}
                      class="aero-input"
                    />
                  </div>
                  <div class="form-group">
                    <label for="newPassword" class="form-label" style="font-size: 0.65rem;">Nueva Contraseña</label>
                    <input
                      id="newPassword"
                      type="password"
                      required
                      bind:value={newPassword}
                      class="aero-input"
                    />
                  </div>
                  <button type="submit" disabled={saving || !oldPassword || !newPassword} class="btn-aero-secondary btn-sm" style="padding: 8px 16px; align-self: flex-start;">
                    Actualizar Contraseña
                  </button>
                </form>
              </div>
            </div>

          <!-- SECTION 4: NOTIFICATIONS -->
          {:else if activeSection === 'notifications'}
            <div class="section-content">
              <div>
                <h3 class="section-title">Notificaciones</h3>
                <p class="section-subtitle">Controla cuándo y cómo deseas ser notificado.</p>
              </div>

              <form onsubmit={saveGeneralSettings} class="form-container">
                <div class="toggle-settings-group border-bottom">
                  <div class="toggle-details">
                    <span class="toggle-title">Me gusta (Likes)</span>
                    <span class="toggle-desc">Cuando alguien reacciona a tus publicaciones.</span>
                  </div>
                  <input type="checkbox" bind:checked={notifyLikes} class="aero-toggle-switch" />
                </div>

                <div class="toggle-settings-group border-bottom">
                  <div class="toggle-details">
                    <span class="toggle-title">Comentarios</span>
                    <span class="toggle-desc">Cuando alguien comenta tus posts o reels.</span>
                  </div>
                  <input type="checkbox" bind:checked={notifyComments} class="aero-toggle-switch" />
                </div>

                <div class="toggle-settings-group border-bottom">
                  <div class="toggle-details">
                    <span class="toggle-title">Nuevos Seguidores</span>
                    <span class="toggle-desc">Cuando un usuario empieza a seguir tu cuenta.</span>
                  </div>
                  <input type="checkbox" bind:checked={notifyFollows} class="aero-toggle-switch" />
                </div>

                <div class="toggle-settings-group">
                  <div class="toggle-details">
                    <span class="toggle-title">Mensajes Directos (DMs)</span>
                    <span class="toggle-desc">Cuando recibes un nuevo mensaje en el chat.</span>
                  </div>
                  <input type="checkbox" bind:checked={notifyDMs} class="aero-toggle-switch" />
                </div>

                <button
                  type="submit"
                  class="btn-aero-primary"
                  style="padding: 10px 24px; align-self: flex-start; margin-top: 12px;"
                >
                  <span class="btn-spinner" class:show={saving}>
                    <span class="loading loading-spinner loading-xs"></span>
                  </span>
                  <span>Guardar Notificaciones</span>
                </button>
              </form>
            </div>
              {/if}
            </div>
          {/key}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 24px 16px;
  }

  .settings-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 24px;
    align-items: start;
  }

  @media (max-width: 768px) {
    .settings-layout {
      grid-template-columns: 1fr;
    }
  }

  .settings-sidebar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 24px 16px;
  }

  .sidebar-section-title {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0 0 12px 12px;
  }

  .sidebar-btn {
    width: 100%;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
    text-align: left;
    background: none;
    border: 1px solid transparent;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: transform 0.15s ease, background 0.25s var(--ease-smooth), color 0.25s var(--ease-smooth), border-color 0.25s var(--ease-smooth), box-shadow 0.25s var(--ease-smooth);
  }

  .sidebar-btn:active {
    transform: scale(0.97);
  }

  .sidebar-btn::before {
    content: '';
    position: absolute;
    left: 0;
    top: 20%;
    bottom: 20%;
    width: 3px;
    border-radius: 2px;
    background: var(--aero-blue);
    opacity: 0;
    transform: scaleY(0.3);
    transition: opacity 0.25s var(--ease-spring), transform 0.25s var(--ease-spring);
  }

  .sidebar-btn:hover {
    background: var(--bg-overlay);
    color: var(--text-primary);
  }

  .sidebar-btn.active {
    background: rgba(27, 133, 243, 0.08);
    border-color: rgba(27, 133, 243, 0.18);
    color: var(--aero-blue);
    box-shadow: 0 0 12px rgba(27, 133, 243, 0.08);
  }

  .sidebar-btn.active::before {
    opacity: 1;
    transform: scaleY(1);
  }

  .settings-content-panel {
    min-width: 0;
  }

  .panel-card {
    padding: 32px;
    border-radius: 24px;
    min-height: 750px;
  }

  /* ── Silky smooth crossfader ── */
  .smooth-transition-wrapper {
    display: grid;
    grid-template-columns: 1fr;
    width: 100%;
  }
  .smooth-transition-content {
    grid-column: 1;
    grid-row: 1;
    width: 100%;
  }

  /* ── Smooth spinner for settings buttons ── */
  .btn-spinner {
    display: inline-flex;
    align-items: center;
    width: 0;
    opacity: 0;
    margin-right: 0;
    overflow: hidden;
    transition: width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
                opacity 0.3s ease, 
                margin-right 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .btn-spinner.show {
    width: 16px;
    opacity: 1;
    margin-right: 6px;
  }
  form .btn-aero-primary {
    gap: 0; /* Remove parent flex gap so we can control spacing perfectly with margin */
  }

  @media (max-width: 768px) {
    .panel-card {
      padding: 20px;
    }
  }

  .alert-box {
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
  }

  .alert-box.success {
    background: rgba(61, 199, 154, 0.08);
    border: 1px solid rgba(61, 199, 154, 0.25);
    color: var(--aero-mint);
  }

  .alert-box.error {
    background: rgba(232, 74, 114, 0.08);
    border: 1px solid rgba(232, 74, 114, 0.25);
    color: var(--aero-rose);
  }

  /* Saving state: dim entire panel card while async request is in flight */
  .panel-card.is-saving {
    pointer-events: none;
    opacity: 0.7;
    transition: opacity 0.25s ease;
  }
  .panel-card {
    transition: opacity 0.25s ease;
  }

  .panel-loading {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 48px;
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .section-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--text-main);
    margin: 0;
  }

  .section-subtitle {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 4px 0 0 0;
  }

  .media-uploads-row {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 20px;
    background: rgba(0, 229, 255, 0.04);
    border-radius: 16px;
    border: 1px solid rgba(0, 119, 255, 0.08);
  }

  .avatar-upload-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .profile-avatar-circle {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00E5FF 0%, #0077FF 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #000;
    font-weight: 700;
    font-size: 1.8rem;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0, 229, 255, 0.2);
  }

  .profile-avatar-circle img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-upload-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 240px;
  }

  .profile-cover-preview {
    width: 100%;
    height: 80px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(0, 119, 255, 0.1);
    background: rgba(0, 119, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .profile-cover-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .no-cover-placeholder {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .form-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 576px) {
    .form-row {
      grid-template-columns: 1fr;
    }
    
    .media-uploads-row {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    
    .cover-upload-box {
      width: 100%;
    }
  }

  /* Algorithm section styling */
  .chart-container {
    background: rgba(0, 229, 255, 0.04);
    border: 1px solid rgba(0, 119, 255, 0.08);
    padding: 16px;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .chart-title {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    margin: 0;
  }

  .chart-bars {
    height: 100px;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    justify-content: space-around;
    padding-top: 16px;
    border-bottom: 1px solid rgba(0, 119, 255, 0.1);
  }

  .bar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    height: 100%;
    justify-content: flex-end;
    min-width: 0;
  }

  .bar-pct-text {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 4px;
  }

  .bar-fill {
    width: 100%;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    transition: height 0.3s ease;
  }

  .chart-labels-row {
    display: flex;
    justify-content: space-around;
    text-align: center;
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--text-muted);
  }

  .chart-labels-row span {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sliders-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  @media (max-width: 768px) {
    .sliders-grid {
      grid-template-columns: 1fr;
    }
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .slider-value-text {
    color: var(--aero-sky);
  }

  .slider-desc {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.3;
  }

  .aero-range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: var(--border-subtle);
    outline: none;
    margin-top: 6px;
  }

  .aero-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--aero-sky);
    cursor: pointer;
    box-shadow: 0 0 8px rgba(74, 171, 223, 0.4);
    transition: transform var(--t-fast);
  }

  .aero-range::-webkit-slider-thumb:hover {
    transform: scale(1.25);
  }

  .algo-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(0, 119, 255, 0.1);
    padding-top: 16px;
    margin-top: 12px;
    gap: 16px;
    flex-wrap: wrap;
  }

  .algo-mode-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* Privacy & Radio/Toggle Styles */
  .radio-settings-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .radio-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-option {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--text-main);
  }

  .radio-option input[type="radio"] {
    appearance: none;
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--border-subtle);
    outline: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--t-fast);
  }

  .radio-option input[type="radio"]:checked {
    border-color: var(--aero-sky);
    background: var(--aero-sky);
    box-shadow: 0 0 8px rgba(74, 171, 223, 0.4);
  }

  .toggle-settings-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 0;
  }

  .toggle-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toggle-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .toggle-desc {
    font-size: 0.7rem;
    color: var(--text-muted);
    line-height: 1.3;
  }



  .border-top {
    border-top: 1px solid var(--border-subtle);
    padding-top: 20px;
  }

  .border-bottom {
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 12px;
  }

  .custom-select-menu {
    position: absolute; 
    bottom: calc(100% + 8px); 
    left: 0; 
    width: 100%; 
    z-index: 100; 
    background: var(--glass-bg); 
    backdrop-filter: blur(20px); 
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border); 
    border-radius: var(--radius-md); 
    overflow: hidden; 
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    display: flex;
    flex-direction: column;
  }
  
  .custom-select-item {
    background: transparent;
    border: none;
    color: var(--text-primary);
    padding: 12px 16px;
    text-align: left;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .custom-select-item:hover {
    background: rgba(46,134,232,0.15);
    color: var(--aero-sky);
  }

  .custom-select-item.active {
    background: rgba(46,134,232,0.25);
    color: var(--aero-sky);
    font-weight: 500;
  }
</style>
