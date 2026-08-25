/**
 * VSocial — Utilidades isomórficas de diseño (seguras en cliente Y servidor)
 *
 * Sanitiza y valida la personalización de perfil antes de persistirla
 * (server) y al renderizarla (cliente). Módulo puro: sin imports de Node.
 *
 * Modelo de amenazas cubierto por sanitizeCss():
 *  - Secuestro visual (phishing overlay): `position: fixed` se reescribe a
 *    `absolute`, `z-index` se acota a [0, 999]. Defensa en profundidad en el
 *    shell con `isolation: isolate; contain: paint;`.
 *  - Exfiltración/redirección vía `url()`: solo rutas locales `/uploads/...`.
 *  - Ejecución legada: `expression()`, `behavior:`, `-moz-binding`.
 *  - Carga de recursos remotos: `@import`, `@charset`, `@namespace`, `@document`.
 *  - Escape del ámbito: todo selector top-level se prefija con
 *    `.profile-custom-wrapper` (html/body/:root se re-mapean al propio wrapper).
 */

export const SCOPE_SELECTOR = '.profile-custom-wrapper';

export const DESIGN_LIMITS = Object.freeze({
	CUSTOM_CSS_MAX: 8192,
	BLOCKS_MAX: 20,
	LINKS_PER_BLOCK_MAX: 20,
	BLOCK_CONTENT_MAX: 2000,
	LINK_TITLE_MAX: 50,
	URL_MAX: 512,
	FONT_FAMILY_MAX: 60,
	Z_INDEX_MIN: 0,
	Z_INDEX_MAX: 999,
	GLASS_BLUR_MIN: 0,
	GLASS_BLUR_MAX: 40,
	GLASS_OPACITY_MIN: 0.2,
	GLASS_OPACITY_MAX: 1
});

export const ALLOWED_BLOCK_TYPES = Object.freeze(['bio', 'links', 'feed', 'photos']);

export const DEFAULT_PRIMARY_COLOR = '#1b85f3';

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const FONT_FAMILY_FORBIDDEN_RE = /[^A-Za-z0-9 _-]/g;
const BLOCK_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const HTTPS_URL_RE = /^https:\/\/\S{1,500}$/i;

// At-rules permitidas. Todo lo demás (@import, @charset, @namespace,
// @document, desconocidos…) se descarta silenciosamente.
const NESTING_AT_RE = /^@(media|supports|container)\b/i;
const KEYFRAMES_AT_RE = /^@(?:-[a-z]+-)?keyframes\b/i;
const LEAF_AT_RE = /^@(font-face|property)\b/i;
const AT_RULE_RE = /^@[a-zA-Z]/;

/* ────────────────────────────── CSS: helpers ───────────────────────────── */

/** true si la URL es segura para usarse dentro de CSS (ruta local de uploads). */
export function isSafeCssUrl(value) {
	if (typeof value !== 'string') return false;
	const u = value.trim();
	if (!u.startsWith('/uploads/')) return false;
	if (u.includes('\\') || u.includes('..')) return false;
	if (u.length > DESIGN_LIMITS.URL_MAX) return false;
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f\u007f]/.test(u)) return false;
	return true;
}

/** Reescribe url(...) no confiables a `none` dentro de un bloque de declaraciones. */
function filterUrls(body) {
	return body.replace(/url\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi, (match, _quote, raw) =>
		isSafeCssUrl(raw) ? match : 'none'
	);
}

/** position: fixed → absolute (anti overlay-phishing). */
function demoteFixedPositioning(body) {
	return body.replace(
		/(^|[;{])\s*position\s*:\s*fixed\s*(?=[;}]|$)/gim,
		(_m, sep) => `${sep}position: absolute`
	);
}

/** Acota z-index numérico al rango seguro. */
function clampZIndex(body) {
	return body.replace(
		/(z-index\s*:\s*)(-?\d+)(?![\w%.])/gi,
		(_m, prop, num) =>
			prop +
			String(
				Math.min(DESIGN_LIMITS.Z_INDEX_MAX, Math.max(DESIGN_LIMITS.Z_INDEX_MIN, parseInt(num, 10)))
			)
	);
}

/** Elimina vectores legados de ejecución/exención de sandbox. */
function stripLegacyVectors(body) {
	return body
		.replace(/\bexpression\s*\([^)]*\)/gi, '')
		.replace(
			/(^|[;{])\s*(?:-moz-binding|behavior|-o-link(-source)?)\s*:[^;}]*/gi,
			(_m, sep) => sep
		);
}

/** Sanitiza un cuerpo de declaraciones "hoja" (sin reglas anidadas). */
function sanitizeLeafBody(body) {
	let out = filterUrls(body);
	out = demoteFixedPositioning(out);
	out = clampZIndex(out);
	out = stripLegacyVectors(out);
	return out;
}

/**
 * Prefija cada selector de la lista con el scope del perfil.
 * html/body/:root se re-mapean al propio wrapper (intención típica del autor
 * era "toda mi página"); selectores ya scoped se respetan.
 */
function prefixSelectors(prelude) {
	return prelude
		.split(',')
		.map((rawSel) => {
			const sel = rawSel.trim();
			if (!sel) return sel;
			const remapped = sel.replace(/^(html\b|body\b|:root\b)/i, SCOPE_SELECTOR);
			if (
				new RegExp(`^${SCOPE_SELECTOR.replace('.', '\\.')}(?=$|[\\s,:.[>+~])`, 'i').test(remapped)
			)
				return remapped;
			return `${SCOPE_SELECTOR} ${remapped}`;
		})
		.filter(Boolean)
		.join(', ');
}

/**
 * Recorre la hoja de estilos a nivel superior, consciente de llaves y
 * comillas, y emite reglas sanitizadas. Devuelve las reglas como array.
 */
function processStylesheet(css, out) {
	const n = css.length;
	let i = 0;
	while (i < n) {
		let braceIdx = -1;
		let quote = null;
		let start = i;
		for (; i < n; i++) {
			const ch = css[i];
			if (quote) {
				if (ch === '\\') i++;
				else if (ch === quote) quote = null;
				continue;
			}
			if (ch === '"' || ch === "'") {
				quote = ch;
				continue;
			}
			if (ch === '{') {
				braceIdx = i;
				break;
			}
		}
		if (braceIdx === -1) break; // restos sin bloque: se descartan

		const prelude = css.slice(start, braceIdx).trim();

		// Localizar la llave de cierre correspondiente
		let depth = 1;
		let j = braceIdx + 1;
		quote = null;
		for (; j < n && depth > 0; j++) {
			const ch = css[j];
			if (quote) {
				if (ch === '\\') j++;
				else if (ch === quote) quote = null;
				continue;
			}
			if (ch === '"' || ch === "'") {
				quote = ch;
				continue;
			}
			if (ch === '{') depth++;
			else if (ch === '}') depth--;
		}
		const bodyEnd = depth === 0 ? j - 1 : n;
		const body = css.slice(braceIdx + 1, bodyEnd);
		i = bodyEnd + 1;

		emitRule(prelude, body, out);
	}
	return out;
}

function emitRule(prelude, body, out) {
	if (!prelude) return;

	if (NESTING_AT_RE.test(prelude)) {
		const inner = processStylesheet(body, []);
		if (inner.length) out.push(`${prelude} {\n${inner.join('\n')}\n}`);
		return;
	}
	if (KEYFRAMES_AT_RE.test(prelude)) {
		out.push(`${prelude} {\n${sanitizeLeafBody(body)}\n}`);
		return;
	}
	if (LEAF_AT_RE.test(prelude)) {
		out.push(`${prelude} {\n${sanitizeLeafBody(body)}\n}`);
		return;
	}
	if (AT_RULE_RE.test(prelude)) return; // at-rule no permitida: descartada

	const selectors = prefixSelectors(prelude);
	if (!selectors) return;
	out.push(`${selectors} {\n${sanitizeLeafBody(body)}\n}`);
}

/**
 * Sanitiza CSS de usuario y devuelve una cadena scoped a `.profile-custom-wrapper`.
 * Puede devolver '' si no queda nada seguro. El límite de longitud lo aplica
 * el llamador (para poder rechazar con 400 en vez de truncar a medias).
 */
export function sanitizeCss(input) {
	if (typeof input !== 'string' || !input.trim()) return '';

	// Comentarios y caracteres de control fuera
	let css = input.replace(/\/\*[\s\S]*?\*\//g, '');
	// eslint-disable-next-line no-control-regex
	css = css.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
	// At-rules prohibidas incluso antes del parseo (@import puede colarse sin bloque)
	css = css.replace(/@(import|charset|namespace|document)\b[^;{]*;?/gi, '');

	const rules = processStylesheet(css, []);
	return rules.join('\n\n');
}

/* ─────────────────────── Validación de campos sueltos ──────────────────── */

/** Hex #rgb/#rrggbb normalizado a minúsculas; cualquier otra cosa → null. */
export function normalizeColor(value) {
	if (typeof value !== 'string') return null;
	const v = value.trim();
	return HEX_COLOR_RE.test(v) ? v.toLowerCase() : null;
}

/** Solo rutas locales /uploads/… ; lo inválido se descarta con aviso. */
function normalizeUploadPath(value, warnings, fieldLabel) {
	if (value == null || value === '') return null;
	const s = String(value).trim();
	if (isSafeCssUrl(s)) return s;
	warnings.push(`${fieldLabel} descartada: solo se permiten archivos subidos a /uploads/.`);
	return null;
}

function clampNumber(value, min, max) {
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	return Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
}

/* ───────────────── Validación de blocks_layout (shape server) ───────────── */

function validateBlocksLayout(raw) {
	const warnings = [];

	if (raw == null || raw === '') return { ok: true, value: null, warnings };

	let arr = raw;
	if (typeof arr === 'string') {
		try {
			arr = JSON.parse(arr);
		} catch {
			return { ok: false, error: 'blocks_layout no es JSON válido.' };
		}
	}
	if (!Array.isArray(arr)) return { ok: false, error: 'blocks_layout debe ser una lista.' };
	if (arr.length > DESIGN_LIMITS.BLOCKS_MAX)
		return { ok: false, error: `Máximo ${DESIGN_LIMITS.BLOCKS_MAX} bloques.` };

	const usedIds = new Set();
	const out = [];

	for (const entry of arr) {
		if (!entry || typeof entry !== 'object') continue;
		const type = String(entry.type ?? '').toLowerCase();
		if (!ALLOWED_BLOCK_TYPES.includes(type)) {
			warnings.push(`Bloque de tipo "${type || 'desconocido'}" ignorado.`);
			continue;
		}

		let id =
			typeof entry.id === 'string' && BLOCK_ID_RE.test(entry.id)
				? entry.id
				: `${type}-${out.length}`;
		while (usedIds.has(id)) id = `${id}-x`;
		usedIds.add(id);

		const block = { id, type, enabled: entry.enabled !== false };

		if (type === 'bio') {
			block.content = String(entry.content ?? '').slice(0, DESIGN_LIMITS.BLOCK_CONTENT_MAX);
		}

		if (type === 'links') {
			const links = [];
			const candidates = Array.isArray(entry.links)
				? entry.links.slice(0, DESIGN_LIMITS.LINKS_PER_BLOCK_MAX)
				: [];
			for (const link of candidates) {
				if (!link || typeof link !== 'object') continue;
				const title =
					String(link.title ?? '')
						.trim()
						.slice(0, DESIGN_LIMITS.LINK_TITLE_MAX) || 'Enlace';
				let url = String(link.url ?? '').trim();
				if (!HTTPS_URL_RE.test(url)) {
					if (/^http:\/\/\S{1,500}$/i.test(url)) {
						url = url.replace(/^http:/i, 'https:');
						warnings.push(`Enlace "${title}" actualizado a https.`);
					} else {
						warnings.push(`Enlace "${title}" omitido: la URL debe ser https://`);
						continue;
					}
				}
				links.push({ title, url });
			}
			block.links = links;
		}

		out.push(block);
	}

	return { ok: true, value: out.length ? out : null, warnings };
}

/* ────────────────── validateCustomization(): contrato del PUT ───────────── */

/**
 * Valida el body de PUT /api/users/me/customization.
 * Devuelve:
 *   { ok: true,  values, warnings }   — values contiene SOLO los campos presentes
 *   { ok: false, error }
 *
 * Estrategia anti-basura: colores/URLs/números inválidos se normalizan a null
 * (el shell hereda del tema) en lugar de rechazar la petición entera; los
 * fallos estructurales (CSS demasiado largo, blocks malformado) sí son 400.
 */
export function validateCustomization(body) {
	const warnings = [];
	const values = {};

	if (!body || typeof body !== 'object' || Array.isArray(body))
		return { ok: false, error: 'Cuerpo de la petición inválido.' };

	if ('primary_color' in body) values.primary_color = normalizeColor(body.primary_color);
	if ('bg_color' in body) values.bg_color = normalizeColor(body.bg_color);

	if ('glass_blur' in body)
		values.glass_blur = clampNumber(
			body.glass_blur,
			DESIGN_LIMITS.GLASS_BLUR_MIN,
			DESIGN_LIMITS.GLASS_BLUR_MAX
		);
	if ('glass_opacity' in body)
		values.glass_opacity = clampNumber(
			body.glass_opacity,
			DESIGN_LIMITS.GLASS_OPACITY_MIN,
			DESIGN_LIMITS.GLASS_OPACITY_MAX
		);

	if ('bg_image_url' in body)
		values.bg_image_url = normalizeUploadPath(body.bg_image_url, warnings, 'Imagen de fondo');
	if ('custom_font_url' in body)
		values.custom_font_url = normalizeUploadPath(body.custom_font_url, warnings, 'Fuente');

	if ('font_family' in body) {
		const family = String(body.font_family ?? '')
			.replace(FONT_FAMILY_FORBIDDEN_RE, '')
			.trim()
			.slice(0, DESIGN_LIMITS.FONT_FAMILY_MAX);
		values.font_family = family || null;
	}

	if ('custom_css' in body) {
		const css = sanitizeCss(typeof body.custom_css === 'string' ? body.custom_css : '');
		if (css.length > DESIGN_LIMITS.CUSTOM_CSS_MAX) {
			return {
				ok: false,
				error: `El CSS personalizado supera el límite de ${DESIGN_LIMITS.CUSTOM_CSS_MAX} caracteres tras sanitizar (${css.length}).`
			};
		}
		values.custom_css = css || null;
	}

	if ('blocks_layout' in body) {
		const res = validateBlocksLayout(body.blocks_layout);
		if (!res.ok) return res;
		values.blocks_layout = res.value ? JSON.stringify(res.value) : null;
		warnings.push(...res.warnings);
	}

	if (!Object.keys(values).length)
		return { ok: false, error: 'No se proporcionó ningún campo de diseño válido.' };

	return { ok: true, values, warnings };
}
