/**
 * sound.js — Utilidades de sonido para el chat (estilo MSN Messenger).
 *
 * Controla la reproducción del sonido de Zumbido (nudge.mp3) con precalentamiento
 * de audio, sintetizador Web Audio de respaldo y persistencia de preferencia en localStorage.
 */

const STORAGE_KEY = 'vsocial_chat_sound';
const NUDGE_SRC = '/sounds/nudge.mp3';

let nudgeAudio = null;
let audioContext = null;
let audioUnlocked = false;

/**
 * Desbloquea el audio en la primera interacción del usuario
 * para evitar restricciones de Autoplay en eventos de WebSocket.
 */
export function unlockAudio() {
	if (audioUnlocked || typeof window === 'undefined') return;
	try {
		if (!nudgeAudio) {
			nudgeAudio = new Audio(NUDGE_SRC);
			nudgeAudio.volume = 0.7;
			nudgeAudio.preload = 'auto';
		}
		const AudioCtx = window.AudioContext || window.webkitAudioContext;
		if (AudioCtx && !audioContext) {
			audioContext = new AudioCtx();
		}
		if (audioContext && audioContext.state === 'suspended') {
			audioContext.resume().catch(() => {});
		}
		audioUnlocked = true;
	} catch {
		/* no-op */
	}
}

// Auto-inicialización de desbloqueo en la primera interacción
if (typeof window !== 'undefined') {
	const unlockHandler = () => {
		unlockAudio();
		window.removeEventListener('pointerdown', unlockHandler);
		window.removeEventListener('keydown', unlockHandler);
	};
	window.addEventListener('pointerdown', unlockHandler, { once: true, passive: true });
	window.addEventListener('keydown', unlockHandler, { once: true, passive: true });
}

export function isSoundEnabled() {
	if (typeof localStorage === 'undefined') return true;
	return localStorage.getItem(STORAGE_KEY) !== '0';
}

export function setSoundEnabled(enabled) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}

/**
 * Sintetizador Web Audio API de respaldo para el sonido de Zumbido MSN
 * (doble acorde vibrante metálico con modulación de frecuencia)
 */
function playMsnNudgeSynth() {
	if (typeof window === 'undefined') return;
	try {
		const AudioCtx = window.AudioContext || window.webkitAudioContext;
		if (!AudioCtx) return;
		const ctx = audioContext || new AudioCtx();
		if (ctx.state === 'suspended') {
			ctx.resume().catch(() => {});
		}

		const now = ctx.currentTime;

		// Oscilador 1: Impacto metálico bajo (tono 180Hz -> 90Hz rápido)
		const osc1 = ctx.createOscillator();
		const gain1 = ctx.createGain();
		osc1.type = 'sawtooth';
		osc1.frequency.setValueAtTime(180, now);
		osc1.frequency.exponentialRampToValueAtTime(70, now + 0.18);
		gain1.gain.setValueAtTime(0.3, now);
		gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
		osc1.connect(gain1);
		gain1.connect(ctx.destination);
		osc1.start(now);
		osc1.stop(now + 0.22);

		// Oscilador 2: Zumbido resonante de campana / cristal MSN (680Hz -> 540Hz)
		const osc2 = ctx.createOscillator();
		const gain2 = ctx.createGain();
		osc2.type = 'sine';
		osc2.frequency.setValueAtTime(680, now + 0.04);
		osc2.frequency.linearRampToValueAtTime(540, now + 0.28);
		gain2.gain.setValueAtTime(0.25, now + 0.04);
		gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
		osc2.connect(gain2);
		gain2.connect(ctx.destination);
		osc2.start(now + 0.04);
		osc2.stop(now + 0.35);

		// Oscilador 3: Eco secundario agudo (880Hz -> 660Hz)
		const osc3 = ctx.createOscillator();
		const gain3 = ctx.createGain();
		osc3.type = 'sine';
		osc3.frequency.setValueAtTime(880, now + 0.12);
		osc3.frequency.exponentialRampToValueAtTime(660, now + 0.4);
		gain3.gain.setValueAtTime(0.18, now + 0.12);
		gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
		osc3.connect(gain3);
		gain3.connect(ctx.destination);
		osc3.start(now + 0.12);
		osc3.stop(now + 0.45);
	} catch {
		/* no-op */
	}
}

/**
 * Reproduce el sonido de Zumbido si el sonido está habilitado.
 * Intenta primero el archivo MP3 y recurre al sintetizador si es necesario.
 */
export function playNudge() {
	if (typeof window === 'undefined' || !isSoundEnabled()) return;
	unlockAudio();
	try {
		if (!nudgeAudio) {
			nudgeAudio = new Audio(NUDGE_SRC);
			nudgeAudio.volume = 0.7;
		}
		nudgeAudio.currentTime = 0;
		const promise = nudgeAudio.play();
		if (promise !== undefined) {
			promise.catch(() => {
				playMsnNudgeSynth();
			});
		}
	} catch {
		playMsnNudgeSynth();
	}
}
