<script>
	let { level = 1, size = 'md', showText = true } = $props();

	// Calculate style based on level tier
	let tier = $derived(getTier(level));
	let sizeClasses = $derived({
		'sm': 'px-2 py-0.5 text-[10px] h-[20px] min-w-[36px]',
		'md': 'px-3 py-1 text-sm h-[28px] min-w-[48px]',
		'lg': 'px-5 py-2 text-xl border-2 h-[44px] min-w-[72px]'
	}[size]);
	
	// Glassmorphism + Neo-Aero styles per tier
	let tierStyles = $derived({
		'1': 'bg-white/5 border-white/20 shadow-[0_2px_8px_rgba(255,255,255,0.05)] text-white/90', // Niveles 1-4 (Cristal)
		'2': 'bg-emerald-500/20 border-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.25)] text-emerald-50', // Niveles 5-9 (Esmeralda)
		'3': 'bg-blue-500/20 border-blue-400/50 shadow-[0_0_20px_rgba(59,130,246,0.35)] text-blue-50', // Niveles 10-14 (Zafiro)
		'4': 'bg-fuchsia-500/20 border-fuchsia-400/60 shadow-[0_0_25px_rgba(217,70,239,0.45)] text-fuchsia-50', // Niveles 15-19 (Amatista)
		'5': 'bg-amber-500/30 border-amber-300/70 shadow-[0_0_30px_rgba(245,158,11,0.55)] text-amber-50', // Niveles 20-29 (Oro Mítico)
		'6': 'bg-gradient-to-tr from-cyan-400/40 via-primary/50 to-fuchsia-500/40 border-white/80 shadow-[0_0_40px_rgba(34,211,238,0.7)] text-white animate-pulse-slow' // Nivel 30+ (Diamante Líquido)
	}[tier.toString()]);

	function getTier(lvl) {
		if (lvl >= 30) return 6;
		if (lvl >= 20) return 5;
		if (lvl >= 15) return 4;
		if (lvl >= 10) return 3;
		if (lvl >= 5) return 2;
		return 1;
	}
</script>

<div class="relative inline-flex flex-shrink-0 items-center justify-center {sizeClasses} rounded-full border backdrop-blur-md font-bold {tierStyles} overflow-hidden group">
	<!-- Internal reflection for glass effect -->
	<div class="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-full pointer-events-none"></div>
	
	<!-- Tier 6 special liquid reflection -->
	{#if tier === 6}
		<div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent mix-blend-overlay pointer-events-none liquid-shine"></div>
	{/if}
	
	<span class="relative z-10 drop-shadow-md flex items-center gap-[2px] whitespace-nowrap leading-none">
		<span class="opacity-60 text-[0.85em] tracking-wider uppercase font-black">Lv</span>
		<span>{level}</span>
	</span>
</div>

{#if showText && size === 'lg'}
	<div class="mt-2 text-center text-xs font-bold uppercase tracking-wider text-white/50">
		Nivel {level}
	</div>
{/if}

<style>
	.animate-pulse-slow {
		animation: pulse-glow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
	
	@keyframes pulse-glow {
		0%, 100% { box-shadow: 0 0 20px rgba(27, 133, 243, 0.4); }
		50% { box-shadow: 0 0 35px rgba(27, 133, 243, 0.8), inset 0 0 10px rgba(255,255,255,0.2); }
	}
	
	.liquid-shine {
		background-size: 200% 200%;
		animation: shine 4s ease infinite;
	}
	
	@keyframes shine {
		0% { background-position: 0% 50%; }
		50% { background-position: 100% 50%; }
		100% { background-position: 0% 50%; }
	}
</style>
