<script>
  /**
   * PasswordMeter — Entropy evaluator with reactive strength bar
   * Svelte 5 Runes · Zero dependencies
   */
  let { password = $bindable(''), label = 'Seguridad' } = $props();

  const checks = $derived({
    length8: password.length >= 8,
    length12: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^a-zA-Z0-9\s]/.test(password),
    noRepeat: !/(.)\1{2,}/.test(password)
  });

  const score = $derived(
    (checks.length8 ? 15 : 0) +
    (checks.length12 ? 15 : 0) +
    (checks.upper ? 15 : 0) +
    (checks.lower ? 10 : 0) +
    (checks.digit ? 15 : 0) +
    (checks.symbol ? 20 : 0) +
    (checks.noRepeat ? 10 : 0)
  );

  const strength = $derived(
    score >= 85 ? { label: 'Excelente', color: '#00E676', glow: 'rgba(0,230,118,0.4)' } :
    score >= 65 ? { label: 'Fuerte',    color: '#69F0AE', glow: 'rgba(105,240,174,0.3)' } :
    score >= 45 ? { label: 'Media',     color: '#FFD740', glow: 'rgba(255,215,64,0.3)' } :
    score >= 25 ? { label: 'Débil',     color: '#FF9100', glow: 'rgba(255,145,0,0.3)' } :
                  { label: 'Muy débil', color: '#FF1744', glow: 'rgba(255,23,68,0.3)' }
  );
</script>

<div class="meter-root">
  <div class="meter-header">
    <span class="meter-label">{label}</span>
    {#if password.length > 0}
      <span class="meter-value" style="color: {strength.color}">{strength.label}</span>
    {/if}
  </div>

  <div class="meter-track">
    <div
      class="meter-fill"
      style="
        width: {password.length > 0 ? Math.min(score, 100) : 0}%;
        background: {strength.color};
        box-shadow: 0 0 10px {strength.glow}, 0 2px 6px {strength.glow};
      "
    ></div>
  </div>

  {#if password.length > 0 && password.length < 8}
    <p class="meter-hint">Mínimo 8 caracteres para una contraseña segura.</p>
  {/if}
</div>

<style>
  .meter-root {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .meter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .meter-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .meter-value {
    font-size: 0.72rem;
    font-weight: 800;
    transition: color 0.4s ease;
  }

  .meter-track {
    height: 5px;
    border-radius: 9999px;
    background: var(--border-subtle);
    overflow: hidden;
    position: relative;
  }

  .meter-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                background 0.4s ease,
                box-shadow 0.4s ease;
    position: relative;
  }

  .meter-fill::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 50%;
    background: linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%);
    border-radius: 9999px 9999px 0 0;
    pointer-events: none;
  }

  .meter-hint {
    font-size: 0.65rem;
    color: var(--text-muted);
    margin: 0;
    font-weight: 600;
  }
</style>
