'use strict';

const rides = [
  { name: 'T 익스프레스', theme: 'timber', tag: 'WOODEN THRILL / 숨 멎는 급강하', description: '나무 레일을 타고 하늘 끝에서 아래로. 오늘은 심장이 먼저 달려가는 모험이에요.', accent: '#ffb86b', rgb: '255, 184, 107' },
  { name: '아마존 익스프레스', theme: 'river', tag: 'JUNGLE RIVER / 예측불가 급류', description: '물결을 따라 정글 속으로. 어느 쪽으로 흘러갈지 모르는 짜릿한 이야기가 기다려요.', accent: '#2eeac2', rgb: '46, 234, 194' },
  { name: '썬더폴스', theme: 'thunder', tag: 'THUNDER SPLASH / 거대한 물보라', description: '고요한 물길 끝에 기다리는 짜릿한 낙하. 물보라가 터지는 순간, 모험이 시작돼요.', accent: '#a971ff', rgb: '169, 113, 255' },
  { name: '롤링 엑스트레인', theme: 'neon', tag: 'NEON RUSH / 뒤집히는 세상', description: '빛처럼 달리고, 시야는 거꾸로. 회전하는 레일 위에서 오늘의 속도를 높여보세요.', accent: '#fe62da', rgb: '254, 98, 218' },
  { name: '허리케인', theme: 'storm', tag: 'INTO THE STORM / 폭풍 속으로', description: '바람이 모이고, 몸이 떠오르는 순간. 한가운데로 뛰어드는 대담한 모험이 찾아왔어요.', accent: '#ffc65d', rgb: '255, 198, 93' },
  { name: '더블락스핀', theme: 'rock', tag: 'ROCK THE SKY / 하늘을 흔들어', description: '한 번 더, 거꾸로 돌아가는 하늘. 강렬한 회전과 함께 오늘의 에너지를 깨워보세요.', accent: '#ff5274', rgb: '255, 82, 116' },
  { name: '렛츠 트위스트', theme: 'twist', tag: 'ORBIT TWIST / 엇갈리는 궤도', description: '돌고, 비틀고, 다시 마주치는 하늘. 예측할 수 없는 궤도에 오늘의 즐거움을 맡겨봐요.', accent: '#bb88ff', rgb: '187, 136, 255' },
  { name: '매직스윙', theme: 'magic', tag: 'A LITTLE MAGIC / 마법 같은 순간', description: '반짝이는 바람에 가볍게 몸을 맡겨요. 작은 설렘으로 채워지는 마법 같은 모험이에요.', accent: '#ff9fd8', rgb: '255, 159, 216' },
];

const $ = (selector) => document.querySelector(selector);
const ticketScreen = $('#ticket-screen');
const drawScreen = $('#draw-screen');
const revealScreen = $('#reveal-screen');
const wheel = $('#roulette-cylinder');
const rouletteStage = $('#roulette-stage');
const machine = $('#gacha-machine');
const drawButton = $('#draw-button');
const keepButton = $('#keep-button');
const redrawButton = $('#redraw-button');
const skipButton = $('#skip-button');
const openingOverlay = $('#opening-overlay');
const status = $('#live-status');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const effects = new RideEffects($('#effects-canvas'));
const timers = new Set();
let stage = 'intro';
let selectedRide = null;
let ticketRide = null;
let spinFrame = null;
let revealPhase = null;
let revealStartedAt = 0;

// All delayed work belongs to the current scene, so navigation cannot reveal an old draw.
function later(callback, delay) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
  return timer;
}

function cancelSequence() {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  if (spinFrame !== null) cancelAnimationFrame(spinFrame);
  spinFrame = null;
  sound.stop();
}

function setStage(next) {
  cancelSequence();
  effects.stop();
  stage = next;
  document.body.dataset.stage = next;
  ticketScreen.hidden = next !== 'ticket' && next !== 'intro';
  drawScreen.hidden = next !== 'draw';
  revealScreen.hidden = next !== 'reveal';
  skipButton.hidden = next !== 'draw' && next !== 'reveal';
  openingOverlay.hidden = next !== 'intro';
  $('#attraction-pool').open = false;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function focusHeading(selector) {
  $(selector).focus({ preventScroll: true });
}

function setAccent(ride) {
  document.documentElement.style.setProperty('--accent', ride ? ride.accent : '#c4f89a');
  document.documentElement.style.setProperty('--accent-rgb', ride ? ride.rgb : '196, 248, 154');
}

function randomRideIndex() {
  if (!window.crypto?.getRandomValues) return Math.floor(Math.random() * rides.length);
  const values = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / rides.length) * rides.length;
  do window.crypto.getRandomValues(values); while (values[0] >= limit);
  return values[0] % rides.length;
}

function makeIcon(theme) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#icon-' + theme);
  icon.append(use);
  return icon;
}

function updateCylinderSize() {
  const panelHeight = Math.min(rouletteStage.clientHeight * .34, 104);
  rouletteStage.style.setProperty('--panel-height', panelHeight + 'px');
  rouletteStage.style.setProperty('--cylinder-radius', panelHeight / (2 * Math.tan(Math.PI / rides.length)) + 'px');
}

function buildCylinder() {
  updateCylinderSize();
  wheel.replaceChildren();
  rides.forEach((ride, index) => {
    const panel = document.createElement('div');
    panel.className = 'cylinder-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.style.setProperty('--panel-rotation', index * 360 / rides.length + 'deg');
    const label = document.createElement('span');
    label.textContent = ride.name;
    panel.append(makeIcon(ride.theme), label);
    wheel.append(panel);
  });
}

function clearRevealDetails() {
  ['#reveal-tag', '#reveal-heading', '#reveal-description', '#reveal-pass-name', '#reveal-index'].forEach((selector) => {
    $(selector).textContent = '';
  });
  $('#reveal-pass-icon use').removeAttribute('href');
  $('#reveal-content').hidden = true;
  $('#reveal-content').inert = true;
  $('#reveal-index').hidden = true;
  revealScreen.classList.remove('is-instant', 'is-revealed');
  delete revealScreen.dataset.theme;
  delete revealScreen.dataset.revealPhase;
  revealPhase = null;
  keepButton.disabled = true;
  redrawButton.disabled = true;
}

function drawRide() {
  if (stage === 'draw') return;
  selectedRide = rides[randomRideIndex()];
  setStage('draw');
  clearRevealDetails();
  setAccent(null);
  drawScreen.classList.remove('is-fading');
  machine.classList.remove('is-spinning');
  $('#machine-status').textContent = 'SCANNING POSSIBILITIES';
  $('#footer-caption').textContent = 'A NEW ADVENTURE IS ON ITS WAY';
  status.textContent = '놀이기구를 뽑고 있어요.';
  focusHeading('#draw-heading');
  buildCylinder();
  wheel.style.transition = 'none';
  wheel.style.transform = 'translateY(-50%) rotateX(0deg)';
  void wheel.offsetWidth;

  later(() => {
    if (stage !== 'draw') return;
    machine.classList.add('is-spinning');
    wheel.style.transition = motionQuery.matches ? 'none' : '';
    spinFrame = requestAnimationFrame(() => {
      spinFrame = null;
      // The reel is anticipation only; it disappears while moving and never points to the result.
      wheel.style.transform = 'translateY(-50%) rotateX(2542.5deg)';
      sound.draw();
      if (motionQuery.matches) {
        later(() => showReveal(true), 180);
        return;
      }
      later(() => {
        if (stage !== 'draw') return;
        drawScreen.classList.add('is-fading');
        status.textContent = '추첨 화면이 사라지고 모험의 빛이 나타납니다.';
        later(() => showReveal(), 1050);
      }, 1350);
    });
  }, motionQuery.matches ? 40 : 280);
}

function readyReveal() {
  if (stage !== 'reveal' || revealPhase !== 'result') return;
  keepButton.disabled = false;
  redrawButton.disabled = false;
  skipButton.hidden = true;
  $('#footer-caption').textContent = 'YOUR FIRST ADVENTURE, UNLOCKED';
  status.textContent = '오늘의 놀이기구는 ' + selectedRide.name + '입니다. 티켓에 담거나 한 번 더 뽑을 수 있어요.';
  focusHeading('#reveal-heading');
}

function publishResult(instant = false) {
  if (stage !== 'reveal' || !selectedRide) return;
  revealPhase = 'result';
  revealScreen.dataset.revealPhase = 'result';
  revealScreen.classList.toggle('is-instant', instant);
  revealScreen.classList.add('is-revealed');
  revealScreen.dataset.theme = selectedRide.theme;
  revealScreen.setAttribute('aria-labelledby', 'reveal-heading');
  $('#cinematic-caption').hidden = true;
  $('#reveal-content').hidden = false;
  $('#reveal-content').inert = false;
  $('#reveal-index').hidden = false;
  setAccent(selectedRide);
  $('#reveal-tag').textContent = selectedRide.tag;
  $('#reveal-heading').textContent = selectedRide.name;
  $('#reveal-description').textContent = selectedRide.description;
  $('#reveal-pass-name').textContent = selectedRide.name;
  $('#reveal-pass-icon use').setAttribute('href', '#icon-' + selectedRide.theme);
  $('#reveal-index').textContent = String(rides.indexOf(selectedRide) + 1).padStart(2, '0');
  if (instant) effects.start(selectedRide.theme, { elapsed: 5.5 });
  sound.reveal();
  if (instant) readyReveal();
  else later(readyReveal, 1350);
}

function setRevealPhase(phase) {
  if (stage !== 'reveal') return;
  revealPhase = phase;
  revealScreen.dataset.revealPhase = phase;
  if (phase === 'hint') {
    setAccent(selectedRide);
    $('#cinematic-heading').textContent = '빛 너머로, 모험의 기척.';
    $('#cinematic-hint').textContent = '색이 번지고, 낯익은 움직임이 깨어납니다.';
    $('#cinematic-step').textContent = '02 / RESONANCE';
    status.textContent = '빛에 색이 번지며 모험의 움직임이 드러납니다.';
    sound.note(261.63, 0, .7, .025);
  } else if (phase === 'silhouette') {
    $('#cinematic-heading').textContent = '조금씩 드러나는, 오늘의 모험.';
    $('#cinematic-hint').textContent = '실루엣을 따라, 첫 번째 목적지가 모습을 드러냅니다.';
    $('#cinematic-step').textContent = '03 / AWAKENING';
    status.textContent = '놀이기구의 실루엣이 서서히 드러납니다.';
    sound.note(329.63, 0, .9, .025);
  }
}

function showReveal(instant = false) {
  if (!selectedRide) return;
  setStage('reveal');
  clearRevealDetails();
  setAccent(null);
  revealStartedAt = performance.now();
  revealScreen.setAttribute('aria-labelledby', 'cinematic-heading');
  revealScreen.dataset.revealPhase = revealPhase = 'arrival';
  $('#cinematic-caption').hidden = false;
  $('#cinematic-heading').textContent = '어떤 모험이 기다릴까요?';
  $('#cinematic-hint').textContent = '작은 빛 하나가, 오늘의 목적지를 찾아갑니다.';
  $('#cinematic-step').textContent = '01 / ARRIVAL';
  $('#footer-caption').textContent = 'LET THE ADVENTURE FIND YOU';
  if (instant || motionQuery.matches) {
    publishResult(true);
    return;
  }
  effects.start(selectedRide.theme, { cinematic: true });
  sound.note(164.81, 0, .9, .025);
  sound.note(220, .45, .9, .02);
  focusHeading('#cinematic-heading');
  status.textContent = '모험의 빛이 나타납니다. 움직임을 따라 목적지를 발견해 보세요.';
  later(() => setRevealPhase('hint'), 1200);
  later(() => setRevealPhase('silhouette'), 2700);
  later(() => publishResult(), 5400);
}

function renderTicket(animateStamp) {
  const filled = Boolean(ticketRide);
  const ticket = $('#adventure-ticket');
  ticket.classList.remove('is-filling');
  $('#ticket-ride-name').textContent = filled ? ticketRide.name : '아직 비어 있는 모험';
  $('#mystery-mark').hidden = filled;
  $('#ticket-ride-icon').toggleAttribute('hidden', !filled);
  $('#slot-state').textContent = filled ? '✓' : '✧';
  $('#draw-button-label').textContent = filled ? '새로운 모험 뽑기' : '놀이기구 뽑기';
  $('#ticket-ready-label').textContent = filled ? '첫 번째 모험이 티켓에 채워졌어요' : '티켓에 모험을 채울 준비가 됐어요';
  $('#ticket-art-caption').textContent = filled ? 'YOUR FIRST ADVENTURE IS CONFIRMED' : 'THE ADVENTURE IS YOURS TO FIND';
  $('#ticket-heading').innerHTML = filled ? '첫 번째 모험,<br><span>티켓에 담았어요.</span>' : '한 장의 티켓,<br><span>예측불가한 하루.</span>';
  $('#ticket-description').innerHTML = filled ? '오늘의 첫 번째 목적지가 정해졌어요.<br>현장 운영과 탑승 안내를 확인하고 즐겨보세요.' : '어디로 갈지는 아직 비밀.<br>뽑기 한 번으로 오늘의 첫 모험을 채워보세요.';
  $('#ride-step').classList.toggle('done', filled);
  if (filled) $('#ticket-ride-icon use').setAttribute('href', '#icon-' + ticketRide.theme);
  if (animateStamp) {
    ticket.classList.remove('is-filled');
    void ticket.offsetWidth;
  }
  ticket.classList.toggle('is-filled', filled);
  if (animateStamp) ticket.classList.add('is-filling');
}

function showTicket(animateStamp = false) {
  setStage('ticket');
  setAccent(null);
  drawButton.disabled = false;
  renderTicket(animateStamp);
  $('#footer-caption').textContent = 'YOUR TICKET TO THE UNEXPECTED';
  if (animateStamp) {
    sound.chime();
    status.textContent = ticketRide.name + '을 티켓에 담았어요.';
  } else status.textContent = '어드벤처 티켓으로 돌아왔어요.';
  focusHeading('#ticket-heading');
}

// Small synthesized cues accompany the draw when explicitly enabled.
const sound = {
  enabled: false,
  context: null,
  nodes: new Set(),
  unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    try {
      if (!this.context) this.context = new AudioContext();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return true;
    } catch { return false; }
  },
  note(frequency, start = 0, duration = .15, level = .035, type = 'sine') {
    if (!this.enabled || !this.context || this.context.state === 'closed') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const time = this.context.currentTime + start;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + .015);
    gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    this.nodes.add(oscillator);
    oscillator.onended = () => {
      this.nodes.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(time);
    oscillator.stop(time + duration + .03);
  },
  draw() {
    if (motionQuery.matches) return;
    for (let index = 0; index < 26; index += 1) this.note(270 + (index % 5) * 55, index * .09 + index * index * .0016, .055, .015, 'triangle');
  },
  chime() { [392, 523.25].forEach((frequency, index) => this.note(frequency, index * .07, .24)); },
  reveal() {
    [261.63, 329.63, 392, 523.25, 783.99].forEach((frequency, index) => this.note(frequency, .16 + index * .12, .55, .032));
  },
  stop() {
    this.nodes.forEach((oscillator) => { try { oscillator.stop(); } catch {} });
    this.nodes.clear();
  },
};

$('#sound-toggle').addEventListener('click', () => {
  sound.enabled = !sound.enabled && sound.unlock();
  sound.stop();
  $('#sound-toggle').setAttribute('aria-pressed', String(sound.enabled));
  $('#sound-toggle').setAttribute('aria-label', sound.enabled ? '효과음 끄기' : '효과음 켜기');
  $('#sound-label').textContent = sound.enabled ? '소리 켜짐' : '소리 꺼짐';
  if (sound.enabled) sound.chime();
});
drawButton.addEventListener('click', drawRide);
redrawButton.addEventListener('click', drawRide);
keepButton.addEventListener('click', () => {
  if (stage !== 'reveal' || keepButton.disabled) return;
  ticketRide = selectedRide;
  showTicket(true);
});
$('#brand-home').addEventListener('click', (event) => {
  event.preventDefault();
  showTicket();
});
skipButton.addEventListener('click', () => {
  if (stage === 'draw') showReveal(true);
  else if (stage === 'reveal') {
    cancelSequence();
    publishResult(true);
  }
});
window.addEventListener('resize', () => { if (stage === 'draw') updateCylinderSize(); }, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { effects.stop(); sound.stop(); }
  else if (stage === 'reveal') effects.start(selectedRide.theme, {
    cinematic: revealPhase !== 'result',
    elapsed: Math.max(revealPhase === 'result' ? 5.5 : 0, (performance.now() - revealStartedAt) / 1000),
  });
});
motionQuery.addEventListener('change', () => {
  if (stage === 'intro') showTicket();
  else if (stage === 'draw' && motionQuery.matches) showReveal(true);
  else if (stage === 'reveal' && motionQuery.matches) {
    cancelSequence();
    publishResult(true);
  }
});

rides.forEach((ride) => {
  const item = document.createElement('div');
  item.className = 'pool-item';
  const name = document.createElement('span');
  name.textContent = ride.name;
  const chance = document.createElement('small');
  chance.textContent = '12.5%';
  item.append(makeIcon(ride.theme), name, chance);
  $('#pool-list').append(item);
});
renderTicket(false);
later(() => openingOverlay.classList.add('is-leaving'), motionQuery.matches ? 30 : 800);
later(() => { openingOverlay.hidden = true; }, motionQuery.matches ? 80 : 1600);
later(() => {
  if (stage !== 'intro') return;
  document.body.dataset.stage = stage = 'ticket';
  drawButton.disabled = false;
  status.textContent = '티켓이 준비됐어요. 놀이기구 뽑기로 첫 번째 모험을 채워보세요.';
}, motionQuery.matches ? 150 : 2050);
