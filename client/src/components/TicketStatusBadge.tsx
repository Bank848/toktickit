// Status is always shown as text plus an icon glyph, never color alone (ui-spec.md §5/§6, WCAG
// 2.2 AA "use of color" -- a colorblind reader or a monochrome printout must still be able to
// tell statuses apart). The icon is a plain Unicode glyph rather than a new icon-library
// dependency: bootstrap-icons/react-icons aren't installed anywhere else in this client, and one
// extra glyph doesn't earn a new package.
const STATUS_META: Record<string, { label: string; icon: string; badgeClass: string }> = {
  NEW: { label: 'New', icon: '●', badgeClass: 'text-bg-primary' },
  ASSIGNED: { label: 'Assigned', icon: '→', badgeClass: 'text-bg-info' },
  IN_PROGRESS: { label: 'In Progress', icon: '⟳', badgeClass: 'text-bg-warning' },
  PENDING_REQUESTER: { label: 'Pending Requester', icon: '⏸', badgeClass: 'text-bg-secondary' },
  RESOLVED: { label: 'Resolved', icon: '✓', badgeClass: 'text-bg-success' },
  CLOSED: { label: 'Closed', icon: '■', badgeClass: 'text-bg-dark' },
  CANCELLED: { label: 'Cancelled', icon: '✕', badgeClass: 'text-bg-danger' },
};

// Reused by MyTicketsPage's status multi-select so the filter's option labels never drift from
// the badge's labels.
export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export function TicketStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, icon: '○', badgeClass: 'text-bg-light' };
  return (
    <span className={`badge rounded-pill ${meta.badgeClass}`}>
      <span aria-hidden="true">{meta.icon} </span>
      {meta.label}
    </span>
  );
}
