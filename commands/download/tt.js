import axios from "axios";

export default {
  name: 'tt',
  aliases: ['tt', 'tiktok'],
  tags: ['download'],
  description: 'Download TikTok video',
  access: {
    owner: false,
    group: false,
    private: false
  },

  run: async (sock, msg, args) => {
    const from = msg.key.remoteJid;
    let progressMsg = null;

    try {
      const url = args[0];

      if (!url) {
        return await sock.sendMessage(from, {
          text: "❌ Masukin link TikTok dulu bos.\n\n💡 Contoh: .tt https://vt.tiktok.com/xxxxx"
        });
      }

      if (!url.includes('tiktok.com') && !url.includes('vt.tiktok') && !url.includes('vm.tiktok')) {
        return await sock.sendMessage(from, {
          text: "❌ Link bukan dari TikTok!\n\n💡 Pastikan link dari TikTok."
        });
      }

      // Send initial progress message
      progressMsg = await sock.sendMessage(from, {
        text: "⏳ *Memproses TikTok...*"
      }, { quoted: msg });

      console.log('[TikTok] Downloading:', url);

      // Try TikWM API
      await sock.sendMessage(from, {
        text: "📋 *Mengambil info video...*",
        edit: progressMsg.key
      });

      let videoData = null;
      try {
        const response = await axios.get(`https://www.tikwm.com/api/`, {
          params: { url: url },
          timeout: 30000
        });

        if (response.data?.code === 0 && response.data?.data) {
          videoData = {
            video: response.data.data.play,
            title: response.data.data.title,
            author: response.data.data.author?.nickname,
            likes: response.data.data.digg_count,
            comments: response.data.data.comment_count,
            shares: response.data.data.share_count,
            views: response.data.data.play_count
          };
        }
      } catch (err) {
        console.log('[TikTok] TikWM failed, trying TikCDN...');
        await sock.sendMessage(from, {
          text: "📋 *API 1 gagal, mencoba API 2...*",
          edit: progressMsg.key
        });
      }

      // Try TikCDN if TikWM failed
      if (!videoData) {
        try {
          const response = await axios.get(`https://tikcdn.io/api/v1/video`, {
            params: { url: url },
            timeout: 30000
          });

          if (response.data?.video) {
            videoData = {
              video: response.data.video,
              title: response.data.title || "TikTok Video",
              author: response.data.author || "Unknown"
            };
          }
        } catch (err) {
          console.log('[TikTok] TikCDN also failed');
        }
      }

      if (!videoData || !videoData.video) {
        console.log('[TikTok] Both APIs failed, trying yt-dlp...');
        await sock.sendMessage(from, {
          text: "📋 *API gagal, mencoba yt-dlp...*",
          edit: progressMsg.key
        });

        // Import downloader module
        const { downloadMedia } = await import('../../Lib/downloader.js');
        const fs = await import('fs');

        try {
          const result = await downloadMedia(url, (percent) => {
            if (percent % 25 === 0) {
              console.log(`[TikTok] yt-dlp Progress: ${percent}%`);
            }
          });

          const filePath = result.filePath;

          await sock.sendMessage(from, {
            text: "📤 *Mengirim video...*",
            edit: progressMsg.key
          });

          const caption = `🎵 *TikTok Downloader*\n\n📦 ${result.size}MB\n\n✅ Downloaded via yt-dlp`;

          await sock.sendMessage(from, {
            video: fs.readFileSync(filePath),
            caption: caption,
            mimetype: 'video/mp4'
          }, { quoted: msg });

          // Cleanup
          fs.unlinkSync(filePath);

          await sock.sendMessage(from, {
            text: "✅ *Selesai!*",
            edit: progressMsg.key
          });

          return; // Exit successfully

        } catch (ytdlpErr) {
          console.log('[TikTok] yt-dlp also failed:', ytdlpErr.message);
          throw new Error('Semua metode gagal. Video mungkin private atau link salah.');
        }
      }

      // Download video
      await sock.sendMessage(from, {
        text: "⬇️ *Mendownload video...*",
        edit: progressMsg.key
      });

      const videoResponse = await axios.get(videoData.video, {
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: 100 * 1024 * 1024
      });

      const videoBuffer = Buffer.from(videoResponse.data);
      const fileSizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);

      if (videoBuffer.length > 100 * 1024 * 1024) {
        throw new Error(`Video terlalu besar (${fileSizeMB}MB). Maksimal 100MB.`);
      }

      // Send video
      await sock.sendMessage(from, {
        text: "📤 *Mengirim video...*",
        edit: progressMsg.key
      });

      const caption = videoData.likes ? `🎬 *TikTok Downloader*

📝 *Title:* ${videoData.title || "-"}
👤 *Author:* ${videoData.author || "-"}

❤️ ${videoData.likes?.toLocaleString() || 0} likes  
💭 ${videoData.comments?.toLocaleString() || 0} komen  
🔁 ${videoData.shares?.toLocaleString() || 0} share  
👀 ${videoData.views?.toLocaleString() || 0} views  

✅ No Watermark` : undefined;

      await sock.sendMessage(from, {
        video: videoBuffer,
        caption: caption,
        mimetype: 'video/mp4'
      }, { quoted: msg });

      // Success
      await sock.sendMessage(from, {
        text: "✅ *Selesai!*",
        edit: progressMsg.key
      });

    } catch (err) {
      console.error('[TikTok] Error:', err.message);

      let errorMsg = '❌ *Gagal download TikTok!*\n\n';

      if (err.message.includes('terlalu besar')) {
        errorMsg += err.message;
      } else if (err.message.includes('timeout')) {
        errorMsg += '⏱️ Timeout. Server lambat atau video besar.\n💡 Coba lagi.';
      } else if (err.message.includes('Semua API gagal')) {
        errorMsg += '🔍 Semua API gagal.\n💡 Pastikan:\n• Link valid\n• Video bukan private\n• Coba link lain';
      } else {
        errorMsg += `⚠️ ${err.message}`;
      }

      // Update progress message with error (jangan kirim baru)
      if (progressMsg && progressMsg.key) {
        try {
          await sock.sendMessage(from, { text: errorMsg, edit: progressMsg.key });
        } catch {
          // Fallback jika edit gagal
          await sock.sendMessage(from, { text: errorMsg });
        }
      } else {
        await sock.sendMessage(from, { text: errorMsg });
      }
    }
  }
};
