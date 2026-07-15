<script>
  import { onMount } from 'svelte';
  import { admin as adminApi } from '$lib/api.js';

  let loading = $state(true);
  let saving = $state(false);
  let statusMsg = $state({ text: '', type: '' });
  
  let settings = $state({
    site_name: 'VSocial',
    allow_registration: true,
    max_upload_size_mb: 50,
  });

  onMount(async () => {
    try {
      const res = await adminApi.settings.get();
      if (res.settings) {
        settings = {
          site_name: res.settings.site_name || 'VSocial',
          allow_registration: res.settings.allow_registration === '1' || res.settings.allow_registration === true,
          max_upload_size_mb: Number(res.settings.max_upload_size_mb || 50),
        };
      }
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  });

  async function saveSettings(e) {
    e.preventDefault();
    saving = true;
    statusMsg = { text: '', type: '' };
    try {
      await adminApi.settings.update({
        site_name: settings.site_name,
        allow_registration: settings.allow_registration,
        max_upload_size_mb: settings.max_upload_size_mb
      });
      statusMsg = { text: 'Configuración general guardada.', type: 'success' };
      setTimeout(() => statusMsg = { text: '', type: '' }, 4000);
    } catch (e) {
      console.error(e);
      statusMsg = { text: 'Error al guardar.', type: 'error' };
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Sistema | VSocial Admin</title>
</svelte:head>

<div class="page-header">
  <h1 class="page-title">Sistema</h1>
  <p class="page-subtitle">Configuración global de la plataforma</p>
</div>

<div class="page-content">
  {#if loading}
    <div class="loader-container">
      <span class="loading loading-spinner text-primary"></span>
    </div>
  {:else}
    <div class="space-y-8">
      <!-- General Settings -->
      <div class="settings-card glass-card">
        {#if statusMsg.text}
          <div class="alert-box" class:success={statusMsg.type === 'success'} class:error={statusMsg.type === 'error'}>
            <span class="material-icons-round">{statusMsg.type === 'success' ? 'check_circle' : 'error'}</span>
            {statusMsg.text}
          </div>
        {/if}

        <form onsubmit={saveSettings} class="settings-form">
          <h3 class="form-section-title">Generales</h3>
          
          <div class="form-group">
            <label for="site_name" class="form-label">Nombre del Sitio</label>
            <input type="text" id="site_name" bind:value={settings.site_name} class="aero-input" required />
          </div>

          <div class="form-group">
            <label for="max_upload" class="form-label">Límite de subida (MB)</label>
            <input type="number" id="max_upload" bind:value={settings.max_upload_size_mb} class="aero-input" required />
          </div>

          <h3 class="form-section-title mt-4">Acceso</h3>
          
          <div class="toggle-row">
            <div class="toggle-info">
              <span class="toggle-title">Permitir Nuevos Registros</span>
              <span class="toggle-desc">Si se desactiva, solo admin puede crear cuentas.</span>
            </div>
            <input type="checkbox" bind:checked={settings.allow_registration} class="aero-toggle-switch" />
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-aero-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .page-header {
    padding: 32px;
    background: linear-gradient(180deg, rgba(46,134,232,0.03) 0%, transparent 100%);
    border-bottom: 1px solid var(--border-subtle);
  }
  .page-title { font-size: 1.8rem; font-family: var(--font-display); font-weight: 800; margin: 0; }
  .page-subtitle { font-size: 0.9rem; color: var(--text-muted); margin: 4px 0 0; }

  .page-content { padding: 32px; max-width: 800px; }
  
  .settings-card { padding: 32px; border-radius: var(--radius-lg); }

  .form-section-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 1px solid var(--border-subtle); }
  .mt-4 { margin-top: 32px; }

  .form-group { margin-bottom: 20px; }
  .form-label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
  
  .toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--border-subtle); }
  .toggle-info { display: flex; flex-direction: column; }
  .toggle-title { font-weight: 600; color: var(--text-primary); font-size: 0.95rem; }
  .toggle-desc { font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; }

  .form-actions { margin-top: 32px; display: flex; justify-content: flex-end; }

  .alert-box { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-weight: 600; font-size: 0.9rem; }
  .alert-box.success { background: rgba(61, 199, 154, 0.1); color: var(--aero-mint); border: 1px solid rgba(61, 199, 154, 0.2); }
  .alert-box.error { background: rgba(232, 74, 114, 0.1); color: var(--aero-rose); border: 1px solid rgba(232, 74, 114, 0.2); }

  .loader-container { padding: 64px; text-align: center; }
</style>
