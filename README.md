# 🏰 Nightwatch

> *"The night is dark and full of bugs."*

A local AI observability sidecar for developers. Wrap any service with one command — Nightwatch streams its logs, runs AI analysis in the background, and gives you a live dashboard with chat. No changes to your app. No cloud. No database.

---

## Requirements

| Tool | Version |
|------|---------|
| Node.js | **18+** (tested on v20) |
| npm | **8+** (bundled with Node 18) |

> The `open` package (`^9.x`) is ESM-only — Node 18+ is required for it to work correctly.

---

## Quickstart

### 1. Download

```bash
git clone https://github.com/your-username/nightwatch.git
cd nightwatch
```

### 2. Install & link globally

```bash
npm install
npm install -g .
```

This makes the `nightwatch` command available everywhere — you'll use it from inside your own project folders, not from the nightwatch directory.

### 3. Get an API Key

Nightwatch uses [OpenRouter](https://openrouter.ai) to access AI models. Sign up (free tier available) and copy your API key — you'll be prompted for it on first run.

### 4. Start the Dashboard

Open a terminal and run:

```bash
nightwatch tower
```

This starts the dashboard at **http://localhost:4000** and opens it in your browser.

### 5. Watch a Service

Open a second terminal, **go to your project folder**, and prefix your normal start command with `nightwatch post --`:

**Node.js**
```bash
nightwatch post -- node server.js
nightwatch post -- node index.js
nightwatch post -- npx ts-node src/index.ts
```

**Python**
```bash
nightwatch post -- python app.py
nightwatch post -- python -m uvicorn main:app --reload
nightwatch post -- gunicorn app:app
```

**Ruby / Rails**
```bash
nightwatch post -- rails server
nightwatch post -- ruby app.rb
```

**Go**
```bash
nightwatch post -- go run main.go
nightwatch post -- ./your-binary
```

**Java / Spring Boot**
```bash
nightwatch post -- java -jar target/app.jar
nightwatch post -- ./mvnw spring-boot:run
nightwatch post -- ./gradlew bootRun
```

**PHP**
```bash
nightwatch post -- php artisan serve
nightwatch post -- php -S localhost:8000
```

**Rust**
```bash
nightwatch post -- cargo run
```

**Any other command**
```bash
nightwatch post -- <your start command here>
```

Your service runs exactly as normal. Nightwatch captures everything it prints.

> On first run you'll be asked for your OpenRouter API key. Paste it and press Enter — it's saved to `~/.devwatch/config.json` and never asked again.

### 6. Use the Dashboard

Open **http://localhost:4000** in your browser.

| Tab | What it shows |
|-----|---------------|
| **Ravens Log** | Live stream of all stdout/stderr from your service |
| **Scrolls** | AI watchman reports — issues, patterns, anomalies detected automatically |
| **Counsel** | Chat with the AI about your logs — it has full context of everything |

Click a service in the left sidebar to select it. The AI runs in the background and writes to Scrolls automatically — no prompting needed.

**Example chat questions:**
- *"Why is /posts slow?"*
- *"What caused that error at 10:44?"*
- *"Are there any N+1 queries?"*

---

## Other Commands

```bash
# List all services currently being watched
nightwatch roster

# Stop watching a service (from its project folder)
nightwatch dismiss

# Stop watching by name
nightwatch dismiss --name backend
```

---

## How It Works

1. `nightwatch post` spawns your service and pipes all output to `~/.devwatch/active/<name>/context.log`
2. The AI engine watches that file, detects errors and patterns, calls OpenRouter, and appends findings to `suggestions.md`
3. The dashboard tails both files over SSE and streams them live to your browser
4. Chat sends your question + the last 100 log lines + all AI findings to the model and streams the response

All data lives in `~/.devwatch/` as plain text files — grep-able, archive-able, no database.

---

## Configuration

Config is stored at `~/.devwatch/config.json`:

```json
{
  "openrouter_key": "sk-or-...",
  "model": "anthropic/claude-sonnet-4-6",
  "sweep_interval": 60,
  "severity_threshold": 6,
  "dashboard_port": 4000
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `model` | `anthropic/claude-sonnet-4-6` | Any model available on OpenRouter |
| `sweep_interval` | `60` | Seconds between scheduled AI sweeps |
| `severity_threshold` | `6` | Only show AI reports rated 6/10 or higher |
| `dashboard_port` | `4000` | Port for the dashboard |

