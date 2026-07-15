import fs from 'fs';

let css = fs.readFileSync('frontend/src/routes/layout.css', 'utf-8');

const pristineTop = `/* ── Light Mode (Day) ───────────────────────────────────────── */
:root {
  /* Scrollbar */
  --scrollbar-bg: rgba(0, 0, 0, 0.05);
  --scrollbar-thumb: rgba(46, 134, 232, 0.4);
  --scrollbar-thumb-hover: rgba(46, 134, 232, 0.6);

  /* Typography */
  --font-sans:    'Inter',  system-ui, sans-serif;
  --font-display: 'Outfit', system-ui, sans-serif;

  /* Core Aero Palette — muted, never harsh */
  --aero-sky:      hsl(200, 72%, 58%);   /* #4AABDF – soft cyan */
  --aero-blue:     hsl(213, 72%, 52%);   /* #2E86E8 – clear blue */
  --aero-indigo:   hsl(232, 60%, 60%);   /* #5B72CC – slate indigo */
  --aero-mint:     hsl(158, 55%, 52%);   /* #3DC79A – muted mint */
  --aero-rose:     hsl(340, 75%, 58%);   /* #E84A72 – soft rose */
  --aero-amber:    hsl(38,  85%, 55%);   /* #E8A023 – warm amber */

  /* Backgrounds */
  --bg-canvas:   hsl(210, 40%, 96%);     /* #EEF3F8 – barely blue white */
  --bg-surface:  hsl(0, 0%, 100%);
  --bg-surface2: hsl(210, 33%, 98%);     /* #F7F9FC */
  --bg-overlay:  rgba(255, 255, 255, 0.62);

  /* Glass */
  --glass-bg:      rgba(255, 255, 255, 0.52);
  --glass-border:  rgba(255, 255, 255, 0.80);
  --glass-border-t:rgba(255, 255, 255, 0.95);
  --glass-shadow:  0 8px 32px rgba(46, 134, 232, 0.10);
  --glass-inset:   inset 0 2px 0 rgba(255, 255, 255, 0.70);

  /* Text */
  --text-primary:  hsl(213, 35%, 22%);   /* #253650 */
  --text-secondary:hsl(213, 22%, 44%);   /* #546D8A */
  --text-muted:    hsl(213, 18%, 60%);   /* #7D97AE */
  --text-inverse:  #FFFFFF;
  --text-on-accent:#FFFFFF;

  /* UI tokens */
  --border-subtle: rgba(100, 150, 200, 0.18);
  --border-glass:  rgba(255, 255, 255, 0.75);

  /* Elevation shadows */
  --shadow-xs: 0 1px 3px rgba(46,134,232,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-sm: 0 4px 10px rgba(46,134,232,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-md: 0 8px 24px rgba(46,134,232,0.10), 0 4px 8px rgba(0,0,0,0.04);
  --shadow-lg: 0 16px 40px rgba(46,134,232,0.12), 0 6px 12px rgba(0,0,0,0.05);

  /* Primary gradient */
  --grad-primary: linear-gradient(145deg, hsl(196,80%,60%), hsl(213,72%,52%));
  --grad-primary-hover: linear-gradient(145deg, hsl(196,80%,65%), hsl(213,72%,45%));

  /* Border radius */
  --radius-xs:  6px;
  --radius-sm:  10px;
  --radius-md:  14px;
  --radius-lg:  20px;
  --radius-xl:  28px;
  --radius-full: 9999px;

  /* Transitions */
  --ease-out:    cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --t-fast:  0.15s var(--ease-out);
  --t-base:  0.25s var(--ease-out);
  --t-slow:  0.40s var(--ease-out);
  --t-spring:0.45s var(--ease-spring);
  
  --noise-texture: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');
}

/* ── Dark Mode (Night) ──────────────────────────────────────── */
[data-theme="dark"] {
  /* =========================================
     Fondos y Superficies (Dark/Deep Oceanic)
     ========================================= */
  --bg-sidebar: #0f2136;       /* Fondo del menú lateral izquierdo */
  --bg-main: #0c2b3e;          /* Fondo general del lienzo/dashboard */
  --bg-surface: #143048;       /* Fondo de las tarjetas (Feed, Tendencias) */
  --bg-surface-hover: #1b3854; /* Efecto hover o paneles secundarios */
  --bg-input: #0b1a2e;         /* Fondo de la barra de búsqueda y campos */

  /* =========================================
     Acentos (Frutiger Aero / Neon Blue)
     ========================================= */
  --accent-blue-base: #1b85f3;    /* Color base de botones como "Publicar" */
  --accent-blue-light: #2eb4ff;   /* Brillo superior para gradientes/glassmorfismo */
  --accent-blue-dark: #1265c2;    /* Sombras de botones o estados active */
  
  /* Gradiente sugerido para los botones principales y tabs activas */
  --accent-gradient: linear-gradient(90deg, #2eb4ff 0%, #1b85f3 100%);

  /* =========================================
     Tipografía y Detalles
     ========================================= */
  --text-primary: #ffffff;     /* Textos principales y títulos */
  --text-secondary: #85a1b9;   /* Textos secundarios, horas, labels (muted) */
  --border-subtle: #24415d;    /* Bordes sutiles entre contenedores */
  --icon-muted: #64829e;       /* Iconos inactivos en el sidebar */
  --bg-icon-btn: #1b3045;      /* Fondo circular de los iconos de adjuntar */

  /* === MAPPING TO ORIGINAL APP VARIABLES === */
  --bg-canvas: var(--bg-main);
  --bg-surface2: var(--bg-sidebar);
  --bg-overlay: rgba(11, 26, 46, 0.7);
  --glass-bg: rgba(20, 48, 72, 0.6);
  --glass-border: rgba(46, 180, 255, 0.15);
  --glass-border-t: rgba(46, 180, 255, 0.3);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  --glass-inset: inset 0 1px 1px rgba(255, 255, 255, 0.1);

  --text-muted: var(--icon-muted);
  --text-inverse: #0f2136;
  --text-on-accent: #ffffff;

  --border-glass: rgba(255, 255, 255, 0.12);

  --shadow-xs: 0 2px 6px rgba(0,0,0,0.3);
  --shadow-sm: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-md: 0 8px 24px rgba(0,0,0,0.5);
  --shadow-lg: 0 16px 40px rgba(0,0,0,0.6);

  --grad-primary: var(--accent-gradient);
  --grad-primary-hover: linear-gradient(90deg, #3dc2ff 0%, #2090ff 100%);
}

/* ── Reset & Base ───────────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  font-family: var(--font-sans);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}

/* Custom Scrollbar (unified) */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
  border: 2px solid transparent;
  background-clip: padding-box;
}

body {
  background: var(--bg-canvas);
  background-attachment: fixed;
  min-height: 100vh;
  overflow-x: hidden;
  line-height: 1.6;
  transition: background var(--t-slow), color var(--t-slow);
  position: relative;
}

/* Ambient prismatic aurora (subtle, bioluminescent) */
body::before {
  content: '';
  position: fixed;
  inset: -50%;
  background:
    radial-gradient(circle at 30% 40%, rgba(46, 180, 255, 0.12) 0%, transparent 55%),
    radial-gradient(circle at 70% 60%, rgba(27, 133, 243, 0.10) 0%, transparent 50%),
    radial-gradient(circle at 50% 80%, rgba(46, 180, 255, 0.08) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
  animation: aurora-shift 30s ease-in-out infinite alternate;
  filter: blur(80px);
}

@keyframes aurora-shift {
  0%   { transform: translate(0, 0) rotate(0deg) scale(1); }
  50%  { transform: translate(-3%, 4%) rotate(3deg) scale(1.05); }
  100% { transform: translate(3%, -4%) rotate(-3deg) scale(1); }
}

body > * { position: relative; z-index: 1; }

a { color: inherit; text-decoration: none; }

/* ── Neo-Aero Glass Panel ───────────────────────────────────── */
.aero-glass, .glass-panel, .glass-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur, blur(16px));
  -webkit-backdrop-filter: var(--glass-blur, blur(16px));
  border: 1px solid transparent;
  border-image: var(--glass-border) 1;
  box-shadow: var(--glass-shadow), var(--glass-inset-highlight);
  border-radius: var(--radius-lg);
  transition: box-shadow var(--t-base), transform var(--t-spring);
  overflow: hidden;
}

/* Micro-texture noise overlay (eliminates gradient banding) */
.aero-glass::before, .glass-panel::before, .glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--noise-texture);
  opacity: 0.03;
  mix-blend-mode: overlay;
  pointer-events: none;
  z-index: 1;
}

/* Top specular highlight (glass thickness refraction) */
.aero-glass::after, .glass-panel::after, .glass-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.15) 50%, transparent 100%);
  pointer-events: none;
  z-index: 2;
}

.aero-glass:hover, .glass-panel:hover, .glass-card:hover {
  box-shadow: var(--shadow-md), var(--glass-inset-highlight);
  transform: translateY(-2px);
}

/* Ensure content above noise layer */
.aero-glass > *, .glass-panel > *, .glass-card > * {
  position: relative;
  z-index: 3;
}

`;

// Extract from buttons section to end
const cssParts = css.split(/\/\* ── Buttons ────────────────────────────────────────────────── \*\//);

if (cssParts.length > 1) {
  // Found the buttons separator
  const finalCss = pristineTop + '/* ── Buttons ────────────────────────────────────────────────── */\n' + cssParts[1];
  fs.writeFileSync('frontend/src/routes/layout.css', finalCss, 'utf-8');
} else {
  // If we couldn't split by Buttons, just inject at the top using regex to replace up to `.aero-glass` block
  console.log("Could not find Buttons separator, manual override");
}
