<script>
	/**
	 * ProfileHeaderCard — cabecera REAL del perfil, compartida por la página
	 * pública (/u/[username]) y el lienzo del editor de diseño
	 * (/settings/design). Única fuente de verdad visual: cualquier cambio aquí
	 * se refleja en ambos, eliminando la clase entera de bugs de divergencia.
	 *
	 * Modo interactivo (perfil real): tabs clicables, stats con enlaces,
	 * botones de cámara para portada/avatar, portada y avatar abren el visor.
	 * Modo preview (editor): todo decorativo (spans sin navegación falsa),
	 * mismas medidas y estilos.
	 */
	import { mediaViewer } from '$lib/stores/mediaViewer.svelte.js';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';
	import UserTitleBadge from '$lib/components/gamification/UserTitleBadge.svelte';
	import { formatHashtags } from '$lib/utils/textFormatting.js';

	let {
		user,
		postsCount = 0,
		followersCount = 0,
		followingState = false,
		activeTab = 'posts',
		isOwnProfile = false,
		interactive = true,
		onTabSelect = () => {},
		onStartDm = () => {},
		onToggleFollow = () => {},
		onAvatarCamera = null,
		onCoverCamera = null
	} = $props();

	const XP_PER_LEVEL_FACTOR = 100;

	const BASE_TABS = [
		{ id: 'posts', label: 'Posts' },
		{ id: 'reposts', label: 'Reposts' },
		{ id: 'reels', label: 'Reels' },
		{ id: 'about', label: 'Sobre mí' }
	];
	const OWNER_TABS = [
		{ id: 'history', label: 'Historial' },
		{ id: 'trash', label: 'Papelera' }
	];

	let tabs = $derived(isOwnProfile ? [...BASE_TABS, ...OWNER_TABS] : BASE_TABS);

	let currentXp = $derived(user?.xp_points || 0);
	let currentLevel = $derived(user?.level || 1);
	let currentLevelBaseXp = $derived(
		currentLevel <= 1 ? 0 : Math.pow(currentLevel - 1, 2) * XP_PER_LEVEL_FACTOR
	);
	let nextLevelBaseXp = $derived(Math.pow(currentLevel, 2) * XP_PER_LEVEL_FACTOR);
	let xpIntoLevel = $derived(currentXp - currentLevelBaseXp);
	let xpRequiredForNext = $derived(nextLevelBaseXp - currentLevelBaseXp);
	let xpPercentage = $derived(Math.min(100, Math.max(0, (xpIntoLevel / xpRequiredForNext) * 100)));

	function openCover() {
		if (!interactive || !user?.cover_url) return;
		mediaViewer.openProfileCover(user);
	}

	function openAvatar() {
		if (!interactive || !user?.avatar_url) return;
		mediaViewer.openProfileAvatar(user);
	}

	function pickCover(e) {
		e.stopPropagation();
		onCoverCamera?.();
	}

	function pickAvatar(e) {
		e.stopPropagation();
		onAvatarCamera?.();
	}

	let joinedDate = $derived.by(() => {
		try {
			return new Date(user?.created_at || user?.joined_at || Date.now()).toLocaleDateString('es', {
				month: 'long',
				year: 'numeric'
			});
		} catch {
			return '';
		}
	});

	const ACTION_STYLE =
		'white-space: nowrap; flex: 0 0 auto; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 20px; font-size: 0.9rem;';
</script>

<div class="profile-header-card glass-panel">
	<!-- Portada -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="profile-cover {user?.cover_url ? 'is-expandable' : ''}"
		onclick={openCover}
		title={interactive && user?.cover_url ? 'Ver foto de portada completa' : ''}
	>
		{#if user?.cover_url}
			<img
				src={user.cover_url}
				alt="Cover"
				width="1200"
				height="180"
				loading="eager"
				fetchpriority="high"
				decoding="async"
			/>
		{/if}
		<div class="cover-glow-bubble"></div>

		{#if interactive && isOwnProfile && onCoverCamera}
			<button
				type="button"
				class="profile-cover-camera-btn"
				onclick={pickCover}
				title="Cambiar portada (16:5)"
				aria-label="Cambiar foto de portada"
			>
				<span class="material-icons-round">photo_camera</span>
				<span class="btn-text">Cambiar portada</span>
			</button>
		{/if}
	</div>

	<!-- Avatar e identidad -->
	<div class="profile-header">
		<div class="avatar-and-names">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="profile-avatar {user?.avatar_url ? 'is-expandable' : ''}"
				onclick={openAvatar}
				title={interactive && user?.avatar_url ? 'Ver foto de perfil completa' : ''}
			>
				{#if user?.avatar_url}
					<img
						src={user.avatar_url}
						alt="Avatar de {user.display_name}"
						crossorigin="anonymous"
						width="84"
						height="84"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<div class="avatar-initials-fallback">
						{(user?.display_name || 'U').charAt(0).toUpperCase()}
					</div>
				{/if}

				{#if interactive && isOwnProfile && onAvatarCamera}
					<button
						type="button"
						class="profile-avatar-camera-btn"
						onclick={pickAvatar}
						title="Cambiar foto de perfil (1:1)"
						aria-label="Cambiar foto de perfil"
					>
						<span class="material-icons-round">photo_camera</span>
					</button>
				{/if}
			</div>
			<div class="profile-credentials">
				<div class="display-name-row">
					<h1 class="profile-display-name">{user?.display_name}</h1>
					<VerifiedBadge
						role={user?.role}
						isVerified={user?.is_verified == 1}
						size="24px"
						interactive={true}
					/>
					{#if user?.level != null}
						<LevelBadge level={user.level || 1} size="md" />
					{/if}
					{#if user?.title_text}
						<UserTitleBadge title={user.title_text} color={user.title_color} size="md" />
					{/if}
					{#if user?.is_virtual}
						<span class="aero-badge-virtual">VTuber</span>
					{/if}
				</div>
				<p class="profile-username">@{user?.username}</p>
			</div>
		</div>

		<div class="profile-actions-row">
			{#if isOwnProfile}
				{#if interactive}
					<a href="/settings" class="btn-aero-secondary" style={ACTION_STYLE}>
						<span class="material-icons-round text-[18px]">settings</span> Editar perfil
					</a>
				{:else}
					<span class="btn-aero-secondary" style={ACTION_STYLE}>
						<span class="material-icons-round text-[18px]">settings</span> Editar perfil
					</span>
				{/if}
			{:else if interactive}
				<button onclick={onStartDm} class="btn-aero-secondary" style={ACTION_STYLE}>
					<span class="material-icons-round text-[18px]">message</span> Mensaje
				</button>
				<button
					class="profile-follow-btn"
					class:following={followingState}
					onclick={onToggleFollow}
				>
					{followingState ? 'Siguiendo' : 'Seguir'}
				</button>
			{:else}
				<span class="btn-aero-secondary" style={ACTION_STYLE}>
					<span class="material-icons-round text-[18px]">message</span> Mensaje
				</span>
				<span class="profile-follow-btn">Seguir</span>
			{/if}

			{#if user?.payment_link}
				{#if interactive}
					<a
						href={user.payment_link}
						target="_blank"
						rel="noopener noreferrer nofollow"
						class="btn-aero-primary profile-pay-btn"
						title="Apoyar a {user.display_name || user.username}"
					>
						<span class="material-icons-round text-[18px]">payments</span> Apoyar
					</a>
				{:else}
					<span
						class="btn-aero-primary profile-pay-btn"
						title="Apoyar a {user.display_name || user.username}"
					>
						<span class="material-icons-round text-[18px]">payments</span> Apoyar
					</span>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Stats -->
	<div class="profile-stats-bar">
		<div class="stat-col">
			<span class="stat-num">{postsCount}</span>
			<span class="stat-label">Publicaciones</span>
		</div>
		{#if interactive}
			<a href="/u/{user.username}/following?tab=followers" class="stat-col interactive">
				<span class="stat-num">{followersCount}</span>
				<span class="stat-label">Seguidores</span>
			</a>
			<a href="/u/{user.username}/following?tab=following" class="stat-col interactive">
				<span class="stat-num">{user.following_count || 0}</span>
				<span class="stat-label">Siguiendo</span>
			</a>
		{:else}
			<div class="stat-col">
				<span class="stat-num">{followersCount}</span>
				<span class="stat-label">Seguidores</span>
			</div>
			<div class="stat-col">
				<span class="stat-num">{user?.following_count || 0}</span>
				<span class="stat-label">Siguiendo</span>
			</div>
		{/if}
	</div>

	<!-- XP -->
	<div class="profile-xp-container">
		<div class="profile-xp-header">
			<span class="xp-current">{currentXp} XP</span>
			<span class="xp-level">Lv. {currentLevel + 1} ({nextLevelBaseXp} XP)</span>
		</div>
		<div class="xp-bar-track">
			<div class="xp-bar-fill" style="width: {xpPercentage}%"></div>
		</div>
	</div>

	<!-- Bio / meta -->
	<div class="profile-details-block">
		{#if user?.bio}
			<p class="profile-bio">{@html formatHashtags(user.bio)}</p>
		{/if}

		<div class="profile-meta-row">
			{#if user?.location}
				<span class="meta-item">
					<span class="material-icons-round" style="font-size: 0.9rem;">place</span>
					{user.location}
				</span>
			{/if}
			{#if user?.website}
				<span class="meta-item">
					<span class="material-icons-round" style="font-size: 0.9rem;">link</span>
					{#if interactive}
						<a href={user.website} target="_blank" rel="noopener noreferrer" class="meta-link"
							>{user.website}</a
						>
					{:else}
						<span class="meta-link">{user.website}</span>
					{/if}
				</span>
			{/if}
			<span class="meta-item">
				<span class="material-icons-round" style="font-size: 0.9rem;">calendar_today</span>
				Se unió en {joinedDate}
			</span>
		</div>
	</div>

	<!-- Tabs -->
	<div class="tabs-container">
		{#each tabs as tab (tab.id)}
			{#if interactive}
				<button
					onclick={() => onTabSelect(tab.id)}
					class="tab-button"
					class:active={activeTab === tab.id}
				>
					{tab.label}
				</button>
			{:else}
				<span class="tab-button" class:active={activeTab === tab.id} aria-hidden="true"
					>{tab.label}</span
				>
			{/if}
		{/each}
	</div>
</div>

<style>
	.profile-header-card {
		display: flex;
		flex-direction: column;
		/* El glass del header (backdrop-filter + transform de .glass-panel) crea
		   un containing block que descuadra los modales position:fixed (p. ej.
		   el de borrar post queda anclado a la tarjeta en vez del viewport), y
		   overflow:clip los recortaría. Neutralizamos ambos SOLO en la tarjeta
		   del perfil: el efecto glass lo aportan la portada y el fondo propio,
		   y las esquinas redondeadas las recorta la portada con su overflow. */
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
		transform: none;
		/* will-change: transform (lo activa .glass-panel:hover) también crea
		   containing block — lo desactivamos para que el modal fixed se centre
		   en el viewport de verdad. */
		will-change: auto;
		contain: none;
		/* Sin isolation: isolate — crearía un stacking context que atraparía
		   al modal (z-index alto) por debajo de los tabs sticky (z-index 40)
		   y del bloque del perfil al hacer scroll. */
		isolation: auto;
		overflow: visible;
	}

	.profile-cover {
		width: 100%;
		height: 200px;
		background: var(--grad-primary);
		border-top-left-radius: var(--radius-lg);
		border-top-right-radius: var(--radius-lg);
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
		position: relative;
		overflow: hidden;
		box-shadow: inset 0 -12px 30px rgba(0, 0, 0, 0.08);
	}

	.profile-cover.is-expandable {
		cursor: pointer;
	}

	.profile-cover.is-expandable:hover img {
		filter: brightness(1.04);
		transition: filter 0.25s ease;
	}

	.profile-cover-camera-btn {
		position: absolute;
		top: 14px;
		right: 14px;
		z-index: 8;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: #ffffff;
		border-radius: var(--radius-full);
		padding: 6px 14px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-shadow: var(--shadow-sm), var(--shadow-glow);
		transition:
			background var(--t-fast),
			border-color var(--t-fast),
			transform var(--t-fast);
	}

	.profile-cover-camera-btn:hover {
		background: var(--aero-blue);
		border-color: #ffffff;
		transform: translateY(-1px);
	}

	.profile-cover-camera-btn:active {
		transform: translateY(1px);
	}

	.profile-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center center;
		opacity: 1; /* override the container opacity for images */
		display: block;
	}

	@media (max-width: 768px) {
		/* Portada más baja en móvil: el header queda más compacto y los tabs no
		   caen detrás de la barra de navegación flotante. */
		.profile-cover {
			height: 150px;
		}
	}

	@media (max-width: 576px) {
		/* En pantallas estrechas la portada se acorta más para que los tabs
		   queden por encima del nav flotante. */
		.profile-cover {
			height: 96px;
		}
	}

	.cover-glow-bubble {
		position: absolute;
		bottom: -40px;
		right: 40px;
		width: 140px;
		height: 140px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: rgba(255, 255, 255, 0.25);
		filter: blur(40px);
		pointer-events: none;
	}

	.profile-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px 0;
		position: relative;
		z-index: 10;
		gap: 16px;
		flex-wrap: wrap;
	}

	@media (max-width: 576px) {
		.profile-header {
			flex-direction: column;
			align-items: flex-start;
			padding: 0 16px 8px;
			gap: 10px;
		}
	}

	.avatar-and-names {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: -50px;
	}

	@media (max-width: 576px) {
		.avatar-and-names {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
			margin-top: 0;
		}
	}

	.profile-avatar {
		width: 84px;
		height: 84px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		padding: 3px;
		background: var(--bg-surface);
		box-shadow: var(--shadow-sm), var(--shadow-glow);
		overflow: hidden;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		transition: box-shadow 0.25s ease;
	}

	.profile-avatar.is-expandable {
		cursor: pointer;
	}

	.profile-avatar.is-expandable:hover {
		box-shadow: 0 0 16px rgba(27, 133, 243, 0.35);
	}

	.profile-avatar-camera-btn {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		border: none;
		border-radius: inherit;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-size: 24px;
		opacity: 0;
		cursor: pointer;
		transition: opacity var(--t-fast);
		z-index: 5;
	}

	.profile-avatar:hover .profile-avatar-camera-btn,
	.profile-avatar-camera-btn:focus-visible {
		opacity: 1;
	}

	@media (max-width: 576px) {
		.profile-avatar {
			margin-top: -30px;
			width: 68px;
			height: 68px;
		}
		.profile-avatar img {
			width: 68px;
			height: 68px;
		}
	}

	.profile-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center center;
		border-radius: calc(var(--radius-squircle) - 2px);
		corner-shape: squircle;
		display: block;
	}

	.avatar-initials-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--grad-primary);
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		color: #fff;
		font-size: 2rem;
		font-weight: 900;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.profile-credentials {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 36px;
	}

	@media (max-width: 576px) {
		.profile-credentials {
			margin-top: 0;
		}
	}

	.display-name-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.profile-display-name {
		font-size: 1.4rem;
		font-weight: 900;
		color: var(--text-primary);
		margin: 0;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
	}

	.profile-username {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}

	.profile-actions-row {
		display: flex;
		gap: 10px;
		margin-top: 10px;
		flex-wrap: wrap;
	}

	.profile-pay-btn {
		white-space: nowrap;
		flex: 0 0 auto;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 0 20px;
		font-size: 0.9rem;
	}

	@media (max-width: 576px) {
		.profile-actions-row {
			margin-top: 0;
		}
	}

	.profile-stats-bar {
		display: flex;
		justify-content: flex-start;
		gap: 24px;
		padding: 14px 24px;
		border-top: 1px solid var(--border-subtle);
		border-bottom: 1px solid var(--border-subtle);
		margin: 20px 24px 0 24px;
		font-size: 0.85rem;
	}

	@media (max-width: 576px) {
		.profile-stats-bar {
			justify-content: space-between;
			gap: 0;
			margin: 8px 16px 0 16px;
			padding: 8px 0;
		}
	}

	@media (max-width: 360px) {
		/* En pantallas muy estrechas las tres estadísticas se comprimen para no
		   desbordar la barra. */
		.profile-stats-bar .stat-col {
			flex: 1 1 0;
			justify-content: center;
			padding: 4px 2px;
			text-align: center;
		}
	}

	.stat-col {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		border-radius: var(--radius-sm);
		padding: 4px 8px;
		transition: background var(--t-fast);
	}
	a.stat-col.interactive:hover {
		background: var(--bg-surface-hover);
	}

	@media (max-width: 576px) {
		.stat-col {
			flex-direction: column;
			gap: 2px;
		}
	}

	.stat-num {
		font-weight: 900;
		color: var(--text-main);
		font-size: 0.95rem;
	}

	@media (max-width: 576px) {
		.stat-num {
			font-size: 1rem;
		}
	}

	.stat-label {
		color: var(--text-muted);
	}

	.profile-xp-container {
		padding: 16px 24px;
		margin: 0 24px;
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	@media (max-width: 576px) {
		.profile-xp-container {
			margin: 0 16px;
			padding: 6px 0;
		}
	}

	@media (max-height: 700px) and (max-width: 576px) {
		/* En viewports bajos (móvil con mucho chrome de navegador) la barra de XP
		   se oculta del header para que los tabs queden por encima del nav
		   flotante y no se encimen con sus etiquetas. */
		.profile-xp-container {
			display: none;
		}
	}

	.profile-xp-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
		color: var(--text-secondary);
		font-weight: 600;
	}

	.xp-current {
		color: var(--aero-blue);
		font-weight: 800;
	}

	.xp-level {
		font-family: var(--font-sans);
		opacity: 0.8;
	}

	.xp-bar-track {
		width: 100%;
		height: 8px;
		background: rgba(0, 0, 0, 0.08);
		border-radius: var(--radius-sm);
		overflow: hidden;
		position: relative;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	:global([data-theme='dark']) .xp-bar-track {
		background: rgba(255, 255, 255, 0.06);
	}

	.xp-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--aero-sky), var(--aero-blue));
		border-radius: var(--radius-sm);
		box-shadow: 0 0 12px rgba(var(--accent-blue-rgb), 0.35);
		transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.profile-details-block {
		padding: 0 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 16px;
	}

	@media (max-width: 576px) {
		.profile-details-block {
			padding: 0 16px;
			margin-top: 6px;
		}
	}

	.profile-bio {
		font-size: 0.85rem;
		color: var(--text-primary);
		line-height: 1.5;
		margin: 0;
		max-width: 640px;
	}

	.profile-meta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.meta-link {
		color: var(--aero-sky);
		text-decoration: none;
		font-weight: 600;
	}

	a.meta-link:hover {
		text-decoration: underline;
	}

	.tabs-container {
		/* Sticky bajo la TopBar global (58px): al hacer scroll los tabs quedan
		   siempre accesibles y nunca se cuelan bajo el nav inferior flotante. */
		position: sticky;
		top: 58px;
		z-index: 40;
		margin: 24px 0 0;
		padding: 0 24px;
		background: var(--bg-surface-solid, var(--bg-canvas, #0f172a));
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--border-subtle);
		display: flex;
		gap: 12px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tabs-container::-webkit-scrollbar {
		display: none;
	}

	@media (max-width: 576px) {
		.tabs-container {
			margin: 8px 0 0;
			padding: 0 16px;
		}
	}

	.tab-button {
		padding: 12px 20px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-muted);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	button.tab-button:hover {
		color: var(--text-main);
	}

	.tab-button.active {
		color: var(--aero-blue);
		font-weight: 700;
		border-bottom-color: var(--aero-blue);
		text-shadow: 0 0 8px rgba(46, 134, 232, 0.3);
	}

	.tabs-container span.tab-button {
		cursor: default;
	}

	.profile-follow-btn {
		background: var(--grad-primary);
		color: var(--text-on-accent, white);
		font-size: 0.9rem;
		font-weight: 700;
		padding: 0 16px;
		border-radius: var(--radius-xl);
		border: 1px solid transparent;
		box-shadow:
			0 4px 12px rgba(14, 165, 233, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.3);
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		cursor: pointer;
		min-width: 110px;
		min-height: 44px;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}
	button.profile-follow-btn:hover {
		transform: translateY(-2px) scale(1.02);
		box-shadow:
			0 6px 16px rgba(14, 165, 233, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.4);
		background: var(--grad-primary-hover, linear-gradient(135deg, #0ea5e9, #3b82f6));
	}
	button.profile-follow-btn:active {
		transform: translateY(1px) scale(0.98);
		box-shadow: 0 2px 8px rgba(14, 165, 233, 0.2);
	}
	button.profile-follow-btn.following {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
		border: 1px solid rgba(255, 255, 255, 0.2);
		box-shadow: none;
		text-shadow: none;
	}
	button.profile-follow-btn.following:hover {
		background: rgba(244, 63, 94, 0.1);
		color: var(--rose-500, #f43f5e);
		border-color: rgba(244, 63, 94, 0.3);
		box-shadow: 0 0 12px rgba(244, 63, 94, 0.1);
	}

	:global([data-theme='light']) button.profile-follow-btn.following {
		background: rgba(14, 165, 233, 0.08);
		border-color: rgba(14, 165, 233, 0.25);
		color: var(--text-primary);
	}
</style>
