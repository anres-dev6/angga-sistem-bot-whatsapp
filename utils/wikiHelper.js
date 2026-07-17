import fetch from 'node-fetch';

// Global cache for Wikipedia search sessions
if (!global.wikiCache) {
    global.wikiCache = new Map();
}

// Global cache for Wikipedia article reading sessions
if (!global.wikiArticleCache) {
    global.wikiArticleCache = new Map();
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
 * Smart text chunker that respects spaces and paragraph endings
 */
function chunkText(text, limit = 800) {
    const chunks = [];
    let remaining = text.trim();
    
    while (remaining.length > 0) {
        if (remaining.length <= limit) {
            chunks.push(remaining);
            break;
        }
        
        let splitIndex = remaining.lastIndexOf('\n', limit);
        if (splitIndex === -1 || splitIndex < limit * 0.5) {
            splitIndex = remaining.lastIndexOf(' ', limit);
        }
        if (splitIndex === -1 || splitIndex < limit * 0.5) {
            splitIndex = limit;
        }
        
        chunks.push(remaining.substring(0, splitIndex).trim());
        remaining = remaining.substring(splitIndex).trim();
    }
    return chunks;
}

/**
 * Send Wikipedia search results using interactive single_select buttons
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
                    description: stripHtml(item.snippet).substring(0, 100) || 'Tidak ada pratinjau.',
                    id: `wiki_select_${searchId}_${index}`
                }))
            }
        ];

        // Add Navigation section if prev or next page is available
        const navRows = [];
        if (offset > 0) {
            navRows.push({
                title: '⬅️ Halaman Sebelumnya',
                description: `Kembali ke halaman ${pageNum - 1}`,
                id: `wiki_prev_${searchId}`
            });
        }
        if (hasMore) {
            navRows.push({
                title: 'Halaman Berikutnya ➡️',
                description: `Lanjut ke halaman ${pageNum + 1}`,
                id: `wiki_next_${searchId}`
            });
        }

        if (navRows.length > 0) {
            sections.push({
                title: 'Navigasi Halaman',
                rows: navRows
            });
        }

        await sock.sendMessage(jid, {
            text: text,
            title: 'Wikipedia Search',
            subtitle: 'Wikipedia Bahasa Indonesia',
            footer: 'Wikipedia Bahasa Indonesia',
            interactiveButtons: [
                {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                        title: '📖 Pilih Artikel',
                        sections: sections
                    })
                }
            ]
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
    const action = parts[1]; // select, prev, next, apage
    
    try {
        if (action === 'apage') {
            const pageAction = parts[2]; // prev, next
            const articleSessionId = parts[3];
            
            const articleSession = global.wikiArticleCache.get(articleSessionId);
            if (!articleSession) {
                return sock.sendMessage(from, {
                    text: '❌ *Sesi Kedaluwarsa!*\n\nArtikel ini sudah terlalu lama di cache. Silakan cari kembali menggunakan `.wiki <kata kunci>`.'
                }, { quoted: m });
            }
            
            if (pageAction === 'prev') {
                articleSession.currentPage = Math.max(0, articleSession.currentPage - 1);
            } else if (pageAction === 'next') {
                articleSession.currentPage = Math.min(articleSession.chunks.length - 1, articleSession.currentPage + 1);
            }
            
            const pageNum = articleSession.currentPage + 1;
            const totalPages = articleSession.chunks.length;
            const chunk = articleSession.chunks[articleSession.currentPage];
            
            const text = `📚 *${articleSession.title}* (Halaman ${pageNum}/${totalPages})\n\n${chunk}\n\n🔗 *Link Artikel:* ${articleSession.pageUrl}`;
            
            const buttons = [];
            if (pageNum > 1) {
                buttons.push({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '⬅️ Halaman Sebelumnya',
                        id: `wiki_apage_prev_${articleSessionId}`
                    })
                });
            }
            if (pageNum < totalPages) {
                buttons.push({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: 'Halaman Berikutnya ➡️',
                        id: `wiki_apage_next_${articleSessionId}`
                    })
                });
            }
            
            if (buttons.length > 0) {
                await sock.sendMessage(from, {
                    text: text,
                    footer: 'Wikipedia Bahasa Indonesia',
                    interactiveButtons: buttons
                }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text }, { quoted: m });
            }
            return;
        }

        const searchId = parts[2];
        const session = global.wikiCache.get(searchId);
        if (!session) {
            return sock.sendMessage(from, {
                text: '❌ *Sesi Kedaluwarsa!*\n\nPencarian ini sudah terlalu lama. Silakan ketik `.wiki <kata kunci>` untuk pencarian baru.'
            }, { quoted: m });
        }

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

            // Fetch full plain text of the article
            const queryUrl = `https://id.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(article.title)}&format=json&redirects=1`;
            console.log(`[Wiki Helper] Fetching full article for "${article.title}"...`);

            const res = await fetch(queryUrl, { headers: { 'User-Agent': 'WhatsAppBot/1.0' } });
            if (!res.ok) throw new Error(`Gagal memuat artikel dari Wikipedia (Status ${res.status})`);

            const data = await res.json();
            const pages = data.query?.pages || {};
            const pageId = Object.keys(pages)[0];
            
            if (pageId === '-1') throw new Error('Artikel tidak ditemukan.');

            const extract = pages[pageId].extract || 'Tidak ada teks isi yang tersedia untuk artikel ini.';
            const pageUrl = `https://id.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}`;

            // Chunk the plain text
            const textChunks = chunkText(extract, 800);

            // Store in article cache
            const articleSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            global.wikiArticleCache.set(articleSessionId, {
                title: article.title,
                chunks: textChunks,
                currentPage: 0,
                pageUrl: pageUrl
            });

            // Clean cache entries older than 30 minutes to save memory
            setTimeout(() => global.wikiArticleCache.delete(articleSessionId), 1800000);

            const pageNum = 1;
            const totalPages = textChunks.length;
            const chunk = textChunks[0];

            const text = `📚 *${article.title}* (Halaman ${pageNum}/${totalPages})\n\n${chunk}\n\n🔗 *Link Artikel:* ${pageUrl}`;

            const buttons = [];
            if (pageNum < totalPages) {
                buttons.push({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: 'Halaman Berikutnya ➡️',
                        id: `wiki_apage_next_${articleSessionId}`
                    })
                });
            }

            if (buttons.length > 0) {
                await sock.sendMessage(from, {
                    text: text,
                    footer: 'Wikipedia Bahasa Indonesia',
                    interactiveButtons: buttons
                }, { quoted: m });
            } else {
                await sock.sendMessage(from, { text }, { quoted: m });
            }
        }
    } catch (err) {
        console.error('[Wiki Helper] Button Action Error:', err);
        await sock.sendMessage(from, {
            text: `❌ *Gagal memuat detail artikel!*\n\n⚠️ Error: ${err.message || err}`
        }, { quoted: m });
    }
}
