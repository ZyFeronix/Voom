<script>
	import { onMount } from 'svelte';
	import { admin as adminApi } from '$lib/api.js';

	let loading = $state(true);
	let loadError = $state('');
	let saving = $state(false);
	let statusMsg = $state({ text: '', type: '' });

	let settings = $state({
		site_name: 'Voom!',
		allow_registration: true,
		require_invite_code: false,
		max_upload_size_mb: 50,
		platform_mode: 'custom',
		reels_enabled: true,
		stories_enabled: true,
		groups_enabled: true,
		marketplace_enabled: true,
		gamification_enabled: true,
		maintenance_mode: false,
		demo_mode: false,
		email_verification_required: false
	});

	let initialSettings = $state({});

	const activeModulesCount = $derived(
		[
			settings.reels_enabled,
			settings.stories_enabled,
			settings.groups_enabled,
			settings.marketplace_enabled,
			settings.gamification_enabled
		].filter(Boolean).length
	);

	const PLATFORM_PRESETS = [
		{
			id: 'custom',
			title: 'Personalizado',
			icon: 'tune',
			desc: 'Control individual de cada módulo y función según tus necesidades.'
		},
		{
			id: 'twitter',
			title: 'Twitter / X',
			icon: 'tag',
			desc: 'Microblogging y texto con gamificación. Reels, Historias y Marketplace inactivos.'
		},
		{
			id: 'facebook',
			title: 'Facebook',
			icon: 'groups',
			desc: 'Ecosistema integral: Grupos, Marketplace, Historias, Reels y Gamificación.'
		},
		{
			id: 'instagram',
			title: 'Instagram',
			icon: 'photo_camera',
			desc: 'Enfocado en contenido audiovisual con Reels e Historias como eje principal.'
		},
		{
			id: 'threads',
			title: 'Threads',
			icon: 'forum',
			desc: 'Conversaciones y feed ligero sin módulos multimedia pesados.'
		}
	];

	function handleModeChange(mode) {
		settings.platform_mode = mode;
		if (mode === 'twitter') {
			settings.reels_enabled = false;
			settings.stories_enabled = false;
			settings.groups_enabled = false;
			settings.marketplace_enabled = false;
			settings.gamification_enabled = true;
		} else if (mode === 'facebook') {
			settings.reels_enabled = true;
			settings.stories_enabled = true;
			settings.groups_enabled = true;
			settings.marketplace_enabled = true;
			settings.gamification_enabled = true;
		} else if (mode === 'instagram') {
			settings.reels_enabled = true;
			settings.stories_enabled = true;
			settings.groups_enabled = false;
			settings.marketplace_enabled = false;
			settings.gamification_enabled = false;
		} else if (mode === 'threads') {
			settings.reels_enabled = false;
			settings.stories_enabled = false;
			settings.groups_enabled = false;
			settings.marketplace_enabled = false;
			settings.gamification_enabled = false;
		}
	}

	function handleFeatureToggle() {
		settings.platform_mode = 'custom';
	}

	// system_settings guarda '1'/'0' como TEXTO; el GET los devuelve parseados
	// (puede llegar número 1, string '1' o booleano) — comparar de forma tolerante.
	const toBool = (v) => v === true || v === 1 || v === '1';
	const isOff = (v) => v === false || v === 0 || v === '0';

	async function loadSettings() {
		loading = true;
		loadError = '';
		try {
			const res = await adminApi.settings.get();
			if (res.settings) {
				settings = {
					site_name: res.settings.site_name || 'Voom!',
					allow_registration: toBool(res.settings.allow_registration),
					require_invite_code: toBool(res.settings.require_invite_code),
					max_upload_size_mb: Number(res.settings.max_upload_size_mb || 50),
					platform_mode: res.settings.platform_mode || 'custom',
					reels_enabled: !isOff(res.settings.reels_enabled),
					stories_enabled: !isOff(res.settings.stories_enabled),
					groups_enabled: !isOff(res.settings.groups_enabled),
					marketplace_enabled: !isOff(res.settings.marketplace_enabled),
					gamification_enabled: !isOff(res.settings.gamification_enabled),
					maintenance_mode: toBool(res.settings.maintenance_mode),
					demo_mode: toBool(res.settings.demo_mode),
					email_verification_required: toBool(res.settings.email_verification_required)
				};
				initialSettings = { ...settings };
			}
		} catch (e) {
			loadError = e?.message || 'No se pudo cargar la configuración del servidor.';
		} finally {
			loading = false;
		}
	}

	function resetSettings() {
		if (Object.keys(initialSettings).length > 0) {
			settings = { ...initialSettings };
			statusMsg = { text: 'Cambios restablecidos a los valores del servidor.', type: 'success' };
			setTimeout(() => (statusMsg = { text: '', type: '' }), 3000);
		}
	}

	onMount(() => {
		loadSettings();
	});

	async function saveSettings(e) {
		e?.preventDefault();
		saving = true;
		statusMsg = { text: '', type: '' };
		try {
			await adminApi.settings.update({
				site_name: settings.site_name,
				allow_registration: settings.allow_registration ? '1' : '0',
				require_invite_code: settings.require_invite_code ? '1' : '0',
				max_upload_size_mb: settings.max_upload_size_mb,
				platform_mode: settings.platform_mode,
				reels_enabled: settings.reels_enabled ? '1' : '0',
				stories_enabled: settings.stories_enabled ? '1' : '0',
				groups_enabled: settings.groups_enabled ? '1' : '0',
				marketplace_enabled: settings.marketplace_enabled ? '1' : '0',
				gamification_enabled: settings.gamification_enabled ? '1' : '0',
				maintenance_mode: settings.maintenance_mode ? '1' : '0',
				demo_mode: settings.demo_mode ? '1' : '0',
				email_verification_required: settings.email_verification_required ? '1' : '0'
			});
			initialSettings = { ...settings };
			statusMsg = { text: 'Configuración general guardada exitosamente.', type: 'success' };
			setTimeout(() => (statusMsg = { text: '', type: '' }), 4000);
		} catch (e) {
			statusMsg = { text: e?.message || 'Error al guardar la configuración.', type: 'error' };
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Configuración del Sistema | Voom! Admin</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">
		<span class="material-icons-round">tune</span> Configuración del Sistema
	</h1>
	<p class="page-subtitle">
		Administración de parámetros globales, modos de plataforma y módulos activos.
	</p>
</div>

<div class="page-content">
	{#if loadError}
		<div class="alert-box error" role="alert">
			<span class="material-icons-round">error</span>
			<span style="flex:1"
				>{loadError} El guardado está bloqueado para no sobrescribir la configuración real.</span
			>
			<button class="btn-aero-secondary btn-sm" onclick={() => loadSettings()}>Reintentar</button>
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
		<div class="skeleton-shimmer skeleton-card" style="height:320px;"></div>
	{:else}
		<!-- ══ KPIs de Estado ══ -->
		<div class="metric-grid">
			<div class="glass-card metric-card">
				<div class="metric-icon" class:is-rose={!settings.allow_registration}>
					<span class="material-icons-round"
						>{settings.allow_registration ? 'how_to_reg' : 'person_off'}</span
					>
				</div>
				<div>
					<div class="metric-value">
						{settings.allow_registration ? 'Abierto' : 'Cerrado'}
					</div>
					<div class="metric-label">Registro</div>
				</div>
			</div>

			<div class="glass-card metric-card">
				<div class="metric-icon is-mint">
					<span class="material-icons-round">dashboard</span>
				</div>
				<div>
					<div class="metric-value" style="font-size:1.15rem; text-transform:capitalize">
						{settings.platform_mode}
					</div>
					<div class="metric-label">Modo Activo</div>
				</div>
			</div>

			<div class="glass-card metric-card">
				<div class="metric-icon is-amber">
					<span class="material-icons-round">cloud_upload</span>
				</div>
				<div>
					<div class="metric-value">{settings.max_upload_size_mb} MB</div>
					<div class="metric-label">Límite Subida</div>
				</div>
			</div>

			<div class="glass-card metric-card">
				<div class="metric-icon">
					<span class="material-icons-round">extension</span>
				</div>
				<div>
					<div class="metric-value">{activeModulesCount} / 5</div>
					<div class="metric-label">Módulos Activos</div>
				</div>
			</div>
		</div>

		<form onsubmit={saveSettings} class="settings-main-form">
			<!-- ══ Sección 1: Parámetros del Sitio & Seguridad ══ -->
			<div class="section-grid">
				<!-- Tarjeta Parámetros Base -->
				<div class="glass-card panel-card">
					<div class="panel-head-group">
						<div class="panel-icon-badge">
							<span class="material-icons-round">language</span>
						</div>
						<div>
							<h2 class="panel-title">Parámetros del Sitio</h2>
							<p class="panel-subtitle-text">Identidad pública y límites de transferencia.</p>
						</div>
					</div>

					<div class="form-group">
						<label for="site_name" class="form-label">Nombre de la Plataforma</label>
						<div class="input-with-icon">
							<span class="material-icons-round input-icon">badge</span>
							<input
								type="text"
								id="site_name"
								bind:value={settings.site_name}
								class="aero-input full-width with-icon"
								placeholder="Voom!"
								required
							/>
						</div>
						<span class="field-help"
							>Se muestra en la cabecera, títulos de ventana y notificaciones.</span
						>
					</div>

					<div class="form-group">
						<label for="max_upload" class="form-label">Límite de Carga de Archivos (MB)</label>
						<div class="input-with-icon">
							<span class="material-icons-round input-icon">upload_file</span>
							<input
								type="number"
								id="max_upload"
								min="5"
								max="500"
								bind:value={settings.max_upload_size_mb}
								class="aero-input full-width with-icon"
								required
							/>
							<span class="input-addon">MB</span>
						</div>
						<span class="field-help">Tamaño máximo para imágenes, videos, reels y adjuntos.</span>
					</div>
				</div>

				<!-- Tarjeta Políticas de Acceso -->
				<div class="glass-card panel-card">
					<div class="panel-head-group">
						<div class="panel-icon-badge is-amber">
							<span class="material-icons-round">security</span>
						</div>
						<div>
							<h2 class="panel-title">Acceso y Registro</h2>
							<p class="panel-subtitle-text">Control de nuevos usuarios y estados del sistema.</p>
						</div>
					</div>

					<!-- Toggle: Registro Abierto -->
					<div class="toggle-card">
						<div class="toggle-card-info">
							<div class="toggle-card-title-row">
								<span class="toggle-card-title">Permitir Nuevos Registros</span>
								<span
									class="status-badge {settings.allow_registration ? 'is-active' : 'is-banned'}"
								>
									<span class="dot"></span>
									{settings.allow_registration ? 'Abierto' : 'Bloqueado'}
								</span>
							</div>
							<p class="toggle-card-desc">
								Si se desactiva, solo el staff podrá invitar o crear cuentas desde el panel de
								usuarios.
							</p>
						</div>
						<label class="aero-switch">
							<input type="checkbox" bind:checked={settings.allow_registration} />
							<span class="slider"></span>
						</label>
					</div>

					<!-- Toggle: Registro solo con invitación (beta cerrada) -->
					<div class="toggle-card">
						<div class="toggle-card-info">
							<div class="toggle-card-title-row">
								<span class="toggle-card-title">Registro Solo con Invitación</span>
								<span
									class="status-badge {settings.require_invite_code ? 'is-active' : 'is-pending'}"
								>
									<span class="dot"></span>
									{settings.require_invite_code ? 'Por invitación' : 'Libre'}
								</span>
							</div>
							<p class="toggle-card-desc">
								Exige un código de invitación válido para registrarse. Genera códigos desde el panel
								de Invitaciones.
							</p>
						</div>
						<label class="aero-switch">
							<input type="checkbox" bind:checked={settings.require_invite_code} />
							<span class="slider"></span>
						</label>
					</div>

					<!-- Toggle: Modo Mantenimiento -->
					<div class="toggle-card">
						<div class="toggle-card-info">
							<div class="toggle-card-title-row">
								<span class="toggle-card-title">Modo Mantenimiento</span>
								<span class="status-badge {settings.maintenance_mode ? 'is-pending' : 'is-active'}">
									<span class="dot"></span>
									{settings.maintenance_mode ? 'Activo' : 'Inactivo'}
								</span>
							</div>
							<p class="toggle-card-desc">
								Bloquea temporalmente el acceso a usuarios regulares mientras se realizan tareas
								técnicas. El staff y el panel admin siguen operativos.
							</p>
						</div>
						<label class="aero-switch">
							<input type="checkbox" bind:checked={settings.maintenance_mode} />
							<span class="slider"></span>
						</label>
					</div>

					<!-- Toggle: Modo Demostración -->
					<div class="toggle-card">
						<div class="toggle-card-info">
							<div class="toggle-card-title-row">
								<span class="toggle-card-title">Modo Demostración</span>
								<span class="status-badge {settings.demo_mode ? 'is-pending' : 'is-active'}">
									<span class="dot"></span>
									{settings.demo_mode ? 'Solo lectura' : 'Normal'}
								</span>
							</div>
							<p class="toggle-card-desc">
								Convierte la plataforma en una demo de solo lectura: nadie puede publicar, comentar
								ni interactuar (excepto el staff).
							</p>
						</div>
						<label class="aero-switch">
							<input type="checkbox" bind:checked={settings.demo_mode} />
							<span class="slider"></span>
						</label>
					</div>
				</div>
			</div>

			<!-- ══ Sección 2: Modo de Plataforma (Presets) ══ -->
			<div class="glass-card panel-card">
				<div class="panel-head-group">
					<div class="panel-icon-badge is-mint">
						<span class="material-icons-round">dashboard_customize</span>
					</div>
					<div>
						<h2 class="panel-title">Modos de Plataforma (Presets)</h2>
						<p class="panel-subtitle-text">
							Aplica configuraciones rápidas de módulos predefinidas para moldear el tipo de red
							social.
						</p>
					</div>
				</div>

				<div class="presets-grid">
					{#each PLATFORM_PRESETS as preset (preset.id)}
						<button
							type="button"
							class="preset-card"
							class:active={settings.platform_mode === preset.id}
							onclick={() => handleModeChange(preset.id)}
						>
							<div class="preset-icon">
								<span class="material-icons-round">{preset.icon}</span>
							</div>
							<div class="preset-info">
								<strong class="preset-name">{preset.title}</strong>
								<span class="preset-desc">{preset.desc}</span>
							</div>
							{#if settings.platform_mode === preset.id}
								<span class="preset-check">
									<span class="material-icons-round">check_circle</span>
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<!-- ══ Sección 3: Control Individual de Módulos ══ -->
			<div class="glass-card panel-card">
				<div class="panel-head-group">
					<div class="panel-icon-badge">
						<span class="material-icons-round">extension</span>
					</div>
					<div>
						<h2 class="panel-title">Módulos del Sistema</h2>
						<p class="panel-subtitle-text">
							Activa o desactiva de forma granular las funciones principales de la plataforma.
						</p>
					</div>
				</div>

				<div class="modules-grid">
					<!-- Módulo: Reels -->
					<div class="module-item-card" class:enabled={settings.reels_enabled}>
						<div class="module-icon is-rose">
							<span class="material-icons-round">movie</span>
						</div>
						<div class="module-body">
							<div class="module-head">
								<strong class="module-name">Reels & Videos Cortos</strong>
								<span class="status-badge {settings.reels_enabled ? 'is-active' : 'is-inactive'}">
									<span class="dot"></span>{settings.reels_enabled ? 'Activo' : 'Inactivo'}
								</span>
							</div>
							<p class="module-desc">
								Feed vertical inmersivo de video con reproductor continuo y comentarios.
							</p>
						</div>
						<label class="aero-switch">
							<input
								type="checkbox"
								bind:checked={settings.reels_enabled}
								onchange={handleFeatureToggle}
							/>
							<span class="slider"></span>
						</label>
					</div>

					<!-- Módulo: Stories -->
					<div class="module-item-card" class:enabled={settings.stories_enabled}>
						<div class="module-icon is-amber">
							<span class="material-icons-round">auto_stories</span>
						</div>
						<div class="module-body">
							<div class="module-head">
								<strong class="module-name">Stories (Historias 24h)</strong>
								<span class="status-badge {settings.stories_enabled ? 'is-active' : 'is-inactive'}">
									<span class="dot"></span>{settings.stories_enabled ? 'Activo' : 'Inactivo'}
								</span>
							</div>
							<p class="module-desc">
								Contenido efímero que desaparece tras 24 horas con visor flotante.
							</p>
						</div>
						<label class="aero-switch">
							<input
								type="checkbox"
								bind:checked={settings.stories_enabled}
								onchange={handleFeatureToggle}
							/>
							<span class="slider"></span>
						</label>
					</div>

					<!-- Módulo: Grupos (Pendiente) -->
					<div
						class="module-item-card"
						class:enabled={settings.groups_enabled}
						style="opacity: 0.7;"
					>
						<div class="module-icon is-sky">
							<span class="material-icons-round">groups</span>
						</div>
						<div class="module-body">
							<div class="module-head">
								<strong class="module-name">Grupos y Comunidades</strong>
								<span class="status-badge is-pending">
									<span class="dot"></span>Pendiente (WIP)
								</span>
							</div>
							<p class="module-desc">
								Espacios segmentados de debate con moderación propia y miembros exclusivos. (Módulo
								en desarrollo).
							</p>
						</div>
						<label class="aero-switch" style="cursor: not-allowed;">
							<input type="checkbox" bind:checked={settings.groups_enabled} disabled />
							<span class="slider"></span>
						</label>
					</div>

					<!-- Módulo: Marketplace -->
					<div class="module-item-card" class:enabled={settings.marketplace_enabled}>
						<div class="module-icon is-mint">
							<span class="material-icons-round">storefront</span>
						</div>
						<div class="module-body">
							<div class="module-head">
								<strong class="module-name">Marketplace & Gigs</strong>
								<span
									class="status-badge {settings.marketplace_enabled ? 'is-active' : 'is-inactive'}"
								>
									<span class="dot"></span>{settings.marketplace_enabled ? 'Activo' : 'Inactivo'}
								</span>
							</div>
							<p class="module-desc">
								Catálogo de compra y venta de productos, comisiones VTuber y servicios de creadores.
							</p>
						</div>
						<label class="aero-switch">
							<input
								type="checkbox"
								bind:checked={settings.marketplace_enabled}
								onchange={handleFeatureToggle}
							/>
							<span class="slider"></span>
						</label>
					</div>

					<!-- Módulo: Gamificación -->
					<div class="module-item-card" class:enabled={settings.gamification_enabled}>
						<div class="module-icon is-gold">
							<span class="material-icons-round">military_tech</span>
						</div>
						<div class="module-body">
							<div class="module-head">
								<strong class="module-name">Gamificación & Puntos XP</strong>
								<span
									class="status-badge {settings.gamification_enabled ? 'is-active' : 'is-inactive'}"
								>
									<span class="dot"></span>{settings.gamification_enabled ? 'Activo' : 'Inactivo'}
								</span>
							</div>
							<p class="module-desc">
								Recompensas por check-in diario, niveles, títulos personalizables y ranking global.
							</p>
						</div>
						<label class="aero-switch">
							<input
								type="checkbox"
								bind:checked={settings.gamification_enabled}
								onchange={handleFeatureToggle}
							/>
							<span class="slider"></span>
						</label>
					</div>
				</div>
			</div>

			<!-- ══ Barra de Acciones / Guardar ══ -->
			<div class="glass-card panel-card save-actions-bar">
				<div class="save-actions-info">
					<span class="material-icons-round save-icon">verified_user</span>
					<span class="save-help-text"
						>Los cambios se aplican globalmente en tiempo real a todos los clientes conectados.</span
					>
				</div>
				<div class="save-actions-buttons">
					<button
						type="button"
						class="btn-aero-ghost"
						onclick={resetSettings}
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
							Guardar Configuración
						{/if}
					</button>
				</div>
			</div>
		</form>
	{/if}
</div>

<style>
	.settings-main-form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.panel-head-group {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 6px;
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
	.panel-subtitle-text {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 2px 0 0;
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
	.input-addon {
		position: absolute;
		right: 14px;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
		pointer-events: none;
	}
	.field-help {
		font-size: 0.73rem;
		color: var(--text-muted);
		margin-top: 4px;
		line-height: 1.35;
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

	/* ── Presets Grid ── */
	.presets-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}
	.preset-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		padding: 16px;
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
		color: var(--text-secondary);
		cursor: pointer;
		text-align: left;
		position: relative;
		transition:
			border-color var(--t-base),
			background var(--t-base),
			transform var(--t-spring),
			box-shadow var(--t-base);
	}
	.preset-card:hover {
		border-color: var(--aero-sky);
		background: var(--bg-input);
		transform: translateY(-2px);
		box-shadow: var(--shadow-sm);
	}
	.preset-card.active {
		border-color: var(--aero-sky);
		background: rgba(46, 180, 255, 0.08);
		box-shadow:
			0 4px 16px rgba(46, 134, 232, 0.15),
			inset 0 0 0 1px var(--aero-sky);
	}
	.preset-icon {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm);
		background: var(--bg-input);
		border: 1px solid var(--glass-border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--aero-sky);
	}
	.preset-card.active .preset-icon {
		background: var(--grad-primary);
		color: #fff;
		border-color: transparent;
	}
	.preset-icon .material-icons-round {
		font-size: 18px;
	}
	.preset-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.preset-name {
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.preset-desc {
		font-size: 0.72rem;
		color: var(--text-muted);
		line-height: 1.35;
	}
	.preset-check {
		position: absolute;
		top: 14px;
		right: 14px;
		color: var(--aero-sky);
	}
	.preset-check .material-icons-round {
		font-size: 18px;
	}

	/* ── Modules Grid ── */
	.modules-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 14px;
	}
	.module-item-card {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px;
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
		transition:
			border-color var(--t-base),
			box-shadow var(--t-base),
			transform var(--t-spring);
	}
	.module-item-card:hover {
		border-color: var(--aero-sky);
		transform: translateY(-1px);
		box-shadow: var(--shadow-sm);
	}
	.module-item-card.enabled {
		background: rgba(46, 134, 232, 0.03);
	}
	.module-icon {
		width: 42px;
		height: 42px;
		border-radius: var(--radius-md);
		background: var(--grad-primary);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-shadow: 0 4px 12px rgba(46, 134, 232, 0.25);
	}
	.module-icon.is-rose {
		background: linear-gradient(135deg, var(--aero-rose), var(--aero-amber));
		box-shadow: 0 4px 12px rgba(236, 72, 153, 0.25);
	}
	.module-icon.is-amber {
		background: linear-gradient(135deg, var(--aero-amber), var(--aero-coral));
		box-shadow: 0 4px 12px rgba(245, 166, 35, 0.25);
	}
	.module-icon.is-sky {
		background: linear-gradient(135deg, var(--aero-sky), var(--aero-indigo));
		box-shadow: 0 4px 12px rgba(46, 180, 255, 0.25);
	}
	.module-icon.is-mint {
		background: linear-gradient(135deg, var(--aero-mint), var(--aero-sky));
		box-shadow: 0 4px 12px rgba(0, 212, 170, 0.25);
	}
	.module-icon.is-gold {
		background: linear-gradient(135deg, #f5a623, #ff6b6b);
		box-shadow: 0 4px 12px rgba(245, 166, 35, 0.25);
	}
	.module-icon .material-icons-round {
		font-size: 21px;
	}
	.module-body {
		flex: 1;
		min-width: 0;
	}
	.module-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 2px;
		flex-wrap: wrap;
	}
	.module-name {
		font-size: 0.88rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.module-desc {
		font-size: 0.74rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.35;
	}

	/* ── Barra de Acciones ── */
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
		color: var(--aero-mint);
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
