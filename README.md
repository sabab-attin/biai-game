# BIAI Prize Wheel

A promotional spinning wheel game for **BIAI (Bangladesh Institute of Artificial Intelligence — [biai.com.bd](https://biai.com.bd))**, built with **Vue 3**, **Express**, **MongoDB**, and automatic **CSV persistence**, styled in a responsive Carnival-inspired editorial system.

## Quick Shortcuts

Start both backend and frontend in the background:

```bash
./start.sh
```

Stop both services cleanly:

```bash
./stop.sh
```

- **App URL**: `http://localhost:5173`
- **API URL**: `http://localhost:4000/api`
- **CSV Log**: `backend/data/entries.csv`

## Features

- **Player Check-In**: Guests enter **Full Name** plus **Phone Number**, **Email Address**, or both.
- **MongoDB + CSV Storage**:
  - Player entries are stored in MongoDB (`players` and `spins` collections) and synced atomically to `backend/data/entries.csv`.
  - Winning codes (`CRN-XXXXXX`) are generated server-side and linked to each entry.
- **BIAI Marketing Integration**:
  - Features BIAI's emblem and real programs from `biai.com.bd` (Free 3-Hour Live AI Masterclass, 3-Day Generative AI Bootcamp, AI Generalist Fellowship, In-Person Dhaka Cohort) with direct links to `biai.com.bd/courses` and WhatsApp (`+880 1328 446600`).
- **Organizer CSV Ledger**:
  - Click **Organizer CSV** in the top navigation or footer and enter `ADMIN_PASSKEY` (default `biai2026` in `backend/.env`) every time to preview records and download `biai-prize-wheel-entries.csv`.

## Testing & Build

```bash
npm test
npm run build
```
