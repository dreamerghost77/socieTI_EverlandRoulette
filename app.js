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
  $('#mission-description').textContent = '놀이기구에 연결된 스페셜 미션 1개와 일반 미션 4개를 뽑습니다. 아직 참가자와 연결하지 않아요.';
  $('#mission-draw-button').hidden = Boolean(team.missions.length);
  $('#mission-next-button').hidden = !team.missions.length;
  renderMissionCards(team, false);
  $('#footer-caption').textContent = team.config.label.toUpperCase() + ' / MISSION DRAW';
  status.textContent = team.missions.length ? '확정된 미션을 확인하고 사다리를 생성하세요.' : '스페셜 미션과 일반 미션을 차례로 뽑아보세요.';
  focusHeading('#mission-heading');
}

function renderMissionCards(team, animate) {
  const container = $('#mission-card-grid');
  container.replaceChildren();
  let generalNumber = 0;
  team.missions.forEach((mission, index) => {
    const card = document.createElement('article');
    card.className = 'mission-card ' + (mission.type === 'special' ? 'is-special' : 'is-general') + (animate ? ' is-flipping' : ' is-flipped');
    card.style.setProperty('--flip-delay', (animate ? index * 170 : 0) + 'ms');
    const back = document.createElement('div');
    back.className = 'mission-card-back';
    back.setAttribute('aria-hidden', 'true');
    back.innerHTML = '<span>✦</span><small>EVERLAND<br>MISSION</small>';
    const face = document.createElement('div');
    face.className = 'mission-card-face';
    const label = document.createElement('span');
    label.className = 'mission-type';
    if (mission.type === 'general') generalNumber += 1;
    label.textContent = mission.type === 'special' ? '✦ SPECIAL MISSION' : 'GENERAL MISSION / 0' + generalNumber;
    const text = document.createElement('p');
    text.textContent = mission.text;
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
  status.textContent = '스페셜 미션과 일반 미션 네 개를 추첨했어요.';
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
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ladder-player' + (match ? ' is-matched' : '') + (id === team.leader ? ' is-leader' : '');
    button.textContent = id;
    button.disabled = !ladderReady || ladderAnimating || Boolean(match);
    button.setAttribute('aria-label', match ? id + ' 미션 배정 완료' : id + ' 사다리타기 시작');
    button.addEventListener('click', () => matchParticipant(id));
    container.append(button);
  });
}

function renderLadderMissions(team) {
  const container = $('#ladder-bottom-missions');
  container.replaceChildren();
  team.missions.forEach((mission, index) => {
    const card = document.createElement('article');
    const assigned = team.matches.find((match) => match.missionIndex === index);
    card.className = 'ladder-mission' + (mission.type === 'special' ? ' is-special' : '') + (assigned ? ' is-assigned' : '');
    if (assigned) card.dataset.assignee = assigned.participantId;
    const label = document.createElement('span');
    label.textContent = mission.type === 'special' ? '✦ SPECIAL' : 'MISSION 0' + (index + 1);
    const text = document.createElement('p');
    text.textContent = mission.text;
    const assignee = document.createElement('strong');
    assignee.textContent = assigned ? (assigned.participantId === team.leader ? '♛ ' : '') + assigned.participantId : '도착 대기';
    card.append(label, text, assignee);
    container.append(card);
  });
}

function renderLadderResults(team) {
  const list = $('#ladder-result-list');
  list.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = team.complete ? 'TEAM COMPLETE / 최종 미션 배정' : '확정된 경로';
  list.append(heading);
  team.members.forEach((id) => {
    const match = team.matches.find((entry) => entry.participantId === id);
    const row = document.createElement('div');
    row.className = 'ladder-result-row' + (id === team.leader ? ' is-leader' : '');
    const name = document.createElement('strong');
    name.textContent = (id === team.leader ? '♛ ' : '') + id + (id === team.leader ? ' · LEADER' : '');
    const mission = document.createElement('span');
    mission.textContent = match ? team.missions[match.missionIndex].text : '사다리 결과 대기';
    row.append(name, mission);
    list.append(row);
  });
}

function updateLeaderCallout(team, newLeader = false) {
  const callout = $('#ladder-leader-callout');
  if (!team.leader) { callout.hidden = true; callout.textContent = ''; return; }
  callout.hidden = false;
  callout.classList.toggle('is-celebrating', newLeader);
  callout.textContent = '♛  TEAM LEADER · ' + team.leader + (newLeader ? ' · 스페셜 미션 당첨!' : '');
}

function celebrateLeader() {
  const wrap = $('#ladder-svg-wrap');
  wrap.classList.add('is-leader-burst');
  const colors = ['#ffd66b', '#c4f89a', '#67f1e4', '#f69dff', '#8ab5ff'];
  for (let index = 0; index < 36; index += 1) {
    const piece = document.createElement('span');
    piece.className = 'leader-confetti';
    piece.style.left = (18 + Math.random() * 64) + '%';
    piece.style.setProperty('--confetti-color', colors[index % colors.length]);
    piece.style.setProperty('--fall-x', (Math.random() * 320 - 160) + 'px');
    piece.style.setProperty('--fall-y', (130 + Math.random() * 260) + 'px');
    piece.style.setProperty('--confetti-delay', (Math.random() * 260) + 'ms');
    wrap.append(piece);
  }
  later(() => {
    $$('.leader-confetti', wrap).forEach((piece) => piece.remove());
    wrap.classList.remove('is-leader-burst');
  }, 2300);
}

function renderLadder(team, animateStructure) {
  renderLadderPlayers(team);
  const rungCount = renderLadderStructure(team, animateStructure);
  renderLadderMissions(team);
  renderLadderResults(team);
  updateLeaderCallout(team);
  const next = $('#ladder-next-button');
  next.hidden = !team.complete;
  next.textContent = raffle.activeTeamIndex === 2 ? '세 팀 최종 티켓 보기' : '팀 티켓 완성 · 다음 팀으로';
  if (team.complete) {
    $('#ladder-heading').textContent = '사다리 결과가 모두 정해졌어요.';
    $('#ladder-description').textContent = '스페셜 미션 당첨자가 팀장이 되고, 다섯 경로가 티켓에 기록됐어요.';
  } else {
    $('#ladder-heading').textContent = '이니셜을 눌러 미션을 연결하세요.';
    $('#ladder-description').textContent = '빛이 지나간 경로는 계속 남아 있어요. 참가자를 한 명씩 선택하세요.';
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
  const specialWinner = match.missionIndex === 0;
  if (specialWinner) {
    updateLeaderCallout(updated, true);
    sound.reveal();
    celebrateLeader();
  }
  status.textContent = participantId + '의 사다리 경로가 ' + updated.missions[match.missionIndex].text + '에 도착했습니다.';
  const finish = () => {
    ladderAnimating = false;
    renderLadderPlayers(raffle.getTeam(team.id));
    renderLadderResults(raffle.getTeam(team.id));
    if (raffle.getTeam(team.id).complete) {
      $('#ladder-heading').textContent = '다섯 명 모두 미션을 받았어요!';
      $('#ladder-description').textContent = '스페셜 미션 당첨자를 팀장으로 기록했습니다.';
      $('#ladder-next-button').hidden = false;
      $('#ladder-next-button').textContent = raffle.activeTeamIndex === 2 ? '세 팀 최종 티켓 보기' : '팀 티켓 완성 · 다음 팀으로';
      status.textContent = '팀의 미션 매칭이 완료됐어요. 팀 티켓을 완성합니다.';
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
      if (id === team.leader) chip.classList.add('is-leader');
      members.append(chip);
    });
    const progress = document.createElement('small');
    progress.textContent = team.complete ? 'TEAM COMPLETE' : team.members.length + ' / 5 MEMBERS · ' + (team.missions.length || 0) + ' / 5 MISSIONS';
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
  $('.mission-slot strong').textContent = team.missions.length ? team.missions.length + '개 미션 확정' : '스페셜 1개 + 일반 4개';
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
  $('#draw-note').textContent = phase === 'ride'
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

function createFinalTicket(team) {
  const article = document.createElement('article');
  article.className = 'final-ticket';
  article.dataset.difficulty = team.config.difficulty;
  const top = document.createElement('header');
  top.className = 'final-ticket-top';
  const label = document.createElement('span');
  label.textContent = 'EVERLAND / ADVENTURE PASS';
  const number = document.createElement('strong');
  number.textContent = team.config.label.toUpperCase();
  top.append(label, number);
  const ride = document.createElement('div');
  ride.className = 'final-ticket-ride';
  ride.append(makeIcon(team.ride.theme));
  const rideText = document.createElement('div');
  const difficulty = document.createElement('span');
  difficulty.textContent = team.config.difficulty + ' 난이도 · ' + team.config.number + '팀';
  const rideName = document.createElement('strong');
  rideName.textContent = team.ride.name;
  rideText.append(difficulty, rideName);
  ride.append(rideText);
  const list = document.createElement('ol');
  list.className = 'final-ticket-members';
  team.members.forEach((id) => {
    const match = team.matches.find((entry) => entry.participantId === id);
    const mission = team.missions[match.missionIndex];
    const row = document.createElement('li');
    row.className = mission.type === 'special' ? 'is-special' : '';
    const person = document.createElement('strong');
    person.textContent = (id === team.leader ? '♛ ' : '') + id;
    if (id === team.leader) person.classList.add('is-leader');
    const assignment = document.createElement('div');
    const kind = document.createElement('span');
    kind.textContent = mission.type === 'special' ? '✦ SPECIAL MISSION' : 'MISSION';
    const text = document.createElement('p');
    text.textContent = mission.text;
    assignment.append(kind, text);
    row.append(person, assignment);
    list.append(row);
  });
  const footer = document.createElement('footer');
  footer.textContent = '♛ TEAM LEADER · ' + team.leader + '     ✦ TEAM COMPLETE';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'text-button download-ticket-button';
  button.textContent = 'PNG 저장 ↓';
  button.addEventListener('click', () => saveTicketPng(team));
  article.append(top, ride, list, footer, button);
  return article;
}

function showFinal() {
  setStage('final');
  setAccent(null);
  const container = $('#final-ticket-grid');
  container.replaceChildren();
  raffle.teams.forEach((team) => container.append(createFinalTicket(team)));
  $('#footer-caption').textContent = 'THREE TEAMS / ALL TICKETS COMPLETE';
  status.textContent = '세 팀의 완성된 티켓을 확인하고 PNG 또는 ZIP으로 저장할 수 있어요.';
  focusHeading('#final-heading');
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 8) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? line + ' ' + word : word;
    if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
    else line = candidate;
  });
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) visible[maxLines - 1] = visible[maxLines - 1].replace(/[.…]+$/, '') + '…';
  visible.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  return visible.length;
}

function ticketCanvas(team) {
  const canvas = document.createElement('canvas');
  canvas.width = 3600;
  canvas.height = 2400;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#e7eddf';
  roundedRect(ctx, 0, 0, 1800, 1200, 24);
  ctx.fill();
  ctx.fillStyle = '#c4f89a';
  ctx.fillRect(1690, 0, 110, 1200);
  ctx.strokeStyle = 'rgba(33,67,41,.3)';
  ctx.setLineDash([7, 8]);
  ctx.beginPath(); ctx.moveTo(1690, 22); ctx.lineTo(1690, 1178); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#243c2c';
  ctx.font = '800 27px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.fillText('EVERLAND / ADVENTURE PASS', 70, 78);
  ctx.fillStyle = '#637762';
  ctx.font = '600 18px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.fillText(team.config.difficulty + ' 난이도   ·   TEAM ' + (team.config.difficulty === '상' ? 'H' : 'M') + '0' + team.config.number, 70, 125);
  ctx.fillStyle = '#274b33';
  ctx.font = '900 54px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.fillText(team.ride.name, 70, 205);
  ctx.fillStyle = '#55735c';
  ctx.font = '600 18px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.fillText('ATTRACTION CONFIRMED / ' + team.ride.tag, 70, 244);
  ctx.strokeStyle = 'rgba(61,99,66,.24)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(70, 285); ctx.lineTo(1650, 285); ctx.stroke();
  const cardTop = 320;
  const cardHeight = 720;
  const cardGap = 16;
  const cardWidth = (1580 - cardGap * 4) / 5;
  team.members.forEach((id, index) => {
    const match = team.matches.find((entry) => entry.participantId === id);
    const mission = team.missions[match.missionIndex];
    const x = 70 + index * (cardWidth + cardGap);
    const special = mission.type === 'special';
    ctx.fillStyle = special ? '#fff3d6' : '#f5f7ef';
    ctx.strokeStyle = special ? '#d6a43c' : 'rgba(70,108,60,.23)';
    ctx.lineWidth = special ? 3 : 2;
    roundedRect(ctx, x, cardTop, cardWidth, cardHeight, 12);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = special ? '#a77919' : '#71856c';
    ctx.font = '700 17px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    ctx.fillText(special ? '✦ SPECIAL MISSION' : 'MISSION 0' + (match.missionIndex + 1), x + 22, cardTop + 42);
    ctx.fillStyle = '#28422e';
    ctx.font = '900 47px monospace';
    ctx.fillText(id, x + 22, cardTop + 115);
    if (id === team.leader) {
      ctx.fillStyle = '#b78a25';
      ctx.font = '800 16px sans-serif';
      ctx.fillText('♛ TEAM LEADER', x + 22, cardTop + 152);
    }
    ctx.strokeStyle = 'rgba(61,99,66,.18)';
    ctx.beginPath(); ctx.moveTo(x + 22, cardTop + 180); ctx.lineTo(x + cardWidth - 22, cardTop + 180); ctx.stroke();
    ctx.fillStyle = '#344e39';
    ctx.font = '600 22px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    wrapCanvasText(ctx, mission.text, x + 22, cardTop + 230, cardWidth - 44, 34, 12);
  });
  ctx.fillStyle = '#345a3e';
  ctx.font = '900 28px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.fillText('TEAM COMPLETE', 70, 1110);
  ctx.fillStyle = '#59745d';
  ctx.font = '600 19px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.fillText('TEAM LEADER  ♛  ' + team.leader + '     /     5 PARTICIPANTS · 5 MISSIONS', 70, 1152);
  ctx.fillStyle = '#29402a';
  ctx.font = '700 19px monospace';
  ctx.save();
  ctx.translate(1748, 880);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('EVERLAND / MT / 2026', 0, 0);
  ctx.restore();
  return canvas;
}

function canvasPng(team) {
  return new Promise((resolve, reject) => {
    ticketCanvas(team).toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG 이미지를 만들지 못했습니다.')), 'image/png');
  });
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

function filenameFor(team) {
  return 'Everland_MT_' + (team.config.difficulty === '상' ? 'High' : 'Medium') + '_Team_' + team.config.number + '.png';
}

async function saveTicketPng(team) {
  try {
    const blob = await canvasPng(team);
    downloadBlob(blob, filenameFor(team));
    status.textContent = team.config.label + ' 티켓을 PNG로 저장했어요.';
  } catch (error) { status.textContent = error.message; }
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function zipPngFiles(entries) {
  const encoder = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const payload = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(payload);
    const local = new Uint8Array(30 + name.length + payload.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, payload.length, true);
    localView.setUint32(22, payload.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(payload, 30 + name.length);
    localChunks.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 0x0314, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, payload.length, true);
    centralView.setUint32(24, payload.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralChunks.push(central);
    localOffset += local.length;
  }
  const centralSize = centralChunks.reduce((total, chunk) => total + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  return new Blob([...localChunks, ...centralChunks, end], { type: 'application/zip' });
}

async function saveAllTickets() {
  const button = $('#download-all-button');
  button.disabled = true;
  try {
    const entries = [];
    for (const team of raffle.teams) entries.push({ name: filenameFor(team), blob: await canvasPng(team) });
    downloadBlob(await zipPngFiles(entries), 'Everland_MT_Team_Tickets.zip');
    status.textContent = '완성된 세 팀의 티켓을 PNG 세 장이 들어 있는 ZIP으로 저장했어요.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
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
$('#download-all-button').addEventListener('click', saveAllTickets);
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
