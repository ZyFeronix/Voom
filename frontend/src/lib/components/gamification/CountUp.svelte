<script>
	/**
	 * CountUp.svelte — número que cuenta desde 0 hasta `value` con easing
	 * cúbico (salida suave). rAF puro; en SSR renderiza el valor final sin
	 * animar. Se re-anima cada vez que cambia `value`.
	 */
	let { value = 0, duration = 1100, format = (v) => Math.round(v).toLocaleString('es') } = $props();

	// null = aún sin animar → se muestra `value` tal cual (SSR / primer paint).
	let display = $state(null);
	let rafId = 0;

	function animateTo(target) {
		if (typeof window === 'undefined' || !Number.isFinite(target)) {
			display = target;
			return;
		}
		cancelAnimationFrame(rafId);
		const startedAt = performance.now();
		const step = (now) => {
			const t = Math.min(1, (now - startedAt) / duration);
			const eased = 1 - Math.pow(1 - t, 3); // cubic-out
			display = target * eased;
			if (t < 1) rafId = requestAnimationFrame(step);
		};
		rafId = requestAnimationFrame(step);
	}

	$effect(() => {
		animateTo(value ?? 0);
		return () => cancelAnimationFrame(rafId);
	});
</script>

<span class="countup">{format(display ?? value)}</span>

<style>
	.countup {
		font-variant-numeric: tabular-nums;
	}
</style>
