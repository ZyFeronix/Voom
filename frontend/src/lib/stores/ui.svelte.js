const SIDEBAR_KEY = 'vs_sidebar_expanded';

function getInitialSidebarState() {
	if (typeof localStorage === 'undefined') return true;
	const stored = localStorage.getItem(SIDEBAR_KEY);
	return stored === null ? true : stored === 'true';
}

export const uiStore = $state({
	sidebarExpanded: getInitialSidebarState(),
	drawerOpen: false,

	// ── Control global de popovers / dropdowns / menús desplegables ──
	// Garantiza que solo haya un popover/menú flotante abierto a la vez en toda la plataforma.
	activePopoverId: null,

	/**
	 * Alterna un popover/menú activo. Si ya había otro abierto,
	 * lo cierra automáticamente antes de abrir el nuevo.
	 * @param {any} id Identificador único del popover
	 * @returns {boolean} true si queda abierto, false si se cerró
	 */
	togglePopover(id) {
		if (this.activePopoverId === id) {
			this.activePopoverId = null;
			return false;
		}
		this.activePopoverId = id;
		return true;
	},

	/** Abre explícitamente un popover, cerrando cualquier otro previo. */
	openPopover(id) {
		this.activePopoverId = id;
	},

	/** Cierra un popover específico si coincide con el activo. */
	closePopover(id) {
		if (this.activePopoverId === id) {
			this.activePopoverId = null;
		}
	},

	/** Cierra todos los popovers y menús abiertos. */
	closeAllPopovers() {
		this.activePopoverId = null;
	},

	/** Comprueba si el popover dado es el que está actualmente abierto. */
	isPopoverOpen(id) {
		return this.activePopoverId === id;
	},

	// ── Confirmación global (sustituye a confirm() nativo) ──
	// ConfirmModal.svelte renderiza lo que haya aquí. requestConfirm()
	// devuelve una Promise<boolean> resuelta por resolveConfirm().
	confirmRequest: null,

	/**
	 * Pide confirmación al usuario con el modal glass de la plataforma.
	 * @param {{title: string, message?: string, danger?: boolean,
	 *          confirmText?: string, cancelText?: string}} opts
	 * @returns {Promise<boolean>} true si confirma, false si cancela.
	 */
	requestConfirm(opts) {
		if (this.confirmRequest?._resolve) this.resolveConfirm(false);
		return new Promise((resolve) => {
			this.confirmRequest = {
				title: opts?.title ?? '¿Confirmar?',
				message: opts?.message ?? '',
				danger: opts?.danger === true,
				confirmText: opts?.confirmText,
				cancelText: opts?.cancelText,
				_resolve: resolve
			};
		});
	},

	/** Resuelve la petición activa (true = confirmar, false = cancelar). */
	resolveConfirm(value) {
		const resolve = this.confirmRequest?._resolve;
		this.confirmRequest = null;
		resolve?.(value === true);
	},

	toggleSidebar() {
		// En móviles y tablets (<1024px) el toggle abre/cierra el Drawer flotante.
		// En PC/desktop (>=1024px) colapsa/expande el rail (80px <-> 250px).
		if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
			this.drawerOpen = !this.drawerOpen;
			return;
		}
		this.sidebarExpanded = !this.sidebarExpanded;
		try {
			localStorage.setItem(SIDEBAR_KEY, String(this.sidebarExpanded));
		} catch {}
	},

	openDrawer() {
		this.drawerOpen = true;
	},

	closeDrawer() {
		this.drawerOpen = false;
	},

	// ── Modal de Subida de Nivel (LevelUpModal.svelte) ──
	levelUpData: null,

	/**
	 * Muestra la celebración global de subida de nivel.
	 * @param {{level: number, xpGained?: number, message?: string}} data
	 */
	showLevelUp(data) {
		this.levelUpData = data;
	},

	dismissLevelUp() {
		this.levelUpData = null;
	}
});
