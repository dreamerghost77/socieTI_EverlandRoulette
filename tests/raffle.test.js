'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { participants } = require('../participants.js');
const { rides, teams, generalMissions, specialMissions } = require('../event-data.js');
const { createLadder, getPermutation, traceLadder, validateLadder } = require('../ladder.js');
const { RaffleState, storageKey } = require('../raffle-state.js');

class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function stableRandom(length) { return length - 1; }

function fillRandomTeam(model, teamId) {
  while (model.getTeam(teamId).members.length < 5) {
    const group = model.drawInitialGroup(teamId);
    model.addMember(teamId, group.candidates.at(-1).id);
  }
}

function completeEveryTeam(model) {
  teams.forEach((team, index) => {
    model.drawRide(team.id);
    if (team.kind === 'random') fillRandomTeam(model, team.id);
    model.drawMissions(team.id);
    model.createLadder(team.id);
    model.getTeam(team.id).members.forEach((participantId) => model.matchParticipant(team.id, participantId));
    if (index < teams.length - 1) model.advanceTeam();
  });
}

function storedTeam(model, teamId) {
  return model.state.teams.find((team) => team.id === teamId);
}

test('event roster has 15 valid participants and reserves the fixed medium team', () => {
  assert.equal(participants.length, 15);
  assert.equal(participants.some((person) => person.id === 'JW'), false);
  assert.deepEqual(teams[2].members, ['BJ', 'MYJ', 'JT', 'KW', 'CYJ']);
  const model = new RaffleState({ storage: new MemoryStorage(), randomIndex: stableRandom });
  assert.equal(model.getAvailableParticipants().length, 10);
  assert.equal(model.getAvailableParticipants().some((person) => teams[2].members.includes(person.id)), false);
});

test('mission pools exactly match the requested four specials and eighteen general missions', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(specialMissions).map(([theme, mission]) => [theme, mission.text])), {
    timber: '공식 사진 구간에서 양손 브이 포즈로 사진찍히기',
    thunder: '탑승 이후 제일 물 많이 맞은 사람으로 지목되기',
    river: '탑승 이후 제일 물 많이 맞은 사람으로 지목되기',
    storm: '탑승 전 1~100 사이 숫자 5개 뽑기 이후 탑승 이후 기억력테스트 성공하기',
  });
  assert.deepEqual(generalMissions.map((mission) => mission.text), [
    '본인 포함 팀원 3명 이상 츄러스 사먹기',
    '직원의 동의를 구한 뒤 셀카 찍기',
    '릴스 형식의 에버랜드 홍보 영상 찍기',
    '모르는 사람에게 사회공헌단 명함 건네고 응원받기',
    '에버랜드에서 빨주노초파남보 색깔 7가지 찾아오기',
    '본인이 중앙을 차지한 단체사진 3개 이상 찍기',
    '사회공헌 활동 이후 인증(예: 쓰레기 주워 분리수거)',
    '본인이 낙오된 단체사진 한 장 이상 찍기',
    '모두가 정면을 바라보지 않는 단체사진 1장 이상 찍기',
    '본인 제외 다른 팀원들의 단독사진 1장씩 찍어오기',
    '틈내서 김홍종 미적분학 연습문제 3개 풀기',
    '다른 팀 만나서 사진찍기',
    '다른 단원 한 명을 지목해 1분 동안 공주님·왕자님처럼 모시기',
    '에버랜드 머리띠 쓰고 2시간 이상 돌아다니기',
    '에버랜드에서 공주님·왕자님 콘셉트로 인생샷 찍기',
    '팀원들이 정해준 별명으로 1시간 동안 불리기',
    '에버랜드에서 혼자 패션 화보 3장 찍기',
    '다른 단원 한 명과 연애 프로그램 첫 만남 장면 연기하기',
  ]);
});

test('the three teams draw the required rides without repeating a difficulty ride', () => {
  const model = new RaffleState({ storage: new MemoryStorage(), randomIndex: stableRandom });
  const highOne = model.drawRide('high-1');
  const highTwo = model.drawRide('high-2');
  const medium = model.drawRide('medium-1');
  assert.equal(highOne.difficulty, '상');
  assert.equal(highTwo.difficulty, '상');
  assert.notEqual(highOne.theme, highTwo.theme);
  assert.equal(medium.difficulty, '중');
  assert.equal(new Set([highOne.theme, highTwo.theme, medium.theme]).size, 3);
  assert.equal(model.getAvailableRides('상').length, 0);
});

test('participant draws are sequential, unique, and preserve the duplicate-initial card group', () => {
  const model = new RaffleState({ storage: new MemoryStorage(), randomIndex: () => 0 });
  model.drawRide('high-1');
  const first = model.drawInitialGroup('high-1');
  assert.deepEqual(first.candidates.map((person) => person.id), ['KMK', 'PMK']);
  model.addMember('high-1', first.candidates[0].id);
  fillRandomTeam(model, 'high-1');
  fillRandomTeam(model, 'high-2');
  assert.equal(model.getTeam('high-1').members.length, 5);
  assert.equal(model.getTeam('high-2').members.length, 5);
  assert.equal(model.getAvailableParticipants().length, 0);
  const allMembers = model.teams.flatMap((team) => team.members);
  assert.equal(allMembers.length, 15);
  assert.equal(new Set(allMembers).size, 15);
});

test('pending participant draw resumes and legacy JW assignments are discarded', () => {
  const storage = new MemoryStorage({
    'everland-event-tickets-v1': JSON.stringify({ version: 1, assignments: [{ participantId: 'JW' }] }),
  });
  const model = new RaffleState({ storage, randomIndex: stableRandom });
  model.drawRide('high-1');
  const pending = model.drawInitialGroup('high-1');
  const resumed = new RaffleState({ storage, randomIndex: stableRandom });
  const resumedGroup = resumed.drawInitialGroup('high-1');
  assert.equal(storage.getItem('everland-event-tickets-v1'), null);
  assert.equal(resumedGroup.initials, pending.initials);
  assert.deepEqual(resumedGroup.candidates.map((person) => person.id), pending.candidates.map((person) => person.id));
  assert.equal(resumed.getAvailableParticipants().some((person) => person.id === 'JW'), false);
});

test('v2 state keeps rides and participants but resets old mission and ladder results', () => {
  const storage = new MemoryStorage({
    'everland-mt-draw-v2': JSON.stringify({
      version: 2,
      activeTeamIndex: 1,
      teams: [
        { id: 'high-1', rideTheme: 'timber', members: ['KMK', 'MJ', 'MH', 'SB', 'PMK'], missionIds: ['special-timber', 'general-churros', 'general-staff-selfie', 'general-reels', 'general-card'], ladder: { columns: 5, rows: [[0]] }, matches: [], complete: false },
        { id: 'high-2', rideTheme: null, members: [], pendingGroup: null },
        { id: 'medium-1', rideTheme: null, members: ['BJ', 'MYJ', 'JT', 'KW', 'CYJ'] },
      ],
    }),
  });
  const model = new RaffleState({ storage });
  const team = model.getTeam('high-1');
  assert.equal(model.migratedLegacyState, true);
  assert.equal(team.ride.theme, 'timber');
  assert.deepEqual(team.members, ['KMK', 'MJ', 'MH', 'SB', 'PMK']);
  assert.equal(team.missionCount, 0);
  assert.equal(team.ladder, null);
  assert.equal(team.phase, 'missions');
  assert.equal(JSON.parse(storage.getItem(storageKey)).version, 3);
});

test('the special mission moves to a shuffled slot instead of always occupying the first slot', () => {
  const specialPositionFor = (randomIndex) => {
    const model = new RaffleState({ storage: new MemoryStorage(), randomIndex });
    const ride = model.drawRide('medium-1');
    model.drawMissions('medium-1');
    return storedTeam(model, 'medium-1').missionIds.indexOf(specialMissions[ride.theme].id);
  };
  assert.equal(specialPositionFor(() => 0), 4);
  assert.equal(specialPositionFor(stableRandom), 0);
});

test('ladder rungs do not overlap and the structure maps every input to one unique output', () => {
  let seed = 91231;
  const randomIndex = (length) => { seed = (seed * 48271) % 2147483647; return seed % length; };
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const ladder = createLadder(5, 10, randomIndex);
    assert.equal(validateLadder(ladder), true);
    ladder.rows.forEach((row) => row.forEach((rung, index) => {
      if (index) assert.ok(rung - row[index - 1] > 1);
    }));
    const permutation = getPermutation(ladder);
    assert.deepEqual([...permutation].sort(), [0, 1, 2, 3, 4]);
    permutation.forEach((destination, start) => assert.equal(traceLadder(ladder, start).destination, destination));
  }
});

test('ladder edges determine the shuffled special mission winner and stay stable after reload', () => {
  const storage = new MemoryStorage();
  const model = new RaffleState({ storage, randomIndex: stableRandom });
  model.drawRide('high-1');
  fillRandomTeam(model, 'high-1');
  const team = model.getTeam('high-1');
  assert.equal(model.drawMissions('high-1').count, 5);
  const missionIds = storedTeam(model, 'high-1').missionIds;
  const specialIndex = missionIds.indexOf(specialMissions[team.ride.theme].id);
  assert.ok(specialIndex >= 0 && specialIndex < 5);
  assert.equal(missionIds.filter((id) => id === specialMissions[team.ride.theme].id).length, 1);
  assert.equal(missionIds.filter((id) => generalMissions.some((mission) => mission.id === id)).length, 4);
  assert.equal(new Set(missionIds).size, 5);
  const publicTeam = model.getTeam('high-1');
  assert.equal(publicTeam.missionCount, 5);
  assert.equal('missionIds' in publicTeam, false);
  assert.equal('missions' in publicTeam, false);
  assert.equal(publicTeam.leader, null);
  assert.equal(publicTeam.missionSlots.filter((slot) => slot.type === 'special').length, 1);
  assert.equal(publicTeam.missionSlots.filter((slot) => slot.type === 'general').length, 4);
  assert.equal(JSON.stringify(publicTeam).includes(specialMissions[team.ride.theme].text), false);
  const ladder = model.createLadder('high-1');
  const expected = getPermutation(ladder);
  assert.throws(() => model.advanceTeam());
  team.members.forEach((id) => model.matchParticipant('high-1', id));
  const complete = model.getTeam('high-1');
  assert.equal(complete.complete, true);
  assert.equal(complete.matches.length, 5);
  complete.matches.forEach((match) => assert.equal(match.missionIndex, expected[team.members.indexOf(match.participantId)]));
  const operatorTeam = model.getOperatorTeams().find((entry) => entry.id === 'high-1');
  const specialWinner = team.members[expected.indexOf(specialIndex)];
  assert.equal(operatorTeam.leader, specialWinner);
  assert.equal(operatorTeam.assignments.find((assignment) => assignment.missionType === 'special').participantId, specialWinner);
  assert.equal(operatorTeam.assignments.filter((assignment) => assignment.isTeamLeader).length, 1);
  assert.equal(complete.leader, specialWinner);
  assert.equal(complete.matches.find((match) => match.participantId === specialWinner).missionType, 'special');
  assert.equal(complete.matches.find((match) => match.participantId === specialWinner).isTeamLeader, true);
  assert.equal(JSON.stringify(complete).includes(specialMissions[team.ride.theme].text), false);
  assert.equal('missionId' in complete.matches[0], false);
  model.markTicketCreated('high-1', specialWinner);
  assert.equal(model.advanceTeam().config.id, 'high-2');
  const restoredModel = new RaffleState({ storage, randomIndex: stableRandom });
  const restored = restoredModel.getTeam('high-1');
  assert.deepEqual(restored.ladder, ladder);
  assert.deepEqual(restored.matches, complete.matches);
  assert.equal(restoredModel.getOperatorTeams().find((entry) => entry.id === 'high-1').leader, specialWinner);
  assert.equal(restoredModel.getOperatorTeams().find((entry) => entry.id === 'high-1').assignments.find((assignment) => assignment.participantId === specialWinner).ticketCreated, true);
});

test('final JSON export contains the complete stable draw, ladder paths, missions, and leaders', () => {
  const storage = new MemoryStorage();
  const model = new RaffleState({ storage, randomIndex: stableRandom });
  completeEveryTeam(model);
  assert.equal(model.allComplete, true);

  const result = model.exportResults();
  assert.equal(result.eventName, 'EVERLAND MT');
  assert.equal(Number.isNaN(Date.parse(result.completedAt)), false);
  assert.equal(result.participantCount, 15);
  assert.equal(result.teamCount, 3);
  assert.equal(result.participants.length, 15);
  assert.equal(new Set(result.participants.map((participant) => participant.id)).size, 15);

  result.teams.forEach((team) => {
    assert.equal(team.members.length, 5);
    assert.equal(team.ladder.assignments.length, 5);
    assert.equal(team.ladder.connections.length, team.ladder.rows.reduce((sum, row) => sum + row.length, 0));
    assert.equal(team.members.filter((member) => member.missionType === 'SPECIAL').length, 1);
    assert.equal(team.members.filter((member) => member.isLeader).length, 1);
    assert.equal(team.members.find((member) => member.missionType === 'SPECIAL').id, team.leaderId);
    team.members.forEach((member) => {
      assert.ok(member.missionId);
      assert.ok(member.missionText);
      assert.equal(member.missionSlot, String.fromCharCode(65 + member.missionIndex));
      const ladderAssignment = team.ladder.assignments.find((entry) => entry.participantId === member.id);
      assert.equal(ladderAssignment.missionId, member.missionId);
      assert.equal(ladderAssignment.destinationSlot, member.missionIndex);
      assert.equal(ladderAssignment.isLeader, member.isLeader);
    });
  });
  assert.deepEqual(model.exportResults(), result);

  const restored = new RaffleState({ storage, randomIndex: stableRandom });
  assert.deepEqual(restored.exportResults(), result);
});

test('a completed participant cannot be reselected to alter their mission', () => {
  const model = new RaffleState({ storage: new MemoryStorage(), randomIndex: stableRandom });
  model.drawRide('high-1');
  fillRandomTeam(model, 'high-1');
  model.drawMissions('high-1');
  model.createLadder('high-1');
  const id = model.getTeam('high-1').members[0];
  const first = model.matchParticipant('high-1', id);
  const again = model.matchParticipant('high-1', id);
  assert.equal(again.missionIndex, first.missionIndex);
  assert.equal(model.getTeam('high-1').matches.length, 1);
});

test('fixed medium participants are not drawn again and the medium ride has its own special mission', () => {
  const model = new RaffleState({ storage: new MemoryStorage(), randomIndex: stableRandom });
  const ride = model.drawRide('medium-1');
  const team = model.getTeam('medium-1');
  assert.equal(team.members.length, 5);
  assert.deepEqual(team.members, teams[2].members);
  model.drawMissions('medium-1');
  assert.ok(storedTeam(model, 'medium-1').missionIds.includes(specialMissions[ride.theme].id));
  assert.equal(model.getTeam('medium-1').missionCount, 5);
  assert.equal(storageKey, 'everland-mt-draw-v3');
});
