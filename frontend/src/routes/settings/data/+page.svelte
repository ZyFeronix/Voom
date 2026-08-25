<script>
	import { users as usersApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { goto } from '$app/navigation';
	import SettingsMessage from '$lib/components/settings/SettingsMessage.svelte';

	let deletePassword = $state('');
	let deleteConfirmText = $state('');
	let deleting = $state(false);
	let exporting = $state(false);
	let message = $state({ type: '', text: '' });

	const CONFIRM_WORD = 'ELIMINAR';
	let confirmValid = $derived(deleteConfirmText.trim().toUpperCase() === CONFIRM_WORD);

	async function handleExport() {
		exporting = true;
		message = { type: '', text: '' };
		try {
			const res = await usersApi.exportData();
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			const cd = res.headers.get('content-disposition') || '';
			a.download = cd.match(/filename="(.+)"/)?.[1] || 'vsocial_export.json';
			a.click();
			URL.revokeObjectURL(url);
			message = { type: 'success', text: 'Exportación descargada correctamente.' };
		} catch (e) {
			message = { type: 'error', text: e?.message ?? 'No se pudo exportar tus datos.' };
		} finally {
			exporting = false;
		}
	}

	async function handleDeleteAccount(e) {
		e.preventDefault();
		if (!deletePassword || !confirmValid || deleting) return;
		deleting = true;
		message = { type: '', text: '' };
		try {
			await usersApi.deleteAccount(deletePassword);
			await authStore.logout();
			goto('/');
		} catch (e2) {
			message = { type: 'error', text: e2?.message ?? 'No se pudo eliminar la cuenta.' };
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>Mis Datos (RGPD) — VSocial</title>
</svelte:head>

<div class="glass-card panel-card">
	<SettingsMessage {message} />

	<div class="section-content">
		<div>
			<h3 class="section-title">Mis Datos (RGPD)</h3>
			<p class="section-subtitle">
				Descarga una copia de tus datos o solicita la eliminación de tu cuenta.
			</p>
		</div>

		<!-- Exportación de datos (art. 20 portabilidad) -->
		<div class="toggle-settings-group border-bottom">
			<div class="toggle-details">
				<span class="toggle-title">Descargar mis datos</span>
				<span class="toggle-desc">
					Exporta toda tu información (perfil, publicaciones, mensajes, cartera, actividad…) en un
					archivo JSON.
				</span>
			</div>
			<button
				class="btn-aero-secondary"
				style="padding: 10px 20px; flex-shrink: 0;"
				onclick={handleExport}
				disabled={exporting}
			>
				<span class="btn-spinner" class:show={exporting}>
					<span class="loading loading-spinner loading-xs"></span>
				</span>
				{#if exporting}Generando...{:else}Descargar JSON{/if}
			</button>
		</div>

		<!-- Zona de peligro: eliminación de cuenta (art. 17 supresión) -->
		<div class="danger-zone">
			<div class="danger-title">Eliminar cuenta</div>
			<p class="toggle-desc" style="margin-bottom: 0.85rem;">
				Tu cuenta se desactivará de inmediato y se eliminará permanentemente, junto con todo su
				contenido y ficheros, transcurridos 30 días. Puedes reactivarla iniciando sesión dentro de
				ese plazo. Esta acción es irreversible una vez vencido el periodo.
			</p>
			<form onsubmit={handleDeleteAccount} class="danger-form">
				<input
					type="text"
					bind:value={deleteConfirmText}
					placeholder={`Escribe "${CONFIRM_WORD}" para confirmar`}
					class="aero-input"
					class:input-error={deleteConfirmText.length > 0 && !confirmValid}
					style="width: 100%; max-width: 360px;"
					autocomplete="off"
					required
				/>
				<input
					type="password"
					bind:value={deletePassword}
					placeholder="Confirma tu contraseña"
					class="aero-input"
					style="width: 100%; max-width: 360px;"
					autocomplete="current-password"
					required
				/>
				<button
					type="submit"
					class="btn-aero-primary"
					style="padding: 10px 20px; background: var(--aero-rose); align-self: flex-start;"
					disabled={deleting || !deletePassword || !confirmValid}
				>
					<span class="btn-spinner" class:show={deleting}>
						<span class="loading loading-spinner loading-xs"></span>
					</span>
					{#if deleting}Eliminando...{:else}Eliminar mi cuenta{/if}
				</button>
			</form>
		</div>
	</div>
</div>

<style>
	.danger-zone {
		border: 1px solid color-mix(in srgb, var(--aero-rose) 30%, transparent);
		border-radius: var(--radius-md);
		padding: 1.25rem;
		margin-top: 1rem;
	}

	.danger-title {
		color: var(--aero-rose);
		font-size: 1.05rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
	}

	.danger-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 360px;
	}

	.input-error {
		border-color: var(--aero-rose) !important;
	}
</style>
