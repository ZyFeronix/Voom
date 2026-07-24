<script>
	import { fade } from 'svelte/transition';
</script>

<svelte:head>
	<title>Política de Cookies - V-SOCIAL</title>
</svelte:head>

<div class="legal-container" in:fade={{ duration: 500 }}>
	<div class="glass-card aero-card legal-card">
		<h1 class="legal-title">Política de Cookies</h1>
		<p class="legal-updated">Última actualización: 22 de julio de 2026</p>

		<section>
			<h2>1. Qué son las cookies</h2>
			<p>
				Las cookies y los mecanismos de almacenamiento del navegador (como localStorage) son
				pequeños ficheros o datos que el sitio guarda en tu dispositivo para mantener tu sesión,
				recordar preferencias o mejorar tu experiencia. Esta política explica cuáles utiliza
				V-SOCIAL.
			</p>
		</section>

		<section>
			<h2>2. Cookies que utilizamos</h2>
			<table class="cookie-table">
				<thead>
					<tr>
						<th>Nombre</th>
						<th>Tipo</th>
						<th>Finalidad</th>
						<th>Duración</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>vsocial_token</code></td>
						<td>Técnica / esencial</td>
						<td>Mantiene tu sesión de autenticación. Se usa junto con el almacenamiento local.</td>
						<td>365 días · SameSite=Strict · Secure</td>
					</tr>
					<tr>
						<td><code>vsocial_cookie_consent</code></td>
						<td>Consentimiento</td>
						<td>Recuerda tu elección respecto a esta política de cookies.</td>
						<td>365 días · SameSite=Strict · Secure</td>
					</tr>
				</tbody>
			</table>
			<p>
				No utilizamos cookies de analítica, publicidad ni seguimiento de terceros. Las cookies
				presentes son estrictamente necesarias para el funcionamiento de la autenticación.
			</p>
		</section>

		<section>
			<h2>3. Almacenamiento local (localStorage)</h2>
			<p>
				El sitio también guarda las siguientes preferencias en el almacenamiento local del
				navegador:
			</p>
			<ul>
				<li><code>vsocial_token</code> — token de autenticación.</li>
				<li><code>vsocial_theme</code> — tema visual (claro/oscuro/auto).</li>
				<li><code>vsocial_mic_id</code> — micrófono preferido para grabaciones.</li>
				<li><code>vsocial_pwa_dismissed</code> — recordatorio de instalación de la app.</li>
				<li><code>vs_recent_searches</code> — búsquedas recientes.</li>
				<li><code>vs_sidebar_expanded</code> — estado del menú lateral.</li>
				<li><code>vsocial_cookie_consent</code> — tu elección de consentimiento de cookies.</li>
			</ul>
			<p>Puedes vaciar estos datos en cualquier momento desde las preferencias de tu navegador.</p>
		</section>

		<section>
			<h2>4. Gestión y revocación del consentimiento</h2>
			<p>
				Puedes aceptar o rechazar las cookies no esenciales desde el banner que se muestra en tu
				primera visita. Como V-SOCIAL solo emplea cookies esenciales para la autenticación, la
				plataforma sigue funcionando incluso si rechazas el consentimiento, aunque no se guardará tu
				preferencia. Para revocar o modificar tu elección puedes borrar la cookie <code
					>vsocial_cookie_consent</code
				> y la entrada correspondiente en el almacenamiento local; el banner volverá a mostrarse.
			</p>
		</section>

		<section>
			<h2>5. Cómo eliminar las cookies</h2>
			<p>
				Los navegadores ofrecen opciones para bloquear o eliminar cookies y datos de sitios.
				Consulta la ayuda de tu navegador para gestionar las preferencias de privacidad. Ten en
				cuenta que eliminar la cookie de sesión (<code>vsocial_token</code>) cerrará tu sesión y
				tendrás que volver a autenticarte.
			</p>
		</section>

		<section>
			<h2>6. Cambios en esta política</h2>
			<p>
				Si la plataforma incorpora nuevas cookies o mecanismos de almacenamiento, esta política se
				actualizará y la fecha de revisión se indicará en la parte superior.
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
		margin-bottom: 1rem;
	}
	.legal-card code {
		font-family: 'Courier New', monospace;
		background: rgba(128, 128, 128, 0.15);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		font-size: 0.85rem;
		color: var(--text-primary);
	}
	.cookie-table {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}
	.cookie-table th,
	.cookie-table td {
		text-align: left;
		padding: 0.65rem 0.75rem;
		border-bottom: 1px solid rgba(128, 128, 128, 0.2);
		color: var(--text-secondary);
	}
	.cookie-table th {
		color: var(--text-primary);
		font-weight: 700;
	}
	@media (max-width: 640px) {
		.legal-card {
			padding: 1.75rem 1.25rem;
		}
		.cookie-table {
			font-size: 0.8rem;
		}
		.cookie-table th,
		.cookie-table td {
			padding: 0.5rem 0.4rem;
		}
	}
</style>
