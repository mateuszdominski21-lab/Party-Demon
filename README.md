# 🎮 Discord Mini Games Bot

Bot z 6 mini grami dla Discord, napisany w Node.js + discord.js v14.

## 🎯 Dostępne Gry

| Gra | Opis |
|-----|------|
| 🔢 **Quiz Matematyczny** | Pytania z rosnącym poziomem trudności, seria i punkty za szybkość |
| 🧠 **Zapamiętaj Sekwencję** | Pokaż sekwencję emoji, zapamiętaj i kliknij w tej samej kolejności |
| 🚪 **Wybierz Drzwi** | Losowa gra — nagroda, nic lub pułapka. Zbuduj serię dla jackpota! |
| ⚡ **Reflex** | Kliknij zanim zniknie! Fałszywe przyciski i malejący czas |
| 🎭 **Zgadnij z Emoji** | Filmy, gry i memy — punkty za szybkość odpowiedzi |
| 🧨 **Nie Klikaj Bomby!** | Znajdź bezpieczny przycisk, unikaj bomb. System żyć! |

## 🚀 Instalacja

### 1. Wymagania
- Node.js v18+
- Konto Discord Developer

### 2. Stwórz bota Discord
1. Wejdź na [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → nadaj nazwę
3. W zakładce **Bot** → **Reset Token** → skopiuj token
4. W **OAuth2 → URL Generator**: zaznacz `bot` + `applications.commands`
5. Uprawnienia bota: `Send Messages`, `Use Slash Commands`, `Read Message History`, `Add Reactions`
6. Wygeneruj link i zaproś bota na serwer

### 3. Konfiguracja
```bash
# Sklonuj repozytorium
git clone https://github.com/twoj-nick/discord-minigames
cd discord-minigames

# Zainstaluj zależności
npm install

# Skopiuj plik konfiguracyjny
cp .env.example .env
```

Edytuj `.env`:
```env
DISCORD_TOKEN=twoj_token_bota
CLIENT_ID=id_aplikacji_ze_developer_portal
GUILD_ID=id_serwera_do_testow  # opcjonalne - usuń dla globalnych komend
```

### 4. Zarejestruj komendy
```bash
# Najpierw zawsze uruchom deploy!
npm run deploy
```

### 5. Uruchom bota
```bash
npm start
# lub w trybie deweloperskim (auto-restart):
npm run dev
```

## 🌐 Hosting

### Railway (zalecane — darmowy tier)
1. Wrzuć kod na GitHub
2. Wejdź na [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Dodaj zmienne środowiskowe w Settings → Variables
4. Railway automatycznie uruchomi `npm start`

### Render
1. Nowy serwis → Web Service → połącz GitHub
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Dodaj Environment Variables

### Heroku
```bash
heroku create twoj-bot-name
heroku config:set DISCORD_TOKEN=xxx CLIENT_ID=xxx
git push heroku main
```

### VPS / Własny serwer
```bash
# Zainstaluj PM2 dla auto-restartu
npm install -g pm2
pm2 start src/index.js --name "discord-minigames"
pm2 save
pm2 startup
```

## 📁 Struktura projektu

```
discord-minigames/
├── src/
│   ├── index.js              # Główny plik bota
│   ├── deploy-commands.js    # Rejestracja komend
│   ├── commands/
│   │   └── graj.js           # Komenda /graj (menu gier)
│   └── games/
│       ├── quiz.js           # Quiz matematyczny
│       ├── memory.js         # Zapamiętaj sekwencję
│       ├── doors.js          # Wybierz drzwi
│       ├── reflex.js         # Test refleksów
│       ├── emoji-guess.js    # Zgadnij z emoji
│       └── bomb.js           # Nie klikaj bomby
├── .env.example
├── .gitignore
└── package.json
```

## 🛠️ Dodawanie nowych pytań (Emoji Guess)

Edytuj `src/games/emoji-guess.js`, sekcja `CATEGORIES`:

```js
filmy: [
  { emoji: '🦸 🌍 💥', answer: 'Avengers', hint: 'Marvel epickie' },
  // ...
],
```

## 📝 Komendy

| Komenda | Opis |
|---------|------|
| `/graj` | Otwiera menu wyboru gry |
