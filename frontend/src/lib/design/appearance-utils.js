/**
 * Utilidades puras de color, contraste WCAG y definiciones de presets
 * del Frutiger Aero Engine de Voom!.
 */

/** hex '#rgb'|'#rrggbb' → {r,g,b} o null. */
export function hexToRgb(hex) {
	if (typeof hex !== 'string') return null;
	let h = hex.replace('#', '');
	if (h.length === 3)
		h = h
			.split('')
			.map((c) => c + c)
			.join('');
	if (!/^[0-9a-f]{6}$/i.test(h)) return null;
	return {
		r: parseInt(h.slice(0, 2), 16),
		g: parseInt(h.slice(2, 4), 16),
		b: parseInt(h.slice(4, 6), 16)
	};
}

export function rgbToHex(r, g, b) {
	const to2 = (n) =>
		Math.round(Math.min(255, Math.max(0, n)))
			.toString(16)
			.padStart(2, '0');
	return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** {r,g,b} → {h,s,l} (h 0-360, s/l 0-100). */
export function rgbToHsl({ r, g, b }) {
	const rn = r / 255,
		gn = g / 255,
		bn = b / 255;
	const max = Math.max(rn, gn, bn),
		min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l: l * 100 };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h;
	if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
	else if (max === gn) h = ((bn - rn) / d + 2) / 6;
	else h = ((rn - gn) / d + 4) / 6;
	return { h: h * 360, s: s * 100, l: l * 100 };
}

function hue2rgb(p, q, t) {
	if (t < 0) t += 1;
	if (t > 1) t -= 1;
	if (t < 1 / 6) return p + (q - p) * 6 * t;
	if (t < 1 / 2) return q;
	if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
	return p;
}

/** {h,s,l} (h 0-360, s/l 0-100) → hex. */
export function hslToHex({ h, s, l }) {
	const sn = s / 100,
		ln = l / 100;
	if (sn === 0) {
		const v = Math.round(ln * 255);
		return rgbToHex(v, v, v);
	}
	const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
	const p = 2 * ln - q;
	const hk = (((h % 360) + 360) % 360) / 360;
	return rgbToHex(
		hue2rgb(p, q, hk + 1 / 3) * 255,
		hue2rgb(p, q, hk) * 255,
		hue2rgb(p, q, hk - 1 / 3) * 255
	);
}

/**
 * Luminancia relativa WCAG 2.x (sRGB linealizado, no "luma" simple).
 * @returns {number} 0–1
 */
export function relativeLuminance(hex) {
	const rgb = hexToRgb(hex);
	if (!rgb) return 0;
	const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
		const cn = c / 255;
		return cn <= 0.03928 ? cn / 12.92 : Math.pow((cn + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Ratio de contraste WCAG entre dos hex (1–21). */
export function contrastRatio(hexA, hexB) {
	const la = relativeLuminance(hexA);
	const lb = relativeLuminance(hexB);
	const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * Paleta derivada MONOCROMÁTICA del acento (siempre armoniosa sea cual sea el
 * tono): replica las relaciones del sistema Aero (bright=base, cyan=light,
 * deep=dark) y construye gradientes duotono base→light que sustituyen a
 * --accent-gradient / --grad-primary(-hover).
 */
export function deriveAccentPalette(baseHex) {
	const rgb = hexToRgb(baseHex);
	if (!rgb) return null;
	const { h, s, l } = rgbToHsl(rgb);
	const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
	const lightL = clamp(l + 14, 0, 92);
	const darkL = clamp(l - 15, 4, 100);
	const brightL = clamp(l + 8, 0, 96);
	return {
		base: baseHex,
		light: hslToHex({ h, s, l: lightL }),
		dark: hslToHex({ h, s, l: darkL }),
		mid: hslToHex({ h, s, l: (l + darkL) / 2 }),
		bright: hslToHex({ h, s, l: brightL }),
		gradient: `linear-gradient(90deg, ${baseHex} 0%, ${hslToHex({ h, s, l: lightL })} 100%)`,
		gradientHover: `linear-gradient(90deg, ${hslToHex({ h, s, l: lightL })} 0%, ${hslToHex({
			h,
			s,
			l: brightL
		})} 100%)`
	};
}

export const KEYS = {
	accent: 'vsocial_accent',
	font: 'vsocial_app_font',
	scale: 'vsocial_font_scale',
	density: 'vsocial_density',
	wallpaper: 'vsocial_wallpaper',
	dim: 'vsocial_wallpaper_dim',
	cardOpacity: 'vsocial_card_opacity',
	borderRadius: 'vsocial_border_radius',
	wallpaperMode: 'vsocial_wallpaper_mode',
	aeroGloss: 'vsocial_aero_gloss',
	activePreset: 'vsocial_active_preset'
};

export const APP_FONT_OPTIONS = [
	{ id: 'default', name: 'Del sistema', desc: 'Outfit + Inter' },
	{ id: 'outfit', name: 'Outfit', desc: 'Display en toda la app' },
	{ id: 'inter', name: 'Inter', desc: 'Texto en toda la app' },
	{ id: 'mono', name: 'JetBrains Mono', desc: 'Estética de código' },
	{ id: 'custom', name: 'Mi fuente', desc: 'La subida en tu perfil' }
];

export const DENSITY_OPTIONS = [
	{ id: 'compact', name: 'Compacta', icon: 'density_small' },
	{ id: 'cozy', name: 'Cómoda', icon: 'density_medium' },
	{ id: 'roomy', name: 'Amplia', icon: 'density_large' }
];

export const ACCENT_SWATCHES = [
	'#1b85f3',
	'#00d4aa',
	'#22c55e',
	'#f3684b',
	'#e84a72',
	'#b026ff',
	'#f5b40a',
	'#334155'
];

/** Geometrías de borde (migración 017): redefinen la escala --radius-*. */
export const BORDER_RADIUS_OPTIONS = [
	{ id: 'sharp', name: 'Brutalista', icon: 'square', desc: '0px · 90°' },
	{ id: 'modern', name: 'Moderno', icon: 'rounded_corner', desc: 'Suave' },
	{ id: 'rounded', name: 'Redondeado', icon: 'crop_square', desc: 'Clásico Aero' },
	{ id: 'bubble', name: 'Bubble', icon: 'bubble_chart', desc: 'Orgánico' }
];

export const WALLPAPER_MODE_OPTIONS = [
	{ id: 'cover', name: 'Cover', icon: 'wallpaper' },
	{ id: 'tile', name: 'Mosaico', icon: 'grid_on' },
	{ id: 'fit', name: 'Ajustar', icon: 'fit_screen' }
];

/**
 * Bóveda de presets Frutiger Aero — 1 clic aplica acento, geometría,
 * opacidad de cristal, gloss, fuente, densidad y MODO de wallpaper.
 */
export const APP_PRESETS = [
	{
		id: 'aqua-os',
		name: 'Aqua OS 2004',
		icon: 'water',
		desc: 'Mac OS X Tiger / gel buttons',
		accentColor: '#0099ff',
		borderRadius: 'sharp',
		cardOpacity: 85,
		aeroGloss: true,
		appFont: 'mono',
		density: 'cozy',
		wallpaperMode: 'tile'
	},
	{
		id: 'frutiger-eco',
		name: 'Frutiger Eco',
		icon: 'eco',
		desc: 'Vista / solarpunk optimista',
		accentColor: '#10b981',
		borderRadius: 'bubble',
		cardOpacity: 90,
		aeroGloss: true,
		appFont: 'outfit',
		density: 'roomy',
		wallpaperMode: 'cover'
	},
	{
		id: 'aero-glass7',
		name: 'Aero Glass 7',
		icon: 'filter_drama',
		desc: 'Windows 7 escarchado',
		accentColor: '#0ea5e9',
		borderRadius: 'rounded',
		cardOpacity: 65,
		aeroGloss: true,
		appFont: 'inter',
		density: 'cozy',
		wallpaperMode: 'cover'
	},
	{
		id: 'neo-orb',
		name: 'Neo-Aero Orb',
		icon: 'blur_circular',
		desc: 'Y2K gloss revival',
		accentColor: '#06b6d4',
		borderRadius: 'modern',
		cardOpacity: 75,
		aeroGloss: true,
		appFont: 'default',
		density: 'cozy',
		wallpaperMode: 'cover'
	},
	{
		id: 'bio-abyss',
		name: 'Abismo Bio',
		icon: 'dark_mode',
		desc: 'Frutiger Aqua nocturno',
		accentColor: '#2dd4bf',
		borderRadius: 'rounded',
		cardOpacity: 70,
		aeroGloss: false,
		appFont: 'inter',
		density: 'cozy',
		wallpaperMode: 'cover'
	}
];

export const FONT_SCALE_MIN = 0.85;
export const FONT_SCALE_MAX = 1.25;
export const CARD_OPACITY_MIN = 40;
export const CARD_OPACITY_MAX = 100;
export const RADIUS_IDS = BORDER_RADIUS_OPTIONS.map((r) => r.id);
export const WALLPAPER_MODE_IDS = WALLPAPER_MODE_OPTIONS.map((m) => m.id);
export const PRESET_IDS = APP_PRESETS.map((p) => p.id);
export const GLOSS_MAX = 1;
export const WALLPAPER_DIM_MAX = 70;

export const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const FONT_IDS = APP_FONT_OPTIONS.map((f) => f.id);
export const DENSITY_IDS = DENSITY_OPTIONS.map((d) => d.id);
