<script>
	import { fly, scale, fade } from 'svelte/transition';
	import { quintOut, backOut, cubicOut } from 'svelte/easing';

	let {
		streak = 0,
		canCheckin = false,
		nextCheckin: _nextCheckin = null,
		disabled = false,
		oncheckin
	} = $props();

	let isPressing = $state(false);
	let progress = $state(0);
	let isCompleted = $state(false);
	let showXpBadge = $state(false);
	let animationFrame = null;
	let pressStartTime = 0;
	let lastVibrateMilestone = 0;
	let actualXpAwarded = $state(null);
	let particles = $state([]);

	// Duración requerida para mantener presionado (ms)
	const HOLD_DURATION = 1100;

	// ── Racha calculada y Tier temático ──────────────────────────────────────
	let nextStreak = $derived(isCompleted ? streak + 1 : streak);
	let calculatedBonus = $derived(Math.min(Math.max(0, (nextStreak - 1) * 2), 50));
	const BASE_REWARD_XP = 10;
	let totalExpectedXp = $derived(BASE_REWARD_XP + calculatedBonus);
	let displayXp = $derived(actualXpAwarded !== null ? actualXpAwarded : totalExpectedXp);

	// Tier de Racha según los días consecutivos:
	// starter: 1-2d | fire: 3-6d | surge: 7-13d (semana) | epic: 14-29d | legendary: 30+d (mes)
	let streakTier = $derived.by(() => {
		const s = nextStreak;
		if (s >= 30) return 'legendary';
		if (s >= 14) return 'epic';
		if (s >= 7) return 'surge';
		if (s >= 3) return 'fire';
		return 'starter';
	});

	// Configuraciones temáticas según el tier de racha
	const TIER_CONFIG = {
		starter: {
			name: 'Iniciado',
			tagText: '¡Primer paso de racha!',
			subText: 'Racha iniciada',
			icon: 'bolt',
			flameIcon: 'local_fire_department',
			glowColor: 'rgba(0, 212, 170, 0.7)'
		},
		fire: {
			name: 'Ardiente',
			tagText: '🔥 ¡Racha Caliente!',
			subText: 'Bonus de Fuego Activo',
			icon: 'local_fire_department',
			flameIcon: 'local_fire_department',
			glowColor: 'rgba(249, 115, 22, 0.8)'
		},
		surge: {
			name: 'Tormenta',
			tagText: '⚡ ¡Semana Imparable!',
			subText: 'Bonus Tormenta Activo',
			icon: 'flash_on',
			flameIcon: 'flash_on',
			glowColor: 'rgba(46, 180, 255, 0.85)'
		},
		epic: {
			name: 'Épico',
			tagText: '💎 ¡Racha Épica!',
			subText: 'Multiplicador Maestro',
			icon: 'diamond',
			flameIcon: 'diamond',
			glowColor: 'rgba(217, 70, 239, 0.9)'
		},
		legendary: {
			name: 'Legendario',
			tagText: '👑 ¡LEYENDA SOLAR!',
			subText: 'MÁXIMO BONUS ALCANZADO',
			icon: 'workspace_premium',
			flameIcon: 'workspace_premium',
			glowColor: 'rgba(251, 191, 36, 1)'
		}
	};

	let activeTierConfig = $derived(TIER_CONFIG[streakTier] || TIER_CONFIG.starter);

	function triggerHaptic(pattern = 10) {
		if (
			typeof window !== 'undefined' &&
			'vibrate' in navigator &&
			typeof navigator.vibrate === 'function'
		) {
			try {
				navigator.vibrate(pattern);
			} catch {
				// Ignorar si el navegador no soporta vibración
			}
		}
	}

	// ── Fanfarria Sonora Sintetizada con Web Audio API ───────────────────────
	function playCelebrationSound(tier) {
		if (typeof window === 'undefined') return;
		try {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			if (!AudioCtx) return;
			const ctx = new AudioCtx();
			if (ctx.state === 'suspended') {
				ctx.resume();
			}

			const now = ctx.currentTime;
			const tierChords = {
				starter: [
					{ freq: 523.25, time: 0, dur: 0.12 }, // C5
					{ freq: 659.25, time: 0.08, dur: 0.14 }, // E5
					{ freq: 783.99, time: 0.16, dur: 0.2 }, // G5
					{ freq: 1046.5, time: 0.24, dur: 0.42 } // C6
				],
				fire: [
					{ freq: 440.0, time: 0, dur: 0.12 }, // A4
					{ freq: 554.37, time: 0.07, dur: 0.14 }, // C#5
					{ freq: 659.25, time: 0.14, dur: 0.16 }, // E5
					{ freq: 880.0, time: 0.21, dur: 0.22 }, // A5
					{ freq: 1108.7, time: 0.28, dur: 0.48 } // C#6
				],
				surge: [
					{ freq: 587.33, time: 0, dur: 0.12 }, // D5
					{ freq: 739.99, time: 0.07, dur: 0.14 }, // F#5
					{ freq: 880.0, time: 0.14, dur: 0.16 }, // A5
					{ freq: 1174.66, time: 0.21, dur: 0.22 }, // D6
					{ freq: 1479.98, time: 0.28, dur: 0.52 } // F#6
				],
				epic: [
					{ freq: 523.25, time: 0, dur: 0.12 },
					{ freq: 659.25, time: 0.06, dur: 0.14 },
					{ freq: 783.99, time: 0.12, dur: 0.16 },
					{ freq: 987.77, time: 0.18, dur: 0.18 },
					{ freq: 1046.5, time: 0.24, dur: 0.22 },
					{ freq: 1318.51, time: 0.3, dur: 0.58 }
				],
				legendary: [
					{ freq: 523.25, time: 0, dur: 0.14 },
					{ freq: 659.25, time: 0.06, dur: 0.15 },
					{ freq: 783.99, time: 0.12, dur: 0.18 },
					{ freq: 1046.5, time: 0.18, dur: 0.22 },
					{ freq: 1318.51, time: 0.24, dur: 0.26 },
					{ freq: 1567.98, time: 0.3, dur: 0.3 },
					{ freq: 2093.0, time: 0.36, dur: 0.72 }
				]
			};

			const notes = tierChords[tier] || tierChords.starter;
			notes.forEach(({ freq, time, dur }) => {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.type = tier === 'legendary' ? 'sine' : 'triangle';
				osc.frequency.setValueAtTime(freq, now + time);

				gain.gain.setValueAtTime(0, now + time);
				gain.gain.linearRampToValueAtTime(0.18, now + time + 0.02);
				gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start(now + time);
				osc.stop(now + time + dur);
			});
		} catch {
			// Ignorar si el audio no está permitido en el contexto actual
		}
	}

	// ── Generador Dinámico de Partículas 360° ────────────────────────────────
	function generateParticles(tier) {
		const countByTier = {
			starter: 26,
			fire: 32,
			surge: 38,
			epic: 44,
			legendary: 52
		};
		const count = countByTier[tier] || 28;
		const colorPalette = {
			starter: ['#00d4aa', '#1b85f3', '#2eb4ff', '#ffffff'],
			fire: ['#fbbf24', '#f97316', '#ef4444', '#fef08a', '#ffffff'],
			surge: ['#2eb4ff', '#8b5cf6', '#3b82f6', '#00f0ff', '#ffffff'],
			epic: ['#d946ef', '#ec4899', '#38bdf8', '#c084fc', '#ffffff'],
			legendary: ['#fbbf24', '#f59e0b', '#ffd700', '#fef08a', '#ffffff']
		};
		const colors = colorPalette[tier] || colorPalette.starter;
		const shapes = ['dot', 'star', 'diamond'];

		const list = [];
		for (let i = 0; i < count; i++) {
			const angle = (i / count) * 360 + (Math.random() * 18 - 9);
			const dist = 38 + Math.random() * 70;
			const size = 4 + Math.random() * 8;
			const delay = Math.floor(Math.random() * 110);
			const duration = 750 + Math.random() * 320;
			const color = colors[i % colors.length];
			const shape = shapes[i % shapes.length];
			const rotation = Math.floor(Math.random() * 360);

			list.push({
				id: i,
				angle,
				dist,
				size,
				delay,
				duration,
				color,
				shape,
				rotation
			});
		}
		return list;
	}

	function startPress(e) {
		if (disabled || !canCheckin || isCompleted) return;
		if (e && e.type === 'pointerdown' && e.button !== 0) return; // Solo click principal

		isPressing = true;
		pressStartTime = performance.now();
		lastVibrateMilestone = 0;
		triggerHaptic(12);

		if (animationFrame) cancelAnimationFrame(animationFrame);
		animationFrame = requestAnimationFrame(animateProgress);
	}

	function animateProgress(time) {
		if (!isPressing || isCompleted) return;

		const elapsed = time - pressStartTime;
		progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);

		// Haptic ticks en hitos de progreso: ~28%, 56%, 84%
		const currentMilestone = Math.floor(progress / 28);
		if (currentMilestone > lastVibrateMilestone) {
			lastVibrateMilestone = currentMilestone;
			triggerHaptic(8);
		}

		if (progress >= 100) {
			completeCheckin();
		} else {
			animationFrame = requestAnimationFrame(animateProgress);
		}
	}

	async function completeCheckin() {
		isPressing = false;
		progress = 100;
		isCompleted = true;
		showXpBadge = true;
		if (animationFrame) cancelAnimationFrame(animationFrame);

		// 1. Generar explosión de partículas reactiva a la racha
		particles = generateParticles(streakTier);

		// 2. Reproducir fanfarria sonora y respuesta háptica
		playCelebrationSound(streakTier);
		triggerHaptic([30, 50, 60, 50, 100, 60, 140]);

		// 3. Invocar endpoint/callback del padre
		if (oncheckin) {
			try {
				const result = await oncheckin();
				if (result && result.xpAwarded) {
					actualXpAwarded = result.xpAwarded;
				}
			} catch {
				// Ignorar fallos de callback
			}
		}

		// 4. Auto-reset y ocultar badge después de que la celebración haya completado su ciclo
		setTimeout(() => {
			showXpBadge = false;
			if (!canCheckin) {
				progress = 0;
				isCompleted = false;
				actualXpAwarded = null;
			}
		}, 2700);
	}

	function cancelPress() {
		if (!isPressing || isCompleted) return;
		isPressing = false;
		if (animationFrame) cancelAnimationFrame(animationFrame);

		function reverseProgress() {
			if (isPressing || isCompleted) return;
			progress = Math.max(0, progress - 7);
			if (progress > 0) {
				animationFrame = requestAnimationFrame(reverseProgress);
			}
		}
		animationFrame = requestAnimationFrame(reverseProgress);
	}

	function handleKeyDown(e) {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			if (!isPressing && !isCompleted) {
				startPress(e);
			}
		}
	}

	function handleKeyUp(e) {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			cancelPress();
		}
	}
</script>

{#if canCheckin && !disabled}
	<div
		class="checkin-toast-wrapper mb-4 w-full"
		in:fly={{ y: 22, duration: 550, easing: quintOut, opacity: 0 }}
		out:fly={{ y: -18, duration: 380, opacity: 0 }}
	>
		<!-- Halo ambiental dinámico Neo-Aero -->
		<div
			class="checkin-ambient-glow tier-{streakTier}"
			class:is-pressing={isPressing}
			class:is-surge={progress >= 75}
			class:is-completed={isCompleted}
			aria-hidden="true"
		></div>

		<!-- ── MEGA-BADGE FLOTANTE "+XX XP" Y CELEBRACIÓN DE RACHA ─────────── -->
		{#if isCompleted && showXpBadge}
			<div
				class="floating-xp-burst tier-{streakTier}"
				in:scale={{ duration: 460, start: 0.35, easing: backOut }}
				out:fade={{ duration: 300, easing: cubicOut }}
				aria-live="polite"
			>
				<!-- Resplandor exterior de la insignia -->
				<div class="xp-burst-glow"></div>

				<!-- Cristal volumétrico de la insignia -->
				<div class="xp-burst-glass">
					<!-- Destello especular superior -->
					<div class="xp-glass-highlight"></div>

					<div class="xp-badge-content">
						<!-- Icono de Racha -->
						<div class="xp-badge-icon-wrap">
							<span class="material-icons-round xp-badge-icon">
								{activeTierConfig.icon}
							</span>
						</div>

						<!-- Números Principales de Puntos -->
						<div class="xp-badge-val-group">
							<span class="xp-badge-plus">+</span>
							<span class="xp-badge-number">{displayXp}</span>
							<span class="xp-badge-unit">XP</span>
						</div>
					</div>

					<!-- Sub-píldora con desglose de bonus de racha -->
					<div class="xp-streak-bonus-pill">
						{#if calculatedBonus > 0}
							<span class="bonus-fire-icon">🔥</span>
							<span class="bonus-text">+{calculatedBonus} XP Bonus ({nextStreak}d)</span>
						{:else}
							<span class="bonus-fire-icon">✨</span>
							<span class="bonus-text">{activeTierConfig.tagText}</span>
						{/if}
					</div>
				</div>

				<!-- Micro-puntos flotantes que se dispersan en arco hacia arriba -->
				<div class="micro-xp-drift-container" aria-hidden="true">
					<span class="micro-xp-spark micro-1">+{displayXp} XP</span>
					<span class="micro-xp-spark micro-2">🔥 x{nextStreak}</span>
					<span class="micro-xp-spark micro-3">✨ ¡Racha!</span>
				</div>
			</div>
		{/if}

		<!-- Botón interactivo principal -->
		<button
			type="button"
			class="checkin-btn tier-{streakTier} w-full relative overflow-hidden flex items-center justify-between transition-all"
			class:pressing={isPressing}
			class:surge={progress >= 85}
			class:completed={isCompleted}
			onpointerdown={startPress}
			onpointerup={cancelPress}
			onpointerleave={cancelPress}
			onpointercancel={cancelPress}
			onkeydown={handleKeyDown}
			onkeyup={handleKeyUp}
			oncontextmenu={(e) => e.preventDefault()}
			style="--progress: {progress}%;"
			aria-label="Registrar racha diaria de conexión"
			disabled={disabled || !canCheckin}
		>
			<!-- 1. Cristal de base Neo-Aero con bisel especular -->
			<div class="absolute inset-0 checkin-base-glass z-0">
				<!-- Destello especular dinámico que barre la superficie -->
				<div class="sheen-sweep-line" aria-hidden="true"></div>
			</div>

			<!-- 2. Barra de energía líquida bioluminiscente -->
			<div
				class="absolute top-0 left-0 h-full fill-bar tier-{streakTier} pointer-events-none z-0"
				class:completed={isCompleted}
				aria-hidden="true"
			>
				<!-- Textura interna de plasma fluido -->
				<div class="liquid-plasma-layer"></div>
				<!-- Menisco especular superior -->
				<div class="liquid-specular-edge"></div>
				<!-- Cabezal de energía / rayo luminoso frontal -->
				<div class="liquid-energy-head" class:active={isPressing && progress > 2 && progress < 100}>
					<div class="energy-core"></div>
					<div class="energy-halo"></div>
				</div>
			</div>

			<!-- 3. Destello de choque y micro-partículas de festejo -->
			<div
				class="absolute inset-0 checkin-flash-shockwave tier-{streakTier} pointer-events-none z-10"
				class:flash={isCompleted}
				aria-hidden="true"
			></div>

			{#if isCompleted}
				<!-- Ondas de choque concéntricas -->
				<div class="checkin-shockwave-ring tier-{streakTier}" aria-hidden="true"></div>
				<div class="checkin-shockwave-glow tier-{streakTier}" aria-hidden="true"></div>

				<!-- Explosión de partículas 360° dinámicas -->
				<div class="checkin-particles-burst pointer-events-none z-20" aria-hidden="true">
					{#each particles as p (p.id)}
						<span
							class="burst-sparkle shape-{p.shape} tier-{streakTier}"
							style="
								--p-angle: {p.angle}deg;
								--p-dist: {p.dist}px;
								--p-size: {p.size}px;
								--p-delay: {p.delay}ms;
								--p-dur: {p.duration}ms;
								--p-color: {p.color};
								--p-rot: {p.rotation}deg;
							"
						>
							{#if p.shape === 'star'}
								<svg class="sparkle-svg" viewBox="0 0 24 24" fill={p.color}>
									<path
										d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"
									/>
								</svg>
							{/if}
						</span>
					{/each}
				</div>
			{/if}

			<!-- 4. Burbuja del ícono / Diana táctil -->
			<div class="relative z-10 flex items-center justify-center checkin-icon-slot">
				<div
					class="checkin-icon-bubble tier-{streakTier}"
					class:charging={isPressing}
					class:completed={isCompleted}
				>
					<span class="material-icons-round checkin-icon" class:icon-bounce={isCompleted}>
						{isCompleted ? activeTierConfig.icon : isPressing ? 'bolt' : 'touch_app'}
					</span>
					{#if isPressing && !isCompleted}
						<div class="icon-pulse-ring"></div>
					{/if}
				</div>
			</div>

			<!-- 5. Columna de texto dinámico con física cinética -->
			<div
				class="relative z-10 flex flex-col items-center justify-center flex-1 text-center px-2 pointer-events-none checkin-center-col"
			>
				<span
					class="checkin-pretitle tier-{streakTier}"
					class:active={isPressing}
					class:completed={isCompleted}
				>
					{isCompleted
						? `¡+${displayXp} XP CONSEGUIDOS!`
						: isPressing
							? `CARGANDO • ${Math.round(progress)}%`
							: 'RACHA DIARIA'}
				</span>
				<span
					class="checkin-main-title tier-{streakTier}"
					class:completed={isCompleted}
					class:pressing={isPressing}
				>
					{isCompleted
						? `¡Racha de ${nextStreak} días asegurada!`
						: isPressing
							? 'Mantén presionado...'
							: 'Mantén presionado'}
				</span>
			</div>

			<!-- 6. Badge de racha con fuego reactivo -->
			<div class="relative z-10 flex-shrink-0 checkin-streak-slot">
				<div
					class="checkin-streak-pill tier-{streakTier}"
					class:pulse-flame={streak > 0}
					class:boosted={isCompleted}
				>
					<div class="flame-glow-halo" aria-hidden="true"></div>
					<span class="material-icons-round flame-icon" aria-hidden="true">
						{activeTierConfig.flameIcon}
					</span>
					<span class="streak-num">
						{isCompleted ? streak + 1 : streak}
					</span>
					{#if isCompleted}
						<span
							class="streak-plus-tag tier-{streakTier}"
							in:scale={{ duration: 380, start: 0.3, easing: backOut }}
						>
							+1
						</span>
					{/if}
				</div>
			</div>
		</button>
	</div>
{/if}

<style>
	/* ══════════════════════════════════════════════════════════════════════
	   CHECKIN TOAST CONTAINER — NEO-AERO GLASSMORPHISM 2.0
	   ══════════════════════════════════════════════════════════════════════ */
	.checkin-toast-wrapper {
		position: relative;
		z-index: 40;
		contain: visible;
		width: 100%;
	}

	/* ── MEGA-BADGE FLOTANTE "+XX XP" ─────────────────────────────────── */
	.floating-xp-burst {
		position: absolute;
		bottom: calc(100% + 12px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		animation: floatingXpFloat 2.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}

	@keyframes floatingXpFloat {
		0% {
			transform: translateX(-50%) translateY(20px) scale(0.6);
			opacity: 0;
		}
		18% {
			transform: translateX(-50%) translateY(-14px) scale(1.16);
			opacity: 1;
		}
		32% {
			transform: translateX(-50%) translateY(-10px) scale(1);
			opacity: 1;
		}
		75% {
			transform: translateX(-50%) translateY(-16px) scale(1);
			opacity: 1;
		}
		100% {
			transform: translateX(-50%) translateY(-34px) scale(0.92);
			opacity: 0;
		}
	}

	.xp-burst-glow {
		position: absolute;
		inset: -12px;
		border-radius: var(--radius-full, 9999px);
		filter: blur(14px);
		opacity: 0.85;
		z-index: 0;
	}

	.floating-xp-burst.tier-starter .xp-burst-glow {
		background: radial-gradient(circle, rgba(0, 212, 170, 0.8) 0%, transparent 70%);
	}
	.floating-xp-burst.tier-fire .xp-burst-glow {
		background: radial-gradient(
			circle,
			rgba(249, 115, 22, 0.9) 0%,
			rgba(239, 68, 68, 0.4) 60%,
			transparent 75%
		);
	}
	.floating-xp-burst.tier-surge .xp-burst-glow {
		background: radial-gradient(
			circle,
			rgba(46, 180, 255, 0.9) 0%,
			rgba(139, 92, 246, 0.5) 60%,
			transparent 75%
		);
	}
	.floating-xp-burst.tier-epic .xp-burst-glow {
		background: radial-gradient(
			circle,
			rgba(217, 70, 239, 0.9) 0%,
			rgba(236, 72, 153, 0.6) 60%,
			transparent 75%
		);
	}
	.floating-xp-burst.tier-legendary .xp-burst-glow {
		background: radial-gradient(
			circle,
			rgba(251, 191, 36, 1) 0%,
			rgba(245, 158, 11, 0.7) 50%,
			transparent 80%
		);
	}

	.xp-burst-glass {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 8px 18px 7px 18px;
		border-radius: var(--radius-xl, 24px);
		backdrop-filter: blur(16px) saturate(1.4);
		-webkit-backdrop-filter: blur(16px) saturate(1.4);
		background: rgba(10, 20, 32, 0.88);
		border: 1.5px solid rgba(255, 255, 255, 0.6);
		box-shadow:
			0 12px 32px rgba(0, 0, 0, 0.35),
			inset 0 1px 2px rgba(255, 255, 255, 0.75),
			inset 0 -1px 2px rgba(0, 0, 0, 0.3);
		overflow: hidden;
	}

	.floating-xp-burst.tier-starter .xp-burst-glass {
		border-color: rgba(0, 212, 170, 0.85);
		box-shadow:
			0 10px 30px rgba(0, 212, 170, 0.45),
			inset 0 1px 2px rgba(255, 255, 255, 0.8);
	}
	.floating-xp-burst.tier-fire .xp-burst-glass {
		border-color: rgba(251, 191, 36, 0.9);
		box-shadow:
			0 12px 34px rgba(249, 115, 22, 0.55),
			inset 0 1px 2px rgba(255, 255, 255, 0.9);
	}
	.floating-xp-burst.tier-surge .xp-burst-glass {
		border-color: rgba(46, 180, 255, 0.9);
		box-shadow:
			0 12px 34px rgba(99, 102, 241, 0.6),
			inset 0 1px 2px rgba(255, 255, 255, 0.9);
	}
	.floating-xp-burst.tier-epic .xp-burst-glass {
		border-color: rgba(217, 70, 239, 0.95);
		box-shadow:
			0 14px 38px rgba(217, 70, 239, 0.65),
			inset 0 1px 2px rgba(255, 255, 255, 0.9);
	}
	.floating-xp-burst.tier-legendary .xp-burst-glass {
		border-color: rgba(255, 255, 255, 0.95);
		background: linear-gradient(135deg, rgba(30, 20, 5, 0.92) 0%, rgba(15, 23, 42, 0.92) 100%);
		box-shadow:
			0 16px 44px rgba(251, 191, 36, 0.8),
			0 0 20px rgba(251, 191, 36, 0.6),
			inset 0 1px 3px rgba(255, 255, 255, 1);
	}

	.xp-glass-highlight {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 45%;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, transparent 100%);
		pointer-events: none;
	}

	.xp-badge-content {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.xp-badge-icon-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full, 9999px);
		background: rgba(255, 255, 255, 0.15);
		box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.6);
	}

	.xp-badge-icon {
		font-size: 18px;
		color: #ffffff;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
	}

	.xp-badge-val-group {
		display: flex;
		align-items: baseline;
		gap: 2px;
	}

	.xp-badge-plus {
		font-family: var(--font-display, inherit);
		font-size: 20px;
		font-weight: 900;
		color: #ffffff;
		line-height: 1;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
	}

	.xp-badge-number {
		font-family: var(--font-display, inherit);
		font-size: 26px;
		font-weight: 900;
		letter-spacing: -0.03em;
		line-height: 1;
		background: linear-gradient(180deg, #ffffff 30%, #e2e8f0 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
	}

	.floating-xp-burst.tier-starter .xp-badge-number {
		background: linear-gradient(180deg, #ffffff 20%, #00d4aa 100%);
		-webkit-background-clip: text;
		background-clip: text;
	}
	.floating-xp-burst.tier-fire .xp-badge-number {
		background: linear-gradient(180deg, #ffffff 15%, #fbbf24 60%, #f97316 100%);
		-webkit-background-clip: text;
		background-clip: text;
	}
	.floating-xp-burst.tier-surge .xp-badge-number {
		background: linear-gradient(180deg, #ffffff 15%, #2eb4ff 60%, #8b5cf6 100%);
		-webkit-background-clip: text;
		background-clip: text;
	}
	.floating-xp-burst.tier-epic .xp-badge-number {
		background: linear-gradient(180deg, #ffffff 15%, #f472b6 60%, #d946ef 100%);
		-webkit-background-clip: text;
		background-clip: text;
	}
	.floating-xp-burst.tier-legendary .xp-badge-number {
		background: linear-gradient(180deg, #ffffff 10%, #ffd700 55%, #f59e0b 100%);
		-webkit-background-clip: text;
		background-clip: text;
	}

	.xp-badge-unit {
		font-family: var(--font-display, inherit);
		font-size: 13px;
		font-weight: 900;
		letter-spacing: 0.05em;
		color: #ffffff;
		margin-left: 2px;
		opacity: 0.95;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
	}

	.xp-streak-bonus-pill {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: var(--radius-full, 9999px);
		background: rgba(255, 255, 255, 0.12);
		border: 1px solid rgba(255, 255, 255, 0.2);
		margin-top: 1px;
	}

	.bonus-fire-icon {
		font-size: 11px;
	}

	.bonus-text {
		font-size: 9.5px;
		font-weight: 800;
		letter-spacing: 0.02em;
		color: #ffffff;
		text-transform: uppercase;
	}

	/* Micro-sparks que flotan y se evaporan hacia arriba */
	.micro-xp-drift-container {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.micro-xp-spark {
		position: absolute;
		font-size: 11px;
		font-weight: 900;
		color: #ffffff;
		text-shadow: 0 0 8px rgba(255, 255, 255, 0.9);
		opacity: 0;
	}

	.micro-1 {
		top: -10px;
		left: -15px;
		animation: microSpark1 1.8s cubic-bezier(0.22, 1, 0.36, 1) 0.15s forwards;
	}

	.micro-2 {
		top: -18px;
		right: -20px;
		animation: microSpark2 1.9s cubic-bezier(0.22, 1, 0.36, 1) 0.25s forwards;
	}

	.micro-3 {
		bottom: -10px;
		left: 80%;
		animation: microSpark3 1.7s cubic-bezier(0.22, 1, 0.36, 1) 0.35s forwards;
	}

	@keyframes microSpark1 {
		0% {
			transform: translate(0, 0) scale(0.5);
			opacity: 0;
		}
		30% {
			transform: translate(-14px, -18px) scale(1.15);
			opacity: 1;
		}
		100% {
			transform: translate(-26px, -45px) scale(0.8);
			opacity: 0;
		}
	}

	@keyframes microSpark2 {
		0% {
			transform: translate(0, 0) scale(0.5);
			opacity: 0;
		}
		30% {
			transform: translate(16px, -20px) scale(1.15);
			opacity: 1;
		}
		100% {
			transform: translate(28px, -48px) scale(0.8);
			opacity: 0;
		}
	}

	@keyframes microSpark3 {
		0% {
			transform: translate(0, 0) scale(0.5);
			opacity: 0;
		}
		30% {
			transform: translate(10px, -15px) scale(1.1);
			opacity: 1;
		}
		100% {
			transform: translate(18px, -38px) scale(0.7);
			opacity: 0;
		}
	}

	/* ── Halo ambiental dinámico Neo-Aero ────────────────────────────── */
	.checkin-ambient-glow {
		position: absolute;
		inset: -3px;
		border-radius: calc(var(--radius-xl, 20px) + 3px);
		background: radial-gradient(
			circle at 50% 50%,
			rgba(27, 133, 243, 0.22) 0%,
			rgba(0, 212, 170, 0.14) 50%,
			transparent 75%
		);
		opacity: 0.6;
		filter: blur(10px);
		pointer-events: none;
		transition:
			opacity 0.4s var(--ease-smooth),
			transform 0.4s var(--ease-spring),
			background 0.4s ease;
		animation: ambientBreathe 4s ease-in-out infinite;
	}

	.checkin-ambient-glow.tier-fire {
		background: radial-gradient(
			circle at 50% 50%,
			rgba(249, 115, 22, 0.3) 0%,
			rgba(251, 191, 36, 0.18) 50%,
			transparent 75%
		);
	}
	.checkin-ambient-glow.tier-surge {
		background: radial-gradient(
			circle at 50% 50%,
			rgba(46, 180, 255, 0.3) 0%,
			rgba(139, 92, 246, 0.2) 50%,
			transparent 75%
		);
	}
	.checkin-ambient-glow.tier-epic {
		background: radial-gradient(
			circle at 50% 50%,
			rgba(217, 70, 239, 0.35) 0%,
			rgba(236, 72, 153, 0.22) 50%,
			transparent 75%
		);
	}
	.checkin-ambient-glow.tier-legendary {
		background: radial-gradient(
			circle at 50% 50%,
			rgba(251, 191, 36, 0.45) 0%,
			rgba(245, 158, 11, 0.3) 50%,
			transparent 75%
		);
	}

	.checkin-ambient-glow.is-pressing {
		opacity: 0.9;
		transform: scale(1.02);
		filter: blur(14px);
		animation: none;
	}

	.checkin-ambient-glow.is-surge {
		opacity: 1;
		filter: blur(18px);
		transform: scale(1.04);
	}

	.checkin-ambient-glow.is-completed {
		opacity: 1;
		filter: blur(20px);
		transform: scale(1.08);
	}

	@keyframes ambientBreathe {
		0%,
		100% {
			opacity: 0.5;
			transform: scale(0.98);
		}
		50% {
			opacity: 0.85;
			transform: scale(1.02);
		}
	}

	/* ── Botón Principal ─────────────────────────────────────────────── */
	.checkin-btn {
		min-height: 58px;
		flex: 0 0 auto;
		border-radius: var(--radius-xl, 20px);
		padding: 0 16px;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		background: transparent;
		border: none;
		outline: none;
		cursor: pointer;
		transform: translateZ(0);
		box-shadow:
			0 8px 24px -4px rgba(0, 0, 0, 0.12),
			0 2px 6px -1px rgba(0, 0, 0, 0.08);
		transition:
			transform 0.25s var(--ease-spring),
			box-shadow 0.25s var(--ease-out);
	}

	.checkin-btn:focus-visible {
		box-shadow:
			0 0 0 3px rgba(27, 133, 243, 0.5),
			0 8px 24px -4px rgba(0, 0, 0, 0.2);
	}

	.checkin-btn.pressing {
		transform: scale(0.975) translateY(1.5px);
		box-shadow:
			inset 0 2px 6px rgba(0, 0, 0, 0.2),
			0 2px 8px rgba(0, 0, 0, 0.08);
	}

	.checkin-btn.surge {
		animation: chargeMicroJitter 0.12s infinite alternate ease-in-out;
	}

	.checkin-btn.completed {
		transform: scale(1.02);
		box-shadow:
			0 12px 36px -4px rgba(0, 212, 170, 0.45),
			0 2px 8px -1px rgba(0, 0, 0, 0.08);
	}

	.checkin-btn.completed.tier-fire {
		box-shadow: 0 12px 36px -4px rgba(249, 115, 22, 0.5);
	}
	.checkin-btn.completed.tier-surge {
		box-shadow: 0 12px 36px -4px rgba(99, 102, 241, 0.55);
	}
	.checkin-btn.completed.tier-epic {
		box-shadow: 0 12px 36px -4px rgba(217, 70, 239, 0.6);
	}
	.checkin-btn.completed.tier-legendary {
		box-shadow:
			0 14px 44px -4px rgba(251, 191, 36, 0.75),
			0 0 24px rgba(251, 191, 36, 0.4);
	}

	@keyframes chargeMicroJitter {
		0% {
			transform: scale(0.975) translateY(1.5px) rotate(-0.3deg);
		}
		100% {
			transform: scale(0.975) translateY(1.5px) rotate(0.3deg);
		}
	}

	/* ── Base Glass Neo-Aero ─────────────────────────────────────────── */
	.checkin-base-glass {
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--border-subtle);
		border-top: 1px solid var(--glass-border-t, rgba(255, 255, 255, 0.45));
		border-radius: inherit;
		box-shadow:
			var(--glass-inset-highlight),
			inset 0 0 16px rgba(255, 255, 255, 0.03);
		overflow: hidden;
		transition:
			background 0.3s ease,
			border-color 0.3s ease;
	}

	.checkin-btn:hover .checkin-base-glass {
		border-color: color-mix(in srgb, var(--aero-blue) 40%, var(--border-subtle));
		border-top-color: rgba(255, 255, 255, 0.65);
	}

	.sheen-sweep-line {
		position: absolute;
		top: 0;
		left: -120%;
		width: 60%;
		height: 100%;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.12) 50%,
			transparent 100%
		);
		transform: skewX(-25deg);
		animation: sheenGlide 6.5s infinite ease-in-out;
		pointer-events: none;
	}

	@keyframes sheenGlide {
		0%,
		40% {
			left: -120%;
		}
		70%,
		100% {
			left: 200%;
		}
	}

	/* ── Barra Líquida Bioluminiscente ───────────────────────────────── */
	.fill-bar {
		width: var(--progress);
		transition: width 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
		background: linear-gradient(
			90deg,
			rgba(27, 133, 243, 0.92) 0%,
			rgba(0, 212, 170, 0.92) 55%,
			rgba(46, 180, 255, 0.98) 100%
		);
		border-right: 1.5px solid rgba(255, 255, 255, 0.9);
		box-shadow:
			0 0 20px rgba(27, 133, 243, 0.5),
			0 0 10px rgba(0, 212, 170, 0.4);
		overflow: hidden;
		will-change: width;
	}

	.fill-bar.completed {
		background: linear-gradient(
			90deg,
			rgba(0, 212, 170, 0.95) 0%,
			rgba(16, 185, 129, 0.95) 60%,
			rgba(46, 180, 255, 0.95) 100%
		);
		box-shadow: 0 0 25px rgba(0, 212, 170, 0.6);
	}

	.fill-bar.completed.tier-fire {
		background: linear-gradient(90deg, #f59e0b 0%, #ea580c 60%, #dc2626 100%);
		box-shadow: 0 0 25px rgba(249, 115, 22, 0.7);
	}
	.fill-bar.completed.tier-surge {
		background: linear-gradient(90deg, #0ea5e9 0%, #6366f1 60%, #8b5cf6 100%);
		box-shadow: 0 0 25px rgba(99, 102, 241, 0.75);
	}
	.fill-bar.completed.tier-epic {
		background: linear-gradient(90deg, #d946ef 0%, #ec4899 60%, #f43f5e 100%);
		box-shadow: 0 0 28px rgba(217, 70, 239, 0.8);
	}
	.fill-bar.completed.tier-legendary {
		background: linear-gradient(90deg, #fef08a 0%, #f59e0b 50%, #d97706 100%);
		box-shadow: 0 0 32px rgba(251, 191, 36, 0.9);
	}

	.liquid-plasma-layer {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.12) 0px,
			rgba(255, 255, 255, 0.12) 10px,
			transparent 10px,
			transparent 20px
		);
		mix-blend-mode: overlay;
		opacity: 0.6;
		animation: liquidFlow 3s linear infinite;
	}

	@keyframes liquidFlow {
		0% {
			background-position: 0 0;
		}
		100% {
			background-position: 40px 0;
		}
	}

	.liquid-specular-edge {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 40%;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, transparent 100%);
		pointer-events: none;
	}

	.liquid-energy-head {
		position: absolute;
		top: 0;
		right: -6px;
		bottom: 0;
		width: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.liquid-energy-head.active {
		opacity: 1;
	}

	.energy-core {
		width: 4px;
		height: 70%;
		background: #ffffff;
		border-radius: 9999px;
		box-shadow: 0 0 8px #ffffff;
	}

	.energy-halo {
		position: absolute;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, transparent 70%);
		filter: blur(2px);
		animation: energyPulse 0.6s infinite alternate ease-in-out;
	}

	@keyframes energyPulse {
		0% {
			transform: scale(0.85);
			opacity: 0.7;
		}
		100% {
			transform: scale(1.25);
			opacity: 1;
		}
	}

	/* ── ONDAS DE CHOQUE Y EXPLOSIÓN RADIAL ───────────────────────────── */
	.checkin-flash-shockwave {
		background: radial-gradient(
			circle at 50% 50%,
			rgba(255, 255, 255, 0.95) 0%,
			rgba(0, 212, 170, 0.7) 40%,
			transparent 75%
		);
		opacity: 0;
		transform: scale(0.6);
		transition:
			opacity 0.4s ease-out,
			transform 0.4s var(--ease-spring);
	}

	.checkin-flash-shockwave.flash {
		opacity: 1;
		transform: scale(1.4);
		animation: flashFade 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}

	.checkin-flash-shockwave.tier-fire {
		background: radial-gradient(
			circle at 50% 50%,
			rgba(255, 255, 255, 0.98) 0%,
			rgba(251, 191, 36, 0.8) 35%,
			rgba(249, 115, 22, 0.6) 60%,
			transparent 80%
		);
	}
	.checkin-flash-shockwave.tier-surge {
		background: radial-gradient(
			circle at 50% 50%,
			rgba(255, 255, 255, 0.98) 0%,
			rgba(46, 180, 255, 0.8) 35%,
			rgba(139, 92, 246, 0.6) 60%,
			transparent 80%
		);
	}
	.checkin-flash-shockwave.tier-epic {
		background: radial-gradient(
			circle at 50% 50%,
			rgba(255, 255, 255, 0.98) 0%,
			rgba(217, 70, 239, 0.85) 35%,
			rgba(236, 72, 153, 0.6) 60%,
			transparent 80%
		);
	}
	.checkin-flash-shockwave.tier-legendary {
		background: radial-gradient(
			circle at 50% 50%,
			rgba(255, 255, 255, 1) 0%,
			rgba(251, 191, 36, 0.95) 35%,
			rgba(245, 158, 11, 0.75) 60%,
			transparent 85%
		);
	}

	@keyframes flashFade {
		0% {
			opacity: 1;
			transform: scale(0.9);
		}
		100% {
			opacity: 0;
			transform: scale(1.7);
		}
	}

	.checkin-shockwave-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 40px;
		height: 40px;
		margin-top: -20px;
		margin-left: -20px;
		border-radius: var(--radius-full, 9999px);
		border: 2px solid #00d4aa;
		pointer-events: none;
		z-index: 15;
		animation: shockwaveRingExpand 0.75s cubic-bezier(0.12, 0.9, 0.32, 1) forwards;
	}

	.checkin-shockwave-ring.tier-fire {
		border-color: #fbbf24;
	}
	.checkin-shockwave-ring.tier-surge {
		border-color: #2eb4ff;
	}
	.checkin-shockwave-ring.tier-epic {
		border-color: #d946ef;
	}
	.checkin-shockwave-ring.tier-legendary {
		border-color: #ffd700;
		border-width: 3px;
	}

	@keyframes shockwaveRingExpand {
		0% {
			transform: scale(0.3);
			opacity: 1;
		}
		100% {
			transform: scale(3.2);
			opacity: 0;
		}
	}

	.checkin-shockwave-glow {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 50px;
		height: 50px;
		margin-top: -25px;
		margin-left: -25px;
		border-radius: var(--radius-full, 9999px);
		background: radial-gradient(circle, rgba(0, 212, 170, 0.7) 0%, transparent 70%);
		filter: blur(6px);
		pointer-events: none;
		z-index: 14;
		animation: shockwaveGlowExpand 0.85s cubic-bezier(0.12, 0.9, 0.32, 1) forwards;
	}

	.checkin-shockwave-glow.tier-fire {
		background: radial-gradient(circle, rgba(249, 115, 22, 0.8) 0%, transparent 70%);
	}
	.checkin-shockwave-glow.tier-surge {
		background: radial-gradient(circle, rgba(99, 102, 241, 0.8) 0%, transparent 70%);
	}
	.checkin-shockwave-glow.tier-epic {
		background: radial-gradient(circle, rgba(217, 70, 239, 0.85) 0%, transparent 70%);
	}
	.checkin-shockwave-glow.tier-legendary {
		background: radial-gradient(circle, rgba(251, 191, 36, 1) 0%, transparent 75%);
	}

	@keyframes shockwaveGlowExpand {
		0% {
			transform: scale(0.4);
			opacity: 0.9;
		}
		100% {
			transform: scale(3.8);
			opacity: 0;
		}
	}

	/* ── Partículas 360° Dinámicas ───────────────────────────────────── */
	.checkin-particles-burst {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: visible;
	}

	.burst-sparkle {
		position: absolute;
		width: var(--p-size, 7px);
		height: var(--p-size, 7px);
		border-radius: var(--radius-full, 9999px);
		background: var(--p-color, #00d4aa);
		box-shadow: 0 0 10px var(--p-color, #00d4aa);
		animation: particlePopDynamic var(--p-dur, 850ms) cubic-bezier(0.12, 0.9, 0.32, 1) forwards;
		animation-delay: var(--p-delay, 0ms);
	}

	.burst-sparkle.shape-star {
		background: transparent;
		box-shadow: none;
		border-radius: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sparkle-svg {
		width: 100%;
		height: 100%;
		filter: drop-shadow(0 0 4px var(--p-color, #ffffff));
	}

	.burst-sparkle.shape-diamond {
		border-radius: 2px;
		transform: rotate(45deg);
	}

	@keyframes particlePopDynamic {
		0% {
			transform: rotate(var(--p-angle)) translate(0px) scale(0) rotate(0deg);
			opacity: 1;
		}
		45% {
			transform: rotate(var(--p-angle)) translate(calc(var(--p-dist) * 0.8)) scale(1.4)
				rotate(var(--p-rot));
			opacity: 1;
		}
		80% {
			transform: rotate(var(--p-angle)) translate(var(--p-dist)) scale(1.1)
				rotate(calc(var(--p-rot) * 1.5));
			opacity: 0.85;
		}
		100% {
			transform: rotate(var(--p-angle)) translate(calc(var(--p-dist) * 1.25)) scale(0)
				rotate(calc(var(--p-rot) * 2));
			opacity: 0;
		}
	}

	/* ── Burbuja de Ícono Frontal ────────────────────────────────────── */
	.checkin-icon-slot {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
	}

	.checkin-icon-bubble {
		position: relative;
		width: 36px;
		height: 36px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--aero-blue) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--aero-blue) 30%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.25s ease,
			border-color 0.25s ease,
			transform 0.25s var(--ease-spring);
	}

	.checkin-icon-bubble.charging {
		background: rgba(255, 255, 255, 0.25);
		border-color: rgba(255, 255, 255, 0.6);
		transform: scale(1.08);
	}

	.checkin-icon-bubble.completed {
		background: linear-gradient(135deg, var(--aero-mint) 0%, #10b981 100%);
		border-color: rgba(255, 255, 255, 0.8);
		box-shadow: 0 0 14px rgba(0, 212, 170, 0.6);
		transform: scale(1.14);
	}

	.checkin-icon-bubble.completed.tier-fire {
		background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
		box-shadow: 0 0 16px rgba(249, 115, 22, 0.7);
	}
	.checkin-icon-bubble.completed.tier-surge {
		background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
		box-shadow: 0 0 16px rgba(99, 102, 241, 0.75);
	}
	.checkin-icon-bubble.completed.tier-epic {
		background: linear-gradient(135deg, #d946ef 0%, #ec4899 100%);
		box-shadow: 0 0 18px rgba(217, 70, 239, 0.8);
	}
	.checkin-icon-bubble.completed.tier-legendary {
		background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%);
		box-shadow:
			0 0 20px rgba(251, 191, 36, 0.9),
			0 0 8px #ffffff;
	}

	.checkin-icon {
		font-size: 20px;
		color: var(--aero-blue);
		transition:
			color 0.2s ease,
			transform 0.2s var(--ease-spring);
	}

	.checkin-icon-bubble.charging .checkin-icon,
	.checkin-icon-bubble.completed .checkin-icon {
		color: #ffffff;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
	}

	.checkin-icon.icon-bounce {
		animation: iconCelebration 0.65s var(--ease-spring) forwards;
	}

	@keyframes iconCelebration {
		0% {
			transform: scale(0.5) rotate(-30deg);
		}
		60% {
			transform: scale(1.35) rotate(15deg);
		}
		100% {
			transform: scale(1) rotate(0deg);
		}
	}

	.icon-pulse-ring {
		position: absolute;
		inset: -4px;
		border-radius: 16px;
		border: 1.5px solid rgba(255, 255, 255, 0.7);
		animation: ringExpand 0.8s ease-out infinite;
	}

	@keyframes ringExpand {
		0% {
			transform: scale(0.85);
			opacity: 1;
		}
		100% {
			transform: scale(1.35);
			opacity: 0;
		}
	}

	/* ── Textos Centrales con Jerarquía Visual ───────────────────────── */
	.checkin-center-col {
		min-width: 0;
		overflow: hidden;
	}

	.checkin-pretitle {
		font-size: 9.5px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
		opacity: 0.85;
		margin-bottom: 1px;
		transition:
			color 0.2s ease,
			opacity 0.2s ease,
			transform 0.2s var(--ease-spring);
	}

	.checkin-pretitle.active {
		color: rgba(255, 255, 255, 0.95);
		opacity: 1;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
		transform: scale(1.02);
	}

	.checkin-pretitle.completed {
		color: #ffffff;
		opacity: 1;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
	}

	.checkin-main-title {
		font-size: 13.5px;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--text-primary);
		line-height: 1.2;
		transition:
			color 0.2s ease,
			text-shadow 0.2s ease,
			transform 0.2s var(--ease-spring);
	}

	.checkin-main-title.pressing {
		color: #ffffff;
		text-shadow:
			0 1px 4px rgba(0, 0, 0, 0.5),
			0 0 10px rgba(255, 255, 255, 0.4);
	}

	.checkin-main-title.completed {
		color: #ffffff;
		text-shadow:
			0 1px 4px rgba(0, 0, 0, 0.5),
			0 0 12px rgba(0, 212, 170, 0.6);
		animation: titlePop 0.4s var(--ease-spring);
	}

	.checkin-main-title.completed.tier-fire {
		text-shadow:
			0 1px 4px rgba(0, 0, 0, 0.5),
			0 0 12px rgba(249, 115, 22, 0.7);
	}
	.checkin-main-title.completed.tier-surge {
		text-shadow:
			0 1px 4px rgba(0, 0, 0, 0.5),
			0 0 12px rgba(99, 102, 241, 0.75);
	}
	.checkin-main-title.completed.tier-epic {
		text-shadow:
			0 1px 4px rgba(0, 0, 0, 0.5),
			0 0 14px rgba(217, 70, 239, 0.8);
	}
	.checkin-main-title.completed.tier-legendary {
		text-shadow:
			0 1px 4px rgba(0, 0, 0, 0.5),
			0 0 16px rgba(251, 191, 36, 0.95);
	}

	@keyframes titlePop {
		0% {
			transform: scale(0.9);
		}
		50% {
			transform: scale(1.08);
		}
		100% {
			transform: scale(1);
		}
	}

	/* ── Badge de Racha con Fuego Reactivo ────────────────────────────── */
	.checkin-streak-slot {
		min-width: 54px;
		display: flex;
		justify-content: flex-end;
	}

	.checkin-streak-pill {
		position: relative;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border-radius: var(--radius-full, 9999px);
		background: color-mix(in srgb, var(--bg-surface) 80%, rgba(245, 166, 35, 0.12));
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid color-mix(in srgb, var(--aero-amber) 40%, var(--border-subtle));
		color: var(--text-primary);
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.08),
			inset 0 1px 1px rgba(255, 255, 255, 0.4);
		transition:
			transform 0.25s var(--ease-spring),
			background 0.25s ease,
			border-color 0.25s ease;
	}

	.checkin-streak-pill.pulse-flame {
		animation: flameBreathe 3s ease-in-out infinite;
	}

	.checkin-streak-pill.boosted {
		background: linear-gradient(135deg, rgba(251, 191, 36, 0.35) 0%, rgba(249, 115, 22, 0.35) 100%);
		border-color: rgba(251, 191, 36, 0.85);
		transform: scale(1.14);
		box-shadow: 0 0 18px rgba(251, 146, 60, 0.6);
	}

	.checkin-streak-pill.boosted.tier-surge {
		background: linear-gradient(135deg, rgba(46, 180, 255, 0.35) 0%, rgba(139, 92, 246, 0.35) 100%);
		border-color: rgba(46, 180, 255, 0.85);
		box-shadow: 0 0 18px rgba(99, 102, 241, 0.65);
	}

	.checkin-streak-pill.boosted.tier-epic {
		background: linear-gradient(135deg, rgba(217, 70, 239, 0.35) 0%, rgba(236, 72, 153, 0.35) 100%);
		border-color: rgba(217, 70, 239, 0.85);
		box-shadow: 0 0 20px rgba(217, 70, 239, 0.7);
	}

	.checkin-streak-pill.boosted.tier-legendary {
		background: linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(245, 158, 11, 0.4) 100%);
		border-color: rgba(255, 255, 255, 0.95);
		box-shadow:
			0 0 22px rgba(251, 191, 36, 0.85),
			0 0 10px #ffffff;
	}

	@keyframes flameBreathe {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.04);
		}
	}

	.flame-icon {
		font-size: 16px;
		background: linear-gradient(135deg, #fbbf24 0%, #fb923c 50%, #f97316 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		filter: drop-shadow(0 0 6px rgba(251, 146, 60, 0.75));
		animation: flameFlicker 2s ease-in-out infinite alternate;
	}

	.checkin-streak-pill.tier-surge .flame-icon {
		background: linear-gradient(135deg, #2eb4ff 0%, #8b5cf6 100%);
		-webkit-background-clip: text;
		filter: drop-shadow(0 0 6px rgba(46, 180, 255, 0.8));
	}

	.checkin-streak-pill.tier-epic .flame-icon {
		background: linear-gradient(135deg, #f472b6 0%, #d946ef 100%);
		-webkit-background-clip: text;
		filter: drop-shadow(0 0 6px rgba(217, 70, 239, 0.8));
	}

	.checkin-streak-pill.tier-legendary .flame-icon {
		background: linear-gradient(135deg, #ffffff 0%, #ffd700 60%, #f59e0b 100%);
		-webkit-background-clip: text;
		filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.95));
	}

	@keyframes flameFlicker {
		0% {
			filter: drop-shadow(0 0 4px rgba(251, 146, 60, 0.55));
			transform: scale(0.98);
		}
		100% {
			filter: drop-shadow(0 0 8px rgba(251, 146, 60, 0.9));
			transform: scale(1.06);
		}
	}

	.streak-num {
		font-size: 12.5px;
		font-weight: 800;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}

	.streak-plus-tag {
		position: absolute;
		top: -9px;
		right: -4px;
		background: linear-gradient(135deg, var(--aero-mint) 0%, #10b981 100%);
		color: #ffffff;
		font-size: 9.5px;
		font-weight: 900;
		padding: 1px 5px;
		border-radius: var(--radius-full, 9999px);
		box-shadow: 0 0 8px rgba(0, 212, 170, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.7);
	}

	.streak-plus-tag.tier-fire {
		background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
		box-shadow: 0 0 8px rgba(249, 115, 22, 0.6);
	}
	.streak-plus-tag.tier-surge {
		background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
		box-shadow: 0 0 8px rgba(99, 102, 241, 0.65);
	}
	.streak-plus-tag.tier-epic {
		background: linear-gradient(135deg, #d946ef 0%, #ec4899 100%);
		box-shadow: 0 0 8px rgba(217, 70, 239, 0.7);
	}
	.streak-plus-tag.tier-legendary {
		background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%);
		box-shadow: 0 0 10px rgba(251, 191, 36, 0.85);
	}
</style>
