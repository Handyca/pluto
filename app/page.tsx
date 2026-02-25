import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, Palette, Shield, Sparkles, Zap, Globe, ArrowRight, Check } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Pluto</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/login">
                <Button variant="ghost" className="text-gray-300 hover:text-white">
                  Sign In
                </Button>
              </Link>
              <Link href="/admin">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>

        <div className="container mx-auto px-4 py-24 md:py-32 relative">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-300">Real-time Presentation Platform</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Engage Your Audience
              </span>
              <br />
              <span className="text-white">In Real-Time</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Transform your presentations with interactive chat, customizable themes, and powerful moderation tools. 
              Create memorable experiences that keep your audience engaged.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/admin">
                <Button size="lg" className="text-lg px-8 h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25">
                  <Shield className="mr-2 h-5 w-5" />
                  Create Your Session
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="text-lg px-8 h-14 border-white/20 hover:bg-white/5 text-white">
                  Explore Features
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-12">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">100%</div>
                <div className="text-sm text-gray-400 mt-1">Real-Time</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">Unlimited</div>
                <div className="text-sm text-gray-400 mt-1">Participants</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-white">Custom</div>
                <div className="text-sm text-gray-400 mt-1">Branding</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-300">Powerful Features</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need to Engage
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Powerful tools designed to make your presentations interactive and memorable
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-white">Real-Time Chat</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-400">
                  Instant messaging with support for text, images, emojis. Watch conversations flow in real-time with WebSocket technology.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Palette className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-white">Fully Customizable</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-400">
                  Upload custom backgrounds (images/videos), choose your brand colors, and customize fonts to match your style perfectly.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-white">No Signup Required</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-400">
                  Participants join instantly with just a nickname and session code. No accounts, no barriers, just simple access.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-white">Powerful Moderation</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-400">
                  Hide inappropriate messages, pin important ones, or delete content in real-time to maintain a professional environment.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-white">QR Code Access</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-400">
                  Display a scannable QR code on your presenter screen for instant participant access. No typing required.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6">
              <ArrowRight className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-300">Simple Process</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Four simple steps to create engaging, interactive presentations
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative">
                <div className="absolute -left-4 top-0 w-px h-full bg-gradient-to-b from-blue-500 via-purple-500 to-transparent hidden md:block"></div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                    1
                  </div>
                  <div className="pt-2">
                    <h3 className="text-xl font-semibold mb-2 text-white">Create Session</h3>
                    <p className="text-gray-400">
                      Sign in to the admin dashboard and create a new presentation session in seconds.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-4 top-0 w-px h-full bg-gradient-to-b from-purple-500 via-pink-500 to-transparent hidden md:block"></div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                    2
                  </div>
                  <div className="pt-2">
                    <h3 className="text-xl font-semibold mb-2 text-white">Customize Appearance</h3>
                    <p className="text-gray-400">
                      Upload your background, customize colors, and make it match your brand perfectly.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-4 top-0 w-px h-full bg-gradient-to-b from-pink-500 via-orange-500 to-transparent hidden md:block"></div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                    3
                  </div>
                  <div className="pt-2">
                    <h3 className="text-xl font-semibold mb-2 text-white">Share Access</h3>
                    <p className="text-gray-400">
                      Display the session code or QR code for participants to scan and join instantly.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-4 top-0 w-px h-full bg-gradient-to-b from-orange-500 to-transparent hidden md:block"></div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                    4
                  </div>
                  <div className="pt-2">
                    <h3 className="text-xl font-semibold mb-2 text-white">Go Live</h3>
                    <p className="text-gray-400">
                      Open the presenter view and moderate chat messages in real-time during your event.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-3xl p-8 md:p-12 backdrop-blur-sm">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                  Why Choose Pluto?
                </h2>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Check className="h-6 w-6 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Lightning Fast</p>
                      <p className="text-gray-400 text-sm">Built with Next.js and WebSocket for instant real-time updates</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Check className="h-6 w-6 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Fully Scalable</p>
                      <p className="text-gray-400 text-sm">Handle hundreds of participants without breaking a sweat</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Check className="h-6 w-6 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Privacy Focused</p>
                      <p className="text-gray-400 text-sm">No data collection, no tracking, complete control over your content</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Check className="h-6 w-6 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white font-medium">Easy to Use</p>
                      <p className="text-gray-400 text-sm">Intuitive interface that anyone can master in minutes</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/10 p-8 flex items-center justify-center">
                  <div className="text-center">
                    <Sparkles className="h-24 w-24 text-blue-400 mx-auto mb-4" />
                    <p className="text-2xl font-bold text-white mb-2">Ready to Start?</p>
                    <p className="text-gray-400 mb-6">Create your first session today</p>
                    <Link href="/admin">
                      <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                        Get Started Free
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-xl font-bold text-white">Pluto</span>
              </div>
              <p className="text-gray-400 text-sm">
                Real-time presentation chat platform for engaging and interactive events.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Technology</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Built with Next.js 16, Bun runtime, WebSocket, Prisma ORM, PostgreSQL, and Tailwind CSS
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link href="/admin" className="block text-gray-400 hover:text-white text-sm transition-colors">
                  Admin Dashboard
                </Link>
                <Link href="/admin/login" className="block text-gray-400 hover:text-white text-sm transition-colors">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10 text-center text-gray-400 text-sm">
            <p>© {new Date().getFullYear()} Pluto. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

