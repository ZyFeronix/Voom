/**
 * Appearance Store — apariencia GLOBAL de la aplicación por usuario
 * (pestaña «Aplicación» de /settings/design).
 *
 * Ejes: acento (con paleta derivada HSL), escala tipográfica, densidad,
 * fuente global y wallpaper. Persistencia en tres capas:
 *  1. Estado reactivo ($state) + aplicación DOM instantánea.
 *  2. localStorage (claves vsocial_*) como caché anti-flash (leída también
 *     por el script bloqueante de app.html antes del primer paint).
 *  3. user_settings en el servidor vía PUT /api/users/settings — DEBOUNCED
 *     (500ms trailing): arrastrar un slider genera UNA petición, no una por
 *     tick. flushSync() envía lo pendiente con keepalive al cerrar la pestaña
 *     para que el servidor nunca pise un valor local más nuevo.
 *
 * Convención de "heredar": accent_color '' y font 'default' eliminan las
 * variables inline para que manden las hojas [data-theme].
 */

import {
	hexToRgb,
	rgbToHex,
	rgbToHsl,
	hslToHex,
	relativeLuminance,
	contrastRatio,
	deriveAccentPalette,
	KEYS,
	APP_FONT_OPTIONS,
	DENSITY_OPTIONS,
	ACCENT_SWATCHES,
	BORDER_RADIUS_OPTIONS,
	WALLPAPER_MODE_OPTIONS,
	APP_PRESETS,
	FONT_SCALE_MIN,
	FONT_SCALE_MAX,
	CARD_OPACITY_MIN,
	CARD_OPACITY_MAX,
	RADIUS_IDS,
	WALLPAPER_MODE_IDS,
	PRESET_IDS,
	GLOSS_MAX,
	WALLPAPER_DIM_MAX,
	HEX_RE,
	FONT_IDS,
	DENSITY_IDS
} from '../design/appearance-utils.js';

export {
	hexToRgb,
	rgbToHex,
	rgbToHsl,
	hslToHex,
	relativeLuminance,
	contrastRatio,
	deriveAccentPalette,
	KEYS,
	APP_FONT_OPTIONS,
	DENSITY_OPTIONS,
	ACCENT_SWATCHES,
	BORDER_RADIUS_OPTIONS,
	WALLPAPER_MODE_OPTIONS,
	APP_PRESETS,
	FONT_SCALE_MIN,
	FONT_SCALE_MAX,
	CARD_OPACITY_MIN,
	CARD_OPACITY_MAX,
	RADIUS_IDS,
	WALLPAPER_MODE_IDS,
	PRESET_IDS,
	GLOSS_MAX,
	WALLPAPER_DIM_MAX,
	HEX_RE,
	FONT_IDS,
	DENSITY_IDS
};

function lsGet(key) {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
function lsSet(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch {}
}

function initialScale() {
	const raw = lsGet(KEYS.scale);
	if (raw === null || raw === undefined) return 1;
	const n = Number(raw);
	return Number.isFinite(n) && n >= FONT_SCALE_MIN && n <= FONT_SCALE_MAX ? n : 1;
}
function initialDim() {
	const raw = lsGet(KEYS.dim);
	if (raw === null || raw === undefined) return 30;
	const n = Number(raw);
	return Number.isFinite(n) && n >= 0 && n <= WALLPAPER_DIM_MAX ? n : 30;
}
function initialCardOpacity() {
	const raw = lsGet(KEYS.cardOpacity);
	if (raw === null || raw === undefined) return 100;
	const n = Number(raw);
	return Number.isFinite(n) && n >= CARD_OPACITY_MIN && n <= CARD_OPACITY_MAX ? n : 100;
}

let _accent = $state(HEX_RE.test(lsGet(KEYS.accent) ?? '') ? lsGet(KEYS.accent) : '');
let _font = $state(FONT_IDS.includes(lsGet(KEYS.font)) ? lsGet(KEYS.font) : 'default');
let _scale = $state(initialScale());
let _density = $state(DENSITY_IDS.includes(lsGet(KEYS.density)) ? lsGet(KEYS.density) : 'cozy');
let _wallpaperUrl = $state(typeof lsGet(KEYS.wallpaper) === 'string' ? lsGet(KEYS.wallpaper) : '');
let _wallpaperDim = $state(initialDim());
// Frutiger Aero Engine (migración 017)
let _cardOpacity = $state(initialCardOpacity());
let _borderRadius = $state(
	RADIUS_IDS.includes(lsGet(KEYS.borderRadius)) ? lsGet(KEYS.borderRadius) : 'rounded'
);
let _wallpaperMode = $state(
	WALLPAPER_MODE_IDS.includes(lsGet(KEYS.wallpaperMode)) ? lsGet(KEYS.wallpaperMode) : 'cover'
);
let _aeroGloss = $state(lsGet(KEYS.aeroGloss) !== 'false');
let _activePreset = $state(
	typeof lsGet(KEYS.activePreset) === 'string' && PRESET_IDS.includes(lsGet(KEYS.activePreset))
		? lsGet(KEYS.activePreset)
		: ''
);

// Fuente personalizada del PERFIL (profile_customizations), no se persiste en
// localStorage: llega de la cuenta en cada boot (hydrateFromUser).
let _customFontFamily = $state('');
let _customFontUrl = $state('');

let _syncTimer = null;
let _pendingPayload = null;
let _syncStatus = $state('idle'); // idle | saving | saved
let _savedFlashTimer = null;

// ────────────────────────── Aplicación DOM ────────────────────────────────

const FONT_STACKS = {
	outfit:
		"'Outfit', 'Outfit Fallback', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
	inter:
		"'Inter', 'Inter Fallback', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
	mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"
};

/** Inyección IDEMPOTENTE de @font-face: un único <style> cuyo contenido se reemplaza. */
function applyCustomFontFace() {
	if (typeof document === 'undefined') return;
	const ID = 'vsocial-custom-app-font';
	let tag = document.getElementById(ID);
	if (!_customFontFamily || !_customFontUrl || _font !== 'custom') {
		if (tag) tag.textContent = '';
		return;
	}
	if (!tag) {
		tag = document.createElement('style');
		tag.id = ID;
		document.head.appendChild(tag);
	}
	const family = String(_customFontFamily)
		.replace(/[\\'"<>{}();]/g, '')
		.trim();
	const url = /^https?:\/\/|^\//.test(_customFontUrl) ? _customFontUrl : '';
	if (!family || !url) {
		tag.textContent = '';
		return;
	}
	tag.textContent = `@font-face{font-family:'${family}';src:url('${url}');font-display:swap;}`;
}

function applyDom() {
	if (typeof document === 'undefined') return;
	const html = document.documentElement;
	const s = html.style;

	// Acento + paleta derivada. Inline-style gana a [data-theme] sin tocar
	// layout.css; al heredar se ELIMINAN las propiedades para que vuelvan las
	// hojas del tema activo.
	if (_accent && HEX_RE.test(_accent)) {
		const pal = deriveAccentPalette(_accent);
		const rgb = hexToRgb(_accent);
		s.setProperty('--accent-blue-base', pal.base);
		s.setProperty('--accent-blue-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
		s.setProperty('--accent-blue-light', pal.light);
		s.setProperty('--accent-blue-dark', pal.dark);
		s.setProperty('--accent-blue-bright', pal.bright);
		s.setProperty('--accent-blue-mid', pal.mid);
		s.setProperty('--accent-blue-deep', pal.dark);
		s.setProperty('--accent-cyan', pal.light);
		s.setProperty('--accent-gradient', pal.gradient);
		// --grad-primary referencia var(--accent-gradient) en layout.css, pero
		// cada tema redefine hover con literales: lo cubrimos explícitamente.
		s.setProperty('--grad-primary', pal.gradient);
		s.setProperty('--grad-primary-hover', pal.gradientHover);
	} else {
		for (const p of [
			'--accent-blue-base',
			'--accent-blue-rgb',
			'--accent-blue-light',
			'--accent-blue-dark',
			'--accent-blue-bright',
			'--accent-blue-mid',
			'--accent-blue-deep',
			'--accent-cyan',
			'--accent-gradient',
			'--grad-primary',
			'--grad-primary-hover'
		]) {
			s.removeProperty(p);
		}
	}

	// Escala tipográfica global: rem/EM escalan con la fuente raíz.
	if (_scale !== 1) s.setProperty('font-size', `${Math.round(_scale * 1000) / 10}%`);
	else s.removeProperty('font-size');

	// Fuente global
	applyCustomFontFace();
	if (_font === 'default') {
		s.removeProperty('--font-sans');
		s.removeProperty('--font-display');
	} else if (_font === 'custom' && _customFontFamily && _customFontUrl) {
		const family = `'${String(_customFontFamily)
			.replace(/[\\'"<>{}();]/g, '')
			.trim()}', system-ui, sans-serif`;
		s.setProperty('--font-sans', family);
		s.setProperty('--font-display', family);
	} else if (FONT_STACKS[_font]) {
		s.setProperty('--font-sans', FONT_STACKS[_font]);
		s.setProperty('--font-display', FONT_STACKS[_font]);
	}

	html.setAttribute('data-density', _density);

	// Frutiger Aero Engine (migración 017): superficies.
	html.setAttribute('data-border-radius', _borderRadius);
	// Cristal translúcido: solo cuando opacidad < 100 (los perfiles lite ya
	// fuerzan sólido con !important, así que aquí no hay conflicto posible).
	const hasGlass = _cardOpacity < CARD_OPACITY_MAX;
	html.setAttribute('data-card-glass', hasGlass ? 'true' : 'false');
	if (hasGlass) s.setProperty('--card-opacity', `${_cardOpacity}%`);
	else s.removeProperty('--card-opacity');
	// Brillo especular curvo: amplifica el ::after de las superficies vía
	// variable (0 = invisible → look actual sin cambios).
	s.setProperty('--gloss-strength', _aeroGloss ? String(GLOSS_MAX) : '0');

	// Wallpaper: capa fija detrás del contenido pintada desde body::before
	// (variables inline en <html>, visibilidad gated por atributo). Una imagen
	// rota simplemente no pinta nada — capa transparente, sin parches.
	const hasWall = !!_wallpaperUrl;
	html.setAttribute('data-wallpaper', hasWall ? 'true' : 'false');
	html.setAttribute('data-wallpaper-mode', _wallpaperMode);
	if (hasWall) {
		s.setProperty('--app-wallpaper', `url("${String(_wallpaperUrl).replace(/"/g, '%22')}")`);
		s.setProperty('--wallpaper-dim', String(_wallpaperDim / 100));
	} else {
		s.removeProperty('--app-wallpaper');
		s.removeProperty('--wallpaper-dim');
	}
}

// ────────────────────────── Sincronización con el servidor ────────────────

/** Debounce 500ms trailing: una ráfaga de interacciones = UN PUT. */
function scheduleSync() {
	_pendingPayload = {
		...(_pendingPayload ?? {}),
		accent_color: _accent,
		app_font: _font,
		font_scale: _scale,
		density: _density,
		app_wallpaper_url: _wallpaperUrl,
		wallpaper_dim: _wallpaperDim,
		card_opacity: _cardOpacity,
		border_radius: _borderRadius,
		wallpaper_mode: _wallpaperMode,
		aero_gloss: _aeroGloss ? 1 : 0,
		active_preset: _activePreset
	};
	_syncStatus = 'saving';
	clearTimeout(_syncTimer);
	_syncTimer = setTimeout(() => {
		_syncTimer = null;
		sendPendingSync(false);
	}, 500);
}

function getAuthToken() {
	if (typeof localStorage !== 'undefined') {
		const t = localStorage.getItem('vsocial_token');
		if (t) return t;
	}
	if (typeof document !== 'undefined') {
		const m = document.cookie.match(/(?:^|;\s*)vsocial_token=([^;]+)/);
		if (m) return decodeURIComponent(m[1]);
	}
	return null;
}

async function sendPendingSync(keepalive) {
	const payload = _pendingPayload;
	_pendingPayload = null;
	if (!payload) return;
	const token = getAuthToken();
	if (!token) {
		if (!keepalive) _syncStatus = 'idle';
		return;
	}
	try {
		const res = await fetch('/api/users/settings', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(payload),
			keepalive,
			credentials: 'include'
		});
		if (!res.ok) {
			const errBody = await res.json().catch(() => null);
			console.warn('[appearance] Error al autoguardar ajustes:', res.status, errBody);
			if (!keepalive) _syncStatus = 'error';
			return;
		}
		if (!keepalive) {
			_syncStatus = 'saved';
			clearTimeout(_savedFlashTimer);
			_savedFlashTimer = setTimeout(() => {
				if (!_syncTimer && !_pendingPayload) _syncStatus = 'idle';
			}, 2200);
		}
	} catch (err) {
		console.warn('[appearance] Excepción de red en autoguardado:', err);
		if (!keepalive) _syncStatus = 'error';
	}
}

export function setCustomFont(family, url) {
	_customFontFamily = family ? String(family).trim() : '';
	_customFontUrl = url ? String(url).trim() : '';
	applyCustomFontFace();
	if (_font === 'custom') applyDom();
}

/** Envío inmediato de lo pendiente (pagehide / pestaña oculta). */
function flushSync() {
	if (!_syncTimer && !_pendingPayload) return;
	clearTimeout(_syncTimer);
	_syncTimer = null;
	sendPendingSync(true);
}

let _listenersBound = false;
function bindUnloadListeners() {
	if (_listenersBound || typeof window === 'undefined') return;
	_listenersBound = true;
	window.addEventListener('pagehide', flushSync);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flushSync();
	});
}

// ────────────────────────── Acciones públicas ─────────────────────────────

function commit(cacheKey, value) {
	applyDom();
	lsSet(cacheKey, value);
	scheduleSync();
}

/**
 * Commit para ajustes MANUALES: cualquier retoque posterior a un preset
 * limpia el tracking de preset activo (el look ya no es "puro").
 */
function commitManual(cacheKey, value) {
	if (_activePreset !== '') {
		_activePreset = '';
		lsSet(KEYS.activePreset, '');
	}
	commit(cacheKey, value);
}

export function setAccent(value) {
	const hex = typeof value === 'string' ? value.trim().toLowerCase() : '';
	if (hex !== '' && !HEX_RE.test(hex)) return false;
	_accent = hex;
	commitManual(KEYS.accent, hex);
	return true;
}

export function setAppFont(id) {
	if (!FONT_IDS.includes(id)) return false;
	_font = id;
	commitManual(KEYS.font, id);
	return true;
}

export function setFontScale(value) {
	let n = Number(value);
	if (!Number.isFinite(n)) return false;
	n = Math.round(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, n)) * 100) / 100;
	_scale = n;
	commitManual(KEYS.scale, String(n));
	return true;
}

export function setDensity(id) {
	if (!DENSITY_IDS.includes(id)) return false;
	_density = id;
	commitManual(KEYS.density, id);
	return true;
}

export function setWallpaper(url) {
	const clean = typeof url === 'string' ? url.trim() : '';
	if (clean && !/^(https?:\/\/[^\s'"<>]+|\/[^\s'"<>]*)$/i.test(clean)) return false;
	_wallpaperUrl = clean;
	if (!clean) _wallpaperDim = 30;
	commit(KEYS.wallpaper, clean);
	lsSet(KEYS.dim, String(_wallpaperDim));
	return true;
}

export function setWallpaperDim(value) {
	let n = Number(value);
	if (!Number.isFinite(n)) return false;
	n = Math.round(Math.min(WALLPAPER_DIM_MAX, Math.max(0, n)));
	_wallpaperDim = n;
	commit(KEYS.dim, String(n));
	return true;
}

export function setCardOpacity(value) {
	let n = Number(value);
	if (!Number.isFinite(n)) return false;
	n = Math.round(Math.min(CARD_OPACITY_MAX, Math.max(CARD_OPACITY_MIN, n)));
	_cardOpacity = n;
	commitManual(KEYS.cardOpacity, String(n));
	return true;
}

export function setBorderRadius(id) {
	if (!RADIUS_IDS.includes(id)) return false;
	_borderRadius = id;
	commitManual(KEYS.borderRadius, id);
	return true;
}

export function setWallpaperMode(id) {
	if (!WALLPAPER_MODE_IDS.includes(id)) return false;
	_wallpaperMode = id;
	commitManual(KEYS.wallpaperMode, id);
	return true;
}

export function setAeroGloss(enabled) {
	const v = !!enabled;
	if (v === _aeroGloss) return true;
	_aeroGloss = v;
	commitManual(KEYS.aeroGloss, v ? 'true' : 'false');
	return true;
}

/**
 * Bóveda de presets: aplica el preset completo en lote. Todos los setters
 * internos comparten el scheduleSync debouncado → UN solo PUT por preset.
 */
export function applyPreset(presetId) {
	const preset = APP_PRESETS.find((p) => p.id === presetId);
	if (!preset) return false;
	setAccent(preset.accentColor);
	setAppFont(preset.appFont);
	setDensity(preset.density);
	setCardOpacity(preset.cardOpacity);
	setBorderRadius(preset.borderRadius);
	setWallpaperMode(preset.wallpaperMode);
	setAeroGloss(preset.aeroGloss);
	// Marca el tracking DESPUÉS de los setters manuales (que lo habrían
	// limpiado) y coalesce todo en el mismo PUT.
	_activePreset = preset.id;
	lsSet(KEYS.activePreset, preset.id);
	scheduleSync();
	return true;
}

export function resetAppearance() {
	setAccent('');
	setAppFont('default');
	setFontScale(1);
	setDensity('cozy');
	setWallpaper('');
	// setWallpaper ya restauró dim=30; reflejarlo en caché
	lsSet(KEYS.dim, String(_wallpaperDim));
	setCardOpacity(100);
	setBorderRadius('rounded');
	setWallpaperMode('cover');
	setAeroGloss(true);
	_activePreset = '';
	lsSet(KEYS.activePreset, '');
	scheduleSync();
}

/**
 * Hidratación desde la cuenta (servidor manda sobre caché local).
 * Llamar tras /api/auth/me con los preferred_* del usuario. NO dispara red.
 */
export function applyAll(prefs = {}) {
	let changed = false;
	const take = (incoming, valid) =>
		incoming !== undefined && incoming !== null && valid(incoming) ? incoming : null;

	const rawAccent = prefs.accentColor !== undefined ? prefs.accentColor : prefs.accent_color;
	const acc =
		rawAccent === '' ? '' : take(rawAccent, (v) => typeof v === 'string' && HEX_RE.test(v));
	if (acc !== null && acc !== _accent) {
		_accent = acc;
		lsSet(KEYS.accent, acc);
		changed = true;
	}
	const rawFont = prefs.appFont !== undefined ? prefs.appFont : prefs.app_font;
	const fnt = take(rawFont, (v) => FONT_IDS.includes(v));
	if (fnt !== null && fnt !== _font) {
		_font = fnt;
		lsSet(KEYS.font, fnt);
		changed = true;
	}
	const rawScale = prefs.fontScale !== undefined ? prefs.fontScale : prefs.font_scale;
	if (rawScale !== undefined && rawScale !== null && Number.isFinite(Number(rawScale))) {
		const sc =
			Math.round(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Number(rawScale))) * 100) / 100;
		if (sc !== _scale) {
			_scale = sc;
			lsSet(KEYS.scale, String(sc));
			changed = true;
		}
	}
	const rawDensity = prefs.density;
	const den = take(rawDensity, (v) => DENSITY_IDS.includes(v));
	if (den !== null && den !== _density) {
		_density = den;
		lsSet(KEYS.density, den);
		changed = true;
	}
	const rawWallUrl =
		prefs.wallpaperUrl !== undefined ? prefs.wallpaperUrl : prefs.app_wallpaper_url;
	if (
		rawWallUrl !== undefined &&
		rawWallUrl !== null &&
		typeof rawWallUrl === 'string' &&
		rawWallUrl !== _wallpaperUrl
	) {
		_wallpaperUrl = rawWallUrl;
		lsSet(KEYS.wallpaper, rawWallUrl);
		changed = true;
	}
	const rawWallDim = prefs.wallpaperDim !== undefined ? prefs.wallpaperDim : prefs.wallpaper_dim;
	if (rawWallDim !== undefined && rawWallDim !== null && Number.isFinite(Number(rawWallDim))) {
		const dm = Math.round(Math.min(WALLPAPER_DIM_MAX, Math.max(0, Number(rawWallDim))));
		if (dm !== _wallpaperDim) {
			_wallpaperDim = dm;
			lsSet(KEYS.dim, String(dm));
			changed = true;
		}
	}
	// Frutiger Aero Engine (migración 017)
	const rawCardOpacity = prefs.cardOpacity !== undefined ? prefs.cardOpacity : prefs.card_opacity;
	const co = take(rawCardOpacity, (v) => Number.isFinite(Number(v)));
	if (co !== null) {
		const n = Math.round(Math.min(CARD_OPACITY_MAX, Math.max(CARD_OPACITY_MIN, Number(co))));
		if (n !== _cardOpacity) {
			_cardOpacity = n;
			lsSet(KEYS.cardOpacity, String(n));
			changed = true;
		}
	}
	const rawRadius = prefs.borderRadius !== undefined ? prefs.borderRadius : prefs.border_radius;
	const br = take(rawRadius, (v) => RADIUS_IDS.includes(v));
	if (br !== null && br !== _borderRadius) {
		_borderRadius = br;
		lsSet(KEYS.borderRadius, br);
		changed = true;
	}
	const rawWallMode =
		prefs.wallpaperMode !== undefined ? prefs.wallpaperMode : prefs.wallpaper_mode;
	const wm = take(rawWallMode, (v) => WALLPAPER_MODE_IDS.includes(v));
	if (wm !== null && wm !== _wallpaperMode) {
		_wallpaperMode = wm;
		lsSet(KEYS.wallpaperMode, wm);
		changed = true;
	}
	const rawGloss = prefs.aeroGloss !== undefined ? prefs.aeroGloss : prefs.aero_gloss;
	if (rawGloss !== undefined && rawGloss !== null) {
		const gl = rawGloss === true || rawGloss === 1 || rawGloss === '1' || rawGloss === 'true';
		if (gl !== _aeroGloss) {
			_aeroGloss = gl;
			lsSet(KEYS.aeroGloss, gl ? 'true' : 'false');
			changed = true;
		}
	}
	const rawPreset = prefs.activePreset !== undefined ? prefs.activePreset : prefs.active_preset;
	const ap =
		rawPreset === '' || rawPreset === null ? '' : take(rawPreset, (v) => PRESET_IDS.includes(v));
	if (ap !== null && ap !== _activePreset) {
		_activePreset = ap;
		lsSet(KEYS.activePreset, ap);
		changed = true;
	}
	const rawCustomFontFamily =
		prefs.customFontFamily ?? prefs.profile_font_family ?? prefs.font_family;
	if (typeof rawCustomFontFamily === 'string') _customFontFamily = rawCustomFontFamily;
	const rawCustomFontUrl =
		prefs.customFontUrl ?? prefs.profile_custom_font_url ?? prefs.custom_font_url;
	if (typeof rawCustomFontUrl === 'string') _customFontUrl = rawCustomFontUrl;

	// El servidor es fuente de verdad tras hidratar: descarta PUT en vuelo
	_pendingPayload = null;
	clearTimeout(_syncTimer);
	_syncTimer = null;

	if (typeof document !== 'undefined') applyDom();
	return changed;
}

/** Boot (llamar tras initTheme): aplica lo cacheado y ata listeners de flush. */
export function initAppearance() {
	if (typeof document !== 'undefined') applyDom();
	bindUnloadListeners();
}

export const appearanceStore = {
	get accentColor() {
		return _accent;
	},
	set accentColor(v) {
		this.setAccent(v);
	},
	get appFont() {
		return _font;
	},
	set appFont(v) {
		this.setAppFont(v);
	},
	get fontScale() {
		return _scale;
	},
	set fontScale(v) {
		this.setFontScale(v);
	},
	get density() {
		return _density;
	},
	set density(v) {
		this.setDensity(v);
	},
	get wallpaperUrl() {
		return _wallpaperUrl;
	},
	set wallpaperUrl(v) {
		this.setWallpaper(v);
	},
	get wallpaperDim() {
		return _wallpaperDim;
	},
	set wallpaperDim(v) {
		this.setWallpaperDim(v);
	},
	get cardOpacity() {
		return _cardOpacity;
	},
	set cardOpacity(v) {
		this.setCardOpacity(v);
	},
	get borderRadius() {
		return _borderRadius;
	},
	set borderRadius(v) {
		this.setBorderRadius(v);
	},
	get wallpaperMode() {
		return _wallpaperMode;
	},
	set wallpaperMode(v) {
		this.setWallpaperMode(v);
	},
	/** Firma Frutiger Aero: brillo especular curvo de cristal (migración 017). */
	get aeroGloss() {
		return _aeroGloss;
	},
	set aeroGloss(v) {
		this.setAeroGloss(v);
	},
	get activePreset() {
		return _activePreset;
	},
	set activePreset(v) {
		if (!v) {
			_activePreset = '';
			lsSet(KEYS.activePreset, '');
			scheduleSync();
		} else {
			this.applyPreset(v);
		}
	},
	get customFontFamily() {
		return _customFontFamily;
	},
	get customFontUrl() {
		return _customFontUrl;
	},
	/** idle | saving | saved — para el chip de autosave del editor. */
	get syncStatus() {
		return _syncStatus;
	},
	setAccent,
	setAppFont,
	setFontScale,
	setDensity,
	setWallpaper,
	setWallpaperDim,
	setCardOpacity,
	setBorderRadius,
	setWallpaperMode,
	setAeroGloss,
	applyPreset,
	resetAppearance,
	applyAll,
	initAppearance,
	flushSync,
	setCustomFont
};

export default appearanceStore;
