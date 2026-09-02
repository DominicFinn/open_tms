/**
 * Issue a public share link for a shipment.
 *
 * Two steps. Pick what the recipient can see and how long the link lasts, then read back the URL
 * and the access code. The access code is only ever shown on that second step: the server keeps a
 * hash of it, so once this dialog closes it cannot be retrieved, only replaced.
 */

import { useState } from 'react';
import { Check, Copy, Link2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  SHIPMENT_SHARE_SECTIONS,
  SHIPMENT_SHARE_SECTION_LABELS,
  SHIPMENT_SHARE_SECTION_DESCRIPTIONS,
  ShipmentShareSection,
} from '@open-tms/shared';
import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const DURATION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

const DEFAULT_SECTIONS: ShipmentShareSection[] = ['overview', 'events'];

interface IssuedLink {
  url: string;
  accessCode: string;
}

interface ShareShipmentDialogProps {
  shipmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a link is issued so the Shared links tab can refresh. */
  onIssued?: () => void;
}

export function ShareShipmentDialog({
  shipmentId,
  open,
  onOpenChange,
  onIssued,
}: ShareShipmentDialogProps) {
  const [sections, setSections] = useState<ShipmentShareSection[]>(DEFAULT_SECTIONS);
  const [days, setDays] = useState('14');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<IssuedLink | null>(null);

  const toggleSection = (section: ShipmentShareSection, checked: boolean) => {
    setSections((current) =>
      checked ? [...current, section] : current.filter((s) => s !== section)
    );
  };

  const reset = () => {
    setSections(DEFAULT_SECTIONS);
    setDays('14');
    setLabel('');
    setIssued(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + Number(days) * 86_400_000).toISOString();
      const res = await fetch(`${API_URL}/api/v1/shipments/${shipmentId}/share-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections, expiresAt, label: label.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Could not create the share link');
        return;
      }
      setIssued({ url: json.data.url, accessCode: json.data.accessCode });
      onIssued?.();
    } catch {
      toast.error('Could not create the share link');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        {issued ? (
          <IssuedLinkPanel issued={issued} onDone={() => handleOpenChange(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Share this shipment</DialogTitle>
              <DialogDescription>
                Anyone with the link and the access code can see the sections you pick. Financials,
                customs paperwork and internal activity are never shared.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label>What they can see</Label>
                <div className="space-y-3">
                  {SHIPMENT_SHARE_SECTIONS.map((section) => (
                    <div key={section} className="flex items-start gap-3">
                      <Checkbox
                        id={`share-section-${section}`}
                        checked={sections.includes(section)}
                        onCheckedChange={(checked) => toggleSection(section, checked === true)}
                        className="mt-1"
                      />
                      <div className="space-y-0.5">
                        <Label
                          htmlFor={`share-section-${section}`}
                          className="cursor-pointer font-medium"
                        >
                          {SHIPMENT_SHARE_SECTION_LABELS[section]}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {SHIPMENT_SHARE_SECTION_DESCRIPTIONS[section]}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {sections.length === 0 && (
                  <p className="text-xs text-destructive">Pick at least one section to share.</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="share-duration">Link expires after</Label>
                  <Select value={days} onValueChange={setDays}>
                    <SelectTrigger id="share-duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="share-label">Note (optional)</Label>
                  <Input
                    id="share-label"
                    value={label}
                    maxLength={120}
                    placeholder="Who it's for"
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || sections.length === 0}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Create link
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IssuedLinkPanel({ issued, onDone }: { issued: IssuedLink; onDone: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Link ready</DialogTitle>
        <DialogDescription>
          Send the link and the access code separately. The code is shown here once and cannot be
          looked up again.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <CopyableField label="Link" value={issued.url} />
        <Separator />
        <CopyableField label="Access code" value={issued.accessCode} mono />
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The recipient enters their email address with the code, and every attempt is recorded on
          the shipment.
        </p>
      </div>

      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
}

function CopyableField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className={mono ? 'font-mono tracking-widest' : undefined} />
        <Button variant="outline" size="icon" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
