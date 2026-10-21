import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, MapPin, MapPinOff, Warehouse as WarehouseIcon } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getInventoryAppUser } from './inventory-session';
import { saveInventoryAppFacility } from './inventory-facility';
import type { components } from '../generated/wmsApi';

type FacilityRow = components['schemas']['FacilityDto'];

/** The inventory app's site picker: lists the org's facilities, since inventory is read by facility (#297). */
export default function InventoryAppSelectFacility() {
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!getInventoryAppUser()) {
      navigate('/inventory-app/login');
      return;
    }

    fetch(`${API_URL}/api/v1/facilities?perPage=100`)
      .then(r => r.json())
      .then(json => {
        if (json.error) {
          setError(json.error);
          return;
        }
        const rows: FacilityRow[] = json.data || [];
        setFacilities(rows);
        if (rows.length === 1) setSelectedId(rows[0].id);
      })
      .catch(() => setError('Network error. Check your connection.'))
      .finally(() => setLoading(false));
  }, [navigate]);

  function handleContinue() {
    if (!selectedId) return;
    const facility = facilities.find(f => f.id === selectedId);
    if (!facility) return;
    saveInventoryAppFacility({ id: facility.id, name: facility.name });
    navigate('/inventory-app');
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
          <h2 className="mt-3 text-2xl font-bold tracking-tight">Select Your Site</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the site whose inventory you want to check.
          </p>
        </div>

        {error && (
          <Card className="border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </Card>
        )}

        {!error && facilities.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <MapPinOff className="h-10 w-10 text-muted-foreground" />
            <p className="text-base font-semibold">No sites available</p>
            <p className="text-sm text-muted-foreground">Ask your admin to set up a warehouse first.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {facilities.map(facility => {
              const selected = selectedId === facility.id;
              return (
                <Card
                  key={facility.id}
                  onClick={() => setSelectedId(facility.id)}
                  className={cn(
                    'cursor-pointer p-4 transition-colors active:bg-muted/50',
                    selected ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <WarehouseIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold">{facility.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {[facility.address.city, facility.address.state, facility.address.country].filter(Boolean).join(', ') || '-'}
                      </div>
                    </div>
                    {selected && <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />}
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
          disabled={!selectedId}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
