<script>
  import { onMount } from 'svelte';
  import { admin as adminApi } from '$lib/api.js';
  import CustomSelect from '$lib/components/CustomSelect.svelte';

  let activeMenuId = $state(null);

  let loading = $state(true);
  let users = $state([]);
  let searchQuery = $state('');
  let actionError = $state('');

  onMount(async () => {
    await loadUsers();
  });

  async function loadUsers() {
    loading = true;
    try {
      const res = await adminApi.users.list({ q: searchQuery });
      users = res.users || [];
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function toggleBan(user) {
    const isBanned = user.is_banned == 1;
    try {
      if (isBanned) {
        await adminApi.users.unban(user.id);
        user.is_banned = 0;
        user.is_active = 1;
      } else {
        await adminApi.users.ban(user.id);
        user.is_banned = 1;
        user.is_active = 0;
      }
      users = [...users]; // trigger reactivity
    } catch (e) {
      console.error(e);
      actionError = 'Error cambiando estado de usuario';
      setTimeout(() => actionError = '', 4000);
    }
  }

  async function changeUserRole(user, newVal) {
    if (user.id === 1) return; // Proteger al admin principal
    const oldRole = user.effective_role;
    user.effective_role = newVal; // Optimistic update
    user.role = newVal;
    users = [...users];
    
    try {
      await adminApi.users.update(user.id, { role: newVal });
    } catch (e) {
      console.error(e);
      user.effective_role = oldRole;
      user.role = oldRole;
      users = [...users];
      actionError = 'Error al cambiar rol';
      setTimeout(() => actionError = '', 4000);
    }
  }

  function toggleMenu(id) {
    if (activeMenuId === id) activeMenuId = null;
    else activeMenuId = id;
  }

  function handleWindowClick(e) {
    if (!e.target.closest('.action-menu-container')) {
      activeMenuId = null;
    }
  }

  async function verifyUser(user) {
    activeMenuId = null;
    const isVerified = user.is_verified == 1;
    user.is_verified = isVerified ? 0 : 1;
    users = [...users];
    try {
      await adminApi.users.update(user.id, { is_verified: user.is_verified });
    } catch(e) {
      console.error(e);
      user.is_verified = isVerified ? 1 : 0;
      users = [...users];
      actionError = 'Error verificando usuario';
      setTimeout(() => actionError = '', 4000);
    }
  }

  async function deleteUser(user) {
    activeMenuId = null;
    if(!confirm(`¿Estás seguro de que deseas eliminar permanentemente a @${user.username}? Esta acción purgará sus datos de la base de datos.`)) return;
    try {
      await adminApi.users.delete(user.id);
      users = users.filter(u => u.id !== user.id);
    } catch(e) {
      console.error(e);
      actionError = 'Error al eliminar usuario';
      setTimeout(() => actionError = '', 4000);
    }
  }

  async function toggleDisable(user) {
    activeMenuId = null;
    const isActivating = user.is_active == 0;
    try {
      if (isActivating) {
        await adminApi.users.enable(user.id);
      } else {
        await adminApi.users.disable(user.id);
      }
      user.is_active = isActivating ? 1 : 0;
      users = [...users];
    } catch(e) {
      console.error(e);
      actionError = `Error al ${isActivating ? 'habilitar' : 'deshabilitar'} usuario`;
      setTimeout(() => actionError = '', 4000);
    }
  }

  let searchTimeout;
  function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadUsers();
    }, 500);
  }
</script>

<svelte:head>
  <title>Usuarios | VSocial Admin</title>
</svelte:head>

<svelte:window onclick={handleWindowClick} />

<div class="page-header">
  <div class="header-left">
    <h1 class="page-title">Usuarios</h1>
    <p class="page-subtitle">Gestiona las cuentas de la plataforma</p>
  </div>
  <div class="header-right">
    <div class="search-box">
      <span class="material-icons-round">search</span>
      <input type="text" placeholder="Buscar usuario..." bind:value={searchQuery} oninput={handleSearchInput} class="aero-input" />
    </div>
  </div>
</div>

<div class="page-content">
  {#if actionError}
    <div class="glass-panel p-4 mb-6 flex items-center gap-2 text-sm rounded-lg" style="background: rgba(232, 74, 114, 0.1); border-color: rgba(232, 74, 114, 0.2); color: var(--aero-rose);">
      <span class="material-icons-round text-[18px]">error_outline</span>
      {actionError}
    </div>
  {/if}

  <div class="glass-card table-card">
    {#if loading && users.length === 0}
      <div class="loader-container">
        <span class="loading loading-spinner text-primary"></span>
      </div>
    {:else}
      <div class="table-responsive">
        <table class="aero-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Fecha de Ingreso</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each users as user}
              <tr>
                <td>
                  <div class="user-cell">
                    <div class="user-avatar-mini">
                      {#if user.avatar_url}
                        <img src={user.avatar_url} alt={user.username} />
                      {:else}
                        <span>{(user.display_name || user.username)[0].toUpperCase()}</span>
                      {/if}
                    </div>
                    <div class="user-details">
                      <p class="user-name">{user.display_name || user.username} {#if user.is_verified == 1}<span class="material-icons-round verified-icon">verified</span>{/if}</p>
                      <p class="user-handle">@{user.username}</p>
                    </div>
                  </div>
                </td>
                <td>
                  {#if user.id === 1}
                    <span class="badge badge-outline">super_admin</span>
                  {:else}
                    <div style="width: 140px;">
                      <CustomSelect 
                        bind:value={user.effective_role}
                        options={[
                          {value: 'user', label: 'User'},
                          {value: 'team', label: 'Team'},
                          {value: 'moderator', label: 'Moderator'},
                          {value: 'admin', label: 'Admin'}
                        ]}
                        onchange={(val) => changeUserRole(user, val)}
                      />
                    </div>
                  {/if}
                </td>
                <td>
                  <span class="status-badge" class:active={user.is_banned == 0 && user.is_active == 1}>
                    {user.is_banned == 1 ? 'Baneado' : (user.is_active == 1 ? 'Activo' : 'Inactivo')}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td class="text-right">
                  {#if user.id !== 1}
                    <div class="action-menu-container" style="position: relative; display: inline-block;">
                      <button class="btn-icon" onclick={() => toggleMenu(user.id)}>
                        <span class="material-icons-round">more_vert</span>
                      </button>
                      
                      {#if activeMenuId === user.id}
                        <div class="glass-menu action-dropdown">
                          <button class="menu-item" onclick={() => toggleBan(user)}>
                            <span class="material-icons-round text-[18px]">{user.is_banned == 1 ? 'how_to_reg' : 'block'}</span>
                            {user.is_banned == 1 ? 'Desbanear' : 'Banear'}
                          </button>
                          {#if user.is_banned == 0}
                            <button class="menu-item" onclick={() => toggleDisable(user)}>
                              <span class="material-icons-round text-[18px]">{user.is_active == 0 ? 'visibility' : 'visibility_off'}</span>
                              {user.is_active == 0 ? 'Habilitar Perfil' : 'Deshabilitar Perfil'}
                            </button>
                          {/if}
                          <button class="menu-item" onclick={() => verifyUser(user)}>
                            <span class="material-icons-round text-[18px] text-blue-500">{user.is_verified == 1 ? 'remove_circle_outline' : 'verified'}</span>
                            {user.is_verified == 1 ? 'Quitar Verificación' : 'Verificar'}
                          </button>
                          <div class="menu-divider"></div>
                          <button class="menu-item text-error" onclick={() => deleteUser(user)}>
                            <span class="material-icons-round text-[18px]">delete_forever</span>
                            Eliminar Cuenta
                          </button>
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <span class="badge badge-outline" style="opacity: 0.5">Protegido</span>
                  {/if}
                </td>
              </tr>
            {/each}
            {#if users.length === 0}
              <tr>
                <td colspan="5" class="empty-row">No se encontraron usuarios</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .page-header {
    padding: 32px;
    background: linear-gradient(180deg, rgba(46,134,232,0.03) 0%, transparent 100%);
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .page-title {
    font-size: 1.8rem;
    font-family: var(--font-display);
    font-weight: 800;
    color: var(--text-primary);
    margin: 0;
  }
  .page-subtitle {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin: 4px 0 0;
  }
  
  .search-box {
    position: relative;
    width: 280px;
  }
  .search-box .material-icons-round {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 20px;
  }
  .search-box input {
    width: 100%;
    padding-left: 40px;
  }

  .page-content {
    padding: 32px;
  }
  
  .table-card {
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .table-responsive {
    overflow-x: auto;
  }
  
  .aero-table {
    width: 100%;
    border-collapse: collapse;
  }
  .aero-table th {
    text-align: left;
    padding: 16px 24px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border-subtle);
  }
  .aero-table td {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-subtle);
    vertical-align: middle;
  }
  .aero-table tr:last-child td { border-bottom: none; }
  .aero-table tr:hover td { background: rgba(255,255,255,0.02); }

  .text-right { text-align: right !important; }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .user-avatar-mini {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--grad-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    overflow: hidden;
  }
  .user-avatar-mini img { width: 100%; height: 100%; object-fit: cover; }
  .user-name {
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .verified-icon { font-size: 14px; color: var(--aero-sky); }
  .user-handle {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 0;
  }

  .badge-outline {
    border: 1px solid var(--border-glass);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.7rem;
    text-transform: uppercase;
    font-weight: 700;
  }
  
  .status-badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    background: rgba(232, 74, 114, 0.1);
    color: var(--aero-rose);
  }
  .status-badge.active {
    background: rgba(46, 204, 113, 0.15);
    color: #2ecc71;
    border-color: rgba(46, 204, 113, 0.3);
  }

  .btn-icon {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .btn-icon:hover {
    background: rgba(255,255,255,0.1);
    color: var(--text-primary);
  }

  .action-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    width: 200px;
    z-index: 50;
    border-radius: var(--radius-md);
    background: var(--glass-surface);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    box-shadow: var(--depth-3);
    padding: 8px;
    text-align: left;
    animation: fadeInScale 0.2s var(--ease-spring);
    transform-origin: top right;
  }

  @keyframes fadeInScale {
    0% { opacity: 0; transform: scale(0.95); }
    100% { opacity: 1; transform: scale(1); }
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 0.9rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }
  .menu-item:hover {
    background: rgba(255,255,255,0.08);
  }
  .menu-item.text-error {
    color: var(--aero-rose);
  }
  .menu-item.text-error:hover {
    background: rgba(232, 74, 114, 0.1);
  }
  
  .menu-divider {
    height: 1px;
    background: rgba(255,255,255,0.1);
    margin: 4px 0;
  }

  .btn-sm { padding: 6px 12px; font-size: 0.8rem; }
  
  .empty-row { text-align: center; color: var(--text-muted); padding: 32px !important; }
  .loader-container { padding: 64px; text-align: center; }
</style>
