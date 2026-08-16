<script>
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { onDestroy } from 'svelte';
	import { users as usersApi } from '$lib/api.js';

	let { onClose, onStartDM } = $props();

	let newDMSearch = $state('');
	let userSearchResults = $state([]);
	let searchingUsers = $state(false);

	let debounceTimer = null;
	let searchSeq = 0; // secuencia para descartar respuestas fuera de orden

	function getInitials(name) {
		if (!name) return '?';
		return name.substring(0, 2).toUpperCase();
	}

	// Debounce del input: agenda la búsqueda 250ms tras la última pulsación.
	function onSearchInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (!newDMSearch.trim()) {
			userSearchResults = [];
			searchingUsers = false;
			return;
		}
		searchingUsers = true;
		debounceTimer = setTimeout(searchUsersForDM, 250);
	}

	async function searchUsersForDM() {
		const term = newDMSearch.trim();
		if (!term) {
			userSearchResults = [];
			searchingUsers = false;
			return;
		}
		const seq = ++searchSeq;
		searchingUsers = true;
		try {
			const result = await usersApi.search(term);
			// Descartar si llegó una respuesta más antigua que la última petición.
			if (seq !== searchSeq) return;
			if (result.data) {
				userSearchResults = result.data.filter((u) => u.is_active !== 0);
			}
		} catch (error) {
			console.error('Error searching users:', error);
		} finally {
			if (seq === searchSeq) searchingUsers = false;
		}
	}

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="modal-backdrop"
	onclick={(e) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}}
	transition:fade={{ duration: 150 }}
>
	<div
		class="glass-card aero-modal"
		style="max-width: 340px; width: 100%; padding: 16px;"
		transition:scale={{ duration: 250, start: 0.95, easing: backOut }}
	>
		<div class="modal-header">
			<h3 class="modal-title">Nuevo chat</h3>
			<button onclick={onClose} class="close-btn" aria-label="Cerrar modal">
				<span class="material-icons-round">close</span>
			</button>
		</div>

		<div class="search-wrapper" style="margin-top: 12px;">
			<span class="material-icons-round">search</span>
			<input
				type="text"
				placeholder="Buscar usuarios por @tag..."
				bind:value={newDMSearch}
				oninput={onSearchInput}
				class="aero-input"
				style="padding-left: 32px; font-size: 0.85rem;"
				autocomplete="off"
			/>
		</div>

		<!-- Results list -->
		<div class="modal-results">
			{#if searchingUsers}
				<div class="modal-loading">
					<span class="loading loading-spinner text-primary"></span>
				</div>
			{:else if userSearchResults.length === 0 && newDMSearch.trim()}
				<p class="modal-empty-text">No se encontraron usuarios.</p>
			{:else if userSearchResults.length === 0}
				<p class="modal-empty-text">Busca a alguien para empezar a chatear.</p>
			{:else}
				{#each userSearchResults as user}
					<button onclick={() => onStartDM(user)} class="modal-user-item">
						<div
							class="conv-avatar"
							style="width: 32px; height: 32px; flex: 0 0 32px; min-width: 32px; min-height: 32px;"
						>
							{#if user.avatar_url}
								<img
									src={user.avatar_url}
									alt={user.display_name}
									width="32"
									height="32"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<span>{getInitials(user.display_name)}</span>
							{/if}
						</div>
						<div class="user-details-mini">
							<h4 class="user-name-mini">{user.display_name}</h4>
							<p class="user-username-mini">@{user.username}</p>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(5px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		border-radius: var(--radius-xs);
		transition: all 0.15s ease;
	}

	.close-btn:hover {
		color: var(--text-primary);
		background: rgba(var(--accent-blue-rgb), 0.1);
	}

	.search-wrapper {
		position: relative;
	}

	.search-wrapper .material-icons-round {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		font-size: 1.05rem;
		pointer-events: none;
	}

	.modal-results {
		max-height: 220px;
		overflow-y: auto;
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.modal-loading {
		display: flex;
		justify-content: center;
		padding: 20px;
	}

	.modal-empty-text {
		text-align: center;
		font-size: 0.75rem;
		color: var(--text-muted);
		padding: 20px;
		margin: 0;
	}

	.modal-user-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		cursor: pointer;
		text-align: left;
		transition: all 0.18s ease;
	}

	.modal-user-item:hover {
		background: var(--bg-surface-hover);
		border-color: var(--accent-blue-base);
	}

	.conv-avatar {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-weight: 700;
		font-size: 0.72rem;
		overflow: hidden;
	}

	.conv-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.user-details-mini {
		flex: 1;
		min-width: 0;
	}

	.user-name-mini {
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-username-mini {
		font-size: 0.68rem;
		color: var(--text-muted);
		margin: 1px 0 0 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
