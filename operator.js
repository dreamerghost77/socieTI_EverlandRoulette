'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const pages = $('#ticket-pages');
const status = $('#operator-status');
const live = $('#operator-live');
const importedDataKey = 'everland-mt-operator-import-v1';
let raffle = null;
let ticketData = null;
let ticketRecords = [];
let logoDataUri = null;
let imageUrls = [];

function setStatus(message) {
  status.textContent = message;
  live.textContent = message;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

function wrapMission(text, maxCharacters = 29) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const parts = Array.from(word);
    if (parts.length > maxCharacters) {
      if (line) { lines.push(line); line = ''; }
      while (parts.length > maxCharacters) lines.push(parts.splice(0, maxCharacters).join(''));
      word = parts.join('');
    }
    const candidate = line ? line + ' ' + word : word;
    if (line && Array.from(candidate).length > maxCharacters) { lines.push(line); line = word; }
    else line = candidate;
  });
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function ticketSvg(ticket) {
  const { team, assignment } = ticket;
  const difficulty = team.difficulty === '상' ? 'HIGH DIFFICULTY' : 'MEDIUM DIFFICULTY';
  const teamMembers = team.members.join('  ·  ');
  const special = assignment.missionType === 'special';
  const typeLabel = special ? 'SPECIAL MISSION' : 'NORMAL MISSION';
  const typeColor = special ? '#a8710c' : '#138b89';
  const lines = wrapMission(assignment.missionText);
  const missionText = lines.map((line, index) => `<tspan x="100" dy="${index ? 56 : 0}">${escapeXml(line)}</tspan>`).join('');
  const leader = assignment.isTeamLeader
    ? '<g><rect x="870" y="478" width="220" height="62" rx="12" fill="#fff4d8" stroke="#cf9c2b" stroke-width="3"/><text x="980" y="519" text-anchor="middle" font-size="27" font-weight="800" fill="#946809">♛ TEAM LEADER</text></g>'
    : '';
  const specialAccent = special ? '#d5a33a' : '#00a8ad';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="148mm" height="105mm" viewBox="0 0 1480 1050">
    <rect x="12" y="12" width="1456" height="1026" rx="28" fill="#fff" stroke="#b8c5bc" stroke-width="5"/>
    <path d="M1130 25v1000" stroke="#7f9587" stroke-width="4" stroke-dasharray="12 13"/>
    <circle cx="1130" cy="12" r="19" fill="#fff" stroke="#b8c5bc" stroke-width="5"/><circle cx="1130" cy="1038" r="19" fill="#fff" stroke="#b8c5bc" stroke-width="5"/>
    <image x="56" y="37" width="292" height="88" preserveAspectRatio="xMinYMid meet" href="${escapeXml(logoDataUri)}"/>
    <text x="390" y="83" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#14241c" letter-spacing="3">EVERLAND MT</text>
    <text x="390" y="124" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#63756a" letter-spacing="2">SOCIAL CONTRIBUTION / ADVENTURE TICKET</text>
    <text x="1080" y="82" text-anchor="end" font-family="Arial, sans-serif" font-size="27" font-weight="800" fill="#264232">TEAM ${team.teamNumber}</text>
    <text x="1080" y="122" text-anchor="end" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#708477">${escapeXml(team.label)}</text>
    <line x1="55" y1="165" x2="1085" y2="165" stroke="#d7dfd9" stroke-width="3"/>
    <text x="60" y="225" font-family="Arial, sans-serif" font-size="23" font-weight="800" fill="#708477" letter-spacing="2">${difficulty}  /  TEAM ${team.teamNumber}</text>
    <text x="60" y="315" font-family="Arial, sans-serif" font-size="68" font-weight="900" fill="#203d2c">${escapeXml(team.ride.name)}</text>
    <text x="60" y="360" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="#63796a">${escapeXml(team.ride.tag || 'EVERLAND MT / RIDE ASSIGNMENT')}</text>
    <text x="60" y="448" font-family="Arial, sans-serif" font-size="20" font-weight="800" fill="#708477" letter-spacing="2">PARTICIPANT</text>
    <text x="60" y="572" font-family="Arial, sans-serif" font-size="110" font-weight="900" fill="#102c1e">${escapeXml(assignment.participantId)}</text>
    ${leader}
    <text x="420" y="477" font-family="Arial, sans-serif" font-size="17" font-weight="800" fill="#7a8c80" letter-spacing="1">TEAM MEMBERS</text>
    <text x="420" y="516" font-family="Arial, sans-serif" font-size="23" font-weight="750" fill="#385644">${escapeXml(teamMembers)}</text>
    <rect x="56" y="620" width="1030" height="330" rx="20" fill="${special ? '#fff8e8' : '#f2f8f5'}" stroke="${specialAccent}" stroke-width="${special ? '6' : '3'}"/>
    <rect x="82" y="644" width="14" height="34" rx="7" fill="${specialAccent}"/>
    <text x="116" y="673" font-family="Arial, sans-serif" font-size="28" font-weight="850" fill="${typeColor}" letter-spacing="2">YOUR SECRET MISSION  /  ${typeLabel}</text>
    <text x="100" y="752" font-family="Arial, sans-serif, 'Malgun Gothic'" font-size="41" font-weight="750" fill="#203d2c">${missionText}</text>
    <text x="60" y="1002" font-family="Arial, sans-serif" font-size="17" font-weight="750" fill="#7b8b80">KEEP THIS TICKET PRIVATE UNTIL THE MISSION BEGINS</text>
    <rect x="1173" y="214" width="236" height="144" rx="19" fill="#f1f8f5" stroke="#cbd8d0" stroke-width="3"/>
    <text x="1291" y="264" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" font-weight="800" fill="#60776a" letter-spacing="2">TICKET HOLDER</text>
    <text x="1291" y="329" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="900" fill="#183a2b">${escapeXml(assignment.participantId)}</text>
    <text x="1291" y="430" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="#718378">MISSION SLOT</text>
    <text x="1291" y="487" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="900" fill="#0b8f91">${String.fromCharCode(65 + assignment.missionIndex)}</text>
    ${assignment.isTeamLeader ? '<rect x="1182" y="560" width="218" height="67" rx="14" fill="#fff4d8" stroke="#cf9c2b" stroke-width="3"/><text x="1291" y="603" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="900" fill="#946809">♛ TEAM LEADER</text>' : ''}
    <line x1="1185" y1="691" x2="1398" y2="691" stroke="#cdd8d1" stroke-width="3"/>
    <text x="1291" y="744" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="750" fill="#708477" letter-spacing="2">TICKET ID</text>
    <text x="1291" y="784" text-anchor="middle" font-family="monospace" font-size="21" font-weight="800" fill="#243d2e">${escapeXml(assignment.ticketNumber)}</text>
    <path d="M1190 857h201" stroke="#253e2e" stroke-width="3" stroke-dasharray="4 8"/>
    <text x="1291" y="899" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="750" fill="#708477">TEAM ${team.teamNumber} · EVERLAND 2026</text>
  </svg>`;
}

function toTicketRecords(data) {
  return data.teams.flatMap((team) => team.assignments.map((assignment) => ({ team, assignment })));
}

function validateOperatorData(data) {
  if (!data || data.schema !== 'everland-mt-operator-tickets' || data.version !== 1 || !Array.isArray(data.teams) || data.teams.length !== 3) {
    throw new Error('지원하지 않는 운영자 파일 형식입니다.');
  }
  const participantIds = new Set();
  const ticketNumbers = new Set();
  data.teams.forEach((team, index) => {
    if (!team || team.teamNumber !== index + 1 || !team.complete || !Array.isArray(team.members) || team.members.length !== 5
      || !team.ride || !Array.isArray(team.assignments) || team.assignments.length !== 5) {
      throw new Error('팀 구성이나 추첨 결과가 완성되지 않은 파일입니다.');
    }
    const assigned = new Set();
    const slots = new Set();
    const missionIds = new Set();
    let specialCount = 0;
    let leaderCount = 0;
    team.assignments.forEach((assignment) => {
      if (!team.members.includes(assignment.participantId) || assigned.has(assignment.participantId)
        || participantIds.has(assignment.participantId) || !assignment.missionId || !assignment.missionText
        || !['special', 'general'].includes(assignment.missionType) || !Number.isInteger(assignment.missionIndex)
        || assignment.missionIndex < 0 || assignment.missionIndex > 4 || !assignment.ticketNumber) {
        throw new Error('참가자별 티켓 데이터가 올바르지 않습니다.');
      }
      assigned.add(assignment.participantId);
      participantIds.add(assignment.participantId);
      if (slots.has(assignment.missionIndex) || missionIds.has(assignment.missionId)) {
        throw new Error('한 팀의 미션 슬롯이나 미션이 중복되었습니다.');
      }
      slots.add(assignment.missionIndex);
      missionIds.add(assignment.missionId);
      if (assignment.missionType === 'special') specialCount += 1;
      if (assignment.isTeamLeader) leaderCount += 1;
      if (ticketNumbers.has(assignment.ticketNumber)) throw new Error('티켓 번호가 중복되었습니다.');
      ticketNumbers.add(assignment.ticketNumber);
    });
    if (team.members.some((id) => !assigned.has(id)) || specialCount !== 1 || leaderCount !== 1
      || team.assignments.find((assignment) => assignment.missionType === 'special')?.participantId !== team.leader) {
      throw new Error('팀별 스페셜 미션 또는 팀장 배정이 일치하지 않습니다.');
    }
  });
  if (participantIds.size !== 15) throw new Error('참가자 티켓이 15장인지 확인할 수 없습니다.');
  return data;
}

async function readLogo() {
  const response = await fetch('assets/social-contribution-logo.png');
  if (!response.ok) throw new Error('사회공헌단 로고를 불러오지 못했습니다.');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('로고 이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

function releaseImages() {
  imageUrls.forEach((url) => URL.revokeObjectURL(url));
  imageUrls = [];
}

function createTicketCard(ticket) {
  const card = document.createElement('article');
  card.className = 'ticket-card';
  card.dataset.ticketId = ticket.assignment.ticketNumber;
  const svg = new Blob([ticketSvg(ticket)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svg);
  imageUrls.push(url);
  const image = document.createElement('img');
  image.className = 'ticket-image';
  image.src = url;
  image.alt = ticket.assignment.participantId + ' 개인 티켓 · ' + ticket.assignment.missionText;
  const actions = document.createElement('div');
  actions.className = 'ticket-card-actions';
  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'button';
  download.textContent = 'PNG 저장';
  download.addEventListener('click', () => downloadPng(ticket));
  const print = document.createElement('button');
  print.type = 'button';
  print.className = 'button';
  print.textContent = '이 티켓 인쇄';
  print.addEventListener('click', () => printSingle(ticket));
  actions.append(download, print);
  card.append(image, actions);
  ticket.card = card;
  ticket.image = image;
  return card;
}

function renderTickets(data) {
  ticketData = data;
  ticketRecords = toTicketRecords(data);
  releaseImages();
  pages.replaceChildren();
  for (let start = 0; start < ticketRecords.length; start += 4) {
    const page = document.createElement('section');
    page.className = 'ticket-print-page';
    page.setAttribute('aria-label', '티켓 인쇄 페이지 ' + (Math.floor(start / 4) + 1));
    const heading = document.createElement('h2');
    heading.className = 'print-page-label';
    heading.textContent = 'PAGE ' + String(Math.floor(start / 4) + 1).padStart(2, '0') + ' / ' + String(Math.ceil(ticketRecords.length / 4)).padStart(2, '0');
    const grid = document.createElement('div');
    grid.className = 'ticket-print-grid';
    ticketRecords.slice(start, start + 4).forEach((ticket) => {
      ticket.page = page;
      grid.append(createTicketCard(ticket));
    });
    page.append(heading, grid);
    pages.append(page);
  }
  $('#operator-actions').hidden = false;
  $('#ticket-count').textContent = ticketRecords.length + '장 · 세 팀 추첨 완료';
  setStatus('개인 티켓 ' + ticketRecords.length + '장을 불러왔습니다. 팀별 미션은 각 티켓에만 표시됩니다.');
}

function saveImportedData(data) {
  try { localStorage.setItem(importedDataKey, JSON.stringify(data)); }
  catch { setStatus('운영자 데이터는 불러왔지만 이 기기에 저장하지 못했습니다. 파일을 보관해 주세요.'); }
}

function markCreated(ticket) {
  ticket.assignment.ticketCreated = true;
  if (raffle) {
    try { raffle.markTicketCreated(ticket.team.id, ticket.assignment.participantId); } catch {}
  }
  if (ticketData) saveImportedData(ticketData);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function pngName(ticket) {
  return 'Everland_MT_Team' + ticket.team.teamNumber + '_' + ticket.assignment.participantId + '.png';
}

function svgImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('티켓 이미지를 렌더링하지 못했습니다.'));
    image.src = url;
  });
}

async function pngBlob(ticket) {
  const svg = new Blob([ticketSvg(ticket)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svg);
  try {
    const image = await svgImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = 1748;
    canvas.height = 1240;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG 파일을 만들지 못했습니다.')), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function downloadPng(ticket) {
  try {
    const blob = await pngBlob(ticket);
    markCreated(ticket);
    downloadBlob(blob, pngName(ticket));
    setStatus(ticket.assignment.participantId + ' 티켓 PNG를 저장했습니다.');
  } catch (error) { setStatus(error.message); }
}

async function waitForImages() {
  await Promise.all(ticketRecords.map((ticket) => ticket.image.decode()));
}

function clearPrintMode() {
  document.body.classList.remove('print-all', 'print-single');
  document.querySelectorAll('.ticket-card.is-print-selected').forEach((card) => card.classList.remove('is-print-selected'));
  document.querySelectorAll('.ticket-print-page.is-print-selected-page').forEach((page) => page.classList.remove('is-print-selected-page'));
}

async function printSingle(ticket) {
  try {
    await waitForImages();
    ticket.card.classList.add('is-print-selected');
    ticket.page.classList.add('is-print-selected-page');
    document.body.classList.add('print-single');
    markCreated(ticket);
    window.print();
  } catch (error) { clearPrintMode(); setStatus(error.message); }
}

async function printAll() {
  try {
    await waitForImages();
    ticketRecords.forEach(markCreated);
    document.body.classList.add('print-all');
    window.print();
  } catch (error) { clearPrintMode(); setStatus(error.message); }
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function zipFiles(entries) {
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
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entries.length, true);
  view.setUint16(10, entries.length, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, localOffset, true);
  return new Blob([...localChunks, ...centralChunks, end], { type: 'application/zip' });
}

async function downloadAll() {
  const button = $('#download-all');
  button.disabled = true;
  try {
    const entries = [];
    for (const ticket of ticketRecords) entries.push({ name: pngName(ticket), blob: await pngBlob(ticket) });
    ticketRecords.forEach(markCreated);
    downloadBlob(await zipFiles(entries), 'Everland_MT_15_individual_tickets.zip');
    setStatus('개인 티켓 PNG 15장을 ZIP 파일로 저장했습니다.');
  } catch (error) { setStatus(error.message); }
  finally { button.disabled = false; }
}

async function importOperatorFile(file) {
  try {
    const data = validateOperatorData(JSON.parse(await file.text()));
    raffle = null;
    saveImportedData(data);
    renderTickets(data);
  } catch (error) { setStatus(error.message || '운영자 파일을 읽지 못했습니다.'); }
}

async function startOperatorView() {
  try {
    logoDataUri = await readLogo();
    raffle = new EventRaffle.RaffleState();
    if (raffle.allComplete) {
      renderTickets(validateOperatorData(raffle.exportOperatorData()));
      return;
    }
    const savedImport = localStorage.getItem(importedDataKey);
    if (savedImport) {
      renderTickets(validateOperatorData(JSON.parse(savedImport)));
      return;
    }
    setStatus('같은 브라우저에 완료된 추첨 결과가 없습니다. 공개 화면에서 받은 JSON 파일을 가져오세요.');
  } catch (error) { setStatus(error.message); }
}

$('#confirm-operator').addEventListener('click', () => {
  $('#operator-warning').close();
  startOperatorView();
});
$('#leave-operator').addEventListener('click', () => { window.location.href = 'index.html'; });
$('#operator-file').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) importOperatorFile(file);
});
$('#print-all').addEventListener('click', printAll);
$('#download-all').addEventListener('click', downloadAll);
window.addEventListener('afterprint', clearPrintMode);
window.addEventListener('beforeunload', releaseImages);

$('#operator-warning').showModal();
