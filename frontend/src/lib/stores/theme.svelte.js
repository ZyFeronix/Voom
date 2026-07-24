/**
 * Theme Store — manages light / dark / midnight modes with localStorage persistence
 *
 * Ciclo: light → dark → midnight → light
 * - light:    Aurora clara (menta/teal/skyblue)
 * - dark:     Oceánico profundo (teal/azul)
 * - midnight: Azulado casi negro, apto OLED y uso nocturno
 */

const STORAGE_KEY = 'vsocial_theme';

export const THEME_OPTIONS = [
	{ id: 'light', name: 'Claro', icon: 'light_mode', desc: 'Aurora clara' },
	{ id: 'dark', name: 'Oscuro', icon: 'dark_mode', desc: 'Océano profundo' },
	{ id: 'midnight', name: 'Noche', icon: 'bedtime', desc: 'Azul OLED' }
];

// Metadatos de cada tema: icono REPRESENTATIVO del tema actual (cada uno
// distinto, para que se reconozca de un vistazo en qué tema estás) y su
// etiqueta legible.
const THEME_META = {
	light: { label: 'Tema: Claro', name: 'Claro', icon: 'light_mode', desc: 'Aurora clara' },
	dark: { label: 'Tema: Oscuro', name: 'Oscuro', icon: 'dark_mode', desc: 'Océano profundo' },
	midnight: { label: 'Tema: Noche', name: 'Noche', icon: 'bedtime', desc: 'Azul OLED' }
};

const THEMES = THEME_OPTIONS.map((t) => t.id);

function isValidTheme(value) {
	return THEMES.includes(value);
}

function prefersReducedMotion() {
	return (
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

function getInitialTheme() {
	if (typeof window === 'undefined') return 'light';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (isValidTheme(stored)) return stored;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let _theme = $state(getInitialTheme());

function applyTheme(value) {
	_theme = value;
	if (typeof window !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, value);
		document.documentElement.setAttribute('data-theme', value);
	}
}

export function setTheme(value) {
	if (!isValidTheme(value)) return;
	if (
		typeof document !== 'undefined' &&
		typeof document.startViewTransition === 'function' &&
		!prefersReducedMotion()
	) {
		try {
			const transition = document.startViewTransition(() => applyTheme(value));
			if (transition.ready) transition.ready.catch(() => {});
			if (transition.finished) transition.finished.catch(() => {});
		} catch {
			applyTheme(value);
		}
	} else {
		applyTheme(value);
	}
}

/** Rota al siguiente tema del ciclo: light → dark → midnight → light */
export function cycleTheme() {
	const idx = THEMES.indexOf(_theme);
	const next = THEMES[(idx + 1) % THEMES.length];
	setTheme(next);
}

/** Alias retrocompatible: mantiene el comportamiento de ciclo. */
export const toggleTheme = cycleTheme;

export function initTheme() {
	if (typeof window !== 'undefined') {
		document.documentElement.setAttribute('data-theme', _theme);
	}
}

export const themeStore = {
	get value() {
		return _theme;
	},
	/** Icono (Material) representativo del tema actual — distinto por tema. */
	get icon() {
		return THEME_META[_theme]?.icon ?? 'dark_mode';
	},
	/** Etiqueta legible del tema actual, para tooltips/aria. */
	get label() {
		return THEME_META[_theme]?.label ?? 'Cambiar tema';
	},
	get name() {
		return THEME_META[_theme]?.name ?? 'Oscuro';
	},
	get desc() {
		return THEME_META[_theme]?.desc ?? 'Océano profundo';
	}
};
