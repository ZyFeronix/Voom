<script>
  /**
   * ReportModal — Reusable content report dialog
   * Svelte 5 Runes · Glassmorphism design
   */
  let { entityType = 'post', entityId = 0, onclose = () => {} } = $props();

  let reason = $state('');
  let sending = $state(false);
  let error = $state('');
  let success = $state(false);

  const reasons = [
    { id: 'spam', label: 'Spam o publicidad no deseada' },
    { id: 'harassment', label: 'Acoso o bullying' },
    { id: 'hate', label: 'Discurso de odio' },
    { id: 'nudity', label: 'Contenido sexual explicito' },
    { id: 'violence', label: 'Violencia o contenido grafico' },
    { id: 'misinformation', label: 'Informacion falsa' },
    { id: 'copyright', label: 'Infraccion de derechos de autor' },
    { id: 'other', label: 'Otro motivo' }
  ];

  async function handleReport() {
    if (!reason || sending) return;
    sending = true;
    error = '';

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('vsocial_token') || ''}`
        },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar reporte');
      success = true;
      setTimeout(() => onclose(), 2000);
    } catch (err) {
      error = err.message;
    } finally {
      sending = false;
    }
  }
</script>

<div class="modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) onclose(); }} transition:fade={{ duration: 150 }}>
  <div class="modal-content glass-panel" transition:scale={{ duration: 250, start: 0.95, easing: backOut }}>
    {#if success}
      <div class="success-state">
        <span class="material-icons-round success-icon">check_circle</span>
        <h3 class="success-title">Reporte enviado</h3>
        <p class="success-text">Gracias por ayudar a mantener VSocial seguro. Lo revisaremos pronto.</p>
      </div>
    {:else}
      <div class="modal-header">
        <h3 class="modal-title">Reportar contenido</h3>
        <button class="close-btn" onclick={onclose}>
          <span class="material-icons-round">close</span>
        </button>
      </div>

      {#if error}
        <div class="error-bar">
          <span class="material-icons-round">error_outline</span>
          {error}
        </div>
      {/if}

      <p class="modal-desc">Selecciona el motivo del reporte para {entityType} #{entityId}:</p>

      <div class="reasons-list">
        {#each reasons as r}
          <button class="reason-option" class:selected={reason === r.label} onclick={() => reason = r.label}>
            <span class="reason-text">{r.label}</span>
            {#if reason === r.label}
              <span class="material-icons-round check-icon">check_circle</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="modal-actions">
        <button class="btn-aero-secondary" onclick={onclose} style="padding:8px 16px;font-size:0.85rem;">Cancelar</button>
        <button class="btn-aero-danger" disabled={!reason || sending} onclick={handleReport} style="padding:8px 20px;font-size:0.85rem;">
          {#if sending}
            <span class="loading-spinner" style="width:14px;height:14px;border-width:2px;"></span>
          {:else}
            <span class="material-icons-round" style="font-size:16px">flag</span>
          {/if}
          Enviar reporte
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 20, 40, 0.5);
    backdrop-filter: blur(8px);
    z-index: var(--z-modal-backdrop);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: fadeIn 0.2s ease;
  }

  .modal-content {
    width: 100%;
    max-width: 420px;
    padding: 24px;
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--text-primary);
    margin: 0;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--glass-bg);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-overlay);
    color: var(--aero-rose);
  }

  .modal-desc {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.4;
  }

  .error-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(232,74,114,0.08);
    border: 1px solid rgba(232,74,114,0.2);
    border-radius: 10px;
    color: var(--aero-rose);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .reasons-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 260px;
    overflow-y: auto;
  }

  .reason-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: var(--glass-bg);
    color: var(--text-primary);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .reason-option:hover {
    background: var(--bg-overlay);
    border-color: var(--glass-border);
  }

  .reason-option.selected {
    border-color: var(--aero-rose);
    background: rgba(232,74,114,0.06);
    color: var(--aero-rose);
    font-weight: 700;
  }

  .check-icon {
    font-size: 18px;
    color: var(--aero-rose);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
  }

  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 20px 0;
    gap: 10px;
  }

  .success-icon {
    font-size: 3rem;
    color: var(--aero-mint);
  }

  .success-title {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--text-primary);
    margin: 0;
  }

  .success-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .loading-spinner {
    display: inline-block;
    border: 3px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
