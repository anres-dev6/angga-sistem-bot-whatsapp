import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import { getYtdlpPath } from '../utils/ytdlpBinary.js';

const execAsync = promisify(exec);

async function testBtchDownloader() {
    console.log('\n--- Testing btch-downloader ---');
    try {
        const btch = await import('btch-downloader');
        console.log('Package loaded successfully.');
        
        // Test TikTok DL
        console.log('Testing TikTok DL...');
        try {
            const ttRes = await btch.ttdl('https://www.tiktok.com/@jokowi/video/7279188448889441541');
            console.log('TikTok DL Result:', typeof ttRes === 'object' ? JSON.stringify(ttRes).substring(0, 200) : ttRes);
        } catch (e) {
            console.error('❌ TikTok DL failed:', e.message);
        }

        // Test YouTube DL
        console.log('Testing YouTube DL...');
        try {
            const ytRes = await btch.youtube('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            console.log('YouTube DL Result:', typeof ytRes === 'object' ? JSON.stringify(ytRes).substring(0, 200) : ytRes);
        } catch (e) {
            console.error('❌ YouTube DL failed:', e.message);
        }
    } catch (e) {
        console.error('❌ Failed to load btch-downloader:', e.message);
    }
}

async function testTikWM() {
    console.log('\n--- Testing TikWM API ---');
    try {
        const url = 'https://www.tiktok.com/@jokowi/video/7279188448889441541';
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
        const res = await fetch(apiUrl);
        const json = await res.json();
        console.log('TikWM API code:', json.code);
        if (json.data) {
            console.log('TikWM Video Play URL:', json.data.play ? 'Available' : 'Not available');
        } else {
            console.log('TikWM failed:', json.msg);
        }
    } catch (e) {
        console.error('❌ TikWM failed:', e.message);
    }
}

async function testYtdlp() {
    console.log('\n--- Testing Local yt-dlp ---');
    try {
        const ytdlpBin = getYtdlpPath().replace(/\\/g, '/');
        console.log('yt-dlp binary path:', ytdlpBin);
        
        const cmd = `"${ytdlpBin}" --version`;
        const { stdout } = await execAsync(cmd);
        console.log('yt-dlp version:', stdout.trim());
        
        // Test download info only (no actual download)
        console.log('Testing yt-dlp info query for YouTube...');
        try {
            const infoCmd = `"${ytdlpBin}" -J "https://www.youtube.com/watch?v=dQw4w9WgXcQ"`;
            const { stdout: infoOut } = await execAsync(infoCmd);
            console.log('yt-dlp info query: Success (received metadata)');
        } catch (e) {
            console.error('❌ yt-dlp YouTube query failed:', e.message.substring(0, 200));
        }
    } catch (e) {
        console.error('❌ yt-dlp test failed:', e.message);
    }
}

async function runAll() {
    await testBtchDownloader();
    await testTikWM();
    await testYtdlp();
}

runAll().catch(console.error);
