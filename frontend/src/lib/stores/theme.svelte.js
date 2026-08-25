/**
 * Theme Store — manages light / dark / midnight modes with localStorage persistence
 *
 * Ciclo: light → dark → midnight → light
 * - light:    Aurora clara (menta/teal/skyblue)
 * - dark:     Oceánico profundo (teal/azul)
 * - midnight: Azulado casi negro, apto OLED y uso nocturno
 */

import { tick } from 'svelte';

const STORAGE_KEY = 'vsocial_theme';

// Fuente única de verdad de los temas. `label` (para tooltips/aria) se deriva
// del `name` para no repetir datos. El icono es REPRESENTATIVO de cada tema
// (distinto por tema, para reconocer de un vistazo en qué tema estás).
export const THEME_OPTIONS = [
	{ id: 'light', name: 'Claro', icon: 'light_mode', desc: 'Aurora clara' },
	{ id: 'dark', name: 'Oscuro', icon: 'dark_mode', desc: 'Océano profundo' },
	{ id: 'midnight', name: 'Noche', icon: 'bedtime', desc: 'Azul OLED' }
];

const THEME_META = Object.fromEntries(
	THEME_OPTIONS.map((t) => [t.id, { ...t, label: `Tema: ${t.name}` }])
);

const THEMES = THEME_OPTIONS.map((t) => t.id);

function isValidTheme(value) {
	return THEMES.includes(value);
}

function getInitialTheme() {
	if (typeof window === 'undefined') return 'light';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (isValidTheme(stored)) return stored;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let _theme = $state(getInitialTheme());

// Bandera de arranque: hasta que initTheme() aplica el tema pre-pintado no se
// anima nada, para evitar parpadeos durante el boot/hidratación.
let _booted = false;

// Timer del fallback legacy. Se limpia antes de cada uso para que los clics
// rápidos no retiren la clase .theme-transitioning a destiempo.
let _fallbackTimer = null;

/** Muta el estado reactivo y el atributo global dentro del mismo snapshot. */
function commitDomTheme(value) {
	_theme = value;
	document.documentElement.setAttribute('data-theme', value);
}

/** Aplicación instantánea, sin animación (boot/hidratación). */
function applyInstant(value) {
	localStorage.setItem(STORAGE_KEY, value);
	commitDomTheme(value);
}

/**
 * Crossfade premium vía View Transitions API. El callback es async: `await tick()`
 * garantiza que Svelte terminó de mutar el DOM de sus componentes (iconos, textos
 * reactivos al tema) antes de que el navegador capture el snapshot del nuevo estado.
 */
function applyWithViewTransition(value) {
	localStorage.setItem(STORAGE_KEY, value);
	try {
		const transition = document.startViewTransition(async () => {
			commitDomTheme(value);
			await tick();
		});
		// Rescate anti-congelamiento: si la VT no termina en 1s, se salta
		// para que un overlay colgado no rompa la plataforma visualmente.
		const timeout = setTimeout(() => {
			transition.skipTransition();
		}, 1000);
		transition.finished.finally(() => clearTimeout(timeout)).catch(() => {});
		transition.ready.catch(() => {});
		transition.updateCallbackDone.catch(() => {});
	} catch {
		applyWithFallbackAnimation(value);
	}
}

/**
 * Fallback para navegadores sin View Transitions API: una clase temporal habilita
 * transiciones CSS baratas (sin box-shadow) mientras los colores viejos funden
 * con los nuevos (~250ms).
 */
function applyWithFallbackAnimation(value) {
	if (_fallbackTimer) {
		clearTimeout(_fallbackTimer);
		_fallbackTimer = null;
	}
	const html = document.documentElement;
	html.classList.add('theme-transitioning');
	void html.offsetHeight; // flush sincrónico: la clase aún ve los colores viejos
	localStorage.setItem(STORAGE_KEY, value);
	commitDomTheme(value);
	_fallbackTimer = setTimeout(() => {
		html.classList.remove('theme-transitioning');
		_fallbackTimer = null;
	}, 300);
}

function applyTheme(value) {
	// SSR: solo estado reactivo, sin DOM ni persistencia
	if (typeof document === 'undefined') {
		_theme = value;
		return;
	}
	if (!_booted) {
		applyInstant(value);
		return;
	}
	if (typeof document.startViewTransition === 'function') {
		applyWithViewTransition(value);
	} else {
		applyWithFallbackAnimation(value);
	}
}

export function setTheme(value) {
	if (!isValidTheme(value) || value === _theme) return;
	applyTheme(value);
	syncThemeToAccount(value);
}

/**
 * Persiste la preferencia de tema en la cuenta (user_settings.theme) para que
 * se aplique en cualquier dispositivo al iniciar sesión. Fire-and-forget: si
 * no hay sesión o falla, se ignora silenciosamente (localStorage sigue siendo
 * la caché inmediata).
 */
function syncThemeToAccount(value) {
	if (typeof localStorage === 'undefined') return;
	const token = localStorage.getItem('vsocial_token');
	if (!token) return;
	fetch('/api/users/settings', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({ theme: value })
	}).catch(() => {});
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
	_booted = true;
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
