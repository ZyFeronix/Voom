<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';
	import PasswordMeter from '$lib/components/PasswordMeter.svelte';
	import { themeStore, setTheme, THEME_OPTIONS } from '$lib/stores/theme.svelte.js';

	// --- Runes State ---
	let step = $state(1); // 1: Requirements, 2: Settings, 3: Admin, 4: Installing/Success
	let loadingRequirements = $state(true);
	let rechecking = $state(false);
	let requirements = $state({
		node_version: '',
		node_ok: false,
		sqlite_ok: false,
		uploads_writable: false,
		db_writable: false,
		db_driver: ''
	});

	// Step 2: Site Settings
	let siteName = $state('VSocial');
	let siteTagline = $state('Red Social para Creadores Virtuales');
	let allowRegistration = $state(true);
	let selectedTheme = $state('dark');

	// Step 3: Admin Credentials
	let adminUsername = $state('admin');
	let adminEmail = $state('admin@vsocial.app');
	let adminPassword = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);

	// Step 4: Installation Progress & Status
	let installing = $state(false);
	let installProgressText = $state('');
	let installError = $state('');
	let installSuccess = $state(false);
	let copiedField = $state('');

	// Ambient bokeh orbs
	let ambientOrbs = $state([]);

	function generateOrbs() {
		return Array.from({ length: 8 }, (_, i) => ({
			id: i,
			x: Math.random() * 90 + 5,
			y: Math.random() * 85 + 5,
			size: Math.random() * 120 + 60,
			duration: Math.random() * 12 + 10,
			delay: Math.random() * 4,
			opacity: Math.random() * 0.15 + 0.05
		}));
	}

	onMount(async () => {
		ambientOrbs = generateOrbs();
		selectedTheme = themeStore.value || 'dark';
		await checkRequirements();
	});

	async function checkRequirements() {
		loadingRequirements = true;
		rechecking = true;
		try {
			const res = await fetch('/api/install');
			const data = await res.json();
			if (data.installed) {
				goto('/');
				return;
			}
			if (data.requirements) {
				requirements = data.requirements;
			}
		} catch (err) {
			console.error('Error comprobando requisitos:', err);
		} finally {
			loadingRequirements = false;
			setTimeout(() => {
				rechecking = false;
			}, 350);
		}
	}

	function handleThemeSelect(themeId) {
		selectedTheme = themeId;
		setTheme(themeId);
	}

	const requirementsAllOk = $derived(
		requirements.node_ok &&
			requirements.sqlite_ok &&
			requirements.uploads_writable &&
			requirements.db_writable
	);

	const adminUserValid = $derived(/^[a-zA-Z0-9_]{3,32}$/.test(adminUsername.trim()));
	const adminEmailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim()));
	const adminPassValid = $derived(adminPassword.length >= 8);
	const passwordsMatch = $derived(adminPassword === confirmPassword && adminPassword.length > 0);

	const step2Valid = $derived(siteName.trim().length >= 2);
	const step3Valid = $derived(
		adminUserValid && adminEmailValid && adminPassValid && passwordsMatch
	);

	async function copyToClipboard(text, field) {
		try {
			await navigator.clipboard.writeText(text);
			copiedField = field;
			setTimeout(() => {
				if (copiedField === field) copiedField = '';
			}, 2000);
		} catch {
			// Fallback
		}
	}

	async function handleInstall(e) {
		if (e) e.preventDefault();
		if (!step3Valid || installing) return;

		installing = true;
		installError = '';
		step = 4;

		const milestones = [
			'Inicializando motor SQLite con WAL activado...',
			'Creando tablas y esquemas relacionales...',
			'Configurando cuenta Super Admin y permisos...',
			'Estableciendo parámetros de la plataforma...',
			'Generando llaves criptográficas y sesiones...',
			'¡Finalizando instalación!'
		];

		let milestoneIdx = 0;
		installProgressText = milestones[0];
		const progressInterval = setInterval(() => {
			milestoneIdx++;
			if (milestoneIdx < milestones.length) {
				installProgressText = milestones[milestoneIdx];
			}
		}, 400);

		try {
			const payload = {
				site_name: siteName.trim(),
				site_description: siteTagline.trim(),
				allow_registration: allowRegistration ? 1 : 0,
				theme: selectedTheme,
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
			clearInterval(progressInterval);

			if (!res.ok) {
				throw new Error(data.error || 'Fallo durante el proceso de instalación');
			}

			installSuccess = true;
		} catch (err) {
			clearInterval(progressInterval);
			installError = err.message || 'Ocurrió un error inesperado durante la instalación.';
			step = 3;
		} finally {
			installing = false;
		}
	}
</script>

<svelte:head>
	<title>Asistente de Instalación — VSocial</title>
</svelte:head>

<div class="install-container">
	<!-- Theme Switcher Top-Right with Squircle Trigger -->
	<div class="theme-bar">
		<ThemeSelector compact={true} align="right" class="install-theme-selector" />
	</div>

	<!-- Ambient Bokeh Orbs -->
	<div class="ambient-layer" aria-hidden="true">
		{#each ambientOrbs as orb (orb.id)}
			<div
				class="aero-orb"
				style="
					left: {orb.x}%;
					top: {orb.y}%;
					width: {orb.size}px;
					height: {orb.size}px;
					opacity: {orb.opacity};
					animation-duration: {orb.duration}s;
					animation-delay: -{orb.delay}s;
				"
			></div>
		{/each}
	</div>

	<!-- Main Glass Card -->
	<main class="install-card glass-panel">
		<!-- Header -->
		<header class="install-header">
			<div class="brand-row">
				<div class="logo-badge squircle" style="flex: 0 0 44px; min-width: 44px; min-height: 44px;">
					<span class="material-icons-round logo-icon">water_drop</span>
				</div>
				<div class="brand-info">
					<h1 class="logo-title">
						<span class="brand-highlight">VS</span>ocial
					</h1>
					<p class="logo-subtitle">Asistente de Instalación</p>
				</div>
			</div>

			<!-- Sleek Squircle Steps Bar -->
			<nav class="stepper-nav" aria-label="Progreso de instalación">
				{#each [1, 2, 3, 4] as s}
					<div
						class="step-item"
						class:is-active={step === s}
						class:is-done={step > s}
						class:is-pending={step < s}
					>
						<div
							class="step-squircle squircle"
							style="flex: 0 0 32px; min-width: 32px; min-height: 32px;"
						>
							{#if step > s}
								<span class="material-icons-round step-check-icon">check</span>
							{:else}
								<span class="step-num">{s}</span>
							{/if}
						</div>
						{#if s < 4}
							<div class="step-connector" class:is-filled={step > s}></div>
						{/if}
					</div>
				{/each}
			</nav>
		</header>

		<!-- Error Alert Banner -->
		{#if installError}
			<div class="error-banner squircle" role="alert">
				<div
					class="error-icon-box squircle"
					style="flex: 0 0 28px; min-width: 28px; min-height: 28px;"
				>
					<span class="material-icons-round">warning</span>
				</div>
				<div class="error-text">
					<span class="error-title">Error de instalación</span>
					<p class="error-desc">{installError}</p>
				</div>
			</div>
		{/if}

		<!-- STEP 1: REQUISITOS DEL SERVIDOR -->
		{#if step === 1}
			<section class="step-section">
				<div class="section-heading">
					<span class="step-pill squircle">Paso 1 de 4</span>
					<h2 class="section-title">Requisitos del Entorno</h2>
					<p class="section-desc">
						Verificando compatibilidad de Node.js, motor SQLite/libSQL y permisos de disco.
					</p>
				</div>

				{#if loadingRequirements}
					<div class="loading-box squircle">
						<div
							class="squircle-spinner"
							style="flex: 0 0 36px; min-width: 36px; min-height: 36px;"
						></div>
						<span class="loading-label">Analizando entorno del servidor...</span>
					</div>
				{:else}
					<div class="req-grid">
						<!-- Node.js -->
						<div
							class="req-card squircle"
							class:req-ok={requirements.node_ok}
							class:req-err={!requirements.node_ok}
						>
							<div
								class="req-icon-box squircle"
								style="flex: 0 0 38px; min-width: 38px; min-height: 38px;"
							>
								<span class="material-icons-round">terminal</span>
							</div>
							<div class="req-details">
								<span class="req-title">Node.js Runtime</span>
								<span class="req-meta">
									{requirements.node_ok
										? `Versión ${requirements.node_version} (Compatible >= 18)`
										: `Versión ${requirements.node_version} (Requiere >= 18)`}
								</span>
							</div>
							<div class="req-badge squircle">
								<span class="material-icons-round badge-icon">
									{requirements.node_ok ? 'check_circle' : 'cancel'}
								</span>
								<span class="badge-text">{requirements.node_ok ? 'OK' : 'Fallo'}</span>
							</div>
						</div>

						<!-- SQLite / libSQL -->
						<div
							class="req-card squircle"
							class:req-ok={requirements.sqlite_ok}
							class:req-err={!requirements.sqlite_ok}
						>
							<div
								class="req-icon-box squircle"
								style="flex: 0 0 38px; min-width: 38px; min-height: 38px;"
							>
								<span class="material-icons-round">storage</span>
							</div>
							<div class="req-details">
								<span class="req-title">Motor SQLite</span>
								<span class="req-meta">
									{requirements.sqlite_ok
										? `Driver ${requirements.db_driver || '@libsql/client'} activo (WAL)`
										: 'No se detectó ningún driver SQLite'}
								</span>
							</div>
							<div class="req-badge squircle">
								<span class="material-icons-round badge-icon">
									{requirements.sqlite_ok ? 'check_circle' : 'cancel'}
								</span>
								<span class="badge-text">{requirements.sqlite_ok ? 'OK' : 'Fallo'}</span>
							</div>
						</div>

						<!-- Directorio Raíz / DB Writable -->
						<div
							class="req-card squircle"
							class:req-ok={requirements.db_writable}
							class:req-err={!requirements.db_writable}
						>
							<div
								class="req-icon-box squircle"
								style="flex: 0 0 38px; min-width: 38px; min-height: 38px;"
							>
								<span class="material-icons-round">drive_file_rename_outline</span>
							</div>
							<div class="req-details">
								<span class="req-title">Escritura de Base de Datos</span>
								<span class="req-meta">
									{requirements.db_writable
										? 'Directorio de datos con permisos concedidos'
										: 'Sin permisos de escritura para database.sqlite'}
								</span>
							</div>
							<div class="req-badge squircle">
								<span class="material-icons-round badge-icon">
									{requirements.db_writable ? 'check_circle' : 'cancel'}
								</span>
								<span class="badge-text">{requirements.db_writable ? 'OK' : 'Fallo'}</span>
							</div>
						</div>

						<!-- Uploads Folder -->
						<div
							class="req-card squircle"
							class:req-ok={requirements.uploads_writable}
							class:req-err={!requirements.uploads_writable}
						>
							<div
								class="req-icon-box squircle"
								style="flex: 0 0 38px; min-width: 38px; min-height: 38px;"
							>
								<span class="material-icons-round">folder_special</span>
							</div>
							<div class="req-details">
								<span class="req-title">Directorio de Archivos (/uploads)</span>
								<span class="req-meta">
									{requirements.uploads_writable
										? 'Directorio multimedia preparado para subidas'
										: 'Directorio /uploads no accesible para escritura'}
								</span>
							</div>
							<div class="req-badge squircle">
								<span class="material-icons-round badge-icon">
									{requirements.uploads_writable ? 'check_circle' : 'cancel'}
								</span>
								<span class="badge-text">{requirements.uploads_writable ? 'OK' : 'Fallo'}</span>
							</div>
						</div>
					</div>

					<div class="actions-row">
						<button
							type="button"
							onclick={checkRequirements}
							class="btn-aero-secondary squircle"
							disabled={rechecking}
							style="flex: 0 0 auto; min-width: 140px; min-height: 44px;"
						>
							<span class="material-icons-round action-icon" class:spin-icon={rechecking}
								>refresh</span
							>
							<span>Recomprobar</span>
						</button>

						<button
							type="button"
							onclick={() => {
								if (requirementsAllOk) step = 2;
							}}
							disabled={!requirementsAllOk}
							class="btn-aero-primary squircle"
							style="flex: 0 0 auto; min-width: 150px; min-height: 44px;"
						>
							<span>Continuar</span>
							<span class="material-icons-round action-icon">arrow_forward</span>
						</button>
					</div>
				{/if}
			</section>
		{/if}

		<!-- STEP 2: CONFIGURACIÓN DE LA PLATAFORMA -->
		{#if step === 2}
			<section class="step-section">
				<div class="section-heading">
					<span class="step-pill squircle">Paso 2 de 4</span>
					<h2 class="section-title">Configuración del Sitio</h2>
					<p class="section-desc">Establece el nombre, temática e identidad de tu plataforma.</p>
				</div>

				<div class="form-stack">
					<!-- Site Name -->
					<div class="field-group">
						<label for="sitename" class="field-label">
							<span class="material-icons-round field-icon">badge</span>
							<span>Nombre de la Plataforma</span>
						</label>
						<div class="input-wrapper squircle">
							<input
								type="text"
								id="sitename"
								bind:value={siteName}
								class="aero-input w-full"
								placeholder="Ej: VSocial"
								required
							/>
						</div>
					</div>

					<!-- Site Tagline -->
					<div class="field-group">
						<label for="sitetagline" class="field-label">
							<span class="material-icons-round field-icon">subtitles</span>
							<span>Eslogan o Descripción</span>
						</label>
						<div class="input-wrapper squircle">
							<input
								type="text"
								id="sitetagline"
								bind:value={siteTagline}
								class="aero-input w-full"
								placeholder="Ej: Red Social para Creadores Virtuales"
							/>
						</div>
					</div>

					<!-- Registration Switch (Squircle Toggle) -->
					<div class="toggle-card squircle">
						<div class="toggle-info">
							<span class="toggle-title">Permitir Registro Abierto</span>
							<span class="toggle-desc">
								Permite que cualquier persona cree su cuenta de forma libre y pública.
							</span>
						</div>
						<label class="squircle-switch" for="allow_reg">
							<input
								type="checkbox"
								id="allow_reg"
								bind:checked={allowRegistration}
								class="squircle-switch-input"
							/>
							<span class="squircle-switch-slider squircle"></span>
						</label>
					</div>

					<!-- Initial Theme Picker -->
					<div class="field-group">
						<span class="field-label">
							<span class="material-icons-round field-icon">palette</span>
							<span>Tema Visual Inicial</span>
						</span>
						<div class="theme-options-grid">
							{#each THEME_OPTIONS as opt (opt.id)}
								<button
									type="button"
									class="theme-card-squircle squircle"
									class:is-active={selectedTheme === opt.id}
									onclick={() => handleThemeSelect(opt.id)}
								>
									<div
										class="theme-icon-box squircle {opt.id}"
										style="flex: 0 0 32px; min-width: 32px; min-height: 32px;"
									>
										<span class="material-icons-round">{opt.icon}</span>
									</div>
									<div class="theme-card-text">
										<span class="theme-name">{opt.name}</span>
										<span class="theme-desc">{opt.desc}</span>
									</div>
									{#if selectedTheme === opt.id}
										<span class="material-icons-round active-check">check_circle</span>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<div class="actions-row">
					<button
						type="button"
						onclick={() => (step = 1)}
						class="btn-aero-secondary squircle"
						style="flex: 0 0 auto; min-width: 120px; min-height: 44px;"
					>
						<span class="material-icons-round action-icon">arrow_back</span>
						<span>Atrás</span>
					</button>

					<button
						type="button"
						onclick={() => {
							if (step2Valid) step = 3;
						}}
						disabled={!step2Valid}
						class="btn-aero-primary squircle"
						style="flex: 0 0 auto; min-width: 150px; min-height: 44px;"
					>
						<span>Siguiente</span>
						<span class="material-icons-round action-icon">arrow_forward</span>
					</button>
				</div>
			</section>
		{/if}

		<!-- STEP 3: CUENTA SUPER ADMINISTRADOR -->
		{#if step === 3}
			<form onsubmit={handleInstall} class="step-section">
				<div class="section-heading">
					<span class="step-pill squircle">Paso 3 de 4</span>
					<h2 class="section-title">Cuenta del Super Administrador</h2>
					<p class="section-desc">
						Crea las credenciales maestras para el control de la plataforma.
					</p>
				</div>

				<div class="form-stack">
					<!-- Admin Username -->
					<div class="field-group">
						<label for="admin_user" class="field-label">
							<span class="material-icons-round field-icon">person</span>
							<span>Nombre de Usuario</span>
						</label>
						<div class="input-wrapper squircle">
							<input
								type="text"
								id="admin_user"
								bind:value={adminUsername}
								class="aero-input w-full"
								placeholder="admin"
								required
								autocomplete="username"
							/>
						</div>
						{#if adminUsername.length > 0 && !adminUserValid}
							<span class="field-hint text-error"
								>Solo letras, números y guiones bajos (3-32 caracteres).</span
							>
						{/if}
					</div>

					<!-- Admin Email -->
					<div class="field-group">
						<label for="admin_email" class="field-label">
							<span class="material-icons-round field-icon">alternate_email</span>
							<span>Correo Electrónico</span>
						</label>
						<div class="input-wrapper squircle">
							<input
								type="email"
								id="admin_email"
								bind:value={adminEmail}
								class="aero-input w-full"
								placeholder="admin@vsocial.app"
								required
								autocomplete="email"
							/>
						</div>
						{#if adminEmail.length > 0 && !adminEmailValid}
							<span class="field-hint text-error">Ingresa un correo electrónico válido.</span>
						{/if}
					</div>

					<!-- Admin Password -->
					<div class="field-group">
						<label for="admin_pass" class="field-label">
							<span class="material-icons-round field-icon">lock</span>
							<span>Contraseña Maestra</span>
						</label>
						<div class="input-wrapper input-with-toggle squircle">
							<input
								type={showPassword ? 'text' : 'password'}
								id="admin_pass"
								bind:value={adminPassword}
								class="aero-input w-full"
								placeholder="Mínimo 8 caracteres"
								required
								minlength="8"
								autocomplete="new-password"
							/>
							<button
								type="button"
								class="toggle-eye-btn squircle"
								onclick={() => (showPassword = !showPassword)}
								title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
								style="flex: 0 0 32px; min-width: 32px; min-height: 32px;"
							>
								<span class="material-icons-round"
									>{showPassword ? 'visibility_off' : 'visibility'}</span
								>
							</button>
						</div>
						<div class="password-meter-wrap">
							<PasswordMeter password={adminPassword} label="Seguridad de Contraseña" />
						</div>
					</div>

					<!-- Confirm Password -->
					<div class="field-group">
						<label for="confirm_pass" class="field-label">
							<span class="material-icons-round field-icon">verified_user</span>
							<span>Confirmar Contraseña</span>
						</label>
						<div class="input-wrapper input-with-toggle squircle">
							<input
								type={showConfirmPassword ? 'text' : 'password'}
								id="confirm_pass"
								bind:value={confirmPassword}
								class="aero-input w-full"
								placeholder="Repite la contraseña maestra"
								required
								minlength="8"
								autocomplete="new-password"
							/>
							<button
								type="button"
								class="toggle-eye-btn squircle"
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
								title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
								style="flex: 0 0 32px; min-width: 32px; min-height: 32px;"
							>
								<span class="material-icons-round"
									>{showConfirmPassword ? 'visibility_off' : 'visibility'}</span
								>
							</button>
						</div>
						{#if confirmPassword.length > 0 && !passwordsMatch}
							<span class="field-hint text-error">Las contraseñas no coinciden.</span>
						{:else if passwordsMatch}
							<span class="field-hint text-success">✓ Las contraseñas coinciden correctamente.</span
							>
						{/if}
					</div>
				</div>

				<div class="actions-row">
					<button
						type="button"
						onclick={() => (step = 2)}
						class="btn-aero-secondary squircle"
						disabled={installing}
						style="flex: 0 0 auto; min-width: 120px; min-height: 44px;"
					>
						<span class="material-icons-round action-icon">arrow_back</span>
						<span>Atrás</span>
					</button>

					<button
						type="submit"
						class="btn-aero-primary squircle"
						disabled={!step3Valid || installing}
						style="flex: 0 0 auto; min-width: 180px; min-height: 44px;"
					>
						<span>Instalar VSocial</span>
						<span class="material-icons-round action-icon">rocket_launch</span>
					</button>
				</div>
			</form>
		{/if}

		<!-- STEP 4: PROCESO / FINALIZACIÓN -->
		{#if step === 4}
			<section class="step-section text-center">
				{#if installing}
					<div class="installing-box">
						<div
							class="squircle-radar squircle"
							style="flex: 0 0 80px; min-width: 80px; min-height: 80px;"
						>
							<span class="material-icons-round radar-icon">settings</span>
						</div>
						<h2 class="installing-title">Instalando VSocial</h2>
						<p class="installing-progress">{installProgressText}</p>
						<div class="progress-track squircle">
							<div class="progress-bar-glow"></div>
						</div>
					</div>
				{:else if installSuccess}
					<div class="success-box">
						<div
							class="success-badge-squircle squircle"
							style="flex: 0 0 76px; min-width: 76px; min-height: 76px;"
						>
							<span class="material-icons-round success-check">check</span>
						</div>

						<h2 class="section-title text-success">¡Instalación Completada!</h2>
						<p class="section-desc">
							VSocial se ha configurado e instalado con éxito. Base de datos SQLite y WAL activos.
						</p>

						<!-- Access Summary Card -->
						<div class="summary-card squircle">
							<div class="summary-header">
								<span class="material-icons-round">admin_panel_settings</span>
								<span>Credenciales del Super Administrador</span>
							</div>

							<div class="summary-item">
								<div class="summary-label">Usuario Admin:</div>
								<div class="summary-value-row">
									<code>{adminUsername}</code>
									<button
										type="button"
										class="copy-btn squircle"
										onclick={() => copyToClipboard(adminUsername, 'user')}
										title="Copiar usuario"
										style="flex: 0 0 28px; min-width: 28px; min-height: 28px;"
									>
										<span class="material-icons-round copy-icon">
											{copiedField === 'user' ? 'done' : 'content_copy'}
										</span>
									</button>
								</div>
							</div>

							<div class="summary-item">
								<div class="summary-label">Correo:</div>
								<div class="summary-value-row">
									<code>{adminEmail}</code>
									<button
										type="button"
										class="copy-btn squircle"
										onclick={() => copyToClipboard(adminEmail, 'email')}
										title="Copiar correo"
										style="flex: 0 0 28px; min-width: 28px; min-height: 28px;"
									>
										<span class="material-icons-round copy-icon">
											{copiedField === 'email' ? 'done' : 'content_copy'}
										</span>
									</button>
								</div>
							</div>

							<div class="demo-box squircle">
								<div class="demo-title">
									<span class="material-icons-round">smart_toy</span>
									<span>Cuentas Demo de VTubers para Pruebas:</span>
								</div>
								<div class="demo-users">
									<span class="demo-chip squircle">@sakura_nova</span>
									<span class="demo-chip squircle">@neon_drifter</span>
								</div>
								<div class="demo-pass">
									Contraseña demo: <code>password123</code>
								</div>
							</div>
						</div>

						<div class="actions-row finish-action">
							<a
								href="/login"
								class="btn-aero-primary squircle w-full text-center"
								style="min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 8px;"
							>
								<span class="material-icons-round">login</span>
								<span>Iniciar Sesión en VSocial</span>
							</a>
						</div>
					</div>
				{/if}
			</section>
		{/if}
	</main>
</div>

<style>
	/* --- Contenedor Principal y Entorno Neo-Aero --- */
	.install-container {
		position: relative;
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
		overflow-x: hidden;
		isolation: isolate;
	}

	.theme-bar {
		position: fixed;
		top: 1.25rem;
		right: 1.25rem;
		z-index: var(--z-sticky, 200);
	}

	/* Ambient Bokeh Orbs */
	.ambient-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: -1;
	}

	.aero-orb {
		position: absolute;
		border-radius: 50%;
		background: radial-gradient(
			circle at 35% 35%,
			rgba(46, 180, 255, 0.45),
			rgba(27, 133, 243, 0.15) 60%,
			transparent 85%
		);
		filter: blur(28px);
		animation: orbFloat infinite ease-in-out alternate;
		will-change: transform;
	}

	@keyframes orbFloat {
		0% {
			transform: translate3d(0, 0, 0) scale(0.9);
		}
		50% {
			transform: translate3d(25px, -30px, 0) scale(1.15);
		}
		100% {
			transform: translate3d(-20px, 35px, 0) scale(1);
		}
	}

	/* --- Tarjeta Glassmorphism 2.0 / Squircles --- */
	.install-card {
		position: relative;
		z-index: 10;
		width: 100%;
		max-width: 580px;
		padding: 2.25rem;
		border-radius: var(--radius-xl, 28px);
		corner-shape: squircle;
		background: var(--bg-surface);
		border: 1px solid var(--glass-border);
		box-shadow:
			var(--glass-shadow),
			0 20px 50px rgba(0, 0, 0, 0.22);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		transition: all 0.3s var(--ease-out);
	}

	.install-card::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background-image: var(--noise-texture);
		opacity: 0.03;
		pointer-events: none;
	}

	.install-card::after {
		content: '';
		position: absolute;
		top: 0;
		left: 10%;
		right: 10%;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			var(--glass-border-t, rgba(255, 255, 255, 0.5)),
			transparent
		);
		pointer-events: none;
	}

	/* --- Header & Stepper --- */
	.install-header {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-subtle);
		margin-bottom: 1.75rem;
	}

	.brand-row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.logo-badge {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-squircle, 20%);
		corner-shape: squircle;
		background: linear-gradient(
			135deg,
			var(--accent-blue-base, #1b85f3),
			var(--accent-blue-light, #2eb4ff)
		);
		box-shadow: 0 4px 16px rgba(27, 133, 243, 0.35);
		display: grid;
		place-items: center;
		color: #ffffff;
	}

	.logo-icon {
		font-size: 24px;
	}

	.brand-info {
		display: flex;
		flex-direction: column;
	}

	.logo-title {
		font-family: var(--font-display, 'Outfit', sans-serif);
		font-size: 1.65rem;
		font-weight: 800;
		color: var(--text-primary);
		line-height: 1.15;
		margin: 0;
	}

	.brand-highlight {
		color: var(--accent-blue-base, #1b85f3);
	}

	.logo-subtitle {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 0;
	}

	/* Stepper Nav */
	.stepper-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding-top: 0.25rem;
	}

	.step-item {
		display: flex;
		align-items: center;
		flex: 1;
	}

	.step-item:last-child {
		flex: 0 0 auto;
	}

	.step-squircle {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-squircle, 20%);
		corner-shape: squircle;
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 700;
		display: grid;
		place-items: center;
		transition: all 0.3s var(--ease-spring);
	}

	.step-item.is-active .step-squircle {
		background: var(--accent-blue-base, #1b85f3);
		border-color: var(--accent-blue-light, #2eb4ff);
		color: #ffffff;
		box-shadow: 0 0 14px rgba(27, 133, 243, 0.45);
		transform: scale(1.08);
	}

	.step-item.is-done .step-squircle {
		background: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.18);
		border-color: var(--accent-blue-base, #1b85f3);
		color: var(--accent-blue-base, #1b85f3);
	}

	.step-check-icon {
		font-size: 18px;
	}

	.step-connector {
		flex: 1;
		height: 2px;
		background: var(--border-subtle);
		margin: 0 8px;
		transition: background 0.3s ease;
	}

	.step-connector.is-filled {
		background: var(--accent-blue-base, #1b85f3);
	}

	/* --- Heading de Secciones --- */
	.step-section {
		display: flex;
		flex-direction: column;
		animation: stepEnter 0.35s var(--ease-out) both;
	}

	@keyframes stepEnter {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.section-heading {
		margin-bottom: 1.5rem;
	}

	.step-pill {
		display: inline-block;
		padding: 3px 10px;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.12);
		border: 1px solid rgba(var(--accent-blue-rgb, 27, 133, 243), 0.25);
		color: var(--accent-blue-base, #1b85f3);
		border-radius: var(--radius-xs, 6px);
		corner-shape: squircle;
		margin-bottom: 0.5rem;
	}

	.section-title {
		font-family: var(--font-display, 'Outfit', sans-serif);
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 0.35rem 0;
	}

	.section-desc {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.45;
	}

	/* --- Error Alert Banner --- */
	.error-banner {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		background: rgba(255, 23, 68, 0.1);
		border: 1px solid rgba(255, 23, 68, 0.3);
		border-radius: var(--radius-md, 14px);
		corner-shape: squircle;
		color: #ff1744;
		margin-bottom: 1.25rem;
	}

	.error-icon-box {
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		background: rgba(255, 23, 68, 0.2);
		border-radius: var(--radius-xs, 6px);
		corner-shape: squircle;
		color: #ff1744;
	}

	.error-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.error-title {
		font-size: 0.85rem;
		font-weight: 700;
	}

	.error-desc {
		font-size: 0.78rem;
		color: var(--text-primary);
		margin: 0;
	}

	/* --- Loading Box --- */
	.loading-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2.5rem 1.5rem;
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md, 14px);
		corner-shape: squircle;
	}

	.squircle-spinner {
		width: 36px;
		height: 36px;
		border: 3px solid rgba(var(--accent-blue-rgb, 27, 133, 243), 0.15);
		border-top-color: var(--accent-blue-base, #1b85f3);
		border-radius: 50%;
		animation: spinRing 0.8s linear infinite;
	}

	@keyframes spinRing {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	/* --- Requisitos Grid (Paso 1) --- */
	.req-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.req-card {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md, 14px);
		corner-shape: squircle;
		transition: all 0.2s var(--ease-out);
	}

	.req-card.req-ok {
		border-color: rgba(0, 212, 170, 0.25);
	}

	.req-card.req-err {
		border-color: rgba(255, 23, 68, 0.35);
		background: rgba(255, 23, 68, 0.04);
	}

	.req-icon-box {
		width: 38px;
		height: 38px;
		border-radius: var(--radius-sm, 10px);
		corner-shape: squircle;
		background: var(--bg-surface-hover);
		border: 1px solid var(--border-subtle);
		display: grid;
		place-items: center;
		color: var(--text-primary);
	}

	.req-card.req-ok .req-icon-box {
		color: #00d4aa;
		background: rgba(0, 212, 170, 0.12);
		border-color: rgba(0, 212, 170, 0.2);
	}

	.req-card.req-err .req-icon-box {
		color: #ff1744;
		background: rgba(255, 23, 68, 0.12);
		border-color: rgba(255, 23, 68, 0.2);
	}

	.req-details {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.req-title {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.req-meta {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 1px;
	}

	.req-badge {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border-radius: var(--radius-xs, 6px);
		corner-shape: squircle;
		font-size: 0.72rem;
		font-weight: 700;
		flex: 0 0 auto;
	}

	.req-card.req-ok .req-badge {
		background: rgba(0, 212, 170, 0.15);
		color: #00d4aa;
		border: 1px solid rgba(0, 212, 170, 0.3);
	}

	.req-card.req-err .req-badge {
		background: rgba(255, 23, 68, 0.15);
		color: #ff1744;
		border: 1px solid rgba(255, 23, 68, 0.3);
	}

	.badge-icon {
		font-size: 14px;
	}

	/* --- Form Stack (Pasos 2 y 3) --- */
	.form-stack {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		margin-bottom: 1.5rem;
	}

	.field-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.field-icon {
		font-size: 16px;
		color: var(--accent-blue-base, #1b85f3);
	}

	.input-wrapper {
		position: relative;
		border-radius: var(--radius-md, 14px);
		corner-shape: squircle;
	}

	.input-with-toggle {
		display: flex;
		align-items: center;
	}

	.input-with-toggle .aero-input {
		padding-right: 42px;
	}

	.toggle-eye-btn {
		position: absolute;
		right: 6px;
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		background: transparent;
		border: none;
		color: var(--text-muted);
		border-radius: var(--radius-xs, 6px);
		corner-shape: squircle;
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
	}

	.toggle-eye-btn:hover {
		color: var(--text-primary);
		background: var(--bg-surface-hover);
	}

	.field-hint {
		font-size: 0.72rem;
		font-weight: 600;
		margin-top: 2px;
	}

	.text-error {
		color: #ff1744;
	}

	.text-success {
		color: #00d4aa;
	}

	.password-meter-wrap {
		margin-top: 4px;
	}

	/* Toggle Card (Squircle Switch) */
	.toggle-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 1.1rem;
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md, 14px);
		corner-shape: squircle;
	}

	.toggle-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.toggle-title {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.toggle-desc {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	/* Squircle Switch */
	.squircle-switch {
		position: relative;
		display: inline-block;
		width: 48px;
		height: 26px;
		flex: 0 0 48px;
		cursor: pointer;
	}

	.squircle-switch-input {
		opacity: 0;
		width: 0;
		height: 0;
		position: absolute;
	}

	.squircle-switch-slider {
		position: absolute;
		inset: 0;
		background: var(--bg-surface-hover);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm, 10px);
		corner-shape: squircle;
		transition: all 0.3s var(--ease-spring);
	}

	.squircle-switch-slider::before {
		content: '';
		position: absolute;
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background: #ffffff;
		border-radius: var(--radius-xs, 6px);
		corner-shape: squircle;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
		transition: transform 0.3s var(--ease-spring);
	}

	.squircle-switch-input:checked + .squircle-switch-slider {
		background: var(--accent-blue-base, #1b85f3);
		border-color: var(--accent-blue-light, #2eb4ff);
		box-shadow: 0 0 10px rgba(27, 133, 243, 0.4);
	}

	.squircle-switch-input:checked + .squircle-switch-slider::before {
		transform: translateX(22px);
	}

	/* Theme Cards Grid */
	.theme-options-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.65rem;
	}

	.theme-card-squircle {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		padding: 0.75rem;
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md, 14px);
		corner-shape: squircle;
		cursor: pointer;
		position: relative;
		text-align: left;
		transition: all 0.25s var(--ease-spring);
	}

	.theme-card-squircle:hover {
		background: var(--bg-surface-hover);
		border-color: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.3);
		transform: translateY(-2px);
	}

	.theme-card-squircle.is-active {
		background: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.12);
		border-color: var(--accent-blue-base, #1b85f3);
		box-shadow: 0 4px 14px rgba(27, 133, 243, 0.2);
	}

	.theme-icon-box {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border-radius: var(--radius-sm, 10px);
		corner-shape: squircle;
		background: var(--bg-surface-hover);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
	}

	.theme-icon-box.dark {
		color: #1b85f3;
		background: rgba(27, 133, 243, 0.15);
	}

	.theme-icon-box.light {
		color: #f59e0b;
		background: rgba(245, 158, 11, 0.15);
	}

	.theme-icon-box.midnight {
		color: #22d3ee;
		background: rgba(34, 211, 238, 0.15);
	}

	.theme-card-text {
		display: flex;
		flex-direction: column;
	}

	.theme-name {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.theme-desc {
		font-size: 0.68rem;
		color: var(--text-muted);
		line-height: 1.2;
	}

	.active-check {
		position: absolute;
		top: 6px;
		right: 6px;
		font-size: 16px;
		color: var(--accent-blue-base, #1b85f3);
	}

	/* --- Actions Row --- */
	.actions-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.action-icon {
		font-size: 18px;
	}

	.spin-icon {
		animation: spinRing 0.8s linear infinite;
	}

	/* --- Paso 4: Instalando & Completado --- */
	.installing-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2.5rem 1rem;
		gap: 1rem;
	}

	.squircle-radar {
		width: 80px;
		height: 80px;
		border-radius: var(--radius-lg, 20px);
		corner-shape: squircle;
		background: linear-gradient(135deg, rgba(27, 133, 243, 0.2), rgba(0, 212, 170, 0.2));
		border: 1px solid rgba(27, 133, 243, 0.35);
		box-shadow: 0 0 24px rgba(27, 133, 243, 0.25);
		display: grid;
		place-items: center;
		animation: radarPulse 1.8s ease-in-out infinite alternate;
	}

	@keyframes radarPulse {
		0% {
			transform: scale(0.95);
			box-shadow: 0 0 16px rgba(27, 133, 243, 0.2);
		}
		100% {
			transform: scale(1.05);
			box-shadow: 0 0 32px rgba(0, 212, 170, 0.4);
		}
	}

	.radar-icon {
		font-size: 40px;
		color: var(--accent-blue-base, #1b85f3);
		animation: spinRing 4s linear infinite;
	}

	.installing-title {
		font-family: var(--font-display, 'Outfit', sans-serif);
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.installing-progress {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin: 0;
		min-height: 1.2rem;
	}

	.progress-track {
		width: 100%;
		max-width: 320px;
		height: 6px;
		background: var(--border-subtle);
		border-radius: var(--radius-xs, 6px);
		corner-shape: squircle;
		overflow: hidden;
		position: relative;
	}

	.progress-bar-glow {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 40%;
		background: linear-gradient(90deg, var(--accent-blue-base, #1b85f3), var(--aero-mint, #00d4aa));
		box-shadow: 0 0 12px rgba(0, 212, 170, 0.5);
		border-radius: inherit;
		animation: progressSweep 1.4s ease-in-out infinite alternate;
	}

	@keyframes progressSweep {
		0% {
			left: 0%;
		}
		100% {
			left: 60%;
		}
	}

	/* Success Box */
	.success-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 1rem 0;
	}

	.success-badge-squircle {
		width: 76px;
		height: 76px;
		border-radius: var(--radius-lg, 20px);
		corner-shape: squircle;
		background: linear-gradient(135deg, #00d4aa, #1b85f3);
		box-shadow: 0 8px 30px rgba(0, 212, 170, 0.4);
		display: grid;
		place-items: center;
		color: #ffffff;
		margin-bottom: 1.25rem;
		animation: badgeBounce 0.6s var(--ease-spring) both;
	}

	@keyframes badgeBounce {
		0% {
			transform: scale(0.6);
			opacity: 0;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	.success-check {
		font-size: 42px;
		font-weight: 800;
	}

	/* Summary Card */
	.summary-card {
		width: 100%;
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md, 14px);
		corner-shape: squircle;
		padding: 1.25rem;
		margin: 1.5rem 0 1.25rem 0;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.summary-header {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--accent-blue-base, #1b85f3);
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.summary-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.summary-label {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.summary-value-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.summary-value-row code {
		font-family: monospace;
		font-size: 0.85rem;
		padding: 2px 8px;
		background: var(--bg-surface-hover);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs, 6px);
		color: var(--text-primary);
	}

	.copy-btn {
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		background: var(--bg-surface-hover);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs, 6px);
		corner-shape: squircle;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s var(--ease-out);
	}

	.copy-btn:hover {
		color: var(--accent-blue-base, #1b85f3);
		border-color: var(--accent-blue-base, #1b85f3);
	}

	.copy-icon {
		font-size: 15px;
	}

	.demo-box {
		padding: 0.75rem 0.85rem;
		background: rgba(var(--accent-blue-rgb, 27, 133, 243), 0.08);
		border: 1px solid rgba(var(--accent-blue-rgb, 27, 133, 243), 0.2);
		border-radius: var(--radius-sm, 10px);
		corner-shape: squircle;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.demo-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent-blue-base, #1b85f3);
	}

	.demo-users {
		display: flex;
		gap: 6px;
	}

	.demo-chip {
		padding: 2px 8px;
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs, 6px);
		corner-shape: squircle;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.demo-pass {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.demo-pass code {
		font-family: monospace;
		font-weight: 700;
		color: var(--text-primary);
	}

	.finish-action {
		width: 100%;
	}

	/* Responsive */
	@media (max-width: 600px) {
		.install-card {
			padding: 1.5rem 1.25rem;
		}

		.theme-options-grid {
			grid-template-columns: 1fr;
		}

		.stepper-nav {
			padding-top: 0;
		}
	}
</style>
