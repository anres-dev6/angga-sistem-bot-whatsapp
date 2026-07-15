import fetch from 'node-fetch';
import { generateWAMessageFromContent } from 'baileys';

// Global cache for Wikipedia sessions
if (!global.wikiCache) {
    global.wikiCache = new Map();
}

/**
 * Utility to strip HTML tags from Wikipedia snippets
 */
const stripHtml = (html) => {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
};

/**
 * Send or edit Wikipedia search results message
 */
export async function searchWikipedia(sock, jid, query, offset = 0, editKey = null) {
    try {
        // srlimit=3 matches WhatsApp's 5-button limit: 3 selects + 1 prev + 1 next = 5 buttons max
        const url = `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=3&sroffset=${offset}`;
        console.log(`[Wiki Helper] Fetching results for "${query}", offset ${offset}...`);
        
        const res = await fetch(url, { headers: { 'User-Agent': 'WhatsAppBot/1.0' } });
        if (!res.ok) throw new Error(`Wikipedia Search API returned status ${res.status}`);
        
        const data = await res.json();
        const results = data.query?.search || [];
        
        if (results.length === 0) {
            const emptyText = `❌ *Pencarian Tidak Ditemukan*\n\nArtikel dengan kata kunci *"${query}"* tidak ditemukan di Wikipedia Bahasa Indonesia.`;
            if (editKey) {
                await sock.sendMessage(jid, { text: emptyText, edit: editKey });
            } else {
                await sock.sendMessage(jid, { text: emptyText });
            }
            return;
        }

        // Cache the session to keep button IDs clean and short
        const searchId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const hasMore = !!data.continue?.sroffset;
        
        global.wikiCache.set(searchId, {
            query,
            offset,
            results,
            hasMore
        });

        // Clean cache entries older than 30 minutes to save memory
        setTimeout(() => global.wikiCache.delete(searchId), 1800000);

        // Build result text
        const pageNum = Math.floor(offset / 3) + 1;
        let text = `🔍 *HASIL PENCARIAN WIKIPEDIA*\n`;
        text += `📝 Kata Kunci: *"${query}"*\n`;
        text += `📄 Halaman: *${pageNum}*\n\n`;

        results.forEach((item, index) => {
            const cleanSnippet = stripHtml(item.snippet);
            text += `${index + 1}. *${item.title}*\n`;
            text += `_${cleanSnippet || 'Tidak ada pratinjau.'}_\n\n`;
        });

        text += `💡 _Pilih nomor di bawah untuk membaca ringkasan artikel._`;

        // Build interactive buttons
        const buttons = [];
        
        // Row 1: Select article buttons (1 to results length)
        for (let i = 0; i < results.length; i++) {
            buttons.push({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: `[${i + 1}]`,
                    id: `wiki_select_${searchId}_${i}`
                })
            });
        }

        // Row 2: Navigation buttons (Prev / Next)
        if (offset > 0) {
            buttons.push({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "⬅️ Prev",
                    id: `wiki_prev_${searchId}`
                })
            });
        }
        if (hasMore) {
            buttons.push({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: "Next ➡️",
                    id: `wiki_next_${searchId}`
                })
            });
        }

        const messageContent = {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        body: { text },
                        footer: { text: "Wikipedia Bahasa Indonesia" },
                        nativeFlowMessage: { buttons }
                    }
                }
            }
        };

        if (editKey) {
            const msg = generateWAMessageFromContent(jid, messageContent, {});
            await sock.relayMessage(jid, {
                protocolMessage: {
                    key: editKey,
                    type: 14,
                    editedMessage: msg.message
                }
            }, {});
        } else {
            const msg = generateWAMessageFromContent(jid, messageContent, {});
            await sock.relayMessage(jid, msg.message, {
                messageId: msg.key.id
            });
        }
        
    } catch (err) {
        console.error('[Wiki Helper] Search Error:', err);
        const errorText = `❌ *Gagal melakukan pencarian!*\n\n⚠️ Error: ${err.message || err}`;
        if (editKey) {
            await sock.sendMessage(jid, { text: errorText, edit: editKey });
        } else {
            await sock.sendMessage(jid, { text: errorText });
        }
    }
}

/**
 * Handle incoming Wikipedia button response clicks
 */
export async function handleWikiButton(sock, m, selectedId) {
    const from = m.key.remoteJid;
    const parts = selectedId.split('_');
    const action = parts[1]; // select, prev, next
    const searchId = parts[2];
    
    const session = global.wikiCache.get(searchId);
    if (!session) {
        return sock.sendMessage(from, {
            text: '❌ *Sesi Kedaluwarsa!*\n\nPencarian ini sudah terlalu lama. Silakan ketik `.wiki <kata kunci>` untuk pencarian baru.'
        }, { quoted: m });
    }

    const contextInfo = m.message?.interactiveResponseMessage?.contextInfo;
    const stanzaId = contextInfo?.stanzaId;

    const editKey = stanzaId ? {
        remoteJid: from,
        id: stanzaId,
        fromMe: true
    } : null;

    try {
        if (action === 'prev') {
            const newOffset = Math.max(0, session.offset - 3);
            if (editKey) {
                await searchWikipedia(sock, from, session.query, newOffset, editKey).catch(async (e) => {
                    console.log('[Wiki Helper] Edit page failed, sending new message:', e.message);
                    await searchWikipedia(sock, from, session.query, newOffset, null);
                });
            } else {
                await searchWikipedia(sock, from, session.query, newOffset, null);
            }
        }
        else if (action === 'next') {
            const newOffset = session.offset + 3;
            if (editKey) {
                await searchWikipedia(sock, from, session.query, newOffset, editKey).catch(async (e) => {
                    console.log('[Wiki Helper] Edit page failed, sending new message:', e.message);
                    await searchWikipedia(sock, from, session.query, newOffset, null);
                });
            } else {
                await searchWikipedia(sock, from, session.query, newOffset, null);
            }
        }
        else if (action === 'select') {
            const index = parseInt(parts[3]);
            const article = session.results[index];
            if (!article) throw new Error('Artikel pilihan tidak ditemukan dalam sesi pencarian.');

            // Fetch summary
            const summaryUrl = `https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article.title.replace(/ /g, '_'))}`;
            console.log(`[Wiki Helper] Fetching summary for "${article.title}"...`);

            const res = await fetch(summaryUrl, { headers: { 'User-Agent': 'WhatsAppBot/1.0' } });
            if (!res.ok) throw new Error(`Gagal memuat ringkasan dari Wikipedia (Status ${res.status})`);

            const data = await res.json();
            const title = data.title || article.title;
            const extract = data.extract || 'Tidak ada ringkasan teks yang tersedia untuk artikel ini.';
            const desc = data.description ? `_${data.description}_\n\n` : '';
            const pageUrl = data.content_urls?.desktop?.page || `https://id.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

            let text = `📚 *${title}*\n`;
            text += desc;
            text += `${extract}\n\n`;
            text += `🔗 *Link Artikel:* ${pageUrl}`;

            // Send summary as a new message! This is robust and doesn't erase the search result
            await sock.sendMessage(from, { text }, { quoted: m });
        }
    } catch (err) {
        console.error('[Wiki Helper] Button Action Error:', err);
        await sock.sendMessage(from, {
            text: `❌ *Gagal memuat detail artikel!*\n\n⚠️ Error: ${err.message || err}`
        }, { quoted: m });
    }
}
