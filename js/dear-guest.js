(() => {
  'use strict';
  function selectMessage(status, phase) {
    const paragraphs = (...parts) => ({ custom: false, paragraphs: parts });
    if (!status.completed) return paragraphs(
      ['この度、白戸祐輔と大貫愛佳は', '結婚することとなりました。'],
      ['つきましては、結婚式へのご出欠について、', 'ご入力・ご回答をお願いいたします。'],
      ['皆様と当日お会いできますことを、', '心より楽しみにしております。']
    );
    if (!status.attending) return paragraphs(
      ['結婚式へのご出欠について、', 'ご回答いただき、誠にありがとうございました。'],
      ['またお会いできる日を', '楽しみにしております。']
    );
    if (phase === 'eve') return paragraphs(
      ['いよいよ明日、結婚式を迎えます！'],
      ['お会いできることを、', 'ふたりで心より楽しみにしております。'],
      ['どうぞお気をつけてお越しください。']
    );
    if (phase === 'today') return paragraphs(
      ['いよいよ本日、結婚式を迎えます！'],
      ['皆様と一緒に過ごせるひとときを、', '心より楽しみにしております。'],
      ['どうぞお気をつけてお越しください。']
    );
    if (phase === 'during') return paragraphs(
      ['本日はお越しいただき、', 'ありがとうございます！'],
      ['結婚式を楽しんでいただけていますか？'],
      ['このあとも、どうぞ心ゆくまで', '楽しんでいってくださいね！']
    );
    if (phase === 'after' && status.dearGuest && status.dearGuest.thanksVisited) return paragraphs(
      ['どうやら最後の謎まで', '解いてしまわれたようですね！', 'さすがです！'],
      ['最後の最後まで結婚式を楽しんでくださり、', '本当にありがとうございます。'],
      ['これからも、ふたりを', 'どうぞよろしくお願いいたします。']
    );
    if (phase === 'after') return paragraphs(
      ['結婚式は楽しんでいただけましたか？'],
      ['皆様と過ごした時間は、', 'ふたりにとって大切な宝物です。', 'これからも、どうぞよろしくお願いいたします。'],
      ['ちなみに、謎はこの招待状にも', '隠されているようですよ…。']
    );
    if (String(status.invitationMessage || '').trim()) return { custom: true, text: status.invitationMessage.trim() };
    return paragraphs(
      ['結婚式へのご出欠について、', 'ご回答いただき、誠にありがとうございました。'],
      ['皆様と当日お会いできますことを、', '心より楽しみにしております！']
    );
  }
  window.WeddingDearGuest = { selectMessage };
})();
