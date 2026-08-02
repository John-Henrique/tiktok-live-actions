const fs = require('fs');
const path = './web-dashboard/src';
fs.readdirSync(path).filter(f => f.endsWith('.jsx')).forEach(f => {
    let p = path + '/' + f;
    let c = fs.readFileSync(p, 'utf8');
    let r = c.replace(/'\$\{API_BASE_URL\}(.*?)'/g, '`${API_BASE_URL}$1`');
    if (c !== r) {
        fs.writeFileSync(p, r);
        console.log('Fixed', p);
    }
});
