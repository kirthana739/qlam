import Link from "next/link";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      {/* Navigation header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm">
              Q
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">
              Qlam
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <main className="flex-1">
        <section className="relative overflow-hidden py-20 sm:py-28 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <Badge
              variant="secondary"
              className="px-3.5 py-1 text-xs sm:text-sm font-medium gap-1.5 rounded-full inline-flex items-center border border-primary/20 bg-primary/5 text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Autonomous Job Application Agent
            </Badge>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] sm:leading-[1.15]">
              Apply to jobs while you sleep
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Upload your resume once. Qlam finds jobs that fit, tailors your
              resume, and applies for you.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="h-12 px-8 text-base shadow-md">
                <Link href="/login" className="flex items-center gap-2">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Platform compatibility pill list */}
            <div className="pt-10 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Greenhouse</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Lever</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Ashby</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Automated tailoring</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="rounded-xl border border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="font-semibold text-lg text-foreground">
                  Smart Job Discovery
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Continuous matching against ATS job boards aligned with your
                  skills and career criteria.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  2
                </div>
                <h3 className="font-semibold text-lg text-foreground">
                  Faithful Tailoring
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Reorders and sharpens your existing resume experience per role
                  without ever fabricating details.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 space-y-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  3
                </div>
                <h3 className="font-semibold text-lg text-foreground">
                  Automated Submissions
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Autonomous browser workers complete application forms and
                  track all correspondence directly in your inbox.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Qlam. All rights reserved.</p>
      </footer>
    </div>
  );
}
