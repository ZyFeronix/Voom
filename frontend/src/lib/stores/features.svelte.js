/**
 * Features Store — manages platform modes and feature flags globally
 * Uses Svelte 5 runes
 */

export const featureStore = $state({
	platform_mode: 'custom',
	reels_enabled: true,
	stories_enabled: true,
	groups_enabled: true,
	marketplace_enabled: true,
	gamification_enabled: true,

	initFeatures(serverSettings) {
		if (!serverSettings) return;

		this.platform_mode = serverSettings.platform_mode || 'custom';

		const parseBool = (val) => val !== '0' && val !== false && val !== 'false';

		this.reels_enabled = parseBool(serverSettings.reels_enabled);
		this.stories_enabled = parseBool(serverSettings.stories_enabled);
		this.groups_enabled = parseBool(serverSettings.groups_enabled);
		this.marketplace_enabled = parseBool(serverSettings.marketplace_enabled);
		this.gamification_enabled = parseBool(serverSettings.gamification_enabled);
	}
});
