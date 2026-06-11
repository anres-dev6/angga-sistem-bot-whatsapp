import { downloadMediaMessage } from 'baileys'
import { uploadMedia } from '../../Lib/uploader.js'
import { db } from '../../Lib/database.js'
import axios from 'axios'
import sharp from 'sharp'

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
                quoted.viewOnceMessageV2?.message?.imageMessage ||
                quoted.viewOnceMessageV2Extension?.message?.imageMessage
                : m.message?.imageMessage ||
                m.message?.viewOnceMessage?.message?.imageMessage ||
                m.message?.viewOnceMessageV2?.message?.imageMessage ||
                m.message?.viewOnceMessageV2Extension?.message?.imageMessage

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
            let msgToDownload
            if (quoted) {
                const quotedContext = m.message?.extendedTextMessage?.contextInfo
                msgToDownload = {
                    key: {
                        remoteJid: quotedContext.participant || m.key.remoteJid,
                        fromMe: false,
                        id: quotedContext.stanzaId
                    },
                    message: {
                        imageMessage: imageMsg
                    }
                }
            } else {
                msgToDownload = {
                    key: m.key,
                    message: {
                        imageMessage: imageMsg
                    }
                }
            }

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

            // Call HD API (Multi-Provider Strategy)
            let response
            let lastError = null
            let success = false

            // Try upload for external providers (only upload if they are needed/timed out)
            let url = null
            try {
                url = await uploadMedia(buffer)
            } catch (uploadErr) {
                console.log('[HD] Failed to upload image for APIs, will proceed to local upscale:', uploadErr.message)
            }

            if (url) {
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
                        const res = await axios.get(provider.url, {
                            responseType: 'arraybuffer',
                            timeout: 10000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        })

                        let contentType = res.headers['content-type'] || ''
                        let imageBuffer = res.data

                        // If response is JSON, parse and download the image URL
                        if (contentType.includes('application/json') || (!contentType.startsWith('image/') && res.data)) {
                            try {
                                const jsonStr = res.data.toString('utf8')
                                const jsonObj = JSON.parse(jsonStr)
                                const extractedUrl = jsonObj.result || jsonObj.url || (jsonObj.data && typeof jsonObj.data === 'string' ? jsonObj.data : null) || (jsonObj.result && jsonObj.result.url)
                                
                                if (extractedUrl && typeof extractedUrl === 'string' && extractedUrl.startsWith('http')) {
                                    console.log(`[HD] Extracted URL from ${provider.name} JSON response:`, extractedUrl)
                                    const imgRes = await axios.get(extractedUrl, {
                                        responseType: 'arraybuffer',
                                        timeout: 15000,
                                        headers: {
                                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                        }
                                    })
                                    const imgContentType = imgRes.headers['content-type'] || ''
                                    if (imgContentType.startsWith('image/')) {
                                        imageBuffer = imgRes.data
                                        contentType = imgContentType
                                    } else {
                                        throw new Error(`Extracted URL response is not an image (${imgContentType})`)
                                    }
                                } else {
                                    throw new Error(`Could not find image URL in JSON response: ${jsonStr.slice(0, 100)}`)
                                }
                            } catch (jsonErr) {
                                throw new Error(`Failed to parse JSON response: ${jsonErr.message}`)
                            }
                        }

                        // ❌ BLOCK HTML / NON-IMAGE
                        if (!contentType.startsWith('image/')) {
                            throw new Error(`Response bukan image (${contentType})`)
                        }

                        // ✅ SUCCESS
                        response = { data: imageBuffer }
                        success = true
                        break // Stop looping

                    } catch (err) {
                        console.log(`[HD] ${provider.name} failed:`, err.message)
                        lastError = err
                    }
                }
            }

            if (!success) {
                // 🛟 LOCAL FALLBACK: upscale using sharp
                try {
                    const metadata = await sharp(buffer).metadata()
                    const targetWidth = (metadata.width || 512) * 2

                    const upscaledBuffer = await sharp(buffer)
                        .resize(targetWidth, null, {
                            kernel: 'lanczos3'
                        })
                        .sharpen({
                            sigma: 1.0,
                            m1: 0.3,
                            m2: 1.0
                        })
                        .modulate({
                            brightness: 1.01,
                            saturation: 1.05
                        })
                        .jpeg({ quality: 90 })
                        .toBuffer()

                    // ✅ React success
                    await sock.sendMessage(m.key.remoteJid, {
                        react: { text: '✅', key: m.key }
                    })

                    await sock.sendMessage(
                        m.key.remoteJid,
                        {
                            image: upscaledBuffer,
                            caption: '✨ Berhasil di-HD-kan! (Local Processing)',
                            mimetype: 'image/jpeg'
                        },
                        { quoted: m }
                    )
                    return
                } catch (localErr) {
                    console.error('[HD Local Fallback Error]', localErr)
                    // If local processing fails too, send original image
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

