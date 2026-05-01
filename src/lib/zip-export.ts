/**
 * Minimal ZIP generator — usa zlib (deflate) built-in de Node.js.
 * Soporta lo justo para empaquetar múltiples .fit files en un ZIP.
 */

import { deflateRawSync } from "zlib";

interface ZipEntry {
  name: string;
  data: Buffer;
}

// CRC32 lookup table
const CRC_TABLE = new Uint32Array(256).fill(0).map((_, i) => {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(buf: Buffer, pos: number, v: number) {
  buf.writeUInt16LE(v, pos);
}

function writeU32(buf: Buffer, pos: number, v: number) {
  buf.writeUInt32LE(v, pos);
}

/**
 * Crea un archivo ZIP en memoria con los entries dados.
 * Formato: LOCAL headers + datos comprimidos → CENTRAL directory → END record.
 */
export function createZip(entries: ZipEntry[]): Buffer {
  const SIG_LOCAL = 0x04034b50;
  const SIG_CENTRAL = 0x02014b50;
  const SIG_END = 0x06054b50;

  const chunks: Buffer[] = [];
  const central: Buffer[] = [];

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);
    const offset = Buffer.concat(chunks).length;

    // Local file header (30 bytes + filename)
    const local = Buffer.alloc(30 + nameBuf.length);
    writeU32(local, 0, SIG_LOCAL);
    writeU16(local, 4, 20);        // version needed (2.0 = deflate)
    writeU16(local, 6, 0);         // flags
    writeU16(local, 8, 8);         // compression: deflate
    writeU16(local, 10, 0);        // mod time (0)
    writeU16(local, 12, 0);        // mod date (0)
    writeU32(local, 14, crc);
    writeU32(local, 18, compressed.length);
    writeU32(local, 22, entry.data.length);
    writeU16(local, 26, nameBuf.length);
    writeU16(local, 28, 0);        // extra field length
    nameBuf.copy(local, 30);

    chunks.push(local, compressed);

    // Central directory entry (46 bytes + filename)
    const cen = Buffer.alloc(46 + nameBuf.length);
    writeU32(cen, 0, SIG_CENTRAL);
    writeU16(cen, 4, 20);          // version made by
    writeU16(cen, 6, 20);          // version needed
    writeU16(cen, 8, 0);           // flags
    writeU16(cen, 10, 8);          // compression
    writeU16(cen, 12, 0);          // mod time
    writeU16(cen, 14, 0);          // mod date
    writeU32(cen, 16, crc);
    writeU32(cen, 20, compressed.length);
    writeU32(cen, 24, entry.data.length);
    writeU16(cen, 28, nameBuf.length);
    writeU16(cen, 30, 0);          // extra field length
    writeU16(cen, 32, 0);          // file comment length
    writeU16(cen, 34, 0);          // disk number start
    writeU16(cen, 36, 0);          // internal file attributes
    writeU32(cen, 38, 0);          // external file attributes
    writeU32(cen, 42, offset);
    nameBuf.copy(cen, 46);

    central.push(cen);
  }

  const centralOffset = Buffer.concat(chunks).length;
  const centralData = Buffer.concat(central);

  // End of central directory record (22 bytes)
  const end = Buffer.alloc(22);
  writeU32(end, 0, SIG_END);
  writeU16(end, 4, 0);             // disk number
  writeU16(end, 6, 0);             // disk with central dir
  writeU16(end, 8, entries.length);
  writeU16(end, 10, entries.length);
  writeU32(end, 12, centralData.length);
  writeU32(end, 16, centralOffset);
  writeU16(end, 20, 0);            // comment length

  return Buffer.concat([...chunks, centralData, end]);
}
