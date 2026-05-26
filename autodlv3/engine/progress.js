import fetch from 'node-fetch';

export async function downloadWithProgress(url, onProgress) {
    const res = await fetch(url);
    const total = Number(res.headers.get('content-length'));
    let received = 0;
    const chunks = [];

    if (!res.body) throw new Error('Response body is empty');

    // Node-fetch body is a stream (AsyncIterator in newer node versions or use stream listener)
    // User used "for await (const chunk of res.body)"

    for await (const chunk of res.body) {
        received += chunk.length;
        if (total) {
            onProgress(Math.floor(received / total * 100));
        }
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}
