import fetch from 'node-fetch';

const testUrl = 'https://www.instagram.com/reel/DMNiqN2TV3v/';
const apiUrl = `https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(testUrl)}`;

console.log('Testing Instagram API...');
console.log('URL:', testUrl);
console.log('API:', apiUrl);
console.log('');

try {
    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'accept': '*/*' }
    });

    console.log('Status:', response.status);

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

} catch (error) {
    console.error('Error:', error.message);
}
