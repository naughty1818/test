require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Storage } = require('@google-cloud/storage');

const PORT = process.env.PORT || 3000;
const BUCKET_NAME = process.env.GCS_BUCKET;
const APP_PASSWORD = process.env.APP_PASSWORD;
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 500);

function fail(msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}
if (!BUCKET_NAME) fail('GCS_BUCKET set kora nai.');
if (!APP_PASSWORD) fail('APP_PASSWORD set kora nai (eta chhara je keu tomar bucket e upload korte parbe).');

// ---------- Google Cloud Storage ----------
// Render e: GCS_CREDENTIALS_JSON e service account key file er puro content thake.
// Nijer computer e: GOOGLE_APPLICATION_CREDENTIALS e key file er path dile hobe.
let storage;
if (process.env.GCS_CREDENTIALS_JSON) {
  let credentials;
  try {
    credentials = JSON.parse(process.env.GCS_CREDENTIALS_JSON);
  } catch {
    fail('GCS_CREDENTIALS_JSON valid JSON na. Key file er puro content copy-paste koro.');
  }
  storage = new Storage({ projectId: credentials.project_id, credentials });
} else {
  storage = new Storage();
}
const bucket = storage.bucket(BUCKET_NAME);

// ---------- Simple password check ----------
function checkPassword(req, res, next) {
  const given = Buffer.from(String(req.get('x-app-password') || ''));
  const real = Buffer.from(APP_PASSWORD);
  const ok = given.length === real.length && crypto.timingSafeEqual(given, real);
  if (!ok) return res.status(401).json({ error: 'Password thik na.' });
  next();
}

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  res.json({ maxFileMb: MAX_FILE_MB });
});

// Step 1: browser ke ekta temporary upload link (signed URL) dei
app.post('/api/upload-url', checkPassword, async (req, res) => {
  try {
    const { filename, contentType, size } = req.body || {};
    if (typeof filename !== 'string' || !filename) return res.status(400).json({ error: 'Filename dao.' });
    if (typeof contentType !== 'string' || !contentType.startsWith('video/')) {
      return res.status(400).json({ error: 'Shudhu video file upload kora jabe.' });
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_MB * 1024 * 1024) {
      return res.status(400).json({ error: `File ${MAX_FILE_MB}MB er moddhe hote hobe.` });
    }

    const safeName = filename.replace(/[^\w.\-]+/g, '_').slice(-100);
    const objectName = `videos/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`;

    const [uploadUrl] = await bucket.file(objectName).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 30 * 60 * 1000, // 30 minute
      contentType
    });
    res.json({ uploadUrl, objectName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Step 2: upload shesh hole title/description save kori
app.post('/api/finish', checkPassword, async (req, res) => {
  try {
    const { objectName, title, description } = req.body || {};
    if (typeof objectName !== 'string' || !objectName.startsWith('videos/') || objectName.includes('..')) {
      return res.status(400).json({ error: 'Invalid object name.' });
    }
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ error: 'File Cloud Storage e paoa jay nai.' });

    const [meta] = await file.getMetadata();
    if (Number(meta.size) > MAX_FILE_MB * 1024 * 1024) {
      await file.delete();
      return res.status(413).json({ error: `File ${MAX_FILE_MB}MB er beshi chhilo, delete kora hoyeche.` });
    }

    await file.setMetadata({
      metadata: {
        title: String(title || '').trim().slice(0, 100),
        description: String(description || '').trim().slice(0, 5000)
      }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Video list (private bucket theke 1 ghontar signed URL diye)
app.get('/api/videos', async (req, res) => {
  try {
    const [files] = await bucket.getFiles({ prefix: 'videos/' });
    const videos = await Promise.all(
      files
        .filter((f) => !f.name.endsWith('/'))
        .sort((a, b) => new Date(b.metadata.timeCreated) - new Date(a.metadata.timeCreated))
        .map(async (f) => {
          const [url] = await f.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000
          });
          const meta = f.metadata.metadata || {};
          return {
            name: f.name,
            title: meta.title || f.name.replace(/^videos\/\d+-[0-9a-f]{8}-/, ''),
            description: meta.description || '',
            size: Number(f.metadata.size),
            created: f.metadata.timeCreated,
            url
          };
        })
    );
    res.json(videos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => console.log(`Video Hub chalu: port ${PORT}`));
