<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';

	// --- Runes State ---
	let step = $state(1); // 1: Requirements, 2: Settings, 3: Admin, 4: Installing/Success
	let loadingRequirements = $state(true);
	let requirements = $state({
		node_version: '',
		node_ok: false,
		sqlite_ok: false,
		uploads_writable: false,
		db_writable: false
	});

	// Form values
	let siteName = $state('VSocial');
	let allowRegistration = $state(true);
	let adminUsername = $state('admin');
	let adminEmail = $state('admin@vsocial.app');
	let adminPassword = $state('');

	let installing = $state(false);
	let installError = $state('');
	let installSuccess = $state(false);

	let particles = $state([]);

	function generateParticles() {
		return Array.from({ length: 15 }, (_, i) => ({
			id: i,
			x: Math.random() * 100,
			y: Math.random() * 100,
			size: Math.random() * 15 + 5,
			duration: Math.random() * 8 + 4,
			delay: Math.random() * 3,
			opacity: Math.random() * 0.3 + 0.1
		}));
	}

	onMount(async () => {
		particles = generateParticles();
		await checkRequirements();
	});

	async function checkRequirements() {
		loadingRequirements = true;
		try {
			const res = await fetch('/api/install');
			const data = await res.json();
			if (data.installed) {
				// Already installed, redirect to home
				goto('/');
			}
			if (data.requirements) {
				requirements = data.requirements;
			}
		} catch (err) {
			console.error('Error checking requirements:', err);
		} finally {
			loadingRequirements = false;
		}
	}

	async function handleInstall(e) {
		if (e) e.preventDefault();
		installing = true;
		installError = '';

		try {
			const payload = {
				site_name: siteName,
				allow_registration: allowRegistration ? 1 : 0,
				admin_username: adminUsername.trim(),
				admin_email: adminEmail.trim(),
				admin_password: adminPassword
			};

			const res = await fetch('/api/install', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || 'Fallo en la instalación');
			}

			installSuccess = true;
			step = 4;
		} catch (err) {
			installError = err.message || 'Ocurrió un error inesperado durante la instalación.';
			step = 3; // Stay at step 3 to fix password/errors
		} finally {
			installing = false;
		}
	}

	const requirementsAllOk = $derived(
		requirements.node_ok &&
			requirements.sqlite_ok &&
			requirements.uploads_writable &&
			requirements.db_writable
	);
</script>

<svelte:head>
	<title>Instalación — VSocial</title>
</svelte:head>

<div class="install-wrapper">
	<!-- Theme Toggle -->
	<ThemeSelector compact={true} align="right" class="theme-toggle-wrap" />

	<!-- Bubbles background -->
	<div class="bubbles-container">
		{#each particles as p (p.id)}
			<div
				class="aero-bubble"
				style="
          left: {p.x}%;
          top: {p.y}%;
          width: {p.size}px;
          height: {p.size}px;
          opacity: {p.opacity};
          animation-duration: {p.duration}s;
          animation-delay: -{p.delay}s;
        "
			></div>
		{/each}
	</div>

	<div class="install-card glass-panel">
		<!-- Header -->
		<div class="install-header">
			<div class="install-logo">
				<span class="logo-text text-gradient">VSocial</span>
				<span class="logo-sub">Asistente de Instalación</span>
			</div>
			<div class="steps-indicator">
				<span class="step-dot" class:active={step >= 1} class:done={step > 1}>1</span>
				<span class="step-line" class:active={step > 1}></span>
				<span class="step-dot" class:active={step >= 2} class:done={step > 2}>2</span>
				<span class="step-line" class:active={step > 2}></span>
				<span class="step-dot" class:active={step >= 3} class:done={step > 3}>3</span>
			</div>
		</div>

		<!-- Error alert banner -->
		{#if installError}
			<div class="error-banner flex items-center gap-2 mt-4 p-3 rounded-xl">
				<span class="material-icons-round text-sm">error_outline</span>
				<span>{installError}</span>
			</div>
		{/if}

		<!-- STEP 1: REQUIREMENTS -->
		{#if step === 1}
			<div class="step-content">
				<h2>Requisitos del Servidor</h2>
				<p class="description">
					Verificando la compatibilidad de tu entorno para ejecutar VSocial.
				</p>

				{#if loadingRequirements}
					<div class="loading-state flex flex-col items-center gap-2 py-8">
						<span class="loading-spinner"></span>
						<span>Analizando servidor...</span>
					</div>
				{:else}
					<div class="requirements-list">
						<div class="req-item flex justify-between items-center">
							<span>Node.js >= 18 (Actual: {requirements.node_version})</span>
							<span class="material-icons-round icon-{requirements.node_ok ? 'ok' : 'fail'}">
								{requirements.node_ok ? 'check_circle' : 'cancel'}
							</span>
						</div>
						<div class="req-item flex justify-between items-center">
							<span>Motor SQLite / libSQL</span>
							<span class="material-icons-round icon-{requirements.sqlite_ok ? 'ok' : 'fail'}">
								{requirements.sqlite_ok ? 'check_circle' : 'cancel'}
							</span>
						</div>
						<div class="req-item flex justify-between items-center">
							<span>Directorio raíz escribible (DB)</span>
							<span class="material-icons-round icon-{requirements.db_writable ? 'ok' : 'fail'}">
								{requirements.db_writable ? 'check_circle' : 'cancel'}
							</span>
						</div>
						<div class="req-item flex justify-between items-center">
							<span>Permisos de escritura en directorio Uploads</span>
							<span
								class="material-icons-round icon-{requirements.uploads_writable ? 'ok' : 'fail'}"
							>
								{requirements.uploads_writable ? 'check_circle' : 'cancel'}
							</span>
						</div>
					</div>

					<div class="actions flex justify-between items-center mt-6">
						<button onclick={checkRequirements} class="btn-aero-secondary">
							<span class="material-icons-round">refresh</span> Recomprobar
						</button>
						<button
							onclick={() => {
								if (requirementsAllOk) step = 2;
							}}
							disabled={!requirementsAllOk}
							class="btn-aero-primary"
						>
							Continuar <span class="material-icons-round">navigate_next</span>
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- STEP 2: GENERAL SETTINGS -->
		{#if step === 2}
			<div class="step-content">
				<h2>Configuraciones del Sitio</h2>
				<p class="description">Establece los parámetros generales de tu nueva red social.</p>

				<div class="form-group">
					<label for="sitename">Nombre de la Plataforma</label>
					<input
						type="text"
						id="sitename"
						bind:value={siteName}
						class="aero-input w-full"
						placeholder="Ej: VSocial"
					/>
				</div>

				<div class="form-group flex items-center justify-between gap-4 mt-4">
					<div>
						<label for="allow_reg" style="margin: 0; font-weight: 700;"
							>Permitir Registro Abierto</label
						>
						<span class="text-xs text-muted block"
							>Permite que nuevos usuarios se registren de forma pública.</span
						>
					</div>
					<input
						type="checkbox"
						id="allow_reg"
						bind:checked={allowRegistration}
						class="aero-toggle-switch"
					/>
				</div>

				<div class="actions flex justify-between items-center mt-8">
					<button onclick={() => (step = 1)} class="btn-aero-secondary"> Atrás </button>
					<button onclick={() => (step = 3)} class="btn-aero-primary">
						Siguiente <span class="material-icons-round">navigate_next</span>
					</button>
				</div>
			</div>
		{/if}

		<!-- STEP 3: ADMIN ACCOUNT -->
		{#if step === 3}
			<form onsubmit={handleInstall} class="step-content">
				<h2>Cuenta del Administrador</h2>
				<p class="description">Crea la cuenta maestra para administrar la red social.</p>

				<div class="form-group">
					<label for="admin_user">Nombre de Usuario (Admin)</label>
					<input
						type="text"
						id="admin_user"
						bind:value={adminUsername}
						class="aero-input w-full"
						required
					/>
				</div>

				<div class="form-group mt-3">
					<label for="admin_email">Correo Electrónico</label>
					<input
						type="email"
						id="admin_email"
						bind:value={adminEmail}
						class="aero-input w-full"
						required
					/>
				</div>

				<div class="form-group mt-3">
					<label for="admin_pass">Contraseña</label>
					<input
						type="password"
						id="admin_pass"
						bind:value={adminPassword}
						class="aero-input w-full"
						required
						minlength="6"
						placeholder="Mínimo 6 caracteres"
					/>
				</div>

				<div class="actions flex justify-between items-center mt-8">
					<button
						type="button"
						onclick={() => (step = 2)}
						class="btn-aero-secondary"
						disabled={installing}
					>
						Atrás
					</button>
					<button type="submit" class="btn-aero-primary" disabled={installing}>
						{#if installing}
							<span class="loading-spinner" style="width: 16px; height: 16px;"></span> Instalando...
						{:else}
							Instalar VSocial <span class="material-icons-round font-bold">water_drop</span>
						{/if}
					</button>
				</div>
			</form>
		{/if}

		<!-- STEP 4: SUCCESS / FINISHED -->
		{#if step === 4 && installSuccess}
			<div class="step-content text-center py-6">
				<div class="success-icon flex items-center justify-center mx-auto mb-4 animate-float">
					<span class="material-icons-round text-white" style="font-size: 3.5rem;">verified</span>
				</div>
				<h2>¡Instalación Completada!</h2>
				<p class="description mt-2">
					VSocial se ha configurado e instalado correctamente con una base de datos local SQLite y
					contenido demo de VTubers.
				</p>

				<div class="admin-summary glass-panel p-4 mt-6 text-left">
					<p class="text-xs text-muted mb-2 uppercase font-bold">Detalles de Acceso:</p>
					<p class="text-sm"><strong>Usuario Admin:</strong> {adminUsername}</p>
					<p class="text-sm">
						<strong>Contraseña:</strong> <em>La que ingresaste en el formulario</em>
					</p>
					<p class="text-xs text-muted mt-3">
						Demo VTubers agregados para pruebas: <strong>sakura_nova</strong>,
						<strong>neon_drifter</strong>
						(Contraseña: <em>password123</em>)
					</p>
				</div>

				<div class="mt-8">
					<a href="/login" class="btn-aero-primary w-full text-center">
						<span class="material-icons-round">login</span> Iniciar Sesión en VSocial
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.install-wrapper {
		position: relative;
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--install-bg);
		overflow: hidden;
		padding: 2rem;
		transition: background 0.4s ease;
	}

	:global(.theme-toggle-wrap) {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 100;
	}

	.bubbles-container {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
		z-index: 1;
	}

	.aero-bubble {
		position: absolute;
		background: var(--bubble-bg);
		border-radius: 50%;
		box-shadow: var(--bubble-shadow);
		animation: rise infinite ease-in;
	}

	@keyframes rise {
		0% {
			transform: translateY(100vh) scale(0.5);
			opacity: 0;
		}
		50% {
			opacity: 1;
		}
		100% {
			transform: translateY(-20vh) scale(1.3);
			opacity: 0;
		}
	}

	.install-card {
		position: relative;
		z-index: 10;
		width: 100%;
		max-width: 500px;
		padding: 2rem;
		box-shadow: 0 12px 40px rgba(0, 119, 255, 0.15);
	}

	.install-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid var(--header-border);
		padding-bottom: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.install-logo {
		display: flex;
		flex-direction: column;
	}

	.logo-text {
		font-family: var(--font-display, 'Outfit', sans-serif);
		font-size: 1.8rem;
		font-weight: 900;
	}

	.logo-sub {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	.steps-indicator {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.step-dot {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--step-dot-bg);
		border: 1px solid var(--step-dot-border);
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.3s;
	}
	.step-dot.active {
		background: var(--color-aero-cyan);
		color: white;
		border-color: var(--color-aero-cyan);
		box-shadow: 0 0 10px rgba(0, 229, 255, 0.5);
	}
	.step-dot.done {
		background: var(--color-aero-blue);
		color: white;
		border-color: var(--color-aero-blue);
	}

	.step-line {
		width: 20px;
		height: 2px;
		background: var(--step-line-bg);
		transition: all 0.3s;
	}
	.step-line.active {
		background: var(--color-aero-cyan);
	}

	.step-content h2 {
		font-family: var(--font-display, 'Outfit', sans-serif);
		color: var(--text-main);
		font-size: 1.4rem;
		font-weight: 700;
	}

	.description {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin-bottom: 1.5rem;
	}

	.requirements-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.req-item {
		background: var(--req-bg);
		border: 1px solid var(--req-border);
		padding: 0.75rem 1rem;
		border-radius: 12px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-main);
	}

	.icon-ok {
		color: #00e676;
	}
	.icon-fail {
		color: #ff1744;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.form-group label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-main);
	}

	.success-icon {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: linear-gradient(135deg, #00e676, #00b0ff);
		box-shadow: 0 8px 25px rgba(0, 230, 118, 0.4);
	}

	.error-banner {
		background: rgba(255, 23, 68, 0.1);
		border: 1px solid rgba(255, 23, 68, 0.2);
		color: #d50000;
	}

	.loading-spinner {
		display: inline-block;
		width: 24px;
		height: 24px;
		border: 3px solid rgba(0, 119, 255, 0.1);
		border-radius: 50%;
		border-top-color: var(--color-aero-blue);
		animation: spin 1s ease-in-out infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Light theme */
	:global(:root) {
		--install-bg: linear-gradient(135deg, #b2ebf2 0%, #ffffff 50%, #e3f2fd 100%);
		--toggle-bg: rgba(255, 255, 255, 0.6);
		--toggle-border: rgba(255, 255, 255, 0.9);
		--bubble-bg: radial-gradient(
			circle at 30% 30%,
			rgba(255, 255, 255, 0.9),
			rgba(0, 229, 255, 0.25)
		);
		--bubble-shadow: inset -2px -2px 6px rgba(0, 119, 255, 0.15), 0 4px 8px rgba(0, 0, 0, 0.04);
		--header-border: rgba(255, 255, 255, 0.5);
		--step-dot-bg: rgba(255, 255, 255, 0.5);
		--step-dot-border: rgba(0, 119, 255, 0.2);
		--step-line-bg: rgba(0, 119, 255, 0.1);
		--req-bg: rgba(255, 255, 255, 0.4);
		--req-border: rgba(255, 255, 255, 0.6);
		--switch-bg: rgba(255, 255, 255, 0.8);
		--switch-border: rgba(0, 0, 0, 0.1);
	}
	/* Dark theme */
	:global([data-theme='dark']) {
		--install-bg: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
		--toggle-bg: rgba(30, 41, 59, 0.8);
		--toggle-border: rgba(255, 255, 255, 0.15);
		--bubble-bg: radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.3), rgba(30, 41, 59, 0.2));
		--bubble-shadow: inset -2px -2px 6px rgba(59, 130, 246, 0.1), 0 4px 8px rgba(0, 0, 0, 0.2);
		--header-border: rgba(255, 255, 255, 0.1);
		--step-dot-bg: rgba(30, 41, 59, 0.5);
		--step-dot-border: rgba(255, 255, 255, 0.15);
		--step-line-bg: rgba(255, 255, 255, 0.1);
		--req-bg: rgba(30, 41, 59, 0.5);
		--req-border: rgba(255, 255, 255, 0.1);
		--switch-bg: rgba(30, 41, 59, 0.6);
		--switch-border: rgba(255, 255, 255, 0.1);
	}
</style>
