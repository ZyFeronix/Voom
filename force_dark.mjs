import fs from 'fs';

let css = fs.readFileSync('frontend/src/routes/layout.css', 'utf-8');

const replacement = `/* ── Unified Deep Oceanic Mode (No Light Mode) ────────────────────────── */
:root, [data-theme="dark"] {
  /* Scrollbar */
  --scrollbar-bg: rgba(0, 0, 0, 0.05);
  --scrollbar-thumb: rgba(46, 134, 232, 0.4);
  --scrollbar-thumb-hover: rgba(46, 134, 232, 0.6);

  /* Typography */
  --font-sans:    'Inter',  system-ui, sans-serif;
  --font-display: 'Outfit', system-ui, sans-serif;

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
  --glass-inset-highlight: inset 0 1px 1px rgba(255, 255, 255, 0.1);

  --text-muted: var(--icon-muted);
  --text-inverse: #0f2136;
  --text-on-accent: #ffffff;
  --text-link: #4da8da;

  --border-glass: rgba(255, 255, 255, 0.12);

  --shadow-xs: 0 2px 6px rgba(0,0,0,0.3);
  --shadow-sm: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-md: 0 8px 24px rgba(0,0,0,0.5);
  --shadow-lg: 0 16px 40px rgba(0,0,0,0.6);

  --grad-primary: var(--accent-gradient);
  --grad-primary-hover: linear-gradient(90deg, #3dc2ff 0%, #2090ff 100%);
  
  --accent-cyan: var(--accent-blue-light);
  --accent-blue-bright: var(--accent-blue-base);
  --accent-blue-mid: #1773d4;
  --accent-blue-deep: var(--accent-blue-dark);
  
  --input-shadow-inner: inset 0 2px 4px rgba(0, 0, 0, 0.2);

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
`;

css = css.replace(/\/\* ── Light Mode \(Day\) ───────────────────────────────────────── \*\/(.*?)\/\* ── Reset & Base ───────────────────────────────────────────── \*\//s, replacement + '\n/* ── Reset & Base ───────────────────────────────────────────── */');

fs.writeFileSync('frontend/src/routes/layout.css', css, 'utf-8');
console.log('Fixed! Set :root to dark theme only.');
