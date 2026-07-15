/**
 * Theme Store — manages dark/light mode with localStorage persistence
 */

const STORAGE_KEY = 'vsocial_theme';

function getInitialTheme() {
	if (typeof window === 'undefined') return 'light';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'dark' || stored === 'light') return stored;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let _theme = $state(getInitialTheme());

export function setTheme(value) {
	_theme = value;
	if (typeof window !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, value);
		document.documentElement.setAttribute('data-theme', value);
	}
}

export function toggleTheme() {
	setTheme(_theme === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
	if (typeof window !== 'undefined') {
		document.documentElement.setAttribute('data-theme', _theme);
	}
}

export const themeStore = {
	get value() { return _theme; }
};
