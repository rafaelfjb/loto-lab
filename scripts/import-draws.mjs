import { readFile, stat } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const normalize = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const decodeXml = value => String(value ?? '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
  const key = entity.toLowerCase();
  if (key === 'amp') return '&'; if (key === 'lt') return '<'; if (key === 'gt') return '>';
  if (key === 'quot') return '"'; if (key === 'apos') return "'";
  return key.startsWith('#x') ? String.fromCodePoint(parseInt(key.slice(2), 16)) : String.fromCodePoint(Number(key.slice(1)));
});
const attr = (text, name) => text.match(new RegExp(`(?:^|\\s)${name.replace(':', '\\:')}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? '';

function zipEntries(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const min = Math.max(0, bytes.length - 65557);
  let end = -1;
  for (let i = bytes.length - 22; i >= min; i--) if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('O arquivo não parece ser uma planilha XLSX válida (estrutura ZIP ausente).');
  const count = bytes.readUInt16LE(end + 10); let cursor = bytes.readUInt32LE(end + 16); const entries = new Map();
  if (count > 2000) throw new Error('A planilha contém itens demais para ser processada com segurança.');
  let totalUncompressed = 0;
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Estrutura interna XLSX inválida.');
    const method = bytes.readUInt16LE(cursor + 10), compressedSize = bytes.readUInt32LE(cursor + 20), uncompressedSize = bytes.readUInt32LE(cursor + 24);
    totalUncompressed += uncompressedSize;
    if (uncompressedSize > 32 * 1024 * 1024 || totalUncompressed > 100 * 1024 * 1024) throw new Error('A planilha XLSX excede os limites de leitura segura.');
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42), name = bytes.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    const localNameLength = bytes.readUInt16LE(localOffset + 26), localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(start, start + compressedSize);
    let content;
    if (method === 0) content = Buffer.from(compressed);
    else if (method === 8) content = inflateRawSync(compressed, { maxOutputLength: 32 * 1024 * 1024 });
    else throw new Error(`Método de compactação XLSX não suportado (${method}).`);
    entries.set(name, content.toString('utf8'));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
function columnIndex(ref) {
  const letters = ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase(); if (!letters) return -1;
  let out = 0; for (const char of letters) out = out * 26 + char.charCodeAt(0) - 64;
  return out - 1;
}
function workbookSheetPath(entries) {
  const workbook = entries.get('xl/workbook.xml');
  const rels = entries.get('xl/_rels/workbook.xml.rels');
  const sheet = workbook?.match(/<sheet\b([^>]*?)\/?\s*>/i);
  const id = sheet ? attr(sheet[1], 'r:id') : '';
  if (id && rels) {
    const relationship = [...rels.matchAll(/<Relationship\b([^>]*?)\/?\s*>/gi)].find(match => attr(match[1], 'Id') === id);
    const target = relationship ? attr(relationship[1], 'Target') : '';
    if (target) {
      const normalized = target.replace(/\\/g, '/').replace(/^\//, '');
      if (normalized.startsWith('xl/')) return normalized;
      const pieces = ['xl', ...normalized.split('/')]; const resolved = [];
      for (const piece of pieces) { if (piece === '..') resolved.pop(); else if (piece !== '.') resolved.push(piece); }
      return resolved.join('/');
    }
  }
  return 'xl/worksheets/sheet1.xml';
}
function parseXlsxMatrix(buffer) {
  const entries = zipEntries(buffer);
  for (const [name, xml] of entries) entries.set(name, xml.replaceAll('<x:', '<').replaceAll('</x:', '</'));
  const shared = (entries.get('xl/sharedStrings.xml') || '').match(/<si\b[^>]*>([\s\S]*?)<\/si>/gi) || [];
  const sharedStrings = shared.map(item => [...item.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(match => decodeXml(match[1])).join(''));
  const sheetPath = workbookSheetPath(entries), sheet = entries.get(sheetPath);
  if (!sheet) throw new Error('Não foi possível localizar a primeira aba da planilha XLSX.');
  const rows = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const row = [];
    let nextIndex = 0;
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi)) {
      const attributes = cellMatch[1], body = cellMatch[2] || '', explicitIndex = columnIndex(attr(attributes, 'r'));
      const index = explicitIndex >= 0 ? explicitIndex : nextIndex;
      nextIndex = index + 1;
      if (index < 0) continue;
      const type = attr(attributes, 't');
      let value = '';
      if (type === 'inlineStr') value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(match => decodeXml(match[1])).join('');
      else {
        const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? '';
        value = type === 's' ? (sharedStrings[Number(raw)] ?? '') : decodeXml(raw);
      }
      row[index] = value;
    }
    rows.push(row.map(value => value ?? ''));
  }
  return rows;
}
function parseCsvMatrix(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) throw new Error('O arquivo CSV está vazio.');
  const first = lines[0], separator = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  return lines.map(line => {
    const cells = []; let value = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
      else if (char === separator && !quoted) { cells.push(value.trim()); value = ''; }
      else value += char;
    }
    cells.push(value.trim()); return cells;
  });
}
function normalizeDate(raw) {
  const value = String(raw ?? '').trim();
  if (/^\d{1,5}(?:\.\d+)?$/.test(value) && Number(value) >= 20000 && Number(value) <= 80000) {
    const date = new Date(Math.round((Number(value) - 25569) * 86400000));
    const iso = date.toISOString().slice(0, 10); return { data: `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`, iso };
  }
  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = br ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(Date.parse(`${iso}T00:00:00Z`))) throw new Error(`Data inválida: ${value}`);
  return { data: `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`, iso };
}
function parseMoney(raw) {
  const value = String(raw ?? '').trim().replace(/R\$\s*/i, '').replace(/\s/g, '');
  if (!value) return null;
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : null;
}
function parseWinners(raw) { const value = String(raw ?? '').trim(); if (!value) return null; const parsed = Number(value.replace(/\D/g, '')); return Number.isFinite(parsed) ? parsed : null; }
export function parseMatrix(matrix) {
  const normalizedRows = matrix.map(row => row.map(normalize));
  let headerIndex = -1, headers = [], numberIndex = -1, dateIndex = -1, drawIndex = -1, ballIndices = [];
  for (let i = 0; i < Math.min(normalizedRows.length, 30); i++) {
    const candidate = normalizedRows[i];
    const n = candidate.findIndex(value => ['concurso', 'numero', 'numerodoconcurso'].includes(value));
    const d = candidate.findIndex(value => ['data', 'datasorteio', 'dataconcurso'].includes(value));
    const balls = candidate.map((value, index) => /^bola\d+$/.test(value) ? { index, number: Number(value.slice(4)) } : null).filter(Boolean).sort((a, b) => a.number - b.number);
    const draw = candidate.findIndex(value => ['dezenas', 'resultado', 'numeros', 'bolas'].includes(value));
    if (n >= 0 && d >= 0 && (balls.length >= 15 || draw >= 0)) { headerIndex = i; headers = candidate; numberIndex = n; dateIndex = d; drawIndex = draw; ballIndices = balls.slice(0, 15).map(item => item.index); break; }
  }
  if (headerIndex < 0) throw new Error('Cabeçalhos não reconhecidos. Esperado: Concurso, Data Sorteio e Bola1 até Bola15, ou coluna dezenas no CSV.');
  const draws = new Map();
  for (const row of matrix.slice(headerIndex + 1)) {
    const numero = Number(String(row[numberIndex] ?? '').trim());
    if (!Number.isInteger(numero) || numero < 1) continue;
    const dezenas = drawIndex >= 0 ? ((String(row[drawIndex] ?? '').match(/\d+/g) || []).map(Number)) : ballIndices.map(index => Number(String(row[index] ?? '').trim()));
    if (dezenas.length !== 15 || dezenas.some(n => !Number.isInteger(n) || n < 1 || n > 25) || new Set(dezenas).size !== 15) throw new Error(`Concurso ${numero}: esperado exatamente 15 dezenas únicas entre 01 e 25.`);
    const date = normalizeDate(row[dateIndex]);
    const item = { lotteryId: 'lotofacil', numero, ...date, dezenas: dezenas.sort((a, b) => a - b) };
    const tiers = {};
    for (const tier of [15, 14, 13, 12, 11]) {
      const winnerIndex = headers.findIndex(value => value === `ganhadores${tier}acertos`);
      const amountIndex = headers.findIndex(value => value === `rateio${tier}acertos`);
      if (winnerIndex >= 0 || amountIndex >= 0) tiers[tier] = { ganhadores: winnerIndex >= 0 ? parseWinners(row[winnerIndex]) : null, rateio: amountIndex >= 0 ? parseMoney(row[amountIndex]) : null };
    }
    if (Object.keys(tiers).length) item.premiacao = tiers;
    const estimatedIndex = headers.findIndex(value => value.startsWith('estimativapremio'));
    if (estimatedIndex >= 0 && parseMoney(row[estimatedIndex]) !== null) item.estimativaPremio = parseMoney(row[estimatedIndex]);
    const accumulatedIndex = headers.findIndex(value => value === 'acumulado15acertos');
    if (accumulatedIndex >= 0 && parseMoney(row[accumulatedIndex]) !== null) item.acumulado15 = parseMoney(row[accumulatedIndex]);
    const specialIndex = headers.findIndex(value => value.startsWith('acumuladosorteioespecial'));
    if (specialIndex >= 0 && parseMoney(row[specialIndex]) !== null) item.acumuladoEspecial = parseMoney(row[specialIndex]);
    const revenueIndex = headers.findIndex(value => value === 'arrecadacaototal');
    if (revenueIndex >= 0 && parseMoney(row[revenueIndex]) !== null) item.arrecadacaoTotal = parseMoney(row[revenueIndex]);
    const cityIndex = headers.findIndex(value => value === 'cidadeuf');
    if (cityIndex >= 0 && String(row[cityIndex] ?? '').trim()) item.cidadeUf = String(row[cityIndex]).trim();
    const observationIndex = headers.findIndex(value => value === 'observacao');
    if (observationIndex >= 0 && String(row[observationIndex] ?? '').trim()) item.observacao = String(row[observationIndex]).trim();
    const previous = draws.get(numero);
    if (previous && previous.dezenas.join(',') !== item.dezenas.join(',')) throw new Error(`A planilha contém resultados divergentes para o concurso ${numero}.`);
    draws.set(numero, item);
  }
  if (!draws.size) throw new Error('Nenhuma linha de concurso válida foi encontrada na planilha.');
  return [...draws.values()].sort((a, b) => a.numero - b.numero);
}
export function parseDraws(text) { return parseMatrix(parseCsvMatrix(text)); }
export function parseXlsx(buffer) { return parseMatrix(parseXlsxMatrix(buffer)); }
function arg(name) { const prefix = `--${name}=`; return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length); }
async function main() {
  const file = process.argv[2], sourceName = arg('source-name'), sourceUrl = arg('source-url');
  if (!file || !sourceName || !sourceUrl) throw new Error('Uso: node scripts/import-draws.mjs <arquivo.xlsx|arquivo.csv> --source-name="CAIXA" --source-url="https://loterias.caixa.gov.br/..."');
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:' || !(url.hostname === 'caixa.gov.br' || url.hostname.endsWith('.caixa.gov.br'))) throw new Error('A origem precisa ser uma URL HTTPS do domínio caixa.gov.br.');
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI antes da importação.');
  const fileInfo = await stat(file);
  if (fileInfo.size > 25 * 1024 * 1024) throw new Error('O arquivo ultrapassa o limite administrativo de 25 MB.');
  const buffer = await readFile(file);
  const draws = /\.xlsx$/i.test(file) ? parseXlsx(buffer) : /\.csv$/i.test(file) ? parseDraws(buffer.toString('utf8')) : (() => { throw new Error('Formato não suportado. Use .xlsx ou .csv.'); })();
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'lotolab');
    const collection = db.collection('draws');
    await collection.createIndex({ lotteryId: 1, numero: 1 }, { unique: true });
    const now = new Date().toISOString();
    const docs = draws.map(draw => ({ ...draw, source: `${sourceName} (arquivo informado pelo operador; conteúdo não verificado independentemente)`, sourceUrl, sourceVerification: 'operator-attested-not-independently-verified', updatedAt: now }));
    await collection.bulkWrite(docs.map(doc => ({ updateOne: { filter: { lotteryId: doc.lotteryId, numero: doc.numero }, update: { $set: doc }, upsert: true } })), { ordered: true });
    console.log(`Importados/atualizados ${docs.length} concursos da Lotofácil.`);
    console.log(`Origem registrada: ${sourceUrl}`);
    console.log('O arquivo e a origem foram registrados conforme informados pelo operador; o conteúdo não foi comparado automaticamente com os dados oficiais.');
  } finally { await client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(`Erro: ${error.message}`); process.exitCode = 1; });
