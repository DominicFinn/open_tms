import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../api';
import { useTheme } from '../ThemeProvider';
import { Logo } from '@/components/brand/Logo';
import { GradientText } from '@/components/brand/GradientText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  const { hasLogo, logoUrl, systemName } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (json.error || !json.data?.token) {
        setError(json.error || 'Login failed. Please try again.');
      } else {
        localStorage.setItem('auth_token', json.data.token);
        localStorage.setItem('auth_user', JSON.stringify(json.data.user));
        navigate(returnTo, { replace: true });
      }
    } catch {
      setError('Network error. Please try again.');
    }
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
            <p className="text-sm text-muted-foreground">Sign in to continue</p>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="on" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </div>
            <Button
              type="submit"
              variant="gradient"
              className="w-full"
              size="lg"
              disabled={loading || !email || !password}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <Link
              to="/forgot-password"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              Forgot password?
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
