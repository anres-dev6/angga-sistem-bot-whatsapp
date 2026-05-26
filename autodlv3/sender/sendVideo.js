export async function sendVideo(sock, jid, buffer, caption) {
    return sock.sendMessage(jid, {
        video: buffer,
        caption,
        mimetype: 'video/mp4'
    });
}
