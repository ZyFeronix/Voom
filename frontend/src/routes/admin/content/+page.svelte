<script>
  import { fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { onMount } from 'svelte';
  import { admin as adminApi } from '$lib/api.js';

  let loading = $state(true);
  let contentList = $state([]);
  let currentType = $state('posts'); // 'posts' or 'reels'

  onMount(async () => {
    await loadContent();
  });

  async function loadContent() {
    loading = true;
    try {
      const res = await adminApi.content.list({ type: currentType });
      contentList = res.content || [];
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function switchType(type) {
    currentType = type;
    loadContent();
  }

  let showConfirmModal = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let isDanger = $state(true);
  let confirmAction = null;
  let actionError = $state('');

  function promptDeleteContent(item) {
    confirmTitle = `¿Eliminar ${currentType}?`;
    confirmMessage = currentType === 'trash' ? 'Este contenido se borrará definitivamente de la base de datos.' : 'El contenido se moverá a la papelera por 30 días.';
    isDanger = true;
    actionError = '';
    confirmAction = async () => {
      try {
        await adminApi.content.delete(currentType === 'posts' ? 'post' : currentType === 'reels' ? 'reel' : 'trash', item.id);
        contentList = contentList.filter(c => c.id !== item.id);
        showConfirmModal = false;
      } catch (e) {
        console.error(e);
        actionError = 'Error al eliminar el contenido.';
      }
    };
    showConfirmModal = true;
  }

  function promptRestoreContent(item) {
    confirmTitle = `¿Restaurar post #${item.id}?`;
    confirmMessage = 'El post volverá a estar visible públicamente.';
    isDanger = false;
    actionError = '';
    confirmAction = async () => {
      try {
        await adminApi.content.restore(item.id);
        contentList = contentList.filter(c => c.id !== item.id);
        showConfirmModal = false;
      } catch (e) {
        console.error(e);
        actionError = 'Error al restaurar el contenido.';
      }
    };
    showConfirmModal = true;
  }
</script>

<svelte:head>
  <title>Contenido | VSocial Admin</title>
</svelte:head>

<div class="page-header">
  <div class="header-left">
    <h1 class="page-title">Contenido</h1>
    <p class="page-subtitle">Modera y gestiona posts y reels</p>
  </div>
  <div class="header-right">
    <div class="type-toggles">
      <button class="toggle-btn" class:active={currentType === 'posts'} onclick={() => switchType('posts')}>Posts</button>
      <button class="toggle-btn" class:active={currentType === 'reels'} onclick={() => switchType('reels')}>Reels</button>
      <button class="toggle-btn" class:active={currentType === 'trash'} onclick={() => switchType('trash')}>Papelera</button>
    </div>
  </div>
</div>

<div class="page-content">
  <div class="glass-card table-card">
    {#if loading && contentList.length === 0}
      <div class="loader-container">
        <span class="loading loading-spinner text-primary"></span>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="aero-table">
          <thead>
            <tr>
              <th>Autor</th>
              <th>Contenido</th>
              <th>Fecha</th>
              <th>Interacciones</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each contentList as item}
              <tr>
                <td>
                  <div class="user-cell">
                    <div class="user-avatar-mini">
                      {#if item.avatar_url}
                        <img src={item.avatar_url} alt={item.username} />
                      {:else}
                        <span>{item.username[0].toUpperCase()}</span>
                      {/if}
                    </div>
                    <span class="user-handle">@{item.username}</span>
                  </div>
                </td>
                <td>
                  <div class="content-cell">
                    {#if item.media}
                      <div class="media-thumb">
                        {#if currentType === 'reels' || item.media.includes('video')}
                          <span class="material-icons-round play-icon">play_circle</span>
                          <media-player src={item.media} muted playsInline>
                            <media-provider></media-provider>
                          </media-player>
                        {:else}
                          <img src={item.media} alt="Media" />
                        {/if}
                      </div>
                    {/if}
                    <p class="content-text">{item.body || '(Sin texto)'}</p>
                  </div>
                </td>
                <td>{new Date(item.created_at).toLocaleDateString()}</td>
                <td>
                  <span class="stat-badge"><span class="material-icons-round">favorite</span> {item.like_count || 0}</span>
                </td>
                <td class="text-right">
                  {#if currentType === 'trash'}
                    <button class="btn-aero-primary btn-sm" style="margin-right: 4px;" onclick={() => promptRestoreContent(item)}>Restaurar</button>
                  {/if}
                  <button class="btn-aero-danger btn-sm" onclick={() => promptDeleteContent(item)}>Eliminar</button>
                </td>
              </tr>
            {/each}
            {#if contentList.length === 0}
              <tr>
                <td colspan="5" class="empty-row">No hay {currentType} disponibles.</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

{#if showConfirmModal}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onclick={(e) => { if(e.target === e.currentTarget) showConfirmModal = false; }} transition:fade={{ duration: 150 }}>
  <div class="glass-panel p-6 max-w-sm w-full" style="border-radius: var(--radius-lg); background: var(--glass-bg);" transition:scale={{ duration: 250, start: 0.95, easing: backOut }}>
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 {isDanger ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}">
        <span class="material-icons-round">{isDanger ? 'warning' : 'restore'}</span>
      </div>
      <h3 class="font-bold text-lg text-main m-0">{confirmTitle}</h3>
    </div>
    <p class="text-sm text-muted mb-6 leading-relaxed">{confirmMessage}</p>
    {#if actionError}
      <p class="text-xs text-red-400 mb-4 bg-red-500/10 p-2 rounded-md">{actionError}</p>
    {/if}
    <div class="flex gap-3 justify-end">
      <button onclick={() => showConfirmModal = false} class="btn-aero-secondary" style="padding: 8px 16px; font-size: 0.85rem;">Cancelar</button>
      <button onclick={confirmAction} class={isDanger ? 'btn-aero-danger' : 'btn-aero-primary'} style="padding: 8px 16px; font-size: 0.85rem;">
        {isDanger ? 'Eliminar' : 'Restaurar'}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .page-header {
    padding: 32px;
    background: linear-gradient(180deg, rgba(46,134,232,0.03) 0%, transparent 100%);
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .page-title { font-size: 1.8rem; font-family: var(--font-display); font-weight: 800; margin: 0; }
  .page-subtitle { font-size: 0.9rem; color: var(--text-muted); margin: 4px 0 0; }

  .type-toggles {
    display: flex;
    background: var(--bg-surface);
    border-radius: var(--radius-md);
    padding: 4px;
    border: 1px solid var(--glass-border);
  }
  .toggle-btn {
    background: none; border: none; padding: 6px 16px; border-radius: 8px; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 0.2s;
  }
  .toggle-btn.active {
    background: var(--bg-canvas); color: var(--text-primary); box-shadow: var(--shadow-sm);
  }

  .page-content { padding: 32px; }
  .table-card { border-radius: var(--radius-lg); overflow: hidden; }
  .table-responsive { overflow-x: auto; }
  
  .aero-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .aero-table th { text-align: left; padding: 16px 24px; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border-subtle); }
  .aero-table td { padding: 16px 24px; border-bottom: 1px solid var(--border-subtle); vertical-align: middle; }
  .aero-table tr:hover td { background: rgba(255,255,255,0.02); }

  .user-cell { display: flex; align-items: center; gap: 8px; }
  .user-avatar-mini { width: 28px; height: 28px; border-radius: 50%; background: var(--grad-primary); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; overflow: hidden; }
  .user-avatar-mini img { width: 100%; height: 100%; object-fit: cover; }
  .user-handle { font-size: 0.85rem; font-weight: 600; }

  .content-cell { display: flex; align-items: center; gap: 12px; max-width: 300px; }
  .media-thumb { width: 48px; height: 48px; border-radius: 8px; overflow: hidden; position: relative; background: #000; flex-shrink: 0; }
  .media-thumb img, .media-thumb video, .media-thumb media-player { width: 100%; height: 100%; object-fit: cover; }
  .play-icon { position: absolute; inset: 0; margin: auto; color: #fff; font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.5); width: 24px; height: 24px; }
  .content-text { font-size: 0.85rem; color: var(--text-secondary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .stat-badge { display: flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }
  .stat-badge .material-icons-round { font-size: 14px; color: var(--aero-rose); }

  .text-right { text-align: right !important; }
  .btn-sm { padding: 6px 12px; font-size: 0.8rem; }
  .empty-row { text-align: center; color: var(--text-muted); padding: 32px !important; }
  .loader-container { padding: 64px; text-align: center; }
</style>
