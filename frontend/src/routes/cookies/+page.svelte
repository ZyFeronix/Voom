<script>
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Política de Cookies - Voom!</title>
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
		<h1 class="legal-title">Política de Cookies</h1>
		<p class="legal-updated">Última actualización: 29 de agosto de 2026</p>

		<section>
			<h2>1. Qué son las cookies</h2>
			<p>
				Las cookies y los mecanismos de almacenamiento del navegador (como localStorage) son
				pequeños ficheros o datos que el sitio guarda en tu dispositivo para mantener tu sesión,
				recordar preferencias, asegurar las conexiones en tiempo real o mejorar tu experiencia. Esta
				política explica cuáles utiliza Voom! <em
					>(Nota: dado que el proyecto se llamó originalmente V-SOCIAL, los nombres técnicos de las
					cookies y claves de almacenamiento conservan el prefijo <code>vsocial_</code> por motivos de
					retrocompatibilidad y estabilidad de la plataforma)</em
				>.
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
						<td
							>Mantiene tu sesión de autenticación. Es necesaria para el funcionamiento seguro de la
							plataforma y llamadas API.</td
						>
						<td>365 días · SameSite=Strict · Secure</td>
					</tr>
					<tr>
						<td><code>vsocial_cookie_consent</code></td>
						<td>Consentimiento</td>
						<td
							>Recuerda tu elección respecto al aviso de cookies para no mostrar el banner
							repetidamente.</td
						>
						<td>365 días · SameSite=Strict · Secure</td>
					</tr>
				</tbody>
			</table>
			<p>
				No utilizamos cookies de analítica, publicidad ni seguimiento de terceros. Las cookies
				presentes son estrictamente necesarias (técnicas) para el funcionamiento de la plataforma.
			</p>
		</section>

		<section>
			<h2>3. Almacenamiento local (localStorage)</h2>
			<p>
				El sitio también guarda preferencias funcionales y de estado en el almacenamiento local de
				tu navegador. Estos datos no se envían al servidor de forma automática con cada petición
				web, sino que se utilizan para el funcionamiento del cliente (Svelte):
			</p>
			<ul>
				<li><code>vsocial_token</code> — token JWT de autenticación primario.</li>
				<li><code>vsocial_theme</code> — preferencia de tema visual (light/dark/midnight).</li>
				<li>
					<code>vsocial_mic_id</code> / <code>vsocial_cam_id</code> — hardware preferido para grabaciones
					y llamadas WebRTC.
				</li>
				<li>
					<code>vsocial_pwa_dismissed</code> — registro para no mostrar el recordatorio de instalación
					PWA.
				</li>
				<li><code>vs_recent_searches</code> — historial local de búsquedas recientes.</li>
				<li><code>vs_sidebar_expanded</code> — estado visual del menú lateral.</li>
				<li>
					<code>vsocial_cookie_consent</code> — réplica local de tu elección de consentimiento de cookies.
				</li>
			</ul>
			<p>
				Puedes vaciar estos datos en cualquier momento desde las herramientas de desarrollador o
				preferencias de tu navegador.
			</p>
		</section>

		<section>
			<h2>4. Gestión y revocación del consentimiento</h2>
			<p>
				Puedes aceptar o configurar tus preferencias desde el banner de cookies que se muestra en tu
				primera visita. Como Voom! solo emplea cookies técnicas esenciales para la autenticación y
				seguridad, la plataforma requiere ciertas cookies para operar si inicias sesión. Para
				revocar tu elección y volver a ver el banner, puedes borrar la cookie <code
					>vsocial_cookie_consent</code
				> y su equivalente en el almacenamiento local.
			</p>
		</section>

		<section>
			<h2>5. Cómo eliminar las cookies</h2>
			<p>
				Los navegadores ofrecen opciones nativas para bloquear, limpiar o eliminar cookies y datos
				de sitios web. Consulta la ayuda de tu navegador para gestionar estas preferencias de
				privacidad de manera global. Ten en cuenta que eliminar la cookie y el valor local de sesión
				(<code>vsocial_token</code>) cerrará inmediatamente tu sesión activa en Voom!.
			</p>
		</section>

		<section>
			<h2>6. Cambios en esta política</h2>
			<p>
				Si la plataforma incorpora nuevas funciones que requieran almacenamiento en el cliente (ej.
				nuevas preferencias de usuario), esta política se actualizará y la fecha de revisión se
				reflejará en la parte superior.
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
		margin-bottom: 1rem;
	}
	.legal-card code {
		font-family: 'Courier New', monospace;
		background: rgba(128, 128, 128, 0.15);
		padding: 0.1rem 0.35rem;
		border-radius: var(--radius-xs);
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
