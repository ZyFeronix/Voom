<script>
	import { onMount } from 'svelte';
	import { getProxiedMediaUrl } from '$lib/utils/mediaProxy.js';

	let { onSelect, onClose } = $props();

	let query = $state('');
	let gifs = $state([]);
	let loading = $state(true);
	let error = $state(null);
	let searchTimeout = null;

	async function fetchGifs(q = '') {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(q)}&limit=24`);
			const data = await res.json();

			if (!data.success) {
				if (data.error === 'KLIPY_API_KEY_NOT_CONFIGURED') {
					error = data.message;
				} else {
					error = data.details || data.error;
				}
				gifs = [];
			} else {
				gifs = data.gifs;
			}
		} catch (_e) {
			error = 'Error de conexión al cargar GIFs';
			gifs = [];
		} finally {
			loading = false;
		}
	}

	function handleSearch(e) {
		query = e.target.value;
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			fetchGifs(query);
		}, 400);
	}

	function handleSelect(gif) {
		if (onSelect) {
			// Return Klipy ID or Media URL based on Klipy API structure.
			const rawUrl =
				gif.file?.md?.gif?.url ||
				gif.file?.sm?.gif?.url ||
				gif.url ||
				(gif.media && gif.media[0] ? gif.media[0].url : gif.id);
			const url = getProxiedMediaUrl(rawUrl);
			onSelect(url, gif);
		}
	}

	onMount(() => {
		fetchGifs();
	});
</script>

<div
	class="klipy-picker glass-card aero-modal"
	role="presentation"
	onclick={(e) => e.stopPropagation()}
	onkeydown={(e) => e.stopPropagation()}
>
	<div class="picker-header">
		<div class="search-wrap">
			<span class="material-icons-round search-icon">search</span>
			<input
				type="text"
				placeholder="Buscar GIFs en Klipy..."
				value={query}
				oninput={handleSearch}
				class="aero-input search-input"
			/>
			{#if onClose}
				<button type="button" class="close-btn" onclick={onClose} title="Cerrar">
					<span class="material-icons-round text-[16px]">close</span>
				</button>
			{/if}
		</div>
	</div>

	<div class="gif-grid custom-scrollbar">
		{#if loading}
			<div class="flex justify-center items-center h-full text-muted py-8">
				<span class="loading loading-spinner text-primary"></span>
			</div>
		{:else if error}
			<div class="error-state">
				<span class="material-icons-round text-red-400 mb-2">error</span>
				<p class="text-sm text-center">{error}</p>
			</div>
		{:else if gifs.length === 0}
			<div class="empty-state">
				<p class="text-sm text-muted">No se encontraron GIFs.</p>
			</div>
		{:else}
			{#each gifs as gif}
				{@const rawPreviewUrl =
					gif.file?.sm?.gif?.url ||
					gif.file?.xs?.gif?.url ||
					gif.preview_url ||
					gif.url ||
					(gif.media && gif.media[0] ? gif.media[0].url : '')}
				{@const previewUrl = getProxiedMediaUrl(rawPreviewUrl)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="gif-btn"
					role="button"
					tabindex="0"
					onclick={() => handleSelect(gif)}
					title={gif.title || 'GIF'}
				>
					<img
						src={previewUrl}
						alt={gif.title || 'GIF'}
						loading="lazy"
						crossorigin="anonymous"
						referrerpolicy="no-referrer"
					/>
				</div>
			{/each}
		{/if}
	</div>

	<div class="picker-footer text-xs text-muted text-center pt-2">
		Powered by <strong>KLIPY</strong>
	</div>
</div>

<style>
	.klipy-picker {
		width: 100%;
		min-width: 280px;
		height: 380px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		box-sizing: border-box;
		z-index: var(--z-dropdown);
	}
	.picker-header {
		flex-shrink: 0;
	}
	.search-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}
	.search-icon {
		position: absolute;
		left: 12px;
		color: var(--text-muted);
		font-size: 18px;
		pointer-events: none;
	}
	.search-input {
		width: 100%;
		padding-left: 38px;
		padding-right: 38px;
		height: 40px;
		border-radius: 20px;
		background: var(--bg-input, rgba(0, 0, 0, 0.05));
		border: 1px solid var(--border-subtle);
		box-shadow: var(--input-shadow-inner, inset 0 2px 4px rgba(0, 0, 0, 0.05));
		transition:
			box-shadow var(--t-fast),
			border-color var(--t-fast);
	}
	.search-input:focus {
		outline: none;
		border-color: var(--aero-blue);
		box-shadow:
			0 0 0 3px rgba(27, 133, 243, 0.15),
			var(--input-shadow-inner);
	}
	.close-btn {
		position: absolute;
		right: 6px;
		width: 28px;
		height: 28px;
		border-radius: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background var(--t-fast),
			color var(--t-fast);
	}
	.close-btn:hover {
		background: rgba(255, 0, 0, 0.1);
		color: var(--rose-500, #f43f5e);
	}
	.gif-grid {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-auto-rows: max-content;
		gap: 10px;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 10px;
		margin: -10px;
	}
	.gif-btn {
		display: block;
		width: 100%;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: 12px;
		cursor: pointer;
		overflow: hidden;
		padding: 0;
		padding-top: 100%; /* Force perfect square */
		position: relative;
		transform: translateZ(0); /* Force GPU clipping for border-radius */
		transition:
			transform var(--t-spring),
			box-shadow var(--t-fast),
			border-color var(--t-fast);
	}
	.gif-btn:hover {
		transform: scale(1.05) translateY(-2px);
		box-shadow:
			0 8px 16px rgba(27, 133, 243, 0.15),
			0 0 0 1px var(--aero-blue);
		border-color: transparent;
		z-index: 10;
	}
	.gif-btn img {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		border-radius: 11px;
		transition: opacity var(--t-fast);
	}
	.gif-btn:active {
		transform: scale(0.95);
	}
	.error-state,
	.empty-state {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 24px;
		color: var(--text-muted);
	}
</style>
