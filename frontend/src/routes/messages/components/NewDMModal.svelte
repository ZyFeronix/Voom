<script>
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { onDestroy, tick } from 'svelte';
	import { users as usersApi } from '$lib/api.js';

	let { onClose, onStartDM } = $props();

	let newDMSearch = $state('');
	let userSearchResults = $state([]);
	let searchingUsers = $state(false);
	let searchInput = $state(null);

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

	function handleKeydown(e) {
		if (e.key === 'Escape') onClose();
	}

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
	});

	// Autofocus al abrir el modal.
	tick().then(() => searchInput?.focus());
</script>

<svelte:window onkeydown={handleKeydown} />

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
		class="glass-card aero-modal dm-modal"
		style="max-width: 360px; width: 100%; padding: 16px;"
		transition:scale={{ duration: 250, start: 0.95, easing: backOut }}
	>
		<header class="modal-header">
			<div class="modal-title-block">
				<span class="modal-title-icon material-icons-round">forum</span>
				<h3 class="modal-title">Nuevo chat</h3>
			</div>
			<button onclick={onClose} class="close-btn" aria-label="Cerrar modal">
				<span class="material-icons-round">close</span>
			</button>
		</header>

		<div class="search-wrapper" style="margin-top: 12px;">
			<span class="material-icons-round">search</span>
			<input
				bind:this={searchInput}
				type="text"
				placeholder="Buscar usuarios por @tag..."
				bind:value={newDMSearch}
				oninput={onSearchInput}
				class="aero-input"
				style="padding-left: 32px; font-size: 0.85rem;"
				autocomplete="off"
			/>
			{#if searchingUsers}
				<span class="inline-spinner" aria-hidden="true"></span>
			{/if}
		</div>

		<!-- Results list -->
		<div class="modal-results">
			{#if searchingUsers && userSearchResults.length === 0}
				<div class="modal-loading">
					<span class="loading loading-spinner text-primary"></span>
				</div>
			{:else if userSearchResults.length === 0 && newDMSearch.trim()}
				<p class="modal-empty-text">No se encontraron usuarios.</p>
			{:else if userSearchResults.length === 0}
				<div class="modal-hint">
					<span class="material-icons-round hint-icon">alternate_email</span>
					<p>Busca por @usuario para empezar a chatear.</p>
				</div>
			{:else}
				<ul class="results-list">
					{#each userSearchResults as user, i (user.id)}
						<li>
							<button
								onclick={() => onStartDM(user)}
								class="modal-user-item"
								in:fade={{ duration: 150, delay: i * 30 }}
							>
								<div
									class="conv-avatar"
									style="flex: 0 0 36px; min-width: 36px; min-height: 36px; width: 36px; height: 36px;"
								>
									{#if user.avatar_url}
										<img
											src={user.avatar_url}
											alt={user.display_name}
											width="36"
											height="36"
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
								<span class="material-icons-round item-go-icon" aria-hidden="true">chat</span>
							</button>
						</li>
					{/each}
				</ul>
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

	.modal-title-block {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.modal-title-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: linear-gradient(135deg, var(--aero-sky), var(--accent-blue-base));
		color: #fff;
		font-size: 15px !important;
		box-shadow: 0 2px 6px rgba(var(--accent-blue-rgb), 0.35);
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
		display: flex;
		align-items: center;
	}

	.search-wrapper .material-icons-round {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		font-size: 1.05rem;
		pointer-events: none;
		z-index: 1;
	}

	/* Spinner inline dentro del input mientras busca */
	.inline-spinner {
		position: absolute;
		right: 10px;
		width: 14px;
		height: 14px;
		border: 2px solid var(--border-subtle);
		border-top-color: var(--accent-blue-base);
		border-radius: 50%;
		animation: spin-slow 0.7s linear infinite;
	}
	@keyframes spin-slow {
		to {
			transform: rotate(360deg);
		}
	}

	.modal-results {
		max-height: 240px;
		overflow-y: auto;
		margin-top: 12px;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
	}

	.results-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.modal-loading {
		display: flex;
		justify-content: center;
		padding: 20px;
	}

	.modal-empty-text,
	.modal-hint {
		text-align: center;
		font-size: 0.75rem;
		color: var(--text-muted);
		padding: 20px;
		margin: 0;
	}

	.modal-hint {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.hint-icon {
		font-size: 1.8rem;
		opacity: 0.4;
	}

	.modal-user-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 9px;
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		cursor: pointer;
		text-align: left;
		transition:
			background 0.18s ease,
			border-color 0.18s ease,
			transform 0.18s var(--ease-spring),
			box-shadow 0.18s ease;
	}

	.modal-user-item:hover {
		background: var(--bg-surface-hover);
		border-color: var(--accent-blue-base);
		transform: translateY(-1px);
		box-shadow: 0 4px 10px rgba(var(--accent-blue-rgb), 0.14);
	}

	.item-go-icon {
		font-size: 16px;
		color: var(--text-muted);
		opacity: 0;
		flex-shrink: 0;
		transform: translateX(-3px);
		transition:
			opacity 0.18s,
			transform 0.18s var(--ease-spring),
			color 0.18s;
	}
	.modal-user-item:hover .item-go-icon {
		opacity: 1;
		transform: translateX(0);
		color: var(--accent-blue-base);
	}

	.conv-avatar {
		width: 36px;
		height: 36px;
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
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.3),
			0 1px 2px rgba(0, 0, 0, 0.1);
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

	@media (prefers-reduced-motion: reduce) {
		.inline-spinner {
			animation-duration: 1.4s;
		}
		.modal-user-item,
		.item-go-icon {
			transition: none;
		}
	}
</style>
