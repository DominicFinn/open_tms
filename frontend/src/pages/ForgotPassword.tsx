import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../api';
import { useTheme } from '../ThemeProvider';
import { Logo } from '@/components/brand/Logo';
import { GradientText } from '@/components/brand/GradientText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function ForgotPassword() {
  const { hasLogo, logoUrl, systemName } = useTheme();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Stub endpoint never exposes existence; ignore network errors.
    }
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background bg-shell-gradient px-4 py-12 font-sans text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex flex-col items-center gap-4">
            {hasLogo && logoUrl ? (
              <img src={logoUrl} alt={systemName} className="h-12 w-auto" />
            ) : (
              <Logo size="lg" showWordmark={false} />
            )}
            <h1 className="text-2xl font-bold tracking-tight">
              {systemName ? (
                systemName
              ) : (
                <>
                  Open <GradientText>TMS</GradientText>
                </>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Self-service reset is not yet available. For now, your administrator can reset your password from the Users admin page.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="mb-4 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
              Your request has been logged. Please contact your administrator to complete the reset.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp-email">Email</Label>
                <Input
                  id="fp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="you@company.com"
                />
              </div>
              <Button
                type="submit"
                variant="gradient"
                className="w-full"
                size="lg"
                disabled={loading || !email}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Submitting...' : 'Request reset'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm">
            <Link
              to="/login"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
