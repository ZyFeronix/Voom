/**
 * SnippetGallery — catálogo de fragmentos de CSS para el editor del perfil
 * (pestaña «Perfil»). Todos los fragmentos respetan el allowlist de
 * lib/design/sanitize.js: sin @import, sin url() externas, selectores que el
 * sanitizador scopea automáticamente al perfil.
 */
export const SNIPPETS = [
	{
		id: 'glow-avatar',
		name: 'Glow en avatar',
		icon: 'auto_awesome',
		css: '\n.profile-avatar {\n  box-shadow: 0 0 22px rgba(27, 133, 243, 0.55);\n}\n'
	},
	{
		id: 'gradient-border',
		name: 'Borde degradado',
		icon: 'gradient',
		css: '\n.glass-card {\n  border-color: transparent;\n  background-image:\n    linear-gradient(var(--bg-surface), var(--bg-surface)),\n    linear-gradient(120deg, #00d4aa, #1b85f3);\n  background-origin: border-box;\n  background-clip: padding-box, border-box;\n}\n'
	},
	{
		id: 'display-type',
		name: 'Tipografía display',
		icon: 'title',
		css: '\n.profile-display-name {\n  font-family: var(--font-display);\n  font-weight: 800;\n  letter-spacing: -0.02em;\n}\n'
	},
	{
		id: 'squircle',
		name: 'Esquinas squircle',
		icon: 'rounded_corner',
		css: '\n.glass-card {\n  border-radius: 24px;\n}\n'
	},
	{
		id: 'hover-lift',
		name: 'Flotar al hover',
		icon: 'upgrade',
		css: '\n.glass-card {\n  transition: transform 0.25s ease, box-shadow 0.25s ease;\n}\n.glass-card:hover {\n  transform: translateY(-3px);\n  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);\n}\n'
	},
	{
		id: 'water-droplet-card',
		name: 'Tarjeta gota de agua',
		icon: 'water_drop',
		css: '\n.glass-card {\n  border-radius: 28px 28px 34px 34px / 24px 24px 40px 40px;\n  border-color: rgba(255, 255, 255, 0.45);\n}\n.glass-card::after {\n  content: "";\n  position: absolute;\n  top: 0; left: 8%; right: 8%;\n  height: 45%;\n  border-radius: inherit;\n  background: linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 100%);\n  pointer-events: none;\n}\n'
	},
	{
		id: 'aqua-gloss-avatar',
		name: 'Avatar burbuja Aqua',
		icon: 'bubble_chart',
		css: '\n.profile-avatar {\n  border: 2px solid rgba(255, 255, 255, 0.5);\n  box-shadow:\n    inset 0 2px 4px rgba(255, 255, 255, 0.7),\n    0 6px 18px rgba(0, 153, 255, 0.45);\n}\n'
	},
	{
		id: 'eco-leaf-tag',
		name: 'Badge hoja eco',
		icon: 'eco',
		css: '\n.badge {\n  background: linear-gradient(180deg, #10b981 0%, #059669 100%);\n  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.55);\n  color: #ffffff;\n  text-shadow: 0 1px 2px rgba(5, 90, 60, 0.4);\n}\n'
	},
	{
		id: 'lens-flare-header',
		name: 'Destello solar en banner',
		icon: 'wb_sunny',
		css: '\n.profile-banner {\n  position: relative;\n  overflow: hidden;\n}\n.profile-banner::before {\n  content: "";\n  position: absolute;\n  top: -30%; right: 12%;\n  width: 220px; height: 220px;\n  background: radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(255,236,180,0.35) 35%, rgba(255,255,255,0) 70%);\n  pointer-events: none;\n}\n'
	}
];
