import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../api';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/customer-portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      localStorage.setItem('customer_token', json.data.token);
      localStorage.setItem('customer_user', JSON.stringify(json.data.user));
      navigate('/customer-portal');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background bg-shell-gradient px-4 py-12 font-sans text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex flex-col items-center gap-4">
            <Logo size="lg" showWordmark={false} />
            <h1 className="text-2xl font-bold tracking-tight">
              Customer <span className="text-primary">Portal</span>
            </h1>
            <p className="text-sm text-muted-foreground">Sign in to view shipments, orders, and invoices</p>
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
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-password">Password</Label>
              <Input
                id="customer-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
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
        </CardContent>
      </Card>
    </div>
  );
}
