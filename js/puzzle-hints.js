(() => {
  'use strict';
  const ordinal = value => {
    const n = Number(value), tail = n % 100;
    return `${n}${tail >= 11 && tail <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
  };
  const clearLabel = count => Number(count) > 0 ? `${Number(count)}-Hint Clear!` : 'No-Hint Clear!';
  let mounted = false;
  function mount(section, guestId) {
    if (mounted) return;
    mounted = true;
    const host = document.getElementById('puzzleHints');
    const disclosure = document.createElement('details');
    disclosure.className = 'puzzle-hints';
    const summary = document.createElement('summary');
    summary.textContent = 'ヒントを見る';
    const list = document.createElement('div');
    list.className = 'puzzle-hint-list';
    const status = document.createElement('p');
    status.className = 'puzzle-hint-status';
    status.setAttribute('role', 'status');
    let state, syncedAt, pending = false, started = false;
    const items = Array.from({ length: 5 }, (_, index) => {
      const number = index + 1;
      const item = document.createElement('div');
      item.className = 'puzzle-hint-item';
      const button = document.createElement('button');
      button.type = 'button';
      button.disabled = true;
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', `puzzle-hint-${number}`);
      const label = document.createElement('span');
      label.textContent = `ヒント${number}`;
      const countdown = document.createElement('span');
      countdown.className = 'puzzle-hint-countdown number-font';
      countdown.textContent = '時間を確認中…';
      button.append(label, countdown);
      const panel = document.createElement('div');
      panel.id = `puzzle-hint-${number}`;
      panel.className = 'puzzle-hint-dialogue';
      panel.hidden = true;
      button.addEventListener('click', async () => {
        if (button.disabled || pending) return;
        if (!panel.hidden) { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); return; }
        if (!state?.opened.includes(number) && !await sync(number)) return;
        const hint = state.hints.find(h => h.number === number);
        if (!hint) return;
        if (!panel.childElementCount) {
          const portraits = document.createElement('div');
          portraits.className = 'puzzle-hint-portraits' + (number === 5 ? ' is-couple' : '');
          const people = number === 5 ? ['teacher', 'girl'] : [number % 2 ? 'teacher' : 'girl'];
          people.forEach(person => {
            const img = document.createElement('img');
            img.src = `assets/hint-${person}.png`;
            img.alt = person === 'teacher' ? '某数学教師' : '某謎解き大好き少女';
            img.width = 1122; img.height = 1402;
            portraits.append(img);
          });
          const speech = document.createElement('p');
          // サーバーの本文を保ったまま、意味の区切りで折り返せるようにします。
          const readable = hint.text
            .replace('文字列、どこか', '文字列、\nどこか')
            .replace('3つずつに区切ると', '3つずつに\n区切ると')
            .replace('A → 10, B → 11, C → 12, ... , I → 18', 'A → 10, B → 11,\nC → 12, ... , I → 18')
            .replace('16進法... いや、G, H, Iが含まれている人も\nいるみたいだから19進法の考え方だね。', '16進法... いや、\nG, H, Iが含まれている人も\nいるみたいだから\n19進法の考え方だね。')
            .replace('　「ab2」', '\n「ab2」')
            .replace('文字列をそのまま', '文字列を\nそのまま');
          readable.split('\n').forEach((line, index) => {
            if (index) speech.append(document.createElement('br'));
            const chunk = document.createElement('span');
            chunk.className = 'puzzle-hint-phrase';
            chunk.textContent = line;
            speech.append(chunk);
          });
          panel.append(portraits, speech);
        }
        panel.hidden = false;
        button.setAttribute('aria-expanded', 'true');
      });
      item.append(button, panel); list.append(item);
      return { number, button, countdown };
    });
    function update() {
      if (!state) return;
      const elapsed = Date.parse(state.serverTime) + performance.now() - syncedAt - Date.parse(state.firstSeen);
      items.forEach(({ number, button, countdown }) => {
        const remaining = Math.max(0, Math.ceil((number * 300000 - elapsed) / 1000));
        button.disabled = pending || remaining > 0;
        countdown.textContent = remaining ? `あと ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}` : state.opened.includes(number) ? '閲覧済み' : '開く';
      });
    }
    async function sync(hint) {
      if (pending) return false;
      pending = true; update();
      status.textContent = hint ? 'ヒントを開いています…' : '時間を確認しています…';
      try {
        const result = await window.WeddingAccess.request('puzzleHints', { guestId, hint });
        if (!result?.ok) throw new Error(result?.error || '時間を確認できませんでした。');
        state = result; syncedAt = performance.now();
        status.textContent = '';
        return true;
      } catch (error) {
        status.textContent = `${error.message} 「ヒントを見る」を開き直すと再確認できます。`;
        return false;
      } finally { pending = false; update(); }
    }
    disclosure.append(summary, status, list); host.append(disclosure);
    disclosure.addEventListener('toggle', () => { if (disclosure.open && started) sync(); });
    const start = () => {
      if (started || document.hidden || section.classList.contains('is-hidden')) return;
      started = true;
      sync();
      window.setInterval(() => { if (!document.hidden) update(); }, 1000);
    };
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting) && !document.hidden) { start(); if (started) observer.disconnect(); }
      });
      observer.observe(document.getElementById('last-puzzle-title'));
    } else start();
    document.addEventListener('visibilitychange', () => { if (!document.hidden && started) sync(); });
  }
  window.WeddingHints = { mount, ordinal, clearLabel };
})();
