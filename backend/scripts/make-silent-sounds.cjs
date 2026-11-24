// Writes the silent Ogg Opus fixtures in test/fixtures/sounds/ without ffmpeg:
// node scripts/make-silent-sounds.cjs. Our own bytes, no ElevenLabs material.
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const OUT = join(__dirname, '..', 'test', 'fixtures', 'sounds');
const SAMPLES_PER_FRAME = 960; // 20 ms at 48 kHz
const PRE_SKIP = 312;
// One CELT fullband 20 ms mono frame that decodes to silence.
const SILENT_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index << 24;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 0x80000000 ? (crc << 1) ^ 0x04c11db7 : crc << 1;
  return crc >>> 0;
});
function oggCrc(bytes) {
  let crc = 0;
  for (const byte of bytes)
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]) >>> 0;
  return crc;
}

/** One Ogg page; every packet here is shorter than 255 bytes. */
function page(packets, { flags, granule, sequence }) {
  const header = Buffer.alloc(27 + packets.length);
  header.write('OggS', 0, 'ascii');
  header[5] = flags;
  header.writeBigInt64LE(BigInt(granule), 6);
  header.writeUInt32LE(0x51ed, 14); // stream serial
  header.writeUInt32LE(sequence, 18);
  header[26] = packets.length;
  packets.forEach((packet, index) => (header[27 + index] = packet.length));
  const bytes = Buffer.concat([header, ...packets]);
  bytes.writeUInt32LE(oggCrc(bytes), 22);
  return bytes;
}

function silentOpus(seconds) {
  const head = Buffer.alloc(19);
  head.write('OpusHead', 0, 'ascii');
  head[8] = 1; // version
  head[9] = 1; // mono
  head.writeUInt16LE(PRE_SKIP, 10);
  head.writeUInt32LE(48000, 12);
  const vendor = Buffer.from('habit-tracker fixture', 'ascii');
  const tags = Buffer.alloc(16 + vendor.length);
  tags.write('OpusTags', 0, 'ascii');
  tags.writeUInt32LE(vendor.length, 8);
  vendor.copy(tags, 12);
  const frames = Array.from(
    { length: Math.round((seconds * 48000) / SAMPLES_PER_FRAME) },
    () => SILENT_FRAME,
  );
  return Buffer.concat([
    page([head], { flags: 0x02, granule: 0, sequence: 0 }),
    page([tags], { flags: 0, granule: 0, sequence: 1 }),
    page(frames, {
      flags: 0x04,
      granule: PRE_SKIP + frames.length * SAMPLES_PER_FRAME,
      sequence: 2,
    }),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const [file, seconds] of [
  ['rain.ogg', 2],
  ['chime-done.ogg', 1],
]) {
  writeFileSync(join(OUT, file), silentOpus(seconds));
  console.log(`${file}: ${seconds} s`);
}
