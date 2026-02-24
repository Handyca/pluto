import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, Palette, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 mb-16">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Pluto
          </h1>
          <p className="text-2xl text-muted-foreground max-w-2xl mx-auto">
            Interactive Presentation Chat Platform
          </p>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Real-time chat with customizable backgrounds, themes, and moderation tools
            for engaging presentations and Q&A sessions
          </p>
          <div className="flex gap-4 justify-center mt-8">
            <Link href="/admin">
              <Button size="lg" className="text-lg px-8">
                <Shield className="mr-2 h-5 w-5" />
                Admin Dashboard
              </Button>
            </Link>
            <Link href="/admin/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <MessageSquare className="h-10 w-10 mb-2 text-blue-600" />
              <CardTitle>Real-time Chat</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Instant messaging with support for text, images, emojis, and stickers
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Palette className="h-10 w-10 mb-2 text-purple-600" />
              <CardTitle>Customizable</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Custom backgrounds (images/videos) and theme colors for your brand
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-10 w-10 mb-2 text-green-600" />
              <CardTitle>Anonymous Join</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Participants join easily with just a nickname - no signup required
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-10 w-10 mb-2 text-orange-600" />
              <CardTitle>Moderation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Hide, pin, or delete messages in real-time for a clean presentation
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl text-center">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">Create a Session</h3>
                <p className="text-sm text-muted-foreground">
                  Sign in to admin dashboard and create a new presentation session
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">Customize Appearance</h3>
                <p className="text-sm text-muted-foreground">
                  Upload background images/videos and customize theme colors
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Share the Code</h3>
                <p className="text-sm text-muted-foreground">
                  Display the session code or QR code for participants to join
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h3 className="font-semibold mb-1">Go Live</h3>
                <p className="text-sm text-muted-foreground">
                  Open presenter view and moderate chat messages in real-time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-16 text-sm text-muted-foreground">
          <p>Built with Next.js, Bun, WebSockets, Prisma, and Tailwind CSS</p>
        </div>
      </div>
    </div>
  );
}

