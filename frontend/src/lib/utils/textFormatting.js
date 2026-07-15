/**
 * Escapes HTML special characters to prevent XSS injection.
 * Must be applied before any HTML rendering of user content.
 */
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
 * - Wraps #hashtags in styled anchor links pointing to /explore
 * 
 * Safe to use with {@html} after this function.
 */
export function formatHashtags(text) {
	if (!text) return '';
	const escaped = escapeHtml(text);
	return escaped.replace(
		/#(\w+)/g,
		'<a href="/explore?q=%23$1" class="hashtag-link" onclick="event.stopPropagation()">#$1</a>'
	);
}
