import fs from 'fs';

let css = fs.readFileSync('frontend/src/routes/layout.css', 'utf-8');

// 1. Dark Mode Variables Update
const darkThemeReplacement = `/* ── Dark Mode (Night) ──────────────────────────────────────── */
[data-theme="dark"] {
  /* FONDOS Y BASE */
  --bg-canvas:   #0a1929;
  --bg-surface:  rgba(13, 45, 70, 0.6);
  --bg-surface2: #0d2b3e;
  --bg-overlay:  rgba(10, 25, 41, 0.85);

  /* PANELES DE CRISTAL */
  --glass-bg:      rgba(13, 45, 70, 0.6);
  --glass-border:  rgba(100, 180, 220, 0.15);
  --glass-border-t:rgba(255, 255, 255, 0.05);
  --glass-shadow:  0 12px 32px rgba(0, 180, 216, 0.08); /* Sombra color cyan sutil */
  --glass-inset:   inset 0 1px 1px rgba(255, 255, 255, 0.05); /* Specular top highlight */

  /* ACENTOS IRIDISCENTES */
  --accent-cyan:    #00b4d8;
  --accent-magenta: #E84A72;
  --accent-gold:    #FFD700;

  /* TEXTOS Y TIPOGRAFÍA */
  --text-primary:  #ffffff;
  --text-secondary:#8ba4b8;
  --text-muted:    #5a7a8f;
  --text-inverse:  #0a1929;
  --text-on-accent:#ffffff;
  --text-link:     #4da8da;

  /* UI TOKENS */
  --border-subtle: rgba(100, 180, 220, 0.1);
  --border-glass:  rgba(100, 180, 220, 0.15);

  /* Sombras de colores para Neo-Aero */
  --shadow-xs: 0 2px 6px rgba(0, 180, 216, 0.05);
  --shadow-sm: 0 4px 12px rgba(0, 180, 216, 0.08);
  --shadow-md: 0 8px 24px rgba(0, 180, 216, 0.12);
  --shadow-lg: 0 16px 40px rgba(0, 180, 216, 0.15);

  /* Degradados interactivos */
  --grad-primary:       linear-gradient(145deg, #00b4d8, #0077b6);
  --grad-primary-hover: linear-gradient(145deg, #00b4d8, #E84A72); /* Toque prismático */
}`;

css = css.replace(/\/\* ── Dark Mode \(Night\).*?\n\}\n/s, darkThemeReplacement + '\n\n');

// 2. Body Background Update
const bodyReplacement = `body {
  background: radial-gradient(circle at 50% 0%, #0f3347 0%, #0a1929 80%);
  background-attachment: fixed;
  min-height: 100vh;
  overflow-x: hidden;
  line-height: 1.6;
  transition: background var(--t-slow), color var(--t-slow);
  position: relative;
}`;

css = css.replace(/body \{\s*background: var\(--bg-canvas\);.*?\n\}\n/s, bodyReplacement + '\n\n');

// 3. Glass Panel Update
const glassReplacement = `/* ── Neo-Aero Glass Panel ───────────────────────────────────── */
.aero-glass, .glass-panel, .glass-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  border: 1px solid transparent;
  background-clip: padding-box;
  box-shadow: var(--glass-shadow), var(--glass-inset);
  border-radius: var(--radius-lg);
  transition: box-shadow var(--t-base), transform var(--t-spring);
  overflow: hidden;
}

/* Refracción de borde (Double border) */
.aero-glass::before, .glass-panel::before, .glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(100, 180, 220, 0.05) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 1;
}

/* Micro-textura (Noise) */
.aero-glass::after, .glass-panel::after, .glass-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--noise-texture);
  opacity: 0.02;
  mix-blend-mode: overlay;
  pointer-events: none;
  z-index: 2;
}

.aero-glass:hover, .glass-panel:hover, .glass-card:hover {
  box-shadow: 0 16px 40px rgba(0, 180, 216, 0.15), var(--glass-inset);
  transform: translateY(-2px);
}

.aero-glass > *, .glass-panel > *, .glass-card > * {
  position: relative;
  z-index: 3;
}`;

css = css.replace(/\/\* ── Neo-Aero Glass Panel ───────────────────────────────────── \*\/.*?(\/\* ── Buttons ────────────────────────────────────────────────── \*\/)/s, glassReplacement + '\n\n$1');

// Add --noise-texture to :root if not present (we removed it when reverting)
if (!css.includes('--noise-texture')) {
    css = css.replace(/:root \{/, `:root {\n  /* Micro-texture Noise */\n  --noise-texture: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E');\n`);
}

// 4. Updates to typography classes (for Neo-Aero)
css = css.replace(/\.text-link\s*\{.*?\}/, `.text-link      { color: var(--text-link); transition: color var(--t-fast); text-shadow: 0 0 8px rgba(77, 168, 218, 0.3); }`);
css = css.replace(/\.text-link:hover\s*\{.*?\}/, `.text-link:hover{ color: #00b4d8; text-shadow: 0 0 12px rgba(0, 180, 216, 0.6); }`);

fs.writeFileSync('frontend/src/routes/layout.css', css, 'utf-8');
console.log('Neo-Aero evolution applied correctly!');
