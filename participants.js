(() => {
  'use strict';

  const ids = ['KMK', 'MJ', 'MH', 'BJ', 'SB', 'MYJ', 'PMK', 'SI', 'JT', 'KW', 'SH', 'HW', 'SW', 'CYJ', 'SM'];
  const participants = Object.freeze(ids.map((id) => Object.freeze({
    id,
    initials: id.slice(-2),
    surname: id.length === 3 ? id[0] : '',
  })));

  function randomIndex(length) {
    if (!Number.isSafeInteger(length) || length < 1 || length > 0x100000000) {
      throw new RangeError('The random range must be an integer between 1 and 2^32.');
    }
    try {
      const source = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
      if (source && typeof source.getRandomValues === 'function') {
        const value = new Uint32Array(1);
        const limit = Math.floor(0x100000000 / length) * length;
        do source.getRandomValues(value); while (value[0] >= limit);
        return value[0] % length;
      }
    } catch {
      // Restricted browser contexts can still run the draw with Math.random.
    }
    return Math.floor(Math.random() * length);
  }

  function shuffled(items) {
    if (!Array.isArray(items)) throw new TypeError('An array is required for shuffling.');
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = randomIndex(index + 1);
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  const helpers = Object.freeze({ randomIndex, shuffled });
  if (typeof window !== 'undefined') {
    window.EventParticipants = participants;
    // NameDraw uses these helpers to shuffle the two facedown surname cards.
    window.TicketRoster = helpers;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { participants, ...helpers };
})();
