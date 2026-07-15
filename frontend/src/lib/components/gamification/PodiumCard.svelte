<script>
  import LevelBadge from './LevelBadge.svelte';
  
  let { user, rank, type = 'level' } = $props();

  const rankData = {
    1: { 
      color: 'var(--aero-gold, #FBBF24)', 
      glow: 'rgba(251, 191, 36, 0.4)', 
      icon: 'emoji_events', 
      h: '280px',
      w: '160px',
      tSize: '54px'
    },
    2: { 
      color: 'var(--aero-silver, #E2E8F0)', 
      glow: 'rgba(226, 232, 240, 0.3)', 
      icon: 'workspace_premium', 
      h: '240px',
      w: '145px',
      tSize: '42px'
    },
    3: { 
      color: 'var(--aero-bronze, #F97316)', 
      glow: 'rgba(249, 115, 22, 0.3)', 
      icon: 'workspace_premium', 
      h: '240px',
      w: '145px',
      tSize: '42px'
    }
  };
  
  let rData = $derived(rankData[rank] || rankData[3]);
  let initial = $derived((user.display_name || user.username || '?').charAt(0).toUpperCase());
</script>

<div class="podium-card group {rank === 1 ? 'is-first' : ''}" style="--rank-color: {rData.color}; --rank-glow: {rData.glow}; --card-h: {rData.h}; --card-w: {rData.w}; --t-size: {rData.tSize};">
  
  <!-- Aura light behind the card -->
  <div class="aura-glow"></div>

  <!-- Main Card Body -->
  <div class="card-glass">
    
    <!-- Avatar Section (Overlapping top border) -->
    <div class="avatar-section">
      <!-- Floating Trophy perfectly anchored to the avatar -->
      <div class="floating-trophy">
        <span class="material-icons-round trophy-icon">{rData.icon}</span>
      </div>

      <div class="avatar-ring">
        {#if user.avatar_url}
          <img src={user.avatar_url} alt={user.display_name} class="avatar-img" />
        {:else}
          <div class="vs-avatar-letter w-full h-full flex items-center justify-center rounded-full" style="width: 100% !important; height: 100% !important; font-size: {rank === 1 ? '2.5rem' : '1.8rem'} !important; line-height: 1 !important; padding: 0 !important; margin: 0 !important;">{initial}</div>
        {/if}
      </div>
    </div>

    <!-- Rank Number -->
    <div class="rank-number">#{rank}</div>

    <!-- User Info -->
    <div class="user-info">
      <a href="/u/{user.username}" class="user-name truncate" title={user.display_name}>
        {user.display_name}
      </a>
      <span class="user-handle truncate">@{user.username}</span>
    </div>

    <!-- Stats -->
    <div class="stats-box w-full mt-auto">
      {#if type === 'level'}
        <div class="flex items-center justify-between w-full px-3 py-2">
          <LevelBadge level={user.level || 1} />
          <span class="text-xs font-mono font-bold text-[var(--glass-highlight)]">{user.xp_points || 0} XP</span>
        </div>
      {:else}
        <div class="flex items-center justify-center gap-1.5 w-full py-2">
          <span class="material-icons-round text-orange-500 text-[14px]">local_fire_department</span>
          <span class="text-orange-400 font-bold text-sm" style="text-shadow: 0 0 5px rgba(249,115,22,0.5)">{user.checkin_streak || 0}</span>
          <span class="text-[10px] uppercase tracking-widest text-white/50 font-bold">Días</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .podium-card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: var(--card-w);
    height: var(--card-h);
    transition: all 0.4s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
    z-index: 10;
  }
  
  .podium-card:hover {
    z-index: 40;
    transform: translateY(-8px);
  }

  /* The glowing light behind the card */
  .aura-glow {
    position: absolute;
    inset: 20px;
    top: 40px;
    background: var(--rank-color);
    filter: blur(25px);
    opacity: 0.15;
    z-index: 0;
    transition: opacity 0.4s;
    border-radius: 50%;
  }
  .podium-card:hover .aura-glow { opacity: 0.3; }

  /* Actual glass card. Uses platform native colors */
  .card-glass {
    position: relative;
    z-index: 10;
    width: 100%;
    height: 100%;
    background: var(--bg-surface);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-top: 3px solid var(--rank-color);
    border-radius: 20px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: var(--shadow-lg), 0 0 20px var(--rank-glow), inset 0 1px 1px rgba(255,255,255,0.1);
  }

  .card-glass::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 40%);
    pointer-events: none;
    border-radius: 20px;
  }

  .avatar-section {
    position: relative;
    z-index: 10;
    margin-top: -35px; /* Overlap the top border */
    margin-bottom: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .floating-trophy {
    position: absolute;
    top: -38px; /* Touch the top of the ring */
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    flex-direction: column;
    align-items: center;
    filter: drop-shadow(0 0 15px var(--rank-glow));
  }

  .is-first .floating-trophy {
    top: -48px; /* Touch the larger ring */
  }

  .trophy-icon {
    font-size: var(--t-size);
    color: var(--rank-color);
    line-height: 1;
  }

  .avatar-ring {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    padding: 3px;
    background: linear-gradient(135deg, var(--rank-color) 0%, rgba(255,255,255,0.15) 100%);
    box-shadow: 0 5px 15px rgba(0,0,0,0.4), inset 0 2px 4px rgba(0,0,0,0.5);
    transition: transform 0.3s;
  }
  .podium-card:hover .avatar-ring {
    transform: scale(1.05);
  }

  .is-first .avatar-ring {
    width: 86px;
    height: 86px;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    background: var(--bg-surface);
  }

  .rank-number {
    font-size: 1.8rem;
    font-weight: 900;
    color: var(--text-main);
    line-height: 1;
    margin-bottom: 8px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  }

  .is-first .rank-number {
    font-size: 2.2rem;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    margin-bottom: 12px;
    position: relative;
    z-index: 10;
  }

  .user-name {
    font-size: 1rem;
    font-weight: 800;
    color: var(--text-main);
    width: 90%;
    text-align: center;
    margin-bottom: 2px;
  }
  .is-first .user-name { font-size: 1.15rem; }
  
  .user-name:hover { color: var(--aero-blue); }

  .user-handle {
    font-size: 0.8rem;
    color: var(--text-muted);
    width: 90%;
    text-align: center;
  }

  .stats-box {
    background: rgba(0,0,0,0.2);
    border-radius: 12px;
    border: 1px solid var(--glass-border);
    position: relative;
    z-index: 10;
  }
</style>
