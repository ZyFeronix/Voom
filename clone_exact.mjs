import fs from 'fs';

let css = fs.readFileSync('frontend/src/routes/layout.css', 'utf-8');

const newCSSHeader = `:root, [data-theme="dark"] {
  /* Scrollbar */
  --scrollbar-bg: rgba(0, 0, 0, 0.05);
  --scrollbar-thumb: rgba(100, 180, 220, 0.4);
  --scrollbar-thumb-hover: rgba(100, 180, 220, 0.6);

  /* Typography */
  --font-sans:    'Inter',  system-ui, sans-serif;
  --font-display: 'Outfit', system-ui, sans-serif;

  /* === FONDO BASE === */
  --bg-sidebar: #0a1929;
  --bg-feed-top: #0f3347;
  --bg-feed-bottom: #0a2535;
  --bg-main: linear-gradient(180deg, #0a2a3f 0%, #0d3b52 100%);
  --bg-right-panel: rgba(13, 43, 62, 0.85);
  
  /* === CRISTAL / PANELES === */
  --glass-bg: rgba(13, 45, 70, 0.6);
  --glass-border: rgba(100, 180, 220, 0.15);
  --glass-highlight: rgba(255, 255, 255, 0.05);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  
  /* === ACCENT / BOTONES === */
  --accent-cyan: #00b4d8;         
  --accent-blue-bright: #1a8fd4;  
  --accent-blue-mid: #0096c7;     
  --accent-blue-deep: #0077b6;    
  --accent-link: #4da8da;         
  
  /* === TEXTOS === */
  --text-primary: #ffffff;
  --text-secondary: #8ba4b8;
  --text-tertiary: #5a7a8f;
  --text-muted: #4a6578;
  
  /* === UI ELEMENTS === */
  --input-bg: rgba(10, 30, 50, 0.8);
  --divider: rgba(100, 180, 220, 0.1);

  /* === COMPONENT MAPPING ALIASES === */
  --bg-canvas: var(--bg-main);
  --bg-surface: var(--glass-bg);
  --bg-surface2: var(--bg-sidebar);
  --bg-overlay: rgba(10, 25, 41, 0.7);

  --glass-border-t: var(--glass-border);
  --glass-inset: inset 0 1px 1px var(--glass-highlight);
  --glass-inset-highlight: inset 0 1px 1px var(--glass-highlight);

  --text-inverse: #0a1929;
  --text-on-accent: #ffffff;

  --border-subtle: var(--divider);
  --border-glass: var(--glass-border);

  /* Elevation shadows */
  --shadow-xs: 0 2px 6px rgba(0,0,0,0.2);
  --shadow-sm: 0 4px 12px rgba(0,0,0,0.3);
  --shadow-md: 0 8px 24px rgba(0,0,0,0.4);
  --shadow-lg: 0 16px 40px rgba(0,0,0,0.5);

  /* Primary gradient */
  --grad-primary: linear-gradient(145deg, #00b4d8, #0077b6);
  --grad-primary-hover: linear-gradient(145deg, #00a8e8, #0096c7);

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

/* Remove aurora effect as per image */
body::before {
  display: none;
}

body > * { position: relative; z-index: 1; }

a { color: inherit; text-decoration: none; }

/* ── Exact Image Clone Glass Panel ───────────────────────────────────── */
.aero-glass, .glass-panel, .glass-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-inset);
  border-radius: var(--radius-lg);
  transition: box-shadow var(--t-base), transform var(--t-spring);
  overflow: hidden;
}

.aero-glass:hover, .glass-panel:hover, .glass-card:hover {
  box-shadow: 0 12px 36px rgba(0,0,0,0.4), var(--glass-inset);
  transform: translateY(-2px);
}

/* Ensure content above background */
.aero-glass > *, .glass-panel > *, .glass-card > * {
  position: relative;
  z-index: 3;
}

/* ── Buttons ────────────────────────────────────────────────── */`;

// Perform regex replacement from the first :root to the Buttons section
css = css.replace(/:root[^{]*\{.*?\/\* ── Buttons ────────────────────────────────────────────────── \*\//s, newCSSHeader);

fs.writeFileSync('frontend/src/routes/layout.css', css, 'utf-8');
console.log('Cloned exact colors from image successfully!');
