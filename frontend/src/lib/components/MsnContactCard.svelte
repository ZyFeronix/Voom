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
	.msn-contact-drawer {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 300px;
		max-width: 88vw;
		z-index: var(--z-modal-content, 600);
		border-left: 1px solid var(--border-subtle);
		box-shadow:
			-8px 0 24px rgba(0, 0, 0, 0.12),
			0 0 20px rgba(var(--accent-blue-rgb), 0.06);
		will-change: transform;
		overflow: hidden;
	}

	.msn-contact-drawer::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		background: var(--bg-surface-solid, rgba(15, 23, 42, 0.94));
		backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2));
		-webkit-backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2));
	}

	.drawer-scroll-area {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.msn-card-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.8rem;
		background: linear-gradient(
			90deg,
			rgba(var(--accent-blue-rgb), 0.12) 0%,
			rgba(14, 165, 233, 0.06) 100%
		);
		border-bottom: 1px solid var(--border-subtle);
	}

	.msn-card-brand {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.msn-card-icon {
		font-size: 0.9rem;
		filter: drop-shadow(0 0 4px var(--accent-blue-base));
	}

	.msn-card-brand-title {
		font-family: var(--font-display, sans-serif);
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: var(--accent-blue-base);
		text-transform: uppercase;
	}

	.msn-card-close-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.2rem;
		border-radius: var(--radius-xs);
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.msn-card-close-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.1);
		color: var(--text-primary);
	}
	.msn-card-close-btn .material-icons-round {
		font-size: 18px;
	}

	.msn-card-banner {
		height: 75px;
		background: linear-gradient(
			135deg,
			rgba(var(--accent-blue-rgb), 0.25) 0%,
			rgba(0, 212, 170, 0.08) 100%
		);
		position: relative;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.msn-card-avatar-wrapper {
		transform: translateY(20px);
		filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.15));
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.msn-card-body {
		padding: 1.4rem 0.85rem 0.85rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.msn-card-identity {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
	}

	.msn-card-name {
		font-family: var(--font-display, sans-serif);
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin: 0;
	}

	.msn-card-username {
		font-size: 0.78rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.msn-personal-status-pill {
		margin-top: 0.35rem;
		padding: 0.3rem 0.65rem;
		border-radius: var(--radius-full, 9999px);
		background: rgba(var(--accent-blue-rgb), 0.06);
		border: 1px solid rgba(var(--accent-blue-rgb), 0.2);
		display: flex;
		align-items: center;
		gap: 0.35rem;
		max-width: 100%;
	}

	.status-music-icon {
		font-size: 0.78rem;
	}

	.status-quote {
		font-size: 0.72rem;
		font-style: italic;
		color: var(--accent-blue-base);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.msn-card-status-strip {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.35rem 0.65rem;
		background: var(--bg-surface);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
	}

	.msn-status-dot {
		width: 7px;
		height: 7px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
	}

	.msn-status-dot.status-online {
		background: var(--status-online, #25d366);
		box-shadow: 0 0 8px rgba(37, 211, 102, 0.6);
	}
	.msn-status-dot.status-away {
		background: var(--status-away, #f5a623);
		box-shadow: 0 0 8px rgba(245, 166, 35, 0.6);
	}
	.msn-status-dot.status-dnd {
		background: var(--status-dnd, #ef4444);
		box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
	}
	.msn-status-dot.status-invisible,
	.msn-status-dot.status-offline {
		background: var(--status-invisible, #8fa8ae);
	}

	.msn-status-label {
		font-size: 0.74rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.msn-card-stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.4rem;
		background: var(--bg-surface);
		padding: 0.5rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
	}

	.msn-stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.stat-value {
		font-family: var(--font-display, sans-serif);
		font-size: 0.92rem;
		font-weight: 800;
		color: var(--text-primary);
	}

	.stat-label {
		font-size: 0.65rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.msn-card-actions {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.msn-card-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.45rem 0.6rem;
		border-radius: var(--radius-sm);
		font-family: var(--font-display, sans-serif);
		font-size: 0.78rem;
		font-weight: 600;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.18s var(--ease-out);
	}

	.msn-card-action-btn:hover {
		background: var(--bg-surface-hover);
		border-color: var(--accent-blue-base);
		color: var(--accent-blue-base);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.msn-card-action-btn .material-icons-round {
		font-size: 16px;
	}

	.msn-card-action-btn.nudge-btn {
		background: linear-gradient(
			135deg,
			rgba(var(--accent-blue-rgb), 0.15) 0%,
			rgba(245, 166, 35, 0.12) 100%
		);
		border-color: rgba(var(--accent-blue-rgb), 0.3);
		color: var(--accent-blue-base);
	}

	.msn-card-action-btn.nudge-btn:hover {
		background: linear-gradient(
			135deg,
			rgba(var(--accent-blue-rgb), 0.25) 0%,
			rgba(245, 166, 35, 0.2) 100%
		);
		box-shadow: 0 4px 14px rgba(var(--accent-blue-rgb), 0.25);
	}

	.msn-card-bio-section {
		padding: 0.6rem 0.75rem;
		background: var(--bg-surface);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
	}

	.bio-title {
		font-size: 0.68rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		display: block;
		margin-bottom: 0.2rem;
	}

	.bio-text {
		font-size: 0.76rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.35;
	}

	.msn-card-empty {
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--text-muted);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
	}
</style>
