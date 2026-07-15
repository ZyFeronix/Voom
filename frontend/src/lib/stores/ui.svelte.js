const SIDEBAR_KEY = 'vs_sidebar_expanded';

function getInitialSidebarState() {
	if (typeof localStorage === 'undefined') return true;
	const stored = localStorage.getItem(SIDEBAR_KEY);
	return stored === null ? true : stored === 'true';
}

export const uiStore = $state({
	sidebarExpanded: getInitialSidebarState(),

	toggleSidebar() {
		this.sidebarExpanded = !this.sidebarExpanded;
		try {
			localStorage.setItem(SIDEBAR_KEY, String(this.sidebarExpanded));
		} catch {}
	}
});
