const { io } = require("socket.io-client");
const crypto = require('crypto');
const { exec } = require('child_process');
const { keyboard, Key } = require("@nut-tree-fork/nut-js");
const { ThermalPrinter, PrinterTypes, CharacterSet } = require("node-thermal-printer");
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const os = require('os');

// Cria/obtem diretorio temporario do SO para suportar escrita no executavel empacotado (pkg)
function getTempDir() {
    const tempDir = path.join(os.tmpdir(), 'tiktok-live-actions');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
}

keyboard.config.autoDelayMs = 50; // Delay padrão entre apertar e soltar

const isDev = process.argv.includes('--local') || process.argv.includes('dev');
const BACKEND_URL = isDev ? "http://localhost:3001" : "https://live.paginasturbinadas.com.br";
const FRONTEND_URL = isDev ? "http://localhost:5173" : "https://live.paginasturbinadas.com.br";
let userRules = [];
let liveMode = 'game';
let printerSettings = {};
let printer = null;

console.log("======================================");
console.log("   TikTok Live Actions - Desktop CLI  ");
if (isDev) {
    console.log("   [MODO DESENVOLVIMENTO / LOCAL]    ");
}
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
    const httpModule = BACKEND_URL.startsWith('https') ? https : http;
    httpModule.get(`${BACKEND_URL}/api/auth/cli-status?session=${sessionId}`, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
            try {
                const parsed = JSON.parse(responseData);
                if (parsed.authenticated && parsed.token) {
                    console.log("\x1b[32m[OK]\x1b[0m Acesso autorizado pelo painel web!\n");
                    startSocket(parsed.token);
                } else {
                    // Tenta de novo em 2 segundos
                    setTimeout(pollForAuth, 2000);
                }
            } catch (e) {
                console.error("\x1b[31m[ERRO]\x1b[0m Erro ao ler resposta do servidor.");
                setTimeout(pollForAuth, 2000);
            }
        });
    }).on('error', (e) => {
        console.error(`\x1b[31m[ERRO]\x1b[0m Erro de conexão com servidor: ${e.message}`);
        setTimeout(pollForAuth, 2000);
    });
}

// Inicia o polling imediatamente
pollForAuth();

// Auxiliar para baixar imagem do presente
function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        // CDNs do TikTok bloqueiam requisições sem User-Agent com erro 502/403. Enviamos um header de navegador.
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        client.get(url, options, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
                return;
            }
            const writeStream = fs.createWriteStream(destPath);
            response.pipe(writeStream);
            writeStream.on('finish', () => {
                writeStream.close();
                resolve(destPath);
            });
            writeStream.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

// Inicializa a impressora
function initPrinter(settings) {
    if (!settings || !settings.interface) {
        printer = null;
        console.log("📠 Impressora não configurada ou sem interface.");
        return;
    }
    
    try {
        let printerInterface = settings.interface;
        
        // Se for Windows e não COM/LPT/Caminho UNC, usamos arquivo temporário no diretório temporário do SO
        if (!printerInterface.startsWith('\\\\') && !printerInterface.startsWith('COM') && !printerInterface.startsWith('LPT')) {
            printerInterface = path.join(getTempDir(), 'temp_print.bin');
        }

        console.log(`[Config Impressora] Inicializando em: ${printerInterface}`);
        printer = new ThermalPrinter({
            type: settings.printerType === 'star' ? PrinterTypes.STAR : PrinterTypes.EPSON,
            interface: printerInterface,
            characterSet: CharacterSet[settings.characterSet] || CharacterSet.PC860_PORTUGUESE,
            removeSpecialCharacters: false,
            options: {
                timeout: 5000
            }
        });
        
        // Ativa modo de cabeça para baixo para texto se configurado
        printer.upsideDown(settings.upsideDown || false);
    } catch (e) {
        console.error("\x1b[31m[ERRO]\x1b[0m Erro ao inicializar impressora térmica:", e.message);
        printer = null;
    }
}

async function sendRawToWindowsPrinter() {
    const rawInterface = printerSettings.interface;
    if (!rawInterface) return;
    if (!rawInterface.startsWith('\\\\') && !rawInterface.startsWith('COM') && !rawInterface.startsWith('LPT')) {
        const tempDir = getTempDir();
        const tempFile = path.resolve(path.join(tempDir, 'temp_print.bin')).replace(/\\/g, '\\\\');
        if (!fs.existsSync(tempFile)) return;
        
        return new Promise((resolve, reject) => {
            const printerName = rawInterface;
            const tempPs1File = path.resolve(path.join(tempDir, 'temp_print.ps1')).replace(/\\/g, '\\\\');
            
            // Script do PowerShell escrito com quebras de linha reais preservadas para o compilador C#
            const psScript = `
$code = @'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendFileToPrinter(string szPrinterName, string szFileName) {
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        bool bSuccess = false;
        di.pDocName = "RAW_ESC_POS_PRINT";
        di.pDataType = "RAW";
        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    byte[] bytes = System.IO.File.ReadAllBytes(szFileName);
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    Int32 dwWritten = 0;
                    bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return bSuccess;
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
[RawPrinter]::SendFileToPrinter('${printerName}', '${tempFile}')
`;

            try {
                fs.writeFileSync(tempPs1File, psScript, 'utf-8');
            } catch (errWrite) {
                console.error("\x1b[31m[ERRO]\x1b[0m Erro ao escrever script ps1 temporário:", errWrite.message);
                try { fs.unlinkSync(tempFile); } catch(e) {}
                reject(errWrite);
                return;
            }

            exec(`powershell -ExecutionPolicy Bypass -File "${tempPs1File}"`, (err, stdout, stderr) => {
                try { fs.unlinkSync(tempPs1File); } catch(e) {}
                try { fs.unlinkSync(tempFile); } catch(e) {}
                if (err) {
                    console.error("\x1b[31m[ERRO]\x1b[0m Erro ao enviar comandos RAW para o Windows Spooler:", stderr || stdout);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

// Auxiliar para compor a imagem de presente com borda, tamanho e centralização via PowerShell
async function composeAndPrintImage(username, inputImg, outputImg, printMode) {
    const cleanInputImg = path.resolve(inputImg).replace(/\\/g, '\\\\');
    const cleanOutputImg = path.resolve(outputImg).replace(/\\/g, '\\\\');
    const tempPs1File = path.resolve(path.join(getTempDir(), 'temp_compose.ps1')).replace(/\\/g, '\\\\');
    const rotate180 = printerSettings.upsideDown ? 'true' : 'false';

    const psScript = `
[void][System.Reflection.Assembly]::LoadWithPartialName('System.Drawing')

function Load-ImageSafely($path) {
    if (!(Test-Path $path) -or (Get-Item $path).Length -eq 0) { return $null }
    try {
        Add-Type -AssemblyName PresentationCore -ErrorAction SilentlyContinue
        $uri = New-Object System.Uri($path)
        $decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create($uri, [System.Windows.Media.Imaging.BitmapCreateOptions]::None, [System.Windows.Media.Imaging.BitmapCacheOption]::Default)
        $frame = $decoder.Frames[0]
        $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
        $encoder.Frames.Add($frame)
        $tempPng = $path + '.wic.png'
        $stream = New-Object System.IO.FileStream($tempPng, [System.IO.FileMode]::Create)
        $encoder.Save($stream)
        $stream.Close()
        $stream.Dispose()
        
        $img = [System.Drawing.Image]::FromFile($tempPng)
        $img.Tag = $tempPng
        return $img
    } catch {
        try {
            return [System.Drawing.Image]::FromFile($path)
        } catch {
            return $null
        }
    }
}

if ('${printMode}' -eq 'photo_s') {
    $canvas = New-Object System.Drawing.Bitmap(384, 150)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear([System.Drawing.Color]::White)
    
    # Caneta de borda com espessura de 8px (2x mais grossa) e Inset por 4px para evitar cortes
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 8)
    $g.DrawRectangle($pen, 4, 4, 375, 141)

    $img = Load-ImageSafely '${cleanInputImg}'
    if ($img -ne $null) {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        
        # Efeito de foto redonda (circular clip)
        $clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $clipPath.AddEllipse(20, 15, 120, 120)
        $oldClip = $g.Clip
        $g.SetClip($clipPath)
        $g.DrawImage($img, 20, 15, 120, 120)
        $g.Clip = $oldClip
        $clipPath.Dispose()
        
        $tempPng = $img.Tag
        $img.Dispose()
        if ($tempPng -and (Test-Path $tempPng)) { Remove-Item $tempPng -Force -ErrorAction SilentlyContinue }
    }

    $font = New-Object System.Drawing.Font('Arial', 14, [System.Drawing.FontStyle]::Bold)
    $brush = [System.Drawing.Brushes]::Black
    $usernameStr = '@${username}'
    $textSize = $g.MeasureString($usernameStr, $font)
    $textX = 160
    $textY = (150 - $textSize.Height) / 2
    $g.DrawString($usernameStr, $font, $brush, $textX, $textY)
    
    if ('${rotate180}' -eq 'true') {
        $canvas.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone)
    }
    
    $canvas.Save('${cleanOutputImg}', [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    $g.Dispose()
    $pen.Dispose()
    $font.Dispose()
} else {
    $imgWidth = 200
    $imgHeight = 200
    if ('${printMode}' -eq 'photo_xl') {
        $imgWidth = 300
        $imgHeight = 300
    }
    $canvasHeight = if ('${printMode}' -eq 'photo_xl') { 380 } else { 280 }
    $imgX = [Math]::Round((384 - $imgWidth) / 2)
    $imgY = 60

    $canvas = New-Object System.Drawing.Bitmap(384, $canvasHeight)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear([System.Drawing.Color]::White)
    
    # Caneta de borda com espessura de 8px (2x mais grossa) e Inset por 4px para evitar cortes
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 8)
    $g.DrawRectangle($pen, 4, 4, 375, $canvasHeight - 9)

    $font = New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Bold)
    $brush = [System.Drawing.Brushes]::Black
    $usernameStr = '@${username}'
    $textSize = $g.MeasureString($usernameStr, $font)
    $textX = (384 - $textSize.Width) / 2
    $g.DrawString($usernameStr, $font, $brush, $textX, 20)

    $img = Load-ImageSafely '${cleanInputImg}'
    if ($img -ne $null) {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        
        # Efeito de foto redonda (circular clip)
        $clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $clipPath.AddEllipse($imgX, $imgY, $imgWidth, $imgHeight)
        $oldClip = $g.Clip
        $g.SetClip($clipPath)
        $g.DrawImage($img, $imgX, $imgY, $imgWidth, $imgHeight)
        $g.Clip = $oldClip
        $clipPath.Dispose()
        
        $tempPng = $img.Tag
        $img.Dispose()
        if ($tempPng -and (Test-Path $tempPng)) { Remove-Item $tempPng -Force -ErrorAction SilentlyContinue }
    }
    
    if ('${rotate180}' -eq 'true') {
        $canvas.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone)
    }
    
    $canvas.Save('${cleanOutputImg}', [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    $g.Dispose()
    $pen.Dispose()
    $font.Dispose()
}
`;

    try {
        fs.writeFileSync(tempPs1File, psScript, 'utf-8');
    } catch (errWrite) {
        console.error("\x1b[31m[ERRO]\x1b[0m Erro ao escrever script de composição ps1:", errWrite.message);
        return Promise.reject(errWrite);
    }

    return new Promise((resolve, reject) => {
        exec(`powershell -ExecutionPolicy Bypass -File "${tempPs1File}"`, (err, stdout, stderr) => {
            try { fs.unlinkSync(tempPs1File); } catch(e) {}
            if (err) {
                console.error("\x1b[31m[ERRO]\x1b[0m Erro no PowerShell ao compor quadro:", stderr || stdout);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Auxiliar para compor o teste de impressão com borda
async function composeAndPrintTest(outputImg) {
    const canvasHeight = 150;
    const cleanOutputImg = path.resolve(outputImg).replace(/\\/g, '\\\\');
    const psCommand = `
[void][System.Reflection.Assembly]::LoadWithPartialName('System.Drawing');
$canvas = New-Object System.Drawing.Bitmap(384, ${canvasHeight});
$g = [System.Drawing.Graphics]::FromImage($canvas);
$g.Clear([System.Drawing.Color]::White);
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 4);
$g.DrawRectangle($pen, 0, 0, 383, ${canvasHeight - 1});
$fontTitle = New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Bold);
$fontSub = New-Object System.Drawing.Font('Arial', 11, [System.Drawing.FontStyle]::Regular);
$brush = [System.Drawing.Brushes]::Black;
$title = 'TESTE DE IMPRESSAO';
$sub1 = 'Aplicativo Local Conectado!';
$sub2 = 'Impressora POS-5890U respondendo.';
$sizeTitle = $g.MeasureString($title, $fontTitle);
$sizeSub1 = $g.MeasureString($sub1, $fontSub);
$sizeSub2 = $g.MeasureString($sub2, $fontSub);
$g.DrawString($title, $fontTitle, $brush, ((384 - $sizeTitle.Width)/2), 20);
$g.DrawString($sub1, $fontSub, $brush, ((384 - $sizeSub1.Width)/2), 65);
$g.DrawString($sub2, $fontSub, $brush, ((384 - $sizeSub2.Width)/2), 95);
$canvas.Save('${cleanOutputImg}', [System.Drawing.Imaging.ImageFormat]::Png);
$canvas.Dispose();
$g.Dispose();
$pen.Dispose();
$fontTitle.Dispose();
$fontSub.Dispose();
`.replace(/\n/g, ' ').replace(/\r/g, ' ');

    return new Promise((resolve, reject) => {
        exec(`powershell -Command "${psCommand}"`, (err, stdout, stderr) => {
            if (err) {
                console.error("\x1b[31m[ERRO]\x1b[0m Erro no PowerShell ao compor teste:", stderr || stdout);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Executa a impressão física do presente
async function executePrintJob(username, giftName, printMode = 'text_only', giftIconUrl = '') {
    if (!printer) {
        console.warn("\x1b[33m[AVISO]\x1b[0m Impressora não conectada/configurada.");
        return;
    }
    
    try {
        if (printMode === 'text_only') {
            // Apenas texto -> escrever apenas o nome do usuário
            printer.alignCenter();
            printer.bold(true);
            printer.setTextDoubleHeight();
            printer.setTextDoubleWidth();
            printer.print(`@${username}`);
            printer.bold(false);
            printer.setTextNormal();
        } else {
            // Demais itens "foto" -> borda em torno da impressão com foto + nome de usuário
            const tempDir = getTempDir();
            
            let tempGiftPath = '';
            if (giftIconUrl) {
                tempGiftPath = path.join(tempDir, `gift_${Date.now()}.png`);
                try {
                    await downloadImage(giftIconUrl, tempGiftPath);
                } catch (errImg) {
                    console.error("\x1b[33m[AVISO]\x1b[0m Erro ao baixar imagem do presente:", errImg.message);
                }
            }
            
            const composedPath = path.join(tempDir, `composed_${Date.now()}.png`);
            await composeAndPrintImage(username, tempGiftPath, composedPath, printMode);
            
            printer.alignCenter();
            await printer.printImage(composedPath);
            
            // Agenda remoção dos arquivos temporários
            setTimeout(() => {
                try { if (tempGiftPath) fs.unlinkSync(tempGiftPath); } catch(e) {}
                try { fs.unlinkSync(composedPath); } catch(e) {}
            }, 5000);
        }
        
        // Espaçamento entre as impressões consecutivas (aumentado em 3x, ~6mm)
        printer.newLine();
        printer.newLine();
        printer.newLine();
        
        await printer.execute();
        await sendRawToWindowsPrinter();
        printer.clear();
        console.log(`📠 Cupom impresso para @${username} [Modo: ${printMode}]`);
    } catch (err) {
        console.error("\x1b[31m[ERRO]\x1b[0m Falha na impressão:", err.message);
    }
}

// Teste de impressão sequencial de todos os formatos (Texto, P, G, GG)
async function executeTestPrint() {
    if (!printer) {
        console.warn("\x1b[33m[AVISO]\x1b[0m Impressora não configurada. Por favor, defina a interface no painel primeiro.");
        return;
    }
    try {
        const tempDir = getTempDir();
        
        // Vamos baixar a imagem de teste da rosa a partir do backend local/produção
        const roseUrl = `${BACKEND_URL}/gifts/Rose-5655.png`;
        const tempGiftPath = path.join(tempDir, `test_rose.png`);
        
        console.log(`\x1b[36m[INFO]\x1b[0m Baixando imagem da Rosa para a bateria de testes de impressão...`);
        try {
            await downloadImage(roseUrl, tempGiftPath);
        } catch (e) {
            // Se falhar o download (ex: offline), tentamos usar o arquivo local do repositório se existir
            const localFallback = path.join(__dirname, '../backend-engine/public/gifts/Rose-5655.png');
            if (fs.existsSync(localFallback)) {
                fs.copyFileSync(localFallback, tempGiftPath);
            } else {
                throw new Error("Não foi possível obter a imagem da Rosa para o teste.");
            }
        }

        console.log("📠 Iniciando bateria de testes sequenciais (Texto, P, G, GG)...");

        // 1. APENAS TEXTO
        printer.alignCenter();
        printer.bold(true);
        printer.setTextDoubleHeight();
        printer.setTextDoubleWidth();
        printer.print(`@TESTE_TEXTO`);
        printer.bold(false);
        printer.setTextNormal();
        printer.newLine();
        printer.newLine();
        printer.newLine();
        await printer.execute();
        await sendRawToWindowsPrinter();
        printer.clear();
        await new Promise(r => setTimeout(r, 800)); // Pausa para a impressora processar

        // 2. FOTO P (Pequena)
        const composedP = path.join(tempDir, `composed_p_${Date.now()}.png`);
        await composeAndPrintImage("TESTE_PEQUENO", tempGiftPath, composedP, 'photo_s');
        printer.alignCenter();
        await printer.printImage(composedP);
        printer.newLine();
        printer.newLine();
        printer.newLine();
        await printer.execute();
        await sendRawToWindowsPrinter();
        printer.clear();
        await new Promise(r => setTimeout(r, 800));

        // 3. FOTO G (Grande)
        const composedG = path.join(tempDir, `composed_g_${Date.now()}.png`);
        await composeAndPrintImage("TESTE_GRANDE", tempGiftPath, composedG, 'photo_l');
        printer.alignCenter();
        await printer.printImage(composedG);
        printer.newLine();
        printer.newLine();
        printer.newLine();
        await printer.execute();
        await sendRawToWindowsPrinter();
        printer.clear();
        await new Promise(r => setTimeout(r, 800));

        // 4. FOTO GG (Extra Grande)
        const composedGG = path.join(tempDir, `composed_gg_${Date.now()}.png`);
        await composeAndPrintImage("TESTE_EXTRA_GG", tempGiftPath, composedGG, 'photo_xl');
        printer.alignCenter();
        await printer.printImage(composedGG);
        printer.newLine();
        printer.newLine();
        printer.newLine();
        await printer.execute();
        await sendRawToWindowsPrinter();
        printer.clear();

        // Agenda remoção de arquivos temporários
        setTimeout(() => {
            try { fs.unlinkSync(tempGiftPath); } catch(e) {}
            try { fs.unlinkSync(composedP); } catch(e) {}
            try { fs.unlinkSync(composedG); } catch(e) {}
            try { fs.unlinkSync(composedGG); } catch(e) {}
        }, 5000);

        console.log("📠 Bateria de testes de impressão concluída!");
    } catch (err) {
        console.error("\x1b[31m[ERRO]\x1b[0m Erro no teste de impressão sequencial:", err.message);
    }
}

// Fila de Impressão sequencial para evitar concorrência no arquivo de buffer e na execução
const printQueue = [];
let isPrinting = false;

function addToPrintQueue(fn) {
    printQueue.push(fn);
    processPrintQueue();
}

async function processPrintQueue() {
    if (isPrinting) return;
    if (printQueue.length === 0) return;

    isPrinting = true;
    const currentJob = printQueue.shift();
    try {
        await currentJob();
    } catch (err) {
        console.error("\x1b[31m[ERRO]\x1b[0m Erro ao processar trabalho de impressão na fila:", err.message);
    } finally {
        // Pausa curta de 200ms para garantir a liberação física de spooler/arquivos
        setTimeout(() => {
            isPrinting = false;
            processPrintQueue();
        }, 200);
    }
}

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

    socket.on("settings-updated", (data) => {
        liveMode = data.liveMode || 'game';
        printerSettings = data.printerSettings || {};
        console.log(`[Config] Modo de Live atualizado para: ${liveMode === 'printer' ? 'Impressão Térmica' : 'Gamer'}`);
        if (liveMode === 'printer') {
            initPrinter(printerSettings);
        }
    });

    socket.on("test-print", () => {
        console.log("📠 Sinal de teste de impressão recebido...");
        addToPrintQueue(() => executeTestPrint());
    });

    socket.on("tiktok-connected", (data) => {
        console.log(`[TikTok] \x1b[32m[OK]\x1b[0m ${data.message} (@${data.username})`);
        console.log(`Aguardando eventos da SUA live...`);
    });

    socket.on("tiktok-error", (data) => {
        console.error(`[TikTok] \x1b[31m[ERRO]\x1b[0m Erro: ${data.message}`);
    });

    socket.on("tiktok-disconnected", (data) => {
        console.warn(`[TikTok] \x1b[33m[AVISO]\x1b[0m ${data.message}`);
    });

    let hasTrialExpired = false;
    socket.on("trial-expired", (data) => {
        if (hasTrialExpired) return;
        hasTrialExpired = true;
        console.log(`\n======================================`);
        console.log(`\x1b[31m[ERRO]\x1b[0m ATENÇÃO: ${data.message}`);
        console.log(`Pressione qualquer tecla para abrir a tela de Upgrade...`);
        console.log(`======================================\n`);
        
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.once('data', (key) => {
                if (key.toString() === '\u0003') {
                    process.exit();
                }
                console.log("Abrindo navegador...");
                exec(`start ${FRONTEND_URL}/dashboard/subscription`);
                process.stdin.setRawMode(false);
                process.stdin.pause();
            });
        } else {
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
                console.log(`\x1b[36m[INFO]\x1b[0m Spam evitado: Regra para '${value}' está em tempo de recarga.`);
                continue;
            }
            cooldowns.set(cooldownKey, now);

            if (rule.actionKeypress) {
                console.log(`⚡ Regra Encontrada: ${value} -> Pressionar '${rule.actionKeypress}'`);
                await executeAction(rule.actionKeypress);
            }
            if (rule.actionSound) {
                console.log(`[AUDIO] Regra Encontrada: ${value} -> Áudio disparado no Widget (OBS)`);
            }
            if (rule.actionVideo) {
                console.log(`[VIDEO] Regra Encontrada: ${value} -> Vídeo disparado no Widget (OBS)`);
            }
        }
    };

    socket.on("gift-received", (data) => {
        // Ignora pacotes intermediários de combo de presentes (só executa no fim do combo)
        if (data.repeatEnd === false) {
            return;
        }
        console.log(`\n\x1b[35m[PRESENTE]\x1b[0m PRESENTE: ${data.giftName} (de ${data.username})`);
        if (liveMode === 'printer') {
            const rule = userRules.find(r => r.triggerType === 'gift' && r.triggerValue.toLowerCase() === data.giftName.toLowerCase());
            const printMode = rule ? rule.actionPrintMode : 'text_only';
            addToPrintQueue(() => executePrintJob(data.username, data.giftName, printMode, data.profilePictureUrl || data.giftIconUrl));
        } else {
            processRule('gift', data.giftName);
        }
    });

    socket.on("follow", (data) => {
        console.log(`\n\x1b[36m[SEGUIDOR]\x1b[0m NOVO SEGUIDOR: ${data.username}`);
        if (liveMode === 'printer') {
            const rule = userRules.find(r => r.triggerType === 'follow');
            const printMode = rule ? rule.actionPrintMode : 'text_only';
            addToPrintQueue(() => executePrintJob(data.username, 'Seguidor', printMode, data.profilePictureUrl));
        } else {
            processRule('follow', 'Novo Seguidor');
        }
    });
    
    socket.on("like", async (data) => {
        console.log(`\n\x1b[31m[CURTIDA]\x1b[0m CURTIDA: ${data.username}`);
        if (liveMode === 'printer') {
            // Normalmente curtida não imprime
        } else {
            await processRule('like', 'Curtida');
        }
    });

    socket.on("share", (data) => {
        console.log(`\n\x1b[34m[COMPARTILHOU]\x1b[0m COMPARTILHAMENTO: ${data.username}`);
        if (liveMode === 'printer') {
            const rule = userRules.find(r => r.triggerType === 'share');
            const printMode = rule ? rule.actionPrintMode : 'text_only';
            addToPrintQueue(() => executePrintJob(data.username, 'Compartilhou a Live', printMode, data.profilePictureUrl));
        } else {
            processRule('share', 'Compartilhamento');
        }
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
    
    const formatted = actionString.trim().toUpperCase();
    let targetKey = null;
    
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
        targetKey = Key[formatted];
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


