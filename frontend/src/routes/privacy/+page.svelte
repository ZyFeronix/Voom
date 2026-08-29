<script>
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Política de Privacidad - Voom!</title>
</svelte:head>

<div class="legal-container" in:fade={{ duration: 300 }}>
	<header class="legal-header glass-panel">
		<a href="/" class="legal-brand-link">
			<span class="legal-brand-badge">VS</span>
			<span class="legal-brand-text font-display">Voom!</span>
		</a>
		<nav class="legal-nav-tabs">
			<a href="/terms" class="legal-tab-btn" class:active={page.url.pathname === '/terms'}>
				<span class="material-icons-round text-sm">gavel</span>
				<span>Términos</span>
			</a>
			<a href="/privacy" class="legal-tab-btn" class:active={page.url.pathname === '/privacy'}>
				<span class="material-icons-round text-sm">security</span>
				<span>Privacidad</span>
			</a>
			<a href="/cookies" class="legal-tab-btn" class:active={page.url.pathname === '/cookies'}>
				<span class="material-icons-round text-sm">cookie</span>
				<span>Cookies</span>
			</a>
		</nav>
	</header>

	<div class="glass-card aero-card legal-card">
		<h1 class="legal-title">Política de Privacidad</h1>
		<p class="legal-updated">Última actualización: 29 de agosto de 2026</p>

		<section>
			<h2>1. Responsable del tratamiento</h2>
			<p>
				El responsable del tratamiento de tus datos personales es Voom! (proyecto originalmente
				denominado V-SOCIAL, cuyo nombre original se conserva en ciertas variables del sistema por
				razones de compatibilidad técnica), una plataforma de red social autoalojada (self-hosted).
				Los datos se almacenan en una base de datos SQLite en el servidor donde se despliega la
				instancia. Para cualquier cuestión relacionada con la protección de datos, puedes contactar
				a través de los canales habilitados por el operador de la instancia.
			</p>
		</section>

		<section>
			<h2>2. Datos que recopilamos</h2>
			<ul>
				<li>
					<strong>Datos de cuenta:</strong> nombre de usuario, correo electrónico, contraseña (almacenada
					con hash bcrypt), nombre para mostrar, foto de perfil, portada y roles.
				</li>
				<li>
					<strong>Datos de perfil:</strong> biografía, ubicación, sitio web, formación, lugar de trabajo,
					teléfono, fecha de nacimiento, género y estado civil (opcionales).
				</li>
				<li>
					<strong>Contenido que publicas:</strong> publicaciones, comentarios, reacciones, stories, reels,
					listados del marketplace, gigs, fotos, vídeos y audios.
				</li>
				<li>
					<strong>Interacciones y Comunicaciones:</strong> contenido de los mensajes directos, metadatos
					de llamadas WebRTC y participación en comunidades/grupos.
				</li>
				<li>
					<strong>Gamificación:</strong> tu experiencia acumulada (XP), nivel, rachas diarias y reputación
					en la comunidad.
				</li>
				<li>
					<strong>Ubicación (opt-in):</strong> check-ins con coordenadas precisas si decides usar esa
					función.
				</li>
				<li>
					<strong>Actividad:</strong> registro de actividad (acciones como ver, dar like, comentar, crear
					o eliminar contenido) que se purga periódicamente tras 90 días.
				</li>
				<li>
					<strong>Datos de sesión y técnicos:</strong> direcciones IP, agente de usuario, tokens de sesión
					y estados de conexión (Socket.IO) para la autenticación y seguridad.
				</li>
				<li>
					<strong>Enlaces de pago y apoyo (P2P):</strong> URL de métodos de cobro externos si decides
					configurarlos voluntariamente en tu perfil.
				</li>
			</ul>
		</section>

		<section>
			<h2>3. Finalidad del tratamiento</h2>
			<p>
				Tratamos tus datos para permitir el funcionamiento de la red social: crear y gestionar tu
				cuenta, mostrar tu perfil y contenido según tu visibilidad preferida, facilitar la
				interacción social (seguidores, mensajería, llamadas de voz/video), operar el marketplace,
				mostrar tus enlaces de apoyo directo (P2P) y la gamificación, enviar notificaciones,
				prevenir abusos y mantener la seguridad de la plataforma.
			</p>
		</section>

		<section>
			<h2>4. Base jurídica</h2>
			<p>
				Conforme al artículo 6 del RGPD, la base jurídica principal es la <strong
					>ejecución de un contrato</strong
				>
				(el alta y uso de la cuenta, y la aceptación de los Términos de Servicio) y el
				<strong>interés legítimo</strong> en el funcionamiento y la seguridad de la plataforma. El consentimiento
				expreso (solicitado al registrarte) aplica para ciertos tratamientos, y puede ser revocado en
				cualquier momento.
			</p>
		</section>

		<section>
			<h2>5. Destinatarios</h2>
			<p>
				Tus datos no se venden ni se comparten con terceros con fines comerciales. Pueden ser
				accesibles para los administradores y moderadores de la instancia en el ejercicio de sus
				funciones de revisión y soporte. No empleamos servicios de analítica ni publicidad de
				terceros. Si te autentificas con Google o Apple, los datos de ese proveedor se tratan
				conforme a su propia política de privacidad.
			</p>
		</section>

		<section>
			<h2>6. Conservación de los datos</h2>
			<p>
				Tus datos se conservan mientras tu cuenta esté activa. Si solicitas la supresión de tu
				cuenta, esta se desactiva de inmediato y se elimina permanentemente en cascada (junto con
				todo su contenido asociado y archivos huérfanos), transcurridos <strong>30 días</strong>.
				Los registros de actividad se purgan automáticamente tras 90 días. Ciertos registros de
				seguridad pueden conservarse durante el tiempo estrictamente necesario.
			</p>
		</section>

		<section>
			<h2>7. Tus derechos (RGPD) y Gestión de Datos</h2>
			<p>
				Como interesado, Voom! te proporciona herramientas de autoservicio para ejercer tus
				derechos:
			</p>
			<ul>
				<li><strong>Acceso:</strong> conocer qué datos tratamos.</li>
				<li>
					<strong>Rectificación:</strong> corregir datos inexactos o incompletos desde tu perfil.
				</li>
				<li>
					<strong>Supresión / Derecho al olvido:</strong> solicitar el borrado de tu cuenta y sus datos
					de forma automatizada.
				</li>
				<li>
					<strong>Portabilidad:</strong> descargar una copia completa de tus datos en formato JSON estructurado
					desde Ajustes → Mis Datos.
				</li>
				<li>
					<strong>Seguridad:</strong> revisar y revocar sesiones activas desde Ajustes → Seguridad.
				</li>
			</ul>
			<p>
				Para el resto de derechos (limitación, oposición), contacta con el operador de la instancia.
				También tienes derecho a reclamar ante la autoridad de control competente.
			</p>
		</section>

		<section>
			<h2>8. Transferencias internacionales</h2>
			<p>
				Al tratarse de una plataforma self-hosted con base de datos local, no se realizan
				transferencias internacionales de tus datos, salvo que el operador de la instancia la aloje
				en un servidor fuera de tu jurisdicción o utilices la autenticación OAuth (sujeta a las
				políticas de Google/Apple).
			</p>
		</section>

		<section>
			<h2>9. Menores</h2>
			<p>
				La plataforma no está dirigida a menores de 13 años. Al registrarte confirmas que tienes al
				menos 13 años; la verificación de la fecha de nacimiento se realiza en el momento del alta
				en el servidor. No se permite el registro de usuarios menores de 13 años.
			</p>
		</section>

		<section>
			<h2>10. Cambios en esta política</h2>
			<p>
				El operador de la instancia podrá actualizar esta política. La fecha de la última revisión
				figura en la parte superior. Se recomienda revisarla periódicamente.
			</p>
		</section>
	</div>
</div>

<style>
	.legal-container {
		padding: 2rem 1rem;
		max-width: 820px;
		margin: 0 auto;
		position: relative;
		z-index: 1;
		min-height: 100vh;
	}
	.legal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		margin-bottom: 1.5rem;
		border-radius: var(--radius-lg);
		background: var(--bg-surface);
		border: 1px solid var(--border-glass, var(--border-subtle));
		box-shadow: var(--shadow-sm);
		gap: 1rem;
		flex-wrap: wrap;
	}
	.legal-brand-link {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		text-decoration: none;
		color: var(--text-primary);
		transition: transform var(--t-fast);
	}
	.legal-brand-link:hover {
		transform: scale(1.03);
	}
	.legal-brand-badge {
		background: var(--accent-gradient, linear-gradient(90deg, #0ea5e9 0%, #10b981 100%));
		color: #fff;
		font-weight: 900;
		font-size: 0.8rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-xs);
		letter-spacing: 0.05em;
	}
	.legal-brand-text {
		font-weight: 800;
		font-size: 1.15rem;
		letter-spacing: -0.02em;
	}
	.legal-nav-tabs {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.legal-tab-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.85rem;
		border-radius: var(--radius-full);
		font-size: 0.85rem;
		font-weight: 600;
		text-decoration: none;
		color: var(--text-secondary);
		transition: all var(--t-fast);
		border: 1px solid transparent;
	}
	.legal-tab-btn:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
	}
	.legal-tab-btn.active {
		color: #fff;
		background: var(--accent-blue-base, #1b85f3);
		box-shadow: 0 4px 12px rgba(27, 133, 243, 0.35);
	}
	.legal-card {
		padding: 3rem;
		border-radius: var(--radius-lg);
	}
	:global([data-theme='dark']) .legal-card {
		background: rgba(15, 20, 25, 0.5);
	}
	.legal-title {
		font-size: clamp(2rem, 4vw, 2.75rem);
		font-weight: 900;
		font-family: var(--font-display);
		color: var(--text-primary);
		margin-bottom: 0.5rem;
		letter-spacing: -0.02em;
	}
	.legal-updated {
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin-bottom: 2.5rem;
		opacity: 0.7;
	}
	.legal-card section {
		margin-bottom: 2rem;
	}
	.legal-card h2 {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.75rem;
	}
	.legal-card p,
	.legal-card li {
		color: var(--text-secondary);
		line-height: 1.7;
		font-size: 0.97rem;
	}
	.legal-card ul {
		padding-left: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.legal-card strong {
		color: var(--text-primary);
		font-weight: 700;
	}
	@media (max-width: 640px) {
		.legal-card {
			padding: 1.75rem 1.25rem;
		}
	}
</style>
