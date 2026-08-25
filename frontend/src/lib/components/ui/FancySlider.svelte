<script>
	/**
	 * FancySlider — deslizador 100% personalizado (cero <input type="range">).
	 *
	 * - Pointer Events con captura: ratón y táctil idénticos.
	 * - Teclado accesible: role="slider", flechas, PageUp/Down, Home/End.
	 * - Fill con gradiente del acento + thumb con glow; todo con tokens.
	 *
	 * Uso: <FancySlider min={0} max={40} step={1} bind:value={blur} label="Difuminado" />
	 */
	let { min = 0, max = 100, step = 1, value = $bindable(0), label = '', id = null } = $props();

	let el = $state(null);
	let dragging = $state(false);

	let pct = $derived.by(() => {
		const span = max - min || 1;
		return Math.min(100, Math.max(0, ((Number(value) - min) / span) * 100));
	});

	function clamp(raw) {
		const snapped = Math.round((raw - min) / step) * step;
		const v = Math.min(max, Math.max(min, Number(snapped.toFixed(6))));
		return v;
	}

	function setFromPointer(e) {
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const ratio = rect.width ? (e.clientX - rect.left) / rect.width : 0;
		value = clamp(min + Math.min(1, Math.max(0, ratio)) * (max - min));
	}

	function onPointerDown(e) {
		dragging = true;
		try {
			el?.setPointerCapture(e.pointerId);
		} catch {}
		setFromPointer(e);
	}

	function onPointerMove(e) {
		if (!dragging) return;
		setFromPointer(e);
	}

	function onPointerEnd() {
		dragging = false;
	}

	function onKeydown(e) {
		const big = step * 10;
		let next = null;
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowUp':
				next = Number(value) + step;
				break;
			case 'ArrowLeft':
			case 'ArrowDown':
				next = Number(value) - step;
				break;
			case 'PageUp':
				next = Number(value) + big;
				break;
			case 'PageDown':
				next = Number(value) - big;
				break;
			case 'Home':
				next = min;
				break;
			case 'End':
				next = max;
				break;
			default:
				return;
		}
		e.preventDefault();
		value = clamp(next);
	}
</script>

<div
	bind:this={el}
	{id}
	class="fancy-slider"
	class:dragging
	role="slider"
	tabindex="0"
	aria-label={label}
	aria-valuemin={min}
	aria-valuemax={max}
	aria-valuenow={value}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerEnd}
	onpointercancel={onPointerEnd}
	onkeydown={onKeydown}
>
	<span class="fs-rail" aria-hidden="true"></span>
	<span class="fs-fill" style:width="{pct}%" aria-hidden="true"></span>
	<span class="fs-thumb" style:left="{pct}%" aria-hidden="true"></span>
</div>

<style>
	.fancy-slider {
		position: relative;
		height: 26px;
		touch-action: none;
		cursor: pointer;
		border-radius: 999px;
		outline-offset: 3px;
		user-select: none;
		-webkit-user-select: none;
	}
	.fancy-slider:focus-visible {
		box-shadow: 0 0 0 3px
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 35%, transparent);
	}

	.fs-rail,
	.fs-fill,
	.fs-thumb {
		position: absolute;
		top: 50%;
		pointer-events: none;
	}
	.fs-rail {
		left: 0;
		right: 0;
		height: 6px;
		transform: translateY(-50%);
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-main) 12%, transparent);
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.12);
	}
	.fs-fill {
		left: 0;
		height: 6px;
		transform: translateY(-50%);
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			var(--accent-blue-base, var(--aero-blue)),
			var(--accent-blue-light, var(--aero-sky))
		);
		box-shadow: 0 0 10px
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 45%, transparent);
	}
	.fs-thumb {
		width: 16px;
		height: 16px;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: #ffffff;
		border: 2px solid var(--accent-blue-base, var(--aero-blue));
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.25),
			0 0 12px color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 40%, transparent);
		transition: scale 0.12s ease;
	}
	.fancy-slider:hover .fs-thumb {
		scale: 1.15;
	}
	.fancy-slider.dragging .fs-thumb {
		scale: 0.95;
		box-shadow:
			0 1px 4px rgba(0, 0, 0, 0.3),
			0 0 16px color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 55%, transparent);
	}
</style>
