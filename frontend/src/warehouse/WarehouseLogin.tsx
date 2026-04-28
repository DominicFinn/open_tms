import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { API_URL } from '../api';
import { Logo } from '@/components/brand/Logo';
import { GradientText } from '@/components/brand/GradientText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function WarehouseLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  // Handle magic link token from URL (QR code scan)
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setMagicLinkLoading(true);
      handleMagicLink(token);
    }
  }, [searchParams]);

  // Check if already logged in
  useEffect(() => {
    const user = localStorage.getItem('warehouse_user');
    if (user) {
      const loc = localStorage.getItem('warehouse_location');
      navigate(loc ? '/warehouse' : '/warehouse/select-location');
    }
  }, [navigate]);

  async function handleMagicLink(token: string) {
    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/auth/magic-link/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || 'Invalid magic link');
        setMagicLinkLoading(false);
        return;
      }
      loginSuccess(json.data.user);
    } catch {
      setError('Network error. Check your connection.');
      setMagicLinkLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || 'Login failed');
        setLoading(false);
        return;
      }
      loginSuccess(json.data.user);
    } catch {
      setError('Network error. Check your connection.');
      setLoading(false);
    }
  }

  function loginSuccess(user: any) {
    localStorage.setItem('warehouse_user', JSON.stringify(user));

    // If user has a preferred location, auto-select it
    if (user.preferredLocationId) {
      fetch(`${API_URL}/api/v1/warehouse/locations`)
        .then(r => r.json())
        .then(json => {
          const loc = (json.data || []).find((l: any) => l.id === user.preferredLocationId);
          if (loc) {
            localStorage.setItem('warehouse_location', JSON.stringify(loc));
            navigate('/warehouse');
          } else {
            navigate('/warehouse/select-location');
          }
        })
        .catch(() => navigate('/warehouse/select-location'));
    } else {
      navigate('/warehouse/select-location');
    }
  }

  if (magicLinkLoading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background bg-shell-gradient px-4 py-12 font-sans text-foreground">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
        <Card className="relative w-full max-w-md border-border/50 bg-card/80 shadow-2xl backdrop-blur-xl">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Signing you in...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background bg-shell-gradient px-4 py-12 font-sans text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <Card className="relative w-full max-w-md border-border/50 bg-card/80 shadow-2xl backdrop-blur-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex flex-col items-center gap-4">
            <Logo size="lg" showWordmark={false} />
            <h1 className="text-2xl font-bold tracking-tight">
              Warehouse <GradientText>App</GradientText>
            </h1>
            <p className="text-sm text-muted-foreground">Sign in to start operations</p>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handlePasswordLogin} autoComplete="on" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wh-email" className="text-base">Email</Label>
              <Input
                id="wh-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-password" className="text-base">Password</Label>
              <Input
                id="wh-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
                className="h-12 text-base"
              />
            </div>
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full text-base"
              disabled={loading || !email || !password}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>or scan QR code</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <p className="mt-3 text-center text-sm text-muted-foreground">
            Ask your admin for a login QR code to stick on the wall for quick access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
