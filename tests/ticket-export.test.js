'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildZip, ticketFileName } = require('../ticket-export.js');

function readStoredZip(blob) {
  return blob.arrayBuffer().then((arrayBuffer) => {
    const bytes = Buffer.from(arrayBuffer);
    const endOffset = bytes.length - 22;
    assert.equal(bytes.readUInt32LE(endOffset), 0x06054b50);
    const count = bytes.readUInt16LE(endOffset + 10);
    const centralOffset = bytes.readUInt32LE(endOffset + 16);
    const entries = [];
    let cursor = centralOffset;
    for (let index = 0; index < count; index += 1) {
      assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
      const nameLength = bytes.readUInt16LE(cursor + 28);
      const extraLength = bytes.readUInt16LE(cursor + 30);
      const commentLength = bytes.readUInt16LE(cursor + 32);
      const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
      const localOffset = bytes.readUInt32LE(cursor + 42);
      assert.equal(bytes.readUInt32LE(localOffset), 0x04034b50);
      const localNameLength = bytes.readUInt16LE(localOffset + 26);
      const localExtraLength = bytes.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const size = bytes.readUInt32LE(cursor + 24);
      entries.push({ name, data: bytes.subarray(dataOffset, dataOffset + size) });
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  });
}

test('complete ZIP has one JSON result and fifteen correctly named individual PNG tickets', async () => {
  const resultJson = JSON.stringify({ eventName: 'EVERLAND MT', missionText: '실제 미션 예시' });
  const entries = [{ name: 'Everland_MT_Results.json', blob: new Blob([resultJson], { type: 'application/json;charset=utf-8' }) }];
  const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const participantIds = Array.from({ length: 5 }, (_, index) => 'P' + index);
  const teamIds = ['high-1', 'high-2', 'medium-1'];
  teamIds.forEach((teamId) => participantIds.forEach((participantId) => {
    const ticket = { team: { id: teamId }, assignment: { participantId } };
    entries.push({
      name: 'Tickets/' + ticketFileName(ticket),
      blob: new Blob([pngSignature], { type: 'image/png' }),
    });
  }));

  const archive = await buildZip(entries);
  const files = await readStoredZip(archive);
  assert.equal(files.length, 16);
  assert.equal(files.filter((file) => file.name.endsWith('.json')).length, 1);
  assert.equal(files.filter((file) => file.name.startsWith('Tickets/') && file.name.endsWith('.png')).length, 15);
  assert.deepEqual(files.find((file) => file.name === 'Everland_MT_Results.json').data.toString('utf8'), resultJson);
  files.filter((file) => file.name.endsWith('.png')).forEach((file) => {
    assert.deepEqual(file.data.subarray(0, 8), Buffer.from(pngSignature));
  });
  assert.ok(files.some((file) => file.name === 'Tickets/Everland_MT_High1_P0.png'));
  assert.ok(files.some((file) => file.name === 'Tickets/Everland_MT_Medium1_P4.png'));
});

test('ZIP builder rejects duplicate names and malformed entries before creating an archive', async () => {
  const duplicate = [
    { name: 'same.png', blob: new Blob(['one']) },
    { name: 'same.png', blob: new Blob(['two']) },
  ];
  await assert.rejects(buildZip(duplicate), /중복된 파일명/);
  await assert.rejects(buildZip([{ name: '../escape', blob: {} }]), /파일 목록이 올바르지 않습니다/);
});
