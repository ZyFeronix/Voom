<script>
	/**
	 * SnippetGallery — galería de fragmentos de CSS para el editor del perfil
	 * (pestaña «Perfil»). Inserta en la posición del cursor del textarea y
	 * permite copiar al portapapeles. Todos los fragmentos respetan el
	 * allowlist de lib/design/sanitize.js (sin @import, sin url() externas).
	 *
	 * Recibe `getTextarea()` para localizar el editor real dentro del modal
	 * de CSS y mutar su valor + disparar `input` (Svelte reacciona igual que
	 * si el usuario tecleara).
	 */
	import { SNIPPETS } from './snippets.js';

	let { getTextarea, onInsert } = $props();

	let copiedId = $state(null);
	let copyTimer = null;

	function insertSnippet(snippet) {
		const ta = getTextarea?.();
		if (!ta) {
			onInsert?.(snippet.css);
			return;
		}
		const start = ta.selectionStart ?? ta.value.length;
		const end = ta.selectionEnd ?? start;
		const next = ta.value.slice(0, start) + snippet.css + ta.value.slice(end);
		ta.value = next;
		ta.dispatchEvent(new Event('input', { bubbles: true }));
		const caret = start + snippet.css.length;
		ta.focus();
		ta.setSelectionRange(caret, caret);
		onInsert?.(next);
	}

	async function copySnippet(snippet) {
		try {
			await navigator.clipboard.writeText(snippet.css.trim());
			copiedId = snippet.id;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copiedId = null), 1500);
		} catch {}
	}
</script>

<div class="snippet-gallery" role="group" aria-label="Fragmentos CSS listos para usar">
	<span class="gallery-label">Fragmentos:</span>
	{#each SNIPPETS as snippet (snippet.id)}
		<span class="snippet-item" class:copied={copiedId === snippet.id}>
			<button
				type="button"
				class="snippet-chip"
				title="Insertar en el cursor"
				onclick={() => insertSnippet(snippet)}
			>
				<span class="material-icons-round">{snippet.icon}</span>
				{snippet.name}
			</button>
			<button
				type="button"
				class="snippet-copy"
				title="Copiar al portapapeles"
				aria-label="Copiar {snippet.name}"
				onclick={() => copySnippet(snippet)}
			>
				<span class="material-icons-round"
					>{copiedId === snippet.id ? 'check' : 'content_copy'}</span
				>
			</button>
		</span>
	{/each}
</div>

<style>
	.snippet-gallery {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.gallery-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.6px;
		margin-right: 2px;
	}
	.snippet-item {
		display: inline-flex;
		align-items: stretch;
		border-radius: 999px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface) 65%, transparent);
	}
	.snippet-item.copied {
		border-color: color-mix(in srgb, var(--aero-mint, #00d4aa) 55%, transparent);
	}
	.snippet-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 8px 5px 10px;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.74rem;
		font-weight: 600;
		cursor: pointer;
	}
	.snippet-chip .material-icons-round {
		font-size: 14px;
		color: var(--accent-cyan);
	}
	.snippet-chip:hover {
		color: var(--text-primary);
	}
	.snippet-copy {
		display: inline-flex;
		align-items: center;
		padding: 0 7px;
		border: none;
		border-left: 1px solid var(--border-subtle);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.snippet-copy .material-icons-round {
		font-size: 13px;
	}
	.snippet-copy:hover {
		color: var(--accent-cyan);
	}
</style>
