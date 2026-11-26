# BIAI + AI Quiz

A promotional event app for **BIAI (Bangladesh Institute of Artificial Intelligence — [biai.com.bd](https://biai.com.bd))**, built with **Vue 3**, **Express**, **MongoDB**, and a durable CSV/JSONL backup pipeline.

Visitors pick **Spin the Wheel** or **Play Quiz** on the landing page, sign in with a name and phone number (email is optional) or continue as a guest, then go straight into the selected game. Guest sessions are numbered sequentially as `#Guest1`, `#Guest2`, and so on. Every login, guest entry, quiz result, wheel result, and admin manual entry is written to MongoDB and appended to a JSONL backup before the UI confirms success.

## Quick Start

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

Create the backend environment file:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your MongoDB URI, session secret, and first admin credentials. Then start both apps from the project root:

```bash
./start.sh      # macOS / Linux / Git Bash
npm.cmd run dev # Windows PowerShell (starts backend + frontend)
```

- **App**: `http://localhost:5173`
- **API**: `http://localhost:4000/api`
- **Generated CSV**: `backend/data/records.csv`
- **Backup log**: `backend/backups/records.log.jsonl`
- **CSV snapshots**: `backend/backups/csv-snapshots/` (newest 96 kept)

### MongoDB on Windows

The backend requires MongoDB at `mongodb://127.0.0.1:27017/carnival_wheel`. Install MongoDB Community Server from [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community) and install it as a Windows service. In an Administrator PowerShell:

```powershell
Start-Service MongoDB
Test-NetConnection 127.0.0.1 -Port 27017
```

`TcpTestSucceeded` must be `True`. If the app was already running when MongoDB started, restart it.

## Environment Variables (`backend/.env`)

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | API port | `4000` |
| `MONGODB_URI` | MongoDB connection string (source of truth) | `mongodb://127.0.0.1:27017/carnival_wheel` |
| `SESSION_SECRET` | Signs player, quiz, and admin tokens. **Change this.** | dev fallback (do not use in production) |
| `FRONTEND_ORIGIN` | Allowed browser origin for CORS | `http://localhost:5173` |
| `MAX_SPINS_PER_PLAYER` | Wheel turns per player | `1` |
| `CSV_FILE_PATH` | Generated CSV path | `./data/records.csv` |
| `BACKUP_DIR` | Backup root | `./backups` |
| `RECORD_LOG_PATH` | Append-only JSONL backup | `./backups/records.log.jsonl` |
| `CSV_SNAPSHOT_DIR` | Timestamped CSV snapshots | `./backups/csv-snapshots` |
| `ADMIN_USERNAMES` | Comma-separated admin usernames (all share one password) | none |
| `ADMIN_PASSWORD` | Shared admin plain password (hashed on seed) | none |
| `ADMIN_PASSWORD_HASH` | Alternative bcrypt hash | none |
| `COOKIE_SECURE` | Set `true` when serving over HTTPS | `false` (dev) |
| `ADMIN_LOGIN_MAX_ATTEMPTS` | Failed logins allowed per window | `5` |
| `ADMIN_LOGIN_WINDOW_MS` | Login rate-limit window | `900000` (15 min) |

The admin URL path comes from the frontend build variable `VITE_ADMIN_PATH` (default `admin`). The footer **admin** link points to it and the console can be opened at any time.

## Data Model

MongoDB is authoritative. The `records` collection stores:

`name`, `phone`, `email`, `reward`, `timestamp` (UTC ISO), `source` (`wheel`, `quiz`, `dart`, `guest`), `game`, `createdAt`.

Normal login requires `name` and a valid Bangladesh `phone`; `email` is optional and stored as null when omitted. Guest and admin manual-entry records may still have null `phone` / `email`. Optional contact fields are validated only when supplied. Manual entries always require a `game` value.

The existing `players` and `spins` collections still power wheel turn state and prize history.

## Backups, CSV, and Recovery

- Every record is appended immediately to `backend/backups/records.log.jsonl` before the MongoDB write is confirmed. Writes to the log and CSV are serialized to avoid races.
- The CSV has exactly these columns: `name,phone,email,reward,timestamp,source`.
  - Nulls become empty cells.
  - Cells beginning with `=`, `+`, `-`, or `@` are prefixed with `'` to prevent spreadsheet formula injection.
  - Commas, quotes, and newlines are quoted/escaped correctly.
- Every 15 minutes the scheduler rebuilds the CSV from MongoDB using a temp file + atomic rename, then writes a timestamped snapshot.
- The newest **96** snapshots are kept; older snapshots are deleted.
- A snapshot is written on `SIGINT` / `SIGTERM` shutdown.
- On startup:
  - If MongoDB is empty, records are restored from the JSONL log.
  - If the CSV is missing or corrupt, it is rebuilt from MongoDB.

Admin actions available in the console:

- **CSV / Backup** green square button, available on every admin tab: **Restore / Rebuild CSV now**, **Download CSV**, preview, and CSV import.
- **Records** browser with source filters, edit, and delete with confirmation.
- **Manual Entry** logger (create, edit, delete with confirmation). Every manual entry requires `name` and `game`.
- **Audit Log** of admin actions.

The CSV and backup files live outside `frontend/` and are never served as static assets.

## Admin Accounts

Built-in admin account (`biai`) is configured with `ADMIN_USERNAMES` + `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH`). The server seeds it on startup and removes any admin accounts that are not listed. Alternatively, seed manually:

```bash
cd backend
npm run seed:admin
```

To reset an existing admin password with the current `.env` values:

```bash
npm run seed:admin -- --force
```

Passwords are hashed with bcrypt. Never commit real credentials.

### Admin Access

Click **admin** in the footer, or open the path configured in `VITE_ADMIN_PATH` directly:

```text
http://localhost:5173/#admin
```

Admin sessions use an httpOnly, SameSite cookie signed with `SESSION_SECRET`. Every admin API checks the admin role server-side and returns a plain **404 Not Found** to anonymous users and non-admin players — never 401 or 403. Admin logins, downloads, rebuilds, manual-entry writes, edits, and deletes are written to the `adminaudits` collection with the admin id and a timestamp.

## Public Flow

1. **Landing** — two large cards: **Spin the Wheel** and **Play Quiz**.
2. **Login** — full name and phone number required; email optional; consent line shown. **Continue as Guest** saves a sequential name such as `#Guest1` with null contact details and source `guest`.
3. After login the selected game opens directly:
   - **Quiz** — 5 distinct questions selected from the 10-question bank with Fisher-Yates; options are shuffled; one question at a time with instant right/wrong feedback; final `x/5` score saved to `records`.
   - **Wheel** — existing 9-segment wheel and server-weighted prize logic are unchanged.
4. **Prizes** — compact ledger of every reward; **How it works** is no longer shown.

## Testing & Build

```bash
cd backend
npm test

cd ../frontend
npm run build
```

Backend tests cover:

- Phone requirement and optional email on login
- Sequentially numbered guest names (`#Guest1`, `#Guest2`, …)
- CSV escaping (formula prefixes, commas, quotes, newlines, nulls)
- Atomic CSV writes with no partial or temp files
- Startup CSV repair after corruption
- Plain 404 responses from admin routes for anonymous and normal players
- Admin login, manual-entry CRUD (with required `game`), audit logging, and authenticated CSV download
- Quiz selection of 5 distinct questions and score persistence
- JSONL restore when MongoDB is empty
- One-spin wheel behavior and wheel record persistence

## Manual Test Checklist

1. Start MongoDB, backend, and frontend. Confirm the app loads at `http://localhost:5173` and the landing page shows only **Spin the Wheel** and **Play Quiz**.
2. Choose **Spin the Wheel**, then submit the login form with a name but no phone number; confirm it is rejected with a phone error.
3. Submit the form with a name and valid phone but no email. Confirm the wheel opens directly.
4. Sign out, click **Continue as Guest**, and confirm the guest is saved as `#Guest1` (or the next number) with source `Guest`.
5. Click **admin** in the footer or open `http://localhost:5173/#admin`, sign in as `biai`, and confirm the new record shows the phone number, a blank email, source `Wheel`, and the **Statistics** tab is gone.
6. From the landing page choose **Play Quiz**, sign in as a guest, answer all 5 questions, and confirm the score is shown and saved with source `Quiz`.
7. In the admin **Manual Entry** tab, try saving without a game; confirm it is rejected. Add a manual entry with name and game, edit it, then delete it after the confirmation prompt.
8. Open the green **CSV / Backup** button from any tab and click **Download CSV**; confirm the header and escaped values match the records.
9. Click **Restore / Rebuild CSV now** and confirm the record count and snapshot timestamp update.
10. Corrupt `backend/data/records.csv` (for example, write random bytes), restart the backend, and confirm the file is rebuilt from MongoDB.
11. Stop the backend mid-write with `Ctrl+C` (SIGINT). Restart and confirm `records.csv` is valid and the JSONL backup still contains the latest entries.
12. Empty the `records` collection in MongoDB while keeping the JSONL file, restart, and confirm records are restored from the log.
