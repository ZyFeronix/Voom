<script>
	/**
	 * LeaderboardSkeleton.svelte — estado de carga del /leaderboard.
	 * Skeleton glass con barrido shimmer (solo transform) que replica la
	 * geometría real de la página: 3 pedestals + filas. Sin spinners.
	 *
	 * - Adaptación multitema completa (Light, Dark, Midnight).
	 * - Modos de rendimiento (Lite, No-Blur, Reducir Movimiento).
	 */
	const ROWS = 6;
</script>

<div class="lb-skel" aria-hidden="true">
	<!-- Podio fantasma -->
	<div class="skel-podium">
		{#each [110, 148, 86] as h, i (h)}
			<div class="skel-slot" style="--dly: {i * 90}ms">
				<div class="skel-avatar"></div>
				<div class="skel-line" style="width: 72%"></div>
				<div class="skel-line skel-line--sm" style="width: 46%"></div>
				<div class="skel-pedestal" style="height: {h}px"></div>
			</div>
		{/each}
	</div>

	<!-- Filas fantasma -->
	<div class="skel-rows">
		{#each Array(ROWS) as _, i (i)}
			<div class="skel-row" style="--dly: {300 + i * 60}ms">
				<span class="material-icons-round skel-flame">local_fire_department</span>
				<div class="skel-row__avatar"></div>
				<div class="skel-row__lines">
					<div class="skel-line" style="width: 52%"></div>
					<div class="skel-line skel-line--sm" style="width: 30%"></div>
				</div>
				<div class="skel-chip"></div>
			</div>
		{/each}
	</div>
</div>

<style>
	.lb-skel {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	/* Bloque base cristal + barrido transform-only */
	.skel-avatar,
	.skel-line,
	.skel-pedestal,
	.skel-row__avatar,
	.skel-chip {
		position: relative;
		overflow: hidden;
		border-radius: var(--radius-sm, 10px);
		background: color-mix(in srgb, var(--text-primary) 7%, transparent);
	}
	.skel-avatar::after,
	.skel-line::after,
	.skel-pedestal::after,
	.skel-row__avatar::after,
	.skel-chip::after {
		content: '';
		position: absolute;
		inset: 0;
		transform: translateX(-110%);
		background: linear-gradient(
			100deg,
			transparent 20%,
			color-mix(in srgb, var(--text-primary) 8%, transparent) 50%,
			transparent 80%
		);
		animation: skel-shimmer 1.6s var(--ease-smooth, ease-in-out) infinite;
		animation-delay: var(--dly, 0ms);
	}

	@keyframes skel-shimmer {
		to {
			transform: translateX(110%);
		}
	}

	/* ── Podio ── */
	.skel-podium {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: clamp(10px, 4vw, 32px);
		margin-top: 3.5rem;
	}
	.skel-slot {
		flex: 1 1 0;
		min-width: 0;
		max-width: 150px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 9px;
	}
	.skel-slot:nth-child(2) {
		order: -1; /* plata a la izquierda del oro */
		margin-bottom: auto;
	}
	.skel-avatar {
		width: 68px;
		height: 68px;
		border-radius: 20px;
	}
	.skel-slot:nth-child(2) .skel-avatar {
		width: 82px;
		height: 82px;
	}
	.skel-line {
		width: 70%;
		height: 12px;
	}
	.skel-line--sm {
		height: 9px;
	}
	.skel-pedestal {
		width: 100%;
		border-radius: var(--radius-md, 14px) var(--radius-md, 14px) var(--radius-sm, 10px)
			var(--radius-sm, 10px);
		border-top: 2px solid color-mix(in srgb, var(--text-primary) 12%, transparent);
	}

	/* ── Filas ── */
	.skel-rows {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.skel-row {
		display: grid;
		grid-template-columns: auto 46px 1fr auto;
		align-items: center;
		gap: 14px;
		padding: 13px 16px;
		border-radius: var(--radius-lg, 18px);
		background: var(--lb-card-bg, rgba(14, 34, 54, 0.65));
		border: 1px solid var(--lb-card-border, rgba(255, 255, 255, 0.12));
		backdrop-filter: var(--lb-glass-blur, blur(16px));
		-webkit-backdrop-filter: var(--lb-glass-blur, blur(16px));
	}
	.skel-flame {
		font-size: 20px;
		opacity: 0.18;
		color: var(--lb-streak);
	}
	.skel-row__avatar {
		width: 44px;
		height: 44px;
		border-radius: 14px;
	}
	.skel-row__lines {
		display: flex;
		flex-direction: column;
		gap: 7px;
		min-width: 0;
	}
	.skel-chip {
		width: 64px;
		height: 26px;
		border-radius: 999px;
	}

	/* ══ Adaptación al Tema Claro (Light Theme) ══ */
	:global([data-theme='light']) .skel-row {
		background: rgba(255, 255, 255, 0.75);
		border-color: rgba(0, 0, 0, 0.08);
	}

	/* ══ Modos de Rendimiento ══ */
	:global([data-perf-mode='true']) .skel-row,
	:global([data-glass-blur='none']) .skel-row {
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
	}

	:global([data-perf-mode='true']) .skel-avatar::after,
	:global([data-perf-mode='true']) .skel-line::after,
	:global([data-perf-mode='true']) .skel-pedestal::after,
	:global([data-perf-mode='true']) .skel-row__avatar::after,
	:global([data-perf-mode='true']) .skel-chip::after,
	:global([data-reduced-motion='true']) .skel-avatar::after,
	:global([data-reduced-motion='true']) .skel-line::after,
	:global([data-reduced-motion='true']) .skel-pedestal::after,
	:global([data-reduced-motion='true']) .skel-row__avatar::after,
	:global([data-reduced-motion='true']) .skel-chip::after {
		animation: none !important;
		display: none !important;
	}

	@media (max-width: 480px) {
		.skel-avatar,
		.skel-slot:nth-child(2) .skel-avatar {
			width: 56px;
			height: 56px;
		}
		.skel-podium {
			gap: 8px;
			margin-top: 2.5rem;
		}
	}
</style>
