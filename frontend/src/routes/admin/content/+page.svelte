<script>
	import { onMount } from 'svelte';
	import { admin as adminApi } from '$lib/api.js';
	import { uiStore } from '$lib/stores/ui.svelte.js';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';

	let { data } = $props();
	const staff = $derived(data.staff);
	const canModerate = $derived(staff.permissions.includes('content.moderate'));
	const isAdminLevel = $derived(staff.role === 'admin' || staff.role === 'super_admin');

	let loading = $state(true);
	let loadError = $state('');
	let contentList = $state([]);
	let currentType = $state('posts'); // posts | reels | trash
	let page = $state(1);
	let totalPages = $state(1);
	const LIMIT = 20;

	const TYPE_TABS = [
		{ key: 'posts', label: 'Posts', icon: 'article' },
		{ key: 'reels', label: 'Reels', icon: 'movie' },
		{ key: 'trash', label: 'Papelera', icon: 'delete_outline' }
	];

	async function loadContent(p = 1) {
		loading = true;
		loadError = '';
		try {
			const res = await adminApi.content.list({ type: currentType, page: p, limit: LIMIT });
			contentList = res.content || [];
			page = res.page || p;
			totalPages = Math.ceil(res.total / (res.limit || LIMIT)) || 1;
		} catch (e) {
			loadError = e?.message || 'No se pudo cargar el contenido.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadContent(1);
	});

	function switchType(type) {
		currentType = type;
		loadContent(1);
	}

	async function deleteContent(item) {
		const isPurge = currentType === 'trash';
		const ok = await uiStore.requestConfirm({
			title: isPurge
				? 'Purgar definitivamente'
				: `Eliminar ${currentType === 'reels' ? 'reel' : 'post'}`,
			message: isPurge
				? `El post #${item.id} se borrará DEFINITIVAMENTE de la base de datos. Esta acción no se puede deshacer.`
				: `El contenido pasará a la papelera y quedará fuera de la plataforma.`,
			danger: true,
			confirmText: isPurge ? 'Purgar' : 'Eliminar'
		});
		if (!ok) return;
		try {
			const apiType = currentType === 'posts' ? 'post' : currentType === 'reels' ? 'reel' : 'trash';
			await adminApi.content.delete(apiType, item.id);
			contentList = contentList.filter((c) => c.id !== item.id);
		} catch (e) {
			loadError = e?.message || 'Error al eliminar el contenido.';
			setTimeout(() => (loadError = ''), 4500);
		}
	}

	async function restoreContent(item) {
		try {
			await adminApi.content.restore(item.id);
			contentList = contentList.filter((c) => c.id !== item.id);
		} catch (e) {
			loadError = e?.message || 'Error al restaurar el contenido.';
			setTimeout(() => (loadError = ''), 4500);
		}
	}

	function fmtDate(raw) {
		if (!raw) return '—';
		const s = String(raw).trim();
		const iso = (s.includes('T') ? s : s.replace(' ', 'T')).replace(/Z?$/, 'Z');
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('es-ES');
	}

	function formatContentBody(item) {
		if (!item) return '(sin texto)';
		let text = item.body || item.caption || '';
		const idx = text.indexOf('[METADATA]');
		if (idx !== -1) {
			text = text.slice(0, idx).trim();
		}
		if (text) return text;
		if (item.quoted_post) {
			return `[Cita a @${item.quoted_post.username || 'usuario'}]`;
		}
		if (item.poll) {
			return `[Encuesta: ${item.poll.question || 'Sin título'}]`;
		}
		if (item.media || item.media_type === 'video') {
			return `[${item.media_type === 'video' ? 'Vídeo' : 'Multimedia'}]`;
		}
		return '(sin texto)';
	}

	function getContentTooltip(item) {
		if (!item) return '';
		let text = item.body || item.caption || '';
		const idx = text.indexOf('[METADATA]');
		if (idx !== -1) {
			text = text.slice(0, idx).trim();
		}
		const extras = [];
		if (item.quoted_post) extras.push(`Cita: @${item.quoted_post.username || 'usuario'}`);
		if (item.poll) extras.push(`Encuesta: ${item.poll.question || ''}`);
		if (item.location) extras.push(`Ubicación: ${item.location}`);
		if (extras.length > 0) {
			return text ? `${text} (${extras.join(' · ')})` : extras.join(' · ');
		}
		return text || '(sin texto)';
	}
</script>

<svelte:head>
	<title>Contenido | Voom! Staff</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title"><span class="material-icons-round">grid_view</span> Contenido</h1>
	<p class="page-subtitle">Modera publicaciones, reels y gestiona la papelera.</p>
</div>

<div class="page-content">
	{#if loadError}
		<div class="alert-box error" role="alert">
			<span class="material-icons-round">error</span>
			<span style="flex:1">{loadError}</span>
			<button class="btn-aero-secondary btn-sm" onclick={() => loadContent(page)}>Reintentar</button
			>
		</div>
	{/if}

	<div class="glass-panel admin-toolbar neo-shadow">
		<div class="filter-chips">
			{#each TYPE_TABS as tab (tab.key)}
				<button
					class="filter-chip"
					class:active={currentType === tab.key}
					onclick={() => switchType(tab.key)}
				>
					<span class="material-icons-round" style="font-size:15px">{tab.icon}</span>
					{tab.label}
				</button>
			{/each}
		</div>
		{#if currentType === 'trash'}
			<span class="muted-note" style="margin-left:auto">
				{isAdminLevel
					? 'Puedes purgar definitivamente o restaurar posts.'
					: 'Puedes restaurar posts eliminados.'}
			</span>
		{/if}
	</div>

	<div class="glass-card table-card">
		{#if loading}
			<div style="padding:20px">
				{#each Array(6) as _, i (i)}
					<div class="skeleton-shimmer skeleton-row"></div>
				{/each}
			</div>
		{:else if contentList.length === 0}
			<div class="empty-state">
				<span class="material-icons-round"
					>{currentType === 'trash' ? 'delete_outline' : 'post_add'}</span
				>
				<p>{currentType === 'trash' ? 'La papelera está vacía' : 'Sin contenido publicado aún'}</p>
			</div>
		{:else}
			<div class="table-responsive">
				<table class="aero-table">
					<thead>
						<tr>
							<th>Autor</th>
							<th>Contenido</th>
							<th>Me gusta</th>
							<th>{currentType === 'trash' ? 'Eliminado' : 'Publicado'}</th>
							{#if canModerate}<th style="text-align:right">Acciones</th>{/if}
						</tr>
					</thead>
					<tbody>
						{#each contentList as item (item.id)}
							<tr>
								<td>
									<div class="cell-user">
										<div style="flex: 0 0 44px; min-width: 44px; min-height: 44px">
											<AeroAvatar
												src={item.avatar_url}
												alt={item.username}
												size="sm"
												showPresence={false}
											/>
										</div>
										<div class="cell-user-main">
											<div class="cell-user-name">@{item.username}</div>
										</div>
									</div>
								</td>
								<td>
									<div class="content-cell">
										{#if item.media_type === 'video'}
											<div class="content-thumb video-thumb" title="Vídeo">
												<span class="material-icons-round">play_circle</span>
											</div>
										{:else if item.media}
											<img src={item.media} alt="" class="content-thumb" loading="lazy" />
										{:else if item.quoted_post}
											<div class="content-thumb" title="Cita a publicación">
												<span class="material-icons-round">format_quote</span>
											</div>
										{:else if item.poll}
											<div class="content-thumb" title="Encuesta">
												<span class="material-icons-round">poll</span>
											</div>
										{:else}
											<div class="content-thumb">
												<span class="material-icons-round">notes</span>
											</div>
										{/if}
										<span class="cell-body" title={getContentTooltip(item)}
											>{formatContentBody(item)}</span
										>
									</div>
								</td>
								<td>{item.like_count ?? 0}</td>
								<td>{fmtDate(currentType === 'trash' ? item.deleted_at : item.created_at)}</td>
								{#if canModerate}
									<td>
										<div class="row-actions">
											{#if currentType === 'trash'}
												<button
													class="icon-btn"
													title="Restaurar post"
													onclick={() => restoreContent(item)}
												>
													<span class="material-icons-round">restore_from_trash</span>
												</button>
												{#if isAdminLevel}
													<button
														class="icon-btn danger"
														title="Purgar definitivamente"
														onclick={() => deleteContent(item)}
													>
														<span class="material-icons-round">delete_forever</span>
													</button>
												{/if}
											{:else}
												<button
													class="icon-btn danger"
													title="Eliminar"
													onclick={() => deleteContent(item)}
												>
													<span class="material-icons-round">delete</span>
												</button>
											{/if}
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="pagination-bar">
				<button
					class="page-btn"
					disabled={page <= 1}
					onclick={() => loadContent(page - 1)}
					aria-label="Página anterior"
				>
					<span class="material-icons-round">chevron_left</span>
				</button>
				<span class="pagination-info">Página {page} de {totalPages}</span>
				<button
					class="page-btn"
					disabled={page >= totalPages}
					onclick={() => loadContent(page + 1)}
					aria-label="Página siguiente"
				>
					<span class="material-icons-round">chevron_right</span>
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.neo-shadow {
		box-shadow: var(--shadow-md);
	}
	.content-cell {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.row-actions {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}
</style>
