export function detectPlatform(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('douyin.com')) return 'douyin';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.com')) return 'facebook';
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
    if (urlLower.includes('x.com') || urlLower.includes('twitter.com')) return 'twitter';
    if (urlLower.includes('capcut.com') || urlLower.includes('capcut.net')) return 'capcut';
    if (urlLower.includes('canva.com')) return 'canva';
    if (urlLower.includes('melolo.org') || urlLower.includes('melolo.com') || urlLower.includes('melolo.app')) return 'melolo';
    if (urlLower.includes('pinedrama.com') || urlLower.includes('pinedrama.app')) return 'pinedrama';
    return null;
}
