(() => {
  'use strict';

  function randomIndex(length) {
    return Math.floor(Math.random() * length);
  }

  function createLadder(columns = 5, rowCount = 10, chooseIndex = randomIndex) {
    if (!Number.isSafeInteger(columns) || columns < 2 || columns > 12) throw new RangeError('Ladder columns must be between 2 and 12.');
    if (!Number.isSafeInteger(rowCount) || rowCount < 1 || rowCount > 100) throw new RangeError('Ladder rows must be between 1 and 100.');
    const rows = [];
    for (let row = 0; row < rowCount; row += 1) {
      const possible = Array.from({ length: columns - 1 }, (_, index) => index);
      for (let index = possible.length - 1; index > 0; index -= 1) {
        const other = chooseIndex(index + 1);
        [possible[index], possible[other]] = [possible[other], possible[index]];
      }
      const count = Math.min(possible.length, 1 + chooseIndex(Math.min(2, possible.length)));
      const selected = [];
      possible.forEach((rung) => {
        if (selected.length >= count) return;
        if (!selected.some((other) => Math.abs(other - rung) === 1)) selected.push(rung);
      });
      rows.push(selected.sort((a, b) => a - b));
    }
    return { columns, rows };
  }

  function validateLadder(ladder) {
    return Boolean(ladder && Number.isSafeInteger(ladder.columns) && ladder.columns === 5
      && Array.isArray(ladder.rows) && ladder.rows.length >= 1 && ladder.rows.length <= 100
      && ladder.rows.every((row) => Array.isArray(row)
        && row.every((rung) => Number.isSafeInteger(rung) && rung >= 0 && rung < ladder.columns - 1)
        && row.every((rung, index) => index === 0 || rung - row[index - 1] > 1)));
  }

  function traceLadder(ladder, startColumn) {
    if (!validateLadder(ladder)) throw new TypeError('A valid five-column ladder is required.');
    if (!Number.isSafeInteger(startColumn) || startColumn < 0 || startColumn >= ladder.columns) throw new RangeError('The starting column is invalid.');
    let column = startColumn;
    const points = [{ column, level: 0 }];
    ladder.rows.forEach((rungs, index) => {
      const level = index + 1;
      let next = column;
      if (rungs.includes(column)) next = column + 1;
      else if (rungs.includes(column - 1)) next = column - 1;
      points.push({ column, level });
      if (next !== column) points.push({ column: next, level });
      column = next;
    });
    points.push({ column, level: ladder.rows.length + 1 });
    return { startColumn, destination: column, points };
  }

  function getPermutation(ladder) {
    return Array.from({ length: ladder.columns }, (_, column) => traceLadder(ladder, column).destination);
  }

  const api = Object.freeze({ createLadder, validateLadder, traceLadder, getPermutation });
  if (typeof window !== 'undefined') window.LadderGame = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
