import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function WarehouseSettings() {
  const navigate = useNavigate();
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('warehouse_user') || '{}'); }
    catch { return {}; }
  });
  const [location] = useState(() => {
    try { return JSON.parse(localStorage.getItem('warehouse_location') || '{}'); }
    catch { return {}; }
  });

  function changeLocation() {
    localStorage.removeItem('warehouse_location');
    navigate('/warehouse/select-location');
  }

  function handleLogout() {
    localStorage.removeItem('warehouse_user');
    localStorage.removeItem('warehouse_location');
    navigate('/warehouse/login');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-1 py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Account and device configuration</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-base font-medium">
              {user.firstName} {user.lastName}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-base font-medium">{user.email || '-'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Role</span>
            <span className="text-base font-medium">{user.roles?.join(', ') || '-'}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Current</span>
            <span className="text-base font-medium">{location.name || '-'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">City</span>
            <span className="text-base font-medium">
              {[location.city, location.state].filter(Boolean).join(', ') || '-'}
            </span>
          </div>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={changeLocation}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Change Location
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">App Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Version</span>
            <span className="text-base font-medium">1.0.0</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Scanner</span>
            <span className="text-base font-medium">HID (built-in)</span>
          </div>
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        size="lg"
        className="w-full"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>
    </div>
  );
}
