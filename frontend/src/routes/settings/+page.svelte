<script>
	import { page } from '$app/state';

	let { data } = $props();

	const CARDS = [
		{
			href: '/settings/profile',
			icon: 'person',
			title: 'Editar Perfil',
			desc: 'Nombre, biografía, ubicación y fotos de avatar/portada.'
		},
		{
			href: '/settings/design',
			icon: 'palette',
			title: 'Diseño del Perfil',
			desc: 'Colores, fondo, tipografía y bloques de tu perfil público.'
		},
		{
			href: '/settings/algorithm',
			icon: 'auto_awesome',
			title: 'Feed y Algoritmo',
			desc: 'Modo de feed, perfiles rápidos y pesos de personalización.'
		},
		{
			href: '/settings/privacy',
			icon: 'lock',
			title: 'Privacidad',
			desc: 'Visibilidad del perfil, mensajes directos y estado de conexión.'
		},
		{
			href: '/settings/security',
			icon: 'shield',
			title: 'Seguridad y Sesiones',
			desc: 'Contraseña y dispositivos con acceso activo a tu cuenta.'
		},
		{
			href: '/settings/blocked',
			icon: 'block',
			title: 'Usuarios Bloqueados',
			desc: 'Gestiona las cuentas que no pueden interactuar contigo.'
		},
		{
			href: '/settings/notifications',
			icon: 'notifications',
			title: 'Notificaciones',
			desc: 'Canales email/push y tipos de actividad social.'
		},
		{
			href: '/settings/payments',
			icon: 'payments',
			title: 'Pagos y Enlaces',
			desc: 'Enlace de cobro P2P para recibir apoyos en tu perfil.'
		},
		{
			href: '/settings/performance',
			icon: 'speed',
			title: 'Rendimiento',
			desc: 'Gráficos, animaciones, autoplay y ahorro de datos.'
		},
		{
			href: '/settings/data',
			icon: 'folder_special',
			title: 'Mis Datos (RGPD)',
			desc: 'Exporta tu información o solicita la eliminación de tu cuenta.'
		}
	];

	const VISIBILITY_LABELS = {
		public: 'Público',
		followers: 'Solo seguidores',
		friends: 'Solo amigos'
	};

	const FEED_MODE_LABELS = {
		retention: 'Descubrimiento',
		intelligent: 'Feed Inteligente',
		radar: 'Radar en Vivo'
	};
</script>

<svelte:head>
	<title>Ajustes — VSocial</title>
</svelte:head>

<div class="glass-card panel-card">
	<div class="section-content">
		<div>
			<h3 class="section-title">Hola, {data.user?.display_name || data.user?.username} 👋</h3>
			<p class="section-subtitle">
				Centraliza el control de tu cuenta. Elige una sección para comenzar.
			</p>
		</div>

		<!-- Estado rápido de la cuenta -->
		<div class="hub-status">
			<a href="/settings/security" class="status-chip">
				<span class="material-icons-round status-icon">devices</span>
				<div class="status-info">
					<span class="status-value">{data.counts?.sessions ?? 0}</span>
					<span class="status-label">
						sesión{(data.counts?.sessions ?? 0) === 1 ? '' : 'es'} activa{(data.counts?.sessions ??
							0) === 1
							? ''
							: 's'}
					</span>
				</div>
			</a>

			<a href="/settings/blocked" class="status-chip">
				<span class="material-icons-round status-icon warn">block</span>
				<div class="status-info">
					<span class="status-value">{data.counts?.blocked ?? 0}</span>
					<span class="status-label">bloqueado{(data.counts?.blocked ?? 0) === 1 ? '' : 's'}</span>
				</div>
			</a>

			<a href="/settings/privacy" class="status-chip">
				<span class="material-icons-round status-icon">visibility</span>
				<div class="status-info">
					<span class="status-value"
						>{VISIBILITY_LABELS[data.settings?.profile_visibility] ?? 'Público'}</span
					>
					<span class="status-label">visibilidad del perfil</span>
				</div>
			</a>

			<a href="/settings/algorithm" class="status-chip">
				<span class="material-icons-round status-icon">auto_awesome</span>
				<div class="status-info">
					<span class="status-value"
						>{FEED_MODE_LABELS[data.settings?.feed_mode] ?? 'Inteligente'}</span
					>
					<span class="status-label">modo de feed</span>
				</div>
			</a>
		</div>

		<!-- Tarjetas de secciones -->
		<div class="hub-grid">
			{#each CARDS as card (card.href)}
				<a href={card.href} class="hub-card" class:current={page.url.pathname === card.href}>
					<span class="material-icons-round hub-card-icon">{card.icon}</span>
					<span class="hub-card-title">{card.title}</span>
					<span class="hub-card-desc">{card.desc}</span>
					<span class="material-icons-round hub-card-arrow">arrow_forward</span>
				</a>
			{/each}
		</div>
	</div>
</div>

<style>
	.hub-status {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 12px;
	}

	.status-chip {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px;
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
		text-decoration: none;
		transition:
			border-color 0.2s var(--ease-smooth),
			transform 0.15s ease;
	}

	.status-chip:hover {
		border-color: color-mix(in srgb, var(--aero-blue) 30%, transparent);
		transform: translateY(-1px);
	}

	.status-icon {
		font-size: 22px;
		color: var(--aero-blue);
		flex-shrink: 0;
	}

	.status-icon.warn {
		color: var(--aero-coral);
	}

	.status-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.status-value {
		font-size: 0.9rem;
		font-weight: 800;
		color: var(--text-main);
		line-height: 1.2;
	}

	.status-label {
		font-size: 0.65rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.hub-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 14px;
	}

	@media (max-width: 640px) {
		.hub-grid {
			grid-template-columns: 1fr;
		}
	}

	.hub-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 18px;
		padding-right: 40px;
		border-radius: var(--radius-md);
		background: var(--bg-overlay);
		border: 1px solid var(--border-subtle);
		text-decoration: none;
		overflow: hidden;
		transition:
			transform 0.15s ease,
			border-color 0.25s var(--ease-smooth),
			box-shadow 0.25s var(--ease-smooth);
	}

	.hub-card:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--aero-blue) 35%, transparent);
		box-shadow: 0 6px 18px color-mix(in srgb, var(--aero-blue) 8%, transparent);
	}

	.hub-card.current {
		border-color: color-mix(in srgb, var(--aero-blue) 45%, transparent);
		background: color-mix(in srgb, var(--aero-blue) 5%, transparent);
	}

	.hub-card-icon {
		font-size: 26px;
		color: var(--aero-sky);
		margin-bottom: 4px;
	}

	.hub-card-title {
		font-size: 0.92rem;
		font-weight: 800;
		color: var(--text-main);
	}

	.hub-card-desc {
		font-size: 0.72rem;
		color: var(--text-muted);
		line-height: 1.45;
	}

	.hub-card-arrow {
		position: absolute;
		top: 16px;
		right: 14px;
		font-size: 18px;
		color: var(--text-muted);
		opacity: 0;
		transform: translateX(-6px);
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
	}

	.hub-card:hover .hub-card-arrow {
		opacity: 1;
		transform: translateX(0);
		color: var(--aero-blue);
	}
</style>
