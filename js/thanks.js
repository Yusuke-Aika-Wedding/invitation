(() => {
  'use strict';
  const access = window.WeddingAccess;
  const visit = access.currentVisit();
  if (!visit) {
    location.replace(new URL('./?change-id=1', location.href).href);
    return;
  }
  document.getElementById('specialThanks').hidden = false;
  document.getElementById('changeGuestId').addEventListener('click', access.changeId);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lines = document.querySelectorAll('.thanks-reveal');
  lines.forEach((line, index) => {
    line.style.setProperty('--reveal-delay', `${line.classList.contains('thanks-signature') ? 19.1 : index * 1.9}s`);
    line.classList.add('is-revealing');
  });
  const revealStarted = performance.now();
  const achievement = document.getElementById('puzzleAchievement');
  const rank = document.getElementById('puzzleRank');
  const status = document.getElementById('visitRecordStatus');
  const retry = document.getElementById('retryVisitRecord');
  let pending = false;
  async function recordVisit() {
    if (pending) return;
    pending = true;
    retry.hidden = true;
    status.textContent = '';
    try {
      const result = await access.request('recordThanksVisit', visit);
      if (!result || !result.ok || !Number.isSafeInteger(result.rank) || result.rank < 1) {
        throw new Error('順位を確認できませんでした。');
      }
      rank.textContent = String(result.rank);
      achievement.hidden = false;
      const remaining = Math.max(0, 17.2 - (performance.now() - revealStarted) / 1000);
      achievement.style.setProperty('--reveal-delay', `${reducedMotion ? 0 : remaining}s`);
      achievement.classList.add('is-revealing');
    } catch (_) {
      status.textContent = '解答順位を確認できませんでした。通信環境をご確認のうえ、もう一度お試しください。';
      retry.hidden = false;
    } finally {
      pending = false;
    }
  }
  retry.addEventListener('click', recordVisit);
  recordVisit();
})();
