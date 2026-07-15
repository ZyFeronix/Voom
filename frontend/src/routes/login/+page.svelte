<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { authStore } from '$lib/stores/auth.svelte.js';
  import { themeStore, toggleTheme } from '$lib/stores/theme.svelte.js';

  // ── State ────────────────────────────────────────────────────────────────
  let identifier = $state('');
  let password   = $state('');
  let rememberMe = $state(false);
  let showPass   = $state(false);
  let loading    = $state(false);
  let error      = $state('');
  let mounted    = $state(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  let canSubmit = $derived(identifier.trim().length > 0 && password.length >= 1);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  $effect(() => {
    if (mounted && authStore.user) {
      goto('/feed');
    }
  });

  let particles = $state([]);

  onMount(() => {
    mounted = true;
    particles = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 25 + 10,
      delay: Math.random() * 4,
      duration: Math.random() * 8 + 8,
    }));
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();
    if (!canSubmit || loading) return;

    error   = '';
    loading = true;

    try {
      await authStore.login(identifier.trim(), password);
      goto('/feed');
    } catch (err) {
      error = err?.message ?? 'Error al iniciar sesión. Inténtalo de nuevo.';
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && canSubmit) handleLogin(e);
  }
</script>

<svelte:head>
  <title>Iniciar sesión — VSocial</title>
  <meta name="description" content="Inicia sesión en VSocial, la plataforma premium para creadores virtuales." />
  <meta property="og:title" content="Iniciar sesión — VSocial" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link href="https://fonts.googleapis.com/css2?family=Material+Icons+Round" rel="stylesheet" />
</svelte:head>

<div class="login-container min-h-screen w-full flex relative overflow-hidden" in:fade={{ duration: 600 }}>
  
  <!-- Theme Toggle -->
  <button onclick={toggleTheme} class="theme-toggle" title="Cambiar tema">
    <span class="material-icons-round">
      {themeStore.value === 'dark' ? 'light_mode' : 'dark_mode'}
    </span>
  </button>

  <!-- Bubbles/Orbs Background -->
  <div class="absolute inset-0 z-0 overflow-hidden pointer-events-none">
    {#each particles as p (p.id)}
      <div
        class="bubble"
        style="
          left: {p.x}%;
          top: {p.y}%;
          width: {p.size}px;
          height: {p.size}px;
          animation-delay: -{p.delay}s;
          animation-duration: {p.duration}s;
        "
      ></div>
    {/each}
  </div>

  <!-- Left Brand Panel -->
  <aside class="hidden lg:flex lg:w-[50%] relative flex-col items-center justify-center p-12 z-10" in:fly={{ y: 20, duration: 800, delay: 200 }}>
    <div class="glass-panel p-8 max-w-md text-center flex flex-col items-center gap-6 animate-float">
      <div class="aero-logo">
        <span class="logo-text">VS</span>
      </div>

      <div>
        <h1 class="title-display text-2xl font-black text-gradient mb-2">VSocial</h1>
        <p class="text-sm text-muted leading-relaxed">
          El universo donde los creadores virtuales conectan, comparten y prosperan bajo un entorno cristalino y fluido.
        </p>
      </div>

      <!-- Features checklist -->
      <div class="flex flex-col gap-3 w-full text-left">
        {#each [
          { icon: 'water_drop', label: 'Estética Frutiger Aero pura y fluida' },
          { icon: 'chat', label: 'Mensajería instantánea en tiempo real' },
          { icon: 'storefront', label: 'Marketplace de recursos digitales' },
        ] as item}
          <div class="feature-item">
            <span class="material-icons-round feature-icon">{item.icon}</span>
            <span class="text-xs font-semibold text-main">{item.label}</span>
          </div>
        {/each}
      </div>
    </div>
  </aside>

  <!-- Right Form Panel -->
  <main class="w-full lg:w-[50%] flex items-center justify-center p-6 sm:p-12 z-10 relative" in:fly={{ y: 20, duration: 800, delay: 300 }}>
    <div class="auth-card max-w-md w-full">
    
    <!-- Mobile logo header -->
    <div class="lg:hidden flex items-center gap-2 mb-6">
      <div class="aero-logo" style="width: 32px; height: 32px; border-radius: 8px;">
        <span class="logo-text" style="font-size: 14px;">VS</span>
      </div>
      <span class="text-xl title-display font-black text-gradient">VSocial</span>
    </div>

    <!-- Form card -->
    <div class="w-full max-w-md {mounted ? 'visible' : 'hidden-state'} transition-all duration-500">
      <div class="glass-panel p-8">
        
        <div class="mb-6">
          <h2 class="text-2xl font-black text-main title-display mb-1">
            Bienvenido
          </h2>
          <p class="text-xs text-muted">
            ¿Aún no tienes cuenta?
            <a href="/register" class="text-link font-bold">Regístrate gratis</a>
          </p>
        </div>

        <!-- Error banner -->
        {#if error}
          <div class="flex items-start gap-2 p-3 mb-4 rounded-xl error-banner">
            <span class="material-icons-round text-sm shrink-0">error_outline</span>
            <p class="text-xs leading-relaxed font-semibold">{error}</p>
          </div>
        {/if}

        <!-- Form -->
        <form onsubmit={handleLogin} class="flex flex-col gap-4">
          
          <!-- Username / Email -->
          <div class="flex flex-col gap-1.5">
            <label for="identifier" class="text-xs font-bold text-muted">Usuario o correo electrónico</label>
            <div class="relative" style="position: relative;">
              <span class="material-icons-round text-[18px] text-muted" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); z-index: 2; pointer-events: none;">person</span>
              <input
                id="identifier"
                type="text"
                autocomplete="username"
                placeholder="tu_usuario o correo@ejemplo.com"
                bind:value={identifier}
                onkeydown={handleKeydown}
                class="aero-input w-full"
                style="padding-left: 38px;"
              />
            </div>
          </div>

          <!-- Password -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label for="password" class="text-xs font-bold text-muted">Contraseña</label>
            </div>
            <div class="relative" style="position: relative;">
              <span class="material-icons-round text-[18px] text-muted" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); z-index: 2; pointer-events: none;">lock</span>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                autocomplete="current-password"
                placeholder="Tu contraseña segura"
                bind:value={password}
                onkeydown={handleKeydown}
                class="aero-input w-full"
                style="padding-left: 38px; padding-right: 38px;"
              />
              <button
                type="button"
                onclick={() => (showPass = !showPass)}
                class="pass-toggle"
                style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; z-index: 2;"
                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <span class="material-icons-round text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <!-- Submit button -->
          <button
            type="submit"
            disabled={!canSubmit || loading}
            class="btn-aero-primary w-full mt-2"
          >
            {#if loading}
              <span class="material-icons-round animate-spin text-[18px]">refresh</span>
              Iniciando sesión...
            {:else}
              <span class="material-icons-round text-[18px]">water_drop</span>
              Entrar al Canal
            {/if}
          </button>
        </form>

        <!-- Footer terms -->
        <p class="text-center text-[10px] text-muted mt-6">
          Al iniciar sesión aceptas nuestros
          <a href="/" class="text-link">Términos</a> y
          <a href="/" class="text-link">Privacidad</a>
        </p>

      </div>
    </div>
    </div>
  </main>

</div>

<style>
  .login-container {
    background: var(--login-bg);
    min-height: 100vh;
    transition: background 0.4s ease;
  }

  /* Theme toggle floating button */
  .theme-toggle {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--toggle-bg);
    border: 1px solid var(--toggle-border);
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.3s;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .theme-toggle:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 119, 255, 0.25);
  }

  .bubble {
    position: absolute;
    background: var(--bubble-bg);
    border: 1px solid var(--bubble-border);
    box-shadow: var(--bubble-shadow);
    border-radius: 50%;
    animation: float-bubble 12s linear infinite;
    pointer-events: none;
    z-index: 0;
  }

  @keyframes float-bubble {
    0% { transform: translateY(100vh) scale(0.8); opacity: 0; }
    10% { opacity: 0.6; }
    90% { opacity: 0.6; }
    100% { transform: translateY(-20vh) scale(1.2); opacity: 0; }
  }

  .aero-logo {
    width: 64px; height: 64px;
    border-radius: 20px;
    background: linear-gradient(135deg, var(--color-aero-cyan), var(--color-aero-blue));
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 2px 4px rgba(255,255,255,0.4), 0 8px 20px rgba(0, 119, 255, 0.25);
  }

  .logo-text {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 24px;
    color: white;
  }

  .text-main {
    color: var(--text-main);
  }

  .text-link {
    color: var(--color-aero-blue);
    text-decoration: none;
    transition: var(--transition-smooth);
  }
  .text-link:hover {
    color: var(--color-aero-cyan);
    text-decoration: underline;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--feature-bg);
    border: 1px solid var(--feature-border);
    border-radius: 0.75rem;
  }
  .feature-icon {
    color: var(--color-aero-cyan);
  }

  .pass-toggle {
    color: var(--text-muted);
  }
  .pass-toggle:hover {
    color: var(--color-aero-cyan);
  }

  .error-banner {
    background: rgba(255, 0, 110, 0.1);
    border: 1px solid rgba(255, 0, 110, 0.25);
    color: #FF006E;
  }

  .hidden-state {
    opacity: 0;
    transform: translateY(15px);
  }
  .visible {
    opacity: 1;
    transform: translateY(0);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  /* =========================================================
     Theme Configuration
     ========================================================= */
  .login-container {
    background: var(--bg-canvas);
  }

  .theme-toggle {
    background: var(--bg-surface);
    border: 1px solid var(--border-glass);
  }

  .bubble {
    background: var(--grad-primary);
    opacity: 0.15;
    border: 1px solid var(--border-glass);
    box-shadow: var(--shadow-md), var(--glass-inset);
  }

  .feature-item {
    background: var(--bg-overlay);
    border: 1px solid var(--border-glass);
  }
</style>
