<script>
	import { users as usersApi } from '$lib/api.js';
	import SettingsMessage from '$lib/components/settings/SettingsMessage.svelte';

	let { data } = $props();

	let saving = $state(false);
	let message = $state({ type: '', text: '' });

	// Notification fields — precargados desde el load del layout
	// svelte-ignore state_referenced_locally
	const s = data.settings ?? {};
	let notifyLikes = $state(s.notify_likes ?? true);
	let notifyComments = $state(s.notify_comments ?? true);
	let notifyFollows = $state(s.notify_follows ?? true);
	let notifyDMs = $state(s.notify_dms ?? true);
	let notifyEmail = $state(s.notification_email ?? true);
	let notifyPush = $state(s.notification_push ?? true);

	async function saveNotifications(e) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		message = { type: '', text: '' };

		try {
			const payload = {
				notify_likes: !!notifyLikes,
				notify_comments: !!notifyComments,
				notify_follows: !!notifyFollows,
				notify_dms: !!notifyDMs,
				notification_email: !!notifyEmail,
				notification_push: !!notifyPush
			};
			await usersApi.settings.update(payload);
			message = {
				type: 'success',
				text: '¡Preferencias de notificaciones guardadas! Se aplican a las notificaciones nuevas.'
			};
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'Error al guardar la configuración.' };
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Notificaciones — Voom!</title>
</svelte:head>

<div class="glass-card panel-card" class:is-saving={saving}>
	<SettingsMessage {message} />

	<div class="section-content">
		<div>
			<h3 class="section-title">Notificaciones</h3>
			<p class="section-subtitle">Controla cuándo y cómo deseas ser notificado.</p>
		</div>

		<form onsubmit={saveNotifications} class="form-container">
			<!-- Canales -->
			<span class="form-label">Canales</span>
			<div class="toggle-settings-group border-bottom">
				<div class="toggle-details">
					<span class="toggle-title">Notificaciones por Email</span>
					<span class="toggle-desc">
						Recibe un resumen y avisos importantes en tu correo ({data.user?.email || 'tu email'}).
					</span>
				</div>
				<input type="checkbox" bind:checked={notifyEmail} class="aero-toggle-switch" />
			</div>

			<div class="toggle-settings-group border-bottom">
				<div class="toggle-details">
					<span class="toggle-title">Notificaciones Push</span>
					<span class="toggle-desc">
						Avisos en tiempo real del navegador cuando no tienes Voom! abierto.
					</span>
				</div>
				<input type="checkbox" bind:checked={notifyPush} class="aero-toggle-switch" />
			</div>

			<!-- Actividad social -->
			<span class="form-label" style="margin-top: 8px;">Actividad social</span>
			<div class="toggle-settings-group border-bottom">
				<div class="toggle-details">
					<span class="toggle-title">Me gusta (Likes)</span>
					<span class="toggle-desc">Cuando alguien reacciona a tus publicaciones.</span>
				</div>
				<input type="checkbox" bind:checked={notifyLikes} class="aero-toggle-switch" />
			</div>

			<div class="toggle-settings-group border-bottom">
				<div class="toggle-details">
					<span class="toggle-title">Comentarios</span>
					<span class="toggle-desc">Cuando alguien comenta tus posts o reels.</span>
				</div>
				<input type="checkbox" bind:checked={notifyComments} class="aero-toggle-switch" />
			</div>

			<div class="toggle-settings-group border-bottom">
				<div class="toggle-details">
					<span class="toggle-title">Nuevos Seguidores</span>
					<span class="toggle-desc">Cuando un usuario empieza a seguir tu cuenta.</span>
				</div>
				<input type="checkbox" bind:checked={notifyFollows} class="aero-toggle-switch" />
			</div>

			<div class="toggle-settings-group">
				<div class="toggle-details">
					<span class="toggle-title">Mensajes Directos (DMs)</span>
					<span class="toggle-desc">Cuando recibes un nuevo mensaje o reacción en el chat.</span>
				</div>
				<input type="checkbox" bind:checked={notifyDMs} class="aero-toggle-switch" />
			</div>

			<p class="setting-note">
				<span class="material-icons-round">info</span>
				Los avisos de sistema (moderación, seguridad, ofertas aceptadas) no se pueden desactivar.
			</p>

			<button
				type="submit"
				class="btn-aero-primary"
				style="padding: 10px 24px; align-self: flex-start; margin-top: 4px;"
			>
				<span class="btn-spinner" class:show={saving}>
					<span class="loading loading-spinner loading-xs"></span>
				</span>
				<span>Guardar Notificaciones</span>
			</button>
		</form>
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
	}

	.setting-note .material-icons-round {
		font-size: 14px;
		margin-top: 1px;
		color: var(--aero-sky);
		flex-shrink: 0;
	}
</style>
