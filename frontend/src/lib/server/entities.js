/**
 * VSocial — Entity Parser
 * Converts #hashtags, @mentions, URLs into styled <a> tags.
 * XSS-safe: escapes all HTML before parsing.
 */

function escapeHtml(str) {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

export function parseEntities(raw) {
	if (!raw) return '';
	let text = escapeHtml(raw);

	// URLs (http/https)
	text = text.replace(
		/(https?:\/\/[^\s<]+)/g,
		'<a href="$1" target="_blank" rel="noopener noreferrer" class="entity-url">$1</a>'
	);

	// #hashtags
	text = text.replace(/(?:^|\s)#([a-zA-ZÀ-ÿ0-9_]{1,50})/g, (match, tag) => {
		const prefix = match.startsWith(' ') || match.startsWith('\n') ? match[0] : '';
		return `${prefix}<a href="/explore?q=%23${encodeURIComponent(tag)}" class="entity-hashtag">#${tag}</a>`;
	});

	// @mentions
	text = text.replace(/(?:^|\s)@([a-zA-Z0-9_]{1,32})/g, (match, user) => {
		const prefix = match.startsWith(' ') || match.startsWith('\n') ? match[0] : '';
		return `${prefix}<a href="/u/${encodeURIComponent(user)}" class="entity-mention">@${user}</a>`;
	});

	return text;
}

export function extractHashtags(raw) {
	if (!raw) return [];
	const matches = raw.matchAll(/(?:^|\s)#([a-zA-ZÀ-ÿ0-9_]{1,50})/g);
	return [...matches].map((m) => m[1].toLowerCase());
}

export function extractMentions(raw) {
	if (!raw) return [];
	const matches = raw.matchAll(/(?:^|\s)@([a-zA-Z0-9_]{1,32})/g);
	return [...matches].map((m) => m[1].toLowerCase());
}

export function sanitizeHtml(html) {
	if (!html) return '';
	return html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
		.replace(/on\w+\s*=\s*[^\s>]*/gi, '')
		.replace(/javascript\s*:/gi, '')
		.replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '')
		.replace(/<embed\b[^>]*>/gi, '')
		.replace(/<object\b[^>]*>.*?<\/object>/gi, '');
}
