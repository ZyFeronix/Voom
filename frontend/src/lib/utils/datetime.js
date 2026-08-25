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

/**
 * Etiqueta de día para separadores dentro del chat.
 * Hoy / Ayer / nombre del día de esta semana / fecha corta en su defecto.
 */
export function formatDayLabel(ts, locale = 'es') {
	const d = parseDbDate(ts);
	if (!d) return '';
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const diffDays = Math.round((startOfToday - startOfThatDay) / 86400000);
	if (diffDays === 0) return 'Hoy';
	if (diffDays === 1) return 'Ayer';
	if (diffDays > 1 && diffDays < 7) {
		const label = d.toLocaleDateString(locale, { weekday: 'long' });
		return label.charAt(0).toUpperCase() + label.slice(1);
	}
	return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** ¿El timestamp cae en un día distinto al anterior? (para separadores del chat). */
export function isDifferentDay(prevTs, ts) {
	const a = parseDbDate(prevTs);
	const b = parseDbDate(ts);
	if (!a || !b) return true;
	return (
		a.getFullYear() !== b.getFullYear() ||
		a.getMonth() !== b.getMonth() ||
		a.getDate() !== b.getDate()
	);
}

/** Hora relativa compacta para la lista de conversaciones: 09:41 · Ayer · Lun · 12/05. */
export function formatListTime(ts, locale = 'es') {
	const d = parseDbDate(ts);
	if (!d) return '';
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const diffDays = Math.round((startOfToday - startOfThatDay) / 86400000);
	if (diffDays === 0) return formatTime(ts, locale);
	if (diffDays === 1) return 'Ayer';
	if (diffDays > 1 && diffDays < 7) {
		const label = d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '');
		return label.charAt(0).toUpperCase() + label.slice(1);
	}
	const sameYear = d.getFullYear() === now.getFullYear();
	return d.toLocaleDateString(
		locale,
		sameYear
			? { day: '2-digit', month: '2-digit' }
			: { day: '2-digit', month: '2-digit', year: '2-digit' }
	);
}

/** "Visto hace X": minutos/horas/días desde un timestamp. */
export function lastSeenLabel(ts) {
	if (!ts) return 'Desconectado';
	const then = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z').getTime();
	if (isNaN(then)) return 'Desconectado';
	const diffMin = Math.floor((Date.now() - then) / 60000);
	if (diffMin < 1) return 'Visto hace un momento';
	if (diffMin < 60) return `Visto hace ${diffMin} min`;
	const diffH = Math.floor(diffMin / 60);
	if (diffH < 24) return `Visto hace ${diffH} h`;
	const diffD = Math.floor(diffH / 24);
	return `Visto hace ${diffD} d`;
}
