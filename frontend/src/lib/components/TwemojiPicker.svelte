<script>
	let { onSelect, onClose, variant = 'absolute' } = $props();

	const EMOJI_CATEGORIES = [
		{
			name: 'Sonrisas',
			icon: '😀',
			emojis: [
				'😀',
				'😃',
				'😄',
				'😁',
				'😆',
				'😅',
				'😂',
				'🤣',
				'🥲',
				'😊',
				'😇',
				'🙂',
				'🙃',
				'😉',
				'😌',
				'😍',
				'🥰',
				'😘',
				'😗',
				'😙',
				'😚',
				'😋',
				'😛',
				'😝',
				'😜',
				'🤪',
				'🤨',
				'🧐',
				'🤓',
				'😎',
				'🥸',
				'🤩',
				'🥳',
				'😏',
				'😒',
				'😞',
				'😔',
				'😟',
				'😕',
				'🙁',
				'☹️',
				'😣',
				'😖',
				'😫',
				'😩',
				'🥺',
				'😢',
				'😭',
				'😤',
				'😠',
				'😡',
				'🤬',
				'🤯',
				'😳',
				'🥵',
				'🥶',
				'😱',
				'😨',
				'😰',
				'😥',
				'😓',
				'🤗',
				'🤔',
				'🤭',
				'🤫',
				'🤥',
				'😶',
				'😐',
				'😑',
				'😬',
				'🙄',
				'😯',
				'😦',
				'😧',
				'😮',
				'😲',
				'🥱',
				'😴',
				'🤤',
				'😪',
				'😵',
				'🤐',
				'🥴',
				'🤢',
				'🤮',
				'🤧',
				'😷',
				'🤒',
				'🤕',
				'🤑',
				'🤠',
				'😈',
				'👿',
				'👹',
				'👺',
				'🤡',
				'💩',
				'👻',
				'💀',
				'☠️',
				'👽',
				'👾',
				'🤖',
				'🎃',
				'😺',
				'😸',
				'😹',
				'😻',
				'😼',
				'😽',
				'🙀',
				'😿',
				'😾'
			]
		},
		{
			name: 'Gestos',
			icon: '👋',
			emojis: [
				'👋',
				'🤚',
				'🖐',
				'✋',
				'🖖',
				'👌',
				'🤌',
				'🤏',
				'✌️',
				'🤞',
				'🤟',
				'🤘',
				'🤙',
				'👈',
				'👉',
				'👆',
				'🖕',
				'👇',
				'☝️',
				'👍',
				'👎',
				'✊',
				'👊',
				'🤛',
				'🤜',
				'👏',
				'🙌',
				'👐',
				'🤲',
				'🤝',
				'🙏',
				'✍️',
				'💅',
				'🤳',
				'💪',
				'🦾',
				'🦿',
				'🦵',
				'🦶',
				'👂',
				'🦻',
				'👃',
				'🧠',
				'🫀',
				'🫁',
				'🦷',
				'🦴',
				'👀',
				'👁',
				'👅',
				'👄',
				'💋',
				'🩸'
			]
		},
		{
			name: 'Corazones',
			icon: '❤️',
			emojis: [
				'❤️',
				'🧡',
				'💛',
				'💚',
				'💙',
				'💜',
				'🖤',
				'🤍',
				'🤎',
				'💔',
				'❤️‍🔥',
				'❤️‍🩹',
				'❣️',
				'💕',
				'💞',
				'💓',
				'💗',
				'💖',
				'💘',
				'💝'
			]
		}
	];

	// Paginación: renderizar el tab por lotes evita ~190 nodos DOM por picker
	// (hay varios montados a la vez en feed/chat/lightbox).
	const PAGE_SIZE = 64;

	let activeTab = $state(0);
	let search = $state('');
	let visibleCount = $state(PAGE_SIZE);

	// Keywords ES/EN para el buscador. Solo los emojis más buscados tienen
	// entrada; el resto no aparece en resultados de búsqueda (sigue en su tab).
	const KEYWORDS = {
		'😀': 'sonrisa grin happy feliz alegre',
		'😃': 'sonrisa smile happy feliz',
		'😄': 'sonrisa smile happy feliz ojos',
		'😁': 'sonrisa beam dientes grin',
		'😆': 'risa laugh lol jeje',
		'😅': 'sudor risa nervioso sweat laugh',
		'😂': 'llorar risa joy lol mmda jaja',
		'🤣': 'rofl llorar risa suelo jaja',
		'😊': 'sonrojo sonrisa blush feliz tierno',
		'😇': 'angel ángel halo santo inocente',
		'🙂': 'sonrisa slight neutral ligera',
		'😉': 'guiño wink coqueteo',
		'😍': 'amor ojos corazón love corazon',
		'🥰': 'enamorado amor corazones love',
		'😘': 'beso kiss guino',
		'😋': 'rico delicioso yum lengua sabroso',
		'😛': 'lengua tongue juego',
		'😜': 'lengua guiño loco wink tongue',
		'🤪': 'loco crazy zany ojo',
		'🤨': 'ceja levantada suspicious desconfiado hmm',
		'🧐': 'monoculo monocle curioso examinar',
		'🤓': 'nerd gafas empollon',
		'😎': 'gafas sol cool chido',
		'🥸': 'disfraz incognito bigote',
		'🤩': 'estrellas estrellas wow impresionado',
		'🥳': 'fiesta party celebrar cumpleanos',
		'😏': 'sonrisita smug picardia malicia',
		'😒': 'desagrado unamused aburrido meh',
		'😔': 'triste pensive deprimido suspiro',
		'😕': 'confuso confused confused',
		'🙁': 'triste ceño frown leve',
		'😣': 'perseverar dolor frustrado',
		'😖': 'confundido doliendo sorpresa',
		'😫': 'cansado agotado tired grito',
		'😩': 'agotado cansado weary angustiado',
		'🥺': 'suplicar ruegos porfa ojitos',
		'😢': 'llorar cry triste lagrima',
		'😭': 'gritar llorar sob bawling mucho',
		'😤': 'triunfo aliento vapor huff orgullo',
		'😠': 'enojado angry enfadado molestia',
		'😡': 'rabia rage furioso rojo',
		'🤬': 'groserias insultar malas palabras censurado',
		'🤯': 'mente explotada mind blown impresionado',
		'😳': 'sonrojo avergonzado flushed ruborizado',
		'🥵': 'caliente calor hot agotado derretido',
		'🥶': 'frio frio congelado cold',
		'😱': 'grito miedo susto horrorized',
		'😨': 'miedo susto asustado temor',
		'😰': 'ansioso nervioso sudor',
		'🤗': 'abrazo hug abrazar',
		'🤔': 'pensar thinking hmm duda',
		'🤭': 'oops tapar risita ups',
		'🤫': 'shh silencio callar secreto',
		'🤥': 'mentira liar pinocho',
		'😶': 'sin boca silencio neutral mute',
		'😐': 'neutral expresion inexpressivo meh',
		'😑': 'expresion inexpressivo blanco',
		'😬': 'mueca grimace incomodo yikes',
		'🙄': 'ojos roll cielo eyeroll',
		'😯': 'sorpresa hushed sorprendido',
		'😮': 'boca abierta wow sorpresa',
		'😲': 'asombro astonished sorpresa',
		'🥱': 'bostezo yawn aburrido sueño',
		'😴': 'dormir sleep zzz sueño',
		'🤤': 'baba drool desear',
		'😪': 'somnoliento sleepy cansado',
		'😵': 'mareado dizzy knockout x_x',
		'🤐': 'boca cerrada zipper silencio',
		'🥴': 'mareado ebrio woozy borracho',
		'🤢': 'nausea asco verde sick',
		'🤮': 'vomitar vomit asco puke',
		'🤧': 'estornudar sneeze gripa',
		'😷': 'cubrebocas mascarilla sick covid',
		'🤒': 'termometro sick enfermo',
		'🤕': 'vendaje herido hurt',
		'🤑': 'dinero money boca rico',
		'🤠': 'vaquero cowboy sombrero',
		'😈': 'diablito devil cuernos travieso',
		'👹': 'ogro demonio japon',
		'🤡': 'payaso clown circo',
		'💩': 'caca poop',
		'👻': 'fantasma ghost halloween',
		'💀': 'calavera skull muerte',
		'👽': 'alien extraterrestre ovni',
		'👾': 'videojuego gamer alien pixel',
		'🤖': 'robot bot ia ai',
		'🎃': 'calabaza halloween pumpkin',
		'😺': 'gato sonrisa cat happy',
		'😹': 'gato risa cat joy jaja',
		'😻': 'gato amor cat corazones',
		'😼': 'gato sonrisita cat malicia',
		'🙈': 'mono tapa ojos see no evil verguenza',
		'🙉': 'mono tapa orejas hear no evil',
		'🙊': 'mono tapa boca speak no evil ups',
		'👍': 'pulgar arriba like bien ok',
		'👎': 'pulgar abajo dislike mal',
		'👌': 'perfecto ok dedos',
		'✌️': 'paz paz victoria peace',
		'🤞': 'dedos cruzados suerte suerte',
		'🤙': 'call me llamame surfero',
		'👏': 'aplauso clap bravo',
		'🙏': 'gracias gracias rezar porfa oracion',
		'💪': 'musculo flexion fuerte strong gym',
		'🤝': 'apreton manos acuerdo trato',
		'✍️': 'escribir firma write',
		'💅': 'unas manicura nail saludo',
		'👀': 'ojos ojos mirar look',
		'🧠': 'cerebro brain mente inteligente',
		'🎉': 'fiesta ttp celebrar party confeti',
		'🎊': 'confeti fiesta celebrar',
		'❤️': 'corazon rojo love amor',
		'🧡': 'corazon naranja orange',
		'💛': 'corazon amarillo yellow',
		'💚': 'corazon verde green',
		'💙': 'corazon azul blue',
		'💜': 'corazon morado purple',
		'🖤': 'corazon negro black',
		'🤍': 'corazon blanco white',
		'🤎': 'corazon cafe marron brown',
		'💔': 'corazon roto heartbreak triste',
		'❣️': 'exclamacion corazon love',
		'💕': 'dos corazones love amor',
		'💞': 'corazones girando amor',
		'💓': 'corazon latiendo amor',
		'💗': 'corazon creciendo amor',
		'💖': 'corazon brillante amor',
		'💘': 'corazon flecha cupid san valentin',
		'💝': 'corazon regalo cinta'
	};

	function handleSelect(emoji) {
		if (onSelect) onSelect(emoji);
	}

	function resetPaging() {
		visibleCount = PAGE_SIZE;
	}

	// Buscar en TODAS las categorías por keyword; sin query se ve el tab activo.
	let searchResults = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return null;
		const hits = [];
		for (const cat of EMOJI_CATEGORIES) {
			for (const emoji of cat.emojis) {
				const kw = KEYWORDS[emoji];
				if (kw && kw.includes(q)) hits.push(emoji);
			}
		}
		return hits;
	});

	let visibleEmojis = $derived.by(() => {
		if (searchResults) return searchResults.slice(0, visibleCount);
		const list = EMOJI_CATEGORIES[activeTab].emojis;
		return list.slice(0, visibleCount);
	});

	let hasMore = $derived.by(() => {
		const total = searchResults ? searchResults.length : EMOJI_CATEGORIES[activeTab].emojis.length;
		return visibleCount < total;
	});
</script>

<div
	class="emoji-picker {variant === 'inline' ? 'variant-inline' : ''}"
	role="presentation"
	onclick={(e) => e.stopPropagation()}
	onkeydown={(e) => e.stopPropagation()}
	onwheel={(e) => e.stopPropagation()}
>
	<!-- Tabs -->
	<div class="tabs-container">
		{#each EMOJI_CATEGORIES as cat, i}
			<button
				type="button"
				class="tab-btn"
				class:active={activeTab === i && !search}
				onclick={() => {
					activeTab = i;
					search = '';
					resetPaging();
				}}
				title={cat.name}
				aria-label={cat.name}
			>
				<span class="tab-icon">{cat.icon}</span>
			</button>
		{/each}
		<div style="flex: 1;"></div>
		{#if onClose}
			<button type="button" class="close-btn" onclick={onClose} title="Cerrar">
				<span class="material-icons-round" style="font-size:16px">close</span>
			</button>
		{/if}
	</div>

	<!-- Búsqueda -->
	<div class="search-box">
		<span class="material-icons-round search-icon">search</span>
		<input
			type="text"
			class="aero-input search-input"
			placeholder="Buscar emoji…"
			bind:value={search}
			oninput={resetPaging}
			aria-label="Buscar emoji"
		/>
	</div>

	<!-- Grid -->
	<div class="emoji-grid custom-scrollbar" onwheel={(e) => e.stopPropagation()}>
		{#if visibleEmojis.length === 0}
			<p class="no-results">Sin resultados para «{search}»</p>
		{:else}
			{#each visibleEmojis as emoji (emoji)}
				<button
					type="button"
					class="emoji-btn"
					onclick={() => handleSelect(emoji)}
					title={emoji}
					aria-label={emoji}
				>
					<span class="emoji-glyph">{emoji}</span>
				</button>
			{/each}
		{/if}
	</div>

	{#if hasMore}
		<button type="button" class="load-more" onclick={() => (visibleCount += PAGE_SIZE)}>
			Ver más ({visibleEmojis.length === 0 ? 0 : visibleCount}
			de {searchResults ? searchResults.length : EMOJI_CATEGORIES[activeTab].emojis.length})
		</button>
	{/if}
</div>

<style>
	.emoji-picker {
		position: absolute;
		bottom: 100%;
		right: 0;
		margin-bottom: 8px;
		width: 280px;
		max-width: 100%;
		padding: 12px;
		z-index: 1000;
		box-sizing: border-box;
		background: var(--bg-sidebar) !important;
		backdrop-filter: var(--glass-blur) !important;
		-webkit-backdrop-filter: var(--glass-blur) !important;
		border: 1px solid var(--glass-border-t, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-lg, 16px);
		box-shadow: 0 4px 16px rgba(46, 134, 232, 0.06);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	:global([data-theme='light']) .emoji-picker {
		background: linear-gradient(
			90deg,
			rgba(16, 185, 129, 0.25) 0%,
			rgba(14, 165, 233, 0.35) 100%
		) !important;
		box-shadow:
			0 4px 16px rgba(16, 185, 129, 0.12),
			0 1px 0 rgba(255, 255, 255, 0.6) inset;
	}
	.emoji-picker.variant-inline {
		position: relative;
		bottom: auto;
		right: auto;
		margin-bottom: 0;
		width: 100%;
		max-width: 100%;
		padding: 0;
		box-sizing: border-box;
		z-index: 1;
		box-shadow: none;
		background: transparent !important;
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
		border: none;
	}
	:global([data-theme='light']) .emoji-picker.variant-inline {
		background: transparent !important;
		box-shadow: none;
	}
	.tabs-container {
		display: flex;
		gap: 6px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--border-subtle);
		align-items: center;
		flex-shrink: 0;
	}
	.search-box {
		position: relative;
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}
	.search-icon {
		position: absolute;
		left: 10px;
		font-size: 15px;
		color: var(--text-tertiary);
		pointer-events: none;
	}
	.search-input {
		width: 100%;
		padding: 7px 10px 7px 32px;
		font-size: 0.8rem;
		border-radius: var(--radius-squircle);
	}
	.no-results {
		grid-column: 1 / -1;
		margin: 8px 0;
		font-size: 0.78rem;
		color: var(--text-tertiary);
		text-align: center;
	}
	.load-more {
		flex-shrink: 0;
		border: 1px solid var(--border-subtle);
		background: var(--bg-overlay);
		color: var(--text-secondary);
		font-size: 0.72rem;
		font-weight: 600;
		padding: 6px 10px;
		border-radius: var(--radius-squircle);
		cursor: pointer;
		transition:
			background var(--t-fast),
			color var(--t-fast);
	}
	.load-more:hover {
		background: var(--bg-surface-hover);
		color: var(--text-primary);
	}
	.tab-btn {
		background: transparent;
		border: 1px solid transparent;
		padding: 5px 10px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		cursor: pointer;
		transition:
			background var(--t-fast),
			border-color var(--t-fast),
			transform 0.18s var(--ease-spring);
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tab-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.1);
	}
	.tab-btn.active {
		background: rgba(var(--accent-blue-rgb), 0.16);
		border-color: rgba(var(--accent-blue-rgb), 0.35);
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.35),
			var(--shadow-xs);
	}
	.tab-icon {
		font-size: 20px;
		font-family: 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
		display: block;
		pointer-events: none;
		line-height: 1;
	}
	.close-btn {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background var(--t-fast),
			color var(--t-fast);
	}
	.close-btn:hover {
		background: rgba(255, 0, 0, 0.1);
		color: var(--rose-500, #f43f5e);
	}
	/* ── Grid Neo-Aero: tiles squircle con halo de acento al hover ── */
	.emoji-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
		justify-items: center;
		gap: 4px;
		max-height: 210px;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 2px 8px 6px 2px;
		box-sizing: border-box;
		scrollbar-gutter: stable;
		scrollbar-width: thin;
		scrollbar-color: rgba(var(--accent-blue-rgb), 0.35) var(--scrollbar-track, transparent);
	}
	.emoji-grid::-webkit-scrollbar {
		width: 6px;
	}
	.emoji-grid::-webkit-scrollbar-track {
		background: var(--scrollbar-track, transparent);
		border-radius: var(--radius-full);
		margin: 4px 0;
	}
	.emoji-grid::-webkit-scrollbar-thumb {
		background: linear-gradient(180deg, var(--aero-sky), var(--aero-mint));
		opacity: 0.45;
		border-radius: var(--radius-full);
		box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.3);
	}
	.emoji-grid::-webkit-scrollbar-thumb:hover {
		background: linear-gradient(180deg, var(--aero-sky), var(--aero-mint));
		opacity: 0.7;
	}
	.emoji-btn {
		width: 38px;
		height: 38px;
		min-width: 38px;
		min-height: 38px;
		background: transparent;
		border: 1px solid transparent;
		cursor: pointer;
		padding: 0;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		transition:
			transform 0.18s var(--ease-spring),
			background var(--t-fast),
			border-color var(--t-fast),
			box-shadow 0.18s ease;
		display: flex;
		justify-content: center;
		align-items: center;
		line-height: 1;
		box-sizing: border-box;
	}
	.emoji-btn:hover {
		background: rgba(var(--accent-blue-rgb), 0.14);
		border-color: rgba(var(--accent-blue-rgb), 0.35);
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.35),
			0 2px 8px rgba(var(--accent-blue-rgb), 0.22);
		transform: scale(1.16);
		z-index: 2;
	}
	.emoji-btn:active {
		transform: scale(0.94);
	}
	.emoji-glyph {
		font-size: 22px;
		font-family: 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		line-height: 1;
		user-select: none;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.18));
		transition: filter var(--t-fast);
	}
	.emoji-btn:hover .emoji-glyph {
		filter: drop-shadow(0 2px 5px rgba(var(--accent-blue-rgb), 0.4))
			drop-shadow(0 0 2px rgba(255, 255, 255, 0.35));
	}
</style>
