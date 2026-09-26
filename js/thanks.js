(() => {
  'use strict';
  const access = window.WeddingAccess;
  const visit = access.currentVisit();
  if (!visit) {
    location.replace(new URL('./?change-id=1', location.href).href);
    return;
  }
  const site = document.getElementById('specialThanks');
  const gate = document.getElementById('thanksGate');
  const message = document.getElementById('thanksGateMessage');
  const achievement = document.getElementById('puzzleAchievement');
  const status = document.getElementById('visitRecordStatus');
  const retry = document.getElementById('retryVisitRecord');
  document.getElementById('changeGuestId').addEventListener('click', access.changeId);
  let pending = false;
  let timer;
  let revealed = false;
  async function recordVisit() {
    if (pending) return;
    pending = true;
    window.clearTimeout(timer);
    retry.hidden = true;
    status.textContent = '';
    try {
      const result = await access.request('recordThanksVisit', visit);
      if (!result || !result.ok || !Number.isSafeInteger(result.rank) || result.rank < 1) {
        throw new Error('順位を確認できませんでした。');
      }
      // サーバーが公開を許可するまでは感謝本文を表示しない。
      if (result.published !== true) {
        site.hidden = true;
        gate.hidden = false;
        revealed = false;
        message.textContent = '合言葉の入力と解答順を記録しました。来場感謝サイトは、結婚式終了後に公開されます。どうぞ楽しみにお待ちください。';
      } else {
        gate.hidden = true;
        site.hidden = false;
        document.getElementById('puzzleRank').textContent = String(result.rank);
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
      if (!revealed) {
        message.textContent = '公開状況を確認できませんでした。';
        status.textContent = '通信環境をご確認のうえ、もう一度お試しください。';
        retry.hidden = false;
      }
      timer = window.setTimeout(recordVisit, 30000);
    } finally {
      pending = false;
    }
  }
  retry.addEventListener('click', recordVisit);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recordVisit(); });
  recordVisit();
})();
