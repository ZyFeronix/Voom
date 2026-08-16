<script>
	// Segmented pill tabs for switching leaderboard type.
	// The active pill slides between options; color follows the type.
	let { type = 'level', onChange = () => {} } = $props();

	const tabs = [
		{ id: 'level', icon: 'star', label: 'Niveles' },
		{ id: 'streak', icon: 'local_fire_department', label: 'Rachas' }
	];

	let activeIndex = $derived(tabs.findIndex((t) => t.id === type));

	let sliderEl = $state(undefined);

	// Watchdog: algunos entornos (p. ej. webviews con el reloj de animación
	// congelado) no ejecutan las transiciones CSS, y el slider se queda atascado
	// bajo la pestaña anterior. Si tras el cambio no llegó a su destino,
	// cancelamos las transiciones congeladas para que salte a la posición
	// correcta. En navegadores normales la transición ya habrá terminado y esto
	// no hace nada.
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
			linear-gradient(var(--lb-card-bg), var(--lb-card-bg)) padding-box,
			linear-gradient(
					135deg,
					rgba(255, 255, 255, 0.32),
					rgba(255, 255, 255, 0.08) 50%,
					rgba(var(--accent-blue-rgb), 0.25)
				)
				border-box;
		box-shadow: var(--shadow-sm), var(--glass-inset);
		backdrop-filter: var(--lb-glass-blur);
		-webkit-backdrop-filter: var(--lb-glass-blur);
	}

	/* Sliding highlight behind the active tab */
	.lb-tabs__slider {
		position: absolute;
		top: 5px;
		bottom: 5px;
		left: 5px;
		width: calc((100% - 10px - (var(--tab-count) - 1) * 4px) / var(--tab-count));
		border-radius: 999px;
		transform: translateX(calc(var(--active-index) * (100% + 4px)));
		transition:
			transform 0.42s var(--ease-spring),
			background 0.3s ease,
			box-shadow 0.3s ease;
		z-index: 0;
	}
	.lb-tabs__slider--level {
		background: linear-gradient(120deg, var(--aero-sky), var(--aero-mint));
		box-shadow: 0 4px 16px rgba(46, 180, 255, 0.4);
	}
	.lb-tabs__slider--streak {
		background: linear-gradient(
			120deg,
			color-mix(in srgb, var(--lb-streak) 70%, #fff),
			var(--lb-streak)
		);
		box-shadow: 0 4px 16px var(--lb-streak-glow, rgba(249, 115, 22, 0.4));
	}

	.lb-tab {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 clamp(18px, 5vw, 34px);
		border: none;
		background: transparent;
		border-radius: 999px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 0.9rem;
		letter-spacing: -0.01em;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			color 0.3s ease,
			transform 0.2s var(--ease-spring);
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
	.lb-tab.is-active.lb-tab--level .lb-tab__icon {
		color: #fde047;
	}
	.lb-tab.is-active.lb-tab--streak .lb-tab__icon {
		color: #fef08a;
	}

	.lb-tab:focus-visible {
		outline: 2px solid var(--accent-cyan);
		outline-offset: 3px;
	}

	/* [VSocial: reduced-motion removido — lb-tabs__slider siempre transicionado] */
</style>
