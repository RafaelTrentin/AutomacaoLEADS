// index.js
const express = require('express');
const venom = require('venom-bot');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3333;

let lastQrBase64 = null;
let lastQrAttempts = 0;
let clientRef = null;
let isReady = false;

// --- Rotas que respondem já no boot (para o health check do Render) ---
app.get('/', (_req, res) => {
  res.status(200).send('ok');
});

app.get('/health', (_req, res) => {
  res.json({
    status: isReady ? 'ready' : 'starting',
    session: 'mx-session',
    qrAttempts: lastQrAttempts,
    hasQr: !!lastQrBase64
  });
});

app.get('/qr', (_req, res) => {
  if (!lastQrBase64) return res.status(404).send('QR ainda não disponível. Aguarde gerar.');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;">
        <h1>Escaneie o QR no WhatsApp</h1>
        <img style="width:320px;height:320px" src="data:image/png;base64,${lastQrBase64}" />
        <p>Tentativas: ${lastQrAttempts}</p>
      </body>
    </html>
  `);
});

// Exemplo de API
app.post('/send-text', async (req, res) => {
  try {
    if (!clientRef || !isReady) return res.status(503).json({ error: 'Sessão ainda iniciando' });
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to e message são obrigatórios' });
    const chatId = to.endsWith('@c.us') ? to : `${to}@c.us`;
    await clientRef.sendText(chatId, message);
    res.json({ ok: true });
  } catch (e) {
    console.error('Erro /send-text:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Sobe o HTTP imediatamente (assim o Render vê 200 em /)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP em http://0.0.0.0:${PORT}`);
  console.log(`🔎 Abra /qr para visualizar o QR quando disponível`);
});

// --- Inicia o Venom em paralelo ---
venom
  .create({
    session: 'mx-session',
    multidevice: true,
    headless: true,
    useChrome: true,
    disableSpins: true,
    logQR: process.env.LOG_QR === 'true',
    catchQR: (base64Qr, asciiQR, attempts) => {
      lastQrBase64 = base64Qr;
      lastQrAttempts = attempts;
      console.log('====== QR CODE (ASCII) ======');
      console.log(asciiQR);
      console.log('=============================');
    },
    browserArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--window-size=1280,720',
      '--remote-debugging-port=9222'
    ]
    // executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  })
  .then((client) => {
    clientRef = client;
    isReady = true;
    console.log('▶️ Venom iniciado e pronto!');

    client.onMessage(async (message) => {
      try {
        if (!message || !message.from || message.isStatus) return;
        const reply = 'Obrigado pelo contato! 🙌 Nosso time comercial falará com você em breve.';
        await client.sendText(message.from, reply);
      } catch (e) {
        console.error('Erro onMessage:', e);
      }
    });
  })
  .catch((err) => {
    console.error('Erro ao iniciar Venom:', err);
    // Mantém o processo vivo para permitir debug/healthcheck
  });
