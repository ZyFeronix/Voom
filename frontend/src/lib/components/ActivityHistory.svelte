<script>
	import { fade, slide } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { activity as activityApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';

	let logs = $state([]);
	let currentFilter = $state('all');
	let filterKey = $state(0);
	let loading = $state(true);

	onMount(() => {
		fetchLogs();
	});

	async function fetchLogs() {
		loading = true;
		try {
			const data = await activityApi.history(currentFilter);
			logs = data.logs || [];
			currentFilter = data.currentFilter || 'all';
		} catch (e) {
			console.error(e);
		} finally {
			loading = false;
		}
	}

	function setFilter(f) {
		currentFilter = f;
		filterKey++;
		fetchLogs();
	}

	const filters = [
		{ id: 'all', label: 'Todo el Historial' },
		{ id: 'views', label: 'Visualizaciones' },
		{ id: 'interactions', label: 'Interacciones' },
		{ id: 'audit', label: 'Auditoría (Modificaciones)' }
	];

	function getActionIcon(action) {
		switch(action) {
			case 'view': return 'visibility';
			case 'like': return 'favorite';
			case 'unlike': return 'heart_broken';
			case 'comment': return 'chat_bubble';
			case 'create': return 'add_circle';
			case 'update': return 'edit';
			case 'delete': return 'delete';
			default: return 'history';
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

	function getLink(log) {
		if (['delete'].includes(log.action_type)) return '#'; // Deleted items have no destination
		
		if (log.entity_type === 'reel') return `/reels?id=${log.entity_id}`;
		if (log.entity_type === 'video') return `/videos/${log.entity_id}`;
		if (log.entity_type === 'post') return `/posts/${log.entity_id}`;
		if (log.entity_type === 'comment') {
			if (log.metadataObj?.post_id) return `/posts/${log.metadataObj.post_id}#comment-${log.entity_id}`;
			if (log.metadataObj?.reel_id) return `/reels?id=${log.metadataObj.reel_id}#comment-${log.entity_id}`;
			return '#'; // Fallback if no post_id or reel_id
		}
		if (log.entity_type === 'story') return `/stories/${log.entity_id}`;
		if (log.entity_type === 'user') return `/u/${log.metadataObj?.username || log.entity_id}`;
		return '#';
	}

	function formatDate(dateStr) {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('es-ES', {
			day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
		}).format(date);
	}
</script>

<div class="space-y-6 p-6">
	<!-- Filtros -->
	<div class="flex flex-wrap gap-2 mb-6">
		{#each filters as filter}
			<button 
			   onclick={() => setFilter(filter.id)}
			   class="filter-btn {currentFilter === filter.id ? 'active' : 'inactive'}">
				{filter.label}
			</button>
		{/each}
	</div>

	<!-- Timeline de Actividad -->
	<div class="smooth-transition-wrapper">
		{#key filterKey + (loading ? '-loading' : '-loaded')}
			<div
				in:fade={{ duration: 250, delay: 100 }}
				out:fade={{ duration: 150 }}
				class="smooth-transition-content"
			>
				{#if loading}
					<div class="text-center py-12">
						<span class="material-icons-round animate-spin text-4xl text-primary mb-4 block">autorenew</span>
						<h3 class="text-xl text-muted font-medium">Cargando historial...</h3>
					</div>
				{:else if logs.length === 0}
					<div class="text-center py-12">
						<span class="material-icons-round text-6xl text-muted opacity-50 mb-4 block">hourglass_empty</span>
						<h3 class="text-xl text-main font-medium">No hay actividad reciente</h3>
						<p class="text-muted text-sm mt-2">Interactúa con la plataforma para empezar a registrar tu historial.</p>
					</div>
				{:else}
					<div class="flex flex-col gap-4">
						{#each logs as log (log.id)}
							<a 
								href={getLink(log)} 
								class="group relative flex items-start gap-4 p-4 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 border border-transparent transition-colors duration-200 {getLink(log) === '#' ? 'cursor-default' : 'cursor-pointer'}"
							>
								<!-- Conector vertical (Timeline) -->
								<div class="absolute left-9 top-14 bottom-[-1rem] w-[2px] bg-black/10 dark:bg-white/10 group-last:hidden"></div>
								
								<!-- Icono de acción -->
								<div class="relative z-10 rounded-full glass-panel flex items-center justify-center shrink-0" style="flex: 0 0 44px; width: 44px; height: 44px; min-width: 44px; min-height: 44px;">
									<span class="material-icons-round text-xl {getActionColor(log.action_type)} drop-shadow-[0_0_8px_currentColor]">{getActionIcon(log.action_type)}</span>
								</div>
								
								<!-- Contenido -->
								<div class="flex-1 min-w-0 pt-1">
									<div class="flex justify-between items-baseline gap-2">
										<p class="text-sm font-medium text-main truncate">
											{formatActionText(log)}
										</p>
										<span class="text-xs text-muted whitespace-nowrap shrink-0">{formatDate(log.created_at)}</span>
									</div>
									
									{#if log.entityPreview}
										<div class="mt-2 p-3 rounded-lg bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/5 text-sm text-muted line-clamp-2">
											{#if ['delete', 'update'].includes(log.action_type)}
												<span class="text-xs font-mono text-yellow-600 dark:text-yellow-400/70 mb-1 block">Contenido original antes del cambio:</span>
											{/if}
											{log.entityPreview}
										</div>
									{/if}
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		{/key}
	</div>
</div>

<style>
	/* ── Silky smooth crossfader ── */
	.smooth-transition-wrapper {
		display: grid;
		grid-template-columns: 1fr;
		width: 100%;
	}
	.smooth-transition-content {
		grid-column: 1;
		grid-row: 1;
		width: 100%;
	}

	.filter-btn {
		padding: 8px 18px;
		font-size: 0.85rem;
		font-weight: 600;
		border-radius: 99px;
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
		border: 1px solid transparent;
		cursor: pointer;
	}
	.filter-btn.active {
		background: var(--grad-primary);
		border-top: 1px solid rgba(255, 255, 255, 0.35);
		color: #ffffff;
		box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}
	.filter-btn.inactive {
		background: var(--glass-bg);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--border-glass);
		color: var(--text-primary);
	}
	.filter-btn.inactive:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: var(--accent-cyan);
		transform: translateY(-1px);
	}
</style>
