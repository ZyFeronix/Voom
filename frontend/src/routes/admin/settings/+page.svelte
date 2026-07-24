<script>
	import { onMount } from 'svelte';
	import { admin as adminApi } from '$lib/api.js';
	import { invalidateAll } from '$app/navigation';

	let loading = $state(true);
	let saving = $state(false);
	let statusMsg = $state({ text: '', type: '' });

	let settings = $state({
		site_name: 'VSocial',
		allow_registration: true,
		max_upload_size_mb: 50,
		platform_mode: 'custom',
		reels_enabled: true,
		stories_enabled: true,
		groups_enabled: true,
		marketplace_enabled: true,
		gamification_enabled: true
	});

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

	onMount(async () => {
		try {
			const res = await adminApi.settings.get();
			if (res.settings) {
				settings = {
					site_name: res.settings.site_name || 'VSocial',
					allow_registration:
						res.settings.allow_registration === '1' || res.settings.allow_registration === true,
					max_upload_size_mb: Number(res.settings.max_upload_size_mb || 50),
					platform_mode: res.settings.platform_mode || 'custom',
					reels_enabled: res.settings.reels_enabled !== '0' && res.settings.reels_enabled !== false,
					stories_enabled:
						res.settings.stories_enabled !== '0' && res.settings.stories_enabled !== false,
					groups_enabled:
						res.settings.groups_enabled !== '0' && res.settings.groups_enabled !== false,
					marketplace_enabled:
						res.settings.marketplace_enabled !== '0' && res.settings.marketplace_enabled !== false,
					gamification_enabled:
						res.settings.gamification_enabled !== '0' && res.settings.gamification_enabled !== false
				};
			}
		} catch (e) {
			console.error(e);
		} finally {
			loading = false;
		}
	});

	async function saveSettings(e) {
		e.preventDefault();
		saving = true;
		statusMsg = { text: '', type: '' };
		try {
			await adminApi.settings.update({
				site_name: settings.site_name,
				allow_registration: settings.allow_registration,
				max_upload_size_mb: settings.max_upload_size_mb,
				platform_mode: settings.platform_mode,
				reels_enabled: settings.reels_enabled,
				stories_enabled: settings.stories_enabled,
				groups_enabled: settings.groups_enabled,
				marketplace_enabled: settings.marketplace_enabled,
				gamification_enabled: settings.gamification_enabled
			});
			statusMsg = { text: 'Configuración general guardada.', type: 'success' };
			setTimeout(() => (statusMsg = { text: '', type: '' }), 4000);
			await invalidateAll();
		} catch (e) {
			console.error(e);
			statusMsg = { text: 'Error al guardar.', type: 'error' };
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Sistema | VSocial Admin</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Sistema</h1>
	<p class="page-subtitle">Configuración global de la plataforma</p>
</div>

<div class="page-content">
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
		<div class="loader-container">
			<span class="loading loading-spinner text-primary"></span>
		</div>
	{:else}
		<form onsubmit={saveSettings} class="settings-form">
			<div class="settings-layout">
				<!-- General Section -->
				<div class="settings-panel glass-panel neo-shadow">
					<div class="panel-header">
						<div class="panel-icon primary-glow">
							<span class="material-icons-round">language</span>
						</div>
						<div>
							<h3 class="panel-title">Configuración General</h3>
							<p class="panel-desc">Identidad base y límites del servidor</p>
						</div>
					</div>

					<div class="form-group">
						<label for="site_name" class="form-label">Nombre del Sitio</label>
						<input
							type="text"
							id="site_name"
							bind:value={settings.site_name}
							class="aero-input w-full"
							required
						/>
					</div>

					<div class="form-group mb-0">
						<label for="max_upload" class="form-label">Límite de Subida (MB)</label>
						<div class="input-with-icon">
							<span class="material-icons-round input-icon">cloud_upload</span>
							<input
								type="number"
								id="max_upload"
								bind:value={settings.max_upload_size_mb}
								class="aero-input w-full with-icon"
								required
							/>
						</div>
					</div>
				</div>

				<!-- Access Section -->
				<div class="settings-panel glass-panel neo-shadow">
					<div class="panel-header">
						<div class="panel-icon amber-glow">
							<span class="material-icons-round">vpn_key</span>
						</div>
						<div>
							<h3 class="panel-title">Control de Acceso</h3>
							<p class="panel-desc">Políticas de registro y autenticación</p>
						</div>
					</div>

					<div class="toggle-row">
						<div class="toggle-info">
							<span class="toggle-title">Permitir Nuevos Registros</span>
							<span class="toggle-desc"
								>Si se desactiva, solo los administradores podrán crear cuentas manualmente.</span
							>
						</div>
						<label class="aero-toggle-switch">
							<input type="checkbox" bind:checked={settings.allow_registration} />
							<span class="toggle-slider"></span>
						</label>
					</div>
				</div>
			</div>

			<!-- Features & Platform Mode Section -->
			<div class="settings-panel glass-panel neo-shadow" style="grid-column: 1 / -1;">
				<div class="panel-header">
					<div
						class="panel-icon"
						style="background: var(--grad-purple); box-shadow: 0 0 20px rgba(138,43,226,0.3);"
					>
						<span class="material-icons-round">dashboard_customize</span>
					</div>
					<div>
						<h3 class="panel-title">Modo de Plataforma y Funciones</h3>
						<p class="panel-desc">
							Habilita o deshabilita módulos principales del sistema de forma global
						</p>
					</div>
				</div>

				<div class="form-group">
					<span class="form-label">Modo de Operación</span>
					<div class="modes-grid">
						<button
							type="button"
							class="mode-btn"
							class:active={settings.platform_mode === 'custom'}
							onclick={() => handleModeChange('custom')}
						>
							<span class="material-icons-round">tune</span> Custom
						</button>
						<button
							type="button"
							class="mode-btn"
							class:active={settings.platform_mode === 'twitter'}
							onclick={() => handleModeChange('twitter')}
						>
							<span class="material-icons-round">tag</span> Twitter/X
						</button>
						<button
							type="button"
							class="mode-btn"
							class:active={settings.platform_mode === 'facebook'}
							onclick={() => handleModeChange('facebook')}
						>
							<span class="material-icons-round">groups</span> Facebook
						</button>
						<button
							type="button"
							class="mode-btn"
							class:active={settings.platform_mode === 'instagram'}
							onclick={() => handleModeChange('instagram')}
						>
							<span class="material-icons-round">photo_camera</span> Instagram
						</button>
						<button
							type="button"
							class="mode-btn"
							class:active={settings.platform_mode === 'threads'}
							onclick={() => handleModeChange('threads')}
						>
							<span class="material-icons-round">forum</span> Threads
						</button>
					</div>
				</div>

				<div class="features-grid">
					<div class="toggle-row">
						<div class="toggle-info">
							<span class="toggle-title">Reels (Videos Cortos)</span>
							<span class="toggle-desc">Habilita el feed de videos verticales tipo TikTok.</span>
						</div>
						<label class="aero-toggle-switch">
							<input
								type="checkbox"
								bind:checked={settings.reels_enabled}
								onchange={handleFeatureToggle}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>

					<div class="toggle-row">
						<div class="toggle-info">
							<span class="toggle-title">Stories (Historias)</span>
							<span class="toggle-desc">Contenido efímero que desaparece en 24 horas.</span>
						</div>
						<label class="aero-toggle-switch">
							<input
								type="checkbox"
								bind:checked={settings.stories_enabled}
								onchange={handleFeatureToggle}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>

					<div class="toggle-row">
						<div class="toggle-info">
							<span class="toggle-title">Grupos</span>
							<span class="toggle-desc">Comunidades de usuarios asiladas por intereses.</span>
						</div>
						<label class="aero-toggle-switch">
							<input
								type="checkbox"
								bind:checked={settings.groups_enabled}
								onchange={handleFeatureToggle}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>

					<div class="toggle-row">
						<div class="toggle-info">
							<span class="toggle-title">Marketplace</span>
							<span class="toggle-desc">Sistema de compra y venta entre usuarios.</span>
						</div>
						<label class="aero-toggle-switch">
							<input
								type="checkbox"
								bind:checked={settings.marketplace_enabled}
								onchange={handleFeatureToggle}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>

					<div class="toggle-row">
						<div class="toggle-info">
							<span class="toggle-title">Gamificación</span>
							<span class="toggle-desc">Insignias, puntos y niveles en la plataforma.</span>
						</div>
						<label class="aero-toggle-switch">
							<input
								type="checkbox"
								bind:checked={settings.gamification_enabled}
								onchange={handleFeatureToggle}
							/>
							<span class="toggle-slider"></span>
						</label>
					</div>
				</div>
			</div>

			<div class="form-actions-bar glass-panel neo-shadow">
				<button type="submit" class="btn-aero-primary flex items-center gap-2" disabled={saving}>
					{#if saving}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						<span class="material-icons-round text-[18px]">save</span>
						Guardar Cambios
					{/if}
				</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.page-header {
		padding: 32px;
		background: linear-gradient(180deg, rgba(46, 134, 232, 0.03) 0%, transparent 100%);
		border-bottom: 1px solid var(--border-subtle);
	}
	.page-title {
		font-size: 1.8rem;
		font-family: var(--font-display);
		font-weight: 800;
		margin: 0;
	}
	.page-subtitle {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin: 4px 0 0;
	}

	.page-content {
		padding: 32px;
		max-width: 1400px;
		margin: 0 auto;
	}

	.settings-layout {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
		gap: 32px;
		margin-bottom: 32px;
	}

	.settings-panel {
		padding: 32px;
		border-radius: var(--radius-lg);
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--glass-border);
		backdrop-filter: blur(24px) saturate(1.5);
		display: flex;
		flex-direction: column;
	}

	.panel-header {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 32px;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 24px;
	}
	.panel-icon {
		width: 48px;
		height: 48px;
		min-width: 48px;
		border-radius: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}
	.panel-icon .material-icons-round {
		font-size: 24px;
	}
	.primary-glow {
		background: var(--grad-primary);
		box-shadow: 0 0 20px rgba(46, 134, 232, 0.3);
	}
	.amber-glow {
		background: var(--grad-gold);
		box-shadow: 0 0 20px rgba(255, 191, 0, 0.3);
	}

	.panel-title {
		font-size: 1.15rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0 0 4px 0;
	}
	.panel-desc {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.4;
	}

	.form-group {
		margin-bottom: 24px;
	}
	.form-group.mb-0 {
		margin-bottom: 0;
	}
	.form-label {
		display: block;
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin-bottom: 8px;
	}

	.input-with-icon {
		position: relative;
		display: flex;
		align-items: center;
	}
	.input-icon {
		position: absolute;
		left: 14px;
		color: var(--text-muted);
		font-size: 20px;
		pointer-events: none;
	}
	.aero-input.with-icon {
		padding-left: 44px;
	}

	.toggle-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
	}
	.toggle-info {
		display: flex;
		flex-direction: column;
		padding-right: 16px;
	}
	.toggle-title {
		font-weight: 700;
		color: var(--text-primary);
		font-size: 0.95rem;
		margin-bottom: 4px;
	}
	.toggle-desc {
		font-size: 0.82rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	/* Neo-Aero Toggle Switch */
	.aero-toggle-switch {
		position: relative;
		display: inline-block;
		width: 52px;
		height: 28px;
		flex-shrink: 0;
	}
	.aero-toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}
	.toggle-slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(255, 255, 255, 0.1);
		transition: 0.3s var(--ease-spring);
		border-radius: 34px;
		border: 1px solid var(--border-glass);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
	}
	.toggle-slider:before {
		position: absolute;
		content: '';
		height: 20px;
		width: 20px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		transition: 0.3s var(--ease-spring);
		border-radius: 50%;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
	}
	input:checked + .toggle-slider {
		background-color: var(--aero-sky);
		border-color: var(--aero-blue);
		box-shadow:
			0 0 15px rgba(74, 171, 223, 0.4),
			inset 0 2px 4px rgba(0, 0, 0, 0.2);
	}
	input:checked + .toggle-slider:before {
		transform: translateX(24px);
	}

	.form-actions-bar {
		padding: 24px;
		border-radius: var(--radius-lg);
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--glass-border);
		backdrop-filter: blur(24px) saturate(1.5);
		display: flex;
		justify-content: flex-end;
	}

	.alert-box {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px 20px;
		border-radius: var(--radius-md);
		margin-bottom: 24px;
		font-weight: 600;
		font-size: 0.9rem;
	}
	.alert-box.success {
		background: rgba(61, 199, 154, 0.1);
		color: var(--aero-mint);
		border: 1px solid rgba(61, 199, 154, 0.25);
		box-shadow: 0 4px 20px rgba(61, 199, 154, 0.15);
	}
	.alert-box.error {
		background: rgba(232, 74, 114, 0.1);
		color: var(--aero-rose);
		border: 1px solid rgba(232, 74, 114, 0.25);
		box-shadow: 0 4px 20px rgba(232, 74, 114, 0.15);
	}

	.loader-container {
		padding: 64px;
		text-align: center;
	}

	.modes-grid {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 24px;
	}
	.mode-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--border-glass);
		color: var(--text-secondary);
		font-weight: 600;
		cursor: pointer;
		transition: 0.2s ease;
	}
	.mode-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	.mode-btn.active {
		background: var(--aero-blue);
		color: #fff;
		border-color: rgba(255, 255, 255, 0.3);
		box-shadow: 0 4px 15px rgba(74, 171, 223, 0.4);
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 16px;
		background: rgba(0, 0, 0, 0.15);
		padding: 24px;
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.05);
		box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.2);
	}
</style>
