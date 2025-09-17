// index.js
const express = require('express');
const venom = require('venom-bot');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3333;

// Variáveis de ambiente úteis no Render:
// CHROME_PATH=/usr/bin/google-chrome
// LOG_QR=true
// NODE_ENV=production
// (opcional) PUPPETEER_SKIP_DOWNLOAD=true

let lastQrBase64 = null;
let lastQrAttempts = 0;

// Função principal: inicia o Venom e sobe o servidor
venom
  .create({
    session: 'mx-session',
    multidevice: true,
    headless: true,              // roda sem abrir janela
    useChrome: true,
    // executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', // opcional
    disableSpins: true,
    logQR: process.env.LOG_QR === 'true',
    catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
      // guarda o QR pra servir via HTTP e imprime no log
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
  })
  .then((client) => start(client))
  .catch((err) => {
    console.error('Erro ao iniciar Venom:', err);
    process.exit(1);
  });

function start(client) {
  console.log('▶️ Venom iniciado, configurando endpoints...');

  // Healthcheck simples
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', session: 'mx-session', qrAttempts: lastQrAttempts });
  });

  // Mostra o QR em HTML (abra no browser para escanear)
  app.get('/qr', (_req, res) => {
    if (!lastQrBase64) {
      return res.status(404).send('QR ainda não disponível. Aguarde o Venom gerar.');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <html>
        <head><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
        <body style="font-family: sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; flex-direction:column; gap:16px;">
          <h1>Escaneie o QR no WhatsApp</h1>
          <img style="width:320px;height:320px" src="data:image/png;base64,${lastQrBase64}" />
          <p>Tentativas: ${lastQrAttempts}</p>
        </body>
      </html>
    `);
  });

  // Envia texto (exemplo de API)
  app.post('/send-text', async (req, res) => {
    try {
      const { to, message } = req.body;
      if (!to || !message) return res.status(400).json({ error: 'to e message são obrigatórios' });

      // Formato internacional recomendado pelo Venom: 5511999999999@c.us
      const chatId = to.endsWith('@c.us') ? to : `${to}@c.us`;
      await client.sendText(chatId, message);
      return res.json({ ok: true });
    } catch (e) {
      console.error('Erro /send-text:', e);
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Resposta automática de exemplo
  client.onMessage(async (message) => {
    try {
      if (!message || !message.from || message.isStatus) return;

      // Agradece e informa que o supervisor comercial entrará em contato
      const reply =
        'Obrigado pelo contato! 🙌 Nosso time comercial recebeu sua mensagem e um supervisor falará com você assim que possível.';

      await client.sendText(message.from, reply);
    } catch (e) {
      console.error('Erro onMessage:', e);
    }
  });

  // Sobe HTTP em 0.0.0.0 (obrigatório no Render)
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP em http://0.0.0.0:${PORT}`);
    console.log(`🔎 Abra /qr para visualizar o QR quando disponível`);
  });
}
