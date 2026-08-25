<script>
	import { onMount } from 'svelte';
	import { perfStore } from '$lib/stores/perf.svelte.js';

	let wrapper = $state();
	let isBackgroundDisabled = $derived(perfStore.perfMode || perfStore.disableLiquidBg);

	onMount(() => {
		perfStore.init();

		// Pausa las animaciones infinitas del fondo cuando la pestaña está oculta
		// O la ventana perdió el foco (ahorro de GPU/batería en segundo plano).
		// Al volver el foco todo se reanuda solo (clase quitada).
		const onVisibility = () => {
			if (!wrapper) return;
			wrapper.classList.toggle('bg-paused', document.hidden || !document.hasFocus());
		};
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('focus', onVisibility);
		window.addEventListener('blur', onVisibility);
		// Estado inicial por si se monta ya en background.
		onVisibility();
		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('focus', onVisibility);
			window.removeEventListener('blur', onVisibility);
		};
	});
</script>

{#if isBackgroundDisabled}
	<!-- Fondo estático de alto rendimiento: degradados CSS puros sin animaciones ni GPU blur filters -->
	<div class="aero-static-bg" aria-hidden="true"></div>
{:else}
	<div class="aero-bg-wrapper" bind:this={wrapper} aria-hidden="true">
		<!-- Base de gradientes líquidos (GPU Accelerated) -->
		<div class="aurora-blobs">
			<div class="blob blob-1"></div>
			<div class="blob blob-2"></div>
			<div class="blob blob-3"></div>
		</div>
	</div>
{/if}

<style>
	.aero-bg-wrapper {
		position: fixed;
		inset: 0;
		z-index: -10;
		overflow: hidden;
		pointer-events: none;
		contain: strict;
		/* El fondo base se hereda de html (--bg-canvas) respetando el tema activo */
		background: transparent;
	}

	/* Rayos de luz crepusculares (God Rays submarinos) */
	.aero-bg-wrapper::after {
		content: '';
		position: absolute;
		inset: -30%;
		/* Conic gradient que nace desde arriba del viewport para simular luz penetrando el agua */
		background: conic-gradient(
			from 140deg at 50% -10%,
			transparent 0deg,
			rgba(0, 229, 255, 0.12) 20deg,
			transparent 35deg,
			rgba(255, 255, 255, 0.16) 45deg,
			transparent 55deg,
			rgba(0, 229, 255, 0.14) 65deg,
			transparent 80deg
		);
		filter: blur(18px);
		mix-blend-mode: screen;
		transform-origin: 50% 0%;
		/* Animación de oscilación suave como el agua */
		animation: swayRays 18s ease-in-out infinite alternate;
		will-change: transform;
	}

	@keyframes swayRays {
		0% {
			transform: scale(1.1) rotate(-3deg);
		}
		100% {
			transform: scale(1.1) rotate(3deg);
		}
	}

	/* --- Bioluminiscencia Submarina & Aero Fluid --- */
	.aurora-blobs {
		position: absolute;
		inset: -15%;
		z-index: 1;
		filter: blur(100px);
		opacity: 0.85;
		overflow: hidden;
		transform: translateZ(0);
		will-change: transform;
	}

	.blob {
		position: absolute;
		border-radius: 45% 55% 40% 60% / 55% 45% 60% 40%;
		will-change: transform;
	}

	/* Colores adaptados a la estética Frutiger Aero Submarino (Cianes, Azules Eléctricos, Teals) */
	.blob-1 {
		width: 80vw;
		height: 80vw;
		top: -10%;
		left: -10%;
		background: radial-gradient(
			circle at 30% 30%,
			rgba(0, 242, 254, 0.7) 0%,
			rgba(79, 172, 254, 0.35) 60%,
			transparent 90%
		);
		animation: flowBlob1 38s linear infinite;
		opacity: 0.75;
	}

	.blob-2 {
		width: 70vw;
		height: 70vw;
		bottom: -15%;
		right: -10%;
		background: radial-gradient(
			circle at 30% 30%,
			rgba(0, 212, 170, 0.6) 0%,
			rgba(14, 165, 233, 0.3) 65%,
			transparent 90%
		);
		animation: flowBlob2 48s linear infinite;
		opacity: 0.7;
	}

	.blob-3 {
		width: 65vw;
		height: 65vw;
		top: 25%;
		left: 15%;
		background: radial-gradient(
			circle at 30% 30%,
			rgba(28, 216, 210, 0.55) 0%,
			rgba(0, 180, 255, 0.25) 60%,
			transparent 90%
		);
		animation: flowBlob3 42s linear infinite;
		opacity: 0.65;
	}

	@keyframes flowBlob1 {
		0% {
			transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
		}
		33% {
			transform: translate3d(6%, 10%, 0) scale(1.08) rotate(120deg);
		}
		66% {
			transform: translate3d(-3%, 6%, 0) scale(0.95) rotate(240deg);
		}
		100% {
			transform: translate3d(0, 0, 0) scale(1) rotate(360deg);
		}
	}

	@keyframes flowBlob2 {
		0% {
			transform: translate3d(0, 0, 0) scale(1) rotate(360deg);
		}
		33% {
			transform: translate3d(-8%, -6%, 0) scale(1.1) rotate(240deg);
		}
		66% {
			transform: translate3d(4%, -10%, 0) scale(0.92) rotate(120deg);
		}
		100% {
			transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
		}
	}

	@keyframes flowBlob3 {
		0% {
			transform: translate3d(0, 0, 0) scale(0.9) rotate(0deg);
		}
		33% {
			transform: translate3d(10%, -12%, 0) scale(1.05) rotate(120deg);
		}
		66% {
			transform: translate3d(-6%, -8%, 0) scale(0.95) rotate(240deg);
		}
		100% {
			transform: translate3d(0, 0, 0) scale(0.9) rotate(360deg);
		}
	}

	/* Móvil: de 3 blobs animados a 1, y ralentizado, para bajar el coste GPU continuo.
	   Desktop mantiene los 3 blobs + timings originales. Solo ≤768px. */
	@media (max-width: 768px) {
		.blob-2,
		.blob-3 {
			display: none;
		}
		.blob-1 {
			animation-duration: 90s;
		}
		.aero-bg-wrapper::after {
			animation-duration: 36s;
		}
	}

	/* Pausa las animaciones infinitas cuando la pestaña está oculta (todas las plataformas,
	   invisible). No se usa prefers-reduced-motion porque app.html lo derriba globalmente.
	   La clase .bg-paused se togglea por JS (classList), por eso los selectores van con
	   :global() para que el compilador no los marque como no usados. */
	:global(.aero-bg-wrapper.bg-paused) .blob,
	:global(.aero-bg-wrapper.bg-paused::after) {
		animation-play-state: paused;
	}

	/* ── Fondo Estático de Alto Rendimiento (Lite / Sin Animaciones) ── */
	.aero-static-bg {
		position: fixed;
		inset: 0;
		z-index: -10;
		overflow: hidden;
		pointer-events: none;
		contain: strict;
		/* Gradiente Frutiger Aqua estático base (0 coste GPU ni repintados continuos) */
		background:
			radial-gradient(at 10% 12%, rgba(255, 255, 255, 0.95) 0px, transparent 42%),
			radial-gradient(at 88% 85%, rgba(0, 212, 170, 0.42) 0px, transparent 48%),
			radial-gradient(at 80% 12%, rgba(14, 165, 233, 0.42) 0px, transparent 52%),
			radial-gradient(at 35% 80%, rgba(56, 189, 248, 0.35) 0px, transparent 45%),
			linear-gradient(135deg, #a0ebf8 0%, #c4f3fa 42%, #7ae5d4 100%);
	}

	:global([data-theme='dark']) .aero-static-bg {
		background:
			radial-gradient(circle at 18% 12%, rgba(0, 242, 254, 0.14) 0%, transparent 42%),
			radial-gradient(circle at 82% 82%, rgba(0, 198, 255, 0.11) 0%, transparent 42%),
			radial-gradient(circle at 50% 35%, rgba(28, 216, 210, 0.08) 0%, transparent 45%),
			var(--bg-main);
	}

	:global([data-theme='midnight']) .aero-static-bg {
		background:
			radial-gradient(circle at 20% 15%, rgba(0, 229, 255, 0.09) 0%, transparent 40%),
			radial-gradient(circle at 80% 80%, rgba(46, 180, 255, 0.07) 0%, transparent 40%),
			var(--bg-main);
	}

	:global([data-theme='light']) .aero-static-bg {
		background:
			radial-gradient(at 10% 12%, rgba(255, 255, 255, 0.95) 0px, transparent 42%),
			radial-gradient(at 88% 85%, rgba(0, 212, 170, 0.42) 0px, transparent 48%),
			radial-gradient(at 80% 12%, rgba(14, 165, 233, 0.42) 0px, transparent 52%),
			radial-gradient(at 35% 80%, rgba(56, 189, 248, 0.35) 0px, transparent 45%),
			linear-gradient(135deg, #a0ebf8 0%, #c4f3fa 42%, #7ae5d4 100%);
	}
</style>
