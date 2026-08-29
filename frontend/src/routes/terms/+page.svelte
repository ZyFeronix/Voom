<script>
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Términos de Servicio - Voom!</title>
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
		<h1 class="legal-title">Términos de Servicio</h1>
		<p class="legal-updated">Última actualización: 29 de agosto de 2026</p>

		<section>
			<h2>1. Aceptación de los términos</h2>
			<p>
				Al registrarte y usar Voom! (anteriormente conocido como V-SOCIAL) aceptas los presentes
				Términos de Servicio y la Política de Privacidad. <em
					>Nota: El identificador "v-social" o "vsocial" aún se mantiene en referencias técnicas
					internas para garantizar la compatibilidad y no afectar el funcionamiento de la
					plataforma.</em
				> Si no estás de acuerdo, no debes crear una cuenta ni utilizar la plataforma. El consentimiento
				se recoge mediante la casilla de aceptación durante el registro y se registra con fecha y hora.
			</p>
		</section>

		<section>
			<h2>2. Edad mínima</h2>
			<p>
				Para crear una cuenta debes tener al menos <strong>13 años</strong>. Al registrarte aportas
				tu fecha de nacimiento, que se valida automáticamente en el servidor. No se permite el
				registro de menores de 13 años. Si eres menor de edad en tu jurisdicción, debes contar con
				la autorización de tus representantes legales.
			</p>
		</section>

		<section>
			<h2>3. Cuenta y responsabilidades</h2>
			<p>
				Eres responsable de mantener la confidencialidad de tu contraseña y de toda la actividad que
				ocurra en tu cuenta, incluyendo las sesiones activas que puedes gestionar en todo momento.
				Debes facilitar información veraz en el registro y mantenerla actualizada. No puedes crear
				cuentas en nombre de terceros sin su autorización ni suplantar la identidad de otra persona.
			</p>
		</section>

		<section>
			<h2>4. Contenido, licencia y herramientas</h2>
			<p>
				Mantienes la propiedad del contenido que publicas (Posts, Reels, Stories, y Mensajes). Al
				subirlo, concedes a Voom! una licencia no exclusiva para alojarlo, mostrarlo y distribuirlo
				dentro de la plataforma con la finalidad de prestar el servicio. Eres el único responsable
				del contenido de tus transmisiones y material multimedia subido. El código fuente de Voom!
				se distribuye bajo licencia AGPLv3.
			</p>
		</section>

		<section>
			<h2>5. Conducta y uso aceptable</h2>
			<p>
				Te comprometes a no usar la plataforma para publicar contenido ilegal, difamatorio, que
				infrinja derechos de terceros, que incite al odio o la violencia, o que vulnere la
				legislación aplicable. Está prohibido el uso de bots no autorizados, spam o la elusión de
				los sistemas de limitación de tasa (rate limiting). El operador y los moderadores de la
				instancia podrán retirar contenido y suspender cuentas que infrinjan estas normas.
			</p>
		</section>

		<section>
			<h2>6. Transacciones, Marketplace y Gigs (Economía P2P)</h2>
			<p>
				Voom! facilita herramientas para la publicación de artículos en el <strong
					>Marketplace</strong
				>
				y ofertas de trabajo (<strong>Gigs</strong>), así como enlaces a métodos de apoyo a
				creadores. Sin embargo, Voom! no actúa como pasarela de pago, procesador financiero,
				custodio ni intermediario mercantil. Cualquier transacción comercial, encargo artístico, o
				apoyo económico se realiza de forma directa y entre pares (P2P) a través de enlaces externos
				(como PayPal, Ko-fi o Patreon). Voom! <strong>no cobra comisiones</strong> por dichas
				transacciones,
				<strong>no retiene fondos</strong> ni asume responsabilidad respecto al cumplimiento, garantías
				o disputas comerciales entre usuarios.
			</p>
		</section>

		<section>
			<h2>7. Gamificación y Reputación</h2>
			<p>
				El sistema de gamificación de Voom! (incluyendo experiencia "XP", niveles, rachas diarias y
				reputación de autor) se proporciona como una función lúdica para fomentar la participación
				comunitaria. Estos puntos y niveles no tienen valor monetario, no son transferibles y Voom!
				se reserva el derecho de ajustar, reiniciar o eliminar mecánicas de gamificación en
				cualquier momento.
			</p>
		</section>

		<section>
			<h2>8. Suspensiones y moderación</h2>
			<p>
				El operador de la instancia puede suspender o dar de baja cuentas que infrinjan los
				presentes términos, mediante las herramientas de moderación y sistemas automatizados de
				detección de spam. Las suspensiones se comunican al intentarse iniciar sesión.
			</p>
		</section>

		<section>
			<h2>9. Supresión de la cuenta</h2>
			<p>
				Puedes solicitar la eliminación de tu cuenta desde Ajustes → Mis Datos en cualquier momento,
				previa confirmación de seguridad. Al hacerlo, la cuenta se desactiva de inmediato y se
				programa su eliminación permanente, junto con el contenido asociado, para dentro de <strong
					>30 días</strong
				>. Durante ese plazo puedes reactivarla iniciando sesión normalmente. Transcurrido el plazo,
				el borrado es irreversible y ejecutado automáticamente.
			</p>
		</section>

		<section>
			<h2>10. Limitación de responsabilidad</h2>
			<p>
				Voom! se ofrece «tal cual», sin garantías explícitas o implícitas. El operador de la
				instancia no se hace responsable de pérdidas de datos, interrupciones del servicio,
				disponibilidad de conexiones WebRTC (llamadas de audio/video) o daños derivados del uso de
				la plataforma, en la medida en que lo permita la legislación aplicable.
			</p>
		</section>

		<section>
			<h2>11. Ley aplicable</h2>
			<p>
				Estos términos se rigen por la legislación aplicable en la jurisdicción del operador de la
				instancia. Cualquier disputa se someterá a los tribunales competentes de dicha jurisdicción,
				sin perjuicio de los derechos que asistan al usuario como interesado en materia de
				protección de datos.
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
	.legal-card p {
		color: var(--text-secondary);
		line-height: 1.7;
		font-size: 0.97rem;
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
