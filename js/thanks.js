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
      if (!result || !result.ok) throw new Error('記録できませんでした。');
    } catch (_) {
      status.textContent = '訪問記録を保存できませんでした。通信環境をご確認ください。';
      retry.hidden = false;
    } finally {
      pending = false;
    }
  }
  retry.addEventListener('click', recordVisit);
  recordVisit();
})();
