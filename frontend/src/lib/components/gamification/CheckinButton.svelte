<script>
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let {
		streak = 0,
		canCheckin = false,
		nextCheckin: _nextCheckin = null,
		disabled = false,
		oncheckin
	} = $props();
	let isPressing = $state(false);
	let progress = $state(0);
	let animationFrame;
	let pressStartTime = 0;

	// How long they need to hold it (ms)
	const HOLD_DURATION = 1200;

	function startPress(_e) {
		if (disabled || !canCheckin) return;
		isPressing = true;
		pressStartTime = performance.now();
		cancelAnimationFrame(animationFrame);
		animateProgress(performance.now());
	}

	function animateProgress(time) {
		if (!isPressing) return;

		const elapsed = time - pressStartTime;
		progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);

		if (progress >= 100) {
			completeCheckin();
		} else {
			animationFrame = requestAnimationFrame(animateProgress);
		}
	}

	function completeCheckin() {
		isPressing = false;
		progress = 100;
		cancelAnimationFrame(animationFrame);
		if (oncheckin) oncheckin();

		setTimeout(() => {
			if (!canCheckin) progress = 0;
		}, 1000);
	}

	function cancelPress() {
		isPressing = false;
		cancelAnimationFrame(animationFrame);

		function reverseProgress() {
			if (isPressing) return;
			progress -= 6;
			if (progress > 0) {
				requestAnimationFrame(reverseProgress);
			} else {
				progress = 0;
			}
		}
		requestAnimationFrame(reverseProgress);
	}
</script>

{#if canCheckin && !disabled}
	<div
		class="checkin-toast-wrapper mb-4 w-full"
		in:fly={{ y: 20, duration: 600, easing: quintOut, opacity: 0 }}
		out:fly={{ y: -20, duration: 400, opacity: 0 }}
	>
		<button
			class="checkin-btn w-full h-14 relative overflow-hidden rounded-2xl flex items-center justify-between px-4 transition-all duration-300 bg-transparent"
			class:pressing={isPressing}
			onpointerdown={startPress}
			onpointerup={cancelPress}
			onpointerleave={cancelPress}
			onpointercancel={cancelPress}
			oncontextmenu={(e) => e.preventDefault()}
			style="--progress: {progress}%"
		>
			<!-- Neo-Aero Glass Base -->
			<div
				class="absolute inset-0 bg-white/10 backdrop-blur-xl border border-white/20 z-0"
				style="box-shadow: inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.1);"
			></div>

			<!-- Barra de progreso líquida Neo-Aero -->
			<div
				class="absolute top-0 left-0 h-full fill-bar pointer-events-none flex items-center justify-end shadow-[0_0_20px_var(--neon-primary)] z-0"
				style="background: linear-gradient(90deg, var(--aero-blue), var(--aero-sky));"
			>
				<!-- Borde brillante interior del líquido -->
				<div class="absolute inset-0 border-t border-white/40 mix-blend-overlay"></div>
				<!-- Reflejo especular en la punta -->
				<div class="w-2 h-10 bg-white/60 rounded-full blur-[2px] mr-1"></div>
			</div>

			<!-- Destello al completarse -->
			<div
				class="absolute inset-0 bg-white/60 opacity-0 transition-opacity duration-300 pointer-events-none mix-blend-overlay z-0"
				class:opacity-100={progress >= 100}
			></div>

			<!-- Contenido Central -->
			<div
				class="relative z-10 flex items-center gap-2 text-white font-bold tracking-wide pointer-events-none flex-1 justify-center"
				style="text-shadow: 0 1px 4px rgba(0,0,0,0.4);"
			>
				<span
					class="material-icons-round"
					style="font-size: 22px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"
					class:animate-bounce={progress >= 100}
				>
					{progress >= 100 ? 'task_alt' : 'touch_app'}
				</span>
				<span>{progress >= 100 ? '¡Racha Asegurada!' : 'Mantén presionado'}</span>
			</div>

			<!-- Badge de Racha -->
			<div class="relative z-10 flex-shrink-0 ml-2">
				{#if streak > 0}
					<div
						class="flex items-center gap-1.5 text-white bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
					>
						<span style="filter: drop-shadow(0 0 6px rgba(255,165,0,0.8));">🔥</span>
						{streak}
					</div>
				{/if}
			</div>
		</button>
	</div>
{/if}

<style>
	.checkin-toast-wrapper {
		position: relative;
		z-index: 40;
		filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.15));
	}

	.checkin-btn {
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		background: transparent;
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.15),
			0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.checkin-btn.pressing {
		transform: scale(0.96) translateY(2px);
		box-shadow:
			inset 0 4px 8px rgba(0, 0, 0, 0.2),
			0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.fill-bar {
		width: var(--progress);
		/* Transición fluida para el llenado y vaciado con spring feeling */
		transition: width 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
		border-right: 1px solid rgba(255, 255, 255, 0.8);
	}

	/* Prevenir que el badge cambie el tamaño del botón cuando no hay racha */
	.checkin-btn > .flex-shrink-0 {
		min-width: 50px;
		display: flex;
		justify-content: flex-end;
	}
</style>
