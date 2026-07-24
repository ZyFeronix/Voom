<script>
	import { onMount } from 'svelte';

	let wrapper = $state();

	onMount(() => {
		// Pausa las animaciones infinitas del fondo cuando la pestaña está oculta (ahorro de
		// GPU/batería en segundo plano). Al volver a foco se reanudan solas (clase quitada).
		const onVisibility = () => {
			if (!wrapper) return;
			wrapper.classList.toggle('bg-paused', document.hidden);
		};
		document.addEventListener('visibilitychange', onVisibility);
		// Estado inicial por si se monta ya en background.
		onVisibility();
		return () => document.removeEventListener('visibilitychange', onVisibility);
	});
</script>

<div class="aero-bg-wrapper" bind:this={wrapper}>
	<!-- Base de gradientes líquidos (GPU Accelerated) -->
	<div class="aurora-blobs">
		<div class="blob blob-1"></div>
		<div class="blob blob-2"></div>
		<div class="blob blob-3"></div>
	</div>
</div>

<style>
	.aero-bg-wrapper {
		position: fixed;
		inset: 0;
		z-index: -10;
		overflow: hidden;
		pointer-events: none;
		contain: strict;
		/* El fondo base ahora es heredado del body (--bg-canvas) para respetar Light/Dark mode */
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
			rgba(0, 229, 255, 0.08) 20deg,
			transparent 35deg,
			rgba(0, 180, 255, 0.05) 45deg,
			transparent 55deg,
			rgba(0, 229, 255, 0.1) 65deg,
			transparent 80deg
		);
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

	/* --- Bioluminiscencia Submarina --- */
	.aurora-blobs {
		position: absolute;
		inset: -15%;
		z-index: 1;
		opacity: 0.75;
		overflow: hidden;
		transform: translateZ(0);
		will-change: transform;
	}

	.blob {
		position: absolute;
		border-radius: 50%;
		/* Removido mix-blend-mode: screen para que sean visibles en Light Mode */
		will-change: transform;
	}

	/* Colores adaptados a la estética Frutiger Aero Submarino (Cianes, Azules Eléctricos, Teals) */
	.blob-1 {
		width: 80vw;
		height: 80vw;
		top: -10%;
		left: -10%;
		background: radial-gradient(
			closest-side at 40% 40%,
			rgba(0, 242, 254, 0.5) 0%,
			rgba(79, 172, 254, 0.2) 60%,
			transparent 100%
		);
		animation: flowBlob1 38s linear infinite;
		opacity: 0.6;
	}

	.blob-2 {
		width: 70vw;
		height: 70vw;
		bottom: -15%;
		right: -10%;
		background: radial-gradient(
			closest-side at 60% 40%,
			rgba(0, 198, 255, 0.5) 0%,
			rgba(0, 114, 255, 0.15) 60%,
			transparent 100%
		);
		animation: flowBlob2 48s linear infinite;
		opacity: 0.5;
	}

	.blob-3 {
		width: 65vw;
		height: 65vw;
		top: 25%;
		left: 15%;
		background: radial-gradient(
			closest-side at 30% 60%,
			rgba(28, 216, 210, 0.45) 0%,
			rgba(31, 107, 184, 0.15) 60%,
			transparent 100%
		);
		animation: flowBlob3 42s linear infinite;
		opacity: 0.45;
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
</style>
