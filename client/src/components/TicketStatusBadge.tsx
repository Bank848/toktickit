import { Icon, type IconName } from './Icon';

// Status is always shown as text plus an icon, never color alone (ui-spec.md §1/§5/§6, WCAG 2.2
// AA "use of color" -- a colorblind reader or a monochrome printout must still be able to tell
// statuses apart). Badge surfaces use tone classes (Pale green/neutral/warning/danger/dark), never
// raw Primary/Secondary, which ui-spec.md §1 reserves for header/primary-action chrome.
const STATUS_META: Record<string, { label: string; icon: IconName; badgeClass: string }> = {
  NEW: { label: 'New', icon: 'circle-fill', badgeClass: 'badge-tone-info' },
  ASSIGNED: { label: 'Assigned', icon: 'person-check', badgeClass: 'badge-tone-info' },
  IN_PROGRESS: { label: 'In Progress', icon: 'arrow-repeat', badgeClass: 'badge-tone-warning' },
  PENDING_REQUESTER: { label: 'Pending Requester', icon: 'pause-circle-fill', badgeClass: 'badge-tone-neutral' },
  RESOLVED: { label: 'Resolved', icon: 'check-circle-fill', badgeClass: 'badge-tone-success' },
  CLOSED: { label: 'Closed', icon: 'dash-circle-fill', badgeClass: 'badge-tone-dark' },
  CANCELLED: { label: 'Cancelled', icon: 'x-circle-fill', badgeClass: 'badge-tone-danger' },
};

// Reused by MyTicketsPage's status multi-select so the filter's option labels never drift from
// the badge's labels.
export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

function renderBadge(meta: { label: string; icon: IconName; badgeClass: string }) {
  return (
    <span className={`badge rounded-pill ${meta.badgeClass}`}>
      <Icon name={meta.icon} />
      {meta.label}
    </span>
  );
}

export function TicketStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, icon: 'circle-fill' as IconName, badgeClass: 'badge-tone-neutral' };
  return renderBadge(meta);
}

// Requested Priority / IT Priority are a separate value space from ticket Status (LOW/MEDIUM/
// HIGH/URGENT vs NEW/ASSIGNED/...), so they get their own meta map -- folding them into
// STATUS_META would leak priority values into MyTicketsPage's status filter via STATUS_OPTIONS.
const PRIORITY_META: Record<string, { label: string; icon: IconName; badgeClass: string }> = {
  LOW: { label: 'Low', icon: 'dash-circle-fill', badgeClass: 'badge-tone-neutral' },
  MEDIUM: { label: 'Medium', icon: 'circle-fill', badgeClass: 'badge-tone-info' },
  HIGH: { label: 'High', icon: 'exclamation-triangle-fill', badgeClass: 'badge-tone-warning' },
  URGENT: { label: 'Urgent', icon: 'exclamation-triangle-fill', badgeClass: 'badge-tone-danger' },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority] ?? { label: priority, icon: 'circle-fill' as IconName, badgeClass: 'badge-tone-neutral' };
  return renderBadge(meta);
}
