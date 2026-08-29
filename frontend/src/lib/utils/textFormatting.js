/**
 * Escapes HTML special characters to prevent XSS injection.
 * Must be applied before any HTML rendering of user content.
 */
import { emoteFor } from '$lib/data/msnEmoticons.js';

export function escapeHtml(unsafe) {
	if (!unsafe) return '';
	return unsafe
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Formats text for display in posts, comments, bios, etc.
 * - Escapes HTML (XSS protection)
 * - Wraps URLs in styled anchor links (opens in new tab)
 * - Wraps #hashtags in styled anchor links pointing to /explore
 * - Wraps @mentions in styled anchor links pointing to /u/[username]
 * - Replaces emojis with emote propio del set Voom! (img con alt=unicode,
 *   así el texto se conserva al copiar/pegar)
 *
 * Safe to use with {@html} after this function.
 */
export function formatHashtags(text) {
	if (!text) return '';
	let escaped = escapeHtml(text);

	// URLs (http/https)
	escaped = escaped.replace(
		/(https?:\/\/[^\s<]+)/g,
		'<a href="$1" target="_blank" rel="noopener noreferrer" class="url-link hashtag-link" onclick="event.stopPropagation()">$1</a>'
	);

	// #hashtags (supports unicode / accented characters)
	escaped = escaped.replace(/(?:^|\s)#([a-zA-ZÀ-ÿ0-9_]{1,50})/g, (match, tag) => {
		const prefix = match.startsWith(' ') || match.startsWith('\n') ? match[0] : '';
		return `${prefix}<a href="/explore?q=%23${encodeURIComponent(tag)}" class="hashtag-link" onclick="event.stopPropagation()">#${tag}</a>`;
	});

	// @mentions
	escaped = escaped.replace(/(?:^|\s)@([a-zA-Z0-9_]{1,32})/g, (match, user) => {
		const prefix = match.startsWith(' ') || match.startsWith('\n') ? match[0] : '';
		return `${prefix}<a href="/u/${encodeURIComponent(user)}" class="mention-link hashtag-link" onclick="event.stopPropagation()">@${user}</a>`;
	});

	// Emojis con emote propio del set Voom! (post-escape: el HTML ya es seguro)
	escaped = replaceVoomEmotes(escaped);

	return escaped;
}

// Un solo grapheme emoji: pictográfico + VS16 + secuencias ZWJ + skin tones.
const EMOJI_SEQ =
	/(\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])(\uFE0F)?(\u200D(?:\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])(\uFE0F)?)*/gu;

function replaceVoomEmotes(html) {
	if (!/[\p{Extended_Pictographic}]/u.test(html)) return html;
	return html.replace(EMOJI_SEQ, (seq) => {
		const meta = emoteFor(seq);
		if (!meta) return seq;
		return `<img class="msn-emoji-render" src="${meta.url}" alt="${meta.emoji}" title="${meta.name}" loading="lazy" decoding="async" />`;
	});
}
