const { io } = require("socket.io-client");
const crypto = require('crypto');
const { exec } = require('child_process');
const { keyboard, Key } = require("@nut-tree-fork/nut-js");

keyboard.config.autoDelayMs = 50; // Delay padrão entre apertar e soltar

const BACKEND_URL = "https://live.paginasturbinadas.com.br";
const FRONTEND_URL = "https://live.paginasturbinadas.com.br";
let userRules = {};

console.log("======================================");
console.log("   TikTok Live Actions - Desktop CLI  ");
console.log("======================================");

// Gera um ID de sessão único para este terminal
const sessionId = crypto.randomUUID();
const loginUrl = `${FRONTEND_URL}/cli-login?session=${sessionId}`;

console.log("\n🔗 Abrindo o navegador para autenticação...");
console.log(`Se o navegador não abrir sozinho, acesse:`);
console.log(`\x1b[36m${loginUrl}\x1b[0m\n`);
console.log("Aguardando autorização no painel web...");

// Abre o navegador no Windows
exec(`start ${loginUrl}`);

// Função que faz o polling perguntando ao servidor se a sessão foi autorizada
function pollForAuth() {
    const http = BACKEND_URL.startsWith('https') ? require('https') : require('http');
    http.get(`${BACKEND_URL}/api/auth/cli-status?session=${sessionId}`, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
            try {
                const parsed = JSON.parse(responseData);
                if (parsed.authenticated && parsed.token) {
                    console.log("✅ Acesso autorizado pelo painel web!\n");
                    startSocket(parsed.token);
                } else {
                    // Tenta de novo em 2 segundos
                    setTimeout(pollForAuth, 2000);
                }
            } catch (e) {
                console.error("❌ Erro ao ler resposta do servidor.");
                setTimeout(pollForAuth, 2000);
            }
        });
    }).on('error', (e) => {
        console.error(`❌ Erro de conexão com servidor: ${e.message}`);
        setTimeout(pollForAuth, 2000);
    });
}

// Inicia o polling imediatamente
pollForAuth();

function startSocket(token) {
    const socket = io(BACKEND_URL, {
        auth: { token }
    });

    socket.on("connect", () => {
        console.log(`[Conexão Segura] Conectado ao servidor principal!`);
    });

    socket.on("rules-updated", (rules) => {
        userRules = Array.isArray(rules) ? rules : [];
        console.log(`[Config] Suas regras foram atualizadas pelo painel.`);
    });

    socket.on("tiktok-connected", (data) => {
        console.log(`[TikTok] ✅ ${data.message} (@${data.username})`);
        console.log(`Aguardando eventos da SUA live...`);
    });

    socket.on("tiktok-error", (data) => {
        console.error(`[TikTok] ❌ Erro: ${data.message}`);
    });

    socket.on("tiktok-disconnected", (data) => {
        console.warn(`[TikTok] ⚠️ ${data.message}`);
    });

    socket.on("trial-expired", (data) => {
        console.log(`\n======================================`);
        console.log(`❌ ATENÇÃO: ${data.message}`);
        console.log(`Pressione qualquer tecla para abrir a tela de Upgrade...`);
        console.log(`======================================\n`);
        
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.once('data', (key) => {
                // Se pressionou Ctrl+C, permite fechar o app
                if (key.toString() === '\u0003') {
                    process.exit();
                }
                console.log("Abrindo navegador...");
                exec(`start ${FRONTEND_URL}/dashboard/subscription`);
                process.stdin.setRawMode(false);
                process.stdin.pause();
            });
        } else {
            // Fallback se não suportar rawMode
            exec(`start ${FRONTEND_URL}/dashboard/subscription`);
        }
    });

    const cooldowns = new Map();
    const COOLDOWN_MS = 3000;

    const processRule = async (type, value) => {
        if (!Array.isArray(userRules)) return;
        const matchedRules = userRules.filter(r => 
            r.triggerType === type && r.triggerValue && r.triggerValue.toLowerCase() === value.toLowerCase()
        );
        for (const rule of matchedRules) {
            const cooldownKey = `rule_${rule.id}`;
            const now = Date.now();
            if (cooldowns.has(cooldownKey) && (now - cooldowns.get(cooldownKey) < COOLDOWN_MS)) {
                console.log(`⏳ Spam evitado: Regra para '${value}' está em tempo de recarga.`);
                continue;
            }
            cooldowns.set(cooldownKey, now);

            if (rule.actionKeypress) {
                console.log(`⚡ Regra Encontrada: ${value} -> Pressionar '${rule.actionKeypress}'`);
                await executeAction(rule.actionKeypress);
            }
            if (rule.actionSound) {
                console.log(`🎵 Regra Encontrada: ${value} -> Áudio disparado no Widget (OBS)`);
            }
            if (rule.actionVideo) {
                console.log(`🎬 Regra Encontrada: ${value} -> Vídeo disparado no Widget (OBS)`);
            }
        }
    };

    socket.on("gift-received", async (data) => {
        console.log(`\n🎁 PRESENTE: ${data.giftName} (de ${data.username})`);
        await processRule('gift', data.giftName);
    });

    socket.on("follow", async (data) => {
        console.log(`\n👤 NOVO SEGUIDOR: ${data.username}`);
        await processRule('follow', 'Novo Seguidor');
    });
    
    socket.on("like", async (data) => {
        console.log(`\n❤️ CURTIDA: ${data.username}`);
        await processRule('like', 'Curtida');
    });

    socket.on("share", async (data) => {
        console.log(`\n🔄 COMPARTILHAMENTO: ${data.username}`);
        await processRule('share', 'Compartilhamento');
    });

    socket.on("connect_error", (err) => {
        console.error(`[Socket] Erro de autenticação: ${err.message}`);
    });

    socket.on("disconnect", () => {
        console.log("[Socket] Desconectado do servidor SaaS.");
    });
}

// Função para mapear e pressionar a tecla usando nut-js
async function executeAction(actionString) {
    if (!actionString) return;
    
    // Tratamento para garantir que "W", "Space", "Enter" sejam mapeados
    const formatted = actionString.trim().toUpperCase();
    
    let targetKey = null;
    
    // Mapeamento manual rápido para as mais comuns
    const map = {
        'SPACE': Key.Space,
        'ENTER': Key.Enter,
        'UP': Key.Up,
        'DOWN': Key.Down,
        'LEFT': Key.Left,
        'RIGHT': Key.Right,
        'TAB': Key.Tab,
        'ESCAPE': Key.Escape
    };

    if (map[formatted]) {
        targetKey = map[formatted];
    } else {
        // Tenta achar direto no Enum Key do nut-js (ex: Key.W)
        targetKey = Key[formatted];
        // Se for número, o enum usa Num0, Num1...
        if (!targetKey && !isNaN(formatted)) {
            targetKey = Key[`Num${formatted}`];
        }
    }

    if (targetKey != null) {
        try {
            await keyboard.type(targetKey);
            console.log(`[Físico] Tecla '${formatted}' pressionada com sucesso!`);
        } catch (err) {
            console.error(`[Físico] Erro ao tentar pressionar a tecla:`, err);
        }
    } else {
        console.error(`[Físico] Tecla não reconhecida pelo sistema: '${actionString}'`);
    }
}
