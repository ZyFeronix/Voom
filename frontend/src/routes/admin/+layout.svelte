<script>
  import '../../routes/layout.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte.js';
  import { fade } from 'svelte/transition';

  let { children } = $props();

  let ready = $state(authStore.isAuthenticated && authStore.isAdmin);

  // Sub-routes for admin navigation
  const adminNav = [
    { href: '/admin', icon: 'dashboard', label: 'Dashboard', exact: true },
    { href: '/admin/users', icon: 'people', label: 'Usuarios' },
    { href: '/admin/content', icon: 'grid_view', label: 'Contenido' },
    { href: '/admin/reports', icon: 'flag', label: 'Reportes' },
    { href: '/admin/settings', icon: 'tune', label: 'Sistema' },
    { href: '/admin/apis', icon: 'api', label: 'APIs & Integraciones' },
  ];

  function isActive(href, exact = false) {
    if (exact) return page.url.pathname === href;
    return page.url.pathname.startsWith(href);
  }

  onMount(async () => {
    if (!ready) {
      await authStore.initialize();
      if (!authStore.isAuthenticated || !authStore.isAdmin) {
        goto('/feed');
        return;
      }
      ready = true;
    }
  });
</script>

{#if !ready}
  <!-- Loading state -->
  <div class="admin-boot">
    <div class="admin-boot-inner">
      <div class="admin-boot-logo">
        <span class="material-icons-round">admin_panel_settings</span>
      </div>
      <p>Cargando panel...</p>
    </div>
  </div>
{:else}
  <div class="admin-shell">

    <!-- ── Admin Sidebar ──────────────────────────────── -->
    <aside class="admin-aside">
      <!-- Logo + Back link -->
      <div class="aside-header">
        <a href="/feed" class="aside-back-link" title="Volver a la plataforma">
          <span class="material-icons-round">arrow_back</span>
        </a>
        <div class="aside-logo">
          <div class="aside-logo-icon">
            <span class="material-icons-round">admin_panel_settings</span>
          </div>
          <div class="aside-logo-text">
            <span class="aside-logo-title">VSocial</span>
            <span class="aside-logo-sub">Centro de Control</span>
          </div>
        </div>
      </div>

      <!-- Nav -->
      <nav class="aside-nav">
        {#each adminNav as item}
          <a
            href={item.href}
            class="aside-nav-link"
            class:active={isActive(item.href, item.exact)}
          >
            <span class="material-icons-round aside-nav-icon">{item.icon}</span>
            <span class="aside-nav-label">{item.label}</span>
            {#if isActive(item.href, item.exact)}
              <span class="aside-nav-pip"></span>
            {/if}
          </a>
        {/each}
      </nav>

      <!-- User card -->
      <div class="aside-footer">
        {#if authStore.user}
          <div class="aside-user">
            <div class="aside-user-avatar">
              {#if authStore.user.avatar_url}
                <img src={authStore.user.avatar_url} alt={authStore.user.username} />
              {:else}
                <span>{(authStore.user.display_name || authStore.user.username || '?')[0].toUpperCase()}</span>
              {/if}
            </div>
            <div class="aside-user-info">
              <p class="aside-user-name">{authStore.user.display_name || authStore.user.username}</p>
              <p class="aside-user-role">Administrador</p>
            </div>
            <div class="aside-user-badge">
              <span class="material-icons-round">verified</span>
            </div>
          </div>
        {/if}
      </div>
    </aside>

    <!-- ── Admin Main ──────────────────────────────────── -->
    <main class="admin-main">
      {@render children()}
    </main>

  </div>
{/if}

<style>
  /* ── Shell ──────────────────────────────────────────── */
  .admin-shell {
    display: flex;
    min-height: 100vh;
    background: var(--bg-canvas);
    font-family: var(--font-sans);
  }

  /* ── Boot Screen ───────────────────────────────────── */
  .admin-boot {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-canvas);
  }
  .admin-boot-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .admin-boot-logo {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: var(--grad-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    box-shadow: 0 8px 24px rgba(46, 134, 232, 0.35);
    animation: pulse-boot 1.2s ease-in-out infinite;
  }
  @keyframes pulse-boot {
    0%, 100% { transform: scale(1); box-shadow: 0 8px 24px rgba(46,134,232,0.35); }
    50%       { transform: scale(1.08); box-shadow: 0 12px 32px rgba(46,134,232,0.50); }
  }
  .admin-boot-inner p {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  /* ── Sidebar ───────────────────────────────────────── */
  .admin-aside {
    width: 248px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--glass-bg);
    backdrop-filter: blur(28px) saturate(1.6);
    -webkit-backdrop-filter: blur(28px) saturate(1.6);
    border-right: 1px solid var(--glass-border);
    box-shadow: 2px 0 24px rgba(46, 134, 232, 0.07);
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    scrollbar-width: none;
    padding: 20px 12px 16px;
    gap: 4px;
  }
  .admin-aside::-webkit-scrollbar { display: none; }

  /* Header */
  .aside-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
    padding: 0 4px;
  }

  .aside-back-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    background: var(--bg-overlay);
    border: 1px solid var(--glass-border);
    text-decoration: none;
    flex-shrink: 0;
    transition: all var(--t-base);
  }
  .aside-back-link .material-icons-round { font-size: 16px; }
  .aside-back-link:hover {
    background: var(--grad-primary);
    color: #fff;
    border-color: transparent;
    transform: translateX(-2px);
  }

  .aside-logo {
    display: flex;
    align-items: center;
    gap: 9px;
    flex: 1;
    min-width: 0;
  }
  .aside-logo-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: var(--grad-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(46,134,232,0.30), inset 0 1px 0 rgba(255,255,255,0.35);
  }
  .aside-logo-icon .material-icons-round { font-size: 17px; }
  .aside-logo-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .aside-logo-title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.98rem;
    background: var(--grad-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .aside-logo-sub {
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    line-height: 1;
  }

  /* Nav */
  .aside-nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .aside-nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    text-decoration: none;
    font-weight: 500;
    font-size: 0.88rem;
    border: 1px solid transparent;
    position: relative;
    overflow: hidden;
    transition: background var(--t-base), color var(--t-base), border-color var(--t-base), box-shadow var(--t-base), transform var(--t-spring);
  }
  .aside-nav-icon {
    font-size: 19px;
    flex-shrink: 0;
    transition: transform var(--t-spring);
  }
  .aside-nav-label { flex: 1; }

  .aside-nav-link:hover {
    background: var(--bg-overlay);
    color: var(--aero-blue);
    border-color: var(--glass-border);
    box-shadow: var(--shadow-xs), var(--glass-inset);
  }
  .aside-nav-link:hover .aside-nav-icon {
    transform: scale(1.12) translateX(1px);
  }

  .aside-nav-link.active {
    background: var(--grad-primary);
    color: #fff;
    border-color: rgba(255,255,255,0.22);
    box-shadow: 0 4px 14px rgba(46,134,232,0.28), var(--glass-inset);
    font-weight: 600;
  }
  .aside-nav-link.active .aside-nav-icon {
    transform: scale(1.05);
  }
  /* Glossy highlight on active */
  .aside-nav-link.active::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 45%;
    background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    pointer-events: none;
  }

  .aside-nav-pip {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.75);
    flex-shrink: 0;
  }

  /* Footer / User Card */
  .aside-footer {
    border-top: 1px solid var(--border-subtle);
    padding-top: 12px;
    margin-top: 8px;
  }
  .aside-user {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 10px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-xs), var(--glass-inset);
  }
  .aside-user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--grad-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 0.82rem;
    border: 2px solid rgba(255,255,255,0.5);
  }
  .aside-user-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .aside-user-info { flex: 1; min-width: 0; }
  .aside-user-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
  }
  .aside-user-role {
    font-size: 0.66rem;
    color: var(--aero-sky);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0;
  }
  .aside-user-badge .material-icons-round {
    font-size: 16px;
    color: var(--aero-sky);
  }

  /* ── Main Content ──────────────────────────────────── */
  .admin-main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    min-height: 100vh;
  }

  /* ── Responsive ────────────────────────────────────── */
  @media (max-width: 768px) {
    .admin-aside { display: none; }
  }
</style>
