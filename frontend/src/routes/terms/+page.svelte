<script>
	import { fade } from 'svelte/transition';
</script>

<svelte:head>
	<title>Términos de Servicio - V-SOCIAL</title>
</svelte:head>

<div class="legal-container" in:fade={{ duration: 500 }}>
	<div class="glass-card aero-card legal-card">
		<h1 class="legal-title">Términos de Servicio</h1>
		<p class="legal-updated">Última actualización: 22 de julio de 2026</p>

		<section>
			<h2>1. Aceptación de los términos</h2>
			<p>
				Al registrarte y usar V-SOCIAL aceptas los presentes Términos de Servicio y la Política de
				Privacidad. Si no estás de acuerdo, no debes crear una cuenta ni utilizar la plataforma. El
				consentimiento se recoge mediante la casilla de aceptación durante el registro y se registra
				con fecha y hora.
			</p>
		</section>

		<section>
			<h2>2. Edad mínima</h2>
			<p>
				Para crear una cuenta debes tener al menos <strong>13 años</strong>. Al registrarte aportas
				tu fecha de nacimiento, que se valida en el servidor. No se permite el registro de menores
				de 13 años. Si eres menor de edad en tu jurisdicción, debes contar con la autorización de
				tus representantes legales.
			</p>
		</section>

		<section>
			<h2>3. Cuenta y responsabilidades</h2>
			<p>
				Eres responsable de mantener la confidencialidad de tu contraseña y de toda la actividad que
				ocurra en tu cuenta. Debes facilitar información veraz en el registro y mantenerla
				actualizada. No puedes crear cuentas en nombre de terceros sin su autorización ni suplantar
				la identidad de otra persona.
			</p>
		</section>

		<section>
			<h2>4. Contenido y licencia</h2>
			<p>
				Mantienes la propiedad del contenido que publicas. Al subirlo, concedes a V-SOCIAL una
				licencia no exclusiva para alojarlo, mostrarlo y distribuirlo dentro de la plataforma con la
				finalidad de prestar el servicio. El código fuente de V-SOCIAL se distribuye bajo licencia
				AGPLv3.
			</p>
		</section>

		<section>
			<h2>5. Conducta</h2>
			<p>
				Te comprometes a no usar la plataforma para publicar contenido ilegal, difamatorio, que
				infrinja derechos de terceros, que incite al odio o la violencia, o que vulnere la
				legislación aplicable. El operador y los moderadores de la instancia podrán retirar
				contenido y suspender cuentas que infrinjan estas normas.
			</p>
		</section>

		<section>
			<h2>6. Suspensiones y moderación</h2>
			<p>
				El operador de la instancia puede suspender o dar de baja cuentas que infrinjan los
				presentes términos, mediante las herramientas de moderación disponibles. Las suspensiones se
				comunican al intentarse iniciar sesión.
			</p>
		</section>

		<section>
			<h2>7. Supresión de la cuenta</h2>
			<p>
				Puedes solicitar la eliminación de tu cuenta desde Ajustes → Mis Datos en cualquier momento.
				Al hacerlo, la cuenta se desactiva de inmediato y se programa su eliminación permanente,
				junto con el contenido asociado, para dentro de <strong>30 días</strong>. Durante ese plazo
				puedes reactivarla iniciando sesión normalmente. Transcurrido el plazo, el borrado es
				irreversible.
			</p>
		</section>

		<section>
			<h2>8. Limitación de responsabilidad</h2>
			<p>
				V-SOCIAL se ofrece «tal cual», sin garantías explícitas o implícitas. El operador de la
				instancia no se hace responsable de pérdidas de datos, interrupciones del servicio o daños
				derivados del uso de la plataforma, en la medida en que lo permita la legislación aplicable.
			</p>
		</section>

		<section>
			<h2>9. Ley aplicable</h2>
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
