<script>
	import { fade, slide } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let logs = $state([]);
	let currentFilter = $state('all');
	let loading = $state(true);

	$effect(() => {
		const filter = $page.url.searchParams.get('filter') || 'all';
		if (filter !== currentFilter) {
			currentFilter = filter;
			fetchLogs();
		}
	});

	onMount(() => {
		if (!authStore.isAuthenticated) {
			goto('/login');
			return;
		}
		currentFilter = $page.url.searchParams.get('filter') || 'all';
		fetchLogs();
	});

	async function fetchLogs() {
		loading = true;
		try {
			const res = await fetch(`/api/activity/history?filter=${currentFilter}`, {
				headers: {
					'Authorization': `Bearer ${authStore.token}`
				}
			});
			if (!res.ok) {
				if (res.status === 401) goto('/login');
				throw new Error('Failed to fetch activity');
			}
			const data = await res.json();
			logs = data.logs || [];
			currentFilter = data.currentFilter || 'all';
		} catch (e) {
			console.error(e);
		} finally {
			loading = false;
		}
	}

	const filters = [
		{ id: 'all', label: 'Todo el Historial' },
		{ id: 'views', label: 'Visualizaciones' },
		{ id: 'interactions', label: 'Interacciones' },
		{ id: 'audit', label: 'Auditoría (Modificaciones)' }
	];

	function getActionIcon(action) {
		switch(action) {
			case 'view': return 'bx-show';
			case 'like': return 'bx-heart';
			case 'unlike': return 'bx-heart-circle';
			case 'comment': return 'bx-comment-detail';
			case 'create': return 'bx-plus-circle';
			case 'update': return 'bx-edit';
			case 'delete': return 'bx-trash';
			default: return 'bx-history';
		}
	}

	function getActionColor(action) {
		switch(action) {
			case 'view': return 'text-blue-400';
			case 'like': return 'text-red-400';
			case 'unlike': return 'text-gray-400';
			case 'comment': return 'text-green-400';
			case 'create': return 'text-purple-400';
			case 'update': return 'text-yellow-400';
			case 'delete': return 'text-red-500';
			default: return 'text-white/70';
		}
	}

	function formatActionText(log) {
		const typeStr = log.entity_type === 'post' ? 'una publicación' :
						log.entity_type === 'comment' ? 'un comentario' :
						log.entity_type === 'reel' ? 'un reel' :
						log.entity_type === 'video' ? 'un video' : 'un elemento';

		switch(log.action_type) {
			case 'view': return `Visualizaste ${typeStr}`;
			case 'like': return `Te gustó ${typeStr}`;
			case 'unlike': return `Quitaste tu me gusta de ${typeStr}`;
			case 'comment': return `Comentaste en ${typeStr}`;
			case 'create': return `Creaste ${typeStr}`;
			case 'update': return `Editaste ${typeStr}`;
			case 'delete': return `Eliminaste ${typeStr}`;
			default: return `Interactuaste con ${typeStr}`;
		}
	}

	function formatDate(dateStr) {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('es-ES', {
			day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
		}).format(date);
	}
</script>

<svelte:head>
	<title>Historial de Actividad - V-SOCIAL</title>
</svelte:head>

<div class="max-w-4xl mx-auto w-full space-y-6 pt-4 pb-20">
	<div class="glass-panel p-6 sm:p-8 relative overflow-hidden">
		<div class="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none"></div>
		
		<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-white/90 drop-shadow-md">Registro de Actividad</h1>
				<p class="text-white/50 text-sm mt-1">Todo lo que haces, visualizas e interactúas en V-SOCIAL queda registrado aquí.</p>
			</div>
		</div>

		<!-- Filtros -->
		<div class="flex flex-wrap gap-2 mb-8">
			{#each filters as filter}
				<a href="?filter={filter.id}" 
				   data-sveltekit-replacestate
				   class="px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 backdrop-blur-md border {currentFilter === filter.id ? 'bg-primary/20 text-primary-300 border-primary/30 shadow-[0_0_15px_rgba(27,133,243,0.15)]' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white/90'}">
					{filter.label}
				</a>
			{/each}
		</div>

		<!-- Timeline de Actividad -->
		<div class="space-y-4">
			{#if loading}
				<div class="text-center py-12" in:fade>
					<span class="material-icons-round animate-spin text-4xl text-primary mb-4 block">autorenew</span>
					<h3 class="text-xl text-white/50 font-medium">Cargando historial...</h3>
				</div>
			{:else if logs.length === 0}
				<div class="text-center py-12" in:fade>
					<i class="bx bx-ghost text-6xl text-white/20 mb-4 block"></i>
					<h3 class="text-xl text-white/50 font-medium">No hay actividad reciente</h3>
					<p class="text-white/30 text-sm mt-2">Interactúa con la plataforma para empezar a registrar tu historial.</p>
				</div>
			{:else}
				{#each logs as log (log.id)}
					<div class="group relative flex gap-4 p-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors duration-200" transition:slide>
						<!-- Conector vertical (Timeline) -->
						<div class="absolute left-9 top-14 bottom-[-1rem] w-[1px] bg-white/10 group-last:hidden"></div>
						
						<!-- Icono de acción -->
						<div class="relative z-10 h-[44px] rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md shrink-0" style="flex: 0 0 44px; min-width: 44px;">
							<i class="bx {getActionIcon(log.action_type)} text-xl {getActionColor(log.action_type)} drop-shadow-[0_0_8px_currentColor]"></i>
						</div>
						
						<!-- Contenido -->
						<div class="flex-1 min-w-0 pt-1">
							<div class="flex justify-between items-baseline gap-2">
								<p class="text-sm font-medium text-white/90 truncate">
									{formatActionText(log)}
								</p>
								<span class="text-xs text-white/40 whitespace-nowrap shrink-0">{formatDate(log.created_at)}</span>
							</div>
							
							{#if log.entityPreview}
								<div class="mt-2 p-3 rounded-lg bg-black/20 border border-white/5 text-sm text-white/60 line-clamp-2">
									{#if ['delete', 'update'].includes(log.action_type)}
										<span class="text-xs font-mono text-yellow-400/70 mb-1 block">Contenido original antes del cambio:</span>
									{/if}
									{log.entityPreview}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
