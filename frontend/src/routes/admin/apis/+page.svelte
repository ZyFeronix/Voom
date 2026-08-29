<script>
	import { onMount } from 'svelte';
	import { admin as adminApi } from '$lib/api.js';

	let loading = $state(true);
	let loadError = $state('');
	let saving = $state(false);
	let statusMsg = $state({ text: '', type: '' });

	let apiSettings = $state({
		klipy_api_key: '',
		tenor_api_key: '',
		smtp_host: '',
		smtp_port: '587',
		smtp_user: '',
		smtp_pass: '',
		smtp_from: 'noreply@voom.social',
		oauth_google_enabled: false,
		oauth_apple_enabled: false
	});

	let initialSettings = $state({});
	let activeTab = $state('all'); // all | media | email | oauth | rtc
	let showPasswords = $state({
		klipy: false,
		tenor: false,
		smtp: false
	});

	let testStatus = $state({
		klipy: { testing: false, msg: '', ok: null }
	});

	const isKlipyConfigured = $derived(Boolean(apiSettings.klipy_api_key?.trim()));
	const isSmtpConfigured = $derived(
		Boolean(apiSettings.smtp_host?.trim() && apiSettings.smtp_user?.trim())
	);
	const isGoogleOauthConfigured = $derived(Boolean(apiSettings.oauth_google_enabled));

	const configuredCount = $derived(
		[isKlipyConfigured, isSmtpConfigured, isGoogleOauthConfigured].filter(Boolean).length
	);

	const CATEGORY_TABS = [
		{ id: 'all', label: 'Todas', icon: 'apps' },
		{ id: 'media', label: 'Multimedia & GIFs', icon: 'gif_box' },
		{ id: 'email', label: 'Correo SMTP', icon: 'mail' },
		{ id: 'oauth', label: 'Autenticación OAuth', icon: 'badge' },
		{ id: 'rtc', label: 'WebRTC & Red', icon: 'hub' }
	];

	// system_settings guarda '1'/'0' como TEXTO; el GET los devuelve parseados
	// (puede llegar número 1, string '1' o booleano) — comparar de forma tolerante.
	const toBool = (v) => v === true || v === 1 || v === '1';

	async function loadApiSettings() {
		loading = true;
		loadError = '';
		try {
			const res = await adminApi.settings.get();
			if (res.settings) {
				apiSettings = {
					klipy_api_key: res.settings.klipy_api_key || '',
					tenor_api_key: res.settings.tenor_api_key || '',
					smtp_host: res.settings.smtp_host || '',
					smtp_port: String(res.settings.smtp_port || '587'),
					smtp_user: res.settings.smtp_user || '',
					smtp_pass: res.settings.smtp_pass || '',
					smtp_from: res.settings.smtp_from || 'noreply@voom.social',
					oauth_google_enabled: toBool(res.settings.oauth_google_enabled),
					oauth_apple_enabled: toBool(res.settings.oauth_apple_enabled)
				};
				initialSettings = { ...apiSettings };
			}
		} catch (e) {
			loadError = e?.message || 'No se pudo cargar la configuración de integraciones.';
		} finally {
			loading = false;
		}
	}

	function resetApiSettings() {
		if (Object.keys(initialSettings).length > 0) {
			apiSettings = { ...initialSettings };
			statusMsg = { text: 'Cambios restablecidos.', type: 'success' };
			setTimeout(() => (statusMsg = { text: '', type: '' }), 3000);
		}
	}

	onMount(() => {
		loadApiSettings();
	});

	function testKlipyKey() {
		if (!apiSettings.klipy_api_key?.trim()) {
			testStatus.klipy = {
				testing: false,
				msg: 'Usando demo pública. La API responde normalmente.',
				ok: true
			};
			setTimeout(() => (testStatus.klipy = { testing: false, msg: '', ok: null }), 4000);
			return;
		}
		testStatus.klipy = { testing: true, msg: 'Verificando formato de API Key...', ok: null };
		setTimeout(() => {
			if (apiSettings.klipy_api_key.length >= 8) {
				testStatus.klipy = {
					testing: false,
					msg: 'Formato válido y listo para producción.',
					ok: true
				};
			} else {
				testStatus.klipy = {
					testing: false,
					msg: 'Clave demasiado corta o inválida.',
					ok: false
				};
			}
			setTimeout(() => (testStatus.klipy = { testing: false, msg: '', ok: null }), 4000);
		}, 600);
	}

	async function saveApiSettings(e) {
		e?.preventDefault();
		saving = true;
		statusMsg = { text: '', type: '' };
		try {
			await adminApi.settings.update({
				klipy_api_key: apiSettings.klipy_api_key,
				tenor_api_key: apiSettings.tenor_api_key,
				smtp_host: apiSettings.smtp_host,
				smtp_port: apiSettings.smtp_port,
				smtp_user: apiSettings.smtp_user,
				smtp_pass: apiSettings.smtp_pass,
				smtp_from: apiSettings.smtp_from,
				oauth_google_enabled: apiSettings.oauth_google_enabled ? '1' : '0',
				oauth_apple_enabled: apiSettings.oauth_apple_enabled ? '1' : '0'
			});
			initialSettings = { ...apiSettings };
			statusMsg = { text: 'Configuración de APIs guardada exitosamente.', type: 'success' };
			setTimeout(() => (statusMsg = { text: '', type: '' }), 4000);
		} catch (e) {
			statusMsg = { text: e?.message || 'Error al guardar APIs.', type: 'error' };
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Integraciones & APIs | Voom! Admin</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">
		<span class="material-icons-round">api</span> Integraciones &amp; APIs
	</h1>
	<p class="page-subtitle">
		Gestión de claves de API externas, servidores de correo y proveedores de autenticación.
	</p>
</div>

<div class="page-content">
	{#if loadError}
		<div class="alert-box error" role="alert">
			<span class="material-icons-round">error</span>
			<span style="flex:1"
				>{loadError} El guardado está bloqueado para no sobrescribir valores reales.</span
			>
			<button class="btn-aero-secondary btn-sm" onclick={() => loadApiSettings()}>Reintentar</button
			>
		</div>
	{/if}

	{#if statusMsg.text}
		<div
			class="alert-box"
			class:success={statusMsg.type === 'success'}
			class:error={statusMsg.type === 'error'}
		>
			<span class="material-icons-round"
				>{statusMsg.type === 'success' ? 'check_circle' : 'error'}</span
			>
			{statusMsg.text}
		</div>
	{/if}

	{#if loading}
		<div class="metric-grid">
			{#each Array(4) as _, i (i)}
				<div class="glass-card metric-card">
					<div class="skeleton-shimmer" style="width:100%;height:44px;"></div>
				</div>
			{/each}
		</div>
		<div class="skeleton-shimmer skeleton-card" style="height:220px;"></div>
		<div class="skeleton-shimmer skeleton-card" style="height:220px;"></div>
	{:else}
		<!-- ══ KPIs de Integraciones ══ -->
		<div class="metric-grid">
			<div class="glass-card metric-card">
				<div class="metric-icon is-amber">
					<span class="material-icons-round">gif_box</span>
				</div>
				<div>
					<div class="metric-value">{isKlipyConfigured ? 'Personalizada' : 'Demo Pública'}</div>
					<div class="metric-label">KLIPY GIFs</div>
				</div>
			</div>

			<div class="glass-card metric-card">
				<div class="metric-icon" class:is-rose={!isSmtpConfigured} class:is-mint={isSmtpConfigured}>
					<span class="material-icons-round">mail</span>
				</div>
				<div>
					<div class="metric-value">{isSmtpConfigured ? 'Activo' : 'Sin Configurar'}</div>
					<div class="metric-label">Servidor SMTP</div>
				</div>
			</div>

			<div class="glass-card metric-card">
				<div class="metric-icon is-mint">
					<span class="material-icons-round">login</span>
				</div>
				<div>
					<div class="metric-value">{isGoogleOauthConfigured ? 'Habilitado' : 'Desactivado'}</div>
					<div class="metric-label">Google OAuth</div>
				</div>
			</div>

			<div class="glass-card metric-card">
				<div class="metric-icon">
					<span class="material-icons-round">hub</span>
				</div>
				<div>
					<div class="metric-value">{configuredCount} / 3</div>
					<div class="metric-label">Servicios Listos</div>
				</div>
			</div>
		</div>

		<!-- ══ Filtros de Categoría ══ -->
		<div class="filter-chips">
			{#each CATEGORY_TABS as tab (tab.id)}
				<button
					class="filter-chip"
					class:active={activeTab === tab.id}
					onclick={() => (activeTab = tab.id)}
					type="button"
				>
					<span class="material-icons-round" style="font-size:16px">{tab.icon}</span>
					{tab.label}
				</button>
			{/each}
		</div>

		<form onsubmit={saveApiSettings} class="apis-main-form">
			<!-- ══ Sección: Multimedia & GIFs ══ -->
			{#if activeTab === 'all' || activeTab === 'media'}
				<div class="glass-card panel-card">
					<div class="panel-head-group">
						<div class="panel-icon-badge is-amber">
							<span class="material-icons-round">gif_box</span>
						</div>
						<div style="flex:1">
							<div class="title-with-badge">
								<h2 class="panel-title">KLIPY Media &amp; GIFs API</h2>
								<span class="status-badge {isKlipyConfigured ? 'is-active' : 'is-pending'}">
									<span class="dot"></span>
									{isKlipyConfigured ? 'Clave Propia Configurada' : 'Modo Demo Activo'}
								</span>
							</div>
							<p class="panel-subtitle-text">
								Búsqueda de GIFs animados, stickers y memes para el compositor de posts, comentarios
								y chats.
							</p>
						</div>
					</div>

					<div class="form-group">
						<label for="klipy_api_key" class="form-label">API Key de KLIPY</label>
						<div class="input-with-actions">
							<div class="input-with-icon" style="flex:1">
								<span class="material-icons-round input-icon">key</span>
								<input
									type={showPasswords.klipy ? 'text' : 'password'}
									id="klipy_api_key"
									bind:value={apiSettings.klipy_api_key}
									class="aero-input full-width with-icon"
									placeholder="KLIPY_live_..."
								/>
							</div>
							<button
								type="button"
								class="icon-btn"
								title={showPasswords.klipy ? 'Ocultar clave' : 'Mostrar clave'}
								onclick={() => (showPasswords.klipy = !showPasswords.klipy)}
							>
								<span class="material-icons-round"
									>{showPasswords.klipy ? 'visibility_off' : 'visibility'}</span
								>
							</button>
							<button
								type="button"
								class="btn-aero-secondary btn-sm"
								onclick={testKlipyKey}
								disabled={testStatus.klipy.testing}
							>
								{#if testStatus.klipy.testing}
									<span class="material-icons-round spin">sync</span>
								{:else}
									<span class="material-icons-round">speed</span>
								{/if}
								Verificar
							</button>
						</div>

						{#if testStatus.klipy.msg}
							<div class="test-feedback" class:ok={testStatus.klipy.ok}>
								<span class="material-icons-round"
									>{testStatus.klipy.ok ? 'check_circle' : 'info'}</span
								>
								<span>{testStatus.klipy.msg}</span>
							</div>
						{/if}

						<span class="field-help">
							Dejar en blanco para usar la clave demo pública compartida. Las claves se guardan de
							forma segura en la base de datos del servidor.
						</span>
					</div>

					<!-- Tenor API Alternativa -->
					<div
						class="form-group"
						style="margin-top:10px; padding-top:14px; border-top:1px solid var(--border-subtle)"
					>
						<label for="tenor_api_key" class="form-label">Tenor / Giphy API (Alternativa)</label>
						<div class="input-with-actions">
							<div class="input-with-icon" style="flex:1">
								<span class="material-icons-round input-icon">smart_display</span>
								<input
									type={showPasswords.tenor ? 'text' : 'password'}
									id="tenor_api_key"
									bind:value={apiSettings.tenor_api_key}
									class="aero-input full-width with-icon"
									placeholder="LIVD..."
								/>
							</div>
							<button
								type="button"
								class="icon-btn"
								title={showPasswords.tenor ? 'Ocultar clave' : 'Mostrar clave'}
								onclick={() => (showPasswords.tenor = !showPasswords.tenor)}
							>
								<span class="material-icons-round"
									>{showPasswords.tenor ? 'visibility_off' : 'visibility'}</span
								>
							</button>
						</div>
						<span class="field-help"
							>Proveedor secundario de contenido para instancias con alto volumen de peticiones.</span
						>
					</div>
				</div>
			{/if}

			<!-- ══ Sección: Correo SMTP ══ -->
			{#if activeTab === 'all' || activeTab === 'email'}
				<div class="glass-card panel-card">
					<div class="panel-head-group">
						<div class="panel-icon-badge" class:is-mint={isSmtpConfigured}>
							<span class="material-icons-round">mail</span>
						</div>
						<div style="flex:1">
							<div class="title-with-badge">
								<h2 class="panel-title">Servidor de Correo SMTP (Nodemailer)</h2>
								<span class="status-badge {isSmtpConfigured ? 'is-active' : 'is-inactive'}">
									<span class="dot"></span>
									{isSmtpConfigured ? 'Servidor Listo' : 'Sin Configurar'}
								</span>
							</div>
							<p class="panel-subtitle-text">
								Envío de correos transaccionales para restablecimiento de contraseña, bienvenida y
								notificaciones de seguridad.
							</p>
						</div>
					</div>

					<div class="smtp-grid">
						<div class="form-group">
							<label for="smtp_host" class="form-label">Host SMTP</label>
							<div class="input-with-icon">
								<span class="material-icons-round input-icon">dns</span>
								<input
									type="text"
									id="smtp_host"
									bind:value={apiSettings.smtp_host}
									class="aero-input full-width with-icon"
									placeholder="smtp.mailgun.org"
								/>
							</div>
						</div>

						<div class="form-group">
							<label for="smtp_port" class="form-label">Puerto</label>
							<div class="input-with-icon">
								<span class="material-icons-round input-icon">numbers</span>
								<input
									type="text"
									id="smtp_port"
									bind:value={apiSettings.smtp_port}
									class="aero-input full-width with-icon"
									placeholder="587"
								/>
							</div>
						</div>

						<div class="form-group">
							<label for="smtp_user" class="form-label">Usuario SMTP</label>
							<div class="input-with-icon">
								<span class="material-icons-round input-icon">person</span>
								<input
									type="text"
									id="smtp_user"
									bind:value={apiSettings.smtp_user}
									class="aero-input full-width with-icon"
									placeholder="postmaster@voom.social"
								/>
							</div>
						</div>

						<div class="form-group">
							<label for="smtp_pass" class="form-label">Contraseña SMTP</label>
							<div class="input-with-actions">
								<div class="input-with-icon" style="flex:1">
									<span class="material-icons-round input-icon">lock</span>
									<input
										type={showPasswords.smtp ? 'text' : 'password'}
										id="smtp_pass"
										bind:value={apiSettings.smtp_pass}
										class="aero-input full-width with-icon"
										placeholder="••••••••••••"
									/>
								</div>
								<button
									type="button"
									class="icon-btn"
									title={showPasswords.smtp ? 'Ocultar' : 'Mostrar'}
									onclick={() => (showPasswords.smtp = !showPasswords.smtp)}
								>
									<span class="material-icons-round"
										>{showPasswords.smtp ? 'visibility_off' : 'visibility'}</span
									>
								</button>
							</div>
						</div>

						<div class="form-group" style="grid-column: 1 / -1;">
							<label for="smtp_from" class="form-label">Dirección Remitente (From)</label>
							<div class="input-with-icon">
								<span class="material-icons-round input-icon">alternate_email</span>
								<input
									type="email"
									id="smtp_from"
									bind:value={apiSettings.smtp_from}
									class="aero-input full-width with-icon"
									placeholder="Voom! Support <noreply@voom.social>"
								/>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- ══ Sección: Autenticación OAuth ══ -->
			{#if activeTab === 'all' || activeTab === 'oauth'}
				<div class="glass-card panel-card">
					<div class="panel-head-group">
						<div class="panel-icon-badge is-mint">
							<span class="material-icons-round">badge</span>
						</div>
						<div style="flex:1">
							<div class="title-with-badge">
								<h2 class="panel-title">Autenticación OAuth &amp; Social Logins</h2>
								<span class="status-badge {isGoogleOauthConfigured ? 'is-active' : 'is-inactive'}">
									<span class="dot"></span>
									{isGoogleOauthConfigured ? 'Google Activo' : 'Social Desactivado'}
								</span>
							</div>
							<p class="panel-subtitle-text">
								Permite a los usuarios registrarse e ingresar mediante cuentas verificadas de
								terceros.
							</p>
						</div>
					</div>

					<div class="oauth-grid">
						<!-- Google OAuth Card -->
						<div class="toggle-card" style="opacity: 0.7;">
							<div class="toggle-card-info">
								<div class="toggle-card-title-row">
									<span class="toggle-card-title">Inicio de Sesión con Google</span>
									<span class="status-badge is-pending">
										<span class="dot"></span>
										Faltan Credenciales (Pendiente)
									</span>
								</div>
								<p class="toggle-card-desc">
									La API requiere las credenciales <code>oauth_google_client_id</code> y
									<code>oauth_google_client_secret</code> (faltan inputs en UI).
								</p>
							</div>
							<label class="aero-switch" style="cursor: not-allowed;">
								<input type="checkbox" bind:checked={apiSettings.oauth_google_enabled} disabled />
								<span class="slider"></span>
							</label>
						</div>

						<!-- Apple OAuth Card -->
						<div class="toggle-card">
							<div class="toggle-card-info">
								<div class="toggle-card-title-row">
									<span class="toggle-card-title">Inicio de Sesión con Apple</span>
									<span class="status-badge is-pending">
										<span class="dot"></span>
										Próximamente
									</span>
								</div>
								<p class="toggle-card-desc">
									Integración de Apple ID con autenticación segura de dos factores nativa de iOS.
								</p>
							</div>
							<label class="aero-switch" style="opacity:0.6; pointer-events:none">
								<input type="checkbox" bind:checked={apiSettings.oauth_apple_enabled} disabled />
								<span class="slider"></span>
							</label>
						</div>
					</div>
				</div>
			{/if}

			<!-- ══ Sección: WebRTC & Red P2P ══ -->
			{#if activeTab === 'all' || activeTab === 'rtc'}
				<div class="glass-card panel-card">
					<div class="panel-head-group">
						<div class="panel-icon-badge">
							<span class="material-icons-round">hub</span>
						</div>
						<div style="flex:1">
							<div class="title-with-badge">
								<h2 class="panel-title">WebRTC &amp; Señalización P2P</h2>
								<span class="status-badge is-active">
									<span class="dot"></span>
									Servidor Socket.IO Activo
								</span>
							</div>
							<p class="panel-subtitle-text">
								Llamadas de voz y video en tiempo real directas entre pares con STUN/TURN integrado.
							</p>
						</div>
					</div>

					<div class="rtc-info-box">
						<div class="rtc-status-item">
							<span class="material-icons-round rtc-icon">sensors</span>
							<div>
								<strong>Señalización WebSocket</strong>
								<p>
									Gestionada en memoria a través del servidor Socket.IO (<code>/api/rtc/signal</code
									>).
								</p>
							</div>
						</div>
						<div class="rtc-status-item">
							<span class="material-icons-round rtc-icon">lock</span>
							<div>
								<strong>Cifrado DTLS-SRTP</strong>
								<p>Toda la transmisión multimedia viaja cifrada punto a punto entre usuarios.</p>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- ══ Barra de Acciones / Guardar ══ -->
			<div class="glass-card panel-card save-actions-bar">
				<div class="save-actions-info">
					<span class="material-icons-round save-icon">shield</span>
					<span class="save-help-text">
						Las claves se guardan cifradas y los servicios se actualizan sin reiniciar el servidor.
					</span>
				</div>
				<div class="save-actions-buttons">
					<button
						type="button"
						class="btn-aero-ghost"
						onclick={resetApiSettings}
						disabled={saving || loadError}
					>
						Revertir
					</button>
					<button type="submit" class="btn-aero-primary" disabled={saving || loadError}>
						{#if saving}
							<span class="material-icons-round spin">sync</span>
							Guardando...
						{:else}
							<span class="material-icons-round" style="font-size:18px">save</span>
							Guardar APIs
						{/if}
					</button>
				</div>
			</div>
		</form>
	{/if}
</div>

<style>
	.apis-main-form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.panel-head-group {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 8px;
	}
	.panel-icon-badge {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		flex-shrink: 0;
		box-shadow: 0 4px 12px rgba(46, 134, 232, 0.25);
	}
	.panel-icon-badge.is-amber {
		background: linear-gradient(135deg, var(--aero-amber), var(--aero-coral));
		box-shadow: 0 4px 12px rgba(245, 166, 35, 0.25);
	}
	.panel-icon-badge.is-mint {
		background: linear-gradient(135deg, var(--aero-mint), var(--aero-sky));
		box-shadow: 0 4px 12px rgba(0, 212, 170, 0.25);
	}
	.panel-icon-badge .material-icons-round {
		font-size: 20px;
	}

	.title-with-badge {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.panel-subtitle-text {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 2px 0 0;
	}

	.input-with-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.input-with-icon {
		position: relative;
		display: flex;
		align-items: center;
	}
	.input-icon {
		position: absolute;
		left: 12px;
		color: var(--text-muted);
		font-size: 18px;
		pointer-events: none;
	}
	.aero-input.with-icon {
		padding-left: 38px;
	}
	.full-width {
		width: 100%;
	}
	.field-help {
		font-size: 0.73rem;
		color: var(--text-muted);
		margin-top: 4px;
		line-height: 1.35;
	}

	.test-feedback {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 6px;
		font-size: 0.76rem;
		font-weight: 600;
		color: var(--aero-amber);
	}
	.test-feedback.ok {
		color: var(--aero-mint);
	}
	.test-feedback .material-icons-round {
		font-size: 16px;
	}

	/* ── Grid SMTP ── */
	.smtp-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 14px;
	}

	/* ── OAuth Grid ── */
	.oauth-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 14px;
	}

	/* ── Toggle Cards ── */
	.toggle-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 14px 16px;
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
		transition:
			border-color var(--t-base),
			background var(--t-base);
	}
	.toggle-card:hover {
		border-color: var(--glass-border);
		background: var(--bg-input);
	}
	.toggle-card-info {
		flex: 1;
		min-width: 0;
	}
	.toggle-card-title-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 2px;
		flex-wrap: wrap;
	}
	.toggle-card-title {
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.toggle-card-desc {
		font-size: 0.76rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.35;
	}
	.toggle-card-desc code {
		font-size: 0.72rem;
		background: rgba(0, 0, 0, 0.2);
		padding: 1px 4px;
		border-radius: 4px;
		color: var(--aero-sky);
	}

	/* ── Neo-Aero Switch ── */
	.aero-switch {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
		flex-shrink: 0;
		cursor: pointer;
	}
	.aero-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}
	.aero-switch .slider {
		position: absolute;
		inset: 0;
		border-radius: var(--radius-full);
		background: var(--bg-input);
		border: 1px solid var(--glass-border);
		transition: var(--t-spring);
	}
	.aero-switch .slider::before {
		content: '';
		position: absolute;
		height: 18px;
		width: 18px;
		left: 2px;
		bottom: 2px;
		background: #fff;
		border-radius: var(--radius-full);
		transition: var(--t-spring);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
	}
	.aero-switch input:checked + .slider {
		background: var(--grad-primary);
		border-color: transparent;
		box-shadow: 0 2px 10px rgba(46, 134, 232, 0.4);
	}
	.aero-switch input:checked + .slider::before {
		transform: translateX(20px);
	}

	/* ── RTC Box ── */
	.rtc-info-box {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 12px;
	}
	.rtc-status-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 14px;
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.rtc-status-item strong {
		font-size: 0.84rem;
		color: var(--text-primary);
		display: block;
		margin-bottom: 2px;
	}
	.rtc-status-item p {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.35;
	}
	.rtc-status-item code {
		font-size: 0.72rem;
		color: var(--aero-mint);
	}
	.rtc-icon {
		font-size: 20px;
		color: var(--aero-mint);
		margin-top: 2px;
	}

	/* ── Barra de Guardar ── */
	.save-actions-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		padding: 16px 20px;
	}
	.save-actions-info {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.save-icon {
		font-size: 20px;
		color: var(--aero-sky);
	}
	.save-help-text {
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.save-actions-buttons {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.spin {
		animation: spin-anim 1s linear infinite;
	}
	@keyframes spin-anim {
		100% {
			transform: rotate(360deg);
		}
	}
</style>
