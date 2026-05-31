import axios from 'axios';

const testUrls = [
    'https://api.botcahx.live/api/maker/attp?text=Halo%20Dunia',
    'https://api.tiodev.my.id/api/maker/attp?text=Halo%20Dunia',
    'https://api.xyrozee.xyz/api/maker/attp?text=Halo%20Dunia',
    'https://api.caliph.biz.id/api/attp?text=Halo%20Dunia',
    'https://api.betabotz.eu.org/api/maker/attp?apikey=free&text=Halo%20Dunia',
    'https://api.botcahx.live/api/maker/attp?apikey=free&text=Halo%20Dunia',
    'https://xzn.wtf/api/attp?text=Halo%20Dunia',
    'https://api.itsrose.life/attp?text=Halo%20Dunia'
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
