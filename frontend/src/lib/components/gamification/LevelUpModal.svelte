<script>
	/**
	 * LevelUpModal.svelte - V-SOCIAL Level Up Celebration Modal
	 * Muestra una tarjeta inmersiva Glassmorphic + Neo-Aero cuando el usuario sube de nivel,
	 * con física de resorte, partículas de neón y fanfarria Web Audio API.
	 */
	import { uiStore } from '$lib/stores/ui.svelte.js';
	import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';

	let activeData = $derived(uiStore.levelUpData);

	// Fanfarria triunfal sintetizada con Web Audio API (C5 -> E5 -> G5 -> C6)
	function playLevelUpFanfare() {
		if (typeof window === 'undefined') return;
		try {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			if (!AudioCtx) return;
			const ctx = new AudioCtx();
			if (ctx.state === 'suspended') {
				ctx.resume();
			}

			const now = ctx.currentTime;
			const notes = [
				{ freq: 523.25, time: 0, duration: 0.15 }, // C5
				{ freq: 659.25, time: 0.12, duration: 0.15 }, // E5
				{ freq: 783.99, time: 0.24, duration: 0.18 }, // G5
				{ freq: 1046.5, time: 0.38, duration: 0.55 } // C6
			];

			notes.forEach(({ freq, time, duration }) => {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.type = 'triangle';
				osc.frequency.setValueAtTime(freq, now + time);

				gain.gain.setValueAtTime(0, now + time);
				gain.gain.linearRampToValueAtTime(0.22, now + time + 0.03);
				gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

				osc.connect(gain);
				gain.connect(ctx.destination);

				osc.start(now + time);
				osc.stop(now + time + duration);
			});
		} catch (_e) {
			// Ignorar bloqueos de autoplay pre-interacción
		}
	}

	$effect(() => {
		if (activeData) {
			playLevelUpFanfare();
		}
	});

	function handleClose() {
		uiStore.dismissLevelUp();
	}

	function handleKeydown(e) {
		if (e.key === 'Escape' && activeData) {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if activeData}
	<div class="levelup-backdrop" role="presentation" onclick={handleClose}>
		<div
			class="levelup-card glass-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="levelup-heading"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<!-- Resplandor bioluminiscente de fondo -->
			<div class="levelup-glow"></div>

			<!-- Halo decorativo animado -->
			<div class="levelup-ring"></div>

			<!-- Encabezado -->
			<div class="levelup-header">
				<span class="levelup-kicker">¡NUEVO LOGRO EN PLATAFORMA!</span>
				<h2 id="levelup-heading" class="levelup-title">¡SUBIDA DE NIVEL!</h2>
			</div>

			<!-- Insignia de Nivel Gigante con Física -->
			<div class="levelup-badge-stage">
				<LevelBadge level={activeData.level} size="lg" showText={false} />
				<div class="levelup-number-glow">NIVEL {activeData.level}</div>
			</div>

			<!-- Mensaje y Detalles -->
			<div class="levelup-body">
				<p class="levelup-message">
					{activeData.message ||
						`¡Felicidades! Has alcanzado el Nivel ${activeData.level} en V-SOCIAL.`}
				</p>
				{#if activeData.xpGained > 0}
					<div class="levelup-xp-pill">
						<span class="xp-icon">⚡</span>
						<span class="xp-val">+{activeData.xpGained} XP Ganados</span>
					</div>
				{/if}
			</div>

			<!-- Acciones -->
			<div class="levelup-actions">
				<button type="button" class="btn-aero-primary levelup-btn" onclick={handleClose}>
					¡GENIAL!
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.levelup-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal-backdrop, 500);
		background: rgba(4, 12, 24, 0.72);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		display: grid;
		place-items: center;
		padding: 1.5rem;
		animation: vsFadeIn 0.25s var(--ease-out) forwards;
	}

	.levelup-card {
		position: relative;
		z-index: var(--z-modal-content, 600);
		width: 100%;
		max-width: 440px;
		padding: 2.5rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1.5rem;
		border-radius: var(--radius-xl, 28px);
		background: var(--glass-bg, rgba(15, 23, 42, 0.85));
		border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.15));
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.23),
			0 0 40px rgba(var(--accent-blue-rgb), 0.3),
			var(--glass-inset-highlight);
		overflow: hidden;
		animation: vsLevelUpEnter 0.5s var(--ease-spring) forwards;
	}

	.levelup-glow {
		position: absolute;
		top: -30%;
		left: 50%;
		transform: translateX(-50%);
		width: 160%;
		height: 80%;
		background: radial-gradient(
			ellipse at 50% 30%,
			rgba(var(--accent-blue-rgb), 0.35) 0%,
			rgba(0, 212, 170, 0.08) 40%,
			transparent 75%
		);
		pointer-events: none;
		z-index: 0;
	}

	.levelup-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -60%);
		width: 260px;
		height: 260px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		border: 1px dashed rgba(46, 180, 255, 0.25);
		animation: vsSpinRing 20s linear infinite;
		pointer-events: none;
		z-index: 0;
	}

	.levelup-header,
	.levelup-badge-stage,
	.levelup-body,
	.levelup-actions {
		position: relative;
		z-index: 1;
	}

	.levelup-kicker {
		font-family: var(--font-display);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.22em;
		color: var(--accent-blue-light, #2eb4ff);
		text-transform: uppercase;
	}

	.levelup-title {
		margin: 0.25rem 0 0 0;
		font-family: var(--font-display);
		font-size: 1.85rem;
		font-weight: 900;
		letter-spacing: -0.02em;
		background: linear-gradient(135deg, #ffffff 0%, #2eb4ff 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		filter: drop-shadow(0 2px 8px rgba(var(--accent-blue-rgb), 0.4));
	}

	.levelup-badge-stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		margin: 0.5rem 0;
		transform: scale(1.35);
	}

	.levelup-number-glow {
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: var(--accent-blue-light, #2eb4ff);
		text-shadow: 0 0 12px rgba(46, 180, 255, 0.6);
	}

	.levelup-message {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--text-primary, #f8fafc);
		font-weight: 500;
	}

	.levelup-xp-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
		padding: 0.4rem 1rem;
		border-radius: var(--radius-full, 9999px);
		background: rgba(0, 212, 170, 0.12);
		border: 1px solid rgba(0, 212, 170, 0.14);
		color: #00d4aa;
		font-weight: 700;
		font-size: 0.85rem;
		box-shadow: 0 0 15px rgba(0, 212, 170, 0.08);
	}

	.levelup-actions {
		width: 100%;
		margin-top: 0.5rem;
	}

	.levelup-btn {
		width: 100%;
		padding: 0.85rem 1.5rem;
		font-size: 1rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		border-radius: var(--radius-lg, 20px);
		cursor: pointer;
		box-shadow: 0 8px 24px rgba(var(--accent-blue-rgb), 0.4);
		transition:
			transform var(--t-spring),
			box-shadow var(--t-base);
	}

	.levelup-btn:hover {
		transform: translateY(-2px) scale(1.02);
		box-shadow: 0 12px 30px rgba(var(--accent-blue-rgb), 0.6);
	}

	.levelup-btn:active {
		transform: translateY(0) scale(0.98);
	}

	@keyframes vsFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes vsLevelUpEnter {
		from {
			opacity: 0;
			transform: translateY(24px) scale(0.9);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes vsSpinRing {
		to {
			transform: translate(-50%, -60%) rotate(360deg);
		}
	}
</style>
