<script>
	import { users as usersApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import ImageCropperModal from '$lib/components/ImageCropperModal.svelte';
	import SettingsMessage from '$lib/components/settings/SettingsMessage.svelte';

	let { data } = $props();

	let saving = $state(false);
	let message = $state({ type: '', text: '' });

	// Profile fields (inicializados desde el load del layout — sin fetch extra).
	// Captura intencional de valores iniciales: el formulario se siembra una vez
	// por montaje (cada navegación crea una instancia nueva del componente).
	// svelte-ignore state_referenced_locally
	const u = data.user;
	let displayName = $state(u?.display_name || '');
	let bio = $state(u?.bio || '');
	let location = $state(u?.location || '');
	let website = $state(u?.website || '');
	let avatarPreview = $state(u?.avatar_url || '');
	let coverPreview = $state(u?.cover_url || '');

	// Media upload inputs
	let avatarInput = $state(null);
	let coverInput = $state(null);

	// Cropper State
	let cropFile = $state(null);
	let cropType = $state(null); // 'avatar' | 'cover'
	let cropRatio = $state(1);

	async function saveProfile(e) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		message = { type: '', text: '' };

		try {
			const payload = {
				display_name: displayName.trim(),
				bio: bio.trim(),
				location: location.trim(),
				website: website.trim()
			};
			await usersApi.updateProfile(payload);
			authStore.updateUser(payload);
			message = { type: 'success', text: '¡Perfil actualizado con éxito!' };
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'Error al actualizar el perfil.' };
		} finally {
			saving = false;
		}
	}

	function handleAvatarChange(e) {
		const file = e.target.files[0];
		if (!file || saving) return;
		cropFile = file;
		cropType = 'avatar';
		cropRatio = 1;
		e.target.value = ''; // Reset input so it can be selected again
	}

	function handleCoverChange(e) {
		const file = e.target.files[0];
		if (!file || saving) return;
		cropFile = file;
		cropType = 'cover';
		cropRatio = 16 / 5; // 3.2:1 ideal banner ratio
		e.target.value = '';
	}

	async function handleCrop(croppedFile) {
		const type = cropType;
		cropFile = null;
		cropType = null;

		saving = true;
		message = { type: '', text: '' };
		try {
			const fd = new FormData();
			if (type === 'avatar') {
				fd.append('avatar', croppedFile);
				const res = await usersApi.uploadAvatar(fd);
				if (res.success) {
					avatarPreview = res.avatar_url;
					authStore.updateUser({ avatar_url: res.avatar_url });
					message = { type: 'success', text: '¡Foto de perfil actualizada con éxito!' };
				}
			} else if (type === 'cover') {
				fd.append('cover', croppedFile);
				const res = await usersApi.uploadCover(fd);
				if (res.success) {
					coverPreview = res.cover_url;
					authStore.updateUser({ cover_url: res.cover_url });
					message = { type: 'success', text: '¡Portada del perfil actualizada con éxito!' };
				}
			}
		} catch (err) {
			message = {
				type: 'error',
				text: err?.message ?? `Error al subir ${type === 'avatar' ? 'foto de perfil' : 'portada'}.`
			};
		} finally {
			saving = false;
		}
	}

	function cancelCrop() {
		cropFile = null;
		cropType = null;
	}
</script>

<svelte:head>
	<title>Editar Perfil — VSocial</title>
</svelte:head>

<div class="glass-card panel-card" class:is-saving={saving}>
	<SettingsMessage {message} />

	<div class="section-content">
		<div>
			<h3 class="section-title">Editar Perfil</h3>
			<p class="section-subtitle">Controla tu identidad pública y fotos en VSocial.</p>
		</div>

		<!-- Visual Identity Studio (Avatar & Cover) -->
		<div class="profile-visual-card glass-panel">
			<!-- Cover Preview Banner -->
			<div class="profile-visual-cover">
				{#if coverPreview}
					<img src={coverPreview} alt="Vista previa de portada" />
				{:else}
					<div class="no-cover-art">
						<span class="material-icons-round no-cover-icon">panorama</span>
						<span>Sin imagen de portada configurada</span>
					</div>
				{/if}
				<div class="cover-gradient-shade"></div>

				<button
					type="button"
					class="btn-cover-action"
					onclick={() => coverInput.click()}
					title="Cambiar imagen de portada (16:5)"
				>
					<span class="material-icons-round">photo_camera</span>
					<span class="btn-text">Cambiar portada</span>
				</button>
			</div>

			<!-- Avatar & Studio Info Row -->
			<div class="profile-visual-bottom">
				<div class="avatar-interactive-slot">
					<div class="avatar-visual-circle">
						{#if avatarPreview}
							<img src={avatarPreview} alt="Avatar preview" />
						{:else}
							<span class="avatar-initials-text">{displayName[0]?.toUpperCase() || '?'}</span>
						{/if}
						<button
							type="button"
							class="avatar-camera-overlay"
							onclick={() => avatarInput.click()}
							aria-label="Cambiar foto de perfil"
							title="Cambiar foto de perfil (1:1)"
						>
							<span class="material-icons-round">photo_camera</span>
						</button>
						<div class="avatar-corner-badge" aria-hidden="true">
							<span class="material-icons-round">photo_camera</span>
						</div>
					</div>
				</div>

				<div class="visual-actions-meta">
					<div class="visual-hints-row">
						<span class="visual-hint">
							<span class="material-icons-round hint-dot">check_circle</span>
							Avatar: 1:1 circular
						</span>
						<span class="visual-hint">
							<span class="material-icons-round hint-dot">check_circle</span>
							Portada: 16:5 panorámica (1920×600px)
						</span>
					</div>
				</div>
			</div>

			<input
				id="avatar-upload"
				name="avatar-upload"
				type="file"
				accept="image/*"
				bind:this={avatarInput}
				onchange={handleAvatarChange}
				style="display: none;"
			/>
			<input
				id="cover-upload"
				name="cover-upload"
				type="file"
				accept="image/*"
				bind:this={coverInput}
				onchange={handleCoverChange}
				style="display: none;"
			/>
		</div>

		<!-- General Form -->
		<form onsubmit={saveProfile} class="form-container">
			<div class="form-group">
				<label for="displayName" class="form-label">Nombre de pantalla</label>
				<input id="displayName" type="text" required bind:value={displayName} class="aero-input" />
			</div>

			<div class="form-group">
				<label for="bio" class="form-label">Biografía</label>
				<textarea
					id="bio"
					rows="3"
					bind:value={bio}
					placeholder="Cuéntale al mundo sobre tu avatar virtual..."
					class="aero-textarea"
				></textarea>
			</div>

			<div class="form-row">
				<div class="form-group">
					<label for="location" class="form-label">Ubicación</label>
					<input
						id="location"
						type="text"
						bind:value={location}
						placeholder="Internet, Twitch, Japón..."
						class="aero-input"
					/>
				</div>
				<div class="form-group">
					<label for="website" class="form-label">Sitio Web</label>
					<input
						id="website"
						type="url"
						bind:value={website}
						placeholder="https://tuchanal.com"
						class="aero-input"
					/>
				</div>
			</div>

			<button type="submit" class="btn-aero-primary" style="margin-top: 12px; padding: 10px 24px;">
				<span class="btn-spinner" class:show={saving}>
					<span class="loading loading-spinner loading-xs"></span>
				</span>
				<span>Guardar Perfil</span>
			</button>
		</form>
	</div>
</div>

{#if cropFile}
	<ImageCropperModal
		imageFile={cropFile}
		aspectRatio={cropRatio}
		shape={cropType === 'avatar' ? 'circle' : 'rect'}
		{cropType}
		title={cropType === 'avatar' ? 'Ajustar Foto de Perfil' : 'Ajustar Portada de Perfil'}
		subtitle={cropType === 'avatar'
			? 'Centra y escala tu avatar • Proporción 1:1'
			: 'Encuadra tu banner panorámico • Proporción 16:5'}
		onCrop={handleCrop}
		onCancel={cancelCrop}
	/>
{/if}
