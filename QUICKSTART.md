# Quick Start Guide

## Setup Instructions

Follow these steps to get Pluto running on your local machine.

### 1. Install PostgreSQL

You need PostgreSQL running. Quick option using Docker:

```bash
docker run --name pluto-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=pluto \
  -p 5432:5432 \
  -d postgres:16
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Configure Environment

The `.env.local` file is already configured for local development with these defaults:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pluto?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="development-secret-key-change-in-production-please"
WS_PORT=3001
NEXT_PUBLIC_WS_PORT=3001
ADMIN_EMAIL="admin@pluto.local"
ADMIN_PASSWORD="admin123"
```

### 4. Set up Database

```bash
# Generate Prisma client
bun run prisma:generate

# Run migrations to create tables
bun run db:migrate

# Seed with default admin account
bun run db:seed
```

### 5. Start Development Servers

```bash
bun run dev
```

This will start:

- ✅ Next.js on http://localhost:3000
- ✅ WebSocket server on ws://localhost:3001

## Try It Out!

### Admin Dashboard

1. Go to http://localhost:3000/admin/login
2. Login with:
   - **Email**: `admin@pluto.local`
   - **Password**: `admin123`
3. Create a new session
4. Get the session code (e.g., `DEMO01`)

### Presenter View

1. Open http://localhost:3000/presenter/DEMO01 (use your session code)
2. You'll see the presenter view with chat overlay
3. Keep this open on a projector/screen

### Participant Chat

1. In a different browser/window, go to http://localhost:3000/join/DEMO01
2. Enter a nickname
3. Start chatting!
4. Watch messages appear in real-time on the presenter view

### Customize

Back in admin dashboard:

1. Go to "Manage" for your session
2. Upload a background image/video
3. Change theme colors
4. Moderate messages (hide, pin, delete)

## Troubleshooting

### Database Connection Error

Make sure PostgreSQL is running:

```bash
docker ps | grep postgres
```

### WebSocket Connection Failed

Check if port 3001 is available:

```bash
lsof -i :3001
```

### Prisma Client Not Found

Regenerate the client:

```bash
bun run prisma:generate
```

### Port Already in Use

Change ports in `.env.local`:

```env
WS_PORT=3002
NEXT_PUBLIC_WS_PORT=3002
```

Then restart: `bun run dev`

## Next Steps

- Customize the default theme in [prisma/seed.ts](prisma/seed.ts)
- Add more stickers to `public/uploads/sticker/`
- Configure production environment variables
- Set up reverse proxy for WebSocket in production

## Need Help?

Check the main [README.md](README.md) for detailed documentation or open an issue on the repository.
