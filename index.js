const express = require('express');
const bodyParser = require('body-parser');
const venom = require('venom-bot');

const app = express();
app.use(bodyParser.json());

let client = null;
let venomState = 'BOOTING';
let isConn = false;

const HOST = '0.0.0.0';
const PORT = 3333;

/* ----------------- HTTP (sobe já) ----------------- */
app.get('/', (_req, res) => res.send('Venom API online ✅'));
app.get('/health', (_req, res) => res.json({
  ok: true,
  hasClient: !!client,
  state: venomState,
  isConnected: isConn
}));

app.get('/me', async (_req, res) => {
  try {
    if (!client) return res.status(503).json({ ok:false, error:'client not ready' });
    const me = await client.getHostDevice();
    res.json({ ok:true, me });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

app.post('/send-text', (req, res) => {
  const { phone, text } = req.body || {};
  if (!phone || !text) return res.status(400).json({ ok:false, error:'phone e text são obrigatórios' });
  if (!client) return res.status(503).json({ ok:false, error:'client not ready' });
  const to = phone.includes('@') ? phone : `${phone}@c.us`;
  console.log('→ /send-text | to:', to, '| text:', text);
  res.json({ ok:true, queued:true, to });
  client.sendText(to, text)
    .then(()=>console.log('✓ send-text entregue para', to))
    .catch(e=>console.error('✗ send-text erro:', e?.message||e));
});

app.post('/send-group-text', (req, res) => {
  const { groupId, text } = req.body || {};
  if (!groupId || !text) return res.status(400).json({ ok:false, error:'groupId e text são obrigatórios' });
  if (!client) return res.status(503).json({ ok:false, error:'client not ready' });
  console.log('→ /send-group-text | to:', groupId, '| text:', text);
  res.json({ ok:true, queued:true, to: groupId });
  client.sendText(groupId, text)
    .then(()=>console.log('✓ send-group-text entregue para', groupId))
    .catch(e=>console.error('✗ send-group-text erro:', e?.message||e));
});

app.get('/groups', async (_req, res) => {
  try {
    if (!client) return res.status(503).json({ ok:false, error:'client not ready' });
    let chats = null;
    if (typeof client.getAllChats === 'function') chats = await client.getAllChats();
    else if (typeof client.getChats === 'function') chats = await client.getChats();
    if (!Array.isArray(chats)) return res.status(500).json({ ok:false, error:'não foi possível listar chats nesta versão' });
    const out = chats.filter(c=>c.isGroup).map(g=>({
      name: g.name || g.contact?.pushname || g.id?.user || 'Grupo',
      id:   g.id?._serialized || g.id || ''
    }));
    res.json(out);
  } catch (e) {
    console.error('Erro /groups:', e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`🌐 HTTP em http://127.0.0.1:${PORT}`);
});

/* --------------- VENOM (GUI ligada) --------------- */
startVenom();

function startVenom() {
  console.log('▶️  Iniciando Venom...');
  venom.create({
    session: 'mx-session',
    multidevice: true,
    headless: false,     // GUI para depurar; depois pode trocar para headless:true + '--headless=new'
    waitForLogin: true,
    logQR: true,
    disableSpins: true
  })
  .then((c)=>{
    client = c;
    console.log('✅ Venom iniciado');
    wireVenom();
    monitorConnection();
  })
  .catch(e=>{
    console.error('❌ Erro ao iniciar Venom:', e?.message||e);
  });
}

function wireVenom() {
  if (client?.onStateChange) {
    client.onStateChange((state)=>{
      venomState = String(state || '').toUpperCase();
      console.log('🔌 Estado do WhatsApp:', venomState);
    });
  }

  if (client?.onMessage) {
    client.onMessage((m)=>{
      const from = m.from || '';
      const text = (m.body||'').trim();
      console.log('📩 onMessage | from:', from, '| isGroup:', from.endsWith('@g.us'), '| text:', text);
      if (from.endsWith('@g.us')) console.log('🧩 GroupId:', from);
    });
  } else {
    console.log('⚠️ onMessage não disponível nesta build.');
  }

  if (client?.onAnyMessage) {
    client.onAnyMessage((m)=>{
      const from = m.from || '';
      const text = (m.body||'').trim();
      console.log('🪝 onAnyMessage | from:', from, '| isGroup:', from.endsWith('@g.us'), '| text:', text);
      if (from.endsWith('@g.us')) console.log('🧩 GroupId(any):', from);
    });
  }
}

function monitorConnection() {
  // checa periodicamente se está conectado
  const tick = async () => {
    try {
      if (client?.isConnected) {
        isConn = !!(await client.isConnected());
      }
    } catch (_) { isConn = false; }
    setTimeout(tick, 2000);
  };
  tick();
}
