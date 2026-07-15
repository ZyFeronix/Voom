import fs from 'fs';

let css = fs.readFileSync('frontend/src/routes/layout.css', 'utf-8');

// Restore :root
css = css.replace(/\/\* ── Light Mode \(Day\).*?\n\}\n/s, `/* ── Light Mode (Day) ───────────────────────────────────────── */
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
}
`);

// Restore dark theme
css = css.replace(/\/\* ── Dark Mode \(Night\).*?\n\}\n/s, `/* ── Dark Mode (Night) ──────────────────────────────────────── */
[data-theme="dark"] {
  /* Aero palette shifts — richer, vibrant, glowing */
  --aero-sky:      hsl(195, 85%, 65%);
  --aero-blue:     hsl(213, 85%, 55%);
  --aero-indigo:   hsl(232, 75%, 68%);
  --aero-mint:     hsl(158, 70%, 50%);
  --aero-rose:     hsl(330, 80%, 65%);
  --aero-amber:    hsl(38,  85%, 60%);

  /* Deep ocean backgrounds — rich layered navy, NOT pure dark grey */
  --bg-canvas:   hsl(222, 45%, 11%);    /* Rich deep navy */
  --bg-surface:  hsl(222, 35%, 15%);    /* Elevated navy */
  --bg-surface2: hsl(222, 30%, 18%);    /* Higher elevated */
  --bg-overlay:  rgba(15, 23, 42, 0.4); /* Much more transparent for blur */

  /* Glass — deep blue-tinted, highly refractive */
  --glass-bg:      rgba(20, 30, 50, 0.45);
  --glass-border:  rgba(255, 255, 255, 0.12);
  --glass-border-t:rgba(255, 255, 255, 0.25);
  --glass-shadow:  0 8px 32px rgba(0, 0, 0, 0.5);
  --glass-inset:   inset 0 1px 1px rgba(255, 255, 255, 0.1);

  /* Text */
  --text-primary:  hsl(210, 45%, 92%);
  --text-secondary:hsl(210, 30%, 75%);
  --text-muted:    hsl(210, 25%, 60%);
  --text-inverse:  hsl(222, 45%, 11%);
  --text-on-accent:#FFFFFF;

  /* UI tokens */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-glass:  rgba(255, 255, 255, 0.12);

  /* Elevation shadows */
  --shadow-xs: 0 2px 6px rgba(0,0,0,0.3);
  --shadow-sm: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-md: 0 8px 24px rgba(0,0,0,0.5);
  --shadow-lg: 0 16px 40px rgba(0,0,0,0.6);

  /* Primary gradient */
  --grad-primary: linear-gradient(145deg, hsl(196,85%,50%), hsl(213,85%,45%));
  --grad-primary-hover: linear-gradient(145deg, hsl(196,85%,55%), hsl(213,85%,50%));
}
`);

// Restore body
css = css.replace(/body \{\s*background: radial-gradient.*?\n\}\n/s, `body {
  background: var(--bg-canvas);
  background-attachment: fixed;
  min-height: 100vh;
  overflow-x: hidden;
  line-height: 1.6;
  transition: background var(--t-slow), color var(--t-slow);
  position: relative;
}
`);

// Restore glass
css = css.replace(/\/\* ── Neo-Aero Glass Panel ───────────────────────────────────── \*\/.*?(\/\* ── Buttons ────────────────────────────────────────────────── \*\/)/s, `/* ── Neo-Aero Glass Panel ───────────────────────────────────── */
.aero-glass, .glass-panel, .glass-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
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
  box-shadow: var(--glass-shadow-hover), var(--glass-inset-highlight);
  transform: translateY(-2px);
}

/* Ensure content above noise layer */
.aero-glass > *, .glass-panel > *, .glass-card > * {
  position: relative;
  z-index: 3;
}

$1`);

fs.writeFileSync('frontend/src/routes/layout.css', css, 'utf-8');
console.log('Restored layout.css successfully!');
