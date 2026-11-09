'use strict';

const { rides, teams: teamConfigs } = EverlandEventData;
const raffle = new EventRaffle.RaffleState();
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const ticketScreen = $('#ticket-screen');
const drawScreen = $('#draw-screen');
const revealScreen = $('#reveal-screen');
const ownerScreen = $('#owner-screen');
const missionScreen = $('#mission-screen');
const ladderScreen = $('#ladder-screen');
const finalScreen = $('#final-screen');
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
let selectedTeamId = null;
let nameDraw = null;
let spinFrame = null;
let revealPhase = null;
let revealStartedAt = 0;
let ladderReady = false;
let ladderAnimating = false;
let activeRoutePath = null;

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
  [ticketScreen, drawScreen, revealScreen, ownerScreen, missionScreen, ladderScreen, finalScreen]
    .forEach((screen) => { screen.hidden = screen.id !== (next === 'ticket' || next === 'intro' ? 'ticket-screen' : next === 'draw' ? 'draw-screen' : next === 'reveal' ? 'reveal-screen' : next === 'owner' ? 'owner-screen' : next === 'missions' ? 'mission-screen' : next === 'ladder' ? 'ladder-screen' : 'final-screen'); });
  skipButton.hidden = next !== 'draw' && next !== 'reveal' && next !== 'owner';
  openingOverlay.hidden = next !== 'intro';
  updateJourney();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function focusHeading(selector) {
  const heading = $(selector);
  if (heading) heading.focus({ preventScroll: true });
}

function setAccent(ride) {
  document.documentElement.style.setProperty('--accent', ride ? ride.accent : '#c4f89a');
  document.documentElement.style.setProperty('--accent-rgb', ride ? ride.rgb : '196, 248, 154');
}

function currentConfig() {
  return teamConfigs[raffle.activeTeamIndex] || null;
}

function currentTeam() {
  return raffle.activeTeam;
}

function currentTeamForDraw() {
  if (selectedTeamId) return raffle.getTeam(selectedTeamId);
  return currentTeam();
}

function updateJourney() {
  const current = currentTeam();
  const phase = current ? current.phase : 'complete';
  const phases = ['ride', 'members', 'missions', 'ladder'];
  ['#ride-step', '#owner-step', '#mission-step', '#ladder-step'].forEach((selector, index) => {
    const element = $(selector);
    element.classList.toggle('active', phase === phases[index]);
    element.classList.toggle('done', current ? phases.indexOf(phase) > index || phase === 'complete' : true);
  });
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

function buildCylinder(pool) {
  if (!pool.length) return false;
  const entries = Array.from({ length: Math.max(8, pool.length * 4) }, (_, index) => pool[index % pool.length]);
  wheel.setAttribute('aria-label', pool.map((ride) => ride.name).join(', ') + ' 원통형 룰렛');
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

function teamDrawHeading(config) {
  return config.label + ' · ' + config.difficulty + ' 난이도 놀이기구';
}

function drawRide() {
  if (stage === 'draw' || stage === 'owner') return;
  const config = currentConfig();
  if (!config) { showFinal(); return; }
  selectedTeamId = config.id;
  const pool = raffle.getAvailableRides(config.difficulty);
  try { selectedRide = raffle.drawRide(config.id); }
  catch (error) {
    status.textContent = error.message;
    return;
  }
  setStage('draw');
  clearRevealDetails();
  setAccent(null);
  drawScreen.classList.remove('is-fading');
  machine.classList.remove('is-spinning');
  $('#draw-heading').textContent = teamDrawHeading(config);
  $('#draw-screen .draw-intro > p:last-child').textContent = '같은 난이도에서 아직 나오지 않은 놀이기구를 추첨합니다.';
  $('#machine-status').textContent = config.difficulty.toUpperCase() + ' DIFFICULTY / NO REPEATS';
  $('#footer-caption').textContent = config.label.toUpperCase() + ' / ATTRACTION DRAW';
  status.textContent = config.label + ' 놀이기구를 뽑고 있어요.';
  focusHeading('#draw-heading');
  if (!buildCylinder(pool)) { showHome(); return; }
  wheel.style.transition = 'none';
  wheel.style.transform = 'translateY(-50%) rotateX(0deg)';
  void wheel.offsetWidth;
  later(() => {
    if (stage !== 'draw') return;
    machine.classList.add('is-spinning');
    wheel.style.transition = motionQuery.matches ? 'none' : '';
    spinFrame = requestAnimationFrame(() => {
      spinFrame = null;
      wheel.style.transform = 'translateY(-50%) rotateX(2542.5deg)';
      sound.draw();
      if (motionQuery.matches) {
        later(() => showReveal(true), 180);
        return;
      }
      later(() => {
        if (stage !== 'draw') return;
        drawScreen.classList.add('is-fading');
        status.textContent = '룰렛이 사라지고 놀이기구의 빛이 나타납니다.';
        later(() => showReveal(), 1050);
      }, 1350);
    });
  }, motionQuery.matches ? 40 : 280);
}

function clearRevealDetails() {
  ['#reveal-tag', '#reveal-heading', '#reveal-description', '#reveal-pass-name', '#reveal-index'].forEach((selector) => { $(selector).textContent = ''; });
  $('#reveal-pass-icon use').removeAttribute('href');
  $('#reveal-content').hidden = true;
  $('#reveal-content').inert = true;
  $('#reveal-index').hidden = true;
  $('#reveal-fixed-members').hidden = true;
  $('#reveal-fixed-list').replaceChildren();
  revealScreen.classList.remove('is-instant', 'is-revealed');
  delete revealScreen.dataset.theme;
  delete revealScreen.dataset.revealPhase;
  revealPhase = null;
  keepButton.disabled = true;
  redrawButton.disabled = true;
}

function readyReveal() {
  if (stage !== 'reveal' || revealPhase !== 'result') return;
  const team = currentTeamForDraw();
  const fixed = team?.config.kind === 'fixed';
  keepButton.textContent = fixed ? '확정 팀원 확인 · 미션 뽑기' : '참가자 5명 순차 추첨';
  keepButton.disabled = false;
  redrawButton.hidden = true;
  redrawButton.disabled = true;
  skipButton.hidden = true;
  $('#footer-caption').textContent = team?.config.label.toUpperCase() + ' / RIDE CONFIRMED';
  status.textContent = '오늘의 놀이기구는 ' + selectedRide.name + '입니다.' + (fixed ? ' 확정된 팀원을 확인한 뒤 미션을 뽑습니다.' : ' 티켓에 기록할 참가자 다섯 명을 차례로 뽑아보세요.');
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
  const team = currentTeamForDraw();
  if (team?.config.kind === 'fixed') {
    $('#reveal-fixed-members').hidden = false;
    team.members.forEach((id) => {
      const member = document.createElement('span');
      member.textContent = id;
      $('#reveal-fixed-list').append(member);
    });
  }
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
  if (instant || motionQuery.matches) { publishResult(true); return; }
  effects.start(selectedRide.theme, { cinematic: true });
  sound.note(164.81, 0, .9, .025);
  sound.note(220, .45, .9, .02);
  focusHeading('#cinematic-heading');
  status.textContent = '모험의 빛이 나타납니다. 움직임을 따라 목적지를 발견해 보세요.';
  later(() => setRevealPhase('hint'), 1200);
  later(() => setRevealPhase('silhouette'), 2700);
  later(() => publishResult(), 5400);
}

function startMemberDraw() {
  const team = currentTeamForDraw();
  if (!team || team.config.kind !== 'random') { showMissionScreen(); return; }
  if (team.members.length >= 5) { showMissionScreen(); return; }
  const group = raffle.drawInitialGroup(team.id);
  selectedTeamId = team.id;
  selectedRide = team.ride;
  setStage('owner');
  setAccent(selectedRide);
  $('#footer-caption').textContent = team.config.label.toUpperCase() + ' / PARTICIPANT ' + String(team.members.length + 1).padStart(2, '0') + ' OF 05';
  status.textContent = team.config.label + ' 참가자 ' + (team.members.length + 1) + '번째 이니셜을 추첨합니다.';
  nameDraw.start({ ride: selectedRide, group });
  renderMemberProgress(team.id);
}

function renderMemberProgress(teamId, newlyAddedId = null) {
  const team = raffle.getTeam(teamId);
  let progress = $('#member-ticket-progress', ownerScreen);
  if (!progress) {
    progress = document.createElement('section');
    progress.id = 'member-ticket-progress';
    progress.className = 'member-ticket-progress';
    ownerScreen.append(progress);
  }
  progress.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'member-progress-heading';
  const title = document.createElement('strong');
  title.textContent = '티켓 참가자 기록';
  const count = document.createElement('span');
  count.textContent = team.members.length + ' / 5';
  heading.append(title, count);
  const slots = document.createElement('ol');
  slots.className = 'member-ticket-slots';
  for (let index = 0; index < 5; index += 1) {
    const item = document.createElement('li');
    item.textContent = team.members[index] || '—';
    item.classList.toggle('is-empty', !team.members[index]);
    item.classList.toggle('is-active', index === team.members.length && team.members.length < 5);
    item.classList.toggle('is-printed', team.members[index] === newlyAddedId);
    slots.append(item);
  }
  progress.append(heading, slots);
  if (team.members.length === 5) {
    const ready = document.createElement('p');
    ready.className = 'member-team-ready';
    ready.textContent = '✦ 다섯 명의 티켓 기록이 완료됐어요.';
    progress.append(ready);
  }
}

function commitMember(participant) {
  if (stage !== 'owner' || !selectedTeamId) return;
  const teamId = selectedTeamId;
  let updated;
  try { updated = raffle.addMember(teamId, participant.id); }
  catch (error) {
    status.textContent = error.message;
    return;
  }
  sound.chime();
  renderMemberProgress(teamId, participant.id);
  renderHome();
  if (updated.members.length === 5) {
    status.textContent = '다섯 명이 모두 티켓에 기록됐어요. 이제 미션 카드를 뽑습니다.';
    const proceed = document.createElement('button');
    proceed.className = 'primary-button member-next-button';
    proceed.type = 'button';
    proceed.textContent = '미션 뽑기';
    proceed.addEventListener('click', showMissionScreen, { once: true });
    $('#member-ticket-progress', ownerScreen).append(proceed);
    later(() => { if (stage === 'owner' && raffle.getTeam(teamId).members.length === 5) showMissionScreen(); }, motionQuery.matches ? 600 : 2800);
    return;
  }
  status.textContent = participant.id + ' 이니셜이 티켓의 ' + updated.members.length + '번째 슬롯에 기록됐어요.';
  later(() => { if (stage === 'owner') startMemberDraw(); }, motionQuery.matches ? 120 : 780);
}

function renderTeamStrip(element, team) {
  element.replaceChildren();
  const label = document.createElement('span');
  label.className = 'team-strip-label';
  label.textContent = team.config.label + ' · ' + team.config.difficulty + ' 난이도';
  const ride = document.createElement('strong');
  ride.textContent = team.ride?.name || '놀이기구 미정';
  const people = document.createElement('div');
  people.className = 'team-strip-people';
  team.members.forEach((id) => {
    const chip = document.createElement('span');
    chip.textContent = id;
    people.append(chip);
  });
  element.append(label, ride, people);
}

function showMissionScreen() {
  const team = currentTeamForDraw();
  if (!team) { showFinal(); return; }
  if (!team.ride || team.members.length !== 5) { showHome(); return; }
  selectedTeamId = team.id;
  selectedRide = team.ride;
  setStage('missions');
  setAccent(selectedRide);
  renderTeamStrip($('#mission-team-strip'), team);
  $('#mission-description').textContent = '참가자에게 공개할 블라인드 미션 5개를 추첨합니다. 실제 내용과 유형은 이 화면에 표시되지 않습니다.';
  $('#mission-draw-button').hidden = Boolean(team.missionCount);
  $('#mission-next-button').hidden = !team.missionCount;
  renderMissionCards(team, false);
  $('#footer-caption').textContent = team.config.label.toUpperCase() + ' / MISSION DRAW';
  status.textContent = team.missionCount ? '블라인드 미션 5개가 확정되었습니다.' : '블라인드 미션 5개를 추첨하세요.';
  focusHeading('#mission-heading');
}

function renderMissionCards(team, animate) {
  const container = $('#mission-card-grid');
  container.replaceChildren();
  const count = team.missionCount || 0;
  Array.from({ length: count }, (_, index) => index).forEach((index) => {
    const card = document.createElement('article');
    card.className = 'mission-card is-sealed' + (animate ? ' is-flipping' : ' is-flipped');
    card.style.setProperty('--flip-delay', (animate ? index * 170 : 0) + 'ms');
    const back = document.createElement('div');
    back.className = 'mission-card-back';
    back.setAttribute('aria-hidden', 'true');
    back.innerHTML = '<span>?</span><small>SEALED<br>MISSION</small>';
    const face = document.createElement('div');
    face.className = 'mission-card-face';
    const label = document.createElement('span');
    label.className = 'mission-type';
    label.textContent = 'SECRET MISSION';
    const text = document.createElement('p');
    text.textContent = '•••';
    card.setAttribute('aria-label', '내용이 봉인된 비밀 미션 카드');
    face.append(label, text);
    card.append(back, face);
    container.append(card);
  });
}

function drawMissions() {
  const team = currentTeamForDraw();
  if (!team) return;
  try { raffle.drawMissions(team.id); }
  catch (error) { status.textContent = error.message; return; }
  const updated = raffle.getTeam(team.id);
  renderMissionCards(updated, !motionQuery.matches);
  $('#mission-draw-button').hidden = true;
  $('#mission-next-button').hidden = false;
  status.textContent = '블라인드 미션 5개가 확정되었습니다.';
  sound.reveal();
}

function startLadder() {
  const team = currentTeamForDraw();
  if (!team) return;
  try { raffle.createLadder(team.id, 10); }
  catch (error) { status.textContent = error.message; return; }
  showLadder(true);
}

function svgElement(name, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function ladderX(column) { return 113.333 + column * 193.333; }
function ladderY(level, rows) { return level * 500 / (rows + 1); }

function routePathData(route, rows) {
  return route.points.map((point, index) => (index ? 'L ' : 'M ') + ladderX(point.column) + ' ' + ladderY(point.level, rows)).join(' ');
}

function addLadderTrace(team, participantId, animate) {
  const svg = $('#ladder-svg');
  const route = raffle.traceParticipant(team.id, participantId);
  const d = routePathData(route, team.ladder.rows.length);
  const colorIndex = team.members.indexOf(participantId) % 5;
  const colors = ['#b9ff8a', '#72f4e5', '#f79dff', '#ffd36e', '#7ca8ff'];
  const path = svgElement('path', {
    d,
    class: 'ladder-route' + (animate ? ' is-running' : ''),
    stroke: colors[colorIndex],
    'data-participant': participantId,
    pathLength: '1',
  });
  if (!animate) path.classList.add('is-complete');
  svg.append(path);
  if (animate) {
    path.getBoundingClientRect();
    requestAnimationFrame(() => path.classList.add('is-complete'));
    const marker = svgElement('circle', { r: 9, class: 'ladder-runner', fill: colors[colorIndex] });
    const motion = svgElement('animateMotion', { dur: '1.85s', path: d, fill: 'freeze', rotate: 'auto' });
    marker.append(motion);
    svg.append(marker);
    activeRoutePath = path;
    later(() => { marker.remove(); path.classList.remove('is-running'); path.classList.add('is-complete'); activeRoutePath = null; }, 1900);
  }
  return route;
}

function renderLadderStructure(team, animate) {
  const svg = $('#ladder-svg');
  svg.replaceChildren();
  const defs = svgElement('defs');
  const filter = svgElement('filter', { id: 'ladder-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
  filter.append(svgElement('feGaussianBlur', { stdDeviation: '5', result: 'blur' }));
  const merge = svgElement('feMerge');
  merge.append(svgElement('feMergeNode', { in: 'blur' }), svgElement('feMergeNode', { in: 'SourceGraphic' }));
  filter.append(merge);
  defs.append(filter);
  svg.append(defs);
  const base = svgElement('g', { class: 'ladder-base' });
  for (let column = 0; column < team.ladder.columns; column += 1) {
    const line = svgElement('line', { x1: ladderX(column), y1: 0, x2: ladderX(column), y2: 500, class: 'ladder-rail' + (animate ? '' : ' is-static') });
    if (animate) {
      line.style.setProperty('--draw-delay', (column * 110) + 'ms');
      line.style.strokeDasharray = '500';
      line.style.strokeDashoffset = '500';
    }
    base.append(line);
  }
  let rungIndex = 0;
  team.ladder.rows.forEach((rungs, rowIndex) => rungs.forEach((column) => {
    const line = svgElement('line', {
      x1: ladderX(column), y1: ladderY(rowIndex + 1, team.ladder.rows.length),
      x2: ladderX(column + 1), y2: ladderY(rowIndex + 1, team.ladder.rows.length),
      class: 'ladder-rung' + (animate ? '' : ' is-static'),
    });
    if (animate) {
      line.style.setProperty('--draw-delay', (780 + rungIndex * 92) + 'ms');
      line.style.strokeDasharray = '200';
      line.style.strokeDashoffset = '200';
    }
    rungIndex += 1;
    base.append(line);
  }));
  svg.append(base);
  team.matches.forEach((match) => addLadderTrace(team, match.participantId, false));
  return rungIndex;
}

function renderLadderPlayers(team) {
  const container = $('#ladder-top-players');
  container.replaceChildren();
  team.members.forEach((id) => {
    const match = team.matches.find((entry) => entry.participantId === id);
    const isLeader = Boolean(match?.isTeamLeader);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ladder-player' + (match ? ' is-matched' : '') + (isLeader ? ' is-leader' : '');
    button.textContent = isLeader ? '♛ ' + id : id;
    button.disabled = !ladderReady || ladderAnimating || Boolean(match);
    button.setAttribute('aria-label', match
      ? id + (isLeader ? ' 팀장 당첨, 스페셜 미션 배정 완료' : ' 일반 미션 배정 완료')
      : id + ' 사다리타기 시작');
    button.addEventListener('click', () => matchParticipant(id));
    container.append(button);
  });
}

function renderLadderMissions(team) {
  const container = $('#ladder-bottom-missions');
  container.replaceChildren();
  Array.from({ length: team.missionCount }, (_, index) => index).forEach((index) => {
    const card = document.createElement('article');
    const assigned = team.matches.find((match) => match.missionIndex === index);
    const missionType = team.missionSlots[index]?.type;
    const isSpecial = missionType === 'special';
    card.className = 'ladder-mission'
      + (isSpecial ? ' is-special' : '')
      + (assigned ? ' is-assigned' : '');
    card.dataset.slotIndex = String(index);
    if (assigned) card.dataset.assignee = assigned.participantId;
    const typeLabel = document.createElement('span');
    typeLabel.className = 'mission-type-label';
    typeLabel.textContent = isSpecial ? 'SPECIAL MISSION' : 'NORMAL MISSION';
    const slotLabel = document.createElement('span');
    slotLabel.className = 'mission-slot-label';
    slotLabel.textContent = missionSlotLabel(index);
    const text = document.createElement('p');
    text.textContent = '🔒';
    text.setAttribute('aria-hidden', 'true');
    const assignee = document.createElement('strong');
    assignee.textContent = assigned
      ? assigned.participantId + ' → ' + missionSlotLabel(index) + (assigned.isTeamLeader ? ' · TEAM LEADER' : '')
      : '봉인된 미션';
    card.setAttribute('aria-label', (isSpecial ? 'SPECIAL MISSION' : 'NORMAL MISSION') + ', ' + missionSlotLabel(index) + ', 내용 봉인');
    card.append(typeLabel, slotLabel, text, assignee);
    container.append(card);
  });
}

function renderLadderResults(team) {
  const list = $('#ladder-result-list');
  list.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = team.complete ? 'TEAM COMPLETE / 블라인드 배정 결과' : '확정된 경로';
  list.append(heading);
  team.members.forEach((id) => {
    const match = team.matches.find((entry) => entry.participantId === id);
    const row = document.createElement('div');
    row.className = 'ladder-result-row'
      + (match?.missionType === 'special' ? ' is-special' : '')
      + (match?.isTeamLeader ? ' is-leader' : '');
    const name = document.createElement('strong');
    name.textContent = match?.isTeamLeader ? '♛ ' + id : id;
    const mission = document.createElement('span');
    const typeLabel = match?.missionType === 'special' ? 'SPECIAL MISSION' : 'NORMAL MISSION';
    mission.textContent = match
      ? typeLabel + ' · ' + missionSlotLabel(match.missionIndex) + (match.isTeamLeader ? ' · TEAM LEADER' : '')
      : '사다리 결과 대기';
    row.append(name, mission);
    list.append(row);
  });
}

function missionSlotLabel(index) {
  return 'MISSION ' + String.fromCharCode(65 + index);
}

function celebrateTeamLeader(participantId, missionIndex) {
  const wrap = $('#ladder-svg-wrap');
  const card = $('#ladder-bottom-missions').querySelector('[data-slot-index="' + missionIndex + '"]');
  const callout = $('#ladder-leader-callout');
  if (card) card.classList.add('is-leader-hit');
  callout.hidden = false;
  callout.textContent = '♛ ' + participantId + ' · TEAM LEADER';
  callout.classList.remove('is-celebrating');
  wrap.classList.remove('is-leader-burst');
  void wrap.offsetWidth;
  callout.classList.add('is-celebrating');
  wrap.classList.add('is-leader-burst');
  wrap.querySelectorAll('.leader-confetti').forEach((particle) => particle.remove());
  const colors = ['#ffd56f', '#fff0b2', '#f58bd0', '#8ef3da', '#b4c8ff'];
  Array.from({ length: 26 }, (_, index) => {
    const particle = document.createElement('span');
    particle.className = 'leader-confetti';
    particle.style.left = (4 + Math.random() * 92) + '%';
    particle.style.setProperty('--confetti-color', colors[index % colors.length]);
    particle.style.setProperty('--fall-x', Math.round((Math.random() - .5) * 220) + 'px');
    particle.style.setProperty('--fall-y', Math.round(80 + Math.random() * 180) + 'px');
    particle.style.setProperty('--confetti-delay', (Math.random() * .3).toFixed(2) + 's');
    wrap.append(particle);
    window.setTimeout(() => particle.remove(), 2100);
  });
  window.setTimeout(() => {
    if (card?.isConnected) card.classList.remove('is-leader-hit');
    wrap.classList.remove('is-leader-burst');
    callout.classList.remove('is-celebrating');
  }, 1900);
  status.textContent = participantId + ' 팀장 당첨! 실제 미션 내용은 공개하지 않습니다.';
}

function renderLadder(team, animateStructure) {
  renderLadderPlayers(team);
  const rungCount = renderLadderStructure(team, animateStructure);
  renderLadderMissions(team);
  renderLadderResults(team);
  const next = $('#ladder-next-button');
  const leaderCallout = $('#ladder-leader-callout');
  leaderCallout.hidden = !team.leader;
  leaderCallout.textContent = team.leader ? '♛ ' + team.leader + ' · TEAM LEADER' : '';
  leaderCallout.classList.remove('is-celebrating');
  next.hidden = !team.complete;
  next.textContent = raffle.activeTeamIndex === 2 ? '세 팀 최종 티켓 보기' : '팀 티켓 완성 · 다음 팀으로';
  if (team.complete) {
    $('#ladder-heading').textContent = '사다리 결과가 모두 정해졌어요.';
    $('#ladder-description').textContent = '미션 유형과 팀장 당첨자를 공개합니다. 실제 미션 내용은 계속 봉인됩니다.';
  } else {
    $('#ladder-heading').textContent = '이니셜을 눌러 미션에 연결하세요.';
    $('#ladder-description').textContent = 'SPECIAL MISSION 위치와 결과를 공개합니다. 실제 미션 내용은 티켓에 도착할 때까지 봉인됩니다.';
  }
  ladderReady = false;
  renderLadderPlayers(team);
  if (!animateStructure) {
    ladderReady = true;
    const base = $('.ladder-base', $('#ladder-svg'));
    if (base) base.classList.add('is-faded');
    renderLadderPlayers(team);
    return;
  }
  const finishDrawing = () => {
    const base = $('.ladder-base', $('#ladder-svg'));
    if (base) base.classList.add('is-faded');
    ladderReady = true;
    renderLadderPlayers(raffle.getTeam(team.id));
  };
  if (motionQuery.matches) later(finishDrawing, 120);
  else {
    later(() => $('#ladder-svg-wrap').classList.add('is-flashing'), 3000 + Math.max(0, rungCount - 12) * 90);
    later(() => {
      $('#ladder-svg-wrap').classList.remove('is-flashing');
      finishDrawing();
      status.textContent = '사다리가 투명해졌어요. 참가자 이니셜을 눌러 경로를 확인하세요.';
    }, 3650 + Math.max(0, rungCount - 12) * 90);
  }
}

function showLadder(animateStructure = false) {
  const team = currentTeamForDraw();
  if (!team || !team.ladder) { showMissionScreen(); return; }
  selectedTeamId = team.id;
  selectedRide = team.ride;
  ladderAnimating = false;
  activeRoutePath = null;
  setStage('ladder');
  setAccent(selectedRide);
  renderTeamStrip($('#ladder-team-strip'), team);
  renderLadder(team, animateStructure);
  $('#footer-caption').textContent = team.config.label.toUpperCase() + ' / LADDER DRAW';
  status.textContent = team.complete ? '이 팀의 모든 미션이 확정됐어요.' : '사다리 경로를 생성합니다.';
  focusHeading('#ladder-heading');
}

function matchParticipant(participantId) {
  if (stage !== 'ladder' || !ladderReady || ladderAnimating) return;
  const team = currentTeamForDraw();
  if (!team || team.matches.some((match) => match.participantId === participantId)) return;
  let match;
  try { match = raffle.matchParticipant(team.id, participantId); }
  catch (error) { status.textContent = error.message; return; }
  const updated = raffle.getTeam(team.id);
  ladderAnimating = true;
  renderLadderPlayers(updated);
  addLadderTrace(updated, participantId, !motionQuery.matches);
  renderLadderMissions(updated);
  renderLadderResults(updated);
  status.textContent = match.isTeamLeader
    ? participantId + ' → SPECIAL MISSION · TEAM LEADER'
    : participantId + ' → NORMAL MISSION · ' + missionSlotLabel(match.missionIndex);
  const finish = () => {
    ladderAnimating = false;
    renderLadderPlayers(raffle.getTeam(team.id));
    renderLadderResults(raffle.getTeam(team.id));
    if (match.isTeamLeader) celebrateTeamLeader(participantId, match.missionIndex);
    if (raffle.getTeam(team.id).complete) {
      $('#ladder-heading').textContent = '다섯 명 모두 미션을 받았어요!';
      $('#ladder-description').textContent = '스페셜 미션 당첨자와 팀장을 공개했습니다. 실제 미션 내용은 티켓에서 확인하세요.';
      $('#ladder-next-button').hidden = false;
      $('#ladder-next-button').textContent = raffle.activeTeamIndex === 2 ? '세 팀 최종 티켓 보기' : '팀 티켓 완성 · 다음 팀으로';
      status.textContent = '팀의 블라인드 배정이 완료됐습니다.';
    }
  };
  if (motionQuery.matches) finish();
  else later(finish, 1900);
}

function advanceAfterLadder() {
  const team = currentTeamForDraw();
  if (!team?.complete) return;
  try { raffle.advanceTeam(); }
  catch (error) { status.textContent = error.message; return; }
  selectedRide = null;
  selectedTeamId = null;
  if (raffle.allComplete) showFinal();
  else showHome();
}

function rideStatus(team) {
  if (!team.ride) return '놀이기구 추첨 전';
  if (team.phase === 'ride') return team.ride.name;
  if (team.phase === 'members') return team.ride.name + ' · 참가자 ' + team.members.length + '/5';
  if (team.phase === 'missions') return team.ride.name + ' · 미션 추첨 대기';
  if (team.phase === 'ladder') return team.ride.name + ' · 미션 ' + team.matches.length + '/5';
  return team.ride.name + ' · 팀 완성';
}

function renderOverview() {
  const container = $('#overview-cards');
  container.replaceChildren();
  raffle.teams.forEach((team, index) => {
    const card = document.createElement('article');
    card.className = 'overview-card' + (index === raffle.activeTeamIndex ? ' is-current' : '') + (team.complete ? ' is-complete' : '');
    const header = document.createElement('div');
    header.className = 'overview-card-top';
    const title = document.createElement('strong');
    title.textContent = team.config.label;
    const difficulty = document.createElement('span');
    difficulty.textContent = team.config.difficulty + ' 난이도';
    header.append(title, difficulty);
    const destination = document.createElement('p');
    destination.textContent = rideStatus(team);
    const members = document.createElement('div');
    members.className = 'overview-member-list';
    team.members.forEach((id) => {
      const chip = document.createElement('span');
      chip.textContent = id;
      members.append(chip);
    });
    const progress = document.createElement('small');
    progress.textContent = team.complete ? 'TEAM COMPLETE' : team.members.length + ' / 5 MEMBERS · ' + team.missionCount + ' / 5 SEALED MISSIONS';
    card.append(header, destination, members, progress);
    container.append(card);
  });
}

function renderHome() {
  const team = currentTeam() || raffle.teams.at(-1);
  if (!team) return;
  const config = team.config;
  const phase = team.phase;
  $('#ticket-heading').innerHTML = config.label + ',<br><span>티켓을 채워볼까요.</span>';
  $('#ticket-description').textContent = '15명 · 3팀 · 한 번 정해진 추첨 결과는 새로고침 후에도 이어집니다.';
  $('#ticket-ride-name').textContent = team.ride?.name || config.difficulty + ' 난이도 놀이기구 미정';
  $('#mystery-mark').hidden = Boolean(team.ride);
  $('#ticket-ride-icon').toggleAttribute('hidden', !team.ride);
  if (team.ride) $('#ticket-ride-icon use').setAttribute('href', '#icon-' + team.ride.theme);
  $('#slot-state').textContent = team.ride ? '✓' : '✧';
  $('#ticket-owner-name').textContent = team.members.length ? team.members.join(' · ') : (config.kind === 'fixed' ? '확정 팀원 5명' : '참가자 5명 추첨 대기');
  $('#owner-slot-state').textContent = team.members.length === 5 ? '✓' : '✧';
  $('.mission-slot strong').textContent = team.missionCount ? team.missionCount + '개 블라인드 미션 확정' : '블라인드 미션 5개';
  $('#ticket-art-caption').textContent = team.ride ? team.config.label.toUpperCase() + ' / ADVENTURE READY' : config.difficulty.toUpperCase() + ' DIFFICULTY / DESTINATION';
  $('#ticket-number').textContent = 'EV — MT ' + (team.config.difficulty === '상' ? 'H' : 'M') + team.config.number;
  $('#stub-owner').textContent = 'TEAM\n0' + (team.config.difficulty === '상' ? team.config.number : 3);
  $('#stub-owner').setAttribute('aria-label', config.label);
  $('#ticket-ready-label').textContent = team.complete ? '이 팀의 티켓이 완성됐어요' : config.label + ' 진행 · ' + phaseLabel(phase);
  const buttonText = raffle.allComplete ? '최종 티켓 확인'
    : phase === 'ride' ? config.label + ' 놀이기구 뽑기'
      : phase === 'members' ? '참가자 추첨 이어하기'
        : phase === 'missions' ? '미션 추첨 이어하기'
          : phase === 'complete' ? '팀 결과 확인'
            : '사다리타기 이어하기';
  $('#draw-button-label').textContent = buttonText;
  drawButton.disabled = false;
  $('#draw-note').textContent = raffle.migratedLegacyState
    ? '새 미션 규칙에 맞춰 기존 팀의 사다리 추첨을 다시 진행해 주세요.'
    : phase === 'ride'
    ? config.difficulty + ' 난이도 · 같은 난이도에서 놀이기구 중복 없음'
    : '현재 단계와 추첨 결과는 이 브라우저에 저장됩니다.';
  $('#ticket-stamp').innerHTML = team.complete ? 'TEAM<br>COMPLETE' : 'ADVENTURE<br>PASS';
  const ticket = $('#adventure-ticket');
  ticket.classList.toggle('is-filled', Boolean(team.ride));
  $('#team-overview').hidden = false;
  $('#storage-note').textContent = raffle.persistent ? '추첨 결과가 이 브라우저에 저장됩니다.' : '현재 브라우저 창에서 추첨 결과를 유지합니다.';
  renderOverview();
  updateJourney();
}

function phaseLabel(phase) {
  return ({ ride: '놀이기구 추첨', members: '참가자 순차 추첨', missions: '미션 카드 추첨', ladder: '사다리타기', complete: '완성' })[phase] || phase;
}

function showHome() {
  if (raffle.allComplete) { showFinal(); return; }
  setStage('ticket');
  setAccent(null);
  renderHome();
  $('#footer-caption').textContent = 'YOUR TICKET TO THE UNEXPECTED';
  status.textContent = '현재 팀의 추첨을 이어가세요.';
  focusHeading('#ticket-heading');
}

function continueCurrentTeam() {
  if (raffle.allComplete) { showFinal(); return; }
  const team = currentTeam();
  if (!team) { showFinal(); return; }
  selectedTeamId = team.id;
  selectedRide = team.ride;
  if (team.phase === 'ride') drawRide();
  else if (team.phase === 'members') startMemberDraw();
  else if (team.phase === 'missions') showMissionScreen();
  else if (team.phase === 'ladder' || team.phase === 'complete') showLadder(false);
}

function createFinalSummary(team) {
  const article = document.createElement('article');
  article.className = 'final-summary';
  const heading = document.createElement('header');
  const title = document.createElement('strong');
  title.textContent = team.config.label;
  const ride = document.createElement('span');
  ride.textContent = team.ride.name;
  heading.append(title, ride);
  const assignments = document.createElement('ul');
  assignments.className = 'final-summary-assignments';
  team.members.forEach((id) => {
    const match = team.matches.find((entry) => entry.participantId === id);
    const row = document.createElement('li');
    row.className = (match?.missionType === 'special' ? 'is-special ' : '')
      + (match?.isTeamLeader ? 'is-leader' : '');
    const participant = document.createElement('strong');
    participant.textContent = match?.isTeamLeader ? '♛ ' + id : id;
    if (match?.isTeamLeader) participant.className = 'is-leader';
    const mission = document.createElement('span');
    mission.textContent = match
      ? (match.missionType === 'special' ? 'SPECIAL MISSION' : 'NORMAL MISSION')
        + ' · ' + missionSlotLabel(match.missionIndex)
        + (match.isTeamLeader ? ' · TEAM LEADER' : '')
      : '배정 대기';
    row.append(participant, mission);
    assignments.append(row);
  });
  const note = document.createElement('p');
  note.textContent = '스페셜 미션과 팀장 당첨자를 공개했습니다. 실제 미션 내용은 개인 티켓에만 표시됩니다.';
  article.append(heading, assignments, note);
  return article;
}

function showFinal() {
  setStage('final');
  setAccent(null);
  const container = $('#final-ticket-grid');
  container.replaceChildren();
  raffle.teams.forEach((team) => container.append(createFinalSummary(team)));
  $('#footer-caption').textContent = 'THREE TEAMS / BLIND RESULTS COMPLETE';
  status.textContent = '세 팀의 추첨이 끝났습니다. 스페셜 미션 당첨자와 팀장은 공개되며 실제 미션 내용은 봉인되어 있습니다.';
  focusHeading('#final-heading');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportOperatorData() {
  const button = $('#export-operator-data-button');
  if (!window.confirm('이 파일에는 참가자별 실제 미션과 팀장 정보가 포함됩니다. 운영자에게만 전달하시겠습니까?')) return;
  button.disabled = true;
  try {
    const payload = raffle.exportOperatorData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, 'Everland_MT_operator_tickets.json');
    status.textContent = '운영자 기기로 전달할 파일을 저장했습니다. 실제 미션과 팀장 정보가 포함되어 있습니다.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
}

async function downloadCompleteResults() {
  const button = $('#download-complete-results-button');
  if (button.disabled) return;
  button.disabled = true;
  try {
    const results = raffle.exportResults();
    if (results.participants.length !== 15 || results.teams.length !== 3
      || results.teams.some((team) => team.members.length !== 5)) {
      throw new Error('최종 참가자 15명과 팀별 결과를 확인할 수 없습니다.');
    }
    const exporter = window.EverlandTicketExport;
    if (!exporter) throw new Error('티켓 이미지 생성기를 불러오지 못했습니다. 새로고침한 뒤 다시 시도하세요.');
    const logoDataUri = await exporter.loadLogoDataUri();
    const entries = [{
      name: 'Everland_MT_Results.json',
      blob: new Blob([JSON.stringify(results, null, 2)], { type: 'application/json;charset=utf-8' }),
    }];
    let ticketCount = 0;
    for (const resultTeam of results.teams) {
      const team = {
        id: resultTeam.teamId,
        teamNumber: resultTeam.teamNumber,
        label: resultTeam.label,
        difficulty: resultTeam.difficulty === 'HIGH' ? '상' : '중',
        ride: {
          name: resultTeam.ride.name,
          tag: resultTeam.ride.tag,
        },
        members: resultTeam.members.map((member) => member.id),
      };
      for (const member of resultTeam.members) {
        const ticket = {
          team,
          assignment: {
            participantId: member.id,
            missionIndex: member.missionIndex,
            missionType: member.missionType === 'SPECIAL' ? 'special' : 'general',
            missionText: member.missionText,
            isTeamLeader: member.isLeader,
            ticketNumber: member.ticketNumber,
          },
        };
        const png = await exporter.pngBlob(ticket, logoDataUri);
        entries.push({ name: 'Tickets/' + exporter.ticketFileName(ticket), blob: png });
        ticketCount += 1;
        status.textContent = '최종 결과와 티켓 ZIP을 준비하는 중입니다. PNG ' + ticketCount + '/15';
      }
    }
    if (ticketCount !== 15 || entries.length !== 16) throw new Error('ZIP에는 결과 JSON 1개와 티켓 PNG 15개가 있어야 합니다.');
    const zip = await exporter.buildZip(entries);
    for (const resultTeam of results.teams) {
      resultTeam.members.forEach((member) => raffle.markTicketCreated(resultTeam.teamId, member.id));
    }
    downloadBlob(zip, 'Everland_MT_Complete.zip');
    status.textContent = 'Everland_MT_Complete.zip 저장을 시작했습니다. JSON 1개와 개인 티켓 PNG 15개가 들어 있습니다.';
  } catch (error) {
    status.textContent = (error?.message || 'ZIP을 만들지 못했습니다.') + ' 다시 시도해 주세요.';
  } finally {
    button.disabled = false;
  }
}

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
    oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(time);
    oscillator.stop(time + duration + .03);
  },
  draw() {
    if (motionQuery.matches) return;
    for (let index = 0; index < 26; index += 1) this.note(270 + (index % 5) * 55, index * .09 + index * index * .0016, .055, .015, 'triangle');
  },
  chime() { [392, 523.25].forEach((frequency, index) => this.note(frequency, index * .07, .24)); },
  reveal() { [261.63, 329.63, 392, 523.25, 783.99].forEach((frequency, index) => this.note(frequency, .16 + index * .12, .55, .032)); },
  stop() { this.nodes.forEach((oscillator) => { try { oscillator.stop(); } catch {} }); this.nodes.clear(); },
};

nameDraw = new NameDraw({
  element: ownerScreen,
  onComplete: commitMember,
  onPhase(phase) { if (stage === 'owner') skipButton.hidden = phase !== 'spinning'; },
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
drawButton.addEventListener('click', continueCurrentTeam);
keepButton.addEventListener('click', () => {
  if (stage !== 'reveal' || keepButton.disabled) return;
  const team = currentTeamForDraw();
  if (team.config.kind === 'fixed') showMissionScreen();
  else startMemberDraw();
});
$('#mission-draw-button').addEventListener('click', drawMissions);
$('#mission-next-button').addEventListener('click', startLadder);
$('#ladder-next-button').addEventListener('click', advanceAfterLadder);
$('#export-operator-data-button').addEventListener('click', exportOperatorData);
$('#download-complete-results-button').addEventListener('click', downloadCompleteResults);
$('#brand-home').addEventListener('click', (event) => { event.preventDefault(); showHome(); });
skipButton.addEventListener('click', () => {
  if (stage === 'draw') showReveal(true);
  else if (stage === 'reveal') { cancelSequence(); publishResult(true); }
  else if (stage === 'owner') nameDraw.skip();
});
$('#reset-event').addEventListener('click', () => $('#reset-dialog').showModal());
$('#reset-final').addEventListener('click', () => $('#reset-dialog').showModal());
$('#cancel-reset').addEventListener('click', () => $('#reset-dialog').close());
$('#confirm-reset').addEventListener('click', () => {
  $('#reset-dialog').close();
  raffle.reset();
  selectedRide = null;
  selectedTeamId = null;
  showHome();
  status.textContent = '전체 추첨을 초기화했어요. 참가자 15명과 세 팀을 처음부터 다시 진행할 수 있습니다.';
});
window.addEventListener('resize', () => { if (stage === 'draw') updateCylinderSize(); }, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { effects.stop(); sound.stop(); }
  else if (stage === 'reveal' && selectedRide) effects.start(selectedRide.theme, {
    cinematic: revealPhase !== 'result',
    elapsed: Math.max(revealPhase === 'result' ? 5.5 : 0, (performance.now() - revealStartedAt) / 1000),
  });
});
motionQuery.addEventListener('change', () => {
  if (stage === 'intro') showHome();
  else if (stage === 'draw' && motionQuery.matches) showReveal(true);
  else if (stage === 'reveal' && motionQuery.matches) { cancelSequence(); publishResult(true); }
});

renderHome();
later(() => openingOverlay.classList.add('is-leaving'), motionQuery.matches ? 30 : 800);
later(() => { openingOverlay.hidden = true; }, motionQuery.matches ? 80 : 1600);
later(() => {
  if (stage !== 'intro') return;
  if (raffle.allComplete) showFinal();
  else showHome();
}, motionQuery.matches ? 150 : 2050);
