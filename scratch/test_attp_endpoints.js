import axios from 'axios';

const testUrls = [
    'https://widipe.com/attp?text=Halo%20Dunia',
    'https://aemt.me/attp?text=Halo%20Dunia',
    'https://api.lolhuman.xyz/api/attp?apikey=free&text=Halo%20Dunia',
    'https://api.lolhuman.xyz/api/attp?apikey=85z276&text=Halo%20Dunia',
    'https://api.lolhuman.xyz/api/attp?apikey=gatauchs&text=Halo%20Dunia',
    'https://api.lolhuman.xyz/api/attp?apikey=lolkey&text=Halo%20Dunia',
    'https://api.lolhuman.xyz/api/attp?apikey=8e922dbb3149ef7df291cc45&text=Halo%20Dunia'
];

async function test() {
    for (const url of testUrls) {
        console.log(`Testing URL: ${url}`);
        try {
            const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
            console.log(`-> SUCCESS! Status: ${res.status}, Content-Type: ${res.headers['content-type']}, Length: ${res.data.length}`);
        } catch (err) {
            console.log(`-> FAILED: ${err.message}`);
            if (err.response) {
                console.log(`   Status: ${err.response.status}`);
            }
        }
        console.log('--------------------------------------------------');
    }
}

test();
