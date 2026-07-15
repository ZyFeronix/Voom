/**
 * No-op stub: emoji rendering now handled by the 'Noto Color Emoji' CSS font.
 * Kept for backward compatibility with `use:twemojiAction` directives in templates.
 * All those directives are harmless and can be removed incrementally.
 */
export function twemojiAction(node) {
	// No-op: Noto Color Emoji font renders all emoji natively via CSS.
	return {
		destroy() {}
	};
}
