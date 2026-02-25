# Pluto - Interactive Presentation Chat

A modern, real-time chat platform for presentations built with Next.js 16, Bun, WebSockets, Prisma, and Tailwind CSS.

## Features

- 🎥 **Customizable Backgrounds**: Upload images or videos for presenter view
- 💬 **Real-time Chat**: WebSocket-powered instant messaging
- 😀 **Rich Content**: Support for text, images, and emojis
- 🎨 **Theme Customization**: Fully customizable colors and layouts
- 👤 **Anonymous Participants**: No signup required - just enter a nickname
- 🛡️ **Chat Moderation**: Hide, pin, or delete messages in real-time
- 📱 **QR Code Access**: Scannable QR codes for easy participant joining
- 📊 **Session Management**: Comprehensive admin dashboard with sidebar navigation
- 🎯 **Participant Persistence**: LocalStorage-based session continuity
- ⚡ **Optimistic Updates**: Instant UI feedback for better UX

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui
- **Backend**: Bun runtime, Next.js API Routes
- **Real-time**: Native WebSockets (ws library)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 (Admin only)
- **State Management**: TanStack Query
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

Create `.env.local`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/pluto"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
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

4. **Start the development server**

```bash
bun run dev
```

This starts both Next.js and WebSocket server on http://localhost:3000

## Default Admin Credentials

- **Email**: `admin@pluto.local`
- **Password**: `admin123`

## Project Structure

```
pluto/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin dashboard with sidebar
│   ├── join/[code]/        # Participant chat interface
│   ├── presenter/[code]/   # Presenter view
│   └── api/                # API routes
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   ├── admin-sidebar.tsx   # Admin navigation sidebar
│   └── admin-layout.tsx    # Admin layout wrapper
├── lib/                    # Utilities and hooks
│   ├── hooks/              # React hooks
│   ├── auth.ts             # NextAuth config
│   └── utils.ts            # Utility functions
├── prisma/                 # Database schema and migrations
├── server/                 # Custom server with WebSocket
└── types/                  # TypeScript type definitions
```

## Key Features Explained

### Admin Dashboard

- Collapsible sidebar navigation
- Session creation and management
- Real-time statistics
- Theme customization panel
- Background upload (images/videos up to 100MB)
- Chat moderation tools

### Presenter View

- Customizable backgrounds (color, image, or video)
- Real-time chat overlay
- Pinned messages section
- QR code for participant access
- Configurable chat position (right, left, or bottom)

### Participant Chat

- Anonymous joining with nickname
- Horizontal toolbar with emoji picker
- Photo uploads (up to 30MB)
- Optimistic message updates
- Session persistence with localStorage

## Scripts

```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run start        # Start production server
bun run lint         # Run ESLint
bun run db:migrate   # Run database migrations
bun run db:studio    # Open Prisma Studio
bun run db:seed      # Seed database with admin
bun run db:push      # Push schema changes to database
```

## License

MIT
│ └── prisma.ts # Prisma client
├── prisma/ # Database schema
├── server/ # WebSocket server
├── types/ # TypeScript types
└── public/uploads/ # Uploaded files

````

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
````

## License

MIT
