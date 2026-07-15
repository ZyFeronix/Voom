<script>
  import { fade, slide } from 'svelte/transition';
  import { onMount } from 'svelte';
  
  let isMounted = $state(false);

  onMount(() => {
    isMounted = true;
  });
</script>

<svelte:head>
  <title>Sobre V-SOCIAL - La Red Social del Futuro</title>
</svelte:head>

<div class="about-container" in:fade={{ duration: 600 }}>
  <!-- Hero Section -->
  <section class="hero-section">
    <div class="hero-bg-gradient"></div>
    <div class="hero-content">
      <h1 class="hero-title">
        Bienvenidos a <span class="text-gradient">V-SOCIAL</span>
      </h1>
      <p class="hero-subtitle">
        Más que una red social. Un ecosistema diseñado con rendimiento absoluto y estética inmersiva.
      </p>
    </div>
  </section>

  <!-- Pilares Section -->
  <section class="pillars-section">
    <div class="grid-container">
      {#if isMounted}
        <div class="glass-card pillar-card aero-card" in:slide={{ duration: 500, delay: 100 }}>
          <div class="pillar-icon-wrapper text-emerald-400">
            <span class="material-icons-round">speed</span>
          </div>
          <h2 class="pillar-title">Rendimiento Extremo</h2>
          <p class="pillar-desc">Impulsado por Svelte 5 y SQLite con arquitectura WAL. V-SOCIAL está construido para resistir escala viral sin parpadear. Sin esperas. Sin lag.</p>
        </div>

        <div class="glass-card pillar-card aero-card" in:slide={{ duration: 500, delay: 200 }}>
          <div class="pillar-icon-wrapper text-blue-400">
            <span class="material-icons-round">auto_awesome</span>
          </div>
          <h2 class="pillar-title">Glassmorphism 2.0</h2>
          <p class="pillar-desc">Una experiencia de usuario visceral. Descartamos el minimalismo estéril para abrazar el Neo-Aero: sombras de neón, desenfoques dinámicos y fluidez táctil.</p>
        </div>

        <div class="glass-card pillar-card aero-card" in:slide={{ duration: 500, delay: 300 }}>
          <div class="pillar-icon-wrapper text-rose-400">
            <span class="material-icons-round">shield</span>
          </div>
          <h2 class="pillar-title">Seguridad Criptográfica</h2>
          <p class="pillar-desc">Sin excepciones. Sin compromisos. Arquitectura Zero-Trust, tokens seguros en cookies httpOnly y preparada contra los ataques de inyección más modernos.</p>
        </div>
      {/if}
    </div>
  </section>

  <!-- CTA Section -->
  <section class="cta-section">
    <div class="cta-panel glass-panel aero-card mt-12 relative overflow-hidden">
      <div class="absolute top-0 left-[20%] right-[20%] h-[1px]" style="background: linear-gradient(90deg, transparent, rgba(27, 133, 243, 0.5), transparent);"></div>
      <h2 class="cta-title">Explora nuestra Jerarquía de Verificación</h2>
      <p class="cta-desc text-center">Descubre cómo clasificamos y autenticamos a nuestros miembros más destacados y al equipo oficial.</p>
      <a href="/about/verified" class="btn-aero-primary text-lg px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2" style="box-shadow: var(--neon-primary); border-radius: 14px;">
        <span class="material-icons-round text-lg">verified</span>
        Sistema de Verificación
      </a>
    </div>
  </section>
</div>

<style>
  .about-container {
    padding: 2rem 1rem;
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
    min-height: 100vh;
  }

  /* Hero */
  .hero-section {
    position: relative;
    padding: 6rem 1rem;
    text-align: center;
    border-radius: 32px;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    overflow: hidden;
    margin-bottom: 4rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.08), inset 0 2px 2px rgba(255, 255, 255, 0.5);
    transform: translateZ(0); /* Forzar recorte por hardware */
  }
  :global([data-theme="dark"]) .hero-section {
    background: rgba(15, 20, 25, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), inset 0 2px 2px rgba(255, 255, 255, 0.05);
  }

  .hero-bg-gradient {
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle at center, rgba(27, 133, 243, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(244, 63, 94, 0.1) 0%, transparent 40%);
    animation: rotateGradient 20s linear infinite;
    z-index: 0;
    pointer-events: none;
    filter: blur(60px);
    will-change: transform;
  }

  @keyframes rotateGradient {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .hero-title {
    font-size: clamp(3rem, 6vw, 5rem);
    font-weight: 900;
    font-family: var(--font-display);
    line-height: 1.1;
    margin-bottom: 1.5rem;
    letter-spacing: -0.03em;
    color: var(--text-primary);
  }

  .text-gradient {
    background: linear-gradient(135deg, var(--aero-blue), var(--aero-rose));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    display: inline-block;
  }

  .hero-subtitle {
    font-size: clamp(1.1rem, 2vw, 1.5rem);
    color: var(--text-secondary);
    max-width: 700px;
    margin: 0 auto;
    line-height: 1.6;
  }

  /* Pillars */
  .grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-bottom: 4rem;
  }

  .pillar-card {
    padding: 2.5rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
  }

  .pillar-card:hover {
    transform: translateY(-10px);
    box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1);
  }

  .pillar-icon-wrapper {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.02);
  }

  .pillar-icon-wrapper span {
    font-size: 32px;
  }

  .pillar-title {
    font-size: 1.5rem;
    font-weight: 800;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }

  .pillar-desc {
    font-size: 1rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  /* CTA */
  .cta-panel {
    padding: 4rem 2rem;
    border-radius: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(27, 133, 243, 0.05) 0%, rgba(255, 255, 255, 0.5) 100%);
    border: 1px solid rgba(27, 133, 243, 0.25);
    box-shadow: 0 20px 50px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5), 0 0 40px rgba(27, 133, 243, 0.1);
  }
  :global([data-theme="dark"]) .cta-panel {
    background: linear-gradient(135deg, rgba(27, 133, 243, 0.08) 0%, rgba(10, 14, 20, 0.7) 100%);
    box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 40px rgba(27, 133, 243, 0.05);
  }

  .cta-title {
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 1rem;
    color: var(--text-primary);
    text-align: center;
  }

  .cta-desc {
    font-size: 1.1rem;
    color: var(--text-secondary);
    max-width: 600px;
    margin-bottom: 2.5rem;
  }
</style>
