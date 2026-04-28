import React, { useState } from 'react';
import { Truck, Plus, Trash2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { GradientText } from '@/components/brand/GradientText';

const COLOR_TOKENS = [
  { name: 'primary', label: 'Primary', tone: 'bg-primary text-primary-foreground' },
  { name: 'secondary', label: 'Secondary', tone: 'bg-secondary text-secondary-foreground' },
  { name: 'accent', label: 'Accent', tone: 'bg-accent text-accent-foreground' },
  { name: 'destructive', label: 'Destructive', tone: 'bg-destructive text-destructive-foreground' },
  { name: 'success', label: 'Success', tone: 'bg-success text-success-foreground' },
  { name: 'warning', label: 'Warning', tone: 'bg-warning text-warning-foreground' },
  { name: 'info', label: 'Info', tone: 'bg-info text-info-foreground' },
  { name: 'muted', label: 'Muted', tone: 'bg-muted text-muted-foreground' },
];

const BUTTON_VARIANTS = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'gradient'] as const;
const BADGE_VARIANTS = ['default', 'secondary', 'destructive', 'outline', 'success', 'warning', 'info', 'muted'] as const;

export default function VNextStyleGuide() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <GradientText>Style guide</GradientText>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reference page for shadcn/ui primitives in the Open TMS frontend.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Typography</h2>
        <Card>
          <CardContent className="space-y-2 p-6">
            <h1 className="text-3xl font-bold tracking-tight">Page heading (3xl bold)</h1>
            <h2 className="text-xl font-semibold">Section heading (xl semibold)</h2>
            <p className="text-sm">Body text (sm) - The quick brown fox jumps over the lazy dog.</p>
            <p className="text-xs text-muted-foreground">Muted small label (xs)</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tiny uppercase label</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Color tokens</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {COLOR_TOKENS.map(c => (
            <div key={c.name} className={`rounded-md p-4 ${c.tone}`}>
              <div className="text-sm font-semibold">{c.label}</div>
              <div className="text-xs opacity-80">{c.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Buttons</h2>
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-6">
            {BUTTON_VARIANTS.map(v => (
              <Button key={v} variant={v}>{v}</Button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-6">
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon"><Plus className="h-4 w-4" /></Button>
            <Button variant="gradient">
              <Truck className="h-4 w-4" />
              With icon
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Badges</h2>
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-6">
            {BADGE_VARIANTS.map(v => (
              <Badge key={v} variant={v}>{v}</Badge>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Cards</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Simple card</CardTitle>
              <CardDescription>With a description below the title.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Card body content goes here.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Card with action</CardTitle>
                <CardDescription>Header has a button on the right.</CardDescription>
              </div>
              <Button variant="outline" size="sm">Action</Button>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <p className="text-sm">Footer-style content separated by a divider.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Form fields</h2>
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Text input</Label>
                <Input placeholder="Type something..." />
              </div>
              <div className="space-y-2">
                <Label>Select</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">Option A</SelectItem>
                    <SelectItem value="b">Option B</SelectItem>
                    <SelectItem value="c">Option C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Textarea</Label>
                <textarea
                  rows={4}
                  placeholder="Long form input..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Checkboxes and radios</Label>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 rounded border border-input bg-background accent-primary"
                  />
                  Checkbox
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="demo-radio"
                    defaultChecked
                    className="h-4 w-4 border border-input bg-background accent-primary"
                  />
                  Radio A
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="demo-radio"
                    className="h-4 w-4 border border-input bg-background accent-primary"
                  />
                  Radio B
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Tabs</h2>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <Card><CardContent className="p-6 text-sm">Overview content.</CardContent></Card>
          </TabsContent>
          <TabsContent value="details" className="mt-4">
            <Card><CardContent className="p-6 text-sm">Details content.</CardContent></Card>
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <Card><CardContent className="p-6 text-sm">Settings content.</CardContent></Card>
          </TabsContent>
        </Tabs>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Tables</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3].map(i => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">SHP-{i.toString().padStart(4, '0')}</TableCell>
                    <TableCell>Sample row {i}</TableCell>
                    <TableCell><Badge variant="success">Active</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Alerts</h2>
        <div className="space-y-2">
          {[
            { tone: 'border-success/30 bg-success/10 text-success', Icon: CheckCircle2, msg: 'Operation completed successfully.' },
            { tone: 'border-destructive/30 bg-destructive/10 text-destructive', Icon: AlertTriangle, msg: 'Something went wrong.' },
            { tone: 'border-warning/30 bg-warning/10 text-warning', Icon: AlertTriangle, msg: 'Heads up - this needs attention.' },
            { tone: 'border-info/30 bg-info/10 text-info', Icon: Info, msg: 'Just a friendly note.' },
          ].map((a, i) => (
            <div key={i} className={`flex items-start gap-2 rounded-md border p-3 text-sm ${a.tone}`}>
              <a.Icon className="h-4 w-4 shrink-0" />
              <span>{a.msg}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Modal</h2>
        <Button variant="outline" onClick={() => setModalOpen(true)}>Open dialog</Button>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Example dialog</DialogTitle>
              <DialogDescription>This is a sample modal with header, body, and footer.</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Body content goes here.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="gradient" onClick={() => setModalOpen(false)}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
