<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { activity as activityApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';

	let { data } = $props();
	let videoElement = $state();
	let isPlaying = $state(false);
	let viewLogged = false;

	onMount(() => {
		if (videoElement) {
			videoElement.play().catch(e => console.log('Autoplay prevented:', e));
		}
	});

	$effect(() => {
		if (isPlaying && !viewLogged && authStore.isAuthenticated && data.reel) {
			viewLogged = true;
			activityApi.view({ entity_type: 'reel', entity_id: data.reel.id }).catch(() => {});
		}
	});
</script>

<svelte:head>
	<title>Reel de {data.reel.username} | V-Social</title>
</svelte:head>

<div class="fixed inset-0 bg-black z-50 flex items-center justify-center">
	<!-- Botón volver -->
	<button onclick={() => history.back()} class="absolute top-6 left-6 z-50 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-all">
		<span class="material-icons-round">arrow_back</span>
	</button>

	<!-- Contenedor del Reel -->
	<div class="relative w-full max-w-[450px] h-[100dvh] bg-zinc-900 overflow-hidden flex flex-col justify-center shadow-2xl" in:fade>
		
		<video
			bind:this={videoElement}
			src={data.reel.video_url}
			class="w-full h-full object-cover"
			loop
			playsinline
			controls
			onplay={() => isPlaying = true}
			onpause={() => isPlaying = false}
		>
			<track kind="captions" />
		</video>

		<!-- Overlay info -->
		<div class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none flex flex-col gap-3">
			<div class="flex items-center gap-3">
				{#if data.reel.avatar_url}
					<img src={data.reel.avatar_url} alt={data.reel.username} class="w-10 h-10 rounded-full border border-white/20 object-cover" />
				{:else}
					<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold border border-white/20">
						{data.reel.username[0].toUpperCase()}
					</div>
				{/if}
				<div class="flex flex-col">
					<span class="text-white font-bold text-sm drop-shadow-md">@{data.reel.username}</span>
				</div>
			</div>
			
			{#if data.reel.caption}
				<p class="text-white/90 text-sm drop-shadow-md line-clamp-3">{data.reel.caption}</p>
			{/if}
		</div>
	</div>
</div>
