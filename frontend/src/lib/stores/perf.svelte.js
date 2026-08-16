/**
 * Performance & Low-Power Mode Store (Svelte 5 Runes)
 * Manages performance mode, reduced motion, liquid background toggles and hardware auto-detection.
 */

let _perfMode = $state(false);
let _reduceMotion = $state(false);
let _disableLiquidBg = $state(false);
let _hardwareInfo = $state({
	cores: 4,
	memoryGB: null,
	isLowEnd: false,
	detected: false
});

function syncDomAttributes() {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-perf-mode', _perfMode ? 'true' : 'false');
	document.documentElement.setAttribute('data-reduced-motion', _reduceMotion ? 'true' : 'false');
}

export const perfStore = {
	get perfMode() {
		return _perfMode;
	},
	get reduceMotion() {
		return _reduceMotion;
	},
	get disableLiquidBg() {
		return _disableLiquidBg;
	},
	get hardwareInfo() {
		return _hardwareInfo;
	},

	init() {
		if (typeof window === 'undefined') return;

		try {
			const savedPerf = localStorage.getItem('vsocial_perf_mode');
			const savedMotion = localStorage.getItem('vsocial_reduce_motion');
			const savedBg = localStorage.getItem('vsocial_disable_liquid_bg');

			_perfMode = savedPerf === 'true';
			_reduceMotion = savedMotion === 'true';
			_disableLiquidBg = savedBg === 'true';

			this.detectHardware();
			syncDomAttributes();
		} catch (_e) {}
	},

	detectHardware() {
		if (typeof navigator === 'undefined') return _hardwareInfo;

		const cores = navigator.hardwareConcurrency || 4;
		const memoryGB = navigator.deviceMemory || null;
		// Heurística de equipo de bajos recursos: 4 o menos núcleos lógicos o <= 4GB RAM
		const isLowEnd = cores <= 4 || (memoryGB !== null && memoryGB <= 4);

		_hardwareInfo = {
			cores,
			memoryGB,
			isLowEnd,
			detected: true
		};

		return _hardwareInfo;
	},

	setPerfMode(enabled) {
		_perfMode = !!enabled;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('vsocial_perf_mode', _perfMode ? 'true' : 'false');
		}
		syncDomAttributes();
	},

	setReduceMotion(enabled) {
		_reduceMotion = !!enabled;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('vsocial_reduce_motion', _reduceMotion ? 'true' : 'false');
		}
		syncDomAttributes();
	},

	setDisableLiquidBg(enabled) {
		_disableLiquidBg = !!enabled;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('vsocial_disable_liquid_bg', _disableLiquidBg ? 'true' : 'false');
		}
	},

	applyRecommendedSettings() {
		this.setPerfMode(true);
		this.setReduceMotion(true);
		this.setDisableLiquidBg(true);
	}
};
