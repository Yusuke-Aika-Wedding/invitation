(() => {
  'use strict';
  const access = window.WeddingAccess;
  const visit = access.currentVisit() || access.createVisit('thanks');
  const site = document.getElementById('specialThanks');
  const achievement = document.getElementById('puzzleAchievement');
  document.getElementById('changeGuestId').addEventListener('click', access.changeId);
  let pending = false;
  let timer;
  let revealed = false;
  async function recordVisit() {
    if (pending) return;
    pending = true;
    window.clearTimeout(timer);
    try {
      const result = await access.checkThanks(visit);
      if (result?.needsGuestId) {
        visit.guestId = '';
        access.returnToEntry(visit);
        return;
      }
      if (!result || !result.ok || !Number.isSafeInteger(result.rank) || result.rank < 1) {
        throw new Error('順位を確認できませんでした。');
      }
      // サーバーが公開を許可するまでは感謝本文を表示しない。
      if (result.published !== true) {
        site.hidden = true;
        access.returnToEntry(visit);
        return;
      } else {
        site.hidden = false;
        document.getElementById('puzzleRank').textContent = String(result.rank);
        document.getElementById('puzzleHintAchievement').textContent = window.WeddingHints.clearLabel(result.hintCount);
        document.getElementById('earlySolveMessage').hidden = !result.earlySolved;
        achievement.hidden = false;
        if (!revealed) {
          document.querySelectorAll('.thanks-reveal').forEach((line, index) => {
            line.style.setProperty('--reveal-delay', `${line.classList.contains('thanks-signature') ? 5.8 : index * 0.65}s`);
            line.classList.add('is-revealing');
          });
          achievement.style.setProperty('--reveal-delay', '4.9s');
          achievement.classList.add('is-revealing');
          revealed = true;
        }
      }
      const untilRelease = Date.parse(result.releaseAt) - Date.parse(result.serverTime);
      timer = window.setTimeout(recordVisit, untilRelease > 0 ? Math.min(30000, untilRelease + 100) : 30000);
    } catch (_) {
      site.hidden = true;
      access.returnToEntry(visit);
    } finally {
      pending = false;
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recordVisit(); });
  if (!visit.guestId) access.returnToEntry(visit);
  else recordVisit();
})();
