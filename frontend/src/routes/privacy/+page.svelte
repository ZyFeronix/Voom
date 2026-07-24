<script>
	import { fade } from 'svelte/transition';
</script>

<svelte:head>
	<title>Política de Privacidad - V-SOCIAL</title>
</svelte:head>

<div class="legal-container" in:fade={{ duration: 500 }}>
	<div class="glass-card aero-card legal-card">
		<h1 class="legal-title">Política de Privacidad</h1>
		<p class="legal-updated">Última actualización: 22 de julio de 2026</p>

		<section>
			<h2>1. Responsable del tratamiento</h2>
			<p>
				El responsable del tratamiento de tus datos personales es V-SOCIAL, una plataforma de red
				social autoalojada (self-hosted). Los datos se almacenan en una base de datos SQLite en el
				servidor donde se despliega la instancia. Para cualquier cuestión relacionada con la
				protección de datos, puedes contactar a través de los canales habilitados por el operador de
				la instancia.
			</p>
		</section>

		<section>
			<h2>2. Datos que recopilamos</h2>
			<ul>
				<li>
					<strong>Datos de cuenta:</strong> nombre de usuario, correo electrónico, contraseña (almacenada
					con hash bcrypt), nombre para mostrar, foto de perfil y portada.
				</li>
				<li>
					<strong>Datos de perfil:</strong> biografía, ubicación, sitio web, formación, lugar de trabajo,
					teléfono, fecha de nacimiento, género y estado civil (opcionales).
				</li>
				<li>
					<strong>Contenido que publicas:</strong> publicaciones, comentarios, reacciones, stories, reels,
					fotos, vídeos y audios.
				</li>
				<li>
					<strong>Mensajes:</strong> contenido de los mensajes directos, archivos adjuntos y notas de
					voz.
				</li>
				<li>
					<strong>Ubicación (opt-in):</strong> check-ins con coordenadas precisas si decides usar esa
					función.
				</li>
				<li>
					<strong>Actividad:</strong> registro de actividad (acciones como ver, dar like, comentar, crear
					o eliminar contenido).
				</li>
				<li>
					<strong>Datos de sesión y técnicos:</strong> direcciones IP, agente de usuario y tokens de sesión
					para la autenticación.
				</li>
				<li>
					<strong>Transacciones:</strong> movimientos de la cartera virtual (créditos y saldo).
				</li>
			</ul>
		</section>

		<section>
			<h2>3. Finalidad del tratamiento</h2>
			<p>
				Tratamos tus datos para permitir el funcionamiento de la red social: crear y gestionar tu
				cuenta, mostrar tu perfil y contenido, facilitar la interacción social (seguir, comentar,
				mensajería), gestionar la cartera y la gamificación, enviar notificaciones, prevenir abusos
				y mantener la seguridad de la plataforma.
			</p>
		</section>

		<section>
			<h2>4. Base jurídica</h2>
			<p>
				Conforme al artículo 6 del RGPD, la base jurídica principal es la <strong
					>ejecución de un contrato</strong
				>
				(el alta y uso de la cuenta) y el <strong>interés legítimo</strong> en el funcionamiento y la
				seguridad de la plataforma. El consentimiento (términos y privacidad aceptados al registrarte)
				aplica para ciertos tratamientos opcionales, como los check-ins de ubicación. Puedes retirar el
				consentimiento en cualquier momento sin que ello afecte a la licitud del tratamiento anterior.
			</p>
		</section>

		<section>
			<h2>5. Destinatarios</h2>
			<p>
				Tus datos no se venden ni se comparten con terceros con fines comerciales. Pueden ser
				accesibles para los administradores y moderadores de la instancia en el ejercicio de sus
				funciones. No empleamos servicios de analítica ni publicidad de terceros. Si te autentificas
				con Google o Apple, los datos de ese proveedor se tratan conforme a su propia política.
			</p>
		</section>

		<section>
			<h2>6. Conservación de los datos</h2>
			<p>
				Tus datos se conservan mientras tu cuenta esté activa. Si solicitas la supresión de tu
				cuenta, esta se desactiva de inmediato y se elimina permanentemente, junto con todo su
				contenido asociado, transcurridos <strong>30 días</strong> (período durante el cual puedes reactivarla
				iniciando sesión). Ciertos registros necesarios para el cumplimiento de obligaciones legales o
				la seguridad de la platforma podrán conservarse durante el tiempo necesario para dichos fines.
			</p>
		</section>

		<section>
			<h2>7. Tus derechos (RGPD arts. 15-21)</h2>
			<p>Como interesado, tienes derecho a:</p>
			<ul>
				<li><strong>Acceso (art. 15):</strong> saber qué datos tuyos tratamos.</li>
				<li>
					<strong>Rectificación (art. 16):</strong> corregir datos inexactos o incompletos desde tu perfil.
				</li>
				<li>
					<strong>Supresión / derecho al olvido (art. 17):</strong> solicitar el borrado de tu cuenta
					y sus datos.
				</li>
				<li>
					<strong>Limitación del tratamiento (art. 18):</strong> restringir ciertos tratamientos.
				</li>
				<li>
					<strong>Portabilidad (art. 20):</strong> descargar una copia de tus datos en formato JSON estructurado
					desde Ajustes → Mis Datos.
				</li>
				<li>
					<strong>Oposición (art. 21):</strong> oponerte a tratamientos basados en interés legítimo.
				</li>
				<li>
					<strong>Retirada del consentimiento:</strong> cuando el tratamiento se base en consentimiento,
					sin que afecte a la licitud del previo.
				</li>
			</ul>
			<p>
				Puedes ejercer el borrado de cuenta y la exportación de datos directamente desde la
				aplicación (Ajustes → Mis Datos). Para el resto de derechos, contacta con el operador de la
				instancia. También tienes derecho a reclamar ante la autoridad de control competente (en
				España, la AEPD).
			</p>
		</section>

		<section>
			<h2>8. Transferencias internacionales</h2>
			<p>
				Al tratarse de una plataforma self-hosted con base de datos local, no se realizan
				transferencias internacionales de tus datos, salvo que el operador de la instancia la aloje
				en un servidor fuera de tu jurisdicción o utilices la autenticación de Google/Apple (sujeta
				a las políticas de dichos proveedores).
			</p>
		</section>

		<section>
			<h2>9. Menores</h2>
			<p>
				La plataforma no está dirigida a menores de 13 años. Al registrarte confirmas que tienes al
				menos 13 años; la verificación de la fecha de nacimiento se realiza en el momento del alta.
				No se permite el registro de usuarios menores de 13 años.
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
	.legal-card {
		padding: 3rem;
		border-radius: 24px;
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
