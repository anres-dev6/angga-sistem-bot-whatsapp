import http from 'http';
import chalk from 'chalk';
import config from './config.js';

/**
 * Start lightweight HTTP API Server for WhatsApp Bot integration
 */
export function startApiServer() {
  const PORT = config.WA_API_PORT || 3001;

  const server = http.createServer(async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Secret-Key');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Health check endpoint
    if (req.url === '/api/health' && req.method === 'GET') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'online',
        botConnected: Boolean(global.waSock?.user),
        targetGroupConfigured: Boolean(config.ANONYMOUS_FORWARD_JID)
      }));
      return;
    }

    // Forward Anonymous Message endpoint
    if (req.url === '/api/send-anonymous' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const secretKeyHeader = req.headers['x-secret-key'];
          if (config.FORWARD_SECRET_KEY && secretKeyHeader !== config.FORWARD_SECRET_KEY) {
            console.log(chalk.red('[WA API] Unauthorized secret key header attempt.'));
          }

          const payload = JSON.parse(body || '{}');
          const {
            sender = 'ANONYMOUS AGENT',
            message = '',
            priority = 'medium',
            evidenceLink = '-',
            source = 'Website DPO'
          } = payload;

          if (!message || !message.trim()) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Pesan tidak boleh kosong.' }));
            return;
          }

          if (!global.waSock) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Koneksi WhatsApp Bot belum siap / terputus.' }));
            return;
          }

          const priorityTag = priority === 'high' ? '🔴 HIGH ALERT' : priority === 'medium' ? '🟡 WARNING' : '🟢 INFO';
          const timeStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

          const formattedMessage = 
`🚨 *[LAPORAN / PESAN ANONIM DPO DIGITAL]* 🚨
--------------------------------------------------
👤 *Pengirim:* ${sender}
⚠️ *Prioritas:* ${priorityTag}
🌐 *Sumber:* ${source}
📅 *Waktu:* ${timeStr} WIB

💬 *Pesan / Kronologi:*
"${message}"

🔗 *Link Bukti:* ${evidenceLink !== '-' ? evidenceLink : 'Tidak ada'}
--------------------------------------------------
🔒 _Pesan ini terforward secara terstruktur via DPO Multi-Forward API_`;

          // Determine target JIDs (Target Group JID if set, else fallback to Owners)
          let targetJids = [];
          
          if (config.ANONYMOUS_FORWARD_JID && config.ANONYMOUS_FORWARD_JID.trim() !== '') {
            let jid = config.ANONYMOUS_FORWARD_JID.trim();
            if (!jid.includes('@')) {
              jid = jid + '@g.us';
            }
            targetJids.push(jid);
            console.log(chalk.cyan(`[WA API] Routing anonymous message to target Group JID: ${jid}`));
          } else {
            targetJids = config.OWNER.map(num => {
              const cleaned = num.replace(/[^0-9]/g, '');
              return `${cleaned}@s.whatsapp.net`;
            });
            console.log(chalk.yellow(`[WA API] No Group JID set. Routing anonymous message to Owner JIDs (${targetJids.length} contacts).`));
          }

          const sendResults = [];
          for (const targetJid of targetJids) {
            try {
              const sent = await global.waSock.sendMessage(targetJid, { text: formattedMessage });
              sendResults.push({ targetJid, success: true, messageId: sent?.key?.id });
            } catch (err) {
              console.error(chalk.red(`[WA API] Failed sending to ${targetJid}:`), err.message);
              sendResults.push({ targetJid, success: false, error: err.message });
            }
          }

          const isOverallSuccess = sendResults.some(r => r.success);
          res.statusCode = isOverallSuccess ? 200 : 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: isOverallSuccess,
            sendResults,
            targetGroupJid: config.ANONYMOUS_FORWARD_JID || null
          }));

        } catch (err) {
          console.error(chalk.red('[WA API] Internal server error:'), err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.statusCode = 404;
    res.end('Not Found');
  });

  server.listen(PORT, () => {
    console.log(chalk.greenBright(`[WA Bot API] Server listening securely on port ${PORT}`));
    if (config.ANONYMOUS_FORWARD_JID) {
      console.log(chalk.cyan(`[WA Bot API] Anonymous chats configured to forward directly to Group JID: ${config.ANONYMOUS_FORWARD_JID}`));
    }
  });
}
