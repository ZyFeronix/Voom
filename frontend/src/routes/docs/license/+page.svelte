<script>
  import { fade, slide } from 'svelte/transition';
  import { onMount } from 'svelte';
  
  let isMounted = $state(false);
  let licenseText = $state('');

  onMount(async () => {
    isMounted = true;
    try {
      const res = await fetch('/LICENSE.txt');
      if (res.ok) {
        licenseText = await res.text();
      } else {
        licenseText = 'No se pudo cargar el archivo de licencia.';
      }
    } catch (e) {
      licenseText = 'Error al cargar la licencia.';
    }
  });
</script>

<svelte:head>
  <title>Licencia y Protección - V-SOCIAL</title>
</svelte:head>

<div class="license-container" in:fade={{ duration: 600 }}>
  <!-- Hero Section -->
  <section class="hero-section">
    <div class="hero-bg-gradient"></div>
    <div class="hero-content">
      <h1 class="hero-title">
        Licencia y <span class="text-gradient">Protección Legal</span>
      </h1>
      <p class="hero-subtitle">
        Acuerdo de usuario, términos de uso de V-SOCIAL y protecciones anti-clonación.
      </p>
    </div>
  </section>

  <!-- Content Section -->
  <section class="content-section">
    <div class="grid-container">
      {#if isMounted}
        <!-- GPLv3 Card -->
        <div class="glass-card aero-card flex-col" in:slide={{ duration: 500, delay: 100 }}>
          <div class="icon-wrapper text-blue-400">
            <span class="material-icons-round">gavel</span>
          </div>
          <h2 class="section-title">Licencia GNU GPLv3</h2>
          <div class="legal-text">
            <p>V-SOCIAL es software libre bajo la Licencia Pública General de GNU (GPLv3). Esto garantiza libertades esenciales, pero impone obligaciones estrictas:</p>
            <ul>
              <li><strong>Código Abierto:</strong> Si distribuyes o modificas esta plataforma, debes compartir el código fuente resultante bajo la misma licencia.</li>
              <li><strong>Sin Garantía:</strong> El software se proporciona "tal cual", sin ninguna garantía implícita o explícita.</li>
              <li><strong>Reconocimiento:</strong> Se debe mantener la atribución a los autores originales en todas las copias y derivados.</li>
            </ul>
            <p class="mt-4"><span class="neon-link" style="cursor: default">Texto completo de la Licencia GPLv3 &darr;</span></p>
            
            {#if licenseText}
              <div class="license-box">
                <pre><code>{licenseText}</code></pre>
              </div>
            {:else}
              <div class="license-box loading-pulse">
                Cargando licencia...
              </div>
            {/if}
          </div>
        </div>

        <!-- Protection Card -->
        <div class="glass-card aero-card flex-col" in:slide={{ duration: 500, delay: 200 }}>
          <div class="icon-wrapper text-emerald-400">
            <span class="material-icons-round">security</span>
          </div>
          <h2 class="section-title">Protección Anti-Clonación (IP)</h2>
          <div class="legal-text">
            <p>Más allá de la lógica de negocio cubierta por GPLv3, la <strong>identidad visual, la marca y el sistema de diseño (Glassmorphism 2.0 / Neo-Aero)</strong> son propiedad intelectual exclusiva de V-SOCIAL.</p>
            <ul>
              <li><strong>Identidad de Marca:</strong> No se permite el uso del nombre "V-SOCIAL", los logotipos, la tipografía distintiva ni el esquema de colores para engañar a usuarios o hacerse pasar por la plataforma oficial.</li>
              <li><strong>Protección de Interfaz (Look & Feel):</strong> El clonado exacto de la interfaz de usuario con fines comerciales competidores está estrictamente prohibido sin autorización.</li>
              <li><strong>Rate Limiting & Anti-Scraping:</strong> La infraestructura incluye protecciones activas. El scraping automatizado o la ingeniería inversa de los algoritmos de feeds privados se considerará un abuso de los términos de servicio.</li>
            </ul>
          </div>
        </div>
        
        <!-- Terms Card -->
        <div class="glass-card aero-card flex-col" in:slide={{ duration: 500, delay: 300 }}>
          <div class="icon-wrapper text-purple-400">
            <span class="material-icons-round">policy</span>
          </div>
          <h2 class="section-title">Términos de Servicio (SLA)</h2>
          <div class="legal-text">
            <p>Al utilizar o alojar una instancia de V-SOCIAL, te comprometes a seguir los estándares de ingeniería y respeto al usuario (<em>Anti-Caja Negra</em>).</p>
            <ul>
              <li><strong>Privacidad del Usuario:</strong> Los feeds de Radar y Descubrimiento no deben ser manipulados con algoritmos ocultos.</li>
              <li><strong>Uso Responsable:</strong> Queda prohibido el uso de la plataforma para distribuir malware, contenido ilícito o esquemas de fraude.</li>
            </ul>
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>

<style>
  /* Base Container */
  .license-container {
    min-height: 100vh;
    padding-bottom: 4rem;
    overflow-x: hidden;
  }

  /* Hero Section */
  .hero-section {
    position: relative;
    padding: 6rem 2rem 4rem;
    text-align: center;
    overflow: hidden;
  }

  .hero-bg-gradient {
    position: absolute;
    top: -50%;
    left: -20%;
    width: 140%;
    height: 200%;
    background: radial-gradient(circle at 50% 50%, rgba(27, 133, 243, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.1) 0%, transparent 40%);
    z-index: -1;
    pointer-events: none;
    animation: slow-pulse 10s ease-in-out infinite alternate;
  }

  @keyframes slow-pulse {
    0% { transform: scale(1) translate(0, 0); }
    100% { transform: scale(1.1) translate(-2%, 2%); }
  }

  .hero-title {
    font-size: 3rem;
    font-weight: 800;
    letter-spacing: -0.05em;
    margin-bottom: 1rem;
    color: #fff;
    text-shadow: 0 4px 20px rgba(0,0,0,0.5);
  }

  .text-gradient {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: none;
    position: relative;
  }

  .text-gradient::after {
    content: '';
    position: absolute;
    inset: 0;
    background: inherit;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 15px rgba(0, 242, 254, 0.2));
    z-index: -1;
  }

  .hero-subtitle {
    font-size: 1.2rem;
    color: var(--text-muted, #94a3b8);
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.6;
  }

  /* Content Section */
  .content-section {
    padding: 2rem;
    max-width: 1000px;
    margin: 0 auto;
  }

  .grid-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* Cards */
  .flex-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 2.5rem;
  }

  .icon-wrapper {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    box-shadow: inset 0 2px 10px rgba(255, 255, 255, 0.05);
  }

  .icon-wrapper .material-icons-round {
    font-size: 32px;
  }

  .section-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 1rem;
    letter-spacing: -0.02em;
  }

  .legal-text {
    color: #cbd5e1;
    font-size: 1.05rem;
    line-height: 1.7;
    width: 100%;
  }

  .legal-text p {
    margin-bottom: 1rem;
  }

  .legal-text ul {
    list-style-type: none;
    padding-left: 0;
    margin-top: 1rem;
  }

  .legal-text li {
    margin-bottom: 1rem;
    position: relative;
    padding-left: 1.5rem;
  }

  .legal-text li::before {
    content: '•';
    position: absolute;
    left: 0;
    color: #00f2fe;
    font-weight: bold;
    font-size: 1.2rem;
  }

  .legal-text strong {
    color: #fff;
    font-weight: 600;
  }

  .neon-link {
    color: #00f2fe;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    display: inline-block;
  }

  .neon-link:hover {
    text-shadow: 0 0 15px rgba(0, 242, 254, 0.4);
    transform: translateX(4px);
  }

  .license-box {
    margin-top: 1.5rem;
    background-color: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    max-height: 400px;
    overflow-y: auto;
    width: 100%;
    box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
  }

  .license-box pre {
    margin: 0;
  }

  .license-box code {
    font-family: 'Fira Code', 'Courier New', Courier, monospace;
    font-size: 0.85rem;
    color: #a8b2d1;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
  }

  .loading-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    text-align: center;
    color: #64748b;
    padding: 2rem;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @media (max-width: 768px) {
    .hero-title {
      font-size: 2.2rem;
    }
    
    .flex-col {
      padding: 1.5rem;
    }
  }
</style>
