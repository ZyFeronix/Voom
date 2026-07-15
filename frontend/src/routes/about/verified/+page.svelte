<script>
  import { fade, slide } from 'svelte/transition';
  import { onMount } from 'svelte';
  
  let isMounted = $state(false);
  let showModal = $state(false);
  // Specular light coordinates for cards
  function handleCardMouseMove(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  }

  let rolesGrid;
  let isDragging = false;
  let isScrolling = $state(false);
  let startX;
  let scrollLeft;
  let velocity = 0;
  let lastX = 0;
  let animationFrameId;
  let overscroll = 0;
  let exactScroll = 0;

  let dragThresholdPassed = false;

  function startDrag(e) {
    if (!rolesGrid) return;
    isDragging = true;
    dragThresholdPassed = false;
    startX = e.pageX - rolesGrid.offsetLeft;
    
    exactScroll = rolesGrid.scrollLeft;
    scrollLeft = exactScroll - (overscroll * 4);
    lastX = e.pageX;
    velocity = 0;
    cancelAnimationFrame(animationFrameId);
  }
  function stopDrag() {
    if (isDragging) {
      isDragging = false;
      dragThresholdPassed = false;
      startInertia();
    }
  }
  function handleDrag(e) {
    if (!isDragging || !rolesGrid) return;
    
    // Only trigger scrolling styling if moved more than 3px
    if (!dragThresholdPassed) {
      if (Math.abs(e.pageX - lastX) > 3) {
        dragThresholdPassed = true;
        isScrolling = true;
      } else {
        return;
      }
    }
    
    e.preventDefault();
    const x = e.pageX - rolesGrid.offsetLeft;
    const walk = (x - startX) * 0.85;
    const targetScroll = scrollLeft - walk;
    const maxScroll = rolesGrid.scrollWidth - rolesGrid.clientWidth;

    if (targetScroll < 0) {
      exactScroll = 0;
      rolesGrid.scrollLeft = 0;
      overscroll = -targetScroll * 0.25;
    } else if (targetScroll > maxScroll) {
      exactScroll = maxScroll;
      rolesGrid.scrollLeft = maxScroll;
      overscroll = (maxScroll - targetScroll) * 0.25;
    } else {
      exactScroll = targetScroll;
      rolesGrid.scrollLeft = targetScroll;
      overscroll = 0;
    }
    rolesGrid.style.transform = `translateX(${overscroll}px)`;
    
    velocity = (e.pageX - lastX) * 0.85;
    lastX = e.pageX;
  }

  function startInertia() {
    if (!rolesGrid) return;
    const friction = 0.95; 
    let overscrollVelocity = 0;
    
    function loop() {
      const maxScroll = rolesGrid.scrollWidth - rolesGrid.clientWidth;

      if (overscroll !== 0 || overscrollVelocity !== 0) {
        if (velocity !== 0) {
          overscrollVelocity += velocity * 0.5;
          velocity = 0;
        }
        
        overscrollVelocity -= overscroll * 0.04;
        overscrollVelocity *= 0.88;
        overscroll += overscrollVelocity;
        
        if (Math.abs(overscroll) < 0.5 && Math.abs(overscrollVelocity) < 0.5) {
          overscroll = 0;
          overscrollVelocity = 0;
        }
        
        rolesGrid.style.transform = overscroll !== 0 ? `translateX(${overscroll}px)` : '';
        
        if (overscroll !== 0) {
          animationFrameId = requestAnimationFrame(loop);
        } else {
          isScrolling = false;
        }
        return;
      }

      if (Math.abs(velocity) > 0.5) {
        exactScroll -= (velocity * 2);
        let nextOverscroll = 0;
        
        if (exactScroll < 0) {
          nextOverscroll = -exactScroll * 0.25;
          exactScroll = 0;
        } else if (exactScroll > maxScroll) {
          nextOverscroll = (exactScroll - maxScroll) * 0.25;
          exactScroll = maxScroll;
        }
        
        rolesGrid.scrollLeft = Math.round(exactScroll);
        
        if (nextOverscroll !== 0) {
          overscroll = nextOverscroll;
          rolesGrid.style.transform = `translateX(${overscroll}px)`;
        }
        
        velocity *= friction;
        animationFrameId = requestAnimationFrame(loop);
        return;
      }
      
      isScrolling = false;
    }
    loop();
  }

  onMount(() => {
    isMounted = true;
  });

  const roles = [
    {
      id: 'admin',
      title: 'Administrador del Sistema',
      icon: 'admin_panel_settings',
      color: 'var(--badge-admin)',
      desc: 'La cúpula de V-SOCIAL. Estas cuentas tienen acceso total y manejan la arquitectura de la red social.',
      perks: ['Acceso a Panel de Control Global', 'Moderación Absoluta', 'Configuración de Servidor']
    },
    {
      id: 'moderator',
      title: 'Moderador Oficial',
      icon: 'shield',
      color: 'var(--badge-moderator)',
      desc: 'Los guardianes de la comunidad. Encargados de asegurar que el contenido cumpla con nuestras directrices y mantener la paz.',
      perks: ['Gestión de Reportes', 'Suspensión de Cuentas', 'Borrado de Contenido Tóxico']
    },
    {
      id: 'support',
      title: 'Soporte V-SOCIAL',
      icon: 'support_agent',
      color: 'var(--badge-support)',
      desc: 'El equipo humano de atención al usuario. Encargados de procesar verificaciones, apelaciones y brindar asistencia directa.',
      perks: ['Gestión de Tickets', 'Aprobación de Verificaciones', 'Contacto Directo con Usuarios']
    },
    {
      id: 'team',
      title: 'Equipo V-SOCIAL',
      icon: 'military_tech',
      color: 'var(--badge-team)',
      desc: 'Cuentas que pertenecen al equipo oficial de ingenieros, diseñadores y directivos de V-SOCIAL.',
      perks: ['Acceso Beta a Funciones Nuevas', 'Distintivo de Honor Platinum', 'Insignia de Desarrollo']
    },
    {
      id: 'verified',
      title: 'Usuario Verificado',
      icon: 'verified',
      color: 'var(--badge-verified)',
      desc: 'Cuentas de figuras públicas, creadores destacados, celebridades o marcas reconocidas que han verificado su identidad.',
      perks: ['Insignia Aero Blue', 'Garantía de Identidad en Búsquedas', 'Protección contra Suplantación']
    }
  ];
</script>

<svelte:head>
  <title>Insignias y Verificación - V-SOCIAL</title>
</svelte:head>

<div class="verified-container" in:fade={{ duration: 600 }}>
  
  <div class="page-header">
    <a href="/about" class="back-link">
      <span class="material-icons-round">arrow_back</span> Volver a About
    </a>
    <h1 class="header-title">Jerarquía de Verificación</h1>
    <p class="header-subtitle">En V-SOCIAL, la autoridad se gana y se distingue con claridad. Conoce nuestras insignias.</p>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="roles-scroll-wrapper hide-scrollbar {isScrolling ? 'dragging' : ''}"
    bind:this={rolesGrid}
    onmousedown={startDrag}
    onmouseleave={stopDrag}
    onmouseup={stopDrag}
    onmousemove={handleDrag}
  >
    <div class="roles-grid">
      {#if isMounted}
        {#each roles as role, i}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="glass-card role-card aero-card" 
            in:slide={{ duration: 500, delay: i * 150 }} 
            style="--role-color: {role.color}"
            ondragstart={(e) => e.preventDefault()}
            onmousemove={handleCardMouseMove}
          >
            <div class="role-header">
              <div class="role-icon-box">
                <span class="material-icons-round">{role.icon}</span>
              </div>
              <h2 class="role-title">{role.title}</h2>
            </div>
            
            <p class="role-desc">{role.desc}</p>
            
            <div class="role-perks">
              <h3 class="perks-title">Privilegios</h3>
              <ul class="perks-list">
                {#each role.perks as perk}
                  <li>
                    <span class="material-icons-round text-sm" style="color: {role.color}">check_circle</span>
                    {perk}
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <div class="apply-section">
    <div class="apply-content">
      <span class="material-icons-round text-6xl mb-4" style="color: var(--aero-blue);">gpp_good</span>
      <h2>¿Eres una figura pública o creador?</h2>
      <p>Protege tu identidad y destaca en el feed obteniendo tu insignia de Verificado Oficial.</p>
      <button class="btn-aero-primary mt-6 text-lg px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 mx-auto" onclick={() => showModal = true} style="box-shadow: var(--neon-primary); border-radius: 14px;">
        <span class="material-icons-round text-lg">check_circle</span>
        Solicitar Verificación
      </button>
    </div>
  </div>
</div>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={() => showModal = false} transition:fade={{ duration: 200 }}>
    <div class="apply-modal" onclick={(e) => e.stopPropagation()} transition:slide={{ duration: 300 }}>
      <button class="close-btn" onclick={() => showModal = false}>
        <span class="material-icons-round">close</span>
      </button>
      
      <div class="modal-header">
        <span class="material-icons-round text-5xl mb-2" style="color: var(--aero-blue);">verified</span>
        <h2 class="text-2xl font-bold" style="color: var(--text-primary); font-family: var(--font-display);">Solicitud de Verificación</h2>
      </div>
      
      <div class="modal-body text-center mt-4">
        <p class="text-muted" style="line-height: 1.6; color: var(--text-muted);">
          Actualmente, las solicitudes de verificación se procesan internamente.<br>
          Si consideras que cumples con los requisitos de notoriedad, contacta a nuestro equipo de soporte.
        </p>
        
        <div class="glass-panel mt-6 p-4 rounded-xl text-left" style="border: 1px solid var(--border-glass);">
          <h3 class="font-bold text-sm mb-2" style="color: var(--text-primary);">Requisitos Mínimos:</h3>
          <ul class="requisitos-list text-sm text-muted">
            <li>Cuenta activa y auténtica.</li>
            <li>Perfil completo (Avatar, Bio, Portada).</li>
            <li>Presencia y relevancia pública demostrable.</li>
          </ul>
        </div>
      </div>
      
      <div class="modal-footer mt-6 flex justify-end">
        <button class="btn-aero-primary w-full text-lg py-3 rounded-xl font-bold" style="box-shadow: var(--neon-primary); border-radius: 14px;" onclick={() => showModal = false}>Entendido</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .verified-container {
    padding: 2rem 1rem 6rem;
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
    min-height: 100vh;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
    text-decoration: none;
    font-weight: 600;
    margin-bottom: 2rem;
    transition: color 0.2s;
  }
  .back-link:hover { color: var(--aero-blue); }

  .page-header {
    margin-bottom: 4rem;
    text-align: center;
  }

  .header-title {
    font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 900;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, var(--text-primary), var(--text-muted));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .header-subtitle {
    font-size: 1.2rem;
    color: var(--text-secondary);
    max-width: 600px;
    margin: 0 auto;
  }

  /* Scroll Wrapper para el Carrusel */
  .roles-scroll-wrapper {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    cursor: grab;
    padding: 2rem 0;
    margin-bottom: 4rem;
    scrollbar-width: none; /* Firefox */
    
    /* Límites nublados alineados al contenedor */
    -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
    mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
  }
  .roles-scroll-wrapper.dragging .role-card {
    pointer-events: none;
  }
  .roles-scroll-wrapper::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }
  .roles-scroll-wrapper:active {
    cursor: grabbing;
  }

  .roles-grid {
    display: flex;
    gap: 2rem;
    width: max-content;
    padding-top: 3rem;
    padding-bottom: 4rem;
    padding-left: 4rem;
    padding-right: 4rem;
  }

  .role-card {
    width: 340px;
    flex-shrink: 0;
    padding: 2.5rem 2rem;
    position: relative;
    overflow: hidden;
    transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.6s ease, border-color 0.6s ease;
    background: linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-top: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 24px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.2);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex;
    flex-direction: column;
  }
  :global([data-theme="dark"]) .role-card {
    background: linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%);
    border-color: rgba(255,255,255,0.08);
    border-top-color: rgba(255,255,255,0.15);
    box-shadow: 0 15px 35px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1);
  }

  .role-card::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.6s ease;
    background: radial-gradient(
      600px circle at var(--mouse-x, 0) var(--mouse-y, 0), 
      rgba(255, 255, 255, 0.3),
      transparent 40%
    );
  }
  :global([data-theme="dark"]) .role-card::after {
    background: radial-gradient(
      600px circle at var(--mouse-x, 0) var(--mouse-y, 0), 
      rgba(255, 255, 255, 0.08),
      transparent 40%
    );
  }

  .role-card:hover::after {
    opacity: 1;
  }

  .role-card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 45px rgba(0,0,0,0.15), 0 0 25px var(--role-color, transparent);
    border-color: var(--role-color);
  }
  :global([data-theme="dark"]) .role-card:hover {
    box-shadow: 0 20px 45px rgba(0,0,0,0.5), 0 0 25px var(--role-color, transparent);
  }

  .role-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .role-icon-box {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--role-color);
    color: var(--role-color);
    box-shadow: inset 0 0 15px var(--role-color);
  }

  .role-icon-box span {
    font-size: 28px;
  }

  .role-title {
    font-size: 1.3rem;
    font-weight: 800;
    margin: 0;
    color: var(--text-primary);
  }

  .role-desc {
    font-size: 1rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 2rem;
  }

  .role-perks {
    background: rgba(0, 0, 0, 0.04);
    border-radius: 12px;
    padding: 1.2rem;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }
  :global([data-theme="dark"]) .role-perks {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .perks-title {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  .perks-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .perks-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  /* Apply Section */
  .apply-section {
    padding: 4rem 2rem;
    text-align: center;
    border-radius: 24px;
    background: linear-gradient(135deg, rgba(27, 133, 243, 0.05) 0%, rgba(255, 255, 255, 0.5) 100%);
    border: 1px solid rgba(27, 133, 243, 0.25);
    box-shadow: 0 20px 50px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5), 0 0 40px rgba(27, 133, 243, 0.1);
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  :global([data-theme="dark"]) .apply-section {
    background: linear-gradient(135deg, rgba(27, 133, 243, 0.08) 0%, rgba(10, 14, 20, 0.7) 100%);
    box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 40px rgba(27, 133, 243, 0.05);
  }
  .apply-section::before {
    content: '';
    position: absolute;
    top: 0; left: 20%; right: 20%; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(27, 133, 243, 0.5), transparent);
  }

  .apply-content h2 {
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }

  .apply-content p {
    font-size: 1.1rem;
    color: var(--text-secondary);
    max-width: 500px;
    margin: 0 auto;
  }



  /* Modal */
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .apply-modal {
    width: 100%;
    max-width: 450px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 240, 245, 0.95) 100%);
    padding: 2.5rem;
    border-radius: 24px;
    position: relative;
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 25px 60px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 40px rgba(27, 133, 243, 0.1);
    overflow: hidden;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  :global([data-theme="dark"]) .apply-modal {
    background: linear-gradient(135deg, rgba(15, 20, 25, 0.9) 0%, rgba(10, 14, 20, 0.98) 100%);
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 25px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 40px rgba(27, 133, 243, 0.05);
  }

  .apply-modal::before {
    content: '';
    position: absolute;
    top: 0; left: 15%; right: 15%; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(27, 133, 243, 0.5), transparent);
  }

  .modal-header {
    text-align: center;
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .requisitos-list {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin-top: 0.5rem;
  }
  .requisitos-list li {
    margin-bottom: 0.3rem;
  }

  .close-btn {
    position: absolute;
    top: 1rem; right: 1rem;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.2s;
  }
  .close-btn:hover { color: var(--aero-rose); }
</style>
