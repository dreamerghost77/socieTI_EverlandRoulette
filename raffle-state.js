(() => {
  'use strict';

  const data = (typeof window !== 'undefined' && window.EverlandEventData)
    || (typeof module !== 'undefined' && module.exports && require('./event-data.js'));
  const roster = (typeof window !== 'undefined' && window.EventParticipants)
    || (typeof module !== 'undefined' && module.exports && require('./participants.js').participants);
  const ladderGame = (typeof window !== 'undefined' && window.LadderGame)
    || (typeof module !== 'undefined' && module.exports && require('./ladder.js'));

  const STORAGE_KEY = 'everland-mt-draw-v3';
  const PREVIOUS_STORAGE_KEY = 'everland-mt-draw-v2';
  const LEGACY_STORAGE_KEY = 'everland-event-tickets-v1';
  const participantById = new Map(roster.map((person) => [person.id, person]));
  const rideByTheme = new Map(data.rides.map((ride) => [ride.theme, ride]));
  const generalById = new Map(data.generalMissions.map((mission) => [mission.id, mission]));
  const specialById = new Map(Object.values(data.specialMissions).map((mission) => [mission.id, mission]));
  const missionById = new Map([...generalById, ...specialById]);

  function makeInitialState() {
    return {
      version: 3,
      activeTeamIndex: 0,
      teams: data.teams.map((config) => ({
        id: config.id,
        rideTheme: null,
        members: config.kind === 'fixed' ? config.members.slice() : [],
        pendingGroup: null,
        missionIds: null,
        ladder: null,
        matches: [],
        leader: null,
        complete: false,
      })),
    };
  }

  function sameMembers(left, right) {
    return Array.isArray(left) && left.length === right.length && right.every((id) => left.includes(id));
  }

  class RaffleState {
    static storageKey = STORAGE_KEY;

    constructor(options = {}) {
      this.randomIndex = options.randomIndex || ((length) => {
        const helpers = typeof window !== 'undefined' ? window.TicketRoster : null;
        return helpers ? helpers.randomIndex(length) : Math.floor(Math.random() * length);
      });
      this.shuffle = options.shuffle || ((items) => {
        const copy = items.slice();
        for (let index = copy.length - 1; index > 0; index -= 1) {
          const other = this.randomIndex(index + 1);
          [copy[index], copy[other]] = [copy[other], copy[index]];
        }
        return copy;
      });
      this.storage = null;
      this.migratedLegacyState = false;
      try {
        const storage = options.storage === undefined
          ? (typeof window !== 'undefined' ? window.localStorage : null)
          : options.storage;
        if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') this.storage = storage;
      } catch {
        // The draw remains usable in memory when browser storage is unavailable.
      }
      this._removeLegacySnapshot();
      this.state = this._load();
    }

    get persistent() { return Boolean(this.storage); }
    get activeTeamIndex() { return this.state.activeTeamIndex; }
    get allComplete() { return this.state.teams.every((team) => team.complete); }
    get teams() { return this.state.teams.map((team) => this._publicTeam(team)); }
    get activeTeam() { return this.state.teams[this.state.activeTeamIndex] ? this._publicTeam(this.state.teams[this.state.activeTeamIndex]) : null; }

    getTeam(teamId) {
      const team = this.state.teams.find((entry) => entry.id === teamId);
      return team ? this._publicTeam(team) : null;
    }

    getAvailableParticipants() {
      const used = new Set(this.state.teams.flatMap((team) => team.members));
      return roster.filter((person) => !used.has(person.id));
    }

    getAvailableRides(difficulty) {
      const used = new Set(this.state.teams
        .filter((team) => team.rideTheme)
        .map((team) => team.rideTheme));
      return data.rides.filter((ride) => ride.difficulty === difficulty && !used.has(ride.theme));
    }

    getPhase(teamId) {
      const team = this._team(teamId);
      if (!team.rideTheme) return 'ride';
      if (team.members.length < 5) return 'members';
      if (!team.missionIds) return 'missions';
      if (!team.ladder) return 'ladder';
      if (team.complete) return 'complete';
      return 'ladder';
    }

    drawRide(teamId) {
      const team = this._team(teamId);
      if (team.rideTheme) return rideByTheme.get(team.rideTheme);
      const config = this._config(teamId);
      const eligible = this.getAvailableRides(config.difficulty);
      if (!eligible.length) throw new Error('해당 난이도에서 추첨할 수 있는 놀이기구가 없습니다.');
      const ride = eligible[this.randomIndex(eligible.length)];
      team.rideTheme = ride.theme;
      this._save();
      return ride;
    }

    drawInitialGroup(teamId) {
      const team = this._team(teamId);
      if (team.members.length >= 5) return null;
      if (team.pendingGroup) return this._publicGroup(team.pendingGroup);
      const remaining = this.getAvailableParticipants();
      if (!remaining.length) throw new Error('남은 참가자가 없습니다.');
      const selected = remaining[this.randomIndex(remaining.length)];
      const group = {
        initials: selected.initials,
        candidateIds: remaining.filter((person) => person.initials === selected.initials).map((person) => person.id),
      };
      team.pendingGroup = group;
      this._save();
      return this._publicGroup(group);
    }

    addMember(teamId, participantId) {
      const team = this._team(teamId);
      const config = this._config(teamId);
      if (config.kind !== 'random') throw new Error('이 팀의 참가자는 미리 확정되어 있습니다.');
      const pending = team.pendingGroup;
      if (!pending || !pending.candidateIds.includes(participantId)) throw new Error('현재 추첨에서 선택할 수 없는 참가자입니다.');
      if (this.getAvailableParticipants().every((person) => person.id !== participantId)) throw new Error('이미 다른 팀에 배정된 참가자입니다.');
      if (team.members.length >= 5) throw new Error('팀원이 모두 확정되었습니다.');
      team.members.push(participantId);
      team.pendingGroup = null;
      this._save();
      return this._publicTeam(team);
    }

    drawMissions(teamId) {
      const team = this._team(teamId);
      if (!team.rideTheme || team.members.length !== 5) throw new Error('놀이기구와 참가자 5명을 먼저 확정하세요.');
      if (team.missionIds) return { count: team.missionIds.length };
      const special = data.specialMissions[team.rideTheme];
      if (!special) throw new Error('선택된 놀이기구에 연결된 스페셜 미션이 없습니다.');
      const general = this.shuffle(data.generalMissions).slice(0, 4);
      if (new Set(general.map((mission) => mission.id)).size !== 4) throw new Error('일반 미션 추첨에 중복이 발생했습니다.');
      team.missionIds = this.shuffle([special, ...general]).map((mission) => mission.id);
      this._save();
      return { count: team.missionIds.length };
    }

    getOperatorTeams() {
      return this.state.teams.map((team, index) => {
        const ride = rideByTheme.get(team.rideTheme) || null;
        const config = this._config(team.id);
        const assignments = team.members.map((participantId, memberIndex) => {
          const match = team.matches.find((entry) => entry.participantId === participantId);
          if (!match) return null;
          const mission = missionById.get(match.missionId);
          if (!mission) return null;
          return {
            participantId,
            missionIndex: match.missionIndex,
            missionId: mission.id,
            missionType: mission.type,
            missionText: mission.text,
            isTeamLeader: participantId === team.leader,
            ticketCreated: Boolean(match.ticketCreated),
            ticketNumber: 'EVMT26-T' + (index + 1) + '-' + String(memberIndex + 1).padStart(2, '0'),
          };
        }).filter(Boolean);
        return {
          id: team.id,
          teamNumber: index + 1,
          label: config.label,
          difficulty: config.difficulty,
          ride,
          members: team.members.slice(),
          assignments,
          leader: team.leader,
          complete: team.complete,
        };
      });
    }

    exportOperatorData() {
      if (!this.allComplete) throw new Error('세 팀의 사다리 추첨을 모두 완료한 뒤 운영자 파일을 만들 수 있습니다.');
      return {
        schema: 'everland-mt-operator-tickets',
        version: 1,
        exportedAt: new Date().toISOString(),
        teams: this.getOperatorTeams(),
      };
    }

    markTicketCreated(teamId, participantId) {
      const team = this._team(teamId);
      const match = team.matches.find((entry) => entry.participantId === participantId);
      if (!match) throw new Error('완료된 사다리 배정이 없는 참가자입니다.');
      if (!match.ticketCreated) {
        match.ticketCreated = true;
        this._save();
      }
      return true;
    }

    _getMissions(teamId) {
      const team = this._team(teamId);
      if (!team.missionIds) return [];
      return team.missionIds.map((id) => missionById.get(id)).filter(Boolean);
    }

    createLadder(teamId, rowCount = 10) {
      const team = this._team(teamId);
      if (!team.missionIds) throw new Error('미션을 먼저 추첨하세요.');
      if (!team.ladder) team.ladder = ladderGame.createLadder(5, rowCount, this.randomIndex);
      this._save();
      return JSON.parse(JSON.stringify(team.ladder));
    }

    traceParticipant(teamId, participantId) {
      const team = this._team(teamId);
      const startColumn = team.members.indexOf(participantId);
      if (startColumn < 0) throw new Error('이 팀의 참가자가 아닙니다.');
      return ladderGame.traceLadder(team.ladder, startColumn);
    }

    matchParticipant(teamId, participantId) {
      const team = this._team(teamId);
      if (!team.ladder || !team.missionIds) throw new Error('사다리를 먼저 생성하세요.');
      const existing = team.matches.find((match) => match.participantId === participantId);
      if (existing) return { participantId, missionIndex: existing.missionIndex, route: this.traceParticipant(teamId, participantId) };
      if (team.complete) throw new Error('모든 참가자의 미션이 이미 확정되었습니다.');
      const route = this.traceParticipant(teamId, participantId);
      if (team.matches.some((match) => match.missionIndex === route.destination)) throw new Error('이 미션은 이미 다른 참가자에게 배정되었습니다.');
      const missionId = team.missionIds[route.destination];
      const mission = missionById.get(missionId);
      if (!mission) throw new Error('사다리 슬롯에 연결된 미션을 찾을 수 없습니다.');
      const match = {
        participantId,
        missionIndex: route.destination,
        missionId,
        missionType: mission.type,
        ticketCreated: false,
      };
      team.matches.push(match);
      if (mission.type === 'special') team.leader = participantId;
      team.complete = team.matches.length === 5;
      this._save();
      return { participantId, missionIndex: match.missionIndex, route };
    }

    advanceTeam() {
      const team = this.state.teams[this.state.activeTeamIndex];
      if (!team || !team.complete) throw new Error('현재 팀의 사다리타기를 모두 마쳐야 다음 팀으로 이동할 수 있습니다.');
      this.state.activeTeamIndex = Math.min(this.state.activeTeamIndex + 1, this.state.teams.length);
      this._save();
      return this.activeTeam;
    }

    reset() {
      this.state = makeInitialState();
      if (this.storage) {
        try {
          this.storage.removeItem(STORAGE_KEY);
          this.storage.removeItem(PREVIOUS_STORAGE_KEY);
        } catch { this.storage = null; }
      }
    }

    _team(teamId) {
      const team = this.state.teams.find((entry) => entry.id === teamId);
      if (!team) throw new Error('알 수 없는 팀입니다.');
      return team;
    }

    _config(teamId) {
      const config = data.teams.find((entry) => entry.id === teamId);
      if (!config) throw new Error('알 수 없는 팀입니다.');
      return config;
    }

    _publicGroup(group) {
      return {
        initials: group.initials,
        candidates: group.candidateIds.map((id) => participantById.get(id)).filter(Boolean),
      };
    }

    _publicTeam(team) {
      const ride = rideByTheme.get(team.rideTheme) || null;
      const matches = team.matches.map((match) => ({ participantId: match.participantId, missionIndex: match.missionIndex }));
      const publicState = JSON.parse(JSON.stringify(team));
      delete publicState.missionIds;
      delete publicState.leader;
      publicState.matches = matches;
      return {
        ...publicState,
        ride,
        config: this._config(team.id),
        missionCount: team.missionIds ? team.missionIds.length : 0,
        matchedCount: team.matches.length,
        matches,
        phase: this.getPhase(team.id),
      };
    }

    _removeLegacySnapshot() {
      if (!this.storage) return;
      try { this.storage.removeItem(LEGACY_STORAGE_KEY); }
      catch { this.storage = null; }
    }

    _load() {
      if (!this.storage) return makeInitialState();
      try {
        const raw = this.storage.getItem(STORAGE_KEY);
        if (raw) return this._restore(JSON.parse(raw));
        const previous = this.storage.getItem(PREVIOUS_STORAGE_KEY);
        if (!previous) return makeInitialState();
        this.migratedLegacyState = true;
        const restored = this._restore(JSON.parse(previous));
        this.state = restored;
        this._save();
        return restored;
      } catch {
        return makeInitialState();
      }
    }

    _restore(saved) {
      const state = makeInitialState();
      if (!saved || ![2, 3].includes(saved.version) || !Array.isArray(saved.teams)) return state;
      const canRestoreMissions = saved.version === 3;
      const usedParticipants = new Set(data.teams.find((team) => team.kind === 'fixed').members);
      const usedRides = new Set();
      saved.teams.forEach((record) => {
        if (!record || !state.teams.some((team) => team.id === record.id)) return;
        const team = state.teams.find((entry) => entry.id === record.id);
        const config = this._config(team.id);
        const ride = rideByTheme.get(record.rideTheme);
        if (ride && ride.difficulty === config.difficulty && !usedRides.has(ride.theme)) {
          team.rideTheme = ride.theme;
          usedRides.add(ride.theme);
        }
        if (config.kind === 'random' && Array.isArray(record.members)) {
          record.members.slice(0, 5).forEach((id) => {
            if (participantById.has(id) && !usedParticipants.has(id)) {
              team.members.push(id);
              usedParticipants.add(id);
            }
          });
        }
      });

      saved.teams.forEach((record) => {
        if (!record) return;
        const team = state.teams.find((entry) => entry.id === record.id);
        if (!team || !team.rideTheme || team.members.length >= 5 || !record.pendingGroup
          || !/^[A-Z]{2}$/.test(record.pendingGroup.initials) || !Array.isArray(record.pendingGroup.candidateIds)) return;
        const available = roster.filter((person) => !usedParticipants.has(person.id));
        const candidates = available.filter((person) => person.initials === record.pendingGroup.initials
          && record.pendingGroup.candidateIds.includes(person.id));
        if (candidates.length && candidates.length <= 2 && candidates.length === record.pendingGroup.candidateIds.length) {
          team.pendingGroup = { initials: record.pendingGroup.initials, candidateIds: candidates.map((person) => person.id) };
        }
      });

      if (canRestoreMissions) saved.teams.forEach((record) => {
        if (!record) return;
        const team = state.teams.find((entry) => entry.id === record.id);
        if (!team || !team.rideTheme || team.members.length !== 5 || !Array.isArray(record.missionIds)) return;
        const expectedSpecial = data.specialMissions[team.rideTheme]?.id;
        const specialIds = record.missionIds.filter((id) => specialById.has(id));
        const generalIds = record.missionIds.filter((id) => generalById.has(id));
        if (record.missionIds.length === 5 && specialIds.length === 1 && specialIds[0] === expectedSpecial
          && generalIds.length === 4 && record.missionIds.every((id) => missionById.has(id))
          && new Set(record.missionIds).size === 5) {
          team.missionIds = record.missionIds.slice();
        }
      });

      if (canRestoreMissions) saved.teams.forEach((record) => {
        if (!record) return;
        const team = state.teams.find((entry) => entry.id === record.id);
        if (team && team.missionIds && ladderGame.validateLadder(record.ladder)) team.ladder = record.ladder;
      });

      if (canRestoreMissions) saved.teams.forEach((record) => {
        if (!record) return;
        const team = state.teams.find((entry) => entry.id === record.id);
        if (!team || !team.ladder || !Array.isArray(record.matches)) return;
        const missionIndices = new Set();
        record.matches.forEach((candidate) => {
          if (!candidate || !team.members.includes(candidate.participantId) || team.matches.some((match) => match.participantId === candidate.participantId)) return;
          const route = ladderGame.traceLadder(team.ladder, team.members.indexOf(candidate.participantId));
          const missionId = team.missionIds[route.destination];
          const mission = missionById.get(missionId);
          if (route.destination !== candidate.missionIndex || missionIndices.has(route.destination)
            || candidate.missionId !== missionId || !mission || candidate.missionType !== mission.type) return;
          team.matches.push({
            participantId: candidate.participantId,
            missionIndex: candidate.missionIndex,
            missionId,
            missionType: mission.type,
            ticketCreated: Boolean(candidate.ticketCreated),
          });
          missionIndices.add(route.destination);
          if (mission.type === 'special') team.leader = candidate.participantId;
        });
        team.complete = team.matches.length === 5 && team.missionIds !== null;
      });

      const firstIncomplete = state.teams.findIndex((team) => !team.complete);
      const maxIndex = firstIncomplete < 0 ? state.teams.length : firstIncomplete;
      state.activeTeamIndex = Number.isSafeInteger(saved.activeTeamIndex)
        ? Math.max(0, Math.min(saved.activeTeamIndex, maxIndex))
        : 0;
      return state;
    }

    _save() {
      if (!this.storage) return;
      try { this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state)); }
      catch { this.storage = null; }
    }
  }

  const api = { RaffleState, storageKey: STORAGE_KEY, makeInitialState };
  if (typeof window !== 'undefined') window.EventRaffle = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
