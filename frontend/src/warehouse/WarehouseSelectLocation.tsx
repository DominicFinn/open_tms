import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, MapPin, MapPinOff, Warehouse as WarehouseIcon } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function WarehouseSelectLocation() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('warehouse_user');
    if (!user) {
      navigate('/warehouse/login');
      return;
    }

    fetch(`${API_URL}/api/v1/warehouse/locations`)
      .then(r => r.json())
      .then(json => {
        setLocations(json.data || []);
        // Pre-select if only one location
        if (json.data?.length === 1) {
          setSelectedId(json.data[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function handleContinue() {
    if (!selectedId) return;
    setSaving(true);

    const loc = locations.find(l => l.id === selectedId);
    localStorage.setItem('warehouse_location', JSON.stringify(loc));

    // Save preference so user doesn't get asked again
    try {
      const user = JSON.parse(localStorage.getItem('warehouse_user') || '{}');
      await fetch(`${API_URL}/api/v1/warehouse/users/${user.id}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLocationId: selectedId }),
      });
      user.preferredLocationId = selectedId;
      localStorage.setItem('warehouse_user', JSON.stringify(user));
    } catch {
      // Non-critical - continue anyway
    }

    navigate('/warehouse');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <MapPin className="h-12 w-12 text-primary" />
          <h2 className="mt-3 text-2xl font-bold tracking-tight">Select Your Location</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the warehouse or origin you are working from today.
          </p>
        </div>

        {locations.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <MapPinOff className="h-10 w-10 text-muted-foreground" />
            <p className="text-base font-semibold">No locations available</p>
            <p className="text-sm text-muted-foreground">Ask your admin to set up locations first.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {locations.map(loc => {
              const selected = selectedId === loc.id;
              return (
                <Card
                  key={loc.id}
                  onClick={() => setSelectedId(loc.id)}
                  className={cn(
                    'cursor-pointer p-4 transition-colors active:bg-muted/50',
                    selected
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <WarehouseIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold">{loc.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {[loc.city, loc.state, loc.country].filter(Boolean).join(', ') || '-'}
                      </div>
                    </div>
                    {selected && (
                      <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Button
          variant="gradient"
          size="lg"
          className="w-full text-base"
          disabled={!selectedId || saving}
          onClick={handleContinue}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Setting up...' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
