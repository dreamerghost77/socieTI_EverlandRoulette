'use strict';

const rides = [
  { name: 'T 익스프레스', theme: 'timber', tag: 'WOODEN THRILL / 숨 멎는 급강하', description: '나무 레일을 타고 하늘 끝에서 아래로. 오늘은 심장이 먼저 달려가는 모험이에요.', accent: '#ffb86b', rgb: '255, 184, 107' },
  { name: '아마존 익스프레스', theme: 'river', tag: 'JUNGLE RIVER / 예측불가 급류', description: '물결을 따라 정글 속으로. 어느 쪽으로 흘러갈지 모르는 짜릿한 이야기가 기다려요.', accent: '#2eeac2', rgb: '46, 234, 194' },
  { name: '썬더폴스', theme: 'thunder', tag: 'THUNDER SPLASH / 거대한 물보라', description: '고요한 물길 끝에 기다리는 짜릿한 낙하. 물보라가 터지는 순간, 모험이 시작돼요.', accent: '#a971ff', rgb: '169, 113, 255' },
  { name: '허리케인', theme: 'storm', tag: 'INTO THE STORM / 폭풍 속으로', description: '바람이 모이고, 몸이 떠오르는 순간. 한가운데로 뛰어드는 대담한 모험이 찾아왔어요.', accent: '#ffc65d', rgb: '255, 198, 93' },
];

const $ = (selector) => document.querySelector(selector);
const ticketScreen = $('#ticket-screen');
const drawScreen = $('#draw-screen');
const revealScreen = $('#reveal-screen');
const ownerScreen = $('#owner-screen');
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
const roster = new TicketRoster({ teams: rides, capacity: 4 });
const lastAssignment = roster.assignments.at(-1);
const timers = new Set();
let stage = 'intro';
let selectedRide = null;
let ticketRide = lastAssignment ? rides.find((ride) => ride.theme === lastAssignment.rideTheme) : null;
let ticketOwner = lastAssignment ? EventParticipants.find((participant) => participant.id === lastAssignment.participantId) : null;
let nameDraw = null;
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
  if (nameDraw) nameDraw.cancel();
  stage = next;
  document.body.dataset.stage = next;
  ticketScreen.hidden = next !== 'ticket' && next !== 'intro';
  drawScreen.hidden = next !== 'draw';
  revealScreen.hidden = next !== 'reveal';
  ownerScreen.hidden = next !== 'owner';
  skipButton.hidden = next !== 'draw' && next !== 'reveal' && next !== 'owner';
  openingOverlay.hidden = next !== 'intro';
  $('#attraction-pool').open = false;
  updateJourney();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function focusHeading(selector) {
  $(selector).focus({ preventScroll: true });
}

function setAccent(ride) {
  document.documentElement.style.setProperty('--accent', ride ? ride.accent : '#c4f89a');
  document.documentElement.style.setProperty('--accent-rgb', ride ? ride.rgb : '196, 248, 154');
}

function updateJourney() {
  const ticketComplete = (stage === 'ticket' || stage === 'intro') && Boolean(ticketOwner);
  $('#ride-step').classList.toggle('done', ticketComplete || stage === 'owner');
  $('#ride-step').classList.toggle('active', !ticketComplete && stage !== 'owner');
  $('#owner-step').classList.toggle('active', stage === 'owner');
  $('#owner-step').classList.toggle('done', ticketComplete);
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
  const entriesCount = Number(wheel.dataset.entriesCount) || 8;
  rouletteStage.style.setProperty('--cylinder-radius', panelHeight / (2 * Math.tan(Math.PI / entriesCount)) + 'px');
}

function buildCylinder() {
  const counts = roster.counts;
  const available = rides.filter((ride) => counts[ride.theme] < 4);
  if (!available.length) { showTicket(); return false; }
  const entries = Array.from({ length: Math.max(8, available.length * 2) }, (_, index) => available[index % available.length]);
  wheel.dataset.entriesCount = String(entries.length);
  updateCylinderSize();
  wheel.replaceChildren();
  entries.forEach((ride, index) => {
    const panel = document.createElement('div');
    panel.className = 'cylinder-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.style.setProperty('--panel-rotation', index * 360 / entries.length + 'deg');
    const label = document.createElement('span');
    label.textContent = ride.name;
    panel.append(makeIcon(ride.theme), label);
    wheel.append(panel);
  });
  return true;
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
  if (stage === 'draw' || stage === 'owner') return;
  selectedRide = roster.drawRide();
  if (!selectedRide) {
    showTicket();
    status.textContent = '16명 모두의 티켓이 배정됐어요. 배정 현황에서 각 팀을 확인하세요.';
    return;
  }
  setStage('draw');
  clearRevealDetails();
  setAccent(null);
  drawScreen.classList.remove('is-fading');
  machine.classList.remove('is-spinning');
  $('#machine-status').textContent = 'SCANNING POSSIBILITIES';
  $('#footer-caption').textContent = 'A NEW ADVENTURE IS ON ITS WAY';
  status.textContent = '놀이기구를 뽑고 있어요.';
  focusHeading('#draw-heading');
  if (!buildCylinder()) return;
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
  status.textContent = '오늘의 놀이기구는 ' + selectedRide.name + '입니다. 이제 티켓 주인을 뽑아보세요.';
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
  const filled = Boolean(ticketRide && ticketOwner);
  const assigned = roster.assignments.length;
  const remaining = EventParticipants.length - assigned;
  const ticket = $('#adventure-ticket');
  ticket.classList.remove('is-filling');
  $('#ticket-ride-name').textContent = filled ? ticketRide.name : '아직 비어 있는 모험';
  $('#mystery-mark').hidden = filled;
  $('#ticket-ride-icon').toggleAttribute('hidden', !filled);
  $('#slot-state').textContent = filled ? '✓' : '✧';
  $('#ticket-owner-name').textContent = filled ? ticketOwner.id : '누구의 모험이 될까요?';
  $('#owner-slot-state').textContent = filled ? '✓' : '✧';
  $('#stub-owner').textContent = filled ? ticketOwner.id : '—';
  $('#stub-owner').setAttribute('aria-label', filled ? '티켓 주인 ' + ticketOwner.id : '티켓 주인 미정');
  $('#draw-button-label').textContent = remaining ? (filled ? '다음 티켓 뽑기' : '놀이기구 뽑기') : '모든 티켓 배정 완료';
  $('#ticket-ready-label').textContent = remaining ? '16명 중 ' + assigned + '명 배정 · 다음 티켓의 주인을 기다려요' : '16명 모두의 모험이 정해졌어요';
  $('#ticket-art-caption').textContent = filled ? 'YOUR ADVENTURE HAS FOUND YOU' : 'THE ADVENTURE IS YOURS TO FIND';
  $('#ticket-heading').innerHTML = filled ? '티켓의 주인,<br><span>' + ticketOwner.id + '입니다.</span>' : '한 장의 티켓,<br><span>예측불가한 하루.</span>';
  $('#ticket-description').innerHTML = filled ? ticketOwner.id + '의 모험은 ' + ticketRide.name + '에서.<br>' + (remaining ? '다음 티켓은 또 누구에게 향할까요?' : '4명씩 4팀의 배정이 모두 끝났어요.') : '먼저 놀이기구를, 그다음 티켓의 주인을.<br>16명의 모험을 4개 팀으로 채워보세요.';
  $('#ticket-number').textContent = 'EV — ' + String(Math.max(1, assigned)).padStart(4, '0');
  drawButton.disabled = !remaining;
  updateJourney();
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
  renderTicket(animateStamp);
  renderRoster();
  $('#footer-caption').textContent = 'YOUR TICKET TO THE UNEXPECTED';
  if (animateStamp) {
    sound.chime();
    status.textContent = ticketOwner.id + '의 ' + ticketRide.name + ' 티켓이 확정됐어요.';
  } else status.textContent = '어드벤처 티켓으로 돌아왔어요.';
  focusHeading('#ticket-heading');
}

function renderRoster() {
  const assignments = roster.assignments;
  const remaining = EventParticipants.filter((participant) => !assignments.some((record) => record.participantId === participant.id));
  $('#assignment-count').textContent = assignments.length + ' / 16명';
  $('#draw-note').textContent = remaining.length ? '4개의 팀 · 팀당 4명 · 남은 티켓 ' + remaining.length + '장' : '4개 팀의 티켓이 모두 완성됐어요';
  $('#pool-list').replaceChildren();
  $('#assignment-teams').replaceChildren();
  rides.forEach((ride) => {
    const members = assignments.filter((record) => record.rideTheme === ride.theme);
    const seats = 4 - members.length;
    const item = document.createElement('div');
    item.className = 'pool-item' + (seats ? '' : ' team-full');
    const name = document.createElement('span');
    name.textContent = ride.name;
    const chance = document.createElement('small');
    chance.textContent = seats ? seats + '석 · ' + (seats / remaining.length * 100).toFixed(1) + '%' : '배정 완료';
    item.append(makeIcon(ride.theme), name, chance);
    $('#pool-list').append(item);

    const team = document.createElement('article');
    team.className = 'assignment-team';
    team.dataset.team = ride.theme;
    const top = document.createElement('div');
    top.className = 'assignment-team-heading';
    const title = document.createElement('h3');
    title.textContent = ride.name;
    const count = document.createElement('span');
    count.textContent = members.length + ' / 4';
    top.append(makeIcon(ride.theme), title, count);
    const list = document.createElement('ol');
    for (let index = 0; index < 4; index += 1) {
      const member = document.createElement('li');
      member.textContent = members[index]?.participantId || '빈자리';
      member.classList.toggle('empty-seat', !members[index]);
      list.append(member);
    }
    team.append(top, list);
    $('#assignment-teams').append(team);
  });
  $('#waiting-label').textContent = remaining.length ? '아직 티켓을 기다리는 참가자 · ' + remaining.length + '명' : '모두 티켓을 받았어요';
  $('#waiting-list').replaceChildren();
  remaining.forEach((participant) => {
    const chip = document.createElement('span');
    chip.textContent = participant.id;
    $('#waiting-list').append(chip);
  });
  $('#storage-note').textContent = roster.persistent ? '배정 현황은 이 브라우저에 저장됩니다.' : '현재 창에서 배정 현황을 이어갑니다.';
  $('#reset-event').disabled = !assignments.length;
}

function startNameDraw() {
  if (!selectedRide || stage !== 'reveal' || keepButton.disabled) return;
  const group = roster.drawGroup();
  if (!group) { showTicket(); return; }
  if (roster.counts[selectedRide.theme] >= 4) {
    drawRide();
    status.textContent = '이 팀의 티켓이 모두 배정되어 다른 놀이기구를 추첨합니다.';
    return;
  }
  setStage('owner');
  setAccent(selectedRide);
  $('#footer-caption').textContent = 'THIS ADVENTURE IS LOOKING FOR YOU';
  status.textContent = selectedRide.name + ' 티켓의 주인을 뽑습니다.';
  nameDraw.start({ ride: selectedRide, group });
}

function assignTicket(participant) {
  if (stage !== 'owner') return;
  try {
    roster.assign(participant.id, selectedRide);
    ticketRide = selectedRide;
    ticketOwner = participant;
    showTicket(true);
    if (!roster.remaining.length) $('#assignment-details').open = true;
  } catch {
    showTicket();
    status.textContent = '배정 현황이 변경되어 이 티켓을 확정하지 못했어요. 남은 티켓을 다시 뽑아주세요.';
  }
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

nameDraw = new NameDraw({
  element: ownerScreen,
  onComplete: assignTicket,
  onPhase(phase) {
    if (stage === 'owner') skipButton.hidden = phase !== 'spinning';
  },
  onSound(cue) {
    if (stage !== 'owner') return;
    if (cue === 'confirmed') sound.reveal();
    else if (cue === 'card') sound.note(523.25, 0, .4, .03);
    else if (cue === 'lock') sound.chime();
    else sound.note(330, 0, .06, .015, 'triangle');
  },
});

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
keepButton.addEventListener('click', startNameDraw);
$('#brand-home').addEventListener('click', (event) => {
  event.preventDefault();
  showTicket();
});
skipButton.addEventListener('click', () => {
  if (stage === 'draw') showReveal(true);
  else if (stage === 'reveal') {
    cancelSequence();
    publishResult(true);
  } else if (stage === 'owner') nameDraw.skip();
});
$('#reset-event').addEventListener('click', () => $('#reset-dialog').showModal());
$('#cancel-reset').addEventListener('click', () => $('#reset-dialog').close());
$('#confirm-reset').addEventListener('click', () => {
  $('#reset-dialog').close();
  roster.reset();
  selectedRide = ticketRide = ticketOwner = null;
  showTicket();
  $('#assignment-details').open = false;
  status.textContent = '배정을 초기화했어요. 16명 모두 다시 추첨할 수 있습니다.';
});
window.addEventListener('storage', (event) => {
  if (event.key !== TicketRoster.storageKey && event.key !== null) return;
  if (stage !== 'ticket' && stage !== 'intro') return;
  const latest = roster.assignments.at(-1);
  ticketRide = latest ? rides.find((ride) => ride.theme === latest.rideTheme) : null;
  ticketOwner = latest ? EventParticipants.find((participant) => participant.id === latest.participantId) : null;
  renderTicket(false);
  renderRoster();
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

renderTicket(false);
renderRoster();
later(() => openingOverlay.classList.add('is-leaving'), motionQuery.matches ? 30 : 800);
later(() => { openingOverlay.hidden = true; }, motionQuery.matches ? 80 : 1600);
later(() => {
  if (stage !== 'intro') return;
  document.body.dataset.stage = stage = 'ticket';
  renderTicket(false);
  renderRoster();
  status.textContent = roster.remaining.length ? '티켓이 준비됐어요. 놀이기구와 티켓 주인을 차례로 뽑아보세요.' : '16명 모두의 티켓이 배정됐어요. 참가자 배정 현황을 확인하세요.';
}, motionQuery.matches ? 150 : 2050);
