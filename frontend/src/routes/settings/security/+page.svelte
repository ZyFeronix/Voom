<script>
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { auth as authApi } from '$lib/api.js';
	import SettingsMessage from '$lib/components/settings/SettingsMessage.svelte';

	let saving = $state(false);
	let message = $state({ type: '', text: '' });

	// ── Cambiar Contraseña ──────────────────────────────────────────────────
	let oldPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	let pwdMismatch = $derived(confirmPassword.length > 0 && newPassword !== confirmPassword);

	async function handleChangePassword(e) {
		e.preventDefault();
		if (saving || pwdMismatch) return;
		saving = true;
		message = { type: '', text: '' };

		try {
			await authApi.changePassword({
				old_password: oldPassword,
				new_password: newPassword
			});
			message = {
				type: 'success',
				text: '¡Contraseña actualizada! Por tu seguridad, se han cerrado todas las demás sesiones activas.'
			};
			oldPassword = '';
			newPassword = '';
			confirmPassword = '';
			await loadSessions();
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'Error al actualizar contraseña.' };
		} finally {
			saving = false;
		}
	}

	// ── Sesiones Activas ─────────────────────────────────────────────────────
	let sessions = $state([]);
	let loadingSessions = $state(true);
	let revokingId = $state(null);
	let revokingAll = $state(false);

	async function loadSessions() {
		loadingSessions = true;
		try {
			const res = await authApi.sessions.list();
			sessions = res.sessions ?? [];
		} catch (_err) {
			sessions = [];
		} finally {
			loadingSessions = false;
		}
	}

	async function revokeSession(id) {
		if (revokingId) return;
		revokingId = id;
		try {
			await authApi.sessions.revoke(id);
			sessions = sessions.filter((s) => s.id !== id);
			message = { type: 'success', text: 'Sesión cerrada correctamente.' };
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'No se pudo cerrar la sesión.' };
		} finally {
			revokingId = null;
		}
	}

	async function revokeOthers() {
		if (revokingAll) return;
		revokingAll = true;
		try {
			const res = await authApi.sessions.revokeOthers();
			await loadSessions();
			message = {
				type: 'success',
				text: `Se cerraron ${res.revoked ?? 0} sesión(es) en otros dispositivos.`
			};
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'No se pudieron cerrar las sesiones.' };
		} finally {
			revokingAll = false;
		}
	}

	function formatDate(dateStr) {
		if (!dateStr) return '';
		return new Intl.DateTimeFormat('es-ES', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(String(dateStr).includes('T') ? dateStr : dateStr.replace(' ', 'T')));
	}

	onMount(() => {
		loadSessions();
	});
</script>

<svelte:head>
	<title>Seguridad y Sesiones — Voom!</title>
</svelte:head>

<div class="glass-card panel-card" class:is-saving={saving}>
	<SettingsMessage {message} />

	<div class="section-content">
		<div>
			<h3 class="section-title">Seguridad y Sesiones</h3>
			<p class="section-subtitle">
				Gestiona tus credenciales y revisa los dispositivos con acceso a tu cuenta.
			</p>
		</div>

		<!-- Cambiar Contraseña -->
		<div class="security-block">
			<h4 class="block-title">
				<span class="material-icons-round">password</span>
				Cambiar Contraseña
			</h4>
			<form onsubmit={handleChangePassword} class="form-container" style="max-width: 360px;">
				<div class="form-group">
					<label for="oldPassword" class="form-label">Contraseña Actual</label>
					<input
						id="oldPassword"
						type="password"
						required
						bind:value={oldPassword}
						class="aero-input"
						autocomplete="current-password"
					/>
				</div>
				<div class="form-group">
					<label for="newPassword" class="form-label">Nueva Contraseña</label>
					<input
						id="newPassword"
						type="password"
						required
						minlength="8"
						bind:value={newPassword}
						class="aero-input"
						autocomplete="new-password"
					/>
					{#if newPassword.length > 0 && newPassword.length < 8}
						<span class="pwd-hint error">Mínimo 8 caracteres</span>
					{/if}
				</div>
				<div class="form-group">
					<label for="confirmPassword" class="form-label">Confirmar Nueva Contraseña</label>
					<input
						id="confirmPassword"
						type="password"
						required
						bind:value={confirmPassword}
						class="aero-input"
						class:input-error={pwdMismatch}
						autocomplete="new-password"
					/>
					{#if pwdMismatch}
						<span class="pwd-hint error">Las contraseñas no coinciden</span>
					{/if}
				</div>
				<button
					type="submit"
					disabled={saving || !oldPassword || !newPassword || pwdMismatch}
					class="btn-aero-secondary btn-sm"
					style="padding: 8px 16px; align-self: flex-start;"
				>
					Actualizar Contraseña
				</button>
			</form>
		</div>

		<!-- Sesiones Activas -->
		<div class="security-block border-top" style="padding-top: 24px;">
			<div class="sessions-head">
				<div>
					<h4 class="block-title">
						<span class="material-icons-round">devices</span>
						Sesiones Activas
					</h4>
					<p class="section-subtitle" style="margin-top: 2px;">
						Dispositivos conectados actualmente a tu cuenta.
					</p>
				</div>
				{#if sessions.filter((x) => !x.is_current).length > 0}
					<button class="btn-aero-ghost danger-btn" onclick={revokeOthers} disabled={revokingAll}>
						<span class="material-icons-round">{revokingAll ? 'hourglass_empty' : 'logout'}</span>
						{revokingAll ? 'Cerrando...' : 'Cerrar todas las demás'}
					</button>
				{/if}
			</div>

			{#if loadingSessions}
				<div class="panel-loading">
					<span class="loading loading-spinner text-primary"></span>
					<span>Cargando sesiones...</span>
				</div>
			{:else if sessions.length === 0}
				<p class="session-empty">No hay sesiones activas que mostrar.</p>
			{:else}
				<div class="sessions-list">
					{#each sessions as sess (sess.id)}
						<div class="session-item" class:current={sess.is_current} in:fade={{ duration: 200 }}>
							<div class="session-icon">
								<span class="material-icons-round">
									{sess.device.device === 'Móvil'
										? 'smartphone'
										: sess.device.device === 'Tablet'
											? 'tablet_mac'
											: 'computer'}
								</span>
							</div>
							<div class="session-info">
								<div class="session-device-row">
									<span class="session-device">
										{sess.device.device}{sess.device.browser ? ` · ${sess.device.browser}` : ''}
									</span>
									{#if sess.is_current}
										<span class="session-badge-current" transition:slide={{ duration: 200 }}>
											<span class="material-icons-round">verified_user</span>
											Este dispositivo
										</span>
									{/if}
								</div>
								<span class="session-meta">
									IP {sess.ip_address} · Iniciada el {formatDate(sess.created_at)}
								</span>
							</div>
							{#if sess.is_current}
								<span class="session-active-pill">Sesión actual</span>
							{:else}
								<button
									class="btn-aero-ghost danger-btn btn-sm"
									style="flex-shrink: 0;"
									onclick={() => revokeSession(sess.id)}
									disabled={!!revokingId}
								>
									<span class="material-icons-round"
										>{revokingId === sess.id ? 'hourglass_empty' : 'delete_forever'}</span
									>
									{revokingId === sess.id ? 'Cerrando...' : 'Cerrar'}
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.security-block {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.block-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-main);
		margin: 0;
	}

	.block-title .material-icons-round {
		font-size: 18px;
		color: var(--aero-blue);
	}

	.pwd-hint {
		font-size: 0.68rem;
		margin-top: 2px;
	}

	.pwd-hint.error {
		color: var(--aero-rose);
	}

	.input-error {
		border-color: var(--aero-rose) !important;
	}

	.sessions-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.danger-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--aero-rose);
		border: 1px solid color-mix(in srgb, var(--aero-rose) 30%, transparent);
		border-radius: var(--radius-sm);
		padding: 6px 12px;
		background: transparent;
		cursor: pointer;
		font-size: 0.72rem;
		font-weight: 600;
		transition: background 0.2s ease;
	}

	.danger-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--aero-rose) 10%, transparent);
	}

	.danger-btn .material-icons-round {
		font-size: 15px;
	}

	.sessions-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.session-item {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
	}

	.session-item.current {
		border-color: color-mix(in srgb, var(--aero-mint) 35%, transparent);
		background: color-mix(in srgb, var(--aero-mint) 5%, transparent);
	}

	.session-icon {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		background: var(--bg-surface-elevated);
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.session-icon .material-icons-round {
		font-size: 20px;
		color: var(--text-muted);
	}

	.session-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.session-device-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.session-device {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--text-main);
	}

	.session-badge-current {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		color: var(--aero-mint);
	}

	.session-badge-current .material-icons-round {
		font-size: 13px;
	}

	.session-meta {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.session-active-pill {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--aero-mint);
		border: 1px solid color-mix(in srgb, var(--aero-mint) 35%, transparent);
		border-radius: 999px;
		padding: 4px 10px;
		flex-shrink: 0;
	}

	.session-empty {
		font-size: 0.78rem;
		color: var(--text-muted);
		padding: 16px 0;
	}
</style>
