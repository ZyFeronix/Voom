/**
 * Voom! — Validación y construcción de updates de user_settings.
 *
 * Fuente única para PUT /api/users/settings: define qué campos acepta el
 * backend y con qué validación. Compartido con los tests para garantizar que
 * lo que envía el frontend se persiste exactamente igual.
 */

export const PROFILE_VISIBILITIES = ['public', 'followers', 'friends'];
export const DM_POLICIES = ['everyone', 'followers', 'none'];
export const THEMES = ['light', 'dark', 'midnight'];
export const APP_FONTS = ['default', 'outfit', 'inter', 'mono', 'custom'];
export const DENSITIES = ['compact', 'cozy', 'roomy'];
export const BORDER_RADII = ['sharp', 'modern', 'rounded', 'bubble'];
export const WALLPAPER_MODES = ['cover', 'tile', 'fit'];

/** Hex sólido #RGB/#RRGGBB o cadena vacía (= heredar del tema). */
const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$|^$/i;
/**
 * Wallpaper global: http(s) absoluta o ruta relativa servida por la app
 * (p. ej. /uploads/...). Sin javascript:/data:/vbscript: ni saltos de línea.
 */
const SAFE_URL_RE = /^(https?:\/\/[^\s'"<>]+|\/[^\s'"<>]*)$/i;
/** Preset estético activo: id corto [a-z0-9_-] o vacío (tracking informativo). */
const PRESET_RE = /^[a-z0-9_-]{0,30}$/;

const BOOL_FIELDS = [
	'show_online_status',
	'notify_likes',
	'notify_comments',
	'notify_follows',
	'notify_dms',
	'notification_email',
	'notification_push',
	'notification_dms',
	'aero_gloss'
];

const ENUM_FIELDS = {
	profile_visibility: PROFILE_VISIBILITIES,
	allow_dms: DM_POLICIES,
	theme: THEMES,
	app_font: APP_FONTS,
	density: DENSITIES,
	border_radius: BORDER_RADII,
	wallpaper_mode: WALLPAPER_MODES
};

const FREE_FIELDS = ['language'];

// Apariencia: [campo, mínimo, máximo] — se hace clamp, no rechazo.
const NUMBER_FIELDS = {
	font_scale: [0.85, 1.25],
	wallpaper_dim: [0, 70],
	card_opacity: [40, 100]
};

const COLOR_FIELDS = ['accent_color'];

const URL_FIELDS = ['app_wallpaper_url'];

// Campos de texto corto con formato restringido (se normalizan a minúsculas).
const PRESET_FIELDS = ['active_preset'];

function invalidField(field) {
	const err = new Error(`Valor no válido para ${field}`);
	err.statusCode = 400;
	return err;
}

function pushColor(updates, vals, field, value) {
	if (typeof value !== 'string' || !COLOR_RE.test(value.trim())) throw invalidField(field);
	updates.push(`${field} = ?`);
	vals.push(value.trim().toLowerCase());
}

function pushUrl(updates, vals, field, value) {
	if (typeof value !== 'string') throw invalidField(field);
	const trimmed = value.trim();
	if (trimmed.length > 500) throw invalidField(field);
	if (trimmed !== '' && !SAFE_URL_RE.test(trimmed)) throw invalidField(field);
	updates.push(`${field} = ?`);
	vals.push(trimmed);
}

function pushNumber(updates, vals, field, value, min, max) {
	let n = Number(value);
	if (!Number.isFinite(n)) throw invalidField(field);
	n = Math.min(max, Math.max(min, Math.round(n * 100) / 100));
	updates.push(`${field} = ?`);
	vals.push(n);
}

/**
 * Construye las cláusulas SET para user_settings a partir del body recibido.
 * @returns {{ updates: string[], vals: any[] }} vacío si no hay campos válidos
 * @throws {Error} con .statusCode 400 si un valor enum/color/url/number no es válido
 */
export function buildSettingsUpdate(body = {}) {
	const updates = [];
	const vals = [];

	for (const f of BOOL_FIELDS) {
		if (body[f] !== undefined) {
			updates.push(`${f} = ?`);
			vals.push(body[f] === true || body[f] === 1 || body[f] === 'true' ? 1 : 0);
		}
	}
	for (const [f, allowed] of Object.entries(ENUM_FIELDS)) {
		if (body[f] !== undefined) {
			if (!allowed.includes(body[f])) throw invalidField(f);
			updates.push(`${f} = ?`);
			vals.push(body[f]);
		}
	}
	for (const f of FREE_FIELDS) {
		if (body[f] !== undefined && typeof body[f] === 'string' && body[f].length <= 10) {
			updates.push(`${f} = ?`);
			vals.push(body[f]);
		}
	}
	for (const f of COLOR_FIELDS) {
		if (body[f] !== undefined) pushColor(updates, vals, f, body[f]);
	}
	for (const f of URL_FIELDS) {
		if (body[f] !== undefined) pushUrl(updates, vals, f, body[f]);
	}
	for (const f of PRESET_FIELDS) {
		if (body[f] !== undefined) {
			if (typeof body[f] !== 'string' || !PRESET_RE.test(body[f].trim().toLowerCase()))
				throw invalidField(f);
			updates.push(`${f} = ?`);
			vals.push(body[f].trim().toLowerCase());
		}
	}
	for (const [f, [min, max]] of Object.entries(NUMBER_FIELDS)) {
		if (body[f] !== undefined) pushNumber(updates, vals, f, body[f], min, max);
	}

	return { updates, vals };
}

export default { buildSettingsUpdate };
