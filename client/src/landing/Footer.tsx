export default function Footer() {
  return (
    <footer className="bg-background border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8 items-start">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src="/commandless.svg" alt="Commandless Logo" className="w-8 h-8" />
              <span className="text-xl font-bold text-foreground">Commandless</span>
            </div>
            <p className="text-muted-foreground mb-4 max-w-md">
              Transform your Discord and Telegram bots from clunky commands to natural AI conversations in just a few clicks.
            </p>
          </div>
          <div className="col-span-2 md:col-span-2 flex md:justify-end">
            <a href="mailto:abdarrahman2345@gmail.com" className="inline-flex items-center justify-center rounded-xl px-6 py-4 text-base md:text-lg font-semibold bg-[hsl(var(--primary))] text-white shadow-[0_10px_30px_hsl(245_83%_65%/0.35)] hover:shadow-[0_14px_40px_hsl(245_83%_65%/0.45)] transition-all">
              Talk to the Founder
            </a>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row items-center justify-between">
          <p className="text-muted-foreground text-sm">© 2024 Commandless. All rights reserved.</p>
          <div className="flex items-center gap-6 mt-4 md:mt-0 text-sm text-muted-foreground" />
        </div>
      </div>
    </footer>
  );
}


