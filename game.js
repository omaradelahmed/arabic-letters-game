/*!
 * حروفي — لعبة الحروف والحركات
 * لعبة تعليمية للأطفال من 3 إلى 6 سنوات.
 * لا موسيقى: كل الأصوات مولّدة بـ WebAudio، والكلام عبر speechSynthesis.
 */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* البيانات                                                            */
  /* ------------------------------------------------------------------ */

  const HARAKAT = {
    damma: { mark: '\u064F', name: 'مضمومة' },
    fatha: { mark: '\u064E', name: 'مفتوحة' },
    kasra: { mark: '\u0650', name: 'مكسورة' },
  };

  const LETTERS = [
    {
      letter: 'ر',
      name: 'راء',
      words: {
        damma: { text: 'رُز', emoji: '🍚' },
        fatha: { text: 'رَاديو', emoji: '📻' },
        kasra: { text: 'رِجل', emoji: '🦵' },
      },
    },
    {
      letter: 'س',
      name: 'سين',
      words: {
        damma: { text: 'سُكّر', emoji: '🍬' },
        fatha: { text: 'سَيّارة', emoji: '🚗' },
        kasra: { text: 'سِنجاب', emoji: '🐿️' },
      },
    },
    {
      letter: 'خ',
      name: 'خاء',
      words: {
        damma: { text: 'خُبز', emoji: '🍞' },
        fatha: { text: 'خَروف', emoji: '🐑' },
        kasra: { text: 'خِيار', emoji: '🥒' },
      },
    },
    {
      letter: 'ن',
      name: 'نون',
      words: {
        damma: { text: 'نُجوم', emoji: '⭐' },
        fatha: { text: 'نَملة', emoji: '🐜' },
        kasra: { text: 'نِمر', emoji: '🐆' },
      },
    },
    {
      letter: 'ت',
      name: 'تاء',
      words: {
        damma: { text: 'تُفاح', emoji: '🍎' },
        fatha: { text: 'تَاج', emoji: '👑' },
        kasra: { text: 'تِمساح', emoji: '🐊' },
      },
    },
    {
      letter: 'ل',
      name: 'لام',
      words: {
        damma: { text: 'لُعبة', emoji: '🧸' },
        fatha: { text: 'لَيمون', emoji: '🍋' },
        kasra: { text: 'لِسان', emoji: '👅' },
      },
    },
  ];

  const STORAGE_KEY = 'hurouf.v1';
  const WALK_MS = 680;      // مدة مشية الحرف قبل ظهور الأبواب
  const NEXT_ROUND_MS = 1250; // مدة الاحتفال قبل الحرف الجديد
  const GAME_OVER_MS = 1250;

  /* ------------------------------------------------------------------ */
  /* عناصر الصفحة                                                        */
  /* ------------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);

  const el = {
    score: $('score'),
    best: $('best'),
    soundBtn: $('soundBtn'),
    prompt: $('prompt'),
    doors: $('doors'),
    player: $('player'),
    playerGlyph: $('playerGlyph'),
    speakBtn: $('speakBtn'),
    startOverlay: $('startOverlay'),
    overOverlay: $('overOverlay'),
    playBtn: $('playBtn'),
    againBtn: $('againBtn'),
    finalScore: $('finalScore'),
    overText: $('overText'),
    overEmoji: $('overEmoji'),
    confetti: $('confetti'),
  };

  const doorParts = Array.from(document.querySelectorAll('.door')).map((root) => ({
    root,
    emoji: root.querySelector('.door-emoji'),
    word: root.querySelector('.door-word'),
  }));

  const state = {
    playing: false,
    locked: true,
    score: 0,
    best: 0,
    sound: true,
    lastLetter: '',
    round: null,
  };

  /* ------------------------------------------------------------------ */
  /* الحفظ المحلي                                                        */
  /* ------------------------------------------------------------------ */

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.best === 'number' && saved.best >= 0) state.best = saved.best;
      if (typeof saved.sound === 'boolean') state.sound = saved.sound;
    } catch {
      /* تجاهل أي بيانات تالفة */
    }
  }

  function saveSaved() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ best: state.best, sound: state.sound }));
    } catch {
      /* التخزين قد يكون معطّلًا في وضع التصفح الخاص */
    }
  }

  /* ------------------------------------------------------------------ */
  /* المؤثرات الصوتية (WebAudio — بدون أي ملفات ولا موسيقى)              */
  /* ------------------------------------------------------------------ */

  let actx = null;

  function audioCtx() {
    if (!state.sound) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!actx) {
      try {
        actx = new AC();
      } catch {
        return null;
      }
    }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }

  function tone({ freq, at = 0, dur = 0.2, type = 'sine', vol = 0.14 }) {
    const ctx = audioCtx();
    if (!ctx) return;
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  const sfx = {
    tap() {
      tone({ freq: 640, dur: 0.07, type: 'triangle', vol: 0.07 });
    },
    correct() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        tone({ freq, at: i * 0.085, dur: 0.24, type: 'triangle', vol: 0.12 });
      });
    },
    wrong() {
      tone({ freq: 233, dur: 0.18, type: 'sawtooth', vol: 0.09 });
      tone({ freq: 175, at: 0.15, dur: 0.3, type: 'sawtooth', vol: 0.09 });
      tone({ freq: 117, at: 0.3, dur: 0.36, type: 'sine', vol: 0.12 });
    },
  };

  /* ------------------------------------------------------------------ */
  /* الكلام (اختياري — يظهر فقط لو فيه صوت عربي على الجهاز)              */
  /* ------------------------------------------------------------------ */

  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let arVoice = null;
  let speakToken = 0;

  function findArabicVoice() {
    if (!synth) {
      document.body.classList.add('no-tts');
      return;
    }
    let voices = [];
    try {
      voices = synth.getVoices() || [];
    } catch {
      voices = [];
    }
    arVoice =
      voices.find((v) => /^ar[-_]EG/i.test(v.lang)) ||
      voices.find((v) => /^ar/i.test(v.lang)) ||
      null;
    document.body.classList.toggle('no-tts', !arVoice);
  }

  function speak(lines) {
    if (!synth || !arVoice || !state.sound || !lines.length) return;
    const token = ++speakToken;
    try {
      synth.cancel();
    } catch {
      /* بعض المتصفحات ترمي خطأ لو مفيش كلام شغّال */
    }
    // تأخير صغير: كروم بيفشل أحيانًا لو cancel ثم speak فورًا
    setTimeout(() => {
      if (token !== speakToken) return;
      for (const text of lines) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.voice = arVoice;
        utter.lang = arVoice.lang || 'ar-EG';
        utter.rate = 0.85;
        utter.pitch = 1.05;
        utter.volume = 1;
        try {
          synth.speak(utter);
        } catch {
          /* تجاهل */
        }
      }
    }, 80);
  }

  function speakRound() {
    const round = state.round;
    if (!round) return;
    const letterPhrase = `${round.letter.name} ${HARAKAT[round.correctHaraka].name}`;
    const words = round.doors.map((door) => round.letter.words[door.haraka].text);
    speak([letterPhrase, ...words]);
  }

  /* ------------------------------------------------------------------ */
  /* منطق الجولات                                                        */
  /* ------------------------------------------------------------------ */

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function buildRound() {
    const others = LETTERS.filter((item) => item.letter !== state.lastLetter);
    const letter = pick(others.length ? others : LETTERS);
    const harakat = Object.keys(letter.words);
    const correctHaraka = pick(harakat);
    const wrongHaraka = pick(harakat.filter((h) => h !== correctHaraka));
    const correctFirst = Math.random() < 0.5;

    const doors = correctFirst
      ? [{ haraka: correctHaraka }, { haraka: wrongHaraka }]
      : [{ haraka: wrongHaraka }, { haraka: correctHaraka }];

    return { letter, correctHaraka, wrongHaraka, doors };
  }

  function renderPrompt(glyph) {
    if (!el.prompt) return;
    el.prompt.textContent = '';
    el.prompt.append('اختار الباب اللي بيبدأ بـ ');
    const chip = document.createElement('b');
    chip.className = 'prompt-letter';
    chip.textContent = glyph;
    el.prompt.append(chip);
  }

  function renderDoors(round) {
    doorParts.forEach((parts, index) => {
      const door = round.doors[index];
      const word = round.letter.words[door.haraka];
      parts.root.classList.remove('correct', 'wrong');
      parts.root.dataset.haraka = door.haraka;
      parts.root.setAttribute('aria-label', word.text);
      if (parts.emoji) parts.emoji.textContent = word.emoji;
      if (parts.word) parts.word.textContent = word.text;
    });
  }

  function nextRound() {
    const round = buildRound();
    state.round = round;
    state.lastLetter = round.letter.letter;
    state.locked = true;

    const glyph = round.letter.letter + HARAKAT[round.correctHaraka].mark;
    if (el.playerGlyph) el.playerGlyph.textContent = glyph;
    renderPrompt(glyph);
    renderDoors(round);

    // الحرف يمشي، والأبواب تظهر لما يوصل
    el.doors.classList.add('is-hidden');
    el.player.classList.remove('walking');
    void el.player.offsetWidth; // إعادة حساب عشان الأنيميشن يشتغل كل جولة
    el.player.classList.add('walking');

    setTimeout(() => el.player.classList.remove('walking'), WALK_MS);

    setTimeout(() => {
      if (!state.playing) return;
      el.doors.classList.remove('is-hidden');
      state.locked = false;
      speakRound();
    }, WALK_MS - 40);
  }

  function renderScore() {
    el.score.textContent = String(state.score);
    el.best.textContent = String(state.best);
  }

  function celebrate() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#ffd166', '#43b3ff', '#2fbf71', '#ff7b9c', '#b388ff'];
    for (let i = 0; i < 26; i += 1) {
      const piece = document.createElement('i');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.25}s`;
      piece.style.animationDuration = `${0.9 + Math.random() * 0.6}s`;
      el.confetti.appendChild(piece);
      setTimeout(() => piece.remove(), 2300);
    }
  }

  function chooseDoor(index) {
    if (!state.playing || state.locked) return;
    const round = state.round;
    if (!round) return;

    const door = round.doors[index];
    const parts = doorParts[index];
    if (!door || !parts) return;

    state.locked = true;

    if (door.haraka === round.correctHaraka) {
      parts.root.classList.add('correct');
      sfx.correct();
      celebrate();

      state.score += 1;
      if (state.score > state.best) {
        state.best = state.score;
        saveSaved();
      }
      renderScore();

      el.player.classList.add('pop');
      setTimeout(() => el.player.classList.remove('pop'), 420);
      speak(['أحسنت!']);

      setTimeout(() => {
        if (state.playing) nextRound();
      }, NEXT_ROUND_MS);
      return;
    }

    // إجابة غلط: نعلّم الباب الغلط ونكشف الباب الصح
    parts.root.classList.add('wrong');
    const correctIndex = round.doors.findIndex((d) => d.haraka === round.correctHaraka);
    if (correctIndex >= 0 && doorParts[correctIndex]) {
      doorParts[correctIndex].root.classList.add('correct');
    }
    sfx.wrong();
    speak(['الإجابة كانت', round.letter.words[round.correctHaraka].text]);

    setTimeout(() => {
      if (state.playing) gameOver();
    }, GAME_OVER_MS);
  }

  function gameOver() {
    state.playing = false;
    state.locked = true;

    el.finalScore.textContent = String(state.score);
    if (el.overText) {
      el.overText.textContent =
        state.score > 0
          ? `جاوبت ${state.score} صح على التوالي. جرّب تكسر رقمك!`
          : 'الإجابة كانت غلط، بس المحاولة الجاية أحسن.';
    }
    if (el.overEmoji) {
      el.overEmoji.textContent = state.score >= 5 ? '🏆' : state.score > 0 ? '👏' : '🙈';
    }
    el.overOverlay.classList.remove('hidden');
    speak(['خلاص كده!', `نقاطك ${state.score}`]);
  }

  function startGame() {
    audioCtx();
    state.playing = true;
    state.score = 0;
    state.lastLetter = '';
    state.round = null;
    renderScore();
    el.startOverlay.classList.add('hidden');
    el.overOverlay.classList.add('hidden');
    el.doors.classList.remove('is-hidden');
    nextRound();
  }

  /* ------------------------------------------------------------------ */
  /* الصوت: تشغيل/إيقاف                                                  */
  /* ------------------------------------------------------------------ */

  function applySoundUI() {
    el.soundBtn.textContent = state.sound ? '🔊' : '🔇';
    el.soundBtn.setAttribute('aria-pressed', String(state.sound));
    el.soundBtn.setAttribute('aria-label', state.sound ? 'إيقاف الصوت' : 'تشغيل الصوت');
  }

  function toggleSound() {
    state.sound = !state.sound;
    applySoundUI();
    saveSaved();
    if (!state.sound) {
      if (synth) {
        try {
          synth.cancel();
        } catch {
          /* تجاهل */
        }
      }
    } else {
      audioCtx();
      sfx.tap();
    }
  }

  /* ------------------------------------------------------------------ */
  /* التشغيل                                                            */
  /* ------------------------------------------------------------------ */

  loadSaved();
  renderScore();
  applySoundUI();
  findArabicVoice();
  if (synth) synth.onvoiceschanged = findArabicVoice;

  el.playBtn.addEventListener('click', () => {
    sfx.tap();
    startGame();
  });

  el.againBtn.addEventListener('click', () => {
    sfx.tap();
    startGame();
  });

  el.soundBtn.addEventListener('click', toggleSound);

  el.speakBtn.addEventListener('click', () => {
    sfx.tap();
    speakRound();
  });

  doorParts.forEach((parts, index) => {
    parts.root.addEventListener('click', () => chooseDoor(index));
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && synth) {
      try {
        synth.cancel();
      } catch {
        /* تجاهل */
      }
    }
  });

  // تحديث تلقائي للعبة عند تغيير نسخة الـ Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js', { updateViaCache: 'none' })
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {});
    });
  }
})();
