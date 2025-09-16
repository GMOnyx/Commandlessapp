import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <img src="/commandless.svg" alt="Commandless" className="h-8 w-auto transform scale-[5] origin-left" />
        <nav className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm text-gray-700 hover:underline">Sign in</Link>
          <Link href="/sign-up" className="text-sm text-white bg-[#5046E4] rounded-md px-3 py-1.5">Get started</Link>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900">Turn commands into conversations</h1>
        <p className="mt-5 text-lg text-gray-600">
          Commandless is an AI middleware that lets your Discord bots understand natural language and execute real actions.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/sign-up" className="text-white bg-[#5046E4] hover:bg-[#5046E4]/90 rounded-md px-5 py-3">Start free</Link>
          <Link href="/sign-in" className="text-[#5046E4] hover:underline">Sign in</Link>
        </div>
      </main>
    </div>
  );
}


