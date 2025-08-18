# JellyseerrWhatsAppRequester
A Bot for requesting media via WhatsApp and adding requests to Jellyseerr.

GitHub README (for your repo)
# 🎬 WhatsApp Jellyseerr Request Bot

This is a **WhatsApp bot** that lets you search and request **movies or TV series** directly from WhatsApp.  
It integrates with [Jellyseerr](https://github.com/Fallenbagel/jellyseerr) so you and your friends can easily request media.

---

## ✨ Features
- 🔎 Search for Movies or TV Series by name  
- 🎥 Provides **IMDb / TVDb links** to confirm the result  
- 📩 Request Movies or Full Series (all seasons automatically)  
- ✅ Requests appear in Jellyseerr for approval (unless you use an admin API key)  
- 🗂 Lightweight and easy to run (Node.js + whatsapp-web.js)

---

## 📦 Requirements
- Node.js (>= 18.x)  
- Jellyseerr server running and accessible  
- WhatsApp account for the bot  

---

## ⚙️ Setup & Installation

1. Clone this repo:
   ```bash
   git clone https://github.com/drlovesan/JellyseerrWhatsAppRequester.git
   cd JellyseerrWhatsAppRequester


Install dependencies:

npm install


create a .env file in same folder and update values:

JELLYSEERR_URL=http://your-jellyseerr-server:5055
JELLYSEERR_API_KEY=your_non_admin_api_key


⚠️ Important:

If you use an Admin API Key, requests are auto-approved.

To require approval, create a normal Jellyseerr user and use that API key here.

Start the bot:

node bot.js

Scan the QR code with your WhatsApp to connect.

💬 Usage

Request a movie:

!request movie Inception


Request a series (all seasons will be requested):

!request series Breaking Bad


Example reply:

Found: Breaking Bad (2008)
IMDb: https://www.imdb.com/title/tt0903747/

✅ Request sent to Jellyseerr

🚀 Roadmap

Add download status feedback

Add Jellyfin integration for request tracking

Multi-user role-based control
