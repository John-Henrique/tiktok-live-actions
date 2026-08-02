const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { TikTokLiveConnection } = require('tiktok-live-connector');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_saas_2026';
const WOOVI_APP_ID = process.env.WOOVI_APP_ID || '';
const TRIAL_DURATION_MS = 60 * 60 * 1000; // 1 hora

const app = express();
app.use(cors());
app.use(express.json());
app.use('/gifts', express.static(path.join(__dirname, 'public/gifts')));

// Configuração do Backblaze B2 (S3 API)
const s3Client = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: 'us-east-005', // Fake region needed for aws-sdk
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APP_KEY
    }
});
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Map de Conexões Ativas: userId -> { connection, timeoutId, username }
const activeConnections = new Map();

// Map de Sessões CLI pendentes: sessionId -> { authenticated: boolean, token?: string }
const cliSessions = new Map();

// Função para iniciar conexão com o TikTok (Multi-Tenant)
function connectToTikTok(userId, username, isTrial) {
    if (!username || !userId) return;
    
    const existing = activeConnections.get(userId);
    if (existing) {
        if (existing.username === username) {
            console.log(`[TikTok] Usuário ${userId} já está conectado a @${username}.`);
            return;
        }
        console.log(`[TikTok] Desconectando usuário ${userId} de @${existing.username} para nova conexão...`);
        existing.connection.disconnect();
        clearTimeout(existing.timeoutId);
        activeConnections.delete(userId);
    }

    console.log(`[TikTok] Iniciando conexão para usuário ${userId} com @${username} (Trial: ${isTrial})...`);
    
    const tiktokLiveConnection = new TikTokLiveConnection(username, {
        processInitialData: false,
        enableExtendedGiftInfo: false,
        enableWebsocketUpgrade: true,
        requestOptions: { timeout: 10000 }
    });

    let timeoutId = null;

    tiktokLiveConnection.on('connected', (state) => {
        console.log(`[TikTok] User ${userId} conectado à live de @${username}`);
        io.to(userId.toString()).emit('tiktok-connected', { username, message: 'Conectado com sucesso!' });
        
        if (isTrial) {
            db.get('SELECT trial_time_used FROM users WHERE id = ?', [userId], (err, row) => {
                let timeUsed = row && row.trial_time_used ? row.trial_time_used : 0;

                const timeLeft = Math.max(0, TRIAL_DURATION_MS - timeUsed);
                
                if (timeLeft === 0) {
                    console.log(`[TikTok] Trial expirado imediatamente para usuário ${userId}.`);
                    io.to(userId.toString()).emit('trial-expired', { message: 'Seu tempo de teste de 1 hora acabou.' });
                    db.run('UPDATE users SET trial_used = 1 WHERE id = ?', [userId]);
                    if (activeConnections.has(userId)) {
                        const conn = activeConnections.get(userId);
                        conn.connection.disconnect();
                        activeConnections.delete(userId);
                    }
                } else {
                    let lastTick = Date.now();
                    const intervalId = setInterval(() => {
                        const now = Date.now();
                        timeUsed += (now - lastTick);
                        lastTick = now;
                        
                        // Atualiza no banco o tempo gasto
                        db.run('UPDATE users SET trial_time_used = ? WHERE id = ?', [Math.floor(timeUsed), userId]);
                        
                        // Se o tempo acumulado ultrapassou 1 hora
                        if (timeUsed >= TRIAL_DURATION_MS) {
                            console.log(`[TikTok] Trial expirado para usuário ${userId}. Desconectando...`);
                            io.to(userId.toString()).emit('trial-expired', { message: 'Seu tempo de teste de 1 hora acabou.' });
                            db.run('UPDATE users SET trial_used = 1 WHERE id = ?', [userId]);
                            if (activeConnections.has(userId)) {
                                const conn = activeConnections.get(userId);
                                conn.connection.disconnect(); // Isso vai disparar o evento disconnected e limpar o interval
                            }
                        }
                    }, 5000); // Salva a cada 5 segundos
                    
                    if (activeConnections.has(userId)) {
                        activeConnections.get(userId).intervalId = intervalId;
                    }
                }
            });
        }
    });

    tiktokLiveConnection.connect().catch(err => {
        console.error(`[TikTok] Erro ao conectar a @${username} para user ${userId}`, err);
        io.to(userId.toString()).emit('tiktok-error', { message: `Falha ao conectar: ${err.message}` });
        activeConnections.delete(userId);
    });

    tiktokLiveConnection.on('chat', data => {
        const user = data.user || data.author || {};
        const uniqueId = user.uniqueId || user.displayId || user.nickname || "User";
        const comment = data.comment || data.content || data.text || "";
        console.log(`[TikTok @${username}] Chat: ${uniqueId}: ${comment}`);
        io.to(userId.toString()).emit('chat', { uniqueId, comment });
    });

    tiktokLiveConnection.on('gift', data => {
        const user = data.user || data.author || {};
        const uniqueId = user.uniqueId || user.displayId || user.nickname || "User";
        const giftName = data.giftName || (data.gift && data.gift.name) || (data.giftInfo && data.giftInfo.name) || "Presente";
        const giftId = data.giftId || (data.gift && data.gift.id) || (data.giftInfo && data.giftInfo.giftId) || 0;
        const repeatCount = data.repeatCount || 1;
        const repeatEnd = typeof data.repeatEnd !== 'undefined' ? data.repeatEnd : true;
        
        console.log(`[TikTok @${username}] Gift: ${giftName} de ${uniqueId}`);
        io.to(userId.toString()).emit('gift-received', {
            username: uniqueId, giftName, giftId, repeatCount, repeatEnd
        });
    });

    tiktokLiveConnection.on('follow', data => {
        const uniqueId = data.user ? (data.user.uniqueId || data.user.displayId) : "User";
        io.to(userId.toString()).emit('follow', { username: uniqueId });
    });

    tiktokLiveConnection.on('like', data => {
        const uniqueId = data.user ? (data.user.uniqueId || data.user.displayId) : "User";
        io.to(userId.toString()).emit('like', { username: uniqueId, totalLikes: data.totalLikeCount || 1 });
    });

    tiktokLiveConnection.on('share', data => {
        const uniqueId = data.user ? (data.user.uniqueId || data.user.displayId) : "User";
        io.to(userId.toString()).emit('share', { username: uniqueId });
    });

    tiktokLiveConnection.on('disconnected', () => {
        console.log(`[TikTok] Desconectado da live de @${username} (User ${userId})`);
        io.to(userId.toString()).emit('tiktok-disconnected', { message: 'Live encerrada ou desconectada.' });
        if (activeConnections.has(userId)) {
            const conn = activeConnections.get(userId);
            if (conn.intervalId) clearInterval(conn.intervalId);
            activeConnections.delete(userId);
        }
    });

    activeConnections.set(userId, { connection: tiktokLiveConnection, intervalId: null, username });
}

// ---------------- ESTATÍSTICAS (ADMIN) ----------------
app.get('/api/stats', (req, res) => {
    res.json({
        activeTikTokConnections: activeConnections.size,
        activeCliSessions: cliSessions.size,
        uptime: process.uptime()
    });
});

// Middleware de Autenticação REST
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: 'Token não fornecido' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
}

// ---------------- AUTENTICAÇÃO REST ----------------
app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

    const passwordHash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, passwordHash], function(err) {
        if (err) return res.status(400).json({ error: 'Erro ao criar conta (Email já existe?)' });
        db.run('INSERT INTO rules (user_id, rules_json) VALUES (?, ?)', [this.lastID, '{}']);
        const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET);
        res.json({ success: true, token, user: { id: this.lastID, email } });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Usuário não encontrado' });

        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Senha incorreta' });
        }
        
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
        res.json({ success: true, token, user: { id: user.id, email: user.email, tiktok_username: user.tiktok_username, plan: user.plan_status, trial_used: user.trial_used, trial_time_used: user.trial_time_used } });
    });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    db.get('SELECT id, email, tiktok_username, plan_status, trial_used, trial_time_used FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ id: user.id, email: user.email, tiktok_username: user.tiktok_username, plan: user.plan_status, trial_used: user.trial_used, trial_time_used: user.trial_time_used });
    });
});

app.put('/api/auth/password', authenticateToken, (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Senha muito curta (mínimo 6 caracteres)' });
    
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: 'Erro ao atualizar senha' });
        res.json({ success: true, message: 'Senha atualizada com sucesso' });
    });
});

app.delete('/api/auth/account', authenticateToken, (req, res) => {
    const userId = req.user.id;
    // Remove the user and their rules from the database
    db.run('DELETE FROM rules WHERE user_id = ?', [userId], (err) => {
        if (err) console.error("Erro ao deletar regras do usuário", err);
        db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
            if (err) return res.status(500).json({ error: 'Erro ao deletar conta' });
            
            // Disconnect active TikTok connection
            if (activeConnections.has(userId)) {
                const conn = activeConnections.get(userId);
                if (conn.intervalId) clearInterval(conn.intervalId);
                conn.connection.disconnect();
                activeConnections.delete(userId);
            }
            // Also force disconnect all sockets in their room
            io.to(userId.toString()).disconnectSockets(true);
            
            res.json({ success: true, message: 'Conta excluída permanentemente' });
        });
    });
});

app.post('/api/media/upload', authenticateToken, upload.single('media'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const fileExt = path.extname(req.file.originalname);
    const fileName = `tiktok-live/${req.user.id}_${Date.now()}${fileExt}`;
    
    try {
        const bucketName = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET;
        console.log(`[B2 Debug] B2_BUCKET_NAME = "${process.env.B2_BUCKET_NAME}"`);
        console.log(`[B2 Debug] Resolving bucket to: "${bucketName}"`);

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        });
        
        await s3Client.send(command);
        
        const publicUrl = `${process.env.B2_ENDPOINT}/${process.env.B2_BUCKET_NAME || process.env.B2_BUCKET}/${fileName}`;
        res.json({ success: true, url: publicUrl });
    } catch (err) {
        console.error("[B2 Upload Error]", err);
        res.status(500).json({ error: 'Falha no upload para nuvem' });
    }
});

app.delete('/api/media', authenticateToken, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL não fornecida' });
    
    // Extract key from URL
    // Format: https://s3.region.backblazeb2.com/bucketName/tiktok-live/filename.ext
    try {
        const bucketName = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET;
        const parts = url.split(`${bucketName}/`);
        if (parts.length < 2) return res.status(400).json({ error: 'URL inválida' });
        
        const key = parts[1];
        
        // Ensure user is only deleting their own files
        if (!key.startsWith(`tiktok-live/${req.user.id}_`)) {
             return res.status(403).json({ error: 'Acesso negado' });
        }
        
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key
        });
        
        await s3Client.send(command);
        res.json({ success: true });
    } catch (err) {
        console.error("[B2 Delete Error]", err);
        res.status(500).json({ error: 'Falha ao deletar arquivo' });
    }
});


app.get('/api/auth/cli-status', (req, res) => {
    const { session } = req.query;
    if (!session) return res.status(400).json({ error: 'Sessão não fornecida' });

    if (!cliSessions.has(session)) {
        // Inicializa a sessão se não existir
        cliSessions.set(session, { authenticated: false });
    }

    const sessionData = cliSessions.get(session);
    res.json(sessionData);

    // Opcional: Limpar após o consumo bem sucedido para segurança
    if (sessionData.authenticated) {
        cliSessions.delete(session);
    }
});

app.post('/api/auth/cli-authorize', authenticateToken, (req, res) => {
    const { session } = req.body;
    if (!session) return res.status(400).json({ error: 'Sessão não fornecida' });

    // Pega o token JWT enviado no cabeçalho Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader.split(' ')[1];

    cliSessions.set(session, { authenticated: true, token: token });
    res.json({ success: true });
});

// ---------------- PAGAMENTOS WOOVI (PIX) ----------------

app.post('/api/payments/pix', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const planDuration = req.body.planDuration || 30; // default 30 days
    
    let chargeValue = 2000;
    if (planDuration === 90) chargeValue = 5000; // Trimestral (R$ 50)
    if (planDuration === 180) chargeValue = 9000; // Semestral (R$ 90)
    if (planDuration === 365) chargeValue = 15000; // Anual (R$ 150)

    const correlationID = `order_${userId}_${Date.now()}`;

    const payload = JSON.stringify({
        correlationID: correlationID,
        value: chargeValue,
        comment: "Upgrade para Plano Pro - TikTok Live Actions",
        customer: {
            name: req.user.email,
            email: req.user.email,
            type: "FREE"
        }
    });

    const options = {
        hostname: 'api.woovi.com',
        port: 443,
        path: '/api/v1/charge',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': WOOVI_APP_ID,
            'Content-Length': payload.length
        }
    };

    const wooviReq = https.request(options, (wooviRes) => {
        let responseData = '';
        wooviRes.on('data', chunk => responseData += chunk);
        wooviRes.on('end', () => {
            try {
                const data = JSON.parse(responseData);
                if (data.charge) {
                    // Salvar pagamento no banco de dados como pendente
                    db.run('INSERT INTO payments (user_id, charge_id, amount, plan_duration) VALUES (?, ?, ?, ?)', 
                           [userId, data.charge.correlationID, chargeValue, planDuration], function(err) {
                        if (err) console.error("Erro ao salvar payment no DB:", err);
                    });

                    return res.json({
                        success: true,
                        qrCodeImage: data.charge.qrCodeImage,
                        brCode: data.charge.brCode,
                        correlationID: data.charge.correlationID
                    });
                } else {
                    console.error("Woovi Erro:", data);
                    return res.status(500).json({ error: 'Erro ao gerar PIX', details: data });
                }
            } catch (e) {
                return res.status(500).json({ error: 'Erro na resposta do PIX' });
            }
        });
    });

    wooviReq.on('error', (e) => {
        return res.status(500).json({ error: 'Falha na comunicação com gateway de pagamento' });
    });

    wooviReq.write(payload);
    wooviReq.end();
});

// Webhook que a Woovi chama quando o PIX é pago
app.post('/api/webhooks/woovi', (req, res) => {
    // Retorna OK o mais rápido possível para a Woovi
    res.status(200).send('OK');

    const event = req.body;
    
    if (event && event.event === 'OPENPIX:CHARGE_COMPLETED' && event.charge) {
        const correlationID = event.charge.correlationID;

        // Procura no banco qual o user e os dias desse charge
        db.get('SELECT user_id, plan_duration FROM payments WHERE charge_id = ? AND status = "PENDING"', [correlationID], (err, payment) => {
            if (err || !payment) return;
            
            const userId = payment.user_id;
            const duration = payment.plan_duration || 30;
            
            // Marca pagamento como concluído
            db.run('UPDATE payments SET status = "COMPLETED" WHERE charge_id = ?', [correlationID]);
            
            // Atualiza usuário para PRO e soma o tempo ao pro_expires_at (ou cria um novo se tiver vencido)
            const query = `
                UPDATE users 
                SET plan_status = "pro", 
                    trial_used = 1,
                    pro_expires_at = datetime(
                        CASE 
                            WHEN pro_expires_at IS NULL OR pro_expires_at < CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP 
                            ELSE pro_expires_at 
                        END, 
                        '+' || ? || ' days'
                    )
                WHERE id = ?
            `;
            
            db.run(query, [duration, userId], (err2) => {
                if (err2) return console.error("Erro ao dar upgrade no usuário", err2);
                
                // Emite o alerta de sucesso com confetes para o painel em tempo real
                io.to(userId.toString()).emit('payment-completed', { duration });


                console.log(`\n🎉 Pagamento Recebido! Usuário ${userId} agora é PRO!`);
                
                // Emite evento instantâneo via Socket.io para o navegador do usuário
                io.to(userId.toString()).emit('subscription-updated', { 
                    plan: 'pro',
                    message: 'Pagamento confirmado! Bem-vindo ao Plano Pro!'
                });
            });
        });
    }
});

// ---------------- REGRAS E CONEXÃO ----------------
app.get('/api/available-gifts', (req, res) => {
    try {
        const giftsDir = path.join(__dirname, 'public', 'gifts');
        if (!fs.existsSync(giftsDir)) return res.json([]);
        const files = fs.readdirSync(giftsDir);
        const gifts = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg')).map(f => {
            const parts = f.replace(/\.(png|jpg|jpeg)$/i, '').split('-');
            const publicUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
            return {
                filename: f, name: parts[0], id: parts.length > 1 ? parts[1] : '',
                diamondCount: 0, url: `${publicUrl}/gifts/${f}`
            };
        });
        res.json(gifts);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar presentes' });
    }
});

// Retorna histórico de pagamentos e informações da assinatura
app.get('/api/payments', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    db.get('SELECT plan_status, pro_expires_at, trial_used FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.status(500).json({ error: 'Erro ao buscar dados do usuário' });
        
        db.all('SELECT charge_id, amount, status, plan_duration, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [userId], (err2, payments) => {
            if (err2) return res.status(500).json({ error: 'Erro ao buscar pagamentos' });
            
            res.json({
                planStatus: user.plan_status,
                trialUsed: user.trial_used,
                proExpiresAt: user.pro_expires_at,
                history: payments
            });
        });
    });
});

app.get('/api/rules', authenticateToken, (req, res) => {
    db.get('SELECT * FROM rules WHERE user_id = ?', [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Erro ao ler regras' });
        db.get('SELECT tiktok_username FROM users WHERE id = ?', [req.user.id], (err2, userRow) => {
            let rulesObj = {};
            try { rulesObj = row ? JSON.parse(row.rules_json) : {}; } catch(e) {}
            res.json({ targetUsername: userRow ? userRow.tiktok_username : '', rules: rulesObj });
        });
    });
});

app.post('/api/rules', authenticateToken, (req, res) => {
    const newRules = req.body;
    const rulesJson = JSON.stringify(newRules.rules || {});
    
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(500).json({ error: 'Usuário não encontrado' });
        
        const requestedUsername = newRules.targetUsername ? newRules.targetUsername.trim() : null;

        // Validar unicidade do tiktok_username se foi alterado
        if (requestedUsername && requestedUsername !== user.tiktok_username) {
            db.get('SELECT id FROM users WHERE tiktok_username = ? AND id != ?', [requestedUsername, req.user.id], (err2, existingUser) => {
                if (existingUser) {
                    return res.status(400).json({ error: 'Este perfil do TikTok já está sendo monitorado por outra conta.' });
                }
                updateRulesAndConnect(req.user.id, user, requestedUsername, rulesJson, newRules, res);
            });
        } else {
            updateRulesAndConnect(req.user.id, user, requestedUsername, rulesJson, newRules, res);
        }
    });
});

function updateRulesAndConnect(userId, user, requestedUsername, rulesJson, newRules, res) {
    db.run('UPDATE rules SET rules_json = ? WHERE user_id = ?', [rulesJson, userId], (err) => {
        if (err) return res.status(500).json({ error: 'Erro ao salvar regras' });

        if (requestedUsername) {
            db.run('UPDATE users SET tiktok_username = ? WHERE id = ?', [requestedUsername, userId]);
            
            if (user.trial_used && user.plan_status !== 'pro') {
                return res.status(403).json({ error: 'Seu trial de 1 hora já foi utilizado. Faça upgrade para o plano Pro.' });
            }

            const isTrial = user.plan_status !== 'pro';
            
            // Só conecta no TikTok agora se o usuário tiver algum cliente (CLI/Widget) online!
            const room = io.sockets.adapter.rooms.get(userId.toString());
            if (room && room.size > 0) {
                connectToTikTok(userId, requestedUsername, isTrial);
            } else {
                console.log(`[TikTok] Regras salvas, mas nenhum cliente conectado para User ${userId}. Aguardando CLI...`);
            }
        }
        
        io.to(userId.toString()).emit('rules-updated', newRules.rules || {});
        res.json({ success: true });
    });
}

// ---------------- SOCKET.IO MIDDLEWARE E EVENTOS ----------------
io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Autenticação necessária (Token ausente)'));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Token inválido'));
        socket.userId = decoded.id.toString();
        next();
    });
});

io.on('connection', (socket) => {
    console.log(`[Socket] Cliente conectado (User ID: ${socket.userId})`);
    
    // Join na sala exclusiva do usuário
    socket.join(socket.userId);

    db.get('SELECT tiktok_username, plan_status, trial_used, rules_json FROM users LEFT JOIN rules ON users.id = rules.user_id WHERE users.id = ?', [socket.userId], (err, row) => {
        if (row) {
            try {
                if (row.rules_json) {
                    const rulesObj = JSON.parse(row.rules_json);
                    socket.emit('rules-updated', rulesObj);
                }
            } catch(e) {}

            // Inicia a conexão com o TikTok automaticamente se houver um username configurado
            // e se ainda não estiver ativo no activeConnections
            const userIdNum = parseInt(socket.userId);
            if (row.tiktok_username && !activeConnections.has(userIdNum)) {
                if (row.trial_used && row.plan_status !== 'pro') {
                    socket.emit('trial-expired', { message: 'Seu trial expirou. Faça o upgrade para conectar.' });
                } else {
                    const isTrial = row.plan_status !== 'pro';
                    connectToTikTok(userIdNum, row.tiktok_username, isTrial);
                }
            } else if (activeConnections.has(userIdNum)) {
                const conn = activeConnections.get(userIdNum);
                socket.emit('tiktok-connected', { username: conn.username, message: 'Já conectado à live.' });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Cliente desconectado (User ID: ${socket.userId})`);
        
        // Verifica se ainda há algum cliente (Widget ou CLI) conectado nesta sala
        const room = io.sockets.adapter.rooms.get(socket.userId);
        if (!room || room.size === 0) {
            console.log(`[Socket] Nenhuma tela/CLI ativa para User ${socket.userId}. Pausando conexão com TikTok para economizar recursos.`);
            const userIdNum = parseInt(socket.userId);
            if (activeConnections.has(userIdNum)) {
                const conn = activeConnections.get(userIdNum);
                conn.connection.disconnect(); // Dispara on('disconnected') que limpa o intervalId
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`[Backend SaaS] Motor rodando na porta ${PORT}`);
});
