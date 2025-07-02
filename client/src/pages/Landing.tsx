import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BotIcon, MessageSquareIcon, SparklesIcon, ArrowRightIcon, CheckIcon, StarIcon } from "lucide-react";
import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <BotIcon className="h-8 w-8 text-primary mr-2" />
              <span className="text-2xl font-bold text-gray-900">Commandless</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/sign-in">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/sign-up">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16 sm:pt-24 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge variant="secondary" className="mb-4">
              <SparklesIcon className="h-3 w-3 mr-1" />
              AI-Powered Bot Transformation
            </Badge>
            
            <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
              Transform Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Command Bots
              </span>
              {" "}Into Conversational AI
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Stop forcing users to memorize complex bot commands. Commandless turns any Discord or Telegram bot 
              into an intelligent conversational assistant that understands natural language.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/sign-up">
                <Button size="lg" className="text-lg px-8 py-6">
                  Start Free Trial
                  <ArrowRightIcon className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How Commandless Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Transform rigid command-based interactions into natural conversations in three simple steps.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <BotIcon className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Connect Your Bot</CardTitle>
                <CardDescription>
                  Link your existing Discord or Telegram bot to Commandless in seconds
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <SparklesIcon className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl">AI Training</CardTitle>
                <CardDescription>
                  Our AI learns your bot's commands and creates natural language mappings automatically
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <MessageSquareIcon className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-xl">Natural Conversations</CardTitle>
                <CardDescription>
                  Users can now talk to your bot naturally instead of memorizing complex commands
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Before/After Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Before vs After Commandless
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Before */}
            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center">
                  <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                  Before: Command-Based
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="bg-gray-800 text-green-400 p-3 rounded font-mono">
                    User: !ban @user123 "spam"
                  </div>
                  <div className="bg-gray-800 text-green-400 p-3 rounded font-mono">
                    User: !kick @user456 --reason="toxic behavior"
                  </div>
                  <div className="bg-gray-800 text-green-400 p-3 rounded font-mono">
                    User: !mute @user789 30m "excessive caps"
                  </div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-red-700">
                  <li>❌ Complex syntax to memorize</li>
                  <li>❌ Confusing parameters and flags</li>
                  <li>❌ High learning curve for new users</li>
                  <li>❌ Frequent command errors</li>
                </ul>
              </CardContent>
            </Card>

            {/* After */}
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-800 flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  After: Natural Language
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="bg-blue-100 text-blue-800 p-3 rounded">
                    User: "Can you ban user123 for spamming?"
                  </div>
                  <div className="bg-blue-100 text-blue-800 p-3 rounded">
                    User: "Please kick user456, they're being toxic"
                  </div>
                  <div className="bg-blue-100 text-blue-800 p-3 rounded">
                    User: "Mute user789 for 30 minutes, too much caps"
                  </div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-green-700">
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2" />Natural conversation flow</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2" />No syntax to remember</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2" />Instant user adoption</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2" />Fewer user errors</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Start free, scale as you grow
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <Card className="border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Starter</CardTitle>
                <div className="text-4xl font-bold">$0</div>
                <CardDescription>Perfect for trying out Commandless</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />1 Connected Bot</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />10 Command Mappings</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />100 Monthly Conversations</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />Basic Support</li>
                </ul>
                <Link href="/sign-up" className="w-full mt-6 block">
                  <Button variant="outline" className="w-full">Get Started Free</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-2 border-blue-500 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-500">Most Popular</Badge>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Pro</CardTitle>
                <div className="text-4xl font-bold">$29</div>
                <CardDescription>For growing communities and teams</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />5 Connected Bots</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />Unlimited Command Mappings</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />10,000 Monthly Conversations</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />Priority Support</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />Advanced Analytics</li>
                </ul>
                <Link href="/sign-up" className="w-full mt-6 block">
                  <Button className="w-full">Start Pro Trial</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Enterprise</CardTitle>
                <div className="text-4xl font-bold">Custom</div>
                <CardDescription>For large organizations</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />Unlimited Bots</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />Unlimited Everything</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />Custom Integrations</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />Dedicated Support</li>
                  <li className="flex items-center"><CheckIcon className="h-4 w-4 mr-2 text-green-600" />SLA Guarantees</li>
                </ul>
                <Button variant="outline" className="w-full mt-6">Contact Sales</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Bot Experience?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of communities already using Commandless to make their bots more accessible.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
                Start Free Trial
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <BotIcon className="h-6 w-6 mr-2" />
              <span className="text-xl font-bold">Commandless</span>
            </div>
            <div className="flex space-x-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <a href="#" className="hover:text-white">Terms of Service</a>
              <a href="#" className="hover:text-white">Support</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            © 2025 Commandless. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
} 