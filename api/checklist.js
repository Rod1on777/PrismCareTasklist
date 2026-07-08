// Serverless-функция Vercel: GET отдаёт сохранённое состояние чек-листа,
// POST сохраняет новое состояние. Хранилище — Redis, подключённый через
// Vercel Marketplace (Upstash Redis / Redis Cloud и т.п.).
//
// Vercel сам подставит переменные окружения после того, как вы подключите
// Redis-интеграцию в Storage → Marketplace в панели проекта. Названия
// переменных могут отличаться в зависимости от провайдера — ниже
// предусмотрены самые частые варианты (KV_REST_API_* и UPSTASH_REDIS_REST_*).

const { Redis } = require('@upstash/redis');

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const STORAGE_KEY = 'cleaning-checklist-state';

module.exports = async function handler(req, res) {
  if (!redis) {
    res.status(500).json({
      error: 'storage_not_configured',
      message: 'Redis не подключён. Добавьте Redis-интеграцию в Vercel: Project → Storage → Marketplace, затем сделайте новый деплой.'
    });
    return;
  }

  if (req.method === 'GET') {
    try {
      const data = await redis.get(STORAGE_KEY);
      res.status(200).json(data || null);
    } catch (err) {
      res.status(500).json({ error: 'storage_read_failed', message: String(err) });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      if (!body || !Array.isArray(body.tabs)) {
        res.status(400).json({ error: 'invalid_payload' });
        return;
      }
      await redis.set(STORAGE_KEY, body);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'storage_write_failed', message: String(err) });
    }
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).end('Method Not Allowed');
};
