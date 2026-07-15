<script>
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  
  let deferredPrompt = $state(null);
  let showPrompt = $state(false);
  let userDismissed = $state(false);

  onMount(() => {
    // Escuchar el evento que indica que la PWA se puede instalar
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevenir que el mini-infobar de Chrome aparezca en mobile automáticamente
      e.preventDefault();
      
      // Guardar el evento para dispararlo cuando el usuario haga click en el botón
      deferredPrompt = e;
      
      // Mostrar nuestro propio UI de instalación si el usuario no lo ha descartado
      const dismissed = localStorage.getItem('vsocial_pwa_dismissed');
      if (!dismissed) {
        showPrompt = true;
      }
    });
    
    // Si ya fue instalada
    window.addEventListener('appinstalled', () => {
      showPrompt = false;
      deferredPrompt = null;
    });
  });

  async function handleInstall() {
    if (!deferredPrompt) return;
    
    // Mostrar el prompt nativo
    deferredPrompt.prompt();
    
    // Esperar a ver qué responde el usuario
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('El usuario aceptó instalar la PWA');
      showPrompt = false;
    } else {
      console.log('El usuario descartó la instalación de la PWA');
      handleDismiss();
    }
    
    deferredPrompt = null;
  }

  function handleDismiss() {
    showPrompt = false;
    userDismissed = true;
    localStorage.setItem('vsocial_pwa_dismissed', 'true');
  }
</script>

{#if showPrompt && !userDismissed}
  <div class="pwa-banner-wrapper" transition:fly={{ y: -50, duration: 400 }}>
    <div class="glass-panel pwa-banner">
      <div class="flex items-center gap-4 flex-1 min-w-0">
        <div class="pwa-icon">
          <img src="/logo.svg" alt="V-SOCIAL Logo" class="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(27,133,243,0.5)]" />
        </div>
        <div class="flex flex-col min-w-0">
          <span class="font-bold text-[var(--text-main)] text-sm md:text-base leading-tight truncate">Instalar V-SOCIAL</span>
          <span class="text-xs text-[var(--text-muted)] truncate">La experiencia completa en tu pantalla de inicio</span>
        </div>
      </div>
      
      <div class="flex items-center gap-2 flex-shrink-0 ml-4">
        <button class="btn-cancel" onclick={handleDismiss} aria-label="Cerrar">
          <span class="material-icons-round text-[20px]">close</span>
        </button>
        <button class="btn-aero-primary px-4 py-2 text-sm font-bold shadow-[0_0_15px_rgba(27,133,243,0.3)]" onclick={handleInstall}>
          Instalar
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .pwa-banner-wrapper {
    position: fixed;
    top: 16px;
    left: 16px;
    right: 16px;
    z-index: 1000;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .pwa-banner {
    pointer-events: auto;
    width: 100%;
    max-width: 600px;
    padding: 12px 16px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1);
    background: rgba(15, 23, 42, 0.85); /* fallback */
    background: var(--bg-surface);
    border: 1px solid var(--glass-highlight);
    border-top-color: var(--primary-color, #1b85f3);
    border-top-width: 3px;
  }

  .pwa-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--bg-canvas);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--glass-border);
    flex-shrink: 0;
  }

  .btn-cancel {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--text-muted);
    transition: all 0.2s;
  }
  
  .btn-cancel:hover {
    background: rgba(255,255,255,0.1);
    color: var(--text-main);
  }
</style>
