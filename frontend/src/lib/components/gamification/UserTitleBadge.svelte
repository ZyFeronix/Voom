<script>
	let { title = '', color = 'blue', size = 'md' } = $props();

	// Map basic colors to Tailwind classes
	let colorMap = $derived({
		blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
		green: 'bg-green-500/20 text-green-300 border-green-500/30',
		red: 'bg-red-500/20 text-red-300 border-red-500/30',
		yellow: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
		purple: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
		cyan: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
		neon: 'bg-primary/20 text-primary-content border-primary/40 shadow-[0_0_10px_rgba(27,133,243,0.3)]'
	});

	let themeClass = $derived(colorMap[color] || colorMap['blue']);

	let sizeClass = $derived(size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1');
</script>

<div
	class="inline-flex items-center justify-center font-bold uppercase tracking-wider rounded-full border backdrop-blur-sm {themeClass} {sizeClass}"
>
	{title}
</div>
