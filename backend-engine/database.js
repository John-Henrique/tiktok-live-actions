const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const db = new sqlite3.Database(path.join(dbDir, 'saas.db'), (err) => {
    if (err) {
        console.error('[DB] Erro ao conectar ao SQLite:', err.message);
    } else {
        console.log('[DB] Conectado ao banco de dados SQLite.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Tabela de Usuários
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            tiktok_username TEXT,
            plan_status TEXT DEFAULT 'free_trial',
            trial_used BOOLEAN DEFAULT 0,
            trial_time_used INTEGER DEFAULT 0,
            is_admin BOOLEAN DEFAULT 0,
            pro_expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Tentativa de adicionar colunas caso o banco já exista
        db.run(`ALTER TABLE users ADD COLUMN trial_time_used INTEGER DEFAULT 0`, (err) => { /* ignora erro */ });
        db.run(`ALTER TABLE users ADD COLUMN pro_expires_at DATETIME`, (err) => { /* ignora erro */ });
        db.run(`ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0`, (err) => { /* ignora erro */ });

        // Tabela de Regras (Uma por usuário)
        db.run(`CREATE TABLE IF NOT EXISTS rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            rules_json TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Tabela de Pagamentos (Woovi PIX)
        db.run(`CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            charge_id TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'PENDING',
            amount INTEGER NOT NULL,
            plan_duration INTEGER DEFAULT 30,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        db.run(`ALTER TABLE payments ADD COLUMN plan_duration INTEGER DEFAULT 30`, (err) => { /* ignora erro */ });
    });
}

module.exports = db;
