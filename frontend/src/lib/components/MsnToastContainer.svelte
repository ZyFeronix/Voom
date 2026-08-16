<script>
	/**
	 * MsnToastContainer.svelte - V-SOCIAL MSN Messenger Neo-Aero Toast Popups
	 * Renderiza notificaciones emergentes estilo MSN Messenger / Windows Live Messenger
	 * en la esquina inferior derecha con física de resorte y sintetizador Web Audio.
	 */

	import { goto } from '$app/navigation';
	import { notificationsStore } from '$lib/stores/notifications.svelte.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';

	import { uiStore } from '$lib/stores/ui.svelte.js';

	let toasts = $state([]);
	let soundEnabled = $state(true);
	let lastSeenMsgId = $state(null);
	let lastSeenNotifId = $state(null);
	let lastSeenUiToastId = $state(null);

	// Sintetizador Web Audio API para reproducir el acorde cristalino estilo MSN
	function playMsnChime() {
		if (!soundEnabled || typeof window === 'undefined') return;
		if (authStore.user?.custom_status === 'dnd') return;
		try {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			if (!AudioCtx) return;
			const ctx = new AudioCtx();

			if (ctx.state === 'suspended') {
				ctx.resume();
			}

			const now = ctx.currentTime;

			// Nota 1 (C5 - 523.25Hz)
			const osc1 = ctx.createOscillator();
			const gain1 = ctx.createGain();
			osc1.type = 'sine';
			osc1.frequency.setValueAtTime(523.25, now);
			gain1.gain.setValueAtTime(0, now);
			gain1.gain.linearRampToValueAtTime(0.15, now + 0.02);
			gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

			osc1.connect(gain1);
			gain1.connect(ctx.destination);
			osc1.start(now);
			osc1.stop(now + 0.35);

			// Nota 2 cristalina (E5 - 659.25Hz)
			const osc2 = ctx.createOscillator();
			const gain2 = ctx.createGain();
			osc2.type = 'sine';
			osc2.frequency.setValueAtTime(659.25, now + 0.09);
			gain2.gain.setValueAtTime(0, now + 0.09);
			gain2.gain.linearRampToValueAtTime(0.22, now + 0.11);
			gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

			osc2.connect(gain2);
			gain2.connect(ctx.destination);
			osc2.start(now + 0.09);
			osc2.stop(now + 0.55);
		} catch (_e) {
			// Ignorar restricciones de audio context pre-interacción
		}
	}

	function removeToast(id) {
		toasts = toasts.filter((t) => t.id !== id);
	}

	function addToast(item) {
		// No mostrar toasts si el usuario está en modo No molestar
		if (authStore.user?.custom_status === 'dnd') return;

		// No duplicar si ya existe
		if (toasts.some((t) => t.id === item.id)) return;

		const toast = {
			...item,
			createdAt: Date.now(),
			timer: null,
			isHovered: false
		};

		// Limitar a máximo 3 emergentes a la vez (apilados)
		toasts = [toast, ...toasts].slice(0, 3);
		playMsnChime();

		// Auto-dismiss tras duración especificada (default 5.5s)
		scheduleDismiss(toast);
	}

	function scheduleDismiss(toast) {
		if (toast.timer) clearTimeout(toast.timer);
		toast.timer = setTimeout(() => {
			if (!toast.isHovered) {
				removeToast(toast.id);
			}
		}, toast.duration || 5500);
	}

	function handleMouseEnter(toast) {
		toast.isHovered = true;
		if (toast.timer) clearTimeout(toast.timer);
	}

	function handleMouseLeave(toast) {
		toast.isHovered = false;
		scheduleDismiss(toast);
	}

	function handleToastClick(toast) {
		removeToast(toast.id);
		if (toast.link) {
			goto(toast.link);
		}
	}

	// Escuchar nuevos mensajes desde notificationsStore
	$effect(() => {
		const newMsgs = notificationsStore.newMessages;
		if (!newMsgs || newMsgs.length === 0) return;

		const latest = newMsgs[newMsgs.length - 1];
		if (!latest || latest.id === lastSeenMsgId) return;

		lastSeenMsgId = latest.id;

		// Solo mostrar si no es un mensaje propio
		if (!latest.is_own_message && latest.sender_id !== authStore.user?.id) {
			const senderName = latest.sender_username || latest.username || 'Usuario';
			addToast({
				id: `msg-${latest.id}`,
				type: 'message',
				badgeText: 'MESSENGER',
				title: `@${senderName}`,
				body: latest.content || 'Te ha enviado un mensaje',
				avatar: latest.sender_avatar || latest.avatar,
				online: true,
				link: `/messages?user=${latest.sender_id}`
			});
		}
	});

	// Escuchar nuevas notificaciones generales desde notificationsStore
	$effect(() => {
		const items = notificationsStore.items;
		if (!items || items.length === 0) return;

		const latest = items[0];
		if (!latest || latest.id === lastSeenNotifId) return;

		lastSeenNotifId = latest.id;

		// Solo si no está leída y es reciente
		if (!latest.is_read) {
			const actorName = latest.actor_username || 'V-SOCIAL';
			addToast({
				id: `notif-${latest.id}`,
				type: latest.type || 'system',
				badgeText: 'NOTIFICACIÓN',
				title: `@${actorName}`,
				body: latest.message || 'Nueva interacción',
				avatar: latest.actor_avatar,
				online: false,
				link: '/notifications'
			});
		}
	});

	// Escuchar toasts programáticos lanzados desde uiStore.showToast()
	$effect(() => {
		const uiToasts = uiStore.toasts;
		if (!uiToasts || uiToasts.length === 0) return;

		const latest = uiToasts[0];
		if (!latest || latest.id === lastSeenUiToastId) return;

		lastSeenUiToastId = latest.id;
		addToast(latest);
	});
</script>

{#if toasts.length > 0}
	<aside
		class="msn-toast-container"
		aria-live="polite"
		aria-label="Notificaciones emergentes de Messenger"
	>
		{#each toasts as toast (toast.id)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="msn-toast-card glass-panel"
				onmouseenter={() => handleMouseEnter(toast)}
				onmouseleave={() => handleMouseLeave(toast)}
				onclick={() => handleToastClick(toast)}
			>
				<!-- Cabecera estilo MSN Messenger -->
				<div class="msn-toast-header">
					<div class="msn-toast-brand">
						<span class="msn-toast-badge">{toast.badgeText}</span>
						<span class="msn-toast-dot"></span>
					</div>
					<div class="msn-toast-actions">
						<button
							type="button"
							class="msn-toast-audio-btn"
							title={soundEnabled ? 'Silenciar sonidos de MSN' : 'Activar sonidos de MSN'}
							onclick={(e) => {
								e.stopPropagation();
								soundEnabled = !soundEnabled;
							}}
						>
							{#if soundEnabled}
								🔊
							{:else}
								🔇
							{/if}
						</button>
						<button
							type="button"
							class="msn-toast-close"
							aria-label="Cerrar notificación"
							onclick={(e) => {
								e.stopPropagation();
								removeToast(toast.id);
							}}
						>
							✕
						</button>
					</div>
				</div>

				<!-- Cuerpo principal con avatar e información -->
				<div class="msn-toast-body">
					<div
						class="msn-toast-avatar-wrapper"
						style="flex: 0 0 44px; min-width: 44px; min-height: 44px"
					>
						<AeroAvatar src={toast.avatar} alt={toast.title} size="md" online={toast.online} />
					</div>
					<div class="msn-toast-content">
						<span class="msn-toast-title">{toast.title}</span>
						<p class="msn-toast-text">{toast.body}</p>
					</div>
				</div>

				<!-- Barra de tiempo de desvanecimiento -->
				<div class="msn-toast-progress-bar"></div>
			</div>
		{/each}
	</aside>
{/if}

<style>
	.msn-toast-container {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: var(--z-toast, 700);
		display: flex;
		flex-direction: column-reverse;
		gap: 0.75rem;
		max-width: 320px;
		width: calc(100vw - 3rem);
		pointer-events: none;
	}

	/* Ajuste en móvil para flotar limpiamente sobre MobileNav */
	@media (max-width: 768px) {
		.msn-toast-container {
			bottom: calc(var(--mobile-nav-height, 5rem) + 1rem);
			right: 1rem;
			left: 1rem;
			width: auto;
			max-width: none;
		}
	}

	.msn-toast-card {
		pointer-events: auto;
		position: relative;
		overflow: hidden;
		border-radius: var(--radius-md, 14px);
		background: var(--bg-surface-solid, rgba(10, 32, 52, 0.92));
		backdrop-filter: var(--glass-blur, blur(12px) saturate(1.1));
		-webkit-backdrop-filter: var(--glass-blur, blur(12px) saturate(1.1));
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.15));
		box-shadow: var(--shadow-lg, 0 10px 30px rgba(0, 0, 0, 0.25));
		padding: 0;
		cursor: pointer;
		transform-origin: bottom right;
		animation: msnToastSlideUp 0.45s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
		transition:
			transform 0.2s var(--ease-out),
			box-shadow 0.2s var(--ease-out),
			background 0.2s var(--ease-out),
			border-color 0.2s var(--ease-out);
	}

	.msn-toast-card:hover {
		transform: scale(1.02);
		box-shadow:
			0 14px 36px rgba(0, 0, 0, 0.3),
			0 0 28px rgba(var(--accent-blue-rgb), 0.35);
	}

	.msn-toast-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.4rem 0.75rem;
		background: linear-gradient(
			90deg,
			rgba(var(--accent-blue-rgb), 0.25) 0%,
			rgba(14, 165, 233, 0.1) 100%
		);
		border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
	}

	.msn-toast-brand {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.msn-toast-badge {
		font-family: var(--font-display, sans-serif);
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: var(--accent-blue-light, #38bdf8);
		text-transform: uppercase;
	}

	.msn-toast-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: var(--aero-mint, #00d4aa);
		box-shadow: 0 0 8px var(--aero-mint, #00d4aa);
	}

	.msn-toast-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.msn-toast-audio-btn,
	.msn-toast-close {
		background: transparent;
		border: none;
		color: var(--text-secondary, rgba(255, 255, 255, 0.7));
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0.1rem 0.25rem;
		border-radius: var(--radius-xs);
		transition:
			background 0.15s,
			color 0.15s;
	}

	.msn-toast-audio-btn:hover,
	.msn-toast-close:hover {
		background: rgba(255, 255, 255, 0.15);
		color: var(--text-primary, #fff);
	}

	.msn-toast-body {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
	}

	.msn-toast-avatar-wrapper {
		position: relative;
	}

	.msn-toast-content {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.msn-toast-title {
		font-family: var(--font-display, sans-serif);
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--text-primary, #ffffff);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.msn-toast-text {
		font-family: var(--font-sans, sans-serif);
		font-size: 0.78rem;
		color: var(--text-secondary, rgba(255, 255, 255, 0.75));
		margin: 0.15rem 0 0 0;
		line-height: 1.25;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.msn-toast-progress-bar {
		height: 2px;
		width: 100%;
		background: linear-gradient(
			90deg,
			var(--accent-blue-base, #1b85f3) 0%,
			var(--aero-mint, #00d4aa) 100%
		);
		transform-origin: left;
		animation: msnToastProgress 5.5s linear forwards;
	}

	.msn-toast-card:hover .msn-toast-progress-bar {
		animation-play-state: paused;
	}

	/* ── Theme Specific Overrides ── */

	/* Tema Day / Light */
	:global([data-theme='light']) .msn-toast-card {
		background: rgba(240, 253, 255, 0.94);
		border: 1px solid rgba(14, 165, 233, 0.28);
		border-top-color: rgba(255, 255, 255, 0.9);
		box-shadow:
			0 10px 30px rgba(14, 165, 233, 0.15),
			0 4px 12px rgba(0, 0, 0, 0.05),
			inset 0 1px 0 rgba(255, 255, 255, 0.8);
	}
	:global([data-theme='light']) .msn-toast-card:hover {
		box-shadow:
			0 14px 38px rgba(14, 165, 233, 0.25),
			0 6px 18px rgba(0, 0, 0, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.95);
	}
	:global([data-theme='light']) .msn-toast-header {
		background: linear-gradient(
			90deg,
			rgba(var(--accent-blue-rgb), 0.15) 0%,
			rgba(14, 165, 233, 0.08) 100%
		);
		border-bottom: 1px solid rgba(14, 165, 233, 0.18);
	}
	:global([data-theme='light']) .msn-toast-badge {
		color: #0284c7;
	}
	:global([data-theme='light']) .msn-toast-dot {
		background: #059669;
		box-shadow: 0 0 8px rgba(5, 150, 105, 0.6);
	}
	:global([data-theme='light']) .msn-toast-audio-btn,
	:global([data-theme='light']) .msn-toast-close {
		color: var(--text-secondary);
	}
	:global([data-theme='light']) .msn-toast-audio-btn:hover,
	:global([data-theme='light']) .msn-toast-close:hover {
		background: rgba(14, 165, 233, 0.15);
		color: var(--text-primary);
	}
	:global([data-theme='light']) .msn-toast-title {
		color: var(--text-primary);
	}
	:global([data-theme='light']) .msn-toast-text {
		color: var(--text-secondary);
	}
	:global([data-theme='light']) .msn-toast-progress-bar {
		background: linear-gradient(90deg, #1b85f3 0%, #059669 100%);
	}

	/* Tema Dark */
	:global([data-theme='dark']) .msn-toast-card {
		background: rgba(10, 32, 52, 0.88);
		border: 1px solid rgba(0, 200, 255, 0.2);
		border-top-color: rgba(0, 229, 255, 0.35);
		box-shadow:
			0 10px 30px rgba(0, 0, 0, 0.35),
			0 0 20px rgba(0, 200, 255, 0.18),
			inset 0 1px 0 rgba(0, 229, 255, 0.2);
	}
	:global([data-theme='dark']) .msn-toast-card:hover {
		box-shadow:
			0 14px 36px rgba(0, 0, 0, 0.45),
			0 0 28px rgba(0, 200, 255, 0.3);
	}
	:global([data-theme='dark']) .msn-toast-header {
		background: linear-gradient(
			90deg,
			rgba(var(--accent-blue-rgb), 0.35) 0%,
			rgba(14, 165, 233, 0.15) 100%
		);
		border-bottom: 1px solid rgba(0, 200, 255, 0.15);
	}
	:global([data-theme='dark']) .msn-toast-badge {
		color: #38bdf8;
	}
	:global([data-theme='dark']) .msn-toast-audio-btn,
	:global([data-theme='dark']) .msn-toast-close {
		color: rgba(240, 248, 255, 0.7);
	}
	:global([data-theme='dark']) .msn-toast-audio-btn:hover,
	:global([data-theme='dark']) .msn-toast-close:hover {
		background: rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}
	:global([data-theme='dark']) .msn-toast-title {
		color: #f0f8ff;
	}
	:global([data-theme='dark']) .msn-toast-text {
		color: #90b0d0;
	}

	/* Tema Midnight */
	:global([data-theme='midnight']) .msn-toast-card {
		background: rgba(4, 12, 24, 0.92);
		border: 1px solid rgba(56, 189, 248, 0.25);
		border-top-color: rgba(56, 189, 248, 0.4);
		box-shadow:
			0 12px 36px rgba(0, 0, 0, 0.6),
			0 0 24px rgba(56, 189, 248, 0.2),
			inset 0 1px 0 rgba(56, 189, 248, 0.25);
	}
	:global([data-theme='midnight']) .msn-toast-card:hover {
		box-shadow:
			0 16px 40px rgba(0, 0, 0, 0.7),
			0 0 32px rgba(56, 189, 248, 0.35);
	}
	:global([data-theme='midnight']) .msn-toast-header {
		background: linear-gradient(90deg, rgba(14, 165, 233, 0.3) 0%, rgba(56, 189, 248, 0.1) 100%);
		border-bottom: 1px solid rgba(56, 189, 248, 0.2);
	}
	:global([data-theme='midnight']) .msn-toast-badge {
		color: #38bdf8;
	}
	:global([data-theme='midnight']) .msn-toast-audio-btn,
	:global([data-theme='midnight']) .msn-toast-close {
		color: rgba(148, 163, 184, 0.8);
	}
	:global([data-theme='midnight']) .msn-toast-audio-btn:hover,
	:global([data-theme='midnight']) .msn-toast-close:hover {
		background: rgba(56, 189, 248, 0.2);
		color: #f8fafc;
	}
	:global([data-theme='midnight']) .msn-toast-title {
		color: #f8fafc;
	}
	:global([data-theme='midnight']) .msn-toast-text {
		color: var(--text-secondary);
	}

	@keyframes msnToastSlideUp {
		from {
			opacity: 0;
			transform: translateY(30px) scale(0.9);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes msnToastProgress {
		from {
			transform: scaleX(1);
		}
		to {
			transform: scaleX(0);
		}
	}
</style>
