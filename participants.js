(() => {
  'use strict';

  const STORAGE_KEY = 'everland-event-tickets-v1';
  const PARTICIPANT_IDS = ['KMK', 'MJ', 'MH', 'BJ', 'SB', 'MYJ', 'PMK', 'SI', 'JT', 'KW', 'SH', 'JW', 'HW', 'SW', 'CYJ', 'SM'];
  const PARTICIPANTS = Object.freeze(PARTICIPANT_IDS.map((id) => Object.freeze({
    id,
    initials: id.slice(-2),
    surname: id.length === 3 ? id[0] : '',
  })));
  const PARTICIPANT_BY_ID = new Map(PARTICIPANTS.map((participant) => [participant.id, participant]));
  const DEFAULT_TEAMS = Object.freeze([
    Object.freeze({ name: 'T 익스프레스', theme: 'timber' }),
    Object.freeze({ name: '아마존 익스프레스', theme: 'river' }),
    Object.freeze({ name: '썬더폴스', theme: 'thunder' }),
    Object.freeze({ name: '허리케인', theme: 'storm' }),
  ]);

  function fail(code, message) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  class TicketRoster {
    static storageKey = STORAGE_KEY;

    constructor(options = {}) {
      const { teams = DEFAULT_TEAMS, capacity = 4 } = options;
      if (!Array.isArray(teams) || !teams.length) throw new TypeError('At least one team is required.');
      if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError('Team capacity must be a positive integer.');
      this.capacity = capacity;
      this._teams = teams.slice();
      this._teamMap = new Map();
      this._assignments = [];

      this._teams.forEach((team) => {
        if (!team || typeof team.name !== 'string' || !team.name.trim() || team.name.length > 120
          || typeof team.theme !== 'string' || !/^[a-z][a-z0-9-]*$/.test(team.theme)
          || this._teamMap.has(team.theme)) {
          throw new TypeError('Teams must have a name and a unique theme.');
        }
        this._teamMap.set(team.theme, { name: team.name, theme: team.theme, original: team });
      });

      this._storage = null;
      this._persistent = false;
      try {
        const storage = options.storage === undefined ? window.localStorage : options.storage;
        if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
          && typeof storage.removeItem === 'function') {
          this._storage = storage;
          this._persistent = true;
        }
      } catch {
        // A blocked storage API still allows this browser session to run the draw.
      }
      this._refresh();
    }

    get persistent() { return this._persistent; }

    get teams() { return this._teams.slice(); }

    get assignments() {
      this._refresh();
      return this._assignments.map((assignment) => ({ ...assignment }));
    }

    get remaining() {
      this._refresh();
      return this._remaining();
    }

    get counts() {
      this._refresh();
      return this._counts();
    }

    static randomIndex(length) {
      if (!Number.isSafeInteger(length) || length < 1 || length > 0x100000000) {
        throw new RangeError('The random range must be an integer between 1 and 2^32.');
      }
      try {
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
          const value = new Uint32Array(1);
          const limit = Math.floor(0x100000000 / length) * length;
          do window.crypto.getRandomValues(value); while (value[0] >= limit);
          return value[0] % length;
        }
      } catch {
        // Older or restricted browser contexts can fall back to Math.random.
      }
      return Math.floor(Math.random() * length);
    }

    static shuffled(items) {
      if (!Array.isArray(items)) throw new TypeError('An array is required for shuffling.');
      const copy = items.slice();
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = TicketRoster.randomIndex(index + 1);
        [copy[index], copy[other]] = [copy[other], copy[index]];
      }
      return copy;
    }

    drawRide() {
      this._refresh();
      if (!this._remaining().length) return null;
      const counts = this._counts();
      const seats = [];
      this._teams.forEach((team) => {
        for (let seat = counts[team.theme]; seat < this.capacity; seat += 1) seats.push(team);
      });
      return seats.length ? seats[TicketRoster.randomIndex(seats.length)] : null;
    }

    drawGroup() {
      this._refresh();
      const remaining = this._remaining();
      if (!remaining.length) return null;
      // Sampling a person first gives MK and YJ two chances while both candidates remain.
      const selected = remaining[TicketRoster.randomIndex(remaining.length)];
      return {
        initials: selected.initials,
        candidates: remaining.filter((participant) => participant.initials === selected.initials),
      };
    }

    assign(participantId, ride) {
      this._refresh();
      if (!PARTICIPANT_BY_ID.has(participantId)) fail('INVALID_PARTICIPANT', 'Unknown participant.');
      const team = ride && this._teamMap.get(ride.theme);
      if (!team || ride.name !== team.name) fail('INVALID_RIDE', 'Unknown attraction team.');
      if (this._assignments.some((assignment) => assignment.participantId === participantId)) {
        fail('ALREADY_ASSIGNED', 'This participant already has a ticket.');
      }
      if (this._counts()[team.theme] >= this.capacity) fail('TEAM_FULL', 'This attraction team is full.');

      const assignment = {
        participantId,
        rideName: team.name,
        rideTheme: team.theme,
        assignedAt: new Date().toISOString(),
      };
      this._assignments.push(assignment);
      this._persist();
      return { ...assignment };
    }

    reset() {
      this._assignments = [];
      if (!this._storage) return;
      try { this._storage.removeItem(STORAGE_KEY); }
      catch { this._disableStorage(); }
    }

    _remaining() {
      const assigned = new Set(this._assignments.map((assignment) => assignment.participantId));
      return PARTICIPANTS.filter((participant) => !assigned.has(participant.id));
    }

    _counts() {
      const counts = Object.fromEntries(this._teams.map((team) => [team.theme, 0]));
      this._assignments.forEach((assignment) => { counts[assignment.rideTheme] += 1; });
      return counts;
    }

    _decode(raw) {
      let snapshot;
      try { snapshot = JSON.parse(raw); } catch { return null; }
      if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.assignments)) return null;

      const accepted = [];
      const ids = new Set();
      const counts = Object.fromEntries(this._teams.map((team) => [team.theme, 0]));
      snapshot.assignments.slice(0, 1000).forEach((record) => {
        if (!record || typeof record !== 'object' || !PARTICIPANT_BY_ID.has(record.participantId)
          || ids.has(record.participantId)) return;
        const team = this._teamMap.get(record.rideTheme);
        if (!team || record.rideName !== team.name || counts[team.theme] >= this.capacity
          || typeof record.assignedAt !== 'string'
          || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(record.assignedAt)
          || !Number.isFinite(Date.parse(record.assignedAt))) return;
        accepted.push({
          participantId: record.participantId,
          rideName: team.name,
          rideTheme: team.theme,
          assignedAt: new Date(record.assignedAt).toISOString(),
        });
        ids.add(record.participantId);
        counts[team.theme] += 1;
      });
      return accepted;
    }

    _refresh() {
      if (!this._storage) return;
      try {
        const raw = this._storage.getItem(STORAGE_KEY);
        if (raw === null) this._assignments = [];
        else {
          const decoded = this._decode(raw);
          if (decoded !== null) this._assignments = decoded;
        }
      } catch { this._disableStorage(); }
    }

    _persist() {
      if (!this._storage) return;
      try {
        this._storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, assignments: this._assignments }));
      } catch { this._disableStorage(); }
    }

    _disableStorage() {
      this._storage = null;
      this._persistent = false;
    }
  }

  window.EventParticipants = PARTICIPANTS;
  window.TicketRoster = TicketRoster;
})();
