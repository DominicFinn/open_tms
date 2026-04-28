import * as React from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { RouteKey } from '@/components/app/app-sidebar';

interface Props {
  onNavigate: (r: RouteKey) => void;
}

export function CreateShipmentPage({ onNavigate }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate('shipments')}
          className="-ml-3"
        >
          <ArrowLeft className="h-4 w-4" />
          All shipments
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">New shipment</h1>
        <p className="mt-1 text-muted-foreground">
          Create a shipment from a customer order or as a one-off booking.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer &amp; reference</CardTitle>
              <CardDescription>Who is paying and what are we tracking it as.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <Select>
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acme">Acme Foods</SelectItem>
                    <SelectItem value="northwind">Northwind Pharma</SelectItem>
                    <SelectItem value="globex">Globex Logistics</SelectItem>
                    <SelectItem value="initech">Initech Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="po">Customer PO</Label>
                <Input id="po" placeholder="e.g. PO-2026-04-1042" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref">Internal reference</Label>
                <Input id="ref" placeholder="Auto-assigned if blank" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mode">Mode</Label>
                <Select defaultValue="ftl">
                  <SelectTrigger id="mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ftl">FTL</SelectItem>
                    <SelectItem value="ltl">LTL</SelectItem>
                    <SelectItem value="parcel">Parcel</SelectItem>
                    <SelectItem value="intermodal">Intermodal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pickup</CardTitle>
              <CardDescription>Where the freight starts.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="origin">Origin location</Label>
                <Select>
                  <SelectTrigger id="origin">
                    <SelectValue placeholder="Search saved locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chi-dc">Acme Chicago DC</SelectItem>
                    <SelectItem value="dal-dc">Acme Dallas DC</SelectItem>
                    <SelectItem value="la-dc">Acme LA DC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickup-date">Pickup date</Label>
                <Input id="pickup-date" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickup-window">Pickup window</Label>
                <Input id="pickup-window" placeholder="08:00 - 12:00" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
              <CardDescription>Where the freight ends.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="dest">Destination location</Label>
                <Select>
                  <SelectTrigger id="dest">
                    <SelectValue placeholder="Search saved locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atl-dc">Acme Atlanta DC</SelectItem>
                    <SelectItem value="mia-dc">Acme Miami DC</SelectItem>
                    <SelectItem value="den-dc">Acme Denver DC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="del-date">Delivery date</Label>
                <Input id="del-date" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="del-window">Delivery window</Label>
                <Input id="del-window" placeholder="14:00 - 18:00" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Freight</CardTitle>
              <CardDescription>What is on the truck.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (lbs)</Label>
                <Input id="weight" type="number" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pallets">Pallets</Label>
                <Input id="pallets" type="number" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temp">Temperature</Label>
                <Select defaultValue="ambient">
                  <SelectTrigger id="temp">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambient">Ambient</SelectItem>
                    <SelectItem value="chilled">Chilled (2-8&deg;C)</SelectItem>
                    <SelectItem value="frozen">Frozen (&lt; -18&deg;C)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => onNavigate('shipments')}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button variant="outline">Save as draft</Button>
              <Button variant="gradient">Create &amp; tender</Button>
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">Suggested rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">$2,840</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Based on lane history with Werner over the last 90 days.
              </div>
              <Separator className="my-4" />
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Linehaul</span>
                  <span>$2,420</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Fuel surcharge</span>
                  <span>$320</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Liftgate</span>
                  <span>$100</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Customer EDI 850?</span>
                <span className="text-foreground">Yes</span>
              </div>
              <div className="flex justify-between">
                <span>Cold chain logging?</span>
                <span className="text-foreground">Required</span>
              </div>
              <div className="flex justify-between">
                <span>SLA promise</span>
                <span className="text-foreground">2 days</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
