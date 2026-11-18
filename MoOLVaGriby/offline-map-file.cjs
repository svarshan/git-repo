'use strict';

const {open} = require('node:fs/promises');

async function readMapRange(filename, range) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Range, ETag',
    'Accept-Ranges': 'bytes',
    'Content-Type': 'application/octet-stream'
  };
  let file;
  try {
    file = await open(filename, 'r');
    const {size} = await file.stat();
    const match = /^bytes=(\d+)-(\d+)$/.exec(range || '');
    const start = match ? Number(match[1]) : NaN;
    const end = match ? Math.min(Number(match[2]), size - 1) : NaN;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end - start >= 2 ** 21) {
      return new Response(null, {status: 416, headers: {...headers, 'Content-Range': `bytes */${size}`}});
    }
    const length = end - start + 1;
    const data = Buffer.alloc(length);
    let filled = 0;
    while (filled < length) {
      const {bytesRead} = await file.read(data, filled, length - filled, start + filled);
      if (!bytesRead) throw new Error('Incomplete offline map read');
      filled += bytesRead;
    }
    return new Response(data, {
      status: 206,
      headers: {...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(length)}
    });
  } catch (error) {
    return new Response(null, {status: error.code === 'ENOENT' ? 404 : 500, headers});
  } finally {
    await file?.close();
  }
}

module.exports = {readMapRange};
