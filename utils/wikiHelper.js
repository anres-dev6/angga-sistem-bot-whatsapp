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
export async function searchWikipedia(sock, jid, query, offset = 0) {
    try {
        const url = `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=3&sroffset=${offset}`;
        console.log(`[Wiki Helper] Fetching results for "${query}", offset ${offset}...`);
        
        const res = await fetch(url, { headers: { 'User-Agent': 'WhatsAppBot/1.0' } });
        if (!res.ok) throw new Error(`Wikipedia Search API returned status ${res.status}`);
        
        const data = await res.json();
        const results = data.query?.search || [];
        
        if (results.length === 0) {
            const emptyText = `❌ *Pencarian Tidak Ditemukan*\n\nArtikel dengan kata kunci *"${query}"* tidak ditemukan di Wikipedia Bahasa Indonesia.`;
            await sock.sendMessage(jid, { text: emptyText });
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
        const text = `🔍 *HASIL PENCARIAN WIKIPEDIA*\n\n📝 Kata Kunci: *"${query}"*\n📄 Halaman: *${pageNum}*\n\n💡 _Silakan klik tombol di bawah untuk melihat dan memilih artikel._`;

        const sections = [
            {
                title: `Hasil Pencarian (Halaman ${pageNum})`,
                rows: results.map((item, index) => ({
                    title: `${item.title}`,
                    rowId: `wiki_select_${searchId}_${index}`,
                    description: stripHtml(item.snippet).substring(0, 100) || 'Tidak ada pratinjau.'
                }))
            }
        ];

        // Add Navigation section if prev or next page is available
        const navRows = [];
        if (offset > 0) {
            navRows.push({
                title: '⬅️ Halaman Sebelumnya',
                rowId: `wiki_prev_${searchId}`,
                description: `Kembali ke halaman ${pageNum - 1}`
            });
        }
        if (hasMore) {
            navRows.push({
                title: 'Halaman Berikutnya ➡️',
                rowId: `wiki_next_${searchId}`,
                description: `Lanjut ke halaman ${pageNum + 1}`
            });
        }

        if (navRows.length > 0) {
            sections.push({
                title: 'Navigasi Halaman',
                rows: navRows
            });
        }

        await sock.sendMessage(jid, {
            text,
            footer: 'Wikipedia Bahasa Indonesia',
            title: 'Wikipedia Search',
            buttonText: 'Pilih Artikel',
            sections: sections
        });
        
    } catch (err) {
        console.error('[Wiki Helper] Search Error:', err);
        const errorText = `❌ *Gagal melakukan pencarian!*\n\n⚠️ Error: ${err.message || err}`;
        await sock.sendMessage(jid, { text: errorText });
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

    try {
        if (action === 'prev') {
            const newOffset = Math.max(0, session.offset - 3);
            await searchWikipedia(sock, from, session.query, newOffset);
        }
        else if (action === 'next') {
            const newOffset = session.offset + 3;
            await searchWikipedia(sock, from, session.query, newOffset);
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

            await sock.sendMessage(from, { text }, { quoted: m });
        }
    } catch (err) {
        console.error('[Wiki Helper] Button Action Error:', err);
        await sock.sendMessage(from, {
            text: `❌ *Gagal memuat detail artikel!*\n\n⚠️ Error: ${err.message || err}`
        }, { quoted: m });
    }
}
