import React, { useState } from 'react';
import {
  BarChart3,
  CreditCard,
  DollarSign,
  Download,
  Receipt,
  Truck,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ExportOption {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  endpoint: string;
  supportsDateRange: boolean;
  extraParams?: { key: string; label: string; options: { value: string; label: string }[] }[];
}

const EXPORTS: ExportOption[] = [
  {
    key: 'invoices',
    label: 'Invoice Register',
    description: 'All customer invoices with line item detail - totals, payment status, balances',
    icon: Receipt,
    endpoint: '/api/v1/reports/export/invoices',
    supportsDateRange: true,
    extraParams: [{ key: 'status', label: 'Status', options: [
      { value: 'all', label: 'All' }, { value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' },
      { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' }, { value: 'void', label: 'Void' },
    ]}],
  },
  {
    key: 'carrier-invoices',
    label: 'Carrier Invoice Register',
    description: 'All carrier invoices with freight audit results - match status, variance, line items',
    icon: Truck,
    endpoint: '/api/v1/reports/export/carrier-invoices',
    supportsDateRange: true,
    extraParams: [{ key: 'status', label: 'Status', options: [
      { value: 'all', label: 'All' }, { value: 'received', label: 'Received' }, { value: 'approved', label: 'Approved' },
      { value: 'paid', label: 'Paid' }, { value: 'discrepancy', label: 'Discrepancy' },
    ]}],
  },
  {
    key: 'payments',
    label: 'Payment Ledger',
    description: 'All customer payments received - date, invoice, amount, method, reference',
    icon: CreditCard,
    endpoint: '/api/v1/reports/export/payments',
    supportsDateRange: true,
  },
  {
    key: 'charges',
    label: 'Charge Detail',
    description: 'All revenue and cost charges across shipments - for margin analysis and reconciliation',
    icon: DollarSign,
    endpoint: '/api/v1/reports/export/charges',
    supportsDateRange: true,
    extraParams: [{ key: 'chargeCategory', label: 'Category', options: [
      { value: 'all', label: 'All' }, { value: 'revenue', label: 'Revenue' }, { value: 'cost', label: 'Cost' },
    ]}],
  },
  {
    key: 'ar-aging',
    label: 'AR Aging',
    description: 'Outstanding invoices bucketed by days past due per customer',
    icon: BarChart3,
    endpoint: '/api/v1/reports/ar-aging/csv',
    supportsDateRange: false,
  },
];

export default function VNextFinanceExports() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({});

  const download = (exp: ExportOption) => {
    const params = new URLSearchParams();
    if (exp.supportsDateRange) {
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
    }
    if (exp.extraParams) {
      for (const p of exp.extraParams) {
        const val = extraFilters[`${exp.key}-${p.key}`];
        if (val && val !== 'all') params.set(p.key, val);
      }
    }
    const qs = params.toString();
    window.open(`${API_URL}${exp.endpoint}${qs ? '?' + qs : ''}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Exports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Download CSV files for your accounting system</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-base font-semibold">Date Range</h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <DatePicker id="from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[170px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <DatePicker id="to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[170px]" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() - 30);
                  setDateFrom(d.toISOString().slice(0, 10)); setDateTo(today);
                }}
              >
                Last 30 days
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() - 90);
                  setDateFrom(d.toISOString().slice(0, 10)); setDateTo(today);
                }}
              >
                Last 90 days
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDateFrom(`${new Date().getFullYear()}-01-01`); setDateTo(today);
                }}
              >
                Year to date
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {EXPORTS.map(exp => {
          const Icon = exp.icon;
          return (
            <Card key={exp.key} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', 'bg-primary/10 text-primary')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">{exp.label}</h3>
                </div>
                <p className="mb-4 flex-1 text-sm text-muted-foreground">{exp.description}</p>

                {exp.extraParams && (
                  <div className="mb-3 space-y-2">
                    {exp.extraParams.map(p => (
                      <Select
                        key={p.key}
                        value={extraFilters[`${exp.key}-${p.key}`] || 'all'}
                        onValueChange={v => setExtraFilters(prev => ({ ...prev, [`${exp.key}-${p.key}`]: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {p.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ))}
                  </div>
                )}

                <Button variant="outline" className="w-full" onClick={() => download(exp)}>
                  <Download className="h-4 w-4" />
                  Download CSV
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
