# Dayflow UI Component Library

Reusable primitives in `frontend/src/components/ui/`. Built by Member 4
(`feature/frontend-ui`) for consumption by `feature/frontend`.

All components use the global `--df-*` design tokens from `src/index.css`,
so they inherit the app theme automatically.

## Import

```jsx
import { Button, Card, DataTable, StatusDot } from '../components/ui/index.js'
```

## Components

### Button

Action button. Shows an inline spinner when `loading` (button is disabled while loading).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'ghost'` | `'primary'` | |
| `size` | `'sm' \| 'md'` | `'md'` | |
| `loading` | bool | `false` | |
| `type` | string | `'button'` | pass `'submit'` inside forms |

```jsx
<Button variant="danger" loading={busy} onClick={reject}>Reject</Button>
```

### Card / StatCard

`Card` is a bordered surface with optional header (`title`, `actions`). `StatCard`
is a dashboard metric tile: `label`, `value`, `hint`, optional hint `tone`
(`'success' | 'warning' | 'danger'`).

```jsx
<StatCard label="Present today" value="42" hint="+3 vs yesterday" tone="success" />
```

### Badge / StatusDot

- `Badge`: pill label, `tone`: `'success' | 'warning' | 'danger' | 'info' | 'neutral'`.
- `StatusDot`: wireframe employee status indicator.
  `status`: `'present'` (green dot) · `'absent'` (yellow dot) · `'leave'` (plane icon) · `'off'`.
  Optional `label` override.

```jsx
<StatusDot status="leave" />
```

### Avatar

Circular avatar from `name` (initials fallback) or `src` image. `size`: `'sm' | 'md' | 'lg'`.

### Form fields

Shared API: `id`, `label`, `required`, `error`, `hint`, `value`, `onChange`, `disabled`.
Error text replaces hint text and colors the control border.

- `TextField` — pass `type` (`text`, `email`, `password`, ...), `autoComplete`
- `SelectField` — `options`: `[{ value, label }]` or plain strings
- `DateField` — native date picker, value `YYYY-MM-DD`; supports `min`/`max`
- `TextAreaField` — `rows` (default 3)
- `FileField` — shows chosen filename; use `accept` (e.g. sick-leave attachments)

```jsx
<TextField id="phone" label="Mobile" required error={errors.phone} value={form.phone}
  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
<FileField id="doc" label="Attachment" accept=".pdf,.png,.jpg"
  hint="Required for sick leave" />
```

### DataTable

Read-only table. Integrates the existing `EmptyState` automatically.

| Prop | Type | Notes |
|---|---|---|
| `columns` | `{ key, label, align?: 'right', width?, render?(row) }[]` | |
| `rows` | array | |
| `rowKey` | `(row) => id` | defaults to `row.id` |
| `empty` | node | custom empty state |
| `clickableRows` | bool | pointer cursor |

```jsx
<DataTable
  columns={[
    { key: 'employee', label: 'Employee', render: (r) => <Avatar name={r.name} size="sm" /> },
    { key: 'status', label: 'Status', render: (r) => <StatusDot status={r.status} /> },
    { key: 'days', label: 'Days present', align: 'right' },
  ]}
  rows={employees}
/>
```

### Modal / ConfirmDialog

`Modal` closes on Escape/overlay click; `footer` prop for action buttons;
`wide` doubles max width. `ConfirmDialog` wraps it for approve/reject flows:
`title`, `message`, `confirmLabel`, `tone` (`'primary' | 'danger'`), `busy`.

```jsx
<ConfirmDialog open={open} onClose={close} onConfirm={approve}
  title="Approve leave?" message="5 days paid leave for Aarav Shah."
  confirmLabel="Approve" busy={approving} />
```

### Tabs

Underline tab strip for multi-tab profiles. Controlled:

```jsx
<Tabs items={[{ id: 'general', label: 'General' }, { id: 'private', label: 'Private Info' }]}
  activeId={tab} onChange={setTab} />
```

### Skeleton

Loading placeholder block: `width`, `height`, `radius`. Compose several to
skeleton-screen a card or table row.

## Conventions

- One component per file, default export; barrel re-exports everything.
- Styling lives in `ui.css`, BEM-ish classes prefixed by component (`.btn__spinner`).
- No business logic inside primitives — pages own data fetching and rules,
  per `docs/api.md` contract.
