<script>
	import { fade, slide, scale } from 'svelte/transition';
	import { cubicOut, quintOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import VerifiedBadge from '$lib/components/VerifiedBadge.svelte';
	import CustomSelect from '$lib/components/CustomSelect.svelte';

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

	const BASE_AVATAR = '/uploads/avatars/avatar_1_1784999564684.jpg';

	const userPresets = {
		admin: {
			name: 'Administrador del Sistema',
			username: 'admin',
			badge: 'admin',
			bio: '👑 Administrador Principal & Arquitectura de V-SOCIAL. Gestión de infraestructura y directrices globales.',
			postText:
				'Mantenimiento y optimización de infraestructura completados. Toda la red opera con latencia mínima y máxima seguridad. 👑⚡',
			hashtag: '#VSocialUpdate #Infrastructure',
			commentText: 'Infraestructura y seguridad operando con parámetros óptimos.',
			avatar: BASE_AVATAR
		},
		moderator: {
			name: 'Moderador Oficial',
			username: 'moderador',
			badge: 'moderator',
			bio: '🛡️ Equipo Oficial de Moderación de V-SOCIAL. Salvaguardando la seguridad y la convivencia comunitaria.',
			postText:
				'Recordatorio a la comunidad: cuidemos la convivencia en el feed. Reporta cualquier conducta inapropiada o sospecha de suplantación. 🛡️✨',
			hashtag: '#SeguridadComunitaria #VSocialSafe',
			commentText: 'Reporte revisado y resuelto conforme a las directrices comunitarias.',
			avatar: BASE_AVATAR
		},
		support: {
			name: 'Soporte V-SOCIAL',
			username: 'soporte',
			badge: 'support',
			bio: '🎧 Centro Oficial de Asistencia y Atención al Usuario. Resolución de tickets y verificación de identidades.',
			postText:
				'El equipo de Soporte y Verificación de Identidad está activo. Responderemos a tus solicitudes en un plazo de 24 a 48 horas hábiles. 🎧',
			hashtag: '#VSocialHelp #SoporteOficial',
			commentText:
				'Ticket de asistencia recibido. Estamos revisando tu caso con el equipo técnico.',
			avatar: BASE_AVATAR
		},
		team: {
			name: 'Equipo V-SOCIAL',
			username: 'team',
			badge: 'team',
			bio: '⚡ Miembro del equipo de ingeniería, diseño UI/UX y desarrollo central de V-SOCIAL.',
			postText:
				'Nueva actualización de interfaz con Glassmorphism 2.0 y aceleración por hardware ya desplegada en toda la plataforma. 💎⚡',
			hashtag: '#NeoAero #DevTeam #Glassmorphism',
			commentText: 'Excelente feedback, implementaremos la mejora en el próximo sprint.',
			avatar: BASE_AVATAR
		},
		government: {
			name: 'Ministerio de Innovación & Tecnología',
			username: 'gob_digital',
			badge: 'government',
			bio: '🏛️ Cuenta Oficial del Ministerio de Innovación y Tecnología Gubernamental. Comunicados de estado y servicios públicos.',
			postText:
				'Decreto Oficial: Se publica la nueva normativa de protección de identidad digital y derechos de los creadores en entornos virtuales. 🏛️📜',
			hashtag: '#GobiernoOficial #IdentidadDigital #Legal',
			commentText: 'Comunicado oficial registrado y validado por la entidad legal competente.',
			avatar: BASE_AVATAR
		},
		verified: {
			name: 'Creador Verificado',
			username: 'creador_oficial',
			badge: 'verified',
			bio: '✨ Creador de contenido oficial y personalidad con identidad verificada en V-SOCIAL.',
			postText:
				'¡Muchas gracias a toda la comunidad por el apoyo constante! Ya está disponible el nuevo contenido y proyectos en mi perfil. ✨🎨',
			hashtag: '#CreadorOficial #VSocial #VirtualCreator',
			commentText: 'Totalmente de acuerdo. La fluidez y estética del sistema es impresionante.',
			avatar: BASE_AVATAR
		}
	};

	let isMounted = $state(false);
	let showModal = $state(false);
	let modalStep = $state('select'); // 'select' | 'form' | 'success'
	let selectedCategory = $state('creator');
	let applicantHandle = $state('');
	let applicantContactEmail = $state('');
	let applicantFolio = $state('');
	let copiedFolio = $state(false);

	// Specialized fields for Category 1: Creadores & Artistas
	let creatorSpecialty = $state('Ilustración 2D');
	let creatorPortfolios = $state('');
	let creatorProofLink = $state('');
	let creatorSoftware = $state('');
	let creatorAck = $state(false);

	// Specialized fields for Category 2: Streamers & VTubers
	let streamerType = $state('VTuber 2D');
	let streamerPlatforms = $state('');
	let streamerMama = $state('');
	let streamerPapa = $state('');
	let streamerPartnerStatus = $state('Partner / Monetizado');
	let streamerProofLink = $state('');
	let streamerAck = $state(false);

	// Specialized fields for Category 3: Organizaciones & Estudios
	let orgLegalName = $state('');
	let orgCountry = $state('');
	let orgType = $state('Agencia de Talentos / VTubers');
	let orgCorporateEmail = $state('');
	let orgProjects = $state('');
	let orgApplicantRole = $state('');
	let orgAck = $state(false);

	// Specialized fields for Category 4: Gobierno & Organismos Oficiales
	let govEntityName = $state('');
	let govJurisdiction = $state('');
	let govEmail = $state('');
	let govResolutionNumber = $state('');
	let govDelegateName = $state('');
	let govDelegateRole = $state('');
	let govAck = $state(false);

	// Specialized fields for Category 5: Personalidades Públicas
	let publicDomain = $state('Música / Producción');
	let publicMediaLinks = $state('');
	let publicSocials = $state('');
	let publicAgency = $state('');
	let publicAck = $state(false);

	// Real-time reactive validation for government email
	let isGovEmailValid = $derived.by(() => {
		if (selectedCategory !== 'government' || !govEmail.trim()) return true;
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

	let currentCategory = $derived(
		categories.find((c) => c.id === selectedCategory) || categories[0]
	);

	let activeFilter = $state('all'); // 'all' | 'staff' | 'core' | 'creators'
	let activeFaq = $state(null);

	// Live Simulator State (Defaulting to Verified)
	let simBadgeType = $state('verified'); // 'admin' | 'moderator' | 'support' | 'team' | 'verified'
	let simDisplayName = $state(userPresets.verified.name);
	let simUsername = $state(userPresets.verified.username);
	let simAvatar = $state(BASE_AVATAR);
	let simBio = $state(userPresets.verified.bio);
	let simPostText = $state(userPresets.verified.postText);
	let simHashtags = $state(userPresets.verified.hashtag);
	let simCommentText = $state(userPresets.verified.commentText);
	let simActiveTab = $state('profile'); // 'profile' | 'post' | 'comment'

	function selectUserPreset(typeKey) {
		const preset = userPresets[typeKey];
		if (!preset) return;
		simBadgeType = preset.badge;
		simDisplayName = preset.name;
		simUsername = preset.username;
		simAvatar = preset.avatar;
		simBio = preset.bio;
		simPostText = preset.postText;
		simHashtags = preset.hashtag;
		simCommentText = preset.commentText;
	}

	// Specular light coordinates for cards
	function handleCardMouseMove(e) {
		const card = e.currentTarget;
		const rect = card.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		card.style.setProperty('--mouse-x', `${x}px`);
		card.style.setProperty('--mouse-y', `${y}px`);
	}

	// Roles Grid Horizontal Drag Scroller
	let rolesGrid;
	let isDragging = false;
	let isScrolling = $state(false);
	let startX = 0;
	let scrollLeft = 0;
	let velocity = 0;
	let lastX = 0;
	let animationFrameId;
	let overscroll = 0;
	let exactScroll = 0;
	let dragThresholdPassed = false;

	function startDrag(e) {
		if (!rolesGrid) return;
		isDragging = true;
		dragThresholdPassed = false;
		startX = e.pageX - rolesGrid.offsetLeft;
		exactScroll = rolesGrid.scrollLeft;
		scrollLeft = exactScroll - overscroll * 4;
		lastX = e.pageX;
		velocity = 0;
		cancelAnimationFrame(animationFrameId);
	}

	function stopDrag() {
		if (isDragging) {
			isDragging = false;
			dragThresholdPassed = false;
			startInertia();
		}
	}

	function handleDrag(e) {
		if (!isDragging || !rolesGrid) return;

		if (!dragThresholdPassed) {
			if (Math.abs(e.pageX - lastX) > 3) {
				dragThresholdPassed = true;
				isScrolling = true;
			} else {
				return;
			}
		}

		e.preventDefault();
		const x = e.pageX - rolesGrid.offsetLeft;
		const walk = (x - startX) * 0.85;
		const targetScroll = scrollLeft - walk;
		const maxScroll = rolesGrid.scrollWidth - rolesGrid.clientWidth;

		if (targetScroll < 0) {
			exactScroll = 0;
			rolesGrid.scrollLeft = 0;
			overscroll = -targetScroll * 0.25;
		} else if (targetScroll > maxScroll) {
			exactScroll = maxScroll;
			rolesGrid.scrollLeft = maxScroll;
			overscroll = (maxScroll - targetScroll) * 0.25;
		} else {
			exactScroll = targetScroll;
			rolesGrid.scrollLeft = targetScroll;
			overscroll = 0;
		}
		rolesGrid.style.transform = `translateX(${overscroll}px)`;
		velocity = (e.pageX - lastX) * 0.85;
		lastX = e.pageX;
	}

	function startInertia() {
		if (!rolesGrid) return;
		const friction = 0.95;
		let overscrollVelocity = 0;

		function loop() {
			const maxScroll = rolesGrid.scrollWidth - rolesGrid.clientWidth;

			if (overscroll !== 0 || overscrollVelocity !== 0) {
				if (velocity !== 0) {
					overscrollVelocity += velocity * 0.5;
					velocity = 0;
				}

				overscrollVelocity -= overscroll * 0.04;
				overscrollVelocity *= 0.88;
				overscroll += overscrollVelocity;

				if (Math.abs(overscroll) < 0.5 && Math.abs(overscrollVelocity) < 0.5) {
					overscroll = 0;
					overscrollVelocity = 0;
				}

				rolesGrid.style.transform = overscroll !== 0 ? `translateX(${overscroll}px)` : '';

				if (overscroll !== 0) {
					animationFrameId = requestAnimationFrame(loop);
				} else {
					isScrolling = false;
				}
				return;
			}

			if (Math.abs(velocity) > 0.5) {
				exactScroll -= velocity * 2;
				let nextOverscroll = 0;

				if (exactScroll < 0) {
					nextOverscroll = -exactScroll * 0.25;
					exactScroll = 0;
				} else if (exactScroll > maxScroll) {
					nextOverscroll = (exactScroll - maxScroll) * 0.25;
					exactScroll = maxScroll;
				}

				rolesGrid.scrollLeft = Math.round(exactScroll);

				if (nextOverscroll !== 0) {
					overscroll = nextOverscroll;
					rolesGrid.style.transform = `translateX(${overscroll}px)`;
				}

				velocity *= friction;
				animationFrameId = requestAnimationFrame(loop);
				return;
			}

			isScrolling = false;
		}
		loop();
	}

	function scrollRoles(direction) {
		if (!rolesGrid) return;
		const amount = direction === 'left' ? -350 : 350;
		rolesGrid.scrollBy({ left: amount, behavior: 'smooth' });
	}

	function toggleFaq(index) {
		activeFaq = activeFaq === index ? null : index;
	}

	function _openApplicationModal(cat = 'creator') {
		selectedCategory = cat;
		modalStep = 'select';
		showModal = true;
	}

	function generateFolio() {
		const year = new Date().getFullYear();
		const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
		const catCode = selectedCategory.substring(0, 3).toUpperCase();
		return `VS-VRF-${year}-${catCode}-${randomHex}`;
	}

	function handleFormSubmit(e) {
		e.preventDefault();
		if (!applicantHandle.trim()) return;
		if (selectedCategory === 'government' && !isGovEmailValid) return;
		applicantFolio = generateFolio();
		copiedFolio = false;
		modalStep = 'success';
	}

	function copyFolio() {
		if (!applicantFolio) return;
		navigator.clipboard.writeText(applicantFolio);
		copiedFolio = true;
		setTimeout(() => {
			copiedFolio = false;
		}, 3000);
	}

	onMount(() => {
		isMounted = true;
	});

	const roles = [
		{
			id: 'admin',
			presetKey: 'admin',
			category: 'staff',
			level: 'Nivel 0 — Soberanía',
			badgeLevel: 'NIVEL 0',
			title: 'Administrador del Sistema',
			badgeLabel: 'ADMIN',
			icon: 'admin_panel_settings',
			color: 'var(--badge-admin)',
			glowRgba: 'rgba(251, 191, 36, 0.25)',
			tag: 'Staff Global',
			desc: 'La cúpula de gobernanza de V-SOCIAL. Cuentas con acceso integral a la infraestructura, seguridad de datos y directrices operativas globales.',
			criteria: 'Asignado estrictamente a directores y arquitectos de sistemas.',
			perks: [
				'Acceso a Panel de Control Global y Auditoría',
				'Moderación Absoluta y Gestión de Permisos',
				'Mantenimiento de Servidores y Parámetros',
				'Insignia Dorada Oficial con Resaltado Distintivo'
			]
		},
		{
			id: 'moderator',
			presetKey: 'moderator',
			category: 'staff',
			level: 'Nivel 1 — Custodia',
			badgeLevel: 'NIVEL 1',
			title: 'Moderador Oficial',
			badgeLabel: 'MODERADOR',
			icon: 'shield',
			color: 'var(--badge-moderator)',
			glowRgba: 'rgba(16, 185, 129, 0.25)',
			tag: 'Guardianes',
			desc: 'Los protectores del ecosistema. Encargados de salvaguardar el orden, mitigar el contenido nocivo y asegurar una convivencia armónica.',
			criteria: 'Líderes comunitarios de confianza y personal de seguridad capacitado.',
			perks: [
				'Gestión de Reportes y Colas de Moderación',
				'Suspensión Temporal y Sanción de Cuentas',
				'Depuración de Contenido y Spam en Tiempo Real',
				'Insignia Verde Esmeralda de Autoridad'
			]
		},
		{
			id: 'support',
			presetKey: 'support',
			category: 'core',
			level: 'Nivel 2 — Asistencia',
			badgeLevel: 'NIVEL 2',
			title: 'Soporte V-SOCIAL',
			badgeLabel: 'SOPORTE',
			icon: 'support_agent',
			color: 'var(--badge-support)',
			glowRgba: 'rgba(45, 212, 191, 0.25)',
			tag: 'Atención Directa',
			desc: 'El equipo humano de asistencia y arbitraje. Especialistas en resolución de disputas, recuperación de cuentas y validación de identidades.',
			criteria: 'Agentes oficiales del departamento de atención y mediación.',
			perks: [
				'Resolución de Tickets y Apelaciones',
				'Aprobación y Validación de Verificaciones',
				'Canal de Comunicación Oficial con Usuarios',
				'Insignia Aqua Teal con Canal Directo'
			]
		},
		{
			id: 'team',
			presetKey: 'team',
			category: 'core',
			level: 'Nivel 3 — Innovación',
			badgeLevel: 'NIVEL 3',
			title: 'Equipo V-SOCIAL',
			badgeLabel: 'TEAM',
			icon: 'military_tech',
			color: 'var(--badge-team)',
			glowRgba: 'rgba(125, 211, 252, 0.25)',
			tag: 'Staff Core',
			desc: 'Cuentas de ingenieros, diseñadores de producto y colaboradores del núcleo de desarrollo y diseño de V-SOCIAL.',
			criteria: 'Desarrolladores activos, diseñadores UI/UX y staff interno.',
			perks: [
				'Acceso Temprano a Funciones Experimentales',
				'Distintivo Sky Platinum en Perfil y Búsquedas',
				'Participación en Salas de Desarrollo y Feedback',
				'Insignia Oficial de Creador de la Plataforma'
			]
		},
		{
			id: 'government',
			presetKey: 'government',
			category: 'institutional',
			level: 'Nivel 5 — Estado y Ley',
			badgeLevel: 'NIVEL 5',
			title: 'Entidad Gubernamental / Legal',
			badgeLabel: 'GOBIERNO',
			icon: 'account_balance',
			color: 'var(--badge-gov)',
			glowRgba: 'rgba(148, 163, 184, 0.28)',
			tag: 'Estado & Ley',
			desc: 'Entidades gubernamentales, ministerios, organismos públicos, representaciones diplomáticas, cortes y autoridades legales reguladoras.',
			criteria:
				'Verificación estricta de dominios oficiales de gobierno (.gob / .gov), decretos y personería jurídica institucional.',
			perks: [
				'Insignia Titanio / Platino Slate Exclusiva de Estado',
				'Canal Prioritario para Comunicados Oficiales y Alertas',
				'Escudo Criptográfico Máximo Contra Suplantación y Spoofing',
				'Validación Notarial / Gubernamental Comprobada'
			]
		},
		{
			id: 'verified',
			presetKey: 'verified',
			category: 'creators',
			level: 'Nivel 4 — Autenticidad',
			badgeLevel: 'NIVEL 4',
			title: 'Usuario Verificado',
			badgeLabel: 'VERIFICADO',
			icon: 'verified',
			color: 'var(--badge-verified)',
			glowRgba: 'rgba(46, 180, 255, 0.28)',
			tag: 'Identidad Real',
			desc: 'Figuras públicas, creadores de contenido, streamers, VTubers, artistas o marcas que han comprobado su identidad y trayectoria.',
			criteria: 'Evaluación de notoriedad, autenticidad y actividad continua.',
			perks: [
				'Insignia Aero Blue Exclusiva en Toda la Red',
				'Posicionamiento Prioritario en Búsquedas y Feed',
				'Protección Estricta Contra Suplantación y Clones',
				'Soporte Prioritario de Cuenta y Seguridad'
			]
		}
	];

	let filteredRoles = $derived.by(() => {
		if (activeFilter === 'all') return roles;
		return roles.filter((r) => r.category === activeFilter);
	});

	const faqs = [
		{
			q: '¿Cuánto cuesta obtener la insignia de verificación en V-SOCIAL?',
			a: 'La verificación en V-SOCIAL es 100% gratuita. A diferencia de otras plataformas, nosotros no vendemos insignias como suscripción de vanidad. Cada insignia representa una autenticación genuina otorgada por mérito, identidad comprobable o pertenencia al staff.'
		},
		{
			q: '¿Qué requisitos debo cumplir como creador, VTuber o artista?',
			a: 'Debes tener una cuenta activa con perfil completo (avatar, portada y biografía), al menos 30 días de antigüedad, actividad constante en la plataforma, y enlaces verificables a tus canales principales (YouTube, Twitch, X, ArtStation, Portfolio, etc.) donde se demuestre tu comunidad.'
		},
		{
			q: '¿Puedo perder mi insignia de verificación?',
			a: 'Sí. La insignia puede ser revocada si la cuenta cambia de propietario, si se modifican de forma sospechosa el nombre de usuario y datos de identidad para simular otra persona, si incurre en infracciones graves de las normas comunitarias, o tras periodos prolongados de inactividad.'
		},
		{
			q: '¿Cuánto tiempo tarda el equipo en evaluar una solicitud?',
			a: 'El proceso de auditoría es manual y realizado por humanos para garantizar cero falsos positivos. Usualmente toma entre 48 y 72 horas hábiles. Recibirás una notificación en tu bandeja de entrada tan pronto como se complete la revisión.'
		},
		{
			q: '¿Cómo distingo a un miembro del Staff de un usuario verificado o entidad oficial?',
			a: 'Cada rango tiene un color y un icono único: Administradores (Dorado/Corona), Moderadores (Verde/Escudo), Soporte (Aqua/Headset), Equipo de Desarrollo (Sky Blue/Medalla), Entidades Gubernamentales/Legales (Titanio Slate/Pilar) y Usuarios Verificados (Aero Blue/Check). Al hacer clic en cualquier insignia, verás un popup con la descripción oficial y el rol autenticado.'
		}
	];

	const categories = [
		{
			id: 'creator',
			icon: 'palette',
			title: 'Creadores & Artistas',
			desc: 'Ilustradores, modeladores 3D, animadores, concept artists y creadores visuales.',
			tag: 'Arte & Diseño',
			color: 'var(--aero-mint)',
			badgeLabel: 'VERIFICADO',
			badgeRole: 'verified'
		},
		{
			id: 'streamer',
			icon: 'videocam',
			title: 'Streamers & VTubers',
			desc: 'Creadores de contenido en vivo, streamers de videojuegos y talentos virtuales.',
			tag: 'Live & Virtual',
			color: 'var(--aero-coral)',
			badgeLabel: 'VERIFICADO',
			badgeRole: 'verified'
		},
		{
			id: 'organization',
			icon: 'business',
			title: 'Organizaciones & Estudios',
			desc: 'Empresas de entretenimiento, agencias de VTubers, estudios indie y colectivos.',
			tag: 'Estudios & Agencias',
			color: 'var(--aero-sky)',
			badgeLabel: 'ORGANIZACIÓN',
			badgeRole: 'verified'
		},
		{
			id: 'government',
			icon: 'account_balance',
			title: 'Gobierno & Organismos Oficiales',
			desc: 'Ministerios, embajadas, agencias estatales, autoridades legales y servicios públicos.',
			tag: 'Vía Diplomática & Legal',
			color: 'var(--badge-gov)',
			badgeLabel: 'GOBIERNO',
			badgeRole: 'government',
			isGov: true
		},
		{
			id: 'public',
			icon: 'public',
			title: 'Personalidades Públicas',
			desc: 'Músicos, periodistas, atletas y figuras con presencia pública reconocida.',
			tag: 'Notoriedad Pública',
			color: 'var(--aero-amber)',
			badgeLabel: 'VERIFICADO',
			badgeRole: 'verified'
		}
	];
</script>

<svelte:head>
	<title>Jerarquía e Insignias de Verificación - V-SOCIAL</title>
	<meta
		name="description"
		content="Conoce el sistema de verificación, insignias y jerarquía oficial de V-SOCIAL. Autenticidad, protección para creadores y autoridad sin suscripciones de pago."
	/>
</svelte:head>

<div class="verified-container" in:fade={{ duration: 600 }}>
	<!-- Top Breadcrumb Navigation -->
	<div class="top-nav-bar">
		<a href="/about" class="back-link glass-panel">
			<span class="material-icons-round text-base">arrow_back</span>
			<span>Volver a About</span>
		</a>
		<div class="badge-status-chip">
			<span class="status-dot"></span>
			<span>Sistema de Verificación v3.0</span>
		</div>
	</div>

	<!-- Hero Header Section -->
	<header class="page-header">
		<div class="hero-emblem-wrapper">
			<div class="hero-emblem-glow"></div>
			<div class="hero-emblem-badge">
				<span class="material-icons-round emblem-icon">verified</span>
			</div>
		</div>

		<h1 class="header-title">
			Jerarquía de <span class="gradient-text">Verificación</span>
		</h1>
		<p class="header-subtitle">
			En V-SOCIAL, la autoridad se gana y la identidad se protege. Distintivos oficiales
			criptográficos para creadores, personalidades y el equipo directivo.
		</p>

		<!-- Trust Pillars Grid -->
		<div class="trust-pillars">
			<div class="trust-pill glass-card">
				<div class="trust-icon" style="color: var(--aero-amber);">
					<span class="material-icons-round">workspace_premium</span>
				</div>
				<div class="trust-info">
					<strong>6 Distintivos Oficiales</strong>
					<p>Especialización visual por rango</p>
				</div>
			</div>

			<div class="trust-pill glass-card">
				<div class="trust-icon" style="color: var(--aero-mint);">
					<span class="material-icons-round">lock_outline</span>
				</div>
				<div class="trust-info">
					<strong>100% Criptográfico y Gratuito</strong>
					<p>Sin compras pay-to-win</p>
				</div>
			</div>

			<div class="trust-pill glass-card">
				<div class="trust-icon" style="color: var(--aero-sky);">
					<span class="material-icons-round">security</span>
				</div>
				<div class="trust-info">
					<strong>Anti-Suplantación</strong>
					<p>Escudo de autenticidad real</p>
				</div>
			</div>

			<div class="trust-pill glass-card">
				<div class="trust-icon" style="color: var(--accent-blue-base);">
					<span class="material-icons-round">trending_up</span>
				</div>
				<div class="trust-info">
					<strong>Prioridad en Feed</strong>
					<p>Alcance y presencia destacada</p>
				</div>
			</div>
		</div>
	</header>

	<!-- Interactive Live Simulator Section -->
	<section class="simulator-section glass-panel">
		<div class="section-badge">
			<span class="material-icons-round text-sm">tune</span>
			<span>Simulador en Tiempo Real</span>
		</div>
		<h2 class="section-title">Prueba las Insignias en Vivo</h2>
		<p class="section-subtitle">
			Selecciona usuarios y roles de la plataforma para ver cómo se renderiza cada distintivo en
			perfil, feed y comentarios.
		</p>

		<div class="simulator-layout">
			<!-- Controls Column -->
			<div class="sim-controls glass-card">
				<div class="sim-controls-header">
					<div class="controls-header-left">
						<span class="material-icons-round text-base text-aero-blue">tune</span>
						<h3 class="controls-heading">Panel de Simulación</h3>
					</div>
					<button
						type="button"
						class="btn-reset-sim"
						onclick={() => selectUserPreset(simBadgeType)}
						title="Restablecer valores originales del rol activo"
					>
						<span class="material-icons-round text-xs">refresh</span>
						<span>Restablecer</span>
					</button>
				</div>

				<!-- Perfectly Balanced 5-Column Segmented Role Selector -->
				<div class="control-group">
					<span class="control-label">Rango / Insignia Activa:</span>
					<div
						class="role-selector-segmented"
						role="radiogroup"
						aria-label="Seleccionar rango de usuario"
					>
						{#each roles as role}
							<button
								type="button"
								role="radio"
								aria-checked={simBadgeType === role.id}
								class="role-select-pill {simBadgeType === role.id ? 'active' : ''}"
								style="--role-accent: {role.color}; --role-glow: {role.glowRgba};"
								onclick={() => selectUserPreset(role.presetKey)}
							>
								<div class="pill-icon-box">
									<span class="material-icons-round pill-icon">{role.icon}</span>
								</div>
								<span class="pill-title">{role.badgeLabel}</span>
								<span class="pill-sub">{role.badgeLevel}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Form Inputs with Compact 2-Column Grid -->
				<div class="control-row-grid">
					<div class="control-group mb-0">
						<label class="control-label" for="sim-input-name">Nombre Mostrado:</label>
						<input
							id="sim-input-name"
							type="text"
							bind:value={simDisplayName}
							maxlength="32"
							class="sim-input"
						/>
					</div>

					<div class="control-group mb-0">
						<label class="control-label" for="sim-input-handle">Usuario (@handle):</label>
						<div class="input-with-prefix">
							<span class="input-prefix">@</span>
							<input
								id="sim-input-handle"
								type="text"
								bind:value={simUsername}
								maxlength="24"
								class="sim-input"
							/>
						</div>
					</div>
				</div>

				<div class="control-group">
					<label class="control-label" for="sim-input-bio">Biografía del Perfil:</label>
					<textarea
						id="sim-input-bio"
						bind:value={simBio}
						rows="2"
						maxlength="150"
						class="sim-input sim-textarea"
					></textarea>
				</div>

				<div class="control-group mb-0">
					<label class="control-label" for="sim-input-post">Texto de Publicación:</label>
					<input
						id="sim-input-post"
						type="text"
						bind:value={simPostText}
						maxlength="140"
						class="sim-input"
					/>
				</div>
			</div>

			<!-- Preview Window Column -->
			<div class="sim-preview glass-card">
				<div class="preview-header">
					<div class="preview-tabs">
						<button
							type="button"
							class="preview-tab {simActiveTab === 'profile' ? 'active' : ''}"
							onclick={() => (simActiveTab = 'profile')}
						>
							<span class="material-icons-round text-sm">badge</span>
							<span>Perfil</span>
						</button>
						<button
							type="button"
							class="preview-tab {simActiveTab === 'post' ? 'active' : ''}"
							onclick={() => (simActiveTab = 'post')}
						>
							<span class="material-icons-round text-sm">article</span>
							<span>Publicación</span>
						</button>
						<button
							type="button"
							class="preview-tab {simActiveTab === 'comment' ? 'active' : ''}"
							onclick={() => (simActiveTab = 'comment')}
						>
							<span class="material-icons-round text-sm">chat_bubble</span>
							<span>Comentario</span>
						</button>
					</div>
					<span class="preview-live-indicator">
						<span class="live-dot"></span> Interactivo
					</span>
				</div>

				<div class="preview-stage">
					{#if simActiveTab === 'profile'}
						<div class="sim-profile-card" in:fade={{ duration: 250 }}>
							<div class="sim-profile-banner"></div>
							<div class="sim-profile-body">
								<div class="sim-avatar-wrapper">
									<img src={simAvatar} alt={simDisplayName} class="sim-avatar" />
									<span class="sim-status-ring"></span>
								</div>
								<div class="sim-profile-meta">
									<div class="sim-name-row">
										<h4 class="sim-display-name">{simDisplayName}</h4>
										<VerifiedBadge
											role={simBadgeType === 'verified' ? 'user' : simBadgeType}
											isVerified={simBadgeType === 'verified'}
											size="18px"
											interactive={false}
										/>
									</div>
									<span class="sim-handle">@{simUsername}</span>
									<p class="sim-bio">{simBio}</p>
									<div class="sim-stats-row">
										<span><strong>1.4k</strong> Siguiendo</span>
										<span><strong>42.8k</strong> Seguidores</span>
										<span><strong style="color: var(--aero-mint);">Nivel 14</strong></span>
									</div>
								</div>
							</div>
						</div>
					{:else if simActiveTab === 'post'}
						<div class="sim-post-card" in:fade={{ duration: 250 }}>
							<div class="sim-post-header">
								<img src={simAvatar} alt={simDisplayName} class="sim-post-avatar" />
								<div class="sim-post-user-info">
									<div class="sim-name-row">
										<span class="sim-post-name">{simDisplayName}</span>
										<VerifiedBadge
											role={simBadgeType === 'verified' ? 'user' : simBadgeType}
											isVerified={simBadgeType === 'verified'}
											size="15px"
											interactive={false}
										/>
									</div>
									<span class="sim-post-time">@{simUsername} • Hace 8 min</span>
								</div>
							</div>
							<p class="sim-post-content">
								{simPostText}
								<span class="hashtag">{simHashtags}</span>
							</p>
							<div class="sim-post-actions">
								<span class="sim-action"
									><span class="material-icons-round text-base">favorite_border</span> 124</span
								>
								<span class="sim-action"
									><span class="material-icons-round text-base">chat_bubble_outline</span> 18</span
								>
								<span class="sim-action"
									><span class="material-icons-round text-base">repeat</span> 9</span
								>
								<span class="sim-action"
									><span class="material-icons-round text-base">bookmark_border</span></span
								>
							</div>
						</div>
					{:else}
						<div class="sim-comment-box" in:fade={{ duration: 250 }}>
							<div class="sim-comment-item">
								<img src={simAvatar} alt={simDisplayName} class="sim-comment-avatar" />
								<div class="sim-comment-bubble">
									<div class="sim-name-row">
										<span class="sim-comment-name">{simDisplayName}</span>
										<VerifiedBadge
											role={simBadgeType === 'verified' ? 'user' : simBadgeType}
											isVerified={simBadgeType === 'verified'}
											size="14px"
											interactive={false}
										/>
										<span class="sim-comment-time">Hace 2 min</span>
									</div>
									<p class="sim-comment-text">
										{simCommentText}
									</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
				<p class="preview-hint">
					💡 <em
						>Tip: Haz clic en la insignia de verificación para abrir el popup oficial interactivo.</em
					>
				</p>
			</div>
		</div>
	</section>

	<!-- Roles Showcase Section with Filter Tabs -->
	<section class="roles-section">
		<div class="section-header-row">
			<div>
				<div class="section-badge">
					<span class="material-icons-round text-sm">shield</span>
					<span>Ecosistema de Distintivos</span>
				</div>
				<h2 class="section-title">Los 6 Niveles de la Jerarquía</h2>
			</div>

			<!-- Filter Pills -->
			<div class="filter-pills">
				<button
					type="button"
					class="filter-pill {activeFilter === 'all' ? 'active' : ''}"
					onclick={() => (activeFilter = 'all')}
				>
					Todos ({roles.length})
				</button>
				<button
					type="button"
					class="filter-pill {activeFilter === 'staff' ? 'active' : ''}"
					onclick={() => (activeFilter = 'staff')}
				>
					🛡️ Gobernanza
				</button>
				<button
					type="button"
					class="filter-pill {activeFilter === 'core' ? 'active' : ''}"
					onclick={() => (activeFilter = 'core')}
				>
					💎 Core & Soporte
				</button>
				<button
					type="button"
					class="filter-pill {activeFilter === 'institutional' ? 'active' : ''}"
					onclick={() => (activeFilter = 'institutional')}
				>
					🏛️ Institucional
				</button>
				<button
					type="button"
					class="filter-pill {activeFilter === 'creators' ? 'active' : ''}"
					onclick={() => (activeFilter = 'creators')}
				>
					✨ Creadores
				</button>
			</div>
		</div>

		<!-- Scroll Controls Bar -->
		<div class="scroll-controls-bar">
			<span class="scroll-instruction">
				<span class="material-icons-round text-sm">swipe</span> Arrastra horizontalmente o usa las flechas
			</span>
			<div class="scroll-buttons">
				<button
					type="button"
					class="scroll-arrow-btn"
					onclick={() => scrollRoles('left')}
					aria-label="Desplazar a la izquierda"
				>
					<span class="material-icons-round">chevron_left</span>
				</button>
				<button
					type="button"
					class="scroll-arrow-btn"
					onclick={() => scrollRoles('right')}
					aria-label="Desplazar a la derecha"
				>
					<span class="material-icons-round">chevron_right</span>
				</button>
			</div>
		</div>

		<!-- Horizontal Drag-to-Scroll Grid -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="roles-scroll-wrapper hide-scrollbar {isScrolling ? 'dragging' : ''}"
			bind:this={rolesGrid}
			onmousedown={startDrag}
			onmouseleave={stopDrag}
			onmouseup={stopDrag}
			onmousemove={handleDrag}
		>
			<div class="roles-grid">
				{#if isMounted}
					{#each filteredRoles as role, i (role.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="glass-card role-card aero-card"
							in:slide={{ duration: 450, delay: i * 100 }}
							style="--role-color: {role.color}; --role-glow: {role.glowRgba};"
							ondragstart={(e) => e.preventDefault()}
							onmousemove={handleCardMouseMove}
						>
							<!-- Card Top Tag & Level -->
							<div class="card-top-row">
								<span
									class="role-level-tag"
									style="border-color: {role.color}; color: {role.color}"
								>
									{role.level}
								</span>
								<span class="role-category-tag">{role.tag}</span>
							</div>

							<!-- Role Header with Glowing Icon -->
							<div class="role-header">
								<div class="role-icon-box">
									<span class="material-icons-round">{role.icon}</span>
								</div>
								<div class="role-header-text">
									<h3 class="role-title">{role.title}</h3>
									<div class="role-mini-preview">
										<span class="preview-label">Insignia:</span>
										<VerifiedBadge
											role={role.id === 'verified' ? 'user' : role.id}
											isVerified={role.id === 'verified'}
											size="15px"
											interactive={false}
										/>
									</div>
								</div>
							</div>

							<!-- Role Description -->
							<p class="role-desc">{role.desc}</p>

							<!-- Criteria Tag -->
							<div class="role-criteria-box">
								<span class="material-icons-round text-xs" style="color: {role.color}">info</span>
								<span class="criteria-text">{role.criteria}</span>
							</div>

							<!-- Perks Section -->
							<div class="role-perks">
								<h4 class="perks-title">Capacidades & Privilegios</h4>
								<ul class="perks-list">
									{#each role.perks as perk}
										<li>
											<span class="material-icons-round text-sm" style="color: {role.color}">
												check_circle
											</span>
											<span>{perk}</span>
										</li>
									{/each}
								</ul>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</section>

	<!-- Step-by-Step Verification Process -->
	<section class="process-section glass-panel">
		<div class="section-badge">
			<span class="material-icons-round text-sm">route</span>
			<span>Transparencia & Flujo</span>
		</div>
		<h2 class="section-title">¿Cómo se Obtiene la Verificación Oficial?</h2>
		<p class="section-subtitle">
			Un proceso riguroso, humano y libre de algoritmos opacos para salvaguardar la confianza.
		</p>

		<div class="process-steps-grid">
			<div class="step-card glass-card">
				<div class="step-number" style="--step-color: var(--aero-sky);">01</div>
				<h3 class="step-title">Perfil Completo & Trayectoria</h3>
				<p class="step-desc">
					La cuenta debe contar con avatar, banner, biografía descriptiva y enlaces comprobables a
					tus plataformas primarias (Twitch, YouTube, X, Portfolio).
				</p>
			</div>

			<div class="step-card glass-card">
				<div class="step-number" style="--step-color: var(--aero-mint);">02</div>
				<h3 class="step-title">Auditoría Humana</h3>
				<p class="step-desc">
					Nuestro equipo de Soporte y Seguridad analiza manualmente la autenticidad de la identidad,
					asegurando que no exista conflicto ni riesgo de suplantación.
				</p>
			</div>

			<div class="step-card glass-card">
				<div class="step-number" style="--step-color: var(--badge-admin);">03</div>
				<h3 class="step-title">Emisión Criptográfica</h3>
				<p class="step-desc">
					Una vez aprobada, la insignia se asocia criptográficamente a tu ID en base de datos,
					actualizando tus permisos y visibilidad global al instante.
				</p>
			</div>

			<div class="step-card glass-card">
				<div class="step-number" style="--step-color: var(--badge-verified);">04</div>
				<h3 class="step-title">Escudo Continuo</h3>
				<p class="step-desc">
					Acceso prioritario a reportes de suplantación de identidad y protección de tu nombre
					artístico o comercial en todo el ecosistema.
				</p>
			</div>
		</div>
	</section>

	<!-- Comparison Section: V-Social vs Traditional Social Networks -->
	<section class="comparison-section glass-panel">
		<div class="section-badge">
			<span class="material-icons-round text-sm">compare_arrows</span>
			<span>Diferenciación Fundamental</span>
		</div>
		<h2 class="section-title">¿Por qué el Modelo de V-SOCIAL es Superior?</h2>

		<div class="comparison-grid">
			<div class="comparison-column glass-card vsocial-col">
				<div class="column-header">
					<span class="material-icons-round header-icon" style="color: var(--aero-blue);"
						>verified_user</span
					>
					<h3>V-SOCIAL</h3>
					<span class="col-tag pro">Modelo de Autenticidad Real</span>
				</div>
				<ul class="comparison-features">
					<li>
						<span class="material-icons-round icon-check">check_circle</span>
						<span><strong>100% Gratuito:</strong> La verificación no se compra con dinero.</span>
					</li>
					<li>
						<span class="material-icons-round icon-check">check_circle</span>
						<span><strong>Auditoría Manual:</strong> Evaluado por seres humanos, no bots.</span>
					</li>
					<li>
						<span class="material-icons-round icon-check">check_circle</span>
						<span><strong>Protección Real:</strong> Escudo contra clones y usurpadores.</span>
					</li>
					<li>
						<span class="material-icons-round icon-check">check_circle</span>
						<span
							><strong>Jerarquía Transparente:</strong> Distinción clara entre Staff y Creadores.</span
						>
					</li>
				</ul>
			</div>

			<div class="comparison-column glass-card other-col">
				<div class="column-header">
					<span class="material-icons-round header-icon text-muted">cancel</span>
					<h3>Otras Redes</h3>
					<span class="col-tag con">Modelo Pay-To-Win</span>
				</div>
				<ul class="comparison-features">
					<li class="negative">
						<span class="material-icons-round icon-cross">cancel</span>
						<span
							><strong>Suscripción Mensual:</strong> Cualquiera con tarjeta puede comprar un check.</span
						>
					</li>
					<li class="negative">
						<span class="material-icons-round icon-cross">cancel</span>
						<span
							><strong>Proliferación de Estafas:</strong> Cuentas falsas con insignias pagadas.</span
						>
					</li>
					<li class="negative">
						<span class="material-icons-round icon-cross">cancel</span>
						<span
							><strong>Pérdida de Significado:</strong> La insignia ya no demuestra autoridad real.</span
						>
					</li>
					<li class="negative">
						<span class="material-icons-round icon-cross">cancel</span>
						<span><strong>Soporte Automatizado:</strong> Sin contacto directo ante problemas.</span>
					</li>
				</ul>
			</div>
		</div>
	</section>

	<!-- FAQ Section with Interactive Accordions -->
	<section class="faq-section">
		<div class="section-badge">
			<span class="material-icons-round text-sm">help_outline</span>
			<span>Preguntas Frecuentes</span>
		</div>
		<h2 class="section-title">Todo lo que necesitas saber</h2>
		<p class="section-subtitle">
			Resolvemos las dudas más habituales sobre requisitos, auditoría y mantenimiento de insignias.
		</p>

		<div class="faq-list">
			{#each faqs as faq, index}
				<div class="faq-item glass-card {activeFaq === index ? 'active' : ''}">
					<button
						type="button"
						class="faq-question-btn"
						onclick={() => toggleFaq(index)}
						aria-expanded={activeFaq === index}
						aria-controls="faq-ans-{index}"
					>
						<span class="faq-q-text">{faq.q}</span>
						<span class="material-icons-round faq-chevron">expand_more</span>
					</button>
					{#if activeFaq === index}
						<div
							id="faq-ans-{index}"
							class="faq-answer-container"
							transition:slide={{ duration: 250, easing: cubicOut }}
						>
							<div class="faq-answer">
								<p>{faq.a}</p>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<!-- Call To Action & Application Section -->
	<section class="apply-section glass-panel">
		<div class="apply-glow"></div>
		<div class="apply-content">
			<div class="apply-icon-bubble">
				<span class="material-icons-round text-5xl">gpp_good</span>
			</div>
			<h2 class="apply-title">¿Eres una figura pública, creador destacado o artista?</h2>
			<p class="apply-desc">
				Protege tu identidad, obtén tu distintivo oficial y destaca con prestigio en el feed de
				V-SOCIAL.
			</p>

			<div class="apply-actions">
				<a href="/about/verified/apply" class="btn-aero-primary apply-cta-btn">
					<span class="material-icons-round text-xl">verified</span>
					<span>Acceder al Portal de Auditoría</span>
				</a>
				<a href="/about" class="btn-aero-secondary learn-more-btn">
					<span class="material-icons-round text-xl">info</span>
					<span>Conocer Más Sobre V-SOCIAL</span>
				</a>
			</div>
		</div>
	</section>
</div>

<!-- Interactive Application Modal -->
{#if showModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-backdrop"
		onclick={() => (showModal = false)}
		transition:fade={{ duration: 200 }}
	>
		<div
			class="apply-modal glass-card aero-modal {selectedCategory === 'government' ? 'is-gov' : ''}"
			onclick={(e) => e.stopPropagation()}
			transition:scale={{ duration: 300, start: 0.92, easing: quintOut }}
		>
			<button
				type="button"
				class="close-modal-btn"
				onclick={() => (showModal = false)}
				aria-label="Cerrar modal"
			>
				<span class="material-icons-round">close</span>
			</button>

			{#if modalStep === 'select'}
				<div class="modal-header">
					<div class="modal-badge-icon">
						<span class="material-icons-round text-3xl">verified</span>
					</div>
					<h3 class="modal-title">Centro de Solicitud de Verificación</h3>
					<p class="modal-subtitle">
						Selecciona la categoría que mejor describe tu identidad o institución para desplegar el
						protocolo correspondiente:
					</p>
				</div>

				<div class="category-grid">
					{#each categories as cat}
						<button
							type="button"
							class="category-card {selectedCategory === cat.id ? 'active' : ''} {cat.isGov
								? 'gov-card-option'
								: ''}"
							style="--cat-color: {cat.color};"
							onclick={() => (selectedCategory = cat.id)}
						>
							<div class="cat-icon-wrapper" style="color: {cat.color};">
								<span class="material-icons-round cat-icon">{cat.icon}</span>
							</div>
							<div class="cat-info">
								<div class="cat-title-row">
									<strong>{cat.title}</strong>
									<span class="cat-tag-pill">{cat.tag}</span>
								</div>
								<p>{cat.desc}</p>
							</div>
						</button>
					{/each}
				</div>

				<div class="modal-footer">
					<a
						href="/about/verified/apply/{selectedCategory}"
						class="btn-aero-primary w-full py-3 font-bold text-center justify-center inline-flex items-center gap-2"
					>
						<span>Acceder al Portal de Auditoría de {currentCategory.title}</span>
						<span class="material-icons-round text-base">arrow_forward</span>
					</a>
				</div>
			{:else if modalStep === 'form'}
				{#if selectedCategory === 'government'}
					<div class="modal-header gov-header">
						<div class="gov-badge-seal">
							<span class="material-icons-round text-3xl">account_balance</span>
						</div>
						<h3 class="modal-title gov-title">Acreditación Gubernamental & Legal</h3>
						<p class="modal-subtitle">
							Protocolo de validación institucional de soberanía y fe pública para entidades y
							organismos del Estado.
						</p>
						<div class="gov-sovereign-alert">
							<span class="material-icons-round text-base">policy</span>
							<div class="alert-text">
								<strong>Aviso de Seguridad Institucional:</strong>
								<p>
									Esta vía es de uso estricto para entidades estatales, diplomáticas y autoridades
									legales. Se exige correo oficial con dominio gubernamental (.gob / .gov / .mil /
									.int).
								</p>
							</div>
						</div>
					</div>
				{:else}
					<div class="modal-header">
						<div
							class="modal-badge-icon"
							style="color: {currentCategory.color}; border-color: {currentCategory.color}; background: color-mix(in srgb, {currentCategory.color} 15%, transparent);"
						>
							<span class="material-icons-round text-3xl">{currentCategory.icon}</span>
						</div>
						<h3 class="modal-title">{currentCategory.title}</h3>
						<p class="modal-subtitle">
							Ingresa tus evidencias y enlaces verificables para que el equipo humano audite tu
							autenticidad:
						</p>
					</div>
				{/if}

				<form onsubmit={handleFormSubmit} class="modal-form">
					<!-- Common Identity Fields -->
					<div class="form-row-2col">
						<div class="form-group">
							<label for="app-username">Usuario en V-SOCIAL *</label>
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
							<label for="app-contact-email">Correo de Contacto *</label>
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

					<!-- Category Specific Fields -->
					{#if selectedCategory === 'creator'}
						<div class="form-row-2col">
							<div class="form-group">
								<label for="creator-specialty">Especialidad Principal *</label>
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
								rows="2"
								placeholder="https://artstation.com/mi_perfil&#10;https://behance.net/mi_perfil&#10;https://cara.app/mi_perfil"
								required
								bind:value={creatorPortfolios}
								class="modal-input"
							></textarea>
						</div>

						<div class="form-group">
							<label for="creator-proof">Enlace de Mención o Prueba de Autoría</label>
							<input
								id="creator-proof"
								type="url"
								placeholder="URL a post en X/Bluesky/ArtStation mencionando @tu_usuario en V-SOCIAL"
								bind:value={creatorProofLink}
								class="modal-input"
							/>
						</div>

						<div class="requisitos-checklist glass-panel">
							<h4 class="font-bold text-xs uppercase tracking-wider text-muted mb-2">
								Requisitos de Auditoría para Creadores
							</h4>
							<ul class="checklist-items">
								<li>
									<span class="material-icons-round text-xs text-mint">check</span> Portafolio activo
									con al menos 6 piezas artísticas originales
								</li>
								<li>
									<span class="material-icons-round text-xs text-mint">check</span> Demostración de autoría
									humana y proceso creativo
								</li>
								<li>
									<span class="material-icons-round text-xs text-mint">check</span> Perfil completo en
									V-SOCIAL con avatar y portada
								</li>
							</ul>
						</div>

						<label class="checkbox-control">
							<input type="checkbox" required bind:checked={creatorAck} />
							<span
								>Certifico que soy el autor legítimo de las obras presentadas y que el contenido
								cumple las normas comunitarias.</span
							>
						</label>
					{:else if selectedCategory === 'streamer'}
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
								rows="2"
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
							<label for="streamer-proof">Prueba de Vinculación en Vivo</label>
							<input
								id="streamer-proof"
								type="text"
								placeholder="Comando de chat !vsocial o enlace en panel de Twitch / YouTube"
								bind:value={streamerProofLink}
								class="modal-input"
							/>
						</div>

						<label class="checkbox-control">
							<input type="checkbox" required bind:checked={streamerAck} />
							<span
								>Declaro ser el titular legítimo del canal y contar con los derechos de uso del
								avatar/modelo virtual.</span
							>
						</label>
					{:else if selectedCategory === 'organization'}
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
									placeholder="ej. México / RFC VAE123456"
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
								rows="2"
								placeholder="Enlaces a web oficial, juegos publicados en Steam o roster de talentos..."
								required
								bind:value={orgProjects}
								class="modal-input"
							></textarea>
						</div>

						<div class="form-group">
							<label for="org-role">Cargo del Solicitante *</label>
							<input
								id="org-role"
								type="text"
								placeholder="ej. Director Ejecutivo (CEO), Head of Talent, Lead Community"
								required
								bind:value={orgApplicantRole}
								class="modal-input"
							/>
						</div>

						<label class="checkbox-control">
							<input type="checkbox" required bind:checked={orgAck} />
							<span
								>Certifico contar con la debida personería y autorización para gestionar la
								presencia oficial de esta organización.</span
							>
						</label>
					{:else if selectedCategory === 'government'}
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
									Los correos comerciales (@gmail, etc.) serán desestimados.
								</span>
							{:else if govEmail}
								<span class="field-hint valid">
									<span class="material-icons-round text-xs">check_circle</span>
									Dominio gubernamental validado.
								</span>
							{/if}
						</div>

						<div class="form-row-2col">
							<div class="form-group">
								<label for="gov-resolution"
									>Decreto / Gaceta Oficial / Resolución de Personería *</label
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

						<label class="checkbox-control gov-checkbox">
							<input type="checkbox" required bind:checked={govAck} />
							<span
								>Declaro bajo fe pública y responsabilidad de estado que esta solicitud representa a
								un organismo oficial legítimo.</span
							>
						</label>
					{:else if selectedCategory === 'public'}
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
								rows="2"
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

						<label class="checkbox-control">
							<input type="checkbox" required bind:checked={publicAck} />
							<span
								>Confirmo la veracidad de mi notoriedad pública y acepto el cotejo de identidad
								confidencial bajo normativas RGPD.</span
							>
						</label>
					{/if}

					<div class="modal-footer-dual">
						<button type="button" class="btn-aero-secondary" onclick={() => (modalStep = 'select')}>
							Atrás
						</button>
						<button
							type="submit"
							class="btn-aero-primary font-bold {selectedCategory === 'government'
								? 'btn-gov-submit'
								: ''}"
						>
							<span class="material-icons-round text-base"
								>{selectedCategory === 'government' ? 'policy' : 'verified'}</span
							>
							<span
								>{selectedCategory === 'government'
									? 'Emitir Acreditación Oficial'
									: 'Enviar Solicitud'}</span
							>
						</button>
					</div>
				</form>
			{:else}
				<div class="modal-success" in:scale={{ duration: 250 }}>
					<div
						class="success-icon-box {selectedCategory === 'government' ? 'gov-success-icon' : ''}"
					>
						<span class="material-icons-round text-4xl"
							>{selectedCategory === 'government' ? 'account_balance' : 'mark_email_read'}</span
						>
					</div>
					<h3 class="modal-title">¡Solicitud Registrada y Firmada!</h3>
					<p class="modal-subtitle text-center">
						Hemos recibido la solicitud para <strong>@{applicantHandle}</strong> en la categoría de
						<strong>{currentCategory.title}</strong>.
					</p>

					<!-- Cryptographic Tracking Folio Box -->
					<div class="folio-box glass-panel">
						<span class="folio-label">FOLIO CRIPTOGRÁFICO DE AUDITORÍA</span>
						<div class="folio-code-row">
							<code class="folio-code">{applicantFolio}</code>
							<button type="button" class="btn-copy-folio" onclick={copyFolio} title="Copiar folio">
								<span class="material-icons-round text-sm"
									>{copiedFolio ? 'check' : 'content_copy'}</span
								>
								<span>{copiedFolio ? '¡Copiado!' : 'Copiar'}</span>
							</button>
						</div>
					</div>

					<div class="audit-sla-card glass-panel">
						<div class="sla-row">
							<span class="material-icons-round text-sm text-mint">hourglass_top</span>
							<span
								><strong>Plazo Estimado:</strong>
								{selectedCategory === 'government'
									? '24 horas prioritarias'
									: '48 a 72 horas hábiles'}</span
							>
						</div>
						<div class="sla-row">
							<span class="material-icons-round text-sm text-mint">person_search</span>
							<span
								><strong>Auditoría:</strong> Evaluación manual 100% humana libre de sesgos automatizados</span
							>
						</div>
						<div class="sla-row">
							<span class="material-icons-round text-sm text-mint">mail</span>
							<span
								><strong>Resolución:</strong> Notificación en tu bandeja de V-SOCIAL y al correo registrado</span
							>
						</div>
					</div>

					<div class="modal-footer">
						<button
							type="button"
							class="btn-aero-primary w-full py-3 font-bold"
							onclick={() => (showModal = false)}
						>
							Entendido y Finalizar
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* ══════════════════════════════════════════════════════════════════════
	   MAIN CONTAINER & TYPOGRAPHY
	   ══════════════════════════════════════════════════════════════════════ */
	.verified-container {
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

	.text-mint {
		color: var(--aero-mint);
	}

	.text-aero-blue {
		color: var(--aero-blue);
	}

	/* ══════════════════════════════════════════════════════════════════════
	   TOP NAVIGATION & STATUS CHIP
	   ══════════════════════════════════════════════════════════════════════ */
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

	/* ══════════════════════════════════════════════════════════════════════
	   PAGE HEADER & TRUST PILLARS
	   ══════════════════════════════════════════════════════════════════════ */
	.page-header {
		text-align: center;
		margin-bottom: 3.2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.hero-emblem-wrapper {
		position: relative;
		width: 72px;
		height: 72px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.4rem;
	}

	.hero-emblem-glow {
		position: absolute;
		inset: -8px;
		background: radial-gradient(
			circle,
			rgba(27, 133, 243, 0.45) 0%,
			rgba(0, 212, 170, 0.2) 50%,
			transparent 70%
		);
		filter: blur(14px);
		border-radius: var(--radius-full);
		z-index: 0;
		animation: pulseEmblemGlow 3.5s ease-in-out infinite alternate;
	}

	@keyframes pulseEmblemGlow {
		0% {
			transform: scale(0.95);
			opacity: 0.7;
		}
		100% {
			transform: scale(1.15);
			opacity: 1;
		}
	}

	.hero-emblem-badge {
		position: relative;
		z-index: 1;
		width: 64px;
		height: 64px;
		border-radius: var(--radius-full);
		background: linear-gradient(
			135deg,
			var(--aero-blue) 0%,
			var(--aero-sky) 55%,
			var(--aero-mint) 100%
		);
		border: 1.5px solid rgba(255, 255, 255, 0.55);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		box-shadow:
			0 10px 28px rgba(27, 133, 243, 0.45),
			0 2px 8px rgba(0, 0, 0, 0.12),
			inset 0 2px 2px rgba(255, 255, 255, 0.8),
			inset 0 -2px 2px rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(12px);
		transition: transform 0.3s var(--ease-spring);
		animation: floatEmblem 4s ease-in-out infinite alternate;
	}

	@keyframes floatEmblem {
		0% {
			transform: translateY(0px) rotate(0deg);
		}
		100% {
			transform: translateY(-4px) rotate(2deg);
		}
	}

	.hero-emblem-badge:hover {
		transform: scale(1.08) translateY(-2px);
	}

	.emblem-icon {
		font-size: 36px;
		filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.2));
	}

	.header-title {
		font-size: clamp(2.2rem, 4.8vw, 3.4rem);
		font-weight: 900;
		font-family: var(--font-display);
		line-height: 1.15;
		margin-bottom: 0.9rem;
		color: var(--text-primary);
		letter-spacing: -0.03em;
	}

	.header-subtitle {
		font-size: clamp(0.98rem, 1.8vw, 1.15rem);
		color: var(--text-secondary);
		max-width: 680px;
		line-height: 1.55;
		margin: 0 auto 2.2rem;
	}

	/* Trust Pillars */
	.trust-pillars {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
		width: 100%;
		max-width: 1080px;
	}

	.trust-pill {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.95rem 1.1rem;
		border-radius: var(--radius-md);
		text-align: left;
		transition:
			transform 0.25s var(--ease-spring),
			border-color 0.25s ease,
			box-shadow 0.25s ease;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
	}

	.trust-pill:hover {
		transform: translateY(-3px);
		border-color: var(--aero-sky);
		box-shadow: 0 8px 20px rgba(27, 133, 243, 0.12);
	}

	.trust-icon {
		flex: 0 0 38px;
		min-width: 38px;
		min-height: 38px;
		height: 38px;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.07);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.trust-icon span {
		font-size: 20px;
	}

	.trust-info strong {
		display: block;
		font-size: 0.88rem;
		color: var(--text-primary);
		margin-bottom: 0.15rem;
	}

	.trust-info p {
		font-size: 0.76rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.3;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   SECTION SHARED HEADINGS & BADGES
	   ══════════════════════════════════════════════════════════════════════ */
	.section-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.74rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--aero-blue);
		background: rgba(27, 133, 243, 0.1);
		border: 1px solid rgba(27, 133, 243, 0.25);
		padding: 0.3rem 0.75rem;
		border-radius: var(--radius-full);
		margin-bottom: 0.6rem;
	}

	.section-title {
		font-size: clamp(1.6rem, 3vw, 2.2rem);
		font-weight: 900;
		font-family: var(--font-display);
		color: var(--text-primary);
		margin-bottom: 0.45rem;
		letter-spacing: -0.02em;
	}

	.section-subtitle {
		font-size: 0.95rem;
		color: var(--text-secondary);
		max-width: 640px;
		margin-bottom: 2rem;
		line-height: 1.5;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   INTERACTIVE LIVE SIMULATOR SECTION & POLISHED SIM-CONTROLS
	   ══════════════════════════════════════════════════════════════════════ */
	.simulator-section {
		padding: 2.2rem 1.8rem;
		border-radius: var(--radius-xl);
		margin-bottom: 3.5rem;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
	}

	.simulator-layout {
		display: grid;
		grid-template-columns: 1fr 1.05fr;
		gap: 1.6rem;
		align-items: start;
	}

	@media (max-width: 900px) {
		.simulator-layout {
			grid-template-columns: 1fr;
		}
	}

	.sim-controls {
		padding: 1.5rem 1.4rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		background: linear-gradient(
			145deg,
			rgba(255, 255, 255, 0.08) 0%,
			rgba(255, 255, 255, 0.02) 100%
		);
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.05),
			inset 0 1px 1px rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}

	.sim-controls-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.2rem;
		padding-bottom: 0.8rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.controls-header-left {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.controls-heading {
		font-size: 1.05rem;
		font-weight: 800;
		font-family: var(--font-display);
		color: var(--text-primary);
		margin: 0;
	}

	.btn-reset-sim {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--border-subtle);
		padding: 0.25rem 0.55rem;
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}

	.btn-reset-sim:hover {
		color: var(--aero-blue);
		border-color: var(--aero-blue);
		transform: scale(1.04);
	}

	.control-group {
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.control-group.mb-0 {
		margin-bottom: 0;
	}

	.control-row-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	@media (max-width: 480px) {
		.control-row-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
	}

	.control-label {
		display: block;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-secondary);
		letter-spacing: -0.01em;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   PERFECTLY BALANCED 6-COLUMN ROLE SELECTOR
	   ══════════════════════════════════════════════════════════════════════ */
	.role-selector-segmented {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 5px;
		background: rgba(0, 0, 0, 0.06);
		padding: 5px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
		width: 100%;
	}

	:global([data-theme='dark']) .role-selector-segmented,
	:global([data-theme='midnight']) .role-selector-segmented {
		background: rgba(0, 0, 0, 0.3);
	}

	.role-select-pill {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		padding: 7px 3px 6px;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid transparent;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.22s var(--ease-spring);
		user-select: none;
		position: relative;
		overflow: hidden;
		min-width: 0;
	}

	.role-select-pill .pill-icon-box {
		width: 26px;
		height: 26px;
		border-radius: var(--radius-xs);
		background: rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--role-accent, var(--text-muted));
		transition: transform 0.22s var(--ease-spring);
	}

	.role-select-pill .pill-icon {
		font-size: 16px;
	}

	.role-select-pill .pill-title {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
		line-height: 1.1;
	}

	.role-select-pill .pill-sub {
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--text-muted);
		letter-spacing: 0.01em;
		line-height: 1;
	}

	.role-select-pill:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: color-mix(in srgb, var(--role-accent) 40%, transparent);
		transform: translateY(-2px);
	}

	.role-select-pill:hover .pill-icon-box {
		transform: scale(1.1);
		background: color-mix(in srgb, var(--role-accent) 20%, transparent);
	}

	.role-select-pill.active {
		background: color-mix(in srgb, var(--role-accent) 15%, var(--bg-surface));
		border-color: var(--role-accent);
		box-shadow:
			0 4px 14px color-mix(in srgb, var(--role-accent) 25%, transparent),
			inset 0 1px 1px rgba(255, 255, 255, 0.35);
	}

	.role-select-pill.active .pill-icon-box {
		background: color-mix(in srgb, var(--role-accent) 25%, transparent);
		box-shadow: 0 0 10px color-mix(in srgb, var(--role-accent) 40%, transparent);
	}

	.role-select-pill.active .pill-title {
		color: var(--text-primary);
	}

	.role-select-pill.active .pill-sub {
		color: var(--role-accent);
		font-weight: 800;
	}

	@media (max-width: 440px) {
		.role-selector-segmented {
			grid-template-columns: repeat(3, 1fr);
		}
		.role-select-pill:last-child {
			grid-column: span 2;
		}
	}

	/* Form Inputs */
	.sim-input {
		width: 100%;
		padding: 0.6rem 0.85rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--bg-input);
		color: var(--text-primary);
		font-size: 0.84rem;
		font-family: inherit;
		outline: none;
		transition: all 0.2s ease;
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.sim-input:focus {
		border-color: var(--aero-blue);
		box-shadow: 0 0 0 3px rgba(27, 133, 243, 0.15);
	}

	.sim-textarea {
		resize: vertical;
		line-height: 1.4;
		min-height: 50px;
	}

	.input-with-prefix {
		display: flex;
		align-items: center;
		position: relative;
	}

	.input-prefix {
		position: absolute;
		left: 0.85rem;
		color: var(--text-muted);
		font-weight: 700;
		font-size: 0.85rem;
		pointer-events: none;
	}

	.input-with-prefix .sim-input {
		padding-left: 1.9rem;
	}

	/* Simulator Preview Window */
	.sim-preview {
		padding: 1.5rem 1.4rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
	}

	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 0.8rem;
		margin-bottom: 1.2rem;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.preview-tabs {
		display: flex;
		gap: 0.35rem;
		background: rgba(0, 0, 0, 0.08);
		padding: 3px;
		border-radius: var(--radius-md);
	}

	:global([data-theme='dark']) .preview-tabs,
	:global([data-theme='midnight']) .preview-tabs {
		background: rgba(255, 255, 255, 0.06);
	}

	.preview-tab {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.7rem;
		border-radius: var(--radius-sm);
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.preview-tab.active {
		background: var(--bg-surface);
		color: var(--text-primary);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
	}

	.preview-live-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--aero-mint);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.live-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		background: var(--aero-mint);
		box-shadow: 0 0 8px var(--aero-mint);
	}

	.preview-stage {
		min-height: 210px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Simulated Profile Card */
	.sim-profile-card {
		width: 100%;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
	}

	.sim-profile-banner {
		height: 60px;
		background: linear-gradient(135deg, var(--accent-blue-base) 0%, var(--aero-mint) 100%);
	}

	.sim-profile-body {
		padding: 0.9rem 1.1rem 1.1rem;
		position: relative;
	}

	.sim-avatar-wrapper {
		position: absolute;
		top: -30px;
		left: 1.1rem;
		width: 52px;
		height: 52px;
		border-radius: var(--radius-full);
		border: 3px solid var(--bg-surface);
		overflow: hidden;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
	}

	.sim-avatar {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.sim-profile-meta {
		padding-top: 1.5rem;
	}

	.sim-name-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.sim-display-name {
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}

	.sim-handle {
		font-size: 0.8rem;
		color: var(--text-muted);
		display: block;
		margin-bottom: 0.5rem;
	}

	.sim-bio {
		font-size: 0.82rem;
		color: var(--text-secondary);
		line-height: 1.4;
		margin-bottom: 0.7rem;
	}

	.sim-stats-row {
		display: flex;
		gap: 0.9rem;
		font-size: 0.78rem;
		color: var(--text-secondary);
		border-top: 1px solid var(--border-subtle);
		padding-top: 0.5rem;
	}

	/* Simulated Post Card */
	.sim-post-card {
		width: 100%;
		padding: 1.1rem;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
	}

	.sim-post-header {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 0.65rem;
	}

	.sim-post-avatar {
		width: 38px;
		height: 38px;
		border-radius: var(--radius-full);
		object-fit: cover;
		flex: 0 0 38px;
		min-width: 38px;
		min-height: 38px;
	}

	.sim-post-name {
		font-weight: 800;
		color: var(--text-primary);
		font-size: 0.88rem;
	}

	.sim-post-time {
		font-size: 0.74rem;
		color: var(--text-muted);
	}

	.sim-post-content {
		font-size: 0.86rem;
		color: var(--text-secondary);
		line-height: 1.45;
		margin-bottom: 0.85rem;
	}

	.sim-post-content .hashtag {
		color: var(--aero-blue);
		font-weight: 600;
		display: block;
		margin-top: 0.3rem;
	}

	.sim-post-actions {
		display: flex;
		gap: 1.2rem;
		color: var(--text-muted);
		font-size: 0.78rem;
		border-top: 1px solid var(--border-subtle);
		padding-top: 0.5rem;
	}

	.sim-action {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.sim-action:hover {
		color: var(--aero-blue);
	}

	/* Simulated Comment Item */
	.sim-comment-box {
		width: 100%;
	}

	.sim-comment-item {
		display: flex;
		gap: 0.65rem;
		align-items: flex-start;
	}

	.sim-comment-avatar {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-full);
		object-fit: cover;
		flex: 0 0 34px;
		min-width: 34px;
		min-height: 34px;
	}

	.sim-comment-bubble {
		flex: 1;
		background: rgba(0, 0, 0, 0.04);
		padding: 0.75rem 0.9rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
	}

	:global([data-theme='dark']) .sim-comment-bubble,
	:global([data-theme='midnight']) .sim-comment-bubble {
		background: rgba(255, 255, 255, 0.05);
	}

	.sim-comment-name {
		font-weight: 700;
		color: var(--text-primary);
		font-size: 0.85rem;
	}

	.sim-comment-time {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-left: auto;
	}

	.sim-comment-text {
		font-size: 0.84rem;
		color: var(--text-secondary);
		margin-top: 0.3rem;
		line-height: 1.4;
	}

	.preview-hint {
		font-size: 0.76rem;
		color: var(--text-muted);
		text-align: center;
		margin-top: 1rem;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   ROLES SECTION & HORIZONTAL CAROUSEL
	   ══════════════════════════════════════════════════════════════════════ */
	.roles-section {
		margin-bottom: 3.5rem;
	}

	.section-header-row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1.2rem;
		margin-bottom: 1.2rem;
	}

	.filter-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		background: var(--bg-surface);
		padding: 0.3rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
	}

	.filter-pill {
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: 700;
		padding: 0.4rem 0.85rem;
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}

	.filter-pill:hover {
		color: var(--text-primary);
	}

	.filter-pill.active {
		background: var(--aero-blue);
		color: #ffffff;
		box-shadow: 0 3px 12px rgba(27, 133, 243, 0.3);
	}

	.scroll-controls-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.8rem;
	}

	.scroll-instruction {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.scroll-buttons {
		display: flex;
		gap: 0.4rem;
	}

	.scroll-arrow-btn {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-full);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
	}

	.scroll-arrow-btn:hover {
		border-color: var(--aero-blue);
		color: var(--aero-blue);
		transform: scale(1.06);
	}

	/* Horizontal Drag Scroller */
	.roles-scroll-wrapper {
		width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		cursor: grab;
		padding: 1rem 0 2rem;
		scrollbar-width: none;
		-webkit-mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
		mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
	}

	.roles-scroll-wrapper.dragging .role-card {
		pointer-events: none;
	}

	.roles-scroll-wrapper::-webkit-scrollbar {
		display: none;
	}

	.roles-scroll-wrapper:active {
		cursor: grabbing;
	}

	.roles-grid {
		display: flex;
		gap: 1.4rem;
		width: max-content;
		padding-left: 1.5rem;
		padding-right: 1.5rem;
	}

	/* Role Card Styling with Neo-Aero Depth */
	.role-card {
		width: 330px;
		flex-shrink: 0;
		padding: 1.8rem 1.5rem;
		position: relative;
		overflow: hidden;
		transition:
			transform 0.45s var(--ease-spring),
			box-shadow 0.45s ease,
			border-color 0.45s ease;
		background: linear-gradient(
			145deg,
			rgba(255, 255, 255, 0.7) 0%,
			rgba(255, 255, 255, 0.35) 100%
		);
		border: 1px solid var(--border-subtle);
		border-top: 1px solid var(--glass-border-t);
		border-radius: var(--radius-lg);
		box-shadow:
			0 10px 28px rgba(0, 0, 0, 0.06),
			inset 0 1px 2px rgba(255, 255, 255, 0.7);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		display: flex;
		flex-direction: column;
	}

	:global([data-theme='dark']) .role-card {
		background: linear-gradient(145deg, rgba(20, 30, 48, 0.65) 0%, rgba(10, 18, 30, 0.45) 100%);
		box-shadow:
			0 14px 35px rgba(0, 0, 0, 0.4),
			inset 0 1px 1px rgba(255, 255, 255, 0.15);
	}

	:global([data-theme='midnight']) .role-card {
		background: linear-gradient(145deg, rgba(10, 16, 28, 0.75) 0%, rgba(4, 8, 16, 0.55) 100%);
		box-shadow:
			0 14px 35px rgba(0, 0, 0, 0.6),
			inset 0 1px 1px rgba(255, 255, 255, 0.1);
	}

	/* Specular Light Follower */
	.role-card::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.5s ease;
		background: radial-gradient(
			450px circle at var(--mouse-x, 0) var(--mouse-y, 0),
			rgba(255, 255, 255, 0.22),
			transparent 40%
		);
	}

	:global([data-theme='dark']) .role-card::after,
	:global([data-theme='midnight']) .role-card::after {
		background: radial-gradient(
			450px circle at var(--mouse-x, 0) var(--mouse-y, 0),
			rgba(255, 255, 255, 0.08),
			transparent 40%
		);
	}

	.role-card:hover::after {
		opacity: 1;
	}

	.role-card:hover {
		transform: translateY(-6px) scale(1.01);
		border-color: var(--role-color);
		box-shadow:
			0 20px 40px rgba(0, 0, 0, 0.16),
			0 0 24px var(--role-glow, transparent);
	}

	.card-top-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.85rem;
		min-height: 28px;
	}

	.role-level-tag {
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.22rem 0.6rem;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid;
		line-height: 1;
		display: inline-flex;
		align-items: center;
	}

	.role-category-tag {
		font-size: 0.72rem;
		color: var(--text-muted);
		font-weight: 600;
		line-height: 1;
		display: inline-flex;
		align-items: center;
	}

	.role-header {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		margin-bottom: 0.9rem;
		min-height: 48px;
	}

	.role-header-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.role-icon-box {
		width: 46px;
		height: 46px;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid var(--role-color);
		color: var(--role-color);
		box-shadow:
			0 4px 14px var(--role-glow, transparent),
			inset 0 0 12px color-mix(in srgb, var(--role-color) 35%, transparent);
		flex: 0 0 46px;
		min-width: 46px;
		min-height: 46px;
	}

	.role-icon-box span {
		font-size: 26px;
	}

	.role-title {
		font-size: 1.12rem;
		font-weight: 900;
		color: var(--text-primary);
		margin: 0 0 0.2rem;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.role-mini-preview {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.preview-label {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.role-desc {
		font-size: 0.84rem;
		color: var(--text-secondary);
		line-height: 1.45;
		margin-bottom: 0.85rem;
		min-height: 56px;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.role-criteria-box {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.75rem;
		color: var(--text-muted);
		background: rgba(0, 0, 0, 0.03);
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		margin-bottom: 1rem;
		min-height: 46px;
		line-height: 1.35;
	}

	:global([data-theme='dark']) .role-criteria-box,
	:global([data-theme='midnight']) .role-criteria-box {
		background: rgba(255, 255, 255, 0.03);
	}

	.role-perks {
		background: rgba(0, 0, 0, 0.03);
		border-radius: var(--radius-md);
		padding: 0.95rem;
		border: 1px solid var(--border-subtle);
		margin-top: auto;
	}

	:global([data-theme='dark']) .role-perks,
	:global([data-theme='midnight']) .role-perks {
		background: rgba(0, 0, 0, 0.25);
	}

	.perks-title {
		font-size: 0.74rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		font-weight: 800;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
	}

	.perks-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.perks-list li {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		font-size: 0.78rem;
		color: var(--text-primary);
		font-weight: 500;
		line-height: 1.35;
		min-height: 32px;
	}

	.perks-list li span.material-icons-round {
		flex: 0 0 15px;
		margin-top: 1px;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   PROCESS STEPS SECTION
	   ══════════════════════════════════════════════════════════════════════ */
	.process-section {
		padding: 2.5rem 2rem;
		border-radius: var(--radius-xl);
		margin-bottom: 3.5rem;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
	}

	.process-steps-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1.25rem;
	}

	.step-card {
		padding: 1.6rem 1.3rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		position: relative;
		transition: transform 0.25s var(--ease-spring);
	}

	.step-card:hover {
		transform: translateY(-4px);
		border-color: var(--aero-blue);
	}

	.step-number {
		font-size: 1.8rem;
		font-weight: 900;
		font-family: var(--font-display);
		color: var(--step-color, var(--aero-blue));
		opacity: 0.9;
		margin-bottom: 0.6rem;
		line-height: 1;
	}

	.step-title {
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--text-primary);
		margin-bottom: 0.45rem;
	}

	.step-desc {
		font-size: 0.82rem;
		color: var(--text-secondary);
		line-height: 1.45;
		margin: 0;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   COMPARISON SECTION
	   ══════════════════════════════════════════════════════════════════════ */
	.comparison-section {
		padding: 2.5rem 2rem;
		border-radius: var(--radius-xl);
		margin-bottom: 3.5rem;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
	}

	.comparison-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-top: 0.8rem;
	}

	@media (max-width: 768px) {
		.comparison-grid {
			grid-template-columns: 1fr;
		}
	}

	.comparison-column {
		padding: 1.8rem 1.6rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
	}

	.vsocial-col {
		border-color: rgba(27, 133, 243, 0.4);
		box-shadow: 0 8px 24px rgba(27, 133, 243, 0.08);
	}

	.column-header {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		margin-bottom: 1.2rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.column-header .header-icon {
		font-size: 32px;
		margin-bottom: 0.4rem;
	}

	.column-header h3 {
		font-size: 1.25rem;
		font-weight: 900;
		color: var(--text-primary);
		margin: 0 0 0.25rem;
	}

	.col-tag {
		font-size: 0.74rem;
		font-weight: 700;
		padding: 0.2rem 0.65rem;
		border-radius: var(--radius-full);
	}

	.col-tag.pro {
		background: rgba(0, 212, 170, 0.12);
		color: var(--aero-mint);
		border: 1px solid rgba(0, 212, 170, 0.3);
	}

	.col-tag.con {
		background: rgba(244, 114, 182, 0.12);
		color: var(--aero-rose);
		border: 1px solid rgba(244, 114, 182, 0.3);
	}

	.comparison-features {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.comparison-features li {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		font-size: 0.86rem;
		color: var(--text-primary);
		line-height: 1.4;
	}

	.icon-check {
		color: var(--aero-mint);
		font-size: 18px;
		flex: 0 0 18px;
	}

	.icon-cross {
		color: var(--aero-rose);
		font-size: 18px;
		flex: 0 0 18px;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   FAQ SECTION WITH ACCORDIONS
	   ══════════════════════════════════════════════════════════════════════ */
	.faq-section {
		margin-bottom: 3.5rem;
	}

	.faq-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.faq-item {
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-subtle);
		overflow: hidden;
		transition:
			border-color 0.25s ease,
			box-shadow 0.25s ease;
		background: var(--bg-surface);
	}

	.faq-item.active {
		border-color: var(--aero-blue);
		box-shadow: 0 8px 25px rgba(27, 133, 243, 0.12);
	}

	.faq-question-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem 1.6rem;
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
		color: var(--text-primary);
		transition: color 0.2s ease;
	}

	.faq-question-btn:hover {
		color: var(--aero-blue);
	}

	.faq-q-text {
		font-size: 1.02rem;
		font-weight: 800;
		line-height: 1.4;
		margin: 0;
	}

	.faq-chevron {
		color: var(--aero-blue);
		font-size: 24px;
		flex: 0 0 24px;
		transition: transform 0.25s var(--ease-spring);
	}

	.faq-item.active .faq-chevron {
		transform: rotate(180deg);
	}

	.faq-answer-container {
		overflow: hidden;
	}

	.faq-answer {
		padding: 1.2rem 1.6rem 1.5rem;
		color: var(--text-secondary);
		font-size: 0.92rem;
		line-height: 1.65;
		border-top: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.02);
	}

	:global([data-theme='dark']) .faq-answer,
	:global([data-theme='midnight']) .faq-answer {
		background: rgba(0, 0, 0, 0.18);
	}

	.faq-answer p {
		margin: 0;
		line-height: 1.65;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   APPLY CALL-TO-ACTION SECTION
	   ══════════════════════════════════════════════════════════════════════ */
	.apply-section {
		padding: 3.5rem 2rem;
		text-align: center;
		border-radius: var(--radius-xl);
		background: linear-gradient(
			135deg,
			rgba(27, 133, 243, 0.08) 0%,
			rgba(0, 212, 170, 0.05) 50%,
			var(--bg-surface) 100%
		);
		border: 1.5px solid rgba(27, 133, 243, 0.35);
		box-shadow:
			0 20px 50px rgba(0, 0, 0, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.6),
			0 0 35px rgba(27, 133, 243, 0.12);
		position: relative;
		overflow: hidden;
	}

	:global([data-theme='dark']) .apply-section,
	:global([data-theme='midnight']) .apply-section {
		background: linear-gradient(
			135deg,
			rgba(27, 133, 243, 0.12) 0%,
			rgba(0, 212, 170, 0.06) 50%,
			rgba(10, 18, 30, 0.85) 100%
		);
		box-shadow:
			0 20px 50px rgba(0, 0, 0, 0.6),
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			0 0 35px rgba(27, 133, 243, 0.1);
	}

	.apply-icon-bubble {
		width: 68px;
		height: 68px;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, var(--aero-blue) 0%, var(--aero-sky) 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1.2rem;
		box-shadow:
			0 10px 24px rgba(27, 133, 243, 0.4),
			inset 0 2px 2px rgba(255, 255, 255, 0.5);
	}

	.apply-icon-bubble span {
		font-size: 38px;
	}

	.apply-title {
		font-size: clamp(1.6rem, 3.2vw, 2.2rem);
		font-weight: 900;
		font-family: var(--font-display);
		margin-bottom: 0.8rem;
		color: var(--text-primary);
		letter-spacing: -0.02em;
	}

	.apply-desc {
		font-size: 1.05rem;
		color: var(--text-secondary);
		max-width: 580px;
		margin: 0 auto 2rem;
		line-height: 1.55;
	}

	.apply-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.85rem;
	}

	.apply-cta-btn {
		font-size: 0.95rem;
		font-weight: 800;
		padding: 0.8rem 1.8rem;
		border-radius: var(--radius-md);
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: linear-gradient(135deg, var(--accent-blue-base) 0%, var(--accent-blue-light) 100%);
		box-shadow:
			0 6px 20px rgba(27, 133, 243, 0.4),
			inset 0 1px 2px rgba(255, 255, 255, 0.4);
		transition: all 0.25s var(--ease-spring);
	}

	.apply-cta-btn:hover {
		transform: translateY(-2px) scale(1.02);
		box-shadow:
			0 10px 28px rgba(27, 133, 243, 0.55),
			inset 0 1px 2px rgba(255, 255, 255, 0.6);
	}

	.learn-more-btn {
		font-size: 0.95rem;
		font-weight: 700;
		padding: 0.8rem 1.6rem;
		border-radius: var(--radius-md);
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		text-decoration: none;
	}

	/* ══════════════════════════════════════════════════════════════════════
	   APPLICATION MODAL & WIZARD
	   ══════════════════════════════════════════════════════════════════════ */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(12px);
		z-index: var(--z-modal-backdrop, 500);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.2rem;
	}

	.apply-modal {
		width: 100%;
		max-width: 620px;
		background: var(--bg-surface-solid);
		padding: 2.2rem;
		border-radius: var(--radius-xl);
		position: relative;
		border: 1.5px solid var(--border-subtle);
		box-shadow:
			0 25px 60px rgba(0, 0, 0, 0.45),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		max-height: 90vh;
		overflow-y: auto;
		transition:
			border-color 0.3s ease,
			box-shadow 0.3s ease;
	}

	:global([data-theme='light']) .apply-modal {
		background: rgba(255, 255, 255, 0.97);
	}

	:global([data-theme='dark']) .apply-modal {
		background: rgba(15, 23, 42, 0.97);
	}

	:global([data-theme='midnight']) .apply-modal {
		background: rgba(8, 14, 24, 0.98);
	}

	/* Special Institutional / Government Theme */
	.apply-modal.is-gov {
		border-color: var(--badge-gov);
		box-shadow:
			0 25px 60px rgba(0, 0, 0, 0.55),
			0 0 30px rgba(148, 163, 184, 0.18),
			inset 0 1px 0 rgba(255, 255, 255, 0.25);
	}

	.close-modal-btn {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid var(--border-subtle);
		width: 32px;
		height: 32px;
		border-radius: var(--radius-full);
		color: var(--text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.close-modal-btn:hover {
		color: var(--aero-rose);
		border-color: var(--aero-rose);
		transform: scale(1.1);
	}

	.modal-header {
		text-align: center;
		margin-bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.modal-header.gov-header {
		margin-bottom: 1.3rem;
	}

	.modal-badge-icon {
		width: 54px;
		height: 54px;
		border-radius: var(--radius-md);
		background: rgba(27, 133, 243, 0.15);
		border: 1px solid var(--aero-blue);
		color: var(--aero-blue);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.8rem;
		box-shadow: 0 6px 18px rgba(27, 133, 243, 0.25);
	}

	.gov-badge-seal {
		width: 58px;
		height: 58px;
		border-radius: var(--radius-md);
		background: rgba(148, 163, 184, 0.15);
		border: 1.5px solid var(--badge-gov);
		color: var(--badge-gov);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.8rem;
		box-shadow:
			0 6px 20px rgba(148, 163, 184, 0.25),
			inset 0 1px 2px rgba(255, 255, 255, 0.3);
	}

	.modal-title {
		font-size: 1.35rem;
		font-weight: 900;
		font-family: var(--font-display);
		color: var(--text-primary);
		margin-bottom: 0.3rem;
	}

	.modal-title.gov-title {
		letter-spacing: -0.01em;
	}

	.modal-subtitle {
		font-size: 0.86rem;
		color: var(--text-secondary);
		line-height: 1.4;
		margin: 0;
	}

	.gov-sovereign-alert {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border-radius: var(--radius-md);
		background: rgba(148, 163, 184, 0.09);
		border: 1px solid rgba(148, 163, 184, 0.28);
		margin-top: 1rem;
		text-align: left;
		font-size: 0.82rem;
		color: var(--text-secondary);
		line-height: 1.45;
	}

	.gov-sovereign-alert span {
		color: var(--badge-gov);
		flex: 0 0 20px;
		margin-top: 2px;
	}

	.gov-sovereign-alert strong {
		color: var(--text-primary);
		display: block;
		margin-bottom: 2px;
	}

	.gov-sovereign-alert p {
		margin: 0;
	}

	.category-grid {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		margin-bottom: 1.5rem;
	}

	.category-card {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		border: 1.5px solid var(--border-subtle);
		text-align: left;
		cursor: pointer;
		transition: all 0.2s var(--ease-spring);
		color: var(--text-primary);
	}

	.category-card:hover {
		border-color: var(--cat-color, var(--aero-blue));
		transform: translateX(3px);
	}

	.category-card.active {
		border-color: var(--cat-color, var(--aero-blue));
		background: color-mix(in srgb, var(--cat-color, var(--aero-blue)) 12%, transparent);
		box-shadow: 0 4px 14px color-mix(in srgb, var(--cat-color, var(--aero-blue)) 18%, transparent);
	}

	.category-card.gov-card-option {
		border-color: rgba(148, 163, 184, 0.35);
	}

	.cat-icon-wrapper {
		width: 38px;
		height: 38px;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.05);
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 38px;
		border: 1px solid var(--border-subtle);
	}

	.cat-icon {
		font-size: 22px;
	}

	.cat-info {
		flex: 1;
		min-width: 0;
	}

	.cat-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.2rem;
	}

	.cat-info strong {
		font-size: 0.9rem;
	}

	.cat-tag-pill {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 2px 7px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid var(--border-subtle);
		color: var(--text-muted);
	}

	.cat-info p {
		font-size: 0.76rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.modal-form {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.form-row-2col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.85rem;
	}

	@media (max-width: 540px) {
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
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.modal-input {
		width: 100%;
		padding: 0.65rem 0.9rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--bg-input);
		color: var(--text-primary);
		font-size: 0.85rem;
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
		left: 0.85rem;
		color: var(--text-muted);
		font-weight: 700;
		font-size: 0.9rem;
		pointer-events: none;
	}

	.input-with-prefix .modal-input {
		padding-left: 2rem;
	}

	.field-hint {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.74rem;
		margin-top: 0.25rem;
		color: var(--text-muted);
		line-height: 1.35;
	}

	.field-hint.error {
		color: var(--aero-coral);
	}

	.field-hint.valid {
		color: var(--aero-mint);
	}

	.input-error {
		border-color: var(--aero-coral) !important;
	}

	.checkbox-control {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		font-size: 0.78rem;
		color: var(--text-secondary);
		line-height: 1.45;
		cursor: pointer;
		margin-top: 0.2rem;
	}

	.checkbox-control input[type='checkbox'] {
		margin-top: 2px;
		accent-color: var(--aero-blue);
		cursor: pointer;
		flex: 0 0 15px;
		width: 15px;
		height: 15px;
	}

	.gov-checkbox input[type='checkbox'] {
		accent-color: var(--badge-gov);
	}

	.requisitos-checklist {
		padding: 0.85rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
	}

	.checklist-items {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.78rem;
		color: var(--text-secondary);
	}

	.checklist-items li {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.modal-footer {
		margin-top: 0.8rem;
	}

	.modal-footer-dual {
		display: flex;
		gap: 0.85rem;
		justify-content: flex-end;
		margin-top: 0.4rem;
	}

	.modal-footer-dual button {
		padding: 0.65rem 1.3rem;
		border-radius: var(--radius-sm);
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.btn-gov-submit {
		background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%) !important;
		box-shadow: 0 6px 20px rgba(100, 116, 139, 0.4) !important;
	}

	.modal-success {
		text-align: center;
		padding: 0.8rem 0;
	}

	.success-icon-box {
		width: 64px;
		height: 64px;
		border-radius: var(--radius-full);
		background: rgba(0, 212, 170, 0.15);
		border: 2px solid var(--aero-mint);
		color: var(--aero-mint);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1rem;
		box-shadow: 0 6px 20px rgba(0, 212, 170, 0.25);
	}

	.gov-success-icon {
		background: rgba(148, 163, 184, 0.15) !important;
		border-color: var(--badge-gov) !important;
		color: var(--badge-gov) !important;
		box-shadow: 0 6px 20px rgba(148, 163, 184, 0.25) !important;
	}

	.folio-box {
		margin: 1.1rem 0;
		padding: 1rem 1.25rem;
		border-radius: var(--radius-md);
		border: 1.5px dashed var(--aero-blue);
		background: rgba(27, 133, 243, 0.06);
		text-align: center;
	}

	.folio-label {
		display: block;
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin-bottom: 0.45rem;
	}

	.folio-code-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.folio-code {
		font-family: 'JetBrains Mono', monospace, monospace;
		font-size: 1rem;
		font-weight: 800;
		color: var(--aero-blue);
		letter-spacing: 0.04em;
		background: rgba(0, 0, 0, 0.2);
		padding: 4px 10px;
		border-radius: var(--radius-xs);
	}

	.btn-copy-folio {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-primary);
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-copy-folio:hover {
		border-color: var(--aero-blue);
		color: var(--aero-blue);
		transform: scale(1.04);
	}

	.audit-sla-card {
		padding: 0.9rem 1.1rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		text-align: left;
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin-bottom: 1rem;
	}

	.sla-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.sla-row strong {
		color: var(--text-primary);
	}

	/* ══════════════════════════════════════════════════════════════════════
	   RESPONSIVE BREAKPOINTS
	   ══════════════════════════════════════════════════════════════════════ */
	@media (max-width: 640px) {
		.verified-container {
			padding: 1rem 0.85rem 4rem;
		}

		.sim-controls {
			padding: 1.2rem 1rem;
		}

		.role-card {
			width: 290px;
			padding: 1.5rem 1.2rem;
		}

		.apply-section {
			padding: 2.5rem 1.2rem;
		}

		.apply-modal {
			padding: 1.5rem 1.2rem;
		}
	}
</style>
