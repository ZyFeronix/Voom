<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { users as usersApi } from '$lib/api.js';
	import SettingsMessage from '$lib/components/settings/SettingsMessage.svelte';

	let blocked = $state([]);
	let loading = $state(true);
	let search = $state('');
	let unblockingId = $state(null);
	let blockUsername = $state('');
	let blocking = $state(false);
	let message = $state({ type: '', text: '' });

	async function loadList(q = '') {
		loading = true;
		try {
			const res = await usersApi.blockedList(q);
			blocked = res.blocked ?? [];
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'No se pudo cargar la lista.' };
		} finally {
			loading = false;
		}
	}

	let searchTimer;
	function onSearchInput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(async () => {
			await loadList(search.trim());
		}, 350);
	}

	async function unblock(user) {
		if (unblockingId) return;
		unblockingId = user.id;
		try {
			await usersApi.unblock(user.username);
			blocked = blocked.filter((b) => b.id !== user.id);
			message = { type: 'success', text: `Has desbloqueado a @${user.username}.` };
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'No se pudo desbloquear.' };
		} finally {
			unblockingId = null;
		}
	}

	async function blockByUsername(e) {
		e.preventDefault();
		const username = blockUsername.trim().replace(/^@/, '');
		if (!username || blocking) return;
		blocking = true;
		message = { type: '', text: '' };
		try {
			const res = await usersApi.block(username);
			message = { type: 'success', text: res.message ?? 'Usuario bloqueado.' };
			blockUsername = '';
			await loadList(search.trim());
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'No se pudo bloquear al usuario.' };
		} finally {
			blocking = false;
		}
	}

	function formatDate(dateStr) {
		if (!dateStr) return '';
		return new Intl.DateTimeFormat('es-ES', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		}).format(new Date(String(dateStr).includes('T') ? dateStr : dateStr.replace(' ', 'T')));
	}

	onMount(() => {
		loadList();
	});
</script>

<svelte:head>
	<title>Usuarios Bloqueados — Voom!</title>
</svelte:head>

<div class="glass-card panel-card">
	<SettingsMessage {message} />

	<div class="section-content">
		<div>
			<h3 class="section-title">Usuarios Bloqueados</h3>
			<p class="section-subtitle">
				Las cuentas bloqueadas no pueden seguirte, ver tu perfil restringido ni enviarte DMs.
			</p>
		</div>

		<!-- Bloquear por usuario -->
		<form onsubmit={blockByUsername} class="block-form">
			<input
				type="text"
				bind:value={blockUsername}
				placeholder="@usuario a bloquear"
				class="aero-input"
				style="flex: 1;"
			/>
			<button
				type="submit"
				class="btn-aero-secondary btn-sm"
				disabled={blocking || !blockUsername.trim()}
			>
				<span class="material-icons-round">{blocking ? 'hourglass_empty' : 'block'}</span>
				{blocking ? 'Bloqueando...' : 'Bloquear'}
			</button>
		</form>

		<!-- Búsqueda -->
		<input
			type="text"
			bind:value={search}
			oninput={onSearchInput}
			placeholder="Buscar en tu lista de bloqueados..."
			class="aero-input"
		/>

		<!-- Lista -->
		{#if loading}
			<div class="panel-loading">
				<span class="loading loading-spinner text-primary"></span>
				<span>Cargando lista...</span>
			</div>
		{:else if blocked.length === 0}
			<div class="blocked-empty" in:fade={{ duration: 200 }}>
				<span class="material-icons-round">emoji_people</span>
				<h4>{search ? 'Sin resultados' : 'No tienes nadie bloqueado'}</h4>
				<p>Una comunidad más sana empieza por curar tu experiencia.</p>
			</div>
		{:else}
			<div class="blocked-list">
				{#each blocked as user (user.id)}
					<div class="blocked-item" in:fade={{ duration: 150 }}>
						<img src={user.avatar_url || '/default-avatar.png'} alt="" class="blocked-avatar" />
						<div class="blocked-info">
							<a
								href="/u/{user.username}"
								class="blocked-name"
								target="_blank"
								rel="noopener noreferrer"
							>
								{user.display_name}
								{#if user.is_verified}
									<span class="material-icons-round verified-icon">verified</span>
								{/if}
							</a>
							<span class="blocked-sub">@{user.username} · desde {formatDate(user.blocked_at)}</span
							>
						</div>
						<button
							class="btn-aero-secondary btn-sm unblock-btn"
							onclick={() => unblock(user)}
							disabled={!!unblockingId}
						>
							<span class="material-icons-round"
								>{unblockingId === user.id ? 'hourglass_empty' : 'lock_open'}</span
							>
							{unblockingId === user.id ? 'Desbloqueando...' : 'Desbloquear'}
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.block-form {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.block-form button,
	.unblock-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.blocked-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.blocked-item {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
	}

	.blocked-avatar {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		object-fit: cover;
		background: var(--bg-surface-elevated);
		flex-shrink: 0;
	}

	.blocked-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.blocked-name {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-main);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.blocked-name:hover {
		color: var(--aero-blue);
	}

	.verified-icon {
		font-size: 14px;
		color: var(--aero-sky);
	}

	.blocked-sub {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.blocked-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 40px 16px;
		gap: 6px;
	}

	.blocked-empty .material-icons-round {
		font-size: 3rem;
		color: var(--text-muted);
		opacity: 0.4;
		margin-bottom: 6px;
	}

	.blocked-empty h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-main);
	}

	.blocked-empty p {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-muted);
		max-width: 300px;
	}
</style>
