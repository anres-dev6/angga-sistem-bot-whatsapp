import { downloadMediaMessage } from 'baileys'
import sharp from 'sharp'

export default {
    name: 'hd',
    aliases: ['hd', 'upscale'],
    tags: ['converter'],
    description: 'HD-kan gambar burik (Upscale Image)',
    access: {
        owner: false,
        group: false,
        private: false
    },

    run: async (sock, m) => {
        try {
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage
            const quotedContext = m.message?.extendedTextMessage?.contextInfo

            // Check for document messages containing images
            const docMsg = quoted
                ? quoted.documentMessage
                : m.message?.documentMessage

            // Extract image message (normal / viewOnce)
            const imageMsg = quoted
                ? quoted.imageMessage ||
                  quoted.viewOnceMessage?.message?.imageMessage ||
                  quoted.viewOnceMessageV2?.message?.imageMessage ||
                  quoted.viewOnceMessageV2Extension?.message?.imageMessage
                : m.message?.imageMessage ||
                  m.message?.viewOnceMessage?.message?.imageMessage ||
                  m.message?.viewOnceMessageV2?.message?.imageMessage ||
                  m.message?.viewOnceMessageV2Extension?.message?.imageMessage

            const isDocImage = docMsg && docMsg.mimetype?.startsWith('image/')
            const mime = imageMsg?.mimetype || docMsg?.mimetype || ''

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

            // Reconstruct the message object for Baileys downloader
            let msgToDownload
            if (quoted) {
                msgToDownload = {
                    key: {
                        remoteJid: m.key.remoteJid,
                        id: quotedContext.stanzaId,
                        participant: quotedContext.participant
                    },
                    message: quoted
                }
            } else {
                msgToDownload = m
            }

            // Download media buffer
            const buffer = await downloadMediaMessage(
                msgToDownload,
                'buffer',
                {},
                {
                    reuploadRequest: sock.updateMediaMessage
                }
            )

            if (!buffer) {
                throw new Error('Gagal mengunduh gambar dari WhatsApp.')
            }

            // 🛟 Local Processing: Upscale using Sharp (Lanczos3 Kernel)
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

            // Kirim hasil HD
            await sock.sendMessage(
                m.key.remoteJid,
                {
                    image: upscaledBuffer,
                    caption: '✨ Berhasil di-HD-kan! (Sharp Local Processing)',
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
        }
    }
}
