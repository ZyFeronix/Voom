<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import PasswordMeter from '$lib/components/PasswordMeter.svelte';

  let step = $state(1);
  let loading = $state(false);
  let error = $state('');
  let mounted = $state(false);
  let particles = $state([]);

  // Step 1: Welcome
  let agreed = $state(false);

  // Step 2: Site Config
  let siteName = $state('VSocial');
  let allowRegistration = $state(true);
  let defaultTheme = $state('dark');

  // Step 3: Admin Account
  let adminUsername = $state('admin');
  let adminEmail = $state('');
  let adminPassword = $state('');
  let confirmPassword = $state('');

  // Step 4: Success
  let setupComplete = $state(false);

  const step3Valid = $derived(
    adminUsername.trim().length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) &&
    adminPassword.length >= 8 &&
    adminPassword === confirmPassword
  );

  const canProceed = $derived(
    step === 1 ? agreed :
    step === 2 ? siteName.trim().length >= 2 :
    step === 3 ? step3Valid : false
  );

  onMount(() => {
    mounted = true;
    particles = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 20 + 8,
      delay: Math.random() * 5,
      duration: Math.random() * 10 + 8
    }));
  });

  function nextStep() {
    if (step < 4 && canProceed) step++;
  }
  function prevStep() {
    if (step > 1) step--;
  }

  async function runSetup() {
    if (!step3Valid || loading) return;
    loading = true;
    error = '';

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_name: siteName.trim(),
          admin_username: adminUsername.trim(),
          admin_email: adminEmail.trim(),
          admin_password: adminPassword,
          allow_registration: allowRegistration,
          theme: defaultTheme,
          language: 'es'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error desconocido');

      setupComplete = true;
      step = 4;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Setup Wizard — VSocial</title>
</svelte:head>

<div class="setup-container">
  <!-- Ambient particles -->
  <div class="particles-layer">
    {#each particles as p (p.id)}
      <div class="particle" style="left:{p.x}%;top:{p.y}%;width:{p.size}px;height:{p.size}px;animation-delay:-{p.delay}s;animation-duration:{p.duration}s;"></div>
    {/each}
  </div>

  <div class="setup-card glass-panel {mounted ? 'visible' : 'hidden-state'}">
    <!-- Progress bar -->
    <div class="progress-bar">
      {#each [1,2,3,4] as s}
        <div class="progress-segment {step >= s ? 'active' : ''} {step > s ? 'done' : ''}">
          <span class="progress-num">{step > s ? '✓' : s}</span>
        </div>
        {#if s < 4}
          <div class="progress-line {step > s ? 'active' : ''}"></div>
        {/if}
      {/each}
    </div>

    <!-- Step 1: Welcome -->
    {#if step === 1}
      <div class="step-content animate-fade-in">
        <div class="step-icon">🚀</div>
        <h1 class="step-title">Bienvenido al Setup</h1>
        <p class="step-desc">Este asistente configurará tu plataforma VSocial en 4 pasos simples. Se creará tu cuenta de Super Administrador y los parámetros base del sistema.</p>

        <div class="info-box">
          <span class="material-icons-round">info</span>
          <span>Este wizard solo aparece cuando no existen usuarios en el sistema. Una vez completado, no volverá a mostrarse.</span>
        </div>

        <label class="agree-check">
          <input type="checkbox" bind:checked={agreed} class="aero-checkbox" />
          <span>Entiendo que esto creará la configuración inicial de la plataforma.</span>
        </label>
      </div>

    <!-- Step 2: Site Config -->
    {:else if step === 2}
      <div class="step-content animate-fade-in">
        <div class="step-icon">⚙️</div>
        <h1 class="step-title">Configuración del Sitio</h1>
        <p class="step-desc">Define los parámetros globales de tu plataforma.</p>

        <div class="form-group">
          <label for="siteName">Nombre de la Plataforma</label>
          <input id="siteName" type="text" bind:value={siteName} class="aero-input w-full" placeholder="Mi Red Social" />
        </div>

        <div class="form-group">
          <span class="form-group-label">Tema por Defecto</span>
          <div class="theme-options">
            <button class="theme-opt {defaultTheme === 'dark' ? 'selected' : ''}" onclick={() => defaultTheme = 'dark'}>
              <span class="material-icons-round">dark_mode</span> Oscuro
            </button>
            <button class="theme-opt {defaultTheme === 'light' ? 'selected' : ''}" onclick={() => defaultTheme = 'light'}>
              <span class="material-icons-round">light_mode</span> Claro
            </button>
          </div>
        </div>

        <label class="agree-check">
          <input type="checkbox" bind:checked={allowRegistration} class="aero-checkbox" />
          <span>Permitir registro público de usuarios</span>
        </label>
      </div>

    <!-- Step 3: Admin Account -->
    {:else if step === 3}
      <div class="step-content animate-fade-in">
        <div class="step-icon">👑</div>
        <h1 class="step-title">Cuenta Super Admin</h1>
        <p class="step-desc">Crea la cuenta maestra con acceso total al sistema.</p>

        {#if error}
          <div class="error-box">
            <span class="material-icons-round">error_outline</span>
            <span>{error}</span>
          </div>
        {/if}

        <div class="form-group">
          <label for="adminUser">Nombre de Usuario</label>
          <input id="adminUser" type="text" bind:value={adminUsername} class="aero-input w-full" placeholder="admin" />
        </div>

        <div class="form-group">
          <label for="adminEmail">Correo Electrónico</label>
          <input id="adminEmail" type="email" bind:value={adminEmail} class="aero-input w-full" placeholder="admin@misitio.com" />
        </div>

        <div class="form-group">
          <label for="adminPass">Contraseña</label>
          <input id="adminPass" type="password" bind:value={adminPassword} class="aero-input w-full" placeholder="Mínimo 8 caracteres" />
          <PasswordMeter password={adminPassword} />
        </div>

        <div class="form-group">
          <label for="confirmPass">Confirmar Contraseña</label>
          <input id="confirmPass" type="password" bind:value={confirmPassword} class="aero-input w-full" placeholder="Repite la contraseña" />
          {#if confirmPassword && adminPassword !== confirmPassword}
            <p class="field-error">Las contraseñas no coinciden.</p>
          {/if}
        </div>
      </div>

    <!-- Step 4: Success -->
    {:else if step === 4}
      <div class="step-content animate-fade-in text-center">
        <div class="success-icon">✅</div>
        <h1 class="step-title">¡Setup Completado!</h1>
        <p class="step-desc">VSocial está listo. Tu cuenta <strong>@{adminUsername}</strong> tiene privilegios de Super Administrador.</p>

        <div class="info-box success-info">
          <span class="material-icons-round">check_circle</span>
          <span>Se han creado las categorías del marketplace y los ajustes por defecto.</span>
        </div>

        <a href="/login" class="btn-aero-primary w-full" style="text-decoration:none;margin-top:16px;">
          <span class="material-icons-round">login</span>
          Iniciar Sesión
        </a>
      </div>
    {/if}

    <!-- Navigation buttons -->
    {#if step < 4}
      <div class="step-nav">
        {#if step > 1}
          <button class="btn-aero-secondary" onclick={prevStep}>
            <span class="material-icons-round">arrow_back</span> Atrás
          </button>
        {/if}
        <div style="flex:1"></div>
        {#if step < 3}
          <button class="btn-aero-primary" onclick={nextStep} disabled={!canProceed}>
            Siguiente <span class="material-icons-round">arrow_forward</span>
          </button>
        {:else if step === 3}
          <button class="btn-aero-primary" onclick={runSetup} disabled={!canProceed || loading}>
            {#if loading}
              <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;"></span> Configurando...
            {:else}
              <span class="material-icons-round">rocket_launch</span> Instalar VSocial
            {/if}
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .setup-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    position: relative;
    overflow: hidden;
    background: var(--bg-canvas);
  }

  .particles-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .particle {
    position: absolute;
    border-radius: 50%;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    animation: float-up 12s linear infinite;
    opacity: 0.5;
  }

  @keyframes float-up {
    0% { transform: translateY(100vh) scale(0.8); opacity: 0; }
    10% { opacity: 0.5; }
    90% { opacity: 0.5; }
    100% { transform: translateY(-20vh) scale(1.2); opacity: 0; }
  }

  .setup-card {
    width: 100%;
    max-width: 520px;
    padding: 32px;
    position: relative;
    z-index: 10;
    transition: opacity 0.5s ease, transform 0.5s ease;
  }

  .hidden-state { opacity: 0; transform: translateY(20px); }
  .visible { opacity: 1; transform: translateY(0); }

  /* Progress bar */
  .progress-bar {
    display: flex;
    align-items: center;
    margin-bottom: 28px;
  }

  .progress-segment {
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 800;
    background: var(--bg-surface2);
    color: var(--text-muted);
    border: 2px solid var(--border-subtle);
    transition: all 0.4s ease;
    flex-shrink: 0;
  }

  .progress-segment.active {
    background: var(--grad-primary);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 4px 14px rgba(46,134,232,0.3);
  }

  .progress-segment.done {
    background: var(--aero-mint);
    color: #fff;
    border-color: transparent;
  }

  .progress-line {
    flex: 1;
    height: 2px;
    background: var(--border-subtle);
    margin: 0 4px;
    transition: background 0.4s ease;
  }

  .progress-line.active {
    background: var(--aero-mint);
  }

  /* Step content */
  .step-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .step-icon {
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 4px;
  }

  .step-title {
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 900;
    color: var(--text-primary);
    text-align: center;
    margin: 0;
  }

  .step-desc {
    font-size: 0.85rem;
    color: var(--text-secondary);
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }

  .text-center { text-align: center; }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-box {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(46, 134, 232, 0.06);
    border: 1px solid rgba(46, 134, 232, 0.15);
    border-radius: var(--radius-md);
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .info-box .material-icons-round {
    color: var(--aero-blue);
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .success-info {
    background: rgba(61, 199, 154, 0.08);
    border-color: rgba(61, 199, 154, 0.2);
  }

  .success-info .material-icons-round {
    color: var(--aero-mint);
  }

  .error-box {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(255, 23, 68, 0.08);
    border: 1px solid rgba(255, 23, 68, 0.2);
    border-radius: var(--radius-md);
    font-size: 0.8rem;
    color: #FF1744;
    font-weight: 600;
  }

  .agree-check {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .agree-check input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--aero-blue);
    cursor: pointer;
  }

  .theme-options {
    display: flex;
    gap: 10px;
  }

  .theme-opt {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }

  .theme-opt.selected {
    border-color: var(--aero-blue);
    color: var(--aero-blue);
    background: rgba(46, 134, 232, 0.08);
    box-shadow: 0 2px 8px rgba(46, 134, 232, 0.15);
  }

  .field-error {
    font-size: 0.7rem;
    color: #FF1744;
    font-weight: 700;
    margin: 2px 0 0;
  }

  .success-icon {
    font-size: 3.5rem;
    margin-bottom: 8px;
  }

  .step-nav {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--border-subtle);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-spinner {
    display: inline-block;
    border: 3px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }
</style>
