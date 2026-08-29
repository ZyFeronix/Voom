<script>
	/**
	 * MsnContactCard.svelte - Tarjeta de Contacto Estilo MSN Messenger Neo-Aero
	 * Visualiza detalles del usuario, mensaje personal, insignias, nivel XP y acciones directas.
	 */
	import AeroAvatar from '$lib/components/AeroAvatar.svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let {
		peer = null,
		online = false,
		status = 'offline',
		onClose = () => {},
		onNudge = () => {},
		onAudioCall = () => {},
		onVideoCall = () => {}
	} = $props();
</script>

<aside
	class="msn-contact-drawer"
	aria-label="Ficha de contacto"
	transition:fly={{ x: 300, duration: 350, easing: cubicOut, opacity: 1 }}
>
	<div class="drawer-scroll-area">
		<!-- Top Window Bar estilo Live Messenger -->
		<div class="msn-card-topbar">
			<div class="msn-card-brand">
				<span class="msn-card-icon">⚡</span>
				<span class="msn-card-brand-title">FICHA DE CONTACTO</span>
			</div>
			<button type="button" class="msn-card-close-btn" onclick={onClose} aria-label="Cerrar ficha">
				<span class="material-icons-round">close</span>
			</button>
		</div>

		{#if peer}
			<!-- Cover / Header Banner -->
			<div class="msn-card-banner">
				<div
					class="msn-card-avatar-wrapper"
					style="flex: 0 0 60px; min-width: 60px; min-height: 60px;"
				>
					<AeroAvatar
						src={peer.peer_avatar || peer.avatar}
						alt={peer.peer_display_name || peer.name || peer.username}
						size="md"
						{online}
						{status}
					/>
				</div>
			</div>

			<!-- User Identity Header -->
			<div class="msn-card-body">
				<div class="msn-card-identity">
					<h3 class="msn-card-name">
						{peer.peer_display_name || peer.name || peer.peer_username || peer.username}
						{#if peer.is_verified || peer.verified}
							<VerifiedBadge role={peer.role || 'user'} isVerified={true} size="14px" />
						{/if}
					</h3>
					<p class="msn-card-username">@{peer.peer_username || peer.username}</p>

					<!-- Estado Personal MSN / Mood -->
					{#if peer.personal_status || peer.bio}
						<div class="msn-personal-status-pill">
							<span class="status-music-icon">🎵</span>
							<span class="status-quote">
								{peer.personal_status || peer.bio}
							</span>
						</div>
					{/if}
				</div>

				<!-- Status Dot & Connection Info -->
				<div class="msn-card-status-strip">
					<span class="msn-status-dot status-{status}"></span>
					<span class="msn-status-label">
						{status === 'online'
							? 'En línea'
							: status === 'away'
								? 'Inactivo'
								: status === 'dnd'
									? 'No molestar'
									: status === 'invisible'
										? 'Invisible'
										: 'Desconectado'}
					</span>
				</div>

				<!-- Stats Row -->
				<div class="msn-card-stats-grid">
					<div class="msn-stat-item">
						<span class="stat-value">{peer.level || 1}</span>
						<span class="stat-label">Nivel XP</span>
					</div>
					<div class="msn-stat-item">
						<span class="stat-value">{peer.followers_count || 0}</span>
						<span class="stat-label">Seguidores</span>
					</div>
					<div class="msn-stat-item">
						<span class="stat-value">{peer.checkin_streak || 0}d</span>
						<span class="stat-label">Racha</span>
					</div>
				</div>

				<!-- Actions Quick Grid -->
				<div class="msn-card-actions">
					<button type="button" class="msn-card-action-btn nudge-btn" onclick={onNudge}>
						<span class="action-icon">⚡</span>
						<span>Enviar Zumbido</span>
					</button>
					<button type="button" class="msn-card-action-btn call-btn" onclick={onAudioCall}>
						<span class="material-icons-round">call</span>
						<span>Llamada Audio</span>
					</button>
					<button type="button" class="msn-card-action-btn video-btn" onclick={onVideoCall}>
						<span class="material-icons-round">videocam</span>
						<span>Videollamada</span>
					</button>
					{#if peer.peer_username || peer.username}
						<a
							href="/u/{peer.peer_username || peer.username}"
							class="msn-card-action-btn profile-btn"
							style="text-decoration: none;"
						>
							<span class="material-icons-round">account_circle</span>
							<span>Ver Perfil</span>
						</a>
					{/if}
				</div>

				<!-- User Details Footer -->
				{#if peer.bio}
					<div class="msn-card-bio-section">
						<span class="bio-title">Sobre mi:</span>
						<p class="bio-text">{peer.bio}</p>
					</div>
				{/if}
			</div>
		{:else}
			<div class="msn-card-empty">
				<span class="material-icons-round">account_circle</span>
				<p>No se pudo cargar la información del contacto.</p>
			</div>
		{/if}
	</div>
</aside>

<style>
	/* ═══════════════════════════════════════════════════════════
	   Voom! Messenger — Ficha de contacto estilo MSN
	   Drawer limpio: barra superior, identidad, stats planas y
	   acciones con color semántico (ámbar zumbido, azul llamadas).
	   ═══════════════════════════════════════════════════════════ */

	.msn-contact-drawer {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 300px;
		max-width: 88vw;
		z-index: 30;
		border-left: 1px solid var(--border-subtle);
		background: var(--bg-surface-solid, var(--bg-surface));
		box-shadow: -12px 0 32px rgba(0, 0, 0, 0.18);
	}

	.msn-contact-drawer::before {
		display: none;
	}

	.drawer-scroll-area {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
	}

	/* Barra superior estilo ventana Live Messenger */
	.msn-card-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.55rem 0.8rem;
		border-bottom: 1px solid var(--border-subtle);
		background: rgba(var(--accent-blue-rgb), 0.05);
		position: sticky;
		top: 0;
		z-index: 2;
	}
	.msn-card-brand {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.msn-card-icon {
		font-size: 0.9rem;
	}
	.msn-card-brand-title {
		font-family: var(--font-display);
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.msn-card-close-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 3px;
		display: flex;
		align-items: center;
		border-radius: 8px;
		flex-shrink: 0;
		transition:
			color 0.14s ease,
			background 0.14s ease;
	}
	.msn-card-close-btn:hover {
		color: var(--text-primary);
		background: rgba(var(--accent-blue-rgb), 0.1);
	}
	.msn-card-close-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 1px;
	}
	.msn-card-close-btn .material-icons-round {
		font-size: 16px;
	}

	/* Banner con avatar */
	.msn-card-banner {
		display: flex;
		justify-content: center;
		padding: 22px 16px 4px;
		background: linear-gradient(180deg, rgba(var(--accent-blue-rgb), 0.08), transparent);
	}
	.msn-card-avatar-wrapper {
		flex-shrink: 0;
	}

	.msn-card-body {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 12px 16px 18px;
	}
	.msn-card-identity {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 2px;
	}
	.msn-card-name {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		letter-spacing: -0.01em;
	}
	.msn-card-username {
		font-size: 0.76rem;
		color: var(--text-muted);
		margin: 0;
	}

	/* Mensaje personal (guiño MSN) */
	.msn-personal-status-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		padding: 5px 12px;
		border-radius: var(--radius-full);
		background: rgba(var(--accent-blue-rgb), 0.06);
		border: 1px solid var(--border-subtle);
		max-width: 100%;
	}
	.status-music-icon {
		font-size: 0.78rem;
		flex-shrink: 0;
	}
	.status-quote {
		font-size: 0.74rem;
		color: var(--text-secondary);
		font-style: italic;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Estado de conexión */
	.msn-card-status-strip {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}
	.msn-status-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.msn-status-dot.status-online {
		background: var(--aero-mint, #00d4aa);
		box-shadow: 0 0 0 2px rgba(var(--aero-mint-rgb, 0, 212, 170), 0.18);
	}
	.msn-status-dot.status-away,
	.msn-status-dot.status-idle {
		background: #f5a623;
	}
	.msn-status-dot.status-dnd {
		background: #e5484d;
	}
	.msn-status-dot.status-invisible,
	.msn-status-dot.status-offline {
		background: #64748b;
	}
	.msn-status-label {
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--text-secondary);
	}

	/* Stats planas */
	.msn-card-stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.msn-stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 9px 4px;
		border: 1px solid var(--border-subtle);
		border-radius: 12px;
		background: rgba(var(--accent-blue-rgb), 0.03);
	}
	.stat-value {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-primary);
		line-height: 1.1;
	}
	.stat-label {
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	/* Acciones */
	.msn-card-actions {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.msn-card-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.55rem 0.7rem;
		border-radius: 11px;
		font-family: var(--font-display, sans-serif);
		font-size: 0.78rem;
		font-weight: 700;
		border: 1px solid var(--border-subtle);
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
		text-decoration: none;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}
	.msn-card-action-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.08);
		border-color: rgba(var(--accent-blue-rgb), 0.3);
		color: var(--accent-blue-base);
	}
	.msn-card-action-btn:focus-visible {
		outline: 2px solid var(--aero-sky, var(--accent-blue-base));
		outline-offset: 2px;
	}
	.msn-card-action-btn .material-icons-round {
		font-size: 16px;
	}
	.action-icon {
		font-size: 0.85rem;
	}

	.msn-card-action-btn.nudge-btn {
		background: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.1);
		border-color: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.3);
		color: var(--aero-amber, #b45309);
	}
	.msn-card-action-btn.nudge-btn:hover {
		background: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.18);
		border-color: rgba(var(--aero-amber-rgb, 245, 166, 35), 0.45);
		color: var(--aero-amber, #b45309);
	}
	:global([data-theme='dark']) .msn-card-action-btn.nudge-btn,
	:global([data-theme='midnight']) .msn-card-action-btn.nudge-btn {
		color: var(--aero-amber, #fbbf24);
	}

	.msn-card-action-btn.call-btn,
	.msn-card-action-btn.video-btn {
		background: rgba(var(--accent-blue-rgb), 0.08);
		border-color: rgba(var(--accent-blue-rgb), 0.25);
		color: var(--accent-blue-base);
	}
	.msn-card-action-btn.call-btn:hover,
	.msn-card-action-btn.video-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.15);
	}

	/* Bio */
	.msn-card-bio-section {
		padding: 12px;
		border: 1px solid var(--border-subtle);
		border-radius: 12px;
		background: rgba(var(--accent-blue-rgb), 0.03);
	}
	.bio-title {
		display: block;
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	.bio-text {
		font-size: 0.76rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	/* Vacío */
	.msn-card-empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 24px;
		color: var(--text-muted);
		text-align: center;
	}
	.msn-card-empty .material-icons-round {
		font-size: 34px;
		opacity: 0.5;
	}
	.msn-card-empty p {
		font-size: 0.78rem;
		margin: 0;
	}
</style>
