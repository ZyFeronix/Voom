<script>
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import CustomSelect from '$lib/components/CustomSelect.svelte';
	import { verification } from '$lib/api.js';
	import { authStore } from '$lib/stores/auth.svelte.js';

	const creatorSpecialtyOptions = [
		{ value: 'Ilustración 2D', label: 'Ilustración 2D / Digital Painting' },
		{ value: 'Modelado 3D / Escultura', label: 'Modelado 3D / Escultura Digital' },
		{ value: 'Animación 2D / 3D', label: 'Animación 2D / 3D & Motion' },
		{ value: 'Rigging Live2D / 3D', label: 'Rigging Live2D / 3D Rigging' },
		{ value: 'Concept Art & Matte', label: 'Concept Art & Matte Painting' },
		{ value: 'UI/UX & Visual Design', label: 'UI/UX & Diseño Visual' },
		{ value: 'Cómic / Manga', label: 'Cómic / Manga / Webtoon' },
		{ value: 'Otro', label: 'Otro Arte Visual' }
	];

	const streamerTypeOptions = [
		{ value: 'VTuber 2D', label: 'VTuber 2D (Live2D)' },
		{ value: 'VTuber 3D', label: 'VTuber 3D (VRoid / Custom 3D)' },
		{ value: 'Streamer Facecam / IRL', label: 'Streamer Facecam / Gaming / IRL' },
		{ value: 'PNGTuber / Híbrido', label: 'PNGTuber / Creador Híbrido' }
	];

	const streamerPartnerOptions = [
		{ value: 'Partner / Monetizado', label: 'Partner Oficial (Twitch / YouTube / Kick)' },
		{ value: 'Afiliado Activo', label: 'Afiliado / Creador en Crecimiento' },
		{ value: 'Creador Independiente', label: 'Creador Independiente con Comunidad Activa' }
	];

	const orgTypeOptions = [
		{ value: 'Agencia de Talentos / VTubers', label: 'Agencia de Talentos / VTubers' },
		{ value: 'Estudio de Videojuegos Indie', label: 'Estudio de Videojuegos Indie' },
		{ value: 'Productora de Animación', label: 'Productora de Animación & VFX' },
		{ value: 'Sello Discográfico / Colectivo', label: 'Sello Discográfico / Colectivo Artístico' },
		{ value: 'Editorial / Medio Digital', label: 'Editorial / Medio Digital' }
	];

	const publicDomainOptions = [
		{ value: 'Música / Producción', label: 'Música / Producción Musical' },
		{ value: 'Periodismo / Medios', label: 'Periodismo / Medios de Comunicación' },
		{ value: 'Deporte Profesional', label: 'Deporte Profesional / Atletas' },
		{ value: 'Literatura / Editorial', label: 'Literatura / Autores & Editores' },
		{ value: 'Actuación / Cine / TV', label: 'Actuación / Cine / Televisión' },
		{ value: 'Ciencia & Divulgación', label: 'Ciencia / Academia & Divulgación' }
	];

	let { data } = $props();
	let currentCatKey = $derived(data.category || 'creator');

	const portalConfigs = {
		creator: {
			id: 'creator',
			icon: 'palette',
			title: 'Auditoría para Creadores & Artistas',
			subtitle:
				'Validación de portafolios originales, autoría humana y presencia artística en la comunidad.',
			tag: 'Arte & Diseño',
			color: 'var(--aero-mint)',
			badgeLabel: 'VERIFICADO',
			badgeRole: 'verified',
			isVerified: true,
			level: 'Nivel 4 — Autenticidad',
			sla: '48 a 72 horas hábiles',
			heroDesc:
				'Este canal audita la autenticidad y titularidad de portafolios artísticos digitales, 2D, 3D, animación y diseño visual.',
			checklist: [
				'Portafolio público y activo con al menos 6 piezas originales',
				'Demostración de autoría humana y proceso creativo',
				'Mención cruzada hacia V-SOCIAL en perfil o post principal',
				'Perfil completo en V-SOCIAL con avatar, portada y biografía'
			]
		},
		streamer: {
			id: 'streamer',
			icon: 'videocam',
			title: 'Auditoría para Streamers & VTubers',
			subtitle:
				'Autenticación de canales de transmisión en vivo y registro de identidad virtual/modelos.',
			tag: 'Live & Virtual',
			color: 'var(--aero-coral)',
			badgeLabel: 'VERIFICADO',
			badgeRole: 'verified',
			isVerified: true,
			level: 'Nivel 4 — Autenticidad',
			sla: '48 a 72 horas hábiles',
			heroDesc:
				'Canal especializado para creadores en streaming y talentos VTuber. Verificación de licencias de avatar y directos en vivo.',
			checklist: [
				'Canal activo de transmisión en Twitch, YouTube o Kick',
				'Créditos comprobables del ilustrador (Mama) y rigger (Papa)',
				'Estatus de Partner, Afiliado o comunidad activa demostrable',
				'Prueba de vinculación mediante comando de chat o bio de canal'
			]
		},
		organization: {
			id: 'organization',
			icon: 'business',
			title: 'Auditoría para Organizaciones & Estudios',
			subtitle:
				'Acreditación de personería jurídica, productoras, agencias de VTubers y colectivos.',
			tag: 'Estudios & Agencias',
			color: 'var(--aero-sky)',
			badgeLabel: 'ORGANIZACIÓN',
			badgeRole: 'verified',
			isVerified: true,
			level: 'Nivel 4 — Corporativo',
			sla: '24 a 48 horas hábiles',
			heroDesc:
				'Canal corporativo para empresas del entretenimiento virtual. Exige correo corporativo institucional y representación legal.',
			checklist: [
				'Razón social y registro fiscal o mercantil de la empresa',
				'Correo corporativo bajo dominio web oficial (@estudio.com)',
				'Catálogo de producciones, videojuegos o talentos gestionados',
				'Acreditación de funciones y cargo del solicitante'
			]
		},
		government: {
			id: 'government',
			icon: 'account_balance',
			title: 'Portal de Acreditación Gubernamental & Legal',
			subtitle:
				'Protocolo de validación institucional de soberanía, fe pública y canales oficiales del Estado.',
			tag: 'Vía Diplomática & Legal',
			color: 'var(--badge-gov)',
			badgeLabel: 'GOBIERNO',
			badgeRole: 'government',
			isVerified: false,
			isGov: true,
			level: 'Nivel 5 — Estado y Ley',
			sla: '24 horas prioritarias',
			heroDesc:
				'Vía de uso estricto para entidades estatales, diplomáticas y autoridades legales. Validación criptográfica de dominios oficiales (.gob / .gov / .mil / .int).',
			checklist: [
				'Dominio y correo institucional del Estado (.gob, .gov, .mil, .int)',
				'Respaldo mediante Decreto, Gaceta Oficial o Resolución Ministerial',
				'Designación formal del funcionario o delegado de prensa',
				'Declaración bajo fe pública de representación estatal'
			]
		},
		public: {
			id: 'public',
			icon: 'public',
			title: 'Auditoría para Personalidades Públicas',
			subtitle:
				'Verificación de notoriedad en medios de comunicación, industria cultural, deporte o academia.',
			tag: 'Notoriedad Pública',
			color: 'var(--aero-amber)',
			badgeLabel: 'VERIFICADO',
			badgeRole: 'verified',
			isVerified: true,
			level: 'Nivel 4 — Notoriedad',
			sla: '48 a 72 horas hábiles',
			heroDesc:
				'Canal para figuras públicas con cobertura acreditada en prensa, Wikipedia, IMDB o plataformas de la industria.',
			checklist: [
				'Enlaces a cobertura en medios de prensa nacional o internacional',
				'Perfiles indexados en Wikipedia, IMDB, Spotify for Artists, etc.',
				'Contacto con agencia de representación, sello discográfico o mánager',
				'Cotejo humano y privado de identidad bajo normativas RGPD'
			]
		}
	};

	let cfg = $derived(portalConfigs[currentCatKey] || portalConfigs.creator);

	// Form State
	let formStep = $state('form'); // 'form' | 'success'
	let applicantHandle = $state('');
	let applicantContactEmail = $state('');
	let applicantFolio = $state('');
	let copiedFolio = $state(false);
	let isSubmitting = $state(false);
	let submitError = $state('');

	onMount(() => {
		if (authStore.user) {
			if (!applicantHandle) applicantHandle = authStore.user.username || '';
			if (!applicantContactEmail) applicantContactEmail = authStore.user.email || '';
		}
	});

	// Category 1: Creator
	let creatorSpecialty = $state('Ilustración 2D');
	let creatorPortfolios = $state('');
	let creatorProofLink = $state('');
	let creatorSoftware = $state('');
	let creatorAck = $state(false);

	// Category 2: Streamer
	let streamerType = $state('VTuber 2D');
	let streamerPlatforms = $state('');
	let streamerMama = $state('');
	let streamerPapa = $state('');
	let streamerPartnerStatus = $state('Partner / Monetizado');
	let streamerProofLink = $state('');
	let streamerAck = $state(false);

	// Category 3: Organization
	let orgLegalName = $state('');
	let orgCountry = $state('');
	let orgType = $state('Agencia de Talentos / VTubers');
	let orgCorporateEmail = $state('');
	let orgProjects = $state('');
	let orgApplicantRole = $state('');
	let orgAck = $state(false);

	// Category 4: Government
	let govEntityName = $state('');
	let govJurisdiction = $state('');
	let govEmail = $state('');
	let govResolutionNumber = $state('');
	let govDelegateName = $state('');
	let govDelegateRole = $state('');
	let govAck = $state(false);

	// Category 5: Public
	let publicDomain = $state('Música / Producción');
	let publicMediaLinks = $state('');
	let publicSocials = $state('');
	let publicAgency = $state('');
	let publicAck = $state(false);

	// Real-time reactive validation for government email
	let isGovEmailValid = $derived.by(() => {
		if (currentCatKey !== 'government' || !govEmail.trim()) return true;
		const lower = govEmail.toLowerCase().trim();
		return (
			lower.includes('.gob') ||
			lower.includes('.gov') ||
			lower.includes('.mil') ||
			lower.includes('.int') ||
			lower.includes('.gouv') ||
			lower.includes('.europa.eu') ||
			lower.includes('.gc.ca')
		);
	});

	function generateFolio() {
		const year = new Date().getFullYear();
		const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
		const catCode = currentCatKey.substring(0, 3).toUpperCase();
		return `VS-VRF-${year}-${catCode}-${randomHex}`;
	}

	async function handleFormSubmit(e) {
		e.preventDefault();
		submitError = '';
		if (!applicantHandle.trim()) return;
		if (currentCatKey === 'government' && !isGovEmailValid) return;

		if (!authStore.isAuthenticated) {
			submitError =
				'Debes iniciar sesión con tu cuenta de V-SOCIAL para enviar la solicitud de verificación.';
			return;
		}

		isSubmitting = true;
		try {
			let legalName = null;
			let specialty = null;
			let contactEmail = applicantContactEmail;
			let portfolioList = [];
			let socialLinks = {};

			if (currentCatKey === 'creator') {
				specialty = creatorSpecialty;
				portfolioList = [creatorPortfolios, creatorProofLink].filter(Boolean);
				socialLinks = { software: creatorSoftware };
			} else if (currentCatKey === 'streamer') {
				specialty = streamerType;
				portfolioList = [streamerPlatforms, streamerProofLink].filter(Boolean);
				socialLinks = {
					mama: streamerMama,
					papa: streamerPapa,
					partnerStatus: streamerPartnerStatus
				};
			} else if (currentCatKey === 'organization') {
				legalName = orgLegalName;
				specialty = orgType;
				contactEmail = orgCorporateEmail || applicantContactEmail;
				portfolioList = [orgProjects].filter(Boolean);
				socialLinks = { country: orgCountry, applicantRole: orgApplicantRole };
			} else if (currentCatKey === 'government') {
				legalName = govEntityName;
				contactEmail = govEmail || applicantContactEmail;
				socialLinks = {
					jurisdiction: govJurisdiction,
					resolution: govResolutionNumber,
					delegateName: govDelegateName,
					delegateRole: govDelegateRole
				};
			} else if (currentCatKey === 'public') {
				specialty = publicDomain;
				portfolioList = [publicMediaLinks, publicSocials].filter(Boolean);
				socialLinks = { agency: publicAgency };
			}

			const res = await verification.apply({
				category: currentCatKey,
				applicant_handle: applicantHandle,
				contact_email: contactEmail,
				legal_name: legalName,
				specialty: specialty,
				portfolio_links: portfolioList,
				social_links: socialLinks
			});

			applicantFolio = res.folio || generateFolio();
			copiedFolio = false;
			formStep = 'success';
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} catch (err) {
			submitError = err.message || 'Error al procesar la solicitud de verificación.';
		} finally {
			isSubmitting = false;
		}
	}

	function copyFolio() {
		if (!applicantFolio) return;
		navigator.clipboard.writeText(applicantFolio);
		copiedFolio = true;
		setTimeout(() => {
			copiedFolio = false;
		}, 3000);
	}
</script>

<svelte:head>
	<title>{cfg.title} - V-SOCIAL</title>
	<meta name="description" content={cfg.subtitle} />
</svelte:head>

<div class="dedicated-apply-page {cfg.isGov ? 'is-gov-page' : ''}" in:fade={{ duration: 400 }}>
	<!-- Top Breadcrumbs -->
	<div class="top-nav-bar">
		<div class="breadcrumb-trail">
			<a href="/about/verified" class="crumb-link">Verificaciones</a>
			<span class="crumb-separator">/</span>
			<a href="/about/verified/apply" class="crumb-link">Canales de Auditoría</a>
			<span class="crumb-separator">/</span>
			<span class="crumb-current" style="color: {cfg.color};">{cfg.tag}</span>
		</div>

		<div class="badge-status-chip">
			<span class="status-dot"></span>
			<span>Canal Oficial de Auditoría Humana</span>
		</div>
	</div>

	<!-- Dedicated Hero Banner -->
	<header class="portal-hero glass-panel" style="--portal-color: {cfg.color};">
		<div class="hero-header-row">
			<div class="hero-icon-seal {cfg.isGov ? 'gov-seal' : ''}" style="color: {cfg.color};">
				<span class="material-icons-round hero-icon">{cfg.icon}</span>
			</div>
			<div class="hero-info-text">
				<div class="hero-tag-row">
					<span class="portal-category-tag">{cfg.tag}</span>
					<span class="portal-level-tag">{cfg.level}</span>
				</div>
				<h1 class="portal-main-title">{cfg.title}</h1>
				<p class="portal-main-subtitle">{cfg.subtitle}</p>
			</div>
		</div>

		{#if cfg.isGov}
			<div class="gov-sovereignty-banner" in:fade>
				<span class="material-icons-round text-xl">policy</span>
				<div class="gov-banner-text">
					<strong>⚖️ Protocolo de Fe Pública & Soberanía Estatal</strong>
					<p>
						Este canal está reservado exclusivamente para ministerios, embajadas, cortes y
						organismos públicos del Estado. Se exige correo oficial bajo dominio gubernamental (.gob
						/ .gov / .mil / .int).
					</p>
				</div>
			</div>
		{/if}
	</header>

	<!-- Main Workspace: 2-Column Responsive Layout -->
	{#if formStep === 'form'}
		<div class="workspace-grid" in:fade={{ duration: 300 }}>
			<!-- Left Column: Form & Evidences -->
			<main class="form-container glass-card aero-card">
				<div class="form-header-box">
					<h2 class="form-section-title">Expediente de Solicitud</h2>
					<p class="form-section-desc">
						Completa los datos requeridos para que los auditores verifiquen la autenticidad de tu
						cuenta:
					</p>
					{#if submitError}
						<div
							class="glass-panel p-4 mb-4 rounded-xl flex items-center gap-3 text-sm"
							style="background: rgba(232, 74, 114, 0.12); border: 1px solid rgba(232, 74, 114, 0.3); color: var(--aero-rose);"
						>
							<span class="material-icons-round text-lg">error_outline</span>
							<span>{submitError}</span>
						</div>
					{/if}

					<form onsubmit={handleFormSubmit} class="audit-form">
						<!-- Base Identity Section -->
						<div class="form-fieldset">
							<span class="fieldset-legend">1. Cuenta en V-SOCIAL & Contacto</span>

							<div class="form-row-2col">
								<div class="form-group">
									<label for="app-username">Nombre de Usuario en V-SOCIAL *</label>
									<div class="input-with-prefix">
										<span class="input-prefix">@</span>
										<input
											id="app-username"
											type="text"
											placeholder="tu_usuario"
											required
											bind:value={applicantHandle}
											class="modal-input"
										/>
									</div>
								</div>

								<div class="form-group">
									<label for="app-contact-email">Correo de Notificación y Auditoría *</label>
									<input
										id="app-contact-email"
										type="email"
										placeholder="correo@ejemplo.com"
										required
										bind:value={applicantContactEmail}
										class="modal-input"
									/>
								</div>
							</div>
						</div>

						<!-- Specialized Fields Section -->
						<div class="form-fieldset">
							<span class="fieldset-legend">2. Evidencias Específicas de {cfg.tag}</span>

							{#if currentCatKey === 'creator'}
								<div class="form-row-2col">
									<div class="form-group">
										<label for="creator-specialty">Especialidad Artística Principal *</label>
										<CustomSelect
											id="creator-specialty"
											bind:value={creatorSpecialty}
											options={creatorSpecialtyOptions}
										/>
									</div>

									<div class="form-group">
										<label for="creator-software">Software / Toolchain Habitual</label>
										<input
											id="creator-software"
											type="text"
											placeholder="ej. Blender, Clip Studio, Maya, ZBrush, Spine"
											bind:value={creatorSoftware}
											class="modal-input"
										/>
									</div>
								</div>

								<div class="form-group">
									<label for="creator-portfolios">Portafolios Primarios Verificables *</label>
									<textarea
										id="creator-portfolios"
										rows="3"
										placeholder="https://artstation.com/mi_perfil&#10;https://behance.net/mi_perfil&#10;https://cara.app/mi_perfil&#10;https://pixiv.net/users/..."
										required
										bind:value={creatorPortfolios}
										class="modal-input"
									></textarea>
									<span class="field-hint"
										>Ingresa URLs activas donde se visualice tu obra completa y trayectoria.</span
									>
								</div>

								<div class="form-group">
									<label for="creator-proof">Enlace de Mención Cruzada o Prueba de Autoría</label>
									<input
										id="creator-proof"
										type="url"
										placeholder="URL a post en X/Bluesky/ArtStation mencionando @tu_usuario en V-SOCIAL"
										bind:value={creatorProofLink}
										class="modal-input"
									/>
								</div>
							{:else if currentCatKey === 'streamer'}
								<div class="form-row-2col">
									<div class="form-group">
										<label for="streamer-type">Modalidad de Transmisión *</label>
										<CustomSelect
											id="streamer-type"
											bind:value={streamerType}
											options={streamerTypeOptions}
										/>
									</div>

									<div class="form-group">
										<label for="streamer-partner">Estatus de Creador *</label>
										<CustomSelect
											id="streamer-partner"
											bind:value={streamerPartnerStatus}
											options={streamerPartnerOptions}
										/>
									</div>
								</div>

								<div class="form-group">
									<label for="streamer-platforms">Canales de Transmisión en Vivo *</label>
									<textarea
										id="streamer-platforms"
										rows="3"
										placeholder="https://twitch.tv/mi_canal&#10;https://youtube.com/@mi_canal&#10;https://kick.com/mi_canal"
										required
										bind:value={streamerPlatforms}
										class="modal-input"
									></textarea>
								</div>

								<div class="form-row-2col">
									<div class="form-group">
										<label for="streamer-mama">Mama / Ilustrador Original (VTubers)</label>
										<input
											id="streamer-mama"
											type="text"
											placeholder="@artista o link de contacto"
											bind:value={streamerMama}
											class="modal-input"
										/>
									</div>

									<div class="form-group">
										<label for="streamer-papa">Papa / Rigger 2D/3D (VTubers)</label>
										<input
											id="streamer-papa"
											type="text"
											placeholder="@rigger o link de contacto"
											bind:value={streamerPapa}
											class="modal-input"
										/>
									</div>
								</div>

								<div class="form-group">
									<label for="streamer-proof">Prueba de Vinculación en Directo</label>
									<input
										id="streamer-proof"
										type="text"
										placeholder="Comando !vsocial en chat o enlace en paneles del canal"
										bind:value={streamerProofLink}
										class="modal-input"
									/>
								</div>
							{:else if currentCatKey === 'organization'}
								<div class="form-row-2col">
									<div class="form-group">
										<label for="org-name">Razón Social / Nombre Legal *</label>
										<input
											id="org-name"
											type="text"
											placeholder="ej. Virtual Arts Entertainment S.A.S."
											required
											bind:value={orgLegalName}
											class="modal-input"
										/>
									</div>

									<div class="form-group">
										<label for="org-country">País y Registro Mercantil / Fiscal *</label>
										<input
											id="org-country"
											type="text"
											placeholder="ej. España / NIF B-12345678"
											required
											bind:value={orgCountry}
											class="modal-input"
										/>
									</div>
								</div>

								<div class="form-row-2col">
									<div class="form-group">
										<label for="org-type">Tipo de Organización *</label>
										<CustomSelect id="org-type" bind:value={orgType} options={orgTypeOptions} />
									</div>

									<div class="form-group">
										<label for="org-email">Correo Corporativo Institucional *</label>
										<input
											id="org-email"
											type="email"
											placeholder="contacto@tu-estudio.com"
											required
											bind:value={orgCorporateEmail}
											class="modal-input"
										/>
									</div>
								</div>

								<div class="form-group">
									<label for="org-projects">Proyectos, Juegos o Talentos Representados *</label>
									<textarea
										id="org-projects"
										rows="3"
										placeholder="Enlaces a web oficial, juegos en Steam o roster de talentos..."
										required
										bind:value={orgProjects}
										class="modal-input"
									></textarea>
								</div>

								<div class="form-group">
									<label for="org-role">Cargo y Personería del Solicitante *</label>
									<input
										id="org-role"
										type="text"
										placeholder="ej. Director Ejecutivo (CEO), Head of Talent, Representante Legal"
										required
										bind:value={orgApplicantRole}
										class="modal-input"
									/>
								</div>
							{:else if currentCatKey === 'government'}
								<div class="form-row-2col">
									<div class="form-group">
										<label for="gov-entity">Organismo / Ministerio / Embajada / Corte *</label>
										<input
											id="gov-entity"
											type="text"
											placeholder="ej. Ministerio de Tecnologías y Comunicaciones"
											required
											bind:value={govEntityName}
											class="modal-input"
										/>
									</div>

									<div class="form-group">
										<label for="gov-jurisdiction">Jurisdicción & País *</label>
										<input
											id="gov-jurisdiction"
											type="text"
											placeholder="ej. República de Chile / Nivel Nacional"
											required
											bind:value={govJurisdiction}
											class="modal-input"
										/>
									</div>
								</div>

								<div class="form-group">
									<label for="gov-email"
										>Correo Institucional Gubernamental (.gob / .gov / .mil / .int) *</label
									>
									<input
										id="gov-email"
										type="email"
										placeholder="ej. prensa@mintic.gov.co o contacto@mici.gob.es"
										required
										bind:value={govEmail}
										class="modal-input {govEmail && !isGovEmailValid ? 'input-error' : ''}"
									/>
									{#if govEmail && !isGovEmailValid}
										<span class="field-hint error">
											<span class="material-icons-round text-xs">warning</span>
											Se exige un dominio gubernamental oficial (.gob, .gov, .mil, .int, .gouv, .europa.eu).
											Los correos comerciales serán desestimados.
										</span>
									{:else if govEmail}
										<span class="field-hint valid">
											<span class="material-icons-round text-xs">check_circle</span>
											Dominio gubernamental validado criptográficamente.
										</span>
									{/if}
								</div>

								<div class="form-row-2col">
									<div class="form-group">
										<label for="gov-resolution"
											>Decreto / Gaceta Oficial / Resolución Ministerial *</label
										>
										<input
											id="gov-resolution"
											type="text"
											placeholder="ej. Decreto Supremo N° 104-2025-PCM"
											required
											bind:value={govResolutionNumber}
											class="modal-input"
										/>
									</div>

									<div class="form-group">
										<label for="gov-delegate">Funcionario / Portavoz Autorizado *</label>
										<input
											id="gov-delegate"
											type="text"
											placeholder="Nombre y apellido del funcionario"
											required
											bind:value={govDelegateName}
											class="modal-input"
										/>
									</div>
								</div>

								<div class="form-group">
									<label for="gov-role">Cargo Institucional Formal *</label>
									<input
										id="gov-role"
										type="text"
										placeholder="ej. Director General de Comunicación Digital y Prensa"
										required
										bind:value={govDelegateRole}
										class="modal-input"
									/>
								</div>
							{:else if currentCatKey === 'public'}
								<div class="form-row-2col">
									<div class="form-group">
										<label for="public-domain">Ámbito de Notoriedad Pública *</label>
										<CustomSelect
											id="public-domain"
											bind:value={publicDomain}
											options={publicDomainOptions}
										/>
									</div>

									<div class="form-group">
										<label for="public-agency">Agencia de Prensa o Mánager</label>
										<input
											id="public-agency"
											type="text"
											placeholder="Nombre o contacto de agencia (opcional)"
											bind:value={publicAgency}
											class="modal-input"
										/>
									</div>
								</div>

								<div class="form-group">
									<label for="public-media">Enlaces a Cobertura en Medios Acreditados *</label>
									<textarea
										id="public-media"
										rows="3"
										placeholder="https://es.wikipedia.org/wiki/...&#10;https://imdb.com/name/...&#10;https://prensa-nacional.com/entrevista/..."
										required
										bind:value={publicMediaLinks}
										class="modal-input"
									></textarea>
								</div>

								<div class="form-group">
									<label for="public-socials">Perfiles Verificados en Otras Plataformas</label>
									<textarea
										id="public-socials"
										rows="2"
										placeholder="https://x.com/oficial&#10;https://instagram.com/oficial&#10;https://open.spotify.com/artist/..."
										bind:value={publicSocials}
										class="modal-input"
									></textarea>
								</div>
							{/if}
						</div>

						<!-- Certifications & Acknowledgements -->
						<div class="form-fieldset">
							<span class="fieldset-legend">3. Declaración de Fe & Autenticidad</span>

							{#if currentCatKey === 'creator'}
								<label class="checkbox-control">
									<input type="checkbox" required bind:checked={creatorAck} />
									<span
										>Certifico bajo mi responsabilidad que soy el autor original de las obras y
										portafolios presentados, y que el contenido cumple con las normas comunitarias.</span
									>
								</label>
							{:else if currentCatKey === 'streamer'}
								<label class="checkbox-control">
									<input type="checkbox" required bind:checked={streamerAck} />
									<span
										>Declaro ser el titular legítimo del canal y contar con los derechos y licencias
										del modelo virtual/avatar utilizado en las transmisiones.</span
									>
								</label>
							{:else if currentCatKey === 'organization'}
								<label class="checkbox-control">
									<input type="checkbox" required bind:checked={orgAck} />
									<span
										>Certifico contar con la debida personería y autorización para gestionar la
										presencia y representación oficial de esta organización en V-SOCIAL.</span
									>
								</label>
							{:else if currentCatKey === 'government'}
								<label class="checkbox-control gov-checkbox">
									<input type="checkbox" required bind:checked={govAck} />
									<span
										>Declaro bajo fe pública y responsabilidad de estado que esta solicitud es
										emitida por la autoridad competente en ejercicio de funciones oficiales
										legítimas.</span
									>
								</label>
							{:else if currentCatKey === 'public'}
								<label class="checkbox-control">
									<input type="checkbox" required bind:checked={publicAck} />
									<span
										>Confirmo la veracidad de mi notoriedad pública y acepto el protocolo de cotejo
										de identidad confidencial bajo normativas RGPD.</span
									>
								</label>
							{/if}
						</div>

						<!-- Submit Action Bar -->
						<div class="form-actions-bar">
							<a href="/about/verified/apply" class="btn-aero-secondary">
								<span class="material-icons-round text-base">arrow_back</span>
								<span>Cambiar Canal</span>
							</a>
							<button
								type="submit"
								disabled={isSubmitting}
								class="btn-aero-primary font-bold {cfg.isGov ? 'btn-gov-submit' : ''}"
								style={isSubmitting ? 'opacity: 0.7; cursor: wait;' : ''}
							>
								<span class="material-icons-round text-base"
									>{isSubmitting ? 'sync' : cfg.isGov ? 'policy' : 'send'}</span
								>
								<span
									>{isSubmitting
										? 'Procesando Radicación...'
										: cfg.isGov
											? 'Emitir Acreditación Estatal'
											: 'Enviar Solicitud a Auditoría'}</span
								>
							</button>
						</div>
					</form>
				</div>
			</main>

			<!-- Right Column: Sidebar & Security Protocol -->
			<aside class="sidebar-container">
				<!-- Live Badge Preview Card -->
				<div class="sidebar-card glass-card">
					<span class="sidebar-tag">Insignia Objetivo</span>
					<div class="badge-display-box">
						<VerifiedBadge
							role={cfg.badgeRole}
							isVerified={cfg.isVerified}
							size="24px"
							interactive={false}
						/>
						<div class="badge-meta">
							<strong class="badge-title">{cfg.badgeLabel}</strong>
							<span class="badge-level">{cfg.level}</span>
						</div>
					</div>
					<p class="badge-explanation">
						Al completarse la auditoría, esta insignia criptográfica se vinculará a tu ID de usuario
						de forma permanente.
					</p>
				</div>

				<!-- Audit Criteria Checklist -->
				<div class="sidebar-card glass-card">
					<h3 class="sidebar-heading">
						<span class="material-icons-round text-base" style="color: {cfg.color};">rule</span>
						<span>Criterios de Evaluación</span>
					</h3>
					<ul class="checklist-items">
						{#each cfg.checklist as item}
							<li>
								<span class="material-icons-round text-xs text-mint">check</span>
								<span>{item}</span>
							</li>
						{/each}
					</ul>
				</div>

				<!-- SLA & Human Guarantee -->
				<div class="sidebar-card glass-card">
					<h3 class="sidebar-heading">
						<span class="material-icons-round text-base" style="color: {cfg.color};"
							>verified_user</span
						>
						<span>Garantías del Proceso</span>
					</h3>
					<div class="guarantee-list">
						<div class="guarantee-row">
							<span class="material-icons-round text-sm" style="color: {cfg.color};">schedule</span>
							<div>
								<strong>Tiempo de Respuesta (SLA):</strong>
								<p>{cfg.sla}</p>
							</div>
						</div>
						<div class="guarantee-row">
							<span class="material-icons-round text-sm" style="color: {cfg.color};">lock</span>
							<div>
								<strong>Protección de Datos:</strong>
								<p>Toda la información es confidencial bajo normativas RGPD.</p>
							</div>
						</div>
					</div>
				</div>
			</aside>
		</div>
	{:else}
		<!-- Success / Sealed Folio View -->
		<div class="success-stage glass-panel" in:scale={{ duration: 300, easing: quintOut }}>
			<div class="success-seal-box {cfg.isGov ? 'gov-seal-box' : ''}">
				<span class="material-icons-round text-5xl"
					>{cfg.isGov ? 'account_balance' : 'mark_email_read'}</span
				>
			</div>
			<h2 class="success-title">¡Expediente de Auditoría Registrado con Éxito!</h2>
			<p class="success-subtitle">
				Hemos recibido los datos y evidencias para <strong>@{applicantHandle}</strong> en el canal
				de <strong>{cfg.title}</strong>.
			</p>

			<div class="folio-ticket glass-card">
				<span class="folio-ticket-label">FOLIO CRIPTOGRÁFICO OFICIAL DE SEGUIMIENTO</span>
				<div class="folio-ticket-code-row">
					<code class="folio-ticket-code">{applicantFolio}</code>
					<button type="button" class="btn-copy-folio" onclick={copyFolio}>
						<span class="material-icons-round text-sm"
							>{copiedFolio ? 'check' : 'content_copy'}</span
						>
						<span>{copiedFolio ? '¡Copiado al portapapeles!' : 'Copiar Folio'}</span>
					</button>
				</div>
				<p class="folio-hint">
					Conserva este folio para cualquier consulta directa con el equipo de soporte y gobernanza.
				</p>
			</div>

			<div class="success-summary-grid">
				<div class="summary-pill glass-card">
					<span class="material-icons-round text-lg text-mint">hourglass_bottom</span>
					<div>
						<strong>Plazo de Auditoría:</strong>
						<p>{cfg.sla}</p>
					</div>
				</div>
				<div class="summary-pill glass-card">
					<span class="material-icons-round text-lg text-mint">person</span>
					<div>
						<strong>Equipo Revisor:</strong>
						<p>Auditores humanos oficiales</p>
					</div>
				</div>
				<div class="summary-pill glass-card">
					<span class="material-icons-round text-lg text-mint">mail</span>
					<div>
						<strong>Notificación:</strong>
						<p>{applicantContactEmail || 'Bandeja de entrada oficial'}</p>
					</div>
				</div>
			</div>

			<div class="success-actions">
				<a href="/about/verified" class="btn-aero-primary font-bold px-8 py-3">
					Volver a Jerarquía de Verificaciones
				</a>
				<a href="/about/verified/apply" class="btn-aero-secondary font-bold px-8 py-3">
					Explorar Otros Canales
				</a>
			</div>
		</div>
	{/if}
</div>

<style>
	.dedicated-apply-page {
		padding: 1.5rem 1.25rem 5rem;
		max-width: 1200px;
		margin: 0 auto;
		position: relative;
		z-index: 1;
		min-height: 100vh;
	}

	.top-nav-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.breadcrumb-trail {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.86rem;
		font-weight: 600;
	}

	.crumb-link {
		color: var(--text-secondary);
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.crumb-link:hover {
		color: var(--aero-blue);
		text-decoration: underline;
	}

	.crumb-separator {
		color: var(--text-muted);
	}

	.crumb-current {
		font-weight: 800;
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

	.portal-hero {
		padding: 2.2rem 2.5rem;
		border-radius: var(--radius-xl);
		margin-bottom: 2.5rem;
		border: 1.5px solid var(--border-subtle);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--portal-color) 8%, transparent) 0%,
			var(--bg-surface) 100%
		);
	}

	.hero-header-row {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.hero-icon-seal {
		width: 72px;
		height: 72px;
		border-radius: var(--radius-xl);
		background: color-mix(in srgb, var(--portal-color) 15%, transparent);
		border: 2px solid var(--portal-color);
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 72px;
		box-shadow: 0 8px 24px color-mix(in srgb, var(--portal-color) 25%, transparent);
	}

	.hero-icon {
		font-size: 38px;
	}

	.gov-seal {
		background: rgba(148, 163, 184, 0.15) !important;
		border-color: var(--badge-gov) !important;
		box-shadow: 0 8px 25px rgba(148, 163, 184, 0.25) !important;
	}

	.hero-tag-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.4rem;
	}

	.portal-category-tag {
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 3px 9px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
	}

	.portal-level-tag {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--portal-color);
	}

	.portal-main-title {
		font-size: clamp(1.5rem, 3vw, 2.2rem);
		font-weight: 900;
		font-family: var(--font-display);
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin-bottom: 0.35rem;
	}

	.portal-main-subtitle {
		font-size: 0.96rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.gov-sovereignty-banner {
		display: flex;
		align-items: flex-start;
		gap: 0.9rem;
		padding: 1rem 1.25rem;
		border-radius: var(--radius-md);
		background: rgba(148, 163, 184, 0.1);
		border: 1.5px solid rgba(148, 163, 184, 0.35);
		margin-top: 1.5rem;
		color: var(--text-secondary);
		font-size: 0.85rem;
		line-height: 1.5;
	}

	.gov-sovereignty-banner span {
		color: var(--badge-gov);
		flex: 0 0 24px;
		margin-top: 2px;
	}

	.gov-banner-text strong {
		color: var(--text-primary);
		display: block;
		margin-bottom: 2px;
	}

	.gov-banner-text p {
		margin: 0;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   WORKSPACE 2-COLUMN GRID
	   ══════════════════════════════════════════════════════════════════════ */
	.workspace-grid {
		display: grid;
		grid-template-columns: 1fr 340px;
		gap: 2rem;
		align-items: start;
	}

	@media (max-width: 960px) {
		.workspace-grid {
			grid-template-columns: 1fr;
		}
	}

	.form-container {
		padding: 2.2rem;
		border-radius: var(--radius-xl);
		border: 1.5px solid var(--border-subtle);
		background: var(--bg-surface);
	}

	.form-header-box {
		margin-bottom: 1.8rem;
		padding-bottom: 1.2rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.form-section-title {
		font-size: 1.35rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.3rem;
	}

	.form-section-desc {
		font-size: 0.88rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.audit-form {
		display: flex;
		flex-direction: column;
		gap: 1.8rem;
	}

	.form-fieldset {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.2rem 1.4rem;
		border-radius: var(--radius-md);
		background: rgba(0, 0, 0, 0.02);
		border: 1px solid var(--border-subtle);
	}

	:global([data-theme='dark']) .form-fieldset,
	:global([data-theme='midnight']) .form-fieldset {
		background: rgba(0, 0, 0, 0.2);
	}

	.fieldset-legend {
		font-size: 0.8rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin-bottom: 0.2rem;
	}

	.form-row-2col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	@media (max-width: 600px) {
		.form-row-2col {
			grid-template-columns: 1fr;
		}
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-group label {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.modal-input {
		width: 100%;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--bg-input);
		color: var(--text-primary);
		font-size: 0.88rem;
		outline: none;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		font-family: inherit;
		resize: vertical;
	}

	.modal-input:focus {
		border-color: var(--aero-blue);
		box-shadow: 0 0 0 2px rgba(27, 133, 243, 0.15);
	}

	.input-with-prefix {
		position: relative;
		display: flex;
		align-items: center;
	}

	.input-prefix {
		position: absolute;
		left: 0.9rem;
		color: var(--text-muted);
		font-weight: 700;
		font-size: 0.95rem;
		pointer-events: none;
	}

	.input-with-prefix .modal-input {
		padding-left: 2.2rem;
	}

	.field-hint {
		font-size: 0.76rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
		line-height: 1.35;
	}

	.field-hint.error {
		color: var(--aero-coral);
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.field-hint.valid {
		color: var(--aero-mint);
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.input-error {
		border-color: var(--aero-coral) !important;
	}

	.checkbox-control {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		font-size: 0.82rem;
		color: var(--text-secondary);
		line-height: 1.5;
		cursor: pointer;
	}

	.checkbox-control input[type='checkbox'] {
		margin-top: 3px;
		accent-color: var(--aero-blue);
		cursor: pointer;
		flex: 0 0 16px;
		width: 16px;
		height: 16px;
	}

	.gov-checkbox input[type='checkbox'] {
		accent-color: var(--badge-gov);
	}

	.form-actions-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 0.8rem;
	}

	.btn-gov-submit {
		background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%) !important;
		box-shadow: 0 6px 20px rgba(100, 116, 139, 0.4) !important;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   SIDEBAR PROTOCOL CARDS
	   ══════════════════════════════════════════════════════════════════════ */
	.sidebar-container {
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
	}

	.sidebar-card {
		padding: 1.4rem;
		border-radius: var(--radius-xl);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
	}

	.sidebar-tag {
		display: block;
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
	}

	.badge-display-box {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--border-subtle);
		margin-bottom: 0.75rem;
	}

	.badge-title {
		display: block;
		font-size: 0.92rem;
		color: var(--text-primary);
	}

	.badge-level {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.badge-explanation {
		font-size: 0.78rem;
		color: var(--text-secondary);
		line-height: 1.45;
		margin: 0;
	}

	.sidebar-heading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.85rem;
	}

	.checklist-items {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.checklist-items li {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		line-height: 1.4;
	}

	.checklist-items li span:first-child {
		margin-top: 1px;
	}

	.guarantee-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.guarantee-row {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		font-size: 0.8rem;
	}

	.guarantee-row span {
		flex: 0 0 18px;
		margin-top: 2px;
	}

	.guarantee-row strong {
		display: block;
		color: var(--text-primary);
	}

	.guarantee-row p {
		color: var(--text-secondary);
		margin: 0;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   SUCCESS TICKET STAGE
	   ══════════════════════════════════════════════════════════════════════ */
	.success-stage {
		padding: 3.5rem 2rem;
		border-radius: var(--radius-xl);
		text-align: center;
		max-width: 800px;
		margin: 0 auto;
		border: 1.5px solid var(--border-subtle);
	}

	.success-seal-box {
		width: 84px;
		height: 84px;
		border-radius: var(--radius-full);
		background: rgba(0, 212, 170, 0.15);
		border: 2.5px solid var(--aero-mint);
		color: var(--aero-mint);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1.5rem;
		box-shadow: 0 10px 30px rgba(0, 212, 170, 0.3);
	}

	.gov-seal-box {
		background: rgba(148, 163, 184, 0.15) !important;
		border-color: var(--badge-gov) !important;
		color: var(--badge-gov) !important;
		box-shadow: 0 10px 30px rgba(148, 163, 184, 0.3) !important;
	}

	.success-title {
		font-size: clamp(1.6rem, 3.2vw, 2.2rem);
		font-weight: 900;
		font-family: var(--font-display);
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin-bottom: 0.6rem;
	}

	.success-subtitle {
		font-size: 1.05rem;
		color: var(--text-secondary);
		max-width: 600px;
		margin: 0 auto 2rem;
		line-height: 1.55;
	}

	.folio-ticket {
		padding: 1.6rem 2rem;
		border-radius: var(--radius-xl);
		border: 2px dashed var(--aero-blue);
		background: rgba(27, 133, 243, 0.05);
		margin-bottom: 2rem;
	}

	.folio-ticket-label {
		display: block;
		font-size: 0.76rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
	}

	.folio-ticket-code-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 0.75rem;
	}

	.folio-ticket-code {
		font-family: 'JetBrains Mono', monospace, monospace;
		font-size: 1.3rem;
		font-weight: 900;
		color: var(--aero-blue);
		letter-spacing: 0.06em;
		background: rgba(0, 0, 0, 0.25);
		padding: 6px 14px;
		border-radius: var(--radius-sm);
	}

	.btn-copy-folio {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 1rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-primary);
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-copy-folio:hover {
		border-color: var(--aero-blue);
		color: var(--aero-blue);
		transform: scale(1.04);
	}

	.folio-hint {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin: 0;
	}

	.success-summary-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-bottom: 2.2rem;
	}

	@media (max-width: 640px) {
		.success-summary-grid {
			grid-template-columns: 1fr;
		}
	}

	.summary-pill {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
		text-align: left;
	}

	.summary-pill strong {
		display: block;
		font-size: 0.84rem;
		color: var(--text-primary);
	}

	.summary-pill p {
		font-size: 0.76rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.success-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	@media (max-width: 640px) {
		.dedicated-apply-page {
			padding: 1rem 0.85rem 4rem;
		}

		.portal-hero {
			padding: 1.5rem 1.2rem;
		}

		.hero-header-row {
			flex-direction: column;
			text-align: center;
			gap: 1rem;
		}

		.hero-tag-row {
			justify-content: center;
		}

		.form-container {
			padding: 1.5rem 1.2rem;
		}
	}
</style>
