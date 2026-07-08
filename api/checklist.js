// Serverless-функция Vercel: GET отдаёт сохранённое состояние чек-листа,
// POST сохраняет новое состояние. Хранилище — Vercel Blob (Private-стор):
// нативное хранилище Vercel, бесплатно в пределах Hobby-лимитов (1 ГБ
// хранилища и 2000 операций записи в месяц), не требует стороннего
// аккаунта. Private-стор означает, что файл недоступен по прямой ссылке
// никому, кроме этой функции — читаем и пишем через SDK с access:'private'.

const { put, get } = require('@vercel/blob');

const PATHNAME = 'cleaning-checklist-state.json';
// Vercel подключает Blob двумя способами: старый — статический токен
// BLOB_READ_WRITE_TOKEN; новый (по умолчанию) — OIDC, при котором в проект
// подставляются BLOB_STORE_ID и VERCEL_OIDC_TOKEN, а SDK сам обменивает их
// на доступ. Проверяем оба варианта, чтобы не зависеть от того, какой из
// них использует ваш проект.
const isConfigured = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

module.exports = async function handler(req, res) {
  if (!isConfigured) {
    res.status(500).json({
      error: 'storage_not_configured',
      message: 'Vercel Blob не подключён. Добавьте хранилище: Project → Storage → Create Database → Blob, затем сделайте новый деплой.'
    });
    return;
  }

  if (req.method === 'GET') {
    try {
      const result = await get(PATHNAME, { access: 'private' });
      if (!result || result.statusCode !== 200 || !result.stream) {
        // Ещё ничего не сохраняли — это нормально при первом запуске
        res.status(200).json(null);
        return;
      }
      const text = await new Response(result.stream).text();
      const data = JSON.parse(text);
      res.status(200).json(data);
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
      await put(PATHNAME, JSON.stringify(body), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json'
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'storage_write_failed', message: String(err) });
    }
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).end('Method Not Allowed');
};
