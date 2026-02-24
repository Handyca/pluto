# Pluto - Interactive Presentation Chat

A modern, real-time chat platform for presentations built with Next.js 14+, Bun, WebSockets, Prisma, and Tailwind CSS.

## Features

- 🎥 **Customizable Backgrounds**: Upload images or videos for presenter view
- 💬 **Real-time Chat**: WebSocket-powered instant messaging
- 😀 **Rich Content**: Support for text, images, emojis, and stickers
- 🎨 **Theme Customization**: Fully customizable colors and layouts
- 👤 **Anonymous Participants**: No signup required - just enter a nickname
- 🛡️ **Chat Moderation**: Hide, pin, or delete messages in real-time
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React 19, TailwindCSS v4, shadcn/ui
- **Backend**: Bun runtime, Next.js API Routes
- **Real-time**: Native WebSockets (ws library)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 (Admin only)
- **State Management**: TanStack Query, Zustand
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0 or higher
- PostgreSQL database

### Installation

1. **Install dependencies**

```bash
bun install
```

2. **Configure environment variables**

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/pluto"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
WS_PORT=3001
```

3. **Set up the database**

```bash
# Generate Prisma client
bun run prisma:generate

# Run migrations
bun run db:migrate

# Seed the database with default admin
bun run db:seed
```

4. **Start the development servers**

```bash
bun run dev
```

This starts both:

- Next.js dev server on http://localhost:3000
- WebSocket server on ws://localhost:3001

## Default Admin Credentials

- **Email**: `admin@pluto.local`
- **Password**: `admin123`

## Project Structure

```
pluto/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin dashboard
│   ├── join/[code]/        # Participant chat
│   ├── presenter/[code]/   # Presenter view
│   └── api/                # API routes
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   └── ...
├── lib/                    # Utilities and hooks
│   ├── hooks/              # React hooks
│   ├── auth.ts             # NextAuth config
│   └── prisma.ts           # Prisma client
├── prisma/                 # Database schema
├── server/                 # WebSocket server
├── types/                  # TypeScript types
└── public/uploads/         # Uploaded files
```

## Usage

1. **Admin**: Login at `/admin/login` and create sessions
2. **Presenter**: Open `/presenter/{CODE}` to display with chat overlay
3. **Participants**: Join at `/join/{CODE}` with a nickname

## Scripts

```bash
bun run dev              # Start development servers
bun run build            # Build for production
bun run start            # Start production server
bun run db:migrate       # Run database migrations
bun run db:studio        # Open Prisma Studio
bun run db:seed          # Seed database
```

## License

MIT
