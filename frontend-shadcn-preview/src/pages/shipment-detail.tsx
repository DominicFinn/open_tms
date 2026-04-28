import * as React from 'react';
import {
  ArrowLeft,
  Truck,
  MapPin,
  Thermometer,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { RouteKey } from '@/components/app/app-sidebar';

interface Props {
  onNavigate: (r: RouteKey) => void;
}

const TIMELINE = [
  { time: 'Apr 28, 14:22', label: 'GPS ping received', sub: '12 mi from Atlanta DC', icon: MapPin, tone: 'info' as const },
  { time: 'Apr 28, 09:14', label: 'Departed Memphis hub', sub: 'On revised plan', icon: Truck, tone: 'info' as const },
  { time: 'Apr 28, 06:02', label: 'Cold chain check passed', sub: '4.1 deg C, holding', icon: Thermometer, tone: 'success' as const },
  { time: 'Apr 27, 18:30', label: 'Picked up from Chicago', sub: 'Werner driver: T. Reyes', icon: CheckCircle2, tone: 'success' as const },
  { time: 'Apr 27, 11:00', label: 'Tender accepted', sub: 'Rate: $2,840', icon: FileText, tone: 'muted' as const },
];

const TONE = {
  info: 'border-info/30 bg-info/10 text-info',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  muted: 'border-border bg-muted text-muted-foreground',
};

export function ShipmentDetailPage({ onNavigate }: Props) {
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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-3xl font-bold tracking-tight">SHIP-1042</h1>
            <Badge variant="info">In transit</Badge>
            <Badge variant="muted">Reefer</Badge>
          </div>
          <p className="mt-2 text-muted-foreground">
            Acme Foods &middot; Chicago, IL <span className="px-1">&rarr;</span> Atlanta, GA
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Documents</Button>
          <Button variant="outline">Tender history</Button>
          <Button variant="gradient">Mark delivered</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Route &amp; ETA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-64 items-center justify-center rounded-md border border-dashed bg-muted/30 text-muted-foreground">
                <div className="text-center">
                  <MapPin className="mx-auto h-8 w-8" />
                  <div className="mt-2 text-sm">Live map placeholder</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Current ETA
                  </div>
                  <div className="mt-1 text-xl font-semibold">18:30 EDT</div>
                  <div className="text-xs text-muted-foreground">12 min ahead</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Distance left
                  </div>
                  <div className="mt-1 text-xl font-semibold">112 mi</div>
                  <div className="text-xs text-muted-foreground">on planned corridor</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Reefer temp
                  </div>
                  <div className="mt-1 text-xl font-semibold">4.1&deg;C</div>
                  <div className="text-xs text-success">Within range</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="stops">Stops</TabsTrigger>
              <TabsTrigger value="charges">Charges</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="edi">EDI</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <Card>
                <CardContent className="p-6">
                  <ol className="relative space-y-6 border-l border-border pl-6">
                    {TIMELINE.map((event, idx) => {
                      const Icon = event.icon;
                      return (
                        <li key={idx} className="relative">
                          <span
                            className={`absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full border ${TONE[event.tone]}`}
                          >
                            <Icon className="h-3 w-3" />
                          </span>
                          <div className="text-xs uppercase tracking-wider text-muted-foreground">
                            {event.time}
                          </div>
                          <div className="mt-1 text-sm font-medium">{event.label}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{event.sub}</div>
                        </li>
                      );
                    })}
                  </ol>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stops">
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Two stops planned. Pickup at Acme Chicago DC, delivery at Acme Atlanta DC.
                  Stop sequence editor would render here.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="charges">
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Linehaul + fuel surcharge + 2 accessorials. Margin 18.4%. Charge editor would
                  render here.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  BOL, POD, weight ticket. Document library would render here.
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="edi">
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  204 sent, 990 received, last 214 5 minutes ago. EDI log would render here.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Carrier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="font-semibold">Werner Enterprises</div>
                <div className="text-xs text-muted-foreground">Driver: T. Reyes</div>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  +1 (402) 555-0142
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  dispatch@werner.example
                </div>
              </div>
              <Button variant="outline" className="w-full">
                Contact driver
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SLA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Promised</span>
                <span className="font-medium">Apr 28, 19:00</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Predicted</span>
                <span className="font-medium text-success">18:30 (-30m)</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Buffer</span>
                <span className="font-medium">30 min</span>
              </div>
              <div className="rounded-md border border-success/20 bg-success/10 p-3 text-xs text-success">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  On track
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-warning/20 bg-warning/10 p-3 text-xs">
                <div className="flex items-start gap-2 text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <div className="font-medium">Reefer briefly drifted to 7.8&deg;C</div>
                    <div className="mt-1 text-muted-foreground">Resolved at 11:43 EDT.</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last update</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />4 minutes ago
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
