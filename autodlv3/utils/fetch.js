import fetch from 'node-fetch';

export default {
    text: async (url, opt = {}) => {
        const res = await fetch(url, {
            redirect: 'follow',
            ...opt,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                ...opt.headers
            }
        });
        return res.text();
    },
    // Keep original fetch for compatibility if needed elsewhere (optional, but safer to just export default object as user requested)
    fetch: fetch
};
