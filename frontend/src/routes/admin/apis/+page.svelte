<script>
	import { onMount } from 'svelte';
	import { admin as adminApi } from '$lib/api.js';

	let loading = $state(true);
	let saving = $state(false);
	let statusMsg = $state({ text: '', type: '' });

	let apiSettings = $state({
		klipy_api_key: ''
	});

	onMount(async () => {
		try {
			const res = await adminApi.settings.get();
			if (res.settings) {
				apiSettings = {
					klipy_api_key: res.settings.klipy_api_key || ''
				};
			}
		} catch (e) {
			console.error(e);
		} finally {
			loading = false;
		}
	});

	async function saveApiSettings(e) {
		e.preventDefault();
		saving = true;
		statusMsg = { text: '', type: '' };
		try {
			await adminApi.settings.update({
				klipy_api_key: apiSettings.klipy_api_key
			});
			statusMsg = { text: 'API Keys guardadas exitosamente.', type: 'success' };
			setTimeout(() => (statusMsg = { text: '', type: '' }), 4000);
		} catch (e) {
			console.error(e);
			statusMsg = { text: 'Error al guardar APIs.', type: 'error' };
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Integraciones & APIs | VSocial Admin</title>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Integraciones & APIs</h1>
	<p class="page-subtitle">
		Gestiona las claves de acceso para servicios de terceros utilizados por la plataforma.
	</p>
</div>

<div class="page-content">
	{#if loading}
		<div class="loader-container">
			<span class="loading loading-spinner text-primary"></span>
		</div>
	{:else}
		<div class="settings-card glass-card">
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

			<form onsubmit={saveApiSettings} class="settings-form">
				<div class="apis-section-header">
					<div class="apis-section-icon">
						<span class="material-icons-round">api</span>
					</div>
					<div>
						<h3 class="section-heading">API Keys de Terceros</h3>
						<p class="section-desc">
							Configura las claves de acceso para servicios externos. Las claves se almacenan de
							forma segura en la base de datos del servidor.
						</p>
					</div>
				</div>

				<div class="api-list">
					<!-- KLIPY API -->
					<div class="api-item">
						<div class="api-item-header">
							<div class="api-item-icon gif-icon">
								<span class="material-icons-round">gif_box</span>
							</div>
							<div class="api-item-info">
								<h4 class="api-item-name">KLIPY API</h4>
								<p class="api-item-desc">GIFs y Stickers para publicaciones y mensajes</p>
							</div>
							{#if apiSettings.klipy_api_key}
								<span class="api-status-badge configured">
									<span class="dot"></span>
									Configurada
								</span>
							{:else}
								<span class="api-status-badge unconfigured">
									<span class="material-icons-round" style="font-size:14px"
										>remove_circle_outline</span
									>
									Sin configurar
								</span>
							{/if}
						</div>
						<div class="api-item-field">
							<label for="klipy_api_key" class="form-label">API Key</label>
							<input
								type="password"
								id="klipy_api_key"
								bind:value={apiSettings.klipy_api_key}
								class="aero-input"
								placeholder="KLIPY_..."
							/>
							<p class="field-hint">
								Dejar en blanco para usar la demo pública. La clave se guarda globalmente en el
								servidor.
							</p>
						</div>
					</div>

					<!-- SMTP (Coming Soon) -->
					<div class="api-item coming-soon">
						<div class="api-item-header">
							<div class="api-item-icon smtp-icon">
								<span class="material-icons-round">mail</span>
							</div>
							<div class="api-item-info">
								<h4 class="api-item-name">
									SMTP Email Server
									<span class="coming-soon-badge">Próximamente</span>
								</h4>
								<p class="api-item-desc">Servidor de correo para notificaciones y verificación</p>
							</div>
						</div>
						<div class="api-item-field">
							<span class="form-label">Host SMTP</span>
							<input
								type="text"
								id="smtp_host"
								name="smtp_host"
								disabled
								placeholder="smtp.example.com"
								class="aero-input"
							/>
						</div>
					</div>

					<!-- Stripe (Coming Soon) -->
					<div class="api-item coming-soon">
						<div class="api-item-header">
							<div class="api-item-icon stripe-icon">
								<span class="material-icons-round">payments</span>
							</div>
							<div class="api-item-info">
								<h4 class="api-item-name">
									Stripe Payments
									<span class="coming-soon-badge">Próximamente</span>
								</h4>
								<p class="api-item-desc">Procesamiento de pagos y suscripciones premium</p>
							</div>
						</div>
						<div class="api-item-field">
							<span class="form-label">Secret Key</span>
							<input
								type="password"
								id="stripe_key"
								name="stripe_key"
								disabled
								placeholder="sk_test_..."
								class="aero-input"
							/>
						</div>
					</div>
				</div>

				<div class="form-actions">
					<button type="submit" class="btn-aero-primary" disabled={saving}>
						{saving ? 'Guardando...' : 'Guardar API Keys'}
					</button>
				</div>
			</form>
		</div>
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
	.settings-card {
		padding: 32px;
		border-radius: var(--radius-lg);
	}
	.loader-container {
		padding: 64px;
		text-align: center;
	}

	.apis-section-header {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		margin-bottom: 24px;
	}
	.apis-section-icon {
		width: 48px;
		height: 48px;
		min-width: 48px;
		border-radius: 14px;
		background: rgba(46, 134, 232, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--aero-blue);
		border: 1px solid rgba(46, 134, 232, 0.2);
	}
	.apis-section-icon .material-icons-round {
		font-size: 24px;
	}
	.section-heading {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 4px 0;
	}
	.section-desc {
		font-size: 0.82rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.4;
	}

	.api-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 24px;
		margin-bottom: 32px;
	}

	.api-item {
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-lg);
		padding: 24px;
		background: rgba(255, 255, 255, 0.02);
		backdrop-filter: blur(20px);
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow:
			0 4px 20px rgba(0, 0, 0, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.05);
		display: flex;
		flex-direction: column;
	}
	.api-item:hover {
		transform: translateY(-4px);
		border-color: rgba(255, 255, 255, 0.15);
		background: rgba(255, 255, 255, 0.04);
		box-shadow:
			0 12px 30px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}
	.api-item:hover .api-item-icon.gif-icon {
		box-shadow: 0 0 20px rgba(255, 191, 0, 0.4);
	}
	.api-item:hover .api-item-icon.smtp-icon {
		box-shadow: 0 0 20px rgba(74, 171, 223, 0.4);
	}
	.api-item:hover .api-item-icon.stripe-icon {
		box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
	}

	.api-item.coming-soon {
		background: repeating-linear-gradient(
			-45deg,
			rgba(255, 255, 255, 0.01),
			rgba(255, 255, 255, 0.01) 10px,
			transparent 10px,
			transparent 20px
		);
		opacity: 0.7;
		pointer-events: none;
	}

	.api-item-header {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 24px;
	}
	.api-item-icon {
		width: 48px;
		height: 48px;
		min-width: 48px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: box-shadow 0.3s ease;
	}
	.api-item-icon .material-icons-round {
		font-size: 24px;
		color: #fff;
	}
	.gif-icon {
		background: var(--grad-gold);
	}
	.smtp-icon {
		background: var(--grad-primary);
	}
	.stripe-icon {
		background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
	}

	.api-item-info {
		flex: 1;
		min-width: 0;
	}
	.api-item-name {
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0 0 6px 0;
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.api-item-desc {
		font-size: 0.82rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.4;
	}

	.api-status-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		border-radius: 99px;
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		flex-shrink: 0;
	}
	.api-status-badge.configured {
		background: rgba(61, 199, 154, 0.1);
		color: var(--aero-mint);
		border: 1px solid rgba(61, 199, 154, 0.25);
	}
	.api-status-badge.configured .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--aero-mint);
		box-shadow: 0 0 8px var(--aero-mint);
		animation: pulse 2s infinite;
	}
	@keyframes pulse {
		0% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(0.8);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.api-status-badge.unconfigured {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-muted);
		border: 1px solid var(--border-glass);
	}

	.coming-soon-badge {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: rgba(46, 134, 232, 0.12);
		color: var(--aero-blue);
		border: 1px solid rgba(46, 134, 232, 0.25);
		border-radius: 99px;
		padding: 2px 8px;
	}

	.api-item-field {
		margin-top: auto;
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
	.field-hint {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-top: 6px;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		border-top: 1px solid var(--border-glass);
		padding-top: 20px;
	}

	.alert-box {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-radius: 10px;
		margin-bottom: 24px;
		font-weight: 600;
		font-size: 0.88rem;
	}
	.alert-box.success {
		background: rgba(61, 199, 154, 0.1);
		color: var(--aero-mint);
		border: 1px solid rgba(61, 199, 154, 0.25);
	}
	.alert-box.error {
		background: rgba(232, 74, 114, 0.1);
		color: var(--aero-rose);
		border: 1px solid rgba(232, 74, 114, 0.25);
	}
</style>
