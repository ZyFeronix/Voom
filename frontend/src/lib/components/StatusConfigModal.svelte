<script>
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { onMount } from 'svelte';
	import { scale, fade, fly } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import CustomSelect from '$lib/components/CustomSelect.svelte';

	// UX: cierre con Escape y bloqueo del scroll de fondo mientras el modal está abierto.
	function handleEscape(e) {
		if (e.key === 'Escape') onClose?.();
	}

	$effect(() => {
		window.addEventListener('keydown', handleEscape);
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('keydown', handleEscape);
			document.body.style.overflow = prev;
		};
	});

	let { onClose } = $props();

	let selectedStatus = $state(authStore.user?.custom_status || 'online');
	let statusText = $state(authStore.user?.custom_status_text || '');
	let selectedDuration = $state(''); // will hold minutes as string, or 'forever'
	let saving = $state(false);

	// Cada estado lleva su color de identidad (--sc) para teñir selección, anillo
	// del avatar y punto de presencia de forma coherente en los tres temas.
	const statuses = [
		{ id: 'online', label: 'En línea', icon: '🟢', color: '#22c55e', desc: '' },
		{
			id: 'away',
			label: 'Inactivo',
			icon: '🌙',
			color: '#f5a623',
			desc: 'Se te mostrará como ausente.'
		},
		{
			id: 'dnd',
			label: 'No molestar',
			icon: '⛔',
			color: '#ef4444',
			desc: 'No recibirás notificaciones sonoras o en pantalla.'
		},
		{
			id: 'invisible',
			label: 'Invisible',
			icon: '⚪',
			color: '#94a3b8',
			desc: 'Aparecerás sin conexión.'
		}
	];

	const durations = [
		{ id: '15', label: 'Durante 15 minutos' },
		{ id: '60', label: 'Durante 1 hora' },
		{ id: '480', label: 'Durante 8 horas' },
		{ id: '1440', label: 'Durante 24 horas' },
		{ id: '4320', label: 'Durante 3 días' },
		{ id: 'forever', label: 'Para siempre' }
	];

	const activeStatus = $derived(statuses.find((s) => s.id === selectedStatus) ?? statuses[0]);
	const remaining = $derived(100 - (statusText?.length ?? 0));

	onMount(() => {
		// initialize duration to forever by default
		selectedDuration = 'forever';
	});

	function handleKeydown(e, id) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			selectedStatus = id;
		}
	}

	async function saveStatus() {
		saving = true;
		try {
			const res = await fetch('/api/users/me/status', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authStore.token}`
				},
				body: JSON.stringify({
					custom_status: selectedStatus,
					custom_status_text: statusText,
					duration_minutes: selectedDuration
				})
			});
			if (res.ok) {
				const data = await res.json();
				// Update authStore locally
				authStore.updateUser({
					custom_status: data.custom_status,
					custom_status_text: data.custom_status_text,
					custom_status_expires_at: data.expires_at
				});
				onClose();
			} else {
				console.error('Failed to save status');
			}
		} catch (e) {
			console.error(e);
		} finally {
			saving = false;
		}
	}
</script>

<div
	class="vs-modal-backdrop"
	transition:fade={{ duration: 200 }}
	onclick={(e) => e.target === e.currentTarget && onClose()}
	role="presentation"
>
	<div
		class="vs-modal-content"
		style="--sc: {activeStatus.color}"
		transition:scale={{ duration: 320, easing: backOut, start: 0.92 }}
		role="dialog"
		aria-modal="true"
		aria-label="Estado de conexión"
	>
		<div class="modal-header">
			<div class="header-title">
				<span class="header-dot"></span>
				<h2>Estado de conexión</h2>
			</div>
			<button class="close-btn" onclick={onClose} aria-label="Cerrar">
				<span class="material-icons-round">close</span>
			</button>
		</div>

		<div class="modal-body">
			<!-- My Avatar Preview -->
			<div class="avatar-preview">
				<div class="avatar-container">
					{#if authStore.user?.avatar_url}
						<img src={authStore.user.avatar_url} alt="Me" class="vs-avatar-img" />
					{:else}
						<div class="vs-avatar-initial">
							{(authStore.user?.display_name || authStore.user?.username || '?')[0].toUpperCase()}
						</div>
					{/if}
					<span class="presence-dot" title={activeStatus.label}></span>
				</div>
				<div class="preview-info">
					<div class="preview-name">{authStore.user?.display_name || authStore.user?.username}</div>
					<div class="preview-status">{statusText ? statusText : '¿Qué estás haciendo?'}</div>
				</div>
			</div>

			<div class="form-group">
				<label for="status_text">Estado personalizado</label>
				<div class="input-wrap">
					<input
						type="text"
						id="status_text"
						class="aero-input"
						bind:value={statusText}
						placeholder="Ej. Comiendo, Estudiando..."
						maxlength="100"
					/>
					<span class="char-count" class:low={remaining <= 10}>{remaining}</span>
				</div>
			</div>

			<div class="form-group">
				<span class="label-text">Estado</span>
				<div class="status-options" role="radiogroup" aria-label="Estado">
					{#each statuses as s, i}
						<button
							type="button"
							class="status-option"
							class:active={selectedStatus === s.id}
							style="--sc: {s.color}"
							role="radio"
							aria-checked={selectedStatus === s.id}
							onclick={() => (selectedStatus = s.id)}
							onkeydown={(e) => handleKeydown(e, s.id)}
							in:fly={{ y: 8, duration: 260, delay: 40 * i }}
						>
							<span class="status-icon">{s.icon}</span>
							<span class="status-body">
								<span class="status-label">{s.label}</span>
								{#if s.desc}
									<span class="status-desc">{s.desc}</span>
								{/if}
							</span>
							<span class="status-check material-icons-round">check_circle</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="form-group">
				<label for="status_duration">Borrar estado después de</label>
				<CustomSelect
					id="status_duration"
					bind:value={selectedDuration}
					options={durations}
					placeholder="Selecciona duración..."
				/>
			</div>
		</div>

		<div class="modal-footer">
			<button class="btn-aero-ghost" onclick={onClose} disabled={saving}>Cancelar</button>
			<button class="btn-aero-primary" onclick={saveStatus} disabled={saving}>
				{#if saving}
					<span class="spinner"></span> Guardando…
				{:else}
					Guardar
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.vs-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(4, 9, 20, 0.45);
		backdrop-filter: blur(10px) saturate(1.15);
		-webkit-backdrop-filter: blur(10px) saturate(1.15);
		display: flex;
		align-items: flex-start;
		justify-content: flex-start;
		padding: 72px 20px 20px 84px;
		z-index: 10000;
	}
	.vs-modal-content {
		position: relative;
		background: var(--bg-surface-solid, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: 14px;
		width: 100%;
		max-width: 410px;
		max-height: min(640px, calc(100dvh - 90px));
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow:
			0 24px 60px rgba(0, 0, 0, 0.35),
			inset 0 1px 0 var(--glass-border-t);
		transition: box-shadow 0.4s var(--ease-smooth);
	}

	@media (max-width: 768px) {
		.vs-modal-backdrop {
			align-items: flex-end;
			justify-content: center;
			padding: 0;
		}
		.vs-modal-content {
			max-width: 100%;
			border-radius: 16px 16px 0 0;
			max-height: 85dvh;
		}
	}
	/* Halo superior teñido por el estado activo (--sc) */
	.vs-modal-content::before {
		content: '';
		position: absolute;
		inset: 0 0 auto 0;
		height: 120px;
		border-top-left-radius: inherit;
		border-top-right-radius: inherit;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--sc) 14%, transparent) 0%,
			transparent 100%
		);
		pointer-events: none;
		opacity: 0.9;
		transition: background 0.4s var(--ease-smooth);
	}
	.modal-header,
	.modal-body,
	.modal-footer {
		position: relative;
		z-index: 1;
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-subtle);
	}
	.header-title {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.header-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--sc);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--sc) 22%, transparent);
		transition:
			background 0.35s var(--ease-smooth),
			box-shadow 0.35s var(--ease-smooth);
	}
	.modal-header h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 700;
		font-family: var(--font-display);
		letter-spacing: -0.01em;
	}
	.close-btn {
		background: transparent;
		border: none;
		color: var(--icon-muted);
		cursor: pointer;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: all var(--t-fast);
	}
	.close-btn:hover {
		background: var(--bg-icon-btn);
		color: var(--text-primary);
		transform: rotate(90deg);
	}
	.modal-body {
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.avatar-preview {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 14px;
		background: var(--bg-input);
		border-radius: 10px;
		border: 1px solid var(--border-subtle);
	}
	.avatar-container {
		position: relative;
		flex-shrink: 0;
	}
	.vs-avatar-img,
	.vs-avatar-initial {
		width: 50px;
		height: 50px;
		border-radius: 10px;
		border: 2.5px solid var(--sc);
		transition: border-color 0.35s var(--ease-smooth);
	}
	.vs-avatar-img {
		object-fit: cover;
	}
	.vs-avatar-initial {
		background: var(--grad-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-weight: 700;
		font-size: 20px;
	}
	.presence-dot {
		position: absolute;
		right: -2px;
		bottom: -2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--sc);
		border: 2px solid var(--bg-surface-solid);
		transition: background 0.35s var(--ease-smooth);
	}
	.preview-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.preview-name {
		font-weight: 700;
		font-size: 1rem;
		color: var(--text-primary);
	}
	.preview-status {
		color: var(--text-secondary);
		font-size: 0.84rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.form-group label,
	.label-text {
		font-weight: 700;
		font-size: 0.72rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.input-wrap {
		position: relative;
	}
	.aero-input {
		width: 100%;
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
		padding: 10px 14px;
		border-radius: 10px;
		color: var(--text-primary);
		font-size: 0.9rem;
		font-family: inherit;
		transition: all var(--t-fast);
	}
	.input-wrap .aero-input {
		padding-right: 44px;
	}
	.aero-input:focus {
		outline: none;
		border-color: var(--sc);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--sc) 18%, transparent);
	}
	.char-count {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
		pointer-events: none;
	}
	.char-count.low {
		color: var(--aero-amber);
		font-weight: 700;
	}
	.status-options {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.status-option {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		text-align: left;
		padding: 9px 12px;
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		cursor: pointer;
		background: var(--bg-input);
		color: var(--text-primary);
		font-family: inherit;
		transition:
			border-color var(--t-fast),
			background var(--t-fast),
			transform var(--t-fast);
	}
	.status-option:hover {
		background: var(--bg-surface-hover);
		border-color: color-mix(in srgb, var(--sc) 45%, var(--border-subtle));
	}
	.status-option:active {
		transform: scale(0.99);
	}
	.status-option:focus-visible {
		outline: none;
		border-color: var(--sc);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--sc) 20%, transparent);
	}
	.status-option.active {
		border-color: var(--sc);
		background: color-mix(in srgb, var(--sc) 10%, var(--bg-input));
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sc) 35%, transparent);
	}
	.status-icon {
		font-size: 1.2rem;
		line-height: 1;
		filter: drop-shadow(0 0 6px color-mix(in srgb, var(--sc) 55%, transparent));
	}
	.status-body {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}
	.status-label {
		font-weight: 600;
		font-size: 0.9rem;
	}
	.status-desc {
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.3;
	}
	.status-check {
		font-size: 1.25rem;
		color: var(--sc);
		opacity: 0;
		transform: scale(0.6);
		transition:
			opacity var(--t-fast),
			transform var(--t-spring);
	}
	.status-option.active .status-check {
		opacity: 1;
		transform: scale(1);
	}
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 14px 20px;
		border-top: 1px solid var(--border-subtle);
		background: var(--bg-sidebar);
	}
	.btn-aero-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: var(--grad-primary);
		color: #fff;
		border: none;
		padding: 8px 20px;
		border-radius: 8px;
		font-weight: 600;
		font-family: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all var(--t-fast);
	}
	.btn-aero-primary:hover:not(:disabled) {
		transform: translateY(-1px);
		filter: brightness(1.06);
	}
	.btn-aero-primary:disabled,
	.btn-aero-ghost:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.btn-aero-ghost {
		background: transparent;
		color: var(--text-primary);
		border: 1px solid var(--border-subtle);
		padding: 8px 18px;
		border-radius: 8px;
		font-weight: 600;
		font-family: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all var(--t-fast);
	}
	.btn-aero-ghost:hover:not(:disabled) {
		background: var(--bg-surface-hover);
	}
	.spinner {
		width: 15px;
		height: 15px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-top-color: #fff;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
