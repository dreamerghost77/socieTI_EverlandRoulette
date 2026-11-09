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

function ticketSvg(ticket) {
  return window.EverlandTicketExport.ticketSvg(ticket, logoDataUri);
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
  return window.EverlandTicketExport.loadLogoDataUri();
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
  return window.EverlandTicketExport.ticketFileName(ticket);
}

async function pngBlob(ticket) {
  return window.EverlandTicketExport.pngBlob(ticket, logoDataUri);
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

async function downloadAll() {
  const button = $('#download-all');
  button.disabled = true;
  try {
    const entries = [];
    for (const ticket of ticketRecords) entries.push({ name: pngName(ticket), blob: await pngBlob(ticket) });
    ticketRecords.forEach(markCreated);
    downloadBlob(await window.EverlandTicketExport.buildZip(entries), 'Everland_MT_15_individual_tickets.zip');
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
