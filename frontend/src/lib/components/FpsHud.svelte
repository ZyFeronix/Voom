<script>
	import { fade } from 'svelte/transition';
	import { perfStore } from '$lib/stores/perf.svelte.js';

	let fps = $state(60);
	let avgFps = $state(60);
	let minFps = $state(60);
	let domNodes = $state(0);
	let memoryMB = $state(null);
	let isCollapsed = $state(false);

	let frameCount = 0;
	let lastTime = 0;
	let fpsHistory = [];
	let rafId = null;
	let intervalId = null;

	let frameTime = $derived(fps > 0 ? (1000 / fps).toFixed(1) : '16.6');

	function calculateStats() {
		if (typeof document !== 'undefined') {
			domNodes = document.getElementsByTagName('*').length;
		}
		if (typeof performance !== 'undefined' && performance.memory) {
			memoryMB = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
		}
	}

	function tick(now) {
		frameCount++;
		if (!lastTime) lastTime = now;

		const delta = now - lastTime;
		if (delta >= 500) {
			fps = Math.round((frameCount * 1000) / delta);
			frameCount = 0;
			lastTime = now;

			fpsHistory.push(fps);
			if (fpsHistory.length > 20) fpsHistory.shift();

			avgFps = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
			minFps = Math.min(...fpsHistory);
		}

		rafId = requestAnimationFrame(tick);
	}

	// El muestreo vive en un $effect gated por el ajuste: antes corría un bucle
	// rAF + un intervalo de 1s SIEMPRE, incluso con el HUD apagado desde Ajustes.
	// Al alternar el interruptor el cleanup detiene/retoma el muestreo al vuelo.
	$effect(() => {
		if (!perfStore.fpsHud || typeof document === 'undefined') return;

		const startSampling = () => {
			lastTime = 0;
			frameCount = 0;
			rafId = requestAnimationFrame(tick);
			intervalId = setInterval(calculateStats, 1000);
		};

		const stopSampling = () => {
			if (rafId) cancelAnimationFrame(rafId);
			if (intervalId) clearInterval(intervalId);
			rafId = null;
			intervalId = null;
		};

		// Pausa el muestreo mientras la pestaña está oculta: nada de esto sirve
		// en segundo plano y compite por CPU justo cuando otra pestaña lo necesita.
		const visibilityHandler = () => {
			if (document.hidden) {
				stopSampling();
			} else if (!rafId) {
				calculateStats();
				startSampling();
			}
		};

		document.addEventListener('visibilitychange', visibilityHandler);
		calculateStats();
		if (!document.hidden) startSampling();

		return () => {
			document.removeEventListener('visibilitychange', visibilityHandler);
			stopSampling();
		};
	});
</script>

{#if perfStore.fpsHud}
	<div class="fps-hud-container" transition:fade={{ duration: 150 }}>
		<div class="fps-hud-panel glass-panel">
			<!-- Header / Mini Stats -->
			<div class="fps-hud-header">
				<div class="fps-badge-group">
					<span
						class="fps-dot"
						class:fps-good={fps >= 55}
						class:fps-warn={fps >= 30 && fps < 55}
						class:fps-bad={fps < 30}
					></span>
					<span class="fps-number">{fps}</span>
					<span class="fps-label">FPS</span>
					<span class="fps-sub-label">({frameTime}ms)</span>
				</div>

				<div class="fps-controls">
					<button
						type="button"
						class="fps-ctrl-btn"
						onclick={() => (isCollapsed = !isCollapsed)}
						title={isCollapsed ? 'Expandir HUD' : 'Minimizar HUD'}
					>
						<span class="material-icons-round text-xs">
							{isCollapsed ? 'unfold_more' : 'unfold_less'}
						</span>
					</button>
					<button
						type="button"
						class="fps-ctrl-btn"
						onclick={() => perfStore.setFpsHud(false)}
						title="Cerrar monitor de rendimiento"
					>
						<span class="material-icons-round text-xs">close</span>
					</button>
				</div>
			</div>

			<!-- Expanded Technical Telemetry -->
			{#if !isCollapsed}
				<div class="fps-hud-body">
					<div class="fps-stat-row">
						<span class="stat-name">Media / Mín:</span>
						<span class="stat-val">{avgFps} / {minFps} fps</span>
					</div>
					<div class="fps-stat-row">
						<span class="stat-name">Tasa Refresco:</span>
						<span class="stat-val">{perfStore.hardwareInfo.screenRefreshRate} Hz</span>
					</div>
					<div class="fps-stat-row">
						<span class="stat-name">Nodos DOM:</span>
						<span class="stat-val">{domNodes}</span>
					</div>
					{#if memoryMB !== null}
						<div class="fps-stat-row">
							<span class="stat-name">Heap JS:</span>
							<span class="stat-val">{memoryMB} MB</span>
						</div>
					{/if}
					{#if perfStore.hardwareInfo.rtt}
						<div class="fps-stat-row">
							<span class="stat-name">Ping Red:</span>
							<span class="stat-val">{perfStore.hardwareInfo.rtt} ms</span>
						</div>
					{/if}
					<div class="fps-stat-row">
						<span class="stat-name">Perfil Activo:</span>
						<span class="stat-val text-accent font-semibold" style="text-transform: capitalize;">
							{perfStore.perfProfile}
						</span>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.fps-hud-container {
		position: fixed;
		bottom: 18px;
		right: 18px;
		z-index: var(--z-toast, 700);
		pointer-events: auto;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		user-select: none;
	}

	.fps-hud-panel {
		background: rgba(15, 23, 42, 0.85);
		backdrop-filter: var(--glass-blur, blur(12px));
		-webkit-backdrop-filter: var(--glass-blur, blur(12px));
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: var(--radius-md, 14px);
		padding: 7px 12px;
		box-shadow: var(--shadow-sm), var(--shadow-glow);
		color: #f8fafc;
		font-size: 11px;
		min-width: 155px;
	}

	.fps-hud-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.fps-badge-group {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.fps-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--aero-mint, #00d4aa);
		box-shadow: 0 0 6px var(--aero-mint, #00d4aa);
	}

	.fps-dot.fps-warn {
		background: var(--aero-amber, #f5a623);
		box-shadow: 0 0 6px var(--aero-amber, #f5a623);
	}

	.fps-dot.fps-bad {
		background: #ef4444;
		box-shadow: 0 0 6px #ef4444;
	}

	.fps-number {
		font-weight: 800;
		font-size: 13px;
		letter-spacing: -0.5px;
		color: #ffffff;
	}

	.fps-label {
		font-size: 9px;
		opacity: 0.75;
		font-weight: 700;
	}

	.fps-sub-label {
		font-size: 9px;
		opacity: 0.55;
	}

	.fps-controls {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.fps-ctrl-btn {
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.65);
		cursor: pointer;
		padding: 2px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			color 0.15s ease,
			background 0.15s ease;
	}

	.fps-ctrl-btn:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.12);
	}

	.fps-hud-body {
		margin-top: 7px;
		padding-top: 7px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		gap: 3.5px;
	}

	.fps-stat-row {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 10px;
	}

	.stat-name {
		color: rgba(255, 255, 255, 0.6);
	}

	.stat-val {
		color: rgba(255, 255, 255, 0.95);
		font-weight: 600;
	}

	.text-accent {
		color: var(--aero-sky, #2eb4ff);
	}
</style>
