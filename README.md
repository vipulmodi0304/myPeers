# myPeers

A real-time collaborative study platform for students to find active study sessions, connect with peers, and study together online.

## Highlights

- Real-time study rooms powered by Supabase Realtime
- Live presence, chat, and room synchronization
- Shared whiteboard, collaborative Pomodoro timers, and emoji reactions
- Session discovery and course-based filtering
- File and message workflows for student collaboration
- Responsive React interface deployed through Railway

The project was built as a fast-moving MVP and tested with 15–20 active users, including 10+ concurrent users in a room.

## Tech stack

- **Frontend:** React 19, Vite, JavaScript, CSS
- **Realtime and data:** Supabase, PostgreSQL, Supabase Realtime
- **UI:** Framer Motion, Lucide React
- **Deployment:** Railway, Nixpacks
- **Tooling:** ESLint, npm

## How it works

```text
Browser
  |
  v
React + Vite client
  |
  +--> Supabase database
  +--> Supabase Realtime channels
  +--> Supabase-backed messaging and collaboration workflows
```

The application keeps room state synchronized across users while supporting presence, messaging, collaborative timers, and shared study tools.

## Run locally

```bash
git clone https://github.com/vipulmodi0304/myPeers.git
cd myPeers/15nov
cp .env.example .env
npm install
npm run dev
```

Create a `.env` file with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Then open the local Vite URL shown in your terminal.

## Project structure

```text
15nov/
├── src/
│   ├── components/   # reusable UI and collaboration components
│   ├── lib/          # Supabase and realtime helpers
│   ├── pages/        # application screens
│   └── utils/        # session, messaging, and synchronization utilities
├── public/
└── package.json
```

## What I learned

Building myPeers gave me hands-on experience with real-time application state, concurrent users, database-backed collaboration, deployment, and debugging a product under a tight build cycle.

## Status

The current repository contains the MVP used for the original project. Future improvements include stronger automated testing, clearer service boundaries, and additional reliability work around real-time collaboration.
