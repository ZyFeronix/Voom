import re

with open('frontend/src/routes/layout.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Replace :root
root_new = '''/* „Ÿ„Ÿ Light Mode (Day) „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ */
:root {
  /* Scrollbar */
  --scrollbar-bg: rgba(0, 0, 0, 0.05);
  --scrollbar-thumb: rgba(0, 229, 255, 0.4);
  --scrollbar-thumb-hover: rgba(0, 229, 255, 0.6);

  /* Typography */
  --font-sans:    'Inter',  system-ui, sans-serif;
  --font-display: 'Outfit', system-ui, sans-serif;

  /* Prismatic Iridescent Accents */
  --accent-cyan:    #00E5FF;
  --accent-magenta: #E84A72;
  --accent-gold:    #FFD700;

  /* Backgrounds (The Void - Light equivalent) */
  --bg-canvas:   hsl(220, 20%, 97%);
  --bg-surface:  hsl(0, 0%, 100%);
  --bg-surface2: hsl(220, 20%, 95%);
  --bg-overlay:  rgba(255, 255, 255, 0.5);

  /* Glass - Prismatic */
  --glass-bg:      rgba(255, 255, 255, 0.5);
  --glass-blur:    blur(24px) saturate(150%);
  --glass-border:  rgba(255, 255, 255, 0.80);
  --glass-border-t:rgba(255, 255, 255, 0.95);
  --glass-shadow:  0 8px 32px rgba(0, 229, 255, 0.10);
  --glass-inset-highlight: inset 0 2px 0 rgba(255, 255, 255, 0.70);

  /* Text */
  --text-primary:  hsl(220, 30%, 15%);
  --text-secondary:hsl(220, 20%, 40%);
  --text-muted:    hsl(220, 15%, 55%);
  --text-inverse:  #FFFFFF;
  --text-on-accent:#050914;

  /* UI tokens */
  --border-subtle: rgba(0, 229, 255, 0.18);
  --border-glass:  rgba(255, 255, 255, 0.75);

  /* Elevation shadows */
  --shadow-xs: 0 1px 3px rgba(0, 229, 255, 0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-sm: 0 4px 10px rgba(0, 229, 255, 0.08), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-md: 0 8px 24px rgba(0, 229, 255, 0.10), 0 4px 8px rgba(0,0,0,0.04);
  --shadow-lg: 0 16px 40px rgba(0, 229, 255, 0.12), 0 6px 12px rgba(0,0,0,0.05);

  /* Primary gradient */
  --grad-primary: linear-gradient(145deg, var(--accent-cyan), hsl(190, 100%, 45%));
  --grad-primary-hover: linear-gradient(145deg, hsl(190, 100%, 60%), hsl(190, 100%, 50%));

  /* Fluid Geometry */
  --radius-xs:  6px;
  --radius-sm:  10px;
  --radius-md:  14px;
  --radius-lg:  24px;
  --radius-xl:  32px;
  --radius-full: 9999px;

  /* Transitions */
  --ease-out:    cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --t-fast:  0.15s var(--ease-out);
  --t-base:  0.25s var(--ease-out);
  --t-slow:  0.40s var(--ease-out);
  --t-spring:0.45s var(--ease-spring);

  /* Micro-texture Noise */
  --noise-texture: url("data:image/svg+xml;utf8,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
}'''

# Replace [data-theme="dark"]
dark_new = '''/* „Ÿ„Ÿ Dark Mode (Night) „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ */
[data-theme="dark"] {
  /* The Void Backgrounds - Deep Obsidian to Midnight Blue */
  --bg-canvas:   #050914;
  --bg-surface:  #0a192f;
  --bg-surface2: #0d213f;
  --bg-overlay:  rgba(5, 9, 20, 0.5);

  /* Glass - Prismatic */
  --glass-bg:      rgba(10, 25, 47, 0.45);
  --glass-border:  rgba(255, 255, 255, 0.12);
  --glass-border-t:rgba(255, 255, 255, 0.25);
  --glass-shadow:  0 8px 32px rgba(0, 229, 255, 0.15);
  --glass-inset-highlight: inset 0 1px 1px rgba(255, 255, 255, 0.1);

  /* Text - Liquid Glass */
  --text-primary:  hsl(210, 45%, 95%);
  --text-secondary:hsl(210, 30%, 80%);
  --text-muted:    hsl(210, 25%, 60%);
  --text-inverse:  #050914;
  --text-on-accent:#050914;

  /* UI tokens */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-glass:  rgba(255, 255, 255, 0.12);

  /* Elevation shadows */
  --shadow-xs: 0 2px 6px rgba(0, 229, 255, 0.08);
  --shadow-sm: 0 4px 12px rgba(0, 229, 255, 0.12);
  --shadow-md: 0 8px 24px rgba(0, 229, 255, 0.15);
  --shadow-lg: 0 16px 40px rgba(0, 229, 255, 0.20);
}'''

# Replace body
body_new = '''body {
  background: radial-gradient(circle at top, var(--bg-surface) 0%, var(--bg-canvas) 100%);
  background-attachment: fixed;
  min-height: 100vh;
  overflow-x: hidden;
  line-height: 1.6;
  transition: background var(--t-slow), color var(--t-slow);
  position: relative;
}'''

# Replace glass
glass_new = '''/* „Ÿ„Ÿ Neo-Aero Glass Panel „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ */
.aero-glass, .glass-panel, .glass-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid transparent;
  background-clip: padding-box;
  box-shadow: var(--glass-shadow), var(--glass-inset-highlight);
  border-radius: var(--radius-lg);
  transition: box-shadow var(--t-base), transform var(--t-spring);
  overflow: hidden;
}

/* Double Border Refraction (1px linear-gradient) */
.aero-glass::before, .glass-panel::before, .glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 1;
}

/* Micro-texture noise overlay */
.aero-glass::after, .glass-panel::after, .glass-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--noise-texture);
  opacity: 0.04;
  mix-blend-mode: overlay;
  pointer-events: none;
  z-index: 2;
}

.aero-glass:hover, .glass-panel:hover, .glass-card:hover {
  box-shadow: 0 12px 40px rgba(0, 229, 255, 0.25), var(--glass-inset-highlight);
  transform: translateY(-2px);
}

.aero-glass > *, .glass-panel > *, .glass-card > * {
  position: relative;
  z-index: 3;
}'''


css = re.sub(r'/\* „Ÿ„Ÿ Light Mode \(Day\) „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ \*/\s*:root \{.*?\n\}\n', root_new + '\n\n', css, flags=re.DOTALL)
css = re.sub(r'/\* „Ÿ„Ÿ Dark Mode \(Night\) „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ \*/\s*\[data-theme="dark"\] \{.*?\n\}\n', dark_new + '\n\n', css, flags=re.DOTALL)
css = re.sub(r'body \{\s*background: var\(--bg-canvas\);.*?\n\}\n', body_new + '\n\n', css, flags=re.DOTALL)
css = re.sub(r'/\* „Ÿ„Ÿ Neo-Aero Glass Panel „Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ„Ÿ \*/.*?/\* Ensure content above noise layer \*/.*?\}\n', glass_new + '\n\n', css, flags=re.DOTALL)

with open('frontend/src/routes/layout.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('Updated layout.css successfully!')
