(() => {
const decoder = new TextDecoder('utf-8');
const decodeXml = text => {
  const doc = new DOMParser().parseFromString(`<root>${text}</root>`, 'application/xml');
  return doc.documentElement.textContent || '';
};
const attr = (node, name) => node?.getAttribute(name) || '';
function columnIndex(reference) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return -1;
  let value = 0; for (const char of letters) value = value * 26 + char.charCodeAt(0) - 64;
  return value - 1;
}
async function readZipEntry(bytes, view, entry) {
  if (entry.uncompressedSize > 32 * 1024 * 1024) throw new Error('A planilha XLSX excede o limite de leitura segura.');
  const offset = entry.localOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error('Estrutura interna da planilha inválida.');
  const nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return decoder.decode(compressed);
  if (entry.method !== 8 || !('DecompressionStream' in window)) throw new Error('Este navegador não oferece suporte à leitura deste formato XLSX.');
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return decoder.decode(await new Response(stream).arrayBuffer());
}
async function getZipEntries(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  const min = Math.max(0, bytes.length - 65557); let end = -1;
  for (let i = bytes.length - 22; i >= min; i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('O arquivo não parece ser uma planilha XLSX válida.');
  const count = view.getUint16(end + 10, true); let cursor = view.getUint32(end + 16, true); const entries = new Map();
  if (count > 2000) throw new Error('A planilha contém itens demais para ser processada com segurança.');
  for (let i = 0; i < count; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('Estrutura interna da planilha inválida.');
    const method = view.getUint16(cursor + 10, true), compressedSize = view.getUint32(cursor + 20, true), uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    entries.set(name, { method, compressedSize, uncompressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  const texts = new Map();
  return { get: async name => {
    if (!entries.has(name)) return null;
    if (!texts.has(name)) texts.set(name, await readZipEntry(bytes, view, entries.get(name)));
    return texts.get(name);
  }};
}
function parseXml(text, label) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error(`A planilha contém XML inválido em ${label}.`);
  return doc;
}
function nodeText(node) {
  return [...node.getElementsByTagNameNS('*', 't')].map(element => element.textContent || '').join('');
}
function relationshipTarget(target) {
  const parts = (target.startsWith('/') ? target.slice(1) : `xl/${target}`).replace(/\\/g, '/').split('/');
  const result = [];
  for (const part of parts) { if (part === '..') result.pop(); else if (part !== '.' && part) result.push(part); }
  return result.join('/');
}
async function readCaixaWorkbook(file) {
  const zip = await getZipEntries(await file.arrayBuffer());
  const workbookText = await zip.get('xl/workbook.xml');
  const relsText = await zip.get('xl/_rels/workbook.xml.rels');
  let sheetPath = 'xl/worksheets/sheet1.xml';
  if (workbookText && relsText) {
    const workbook = parseXml(workbookText, 'workbook'), rels = parseXml(relsText, 'relações');
    const sheet = workbook.getElementsByTagNameNS('*', 'sheet')[0];
    const id = sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || attr(sheet, 'r:id');
    const relation = [...rels.getElementsByTagNameNS('*', 'Relationship')].find(item => attr(item, 'Id') === id);
    if (relation && attr(relation, 'Target')) sheetPath = relationshipTarget(attr(relation, 'Target'));
  }
  const sheetText = await zip.get(sheetPath);
  if (!sheetText) throw new Error('Não foi possível abrir a primeira aba da planilha XLSX.');
  const sharedText = await zip.get('xl/sharedStrings.xml');
  const shared = sharedText ? [...parseXml(sharedText, 'textos compartilhados').getElementsByTagNameNS('*', 'si')].map(nodeText) : [];
  const sheet = parseXml(sheetText, 'resultados');
  const rows = [...sheet.getElementsByTagNameNS('*', 'row')].map(rowNode => {
    const row = []; let nextIndex = 0;
    for (const cell of rowNode.children) {
      if (cell.localName !== 'c') continue;
      const explicitIndex = columnIndex(attr(cell, 'r'));
      const index = explicitIndex >= 0 ? explicitIndex : nextIndex;
      nextIndex = index + 1;
      if (index < 0) continue;
      const type = attr(cell, 't'); let value = '';
      if (type === 'inlineStr') value = nodeText(cell);
      else {
        const raw = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent || '';
        value = type === 's' ? (shared[Number(raw)] ?? '') : decodeXml(raw);
      }
      row[index] = value;
    }
    return row.map(value => value ?? '');
  });
  return rows;
}
window.readCaixaWorkbook = readCaixaWorkbook;
})();
