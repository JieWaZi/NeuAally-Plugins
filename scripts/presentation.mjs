import { inflateSync } from 'node:zlib';

const maxIconBytes = 128 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function crc32(content) {
  let value = 0xffffffff;
  for (const byte of content) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
  return (value ^ 0xffffffff) >>> 0;
}

// 发布只接受有界、非交错的 8 位 PNG，校验块、像素数据及过滤器后才内嵌目录。
function pngIcon(content) {
  const invalid = () => { throw new Error('invalid PNG icon asset'); };
  if (content.length > maxIconBytes || !content.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) invalid();
  let offset = 8, rowBytes = 0, height = 0, ended = false, dataEnded = false; const compressed = [];
  while (offset < content.length) {
    if (content.length - offset < 12) invalid();
    const size = content.readUInt32BE(offset), end = offset + 12 + size;
    if (end > content.length) invalid();
    const type = content.toString('ascii', offset + 4, offset + 8);
    const data = content.subarray(offset + 8, offset + 8 + size);
    if (!/^[A-Za-z]{4}$/.test(type) || crc32(content.subarray(offset + 4, offset + 8 + size)) !== content.readUInt32BE(offset + 8 + size)) invalid();
    if (offset === 8 && type !== 'IHDR') invalid();
    if (type === 'IHDR') {
      if (offset !== 8 || size !== 13) invalid();
      const width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[data[9]];
      if (width < 1 || height < 1 || width > 2048 || height > 2048 || data[8] !== 8 || !channels || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) invalid();
      rowBytes = width * channels + 1;
    } else if (type === 'IDAT') {
      if (dataEnded) invalid();
      compressed.push(data);
    } else if (type === 'IEND') {
      if (size !== 0 || end !== content.length || !compressed.length) invalid();
      ended = true;
    } else {
      if (compressed.length) dataEnded = true;
      if (type[0] === type[0].toUpperCase() && type !== 'PLTE') invalid();
      if (['acTL', 'fcTL', 'fdAT'].includes(type)) invalid();
    }
    offset = end;
  }
  if (!ended) invalid();
  let pixels;
  try { pixels = inflateSync(Buffer.concat(compressed), { maxOutputLength: rowBytes * height }); } catch { invalid(); }
  if (pixels.length !== rowBytes * height) invalid();
  for (let row = 0; row < height; row++) if (pixels[row * rowBytes] > 4) invalid();
  return `data:image/png;base64,${content.toString('base64')}`;
}

// 附加文件只承载本地化展示，不接纳身份、组件或任意文档路径。
export function catalogPresentation({ manifest, packagePath, has, read }) {
  const result = {}, filename = `${packagePath}/.neuxally/presentation.json`;
  if (has(filename)) {
    const bytes = read(filename);
    if (bytes.length > 20 * 1024) throw new Error('presentation metadata too large');
    const value = JSON.parse(bytes);
    if (!object(value) || Object.keys(value).some(key => !['displayNames', 'localizedDescriptions'].includes(key))) throw new Error('invalid presentation fields');
    for (const [key, translations] of Object.entries(value)) {
      if (!object(translations)) throw new Error('invalid presentation locale map');
      for (const [locale, text] of Object.entries(translations)) {
        if (!['en', 'zh-CN'].includes(locale) || typeof text !== 'string' || !text.trim() || Buffer.byteLength(text) > 4096 || /[\u0000-\u001f]/u.test(text)) throw new Error('invalid presentation locale text');
      }
      if (Object.keys(translations).length) result[key] = translations;
    }
  }
  const reference = manifest.interface?.logo ?? manifest.interface?.composerIcon;
  if (reference !== undefined) {
    if (typeof reference !== 'string' || !/^\.\/assets\/(?:[^/\\:\x00-\x1f]+\/)*[^/\\:\x00-\x1f]+\.png$/.test(reference) || reference.split('/').slice(1).some(part => part === '.' || part === '..')) throw new Error('invalid icon asset path');
    result.icon = pngIcon(read(`${packagePath}/${reference.slice(2)}`));
  }
  return result;
}
