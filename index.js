const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
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
global.chatbot = chatbot;
let chatData = {};
let lastTextTime = 0;
const messageDelay = 3000;

// Track active typing indicators
const activeTyping = new Map();

// Load Chat History
const chatDataPath = path.join(__dirname, 'chatData.json');
if (fs.existsSync(chatDataPath)) {
    try {
        chatData = JSON.parse(fs.readFileSync(chatDataPath, 'utf8'));
    } catch (e) {
        console.error('Error loading chat data:', e);
    }
}

function saveChat() {
    try {
        fs.writeFileSync(chatDataPath, JSON.stringify(chatData, null, 2));
    } catch (e) {
        console.error('Error saving chat data:', e);
    }
}

// Keep Render from sleeping
function keepAlive() {
    // Ping self every 5 minutes to prevent idle timeout
    setInterval(() => {
        console.log('🔄 Keep-alive ping at:', new Date().toISOString());
    }, 5 * 60 * 1000);
}

async function startBot() {
    console.log('🚀 Starting WhatsApp Bot...');
    
    // --- SESSION HANDLER FOR RENDER ---
    const sessionPath = path.join(__dirname, 'session');
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    // Check if SESSION_ID exists in environment variables
    if (process.env.SESSION_ID) {
        try {
            const credsPath = path.join(sessionPath, 'creds.json');
            if (!fs.existsSync(credsPath)) {
                let sessionData = process.env.SESSION_ID;
                
                // Remove prefix if it exists
                if (sessionData.includes(';;;')) {
                    sessionData = sessionData.split(';;;')[1];
                }
                
                // Clean the string (remove any whitespace or newlines)
                sessionData = sessionData.trim();
                
                // Check if it's base64
                if (/^[A-Za-z0-9+/=]+$/.test(sessionData)) {
                    const credsJson = Buffer.from(sessionData, 'base64').toString('utf-8');
                    fs.writeFileSync(credsPath, credsJson);
                    console.log("✅ Session credentials restored from SESSION_ID.");
                } else {
                    // Assume it's already JSON
                    fs.writeFileSync(credsPath, sessionData);
                    console.log("✅ Session credentials restored as JSON.");
                }
            }
        } catch (e) {
            console.error("❌ Error restoring session:", e.message);
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const IconicTechInc = makeWASocket({
        version,
        logger: pino({ level: process.env.NODE_ENV === 'development' ? 'debug' : 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: Browsers.macOS("Desktop"),
        markOnlineOnConnect: true,
        // Additional options for better stability
        emitOwnEvents: true,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
    });

    IconicTechInc.ev.on('creds.update', saveCreds);

    IconicTechInc.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const statusCode = (lastDisconnect.error instanceof Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log(`🔌 Connection closed. Status: ${statusCode || 'unknown'}`);
            console.log(`🔄 Should reconnect: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                // Wait before reconnecting
                await new Promise(resolve => setTimeout(resolve, 5000));
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ Silentbyte AI is online and connected!');
            console.log(`🤖 Chatbot mode: ${global.chatbot ? 'ENABLED' : 'DISABLED'}`);
            console.log(`👤 Logged in as: ${IconicTechInc.user?.name || IconicTechInc.user?.id}`);
            
            // Start keep-alive when connected
            keepAlive();
        }
    });

    // Handle message acknowledgments
    IconicTechInc.ev.on('messages.update', (messageUpdate) => {
        for (const update of messageUpdate) {
            if (update.update?.status === 'READ') {
                console.log(`✅ Message read: ${update.key.id}`);
            } else if (update.update?.status === 'DELIVERED') {
                console.log(`📨 Message delivered: ${update.key.id}`);
            }
        }
    });

    // Typing indicator functions
    async function showTyping(jid, duration = 10000) {
        try {
            if (activeTyping.has(jid)) return;
            
            await IconicTechInc.sendPresenceUpdate('composing', jid);
            activeTyping.set(jid, true);
            
            setTimeout(async () => {
                if (activeTyping.get(jid)) {
                    await hideTyping(jid);
                }
            }, Math.min(duration, 30000)); // Max 30 seconds
        } catch (error) {
            console.error('Error showing typing:', error.message);
        }
    }

    async function hideTyping(jid) {
        try {
            await IconicTechInc.sendPresenceUpdate('paused', jid);
            activeTyping.delete(jid);
        } catch (error) {
            console.error('Error hiding typing:', error.message);
        }
    }

    // Main message handler
    IconicTechInc.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const userId = m.key.remoteJid;
            const isGroup = userId.endsWith('@g.us');
            
            // Send read receipt
            await IconicTechInc.readMessages([m.key]).catch(() => {});
            
            // Only respond to private messages when chatbot is enabled
            if (!isGroup && global.chatbot) {
                const currentTime = Date.now();
                if (currentTime - lastTextTime < messageDelay) {
                    console.log('⏳ Skipping due to rate limit');
                    return;
                }

                const text = m.message.conversation || 
                            m.message.extendedTextMessage?.text ||
                            m.message.imageMessage?.caption ||
                            '';
                
                if (!text.trim()) {
                    await IconicTechInc.sendMessage(userId, { 
                        text: "I currently only support text messages. Please send a text message." 
                    });
                    return;
                }

                console.log(`📩 Message from ${userId}: ${text.substring(0, 50)}...`);

                // Initialize chat history
                if (!chatData[userId]) chatData[userId] = [];
                chatData[userId].push({ role: 'user', text, timestamp: new Date().toISOString() });
                saveChat();

                // Show typing indicator
                await showTyping(userId, 30000);
                
                // Add reaction
                await IconicTechInc.sendMessage(userId, { 
                    react: { text: '🤖', key: m.key } 
                }).catch(() => {});

                // Prepare context from last 10 messages
                const context = chatData[userId]
                    .slice(-10)
                    .map(e => `${e.role === 'user' ? 'User' : 'AI'}: ${e.text}`)
                    .join('\n');

                // Call AI API
                try {
                    const response = await axios.get('https://apiskeith.vercel.app/ai/grok', {
                        params: {
                            q: `You are Silentbyte AI, a helpful and professional AI chatbot developed by Iconic Tech. Always reply normally in plain, casual language.
**About You (Share Only When Relevant):**
- Developer: Iconic Tech (he loves his bots!) and his number +263 78 611 5435
- Part of Codewave Unit Force
- Other bots: Silentbyte AI and more
- Repository: https://github.com/iconictech-dev/Queen-Ruva-AI-Beta
- Deploy link: https://bot-hosting.net/?aff=1336281489364484136
- Features page: https://www.codewave-unit-force.zone.id/features/queen_ruva
- Website: https://www.codewave-unit-force.zone.id
- API: https://apis-codewave-unit-force.zone.id

You are fast, advanced, and full of unique features — but stay chill and let users enjoy chatting with you naturally.

Conversation so far:\n${context}\nUser: ${text}\nAI:`
                        },
                        timeout: 30000
                    });

                    if (response.data?.status && response.data?.result) {
                        const aiReply = response.data.result;
                        
                        // Save to chat history
                        chatData[userId].push({ 
                            role: 'bot', 
                            text: aiReply, 
                            timestamp: new Date().toISOString() 
                        });
                        saveChat();

                        // Hide typing
                        await hideTyping(userId);
                        
                        // Simulate typing for longer responses
                        if (aiReply.length > 100) {
                            await showTyping(userId, 2000);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            await hideTyping(userId);
                        }

                        // Send response
                        await IconicTechInc.sendMessage(
                            userId, 
                            { text: aiReply }, 
                            { quoted: m }
                        );

                        lastTextTime = currentTime;
                    } else {
                        throw new Error('Invalid API response format');
                    }
                } catch (apiError) {
                    await hideTyping(userId);
                    console.error('API Error:', apiError.message);
                    
                    await IconicTechInc.sendMessage(
                        userId, 
                        { 
                            text: "⚠️ Sorry, I'm having trouble connecting to my AI brain right now. Please try again in a moment." 
                        }, 
                        { quoted: m }
                    );
                }
            } else if (!global.chatbot && !isGroup) {
                console.log('Chatbot is disabled. No response sent.');
                await IconicTechInc.sendMessage(userId, { 
                    text: "🤖 Chatbot is currently disabled. I won't be able to respond to your messages." 
                });
            }
        } catch (error) {
            console.error('Unexpected error in message handler:', error);
            
            // Clean up typing indicators on error
            const m = messages[0];
            if (m && m.key.remoteJid) {
                await hideTyping(m.key.remoteJid).catch(() => {});
            }
        }
    });

    // Error handling for other events
    IconicTechInc.ev.on('error', (error) => {
        console.error('Bot error event:', error);
    });

    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
        console.log('🛑 SIGTERM received, shutting down gracefully...');
        await IconicTechInc.ws.close();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('🛑 SIGINT received, shutting down gracefully...');
        await IconicTechInc.ws.close();
        process.exit(0);
    });
}

// Start with error handling
startBot().catch(error => {
    console.error('Failed to start bot:', error);
    process.exit(1);
});

// Export for Render health checks
module.exports = startBot;