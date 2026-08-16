/**
 * Utilidades de fecha/hora para el cliente.
 *
 * Los DATETIME de SQLite/libSQL se guardan en UTC con formato
 * "YYYY-MM-DD HH:MM:SS" (sin sufijo de zona). `new Date(...)` interpreta
 * ese string como hora LOCAL, desfasando las horas mostradas. Estas
 * funciones normalizan el string a UTC antes de construir el Date.
 */

/** Convierte un timestamp crudo de la BD a un objeto Date correcto (UTC). */
export function parseDbDate(ts) {
	if (!ts) return null;
	if (ts instanceof Date) return ts;
	// Si ya viene en ISO con zona (T...Z o con offset) se usa tal cual.
	const str = String(ts);
	const normalized = str.includes('T') ? str : str.replace(' ', 'T') + 'Z';
	const d = new Date(normalized);
	return isNaN(d.getTime()) ? null : d;
}

/** Formatea la hora (HH:MM) de un timestamp de BD en la zona local. */
export function formatTime(ts, locale = 'es') {
	const d = parseDbDate(ts);
	if (!d) return '';
	return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
