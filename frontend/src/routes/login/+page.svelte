<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';

	// ── State (Svelte 5 Runes) ───────────────────────────────────────────────
	let identifier = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let showPass = $state(false);
	let loading = $state(false);
	let error = $state('');
	let shakeError = $state(false);
	let mounted = $state(false);
	let helpModalOpen = $state(false);

	// ── Derived ──────────────────────────────────────────────────────────────
	let canSubmit = $derived(identifier.trim().length >= 2 && password.length >= 1);

	// ── Lifecycle ────────────────────────────────────────────────────────────
	$effect(() => {
		if (mounted && authStore.user) {
			goto('/feed');
		}
	});

	onMount(() => {
		mounted = true;
		try {
			const saved = localStorage.getItem('vsocial_saved_identifier');
			if (saved) {
				identifier = saved;
				rememberMe = true;
			}
		} catch {
			// Ignore localStorage restrictions in private/sandboxed modes
		}
	});

	// ── Handlers ─────────────────────────────────────────────────────────────
	async function handleLogin(e) {
		e?.preventDefault();
		if (!canSubmit || loading) return;

		error = '';
		shakeError = false;
		loading = true;

		try {
			await authStore.login(identifier.trim(), password);

			// Persist identifier if rememberMe is set
			try {
				if (rememberMe) {
					localStorage.setItem('vsocial_saved_identifier', identifier.trim());
				} else {
					localStorage.removeItem('vsocial_saved_identifier');
				}
			} catch {
				// Ignore
			}

			goto('/feed');
		} catch (err) {
			error = err?.message ?? 'Credenciales incorrectas o error en el servidor.';
			shakeError = true;
			setTimeout(() => {
				shakeError = false;
			}, 600);
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Enter' && canSubmit) {
			handleLogin(e);
		}
	}
</script>

<svelte:head>
	<title>Acceder a tu Cuenta &mdash; VSocial</title>
	<meta
		name="description"
		content="Inicia sesión en VSocial, el universo digital para creadores virtuales, VTubers y comunidades creativas."
	/>
</svelte:head>

<div class="vs-login-page" in:fade={{ duration: 400 }}>
	<!-- Top Navigation Capsule (Theme Toggle + Home link) -->
	<header class="vs-login-header" in:fly={{ y: -15, duration: 500, delay: 100 }}>
		<a href="/" class="vs-login-nav-pill" title="Volver al inicio">
			<span
				class="material-icons-round"
				style="font-size: 16px; flex: 0 0 16px; min-width: 16px; min-height: 16px;"
			>
				arrow_back
			</span>
			<span class="vs-login-nav-pill-text">Inicio</span>
		</a>

		<div class="vs-login-header-actions">
			<ThemeSelector compact={true} align="right" />
		</div>
	</header>

	<!-- Atmospheric Ambient Light Orbs -->
	<div class="vs-login-aurora-bg" aria-hidden="true">
		<div class="vs-light-orb orb-primary"></div>
		<div class="vs-light-orb orb-secondary"></div>
		<div class="vs-light-orb orb-accent"></div>
	</div>

	<!-- Main Stage Layout -->
	<div class="vs-login-stage">
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
							<span>PLATAFORMA VIRTUAL 2.0</span>
						</div>
						<h1 class="vs-hero-heading">
							Tu identidad en un universo <span class="vs-gradient-text">cristalino</span>.
						</h1>
					</div>
				</div>

				<p class="vs-hero-summary">
					Diseñado para creadores de contenido, ilustradores, VTubers y comunidades que buscan
					fluidez, privacidad y estética de vanguardia.
				</p>

				<!-- Feature Highlights Grid -->
				<div class="vs-hero-features">
					<div class="vs-feature-pill">
						<div
							class="vs-feature-icon-box cyan"
							style="flex: 0 0 30px; min-width: 30px; min-height: 30px;"
						>
							<span class="material-icons-round">water_drop</span>
						</div>
						<div class="vs-feature-body">
							<strong class="vs-feature-title">Glassmorphism & Físicas Neo-Aero</strong>
							<span class="vs-feature-desc">Interfaz translúcida a 60 FPS con feedback táctil.</span
							>
						</div>
					</div>

					<div class="vs-feature-pill">
						<div
							class="vs-feature-icon-box blue"
							style="flex: 0 0 30px; min-width: 30px; min-height: 30px;"
						>
							<span class="material-icons-round">bolt</span>
						</div>
						<div class="vs-feature-body">
							<strong class="vs-feature-title">Interacción en Tiempo Real</strong>
							<span class="vs-feature-desc">Presencia activa, chat instantáneo y voz WebRTC.</span>
						</div>
					</div>

					<div class="vs-feature-pill">
						<div
							class="vs-feature-icon-box emerald"
							style="flex: 0 0 30px; min-width: 30px; min-height: 30px;"
						>
							<span class="material-icons-round">storefront</span>
						</div>
						<div class="vs-feature-body">
							<strong class="vs-feature-title">Marketplace & Economía Directa</strong>
							<span class="vs-feature-desc">Monetiza modelos 3D y comisiones sin fricción.</span>
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
							security
						</span>
						<span>RGPD</span>
					</div>
					<span class="vs-trust-sep">&bull;</span>
					<div class="vs-trust-item">
						<span
							class="material-icons-round trust-icon"
							style="flex: 0 0 14px; min-width: 14px; min-height: 14px;"
						>
							speed
						</span>
						<span>Sin Algoritmos Ocultos</span>
					</div>
				</div>
			</div>
		</aside>

		<!-- Right Login Station Panel -->
		<main class="vs-login-station" in:fly={{ x: 20, duration: 600, delay: 200 }}>
			<div class="vs-station-card-wrap">
				<!-- Mobile Brand Header (Visible only on mobile) -->
				<div class="vs-mobile-brand">
					<div class="vs-mobile-logo" style="flex: 0 0 38px; min-width: 38px; min-height: 38px;">
						<span>VS</span>
					</div>
					<div class="vs-mobile-titles">
						<span class="vs-mobile-name">VSocial</span>
						<span class="vs-mobile-sub">Acceso a la Red</span>
					</div>
				</div>

				<!-- Main Glass Form Card -->
				<div class="glass-panel vs-station-card">
					<div class="vs-card-header">
						<div class="vs-card-header-badge">
							<span class="material-icons-round" style="font-size: 14px;">lock_open</span>
							<span>ACCESO SEGURO</span>
						</div>
						<h2 class="vs-card-title">Bienvenido de vuelta</h2>
						<p class="vs-card-desc">
							¿Aún no tienes cuenta?
							<a href="/register" class="vs-card-register-link">Regístrate gratis</a>
						</p>
					</div>

					<!-- Error Notification Banner -->
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
								<strong>No se pudo ingresar</strong>
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

					<!-- Login Form -->
					<form onsubmit={handleLogin} class="vs-login-form" novalidate>
						<!-- Identifier Field -->
						<div class="vs-form-group">
							<label for="identifier" class="vs-form-label">
								<span>Usuario o Correo</span>
								<span class="vs-form-required">*</span>
							</label>
							<div class="vs-input-wrapper">
								<div
									class="vs-input-lead-icon"
									style="flex: 0 0 36px; min-width: 36px; min-height: 36px;"
								>
									<span class="material-icons-round" style="font-size: 17px;">alternate_email</span>
								</div>
								<input
									id="identifier"
									type="text"
									name="username"
									autocomplete="username"
									placeholder="tu_usuario o correo@ejemplo.com"
									bind:value={identifier}
									onkeydown={handleKeydown}
									class="aero-input vs-custom-input"
									disabled={loading}
									required
								/>
							</div>
						</div>

						<!-- Password Field -->
						<div class="vs-form-group">
							<div class="vs-label-row">
								<label for="password" class="vs-form-label">
									<span>Contraseña</span>
									<span class="vs-form-required">*</span>
								</label>
								<button type="button" onclick={() => (helpModalOpen = true)} class="vs-forgot-link">
									¿Olvidaste tu contraseña?
								</button>
							</div>
							<div class="vs-input-wrapper">
								<div
									class="vs-input-lead-icon"
									style="flex: 0 0 36px; min-width: 36px; min-height: 36px;"
								>
									<span class="material-icons-round" style="font-size: 17px;">lock</span>
								</div>
								<input
									id="password"
									type={showPass ? 'text' : 'password'}
									name="password"
									autocomplete="current-password"
									placeholder="••••••••••••"
									bind:value={password}
									onkeydown={handleKeydown}
									class="aero-input vs-custom-input with-trail-btn"
									disabled={loading}
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
						</div>

						<!-- Options: Remember Me + Quick Tip -->
						<div class="vs-form-options">
							<label class="vs-checkbox-label">
								<input type="checkbox" bind:checked={rememberMe} class="vs-custom-checkbox" />
								<span class="vs-checkbox-text">Recordar usuario</span>
							</label>

							<div class="vs-security-chip" title="Transmisión cifrada de extremo a extremo">
								<span class="material-icons-round" style="font-size: 12px;">verified</span>
								<span>TLS 1.3</span>
							</div>
						</div>

						<!-- Submit Action Button -->
						<div class="vs-submit-wrap">
							<button
								type="submit"
								disabled={!canSubmit || loading}
								class="btn-aero-primary vs-submit-btn"
							>
								{#if loading}
									<span
										class="material-icons-round vs-spin"
										style="font-size: 17px; flex: 0 0 17px; min-width: 17px; min-height: 17px;"
									>
										autorenew
									</span>
									<span>Autenticando...</span>
								{:else}
									<span
										class="material-icons-round"
										style="font-size: 17px; flex: 0 0 17px; min-width: 17px; min-height: 17px;"
									>
										water_drop
									</span>
									<span>Ingresar a VSocial</span>
								{/if}
							</button>
						</div>
					</form>

					<!-- Divider -->
					<div class="vs-card-divider">
						<span class="vs-divider-line"></span>
						<span class="vs-divider-label">O explora la comunidad</span>
						<span class="vs-divider-line"></span>
					</div>

					<!-- Register Secondary Action -->
					<div class="vs-secondary-actions">
						<a href="/register" class="btn-aero-secondary vs-secondary-btn">
							<span
								class="material-icons-round"
								style="font-size: 16px; flex: 0 0 16px; min-width: 16px; min-height: 16px;"
							>
								person_add
							</span>
							<span>Crear una Nueva Cuenta</span>
						</a>
					</div>

					<!-- Footer Legal Notes -->
					<footer class="vs-card-footer">
						<p class="vs-legal-text">
							Al ingresar aceptas nuestros
							<a href="/terms" class="vs-legal-link">Términos</a> y
							<a href="/privacy" class="vs-legal-link">Privacidad</a>.
						</p>
					</footer>
				</div>
			</div>
		</main>
	</div>

	<!-- Help / Password Recovery Modal -->
	{#if helpModalOpen}
		<div
			class="vs-modal-backdrop"
			in:fade={{ duration: 200 }}
			onclick={() => (helpModalOpen = false)}
			onkeydown={(e) => {
				if (e.key === 'Escape') helpModalOpen = false;
			}}
			role="button"
			tabindex="0"
			aria-label="Cerrar ventana emergente de ayuda"
		>
			<div
				class="vs-modal-window glass-panel"
				in:scale={{ start: 0.95, duration: 250 }}
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				tabindex="-1"
				aria-labelledby="help-modal-title"
			>
				<div class="vs-modal-header">
					<div
						class="vs-modal-icon-badge"
						style="flex: 0 0 36px; min-width: 36px; min-height: 36px;"
					>
						<span class="material-icons-round" style="font-size: 18px;">help_outline</span>
					</div>
					<div>
						<h3 id="help-modal-title" class="vs-modal-title">Asistencia de Acceso</h3>
						<p class="vs-modal-subtitle">Recuperación de credenciales y soporte</p>
					</div>
					<button
						type="button"
						onclick={() => (helpModalOpen = false)}
						class="aero-icon-btn vs-modal-close"
						aria-label="Cerrar ventana"
						style="flex: 0 0 30px; min-width: 30px; min-height: 30px;"
					>
						<span class="material-icons-round" style="font-size: 16px;">close</span>
					</button>
				</div>

				<div class="vs-modal-body">
					<div class="vs-help-step">
						<div class="vs-help-step-number">1</div>
						<div class="vs-help-step-content">
							<strong>Verifica tu usuario o email</strong>
							<p>Asegúrate de no incluir espacios antes o después de tus datos.</p>
						</div>
					</div>

					<div class="vs-help-step">
						<div class="vs-help-step-number">2</div>
						<div class="vs-help-step-content">
							<strong>Restablecimiento de contraseña</strong>
							<p>Por seguridad y cifrado, puedes solicitar asistencia al equipo administrativo.</p>
						</div>
					</div>

					<div class="vs-help-step">
						<div class="vs-help-step-number">3</div>
						<div class="vs-help-step-content">
							<strong>Cuentas en periodo de gracia</strong>
							<p>
								Si diste de baja tu cuenta en los últimos 30 días, entrar aquí la reactivará
								automáticamente.
							</p>
						</div>
					</div>
				</div>

				<div class="vs-modal-footer">
					<button
						type="button"
						onclick={() => (helpModalOpen = false)}
						class="btn-aero-primary vs-modal-action-btn"
					>
						<span>Entendido</span>
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* ══════════════════════════════════════════════════════════════════════
	   💎 V-SOCIAL LOGIN STATION — SURGICAL COMPACT PROPORTIONS
	   ══════════════════════════════════════════════════════════════════════ */

	.vs-login-page {
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
	.vs-login-header {
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

	.vs-login-nav-pill {
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

	.vs-login-nav-pill:hover {
		transform: translateY(-1px);
		background: var(--bg-surface-hover);
		border-color: rgba(var(--accent-blue-rgb), 0.4);
		box-shadow:
			var(--shadow-sm),
			0 0 10px rgba(var(--accent-blue-rgb), 0.25);
		color: var(--accent-blue-base);
	}

	.vs-login-nav-pill-text {
		letter-spacing: 0.02em;
	}

	.vs-login-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* ── Ambient Mesh Background ───────────────────────────────── */
	.vs-login-aurora-bg {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
		/* Foco primario + secundario + acento */
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
			/* Halo respirante suave al centro */
			radial-gradient(
					ellipse 70% 50% at 40% 60%,
					rgba(var(--accent-sky-rgb, 46, 180, 255), 0.07) 0%,
					transparent 65%
				);
	}

	/* Capa de respiro — opacity only (compositor-only, zero repaint) */
	.vs-login-aurora-bg::after {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 80% 60% at 25% 70%,
			rgba(var(--aero-mint-rgb, 0, 212, 170), 0.1) 0%,
			transparent 60%
		);
		animation: vsLoginBreathe 12s ease-in-out infinite alternate;
		will-change: opacity;
	}

	@keyframes vsLoginBreathe {
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
	.vs-login-stage {
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

	/* ── Right Login Station Panel ─────────────────────────────── */
	.vs-login-station {
		flex: 1 1 50%;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		max-width: 380px;
	}

	.vs-station-card-wrap {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
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

	/* Station Card */
	.vs-station-card {
		padding: 1.5rem 1.4rem;
		display: flex;
		flex-direction: column;
		gap: 1.05rem;
		box-shadow:
			var(--glass-shadow),
			0 12px 32px rgba(0, 0, 0, 0.15),
			var(--glass-inset-highlight);
	}

	@media (max-width: 640px) {
		.vs-station-card {
			padding: 1.25rem 1.15rem;
			gap: 0.95rem;
		}
	}

	.vs-card-header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
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
		font-size: 1.35rem;
		font-weight: 900;
		letter-spacing: -0.02em;
		color: var(--text-primary);
		margin: 0;
	}

	.vs-card-desc {
		font-size: 0.775rem;
		color: var(--text-muted);
		margin: 0;
	}

	.vs-card-register-link {
		color: var(--accent-blue-base);
		font-weight: 700;
		text-decoration: none;
		margin-left: 0.2rem;
		transition: color var(--t-fast);
	}

	.vs-card-register-link:hover {
		color: var(--accent-blue-light);
		text-decoration: underline;
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
	.vs-login-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.vs-form-group {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.vs-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.vs-form-label {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--text-secondary);
		letter-spacing: 0.01em;
	}

	.vs-form-required {
		color: var(--accent-blue-base);
	}

	.vs-forgot-link {
		background: none;
		border: none;
		padding: 0;
		font-family: var(--font-sans);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		text-decoration: none;
		transition: color var(--t-fast);
	}

	.vs-forgot-link:hover {
		color: var(--accent-blue-base);
		text-decoration: underline;
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

	.vs-input-wrapper:focus-within .vs-input-lead-icon {
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

	/* Options Row */
	.vs-form-options {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.05rem 0;
	}

	.vs-checkbox-label {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		user-select: none;
		font-size: 0.74rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.vs-custom-checkbox {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		accent-color: var(--accent-blue-base);
		cursor: pointer;
	}

	.vs-security-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--text-muted);
		padding: 0.15rem 0.4rem;
		border-radius: var(--radius-full);
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
	}

	.vs-security-chip .material-icons-round {
		color: var(--aero-mint, #00d4aa);
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

	/* Divider */
	.vs-card-divider {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin: 0.15rem 0;
	}

	.vs-divider-line {
		flex: 1;
		height: 1px;
		background: var(--border-subtle);
	}

	.vs-divider-label {
		font-size: 0.66rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	/* Secondary Actions */
	.vs-secondary-actions {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.vs-secondary-btn {
		width: 100%;
		min-height: 36px;
		font-size: 0.8rem;
		padding: 0.45rem 1rem;
	}

	/* Card Footer Legal */
	.vs-card-footer {
		text-align: center;
		padding-top: 0.4rem;
		border-top: 1px solid var(--border-subtle);
	}

	.vs-legal-text {
		font-size: 0.68rem;
		color: var(--text-muted);
		line-height: 1.4;
		margin: 0;
	}

	.vs-legal-link {
		color: var(--accent-blue-base);
		font-weight: 600;
		text-decoration: none;
	}

	.vs-legal-link:hover {
		text-decoration: underline;
	}

	/* ── Help / Password Recovery Modal ────────────────────────── */
	.vs-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		z-index: var(--z-modal-backdrop, 500);
	}

	.vs-modal-window {
		position: relative;
		width: 100%;
		max-width: 400px;
		padding: 1.35rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		z-index: var(--z-modal-content, 600);
		box-shadow:
			var(--glass-shadow),
			0 18px 36px rgba(0, 0, 0, 0.4),
			var(--glass-inset-highlight);
	}

	.vs-modal-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		position: relative;
	}

	.vs-modal-icon-badge {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-xs);
		background: rgba(var(--accent-blue-rgb), 0.15);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.3);
		color: var(--accent-blue-base);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.vs-modal-title {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}

	.vs-modal-subtitle {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin: 0;
	}

	.vs-modal-close {
		position: absolute;
		right: 0;
		top: 0;
	}

	.vs-modal-body {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.vs-help-step {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding: 0.55rem 0.75rem;
		border-radius: var(--radius-sm);
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
	}

	.vs-help-step-number {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent-blue-base);
		color: #ffffff;
		font-size: 0.68rem;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 18px;
		min-width: 18px;
		min-height: 18px;
		margin-top: 1px;
	}

	.vs-help-step-content {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.vs-help-step-content strong {
		color: var(--text-primary);
	}

	.vs-help-step-content p {
		margin: 0;
		line-height: 1.3;
		color: var(--text-muted);
	}

	.vs-modal-footer {
		display: flex;
		justify-content: flex-end;
		padding-top: 0.35rem;
	}

	.vs-modal-action-btn {
		min-width: 100px;
		min-height: 36px;
		font-size: 0.8rem;
		padding: 0.45rem 1rem;
	}
</style>
