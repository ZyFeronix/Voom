<script>
	// Signature element: a vertical luminous column that runs down the
	// visual center of the leaderboard, tying the podium to the list.
	// It shifts color by leaderboard type: cool borealis for "Niveles",
	// warm solar flare for "Rachas".
	let { type = 'level' } = $props();

	let aurora = $derived(type === 'streak' ? 'var(--lb-aurora-warm)' : 'var(--lb-aurora-cool)');
	let capColor = $derived(type === 'streak' ? 'var(--lb-streak)' : 'var(--aero-sky)');
</script>

<div
	class="lb-pillar"
	aria-hidden="true"
	style="--pillar-aurora: {aurora}; --pillar-cap: {capColor};"
>
	<div class="pillar-core lb-motion"></div>
	<div class="pillar-cap pillar-cap--top"></div>
	<div class="pillar-cap pillar-cap--bottom"></div>
</div>

<style>
	.lb-pillar {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 300px;
		max-width: 80vw;
		pointer-events: none;
		z-index: -1;
		display: flex;
		justify-content: center;
	}

	/* The luminous column itself (flat top & bottom) */
	.pillar-core {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 100%;
	}

	/* Soft glow bleeding outward: flat top & bottom, smooth horizontal gradient fade on the sides */
	.pillar-core::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--pillar-aurora);
		background-size: 100% 220%;
		filter: blur(70px);
		opacity: 0.35;
		mask-image: linear-gradient(to right, transparent 0%, #000 20%, #000 80%, transparent 100%);
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0%,
			#000 20%,
			#000 80%,
			transparent 100%
		);
		animation: lb-aurora-drift 22s ease-in-out infinite alternate;
	}

	/* Glowing caps that anchor the pillar top & bottom */
	.pillar-cap {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--pillar-cap);
		box-shadow: 0 0 24px 6px var(--pillar-cap);
		opacity: 0.5;
	}
	.pillar-cap--top {
		top: 8px;
	}
	.pillar-cap--bottom {
		bottom: 8px;
	}

	@media (max-width: 640px) {
		.lb-pillar {
			width: 200px;
		}
		.pillar-core::before {
			filter: blur(40px);
			opacity: 0.25;
		}
	}

	/* [VSocial: reduced-motion removido — pillar siempre animado] */
</style>
