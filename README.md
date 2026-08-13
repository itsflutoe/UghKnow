# Cyber UNO - Real-Time Multiplayer UNO

A fully functional real-time multiplayer UNO game with cyberpunk aesthetic, built for GitHub Pages + Supabase free tier.

**Live Demo Structure**: Deploy frontend to GitHub Pages, connect to your own Supabase project.

## Features

- Username/password authentication (via Supabase Auth)
- Random matchmaking (2/4/6 players)
- Private rooms with shareable codes & links
- Full standard UNO rules + house rules (stacking, jump-in, Seven-O, etc.)
- Bot opponents (Easy / Normal / Hard)
- Real-time synchronization via Supabase Realtime
- Mobile-first responsive cyberpunk UI
- Reconnect support
- UNO calling & penalties
- Game chat (basic)

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Supabase (Auth + PostgreSQL + Realtime + RLS)
- **Hosting**: GitHub Pages (static)
- **No custom server required**

## Prerequisites

- Free Supabase account (https://supabase.com)
- Free GitHub account
- Modern browser

---

## 1. Create Supabase Project

1. Go to https://supabase.com and sign in / sign up.
2. Click **New Project**.
3. Choose organization, name it `cyber-uno` (or anything).
4. Set a strong database password (save it!).
5. Choose a region close to you.
6. Click **Create new project**. Wait ~2 minutes.

7. Once ready, go to **Project Settings → API**.
   - Copy the **Project URL**
   - Copy the **anon public** key
   - **NEVER** copy or use the `service_role` key in frontend code.

---

## 2. Configure Authentication

1. In Supabase Dashboard → **Authentication → Providers**.
2. Ensure **Email** is enabled.
3. Go to **Authentication → Settings** (or URL Configuration).
4. **Disable "Confirm email"** (important for username-style signup without real emails).
5. Under **Auth → Providers → Email**, turn off "Confirm email" if the toggle exists.
6. Optional: Set Site URL to your future GitHub Pages URL (e.g. `https://yourusername.github.io/uno-cyber`).

---

## 3. Create Database Tables & Policies

1. Go to **SQL Editor** in Supabase.
2. Create a new query.
3. Copy the **entire contents** of `supabase/schema.sql` (provided in this repo) and paste it.
4. Click **Run**.

This creates:

- `profiles`
- `rooms`
- `room_players`
- `games`
- `game_players`
- `matchmaking_queue`
- Necessary indexes, triggers, RLS policies, and helper functions.

5. Enable Realtime:
   - Go to **Database → Replication** (or Realtime section).
   - Enable replication for tables: `rooms`, `room_players`, `games`, `game_players`, `matchmaking_queue`, `profiles` (if needed).

Or run in SQL Editor:

```sql
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_players;
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table game_players;
alter publication supabase_realtime add table matchmaking_queue;
```

---

## 4. Configure Frontend

1. Open `js/config.js`.
2. Replace the placeholders:

```js
const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY";
```

3. Save the file.

---

## 5. Local Testing

You can open the HTML files directly, but for best results use a simple local server:

```bash
# Python
python -m http.server 8000

# or Node
npx serve .
```

Then open http://localhost:8000

---

## 6. Deploy to GitHub Pages

1. Create a new GitHub repository named `uno-cyber` (or any name).
2. Upload **all files** from this folder to the repository root (or a `/docs` folder if preferred).
3. Go to repository **Settings → Pages**.
4. Under **Source**, select **Deploy from a branch**.
5. Branch: `main` (or `master`), folder: `/ (root)`.
6. Save.
7. Wait 1-2 minutes. Your site will be at:
   `https://YOUR_USERNAME.github.io/uno-cyber/`

8. Update Supabase Auth Site URL and Redirect URLs to match your GitHub Pages URL.

---

## 7. How to Play / Test Multiplayer

### Account
1. Open the site → Register with a unique username + password.
2. Login.

### Random Matchmaking
1. Click **Play → Random Players**.
2. Choose 2 / 4 / 6 players.
3. Wait for others. Open the site in multiple browsers / incognito / devices and join the same queue size.
4. Once enough players are found, a room is created and game starts automatically.

### Friends
1. **Create Room** → choose player count → share the room code or invitation link.
2. Friend opens link or enters code → joins lobby.
3. Host clicks **Start Game** when ready.

### Bots
1. **Play → Bots** → choose count + difficulty.
2. Game starts immediately with AI opponents.

### Testing Tips
- Use multiple browser profiles / devices.
- Free tier Realtime has limits (~200 concurrent connections). Fine for small groups of friends.
- If matchmaking feels slow, refresh or cancel and rejoin.

---

## 8. House Rules

When creating a private room you can toggle:

- Stack Draw Cards
- Jump-In
- Seven-O
- Force Play / Draw Until Playable
- Allow drawing even with playable cards
- Starting hand size (default 7)

These are stored in the room and applied by the game engine + bots.

---

## 9. Security Notes

- Only the **anon** key is used in frontend.
- Row Level Security (RLS) protects data.
- Critical game actions should be validated (basic validation is included via functions where possible).
- Passwords are handled entirely by Supabase Auth (bcrypt). Never stored by us.
- Do not expose `service_role` key.

---

## 10. Free-Tier Limitations

- Realtime: ~200 concurrent connections, 100 messages/sec.
- Database: 500 MB.
- Auth: generous for small projects.
- If you hit limits, upgrade or reduce concurrent players.

GitHub Pages is static only — all logic runs in browser + Supabase.

---

## Project Structure

```
uno-cyber/
├── index.html          # Landing / redirect
├── login.html
├── register.html
├── dashboard.html
├── matchmaking.html
├── room.html
├── game.html
├── css/
│   └── style.css       # Cyberpunk theme
├── js/
│   ├── config.js       # Supabase credentials
│   ├── supabase-client.js
│   ├── auth.js
│   ├── uno-engine.js   # Core UNO rules & logic
│   ├── bots.js
│   ├── matchmaking.js
│   ├── lobby.js
│   ├── game.js
│   └── ui.js
├── supabase/
│   └── schema.sql      # Full database setup
└── README.md
```

---

## Troubleshooting

- **"Invalid login"**: Make sure email confirmation is disabled.
- **Realtime not updating**: Check Replication is enabled for the tables.
- **CORS / Auth errors**: Set Site URL correctly in Supabase Auth settings.
- **RLS errors**: Re-run the schema.sql policies.
- Mobile layout issues: Use portrait; landscape supported for game table.

---

## License

MIT – feel free to modify and deploy your own instance.

Enjoy the neon tables. May the Wild Draw Four be ever in your favor.
