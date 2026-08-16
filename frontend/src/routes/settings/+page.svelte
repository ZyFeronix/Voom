<script>
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { goto } from '$app/navigation';

	// Drives CSS-only section crossfade — toggled on every section switch
	let sectionKey = $state(0);
	import { users as usersApi, feed as feedApi, auth as authApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { perfStore } from '$lib/stores/perf.svelte.js';
	import { validatePaymentLink } from '$lib/validators.js';
	import ImageCropperModal from '$lib/components/ImageCropperModal.svelte';

	// ── Runes State ──────────────────────────────────────────────────────────
	let activeSection = $state('profile'); // 'profile', 'privacy', 'notifications', 'algorithm', 'data', 'payments', 'performance'
	let loading = $state(true);
	let saving = $state(false);
	let message = $state({ type: '', text: '' });

	// ── Pagos y Enlaces (P2P) ───────────────────────────────────────────────
	let paymentLink = $state('');
	let savedPaymentLink = $state('');
	let paymentLinkHint = $state({ ok: true, host: null, error: '' });
	let savingPaymentLink = $state(false);

	let selectedPlatform = $state('');
	let paymentUsername = $state('');

	const PAYMENT_PLATFORMS = [
		{ id: 'paypal', host: 'paypal.me', name: 'PayPal', prefix: 'paypal.me/' },
		{ id: 'patreon', host: 'patreon.com', name: 'Patreon', prefix: 'patreon.com/' },
		{ id: 'kofi', host: 'ko-fi.com', name: 'Ko-fi', prefix: 'ko-fi.com/' }
	];

	function selectPaymentPlatform(id) {
		selectedPlatform = id;
		buildPaymentLink();
	}

	function buildPaymentLink() {
		if (!selectedPlatform || !paymentUsername) {
			paymentLink = '';
		} else {
			const p = PAYMENT_PLATFORMS.find((x) => x.id === selectedPlatform);
			paymentLink = `https://${p.prefix}${paymentUsername.trim()}`;
		}
		paymentLinkHint = validatePaymentLink(paymentLink);
	}

	function parsePaymentLinkToBuilder(urlStr) {
		if (!urlStr) {
			selectedPlatform = '';
			paymentUsername = '';
			return;
		}
		let url;
		try {
			url = new URL(urlStr);
		} catch {
			return;
		}

		let host = url.hostname.toLowerCase();
		if (host.startsWith('www.')) host = host.slice(4);

		const p = PAYMENT_PLATFORMS.find((x) => host === x.host || host.endsWith('.' + x.host));
		if (p) {
			selectedPlatform = p.id;
			paymentUsername = url.pathname.replace(/^\/+/, '');
		}
	}

	function onPaymentLinkInput() {
		buildPaymentLink();
	}

	async function savePaymentLink() {
		if (savingPaymentLink) return;
		const v = validatePaymentLink(paymentLink);
		if (!v.ok) {
			paymentLinkHint = v;
			return;
		}
		savingPaymentLink = true;
		try {
			await usersApi.updateProfile({ payment_link: v.value });
			authStore.updateUser({ payment_link: v.value });
			savedPaymentLink = v.value;
			paymentLinkHint = { ok: true, host: v.host };
			message = {
				type: 'success',
				text: v.value
					? 'Enlace de pago guardado y visible en tu perfil.'
					: 'Enlace de pago eliminado.'
			};
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'Error al guardar el enlace.' };
		} finally {
			savingPaymentLink = false;
		}
	}

	async function clearPaymentLink() {
		if (savingPaymentLink) return;
		savingPaymentLink = true;
		try {
			await usersApi.updateProfile({ payment_link: null });
			authStore.updateUser({ payment_link: null });
			paymentLink = '';
			savedPaymentLink = '';
			selectedPlatform = '';
			paymentUsername = '';
			paymentLinkHint = { ok: true, host: null, error: '' };
		} catch (err) {
			console.error('Error clearing payment link', err);
		} finally {
			savingPaymentLink = false;
		}
	}

	// ── Mis Datos (RGPD) ─────────────────────────────────────────────────────
	let deletePassword = $state('');
	let deleting = $state(false);
	let exporting = $state(false);

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

	async function handleDeleteAccount() {
		if (!deletePassword) return;
		deleting = true;
		message = { type: '', text: '' };
		try {
			await usersApi.deleteAccount(deletePassword);
			await authStore.logout();
			goto('/');
		} catch (e) {
			message = { type: 'error', text: e?.message ?? 'No se pudo eliminar la cuenta.' };
		} finally {
			deleting = false;
		}
	}

	function selectSection(section) {
		activeSection = section;
		sectionKey++;
		message = { type: '', text: '' };
	}

	// Profile fields
	let displayName = $state('');
	let bio = $state('');
	let location = $state('');
	let website = $state('');
	let avatarPreview = $state('');
	let coverPreview = $state('');

	// Media upload inputs
	let avatarInput = $state(null);
	let coverInput = $state(null);

	// Cropper State
	let cropFile = $state(null);
	let cropType = $state(null); // 'avatar' or 'cover'
	let cropRatio = $state(1);

	// Change Password fields
	let oldPassword = $state('');
	let newPassword = $state('');

	// Algorithm weight fields (coefficients)
	let wInterests = $state(50);
	let wInteractions = $state(40);
	let wSocial = $state(30);
	let wPopularity = $state(20);
	let wRecency = $state(70);
	let wDiversity = $state(15);
	let feedMode = $state('intelligent'); // 'retention', 'intelligent', or 'radar'

	// Privacy fields
	let profileVisibility = $state('public');
	let allowDMs = $state('everyone');
	let showOnlineStatus = $state(true);

	// Notification fields
	let notifyLikes = $state(true);
	let notifyComments = $state(true);
	let notifyFollows = $state(true);
	let notifyDMs = $state(true);

	// Derived: sum of algorithm weights for percentage calculations
	let totalWeight = $derived(
		Math.max(
			1,
			Number(wInterests) +
				Number(wInteractions) +
				Number(wSocial) +
				Number(wPopularity) +
				Number(wRecency) +
				Number(wDiversity)
		)
	);

	// ── Feed mode metadata (drives the mode cards) ─────────────────────────────
	const FEED_MODES = [
		{
			id: 'retention',
			icon: 'auto_awesome',
			title: 'Descubrimiento',
			tag: 'Para Ti',
			desc: 'Contenido viral y nuevos creadores, estilo "For You". Los pesos se optimizan automáticamente.'
		},
		{
			id: 'intelligent',
			icon: 'tune',
			title: 'Feed Inteligente',
			tag: 'Personalizado',
			desc: 'Tú controlas la mezcla exacta con los seis pesos de abajo. Máximo control.'
		},
		{
			id: 'radar',
			icon: 'bolt',
			title: 'Radar en Vivo',
			tag: 'Cronológico',
			desc: 'Línea de tiempo pura: lo más reciente de quienes sigues, sin reordenar por algoritmo.'
		}
	];

	// ── Presets (1-click weight profiles, only meaningful in "intelligent") ─────
	const PRESETS = [
		{
			id: 'balanced',
			icon: 'balance',
			label: 'Equilibrado',
			w: { interests: 50, interactions: 40, social: 45, popularity: 30, recency: 60, diversity: 25 }
		},
		{
			id: 'discovery',
			icon: 'explore',
			label: 'Descubrimiento',
			w: { interests: 70, interactions: 25, social: 15, popularity: 85, recency: 70, diversity: 80 }
		},
		{
			id: 'close',
			icon: 'favorite',
			label: 'Círculo cercano',
			w: { interests: 30, interactions: 80, social: 90, popularity: 15, recency: 55, diversity: 10 }
		},
		{
			id: 'fresh',
			icon: 'schedule',
			label: 'Recientes',
			w: {
				interests: 25,
				interactions: 30,
				social: 40,
				popularity: 20,
				recency: 100,
				diversity: 20
			}
		},
		{
			id: 'viral',
			icon: 'trending_up',
			label: 'Solo virales',
			w: {
				interests: 35,
				interactions: 15,
				social: 10,
				popularity: 100,
				recency: 50,
				diversity: 40
			}
		}
	];

	const DEFAULT_WEIGHTS = {
		interests: 50,
		interactions: 40,
		social: 30,
		popularity: 20,
		recency: 70,
		diversity: 15
	};

	function selectMode(id) {
		feedMode = id;
	}

	function applyPreset(preset) {
		feedMode = 'intelligent';
		wInterests = preset.w.interests;
		wInteractions = preset.w.interactions;
		wSocial = preset.w.social;
		wPopularity = preset.w.popularity;
		wRecency = preset.w.recency;
		wDiversity = preset.w.diversity;
	}

	function resetWeights() {
		wInterests = DEFAULT_WEIGHTS.interests;
		wInteractions = DEFAULT_WEIGHTS.interactions;
		wSocial = DEFAULT_WEIGHTS.social;
		wPopularity = DEFAULT_WEIGHTS.popularity;
		wRecency = DEFAULT_WEIGHTS.recency;
		wDiversity = DEFAULT_WEIGHTS.diversity;
	}

	// Which preset (if any) exactly matches the current weight vector — highlights the chip.
	let activePreset = $derived(
		PRESETS.find(
			(p) =>
				Number(wInterests) === p.w.interests &&
				Number(wInteractions) === p.w.interactions &&
				Number(wSocial) === p.w.social &&
				Number(wPopularity) === p.w.popularity &&
				Number(wRecency) === p.w.recency &&
				Number(wDiversity) === p.w.diversity
		)?.id || null
	);

	// Human-readable summary of what the current mix does — the top two weights drive it.
	const WEIGHT_LABELS = {
		interests: 'tus intereses temáticos',
		interactions: 'creadores con los que interactúas',
		social: 'personas que sigues',
		popularity: 'publicaciones populares',
		recency: 'lo más reciente',
		diversity: 'variedad de creadores'
	};
	let feedSummary = $derived.by(() => {
		if (feedMode === 'radar')
			return 'Verás las publicaciones más recientes de quienes sigues, en orden cronológico estricto.';
		if (feedMode === 'retention')
			return 'El sistema elige por ti: contenido viral, fresco y variado para descubrir gente nueva.';
		const ranked = [
			{ k: 'interests', v: Number(wInterests) },
			{ k: 'interactions', v: Number(wInteractions) },
			{ k: 'social', v: Number(wSocial) },
			{ k: 'popularity', v: Number(wPopularity) },
			{ k: 'recency', v: Number(wRecency) },
			{ k: 'diversity', v: Number(wDiversity) }
		].sort((a, b) => b.v - a.v);
		return `Tu feed prioriza sobre todo ${WEIGHT_LABELS[ranked[0].k]} y ${WEIGHT_LABELS[ranked[1].k]}.`;
	});

	// ── Lifecycle ────────────────────────────────────────────────────────────
	onMount(async () => {
		perfStore.init();
		loading = true;
		try {
			// Load user profile defaults
			if (authStore.user) {
				displayName = authStore.user.display_name || '';
				bio = authStore.user.bio || '';
				location = authStore.user.location || '';
				website = authStore.user.website || '';
				avatarPreview = authStore.user.avatar_url || '';
				coverPreview = authStore.user.cover_url || '';
				paymentLink =
					authStore.user.payment_link && authStore.user.payment_link !== 'null'
						? authStore.user.payment_link
						: '';
				savedPaymentLink = paymentLink;
				parsePaymentLinkToBuilder(paymentLink);
				paymentLinkHint = validatePaymentLink(paymentLink);
			}

			// Load algorithm preferences
			try {
				const prefRes = await feedApi.preferences.get();
				if (prefRes.preferences) {
					const p = prefRes.preferences;
					wInterests = p.w_interests ?? 50;
					wInteractions = p.w_interactions ?? 40;
					wSocial = p.w_social ?? 30;
					wPopularity = p.w_popularity ?? 20;
					wRecency = p.w_recency ?? 70;
					wDiversity = p.w_diversity ?? 15;
					feedMode = p.feed_mode ?? 'intelligent';
				}
			} catch (_err) {
				console.warn('Algorithm preferences endpoint failed, using default state.');
			}

			// Load user general settings
			try {
				const settingsRes = await usersApi.settings.get();
				if (settingsRes.settings) {
					const s = settingsRes.settings;
					profileVisibility = s.profile_visibility ?? 'public';
					allowDMs = s.allow_dms ?? 'everyone';
					showOnlineStatus = s.show_online_status ?? true;
					notifyLikes = s.notify_likes ?? true;
					notifyComments = s.notify_comments ?? true;
					notifyFollows = s.notify_follows ?? true;
					notifyDMs = s.notify_dms ?? true;
				}
			} catch (_err) {
				console.warn('General settings endpoint failed, using local mockup defaults.');
			}
		} catch (err) {
			console.error('Failed to load settings:', err);
		} finally {
			loading = false;
		}
	});

	// ── Actions ──────────────────────────────────────────────────────────────
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

	async function handleChangePassword(e) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		message = { type: '', text: '' };

		try {
			await authApi.changePassword({
				old_password: oldPassword,
				new_password: newPassword
			});
			message = { type: 'success', text: '¡Contraseña actualizada con éxito!' };
			oldPassword = '';
			newPassword = '';
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'Error al actualizar contraseña.' };
		} finally {
			saving = false;
		}
	}

	async function saveAlgorithmSettings(e) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		message = { type: '', text: '' };

		try {
			const payload = {
				w_interests: Number(wInterests),
				w_interactions: Number(wInteractions),
				w_social: Number(wSocial),
				w_popularity: Number(wPopularity),
				w_recency: Number(wRecency),
				w_diversity: Number(wDiversity),
				feed_mode: feedMode
			};
			await feedApi.preferences.update(payload);
			message = { type: 'success', text: '¡Preferencias del algoritmo guardadas con éxito!' };
		} catch (err) {
			message = {
				type: 'error',
				text: err?.message ?? 'Error al guardar las preferencias del feed.'
			};
		} finally {
			saving = false;
		}
	}

	async function saveGeneralSettings(e) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		message = { type: '', text: '' };

		try {
			const payload = {
				profile_visibility: profileVisibility,
				allow_dms: allowDMs,
				show_online_status: showOnlineStatus,
				notify_likes: notifyLikes,
				notify_comments: notifyComments,
				notify_follows: notifyFollows,
				notify_dms: notifyDMs
			};
			await usersApi.settings.update(payload);
			message = { type: 'success', text: '¡Configuración general guardada con éxito!' };
		} catch (err) {
			message = { type: 'error', text: err?.message ?? 'Error al guardar la configuración.' };
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Ajustes — VSocial</title>
</svelte:head>

<div class="settings-container">
	<div class="settings-layout">
		<!-- Left Sidebar Categories -->
		<div class="settings-sidebar glass-card">
			<h2 class="sidebar-section-title">Ajustes</h2>

			<button
				onclick={() => selectSection('profile')}
				class="sidebar-btn"
				class:active={activeSection === 'profile'}
			>
				<span class="material-icons-round">person</span>
				<span>Editar Perfil</span>
			</button>

			<a href="/settings/design" class="sidebar-btn" style="text-decoration: none;">
				<span class="material-icons-round">palette</span>
				<span>Diseño del Perfil</span>
			</a>

			<button
				onclick={() => selectSection('algorithm')}
				class="sidebar-btn"
				class:active={activeSection === 'algorithm'}
			>
				<span class="material-icons-round">auto_awesome</span>
				<span>Feed & Algoritmo</span>
			</button>

			<button
				onclick={() => selectSection('privacy')}
				class="sidebar-btn"
				class:active={activeSection === 'privacy'}
			>
				<span class="material-icons-round">lock</span>
				<span>Privacidad</span>
			</button>

			<button
				onclick={() => selectSection('notifications')}
				class="sidebar-btn"
				class:active={activeSection === 'notifications'}
			>
				<span class="material-icons-round">notifications</span>
				<span>Notificaciones</span>
			</button>

			<button
				onclick={() => selectSection('data')}
				class="sidebar-btn"
				class:active={activeSection === 'data'}
			>
				<span class="material-icons-round">folder_special</span>
				<span>Mis Datos</span>
			</button>

			<button
				onclick={() => selectSection('payments')}
				class="sidebar-btn"
				class:active={activeSection === 'payments'}
			>
				<span class="material-icons-round">payments</span>
				<span>Pagos y Enlaces</span>
			</button>

			<button
				onclick={() => selectSection('performance')}
				class="sidebar-btn"
				class:active={activeSection === 'performance'}
			>
				<span class="material-icons-round">speed</span>
				<span>Rendimiento</span>
			</button>

			{#if authStore.isTeamOrHigher}
				<a
					href="/studio/emotes"
					class="sidebar-btn sidebar-btn-team"
					style="text-decoration: none;"
				>
					<span class="material-icons-round" style="color: var(--aero-mint);">military_tech</span>
					<span>Estudio Emotes (EXP)</span>
				</a>
			{/if}
		</div>

		<!-- Right Sidebar Content Box -->
		<div class="settings-content-panel">
			<div class="glass-card panel-card" class:is-saving={saving}>
				<!-- Status Alert Messages -->
				{#if message.text}
					<div
						class="alert-box"
						class:success={message.type === 'success'}
						class:error={message.type === 'error'}
						in:fade={{ duration: 250 }}
						out:fade={{ duration: 200 }}
					>
						<span class="material-icons-round">
							{message.type === 'success' ? 'check_circle_outline' : 'error_outline'}
						</span>
						<span>{message.text}</span>
					</div>
				{/if}

				<div class="smooth-transition-wrapper">
					{#key sectionKey + (loading ? '-loading' : '-loaded')}
						<div
							in:fade={{ duration: 250, delay: 100 }}
							out:fade={{ duration: 150 }}
							class="smooth-transition-content"
						>
							{#if loading}
								<div class="panel-loading">
									<span class="loading loading-spinner text-primary"></span>
									<span>Cargando ajustes...</span>
								</div>
							{:else if activeSection === 'profile'}
								<div class="section-content">
									<div>
										<h3 class="section-title">Editar Perfil</h3>
										<p class="section-subtitle">
											Controla tu identidad pública y fotos en VSocial.
										</p>
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

											<!-- Cover Action Floating Button -->
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
														<span class="avatar-initials-text"
															>{displayName[0]?.toUpperCase() || '?'}</span
														>
													{/if}
													<!-- Camera Overlay Badge Button -->
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

										<!-- Hidden file inputs -->
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
											<input
												id="displayName"
												type="text"
												required
												bind:value={displayName}
												class="aero-input"
											/>
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

										<button
											type="submit"
											class="btn-aero-primary"
											style="margin-top: 12px; padding: 10px 24px;"
										>
											<span class="btn-spinner" class:show={saving}>
												<span class="loading loading-spinner loading-xs"></span>
											</span>
											<span>Guardar Perfil</span>
										</button>
									</form>
								</div>

								<!-- SECTION 2: FEED & ALGORITHM (UNIQUE FEATURE) -->
							{:else if activeSection === 'algorithm'}
								<div class="section-content">
									<div>
										<h3 class="section-title">Feed & Algoritmo</h3>
										<p class="section-subtitle">
											Controla exactamente cómo se prioriza el contenido en tu página de inicio.
										</p>
									</div>

									<!-- Mode selector cards -->
									<div class="mode-cards">
										{#each FEED_MODES as m}
											<button
												type="button"
												class="mode-card"
												class:active={feedMode === m.id}
												onclick={() => selectMode(m.id)}
											>
												<div class="mode-card-head">
													<span class="material-icons-round mode-card-icon">{m.icon}</span>
													<span class="mode-card-tag">{m.tag}</span>
												</div>
												<span class="mode-card-title">{m.title}</span>
												<span class="mode-card-desc">{m.desc}</span>
											</button>
										{/each}
									</div>

									<!-- Live summary of what the current config does -->
									<div class="feed-summary">
										<span class="material-icons-round">insights</span>
										<span>{feedSummary}</span>
									</div>

									<form onsubmit={saveAlgorithmSettings} class="form-container">
										<!-- Presets (only relevant in intelligent mode) -->
										{#if feedMode === 'intelligent'}
											<div class="presets-block" transition:slide={{ duration: 250 }}>
												<div class="presets-head">
													<span class="form-label" style="margin: 0;">Perfiles rápidos</span>
													<button type="button" class="reset-btn" onclick={resetWeights}>
														<span class="material-icons-round">restart_alt</span> Restablecer
													</button>
												</div>
												<div class="presets-row">
													{#each PRESETS as p}
														<button
															type="button"
															class="preset-chip"
															class:active={activePreset === p.id}
															onclick={() => applyPreset(p)}
														>
															<span class="material-icons-round">{p.icon}</span>
															<span>{p.label}</span>
														</button>
													{/each}
												</div>
											</div>
										{/if}

										<!-- Bar Chart weight distribution visualization -->
										<div class="chart-container" class:dimmed={feedMode !== 'intelligent'}>
											<h4 class="chart-title">Distribución de Pesos</h4>
											<div class="chart-bars">
												{#each [{ label: 'Intereses', val: wInterests, color: 'linear-gradient(to top, var(--aero-sky), var(--aero-blue))' }, { label: 'Interacciones', val: wInteractions, color: 'linear-gradient(to top, #a855f7, #d946ef)' }, { label: 'Social', val: wSocial, color: 'linear-gradient(to top, var(--aero-coral), var(--aero-rose))' }, { label: 'Popularidad', val: wPopularity, color: 'linear-gradient(to top, #ef4444, #f97316)' }, { label: 'Recencia', val: wRecency, color: 'linear-gradient(to top, var(--aero-mint), #059669)' }, { label: 'Diversidad', val: wDiversity, color: 'linear-gradient(to top, #fcd34d, var(--aero-amber))' }] as bar}
													{@const pct = (bar.val / totalWeight) * 100}
													<div class="bar-col">
														<span class="bar-pct-text">{pct.toFixed(0)}%</span>
														<div
															class="bar-fill"
															style="height: {pct}%; background: {bar.color};"
														></div>
													</div>
												{/each}
											</div>
											<div class="chart-labels-row">
												<span>Intereses</span>
												<span>Interac.</span>
												<span>Social</span>
												<span>Popular</span>
												<span>Recencia</span>
												<span>Diversidad</span>
											</div>
										</div>

										<!-- Sliders grid -->
										<div
											class="sliders-grid"
											style={feedMode !== 'intelligent'
												? 'opacity: 0.5; pointer-events: none;'
												: ''}
										>
											<!-- Interests -->
											<div class="slider-group">
												<div class="slider-header">
													<span>Intereses Temáticos</span>
													<span class="slider-value-text">{wInterests}</span>
												</div>
												<p class="slider-desc">
													Prioriza contenido con hashtags que sueles disfrutar.
												</p>
												<input
													type="range"
													min="0"
													max="100"
													bind:value={wInterests}
													class="aero-range"
												/>
											</div>

											<!-- Interactions -->
											<div class="slider-group">
												<div class="slider-header">
													<span>Interacciones Previas</span>
													<span class="slider-value-text">{wInteractions}</span>
												</div>
												<p class="slider-desc">
													Publicaciones de creadores con los que sueles reaccionar.
												</p>
												<input
													type="range"
													min="0"
													max="100"
													bind:value={wInteractions}
													class="aero-range"
												/>
											</div>

											<!-- Social Connections -->
											<div class="slider-group">
												<div class="slider-header">
													<span>Círculo Social</span>
													<span class="slider-value-text">{wSocial}</span>
												</div>
												<p class="slider-desc">
													Prioriza publicaciones de personas que sigues directamente.
												</p>
												<input
													type="range"
													min="0"
													max="100"
													bind:value={wSocial}
													class="aero-range"
												/>
											</div>

											<!-- Popularity -->
											<div class="slider-group">
												<div class="slider-header">
													<span>Popularidad del Post</span>
													<span class="slider-value-text">{wPopularity}</span>
												</div>
												<p class="slider-desc">
													Favorece publicaciones virales con mucha actividad en la red.
												</p>
												<input
													type="range"
													min="0"
													max="100"
													bind:value={wPopularity}
													class="aero-range"
												/>
											</div>

											<!-- Recency -->
											<div class="slider-group">
												<div class="slider-header">
													<span>Recencia / Tiempo</span>
													<span class="slider-value-text">{wRecency}</span>
												</div>
												<p class="slider-desc">Favorece publicaciones de las últimas horas.</p>
												<input
													type="range"
													min="0"
													max="100"
													bind:value={wRecency}
													class="aero-range"
												/>
											</div>

											<!-- Diversity -->
											<div class="slider-group">
												<div class="slider-header">
													<span>Diversidad de Creadores</span>
													<span class="slider-value-text">{wDiversity}</span>
												</div>
												<p class="slider-desc">
													Evita mostrar demasiadas publicaciones seguidas del mismo usuario.
												</p>
												<input
													type="range"
													min="0"
													max="100"
													bind:value={wDiversity}
													class="aero-range"
												/>
											</div>
										</div>

										<div class="algo-footer">
											<p class="algo-hint">
												<span class="material-icons-round">lightbulb</span>
												{#if feedMode === 'intelligent'}
													Ajusta los pesos o elige un perfil rápido, luego guarda.
												{:else}
													Los pesos manuales solo aplican en el modo <strong
														>Feed Inteligente</strong
													>.
												{/if}
											</p>
											<button type="submit" class="btn-aero-primary" style="padding: 10px 24px;">
												<span class="btn-spinner" class:show={saving}>
													<span class="loading loading-spinner loading-xs"></span>
												</span>
												<span>Guardar Preferencias</span>
											</button>
										</div>
									</form>
								</div>

								<!-- SECTION 3: PRIVACY -->
							{:else if activeSection === 'privacy'}
								<div class="section-content">
									<div>
										<h3 class="section-title">Privacidad</h3>
										<p class="section-subtitle">Controla tu visibilidad y cambia tu contraseña.</p>
									</div>

									<form onsubmit={saveGeneralSettings} class="form-container">
										<!-- Visibilidad de Perfil -->
										<div class="radio-settings-group">
											<span class="form-label">Quién puede ver tu perfil</span>
											<div class="radio-options">
												<label class="radio-option">
													<input
														type="radio"
														name="visibility"
														value="public"
														bind:group={profileVisibility}
													/>
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
													<input
														type="radio"
														name="visibility"
														value="friends"
														bind:group={profileVisibility}
													/>
													<span>Solo Amigos (Mutuo follow)</span>
												</label>
											</div>
										</div>

										<!-- DM Settings -->
										<div class="radio-settings-group border-top">
											<span class="form-label">Mensajería Directa</span>
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
										</div>

										<!-- Online Status toggle -->
										<div class="toggle-settings-group border-top">
											<div class="toggle-details">
												<span class="toggle-title">Mostrar estado de conexión</span>
												<span class="toggle-desc"
													>Permite que tus amigos vean cuándo estás en línea.</span
												>
											</div>
											<input
												type="checkbox"
												bind:checked={showOnlineStatus}
												class="aero-toggle-switch"
											/>
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

									<!-- Change Password Form -->
									<div class="change-password-section border-top">
										<h3 class="section-title" style="font-size: 0.95rem; margin-top: 16px;">
											Cambiar Contraseña
										</h3>
										<p class="section-subtitle" style="margin-bottom: 16px;">
											Actualiza tus credenciales de seguridad.
										</p>

										<form
											onsubmit={handleChangePassword}
											class="form-container"
											style="max-width: 340px;"
										>
											<div class="form-group">
												<label for="oldPassword" class="form-label" style="font-size: 0.65rem;"
													>Contraseña Actual</label
												>
												<input
													id="oldPassword"
													type="password"
													required
													bind:value={oldPassword}
													class="aero-input"
												/>
											</div>
											<div class="form-group">
												<label for="newPassword" class="form-label" style="font-size: 0.65rem;"
													>Nueva Contraseña</label
												>
												<input
													id="newPassword"
													type="password"
													required
													bind:value={newPassword}
													class="aero-input"
												/>
											</div>
											<button
												type="submit"
												disabled={saving || !oldPassword || !newPassword}
												class="btn-aero-secondary btn-sm"
												style="padding: 8px 16px; align-self: flex-start;"
											>
												Actualizar Contraseña
											</button>
										</form>
									</div>
								</div>

								<!-- SECTION 4: NOTIFICATIONS -->
							{:else if activeSection === 'notifications'}
								<div class="section-content">
									<div>
										<h3 class="section-title">Notificaciones</h3>
										<p class="section-subtitle">Controla cuándo y cómo deseas ser notificado.</p>
									</div>

									<form onsubmit={saveGeneralSettings} class="form-container">
										<div class="toggle-settings-group border-bottom">
											<div class="toggle-details">
												<span class="toggle-title">Me gusta (Likes)</span>
												<span class="toggle-desc"
													>Cuando alguien reacciona a tus publicaciones.</span
												>
											</div>
											<input
												type="checkbox"
												bind:checked={notifyLikes}
												class="aero-toggle-switch"
											/>
										</div>

										<div class="toggle-settings-group border-bottom">
											<div class="toggle-details">
												<span class="toggle-title">Comentarios</span>
												<span class="toggle-desc">Cuando alguien comenta tus posts o reels.</span>
											</div>
											<input
												type="checkbox"
												bind:checked={notifyComments}
												class="aero-toggle-switch"
											/>
										</div>

										<div class="toggle-settings-group border-bottom">
											<div class="toggle-details">
												<span class="toggle-title">Nuevos Seguidores</span>
												<span class="toggle-desc"
													>Cuando un usuario empieza a seguir tu cuenta.</span
												>
											</div>
											<input
												type="checkbox"
												bind:checked={notifyFollows}
												class="aero-toggle-switch"
											/>
										</div>

										<div class="toggle-settings-group">
											<div class="toggle-details">
												<span class="toggle-title">Mensajes Directos (DMs)</span>
												<span class="toggle-desc">Cuando recibes un nuevo mensaje en el chat.</span>
											</div>
											<input type="checkbox" bind:checked={notifyDMs} class="aero-toggle-switch" />
										</div>

										<button
											type="submit"
											class="btn-aero-primary"
											style="padding: 10px 24px; align-self: flex-start; margin-top: 12px;"
										>
											<span class="btn-spinner" class:show={saving}>
												<span class="loading loading-spinner loading-xs"></span>
											</span>
											<span>Guardar Notificaciones</span>
										</button>
									</form>
								</div>
							{:else if activeSection === 'data'}
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
											<span class="toggle-desc"
												>Exporta toda tu información (perfil, publicaciones, mensajes, cartera,
												actividad…) en un archivo JSON.</span
											>
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
									<div
										class="danger-zone"
										style="border: 1px solid color-mix(in srgb, var(--aero-rose) 30%, transparent); border-radius: var(--radius-md); padding: 1.25rem; margin-top: 1rem;"
									>
										<div
											class="danger-title"
											style="color: var(--aero-rose); font-size: 1.05rem; margin-bottom: 0.5rem;"
										>
											Eliminar cuenta
										</div>
										<p class="toggle-desc" style="margin-bottom: 0.85rem;">
											Tu cuenta se desactivará de inmediato y se eliminará permanentemente, junto
											con todo su contenido, transcurridos 30 días. Puedes reactivarla iniciando
											sesión dentro de ese plazo. Esta acción es irreversible una vez vencido el
											periodo.
										</p>
										<form
											onsubmit={(e) => {
												e.preventDefault();
												handleDeleteAccount();
											}}
											class="flex flex-col gap-2"
											style="max-width: 360px;"
										>
											<input
												type="password"
												id="deletePassword"
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
												disabled={deleting || !deletePassword}
											>
												<span class="btn-spinner" class:show={deleting}>
													<span class="loading loading-spinner loading-xs"></span>
												</span>
												{#if deleting}Eliminando...{:else}Eliminar mi cuenta{/if}
											</button>
										</form>
									</div>
								</div>
							{:else if activeSection === 'payments'}
								<div class="section-content">
									<div>
										<h3 class="section-title">Pagos y Enlaces</h3>
										<p class="section-subtitle">
											Conecta tu método de cobro externo para recibir pagos directamente, sin
											intermediarios de la plataforma.
										</p>
									</div>

									<div class="payment-card">
										<div class="payment-card-head">
											<div class="payment-icon-wrapper">
												<div class="payment-glow"></div>
												<div class="payment-icon">
													<span class="material-icons-round">payments</span>
												</div>
											</div>
											<div class="payment-card-title">
												<span class="toggle-title">Enlace de cobro (P2P)</span>
												<span class="toggle-desc"
													>Recibe apoyos directos en tu perfil. Compatible con <strong
														>PayPal</strong
													>, <strong>Ko-fi</strong> o <strong>Patreon</strong>.</span
												>
											</div>
										</div>

										<div
											class="payment-platform-selector"
											style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;"
										>
											{#each PAYMENT_PLATFORMS as p}
												<button
													class="platform-pill {selectedPlatform === p.id ? 'active' : ''}"
													onclick={() => selectPaymentPlatform(p.id)}
													style="padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border-subtle); background: {selectedPlatform ===
													p.id
														? 'var(--aero-blue)'
														: 'var(--bg-surface-elevated)'}; color: {selectedPlatform === p.id
														? '#fff'
														: 'var(--text-primary)'}; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s ease;"
												>
													<span class="material-icons-round" style="font-size: 1.1rem;"
														>{selectedPlatform === p.id
															? 'check_circle'
															: 'radio_button_unchecked'}</span
													>
													{p.name}
												</button>
											{/each}
										</div>

										{#if selectedPlatform}
											<div class="payment-input-row" transition:slide={{ duration: 300 }}>
												<div class="payment-input-wrap" class:has-value={!!paymentUsername}>
													<div
														class="payment-input-field"
														style="display: flex; align-items: center;"
													>
														<span
															class="payment-prefix"
															style="color: var(--text-muted); font-weight: 500; margin-left: 14px; margin-right: 2px;"
															>{PAYMENT_PLATFORMS.find((p) => p.id === selectedPlatform)
																?.prefix}</span
														>
														<input
															type="text"
															bind:value={paymentUsername}
															oninput={onPaymentLinkInput}
															placeholder="tu_usuario"
															class="payment-input"
															style="padding-left: 2px;"
															aria-label="Nombre de usuario"
														/>
													</div>
													<button
														class="btn-aero-primary payment-save"
														onclick={savePaymentLink}
														disabled={savingPaymentLink ||
															!paymentUsername.trim() ||
															paymentLink === savedPaymentLink}
													>
														<span class="btn-spinner" class:show={savingPaymentLink}>
															<span class="loading loading-spinner loading-xs"></span>
														</span>
														{savingPaymentLink ? 'Guardando...' : 'Guardar'}
													</button>
												</div>
											</div>
										{/if}

										{#if paymentLink}
											<div class="payment-validation" transition:slide={{ duration: 300 }}>
												{#if paymentLinkHint.error}
													<p class="payment-hint error">
														<span class="material-icons-round">error_outline</span>
														{paymentLinkHint.error}
													</p>
												{:else if paymentLinkHint.host}
													<p class="payment-hint ok">
														<span class="material-icons-round">verified</span>
														Enlace válido detectado →
														<span class="platform-name">{paymentLinkHint.host}</span>
													</p>
												{/if}
											</div>
										{/if}

										{#if savedPaymentLink}
											<div class="payment-preview-card" transition:slide={{ duration: 400 }}>
												<span class="payment-preview-label">Así se verá en tu perfil público</span>
												<div class="payment-preview-mockup">
													<div class="mockup-banner"></div>
													<div class="mockup-avatar">
														<span class="material-icons-round">person</span>
													</div>
													<div class="mockup-info">
														<div class="mockup-name">
															@{authStore.user?.username || 'tu_usuario'}
														</div>
														<div class="mockup-bio">Creador verificado</div>
													</div>
													<a
														href={savedPaymentLink}
														target="_blank"
														rel="noopener noreferrer nofollow"
														class="btn-aero-primary mockup-btn"
													>
														<span class="material-icons-round">favorite</span>
														Apoyar
													</a>
												</div>
												<div class="payment-actions-footer">
													<button
														class="btn-aero-ghost text-danger action-btn"
														onclick={clearPaymentLink}
													>
														<span class="material-icons-round">delete</span>
														Eliminar enlace actual
													</button>
												</div>
											</div>
										{:else}
											<div class="payment-empty-state">
												<span class="material-icons-round">visibility_off</span>
												<p>Sin enlace configurado: el botón "Apoyar" permanecerá oculto.</p>
												{#if paymentLink}
													<button
														class="btn-aero-ghost text-muted mt-2 action-btn"
														onclick={clearPaymentLink}>Descartar cambios</button
													>
												{/if}
											</div>
										{/if}
									</div>
								</div>
							{:else if activeSection === 'performance'}
								<div class="section-content">
									<div>
										<h3 class="section-title">Rendimiento & Accesibilidad</h3>
										<p class="section-subtitle">
											Optimiza la experiencia visual y fluidez de la interfaz para tu equipo y
											preferencias de navegación.
										</p>
									</div>

									<div
										class="glass-card p-5 mt-4"
										style="display: flex; flex-direction: column; gap: 16px;"
									>
										<div
											class="flex items-center justify-between gap-4 py-3"
											style="border-bottom: 1px solid var(--border-subtle);"
										>
											<div>
												<h4 class="font-bold text-main" style="font-size: 0.95rem;">
													Modo Rendimiento (Lite)
												</h4>
												<p class="text-xs text-muted" style="margin-top: 2px;">
													Desactiva el desenfoque de cristal (backdrop-filter) y sombras complejas
													para máxima fluidez en gráficos integrados.
												</p>
											</div>
											<label class="toggle-switch">
												<input
													type="checkbox"
													checked={perfStore.perfMode}
													onchange={(e) => perfStore.setPerfMode(e.currentTarget.checked)}
												/>
												<span class="toggle-slider"></span>
											</label>
										</div>

										<div
											class="flex items-center justify-between gap-4 py-3"
											style="border-bottom: 1px solid var(--border-subtle);"
										>
											<div>
												<h4 class="font-bold text-main" style="font-size: 0.95rem;">
													Reducir Movimiento
												</h4>
												<p class="text-xs text-muted" style="margin-top: 2px;">
													Desactiva transiciones y animaciones continuas (accesibilidad vestibular y
													ahorro de CPU).
												</p>
											</div>
											<label class="toggle-switch">
												<input
													type="checkbox"
													checked={perfStore.reduceMotion}
													onchange={(e) => perfStore.setReduceMotion(e.currentTarget.checked)}
												/>
												<span class="toggle-slider"></span>
											</label>
										</div>

										<div
											class="flex items-center justify-between gap-4 py-3"
											style="border-bottom: 1px solid var(--border-subtle);"
										>
											<div>
												<h4 class="font-bold text-main" style="font-size: 0.95rem;">
													Fondo Fluido Dinámico (Aurora Blobs)
												</h4>
												<p class="text-xs text-muted" style="margin-top: 2px;">
													Gradientes animados con desenfoque de 120px en el fondo. Desactivarlo
													reduce drásticamente el uso de VRAM/GPU.
												</p>
											</div>
											<label class="toggle-switch">
												<input
													type="checkbox"
													checked={!perfStore.disableLiquidBg}
													onchange={(e) => perfStore.setDisableLiquidBg(!e.currentTarget.checked)}
												/>
												<span class="toggle-slider"></span>
											</label>
										</div>

										<div
											class="mt-2 p-4 rounded-xl"
											style="background: rgba(27, 133, 243, 0.08); border: 1px solid rgba(27, 133, 243, 0.25); border-radius: var(--radius-md);"
										>
											<div
												class="flex items-center gap-3"
												style="display: flex; align-items: center; gap: 12px;"
											>
												<span
													class="material-icons-round"
													style="color: var(--aero-blue); font-size: 28px;">memory</span
												>
												<div>
													<div class="text-xs font-bold text-main" style="font-size: 0.85rem;">
														Diagnóstico de Hardware
													</div>
													<div
														class="text-xs text-muted"
														style="font-size: 0.78rem; margin-top: 2px;"
													>
														Núcleos CPU: <strong>{perfStore.hardwareInfo.cores}</strong>
														{#if perfStore.hardwareInfo.memoryGB}
															&bull; RAM: <strong>~{perfStore.hardwareInfo.memoryGB} GB</strong>
														{/if}
														&bull; Recomendación:
														<strong
															style="color: {perfStore.hardwareInfo.isLowEnd
																? 'var(--aero-amber)'
																: 'var(--aero-mint)'};"
															>{perfStore.hardwareInfo.isLowEnd
																? 'Modo Rendimiento'
																: 'Modo Alta Calidad'}</strong
														>
													</div>
												</div>
											</div>
											<button
												type="button"
												class="btn-aero-secondary mt-3 w-full text-xs"
												style="margin-top: 12px; width: 100%; font-size: 0.8rem; padding: 8px 12px; display: flex; align-items: center; justify-content: center; gap: 6px;"
												onclick={() => {
													perfStore.applyRecommendedSettings();
													message = {
														type: 'success',
														text: 'Ajustes de rendimiento optimizados aplicados con éxito.'
													};
												}}
											>
												<span class="material-icons-round" style="font-size: 18px;"
													>auto_fix_high</span
												>
												Aplicar configuración recomendada para mi equipo
											</button>
										</div>
									</div>
								</div>
							{/if}
						</div>
					{/key}
				</div>
			</div>
		</div>
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

<style>
	.settings-container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 24px 16px;
	}

	.settings-layout {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: 24px;
		align-items: start;
	}

	@media (max-width: 768px) {
		.settings-layout {
			grid-template-columns: 1fr;
		}
	}

	.settings-sidebar {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 24px 16px;
	}

	.sidebar-section-title {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 1px;
		margin: 0 0 12px 12px;
	}

	.sidebar-btn {
		width: 100%;
		padding: 12px 16px;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		font-weight: 600;
		text-align: left;
		background: none;
		border: 1px solid transparent;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		position: relative;
		overflow: hidden;
		transition:
			transform 0.15s ease,
			background 0.25s var(--ease-smooth),
			color 0.25s var(--ease-smooth),
			border-color 0.25s var(--ease-smooth),
			box-shadow 0.25s var(--ease-smooth);
	}

	.sidebar-btn:active {
		transform: scale(0.97);
	}

	.sidebar-btn::before {
		content: '';
		position: absolute;
		left: 0;
		top: 20%;
		bottom: 20%;
		width: 3px;
		border-radius: var(--radius-xs);
		background: var(--aero-blue);
		opacity: 0;
		transform: scaleY(0.3);
		transition:
			opacity 0.25s var(--ease-spring),
			transform 0.25s var(--ease-spring);
	}

	.sidebar-btn:hover {
		background: var(--bg-overlay);
		color: var(--text-primary);
	}

	.sidebar-btn.active {
		background: color-mix(in srgb, var(--aero-blue) 8%, transparent);
		border-color: color-mix(in srgb, var(--aero-blue) 18%, transparent);
		color: var(--aero-blue);
		box-shadow: 0 0 12px color-mix(in srgb, var(--aero-blue) 8%, transparent);
	}

	.sidebar-btn.active::before {
		opacity: 1;
		transform: scaleY(1);
	}

	.settings-content-panel {
		min-width: 0;
	}

	.panel-card {
		padding: 32px;
		border-radius: var(--radius-lg);
		min-height: 750px;
	}

	/* ── Silky smooth crossfader ── */
	.smooth-transition-wrapper {
		display: grid;
		grid-template-columns: 1fr;
		width: 100%;
	}
	.smooth-transition-content {
		grid-column: 1;
		grid-row: 1;
		width: 100%;
	}

	/* ── Smooth spinner for settings buttons ── */
	.btn-spinner {
		display: inline-flex;
		align-items: center;
		width: 0;
		opacity: 0;
		margin-right: 0;
		overflow: hidden;
		transition:
			width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
			opacity 0.3s ease,
			margin-right 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.btn-spinner.show {
		width: 16px;
		opacity: 1;
		margin-right: 6px;
	}
	form .btn-aero-primary {
		gap: 0; /* Remove parent flex gap so we can control spacing perfectly with margin */
	}

	@media (max-width: 768px) {
		.panel-card {
			padding: 20px;
		}
	}

	.alert-box {
		padding: 12px 16px;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 24px;
	}

	.alert-box.success {
		background: color-mix(in srgb, var(--aero-mint) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--aero-mint) 25%, transparent);
		color: var(--aero-mint);
	}

	.alert-box.error {
		background: color-mix(in srgb, var(--aero-rose) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--aero-rose) 25%, transparent);
		color: var(--aero-rose);
	}

	/* Saving state: dim entire panel card while async request is in flight */
	.panel-card.is-saving {
		pointer-events: none;
		opacity: 0.7;
		transition: opacity 0.25s ease;
	}
	.panel-card {
		transition: opacity 0.25s ease;
	}

	.panel-loading {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 12px;
		padding: 48px;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.section-content {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.section-title {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-main);
		margin: 0;
	}

	.section-subtitle {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 4px 0 0 0;
	}

	/* Visual Identity Studio (Avatar & Cover) */
	.profile-visual-card {
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-subtle);
		overflow: hidden;
		background: var(--bg-surface);
		box-shadow:
			0 8px 30px rgba(0, 0, 0, 0.08),
			var(--glass-inset-highlight);
		margin-bottom: 8px;
	}

	.profile-visual-cover {
		position: relative;
		width: 100%;
		height: 140px;
		background: color-mix(in srgb, var(--aero-blue) 12%, var(--bg-surface2));
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.profile-visual-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center center;
		display: block;
	}

	.no-cover-art {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 500;
	}

	.no-cover-icon {
		font-size: 22px;
		color: var(--text-muted);
	}

	.cover-gradient-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.45) 0%, transparent 60%);
		pointer-events: none;
	}

	.btn-cover-action {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 5;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: #ffffff;
		border-radius: var(--radius-full);
		padding: 6px 14px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
		transition:
			background var(--t-fast),
			border-color var(--t-fast),
			transform var(--t-fast);
	}

	.btn-cover-action:hover {
		background: var(--aero-blue);
		border-color: #ffffff;
		transform: translateY(-1px);
	}

	.btn-cover-action:active {
		transform: translateY(1px);
	}

	.profile-visual-bottom {
		display: flex;
		align-items: flex-start;
		gap: 20px;
		padding: 0 20px 20px 20px;
		margin-top: -44px;
		position: relative;
		z-index: 6;
		flex-wrap: wrap;
	}

	.avatar-interactive-slot {
		flex: 0 0 94px;
	}

	.avatar-visual-circle {
		width: 94px;
		height: 94px;
		border-radius: var(--radius-xl);
		position: relative;
		border: 4px solid var(--bg-surface-solid, var(--bg-surface));
		background: var(--accent-gradient);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.3),
			0 0 0 1px var(--border-subtle);
		overflow: hidden;
		transition: transform var(--t-spring);
	}

	.avatar-visual-circle:hover {
		transform: scale(1.02);
	}

	.avatar-visual-circle img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center center;
		display: block;
	}

	.avatar-initials-text {
		color: #ffffff;
		font-weight: 800;
		font-size: 2.2rem;
		font-family: var(--font-display);
	}

	.avatar-camera-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-size: 24px;
		opacity: 0;
		cursor: pointer;
		transition: opacity var(--t-fast);
		z-index: 2;
	}

	.avatar-visual-circle:hover .avatar-camera-overlay,
	.avatar-camera-overlay:focus-visible {
		opacity: 1;
	}

	.avatar-corner-badge {
		position: absolute;
		bottom: 4px;
		right: 4px;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		border: 1.5px solid rgba(255, 255, 255, 0.65);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
		pointer-events: none;
		z-index: 1;
		transition: opacity var(--t-fast);
	}

	.avatar-corner-badge .material-icons-round {
		font-size: 15px;
	}

	.avatar-visual-circle:hover .avatar-corner-badge {
		opacity: 0;
	}

	.visual-actions-meta {
		flex: 1;
		min-width: 240px;
		padding-top: 52px;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.visual-hints-row {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}

	.visual-hint {
		font-size: 0.75rem;
		color: var(--text-muted);
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.hint-dot {
		font-size: 14px;
		color: var(--aero-mint, #00d4aa);
	}

	.form-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-label {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 2px;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	@media (max-width: 576px) {
		.form-row {
			grid-template-columns: 1fr;
		}

		.profile-visual-bottom {
			flex-direction: column;
			align-items: center;
			text-align: center;
		}

		.visual-actions-meta {
			padding-top: 10px;
			align-items: center;
		}
	}

	/* Algorithm section styling */
	.mode-cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}

	@media (max-width: 768px) {
		.mode-cards {
			grid-template-columns: 1fr;
		}
	}

	.mode-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		text-align: left;
		padding: 16px;
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			border-color 0.25s var(--ease-smooth),
			background 0.25s var(--ease-smooth),
			box-shadow 0.25s var(--ease-smooth);
	}

	.mode-card:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--aero-blue) 30%, transparent);
	}

	.mode-card:active {
		transform: scale(0.98);
	}

	.mode-card.active {
		background: color-mix(in srgb, var(--aero-blue) 6%, transparent);
		border-color: color-mix(in srgb, var(--aero-blue) 40%, transparent);
		box-shadow: 0 0 18px color-mix(in srgb, var(--aero-blue) 12%, transparent);
	}

	.mode-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.mode-card-icon {
		font-size: 1.4rem;
		color: var(--aero-sky);
	}

	.mode-card-tag {
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
		padding: 2px 8px;
		border-radius: 999px;
	}

	.mode-card.active .mode-card-tag {
		color: var(--aero-sky);
		border-color: color-mix(in srgb, var(--aero-blue) 30%, transparent);
	}

	.mode-card-title {
		font-size: 0.9rem;
		font-weight: 800;
		color: var(--text-main);
	}

	.mode-card-desc {
		font-size: 0.7rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.feed-summary {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--aero-blue) 5%, transparent);
		border: 1px solid color-mix(in srgb, var(--aero-blue) 12%, transparent);
		font-size: 0.78rem;
		color: var(--text-main);
		line-height: 1.4;
	}

	.feed-summary .material-icons-round {
		font-size: 1.2rem;
		color: var(--aero-sky);
		flex-shrink: 0;
	}

	.presets-block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.presets-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.reset-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.7rem;
		font-weight: 700;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		transition:
			color 0.2s ease,
			background 0.2s ease;
	}

	.reset-btn:hover {
		color: var(--aero-rose);
		background: color-mix(in srgb, var(--aero-rose) 8%, transparent);
	}

	.reset-btn .material-icons-round {
		font-size: 1rem;
	}

	.presets-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.preset-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			color 0.2s ease,
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.preset-chip:hover {
		color: var(--text-primary);
		border-color: color-mix(in srgb, var(--aero-blue) 30%, transparent);
	}

	.preset-chip:active {
		transform: scale(0.96);
	}

	.preset-chip.active {
		background: color-mix(in srgb, var(--aero-sky) 8%, transparent);
		border-color: color-mix(in srgb, var(--aero-blue) 40%, transparent);
		color: var(--aero-blue);
		box-shadow: 0 0 12px color-mix(in srgb, var(--aero-blue) 12%, transparent);
	}

	.preset-chip .material-icons-round {
		font-size: 1rem;
	}

	.chart-container.dimmed {
		opacity: 0.5;
	}

	.algo-hint {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: 0.72rem;
		color: var(--text-muted);
		line-height: 1.3;
	}

	.algo-hint .material-icons-round {
		font-size: 1rem;
		color: var(--aero-amber, #f59e0b);
	}

	.chart-container {
		background: color-mix(in srgb, var(--aero-sky) 4%, transparent);
		border: 1px solid color-mix(in srgb, var(--aero-blue) 8%, transparent);
		padding: 16px;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.chart-title {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		margin: 0;
	}

	.chart-bars {
		height: 100px;
		display: flex;
		align-items: flex-end;
		gap: 8px;
		justify-content: space-around;
		padding-top: 16px;
		border-bottom: 1px solid color-mix(in srgb, var(--aero-blue) 10%, transparent);
	}

	.bar-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		height: 100%;
		justify-content: flex-end;
		min-width: 0;
	}

	.bar-pct-text {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-main);
		margin-bottom: 4px;
	}

	.bar-fill {
		width: 100%;
		border-top-left-radius: 6px;
		border-top-right-radius: 6px;
		transition: height 0.3s ease;
	}

	.chart-labels-row {
		display: flex;
		justify-content: space-around;
		text-align: center;
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--text-muted);
	}

	.chart-labels-row span {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sliders-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}

	@media (max-width: 768px) {
		.sliders-grid {
			grid-template-columns: 1fr;
		}
	}

	.slider-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.slider-header {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-main);
	}

	.slider-value-text {
		color: var(--aero-sky);
	}

	.slider-desc {
		font-size: 0.7rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.3;
	}

	.aero-range {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 4px;
		border-radius: var(--radius-xs);
		background: var(--border-subtle);
		outline: none;
		margin-top: 6px;
	}

	.aero-range::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--aero-sky);
		cursor: pointer;
		box-shadow: 0 0 8px color-mix(in srgb, var(--aero-sky) 40%, transparent);
		transition: transform var(--t-fast);
	}

	.aero-range::-webkit-slider-thumb:hover {
		transform: scale(1.25);
	}

	.algo-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid rgba(0, 119, 255, 0.1);
		padding-top: 16px;
		margin-top: 12px;
		gap: 16px;
		flex-wrap: wrap;
	}

	/* Privacy & Radio/Toggle Styles */
	.radio-settings-group {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.radio-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.radio-option {
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		font-size: 0.8rem;
		color: var(--text-main);
	}

	.radio-option input[type='radio'] {
		appearance: none;
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		border: 2px solid var(--border-subtle);
		outline: none;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--t-fast);
	}

	.radio-option input[type='radio']:checked {
		border-color: var(--aero-sky);
		background: var(--aero-sky);
		box-shadow: 0 0 8px rgba(74, 171, 223, 0.4);
	}

	.toggle-settings-group {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 0;
	}

	.toggle-details {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.toggle-title {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-main);
	}

	.toggle-desc {
		font-size: 0.7rem;
		color: var(--text-muted);
		line-height: 1.3;
	}

	.border-top {
		border-top: 1px solid var(--border-subtle);
		padding-top: 20px;
	}

	.border-bottom {
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 12px;
	}

	/* Hint de validación del enlace P2P */
	.payment-validation {
		margin-top: 2px;
	}
	.payment-hint {
		font-size: 0.72rem;
		margin: 0;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.payment-hint .material-icons-round {
		font-size: 1rem;
	}
	.payment-hint.ok {
		color: var(--aero-mint);
	}
	.payment-hint.error {
		color: var(--aero-rose);
	}
	.platform-name {
		font-weight: 800;
		text-transform: capitalize;
		color: var(--text-primary);
	}

	/* Tarjeta de Pagos y Enlaces */
	.payment-card {
		background: var(--glass-bg);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-border);
		box-shadow: var(--glass-inset-highlight), var(--shadow-glow, 0 4px 20px rgba(0, 0, 0, 0.08));
		border-radius: var(--radius-lg);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		position: relative;
		overflow: hidden;
		transform: translateZ(0);
	}
	.payment-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--glass-border-t);
		z-index: 1;
	}

	.payment-card-head {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		position: relative;
		z-index: 2;
	}
	.payment-icon-wrapper {
		position: relative;
		width: 48px;
		height: 48px;
		flex: 0 0 48px;
	}
	.payment-icon {
		position: absolute;
		inset: 0;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--accent-gradient);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
		color: #fff;
		font-size: 1.5rem;
		box-shadow:
			inset 0 2px 4px rgba(255, 255, 255, 0.4),
			0 4px 12px rgba(14, 165, 233, 0.3);
	}
	.payment-glow {
		position: absolute;
		inset: -4px;
		background: var(--accent-gradient);
		filter: blur(12px);
		opacity: 0.6;
		z-index: 1;
		border-radius: var(--radius-squircle);
		animation: pulse-glow 3s infinite alternate ease-in-out;
	}
	@keyframes pulse-glow {
		0% {
			opacity: 0.4;
			transform: scale(0.95);
		}
		100% {
			opacity: 0.7;
			transform: scale(1.05);
		}
	}

	.payment-card-title {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.payment-card-title .toggle-title {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.payment-card-title .toggle-desc {
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.payment-input-row {
		display: flex;
		flex-direction: column;
		gap: 12px;
		position: relative;
		z-index: 2;
	}
	.payment-input-wrap {
		display: flex;
		gap: 8px;
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
		padding: 6px;
		border-radius: var(--radius-full);
		transition: all var(--t-fast);
		box-shadow: var(--input-shadow-inner, inset 0 2px 4px rgba(0, 0, 0, 0.02));
		position: relative;
	}
	.payment-input-field {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 8px;
		padding-left: 12px;
	}
	.payment-input {
		flex: 1;
		min-width: 0;
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		padding: 8px 12px 8px 0;
		outline: none;
	}
	.payment-input-wrap:focus-within {
		border-color: var(--accent-blue-light);
		box-shadow:
			0 0 0 3px rgba(46, 180, 255, 0.2),
			var(--input-shadow-inner);
		background: var(--bg-input-tint);
	}
	.payment-save {
		border-radius: var(--radius-full);
		padding: 10px 24px;
		flex-shrink: 0;
		font-weight: 700;
		letter-spacing: 0.5px;
	}
	.payment-save:not(:disabled) {
		box-shadow: var(--shadow-btn-primary);
	}

	.payment-preview-card {
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 20px;
		background: color-mix(in srgb, var(--text-primary) 3%, transparent);
		border-radius: var(--radius-md);
		border: 1px dashed var(--border-subtle);
		position: relative;
		z-index: 2;
	}
	.payment-preview-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--accent-blue-base);
		align-self: flex-start;
	}

	.payment-preview-mockup {
		background: var(--bg-surface-solid);
		border-radius: var(--radius-sm);
		overflow: hidden;
		box-shadow: var(--shadow-md);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-bottom: 20px;
		position: relative;
	}
	.mockup-banner {
		width: 100%;
		height: 60px;
		flex-shrink: 0;
		background: linear-gradient(135deg, var(--aero-sky), var(--aero-mint));
		opacity: 0.6;
	}
	.mockup-avatar {
		width: 64px;
		height: 64px;
		flex: 0 0 64px;
		border-radius: 50%;
		background: var(--aero-blue);
		border: 3px solid var(--bg-surface-solid);
		margin-top: -32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-size: 2rem;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
		position: relative;
		z-index: 2;
	}
	.mockup-info {
		text-align: center;
		margin-top: 8px;
		margin-bottom: 16px;
	}
	.mockup-name {
		font-weight: 800;
		font-size: 1rem;
		color: var(--text-primary);
	}
	.mockup-bio {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}
	.mockup-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 24px;
		border-radius: var(--radius-full);
		font-weight: 700;
		font-size: 0.9rem;
		text-decoration: none;
	}
	.mockup-btn .material-icons-round {
		font-size: 1.1rem;
	}

	.payment-actions-footer {
		display: flex;
		justify-content: flex-end;
		margin-top: 4px;
	}
	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
		padding: 8px 16px;
		border-radius: var(--radius-full);
	}
	.action-btn .material-icons-round {
		font-size: 1rem;
	}

	.payment-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 24px;
		text-align: center;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-primary) 3%, transparent);
		border-radius: var(--radius-md);
		border: 1px dashed var(--border-subtle);
		position: relative;
		z-index: 2;
	}
	.payment-empty-state .material-icons-round {
		font-size: 2rem;
		opacity: 0.5;
	}
	.payment-empty-state p {
		margin: 0;
		font-size: 0.85rem;
	}

	@media (max-width: 520px) {
		.payment-input-wrap {
			flex-direction: column;
			align-items: stretch;
			border-radius: var(--radius-md);
			padding: 8px;
			gap: 12px;
		}
		.payment-input-field {
			padding-left: 8px;
		}
		.payment-input {
			padding: 8px 12px 8px 0;
		}
	}
</style>
