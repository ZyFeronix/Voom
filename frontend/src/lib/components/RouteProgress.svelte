<script>
	/**
	 * Barra de progreso de navegación (patrón YouTube/GitHub).
	 * Se muestra cuando SvelteKit está cargando la siguiente sección y se
	 * completa con un barrido final cuando la nueva vista aterriza.
	 *
	 * - Nunca parpadea: solo aparece tras 120ms de carga real, así las
	 *   navegaciones instantáneas (rutas precargadas) no la muestran.
	 * - Auto-gateada por rendimiento: en perfil lite o con movimiento
	 *   reducido no se renderiza (la view-transition del canvas ya
	 *   comunica el cambio de sección).
	 * - Es puramente informativa: pointer-events none, no bloquea nada.
	 */
	import { navigating } from '$app/state';
	import { perfStore } from '$lib/stores/perf.svelte.js';

	let visible = $state(false); // fase indeterminada (barrido continuo)
	let finishing = $state(false); // fase de cierre (llenado + desvanecido)

	let showDelay = null;
	let hideTimer = null;

	const SHOW_DELAY_MS = 120;
	const FINISH_MS = 340;

	function startProgress() {
		if (perfStore.perfMode || perfStore.reduceMotion) return;
		clearTimeout(hideTimer);
		clearTimeout(showDelay);
		showDelay = setTimeout(() => {
			finishing = false;
			visible = true;
		}, SHOW_DELAY_MS);
	}

	function completeProgress() {
		clearTimeout(showDelay);
		if (!visible && !finishing && !hideTimer) {
			// Nada en pantalla ni en cierre: navegación demasiado corta para mostrar la barra.
			return;
		}
		visible = false;
		finishing = true;
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			finishing = false;
			hideTimer = null;
		}, FINISH_MS);
	}

	// navigating ($app/state) es un OBJETO de estado, no un valor nullable:
	// siempre es truthy. La señal reactiva real es navigating.to (Navigation | null):
	// no-null mientras hay una navegación en curso, null al terminar. Leerlo aquí
	// dentro del $effect crea la dependencia reactiva que re-ejecuta este bloque
	// al iniciar y al terminar cada navegación client-side. (Antes se evaluaba
	// `if (navigating)`, siempre verdadero → la barra aparecía al montar y nunca
	// se completaba: el sitio quedaba "cargando" indefinidamente.)
	$effect(() => {
		const isNavigating = navigating.to !== null;
		if (isNavigating) {
			startProgress();
		} else {
			completeProgress();
		}
		return () => {
			clearTimeout(showDelay);
			clearTimeout(hideTimer);
		};
	});
</script>

{#if visible || finishing}
	<div
		class="vs-route-progress"
		class:is-finishing={finishing}
		role="progressbar"
		aria-label="Cargando sección"
	>
		<div class="vs-route-progress__track">
			<div class="vs-route-progress__bar"></div>
		</div>
	</div>
{/if}

<style>
	.vs-route-progress {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		z-index: 50000;
		pointer-events: none;
		opacity: 1;
		transition: opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.vs-route-progress.is-finishing {
		opacity: 0;
	}

	.vs-route-progress__track {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	/* Barra indeterminada: un trazo con gradiente de acento barre la pista
	   en loop. Solo anima transform (compositor), cero layout/paint. */
	.vs-route-progress__bar {
		position: absolute;
		top: 0;
		bottom: 0;
		left: -35%;
		width: 35%;
		border-radius: 0 9999px 9999px 0;
		background: linear-gradient(90deg, rgba(0, 229, 255, 0) 0%, #00e5ff 55%, #3ee6c3 100%);
		box-shadow: 0 0 10px rgba(0, 229, 255, 0.55);
		animation: vsRouteSweep 0.9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
		will-change: transform;
	}

	/* Fase de cierre: la barra ocupa todo el ancho y el contenedor
	   se desvanece (transición definida arriba). */
	.vs-route-progress.is-finishing .vs-route-progress__bar {
		left: 0;
		width: 100%;
		animation: none;
		transform: none;
		border-radius: 0;
	}

	@keyframes vsRouteSweep {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(386%);
		}
	}
</style>
