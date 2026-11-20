import { inflateRawSync } from "node:zlib";

/**
 * The files of a zip archive by path. Reads the central directory, so it
 * handles archives whose local headers defer sizes to a data descriptor.
 * Supports the two methods taxonomy packages use: stored (0) and deflate (8);
 * other entries are skipped. Not for zip64 archives, which these never are.
 */
export function readZip(archive: Uint8Array): Map<string, Buffer> {
    const data = Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength);
    const files = new Map<string, Buffer>();

    // End of central directory: signature 0x06054b50, within the last 64 KB + 22 bytes.
    let end = -1;
    for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i--) {
        if (data.readUInt32LE(i) === 0x06054b50) {
            end = i;
            break;
        }
    }
    if (end < 0) throw new Error("Not a zip archive: no end of central directory.");

    const entries = data.readUInt16LE(end + 10);
    let offset = data.readUInt32LE(end + 16);

    for (let n = 0; n < entries; n++) {
        if (data.readUInt32LE(offset) !== 0x02014b50) throw new Error("Corrupt zip central directory.");
        const method = data.readUInt16LE(offset + 10);
        const compressedSize = data.readUInt32LE(offset + 20);
        const nameLength = data.readUInt16LE(offset + 28);
        const extraLength = data.readUInt16LE(offset + 30);
        const commentLength = data.readUInt16LE(offset + 32);
        const localHeader = data.readUInt32LE(offset + 42);
        const name = data.toString("utf8", offset + 46, offset + 46 + nameLength);
        offset += 46 + nameLength + extraLength + commentLength;

        if (name.endsWith("/")) continue;
        if (data.readUInt32LE(localHeader) !== 0x04034b50) throw new Error(`Corrupt zip entry: ${name}`);
        const start = localHeader + 30 + data.readUInt16LE(localHeader + 26) + data.readUInt16LE(localHeader + 28);
        const raw = data.subarray(start, start + compressedSize);

        if (method === 0) files.set(name, Buffer.from(raw));
        else if (method === 8) files.set(name, inflateRawSync(raw));
    }

    return files;
}
