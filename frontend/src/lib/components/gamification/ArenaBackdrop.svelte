<script>
	/**
	 * ArenaBackdrop.svelte — Escenografía del /leaderboard (Arena Voom!).
	 *
	 * - Dos haces volumétricos cruzados (dorado para el campeón + haz reactivo al tipo de ranking)
	 *   y reflejo de suelo bajo el podio.
	 * - Modo de Alto Rendimiento (Lite / Bajo consumo): desactiva blurs de GPU y animaciones
	 *   reemplazándolos por un degradado ambiental estático de 0 coste computacional.
	 * - Detección de pestaña oculta (document.hidden) para ahorro de energía en segundo plano.
	 * - Adaptación armónica a temas: Light (aurora clara), Dark (oceánico) y Midnight (neón nocturno).
	 */
	import { onMount } from 'svelte';
	import { perfStore } from '$lib/stores/perf.svelte.js';

	let { type = 'level' } = $props();

	let paused = $state(false);
	let isBackdropDisabled = $derived(perfStore.perfMode || perfStore.disableLiquidBg);

	onMount(() => {
		perfStore.init();

		const sync = () => {
			paused = typeof document !== 'undefined' && document.hidden;
		};
		sync();
		document.addEventListener('visibilitychange', sync);
		return () => document.removeEventListener('visibilitychange', sync);
	});

	// Acento reactivo por tipo de ranking (tokens de layout.css).
	let accent = $derived(
		type === 'streak'
			? 'var(--lb-streak)'
			: type === 'creators'
				? 'var(--lb-creator)'
				: 'var(--aero-sky)'
	);
</script>

{#if isBackdropDisabled}
	<!-- Modo de alto rendimiento / Lite: sin trabajo de GPU, sin blurs costosos ni animaciones -->
	<div class="arena arena--lite" aria-hidden="true" style="--arena-accent: {accent};">
		<div class="static-glow"></div>
	</div>
{:else}
	<div class="arena" class:is-paused={paused} aria-hidden="true" style="--arena-accent: {accent};">
		<!-- Haz dorado: corona simbólica sobre el puesto #1 -->
		<div class="beam beam--gold"></div>
		<!-- Haz de acento: sigue el colorway del ranking activo -->
		<div class="beam beam--accent"></div>
		<!-- Reflejo de suelo: elipse que ancla el podio -->
		<div class="floor"></div>
	</div>
{/if}

<style>
	.arena {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: -1;
		contain: strict;
	}

	/* ══ Modo Lite / Rendimiento Extremo ══ */
	.arena--lite .static-glow {
		position: absolute;
		top: 0;
		left: 50%;
		width: min(780px, 100%);
		height: 380px;
		transform: translateX(-50%);
		background: radial-gradient(
			ellipse 60% 50% at 50% 15%,
			color-mix(in srgb, var(--arena-accent) 12%, transparent) 0%,
			transparent 75%
		);
		pointer-events: none;
	}

	:global([data-theme='light']) .arena--lite .static-glow {
		background: radial-gradient(
			ellipse 60% 50% at 50% 15%,
			color-mix(in srgb, var(--arena-accent) 8%, transparent) 0%,
			transparent 70%
		);
	}

	/* ══ Haces volumétricos ══ */
	.beam {
		position: absolute;
		top: -6%;
		left: 50%;
		width: clamp(180px, 34vw, 420px);
		height: 78%;
		transform-origin: 50% 0%;
		will-change: transform, opacity;
	}

	.beam--gold {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--lb-gold) 42%, transparent) 0%,
			color-mix(in srgb, var(--lb-gold) 14%, transparent) 45%,
			transparent 92%
		);
		filter: blur(34px);
		opacity: 0.5;
		transform: translateX(-72%) rotate(-7deg);
		animation: arena-sway-a 13s ease-in-out infinite alternate;
		mask-image: radial-gradient(ellipse 62% 88% at 50% 12%, #000 35%, transparent 100%);
		-webkit-mask-image: radial-gradient(ellipse 62% 88% at 50% 12%, #000 35%, transparent 100%);
	}

	.beam--accent {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--arena-accent) 46%, transparent) 0%,
			color-mix(in srgb, var(--arena-accent) 15%, transparent) 48%,
			transparent 94%
		);
		filter: blur(38px);
		opacity: 0.55;
		transform: translateX(-28%) rotate(8deg);
		animation: arena-sway-b 16s ease-in-out infinite alternate;
		mask-image: radial-gradient(ellipse 58% 86% at 50% 10%, #000 32%, transparent 100%);
		-webkit-mask-image: radial-gradient(ellipse 58% 86% at 50% 10%, #000 32%, transparent 100%);
	}

	@keyframes arena-sway-a {
		from {
			transform: translateX(-74%) rotate(-9deg);
			opacity: 0.36;
		}
		to {
			transform: translateX(-70%) rotate(-4deg);
			opacity: 0.62;
		}
	}
	@keyframes arena-sway-b {
		from {
			transform: translateX(-30%) rotate(10deg);
			opacity: 0.62;
		}
		to {
			transform: translateX(-26%) rotate(5deg);
			opacity: 0.4;
		}
	}

	/* ══ Suelo reflectante ══ */
	.floor {
		position: absolute;
		top: min(46%, 430px);
		left: 50%;
		width: min(560px, 92%);
		height: 190px;
		transform: translateX(-50%);
		background: radial-gradient(
			ellipse 50% 50% at 50% 50%,
			color-mix(in srgb, var(--arena-accent) 20%, transparent) 0%,
			color-mix(in srgb, var(--lb-gold) 10%, transparent) 45%,
			transparent 75%
		);
		filter: blur(26px);
		opacity: 0.5;
		animation: arena-floor-breathe 9s ease-in-out infinite;
	}

	@keyframes arena-floor-breathe {
		0%,
		100% {
			opacity: 0.38;
			transform: translateX(-50%) scaleX(1);
		}
		50% {
			opacity: 0.6;
			transform: translateX(-50%) scaleX(1.06);
		}
	}

	/* ══ Adaptación al Tema Claro (Light Theme) ══ */
	:global([data-theme='light']) .beam--gold {
		opacity: 0.28;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--lb-gold) 35%, #fff) 0%,
			color-mix(in srgb, var(--lb-gold) 12%, transparent) 45%,
			transparent 90%
		);
	}

	:global([data-theme='light']) .beam--accent {
		opacity: 0.32;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--arena-accent) 35%, #fff) 0%,
			color-mix(in srgb, var(--arena-accent) 12%, transparent) 45%,
			transparent 90%
		);
	}

	:global([data-theme='light']) .floor {
		opacity: 0.28;
		background: radial-gradient(
			ellipse 50% 50% at 50% 50%,
			color-mix(in srgb, var(--arena-accent) 15%, transparent) 0%,
			color-mix(in srgb, var(--lb-gold) 8%, transparent) 45%,
			transparent 75%
		);
	}

	/* ══ Modos de Rendimiento ══ */
	:global([data-simplify-shadows='true']) .beam {
		filter: blur(16px);
	}
	:global([data-simplify-shadows='true']) .floor {
		filter: blur(12px);
	}

	:global([data-reduced-motion='true']) .beam,
	:global([data-reduced-motion='true']) .floor,
	.is-paused .beam,
	.is-paused .floor {
		animation: none !important;
	}
</style>
