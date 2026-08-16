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

// ---- Derived ----
const isAuthenticated = $derived(!!_user && !!_token);
const isAdmin = $derived(
	_user?.role === 'admin' || _user?.role === 'super_admin' || _user?.is_admin
);
const isModerator = $derived(_user?.role === 'moderator' || isAdmin);
const isTeamOrHigher = $derived(
	['team', 'support', 'moderator', 'admin', 'super_admin', 'staff'].includes(_user?.role) ||
		!!_user?.is_admin
);

let _initPromise = null;

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
				}
			}
		} catch (_err) {
			if (_err?.status === 401 || _err?.status === 403 || _err?.status === 404) {
				if (typeof localStorage !== 'undefined') {
					localStorage.removeItem('vsocial_token');
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
		document.cookie = `vsocial_token=${token}; path=/; max-age=31536000; SameSite=Strict; Secure`;
	}
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
		document.cookie = `vsocial_token=${token}; path=/; max-age=31536000; SameSite=Strict; Secure`;
	}
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
		document.cookie = 'vsocial_token=; path=/; max-age=0; SameSite=Strict; Secure';
	}
}

/**
 * Update user data in store (e.g. after profile edit).
 */
function updateUser(data) {
	if (_user) {
		_user = { ..._user, ...data };
	}
}

/**
 * Refresh user data from API.
 */
async function refresh() {
	try {
		const { user } = await authApi.me();
		_user = user;
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
	get isTeamOrHigher() {
		return isTeamOrHigher;
	},
	initialize,
	login,
	register,
	logout,
	updateUser,
	refresh
};
