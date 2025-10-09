# 🎬 Jellyseerr WhatsApp Requester

A **WhatsApp bot** that lets you search and request **movies or TV series** directly from WhatsApp.
It integrates seamlessly with [Jellyseerr](https://github.com/Fallenbagel/jellyseerr) so you and your friends can easily request media.

---

## ✨ Features

* 🔎 Search for Movies or TV Series by name
* 🎥 Provides **IMDb / TVDb links** to confirm results
* 📩 Request Movies or Full Series (all seasons automatically)
* ✅ Requests appear in Jellyseerr for approval (or auto-approved with an Admin API key)
* 🗂 Lightweight and easy to run (Node.js + [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js))

---

## 📦 Requirements

* Node.js (>= 18.x)
* A running Jellyseerr instance
* A WhatsApp account for the bot

---

## ⚙️ Setup & Installation (Manual)

Follow these steps if you want to run the bot **without Docker**.

1. **Clone the repo**

```bash
git clone https://github.com/drlovesan/JellyseerrWhatsAppRequester.git
cd JellyseerrWhatsAppRequester
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure Jellyseerr details**
   Open `index.js` (or your config file) and update with your Jellyseerr server info and API key:

```javascript
const JELLYSEERR_URL = 'http://localhost:5055';
const API_KEY = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
```

⚠️ **Important Notes**:

* If you use an **Admin API Key**, requests are **auto-approved**.
* To require approval, use an API key from a **regular Jellyseerr user**.

---

## 💬 Usage Instructions

Once the bot is running (see Docker or your chosen local runner), interact via WhatsApp.

### Request a movie

```text
!request movie Inception
```

### Request a series (all seasons will be requested)

```text
!request series Breaking Bad
```

### Example bot reply

```
Found: Breaking Bad (2008)
IMDb: https://www.imdb.com/title/tt0903747/

✅ Request sent to Jellyseerr
```

---

## 🛠️ Configuration

You can configure the bot using **environment variables**:

| Variable                | Description                                                     | Default / Example                   |
| ----------------------- | --------------------------------------------------------------- | ----------------------------------- |
| `JELLYSEERR_URL`        | URL of your Jellyseerr instance                                 | `http://jellyseerr:5055`            |
| `API_KEY`               | Jellyseerr API key (admin or user)                              | `YOUR_API_KEY_HERE`                 |
| `CHAT_WHITELIST`        | Comma-separated list of allowed WhatsApp chat names (no spaces) | `chat1,chat2`                       |
| `CUSTOM_SESSION_PATH`   | Path to persist WhatsApp session (QR login data)                | `./config`                          |
| `ENABLE_EVENT_MESSAGES` | Enable/disable bot event messages (e.g., "Bot Ready")           | `true` (remove variable to disable) |

---

## 🐳 Running with Docker

### Build the Docker image

```bash
docker build -t whatsappreq .
```

### Run the container

```bash
docker run -d \
  --name whatsappreq \
  -e JELLYSEERR_URL=http://localhost:5055 \
  -e API_KEY=YOUR_API_KEY_HERE \
  -e CHAT_WHITELIST=chat1,chat2 \
  -v ./volumes/whatsAppReq/config:/app/config \
  whatsappreq
```

> On windows you may need to use backslashes for the first section eg. `.\volumes\whatsAppReq\config:/app/config`

> The container mounts `./volumes/whatsAppReq/config` so session data (QR auth) is persisted.

---

## 🐙 Running with Docker Compose

Save this as `docker-compose.yml` in the project root (example):

```yaml
version: "3.8"

services:
  jellyseerr:
    image: fallenbagel/jellyseerr:latest
    container_name: jellyseerr
    environment:
      - LOG_LEVEL=debug
      - TZ=Europe/Paris
      - PORT=5055 # optional
    ports:
      - 5055:5055
    volumes:
      - ./volumes/jellyseerr/config:/app/config
    healthcheck:
      test: wget --no-verbose --tries=1 --spider http://localhost:5055/api/v1/status || exit 1
      start_period: 20s
      timeout: 3s
      interval: 15s
      retries: 3
    restart: unless-stopped

  whatsappreq:
    container_name: whatsAppReq
    build: .
    environment:
      - JELLYSEERR_URL=http://jellyseerr:5055
      - API_KEY=YOUR_API_KEY_HERE
      - CHAT_WHITELIST=chat1,chat2 # comma-separated list, no spaces
      - CUSTOM_SESSION_PATH=./config # optional, for session persistence
      - ENABLE_EVENT_MESSAGES=true # optional, remove to disable bot event messages
    volumes:
      - ./volumes/whatsAppReq/config:/app/config
    restart: unless-stopped
```

Start everything:

```bash
docker compose up -d
```

Access logs for the WhatsApp bot container:

```bash
docker logs -f whatsAppReq
```

---

## 🚀 Roadmap

* Add download status feedback
* Jellyfin integration for request tracking
* Multi-user role-based control

---

## 🛠️ Credits

Developed fully using ChatGPT by **Shahid Akram**
