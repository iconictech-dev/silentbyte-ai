<div align="center">
  <img src="https://i.postimg.cc/SNqN1LSR/file-00000000c00071f4b215d2a40050d224.png" alt="Silentbyte AI Logo" width="110">

  <h1>Silentbyte AI — WhatsApp Chatbot</h1>

  <img src="https://capsule-render.vercel.app/api?type=rect&color=0:FF7A00,49:FF7A00,50:00D4FF,100:00D4FF&height=4&width=700"/>

  <p><b>Made with ❤️ by Iconic Tech</b> · Part of Codewave Unit Force</p>
</div>

<br>

## ⭐ Quick Actions

<p align="center">
  <a href="https://github.com/iconictech-dev/silentbyte-ai"><img src="https://img.shields.io/badge/⭐_Star_Repo-FF7A00?style=for-the-badge&labelColor=0D1117"/></a>
  <a href="https://github.com/iconictech-dev/silentbyte-ai/fork"><img src="https://img.shields.io/badge/🔀_Fork_Repo-00D4FF?style=for-the-badge&labelColor=0D1117"/></a>
  <a href="https://whatsapp.com/channel/0029Vb7H0lTGZNCuwI8A7E0i"><img src="https://img.shields.io/badge/📢_Join_Channel-FF7A00?style=for-the-badge&labelColor=0D1117"/></a>
  <a href="https://render.com/deploy?repo=https://github.com/iconictech-dev/silentbyte-ai"><img src="https://img.shields.io/badge/🚀_Deploy_on_Render-00D4FF?style=for-the-badge&labelColor=0D1117"/></a>
</p>

<br>

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#%EF%B8%8F-configuration)
- [How to Connect Your Number](#-how-to-connect-your-number)
- [How It Works](#-how-it-works)
- [What's New](#-whats-new)
- [Upcoming Features](#-upcoming-features)
- [Support & Contact](#-support--contact)
- [Useful Links](#-useful-links)
- [Contributing](#-contributing)
- [License](#-license)

<br>

## ✨ Features

**Current Features**

| | |
|---|---|
| 🤖 **AI-Powered Chat** | Powered by Grok AI for intelligent conversations |
| 💬 **Natural Language Processing** | Understands context and maintains conversation flow |
| ⏳ **Typing Indicators** | Shows when bot is typing, in real time |
| ✅ **Message Ticks** | Delivery and read status (single/double ticks) |
| 🔄 **Session Management** | Save and restore WhatsApp sessions |
| 💾 **Chat History** | Stores conversation context for better responses |
| ⚡ **Fast Response** | Optimized for quick AI replies |
| 🎨 **Emoji Reactions** | Reacts to messages with relevant emojis |
| 🔧 **Easy Configuration** | Toggle chatbot on/off via settings file |
| 📱 **Multi-Device Support** | Works with the WhatsApp Web protocol |

**Technical Features**

| | |
|---|---|
| 📁 **Multi-file Auth State** | Secure session storage |
| 🔒 **Environment Variable Support** | Easy deployment on cloud platforms |
| 📊 **Chat Data Storage** | JSON-based conversation history |
| ⏰ **Rate Limiting** | Prevents spam with message delays |
| 🐛 **Error Handling** | Comprehensive error catching and logging |
| ☁️ **Cloud Ready** | Deploy on Render, Railway, Heroku, etc. |
| 🔐 **Session Encryption** | Secure credential storage |

<br>

## 🚀 Quick Start

**One-Click Deploy**

<p align="center">
  <a href="https://render.com/deploy?repo=https://github.com/iconictech-dev/silentbyte-ai"><img src="https://img.shields.io/badge/Deploy_on-Render-FF7A00?style=for-the-badge&labelColor=0D1117"/></a>
  <a href="https://railway.app/template?template=https://github.com/iconictech-dev/silentbyte-ai"><img src="https://img.shields.io/badge/Deploy_on-Railway-00D4FF?style=for-the-badge&labelColor=0D1117"/></a>
  <a href="https://app.koyeb.com/deploy?type=git&repository=https://github.com/iconictech-dev/silentbyte-ai"><img src="https://img.shields.io/badge/Deploy_on-Koyeb-FF7A00?style=for-the-badge&labelColor=0D1117"/></a>
</p>

**Recommended Hosting**

🚀 **Best for bots:** [Bot Hosting Network](https://bot-hosting.net/?aff=1336281489364484136) — specialized WhatsApp bot hosting

**Prerequisites**

- Node.js v16 or higher
- npm or yarn
- A WhatsApp account (phone number)
- Internet connection

<br>

## 🔧 Installation

**Method 1: Local Installation**

```bash
# Clone the repository
git clone https://github.com/iconictech-dev/silentbyte-ai.git
cd silentbyte-ai

# Install dependencies
npm install

# Create configuration file
echo 'module.exports = { chatbot: true };' > setting.js

# Start the bot
npm start
