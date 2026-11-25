import { createServer } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DB_NAME = process.env.MONGODB_DATABASE || 'lotolab';
let mongoClient = null;
let mongoError = null;

if (process.env.MONGODB_URI) {
  try {
    const { MongoClient } = await import('mongodb');
    mongoClient = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    await mongoClient.connect();
    await mongoClient.db(DB_NAME).collection('draws').createIndex({ lotteryId: 1, numero: 1 }, { unique: true });
    console.log(`MongoDB conectado (banco: ${DB_NAME}).`);
  } catch (error) {
    mongoError = error;
    mongoClient = null;
    console.error('MongoDB não conectou; a interface continuará sendo servida, mas a API de resultados ficará indisponível:', error.message);
  }
} else {
  console.warn('MONGODB_URI não configurada. Modo de desenvolvimento: resultados ficam sem persistência no servidor.');
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(body)); };

async function api(req, res, url) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
  if (url.pathname === '/api/health') {
    if (process.env.MONGODB_URI && !mongoClient) return json(res, 503, { status: 'degraded', storage: 'unavailable', message: 'MongoDB não está conectado.' });
    if (!mongoClient) return json(res, 200, { status: 'ok', storage: 'local', source: null, updatedAt: null, note: 'Banco não configurado; configure MongoDB para servir resultados compartilhados.' });
    try {
      const latest = await mongoClient.db(DB_NAME).collection('draws').find({ lotteryId: 'lotofacil' }, { projection: { _id: 0, source: 1, updatedAt: 1, numero: 1 } }).sort({ numero: -1 }).limit(1).next();
      return json(res, 200, { status: 'ok', storage: 'mongodb', source: latest?.source || null, updatedAt: latest?.updatedAt || null });
    } catch (error) {
      console.error('Falha consultando status do banco:', error.message);
      return json(res, 503, { status: 'degraded', storage: 'unavailable', message: 'Não foi possível consultar o banco.' });
    }
  }
  if (url.pathname === '/api/draws') {
    const lottery = url.searchParams.get('lottery') || 'lotofacil';
    if (lottery !== 'lotofacil') return json(res, 400, { error: 'Modalidade ainda não disponível.' });
    if (!mongoClient) {
      if (process.env.MONGODB_URI) return json(res, 503, { error: 'MongoDB indisponível.' });
      return json(res, 200, { storage: 'local', draws: [] });
    }
    try {
      const draws = await mongoClient.db(DB_NAME).collection('draws').find({ lotteryId: lottery }, { projection: { _id: 0 } }).sort({ numero: -1 }).limit(5000).toArray();
      return json(res, 200, { storage: 'mongodb', draws });
    } catch (error) {
      console.error('Falha consultando resultados:', error.message);
      return json(res, 503, { error: 'Não foi possível consultar os resultados.' });
    }
  }
  return json(res, 404, { error: 'Endpoint não encontrado.' });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('Método não permitido'); }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('Requisição inválida'); }
  if (pathname === '/') pathname = '/index.html';
  const target = path.resolve(PUBLIC, `.${pathname}`);
  if (!target.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Acesso negado'); }
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) throw new Error('not-file');
    res.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream', 'content-length': stat.size, 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'cache-control': path.basename(target) === 'index.html' ? 'no-cache' : 'public, max-age=3600' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Página não encontrada');
  }
});

server.listen(PORT, HOST, () => console.log(`LotoLab disponível em http://${HOST}:${PORT}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { server.close(); if (mongoClient) await mongoClient.close(); process.exit(0); });
