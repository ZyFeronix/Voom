/**
 * xp.js — Curva de nivel de V-SOCIAL en cliente.
 * Espejo exacto de `lib/server/gamification.js`:
 *   level = floor(sqrt(XP / 100)) + 1  (cap MAX_LEVEL = 20)
 *   XP acumulada para alcanzar el nivel n = (n - 1)^2 * 100
 * La fuente de verdad sigue siendo el servidor; esto solo alimenta
 * las visualizaciones de progreso del leaderboard.
 */

export const XP_PER_LEVEL_FACTOR = 100;
export const MAX_LEVEL = 20;

/** XP acumulada necesaria para ALCANZAR `level` (el nivel 1 arranca en 0). */
export function xpForLevel(level) {
	if (level <= 1) return 0;
	return Math.pow(level - 1, 2) * XP_PER_LEVEL_FACTOR;
}

/**
 * Progreso dentro del nivel actual.
 * @returns {{ pct: number, into: number, span: number, isMax: boolean }}
 *  pct: 0–100 dentro del nivel actual; isMax: true si ya tocó techo.
 */
export function levelProgress(xp = 0, level = 1) {
	const lvl = Math.max(1, Math.min(level || 1, MAX_LEVEL));
	if (lvl >= MAX_LEVEL) {
		return { pct: 100, into: 0, span: 0, isMax: true };
	}
	const floorXp = xpForLevel(lvl);
	const ceilXp = xpForLevel(lvl + 1);
	const span = Math.max(1, ceilXp - floorXp);
	const into = Math.max(0, Math.min((xp || 0) - floorXp, span));
	return { pct: Math.round((into / span) * 100), into, span, isMax: false };
}
