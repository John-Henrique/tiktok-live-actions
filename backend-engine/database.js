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
        
        // Tabela de Histórico de Sessões em Live
        db.run(`CREATE TABLE IF NOT EXISTS live_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            active_count INTEGER NOT NULL,
            recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (!err) {
                // Se a tabela acabou de ser criada, verificar se tá vazia para inserir dummy data
                db.get('SELECT COUNT(*) as c FROM live_history', (err, row) => {
                    if (row && row.c === 0) {
                        console.log('[DB] Gerando dados fictícios para live_history...');
                        const stmt = db.prepare('INSERT INTO live_history (active_count, recorded_at) VALUES (?, ?)');
                        const now = new Date();
                        // Gerar ultimas 24 horas
                        for (let i = 24; i >= 0; i--) {
                            let pastTime = new Date(now.getTime() - (i * 60 * 60 * 1000));
                            let dummyCount = Math.floor(Math.random() * 15) + 2; // de 2 a 16 usuarios
                            stmt.run(dummyCount, pastTime.toISOString().slice(0, 19).replace('T', ' '));
                        }
                        stmt.finalize();
                    }
                });
            }
        });

        // Tabela de Estatísticas Diárias do Usuário (Presentes e Seguidores)
        db.run(`CREATE TABLE IF NOT EXISTS user_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            diamonds INTEGER DEFAULT 0,
            followers INTEGER DEFAULT 0,
            UNIQUE(user_id, date),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

    });
}

module.exports = db;
