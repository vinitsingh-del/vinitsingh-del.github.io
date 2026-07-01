import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const WORKSPACE = resolve(process.cwd());
const ENV_PATH = resolve(WORKSPACE, '.env.local');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile(ENV_PATH);

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 18_000_000) {
        req.destroy();
        rejectBody(new Error('Request is too large.'));
      }
    });
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(body || '{}'));
      } catch {
        rejectBody(new Error('Invalid JSON request.'));
      }
    });
    req.on('error', rejectBody);
  });
}

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.*)$/);
  if (!match) throw new Error('Image data is invalid.');
  const [, mimeType, base64] = match;
  const bytes = Buffer.from(base64, 'base64');
  return new Blob([bytes], { type: mimeType || 'image/png' });
}

async function fitRing(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing from .env.local.');

  const selectedFinger = payload.finger || 'ring finger';
  const handSide = payload.handSide || 'auto-detect';
  const prompt = [
    'Edit the hand photo into a realistic jewelry try-on preview.',
    `Place the provided ring product on the ${selectedFinger}.`,
    handSide === 'auto-detect' ? 'Auto-detect whether this is the left or right hand.' : `Treat this as the ${handSide}.`,
    'Preserve the uploaded hand photo composition, skin texture, lighting, background, and camera angle.',
    'Use the product reference as the ring design. Fit it naturally around the finger with correct perspective, scale, occlusion, contact shadows, and finger overlap.',
    'Do not add extra rings, text, watermarks, labels, UI, or decorative elements.',
    'Return only the edited image.'
  ].join(' ');

  const handBlob = dataUrlToBlob(payload.handImage);
  const productBlob = dataUrlToBlob(payload.productImage);
  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  form.append('image[]', handBlob, 'hand.png');
  form.append('image[]', productBlob, 'ring-product.png');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 150_000);
  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json.error?.message || `OpenAI image edit failed (${response.status}).`;
    throw new Error(message);
  }

  const image = json.data?.[0];
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`;
  if (image?.url) return image.url;
  throw new Error('OpenAI did not return an image.');
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, hasKey: Boolean(process.env.OPENAI_API_KEY) });
    return;
  }
  if (req.method !== 'POST' || req.url !== '/api/fit-ring') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }
  try {
    const payload = await readJson(req);
    const image = await fitRing(payload);
    sendJson(res, 200, { image });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Image generation failed.' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`OpenAI try-on proxy running at http://127.0.0.1:${PORT}`);
});
