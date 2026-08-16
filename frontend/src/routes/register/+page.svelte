<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';

	// ── State (Svelte 5 Runes) ───────────────────────────────────────────────
	let step = $state(1); // 1: Credentials, 2: Interests, 3: Profile Type
	let username = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let birthDate = $state('');
	let acceptedTerms = $state(false);
	let showPass = $state(false);

	// Step 2: Interests
	const categories = [
		{ id: 'gaming', name: 'Gaming', icon: 'sports_esports' },
		{ id: 'art', name: 'Arte Digital', icon: 'palette' },
		{ id: 'music', name: 'Música', icon: 'music_note' },
		{ id: 'vtubing', name: 'VTubing', icon: 'face' },
		{ id: 'streaming', name: 'Streaming', icon: 'live_tv' },
		{ id: 'photography', name: 'Fotografía', icon: 'photo_camera' },
		{ id: 'fashion', name: 'Moda', icon: 'checkroom' },
		{ id: 'tech', name: 'Tecnología', icon: 'devices' },
		{ id: 'fitness', name: 'Fitness', icon: 'fitness_center' },
		{ id: 'cooking', name: 'Cocina', icon: 'restaurant' },
		{ id: 'travel', name: 'Viajes', icon: 'flight' },
		{ id: 'books', name: 'Literatura', icon: 'menu_book' },
		{ id: 'cinema', name: 'Cine', icon: 'movie' },
		{ id: 'podcast', name: 'Podcasting', icon: 'mic' },
		{ id: 'animation', name: 'Animación', icon: 'animation' }
	];
	let selectedInterests = $state([]);

	// Step 3: Profile Type
	let profileType = $state('viewer'); // 'viewer' | 'creator'

	let loading = $state(false);
	let error = $state('');
	let shakeError = $state(false);
	let mounted = $state(false);

	// ── Derived Validations ──────────────────────────────────────────────────
	let usernameValid = $derived(/^[a-zA-Z0-9_]{3,32}$/.test(username.trim()));
	let emailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
	let passwordLengthValid = $derived(password.length >= 8);
	let passwordsMatch = $derived(password.length > 0 && password === confirmPassword);
	let ageValid = $derived(
		birthDate ? Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000) >= 13 : false
	);

	let step1Valid = $derived(
		usernameValid &&
			emailValid &&
			passwordLengthValid &&
			passwordsMatch &&
			!!birthDate &&
			ageValid &&
			acceptedTerms
	);

	let step2Valid = $derived(selectedInterests.length === 3);

	// ── Lifecycle ────────────────────────────────────────────────────────────
	$effect(() => {
		if (mounted && authStore.user) {
			goto('/feed');
		}
	});

	onMount(() => {
		mounted = true;
		if (authStore.isAuthenticated) {
			goto('/feed');
		}
	});

	// ── Handlers ─────────────────────────────────────────────────────────────
	function toggleInterest(id) {
		if (selectedInterests.includes(id)) {
			selectedInterests = selectedInterests.filter((x) => x !== id);
		} else {
			if (selectedInterests.length >= 3) return;
			selectedInterests = [...selectedInterests, id];
		}
	}

	function nextStep() {
		error = '';
		if (step === 1 && step1Valid) {
			step = 2;
		} else if (step === 2 && step2Valid) {
			step = 3;
		}
	}

	function prevStep() {
		error = '';
		if (step > 1) step -= 1;
	}

	async function handleRegister(e) {
		e?.preventDefault();
		if (step !== 3 || loading) return;

		error = '';
		shakeError = false;
		loading = true;

		try {
			const payload = {
				username: username.trim().toLowerCase(),
				email: email.trim(),
				password,
				birth_date: birthDate,
				accepted_terms: acceptedTerms,
				interests: selectedInterests,
				category: selectedInterests[0] || '',
				profile_type: profileType
			};

			await authStore.register(payload);
			goto('/feed');
		} catch (err) {
			error = err?.message ?? 'Error al registrar la cuenta. Inténtalo de nuevo.';
			shakeError = true;
			setTimeout(() => {
				shakeError = false;
			}, 600);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Crear Cuenta &mdash; VSocial</title>
	<meta
		name="description"
		content="Únete a VSocial y crea tu identidad en la red social definitiva para creadores virtuales y comunidades creativas."
	/>
</svelte:head>

<div class="vs-register-page" in:fade={{ duration: 400 }}>
	<!-- Top Navigation Capsule (Theme Toggle + Home link) -->
	<header class="vs-register-header" in:fly={{ y: -15, duration: 500, delay: 100 }}>
		<a href="/" class="vs-register-nav-pill" title="Volver al inicio">
			<span
				class="material-icons-round"
				style="font-size: 16px; flex: 0 0 16px; min-width: 16px; min-height: 16px;"
			>
				arrow_back
			</span>
			<span class="vs-register-nav-pill-text">Inicio</span>
		</a>

		<div class="vs-register-header-actions">
			<ThemeSelector compact={true} align="right" />
		</div>
	</header>

	<!-- Atmospheric Ambient Light Orbs -->
	<div class="vs-register-aurora-bg" aria-hidden="true">
		<div class="vs-light-orb orb-primary"></div>
		<div class="vs-light-orb orb-secondary"></div>
		<div class="vs-light-orb orb-accent"></div>
	</div>

	<!-- Main Stage Layout -->
	<div class="vs-register-stage">
		<!-- Left Showcase Hero Panel (Desktop & Tablet L) -->
		<aside class="vs-brand-hero" in:fly={{ x: -20, duration: 600, delay: 150 }}>
			<div class="vs-hero-card glass-panel">
				<!-- Brand Header -->
				<div class="vs-hero-brand">
					<div class="vs-hero-logo" style="flex: 0 0 44px; min-width: 44px; min-height: 44px;">
						<span class="vs-hero-logo-mark">VS</span>
					</div>
					<div class="vs-hero-titles">
						<div class="vs-hero-badge">
							<span class="vs-hero-badge-dot"></span>
							<span>REGISTRO DE IDENTIDAD</span>
						</div>
						<h1 class="vs-hero-heading">
							Únete a la nueva era de <span class="vs-gradient-text">creadores</span>.
						</h1>
					</div>
				</div>

				<p class="vs-hero-summary">
					Crea tu identidad digital en un entorno transparente, cristalino y libre de algoritmos
					intrusivos diseñado para potenciar tu comunidad.
				</p>

				<!-- Feature Highlights Grid -->
				<div class="vs-hero-features">
					<div class="vs-feature-pill">
						<div
							class="vs-feature-icon-box cyan"
							style="flex: 0 0 30px; min-width: 30px; min-height: 30px;"
						>
							<span class="material-icons-round">badge</span>
						</div>
						<div class="vs-feature-body">
							<strong class="vs-feature-title">Canal y Perfil Personalizable</strong>
							<span class="vs-feature-desc"
								>Diseña tu espacio, destaca directos y comparte recursos.</span
							>
						</div>
					</div>

					<div class="vs-feature-pill">
						<div
							class="vs-feature-icon-box blue"
							style="flex: 0 0 30px; min-width: 30px; min-height: 30px;"
						>
							<span class="material-icons-round">record_voice_over</span>
						</div>
						<div class="vs-feature-body">
							<strong class="vs-feature-title">Voz en Directo & Streaming</strong>
							<span class="vs-feature-desc"
								>Comunidades activas con audio espacial WebRTC a 60 FPS.</span
							>
						</div>
					</div>

					<div class="vs-feature-pill">
						<div
							class="vs-feature-icon-box emerald"
							style="flex: 0 0 30px; min-width: 30px; min-height: 30px;"
						>
							<span class="material-icons-round">payments</span>
						</div>
						<div class="vs-feature-body">
							<strong class="vs-feature-title">Monetización y Gigs Directos</strong>
							<span class="vs-feature-desc"
								>Venta de modelos 3D, comisiones y activos digitales.</span
							>
						</div>
					</div>
				</div>

				<!-- Trust & Security Status Ticker -->
				<div class="vs-hero-trust-bar">
					<div class="vs-trust-item">
						<span
							class="material-icons-round trust-icon"
							style="flex: 0 0 14px; min-width: 14px; min-height: 14px;"
						>
							verified_user
						</span>
						<span>Cifrado SHA-256</span>
					</div>
					<span class="vs-trust-sep">&bull;</span>
					<div class="vs-trust-item">
						<span
							class="material-icons-round trust-icon"
							style="flex: 0 0 14px; min-width: 14px; min-height: 14px;"
						>
							gavel
						</span>
						<span>RGPD 13+</span>
					</div>
					<span class="vs-trust-sep">&bull;</span>
					<div class="vs-trust-item">
						<span
							class="material-icons-round trust-icon"
							style="flex: 0 0 14px; min-width: 14px; min-height: 14px;"
						>
							eco
						</span>
						<span>Sin Rastreo Invasivo</span>
					</div>
				</div>
			</div>
		</aside>

		<!-- Right Registration Station Panel -->
		<main class="vs-register-station" in:fly={{ x: 20, duration: 600, delay: 200 }}>
			<div class="vs-station-card-wrap">
				<!-- Mobile Brand Header (Visible only on mobile) -->
				<div class="vs-mobile-brand">
					<div class="vs-mobile-logo" style="flex: 0 0 38px; min-width: 38px; min-height: 38px;">
						<span>VS</span>
					</div>
					<div class="vs-mobile-titles">
						<span class="vs-mobile-name">VSocial</span>
						<span class="vs-mobile-sub">Creación de Cuenta</span>
					</div>
				</div>

				<!-- Step Progress Indicator -->
				<div class="vs-progress-card glass-panel">
					<div class="vs-progress-labels">
						<span class="vs-progress-step-text">PASO {step} DE 3</span>
						<span class="vs-progress-step-name vs-gradient-text">
							{step === 1 ? 'DATOS BÁSICOS' : step === 2 ? 'TUS INTERESES' : 'TIPO DE PERFIL'}
						</span>
					</div>
					<div class="vs-progress-track">
						<div
							class="vs-progress-bar"
							style="width: {step === 1 ? '33.33%' : step === 2 ? '66.66%' : '100%'};"
						></div>
					</div>
				</div>

				<!-- Main Glass Form Card -->
				<div class="glass-panel vs-station-card">
					<!-- Error Banner -->
					{#if error}
						<div
							class="vs-alert-error"
							class:shake={shakeError}
							in:fly={{ y: -8, duration: 250 }}
							role="alert"
						>
							<div
								class="vs-alert-icon-box"
								style="flex: 0 0 24px; min-width: 24px; min-height: 24px;"
							>
								<span class="material-icons-round" style="font-size: 15px;">error_outline</span>
							</div>
							<div class="vs-alert-text">
								<strong>Aviso de Registro</strong>
								<span>{error}</span>
							</div>
							<button
								type="button"
								onclick={() => (error = '')}
								class="vs-alert-close-btn"
								aria-label="Cerrar aviso"
								style="flex: 0 0 20px; min-width: 20px; min-height: 20px;"
							>
								<span class="material-icons-round" style="font-size: 14px;">close</span>
							</button>
						</div>
					{/if}

					<!-- STEP 1: Basic Credentials & GDPR -->
					{#if step === 1}
						<div class="vs-step-block" in:fade={{ duration: 250 }}>
							<div class="vs-card-header">
								<div class="vs-card-header-badge">
									<span class="material-icons-round" style="font-size: 14px;">person_add</span>
									<span>PASO 1</span>
								</div>
								<h2 class="vs-card-title">Crea tu Cuenta</h2>
								<p class="vs-card-desc">Introduce tus datos básicos de acceso a la plataforma.</p>
							</div>

							<form
								onsubmit={(e) => {
									e.preventDefault();
									nextStep();
								}}
								class="vs-register-form"
								novalidate
							>
								<!-- Username Field -->
								<div class="vs-form-group">
									<label for="reg-username" class="vs-form-label">
										<span>Usuario</span>
										<span class="vs-form-required">*</span>
									</label>
									<div class="vs-input-wrapper">
										<div
											class="vs-input-lead-icon"
											style="flex: 0 0 36px; min-width: 36px; min-height: 36px;"
										>
											<span class="vs-input-at">@</span>
										</div>
										<input
											id="reg-username"
											type="text"
											name="username"
											autocomplete="username"
											placeholder="mi_avatar"
											bind:value={username}
											class="aero-input vs-custom-input"
											required
										/>
									</div>
									{#if username && !usernameValid}
										<p class="vs-field-error">
											Entre 3 y 32 caracteres (solo letras, números y _).
										</p>
									{/if}
								</div>

								<!-- Email Field -->
								<div class="vs-form-group">
									<label for="reg-email" class="vs-form-label">
										<span>Correo Electrónico</span>
										<span class="vs-form-required">*</span>
									</label>
									<div class="vs-input-wrapper">
										<div
											class="vs-input-lead-icon"
											style="flex: 0 0 36px; min-width: 36px; min-height: 36px;"
										>
											<span class="material-icons-round" style="font-size: 17px;">email</span>
										</div>
										<input
											id="reg-email"
											type="email"
											name="email"
											autocomplete="email"
											placeholder="tu@correo.com"
											bind:value={email}
											class="aero-input vs-custom-input"
											required
										/>
									</div>
									{#if email && !emailValid}
										<p class="vs-field-error">Introduce un correo electrónico válido.</p>
									{/if}
								</div>

								<!-- Password Field -->
								<div class="vs-form-group">
									<label for="reg-password" class="vs-form-label">
										<span>Contraseña</span>
										<span class="vs-form-required">*</span>
									</label>
									<div class="vs-input-wrapper">
										<div
											class="vs-input-lead-icon"
											style="flex: 0 0 36px; min-width: 36px; min-height: 36px;"
										>
											<span class="material-icons-round" style="font-size: 17px;">lock</span>
										</div>
										<input
											id="reg-password"
											type={showPass ? 'text' : 'password'}
											name="password"
											autocomplete="new-password"
											placeholder="Mínimo 8 caracteres"
											bind:value={password}
											class="aero-input vs-custom-input with-trail-btn"
											required
										/>
										<button
											type="button"
											onclick={() => (showPass = !showPass)}
											class="vs-pass-toggle-btn"
											aria-label={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
											title={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
											tabindex="0"
											style="flex: 0 0 34px; min-width: 34px; min-height: 34px;"
										>
											<span class="material-icons-round" style="font-size: 17px;">
												{showPass ? 'visibility_off' : 'visibility'}
											</span>
										</button>
									</div>
									{#if password && !passwordLengthValid}
										<p class="vs-field-error">Debe tener al menos 8 caracteres.</p>
									{/if}
								</div>

								<!-- Confirm Password Field -->
								<div class="vs-form-group">
									<label for="reg-confirm-password" class="vs-form-label">
										<span>Confirmar Contraseña</span>
										<span class="vs-form-required">*</span>
									</label>
									<div class="vs-input-wrapper">
										<div
											class="vs-input-lead-icon"
											style="flex: 0 0 36px; min-width: 36px; min-height: 36px;"
										>
											<span class="material-icons-round" style="font-size: 17px;">lock_reset</span>
										</div>
										<input
											id="reg-confirm-password"
											type={showPass ? 'text' : 'password'}
											name="confirm-password"
											autocomplete="new-password"
											placeholder="Repite tu contraseña"
											bind:value={confirmPassword}
											class="aero-input vs-custom-input"
											required
										/>
									</div>
									{#if confirmPassword && !passwordsMatch}
										<p class="vs-field-error">Las contraseñas no coinciden.</p>
									{/if}
								</div>

								<!-- Birth Date Field (RGPD Age Gate) -->
								<div class="vs-form-group">
									<label for="reg-birth-date" class="vs-form-label">
										<span>Fecha de Nacimiento (Mínimo 13 años)</span>
										<span class="vs-form-required">*</span>
									</label>
									<div class="vs-input-wrapper">
										<div
											class="vs-input-lead-icon"
											style="flex: 0 0 36px; min-width: 36px; min-height: 36px;"
										>
											<span class="material-icons-round" style="font-size: 17px;"
												>calendar_today</span
											>
										</div>
										<input
											id="reg-birth-date"
											type="date"
											name="birth_date"
											max={new Date().toISOString().split('T')[0]}
											bind:value={birthDate}
											class="aero-input vs-custom-input"
											required
										/>
									</div>
									{#if birthDate && !ageValid}
										<p class="vs-field-error">Debes tener al menos 13 años para registrarte.</p>
									{/if}
								</div>

								<!-- RGPD Consent Checkbox -->
								<div class="vs-rgpd-row">
									<label class="vs-checkbox-label align-start">
										<input
											type="checkbox"
											bind:checked={acceptedTerms}
											class="vs-custom-checkbox mt-05"
										/>
										<span class="vs-checkbox-text">
											Acepto los <a href="/terms" target="_blank" class="vs-legal-link">Términos</a>
											y la
											<a href="/privacy" target="_blank" class="vs-legal-link"
												>Política de Privacidad</a
											>. Confirmo que tengo al menos 13 años.
										</span>
									</label>
								</div>

								<!-- Next Step Action Button -->
								<div class="vs-submit-wrap">
									<button
										type="submit"
										disabled={!step1Valid}
										class="btn-aero-primary vs-submit-btn"
									>
										<span>Continuar a Intereses</span>
										<span class="material-icons-round" style="font-size: 17px;">arrow_forward</span>
									</button>
								</div>
							</form>
						</div>

						<!-- STEP 2: Interests -->
					{:else if step === 2}
						<div class="vs-step-block" in:fade={{ duration: 250 }}>
							<div class="vs-card-header">
								<div class="vs-card-header-badge">
									<span class="material-icons-round" style="font-size: 14px;">category</span>
									<span>PASO 2</span>
								</div>
								<h2 class="vs-card-title">Elige tus Intereses</h2>
								<p class="vs-card-desc">
									Selecciona exactamente 3 temas para personalizar tu feed inicial.
								</p>
							</div>

							<div class="vs-interests-grid scrollbar-custom">
								{#each categories as cat (cat.id)}
									{@const isSelected = selectedInterests.includes(cat.id)}
									<button
										type="button"
										onclick={() => toggleInterest(cat.id)}
										class="vs-interest-btn"
										class:is-selected={isSelected}
										aria-pressed={isSelected}
									>
										<span class="material-icons-round interest-icon" class:is-selected={isSelected}>
											{cat.icon}
										</span>
										<span class="interest-name">{cat.name}</span>
									</button>
								{/each}
							</div>

							<div class="vs-step-counter-chip">
								{#if selectedInterests.length < 3}
									<span
										>Selecciona <strong>{3 - selectedInterests.length}</strong> más para continuar</span
									>
								{:else}
									<span class="ready-text">
										<span class="material-icons-round" style="font-size: 14px;">check_circle</span>
										¡3 de 3 seleccionados!
									</span>
								{/if}
							</div>

							<div class="vs-step-actions-row">
								<button type="button" onclick={prevStep} class="btn-aero-secondary vs-action-half">
									<span class="material-icons-round" style="font-size: 16px;">arrow_back</span>
									<span>Atrás</span>
								</button>
								<button
									type="button"
									disabled={!step2Valid}
									onclick={nextStep}
									class="btn-aero-primary vs-action-half"
								>
									<span>Continuar</span>
									<span class="material-icons-round" style="font-size: 16px;">arrow_forward</span>
								</button>
							</div>
						</div>

						<!-- STEP 3: Profile Type -->
					{:else if step === 3}
						<div class="vs-step-block" in:fade={{ duration: 250 }}>
							<div class="vs-card-header">
								<div class="vs-card-header-badge">
									<span class="material-icons-round" style="font-size: 14px;">tune</span>
									<span>PASO 3</span>
								</div>
								<h2 class="vs-card-title">¿Cómo usarás VSocial?</h2>
								<p class="vs-card-desc">
									Elige tu perfil principal para calibrar tu estación inicial.
								</p>
							</div>

							<div class="vs-profile-options-list">
								<!-- Viewer Option -->
								<button
									type="button"
									onclick={() => (profileType = 'viewer')}
									class="vs-profile-option-card"
									class:is-selected={profileType === 'viewer'}
									aria-pressed={profileType === 'viewer'}
								>
									<div
										class="vs-option-icon-box cyan"
										style="flex: 0 0 34px; min-width: 34px; min-height: 34px;"
									>
										<span class="material-icons-round" style="font-size: 18px;">favorite</span>
									</div>
									<div class="vs-option-body">
										<h3 class="vs-option-title">Espectador / Fan</h3>
										<p class="vs-option-desc">
											Seguir creadores, ver streams, adquirir arte y participar de las salas.
										</p>
									</div>
									{#if profileType === 'viewer'}
										<div
											class="vs-option-check"
											style="flex: 0 0 20px; min-width: 20px; min-height: 20px;"
										>
											<span class="material-icons-round" style="font-size: 14px;">check</span>
										</div>
									{/if}
								</button>

								<!-- Creator Option -->
								<button
									type="button"
									onclick={() => (profileType = 'creator')}
									class="vs-profile-option-card"
									class:is-selected={profileType === 'creator'}
									aria-pressed={profileType === 'creator'}
								>
									<div
										class="vs-option-icon-box emerald"
										style="flex: 0 0 34px; min-width: 34px; min-height: 34px;"
									>
										<span class="material-icons-round" style="font-size: 18px;">videocam</span>
									</div>
									<div class="vs-option-body">
										<h3 class="vs-option-title">Creador / VTuber</h3>
										<p class="vs-option-desc">
											Publicar directos, vender modelos 3D y conectar con tu público.
										</p>
									</div>
									{#if profileType === 'creator'}
										<div
											class="vs-option-check emerald"
											style="flex: 0 0 20px; min-width: 20px; min-height: 20px;"
										>
											<span class="material-icons-round" style="font-size: 14px;">check</span>
										</div>
									{/if}
								</button>
							</div>

							<div class="vs-step-actions-row">
								<button
									type="button"
									disabled={loading}
									onclick={prevStep}
									class="btn-aero-secondary vs-action-half"
								>
									<span class="material-icons-round" style="font-size: 16px;">arrow_back</span>
									<span>Atrás</span>
								</button>
								<button
									type="button"
									disabled={loading}
									onclick={handleRegister}
									class="btn-aero-primary vs-action-half"
								>
									{#if loading}
										<span
											class="material-icons-round vs-spin"
											style="font-size: 16px; flex: 0 0 16px; min-width: 16px; min-height: 16px;"
										>
											autorenew
										</span>
										<span>Guardando...</span>
									{:else}
										<span>Finalizar Registro</span>
										<span class="material-icons-round" style="font-size: 16px;">check</span>
									{/if}
								</button>
							</div>
						</div>
					{/if}

					<!-- Footer Switch to Login -->
					<footer class="vs-card-footer">
						<p class="vs-legal-text">
							¿Ya tienes una cuenta activa?
							<a href="/login" class="vs-legal-link">Inicia sesión</a>
						</p>
					</footer>
				</div>
			</div>
		</main>
	</div>
</div>

<style>
	/* ══════════════════════════════════════════════════════════════════════
	   💎 V-SOCIAL REGISTER STATION — SURGICAL COMPACT PROPORTIONS
	   ══════════════════════════════════════════════════════════════════════ */

	.vs-register-page {
		position: relative;
		min-height: 100vh;
		width: 100%;
		display: flex;
		flex-direction: column;
		background: var(--bg-canvas);
		color: var(--text-primary);
		overflow-x: hidden;
		isolation: isolate;
	}

	/* ── Top Header Bar ────────────────────────────────────────── */
	.vs-register-header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1.5rem;
		z-index: var(--z-sticky, 200);
		pointer-events: auto;
	}

	.vs-register-nav-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-full);
		background: var(--glass-bg);
		border: 1px solid var(--border-glass);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: 0.78rem;
		font-weight: 600;
		text-decoration: none;
		box-shadow: var(--shadow-xs), var(--glass-inset-highlight);
		transition:
			transform var(--t-spring),
			background var(--t-base),
			border-color var(--t-base),
			box-shadow var(--t-base);
		user-select: none;
	}

	.vs-register-nav-pill:hover {
		transform: translateY(-1px);
		background: var(--bg-surface-hover);
		border-color: rgba(var(--accent-blue-rgb), 0.4);
		box-shadow:
			var(--shadow-sm),
			0 0 10px rgba(var(--accent-blue-rgb), 0.25);
		color: var(--accent-blue-base);
	}

	.vs-register-nav-pill-text {
		letter-spacing: 0.02em;
	}

	.vs-register-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* ── Ambient Mesh Background ───────────────────────────────── */
	.vs-register-aurora-bg {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
		background:
			radial-gradient(
				ellipse 65% 55% at -5% -5%,
				rgba(var(--accent-blue-rgb, 27, 133, 243), 0.28) 0%,
				rgba(var(--accent-blue-rgb, 27, 133, 243), 0.04) 55%,
				transparent 70%
			),
			radial-gradient(
				ellipse 60% 50% at 108% 108%,
				rgba(var(--aero-mint-rgb, 0, 212, 170), 0.22) 0%,
				transparent 60%
			),
			radial-gradient(
				ellipse 40% 35% at 105% 10%,
				rgba(var(--accent-sky-rgb, 46, 180, 255), 0.16) 0%,
				transparent 55%
			),
			radial-gradient(
				ellipse 70% 50% at 40% 60%,
				rgba(var(--accent-sky-rgb, 46, 180, 255), 0.07) 0%,
				transparent 65%
			);
	}

	.vs-register-aurora-bg::after {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 80% 60% at 25% 70%,
			rgba(var(--aero-mint-rgb, 0, 212, 170), 0.1) 0%,
			transparent 60%
		);
		animation: vsRegisterBreathe 12s ease-in-out infinite alternate;
		will-change: opacity;
	}

	@keyframes vsRegisterBreathe {
		0% {
			opacity: 0.4;
		}
		100% {
			opacity: 1;
		}
	}

	.vs-light-orb {
		display: none;
	}

	/* ── Main Stage Grid Layout ────────────────────────────────── */
	.vs-register-stage {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 920px;
		margin: 0 auto;
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4.5rem 1.5rem 2rem 1.5rem;
		gap: 2.25rem;
	}

	/* ── Left Hero Brand Panel ─────────────────────────────────── */
	.vs-brand-hero {
		flex: 1 1 50%;
		display: none;
		max-width: 440px;
	}

	@media (min-width: 1024px) {
		.vs-brand-hero {
			display: block;
		}
	}

	.vs-hero-card {
		padding: 1.6rem 1.6rem;
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
		box-shadow: var(--glass-shadow), var(--glass-inset-highlight);
	}

	.vs-hero-brand {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.vs-hero-logo {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-sm);
		background: var(--accent-gradient);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			inset 0 1px 3px rgba(255, 255, 255, 0.6),
			inset 0 -2px 4px rgba(0, 0, 0, 0.2),
			0 8px 18px rgba(var(--accent-blue-rgb), 0.35);
		position: relative;
		overflow: hidden;
	}

	.vs-hero-logo::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 48%;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, transparent 100%);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
	}

	.vs-hero-logo-mark {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: 18px;
		letter-spacing: -0.02em;
		color: #ffffff;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		position: relative;
		z-index: 1;
	}

	.vs-hero-titles {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.vs-hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		align-self: flex-start;
		padding: 0.15rem 0.5rem;
		border-radius: var(--radius-full);
		background: rgba(var(--accent-blue-rgb), 0.1);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.25);
		color: var(--accent-blue-base);
		font-family: var(--font-display);
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}

	.vs-hero-badge-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--accent-blue-base);
		box-shadow: 0 0 6px var(--accent-blue-base);
		animation: vsDotPulse 2s infinite ease-in-out;
	}

	@keyframes vsDotPulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.3);
			opacity: 0.6;
		}
	}

	.vs-hero-heading {
		font-family: var(--font-display);
		font-size: 1.32rem;
		font-weight: 900;
		line-height: 1.25;
		letter-spacing: -0.02em;
		color: var(--text-primary);
		margin: 0;
	}

	.vs-gradient-text {
		background: var(--accent-gradient);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		display: inline;
	}

	.vs-hero-summary {
		font-size: 0.8rem;
		line-height: 1.5;
		color: var(--text-secondary);
		margin: 0;
	}

	/* Feature Cards */
	.vs-hero-features {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.vs-feature-pill {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 0.8rem;
		border-radius: var(--radius-sm);
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		transition:
			transform var(--t-spring),
			border-color var(--t-base),
			box-shadow var(--t-base),
			background var(--t-base);
	}

	.vs-feature-pill:hover {
		transform: translateX(3px);
		background: var(--bg-surface-hover);
		border-color: rgba(var(--accent-blue-rgb), 0.35);
		box-shadow:
			var(--shadow-xs),
			0 2px 10px rgba(var(--accent-blue-rgb), 0.1);
	}

	.vs-feature-icon-box {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4);
	}

	.vs-feature-icon-box.cyan {
		background: linear-gradient(135deg, #06b6d4, #0ea5e9);
	}

	.vs-feature-icon-box.blue {
		background: linear-gradient(135deg, #1b85f3, #3b82f6);
	}

	.vs-feature-icon-box.emerald {
		background: linear-gradient(135deg, #10b981, #059669);
	}

	.vs-feature-icon-box .material-icons-round {
		font-size: 16px;
	}

	.vs-feature-body {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
	}

	.vs-feature-title {
		font-family: var(--font-display);
		font-size: 0.775rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.vs-feature-desc {
		font-size: 0.7rem;
		color: var(--text-muted);
		line-height: 1.35;
	}

	.vs-hero-trust-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 0.85rem;
		border-top: 1px solid var(--border-subtle);
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--text-muted);
		letter-spacing: 0.01em;
	}

	.vs-trust-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.trust-icon {
		font-size: 14px;
		color: var(--accent-blue-base);
	}

	.vs-trust-sep {
		opacity: 0.35;
	}

	/* ── Right Registration Station Panel ──────────────────────── */
	.vs-register-station {
		flex: 1 1 50%;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		max-width: 400px;
	}

	.vs-station-card-wrap {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* Mobile Brand Logo Bar */
	.vs-mobile-brand {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0 0.25rem;
	}

	@media (min-width: 1024px) {
		.vs-mobile-brand {
			display: none;
		}
	}

	.vs-mobile-logo {
		width: 38px;
		height: 38px;
		border-radius: var(--radius-xs);
		background: var(--accent-gradient);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-family: var(--font-display);
		font-weight: 900;
		font-size: 16px;
		box-shadow: 0 3px 10px rgba(var(--accent-blue-rgb), 0.3);
	}

	.vs-mobile-titles {
		display: flex;
		flex-direction: column;
	}

	.vs-mobile-name {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 900;
		line-height: 1.1;
		color: var(--text-primary);
	}

	.vs-mobile-sub {
		font-size: 0.68rem;
		color: var(--text-muted);
		font-weight: 600;
	}

	/* Progress Pill Card */
	.vs-progress-card {
		padding: 0.6rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		box-shadow: var(--shadow-xs), var(--glass-inset-highlight);
	}

	.vs-progress-labels {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}

	.vs-progress-step-text {
		color: var(--text-muted);
	}

	.vs-progress-track {
		width: 100%;
		height: 3px;
		border-radius: var(--radius-full);
		background: var(--border-subtle);
		overflow: hidden;
	}

	.vs-progress-bar {
		height: 100%;
		background: var(--accent-gradient);
		box-shadow: 0 0 8px rgba(var(--accent-blue-rgb), 0.5);
		transition: width 0.35s var(--ease-spring);
	}

	/* Station Card */
	.vs-station-card {
		padding: 1.4rem 1.35rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		box-shadow:
			var(--glass-shadow),
			0 12px 32px rgba(0, 0, 0, 0.15),
			var(--glass-inset-highlight);
	}

	@media (max-width: 640px) {
		.vs-station-card {
			padding: 1.2rem 1.1rem;
			gap: 0.9rem;
		}
	}

	.vs-step-block {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.vs-card-header {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.vs-card-header-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		align-self: flex-start;
		padding: 0.15rem 0.45rem;
		border-radius: var(--radius-full);
		background: rgba(var(--accent-blue-rgb), 0.1);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.25);
		color: var(--accent-blue-base);
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		margin-bottom: 0.1rem;
	}

	.vs-card-title {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 900;
		letter-spacing: -0.02em;
		color: var(--text-primary);
		margin: 0;
	}

	.vs-card-desc {
		font-size: 0.76rem;
		color: var(--text-muted);
		margin: 0;
	}

	/* Error Banner */
	.vs-alert-error {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.75rem;
		border-radius: var(--radius-sm);
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.35);
		color: #f87171;
		box-shadow: 0 2px 8px rgba(239, 68, 68, 0.1);
	}

	.vs-alert-error.shake {
		animation: vsShake 0.5s var(--ease-spring);
	}

	@keyframes vsShake {
		0%,
		100% {
			transform: translateX(0);
		}
		20%,
		60% {
			transform: translateX(-5px);
		}
		40%,
		80% {
			transform: translateX(5px);
		}
	}

	.vs-alert-icon-box {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgba(239, 68, 68, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.vs-alert-icon-box .material-icons-round {
		color: #ef4444;
	}

	.vs-alert-text {
		display: flex;
		flex-direction: column;
		flex: 1;
		font-size: 0.74rem;
		line-height: 1.3;
	}

	.vs-alert-text strong {
		color: #fee2e2;
		font-weight: 700;
	}

	:global([data-theme='light']) .vs-alert-text strong {
		color: #991b1b;
	}

	.vs-alert-close-btn {
		background: transparent;
		border: none;
		color: currentColor;
		cursor: pointer;
		opacity: 0.7;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: opacity var(--t-fast);
	}

	.vs-alert-close-btn:hover {
		opacity: 1;
	}

	/* Form Structure */
	.vs-register-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.vs-form-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.vs-form-label {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-secondary);
		letter-spacing: 0.01em;
	}

	.vs-form-required {
		color: var(--accent-blue-base);
	}

	.vs-field-error {
		font-size: 0.68rem;
		color: #f87171;
		font-weight: 600;
		margin: 0.1rem 0 0 0;
	}

	/* Custom Input Wrapper */
	.vs-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
	}

	.vs-input-lead-icon {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 36px;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		pointer-events: none;
		z-index: 2;
		transition: color var(--t-base);
	}

	.vs-input-at {
		font-family: var(--font-sans);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-muted);
	}

	.vs-input-wrapper:focus-within .vs-input-lead-icon,
	.vs-input-wrapper:focus-within .vs-input-at {
		color: var(--accent-blue-base);
	}

	.vs-custom-input {
		min-height: 38px;
		padding: 0.45rem 0.75rem 0.45rem 36px;
		font-size: 0.84rem;
		border-radius: var(--radius-sm);
	}

	.vs-custom-input.with-trail-btn {
		padding-right: 36px;
	}

	.vs-pass-toggle-btn {
		position: absolute;
		right: 2px;
		top: 50%;
		transform: translateY(-50%);
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: var(--radius-xs);
		color: var(--text-muted);
		cursor: pointer;
		z-index: 3;
		transition:
			color var(--t-fast),
			background var(--t-fast);
	}

	.vs-pass-toggle-btn:hover {
		color: var(--accent-blue-base);
		background: rgba(var(--accent-blue-rgb), 0.1);
	}

	/* RGPD Checkbox */
	.vs-rgpd-row {
		padding: 0.15rem 0;
	}

	.vs-checkbox-label {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		user-select: none;
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--text-secondary);
		line-height: 1.35;
	}

	.vs-checkbox-label.align-start {
		align-items: flex-start;
	}

	.mt-05 {
		margin-top: 0.15rem;
	}

	.vs-custom-checkbox {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		accent-color: var(--accent-blue-base);
		cursor: pointer;
		flex-shrink: 0;
	}

	/* Submit Button */
	.vs-submit-wrap {
		margin-top: 0.2rem;
	}

	.vs-submit-btn {
		width: 100%;
		min-height: 40px;
		font-size: 0.86rem;
		font-weight: 800;
		padding: 0.5rem 1.25rem;
		letter-spacing: 0.02em;
		box-shadow:
			var(--shadow-btn-primary),
			0 4px 14px rgba(var(--accent-blue-rgb), 0.3);
	}

	.vs-submit-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		transform: none !important;
		box-shadow: none !important;
	}

	.vs-spin {
		animation: vsSpin 1s linear infinite;
	}

	@keyframes vsSpin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Step 2: Interests Grid ─────────────────────────────────── */
	.vs-interests-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.45rem;
		max-height: 220px;
		overflow-y: auto;
		padding-right: 0.35rem;
	}

	.vs-interest-btn {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.45rem 0.65rem;
		min-height: 36px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--bg-overlay);
		color: var(--text-primary);
		cursor: pointer;
		text-align: left;
		transition:
			background var(--t-fast),
			border-color var(--t-fast),
			transform var(--t-spring),
			box-shadow var(--t-fast);
	}

	.vs-interest-btn:hover {
		background: var(--bg-surface-hover);
		border-color: rgba(var(--accent-blue-rgb), 0.35);
		transform: translateY(-1px);
	}

	.vs-interest-btn.is-selected {
		background: rgba(var(--accent-blue-rgb), 0.12);
		border-color: var(--accent-blue-base);
		box-shadow: 0 2px 8px rgba(var(--accent-blue-rgb), 0.2);
	}

	.interest-icon {
		font-size: 16px;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.interest-icon.is-selected {
		color: var(--accent-blue-base);
	}

	.interest-name {
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.vs-step-counter-chip {
		text-align: center;
		font-size: 0.7rem;
		color: var(--text-muted);
		padding: 0.2rem 0;
	}

	.ready-text {
		color: var(--aero-mint, #00d4aa);
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.vs-step-actions-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.25rem;
	}

	.vs-action-half {
		flex: 1;
		min-height: 38px;
		font-size: 0.82rem;
		padding: 0.45rem 1rem;
	}

	/* ── Step 3: Profile Options ───────────────────────────────── */
	.vs-profile-options-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.vs-profile-option-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0.85rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--bg-overlay);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition:
			background var(--t-fast),
			border-color var(--t-fast),
			transform var(--t-spring),
			box-shadow var(--t-fast);
	}

	.vs-profile-option-card:hover {
		background: var(--bg-surface-hover);
		border-color: rgba(var(--accent-blue-rgb), 0.35);
		transform: translateY(-1px);
	}

	.vs-profile-option-card.is-selected {
		background: rgba(var(--accent-blue-rgb), 0.1);
		border-color: var(--accent-blue-base);
		box-shadow: 0 4px 14px rgba(var(--accent-blue-rgb), 0.15);
	}

	.vs-option-icon-box {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-xs);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		flex-shrink: 0;
		box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4);
	}

	.vs-option-icon-box.cyan {
		background: linear-gradient(135deg, #06b6d4, #0ea5e9);
	}

	.vs-option-icon-box.emerald {
		background: linear-gradient(135deg, #10b981, #059669);
	}

	.vs-option-body {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		flex: 1;
		min-width: 0;
	}

	.vs-option-title {
		font-family: var(--font-display);
		font-size: 0.825rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}

	.vs-option-desc {
		font-size: 0.68rem;
		color: var(--text-muted);
		line-height: 1.3;
		margin: 0;
	}

	.vs-option-check {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--accent-blue-base);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.vs-option-check.emerald {
		background: var(--aero-mint, #00d4aa);
	}

	/* Card Footer Legal */
	.vs-card-footer {
		text-align: center;
		padding-top: 0.4rem;
		border-top: 1px solid var(--border-subtle);
	}

	.vs-legal-text {
		font-size: 0.72rem;
		color: var(--text-muted);
		line-height: 1.4;
		margin: 0;
	}

	.vs-legal-link {
		color: var(--accent-blue-base);
		font-weight: 700;
		text-decoration: none;
	}

	.vs-legal-link:hover {
		text-decoration: underline;
	}

	/* Scrollbar styling */
	.scrollbar-custom::-webkit-scrollbar {
		width: 4px;
	}

	.scrollbar-custom::-webkit-scrollbar-track {
		background: transparent;
	}

	.scrollbar-custom::-webkit-scrollbar-thumb {
		background: var(--border-subtle);
		border-radius: var(--radius-full);
	}

	.scrollbar-custom::-webkit-scrollbar-thumb:hover {
		background: var(--accent-blue-base);
	}
</style>
