/**
 * Auth Store — Manages authentication state
 * Uses Svelte 5 runes for reactivity
 */

import { auth as authApi } from '$lib/api.js';

// ---- State ----
let _user = $state(null);
let _token = $state(null);
let _loading = $state(true);
let _initialized = $state(false);

// Restaurar sesión de forma síncrona en cliente para evitar saltos visuales en recargas
if (typeof localStorage !== 'undefined') {
	try {
		const storedToken = localStorage.getItem('vsocial_token');
		const storedUser = localStorage.getItem('vsocial_user');
		if (storedToken) {
			_token = storedToken;
			if (storedUser) {
				_user = JSON.parse(storedUser);
			}
		}
	} catch {}
}

// ---- Derived ----
const isAuthenticated = $derived(!!_user && !!_token);
const isAdmin = $derived(
	_user?.role === 'admin' || _user?.role === 'super_admin' || _user?.is_admin
);
const isModerator = $derived(_user?.role === 'moderator' || isAdmin);
const isSupport = $derived(_user?.role === 'support' || isModerator);
const isTeamOrHigher = $derived(
	['team', 'support', 'moderator', 'admin', 'super_admin', 'staff'].includes(_user?.role) ||
		!!_user?.is_admin
);
// isStaff == isTeamOrHigher: acceso al panel /admin según rol efectivo del servidor.

/** Etiqueta en español del rol de staff (para chips del panel). */
const ROLE_LABELS = {
	user: 'Usuario',
	team: 'Equipo Voom!',
	staff: 'Staff',
	support: 'Soporte',
	moderator: 'Moderador',
	admin: 'Administrador',
	super_admin: 'Super Admin',
	government: 'Institución'
};
const roleLabel = $derived(ROLE_LABELS[_user?.role] || _user?.role || 'Usuario');

// Level computed from xp_points (sync with backend formula in gamification.js)
function computeLevel(xp) {
	if (!xp || xp < 100) return 1;
	// Formula: xpForLevel(lv) = (lv - 1)^2 * 100
	// Inverse: lv = floor(sqrt(xp / 100)) + 1
	return Math.floor(Math.sqrt(xp / 100)) + 1;
}

const VALID_THEMES = ['light', 'dark', 'midnight'];
function isValidThemeValue(value) {
	return VALID_THEMES.includes(value);
}

const userLevel = $derived(_user ? _user.level || computeLevel(_user.xp_points || 0) : 1);

let _initPromise = null;

/**
 * Aplica la apariencia global guardada en cuenta (servidor manda sobre la
 * caché local). No-op seguro si el usuario no trae preferencias.
 */
async function hydrateAppearance(user) {
	if (!user || typeof user !== 'object') return;
	try {
		const { applyAll, initAppearance } = await import('./appearance.svelte.js');
		initAppearance();
		applyAll({
			accentColor: user.preferred_accent_color,
			appFont: user.preferred_app_font,
			fontScale: user.preferred_font_scale,
			density: user.preferred_density,
			wallpaperUrl: user.preferred_wallpaper_url,
			wallpaperDim: user.preferred_wallpaper_dim,
			cardOpacity: user.preferred_card_opacity,
			borderRadius: user.preferred_border_radius,
			wallpaperMode: user.preferred_wallpaper_mode,
			aeroGloss: user.preferred_aero_gloss,
			activePreset: user.preferred_active_preset ?? '',
			customFontFamily: user.profile_font_family ?? '',
			customFontUrl: user.profile_custom_font_url ?? ''
		});
	} catch {}
}

/**
 * Initialize auth from localStorage (called on app boot).
 */
async function initialize() {
	if (_initPromise) return _initPromise;

	_initPromise = (async () => {
		_loading = true;
		try {
			if (typeof localStorage !== 'undefined') {
				const stored = localStorage.getItem('vsocial_token');
				if (stored) {
					_token = stored;
					document.cookie = `vsocial_token=${stored}; path=/; max-age=31536000; SameSite=Strict; Secure`;
					const { user } = await authApi.me();
					_user = user;
					localStorage.setItem('vsocial_user', JSON.stringify(user));
					// La preferencia de tema de la cuenta manda sobre la caché local
					if (user?.preferred_theme && isValidThemeValue(user.preferred_theme)) {
						const { setTheme, themeStore } = await import('./theme.svelte.js');
						if (themeStore.value !== user.preferred_theme) {
							setTheme(user.preferred_theme);
						}
					}
					// Apariencia global (acento/escala/densidad/fuente/wallpaper):
					// la cuenta manda sobre la caché local. applyAll NO dispara red.
					await hydrateAppearance(user);
				} else {
					_token = null;
					_user = null;
					localStorage.removeItem('vsocial_user');
				}
			}
		} catch (_err) {
			if (_err?.status === 401 || _err?.status === 403 || _err?.status === 404) {
				if (typeof localStorage !== 'undefined') {
					localStorage.removeItem('vsocial_token');
					localStorage.removeItem('vsocial_user');
					document.cookie = 'vsocial_token=; path=/; max-age=0; SameSite=Strict; Secure';
				}
				_token = null;
				_user = null;
			}
		} finally {
			_loading = false;
			_initialized = true;
		}
	})();

	return _initPromise;
}

/**
 * Login with username/email + password.
 */
async function login(loginId, password) {
	const { token, user } = await authApi.login({ login: loginId, password });
	_token = token;
	_user = user;
	_initialized = true;
	_initPromise = Promise.resolve();
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('vsocial_token', token);
		localStorage.setItem('vsocial_user', JSON.stringify(user));
		document.cookie = `vsocial_token=${token}; path=/; max-age=31536000; SameSite=Strict; Secure`;
	}
	await hydrateAppearance(user);
	return user;
}

/**
 * Register new account.
 */
async function register(data) {
	const { token, user } = await authApi.register(data);
	_token = token;
	_user = user;
	_initialized = true;
	_initPromise = Promise.resolve();
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('vsocial_token', token);
		localStorage.setItem('vsocial_user', JSON.stringify(user));
		document.cookie = `vsocial_token=${token}; path=/; max-age=31536000; SameSite=Strict; Secure`;
	}
	await hydrateAppearance(user);
	return user;
}

/**
 * Logout current user.
 */
async function logout() {
	try {
		await authApi.logout();
	} catch (_) {}
	_token = null;
	_user = null;
	_initialized = false;
	_initPromise = null;
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem('vsocial_token');
		localStorage.removeItem('vsocial_user');
		document.cookie = 'vsocial_token=; path=/; max-age=0; SameSite=Strict; Secure';
	}
}

/**
 * Update user data in store (e.g. after profile edit).
 */
function updateUser(data) {
	if (_user) {
		_user = { ..._user, ...data };
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('vsocial_user', JSON.stringify(_user));
		}
	}
}

/**
 * Refresh user data from API.
 */
async function refresh() {
	try {
		const { user } = await authApi.me();
		_user = user;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('vsocial_user', JSON.stringify(user));
		}
		return user;
	} catch (err) {
		if (err.status === 401) {
			logout();
		}
		throw err;
	}
}

// Export reactive getters and actions
export const authStore = {
	get user() {
		return _user;
	},
	get token() {
		return _token;
	},
	get loading() {
		return _loading;
	},
	get initialized() {
		return _initialized;
	},
	get isAuthenticated() {
		return isAuthenticated;
	},
	get isAdmin() {
		return isAdmin;
	},
	get isModerator() {
		return isModerator;
	},
	get isSupport() {
		return isSupport;
	},
	get isTeamOrHigher() {
		return isTeamOrHigher;
	},
	get roleLabel() {
		return roleLabel;
	},
	get userLevel() {
		return userLevel;
	},
	initialize,
	login,
	register,
	logout,
	updateUser,
	refresh
};
