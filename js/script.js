(() => {
  'use strict';

  const config = window.WEDDING_CONFIG || {};
  const GUEST_ID_STORAGE_KEY = 'yusuke-aika-wedding-guest-id-v1';
  const targetDate = new Date(config.weddingDateIso || '2027-03-21T10:00:00+09:00');
  const els = {};
  let guestId = '';
  let latestStatus = { completed: false, attending: false };
  let currentSlide = 0;
  let authenticated = false;
  const QUIZ_QUESTION_COUNT = 5;
  const QUIZ_QUESTIONS = [
    { question: '新郎のフルネームは？', options: ['白戸 祐輔', '白戸 悠介', '白井 祐輔'], answer: '白戸 祐輔', explanation: '新郎は白戸祐輔（Yusuke Shirato）です。' },
    { question: '新婦のフルネームは？', options: ['大貫 愛佳', '大西 愛佳', '大貫 愛花'], answer: '大貫 愛佳', explanation: '新婦は大貫愛佳（Aika Onuki）です。' },
    { question: 'ふたりに共通する好きなことは？', options: ['野球観戦', '登山', '陶芸'], answer: '野球観戦', explanation: 'ふたりとも野球観戦が好き。プロフィール写真も球場で撮影した一枚です。' },
    { question: '野球観戦の写真で、ふたりが着ているユニフォームの球団は？', options: ['阪神タイガース', '読売ジャイアンツ', '東京ヤクルトスワローズ'], answer: '阪神タイガース', explanation: 'おそろいで阪神タイガースのユニフォームを着ています。' },
    { question: '結婚式の日付は？', options: ['2027年3月21日', '2027年2月21日', '2027年3月12日'], answer: '2027年3月21日', explanation: '結婚式は2027年3月21日に執り行います。' },
    { question: '結婚式当日の曜日は？', options: ['日曜日', '土曜日', '祝日の月曜日'], answer: '日曜日', explanation: '2027年3月21日は日曜日です。' },
    { question: '挙式のスタート時刻は？', options: ['10:00', '10:30', '11:00'], answer: '10:00', explanation: '挙式は10:00〜10:30を予定しています。' },
    { question: '披露宴のスタート時刻は？', options: ['11:00', '11:30', '12:00'], answer: '11:00', explanation: '披露宴は11:00〜14:00を予定しています。' },
    { question: '結婚式の会場はどこ？', options: ['キンプトン新宿東京', 'パレスホテル東京', 'ホテル椿山荘東京'], answer: 'キンプトン新宿東京', explanation: '会場はキンプトン新宿東京です。' },
    { question: '結婚式場があるエリアは？', options: ['新宿', '丸の内', '横浜'], answer: '新宿', explanation: '会場名の通り、新宿エリアにあります。' },
    { question: '東京タワーの前で撮影した写真に写っている大きな花束の色は？', options: ['赤', '白', '黄色'], answer: '赤', explanation: '鮮やかな赤いバラの花束が写っています。' },
    { question: '招待状のメインに書かれているふたりの名前の順番は？', options: ['Yusuke & Aika', 'Aika & Yusuke', 'Y & A Wedding'], answer: 'Yusuke & Aika', explanation: 'サイトでは「Yusuke & Aika」と表記しています。' },
    { question: '野球観戦の写真で、球場の座席は何色？', options: ['青', '赤', '緑'], answer: '青', explanation: 'ふたりの後ろには青いスタンド席が並んでいます。' },
    { question: 'プロフィールの顔写真は、どこで撮った写真から切り抜いている？', options: ['野球場', '東京タワー前', '海辺'], answer: '野球場', explanation: '野球観戦中の写真から、ふたりの表情をそれぞれ切り抜いています。' },
    { question: 'このクイズで1回に出題される問題数は？', options: ['5問', '3問', '10問'], answer: '5問', explanation: '問題リストの中から、毎回ランダムで5問が選ばれます。' },
    { question: '出欠フォームで回答するのはどの予定？', options: ['挙式と披露宴', '披露宴のみ', '二次会のみ'], answer: '挙式と披露宴', explanation: '挙式・披露宴それぞれについて出欠を回答できます。' },
    { question: 'トップの写真スライドに用意されている写真は何枚？', options: ['3枚', '2枚', '5枚'], answer: '3枚', explanation: '東京タワー、海辺、野球場の3枚が切り替わります。' },
    { question: '新郎新婦紹介ページの英語タイトルは？', options: ['About Us', 'Our Story', 'Meet the Family'], answer: 'About Us', explanation: 'プロフィールページのタイトルは「About Us」です。' }
  ];

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('resize', setViewportHeight, { passive: true });
  window.addEventListener('hashchange', applyRoute);

  function init() {
    cacheElements();
    setViewportHeight();
    setupAuth();
    setupOverlay();
    setupMenu();
    setupFadeIn();
    setupCountdown();
    setupCarousel();
    setupQuiz();
    setupAllergyFields();
    setupForm();
    createPetals();
  }

  function cacheElements() {
    Object.assign(els, {
      authOverlay: document.getElementById('authOverlay'),
      authForm: document.getElementById('authForm'),
      guestIdEntry: document.getElementById('guestIdEntry'),
      authButton: document.getElementById('authButton'),
      authStatus: document.getElementById('authStatus'),
      overlay: document.getElementById('messageOverlay'),
      messageGuestName: document.getElementById('messageGuestName'),
      messageBody: document.getElementById('messageBody'),
      form: document.getElementById('rsvpForm'),
      thanks: document.getElementById('thanksMessage'),
      formStatus: document.getElementById('formStatus'),
      submitButton: document.getElementById('submitButton'),
      guestIdInput: document.getElementById('guestId'),
      nameInput: document.getElementById('name'),
      emailInput: document.getElementById('email'),
      allergyDetailsField: document.getElementById('allergyDetailsField'),
      allergyDetailsInput: document.getElementById('allergyDetails'),
      guestMessageInput: document.getElementById('guestMessage'),
      days: document.getElementById('days'),
      hours: document.getElementById('hours'),
      minutes: document.getElementById('minutes'),
      seconds: document.getElementById('seconds'),
      menuButton: document.getElementById('menuButton'),
      menuPanel: document.getElementById('menuPanel'),
      menuGuestName: document.getElementById('menuGuestName'),
      changeIdButton: document.getElementById('changeIdButton'),
      invitationPage: document.getElementById('invitationPage'),
      profilePage: document.getElementById('profilePage'),
      quizStartButton: document.getElementById('quizStartButton'),
      quizPanel: document.getElementById('quizPanel'),
      quizPlayView: document.getElementById('quizPlayView'),
      quizResultView: document.getElementById('quizResultView'),
      quizCurrent: document.getElementById('quizCurrent'),
      quizProgressBar: document.getElementById('quizProgressBar'),
      quizQuestion: document.getElementById('quizQuestion'),
      quizOptions: document.getElementById('quizOptions'),
      quizFeedback: document.getElementById('quizFeedback'),
      quizFeedbackTitle: document.getElementById('quizFeedbackTitle'),
      quizExplanation: document.getElementById('quizExplanation'),
      quizNextButton: document.getElementById('quizNextButton'),
      quizScore: document.getElementById('quizScore'),
      quizResultTitle: document.getElementById('quizResultTitle'),
      quizResultMessage: document.getElementById('quizResultMessage'),
      quizRetryButton: document.getElementById('quizRetryButton')
    });
  }

  function setupAuth() {
    if (!els.authForm) return;

    els.authForm.addEventListener('submit', event => {
      event.preventDefault();
      authenticateGuest(els.guestIdEntry ? els.guestIdEntry.value : '');
    });

    const initialId = getInitialGuestId();
    if (initialId && els.guestIdEntry) {
      els.guestIdEntry.value = initialId;
      authenticateGuest(initialId, { returningGuest: true });
    }
  }

  function getInitialGuestId() {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get('id') || params.get('guest') || params.get('g');
    if (fromUrl) return normalizeGuestId(fromUrl);
    try {
      return normalizeGuestId(localStorage.getItem(GUEST_ID_STORAGE_KEY) || '');
    } catch (_) {
      return '';
    }
  }

  async function authenticateGuest(rawId, options = {}) {
    const candidate = normalizeGuestId(rawId);
    if (!candidate || !/^[A-Za-z0-9_-]{4,64}$/.test(candidate)) {
      setAuthStatus('IDを半角英数字で正しく入力してください。', 'error');
      if (els.guestIdEntry) els.guestIdEntry.focus();
      return;
    }
    if (!isGasConfigured()) {
      setAuthStatus('GASのWebアプリURLが未設定です。先にセットアップを完了してください。', 'error');
      return;
    }

    setAuthLoading(true);
    setAuthStatus(options.returningGuest ? '招待状を準備しています。' : 'IDを確認しています。', '');
    try {
      const result = await jsonp('status', { guestId: candidate });
      if (!result || !result.ok) throw new Error((result && result.error) || 'IDを確認できませんでした。');

      guestId = normalizeGuestId(result.guestId || candidate);
      latestStatus = {
        completed: Boolean(result.completed),
        attending: Boolean(result.attending)
      };
      try {
        localStorage.setItem(GUEST_ID_STORAGE_KEY, guestId);
      } catch (_) {
        // ストレージを使用できない環境では、次回のみ再入力になります。
      }

      hydrateGuest(result);
      revealAuthenticatedSite();
      removeIdFromAddressBar();
    } catch (error) {
      try {
        localStorage.removeItem(GUEST_ID_STORAGE_KEY);
      } catch (_) {
        // 何もしません。
      }
      setAuthStatus(`IDを確認できませんでした。${error.message || '入力内容をご確認ください。'}`, 'error');
      if (els.guestIdEntry) {
        els.guestIdEntry.select();
        els.guestIdEntry.focus();
      }
    } finally {
      setAuthLoading(false);
    }
  }

  function normalizeGuestId(value) {
    return String(value || '')
      .trim()
      .replace(/^https?:\/\/[^/]+\//i, '')
      .replace(/^.*[?&](?:id|guest|g)=/i, '')
      .replace(/^\/+|\/+$/g, '');
  }

  function hydrateGuest(status) {
    const displayName = String(status.displayName || 'ゲスト').trim();
    document.body.dataset.defaultName = displayName;
    if (els.guestIdInput) els.guestIdInput.value = guestId;
    if (els.nameInput) els.nameInput.value = displayName;
    if (els.emailInput) els.emailInput.value = status.email || '';
    if (els.guestMessageInput) els.guestMessageInput.value = status.message || '';
    if (els.menuGuestName) els.menuGuestName.textContent = `${displayName} 様`;
    if (status.ceremonyAttendance) checkRadio('ceremonyAttendance', status.ceremonyAttendance);
    if (status.receptionAttendance) checkRadio('receptionAttendance', status.receptionAttendance);
    hydrateAllergy(status.allergy || '');
    renderMessage(latestStatus);
  }

  function hydrateAllergy(allergy) {
    const value = String(allergy || '').trim();
    if (!value) {
      updateAllergyFields();
      return;
    }
    if (value === 'なし') {
      checkRadio('allergyChoice', 'なし');
      if (els.allergyDetailsInput) els.allergyDetailsInput.value = '';
    } else {
      checkRadio('allergyChoice', 'あり');
      if (els.allergyDetailsInput) els.allergyDetailsInput.value = value;
    }
    updateAllergyFields();
  }

  function revealAuthenticatedSite() {
    authenticated = true;
    document.body.classList.remove('auth-locked');
    document.body.classList.add('has-overlay');
    if (els.authOverlay) {
      els.authOverlay.classList.add('is-closing');
      window.setTimeout(() => { els.authOverlay.hidden = true; }, 620);
    }
    if (els.overlay) {
      els.overlay.hidden = false;
      els.overlay.classList.remove('is-closing');
    }
    applyRoute();
  }

  function removeIdFromAddressBar() {
    if (!location.search || !window.history || !window.history.replaceState) return;
    window.history.replaceState(null, '', `${location.pathname}${location.hash || ''}`);
  }

  function resetToAuth() {
    authenticated = false;
    guestId = '';
    latestStatus = { completed: false, attending: false };
    try {
      localStorage.removeItem(GUEST_ID_STORAGE_KEY);
    } catch (_) {
      // 何もしません。
    }
    closeMenu();
    document.body.classList.add('auth-locked');
    document.body.classList.remove('has-overlay');
    document.body.dataset.defaultName = '';
    if (els.overlay) els.overlay.hidden = true;
    if (els.authOverlay) {
      els.authOverlay.hidden = false;
      els.authOverlay.classList.remove('is-closing');
    }
    if (els.authForm) els.authForm.reset();
    if (els.form) els.form.reset();
    updateAllergyFields();
    setFormCompleted(false, false);
    setAuthStatus('', '');
    window.history.replaceState(null, '', location.pathname);
    window.setTimeout(() => { if (els.guestIdEntry) els.guestIdEntry.focus(); }, 50);
  }

  function setAuthLoading(loading) {
    if (!els.authButton) return;
    els.authButton.disabled = loading;
    els.authButton.textContent = loading ? 'Checking...' : 'Open Invitation';
  }

  function setAuthStatus(message, type) {
    if (!els.authStatus) return;
    els.authStatus.textContent = message || '';
    els.authStatus.classList.toggle('is-error', type === 'error');
    els.authStatus.classList.toggle('is-success', type === 'success');
  }

  function setViewportHeight() {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    syncResponsiveCopy();
  }

  function syncResponsiveCopy() {
    if (!els.guestMessageInput) return;
    els.guestMessageInput.placeholder = window.matchMedia('(max-width: 600px)').matches
      ? '新郎新婦へのメッセージがあれば\nご入力ください。'
      : '新郎新婦へのメッセージがあればご入力ください。';
  }

  function isGasConfigured() {
    return typeof config.gasWebAppUrl === 'string'
      && config.gasWebAppUrl.startsWith('https://script.google.com/')
      && !config.gasWebAppUrl.includes('PASTE_YOUR_GAS_WEB_APP_URL_HERE');
  }

  function getDisplayName() {
    const fromInput = els.nameInput ? els.nameInput.value.trim() : '';
    const fromBody = document.body ? document.body.dataset.defaultName : '';
    return fromInput || fromBody || 'ゲスト';
  }

  function renderMessage(status) {
    latestStatus = {
      completed: Boolean(status && status.completed),
      attending: Boolean(status && status.attending)
    };

    const displayName = getDisplayName();
    if (els.messageGuestName) els.messageGuestName.textContent = `${displayName}様`;

    let sentences;
    if (!latestStatus.completed) {
      sentences = [
        [
          { text: 'この度、白戸祐輔と大貫愛佳は', breakAfter: 'mobile' },
          { text: '結婚することとなりました。' }
        ],
        [
          { text: 'つきましては、', breakAfter: 'mobile' },
          { text: '結婚式へのご出欠について、', breakAfter: 'always' },
          { text: 'ご入力・ご回答をお願いいたします。' }
        ],
        [
          { text: '皆様と当日お会いできますことを、', breakAfter: 'always' },
          { text: '心より楽しみにしております。' }
        ]
      ];
    } else if (latestStatus.attending) {
      sentences = [
        [
          { text: '結婚式へのご出欠について、', breakAfter: 'always' },
          { text: 'ご回答いただき、', breakAfter: 'mobile' },
          { text: '誠にありがとうございました。' }
        ],
        [
          { text: '皆様と当日お会いできますことを、', breakAfter: 'always' },
          { text: '心より楽しみにしております！' }
        ]
      ];
    } else {
      sentences = [
        [
          { text: '結婚式へのご出欠について、', breakAfter: 'always' },
          { text: 'ご回答いただき、', breakAfter: 'mobile' },
          { text: '誠にありがとうございました。' }
        ],
        [{ text: 'またお会いできる日を楽しみにしております。' }]
      ];
    }

    if (els.messageBody) {
      els.messageBody.replaceChildren(...sentences.map(parts => {
        const line = document.createElement('span');
        line.className = 'message-sentence';
        parts.forEach(part => {
          line.append(document.createTextNode(part.text));
          if (part.breakAfter) {
            const lineBreak = document.createElement('br');
            if (part.breakAfter === 'mobile') lineBreak.className = 'mobile-only';
            line.append(lineBreak);
          }
        });
        return line;
      }));
    }
    setFormCompleted(latestStatus.completed, latestStatus.attending);
  }

  function setFormCompleted(completed, attending) {
    if (els.form) els.form.classList.toggle('is-hidden', Boolean(completed));
    if (els.thanks) {
      els.thanks.classList.toggle('is-hidden', !completed);
      const title = els.thanks.querySelector('strong');
      const text = els.thanks.querySelector('p');
      if (title) title.textContent = 'ご回答ありがとうございました！';
      if (text) {
        text.textContent = attending
          ? '当日お会いできますことを、心より楽しみにしております。'
          : 'またお会いできる日を楽しみにしております。';
      }
    }
  }

  function setupOverlay() {
    if (!els.overlay) return;
    const openInvitation = () => {
      els.overlay.classList.add('is-closing');
      document.body.classList.remove('has-overlay');
      window.setTimeout(() => { els.overlay.hidden = true; }, 780);
    };
    els.overlay.addEventListener('click', openInvitation);
    els.overlay.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openInvitation();
      }
    });
  }

  function setupMenu() {
    if (!els.menuButton || !els.menuPanel) return;
    els.menuButton.addEventListener('click', () => {
      const open = !els.menuPanel.classList.contains('is-open');
      els.menuPanel.classList.toggle('is-open', open);
      els.menuButton.classList.toggle('is-open', open);
      els.menuButton.setAttribute('aria-expanded', String(open));
    });
    els.menuPanel.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    if (els.changeIdButton) els.changeIdButton.addEventListener('click', resetToAuth);
    document.addEventListener('click', event => {
      if (!event.target.closest('.top-menu')) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  function closeMenu() {
    if (!els.menuButton || !els.menuPanel) return;
    els.menuPanel.classList.remove('is-open');
    els.menuButton.classList.remove('is-open');
    els.menuButton.setAttribute('aria-expanded', 'false');
  }

  function applyRoute() {
    if (!authenticated) return;
    const routeRaw = (location.hash || '#invitation').replace('#', '').toLowerCase();
    const active = ['invitation', 'profile'].includes(routeRaw)
      ? routeRaw
      : 'invitation';

    Object.entries({
      invitation: els.invitationPage,
      profile: els.profilePage
    }).forEach(([key, page]) => {
      if (page) page.classList.toggle('is-hidden', key !== active);
    });
    document.querySelectorAll('[data-nav]').forEach(item => {
      item.classList.toggle('is-current', item.dataset.nav === active);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setupFadeIn() {
    const nodes = document.querySelectorAll('.fade-in');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(node => node.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(node => observer.observe(node));
  }

  function setupCountdown() {
    const tick = () => {
      const diff = Math.max(0, targetDate.getTime() - Date.now());
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setText(els.days, days);
      setText(els.hours, pad2(hours));
      setText(els.minutes, pad2(minutes));
      setText(els.seconds, pad2(seconds));
    };
    tick();
    window.setInterval(tick, 1000);
  }

  function setupCarousel() {
    const slides = Array.from(document.querySelectorAll('.hero-slide'));
    const dots = Array.from(document.querySelectorAll('.slide-dot'));
    if (slides.length <= 1) return;
    const show = index => {
      currentSlide = ((index % slides.length) + slides.length) % slides.length;
      slides.forEach((slide, i) => slide.classList.toggle('is-active', i === currentSlide));
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === currentSlide));
    };
    dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));
    show(0);
    window.setInterval(() => show(currentSlide + 1), 5000);
  }

  function setupQuiz() {
    if (!els.quizStartButton || !els.quizPanel || !els.quizOptions) return;

    const state = { questions: [], index: 0, score: 0, answered: false };

    const renderQuizQuestion = () => {
      const item = state.questions[state.index];
      state.answered = false;
      setText(els.quizCurrent, state.index + 1);
      els.quizProgressBar.style.width = `${((state.index + 1) / QUIZ_QUESTION_COUNT) * 100}%`;
      setText(els.quizQuestion, item.question);
      els.quizOptions.innerHTML = '';
      els.quizFeedback.classList.add('is-hidden');
      els.quizFeedback.classList.remove('is-correct', 'is-wrong');

      item.shuffledOptions.forEach((option, optionIndex) => {
        const button = document.createElement('button');
        const letter = document.createElement('span');
        const label = document.createElement('span');
        const mark = document.createElement('span');
        button.className = 'quiz-option';
        button.type = 'button';
        letter.className = 'quiz-option-letter';
        label.className = 'quiz-option-text';
        mark.className = 'quiz-option-mark';
        letter.textContent = String.fromCharCode(65 + optionIndex);
        label.textContent = option;
        mark.setAttribute('aria-hidden', 'true');
        button.append(letter, label, mark);
        button.addEventListener('click', () => answerQuizQuestion(option, button));
        els.quizOptions.appendChild(button);
      });
    };

    const startQuiz = () => {
      state.questions = shuffle(QUIZ_QUESTIONS)
        .slice(0, QUIZ_QUESTION_COUNT)
        .map(item => ({ ...item, shuffledOptions: shuffle(item.options) }));
      state.index = 0;
      state.score = 0;
      state.answered = false;
      els.quizPanel.classList.remove('is-hidden');
      els.quizPlayView.classList.remove('is-hidden');
      els.quizResultView.classList.add('is-hidden');
      renderQuizQuestion();
      window.requestAnimationFrame(() => {
        els.quizPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        els.quizPanel.focus({ preventScroll: true });
      });
    };

    const answerQuizQuestion = (selectedOption, selectedButton) => {
      if (state.answered) return;
      state.answered = true;
      const item = state.questions[state.index];
      const isCorrect = selectedOption === item.answer;
      if (isCorrect) state.score += 1;

      Array.from(els.quizOptions.querySelectorAll('.quiz-option')).forEach(button => {
        button.disabled = true;
        const optionText = button.querySelector('.quiz-option-text').textContent;
        const mark = button.querySelector('.quiz-option-mark');
        if (optionText === item.answer) {
          button.classList.add('is-correct');
          mark.textContent = '✓';
        } else if (button === selectedButton) {
          button.classList.add('is-wrong');
          mark.textContent = '×';
        }
      });

      els.quizFeedback.classList.remove('is-hidden');
      els.quizFeedback.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
      setText(els.quizFeedbackTitle, isCorrect ? '正解！' : `残念！ 正解は「${item.answer}」`);
      setText(els.quizExplanation, item.explanation);
      setText(els.quizNextButton, state.index === QUIZ_QUESTION_COUNT - 1 ? '結果を見る' : '次の問題へ');
      els.quizNextButton.focus({ preventScroll: true });
    };

    const showQuizResult = () => {
      els.quizPlayView.classList.add('is-hidden');
      els.quizResultView.classList.remove('is-hidden');
      setText(els.quizScore, state.score);

      let title = 'ナイスチャレンジ！';
      let message = 'もう一度挑戦すると、違う問題が出るかもしれません。ぜひ再挑戦してみてください。';
      if (state.score === QUIZ_QUESTION_COUNT) {
        title = '全問正解！ ふたりマスターです';
        message = 'さすがの満点です。当日もふたりとの思い出話で盛り上がりましょう！';
      } else if (state.score >= 3) {
        title = 'お見事！ ふたり通です';
        message = 'ふたりのことをよく知っていますね。満点を目指してもう一度どうぞ！';
      }
      setText(els.quizResultTitle, title);
      setText(els.quizResultMessage, message);
      els.quizPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    els.quizStartButton.addEventListener('click', startQuiz);
    els.quizRetryButton.addEventListener('click', startQuiz);
    els.quizNextButton.addEventListener('click', () => {
      if (!state.answered) return;
      if (state.index >= QUIZ_QUESTION_COUNT - 1) {
        showQuizResult();
        return;
      }
      state.index += 1;
      renderQuizQuestion();
      els.quizPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function setupAllergyFields() {
    document.querySelectorAll('input[name="allergyChoice"]').forEach(radio => {
      radio.addEventListener('change', updateAllergyFields);
    });
    updateAllergyFields();
  }

  function updateAllergyFields() {
    const selected = document.querySelector('input[name="allergyChoice"]:checked');
    const hasAllergy = selected && selected.value === 'あり';
    if (els.allergyDetailsField) els.allergyDetailsField.classList.toggle('is-hidden', !hasAllergy);
    if (els.allergyDetailsInput) {
      els.allergyDetailsInput.required = Boolean(hasAllergy);
      if (!hasAllergy) els.allergyDetailsInput.value = '';
    }
  }

  function setupForm() {
    if (!els.form) return;
    els.form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!guestId || !authenticated) {
        setStatus('IDの認証情報がありません。IDを再入力してください。', 'error');
        return;
      }
      if (!isGasConfigured()) {
        setStatus('GASのWebアプリURLが未設定です。', 'error');
        return;
      }
      if (!els.form.checkValidity()) {
        els.form.reportValidity();
        setStatus('必須項目を入力・選択してください。', 'error');
        return;
      }

      const formData = new FormData(els.form);
      const payload = Object.fromEntries(formData.entries());
      payload.guestId = guestId;
      payload.name = String(payload.name || '').trim();
      payload.email = String(payload.email || '').trim();
      payload.allergyDetails = String(payload.allergyDetails || '').trim();
      payload.message = String(payload.message || '').trim();
      payload.allergy = payload.allergyChoice === 'なし' ? 'なし' : payload.allergyDetails;

      if (payload.allergyChoice === 'あり' && !payload.allergyDetails) {
        setStatus('アレルギーの詳細を入力してください。', 'error');
        if (els.allergyDetailsInput) els.allergyDetailsInput.focus();
        return;
      }

      setLoading(true);
      setStatus(['送信しています。', '画面を閉じずにお待ちください。'], '');
      try {
        const result = await jsonp('submit', payload);
        if (!result || !result.ok) throw new Error((result && result.error) || '送信に失敗しました。');
        const displayName = String(result.displayName || payload.name || 'ゲスト').trim();
        if (els.nameInput) els.nameInput.value = displayName;
        document.body.dataset.defaultName = displayName;
        if (els.menuGuestName) els.menuGuestName.textContent = `${displayName} 様`;
        renderMessage({ completed: true, attending: Boolean(result.attending) });
        setStatus('ご回答ありがとうございました。確認メールをご確認ください。', 'success');
        const target = document.getElementById('rsvp');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        setStatus(`送信できませんでした。${error.message || 'GASの設定を確認してください。'}`, 'error');
      } finally {
        setLoading(false);
      }
    });
  }

  function checkRadio(name, value) {
    const radio = Array.from(document.querySelectorAll(`input[name="${name}"]`))
      .find(input => input.value === value);
    if (radio) radio.checked = true;
  }

  function jsonp(action, params = {}) {
    return new Promise((resolve, reject) => {
      let url;
      try {
        url = new URL(config.gasWebAppUrl);
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

  function createPetals() {
    const layer = document.querySelector('.petal-layer');
    if (!layer) return;
    layer.innerHTML = '';
    const isSmallScreen = window.matchMedia('(max-width: 640px)').matches;
    const count = isSmallScreen ? 44 : 78;

    for (let i = 0; i < count; i++) {
      const petal = document.createElement('span');
      const duration = 8 + Math.random() * 12;
      petal.className = 'petal';
      petal.style.setProperty('--left', `${Math.random() * 100}%`);
      petal.style.setProperty('--static-top', `${Math.random() * 100}%`);
      petal.style.setProperty('--size', `${7 + Math.random() * 19}px`);
      petal.style.setProperty('--rotate', `${Math.random() * 360}deg`);
      petal.style.setProperty('--alpha', `${0.28 + Math.random() * 0.42}`);
      petal.style.setProperty('--drift', `${(Math.random() * 58 - 29).toFixed(1)}vw`);
      petal.style.setProperty('--duration', `${duration.toFixed(1)}s`);
      petal.style.setProperty('--delay', `${(-Math.random() * duration).toFixed(1)}s`);
      layer.appendChild(petal);
    }
  }

  function setLoading(loading) {
    if (!els.submitButton) return;
    els.submitButton.disabled = loading;
    els.submitButton.textContent = loading ? 'Sending...' : 'Send Reply';
  }

  function setStatus(message, type) {
    if (!els.formStatus) return;
    if (Array.isArray(message)) {
      const content = [];
      message.forEach((part, index) => {
        if (index > 0) {
          const lineBreak = document.createElement('br');
          lineBreak.className = 'mobile-only';
          content.push(lineBreak);
        }
        content.push(document.createTextNode(part));
      });
      els.formStatus.replaceChildren(...content);
    } else {
      els.formStatus.textContent = message || '';
    }
    els.formStatus.classList.toggle('is-error', type === 'error');
    els.formStatus.classList.toggle('is-success', type === 'success');
  }

  function pad2(value) { return String(value).padStart(2, '0'); }
  function setText(element, value) { if (element) element.textContent = String(value); }
  function shuffle(items) {
    const shuffled = Array.from(items);
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
})();
