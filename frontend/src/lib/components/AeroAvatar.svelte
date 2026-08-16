<script>
	/**
	 * AeroAvatar.svelte - V-SOCIAL Neo-Aero Avatar Component
	 * Renderiza avatares con marcos de cristal Frutiger Aero y estelas de presencia en tiempo real.
	 * La presencia se representa exclusivamente mediante la estela bioluminiscente alrededor del marco.
	 */

	let {
		src = null,
		alt = 'Usuario',
		size = 'md',
		online = false,
		away = false,
		busy = false,
		isLive = false,
		isVtuber = false,
		href = null,
		className = '',
		showPresence = true
	} = $props();

	// Obtener la inicial para el avatar de fallback
	let initial = $derived.by(() => {
		if (!alt) return '?';
		const clean = alt.trim().replace(/^@/, '');
		return clean.charAt(0).toUpperCase() || '?';
	});

	// Determinar el estado de presencia para la estela (aura de cristal)
	let presenceState = $derived.by(() => {
		if (!showPresence) return null;
		if (isLive) return 'live';
		if (online) return 'online';
		if (away) return 'away';
		if (busy) return 'busy';
		return 'offline';
	});

	// Clases calculadas para la estela y el marco
	let frameClasses = $derived.by(() => {
		const base = `avatar-ring ring-${size}`;
		const presence = presenceState ? `is-${presenceState}` : '';
		const vtuber = isVtuber ? 'is-vtuber' : '';
		return `${base} ${presence} ${vtuber} ${className}`.replace(/\s+/g, ' ').trim();
	});
</script>

{#if href}
	<a {href} class={frameClasses} title={alt}>
		{#if src}
			<img {src} {alt} loading="lazy" />
		{:else}
			<span class="avatar-ring-letter">
				{initial}
			</span>
		{/if}
	</a>
{:else}
	<div class={frameClasses} title={alt}>
		{#if src}
			<img {src} {alt} loading="lazy" />
		{:else}
			<span class="avatar-ring-letter">
				{initial}
			</span>
		{/if}
	</div>
{/if}
