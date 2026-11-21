'use strict';
const data = {"flags": ["urgent", "secret", "code", "remote", "stranger"], "levels": {"": "low", "large": "medium", "urgent": "medium", "urgent,large": "high", "secret": "medium", "secret,large": "high", "code": "high", "code,large": "high", "remote": "high", "remote,large": "high", "stranger": "medium", "stranger,large": "high", "urgent,secret": "high", "urgent,secret,large": "high", "urgent,code": "high", "urgent,code,large": "high", "urgent,remote": "high", "urgent,remote,large": "high", "urgent,stranger": "high", "urgent,stranger,large": "high", "secret,code": "high", "secret,code,large": "high", "secret,remote": "high", "secret,remote,large": "high", "secret,stranger": "high", "secret,stranger,large": "high", "code,remote": "high", "code,remote,large": "high", "code,stranger": "high", "code,stranger,large": "high", "remote,stranger": "high", "remote,stranger,large": "high", "urgent,secret,code": "high", "urgent,secret,code,large": "high", "urgent,secret,remote": "high", "urgent,secret,remote,large": "high", "urgent,secret,stranger": "high", "urgent,secret,stranger,large": "high", "urgent,code,remote": "high", "urgent,code,remote,large": "high", "urgent,code,stranger": "high", "urgent,code,stranger,large": "high", "urgent,remote,stranger": "high", "urgent,remote,stranger,large": "high", "secret,code,remote": "high", "secret,code,remote,large": "high", "secret,code,stranger": "high", "secret,code,stranger,large": "high", "secret,remote,stranger": "high", "secret,remote,stranger,large": "high", "code,remote,stranger": "high", "code,remote,stranger,large": "high", "urgent,secret,code,remote": "high", "urgent,secret,code,remote,large": "high", "urgent,secret,code,stranger": "high", "urgent,secret,code,stranger,large": "high", "urgent,secret,remote,stranger": "high", "urgent,secret,remote,stranger,large": "high", "urgent,code,remote,stranger": "high", "urgent,code,remote,stranger,large": "high", "secret,code,remote,stranger": "high", "secret,code,remote,stranger,large": "high", "urgent,secret,code,remote,stranger": "high", "urgent,secret,code,remote,stranger,large": "high"}, "codePattern": "(?\u003c![\\p{L}\\p{N}_])(?:назовите|пришлите|отправьте|продиктуйте|сообщите|назови|пришли|продиктуй)\\s+(?:мне\\s+|нам\\s+)?(?:пожалуйста[, ]+)?(?:одноразовый\\s+|смс[ -]?)?код(?![\\p{L}\\p{N}_])|(?\u003c![\\p{L}\\p{N}_])(?:кодты|кодын)\\s+(?:ешкімге\\s+айтпай[,]?\\s+)?(?:тек\\s+)?(?:маған\\s+|бізге\\s+)?(?:айтыңыз|жіберіңіз|беріңіз|айта салыңыз)(?![\\p{L}\\p{N}_])", "words": {"act_high": ["Прервите разговор. Не сообщайте коды и свяжитесь с банком через официальное приложение.", "Әңгімені аяқтаңыз. Кодты айтпаңыз және ресми қолданба арқылы банкке хабарласыңыз."], "act_low": ["Сверьте имя получателя, назначение и сумму самостоятельно.", "Алушының атын, төлем мақсатын және соманы өзіңіз тексеріңіз."], "act_medium": ["Свяжитесь с получателем по уже известному номеру и уточните просьбу.", "Алушымен бұрыннан білетін нөмір арқылы байланысып, өтінішті нақтылаңыз."], "amount": ["Сумма перевода, ₸", "Аударым сомасы, ₸"], "amount_valid": ["Укажите целое число от 1 до 1 000 000 000.", "1 мен 1 000 000 000 арасындағы бүтін санды енгізіңіз."], "analyze": ["Проверить текст", "Мәтінді тексеру"], "assess": ["Оценить обстоятельства", "Жағдайды бағалау"], "choose": ["Что хотите проверить?", "Нені тексергіңіз келеді?"], "circumstances": ["Что происходило перед переводом?", "Аударым алдында не болды?"], "code": ["Просят код из сообщения", "Хабарламадағы кодты сұрайды"], "code_example": ["Продиктуйте мне код из сообщения, чтобы отменить платёж.", "Төлемді тоқтату үшін кодты маған жіберіңіз."], "download": ["Скачать отчёт", "Есепті жүктеу"], "enter_message": ["Введите текст сообщения.", "Хабарлама мәтінін енгізіңіз."], "evidence_code": ["Просят передать код. Он может подтвердить вход или платёж.", "Кодты беруді сұрайды. Ол жүйеге кіруді не төлемді растауы мүмкін."], "example_plain": ["Обычная договорённость", "Қалыпты келісім"], "example_risk": ["Просьба сообщить код", "Кодты сұрау"], "examples": ["Учебные примеры", "Оқу мысалдары"], "headline": ["Проверьте просьбу о деньгах", "Ақша туралы өтінішті тексеріңіз"], "high": ["Высокий риск", "Қауіп жоғары"], "independent": ["Независимый сервис. Доступа к банковским счетам нет.", "Тәуелсіз сервис. Банк шоттарына қол жеткізбейді."], "input": ["Текст для проверки", "Тексерілетін мәтін"], "large": ["Сумма как минимум втрое выше указанной обычной", "Сома көрсетілген әдеттегі сомадан кемінде үш есе жоғары"], "lede": ["Вставьте сообщение или укажите, что произошло перед переводом.", "Хабарламаны енгізіңіз немесе аударым алдында не болғанын белгілеңіз."], "limit_note": ["Оценка зависит от переданных данных. Даже низкий риск не гарантирует безопасность; высокий не доказывает мошенничество.", "Баға берілген деректерге байланысты. Төмен қауіп қауіпсіздікке кепіл емес, ал жоғары қауіп алаяқтықты дәлелдемейді."], "low": ["Мало признаков риска", "Қауіп белгілері аз"], "medium": ["Есть повод проверить", "Тексеруге себеп бар"], "msg_next_unclear": ["Уточните контекст через знакомый канал. До этого не передавайте данные и деньги.", "Жағдайды таныс арна арқылы нақтылаңыз. Оған дейін деректер мен ақша бермеңіз."], "next": ["Что можно сделать", "Не істеуге болады"], "no_code": ["Явной просьбы передать код не найдено. По одному этому признаку нельзя оценить всё сообщение.", "Кодты беруді тікелей сұраған сөздер табылмады. Бір белгімен бүкіл хабарламаны бағалау мүмкін емес."], "ordinary": ["Обычная покупка", "Күнделікті сатып алу"], "privacy": ["Данные остаются в браузере. Для личной истории, анализа с ИИ, аудио и скриншотов нужен вход в серверную версию Senim.", "Деректер браузерде қалады. Жеке тарих, ЖИ талдауы, аудио және скриншоттарды тексеру үшін Senim-нің серверлік нұсқасына кіріңіз."], "privacy_title": ["Ваши данные", "Деректеріңіз"], "remote": ["Просят включить показ экрана", "Экранды көрсетуді сұрайды"], "result": ["Результат проверки", "Тексеру нәтижесі"], "risky": ["Звонок с просьбой о коде", "Код сұраған қоңырау"], "rule_high": ["Просьба о коде, показе экрана или сочетание нескольких признаков требует паузы.", "Кодты сұрау, экранды көрсетуді өтіну немесе бірнеше белгінің қатар келуі кідіре тұруды талап етеді."], "rule_low": ["По вашим ответам правила не выявили тревожных обстоятельств.", "Жауаптарыңыз бойынша алаңдатарлық жағдай анықталмады."], "rule_medium": ["Есть обстоятельство, которое стоит уточнить до перевода.", "Аударымға дейін нақтылайтын жағдай бар."], "safecode": ["Оставьте код при себе. Если речь о вашем счёте, откройте приложение банка самостоятельно.", "Кодты ешкімге айтпаңыз. Әңгіме шотыңыз туралы болса, банк қолданбасын өзіңіз ашыңыз."], "sample_plain": ["Привет! Сможешь завтра забрать книгу после работы?", "Сәлем! Ертең жұмыстан кейін кітапты алып кете аласың ба?"], "secret": ["Просят никому не рассказывать", "Ешкімге айтпауымды сұрайды"], "stranger": ["Я впервые плачу этому получателю", "Бұл алушыға алғаш рет ақша аударғалы тұрмын"], "text": ["Сообщение", "Хабарлама"], "text_hint": ["Автономная проверка ищет прямую просьбу передать код на русском или казахском. Другие схемы она может пропустить.", "Офлайн тексеру орысша немесе қазақша кодты беруді тікелей сұраған сөздерді іздейді. Басқа алаяқтық белгілерін өткізіп алуы мүмкін."], "to_content": ["К содержанию", "Мазмұнға өту"], "transfer": ["Перед переводом", "Аударым алдында"], "unclear": ["Недостаточно данных", "Дерек жеткіліксіз"], "urgent": ["Меня торопят с переводом", "Мені ақшаны тезірек аударуға асықтырып жатыр"], "usual": ["Обычная сумма, ₸ (необязательно)", "Әдеттегі сома, ₸ (міндетті емес)"], "why_code": ["Код может подтвердить платёж или вход в аккаунт.", "Код төлемді немесе аккаунтқа кіруді растауы мүмкін."], "why_large": ["Необычную для вас сумму стоит сверить с целью платежа.", "Сізге әдеттен тыс соманы төлемнің мақсатымен салыстырыңыз."], "why_remote": ["Через показ экрана собеседник может увидеть реквизиты или код.", "Экран көрсетілсе, әңгімелесуші деректемелерді немесе кодты көре алады."], "why_secret": ["Просьба о тайне мешает посоветоваться с человеком, которому вы доверяете.", "Құпия сақтау өтініші сенімді адаммен кеңесуге кедергі жасайды."], "why_stranger": ["Проверьте нового получателя через знакомый вам канал связи.", "Жаңа алушыны өзіңіз білетін байланыс арнасы арқылы тексеріңіз."], "why_urgent": ["Спешка мешает проверить, кому уходят деньги.", "Асыққанда ақшаның кімге кететінін тексеру қиын."]}};
const byId = id => document.getElementById(id);
const transfer = byId('form');
const messageForm = byId('text-form');
const message = byId('message');
const output = byId('output');
let lang = 'ru';
let mode = 'text';
const word = key => data.words[key][lang === 'kk' ? 1 : 0];
const codePattern = new RegExp(data.codePattern, 'giu');

function checkMessage() {
  const quotes = new Set();
  for (const match of message.value.matchAll(codePattern)) {
    const before = message.value.slice(0, match.index);
    if (/(?:^|[^\p{L}])не\s+$/iu.test(before)) continue;
    quotes.add(match[0]);
    if (quotes.size === 5) break;
  }
  const detected = quotes.size > 0;
  return {
    level: detected ? 'high' : 'unclear',
    reason: word(detected ? 'evidence_code' : 'no_code'),
    advice: word(detected ? 'safecode' : 'msg_next_unclear'),
    signals: Array.from(quotes, quote => '«' + quote + '»'),
  };
}

function checkTransfer() {
  const flags = data.flags.filter(flag => transfer.elements[flag].checked);
  const usual = byId('usual');
  if (usual.value && byId('amount').valueAsNumber >= 3 * usual.valueAsNumber) flags.push('large');
  const level = data.levels[flags.join(',')];
  return {
    level,
    reason: word('rule_' + level),
    advice: word('act_' + level),
    signals: flags.map(flag => word(flag) + '. ' + word('why_' + flag)),
  };
}

function showReport() {
  const result = mode === 'text' ? checkMessage() : checkTransfer();
  byId('level').className = 'risk ' + result.level;
  byId('level').textContent = word(result.level);
  byId('reason').textContent = result.reason;
  byId('advice').textContent = result.advice;
  const amount = byId('amount-summary');
  amount.hidden = mode !== 'transfer';
  amount.textContent = amount.hidden ? '' : new Intl.NumberFormat(lang === 'ru' ? 'ru-KZ' : 'kk-KZ', {
    style: 'currency', currency: 'KZT', maximumFractionDigits: 0
  }).format(byId('amount').valueAsNumber);
  byId('signals').replaceChildren(...result.signals.map(text => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
  output.hidden = false;
}

function draw() {
  document.documentElement.lang = lang;
  document.title = 'Senim · ' + word('headline');
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = word(el.dataset.t); });
  for (const key of ['lang', 'mode']) {
    document.querySelectorAll('[data-' + key + ']').forEach(el => {
      el.setAttribute('aria-pressed', String(el.dataset[key] === (key === 'lang' ? lang : mode)));
    });
  }
  messageForm.hidden = mode !== 'text';
  transfer.hidden = mode !== 'transfer';
  byId('plain').textContent = word(mode === 'text' ? 'example_plain' : 'ordinary');
  byId('risky').textContent = word(mode === 'text' ? 'example_risk' : 'risky');
  if (!output.hidden) showReport();
}

document.querySelectorAll('[data-lang]').forEach(el => el.onclick = () => {
  lang = el.dataset.lang;
  document.querySelectorAll('input, textarea').forEach(input => input.setCustomValidity(''));
  draw();
});
document.querySelectorAll('[data-mode]').forEach(el => el.onclick = () => {
  if (mode === el.dataset.mode) return;
  mode = el.dataset.mode;
  output.hidden = true;
  draw();
});
for (const input of document.querySelectorAll('input, textarea')) {
  input.addEventListener('invalid', () => input.setCustomValidity(word(input === message ? 'enter_message' : 'amount_valid')));
  input.addEventListener('input', () => input.setCustomValidity(''));
}
function example(risky) {
  output.hidden = true;
  if (mode === 'text') {
    message.value = word(risky ? 'code_example' : 'sample_plain');
    message.setCustomValidity('');
    message.focus();
  } else {
    transfer.reset();
    transfer.querySelectorAll('input').forEach(input => input.setCustomValidity(''));
    byId('amount').value = risky ? 80000 : 15000;
    byId('usual').value = 20000;
    transfer.elements.code.checked = risky;
    byId('amount').focus();
  }
}
byId('plain').onclick = () => example(false);
byId('risky').onclick = () => example(true);
for (const form of [messageForm, transfer]) {
  form.addEventListener('input', () => { output.hidden = true; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (mode === 'text' && !message.value.trim()) {
      message.setCustomValidity(word('enter_message'));
      message.reportValidity();
      return;
    }
    showReport();
    output.focus();
  });
}
byId('export').onclick = () => {
  const file = new Blob(['Senim\n' + byId('report').innerText], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Senim-report.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
draw();
