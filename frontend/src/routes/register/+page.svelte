<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';

	// ── State ────────────────────────────────────────────────────────────────
	let step = $state(1); // 1: Credentials, 2: Interests, 3: Profile Type
	let username = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');

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
	let profileType = $state('viewer'); // 'viewer' or 'creator'

	let showPass = $state(false);
	let loading = $state(false);
	let error = $state('');
	let mounted = $state(false);
	let birthDate = $state('');
	let acceptedTerms = $state(false);

	// ── Derived ──────────────────────────────────────────────────────────────
	let emailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
	let passwordsMatch = $derived(password === confirmPassword);
	let ageValid = $derived(
		birthDate ? Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000) >= 13 : false
	);
	let step1Valid = $derived(
		username.trim().length >= 3 &&
			emailValid &&
			password.length >= 8 &&
			passwordsMatch &&
			!!birthDate &&
			ageValid &&
			acceptedTerms
	);
	let step2Valid = $derived(selectedInterests.length === 3);

	// ── Lifecycle ────────────────────────────────────────────────────────────
	let particles = $state([]);

	onMount(() => {
		mounted = true;
		particles = Array.from({ length: 15 }, (_, i) => ({
			id: i,
			x: Math.random() * 100,
			y: Math.random() * 100,
			size: Math.random() * 25 + 10,
			delay: Math.random() * 4,
			duration: Math.random() * 8 + 8
		}));
		if (authStore.isAuthenticated) {
			goto('/feed');
		}
	});

	// ── Handlers ─────────────────────────────────────────────────────────────
	function toggleInterest(id) {
		if (selectedInterests.includes(id)) {
			selectedInterests = selectedInterests.filter((x) => x !== id);
		} else {
			if (selectedInterests.length >= 3) return; // Máximo 3 categorías
			selectedInterests = [...selectedInterests, id];
		}
	}

	function nextStep() {
		if (step === 1 && step1Valid) {
			step = 2;
		} else if (step === 2 && step2Valid) {
			step = 3;
		}
	}

	function prevStep() {
		if (step > 1) step -= 1;
	}

	async function handleRegister(e) {
		e.preventDefault();
		if (step !== 3 || loading) return;

		error = '';
		loading = true;

		try {
			const payload = {
				username: username.trim().toLowerCase(),
				email: email.trim(),
				password,
				birth_date: birthDate,
				accepted_terms: acceptedTerms,
				interests: selectedInterests,
				profile_type: profileType
			};

			await authStore.register(payload);
			goto('/feed');
		} catch (err) {
			error = err?.message ?? 'Error al registrar la cuenta. Inténtalo de nuevo.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>V-SOCIAL | Crear Cuenta</title>
</svelte:head>

<div
	class="register-container min-h-screen w-full flex relative overflow-hidden"
	in:fade={{ duration: 600 }}
>
	<!-- Theme Toggle -->
	<ThemeSelector compact={true} align="right" class="theme-toggle-wrap" />

	<!-- Bubbles Background -->
	<div class="absolute inset-0 z-0 overflow-hidden pointer-events-none">
		{#each particles as p (p.id)}
			<div
				class="bubble"
				style="
          left: {p.x}%;
          top: {p.y}%;
          width: {p.size}px;
          height: {p.size}px;
          animation-delay: -{p.delay}s;
          animation-duration: {p.duration}s;
        "
			></div>
		{/each}
	</div>

	<!-- Left Side: Brand Panel (Hidden on Mobile) -->
	<aside
		class="hidden lg:flex lg:w-[50%] relative flex-col items-center justify-center p-12 z-10"
		in:fly={{ y: 20, duration: 800, delay: 200 }}
	>
		<div
			class="glass-panel p-8 max-w-md text-center flex flex-col items-center gap-6 animate-float"
		>
			<!-- Logo -->
			<div class="aero-logo">
				<span class="logo-text">VS</span>
			</div>

			<div>
				<h1 class="title-display text-3xl font-black text-gradient mb-2">Comienza Hoy</h1>
				<p class="text-sm text-muted leading-relaxed">
					Crea tu identidad virtual en la primera red social diseñada específicamente para VTubers,
					ilustradores digitales y sus comunidades.
				</p>
			</div>

			<div
				class="w-full flex items-center justify-between text-xs text-muted border-t pt-4"
				style="border-color: var(--border-color);"
			>
				<span>&copy; 2026 VSocial Inc.</span>
				<div class="flex gap-4">
					<a href="/terms" class="text-link">Términos</a>
					<a href="/privacy" class="text-link">Privacidad</a>
				</div>
			</div>
		</div>
	</aside>

	<!-- Right Side: Multi-step Form -->
	<main
		class="w-full lg:w-[50%] flex items-center justify-center p-6 sm:p-12 z-10 relative"
		in:fly={{ y: 20, duration: 800, delay: 300 }}
	>
		<div class="auth-card max-w-md w-full relative overflow-hidden">
			<div
				class="w-full max-w-md my-4 {mounted
					? 'visible'
					: 'hidden-state'} transition-all duration-500"
			>
				<!-- Progress Indicator -->
				<div class="mb-4">
					<div
						class="flex justify-between items-center text-[10px] font-bold text-muted mb-2 uppercase tracking-wide"
					>
						<span>PASO {step} DE 3</span>
						<span class="text-gradient">
							{step === 1 ? 'DATOS DE ACCESO' : step === 2 ? 'TUS INTERESES' : 'TIPO DE PERFIL'}
						</span>
					</div>
					<div
						class="w-full rounded-full overflow-hidden"
						style="height: 4px; background: var(--border-glass);"
					>
						<div
							class="h-full transition-all duration-300"
							style="width: {step *
								33.33}%; background: var(--grad-primary); box-shadow: 0 0 10px rgba(0, 119, 255, 0.5);"
						></div>
					</div>
				</div>

				<div class="glass-panel p-8">
					<!-- Step 1: Credentials -->
					{#if step === 1}
						<div class="animate-fade-in flex flex-col gap-4">
							<div>
								<h2 class="text-xl font-black text-main title-display mb-1">Crea tu Cuenta</h2>
								<p class="text-xs text-muted">
									Introduce tus datos básicos para registrarte en el metaverso.
								</p>
							</div>

							<form
								onsubmit={(e) => {
									e.preventDefault();
									nextStep();
								}}
								class="flex flex-col gap-4"
							>
								<div class="flex flex-col gap-1.5">
									<label for="username" class="text-xs font-bold text-muted">Usuario</label>
									<div class="relative" style="position: relative;">
										<span
											class="text-muted font-bold text-sm"
											style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); z-index: 2; pointer-events: none;"
											>@</span
										>
										<input
											id="username"
											type="text"
											required
											bind:value={username}
											placeholder="mi_avatar"
											class="aero-input w-full"
											style="padding-left: 36px;"
										/>
									</div>
									{#if username && username.length < 3}
										<p class="text-[10px] text-red-500 font-semibold">
											Debe tener al menos 3 caracteres.
										</p>
									{/if}
								</div>

								<div class="flex flex-col gap-1.5">
									<label for="email" class="text-xs font-bold text-muted">Correo Electrónico</label>
									<div class="relative" style="position: relative;">
										<span
											class="material-icons-round text-muted text-[18px]"
											style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); z-index: 2; pointer-events: none;"
											>email</span
										>
										<input
											id="email"
											type="email"
											required
											bind:value={email}
											placeholder="nombre@ejemplo.com"
											class="aero-input w-full"
											style="padding-left: 38px;"
										/>
									</div>
									{#if email && !emailValid}
										<p class="text-[10px] text-red-500 font-semibold">
											Introduce un correo electrónico válido.
										</p>
									{/if}
								</div>

								<div class="flex flex-col gap-1.5">
									<label for="password" class="text-xs font-bold text-muted">Contraseña</label>
									<div class="relative" style="position: relative;">
										<span
											class="material-icons-round text-muted text-[18px]"
											style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); z-index: 2; pointer-events: none;"
											>lock</span
										>
										<input
											id="password"
											type={showPass ? 'text' : 'password'}
											required
											bind:value={password}
											placeholder="Mínimo 8 caracteres"
											class="aero-input w-full"
											style="padding-left: 38px; padding-right: 38px;"
										/>
										<button
											type="button"
											onclick={() => (showPass = !showPass)}
											class="pass-toggle"
											style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; z-index: 2;"
										>
											<span class="material-icons-round text-[18px]"
												>{showPass ? 'visibility_off' : 'visibility'}</span
											>
										</button>
									</div>
									{#if password && password.length < 8}
										<p class="text-[10px] text-red-500 font-semibold">
											Debe tener al menos 8 caracteres.
										</p>
									{/if}
								</div>

								<div class="flex flex-col gap-1.5">
									<label for="confirmPassword" class="text-xs font-bold text-muted"
										>Confirmar Contraseña</label
									>
									<input
										id="confirmPassword"
										type="password"
										required
										placeholder="Repite tu contraseña"
										bind:value={confirmPassword}
										class="aero-input w-full"
									/>
									{#if confirmPassword && !passwordsMatch}
										<p class="text-[10px] text-red-500 font-semibold">
											Las contraseñas no coinciden.
										</p>
									{/if}
								</div>

								<div class="flex flex-col gap-1.5">
									<label for="birthDate" class="text-xs font-bold text-muted"
										>Fecha de Nacimiento</label
									>
									<input
										id="birthDate"
										type="date"
										required
										bind:value={birthDate}
										max={new Date().toISOString().split('T')[0]}
										class="aero-input w-full"
									/>
									{#if birthDate && !ageValid}
										<p class="text-[10px] text-red-500 font-semibold">
											Debes tener al menos 13 años para registrarte.
										</p>
									{/if}
								</div>

								<label class="flex items-start gap-2 text-xs text-muted cursor-pointer select-none">
									<input
										type="checkbox"
										bind:checked={acceptedTerms}
										class="mt-0.5 accent-[var(--primary-color,#1b85f3)]"
									/>
									<span
										>He leído y acepto los <a href="/terms" class="text-link">Términos</a> y la
										<a href="/privacy" class="text-link">Política de Privacidad</a>. Confirmo que
										tengo al menos 13 años.</span
									>
								</label>

								<button type="submit" disabled={!step1Valid} class="btn-aero-primary w-full mt-2">
									Continuar
									<span class="material-icons-round text-sm">arrow_forward</span>
								</button>
							</form>
						</div>

						<!-- Step 2: Interests -->
					{:else if step === 2}
						<div class="animate-fade-in flex flex-col gap-4">
							<div>
								<h2 class="text-xl font-black text-main title-display mb-1">Elige tus intereses</h2>
								<p class="text-xs text-muted">
									Elige exactamente 3 categorías para personalizar tu feed inicial.
								</p>
							</div>

							<div
								class="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-custom"
							>
								{#each categories as cat}
									<button
										type="button"
										onclick={() => toggleInterest(cat.id)}
										class="interest-btn {selectedInterests.includes(cat.id) ? 'selected' : ''}"
									>
										<span
											class="material-icons-round text-lg {selectedInterests.includes(cat.id)
												? 'text-blue-500'
												: 'text-muted'}"
										>
											{cat.icon}
										</span>
										<span class="text-xs">{cat.name}</span>
									</button>
								{/each}
							</div>

							<div class="flex gap-3 mt-2">
								<button type="button" onclick={prevStep} class="btn-aero-secondary w-1/3">
									Atrás
								</button>
								<button
									type="button"
									disabled={!step2Valid}
									onclick={nextStep}
									class="btn-aero-primary flex-1"
								>
									Continuar
									<span class="material-icons-round text-sm">arrow_forward</span>
								</button>
							</div>
							{#if selectedInterests.length < 3}
								<p class="text-[10px] text-center text-muted font-bold">
									Selecciona {3 - selectedInterests.length} más para continuar
								</p>
							{/if}
						</div>

						<!-- Step 3: Profile Type -->
					{:else if step === 3}
						<div class="animate-fade-in flex flex-col gap-4">
							<div>
								<h2 class="text-xl font-black text-main title-display mb-1">
									¿Cómo usarás VSocial?
								</h2>
								<p class="text-xs text-muted">Selecciona tu rol principal de acceso.</p>
							</div>

							{#if error}
								<div
									class="flex items-start gap-2 p-3 rounded-xl error-banner text-xs font-semibold"
								>
									<span class="material-icons-round text-sm shrink-0">error_outline</span>
									<p>{error}</p>
								</div>
							{/if}

							<div class="flex flex-col gap-3">
								<!-- Viewer Option -->
								<button
									type="button"
									onclick={() => (profileType = 'viewer')}
									class="profile-option {profileType === 'viewer'
										? 'selected viewer-selected'
										: ''}"
								>
									<div class="option-icon viewer-icon">
										<span class="material-icons-round text-white">favorite</span>
									</div>
									<div class="flex-1">
										<h3 class="font-bold text-sm text-main">Espectador / Fan</h3>
										<p class="text-[10px] text-muted mt-0.5">
											Seguir creadores, ver streams, comprar arte digital y participar del chat.
										</p>
									</div>
									{#if profileType === 'viewer'}
										<div class="check-mark viewer-check">
											<span class="material-icons-round text-white text-[10px] font-bold"
												>check</span
											>
										</div>
									{/if}
								</button>

								<!-- Creator Option -->
								<button
									type="button"
									onclick={() => (profileType = 'creator')}
									class="profile-option {profileType === 'creator'
										? 'selected creator-selected'
										: ''}"
								>
									<div class="option-icon creator-icon">
										<span class="material-icons-round text-white">videocam</span>
									</div>
									<div class="flex-1">
										<h3 class="font-bold text-sm text-main">Creador / VTuber</h3>
										<p class="text-[10px] text-muted mt-0.5">
											Soy VTuber, artista o creador. Publicar directos, asset packs y conectar con
											mi público.
										</p>
									</div>
									{#if profileType === 'creator'}
										<div class="check-mark creator-check">
											<span class="material-icons-round text-white text-[10px] font-bold"
												>check</span
											>
										</div>
									{/if}
								</button>
							</div>

							<div class="flex gap-3 mt-2">
								<button
									type="button"
									disabled={loading}
									onclick={prevStep}
									class="btn-aero-secondary w-1/3"
								>
									Atrás
								</button>
								<button
									type="button"
									onclick={handleRegister}
									disabled={loading}
									class="btn-aero-primary flex-1"
								>
									{#if loading}
										<span class="material-icons-round animate-spin text-sm">refresh</span>
										Guardando...
									{:else}
										Finalizar Registro
										<span class="material-icons-round text-sm">check</span>
									{/if}
								</button>
							</div>
						</div>
					{/if}
				</div>

				<p class="text-center text-xs text-muted mt-4">
					¿Ya tienes cuenta?
					<a href="/login" class="text-link font-bold">Inicia sesión</a>
				</p>
			</div>
		</div>
	</main>
</div>

<style>
	.register-container {
		background: var(--register-bg);
		min-height: 100vh;
		transition: background 0.4s ease;
	}

	/* Theme toggle floating button */
	:global(.theme-toggle-wrap) {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 100;
	}

	.bubble {
		position: absolute;
		background: var(--bubble-bg);
		border: 1px solid var(--bubble-border);
		box-shadow: var(--bubble-shadow);
		border-radius: 50%;
		animation: float-bubble 12s linear infinite;
		pointer-events: none;
		z-index: 0;
	}

	@keyframes float-bubble {
		0% {
			transform: translateY(100vh) scale(0.8);
			opacity: 0;
		}
		10% {
			opacity: 0.6;
		}
		90% {
			opacity: 0.6;
		}
		100% {
			transform: translateY(-20vh) scale(1.2);
			opacity: 0;
		}
	}

	.aero-logo {
		width: 64px;
		height: 64px;
		border-radius: 20px;
		background: linear-gradient(135deg, var(--color-aero-cyan), var(--color-aero-blue));
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			inset 0 2px 4px rgba(255, 255, 255, 0.4),
			0 8px 20px rgba(0, 119, 255, 0.25);
	}

	.logo-text {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: 24px;
		color: white;
	}

	.text-main {
		color: var(--text-main);
	}

	.text-link {
		color: var(--color-aero-blue);
		text-decoration: none;
		transition: var(--transition-smooth);
	}
	.text-link:hover {
		color: var(--color-aero-cyan);
		text-decoration: underline;
	}

	.error-banner {
		background: rgba(255, 0, 110, 0.1);
		border: 1px solid rgba(255, 0, 110, 0.25);
		color: #ff006e;
	}

	.hidden-state {
		opacity: 0;
		transform: translateY(15px);
	}
	.visible {
		opacity: 1;
		transform: translateY(0);
	}

	/* Interest buttons */
	.interest-btn {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.625rem;
		border-radius: 0.75rem;
		border: 1px solid var(--interest-border);
		background: var(--interest-bg);
		color: var(--text-main);
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
	}
	.interest-btn:hover {
		background: var(--interest-hover-bg);
	}
	.interest-btn.selected {
		background: var(--interest-selected-bg);
		border-color: var(--color-aero-cyan);
		font-weight: 700;
		color: var(--color-aero-blue);
		box-shadow: 0 2px 8px rgba(0, 119, 255, 0.15);
	}

	/* Profile options */
	.profile-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 0.75rem;
		border: 1px solid var(--option-border);
		background: var(--option-bg);
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
		width: 100%;
		position: relative;
	}
	.profile-option:hover {
		background: var(--option-hover-bg);
	}
	.profile-option.selected {
		box-shadow: 0 2px 8px rgba(0, 119, 255, 0.15);
	}
	.profile-option.viewer-selected {
		background: var(--option-viewer-selected-bg);
		border-color: var(--color-aero-cyan);
	}
	.profile-option.creator-selected {
		background: var(--option-creator-selected-bg);
		border-color: var(--color-aero-green);
	}

	.option-icon {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.viewer-icon {
		background: linear-gradient(135deg, var(--color-aero-cyan), var(--color-aero-blue));
	}
	.creator-icon {
		background: linear-gradient(135deg, var(--color-aero-green), var(--color-aero-cyan));
	}

	.check-mark {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.viewer-check {
		background: var(--color-aero-blue);
	}
	.creator-check {
		background: var(--color-aero-green);
	}

	.scrollbar-custom::-webkit-scrollbar {
		width: 4px;
	}
	.scrollbar-custom::-webkit-scrollbar-track {
		background: var(--scrollbar-track);
		border-radius: 10px;
	}
	.scrollbar-custom::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb);
		border-radius: 10px;
	}
	.scrollbar-custom::-webkit-scrollbar-thumb:hover {
		background: var(--scrollbar-thumb-hover);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.animate-spin {
		animation: spin 1s linear infinite;
	}

	/* =========================================================
     Light Theme (default)
     ========================================================= */
	:global(:root) {
		--register-bg:
			radial-gradient(circle at 10% 25%, rgba(0, 229, 255, 0.2), transparent 45%),
			radial-gradient(circle at 85% 75%, rgba(0, 230, 118, 0.15), transparent 45%),
			linear-gradient(135deg, #e0f7fa 0%, #eceff1 100%);
		--toggle-bg: rgba(255, 255, 255, 0.6);
		--toggle-border: rgba(255, 255, 255, 0.9);
		--bubble-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.1));
		--bubble-border: rgba(255, 255, 255, 0.4);
		--bubble-shadow: 0 4px 10px rgba(0, 119, 255, 0.05), inset 0 2px 4px rgba(255, 255, 255, 0.4);
		--progress-bg: rgba(255, 255, 255, 0.4);
		--interest-border: rgba(255, 255, 255, 0.6);
		--interest-bg: rgba(255, 255, 255, 0.4);
		--interest-hover-bg: rgba(255, 255, 255, 0.7);
		--interest-selected-bg: rgba(0, 229, 255, 0.1);
		--option-border: rgba(255, 255, 255, 0.6);
		--option-bg: rgba(255, 255, 255, 0.4);
		--option-hover-bg: rgba(255, 255, 255, 0.6);
		--option-viewer-selected-bg: rgba(0, 229, 255, 0.08);
		--option-creator-selected-bg: rgba(0, 230, 118, 0.08);
		--scrollbar-track: rgba(255, 255, 255, 0.2);
		--scrollbar-thumb: rgba(0, 119, 255, 0.2);
		--scrollbar-thumb-hover: rgba(0, 119, 255, 0.4);
	}

	/* =========================================================
     Dark Theme
     ========================================================= */
	/* =========================================================
     Theme Configuration
     ========================================================= */
	.register-container {
		background: var(--bg-canvas);
	}
	.bubble {
		background: var(--grad-primary);
		opacity: 0.15;
		border: 1px solid var(--border-glass);
		box-shadow: var(--shadow-md), var(--glass-inset);
	}

	:global(:root) {
		--progress-bg: var(--bg-surface2);
		--interest-border: var(--border-glass);
		--interest-bg: var(--bg-overlay);
		--interest-hover-bg: var(--bg-surface2);
		--interest-selected-bg: rgba(0, 229, 255, 0.1);
		--option-border: var(--border-glass);
		--option-bg: var(--bg-overlay);
		--option-hover-bg: var(--bg-surface2);
		--option-viewer-selected-bg: rgba(0, 229, 255, 0.08);
		--option-creator-selected-bg: rgba(0, 230, 118, 0.08);
		--scrollbar-track: transparent;
		--scrollbar-thumb: var(--bg-surface2);
		--scrollbar-thumb-hover: var(--border-subtle);
	}
</style>
