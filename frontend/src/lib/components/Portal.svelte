<script>
	/**
	 * Portal.svelte — monta su contenido en el ROOT de la app Svelte (hijo directo
	 * de <body>), no en <body> directamente.
	 *
	 * ¿Por qué el root y no body? Dos motivos:
	 *  1. Containing block: si un ancestro del contenido tiene backdrop-filter,
	 *     filter o transform (p. ej. .glass-panel), `position: fixed` se ancla a
	 *     ESE ancestro en vez del viewport y el modal se descuadra. Mover el
	 *     contenido al root de la app lo saca de ese containing block.
	 *  2. Delegación de eventos: Svelte 5 enlaza los eventos delegados (onclick,
	 *     etc.) al contenedor raíz de la app y a `document`. Si el contenido se
	 *     mueve FUERA del árbol de la app (a <body> como hermano del root), los
	 *     handlers delegados dejan de dispararse y el modal queda muerto al clic.
	 *     Al portar al root de la app (que sigue estando DENTRO del árbol de
	 *     Svelte, sin backdrop-filter/transform), la delegación sigue operando.
	 *
	 * Uso: <Portal><div class="modal">…</div></Portal>
	 *      <Portal container={document.querySelector('#app')}>…</Portal>
	 */
	import { onMount } from 'svelte';

	let { children, container = null } = $props();

	let el;

	function resolveTarget() {
		if (container) return container;
		// Root de la app Svelte: el ancestro superior del elemento del componente.
		// En SvelteKit es el div que contiene %sveltekit.body% (hijo de <body>).
		let node = el;
		let root = null;
		while (node) {
			root = node;
			node = node.parentElement;
		}
		// El ancestro superior DEBE estar dentro de <body> para no escapar del
		// árbol de la app (si no, Svelte no procesa los eventos delegados).
		if (root && root !== document.body && document.body.contains(root)) {
			return root;
		}
		// Fallback: primer hijo de <body> (el contenedor de la app en SvelteKit).
		const firstChild = document.body.firstElementChild;
		if (firstChild && firstChild !== document.body) return firstChild;
		return document.body;
	}

	onMount(() => {
		const target = resolveTarget();
		target.appendChild(el);
	});
</script>

<!-- El wrapper se mueve al root de la app tras el mount; los children van dentro de él.
     NO poner pointer-events: none aquí — mataría los clics de todo el contenido
     (el backdrop ya gestiona el cierre por clic fuera). -->
<div bind:this={el} style="position: fixed; inset: 0; z-index: 1000;">
	{@render children()}
</div>
