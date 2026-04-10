# VNext Design System

The vnext design system powers the next-generation Open TMS interface. It is built entirely on CSS classes (prefixed `vn-`) that consume the same CSS custom properties defined in `theme.css`. No CSS-in-JS, no styled-components.

---

## Design Tokens

All colours come from `theme.css` `:root`. Never hardcode values.

| Token | Usage |
|-------|-------|
| `--primary`, `--on-primary` | Primary actions, active states |
| `--success`, `--success-container`, `--on-success-container` | Positive status |
| `--warning`, `--warning-container`, `--on-warning-container` | Caution status |
| `--error`, `--error-container`, `--on-error-container` | Errors, danger |
| `--info`, `--info-container`, `--on-info-container` | Informational |
| `--secondary`, `--on-secondary` | Secondary accent |
| `--surface-container-lowest` | Card/modal backgrounds |
| `--surface-container` | Subtle backgrounds (table headers, hover) |
| `--surface-container-high` | Elevated surfaces |
| `--on-surface` | Primary text |
| `--on-surface-variant` | Secondary text, labels |
| `--outline-variant` | Borders, dividers |
| `--background` | Page background |
| `--overlay-bg` | Modal backdrop |
| `--shadow-1`, `--shadow-2` | Elevation |
| `--border-radius-sm` (8px) | Cards, inputs |
| `--border-radius-md` (16px) | Modals |
| `--border-radius-full` (30px) | Pills, avatars |

**Spacing:** 8px base unit. Common values: 4, 8, 12, 16, 20, 24, 32px.

**Typography:**
- Page heading: 28px / 700 / -0.5px tracking
- Card heading: 16px / 600
- Body: 14px / 400
- Small label: 13px / 500
- Tiny label: 12px / 600 / uppercase / 0.5-0.8px tracking

---

## Layout Shell

```html
<div class="vn-shell">
  <aside class="vn-sidebar">
    <div class="vn-sidebar-brand">
      <span class="material-icons">hub</span>
      Open TMS
    </div>
    <div class="vn-sidebar-section">Operations</div>
    <nav class="vn-sidebar-nav">
      <a href="/vnext" class="active">
        <span class="material-icons">space_dashboard</span>
        Dashboard
      </a>
      <!-- more links -->
    </nav>
  </aside>

  <div class="vn-mobile-overlay"></div>

  <div class="vn-main">
    <header class="vn-topbar">
      <button class="vn-topbar-hamburger">
        <span class="material-icons">menu</span>
      </button>
      <div class="vn-topbar-search">
        <span class="material-icons">search</span>
        <input placeholder="Search..." />
      </div>
      <div class="vn-topbar-actions">
        <button class="vn-btn-icon">
          <span class="material-icons">notifications_none</span>
          <span class="vn-notif-dot"></span>
        </button>
        <div class="vn-topbar-avatar">JD</div>
      </div>
    </header>

    <main class="vn-content">
      <!-- page content -->
    </main>
  </div>
</div>
```

- Sidebar: 260px fixed left, collapses to drawer on mobile (768px)
- Topbar: 56px sticky, hamburger visible on mobile only
- Content: max-width 1440px, centered, 24px padding

---

## Page Structure

```html
<div class="vn-page-header">
  <div>
    <h1>Shipments</h1>
  </div>
  <div class="vn-page-actions">
    <button class="vn-btn vn-btn-outline">Export</button>
    <button class="vn-btn vn-btn-primary">
      <span class="material-icons">add</span>
      New Shipment
    </button>
  </div>
</div>

<!-- Stats row -->
<div class="vn-stats">
  <div class="vn-stat">
    <div class="vn-stat-icon primary">
      <span class="material-icons">local_shipping</span>
    </div>
    <div>
      <div class="vn-stat-value">1,247</div>
      <div class="vn-stat-label">Total Shipments</div>
      <div class="vn-stat-change up">
        <span class="material-icons">trending_up</span> 12% vs last month
      </div>
    </div>
  </div>
  <!-- more stats: success, warning, error, info variants -->
</div>
```

---

## Components

### Buttons

```html
<button class="vn-btn vn-btn-primary">Primary</button>
<button class="vn-btn vn-btn-outline">Outline</button>
<button class="vn-btn vn-btn-ghost">Ghost</button>
<button class="vn-btn vn-btn-success">Success</button>
<button class="vn-btn vn-btn-danger">Danger</button>
<button class="vn-btn vn-btn-sm vn-btn-outline">Small</button>
<button class="vn-btn vn-btn-icon"><span class="material-icons">edit</span></button>
```

### Cards

```html
<div class="vn-card">
  <div class="vn-card-header">
    <h2>Title</h2>
    <button class="vn-btn vn-btn-sm vn-btn-outline">Action</button>
  </div>
  <div class="vn-card-body">Content</div>
</div>

<!-- Flush card (no body padding, for tables) -->
<div class="vn-card">
  <div class="vn-card-header"><h2>Table Title</h2></div>
  <div class="vn-card-flush">
    <div class="vn-table-wrap">...</div>
  </div>
</div>
```

### Chips

```html
<span class="vn-chip vn-chip-success">Delivered</span>
<span class="vn-chip vn-chip-warning">In Transit</span>
<span class="vn-chip vn-chip-error">Exception</span>
<span class="vn-chip vn-chip-info">Pending</span>
<span class="vn-chip vn-chip-primary">Active</span>
<span class="vn-chip vn-chip-secondary">FTL</span>
```

### Data Tables

```html
<div class="vn-table-wrap">
  <table class="vn-table">
    <thead>
      <tr>
        <th>ID</th>
        <th>Route</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="vn-table-id">SHP-001</span></td>
        <td>
          Chicago, IL
          <span class="vn-table-secondary">Origin Warehouse</span>
        </td>
        <td><span class="vn-chip vn-chip-success">Delivered</span></td>
      </tr>
    </tbody>
  </table>
</div>
```

### Filter Bar

```html
<div class="vn-filters">
  <div class="vn-filter-group">
    <span class="material-icons">search</span>
    <input class="vn-filter-input" placeholder="Search..." />
  </div>
  <select class="vn-filter-select">
    <option>All Status</option>
    <option>Active</option>
    <option>Archived</option>
  </select>
  <div style="margin-left: auto;">
    <button class="vn-btn vn-btn-icon"><span class="material-icons">view_list</span></button>
    <button class="vn-btn vn-btn-icon"><span class="material-icons">map</span></button>
  </div>
</div>
```

### Tabs

```html
<div class="vn-tabs">
  <button class="vn-tab active">Events</button>
  <button class="vn-tab">Documents</button>
  <button class="vn-tab">Financials</button>
  <button class="vn-tab">Notes</button>
</div>
```

### Timeline

```html
<div class="vn-timeline">
  <div class="vn-timeline-item">
    <div class="vn-timeline-dot success"></div>
    <div class="vn-timeline-time">10:30 AM</div>
    <div class="vn-timeline-title">Delivered</div>
    <div class="vn-timeline-desc">Package signed for by J. Smith</div>
    <div class="vn-timeline-location">
      <span class="material-icons">place</span>
      123 Main St, Chicago IL
    </div>
  </div>
  <!-- dot variants: success, warning, error, info, primary -->
</div>
```

### Kanban Board

```html
<div class="vn-kanban">
  <div class="vn-kanban-col col-new">
    <div class="vn-kanban-col-header">
      New <span class="vn-count">3</span>
    </div>
    <div class="vn-kanban-cards">
      <div class="vn-kanban-card">
        <div class="vn-kanban-card-title">Late delivery SHP-042</div>
        <div class="vn-kanban-card-meta">
          <span class="vn-chip vn-chip-error vn-chip-sm">High</span>
        </div>
        <div class="vn-kanban-card-footer">
          <span>2h ago</span>
          <div class="vn-kanban-card-assignee">JS</div>
        </div>
      </div>
    </div>
  </div>
  <!-- column variants: col-new, col-investigating, col-escalated, col-resolved -->
</div>
```

### Progress Bar

```html
<div class="vn-progress">
  <div class="vn-progress-bar success" style="width: 75%"></div>
</div>
<!-- bar variants: success, warning, error, info, primary -->
```

### Route Indicators

```html
<div class="vn-route">
  <span class="vn-route-dot origin"></span>
  <span class="vn-route-line active"></span>
  <span class="vn-route-dot destination"></span>
</div>
<!-- dot variants: origin (green), destination (red), stop (orange) -->
```

### Info Grid

```html
<div class="vn-info-grid">
  <div class="vn-info-item">
    <label>Customer</label>
    <span>Acme Corp</span>
  </div>
  <div class="vn-info-item">
    <label>Weight</label>
    <span>2,400 kg</span>
  </div>
</div>
```

### Detail Layout

```html
<div class="vn-detail-grid">
  <div class="vn-detail-main">
    <!-- Main content cards -->
  </div>
  <div class="vn-detail-sidebar">
    <!-- Sticky sidebar cards -->
  </div>
</div>
```

Sidebar is sticky at `top: 80px`. At 1024px, collapses to single column.

### Maps

```html
<div class="vn-map"><!-- Leaflet renders here --></div>
<div class="vn-map tall"><!-- 400px height --></div>
<div class="vn-map full"><!-- 500px height --></div>
```

### Empty State

```html
<div class="vn-empty">
  <span class="material-icons">inbox</span>
  <h3>No shipments found</h3>
  <p>Try adjusting your filters</p>
</div>
```

---

## Forms

Top-label fields. Never floating labels.

### Basic Input

```html
<div class="vn-field">
  <label class="vn-field-label">Company Name <span class="required">*</span></label>
  <input class="vn-input" placeholder="Enter company name" />
  <span class="vn-field-hint">Legal entity name</span>
</div>
```

### Error State

```html
<div class="vn-field vn-field-error">
  <label class="vn-field-label">Email</label>
  <input class="vn-input" value="invalid" />
  <span class="vn-field-hint">Please enter a valid email address</span>
</div>
```

### Select

```html
<div class="vn-field">
  <label class="vn-field-label">Country</label>
  <select class="vn-select">
    <option value="">Select country...</option>
    <option>United States</option>
    <option>United Kingdom</option>
  </select>
</div>
```

### Textarea

```html
<div class="vn-field">
  <label class="vn-field-label">Notes</label>
  <textarea class="vn-textarea" rows="4" placeholder="Add notes..."></textarea>
</div>
```

### Checkbox, Radio, Switch

```html
<label class="vn-checkbox">
  <input type="checkbox" /> Requires hazmat certification
</label>

<label class="vn-radio">
  <input type="radio" name="mode" /> FTL
</label>
<label class="vn-radio">
  <input type="radio" name="mode" /> LTL
</label>

<label class="vn-switch">
  <input type="checkbox" />
  <span class="vn-switch-track"></span>
  Enable notifications
</label>
```

### Form Layout

```html
<div class="vn-form-section">
  <div class="vn-form-section-title">
    <span class="material-icons">business</span>
    Company Information
  </div>
  <div class="vn-form-grid">
    <div class="vn-field">
      <label class="vn-field-label">Name</label>
      <input class="vn-input" />
    </div>
    <div class="vn-field">
      <label class="vn-field-label">Email</label>
      <input class="vn-input" type="email" />
    </div>
    <div class="vn-field vn-col-span-2">
      <label class="vn-field-label">Address</label>
      <input class="vn-input" />
    </div>
  </div>
</div>

<div class="vn-form-actions">
  <button class="vn-btn vn-btn-outline">Cancel</button>
  <button class="vn-btn vn-btn-primary">Save</button>
</div>
```

- `vn-form-grid`: 2 columns on desktop, 1 on mobile
- `vn-col-span-2`: full-width field spanning both columns

---

## Modals

```html
<div class="vn-modal-backdrop">
  <div class="vn-modal"><!-- default 520px -->
    <div class="vn-modal-header">
      <h2>Confirm Delete</h2>
      <button class="vn-modal-close">
        <span class="material-icons">close</span>
      </button>
    </div>
    <div class="vn-modal-body">
      Are you sure you want to delete this shipment?
    </div>
    <div class="vn-modal-footer">
      <button class="vn-btn vn-btn-outline">Cancel</button>
      <button class="vn-btn vn-btn-danger">Delete</button>
    </div>
  </div>
</div>
```

Sizes: `vn-modal-sm` (380px), default (520px), `vn-modal-lg` (720px), `vn-modal-xl` (960px).

---

## Alerts

```html
<div class="vn-alert vn-alert-success">
  <span class="material-icons">check_circle</span>
  <div class="vn-alert-content">Shipment created successfully.</div>
  <button class="vn-alert-dismiss">
    <span class="material-icons">close</span>
  </button>
</div>
<!-- variants: vn-alert-success, vn-alert-error, vn-alert-warning, vn-alert-info -->
```

---

## Responsive Breakpoints

| Breakpoint | Changes |
|-----------|---------|
| 1024px | Detail grid goes single column, sidebar un-sticks |
| 768px | Sidebar becomes drawer, hamburger visible, content padding 16px, form grid 1 column, stats wrap |
| 480px | Single-column everything, search hidden, icons reduced |

---

## Page Patterns

**List page:** Page header + stats row + card with filter bar + table (optional map toggle)
**Detail page:** Page header + detail grid (main content cards + sticky sidebar)
**Kanban page:** Page header + stats row + kanban board (with table toggle)
**Form page:** Page header (with breadcrumb) + card with form sections + form actions
**Dashboard:** Page header + stats row + grid of cards with tables/charts

---

## Icons

Use Material Icons via `<span class="material-icons">icon_name</span>`.

Common TMS icons:
- `local_shipping` (shipments), `receipt_long` (orders), `location_on` (locations)
- `route` (lanes), `airport_shuttle` (carriers), `people` (customers)
- `description` (documents), `bug_report` (issues), `gavel` (bidding)
- `analytics` (reports), `settings` (settings), `palette` (style guide)
- `add`, `edit`, `delete`, `search`, `filter_list`, `download`, `upload`
- `check_circle`, `warning`, `error`, `info`, `help_outline`
- `trending_up`, `trending_down`, `arrow_back`, `arrow_forward`

---

## React Components

Optional thin wrappers in `frontend/src/vnext-design/components/`. Import from the barrel:

```tsx
import { VnButton, VnCard, VnChip, VnDataTable, VnModal } from '../vnext-design/components';
```

These are convenience wrappers — you can always use the raw CSS classes directly.
