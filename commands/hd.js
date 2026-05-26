import { downloadMediaMessage } from 'baileys'
import { uploadMedia } from '../Lib/uploader.js'
import { db } from '../Lib/database.js'
import axios from 'axios'

export default {
    name: 'hd',
    aliases: ['hd', 'upscale'],
    tags: ['converter'],
    description: 'HD kan gambar burik (Upscale Image)',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, m) => {
        let tempFile = null

        try {
            const quoted =
                m.message?.extendedTextMessage?.contextInfo?.quotedMessage

            // Ambil image message (normal / viewOnce)
            const imageMsg = quoted
                ? quoted.imageMessage ||
                quoted.viewOnceMessage?.message?.imageMessage ||
                quoted.viewOnceMessageV2?.message?.imageMessage
                : m.message?.imageMessage ||
                m.message?.viewOnceMessage?.message?.imageMessage ||
                m.message?.viewOnceMessageV2?.message?.imageMessage

            const mime = imageMsg?.mimetype || ''

            if (!mime.startsWith('image/')) {
                return sock.sendMessage(
                    m.key.remoteJid,
                    { text: 'Reply / kirim gambar dengan caption `.hd`' },
                    { quoted: m }
                )
            }

            // ⏳ React processing
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '⏳', key: m.key }
            })

            // Download media
            const msgToDownload = quoted
                ? { message: quoted.viewOnceMessage?.message || quoted }
                : m

            const buffer = await downloadMediaMessage(
                msgToDownload,
                'buffer',
                {},
                {
                    reuploadRequest: sock.updateMediaMessage
                }
            )

            // Save temp
            const ext = mime.split('/')[1] || 'jpg'
            tempFile = await db.saveTemp(buffer, ext)

            // Upload image (URL for API)
            const url = await uploadMedia(buffer)

            // Call HD API (Multi-Provider Strategy)
            let response
            let lastError = null
            let success = false

            const providers = [
                // 1. Widipe (New Candidate)
                {
                    name: 'Widipe',
                    url: `https://widipe.com/remini?url=${encodeURIComponent(url)}`
                },
                // 2. Vreden (New Candidate)
                {
                    name: 'Vreden',
                    url: `https://api.vreden.web.id/api/remini?url=${encodeURIComponent(url)}`
                },
                // 3. Ryzendesu (Cloudflare protected?)
                {
                    name: 'Ryzendesu',
                    url: `https://api.ryzendesu.vip/api/ai/remini?url=${encodeURIComponent(url)}`
                },
                // 4. Skizo (Fallback)
                {
                    name: 'Skizo',
                    url: `https://skizo.tech/api/remini?url=${encodeURIComponent(url)}&apikey=batu`
                }
            ]

            for (const provider of providers) {
                try {
                    // console.log(`[HD] Trying ${provider.name}...`)
                    response = await axios.get(provider.url, {
                        responseType: 'arraybuffer',
                        timeout: 60000,
                        headers: {
                            'User-Agent': 'okhttp/4.9.0' // Mobile UA often bypasses basic CF checks better than fake Chrome
                        }
                    })

                    const contentType = response.headers['content-type'] || ''

                    // ❌ BLOCK HTML / NON-IMAGE
                    if (!contentType.startsWith('image/')) {
                        const preview = response.data.slice(0, 50).toString('utf8')
                        throw new Error(`Response bukan image (${contentType}). Preview: ${preview}`)
                    }

                    // ✅ SUCCESS
                    success = true
                    break // Stop looping

                } catch (err) {
                    console.log(`[HD] ${provider.name} failed:`, err.message)
                    lastError = err
                }
            }

            if (!success) {
                // 🛟 FALLBACK: kirim gambar asli
                await sock.sendMessage(
                    m.key.remoteJid,
                    {
                        image: buffer,
                        caption: '⚠️ Gagal HD (Semua server sibuk). Ini gambar aslinya.'
                    },
                    { quoted: m }
                )
                return
            }

            // ✅ React success
            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '✅', key: m.key }
            })

            // Kirim hasil HD
            await sock.sendMessage(
                m.key.remoteJid,
                {
                    image: response.data,
                    caption: '✨ Berhasil di-HD-kan!',
                    mimetype: 'image/jpeg'
                },
                { quoted: m }
            )
        } catch (err) {
            console.error('[HD ERROR]', err)

            await sock.sendMessage(m.key.remoteJid, {
                react: { text: '❌', key: m.key }
            })

            await sock.sendMessage(
                m.key.remoteJid,
                { text: `HD gagal: ${err.message || err}` },
                { quoted: m }
            )
        } finally {
            if (tempFile) {
                await db.deleteTemp(tempFile).catch(() => { })
            }
        }
    }
}
