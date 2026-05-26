export async function sendDocument(sock, jid, buffer, filename) {
    return sock.sendMessage(jid, {
        document: buffer,
        fileName: filename,
        mimetype: 'video/mp4'
    });
}
