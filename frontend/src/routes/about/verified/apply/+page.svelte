<script>
	import { fade } from 'svelte/transition';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';

	const portals = [
		{
			id: 'creator',
			icon: 'palette',
			title: 'Creadores & Artistas Visuales',
			subtitle: 'Ilustradores, modeladores 3D, animadores, diseñadores y concept artists.',
			tag: 'Arte & Diseño',
			color: 'var(--aero-mint)',
			badgeLabel: 'VERIFICADO',
			badgeRole: 'verified',
			isVerified: true,
			desc: 'Canal especializado para creadores con portafolio demostrable y obras originales. Validación de autoría y vinculación cruzada de perfiles.',
			features: [
				'Auditoría de portafolios (ArtStation, Behance, Cara, Pixiv)',
				'Verificación de autoría de obras y software creativo',
				'Insignia Aero Blue oficial en perfil y feed',
				'Protección activa de portafolio y marca artística'
			],
			href: '/about/verified/apply/creator',
			btnText: 'Iniciar Auditoría de Creador'
		},
		{
			id: 'streamer',
			icon: 'videocam',
			title: 'Streamers & Talentos VTuber',
			subtitle:
				'Creadores en vivo, streamers de videojuegos, talentos virtuales 2D/3D y PNGTubers.',
			tag: 'Live & Virtual',
			color: 'var(--aero-coral)',
			badgeLabel: 'VERIFICADO',
			badgeRole: 'verified',
			isVerified: true,
			desc: 'Canal adaptado para la comunidad de streaming y VTubers. Registro de créditos de identidad virtual (Mama/Papa) y vinculación en directo.',
			features: [
				'Auditoría de canales (Twitch, YouTube Gaming, Kick)',
				'Registro de derechos de modelo e ilustrador/rigger',
				'Comando de verificación en directo para canales activos',
				'Protección estricta contra suplantación de avatar'
			],
			href: '/about/verified/apply/streamer',
			btnText: 'Iniciar Auditoría de Streamer'
		},
		{
			id: 'organization',
			icon: 'business',
			title: 'Organizaciones & Estudios',
			subtitle: 'Agencias de VTubers, estudios de videojuegos indie, productoras y colectivos.',
			tag: 'Estudios & Agencias',
			color: 'var(--aero-sky)',
			badgeLabel: 'ORGANIZACIÓN',
			badgeRole: 'verified',
			isVerified: true,
			desc: 'Canal corporativo para empresas del entretenimiento virtual. Exige correo corporativo institucional y acreditación de personería jurídica.',
			features: [
				'Validación de razón social y registro fiscal de empresa',
				'Requisito de correo institucional corporativo (@estudio.com)',
				'Acreditación de catálogo, producciones y roster de talentos',
				'Canal de comunicación directa con equipo de soporte'
			],
			href: '/about/verified/apply/organization',
			btnText: 'Iniciar Auditoría Corporativa'
		},
		{
			id: 'government',
			icon: 'account_balance',
			title: 'Gobierno & Organismos Oficiales',
			subtitle:
				'Ministerios, embajadas, agencias estatales, autoridades legales y servicios públicos.',
			tag: 'Vía Diplomática & Legal',
			color: 'var(--badge-gov)',
			badgeLabel: 'GOBIERNO',
			badgeRole: 'government',
			isVerified: false,
			isGov: true,
			desc: 'Portal institucional solemne de fe pública y soberanía de Estado. Validación criptográfica rigurosa y obligatoria de dominios gubernamentales oficiales.',
			features: [
				'Exigencia estricta de dominio oficial (.gob / .gov / .mil / .int)',
				'Respaldo mediante Decreto, Gaceta Oficial o Resolución de Estado',
				'Insignia Titanium Slate de Soberanía Institucional (Nivel 5)',
				'Escudo criptográfico máximo contra spoofing y desinformación'
			],
			href: '/about/verified/apply/government',
			btnText: 'Acceder a Vía Diplomática & Estatal'
		},
		{
			id: 'public',
			icon: 'public',
			title: 'Personalidades Públicas',
			subtitle:
				'Músicos, periodistas, atletas, escritores y figuras con presencia pública acreditada.',
			tag: 'Notoriedad Pública',
			color: 'var(--aero-amber)',
			badgeLabel: 'VERIFICADO',
			badgeRole: 'verified',
			isVerified: true,
			desc: 'Canal para figuras con notoriedad en medios de comunicación, industria musical, editorial o científica. Auditoría confidencial protegida bajo RGPD.',
			features: [
				'Comprobación de cobertura en medios de prensa acreditados',
				'Validación de perfiles en Wikipedia, IMDB, Spotify, etc.',
				'Contacto con agencias de representación o mánager',
				'Cotejo humano privado de identidad conforme a la ley'
			],
			href: '/about/verified/apply/public',
			btnText: 'Iniciar Auditoría de Personalidad'
		}
	];
</script>

<svelte:head>
	<title>Portal de Auditoría y Verificación - V-SOCIAL</title>
	<meta
		name="description"
		content="Selecciona el canal de verificación correspondiente para iniciar tu proceso de auditoría oficial de identidad en V-SOCIAL."
	/>
</svelte:head>

<div class="apply-hub-container" in:fade={{ duration: 500 }}>
	<!-- Top Navigation Bar -->
	<div class="top-nav-bar">
		<a href="/about/verified" class="back-link glass-panel">
			<span class="material-icons-round text-base">arrow_back</span>
			<span>Volver a Jerarquía de Insignias</span>
		</a>
		<div class="badge-status-chip">
			<span class="status-dot"></span>
			<span>Auditoría Humana & Criptográfica Activa</span>
		</div>
	</div>

	<!-- Header Hero Section -->
	<header class="hub-header">
		<div class="hub-emblem-badge">
			<span class="material-icons-round text-4xl">verified_user</span>
		</div>
		<h1 class="hub-title">
			Portal Oficial de <span class="gradient-text">Auditoría & Verificación</span>
		</h1>
		<p class="hub-subtitle">
			En V-SOCIAL, las insignias no se compran. Cada distintivo es emitido tras una auditoría
			rigurosa adaptada a las características y evidencias de cada sector.
		</p>

		<div class="hub-guarantees glass-panel">
			<div class="guarantee-item">
				<span class="material-icons-round guarantee-icon" style="color: var(--aero-mint);"
					>verified</span
				>
				<div class="guarantee-text">
					<strong>100% Gratuito & Mérito</strong>
					<p>Sin suscripciones pay-to-win</p>
				</div>
			</div>
			<div class="guarantee-item">
				<span class="material-icons-round guarantee-icon" style="color: var(--aero-sky);"
					>person_search</span
				>
				<div class="guarantee-text">
					<strong>Auditoría Humana</strong>
					<p>Evaluación manual sin algoritmos opacos</p>
				</div>
			</div>
			<div class="guarantee-item">
				<span class="material-icons-round guarantee-icon" style="color: var(--aero-amber);"
					>lock</span
				>
				<div class="guarantee-text">
					<strong>Folio Criptográfico</strong>
					<p>Trazabilidad segura y estricta</p>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Portals Grid -->
	<section class="portals-section">
		<h2 class="section-heading">Selecciona tu Canal de Auditoría</h2>
		<p class="section-subheading">
			Elige la categoría que corresponde a tu perfil para acceder a su portal y formulario
			específico:
		</p>

		<div class="portals-grid">
			{#each portals as portal}
				<div
					class="portal-card glass-card aero-card {portal.isGov ? 'is-gov-portal' : ''}"
					style="--portal-accent: {portal.color};"
				>
					<div class="portal-card-top">
						<div class="portal-icon-box" style="color: {portal.color};">
							<span class="material-icons-round portal-icon">{portal.icon}</span>
						</div>
						<div class="portal-badge-preview">
							<VerifiedBadge
								role={portal.badgeRole}
								isVerified={portal.isVerified}
								size="17px"
								interactive={false}
							/>
							<span class="portal-tag">{portal.tag}</span>
						</div>
					</div>

					<div class="portal-content">
						<h3 class="portal-title">{portal.title}</h3>
						<p class="portal-subtitle">{portal.subtitle}</p>
						<p class="portal-desc">{portal.desc}</p>

						<div class="portal-features-box">
							<h4 class="features-title">Requisitos & Evidencias del Canal:</h4>
							<ul class="features-list">
								{#each portal.features as feature}
									<li>
										<span class="material-icons-round text-sm" style="color: {portal.color};"
											>check_circle</span
										>
										<span>{feature}</span>
									</li>
								{/each}
							</ul>
						</div>
					</div>

					<div class="portal-card-footer">
						<a
							href={portal.href}
							class="btn-aero-primary portal-action-btn {portal.isGov ? 'btn-gov-portal' : ''}"
						>
							<span class="material-icons-round text-base"
								>{portal.isGov ? 'policy' : 'arrow_forward'}</span
							>
							<span>{portal.btnText}</span>
						</a>
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	.apply-hub-container {
		padding: 1.5rem 1.25rem 5rem;
		max-width: 1200px;
		margin: 0 auto;
		position: relative;
		z-index: 1;
		min-height: 100vh;
	}

	.gradient-text {
		background: linear-gradient(
			135deg,
			var(--aero-blue) 0%,
			var(--aero-sky) 50%,
			var(--aero-mint) 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		display: inline-block;
	}

	.top-nav-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 2.2rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--text-primary);
		text-decoration: none;
		font-weight: 700;
		font-size: 0.88rem;
		padding: 0.45rem 1rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		transition: all 0.25s var(--ease-spring);
	}

	.back-link:hover {
		color: var(--aero-blue);
		transform: translateX(-3px);
		border-color: var(--aero-blue);
		box-shadow: 0 4px 16px rgba(27, 133, 243, 0.2);
	}

	.badge-status-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-secondary);
		padding: 0.35rem 0.8rem;
		border-radius: var(--radius-full);
		background: rgba(0, 212, 170, 0.08);
		border: 1px solid rgba(0, 212, 170, 0.25);
	}

	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: var(--radius-full);
		background: var(--aero-mint);
		box-shadow: 0 0 8px var(--aero-mint);
		animation: pulseDot 2s infinite ease-in-out;
		flex: 0 0 7px;
	}

	@keyframes pulseDot {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.3);
			opacity: 0.6;
		}
	}

	.hub-header {
		text-align: center;
		margin-bottom: 3.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.hub-emblem-badge {
		width: 76px;
		height: 76px;
		border-radius: var(--radius-xl);
		background: linear-gradient(135deg, var(--aero-blue) 0%, var(--aero-sky) 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.2rem;
		box-shadow:
			0 12px 30px rgba(27, 133, 243, 0.4),
			inset 0 2px 3px rgba(255, 255, 255, 0.6);
	}

	.hub-title {
		font-size: clamp(2rem, 4vw, 3rem);
		font-weight: 900;
		font-family: var(--font-display);
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin-bottom: 0.75rem;
	}

	.hub-subtitle {
		font-size: 1.1rem;
		color: var(--text-secondary);
		max-width: 650px;
		margin: 0 auto 2rem;
		line-height: 1.6;
	}

	.hub-guarantees {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.5rem;
		padding: 1.25rem 2rem;
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-subtle);
		max-width: 850px;
		width: 100%;
	}

	@media (max-width: 768px) {
		.hub-guarantees {
			grid-template-columns: 1fr;
			gap: 1rem;
			padding: 1.2rem;
		}
	}

	.guarantee-item {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		text-align: left;
	}

	.guarantee-icon {
		font-size: 28px;
		flex: 0 0 28px;
	}

	.guarantee-text strong {
		display: block;
		font-size: 0.88rem;
		color: var(--text-primary);
	}

	.guarantee-text p {
		font-size: 0.76rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.portals-section {
		margin-top: 2rem;
	}

	.section-heading {
		font-size: 1.7rem;
		font-weight: 900;
		font-family: var(--font-display);
		color: var(--text-primary);
		text-align: center;
		margin-bottom: 0.4rem;
	}

	.section-subheading {
		font-size: 0.95rem;
		color: var(--text-secondary);
		text-align: center;
		max-width: 580px;
		margin: 0 auto 2.5rem;
	}

	.portals-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
		gap: 1.6rem;
	}

	.portal-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 2rem;
		border-radius: var(--radius-xl);
		border: 1.5px solid var(--border-subtle);
		background: var(--bg-surface);
		transition: all 0.3s var(--ease-spring);
		position: relative;
		overflow: hidden;
	}

	.portal-card:hover {
		transform: translateY(-4px);
		border-color: var(--portal-accent);
		box-shadow:
			0 16px 36px rgba(0, 0, 0, 0.15),
			0 0 25px color-mix(in srgb, var(--portal-accent) 15%, transparent);
	}

	.portal-card.is-gov-portal {
		border-color: rgba(148, 163, 184, 0.4);
		background: linear-gradient(160deg, rgba(148, 163, 184, 0.08) 0%, var(--bg-surface) 100%);
	}

	.portal-card.is-gov-portal:hover {
		border-color: var(--badge-gov);
		box-shadow:
			0 16px 40px rgba(0, 0, 0, 0.3),
			0 0 30px rgba(148, 163, 184, 0.22);
	}

	.portal-card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.4rem;
	}

	.portal-icon-box {
		width: 52px;
		height: 52px;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--portal-accent) 12%, transparent);
		border: 1.5px solid var(--portal-accent);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 14px color-mix(in srgb, var(--portal-accent) 20%, transparent);
	}

	.portal-icon {
		font-size: 28px;
	}

	.portal-badge-preview {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.portal-tag {
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 3px 8px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid var(--border-subtle);
		color: var(--text-muted);
	}

	.portal-title {
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.3rem;
		letter-spacing: -0.01em;
	}

	.portal-subtitle {
		font-size: 0.84rem;
		font-weight: 600;
		color: var(--portal-accent);
		margin-bottom: 0.85rem;
		line-height: 1.4;
	}

	.portal-desc {
		font-size: 0.85rem;
		color: var(--text-secondary);
		line-height: 1.55;
		margin-bottom: 1.3rem;
	}

	.portal-features-box {
		padding: 1rem;
		border-radius: var(--radius-md);
		background: rgba(0, 0, 0, 0.04);
		border: 1px solid var(--border-subtle);
		margin-bottom: 1.5rem;
	}

	:global([data-theme='dark']) .portal-features-box,
	:global([data-theme='midnight']) .portal-features-box {
		background: rgba(0, 0, 0, 0.25);
	}

	.features-title {
		font-size: 0.76rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		margin-bottom: 0.6rem;
	}

	.features-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.features-list li {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		line-height: 1.35;
	}

	.features-list li span:first-child {
		margin-top: 1px;
	}

	.portal-card-footer {
		margin-top: auto;
		padding-top: 0.5rem;
	}

	.portal-action-btn {
		width: 100%;
		padding: 0.8rem 1.2rem;
		font-weight: 800;
		font-size: 0.9rem;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		text-decoration: none;
		box-shadow: 0 6px 18px color-mix(in srgb, var(--portal-accent) 25%, transparent);
	}

	.btn-gov-portal {
		background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%) !important;
		box-shadow: 0 6px 20px rgba(100, 116, 139, 0.4) !important;
	}

	@media (max-width: 640px) {
		.apply-hub-container {
			padding: 1rem 0.85rem 4rem;
		}

		.portals-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
