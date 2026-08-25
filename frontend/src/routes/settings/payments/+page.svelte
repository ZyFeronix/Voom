<script>
	import { slide } from 'svelte/transition';
	import { users as usersApi } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { validatePaymentLink } from '$lib/validators.js';
	import SettingsMessage from '$lib/components/settings/SettingsMessage.svelte';

	let { data } = $props();

	let message = $state({ type: '', text: '' });

	// ── Pagos y Enlaces (P2P) — precargados desde el load del layout ─────────
	// svelte-ignore state_referenced_locally
	const u = data.user;
	const savedLink = u?.payment_link && u.payment_link !== 'null' ? u.payment_link : '';
	let savedPaymentLink = $state(savedLink);
	let paymentLink = $state(savedLink);
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

	parsePaymentLinkToBuilder(savedLink);

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
			message = { type: 'error', text: err?.message ?? 'Error al eliminar el enlace.' };
		} finally {
			savingPaymentLink = false;
		}
	}
</script>

<svelte:head>
	<title>Pagos y Enlaces — VSocial</title>
</svelte:head>

<div class="glass-card panel-card">
	<SettingsMessage {message} />

	<div class="section-content">
		<div>
			<h3 class="section-title">Pagos y Enlaces</h3>
			<p class="section-subtitle">
				Conecta tu método de cobro externo para recibir pagos directamente, sin intermediarios de la
				plataforma.
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
					<span class="toggle-desc">
						Recibe apoyos directos en tu perfil. Compatible con <strong>PayPal</strong>,
						<strong>Ko-fi</strong> o <strong>Patreon</strong>.
					</span>
				</div>
			</div>

			<div class="payment-platform-selector">
				{#each PAYMENT_PLATFORMS as p (p.id)}
					<button
						class="platform-pill"
						class:active={selectedPlatform === p.id}
						onclick={() => selectPaymentPlatform(p.id)}
					>
						<span class="material-icons-round">
							{selectedPlatform === p.id ? 'check_circle' : 'radio_button_unchecked'}
						</span>
						{p.name}
					</button>
				{/each}
			</div>

			{#if selectedPlatform}
				<div class="payment-input-row" transition:slide={{ duration: 300 }}>
					<div class="payment-input-wrap" class:has-value={!!paymentUsername}>
						<div class="payment-input-field">
							<span class="payment-prefix">
								{PAYMENT_PLATFORMS.find((p) => p.id === selectedPlatform)?.prefix}
							</span>
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
								@{authStore.user?.username || data.user?.username || 'tu_usuario'}
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
						<button class="btn-aero-ghost text-danger action-btn" onclick={clearPaymentLink}>
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
						<button class="btn-aero-ghost text-muted mt-2 action-btn" onclick={clearPaymentLink}
							>Descartar cambios</button
						>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
