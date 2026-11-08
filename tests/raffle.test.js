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

test('event roster has 15 valid participants and reserves the fixed medium team', () => {
  assert.equal(participants.length, 15);
  assert.equal(participants.some((person) => person.id === 'JW'), false);
  assert.deepEqual(teams[2].members, ['BJ', 'MYJ', 'JT', 'KW', 'CYJ']);
  const model = new RaffleState({ storage: new MemoryStorage(), randomIndex: stableRandom });
  assert.equal(model.getAvailableParticipants().length, 10);
  assert.equal(model.getAvailableParticipants().some((person) => teams[2].members.includes(person.id)), false);
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

test('ladder edges determine the special mission winner and stay stable after reload', () => {
  const storage = new MemoryStorage();
  const model = new RaffleState({ storage, randomIndex: stableRandom });
  model.drawRide('high-1');
  fillRandomTeam(model, 'high-1');
  const team = model.getTeam('high-1');
  const missions = model.drawMissions('high-1');
  assert.equal(missions.length, 5);
  assert.equal(missions[0].type, 'special');
  assert.equal(missions[0].id, specialMissions[team.ride.theme].id);
  assert.equal(new Set(missions.slice(1).map((mission) => mission.id)).size, 4);
  assert.ok(generalMissions.length >= 4);
  const ladder = model.createLadder('high-1');
  const expected = getPermutation(ladder);
  assert.throws(() => model.advanceTeam());
  team.members.forEach((id) => model.matchParticipant('high-1', id));
  const complete = model.getTeam('high-1');
  assert.equal(complete.complete, true);
  assert.equal(complete.matches.length, 5);
  complete.matches.forEach((match) => assert.equal(match.missionIndex, expected[team.members.indexOf(match.participantId)]));
  assert.equal(complete.leader, complete.members[expected.indexOf(0)]);
  assert.equal(model.advanceTeam().config.id, 'high-2');
  const restored = new RaffleState({ storage, randomIndex: stableRandom }).getTeam('high-1');
  assert.deepEqual(restored.ladder, ladder);
  assert.deepEqual(restored.matches, complete.matches);
  assert.equal(restored.leader, complete.leader);
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
  assert.equal(model.getTeam('medium-1').missions[0].id, specialMissions[ride.theme].id);
  assert.equal(storageKey, 'everland-mt-draw-v2');
});
