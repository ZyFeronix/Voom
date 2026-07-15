<script>
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import PodiumCard from '$lib/components/gamification/PodiumCard.svelte';
  import LevelBadge from '$lib/components/gamification/LevelBadge.svelte';
  import UserTitleBadge from '$lib/components/gamification/UserTitleBadge.svelte';

  let type = $state('level');
  let users = $state([]);
  let currentUserRank = $state(null);
  let currentUserData = $state(null);
  let loading = $state(true);

  async function fetchLeaderboard() {
    loading = true;
    try {
      const res = await fetch(`/api/gamification/leaderboard?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        users = data.users || [];
        currentUserRank = data.currentUserRank;
        currentUserData = data.currentUserData;
      }
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    fetchLeaderboard();
  });

  let top3 = $derived(users.slice(0, 3));
  let rest = $derived(users.slice(3));

  let podiumOrder = $derived([top3[1], top3[0], top3[2]].filter(Boolean));
  let getRank = (user) => top3.indexOf(user) + 1;
</script>

<div class="vs-container pb-32 min-h-[90vh] pt-8">

  <!-- Header -->
  <div class="text-center mb-10" in:fade={{ duration: 400 }}>
    <h1 class="text-4xl font-black text-[var(--text-main)] mb-2" style="text-shadow: 0 4px 20px rgba(27,133,243,0.3);">Salón de la Fama</h1>
    <p class="text-[var(--text-muted)]">Descubre a los usuarios más destacados de la plataforma</p>
  </div>

  <!-- Tabs (Aero Style) -->
  <div class="flex justify-center mb-8 relative z-20" in:fly={{ y: -20, duration: 400, delay: 100, easing: cubicOut }}>
    <div class="glass-panel p-1.5 rounded-full flex gap-1 shadow-md border border-[var(--glass-border)]">
      <button 
        class="tab-btn {type === 'level' ? 'active level' : ''}"
        onclick={() => type = 'level'}
      >
        <span class="material-icons-round text-[18px]">star</span>
        Niveles
      </button>
      <button 
        class="tab-btn {type === 'streak' ? 'active streak' : ''}"
        onclick={() => type = 'streak'}
      >
        <span class="material-icons-round text-[18px]">local_fire_department</span>
        Rachas
      </button>
    </div>
  </div>

  <style>
    .tab-btn {
      padding: 10px 32px;
      border-radius: 9999px;
      font-weight: 800;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
      color: var(--text-muted);
      background: transparent;
      border: 1px solid transparent;
    }

    .tab-btn:hover:not(.active) {
      color: var(--text-main);
      background: rgba(255,255,255,0.05);
    }

    .tab-btn.active.level {
      background: var(--aero-blue, #1b85f3);
      color: #fff;
      box-shadow: 0 4px 15px rgba(27,133,243,0.4);
      border-color: rgba(255,255,255,0.2);
    }
    .tab-btn.active.level .material-icons-round { color: #fde047; }

    .tab-btn.active.streak {
      background: #f97316;
      color: #fff;
      box-shadow: 0 4px 15px rgba(249,115,22,0.4);
      border-color: rgba(255,255,255,0.2);
    }
    .tab-btn.active.streak .material-icons-round { color: #fef08a; }
  </style>

  {#if loading}
    <div class="flex justify-center py-20 mt-20 relative z-10" in:fade>
      <div class="vs-spinner"></div>
    </div>
  {:else if users.length === 0}
    <div class="glass-panel text-center py-20 max-w-lg mx-auto rounded-3xl mt-20 mb-24 relative z-10 shadow-lg border border-[var(--glass-border)]" in:fade>
      <span class="material-icons-round text-5xl text-[var(--text-muted)] mb-3 opacity-50 block">emoji_events</span>
      <h3 class="text-xl font-bold text-[var(--text-main)]">Aún no hay registros</h3>
      <p class="text-sm text-[var(--text-muted)] mt-2">Sé el primero en aparecer en esta clasificación.</p>
    </div>
  {:else}
    
    <!-- Podium Section -->
    {#if top3.length > 0}
      <div class="podium-wrapper flex flex-row justify-center items-end relative z-10 mx-auto">
        {#each podiumOrder as user, idx}
          <div in:fly={{ y: 50, duration: 600, delay: 200 + (idx * 150), easing: cubicOut }} class="podium-item podium-{getRank(user)}">
            <PodiumCard {user} rank={getRank(user)} {type} />
          </div>
        {/each}
      </div>
    {/if}

    <!-- Leaderboard List -->
    {#if rest.length > 0}
      <div class="max-w-2xl mx-auto flex flex-col gap-2 mt-8">
        {#each rest as user, i}
          <a href="/u/{user.username}" 
             in:fly={{ y: 20, duration: 400, delay: 400 + (Math.min(i, 20) * 50), easing: cubicOut }}
             class="glass-panel p-4 rounded-xl flex items-center justify-between hover:-translate-y-1 transition-all group border border-transparent hover:border-[var(--glass-border)]"
             style={currentUserData && currentUserData.id === user.id ? 'border-color: var(--primary-color, #1b85f3); background: rgba(27, 133, 243, 0.1);' : ''}>
            
            <div class="flex items-center gap-4">
              <span class="text-xl font-black text-[var(--text-muted)] opacity-50 w-8 text-center group-hover:text-[var(--primary-color,#1b85f3)] group-hover:opacity-100 transition-colors"
                    style={currentUserData && currentUserData.id === user.id ? 'color: var(--primary-color, #1b85f3); opacity: 1;' : ''}>{i + 4}</span>
              
              {#if user.avatar_url}
                <img src={user.avatar_url} alt={user.display_name} class="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-[var(--glass-border)] group-hover:border-[var(--primary-color,#1b85f3)] transition-colors" 
                     style={currentUserData && currentUserData.id === user.id ? 'border-color: var(--primary-color, #1b85f3);' : ''} />
              {:else}
                <div class="vs-avatar-letter avatar-md w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-2 border-[var(--glass-border)] group-hover:border-[var(--primary-color,#1b85f3)] transition-colors" 
                     style="line-height: 1 !important; padding: 0 !important; margin: 0 !important; {currentUserData && currentUserData.id === user.id ? 'border-color: var(--primary-color, #1b85f3);' : ''}">
                  {(user.display_name || user.username || '?').charAt(0).toUpperCase()}
                </div>
              {/if}
              
              <div class="flex flex-col">
                <span class="font-bold text-[var(--text-main)] text-sm">{user.display_name}</span>
                {#if user.title_text}
                  <div class="mt-1"><UserTitleBadge title={user.title_text} color={user.title_color} size="sm" /></div>
                {:else}
                  <span class="text-xs text-[var(--text-muted)]">@{user.username}</span>
                {/if}
              </div>
            </div>
            
            <div class="flex flex-col items-end">
              {#if type === 'level'}
                <LevelBadge level={user.level || 1} size="sm" />
                <span class="text-[10px] text-[var(--text-muted)] font-mono font-bold mt-1">{user.xp_points || 0} XP</span>
              {:else}
                <div class="flex items-center gap-1 bg-[var(--glass-surface)] px-2 py-1 rounded-lg border border-[var(--glass-border)]">
                  <span class="material-icons-round text-[14px] text-orange-500">local_fire_department</span>
                  <span class="text-sm font-bold text-[var(--text-main)]">{user.checkin_streak || 0}</span>
                </div>
              {/if}
            </div>
            
          </a>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- Sticky Bottom Bar for Current User (if they are outside the top 50, or simply always visible if they are logged in and rank is known) -->
{#if !loading && currentUserData && currentUserRank}
  <div class="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 md:pb-8 pointer-events-none" in:fly={{ y: 100, duration: 600, delay: 800, easing: cubicOut }}>
    <div class="max-w-3xl mx-auto pointer-events-auto">
      <a href="/u/{currentUserData.username}" class="glass-panel p-4 rounded-2xl flex items-center justify-between transition-all group border-2 border-[var(--primary-color,#1b85f3)] shadow-[0_10px_30px_rgba(27,133,243,0.3)] bg-[var(--bg-panel)]" style="backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);">
        
        <div class="flex items-center gap-4">
          <div class="flex flex-col items-center justify-center w-10">
            <span class="text-xs uppercase font-bold text-[var(--primary-color,#1b85f3)] tracking-widest mb-0.5">Rango</span>
            <span class="text-2xl font-black text-[var(--text-main)]">#{currentUserRank}</span>
          </div>
          
          {#if currentUserData.avatar_url}
            <img src={currentUserData.avatar_url} alt={currentUserData.display_name} class="w-12 h-12 rounded-full object-cover border-2 border-[var(--glass-border)]" />
          {:else}
            <div class="vs-avatar-letter avatar-md w-12 h-12 rounded-full flex items-center justify-center border-2 border-[var(--glass-border)]" style="line-height: 1 !important; padding: 0 !important; margin: 0 !important;">
              {(currentUserData.display_name || currentUserData.username || '?').charAt(0).toUpperCase()}
            </div>
          {/if}
          
          <div class="flex flex-col">
            <span class="font-bold text-[var(--text-main)] text-sm">Tú ({currentUserData.display_name})</span>
            {#if currentUserData.title_text}
              <div class="mt-1"><UserTitleBadge title={currentUserData.title_text} color={currentUserData.title_color} size="sm" /></div>
            {:else}
              <span class="text-xs text-[var(--text-muted)]">@{currentUserData.username}</span>
            {/if}
          </div>
        </div>
        
        <div class="flex flex-col items-end">
          {#if type === 'level'}
            <LevelBadge level={currentUserData.level || 1} size="md" />
            <span class="text-[12px] text-[var(--primary-color,#1b85f3)] font-mono font-bold mt-1">{currentUserData.xp_points || 0} XP</span>
          {:else}
            <div class="flex items-center gap-1.5 bg-[var(--glass-surface)] px-3 py-1.5 rounded-lg border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
              <span class="material-icons-round text-[18px] text-orange-500">local_fire_department</span>
              <span class="text-base font-bold text-orange-400">{currentUserData.checkin_streak || 0}</span>
            </div>
          {/if}
        </div>
      </a>
    </div>
  </div>
{/if}

<style>
  .vs-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--glass-border);
    border-top-color: var(--primary-color, #1b85f3);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .podium-wrapper {
    gap: 12px;
    margin-top: 60px;
    padding-bottom: 40px;
  }

  @media (min-width: 768px) {
    .podium-wrapper {
      gap: 40px;
      margin-top: 80px;
      padding-bottom: 60px;
    }
  }

  @media (max-width: 500px) {
    .podium-wrapper {
      transform: scale(0.75);
      transform-origin: bottom center;
    }
  }
</style>
