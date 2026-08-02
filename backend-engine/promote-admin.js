const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'saas.db');

if (!fs.existsSync(dbPath)) {
    console.error('❌ Banco de dados não encontrado em:', dbPath);
    process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco de dados:', err.message);
        process.exit(1);
    }
});

// Pegar o email por argumento (ex: node promote-admin.js johnhenrique@gmail.com)
const emailArg = process.argv[2] || 'johnhenrique@gmail.com';

db.serialize(() => {
    // Tenta criar a coluna para garantir
    db.run(`ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0`, (err) => {
        // Ignora o erro se a coluna já existir
    });

    db.run(`UPDATE users SET is_admin = 1 WHERE email = ?`, [emailArg], function(err) {
        if (err) {
            console.error('❌ Erro ao promover usuário:', err.message);
        } else if (this.changes === 0) {
            console.warn(`⚠️ O email "${emailArg}" não foi encontrado no banco de dados. Cadastre a conta primeiro se ainda não o fez.`);
        } else {
            console.log(`✅ Sucesso! O usuário "${emailArg}" foi promovido a Administrador.`);
        }
        
        db.close();
    });
});
