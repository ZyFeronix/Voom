<script>
	import { users as usersApi } from '$lib/api.js';
	import SettingsMessage from '$lib/components/settings/SettingsMessage.svelte';

	let { data } = $props();

	let saving = $state(false);
	let message = $state({ type: '', text: '' });

	// Privacy fields — precargados desde el load del layout
	// svelte-ignore state_referenced_locally
	const s = data.settings ?? {};
	let profileVisibility = $state(s.profile_visibility ?? 'public');
	let allowDMs = $state(s.allow_dms ?? 'everyone');
	let showOnlineStatus = $state(s.show_online_status ?? true);

	async function savePrivacy(e) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		message = { type: '', text: '' };

		try {
			const payload = {
				profile_visibility: profileVisibility,
				allow_dms: allowDMs,
				show_online_status: !!showOnlineStatus
			};
			await usersApi.settings.update(payload);
			message = {
				type: 'success',
				text: '¡Configuración de privacidad guardada con éxito! Se aplica de inmediato en toda la plataforma.'
			};
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'Error al guardar la configuración.' };
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Privacidad — Voom!</title>
</svelte:head>

<div class="glass-card panel-card" class:is-saving={saving}>
	<SettingsMessage {message} />

	<div class="section-content">
		<div>
			<h3 class="section-title">Privacidad</h3>
			<p class="section-subtitle">
				Controla quién ve tu perfil, quién puede escribirte y tu estado de conexión.
			</p>
		</div>

		<form onsubmit={savePrivacy} class="form-container">
			<!-- Visibilidad de Perfil -->
			<div class="radio-settings-group">
				<span class="form-label">Quién puede ver tu perfil</span>
				<div class="radio-options">
					<label class="radio-option">
						<input type="radio" name="visibility" value="public" bind:group={profileVisibility} />
						<span>Público (Cualquier usuario o visitante)</span>
					</label>
					<label class="radio-option">
						<input
							type="radio"
							name="visibility"
							value="followers"
							bind:group={profileVisibility}
						/>
						<span>Solo Seguidores</span>
					</label>
					<label class="radio-option">
						<input type="radio" name="visibility" value="friends" bind:group={profileVisibility} />
						<span>Solo Amigos (Mutuo follow)</span>
					</label>
				</div>
				<p class="setting-note">
					<span class="material-icons-round">verified_user</span>
					Si restringes tu perfil, tu biografía, publicaciones y reels solo serán visibles para quien
					cumpla el requisito.
				</p>
			</div>

			<!-- DM Settings -->
			<div class="radio-settings-group border-top">
				<span class="form-label">Mensajería Directa (conversaciones nuevas)</span>
				<div class="radio-options">
					<label class="radio-option">
						<input type="radio" name="dms" value="everyone" bind:group={allowDMs} />
						<span>Todos pueden enviarme DMs</span>
					</label>
					<label class="radio-option">
						<input type="radio" name="dms" value="followers" bind:group={allowDMs} />
						<span>Solo creadores que sigo</span>
					</label>
					<label class="radio-option">
						<input type="radio" name="dms" value="none" bind:group={allowDMs} />
						<span>Nadie (Desactivar DMs entrantes)</span>
					</label>
				</div>
				<p class="setting-note">
					<span class="material-icons-round">info</span>
					Los chats ya existentes siguen funcionando; la restricción aplica a conversaciones nuevas. Los
					usuarios bloqueados nunca pueden escribirte.
				</p>
			</div>

			<!-- Online Status toggle -->
			<div class="toggle-settings-group border-top">
				<div class="toggle-details">
					<span class="toggle-title">Mostrar estado de conexión</span>
					<span class="toggle-desc">Permite que tus amigos vean cuándo estás en línea.</span>
				</div>
				<input type="checkbox" bind:checked={showOnlineStatus} class="aero-toggle-switch" />
			</div>

			<button
				type="submit"
				class="btn-aero-primary"
				style="padding: 10px 24px; align-self: flex-start;"
			>
				<span class="btn-spinner" class:show={saving}>
					<span class="loading loading-spinner loading-xs"></span>
				</span>
				<span>Guardar Privacidad</span>
			</button>
		</form>

		<p class="section-footer-link">
			¿Buscas cambiar tu contraseña o cerrar sesiones remotas?
			<a href="/settings/security">Ve a Seguridad →</a>
		</p>
	</div>
</div>

<style>
	.setting-note {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		font-size: 0.72rem;
		color: var(--text-muted);
		line-height: 1.5;
		margin-top: 8px;
	}

	.setting-note .material-icons-round {
		font-size: 14px;
		margin-top: 1px;
		color: var(--aero-sky);
		flex-shrink: 0;
	}

	.section-footer-link {
		font-size: 0.75rem;
		color: var(--text-muted);
		border-top: 1px solid var(--border-subtle);
		padding-top: 16px;
	}

	.section-footer-link a {
		color: var(--aero-blue);
		text-decoration: none;
		font-weight: 600;
	}

	.section-footer-link a:hover {
		text-decoration: underline;
	}
</style>
