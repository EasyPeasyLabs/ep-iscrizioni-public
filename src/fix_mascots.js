const fs = require('fs');
const path = 'src/assets/mascots.ts';
try {
    let content = fs.readFileSync(path, 'utf8');
    let count = 0;
    // Cerca le stringhe base64 non racchiuse tra virgolette e le corregge
    content = content.replace(/(:\s*)(data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+)/g, function(match, p1, p2) {
        count++;
        return p1 + '"' + p2 + '"';
    });
    fs.writeFileSync(path, content);
    console.log('Corrette ' + count + ' immagini base64.');
} catch (err) {
    console.error('Errore durante la correzione:', err);
}
