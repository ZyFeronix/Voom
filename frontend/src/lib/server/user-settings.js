/**
 * VSocial — Validación y construcción de updates de user_settings.
 *
 * Fuente única para PUT /api/users/settings: define qué campos acepta el
 * backend y con qué validación. Compartido con los tests para garantizar que
 * lo que envía el frontend se persiste exactamente igual.
 */

export const PROFILE_VISIBILITIES = ['public', 'followers', 'friends'];
export const DM_POLICIES = ['everyone', 'followers', 'none'];
export const THEMES = ['light', 'dark', 'midnight'];

const BOOL_FIELDS = [
	'show_online_status',
	'notify_likes',
	'notify_comments',
	'notify_follows',
	'notify_dms',
	'notification_email',
	'notification_push',
	'notification_dms'
];

const ENUM_FIELDS = {
	profile_visibility: PROFILE_VISIBILITIES,
	allow_dms: DM_POLICIES,
	theme: THEMES
};

const FREE_FIELDS = ['language'];

/**
 * Construye las cláusulas SET para user_settings a partir del body recibido.
 * @returns {{ updates: string[], vals: any[] }} vacío si no hay campos válidos
 * @throws {Error} con .statusCode 400 si un valor enum no es válido
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
			if (!allowed.includes(body[f])) {
				const err = new Error(`Valor no válido para ${f}`);
				err.statusCode = 400;
				throw err;
			}
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

	return { updates, vals };
}

export default { buildSettingsUpdate };
