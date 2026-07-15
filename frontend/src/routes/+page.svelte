<script>
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { themeStore, toggleTheme } from '$lib/stores/theme.svelte.js';

  // --- Runes State ---
  let activeTheme = $state('prism');
  let heroVisible = $state(false);
  let marqueeRunning = $state(true);

  // Database metrics simulation
  let queryCount = $state(742981);
  let averageResponseTime = $derived((0.02 + Math.sin(queryCount / 100) * 0.005).toFixed(4));
  let currentWritingOps = $state(18402);
  let walFrames = $state(1247);
  let uptimeDays = $state(312);

  // Mockup dashboard state
  let mockupLikes = $state(1204);
  let mockupLiked = $state(false);
  let activeMockupTab = $state('feed');

  // Sandbox posts state
  let sandboxPosts = $state([
    { author: '@Aria_Hologram', text: 'El sistema de gamificación de V-Social es el mejor que he visto. Los badges y el leaderboard hacen que crear contenido sea adictivo. 🏆✨', likes: 24, time: 'Hace 3 min' },
    { author: '@PixelWizard', text: 'Por fin una red social que no cobra comisiones del 30% a los artistas ni nos oculta detrás de un algoritmo de pago. Esto es libertad digital. 💎🎨', likes: 12, time: 'Hace 8 min' }
  ]);
  let newPostText = $state('');

  // FAQ state
  let faqOpenStates = $state([false, false, false, false, false]);

  function toggleFaq(index) {
    const currentState = faqOpenStates[index];
    for (let i = 0; i < faqOpenStates.length; i++) {
      faqOpenStates[i] = false;
    }
    faqOpenStates[index] = !currentState;
  }

  function handleMockupLike() {
    if (mockupLiked) {
      mockupLikes--;
      mockupLiked = false;
    } else {
      mockupLikes++;
      mockupLiked = true;
      queryCount++;
    }
  }

  function handleAddPost() {
    if (!newPostText.trim()) return;
    sandboxPosts = [
      { author: '@Visitante_Anon', text: newPostText, likes: 0, time: 'Ahora mismo' },
      ...sandboxPosts
    ];
    newPostText = '';
    queryCount++;
  }

  // Specular light coordinates for cards
  function handleCardMouseMove(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  }

  // --- Drag to Scroll for Features Grid ---
  let featuresGrid;
  let isDragging = false;
  let isScrolling = $state(false);
  let startX;
  let scrollLeft;
  let velocity = 0;
  let lastX = 0;
  let animationFrameId;
  let overscroll = 0;
  let exactScroll = 0;

  function handleGridMouseDown(e) {
    if (!featuresGrid) return;
    isDragging = true;
    isScrolling = true;
    startX = e.pageX - featuresGrid.offsetLeft;
    exactScroll = featuresGrid.scrollLeft;
    scrollLeft = exactScroll - (overscroll * 4);
    lastX = e.pageX;
    velocity = 0;
    cancelAnimationFrame(animationFrameId);
  }
  function handleGridMouseLeave() {
    if (isDragging) { isDragging = false; startInertia(); }
  }
  function handleGridMouseUp() {
    if (isDragging) { isDragging = false; startInertia(); }
  }
  function handleGridMouseMove(e) {
    if (!isDragging || !featuresGrid) return;
    e.preventDefault();
    const x = e.pageX - featuresGrid.offsetLeft;
    const walk = (x - startX) * 0.85;
    const targetScroll = scrollLeft - walk;
    const maxScroll = featuresGrid.scrollWidth - featuresGrid.clientWidth;

    if (targetScroll < 0) {
      exactScroll = 0;
      featuresGrid.scrollLeft = 0;
      overscroll = -targetScroll * 0.25;
    } else if (targetScroll > maxScroll) {
      exactScroll = maxScroll;
      featuresGrid.scrollLeft = maxScroll;
      overscroll = (maxScroll - targetScroll) * 0.25;
    } else {
      exactScroll = targetScroll;
      featuresGrid.scrollLeft = targetScroll;
      overscroll = 0;
    }
    featuresGrid.style.transform = `translateX(${overscroll}px)`;
    velocity = (e.pageX - lastX) * 0.85;
    lastX = e.pageX;
  }

  function startInertia() {
    if (!featuresGrid) return;
    const friction = 0.95;
    let overscrollVelocity = 0;

    function loop() {
      const maxScroll = featuresGrid.scrollWidth - featuresGrid.clientWidth;
      if (overscroll !== 0 || overscrollVelocity !== 0) {
        if (velocity !== 0) { overscrollVelocity += velocity * 0.5; velocity = 0; }
        overscrollVelocity -= overscroll * 0.04;
        overscrollVelocity *= 0.88;
        overscroll += overscrollVelocity;
        if (Math.abs(overscroll) < 0.5 && Math.abs(overscrollVelocity) < 0.5) { overscroll = 0; overscrollVelocity = 0; }
        featuresGrid.style.transform = overscroll !== 0 ? `translateX(${overscroll}px)` : '';
        if (overscroll !== 0) { animationFrameId = requestAnimationFrame(loop); } else { isScrolling = false; }
        return;
      }
      if (Math.abs(velocity) > 0.5) {
        exactScroll -= (velocity * 2);
        let nextOverscroll = 0;
        if (exactScroll < 0) { nextOverscroll = -exactScroll * 0.25; exactScroll = 0; }
        else if (exactScroll > maxScroll) { nextOverscroll = (exactScroll - maxScroll) * 0.25; exactScroll = maxScroll; }
        featuresGrid.scrollLeft = Math.round(exactScroll);
        if (nextOverscroll !== 0) { overscroll = nextOverscroll; featuresGrid.style.transform = `translateX(${overscroll}px)`; }
        velocity *= friction;
        animationFrameId = requestAnimationFrame(loop);
        return;
      }
      isScrolling = false;
    }
    loop();
  }

  // --- Intersection Observer for section reveal ---
  let observerSections = $state({});
  let sectionRefs = {};

  function registerSection(name, node) {
    sectionRefs[name] = node;
    return { destroy() {} };
  }

  onMount(() => {
    // Hero intro
    requestAnimationFrame(() => {
      setTimeout(() => { heroVisible = true; }, 80);
    });

    // DB metrics ticking
    const dbInterval = setInterval(() => {
      queryCount += Math.floor(Math.random() * 3) + 1;
      currentWritingOps = Math.floor(Math.sin(Date.now() / 6000) * 1500) + 18500;
      walFrames += Math.floor(Math.random() * 5) + 1;
    }, 1500);

    // Intersection observer for reveal
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observerSections[entry.target.dataset.section] = true;
        }
      }
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-section]').forEach(el => observer.observe(el));

    return () => {
      clearInterval(dbInterval);
      observer.disconnect();
    };
  });
</script>

<svelte:head>
  <title>V-Social — La Red Social Libre para Creadores</title>
  <meta name="description" content="Plataforma social open-source (AGPLv3) construida con SvelteKit 5, SQLite WAL y LiquidglassUI. 0% comisiones, feed cronológico puro, gamificación real. Auto-hospedable desde $4/mes." />
</svelte:head>

<div class="aero-wrapper theme-{activeTheme}">

  <!-- ═══════════════════════════════════ HEADER ══════════════════════════════════ -->
  <header class="aero-header glass-panel">
    <div class="nav-container">
      <a href="/" class="nav-logo">
        <span class="logo-prism">VS</span>ocial
        <span class="nav-live-badge">
          <span class="live-dot"></span>LIVE
        </span>
      </a>

      <nav class="nav-links" aria-label="Navegación principal">
        <a href="/explore">Explorar</a>
        <a href="/reels">Reels</a>
        <a href="/marketplace">Mercado</a>
        <a href="/messages">Mensajes</a>
        <a href="#features">Características</a>
        <a href="#gamification">Gamification</a>
      </nav>

      <div class="nav-actions">
        <button onclick={toggleTheme} class="btn-theme-toggle" title="Cambiar Tema" aria-label="Cambiar tema de color">
          <span class="material-icons-round">
            {themeStore.value === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        <div class="btn-liquidglass-wrap secondary-wrap" style="flex: 0 0 auto; min-width: 120px;">
          <a href="/login" class="btn-liquidglass-secondary">Iniciar Sesión</a>
        </div>
        <div class="btn-liquidglass-wrap primary-wrap" style="flex: 0 0 auto; min-width: 140px;">
          <a href="/register" class="btn-liquidglass-primary">Crear Cuenta</a>
        </div>
      </div>
    </div>
  </header>

  <!-- ═══════════════════════════════════ HERO ════════════════════════════════════ -->
  <section class="hero {heroVisible ? 'visible' : ''}">
    <!-- Aurora background -->
    <div class="aurora-blobs" aria-hidden="true">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <div class="hero-inner">
      <div class="hero-content">
        <div class="badge-premium">
          <span class="badge-dot"></span>
          Open Source · AGPLv3 · v2.1
        </div>

        <h1 class="title">
          La red social que<br/>
          <span class="text-glossy typewriter">devuelve el control</span>
        </h1>

        <p class="subtitle">
          Construida con <strong>SvelteKit 5 Runes</strong>, <strong>SQLite WAL mode</strong> y <strong>LiquidglassUI 2.0</strong>.
          Feed cronológico puro sin algoritmos ocultos. <strong>0% comisiones</strong> para creadores.
          Auto-hospedable desde <strong>$4/mes</strong>.
        </p>

        <div class="hero-actions">
          <div class="btn-liquidglass-wrap primary-wrap" style="flex: 0 0 auto;">
            <a href="/register" class="btn-liquidglass-primary">
              <span class="material-icons-round">rocket_launch</span>
              Únete Gratis
            </a>
          </div>
          <div class="btn-liquidglass-wrap secondary-wrap" style="flex: 0 0 auto;">
            <a href="#features" class="btn-liquidglass-secondary">
              <span class="material-icons-round">explore</span>
              Ver Capacidades
            </a>
          </div>
        </div>

        <!-- Live Stats Bar -->
        <div class="quick-stats glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
          <div class="card-refraction"></div>
          <div class="q-stat">
            <span class="num">0%</span>
            <span class="lbl">Comisiones</span>
          </div>
          <div class="q-stat border-l">
            <span class="num">AGPLv3</span>
            <span class="lbl">Licencia</span>
          </div>
          <div class="q-stat border-l">
            <span class="num">SQLite WAL</span>
            <span class="lbl">Motor DB</span>
          </div>
          <div class="q-stat border-l live-stat">
            <span class="num text-accent">{queryCount.toLocaleString()}</span>
            <span class="lbl">Queries • LIVE</span>
          </div>
        </div>
      </div>

      <!-- Mockup Window -->
      <div class="hero-mockup">
        <div class="aero-window glass-panel">
          <div class="window-header">
            <div class="window-controls" style="flex: 0 0 54px; min-width: 54px;">
              <span class="close"></span><span class="min"></span><span class="max"></span>
            </div>
            <div class="window-title">VSocial Dashboard — Open Core Node</div>
            <div class="window-status" style="flex: 0 0 80px; min-width: 80px;">
              <span class="ws-dot"></span> WAL: ON
            </div>
          </div>

          <div class="window-container">
            <div class="window-sidebar">
              <button class="sidebar-item" class:active={activeMockupTab === 'feed'} onclick={() => activeMockupTab = 'feed'}>
                <span class="material-icons-round">space_dashboard</span>
                <span>Feed Libre</span>
              </button>
              <button class="sidebar-item" class:active={activeMockupTab === 'analytics'} onclick={() => activeMockupTab = 'analytics'}>
                <span class="material-icons-round">dns</span>
                <span>Self-Hosted</span>
              </button>
              <button class="sidebar-item" class:active={activeMockupTab === 'gamification'} onclick={() => activeMockupTab = 'gamification'}>
                <span class="material-icons-round">emoji_events</span>
                <span>Gamification</span>
              </button>
              <button class="sidebar-item" class:active={activeMockupTab === 'engine'} onclick={() => activeMockupTab = 'engine'}>
                <span class="material-icons-round">terminal</span>
                <span>Open Code</span>
              </button>
            </div>

            <div class="window-body">
              {#if activeMockupTab === 'feed'}
                <div class="mock-feed">
                  <div class="mock-post glass-card" role="presentation" onmousemove={handleCardMouseMove}>
                    <div class="post-user">
                      <div class="post-avatar" style="flex: 0 0 40px; min-width: 40px; min-height: 40px; background: radial-gradient(circle, var(--accent-light), var(--accent-primary))">
                        AP
                      </div>
                      <div class="post-user-info">
                        <strong>@AkiraPixel</strong>
                        <span>Ilustrador & Streamer · Nv.42</span>
                      </div>
                      <span class="status-live-badge">LIVE</span>
                    </div>
                    <p class="post-content">
                      V-Social nos devuelve la soberanía sobre nuestro contenido. Sin algoritmos secretos, con el 100% de ingresos directo a nuestra cuenta. 🎨💎🌊
                    </p>
                    <div class="post-visual-chart glass-card">
                      <div class="chart-header"><span>Overhead por query (ms) — menor es mejor</span></div>
                      <div class="chart-row">
                        <span class="label">V-Social · SQLite WAL</span>
                        <div class="bar-container"><div class="bar bar-fast" style="width: 5%"></div></div>
                        <span class="val">0.04ms</span>
                      </div>
                      <div class="chart-row">
                        <span class="label">Cloud propietario</span>
                        <div class="bar-container"><div class="bar bar-slow" style="width: 80%"></div></div>
                        <span class="val">8.45ms</span>
                      </div>
                    </div>
                    <div class="post-footer-actions">
                      <button class="mock-like-btn" class:liked={mockupLiked} onclick={handleMockupLike} style="flex: 0 0 auto; min-height: 32px;">
                        <span class="material-icons-round">{mockupLiked ? 'favorite' : 'favorite_border'}</span>
                        <span>{mockupLikes}</span>
                      </button>
                      <span class="mock-comment-stat">
                        <span class="material-icons-round">chat_bubble_outline</span>
                        <span>Comunidad Libre</span>
                      </span>
                    </div>
                  </div>
                </div>

              {:else if activeMockupTab === 'analytics'}
                <div class="mock-analytics">
                  <div class="analytics-header">
                    <h3>Nodo Autogestionado</h3>
                    <p class="desc">Stack mínimo, máximo rendimiento.</p>
                  </div>
                  <div class="analytics-grid">
                    <div class="analytic-card glass-card" role="presentation" onmousemove={handleCardMouseMove}>
                      <span class="title">RAM Total</span>
                      <span class="value green-glow">&lt; 150MB</span>
                      <span class="meta">Ultra ligero</span>
                    </div>
                    <div class="analytic-card glass-card" role="presentation" onmousemove={handleCardMouseMove}>
                      <span class="title">WAL Frames</span>
                      <span class="value text-accent">{walFrames.toLocaleString()}</span>
                      <span class="meta">Escrituras atómicas</span>
                    </div>
                    <div class="analytic-card glass-card" role="presentation" onmousemove={handleCardMouseMove}>
                      <span class="title">Costo / mes</span>
                      <span class="value">~$4 USD</span>
                      <span class="meta">VPS básico</span>
                    </div>
                  </div>
                  <div class="analytics-chart-container glass-card" role="presentation" onmousemove={handleCardMouseMove}>
                    <div class="chart-legend">
                      <span class="legend-dot queries"></span>
                      <span>Queries/seg · WAL Mode activo</span>
                    </div>
                    <svg class="analytics-svg" viewBox="0 0 300 80" aria-hidden="true">
                      <defs>
                        <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.45"/>
                          <stop offset="100%" stop-color="var(--accent-primary)" stop-opacity="0.0"/>
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
                      <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
                      <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
                      <path d="M 0 80 Q 25 35 50 45 T 100 20 T 150 50 T 200 15 T 250 35 T 300 10 L 300 80 Z" fill="url(#chart-grad)" />
                      <path d="M 0 80 Q 25 35 50 45 T 100 20 T 150 50 T 200 15 T 250 35 T 300 10" fill="none" stroke="var(--accent-primary)" stroke-width="2" class="chart-line-pulse" />
                      <circle cx="300" cy="10" r="3" fill="var(--accent-light)" class="pulse-dot" />
                    </svg>
                  </div>
                </div>

              {:else if activeMockupTab === 'gamification'}
                <div class="mock-gamification">
                  <div class="gami-header">
                    <h3>Sistema de Gamificación</h3>
                    <p class="desc">Gana XP, sube de nivel, desbloquea badges.</p>
                  </div>
                  <div class="gami-leaderboard">
                    <div class="lb-row lb-gold glass-card">
                      <span class="lb-rank">🥇</span>
                      <div class="lb-avatar" style="flex:0 0 30px;min-width:30px;min-height:30px;background:radial-gradient(circle,#fbbf24,#f59e0b)">L3</div>
                      <div class="lb-info">
                        <strong>@Lumina_3D</strong>
                        <div class="lb-xp-bar"><div class="lb-xp-fill" style="width:92%"></div></div>
                      </div>
                      <span class="lb-points">24.5k XP</span>
                    </div>
                    <div class="lb-row glass-card">
                      <span class="lb-rank">🥈</span>
                      <div class="lb-avatar" style="flex:0 0 30px;min-width:30px;min-height:30px;background:radial-gradient(circle,#ec4899,#bf5af2)">AH</div>
                      <div class="lb-info">
                        <strong>@Aria_Hologram</strong>
                        <div class="lb-xp-bar"><div class="lb-xp-fill" style="width:74%"></div></div>
                      </div>
                      <span class="lb-points">18.9k XP</span>
                    </div>
                    <div class="lb-row glass-card">
                      <span class="lb-rank">🥉</span>
                      <div class="lb-avatar" style="flex:0 0 30px;min-width:30px;min-height:30px;background:radial-gradient(circle,#34d399,#00d4aa)">NB</div>
                      <div class="lb-info">
                        <strong>@Neptune_Beats</strong>
                        <div class="lb-xp-bar"><div class="lb-xp-fill" style="width:58%"></div></div>
                      </div>
                      <span class="lb-points">12.1k XP</span>
                    </div>
                  </div>
                  <div class="gami-badges">
                    <span class="badge-chip" title="Creador Premium">🎨 Artista</span>
                    <span class="badge-chip" title="10 Posts seguidos">🔥 Racha x10</span>
                    <span class="badge-chip" title="Verificado">✅ Verificado</span>
                    <span class="badge-chip" title="Nivel 50+">⚡ Legendario</span>
                  </div>
                </div>

              {:else if activeMockupTab === 'engine'}
                <div class="mock-engine">
                  <div class="code-terminal glass-card">
                    <div class="terminal-bar">
                      <div class="terminal-tabs">
                        <span class="tab active"><span class="material-icons-round font-icon">javascript</span>feed-engine.js</span>
                        <span class="tab"><span class="material-icons-round font-icon">table_chart</span>schema.sql</span>
                      </div>
                      <span class="lang-tag">AGPLv3</span>
                    </div>
                    <pre class="code-content"><code>{`// Feed cronológico puro — sin magia opaca
const stmt = db.prepare(\`
  SELECT p.*, u.username, u.display_name,
    u.avatar_url, u.is_verified, u.level
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE p.privacy = 'public'
  ORDER BY p.created_at DESC
  LIMIT ? OFFSET ?
\`);

// WAL mode: lecturas concurrentes sin bloqueos
export const getFeed = (limit=20, offset=0) =>
  stmt.all(limit, offset);`}</code></pre>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════ TECH STACK MARQUEE ════════════════════════════════ -->
  <div class="marquee-band" aria-label="Tecnologías del stack">
    <div class="marquee-track">
      <div class="marquee-inner">
        {#each Array(2) as _}
          <span class="marquee-item"><span class="material-icons-round">bolt</span> SvelteKit 5 Runes</span>
          <span class="marquee-sep">·</span>
          <span class="marquee-item"><span class="material-icons-round">storage</span> SQLite WAL Mode</span>
          <span class="marquee-sep">·</span>
          <span class="marquee-item"><span class="material-icons-round">gavel</span> Licencia AGPLv3</span>
          <span class="marquee-sep">·</span>
          <span class="marquee-item"><span class="material-icons-round">wifi</span> WebSocket + SSE</span>
          <span class="marquee-sep">·</span>
          <span class="marquee-item"><span class="material-icons-round">emoji_events</span> Gamification Engine</span>
          <span class="marquee-sep">·</span>
          <span class="marquee-item"><span class="material-icons-round">lock</span> JWT httpOnly · CSRF</span>
          <span class="marquee-sep">·</span>
          <span class="marquee-item"><span class="material-icons-round">play_circle</span> Reels 60FPS</span>
          <span class="marquee-sep">·</span>
          <span class="marquee-item"><span class="material-icons-round">storefront</span> Marketplace P2P</span>
          <span class="marquee-sep">·</span>
          <span class="marquee-item"><span class="material-icons-round">auto_awesome</span> LiquidglassUI 2.0</span>
          <span class="marquee-sep">·</span>
          <span class="marquee-item"><span class="material-icons-round">dns</span> Self-Hosted · $4/mes</span>
          <span class="marquee-sep">·</span>
        {/each}
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════ FEATURES ════════════════════════════════ -->
  <section id="features" class="features-section" data-section="features">
    <div class="section-head">
      <div class="section-eyebrow">Ecosistema</div>
      <h2 class="section-title">Libertad sin compromisos</h2>
      <p class="section-subtitle">Cada módulo diseñado para empoderar al creador — sin algoritmos opacos, sin comisiones, sin muros de pago.</p>
    </div>

    <div class="features-scroll-wrapper hide-scrollbar"
         class:dragging={isScrolling}
         bind:this={featuresGrid}
         role="presentation"
         onmousedown={handleGridMouseDown}
         onmouseleave={handleGridMouseLeave}
         onmouseup={handleGridMouseUp}
         onmousemove={handleGridMouseMove}>

      <div class="features-grid" role="presentation">
        <div class="features-card glass-card hover-lift" role="presentation" onmousemove={handleCardMouseMove}>
          <div class="card-refraction"></div>
          <div class="card-header-flex">
            <div class="icon-wrapper glass-icon">
              <span class="material-icons-round">history_toggle_off</span>
            </div>
            <span class="feature-tag-chip">Core Engine</span>
          </div>
          <h3>Feed Cronológico Puro</h3>
          <p>Sin retención algorítmica ni promociones pagadas. Tu timeline es una línea de tiempo estricta ordenada por <code>created_at DESC</code>. Lo que sigues, lo ves. Sin excepciones.</p>
          <div class="card-footer-tech">
            <span class="tech-pill">SQLite · keyset pagination</span>
          </div>
        </div>

        <div class="features-card glass-card hover-lift" role="presentation" onmousemove={handleCardMouseMove}>
          <div class="card-refraction"></div>
          <div class="card-header-flex">
            <div class="icon-wrapper glass-icon">
              <span class="material-icons-round">storefront</span>
            </div>
            <span class="feature-tag-chip">P2P Economy</span>
          </div>
          <h3>Marketplace 0% Fee</h3>
          <p>Vende assets digitales, ilustraciones y suscripciones sin peajes de plataforma. V-SOCIAL retiene <strong>0%</strong>. Cada centavo va directo a tu billetera.</p>
          <div class="card-footer-tech">
            <span class="tech-pill">marketplace_listings · wallet</span>
          </div>
        </div>

        <div class="features-card glass-card hover-lift" role="presentation" onmousemove={handleCardMouseMove}>
          <div class="card-refraction"></div>
          <div class="card-header-flex">
            <div class="icon-wrapper glass-icon">
              <span class="material-icons-round">play_circle_outline</span>
            </div>
            <span class="feature-tag-chip">Media Engine</span>
          </div>
          <h3>Reels & Stories 60FPS</h3>
          <p>Video vertical renderizado por hardware, delegado al GPU. Interfaz inmersiva libre de micro-cortes, telemetría invasiva y colapso volumétrico.</p>
          <div class="card-footer-tech">
            <span class="tech-pill">GPU compositing · will-change</span>
          </div>
        </div>

        <div class="features-card glass-card hover-lift" role="presentation" onmousemove={handleCardMouseMove}>
          <div class="card-refraction"></div>
          <div class="card-header-flex">
            <div class="icon-wrapper glass-icon">
              <span class="material-icons-round">forum</span>
            </div>
            <span class="feature-tag-chip">Real-Time</span>
          </div>
          <h3>Mensajería SSE + WS</h3>
          <p>Notificaciones instantáneas via Server-Sent Events. Chat P2P con WebSockets persistentes, heartbeat y reconexión exponencial automática.</p>
          <div class="card-footer-tech">
            <span class="tech-pill">SSE · WebSocket · Socket.io</span>
          </div>
        </div>

        <div class="features-card glass-card hover-lift" role="presentation" onmousemove={handleCardMouseMove}>
          <div class="card-refraction"></div>
          <div class="card-header-flex">
            <div class="icon-wrapper glass-icon">
              <span class="material-icons-round">emoji_events</span>
            </div>
            <span class="feature-tag-chip">Gamification</span>
          </div>
          <h3>XP, Niveles & Badges</h3>
          <p>Sistema de puntos de experiencia, leaderboard global, niveles desbloqueables y badges de logros. Crear contenido nunca fue tan adictivo y recompensado.</p>
          <div class="card-footer-tech">
            <span class="tech-pill">user_xp · badges · leaderboard</span>
          </div>
        </div>

        <div class="features-card glass-card hover-lift" role="presentation" onmousemove={handleCardMouseMove}>
          <div class="card-refraction"></div>
          <div class="card-header-flex">
            <div class="icon-wrapper glass-icon">
              <span class="material-icons-round">dns</span>
            </div>
            <span class="feature-tag-chip">Bare Metal</span>
          </div>
          <h3>Auto-hospedable · $4/mes</h3>
          <p>Con SQLite WAL + better-sqlite3 síncrono, un nodo de $4/mes pulveriza el throughput de clústeres cloud bajo estrés viral. Sin infraestructuras sobredimensionadas.</p>
          <div class="card-footer-tech">
            <span class="tech-pill">better-sqlite3 · WAL · @libsql</span>
          </div>
        </div>
      </div>
    </div>
    <p class="drag-hint">
      <span class="material-icons-round">drag_pan</span> Arrastra para explorar
    </p>
  </section>

  <!-- ═══════════════════════════ TECH DEEP-DIVE ══════════════════════════════ -->
  <section id="performance" class="tech-section" data-section="tech">
    <div class="tech-layout">
      <div class="tech-content">
        <div class="section-eyebrow">Arquitectura</div>
        <h2 class="section-title text-left">SQLite WAL:<br/>Brutal en producción</h2>
        <p class="desc">
          En V-SOCIAL apostamos por la simplicidad radical. <strong>better-sqlite3</strong> en modo WAL permite lecturas concurrentes ilimitadas mientras las escrituras ocurren atómicamente en el Write-Ahead Log. Un solo nodo. Zero configuración distribuida. Código auditado línea a línea.
        </p>

        <div class="performance-indicators">
          <div class="indicator-row">
            <div class="indicator-icon">
              <span class="material-icons-round">speed</span>
            </div>
            <div class="indicator-text">
              <h4>Latencia media de query: <span class="text-accent">{averageResponseTime}ms</span></h4>
              <p>Actualizado en tiempo real — modo WAL, índices compuestos, keyset pagination.</p>
            </div>
          </div>
          <div class="indicator-row">
            <div class="indicator-icon">
              <span class="material-icons-round">lock_open</span>
            </div>
            <div class="indicator-text">
              <h4>SQL 100% transparente y auditable</h4>
              <p>Sin ORMs ni cajas negras. Cada consulta está en el repositorio público bajo AGPLv3.</p>
            </div>
          </div>
          <div class="indicator-row">
            <div class="indicator-icon">
              <span class="material-icons-round">volunteer_activism</span>
            </div>
            <div class="indicator-text">
              <h4>Infraestructura sostenible</h4>
              <p>Huella de carbono mínima. Un servidor de $4/mes para miles de usuarios activos concurrentes.</p>
            </div>
          </div>
        </div>

        <div class="wal-stats-row">
          <div class="wal-stat glass-panel">
            <span class="ws-num">{currentWritingOps.toLocaleString()}</span>
            <span class="ws-lbl">Ops de escritura / min</span>
          </div>
          <div class="wal-stat glass-panel">
            <span class="ws-num">{walFrames.toLocaleString()}</span>
            <span class="ws-lbl">WAL frames acumulados</span>
          </div>
          <div class="wal-stat glass-panel">
            <span class="ws-num">{uptimeDays}d</span>
            <span class="ws-lbl">Uptime del nodo</span>
          </div>
        </div>
      </div>

      <div class="tech-visual glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
        <div class="card-refraction"></div>
        <h3 class="tv-title">Concurrencia WAL en Tiempo Real</h3>
        <p class="tv-sub">Lecturas paralelas, escritura secuencial atómica:</p>

        <div class="wal-schema">
          <div class="schema-box readers glass-card">
            <span class="schema-title">Lectores Concurrentes</span>
            <div class="readers-list">
              <span class="user-pill">@Lumina</span>
              <span class="user-pill">@Aria</span>
              <span class="user-pill">@Pixel</span>
              <span class="user-pill">+{Math.floor(currentWritingOps / 1000)}k más</span>
            </div>
            <div class="flow-line read-line"></div>
          </div>

          <div class="schema-box database glass-card">
            <span class="db-icon material-icons-round">storage</span>
            <span class="db-title">vsocial.db</span>
            <span class="db-status">∞ LECTURAS SIMULTÁNEAS</span>
            <span class="db-wal">WAL ✓ ACTIVE</span>
          </div>

          <div class="schema-box writers glass-card">
            <span class="schema-title">Escritura WAL (Atómica)</span>
            <div class="operations-stream">
              <code>INSERT INTO posts...</code>
              <code>UPDATE users SET xp...</code>
              <code>INSERT INTO likes...</code>
            </div>
            <div class="flow-line write-line"></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════ GAMIFICATION SECTION ═════════════════════════ -->
  <section id="gamification" class="gami-section" data-section="gami">
    <div class="section-head">
      <div class="section-eyebrow">Sistema Exclusivo</div>
      <h2 class="section-title">Crear tiene su recompensa</h2>
      <p class="section-subtitle">El primer motor de gamificación nativo en una red social libre. Gana XP, sube de nivel y compite en el leaderboard global.</p>
    </div>

    <div class="gami-layout">
      <div class="gami-cards">
        <div class="gami-feature-card glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
          <div class="card-refraction"></div>
          <div class="gami-icon-wrap xp-icon">
            <span class="material-icons-round">auto_awesome</span>
          </div>
          <h3>Sistema XP</h3>
          <p>Cada post, like, comentario y check-in suma puntos de experiencia. Tu actividad construye tu reputación de forma orgánica y transparente.</p>
          <div class="gami-demo-bar">
            <div class="gami-xp-track">
              <div class="gami-xp-fill" style="width: 68%"></div>
            </div>
            <span class="gami-xp-label">Nv. 24 → 68% hacia Nv. 25</span>
          </div>
        </div>

        <div class="gami-feature-card glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
          <div class="card-refraction"></div>
          <div class="gami-icon-wrap badge-icon">
            <span class="material-icons-round">workspace_premium</span>
          </div>
          <h3>Badges de Logro</h3>
          <p>Desbloquea insignias únicas por hitos reales: primer post viral, 10 días seguidos activo, verificación de creador, contribuciones al código abierto.</p>
          <div class="gami-badges-preview">
            <span class="gbp-badge" title="Artista">🎨</span>
            <span class="gbp-badge" title="Racha">🔥</span>
            <span class="gbp-badge" title="Verificado">✅</span>
            <span class="gbp-badge" title="Legendario">⚡</span>
            <span class="gbp-badge" title="Código Abierto">🐙</span>
            <span class="gbp-badge gbp-locked" title="Por desbloquear">🔒</span>
          </div>
        </div>

        <div class="gami-feature-card glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
          <div class="card-refraction"></div>
          <div class="gami-icon-wrap lb-icon">
            <span class="material-icons-round">leaderboard</span>
          </div>
          <h3>Leaderboard Global</h3>
          <p>Clasificación semanal y mensual de los creadores más activos. Ranking transparente basado en XP acumulado, no en métricas de pago.</p>
          <div class="gami-lb-preview">
            <div class="glb-row">
              <span class="glb-rank gold">1</span>
              <span class="glb-name">@Lumina_3D</span>
              <span class="glb-xp">24.5k XP</span>
            </div>
            <div class="glb-row">
              <span class="glb-rank silver">2</span>
              <span class="glb-name">@Aria_Hologram</span>
              <span class="glb-xp">18.9k XP</span>
            </div>
            <div class="glb-row">
              <span class="glb-rank bronze">3</span>
              <span class="glb-name">@Neptune_Beats</span>
              <span class="glb-xp">12.1k XP</span>
            </div>
          </div>
        </div>
      </div>

      <div class="gami-cta-card glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
        <div class="card-refraction"></div>
        <div class="gami-cta-icon">
          <span class="material-icons-round">emoji_events</span>
        </div>
        <div class="gami-cta-content">
          <h3>¿Listo para escalar?</h3>
          <p>Únete ahora y comienza a acumular XP desde tu primer post. El leaderboard se resetea cada semana — cada ciclo es una nueva oportunidad.</p>
        </div>
        <div class="gami-cta-actions">
          <div class="btn-liquidglass-wrap primary-wrap" style="flex: 0 0 44px; min-height: 44px;">
            <a href="/register" class="btn-liquidglass-primary w-full h-full">
              <span class="material-icons-round">rocket_launch</span>
              Empezar a ganar XP
            </a>
          </div>
          <a href="/leaderboard" class="gami-lb-link">Ver leaderboard actual →</a>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════ THEME SANDBOX SECTION ═══════════════════════════════ -->
  <section id="sandbox" class="sandbox-section" data-section="sandbox">
    <div class="sandbox-layout">
      <!-- Theme Switcher -->
      <div class="theme-customizer glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
        <div class="card-refraction"></div>
        <div class="section-eyebrow">LiquidglassUI 2.0</div>
        <h2 class="card-title">Motor de Temas Dinámico</h2>
        <p class="card-desc">Sistema de color tokenizado con 4 paletas Aero curadas. Cambia el acento en tiempo real sin recargar:</p>

        <div class="theme-picker-grid">
          <button class="picker-btn theme-prism" class:active={activeTheme === 'prism'} onclick={() => activeTheme = 'prism'}>
            <div class="liquid-sphere"></div>
            <div class="picker-info">
              <strong>Océano Prisma</strong>
              <span>Cyan & Royal Blue</span>
            </div>
          </button>
          <button class="picker-btn theme-sunset" class:active={activeTheme === 'sunset'} onclick={() => activeTheme = 'sunset'}>
            <div class="liquid-sphere"></div>
            <div class="picker-info">
              <strong>Amatista Aura</strong>
              <span>Purple & Electric Pink</span>
            </div>
          </button>
          <button class="picker-btn theme-mint" class:active={activeTheme === 'mint'} onclick={() => activeTheme = 'mint'}>
            <div class="liquid-sphere"></div>
            <div class="picker-info">
              <strong>Esmeralda Glaciar</strong>
              <span>Deep Mint & Emerald</span>
            </div>
          </button>
          <button class="picker-btn theme-fire" class:active={activeTheme === 'fire'} onclick={() => activeTheme = 'fire'}>
            <div class="liquid-sphere"></div>
            <div class="picker-info">
              <strong>Ámbar Fuego</strong>
              <span>Sunset Orange & Gold</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Live Post Playground -->
      <div class="live-sandbox glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
        <div class="card-refraction"></div>
        <div class="section-eyebrow">Svelte 5 Runes</div>
        <h2 class="card-title">Playground Reactivo</h2>
        <p class="card-desc">Motor de publicaciones en caliente con reactividad sin boilerplate. Escribe algo y ve la magia:</p>

        <div class="sandbox-compose-box">
          <div class="sandbox-input-row">
            <textarea
              id="sandbox_post_input"
              name="sandbox_post"
              class="sandbox-textarea"
              placeholder="Escribe tu primer post libre de algoritmos corporativos..."
              bind:value={newPostText}
              style="min-height: 80px;"
            ></textarea>
          </div>

          <div class="sandbox-input-footer">
            <div class="emoji-fast-picker">
              <button onclick={() => newPostText += '✨'} class="emoji-btn" aria-label="Añadir estrella">✨</button>
              <button onclick={() => newPostText += '🎨'} class="emoji-btn" aria-label="Añadir paleta">🎨</button>
              <button onclick={() => newPostText += '🌊'} class="emoji-btn" aria-label="Añadir ola">🌊</button>
              <button onclick={() => newPostText += '💎'} class="emoji-btn" aria-label="Añadir diamante">💎</button>
            </div>
            <div class="btn-liquidglass-wrap primary-wrap" style="flex: 0 0 160px; min-height: 40px; border-radius: var(--radius-full);">
              <button class="btn-liquidglass-primary w-full h-full" onclick={handleAddPost}>
                <span class="material-icons-round">send</span>
                Publicar Demo
              </button>
            </div>
          </div>
        </div>

        <div class="sandbox-feed-display">
          {#each sandboxPosts as post}
            <div class="sandbox-post-item glass-card" role="presentation" onmousemove={handleCardMouseMove}>
              <div class="item-header">
                <div class="item-avatar" style="flex: 0 0 34px; min-width: 34px; min-height: 34px; background: radial-gradient(circle, var(--accent-light), var(--accent-primary))">
                  {post.author.slice(1, 3).toUpperCase()}
                </div>
                <div class="item-meta">
                  <strong>{post.author}</strong>
                  <span>{post.time}</span>
                </div>
              </div>
              <p class="item-body">{post.text}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════ CREATOR SPOTLIGHT ═══════════════════════════════ -->
  <section class="creators-spotlight" data-section="creators">
    <div class="section-head">
      <div class="section-eyebrow">Comunidad</div>
      <h2 class="section-title">Creadores en movimiento</h2>
      <p class="section-subtitle">Artistas, diseñadores 3D y músicos que habitan V-SOCIAL y co-diseñan su futuro abierto.</p>
    </div>

    <div class="creators-grid">
      <div class="creator-card glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
        <div class="card-refraction"></div>
        <div class="creator-header">
          <div class="creator-avatar" style="flex: 0 0 52px; min-width: 52px; min-height: 52px; background: radial-gradient(circle, #5ac8fa, #1b85f3)">L3</div>
          <div class="creator-meta">
            <h3>@Lumina_3D</h3>
            <span>Modeladora 3D · Rigger VTuber</span>
          </div>
          <span class="status-badge live"><span class="dot"></span> LIVE</span>
        </div>
        <p class="creator-bio">Rigs de VTubers de código abierto y modelos en formato libre. El 100% de sus ventas, sin intermediarios.</p>
        <div class="creator-stats">
          <div class="stat"><strong>24.5k</strong><span>Seguidores</span></div>
          <div class="stat"><strong>Nv. 48</strong><span>Nivel XP</span></div>
          <div class="stat"><strong>0%</strong><span>Comisión</span></div>
        </div>
        <div class="btn-liquidglass-wrap primary-wrap w-full mt-4" style="flex: 0 0 44px; min-height: 44px;">
          <a href="/register" class="btn-liquidglass-primary w-full h-full">Ver Portafolio</a>
        </div>
      </div>

      <div class="creator-card glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
        <div class="card-refraction"></div>
        <div class="creator-header">
          <div class="creator-avatar" style="flex: 0 0 52px; min-width: 52px; min-height: 52px; background: radial-gradient(circle, #ff2d55, #ec4899)">AH</div>
          <div class="creator-meta">
            <h3>@Aria_Hologram</h3>
            <span>Arte Digital · UI Design</span>
          </div>
          <span class="status-badge offline"><span class="dot"></span> IDLE</span>
        </div>
        <p class="creator-bio">Ilustraciones Aero e interfaces retro-futuristas. Comisiones directas sin retención de plataforma.</p>
        <div class="creator-stats">
          <div class="stat"><strong>18.9k</strong><span>Seguidores</span></div>
          <div class="stat"><strong>Nv. 36</strong><span>Nivel XP</span></div>
          <div class="stat"><strong>0%</strong><span>Comisión</span></div>
        </div>
        <div class="btn-liquidglass-wrap primary-wrap w-full mt-4" style="flex: 0 0 44px; min-height: 44px;">
          <a href="/register" class="btn-liquidglass-primary w-full h-full">Ver Galería</a>
        </div>
      </div>

      <div class="creator-card glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
        <div class="card-refraction"></div>
        <div class="creator-header">
          <div class="creator-avatar" style="flex: 0 0 52px; min-width: 52px; min-height: 52px; background: radial-gradient(circle, #34d399, #00d4aa)">NB</div>
          <div class="creator-meta">
            <h3>@Neptune_Beats</h3>
            <span>Audio · Loops Creative Commons</span>
          </div>
          <span class="status-badge live"><span class="dot"></span> LIVE</span>
        </div>
        <p class="creator-bio">Música líquida y sintetizadores retro-futuristas bajo licencias CC. Distribución sin plataformas que se queden con tu arte.</p>
        <div class="creator-stats">
          <div class="stat"><strong>12.1k</strong><span>Seguidores</span></div>
          <div class="stat"><strong>Nv. 29</strong><span>Nivel XP</span></div>
          <div class="stat"><strong>0%</strong><span>Comisión</span></div>
        </div>
        <div class="btn-liquidglass-wrap primary-wrap w-full mt-4" style="flex: 0 0 44px; min-height: 44px;">
          <a href="/register" class="btn-liquidglass-primary w-full h-full">Escuchar Loops</a>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════ FAQ ═════════════════════════════════════ -->
  <section id="faq" class="faq-section" data-section="faq">
    <div class="section-head">
      <div class="section-eyebrow">Preguntas</div>
      <h2 class="section-title">Todo lo que necesitas saber</h2>
      <p class="section-subtitle">Sobre código libre, auto-alojamiento, comisiones y gamificación en V-SOCIAL.</p>
    </div>

    <div class="faq-list">
      <div class="faq-item glass-panel" class:open={faqOpenStates[0]}>
        <button class="faq-question" onclick={() => toggleFaq(0)}>
          <span>¿V-Social es realmente 100% gratuito y de código abierto?</span>
          <span class="material-icons-round chevron">expand_more</span>
        </button>
        {#if faqOpenStates[0]}
        <div class="faq-answer-container" transition:slide>
          <div class="faq-answer">
            <p>Sí, absolutamente. V-Social se publica bajo la <strong>Licencia AGPLv3</strong>, garantizando que el código sea libre y permanezca libre. Cualquier instancia cloud debe hacer públicas sus modificaciones. No existen suscripciones premium, muros de pago ocultos, publicidad invasiva ni minería de datos corporativa.</p>
          </div>
        </div>
        {/if}
      </div>

      <div class="faq-item glass-panel" class:open={faqOpenStates[1]}>
        <button class="faq-question" onclick={() => toggleFaq(1)}>
          <span>¿Cómo gestionan las comisiones y pagos de artistas?</span>
          <span class="material-icons-round chevron">expand_more</span>
        </button>
        {#if faqOpenStates[1]}
        <div class="faq-answer-container" transition:slide>
          <div class="faq-answer">
            <p>A diferencia de plataformas que cobran entre 5% y 30% por venta, <strong>V-Social cobra el 0%</strong>. Las transacciones se realizan mediante pasarelas de pago tradicionales, seguras y configurables. El 100% de los ingresos va a la cuenta del creador.</p>
          </div>
        </div>
        {/if}
      </div>

      <div class="faq-item glass-panel" class:open={faqOpenStates[2]}>
        <button class="faq-question" onclick={() => toggleFaq(2)}>
          <span>¿Qué necesito para hospedar mi propio nodo de V-Social?</span>
          <span class="material-icons-round chevron">expand_more</span>
        </button>
        {#if faqOpenStates[2]}
        <div class="faq-answer-container" transition:slide>
          <div class="faq-answer">
            <p>Un VPS Linux de <strong>$4 USD/mes</strong> es más que suficiente para miles de usuarios. Con SQLite WAL en un solo archivo local, el backup es tan simple como copiar el <code>.db</code>. Node.js + el bundle de SvelteKit es todo lo que necesitas.</p>
          </div>
        </div>
        {/if}
      </div>

      <div class="faq-item glass-panel" class:open={faqOpenStates[3]}>
        <button class="faq-question" onclick={() => toggleFaq(3)}>
          <span>¿Los algoritmos deciden qué publicaciones se muestran?</span>
          <span class="material-icons-round chevron">expand_more</span>
        </button>
        {#if faqOpenStates[3]}
        <div class="faq-answer-container" transition:slide>
          <div class="faq-answer">
            <p>No. El feed es <strong>estrictamente cronológico inverso</strong>: <code>ORDER BY created_at DESC</code>. Ves exactamente lo que publican quienes sigues, libre de promociones forzadas y filtros opacos que manipulen tu alcance orgánico.</p>
          </div>
        </div>
        {/if}
      </div>

      <div class="faq-item glass-panel" class:open={faqOpenStates[4]}>
        <button class="faq-question" onclick={() => toggleFaq(4)}>
          <span>¿Cómo funciona el sistema de gamificación y leaderboard?</span>
          <span class="material-icons-round chevron">expand_more</span>
        </button>
        {#if faqOpenStates[4]}
        <div class="faq-answer-container" transition:slide>
          <div class="faq-answer">
            <p>Cada acción en la plataforma genera <strong>puntos de experiencia (XP)</strong>: publicar, recibir likes, comentar, hacer check-in diario y más. Al acumular XP subes de nivel y desbloqueas badges de logro. El <strong>leaderboard global</strong> se actualiza en tiempo real y se resetea semanalmente, dando oportunidades equitativas a todos los creadores sin importar su antigüedad.</p>
          </div>
        </div>
        {/if}
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════ FINAL CTA ════════════════════════════════ -->
  <section class="final-cta-section" data-section="cta">
    <div class="cta-aurora" aria-hidden="true">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
    </div>
    <div class="cta-inner glass-panel" role="presentation" onmousemove={handleCardMouseMove}>
      <div class="card-refraction"></div>
      <div class="cta-badge">
        <span class="badge-dot"></span> Código Abierto para Siempre
      </div>
      <h2 class="cta-title">
        Deja de pagar<br/>
        <span class="text-glossy">comisiones que no mereces.</span>
      </h2>
      <p class="cta-sub">
        Únete a la plataforma social construida por creadores, para creadores. Gratis. Para siempre. Sin trampa.
      </p>
      <div class="cta-actions">
        <div class="btn-liquidglass-wrap primary-wrap" style="flex: 0 0 auto;">
          <a href="/register" class="btn-liquidglass-primary cta-btn-lg">
            <span class="material-icons-round">rocket_launch</span>
            Crear Cuenta Libre
          </a>
        </div>
        <div class="btn-liquidglass-wrap secondary-wrap" style="flex: 0 0 auto;">
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" class="btn-liquidglass-secondary cta-btn-lg">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
            Ver en GitHub
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════ FOOTER ═══════════════════════════════════ -->
  <footer class="aero-footer">
    <div class="footer-container">
      <div class="footer-brand">
        <a href="/" class="nav-logo footer-logo">
          <span class="logo-prism">VS</span>ocial
        </a>
        <p>Plataforma social open-source para creadores. Libre de algoritmos, libre de comisiones, libre de corporaciones. AGPLv3 para siempre.</p>
        <div class="footer-socials">
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" class="social-icon" title="GitHub" aria-label="GitHub">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
          </a>
          <a href="https://discord.com" target="_blank" rel="noopener noreferrer" class="social-icon" title="Discord" aria-label="Discord">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
          </a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" class="social-icon" title="X / Twitter" aria-label="X Twitter">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>
      </div>

      <div class="footer-links-grid">
        <div class="footer-col">
          <h4>Plataforma</h4>
          <a href="#features">Características</a>
          <a href="/reels">Reels & Stories</a>
          <a href="/marketplace">Marketplace</a>
          <a href="/messages">Mensajería Live</a>
          <a href="/leaderboard">Leaderboard</a>
        </div>
        <div class="footer-col">
          <h4>Comunidad</h4>
          <a href="/explore">Creadores</a>
          <a href="/login">Iniciar Sesión</a>
          <a href="/register">Crear Cuenta</a>
          <a href="/setup">Instalar Nodo</a>
        </div>
        <div class="footer-col">
          <h4>Desarrollo</h4>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub Repo</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">Reportar Bug</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">Contribuir</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">Documentación</a>
        </div>
        <div class="footer-col">
          <h4>Tecnología</h4>
          <a href="https://svelte.dev" target="_blank" rel="noopener noreferrer">Svelte 5 Runes</a>
          <a href="https://sqlite.org" target="_blank" rel="noopener noreferrer">SQLite WAL</a>
          <a href="https://github.com/WiseLibs/better-sqlite3" target="_blank" rel="noopener noreferrer">better-sqlite3</a>
          <a href="#sandbox">LiquidglassUI</a>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <p>© 2026 V-Social · Open Source bajo Licencia AGPLv3 · LiquidglassUI v2.1 · Hecho con ❤️ por la comunidad</p>
    </div>
  </footer>

</div>

<!-- SVG Displacement Filter for LiquidglassUI -->
<svg style="position: absolute; width: 0; height: 0; pointer-events: none;" aria-hidden="true">
  <filter id="lg-dist" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="92" result="noise" />
    <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
    <feDisplacementMap in="SourceGraphic" in2="blurred" scale="16" xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>

<style>
  /* ═══════════════════════════════════════════════════════════════
     VSOCIAL LANDING — LiquidglassUI 2.0 + Glassmorphism Premium
     ═══════════════════════════════════════════════════════════════ */

  .aero-wrapper {
    position: relative;
    min-height: 100vh;
    overflow-x: clip;
    background: var(--bg-canvas);
    color: var(--text-primary);
    font-family: var(--font-sans);
    transition: background var(--t-slow), color var(--t-slow);
    isolation: isolate;
    --glass-blur: blur(22px) saturate(1.6);
    --glass-bg: rgba(255, 255, 255, 0.06);
    --glass-border: rgba(255, 255, 255, 0.12);
    --glass-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
    --glass-inset: inset 0 1px 0 rgba(255, 255, 255, 0.12);
    --noise-texture: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
    --depth-1: 0 2px 6px rgba(0, 0, 0, 0.12);
    --depth-2: 0 4px 12px rgba(0, 0, 0, 0.2);

    /* --- Landing Semantic Variables --- */
    --glass-panel-bg: rgba(255, 255, 255, 0.04);
    --glass-panel-border: rgba(255, 255, 255, 0.08);
    --glass-card-bg: rgba(255, 255, 255, 0.03);
    --glass-card-border: rgba(255, 255, 255, 0.06);
    --glass-card-hover: rgba(255, 255, 255, 0.08);
    --glass-card-gradient: linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%);
    --glass-separator: rgba(255, 255, 255, 0.06);
    --code-bg: rgba(255, 255, 255, 0.07);
    --icon-bg: rgba(255, 255, 255, 0.06);
    --input-bg: rgba(255, 255, 255, 0.06);
    --footer-bg: rgba(0, 0, 0, 0.15);
  }

  :global([data-theme="light"]) .aero-wrapper {
    --glass-bg: rgba(255, 255, 255, 0.55);
    --glass-border: rgba(0, 0, 0, 0.08);
    --glass-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
    --glass-inset: inset 0 1px 0 rgba(255, 255, 255, 0.9);
    --depth-1: 0 2px 6px rgba(0, 0, 0, 0.04);
    --depth-2: 0 4px 12px rgba(0, 0, 0, 0.08);

    /* --- Landing Semantic Variables (Light) --- */
    --glass-panel-bg: rgba(255, 255, 255, 0.6);
    --glass-panel-border: rgba(0, 0, 0, 0.06);
    --glass-card-bg: rgba(255, 255, 255, 0.4);
    --glass-card-border: rgba(0, 0, 0, 0.04);
    --glass-card-hover: rgba(255, 255, 255, 0.7);
    --glass-card-gradient: linear-gradient(145deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.3) 100%);
    --glass-separator: rgba(0, 0, 0, 0.06);
    --code-bg: rgba(0, 0, 0, 0.04);
    --icon-bg: rgba(0, 0, 0, 0.03);
    --input-bg: rgba(255, 255, 255, 0.7);
    --footer-bg: rgba(0, 0, 0, 0.02);
  }

  /* ── Colorway Themes ─────────────────────────────────────────── */
  .aero-wrapper.theme-prism {
    --accent-primary: #1b85f3; --accent-light: #2eb4ff;
    --accent-glow: var(--glow-blue);
    --liquid-gradient: linear-gradient(135deg, #1b85f3 0%, #2eb4ff 100%);
    --neon-glow: var(--glow-blue-subtle);
    --neon-glow-strong: var(--glow-blue-strong);
  }
  .aero-wrapper.theme-sunset {
    --accent-primary: #ec4899; --accent-light: #f472b6;
    --accent-glow: var(--glow-pink);
    --liquid-gradient: linear-gradient(135deg, #bf5af2 0%, #ff007f 100%);
    --neon-glow: var(--glow-pink-subtle);
    --neon-glow-strong: var(--glow-pink-strong);
  }
  .aero-wrapper.theme-mint {
    --accent-primary: #00d4aa; --accent-light: #2ee5b3;
    --accent-glow: var(--glow-green);
    --liquid-gradient: linear-gradient(135deg, #00a388 0%, #00ffaa 100%);
    --neon-glow: var(--glow-green-subtle);
    --neon-glow-strong: var(--glow-green-strong);
  }
  .aero-wrapper.theme-fire {
    --accent-primary: #f5a623; --accent-light: #fbbf24;
    --accent-glow: var(--glow-orange);
    --liquid-gradient: linear-gradient(135deg, #ff4500 0%, #ffaa00 100%);
    --neon-glow: var(--glow-orange-subtle);
    --neon-glow-strong: var(--glow-orange-strong);
  }

  /* ── Glass Primitives ────────────────────────────────────────── */
  .glass-panel, .glass-card {
    position: relative;
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow), var(--glass-inset);
    border-radius: var(--radius-lg);
    transition: transform var(--t-spring), box-shadow var(--t-base), border-color var(--t-base);
    overflow: hidden;
  }
  .glass-panel::before, .glass-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--noise-texture);
    opacity: 0.015;
    mix-blend-mode: overlay;
    pointer-events: none;
    z-index: 1;
  }
  .glass-panel::after, .glass-card::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-highlight) 30%, var(--border-highlight) 50%, var(--border-highlight) 70%, transparent);
    z-index: 4;
    pointer-events: none;
  }
  .glass-panel > *, .glass-card > * { position: relative; z-index: 2; }

  /* Specular refraction on hover */
  .card-refraction {
    position: absolute; inset: 0;
    background: radial-gradient(circle 220px at var(--mouse-x, -999px) var(--mouse-y, -999px), var(--surface-highlight), transparent 75%);
    z-index: 3; pointer-events: none;
    transition: opacity 0.3s ease; opacity: 0;
  }
  .glass-panel:hover .card-refraction,
  .glass-card:hover .card-refraction { opacity: 1; }

  /* hover-lift for feature cards */
  .hover-lift:hover {
    transform: translateY(-4px) scale(1.01);
    box-shadow: var(--glass-shadow), var(--glass-inset), var(--neon-glow);
    border-color: var(--border-highlight);
  }

  /* ── Aurora Background ───────────────────────────────────────── */
  .aurora-blobs {
    position: absolute; top: -20%; left: -15%; right: -15%; bottom: 0;
    pointer-events: none; z-index: 0;
    filter: blur(140px); opacity: 0.6; overflow: hidden;
  }
  .blob { position: absolute; border-radius: 50%; background: var(--liquid-gradient); mix-blend-mode: screen; will-change: transform; }
  .blob-1 { width: 65vw; height: 65vw; top: 5%; left: -10%; animation: floatBlob1 28s ease-in-out infinite alternate; opacity: 0.4; }
  .blob-2 { width: 55vw; height: 55vw; bottom: 5%; right: -10%; animation: floatBlob2 35s ease-in-out infinite alternate; opacity: 0.3; }
  .blob-3 { width: 40vw; height: 40vw; top: 30%; left: 35%; animation: floatBlob3 24s ease-in-out infinite alternate; opacity: 0.25; }
  @keyframes floatBlob1 { 0% { transform: translate3d(0,0,0) scale(1); } 100% { transform: translate3d(6%,10%,0) scale(1.12); } }
  @keyframes floatBlob2 { 0% { transform: translate3d(0,0,0) scale(1.1); } 100% { transform: translate3d(-8%,-6%,0) scale(0.9); } }
  @keyframes floatBlob3 { 0% { transform: translate3d(0,0,0) scale(0.9); } 100% { transform: translate3d(5%,-10%,0) scale(1.05); } }

  /* ── Header ─────────────────────────────────────────────────── */
  .aero-header {
    position: fixed; top: 1.2rem; left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 10%); max-width: 1400px;
    z-index: 200; padding: 0.75rem 2rem;
    border-radius: var(--radius-full);
    background: var(--surface-glass-deep);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-deep), var(--glass-inset);
  }
  .nav-container { display: flex; align-items: center; justify-content: space-between; }
  .nav-logo {
    font-family: var(--font-display); font-weight: 900; font-size: 1.5rem;
    letter-spacing: -0.02em; color: var(--text-primary);
    display: flex; align-items: center; gap: 8px; text-decoration: none;
  }
  .logo-prism {
    background: var(--liquid-gradient);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 2px 10px var(--accent-light));
  }
  .nav-live-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em;
    color: var(--accent-light);
    background: var(--surface-green-subtle); border: 1px solid var(--border-green);
    padding: 2px 8px; border-radius: 99px;
  }
  .live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--color-green);
    box-shadow: 0 0 8px var(--color-green);
    animation: livePulse 1.6s ease-in-out infinite;
  }
  @keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }

  .nav-links { display: none; align-items: center; gap: 1.75rem; }
  .nav-links a { font-size: 0.88rem; font-weight: 500; color: var(--text-secondary); transition: color var(--t-fast); }
  .nav-links a:hover { color: var(--accent-primary); }
  .nav-actions { display: flex; align-items: center; gap: 0.75rem; }
  .btn-theme-toggle {
    display: flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; border-radius: 12px;
    background: var(--icon-bg); border: 1px solid var(--glass-card-border);
    color: var(--text-muted); cursor: pointer;
    transition: all var(--t-fast);
  }
  .btn-theme-toggle:hover { background: var(--glass-card-hover); color: var(--accent-primary); }

  /* ── Hero ────────────────────────────────────────────────────── */
  .hero {
    position: relative; min-height: 100vh;
    display: flex; align-items: center;
    padding: 7rem 5% 4rem;
    opacity: 0; transform: translateY(20px);
    transition: opacity 0.8s var(--ease-smooth), transform 0.8s var(--ease-smooth);
  }
  .hero.visible { opacity: 1; transform: translateY(0); }
  .hero-inner {
    position: relative; z-index: 5;
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 3rem; align-items: center;
    width: 100%; max-width: 1400px; margin: 0 auto;
  }
  .hero-content { display: flex; flex-direction: column; gap: 1.5rem; }

  .badge-premium {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--accent-light);
    background: var(--icon-bg); border: 1px solid var(--glass-card-border);
    padding: 6px 14px; border-radius: 99px; width: fit-content;
  }
  .badge-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-primary); box-shadow: var(--neon-glow); }

  .title {
    font-family: var(--font-display); font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 900; line-height: 1.1; letter-spacing: -0.03em;
    color: var(--text-primary); margin: 0;
  }
  .text-glossy {
    background: var(--liquid-gradient);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 4px 20px var(--accent-glow));
  }
  /* Typewriter CSS animation */
  .typewriter {
    display: inline-block;
    overflow: hidden; white-space: nowrap;
    border-right: 2px solid var(--accent-primary);
    animation: typewriter 2s steps(18, end) 0.5s forwards, blinkCaret 0.75s step-end infinite 0.5s;
    max-width: 0;
  }
  @keyframes typewriter { from { max-width: 0; } to { max-width: 100%; } }
  @keyframes blinkCaret { from, to { border-color: transparent; } 50% { border-color: var(--accent-primary); } }

  .subtitle {
    font-size: 1rem; line-height: 1.7; color: var(--text-secondary);
    max-width: 520px; margin: 0;
  }
  .subtitle strong { color: var(--text-primary); }

  .hero-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }

  .quick-stats {
    display: flex; gap: 0; border-radius: var(--radius-lg);
    padding: 0; overflow: hidden;
  }
  .q-stat {
    display: flex; flex-direction: column; gap: 2px;
    padding: 0.9rem 1.25rem; flex: 1;
  }
  .q-stat.border-l { border-left: 1px solid var(--glass-separator); }
  .q-stat .num {
    font-family: var(--font-display); font-size: 1.1rem; font-weight: 800;
    color: var(--text-primary); letter-spacing: -0.02em;
  }
  .q-stat .lbl { font-size: 0.7rem; color: var(--text-muted); font-weight: 500; }
  .live-stat .num { color: var(--accent-primary); }
  .text-accent { color: var(--accent-primary); }

  /* ── Hero Mockup Window ──────────────────────────────────────── */
  .hero-mockup { position: relative; }
  .aero-window { border-radius: 12px; overflow: hidden; box-shadow: var(--glass-shadow), 0 0 60px var(--shadow-deep); }
  .window-header {
    display: flex; align-items: center;
    background: var(--glass-panel-bg);
    border-bottom: 1px solid var(--glass-separator);
    padding: 10px 16px; gap: 12px;
  }
  .window-controls { display: flex; gap: 6px; align-items: center; }
  .window-controls span {
    display: inline-block; width: 12px; height: 12px; border-radius: 50%;
  }
  .window-controls .close { background: var(--status-red); }
  .window-controls .min { background: var(--status-yellow); }
  .window-controls .max { background: var(--status-green); }
  .window-title { flex: 1; text-align: center; font-size: 0.78rem; color: var(--text-muted); font-weight: 500; }
  .window-status { display: flex; align-items: center; gap: 4px; font-size: 0.68rem; color: var(--color-green); font-weight: 600; }
  .ws-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-green); box-shadow: 0 0 6px var(--color-green); }
  .window-container { display: flex; height: 340px; }
  .window-sidebar {
    display: flex; flex-direction: column; gap: 4px;
    padding: 10px 8px;
    background: var(--glass-card-bg);
    border-right: 1px solid var(--glass-separator);
    min-width: 110px;
  }
  .sidebar-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 8px; border: none;
    background: transparent; color: var(--text-muted);
    cursor: pointer; font-size: 0.75rem; text-align: left;
    transition: all var(--t-fast); white-space: nowrap;
  }
  .sidebar-item:hover { background: var(--glass-card-hover); color: var(--text-primary); }
  .sidebar-item.active { background: var(--glass-panel-bg); color: var(--accent-primary); }
  .sidebar-item .material-icons-round { font-size: 16px; }
  .window-body { flex: 1; overflow: auto; padding: 12px; }

  /* Feed mock */
  .mock-post { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .post-user { display: flex; align-items: center; gap: 10px; }
  .post-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; font-weight: 700; color: white;
  }
  .post-user-info { flex: 1; }
  .post-user-info strong { display: block; font-size: 0.82rem; color: var(--text-primary); }
  .post-user-info span { font-size: 0.7rem; color: var(--text-muted); }
  .status-live-badge {
    font-size: 0.6rem; font-weight: 700; padding: 2px 8px;
    border-radius: 99px; background: var(--surface-red-subtle);
    border: 1px solid var(--border-red); color: var(--status-red);
    animation: livePulse 1.6s ease-in-out infinite;
  }
  .post-content { font-size: 0.78rem; line-height: 1.5; color: var(--text-secondary); margin: 0; }
  .post-visual-chart { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
  .chart-header span { font-size: 0.68rem; color: var(--text-muted); }
  .chart-row { display: flex; align-items: center; gap: 8px; font-size: 0.68rem; }
  .label { width: 140px; font-size: 0.65rem; color: var(--text-muted); flex-shrink: 0; }
  .bar-container { flex: 1; height: 6px; background: var(--glass-separator); border-radius: 99px; overflow: hidden; }
  .bar { height: 100%; border-radius: 99px; }
  .bar-fast { background: var(--liquid-gradient); }
  .bar-slow { background: var(--surface-slow-bar); }
  .val { font-size: 0.65rem; color: var(--text-muted); width: 40px; text-align: right; }
  .post-footer-actions { display: flex; gap: 10px; align-items: center; }
  .mock-like-btn {
    display: flex; align-items: center; gap: 4px; border: none;
    background: var(--icon-bg); border-radius: 99px;
    color: var(--text-muted); padding: 4px 12px; cursor: pointer;
    font-size: 0.72rem; transition: all var(--t-fast);
  }
  .mock-like-btn .material-icons-round { font-size: 14px; }
  .mock-like-btn.liked { color: var(--status-red); background: var(--surface-red-subtle); }
  .mock-comment-stat { display: flex; align-items: center; gap: 4px; font-size: 0.72rem; color: var(--text-muted); }
  .mock-comment-stat .material-icons-round { font-size: 14px; }

  /* Analytics mock */
  .mock-analytics, .mock-engine, .mock-gamification { display: flex; flex-direction: column; gap: 10px; }
  .analytics-header h3, .gami-header h3 { font-size: 0.88rem; color: var(--text-primary); margin: 0; }
  .analytics-header .desc, .gami-header .desc { font-size: 0.72rem; color: var(--text-muted); margin: 0; }
  .analytics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .analytic-card { padding: 8px; display: flex; flex-direction: column; gap: 2px; }
  .analytic-card .title { font-size: 0.65rem; color: var(--text-muted); }
  .analytic-card .value { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); }
  .analytic-card .meta { font-size: 0.6rem; color: var(--text-muted); }
  .green-glow { color: var(--color-green); }
  .analytics-chart-container { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
  .chart-legend { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; color: var(--text-muted); }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
  .legend-dot.queries { background: var(--accent-primary); }
  .analytics-svg { width: 100%; }
  .chart-line-pulse { stroke-dasharray: 4 2; animation: dashMove 1.5s linear infinite; }
  @keyframes dashMove { to { stroke-dashoffset: -12; } }
  .pulse-dot { animation: dotPulse 1.5s ease-in-out infinite; }
  @keyframes dotPulse { 0%, 100% { opacity: 1; r: 3px; } 50% { opacity: 0.4; r: 2px; } }

  /* Gamification mock */
  .gami-leaderboard { display: flex; flex-direction: column; gap: 5px; }
  .lb-row {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 10px; border-radius: 8px;
  }
  .lb-row.lb-gold { background: var(--surface-gold-subtle); border-color: var(--border-gold); }
  .lb-rank { font-size: 0.85rem; width: 20px; text-align: center; }
  .lb-avatar {
    width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.6rem; font-weight: 700; color: white;
  }
  .lb-info { flex: 1; }
  .lb-info strong { display: block; font-size: 0.72rem; color: var(--text-primary); }
  .lb-xp-bar { height: 3px; background: var(--glass-separator); border-radius: 99px; margin-top: 3px; overflow: hidden; }
  .lb-xp-fill { height: 100%; background: var(--liquid-gradient); border-radius: 99px; }
  .lb-points { font-size: 0.65rem; color: var(--accent-primary); font-weight: 600; white-space: nowrap; }
  .gami-badges { display: flex; flex-wrap: wrap; gap: 4px; }
  .badge-chip {
    font-size: 0.65rem; padding: 2px 8px; border-radius: 99px;
    background: var(--icon-bg); border: 1px solid var(--glass-card-border);
    color: var(--text-secondary);
  }

  /* Code terminal mock */
  .code-terminal { padding: 0; }
  .terminal-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; border-bottom: 1px solid var(--glass-separator);
    background: var(--glass-panel-bg);
  }
  .terminal-tabs { display: flex; gap: 4px; }
  .tab {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.65rem; color: var(--text-muted);
    padding: 3px 8px; border-radius: 4px;
    background: var(--icon-bg);
  }
  .tab.active { color: var(--text-primary); background: var(--glass-card-hover); }
  .font-icon { font-size: 12px !important; }
  .lang-tag {
    font-size: 0.6rem; padding: 1px 6px; border-radius: 4px;
    background: var(--surface-green-subtle); color: var(--color-green);
    font-weight: 600; letter-spacing: 0.05em;
  }
  .code-content {
    margin: 0; padding: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.68rem; line-height: 1.6;
    color: var(--text-secondary); overflow: auto;
  }

  /* ── Tech Stack Marquee ──────────────────────────────────────── */
  .marquee-band {
    position: relative; overflow: hidden;
    padding: 1rem 0;
    border-top: 1px solid var(--glass-separator);
    border-bottom: 1px solid var(--glass-separator);
    background: var(--glass-panel-bg);
    margin: 0;
  }
  .marquee-band::before, .marquee-band::after {
    content: ''; position: absolute; top: 0; bottom: 0; width: 80px; z-index: 10;
    pointer-events: none;
  }
  .marquee-band::before { left: 0; background: linear-gradient(to right, var(--bg-canvas), transparent); }
  .marquee-band::after { right: 0; background: linear-gradient(to left, var(--bg-canvas), transparent); }
  .marquee-track { overflow: hidden; }
  .marquee-inner {
    display: flex; white-space: nowrap; width: max-content;
    animation: scrollMarquee 40s linear infinite;
  }
  @keyframes scrollMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .marquee-item {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.78rem; font-weight: 600; color: var(--text-muted);
    padding: 0 1.5rem; white-space: nowrap;
    transition: color var(--t-fast);
  }
  .marquee-item:hover { color: var(--accent-primary); }
  .marquee-item .material-icons-round { font-size: 15px; color: var(--accent-primary); }
  .marquee-sep { color: var(--glass-panel-border); font-size: 0.8rem; }

  /* ── Section Common Styles ───────────────────────────────────── */
  .section-head { text-align: center; margin-bottom: 3rem; }
  .badge-new {
    font-size: 0.65rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase;
    background: var(--icon-bg); border: 1px solid var(--glass-border);
    padding: 3px 10px; border-radius: 99px;
  }
  .section-eyebrow {
    display: inline-block; font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--accent-primary); margin-bottom: 0.75rem;
    padding: 4px 12px; border-radius: 99px;
    background: var(--icon-bg); border: 1px solid var(--glass-card-border);
  }
  .section-title {
    font-family: var(--font-display); font-size: clamp(1.8rem, 3.5vw, 2.8rem);
    font-weight: 900; letter-spacing: -0.03em;
    color: var(--text-primary); margin: 0 0 0.75rem;
    line-height: 1.15;
  }
  .section-subtitle { font-size: 1rem; color: var(--text-secondary); max-width: 580px; margin: 0 auto; }

  /* ── Features Section ────────────────────────────────────────── */
  .features-section {
    padding: 6rem 0;
    position: relative;
    overflow: hidden;
  }
  .features-section .section-head {
    padding: 0 5%;
  }
  
  .features-scroll-wrapper {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    cursor: grab;
    padding: 1rem 0;
    margin-bottom: 2rem;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
    mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
  }
  .features-scroll-wrapper.dragging .features-card { pointer-events: none; }
  .features-scroll-wrapper:active { cursor: grabbing; }
  .features-scroll-wrapper::-webkit-scrollbar { display: none; }

  .features-grid {
    display: flex; gap: 1.5rem;
    width: max-content;
    padding-bottom: 1rem;
    padding-left: 5vw;
    padding-right: 5vw;
  }
  .features-card {
    min-width: 300px; max-width: 320px; padding: 1.75rem;
    display: flex; flex-direction: column; gap: 1rem;
    flex-shrink: 0;
    background: var(--glass-card-gradient) !important;
  }
  .card-header-flex { display: flex; align-items: center; justify-content: space-between; }
  .icon-wrapper {
    width: 44px; height: 44px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .glass-icon {
    background: var(--icon-bg);
    border: 1px solid var(--glass-card-border);
    color: var(--accent-primary);
  }
  .icon-wrapper .material-icons-round { font-size: 20px; }
  .feature-tag-chip {
    font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--accent-primary);
    background: rgba(255,255,255,0.06); border: 1px solid var(--glass-border);
    padding: 3px 10px; border-radius: 99px;
  }
  .features-card h3 {
    font-family: var(--font-display); font-size: 1.1rem; font-weight: 800;
    color: var(--text-primary); margin: 0; letter-spacing: -0.02em;
  }
  .features-card p {
    font-size: 0.88rem; line-height: 1.65; color: var(--text-landing-secondary);
    margin: 0; flex: 1;
  }
  .features-card p code { font-size: 0.78em; color: var(--accent-primary); background: var(--code-bg); padding: 1px 5px; border-radius: 4px; }
  .card-footer-tech { margin-top: auto; }
  .tech-pill {
    font-size: 0.65rem; color: var(--text-landing-muted);
    background: var(--icon-bg); border: 1px solid var(--glass-separator);
    padding: 3px 10px; border-radius: 99px;
    font-family: monospace;
  }
  .drag-hint { text-align: center; margin-top: 1.25rem; font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; justify-content: center; gap: 4px; }
  .drag-hint .material-icons-round { font-size: 16px; }

  /* ── Tech Section ────────────────────────────────────────────── */
  .tech-section { padding: 6rem 5%; }
  .tech-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: start; max-width: 1400px; margin: 0 auto; }
  .tech-content { display: flex; flex-direction: column; gap: 1.75rem; }
  .tech-content .section-title { margin-bottom: 0; }
  .desc { font-size: 1rem; line-height: 1.7; color: var(--text-secondary); margin: 0; }
  .desc strong { color: var(--text-primary); }
  .performance-indicators { display: flex; flex-direction: column; gap: 1rem; }
  .indicator-row { display: flex; gap: 1rem; align-items: flex-start; }
  .indicator-icon {
    width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--icon-bg); border: 1px solid var(--glass-card-border);
    color: var(--accent-primary);
  }
  .indicator-text h4 { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin: 0 0 3px; }
  .indicator-text p { font-size: 0.85rem; color: var(--text-secondary); margin: 0; }

  .wal-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .wal-stat { padding: 1rem; display: flex; flex-direction: column; gap: 3px; }
  .ws-num { font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; color: var(--accent-primary); letter-spacing: -0.02em; }
  .ws-lbl { font-size: 0.7rem; color: var(--text-muted); }

  .tech-visual { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
  .tv-title { font-family: var(--font-display); font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0; }
  .tv-sub { font-size: 0.85rem; color: var(--text-secondary); margin: 0; }
  .wal-schema { display: flex; flex-direction: column; gap: 0.75rem; }
  .schema-box { padding: 1rem; display: flex; flex-direction: column; gap: 6px; }
  .schema-title { font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); }
  .readers-list { display: flex; flex-wrap: wrap; gap: 5px; }
  .user-pill {
    font-size: 0.68rem; padding: 2px 10px; border-radius: 99px;
    background: var(--code-bg); border: 1px solid var(--glass-card-border);
    color: var(--text-secondary);
  }
  .flow-line { height: 2px; border-radius: 99px; }
  .read-line { background: linear-gradient(90deg, var(--accent-primary), transparent); animation: flowPulse 2s ease-in-out infinite; }
  .write-line { background: linear-gradient(90deg, transparent, #ff6b6b, transparent); animation: flowPulse 1.8s ease-in-out infinite; }
  @keyframes flowPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
  .db-icon { font-size: 24px !important; color: var(--accent-primary); }
  .db-title { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); }
  .db-status { font-size: 0.7rem; color: #00d4aa; font-weight: 600; }
  .db-wal { font-size: 0.65rem; color: var(--text-muted); background: rgba(0,212,170,0.1); border-radius: 4px; padding: 2px 6px; width: fit-content; }
  .operations-stream { display: flex; flex-direction: column; gap: 4px; }
  .operations-stream code { font-family: monospace; font-size: 0.65rem; color: var(--text-landing-muted); background: var(--code-bg); padding: 2px 8px; border-radius: 4px; }

  /* ── Gamification Section ────────────────────────────────────── */
  .gami-section { padding: 6rem 5%; }
  .gami-layout { display: flex; flex-direction: column; gap: 1.25rem; max-width: 1400px; margin: 0 auto; }
  .gami-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
  .gami-feature-card { padding: 1.75rem; display: flex; flex-direction: column; gap: 1rem; }
  .gami-icon-wrap {
    width: 52px; height: 52px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .xp-icon { background: linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.1)); border: 1px solid rgba(251,191,36,0.3); color: #fbbf24; }
  .badge-icon { background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(139,92,246,0.1)); border: 1px solid rgba(168,85,247,0.3); color: #a855f7; }
  .lb-icon { background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.1)); border: 1px solid rgba(59,130,246,0.3); color: var(--accent-primary); }
  .gami-icon-wrap .material-icons-round { font-size: 24px; }
  .gami-feature-card h3 { font-family: var(--font-display); font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin: 0; }
  .gami-feature-card p { font-size: 0.88rem; line-height: 1.65; color: var(--text-secondary); margin: 0; flex: 1; }
  .gami-demo-bar { margin-top: auto; }
  .gami-xp-track { height: 6px; background: var(--glass-panel-bg); border-radius: 99px; overflow: hidden; margin-bottom: 6px; }
  .gami-xp-fill { height: 100%; background: var(--liquid-gradient); border-radius: 99px; transition: width 1s var(--ease-spring); }
  .gami-xp-label { font-size: 0.65rem; color: var(--text-muted); }
  .gami-badges-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; }
  .gbp-badge { font-size: 1.25rem; cursor: default; transition: transform var(--t-fast); }
  .gbp-badge:hover { transform: scale(1.2); }
  .gbp-locked { opacity: 0.3; filter: grayscale(1); }
  .gami-lb-preview { display: flex; flex-direction: column; gap: 4px; margin-top: auto; }
  .glb-row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; background: var(--glass-panel-bg); }
  .glb-rank { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 800; }
  .glb-rank.gold { background: rgba(251,191,36,0.2); color: #fbbf24; }
  .glb-rank.silver { background: rgba(156,163,175,0.2); color: #9ca3af; }
  .glb-rank.bronze { background: rgba(180,120,68,0.2); color: #b47844; }
  .glb-name { flex: 1; font-size: 0.72rem; color: var(--text-secondary); }
  .glb-xp { font-size: 0.65rem; color: var(--accent-primary); font-weight: 600; }
  .gami-cta-card { padding: 2rem; display: flex; flex-direction: row; align-items: center; justify-content: space-between; text-align: left; gap: 1.5rem; }
  .gami-cta-icon { width: 64px; height: 64px; border-radius: 18px; display: flex; align-items: center; justify-content: center; background: var(--liquid-gradient); box-shadow: var(--neon-glow-strong); color: white; flex-shrink: 0; }
  .gami-cta-icon .material-icons-round { font-size: 32px; }
  .gami-cta-content { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
  .gami-cta-content h3 { font-family: var(--font-display); font-size: 1.2rem; font-weight: 800; color: var(--text-primary); margin: 0; }
  .gami-cta-content p { font-size: 0.85rem; color: var(--text-secondary); margin: 0; }
  .gami-cta-actions { display: flex; align-items: center; gap: 1.5rem; flex-shrink: 0; }
  .gami-lb-link { font-size: 0.8rem; color: var(--accent-primary); text-decoration: none; transition: opacity var(--t-fast); }
  .gami-lb-link:hover { opacity: 0.7; }

  /* ── Sandbox Section ─────────────────────────────────────────── */
  .sandbox-section { padding: 6rem 5%; }
  .sandbox-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; max-width: 1400px; margin: 0 auto; }
  .theme-customizer, .live-sandbox { padding: 2rem; display: flex; flex-direction: column; gap: 1.25rem; }
  .card-title { font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; color: var(--text-primary); margin: 0; }
  .card-desc { font-size: 0.88rem; color: var(--text-secondary); margin: 0; }
  .theme-picker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .picker-btn {
    display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem;
    border-radius: 12px; border: 1px solid var(--glass-panel-border);
    background: var(--glass-panel-bg); cursor: pointer;
    transition: all var(--t-fast); text-align: left;
  }
  .picker-btn:hover { background: var(--glass-card-hover); border-color: var(--glass-card-border); }
  .picker-btn.active { border-color: var(--accent-primary); background: var(--glass-card-hover); box-shadow: var(--neon-glow); }
  .liquid-sphere {
    width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
    background: var(--liquid-gradient);
    box-shadow: var(--neon-glow), inset 0 -4px 8px rgba(0,0,0,0.2), inset 3px 3px 6px var(--glass-panel-bg);
  }
  .picker-info strong { display: block; font-size: 0.82rem; color: var(--text-primary); }
  .picker-info span { font-size: 0.7rem; color: var(--text-muted); }
  .sandbox-compose-box {
    display: flex; flex-direction: column; gap: 0.5rem;
    background: var(--code-bg); border: 1px solid var(--glass-panel-border);
    border-radius: var(--radius-lg); padding: 1rem;
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.05);
    transition: border-color var(--t-fast), box-shadow var(--t-fast);
  }
  .sandbox-compose-box:focus-within {
    border-color: var(--accent-primary);
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.05), 0 0 0 1px var(--accent-primary);
  }
  .sandbox-input-row { display: flex; flex-direction: column; }
  .sandbox-textarea {
    width: 100%; padding: 0.5rem 0.5rem; border-radius: 0;
    background: transparent; border: none;
    color: var(--text-primary); font-family: var(--font-sans); font-size: 0.95rem;
    resize: none; outline: none; box-shadow: none;
  }
  .sandbox-textarea::placeholder { color: var(--text-muted); }
  .sandbox-input-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem; padding-top: 0.75rem; border-top: 1px solid var(--glass-separator); }
  .emoji-fast-picker { display: flex; gap: 6px; }
  .emoji-btn {
    font-size: 1.15rem; background: var(--icon-bg); border: 1px solid var(--glass-card-border);
    cursor: pointer; padding: 6px; border-radius: 8px; transition: all var(--t-fast);
    display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;
  }
  .emoji-btn:hover {
    transform: translateY(-2px) scale(1.1); background: var(--glass-card-hover);
    border-color: var(--accent-primary); box-shadow: var(--shadow-sm);
  }
  .sandbox-feed-display { display: flex; flex-direction: column; gap: 1rem; max-height: 280px; overflow-y: auto; padding-right: 4px; }
  .sandbox-post-item {
    padding: 1.15rem; display: flex; flex-direction: column; gap: 12px;
    background: var(--glass-card-gradient);
    border: 1px solid var(--glass-card-border); border-radius: var(--radius-md);
    animation: post-appear 0.4s var(--ease-spring) both;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); transition: transform var(--t-fast), box-shadow var(--t-fast);
  }
  .sandbox-post-item:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), var(--glass-inset-highlight); border-color: var(--glass-panel-border); }
  @keyframes post-appear {
    0% { opacity: 0; transform: translateY(15px) scale(0.98); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  .item-header { display: flex; align-items: center; gap: 12px; }
  .item-avatar {
    width: 38px; height: 38px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 800; color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 0 0 1px var(--glass-panel-border);
  }
  .item-meta { display: flex; flex-direction: column; gap: 2px; }
  .item-meta strong { display: block; font-size: 0.88rem; color: var(--text-primary); letter-spacing: 0.01em; }
  .item-meta span { font-size: 0.72rem; color: var(--text-muted); }
  .item-body { font-size: 0.92rem; color: var(--text-secondary); margin: 0; line-height: 1.6; }

  /* ── Creator Spotlight ───────────────────────────────────────── */
  .creators-spotlight { padding: 6rem 5%; }
  .creators-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; max-width: 1400px; margin: 0 auto; }
  .creator-card { padding: 1.75rem; display: flex; flex-direction: column; gap: 1rem; }
  .creator-header { display: flex; align-items: center; gap: 12px; }
  .creator-avatar {
    width: 52px; height: 52px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700; color: white;
  }
  .creator-meta h3 { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin: 0; }
  .creator-meta span { font-size: 0.72rem; color: var(--text-muted); }
  .status-badge {
    margin-left: auto; display: flex; align-items: center; gap: 5px;
    font-size: 0.65rem; font-weight: 700; padding: 3px 10px;
    border-radius: 99px;
  }
  .status-badge .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .status-badge.live { background: rgba(0,228,100,0.1); border: 1px solid rgba(0,228,100,0.25); color: #00e464; }
  .status-badge.live .dot { background: #00e464; box-shadow: 0 0 6px #00e464; animation: livePulse 1.4s ease-in-out infinite; }
  .status-badge.offline { background: var(--glass-panel-bg); border: 1px solid var(--glass-card-border); color: var(--text-muted); }
  .status-badge.offline .dot { background: var(--text-muted); }
  .creator-bio { font-size: 0.86rem; color: var(--text-secondary); margin: 0; line-height: 1.6; }
  .creator-stats { display: flex; gap: 1rem; }
  .stat { display: flex; flex-direction: column; }
  .stat strong { font-family: var(--font-display); font-size: 1rem; font-weight: 800; color: var(--text-primary); }
  .stat span { font-size: 0.68rem; color: var(--text-muted); }

  /* ── FAQ Section ─────────────────────────────────────────────── */
  .faq-section { padding: 6rem 5%; }
  .faq-list { display: flex; flex-direction: column; gap: 0.6rem; max-width: 800px; margin: 0 auto; }
  .faq-item { overflow: hidden; transition: box-shadow var(--t-base); }
  .faq-item.open { box-shadow: var(--glass-shadow), var(--neon-glow); border-color: var(--glass-panel-border); }
  .faq-question {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    padding: 1.1rem 1.5rem; background: none; border: none;
    color: var(--text-primary); font-size: 0.95rem; font-weight: 600;
    cursor: pointer; text-align: left; gap: 1rem;
    transition: color var(--t-fast);
  }
  .faq-question:hover { color: var(--accent-primary); }
  .faq-item.open .faq-question { color: var(--accent-primary); }
  .chevron { transition: transform var(--t-base); flex-shrink: 0; }
  .faq-item.open .chevron { transform: rotate(180deg); }
  .faq-answer-container { overflow: hidden; }
  .faq-answer { padding: 0 1.5rem 1.25rem; }
  .faq-answer p { font-size: 0.9rem; line-height: 1.7; color: var(--text-secondary); margin: 0; }
  .faq-answer strong { color: var(--text-primary); }
  .faq-answer code { font-family: monospace; font-size: 0.85em; color: var(--accent-primary); background: var(--code-bg); padding: 1px 5px; border-radius: 4px; }

  /* ── Final CTA ───────────────────────────────────────────────── */
  .final-cta-section {
    padding: 6rem 5%; position: relative;
  }
  .cta-aurora { position: absolute; inset: 0; pointer-events: none; filter: blur(120px); opacity: 0.5; }
  .cta-inner {
    position: relative; z-index: 2; max-width: 780px; margin: 0 auto;
    padding: 4rem 3rem; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 1.5rem;
  }
  .cta-badge {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--accent-light); background: var(--icon-bg);
    border: 1px solid var(--glass-card-border); padding: 5px 14px; border-radius: 99px;
  }
  .cta-title {
    font-family: var(--font-display); font-size: clamp(2rem, 4vw, 3.2rem);
    font-weight: 900; letter-spacing: -0.03em; line-height: 1.1;
    color: var(--text-primary); margin: 0;
  }
  .cta-sub { font-size: 1.05rem; color: var(--text-secondary); max-width: 480px; margin: 0; }
  .cta-actions { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; }
  .cta-btn-lg { font-size: 1rem !important; padding: 0.85rem 2rem !important; }

  /* ── Footer ──────────────────────────────────────────────────── */
  .aero-footer {
    padding: 4rem 5% 0;
    border-top: 1px solid var(--glass-separator);
    background: var(--footer-bg);
  }
  .footer-container { display: grid; grid-template-columns: 1.5fr repeat(4, 1fr); gap: 2rem; max-width: 1400px; margin: 0 auto; }
  .footer-brand { display: flex; flex-direction: column; gap: 1rem; }
  .footer-logo { text-decoration: none; }
  .footer-brand p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; margin: 0; }
  .footer-socials { display: flex; gap: 0.75rem; }
  .social-icon {
    width: 36px; height: 36px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    background: var(--icon-bg); border: 1px solid var(--glass-card-border);
    color: var(--text-muted); text-decoration: none;
    transition: all var(--t-fast);
  }
  .social-icon:hover { color: var(--accent-primary); background: var(--glass-card-hover); border-color: var(--glass-panel-border); }
  .footer-links-grid { display: contents; }
  .footer-col { display: flex; flex-direction: column; gap: 0.5rem; }
  .footer-col h4 { font-size: 0.8rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.25rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .footer-col a { font-size: 0.84rem; color: var(--text-muted); text-decoration: none; transition: color var(--t-fast); }
  .footer-col a:hover { color: var(--accent-primary); }
  .footer-bottom { text-align: center; padding: 1.5rem 0; border-top: 1px solid var(--glass-separator); margin-top: 3rem; }
  .footer-bottom p { font-size: 0.78rem; color: var(--text-muted); margin: 0; }

  /* ── LiquidGlass Button System ───────────────────────────────── */
  .btn-liquidglass-wrap { position: relative; display: inline-flex; border-radius: var(--radius-full); }
  .glass-clip-container { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; z-index: 0; }
  .glass-filter { position: absolute; inset: 0; filter: url(#lg-dist); border-radius: inherit; }
  .glass-filter-primary { background: rgba(255,255,255,0.12); }
  .glass-filter-secondary { background: rgba(255,255,255,0.07); }
  .btn-liquidglass-primary, .btn-liquidglass-secondary {
    position: relative; z-index: 1;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 0.7rem 1.4rem; border-radius: var(--radius-full);
    font-size: 0.9rem; font-weight: 700; text-decoration: none;
    white-space: nowrap; cursor: pointer; border: none;
    transition: all var(--t-fast);
  }
  .btn-liquidglass-primary {
    background: linear-gradient(135deg, rgba(27, 133, 243, 0.9), rgba(12, 110, 210, 0.95));
    color: white;
    box-shadow: 0 4px 15px rgba(27, 133, 243, 0.25), 
                0 8px 30px rgba(0,0,0,0.3), 
                inset 0 1px 1px rgba(255,255,255,0.4), 
                inset 0 -2px 4px rgba(0,0,0,0.2);
    border: 1px solid rgba(255,255,255,0.2);
    border-top: 1px solid rgba(255,255,255,0.4);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .btn-liquidglass-primary:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 6px 20px rgba(27, 133, 243, 0.4), 
                0 12px 40px rgba(0,0,0,0.4), 
                inset 0 1px 2px rgba(255,255,255,0.6),
                inset 0 -2px 4px rgba(0,0,0,0.2);
    background: linear-gradient(135deg, rgba(37, 143, 255, 0.95), rgba(17, 120, 220, 1));
  }
  .btn-liquidglass-primary:active { transform: translateY(0) scale(0.98); }
  .btn-liquidglass-secondary {
    background: var(--glass-panel-bg);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm), var(--glass-inset);
    border: 1px solid var(--glass-panel-border);
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  }
  .btn-liquidglass-secondary:hover {
    background: var(--glass-card-hover);
    transform: translateY(-3px) scale(1.02);
    border-color: var(--glass-panel-border);
    box-shadow: var(--shadow-md), var(--glass-inset);
  }
  .btn-liquidglass-primary .material-icons-round,
  .btn-liquidglass-secondary .material-icons-round { font-size: 18px; }
  .w-full { width: 100%; }
  .h-full { height: 100%; }
  .mt-4 { margin-top: 1rem; }

  /* ── Responsive ──────────────────────────────────────────────── */
  @media (min-width: 768px) {
    .nav-links { display: flex; }
  }

  @media (max-width: 1100px) {
    .hero-inner { grid-template-columns: 1fr; }
    .hero-mockup { display: none; }
    .tech-layout { grid-template-columns: 1fr; }
    .gami-cards { grid-template-columns: 1fr 1fr; }
    .footer-container { grid-template-columns: 1fr 1fr; }
  }

  @media (max-width: 768px) {
    .sandbox-layout { grid-template-columns: 1fr; }
    .creators-grid { grid-template-columns: 1fr; }
    .gami-cards { grid-template-columns: 1fr; }
    .gami-cta-card { flex-direction: column; text-align: center; justify-content: center; }
    .gami-cta-actions { flex-direction: column; }
    .wal-stats-row { grid-template-columns: 1fr; }
    .footer-container { grid-template-columns: 1fr 1fr; }
    .hero { padding: 6rem 5% 3rem; }
    .quick-stats { flex-wrap: wrap; }
    .q-stat { min-width: 40%; }
    .cta-inner { padding: 2.5rem 1.5rem; }
  }

  @media (max-width: 480px) {
    .footer-container { grid-template-columns: 1fr; }
    .analytics-grid { grid-template-columns: 1fr 1fr; }
    .creators-grid { grid-template-columns: 1fr; }
  }
</style>
