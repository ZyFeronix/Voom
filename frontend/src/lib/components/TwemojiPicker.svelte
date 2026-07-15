<script>
  let { onSelect, onClose, variant = 'absolute' } = $props();

  const EMOJI_CATEGORIES = [
    {
      name: 'Sonrisas',
      icon: '😀',
      emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','🥲','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾']
    },
    {
      name: 'Gestos',
      icon: '👋',
      emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁','👅','👄','💋','🩸']
    },
    {
      name: 'Corazones',
      icon: '❤️',
      emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝']
    }
  ];

  let activeTab = $state(0);

  function handleSelect(emoji) {
    if (onSelect) onSelect(emoji);
  }
</script>

<div class="emoji-picker {variant === 'inline' ? 'variant-inline' : ''}" role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
  <!-- Tabs -->
  <div class="tabs-container">
    {#each EMOJI_CATEGORIES as cat, i}
      <button 
        type="button"
        class="tab-btn" 
        class:active={activeTab === i}
        onclick={() => activeTab = i}
        title={cat.name}
        aria-label={cat.name}
      >
        <span class="tab-icon">{cat.icon}</span>
      </button>
    {/each}
    <div style="flex: 1;"></div>
    {#if onClose}
      <button 
        type="button" 
        class="close-btn" 
        onclick={onClose} 
        title="Cerrar"
      >
        <span class="material-icons-round" style="font-size:16px">close</span>
      </button>
    {/if}
  </div>

  <!-- Grid -->
  <div class="emoji-grid custom-scrollbar">
    {#each EMOJI_CATEGORIES[activeTab].emojis as emoji}
      <button type="button" class="emoji-btn" onclick={() => handleSelect(emoji)} title={emoji} aria-label={emoji}>
        <span class="emoji-glyph">{emoji}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .emoji-picker {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
    width: 280px;
    padding: 12px;
    z-index: 1000;
    background: var(--bg-sidebar) !important;
    backdrop-filter: var(--glass-blur) !important;
    -webkit-backdrop-filter: var(--glass-blur) !important;
    border: 1px solid var(--glass-border-t, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 16px);
    box-shadow: 0 4px 16px rgba(46,134,232,0.06);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  :global([data-theme="light"]) .emoji-picker {
    background: linear-gradient(90deg, rgba(16, 185, 129, 0.25) 0%, rgba(14, 165, 233, 0.35) 100%) !important;
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.12), 0 1px 0 rgba(255,255,255,0.6) inset;
  }
  .emoji-picker.variant-inline {
    position: relative;
    bottom: auto;
    right: auto;
    margin-bottom: 0;
    width: 100%;
    z-index: 1;
    box-shadow: none;
  }
  .tabs-container {
    display: flex;
    gap: 4px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-subtle);
    align-items: center;
  }
  .tab-btn {
    background: transparent;
    border: none;
    padding: 6px 12px;
    border-radius: 12px;
    cursor: pointer;
    transition: background var(--t-fast);
    line-height: 1;
  }
  .tab-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .tab-btn.active {
    background: rgba(255, 255, 255, 0.15);
    box-shadow: var(--shadow-sm);
  }
  .tab-icon {
    font-size: 20px;
    font-family: 'Noto Color Emoji', sans-serif;
    display: block;
    pointer-events: none;
  }
  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: background var(--t-fast), color var(--t-fast);
  }
  .close-btn:hover {
    background: rgba(255, 0, 0, 0.1);
    color: var(--rose-500, #f43f5e);
  }
  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 4px;
    padding-bottom: 4px;
  }
  .emoji-grid::-webkit-scrollbar {
    width: 6px;
  }
  .emoji-grid::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
  }
  .emoji-grid::-webkit-scrollbar-thumb {
    background: rgba(14, 165, 233, 0.3);
    border-radius: 10px;
  }
  .emoji-grid::-webkit-scrollbar-thumb:hover {
    background: rgba(14, 165, 233, 0.5);
  }
  .emoji-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    transition: all 0.2s;
    display: flex;
    justify-content: center;
    align-items: center;
    line-height: 1;
  }
  .emoji-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: scale(1.15);
  }
  .emoji-glyph {
    font-size: 22px;
    font-family: 'Noto Color Emoji', sans-serif;
    display: block;
    pointer-events: none;
    line-height: 1;
  }
</style>
