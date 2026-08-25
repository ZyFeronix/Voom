<script>
	/**
	 * LeaderboardTabs.svelte — pestañas segmentadas de la Arena.
	 * Tres rankings: Niveles · Rachas · Creadores. Píldora deslizante con
	 * física spring y color según el ranking activo. Navegación con flechas
	 * + roving tabindex.
	 *
	 * - Adaptación multitema completa (Light, Dark, Midnight).
	 * - Modos de rendimiento (Lite, No-Blur, Simplificar Sombras, Reducir Movimiento).
	 */
	let { type = 'level', onChange = () => {} } = $props();

	const tabs = [
		{ id: 'level', icon: 'star', label: 'Niveles' },
		{ id: 'streak', icon: 'local_fire_department', label: 'Rachas' },
		{ id: 'creators', icon: 'auto_awesome', label: 'Creadores' }
	];

	let activeIndex = $derived(
		Math.max(
			0,
			tabs.findIndex((t) => t.id === type)
		)
	);

	let sliderEl = $state(undefined);

	$effect(() => {
		void type;
		if (!sliderEl) return;
		const timer = setTimeout(() => {
			const active = sliderEl.parentElement?.querySelector('.lb-tab.is-active');
			if (!active) return;
			const dx = Math.abs(sliderEl.getBoundingClientRect().x - active.getBoundingClientRect().x);
			if (dx > 2) {
				sliderEl.getAnimations().forEach((a) => a.cancel());
			}
		}, 550);
		return () => clearTimeout(timer);
	});

	function select(id) {
		if (id !== type) onChange(id);
	}

	function onKeydown(e) {
		if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			e.preventDefault();
			const dir = e.key === 'ArrowRight' ? 1 : -1;
			const next = (activeIndex + dir + tabs.length) % tabs.length;
			select(tabs[next].id);
		}
	}
</script>

<div
	class="lb-tabs"
	role="tablist"
	tabindex="-1"
	aria-label="Tipo de clasificación"
	onkeydown={onKeydown}
	style="--active-index: {activeIndex}; --tab-count: {tabs.length};"
>
	<span class="lb-tabs__slider lb-tabs__slider--{type}" bind:this={sliderEl} aria-hidden="true"
	></span>
	{#each tabs as tab (tab.id)}
		<button
			type="button"
			role="tab"
			id="lb-tab-{tab.id}"
			aria-selected={type === tab.id}
			aria-controls="lb-panel"
			tabindex={type === tab.id ? 0 : -1}
			class="lb-tab {type === tab.id ? 'is-active' : ''} lb-tab--{tab.id}"
			onclick={() => select(tab.id)}
		>
			<span class="material-icons-round lb-tab__icon">{tab.icon}</span>
			<span class="lb-tab__label">{tab.label}</span>
		</button>
	{/each}
</div>

<style>
	.lb-tabs {
		position: relative;
		display: inline-grid;
		grid-template-columns: repeat(var(--tab-count), 1fr);
		gap: 4px;
		padding: 5px;
		border-radius: 999px;
		border: 1px solid transparent;
		background:
			linear-gradient(
					var(--lb-card-bg, rgba(14, 34, 54, 0.75)),
					var(--lb-card-bg, rgba(14, 34, 54, 0.75))
				)
				padding-box,
			linear-gradient(
					135deg,
					rgba(255, 255, 255, 0.32),
					rgba(255, 255, 255, 0.08) 50%,
					rgba(var(--accent-blue-rgb), 0.25)
				)
				border-box;
		box-shadow: var(--shadow-sm), var(--glass-inset);
		backdrop-filter: var(--lb-glass-blur, blur(16px));
		-webkit-backdrop-filter: var(--lb-glass-blur, blur(16px));
	}

	/* Píldora deslizante detrás de la pestaña activa */
	.lb-tabs__slider {
		position: absolute;
		top: 5px;
		bottom: 5px;
		left: 5px;
		width: calc((100% - 10px - (var(--tab-count) - 1) * 4px) / var(--tab-count));
		border-radius: 999px;
		transform: translateX(calc(var(--active-index) * (100% + 4px)));
		transition:
			transform 0.42s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
			background 0.3s ease,
			box-shadow 0.3s ease;
		z-index: 0;
	}
	.lb-tabs__slider--level {
		background: linear-gradient(120deg, var(--aero-sky, #2eb4ff), var(--aero-mint, #00d4aa));
		box-shadow: 0 4px 16px rgba(46, 180, 255, 0.4);
	}
	.lb-tabs__slider--streak {
		background: linear-gradient(
			120deg,
			color-mix(in srgb, var(--lb-streak) 70%, #fff),
			var(--lb-streak)
		);
		box-shadow: 0 4px 16px var(--lb-streak-glow);
	}
	.lb-tabs__slider--creators {
		background: linear-gradient(
			120deg,
			color-mix(in srgb, var(--lb-creator) 65%, #fff),
			var(--lb-creator)
		);
		box-shadow: 0 4px 16px var(--lb-creator-glow);
	}

	.lb-tab {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		min-height: 44px; /* escudo volumétrico táctil */
		padding: 0 clamp(12px, 3.6vw, 30px);
		border: none;
		background: transparent;
		border-radius: 999px;
		font-family: var(--font-display, sans-serif);
		font-weight: 800;
		font-size: 0.88rem;
		letter-spacing: -0.01em;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			color 0.3s ease,
			transform 0.2s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
		white-space: nowrap;
	}
	.lb-tab:hover:not(.is-active) {
		color: var(--text-primary);
	}
	.lb-tab.is-active {
		color: #fff;
	}
	.lb-tab:active {
		transform: scale(0.96);
	}

	.lb-tab__icon {
		font-size: 19px;
		line-height: 1;
	}
	.lb-tab.is-active .lb-tab__icon {
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
	}
	.lb-tab.is-active.lb-tab--level .lb-tab__icon {
		color: #fde047;
	}
	.lb-tab.is-active.lb-tab--streak .lb-tab__icon {
		color: #ffe9b0;
	}
	.lb-tab.is-active.lb-tab--creators .lb-tab__icon {
		color: #ffd6ec;
	}

	.lb-tab:focus-visible {
		outline: 2px solid var(--aero-sky, #2eb4ff);
		outline-offset: 3px;
	}

	/* ══ Adaptación al Tema Claro (Light Theme) ══ */
	:global([data-theme='light']) .lb-tabs {
		background:
			linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)) padding-box,
			linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(0, 0, 0, 0.08)) border-box;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	:global([data-theme='light']) .lb-tabs__slider--level {
		background: linear-gradient(120deg, #0284c7, #0d9488);
		box-shadow: 0 2px 10px rgba(14, 165, 233, 0.35);
	}

	:global([data-theme='light']) .lb-tabs__slider--streak {
		background: linear-gradient(120deg, #f97316, #c2410c);
		box-shadow: 0 2px 10px rgba(234, 88, 12, 0.35);
	}

	:global([data-theme='light']) .lb-tabs__slider--creators {
		background: linear-gradient(120deg, #ec4899, #be185d);
		box-shadow: 0 2px 10px rgba(236, 72, 153, 0.35);
	}

	/* ══ Modos de Rendimiento ══ */
	:global([data-perf-mode='true']) .lb-tabs,
	:global([data-glass-blur='none']) .lb-tabs {
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
	}

	:global([data-perf-mode='true']) .lb-tabs,
	:global([data-perf-mode='true']) .lb-tabs__slider,
	:global([data-simplify-shadows='true']) .lb-tabs,
	:global([data-simplify-shadows='true']) .lb-tabs__slider {
		box-shadow: none !important;
	}

	:global([data-reduced-motion='true']) .lb-tabs__slider {
		transition-duration: 0.15s !important;
	}

	@media (max-width: 400px) {
		.lb-tab {
			padding: 0 clamp(10px, 3vw, 18px);
			font-size: 0.82rem;
		}
	}
</style>
