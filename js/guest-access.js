(() => {
  'use strict';
  const ACTIVE_ID = 'yusuke-aika-wedding-guest-id-v1';
  const SOURCE_ID = 'yusuke-aika-wedding-source-id-v1';
  const VISIT = 'yusuke-aika-wedding-thanks-visit-v1';
  const normalizeKeyword = value => String(value || '').replace(/\s+/g, '').toLowerCase();
  const isKeyword = value => ['thanks', 'thankyou', 'manythanks'].includes(normalizeKeyword(value));
  function rememberGuest(id) {
    try { sessionStorage.setItem(SOURCE_ID, id); } catch (_) {}
  }
  function sourceGuest() {
    try { return sessionStorage.getItem(SOURCE_ID) || localStorage.getItem(ACTIVE_ID) || ''; } catch (_) { return ''; }
  }
  function changeId() {
    try { localStorage.removeItem(ACTIVE_ID); sessionStorage.removeItem(VISIT); } catch (_) {}
    location.replace(new URL('./?change-id=1', location.href).href);
  }
  function saveVisit(visit) {
    try { sessionStorage.setItem(VISIT, JSON.stringify(visit)); } catch (_) {}
    return visit;
  }
  function createVisit(value) {
    return saveVisit({ keyword: normalizeKeyword(value), eventId: crypto.randomUUID(), guestId: sourceGuest() });
  }
  function currentVisit() {
    const parts = location.hash.slice(1).split('/');
    if (parts[0] === 'thanks-entry') parts.shift();
    const [keyword, eventId] = parts;
    if (!isKeyword(keyword) || !/^[a-zA-Z0-9-]{16,64}$/.test(eventId || '')) return null;
    let stored;
    try { stored = JSON.parse(sessionStorage.getItem(VISIT) || 'null'); } catch (_) {}
    // URLで渡された他人の訪問IDから、ゲストIDを推測しない。
    if (stored && stored.eventId === eventId) return { ...stored, keyword: normalizeKeyword(keyword) };
    return { keyword: normalizeKeyword(keyword), eventId, guestId: sourceGuest() };
  }
  function returnToEntry(visit) {
    saveVisit(visit);
    location.replace(new URL(`./?change-id=1#thanks-entry/${visit.keyword}/${visit.eventId}`, location.href).href);
  }
  async function checkThanks(visit) {
    let result = await request('recordThanksVisit', visit);
    if (result && result.retryWithNewEvent) {
      visit.eventId = crypto.randomUUID();
      saveVisit(visit);
      result = await request('recordThanksVisit', visit);
    }
    return result;
  }
  function openThanks(visit) {
    saveVisit(visit);
    location.assign(new URL(`thanks.html#${visit.keyword}/${visit.eventId}`, location.href).href);
  }
  function request(action, params = {}) {
    return new Promise((resolve, reject) => {
      let url;
      try {
        url = new URL(window.WEDDING_CONFIG.gasWebAppUrl);
      } catch (_) {
        reject(new Error('GASのWebアプリURLが正しくありません。'));
        return;
      }
      const callbackName = `__weddingJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      url.searchParams.set('action', action);
      url.searchParams.set('callback', callbackName);
      url.searchParams.set('_', String(Date.now()));
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      });

      const script = document.createElement('script');
      const timer = window.setTimeout(() => cleanup(new Error('通信がタイムアウトしました。')), 22000);
      window[callbackName] = data => cleanup(null, data);
      script.onerror = () => cleanup(new Error('GASと通信できませんでした。'));
      script.src = url.toString();
      document.body.appendChild(script);

      function cleanup(error, data) {
        window.clearTimeout(timer);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        if (error) reject(error);
        else resolve(data);
      }
    });
  }

  window.WeddingAccess = { rememberGuest, changeId, openThanks, currentVisit, request, isKeyword, createVisit, saveVisit, returnToEntry, checkThanks };
})();
