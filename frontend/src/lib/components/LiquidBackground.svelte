<div class="aero-bg-wrapper">
  <!-- Base de gradientes líquidos (GPU Accelerated) -->
  <div class="aurora-blobs">
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>
  </div>
</div>

<style>
  .aero-bg-wrapper {
    position: fixed;
    inset: 0;
    z-index: -10;
    overflow: hidden;
    pointer-events: none;
    contain: strict;
    /* El fondo base ahora es heredado del body (--bg-canvas) para respetar Light/Dark mode */
    background: transparent;
  }

  /* Rayos de luz crepusculares (God Rays submarinos) */
  .aero-bg-wrapper::after {
    content: '';
    position: absolute;
    inset: -30%;
    /* Conic gradient que nace desde arriba del viewport para simular luz penetrando el agua */
    background: conic-gradient(
      from 140deg at 50% -10%,
      transparent 0deg,
      rgba(0, 229, 255, 0.04) 20deg,
      transparent 35deg,
      rgba(0, 180, 255, 0.02) 45deg,
      transparent 55deg,
      rgba(0, 229, 255, 0.05) 65deg,
      transparent 80deg
    );
    filter: blur(20px);
    mix-blend-mode: screen;
    transform-origin: 50% 0%;
    /* Animación de oscilación suave como el agua */
    animation: swayRays 18s ease-in-out infinite alternate;
  }

  @keyframes swayRays {
    0% { transform: scale(1.1) rotate(-3deg); }
    100% { transform: scale(1.1) rotate(3deg); }
  }

  /* --- Bioluminiscencia Submarina --- */
  .aurora-blobs {
    position: absolute;
    inset: -15%;
    z-index: 1;
    filter: blur(140px);
    opacity: 0.75;
    overflow: hidden;
    transform: translateZ(0); 
    will-change: transform;
  }
  
  .blob {
    position: absolute;
    border-radius: 45% 55% 40% 60% / 55% 45% 60% 40%;
    /* Removido mix-blend-mode: screen para que sean visibles en Light Mode */
    will-change: transform;
  }

  /* Colores adaptados a la estética Frutiger Aero Submarino (Cianes, Azules Eléctricos, Teals) */
  .blob-1 { 
    width: 65vw; height: 65vw; 
    top: -5%; left: -10%; 
    background: radial-gradient(circle at 25% 25%, rgba(0, 242, 254, 0.6) 0%, rgba(79, 172, 254, 0.25) 60%, transparent 90%);
    animation: flowBlob1 38s linear infinite; 
    opacity: 0.6; 
  }
  
  .blob-2 { 
    width: 55vw; height: 55vw; 
    bottom: -10%; right: -5%; 
    background: radial-gradient(circle at 25% 25%, rgba(0, 198, 255, 0.5) 0%, rgba(0, 114, 255, 0.2) 65%, transparent 90%);
    animation: flowBlob2 48s linear infinite; 
    opacity: 0.5; 
  }
  
  .blob-3 { 
    width: 50vw; height: 50vw; 
    top: 30%; left: 20%; 
    background: radial-gradient(circle at 25% 25%, rgba(28, 216, 210, 0.45) 0%, rgba(31, 107, 184, 0.15) 60%, transparent 90%);
    animation: flowBlob3 42s linear infinite; 
    opacity: 0.45; 
  }

  @keyframes flowBlob1 {
    0%   { transform: translate3d(0, 0, 0) scale(1) rotate(0deg); }
    33%  { transform: translate3d(6%, 10%, 0) scale(1.08) rotate(120deg); }
    66%  { transform: translate3d(-3%, 6%, 0) scale(0.95) rotate(240deg); }
    100% { transform: translate3d(0, 0, 0) scale(1) rotate(360deg); }
  }

  @keyframes flowBlob2 {
    0%   { transform: translate3d(0, 0, 0) scale(1) rotate(360deg); }
    33%  { transform: translate3d(-8%, -6%, 0) scale(1.1) rotate(240deg); }
    66%  { transform: translate3d(4%, -10%, 0) scale(0.92) rotate(120deg); }
    100% { transform: translate3d(0, 0, 0) scale(1) rotate(0deg); }
  }

  @keyframes flowBlob3 {
    0%   { transform: translate3d(0, 0, 0) scale(0.9) rotate(0deg); }
    33%  { transform: translate3d(10%, -12%, 0) scale(1.05) rotate(120deg); }
    66%  { transform: translate3d(-6%, -8%, 0) scale(0.95) rotate(240deg); }
    100% { transform: translate3d(0, 0, 0) scale(0.9) rotate(360deg); }
  }
</style>
