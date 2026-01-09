const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    Browsers
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load chatbot setting
const { chatbot } = require('./setting.js');

// Configuration & Global Variables
global.chatbot = chatbot; // Now controlled by setting.js
let chatData = {};
let lastTextTime = 0;
const messageDelay = 3000;

// Track active typing indicators
const activeTyping = new Map();

// Load Chat History
if (fs.existsSync('./chatData.json')) {
    chatData = JSON.parse(fs.readFileSync('./chatData.json'));
}

function saveChat() {
    fs.writeFileSync('./chatData.json', JSON.stringify(chatData, null, 2));
}

// Health check endpoint for Render
function startHealthCheck() {
    const express = require('express');
    const app = express();
    const PORT = process.env.PORT || 3000;
    
    app.use(express.json());
    
    // Health check endpoint
    app.get('/', (req, res) => {
        res.status(200).json({
            status: 'online',
            service: 'WhatsApp Bot',
            chatbot_enabled: global.chatbot,
            timestamp: new Date().toISOString()
        });
    });
    
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'healthy' });
    });
    
    // Simple status endpoint
    app.get('/status', (req, res) => {
        res.json({
            status: 'running',
            chatbot: global.chatbot,
            uptime: process.uptime()
        });
    });
    
    app.listen(PORT, () => {
        console.log(`✅ Health check server running on port ${PORT}`);
    });
}

async function startBot() {
    console.log('🚀 Starting WhatsApp Bot on Render...');
    
    // Start health check server
    startHealthCheck();
    
    // --- SESSION HANDLER FOR RENDER ---
    const sessionPath = './session';
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    // Check if SESSION_ID exists in environment variables
    if (process.env.SESSION_ID) {
        try {
            let rawData = process.env.SESSION_ID;
            
            // Handle different formats
            if (rawData.includes(';;;')) {
                rawData = rawData.split(';;;')[1];
            }
            
            // Clean up the data (remove any whitespace or newlines)
            rawData = rawData.trim();
            
            // Decode base64 and write to file
            const credsJson = Buffer.from(rawData, 'base64').toString('utf-8');
            
            // Validate JSON
            JSON.parse(credsJson); // This will throw if invalid
            
            fs.writeFileSync(path.join(sessionPath, 'creds.json'), credsJson);
            console.log("✅ Session credentials successfully restored from Environment Variable.");
        } catch (e) {
            console.error("❌ Error restoring session:", e.message);
            console.log("⚠️ Will use QR code authentication instead...");
        }
    } else {
        console.log("ℹ️ SESSION_ID environment variable not found. QR authentication required.");
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const IconicTechInc = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, 
        auth: state,
        browser: Browsers.macOS("Desktop"),
        markOnlineOnConnect: true,
        // Add connection configs for Render
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        emitOwnEvents: true,
        defaultQueryTimeoutMs: 60000,
    });

    IconicTechInc.ev.on('creds.update', saveCreds);

    IconicTechInc.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📱 QR Code received. Scan with WhatsApp.');
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect.error instanceof Boom 
                ? lastDisconnect.error.output.statusCode 
                : null;
            
            console.log('🔌 Connection closed. Status code:', statusCode);
            
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
                console.log('🔄 Attempting to reconnect in 5 seconds...');
                setTimeout(startBot, 5000);
            } else {
                console.log('❌ Logged out. Please scan QR code again.');
            }
        } else if (connection === 'open') {
            console.log('✅ Silentbyte AI is online and connected!');
            console.log(`🤖 Chatbot mode: ${global.chatbot ? 'ENABLED' : 'DISABLED'}`);
            
            // Send a message to owner if configured
            if (process.env.OWNER_NUMBER) {
                setTimeout(async () => {
                    try {
                        await IconicTechInc.sendMessage(
                            `${process.env.OWNER_NUMBER}@s.whatsapp.net`,
                            { text: '🤖 Bot is now online on Render!' }
                        );
                    } catch (error) {
                        console.log('Could not send startup message to owner');
                    }
                }, 3000);
            }
        }
    });

    // Handle message acknowledgments (ticks)
    IconicTechInc.ev.on('messages.update', async (messageUpdate) => {
        for (const update of messageUpdate) {
            if (update.update?.status === 'READ') {
                console.log(`✅ Message read: ${update.key.id}`);
            } else if (update.update?.status === 'DELIVERED') {
                console.log(`📨 Message delivered: ${update.key.id}`);
            }
        }
    });

    // Function to show typing indicator
    async function showTyping(jid, duration = 10000) {
        try {
            await IconicTechInc.sendPresenceUpdate('composing', jid);
            activeTyping.set(jid, true);
            
            setTimeout(async () => {
                if (activeTyping.get(jid)) {
                    await hideTyping(jid);
                }
            }, duration);
        } catch (error) {
            console.error('Error showing typing:', error);
        }
    }

    // Function to hide typing indicator
    async function hideTyping(jid) {
        try {
            await IconicTechInc.sendPresenceUpdate('paused', jid);
            activeTyping.delete(jid);
        } catch (error) {
            console.error('Error hiding typing:', error);
        }
    }

    IconicTechInc.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const userId = m.key.remoteJid;
            const isGroup = userId.endsWith('@g.us');
            
            // Send read receipt
            await IconicTechInc.readMessages([m.key]);
            
            // Check if chatbot is enabled
            if (!isGroup && global.chatbot) {
                const currentTime = Date.now();
                if (currentTime - lastTextTime < messageDelay) return;

                const text = m.message.conversation || 
                            m.message.extendedTextMessage?.text ||
                            m.message.imageMessage?.caption ||
                            '';

                if (!text.trim()) return;

                if (!chatData[userId]) chatData[userId] = [];
                chatData[userId].push({ role: 'user', text: text.trim() });
                saveChat();

                // Show typing indicator
                await showTyping(userId, 30000);
                
                await IconicTechInc.sendMessage(userId, { react: { text: '⌨️', key: m.key } });

                const context = chatData[userId]
                    .slice(-10)
                    .map(e => `${e.role === 'user' ? 'User' : 'AI'}: ${e.text}`)
                    .join('\n');

                const response = await axios.get('https://apiskeith.vercel.app/ai/grok', {
                    params: {
                        q: `You are Silentbyte ai, a helpful and professional AI chatbot developed by Iconic Tech. Always reply normally in plain, casual language. 
**About You (Share Only When Relevant):**
- Developer: iconic tech (he loves his bots!) and his number +263 78 611 5435
- Part of Codewave Unit Force
- Other bots: Silentbyte ai and more
- Repository: https://github.com/iconictech-dev/Queen-Ruva-AI-Beta
- Deploy link: https://bot-hosting.net/?aff=1336281489364484136
- Features page: https://www.codewave-unit-force.zone.id/features/queen_ruva
- Website: https://www.codewave-unit-force.zone.id
- API: https://apis-codewave-unit-force.zone.id

You are fast, advanced, and full of unique features — but stay chill and let users enjoy chatting with you naturally.

Conversation so far:\n${context}\nUser: ${text}\nAI:`
                    },
                    timeout: 30000 // 30 second timeout
                });

                if (response.data?.status && response.data?.result) {
                    const aiReply = response.data.result;
                    chatData[userId].push({ role: 'bot', text: aiReply });
                    saveChat();

                    await hideTyping(userId);
                    
                    // Simulate typing for longer responses
                    if (aiReply.length > 100) {
                        await showTyping(userId, 2000);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        await hideTyping(userId);
                    }

                    const sentMessage = await IconicTechInc.sendMessage(
                        userId, 
                        { text: `${aiReply}` }, 
                        { quoted: m }
                    );

                    console.log(`📤 Message sent with ID: ${sentMessage.key.id}`);
                    lastTextTime = currentTime;
                } else {
                    await hideTyping(userId);
                    await IconicTechInc.sendMessage(
                        userId,
                        { text: "Sorry, I'm having trouble processing your request right now. Please try again." },
                        { quoted: m }
                    );
                }
            } else if (!global.chatbot) {
                console.log('Chatbot is disabled. No response sent.');
                // Optional: notify user that chatbot is disabled
                // await IconicTechInc.sendMessage(userId, { 
                //     text: "🤖 Chatbot is currently disabled. I won't be able to respond to your messages." 
                // });
            }
        } catch (error) {
            console.error('Chatbot error:', error);
            const m = messages[0];
            if (m && m.key.remoteJid) {
                await hideTyping(m.key.remoteJid).catch(() => {});
            }
        }
    });

    // Graceful shutdown handler
    process.on('SIGTERM', async () => {
        console.log('🔄 SIGTERM received. Closing connections gracefully...');
        try {
            // Send offline presence
            await IconicTechInc.sendPresenceUpdate('unavailable');
            console.log('✅ Bot shutdown gracefully');
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    });

    process.on('SIGINT', async () => {
        console.log('🔄 SIGINT received. Shutting down...');
        process.exit(0);
    });
}

// Start the bot with error handling
startBot().catch(error => {
    console.error('Failed to start bot:', error);
    process.exit(1);
});