# Feature-F — Attachments

**Identity.** FEAT-F, Attachments, v1.0, Lab 2.
**Traceability.** FR-11, FR-20…FR-24 · BR-08, BR-09, BR-15 · NFR-01, NFR-03, NFR-08 · D-06, D-11,
D-20b.
**Behavior.** Actor: any user who can read the ticket (upload, from Create Ticket per Feature-B
or from Ticket Detail); the uploader only (removal). Upload with client-side pre-checks (size,
extension) that are advisory only — the server re-validates everything. Progress/disabled state
during upload. List shows filename, size, uploader, date, Download, and Remove (only on the
viewer's own active uploads). **Removal is a soft removal requiring a reason**: it opens a
confirmation dialog with a required reason field (1..200 chars, submit disabled until non-empty),
and on confirm the attachment's metadata — filename, uploader, upload date, removal reason,
remover, removal date — **stays visible** in the list, clearly marked as removed, with
preview/download replaced by a disabled control; an `ATTACHMENT_REMOVED` audit event is written
(not displayed anywhere in Lab 2 — no Event Log exists, per D-22). The row is never hidden or
removed from the list, and the binary is deleted from storage so it can never be served again.
**Permissions.** Upload: the currently selected Development Requester, for any ticket they can
read. Removal: uploader only (attachment.uploadedById === req.user.id), and only while
ticket.status !== 'CLOSED' (Lab 2), and only with a non-empty reason. Any other Development
Requester gets 403 on removal — Lab 2 has no role-based access control (D-21), so this is a flat
"uploader only" rule with no elevated-role exception to half-implement. Download: anyone who can read the ticket, via the authenticated
content endpoint only, and only while the attachment is active (410 once removed).
**Workflow.** No status impact; attachment add/remove writes an audit event but does not change
ticket status.
**Data.** Attachment tombstones (never row-deleted, deletedAt/deletedById/deletedReason set
instead — `deletedReason` is required and non-empty whenever `deletedAt` is set), ATTACHMENT_ADDED
/ ATTACHMENT_REMOVED events.
**API.** GET /api/v1/tickets/:id/attachments (#9, includes removed items), POST
/api/v1/tickets/:id/attachments (#10, multipart, field `file`), GET
/api/v1/attachments/:id/content (#11, authenticated download, active only), DELETE
/api/v1/attachments/:id (#12, soft removal, requires `{ reason }` body, returns the updated
`AttachmentDto` in its removed state). Upload validation order (fail before touching storage):
authorize -> ticket exists and accessible -> active attachment count < 5 (else 409
ATTACHMENT_LIMIT_REACHED; removed attachments don't count) -> declared size <= 5 MB via the
multer limit (else 413) -> extension in {jpg, jpeg, png, webp, pdf} and declared MIME in
{image/jpeg, image/png, image/webp, application/pdf} and magic-byte sniff of the first bytes
agrees with both (else 422 ATTACHMENT_TYPE_REJECTED). Only then write to storage under a
generated key, then insert metadata + ATTACHMENT_ADDED event in one transaction; on transaction
failure, delete the just-written object (compensating cleanup). Removal validation: authorize
(uploader only) -> ticket not Closed -> `reason` present and non-blank after trim, 1..200 chars
(else 422) -> set deletedAt/deletedById/deletedReason + write ATTACHMENT_REMOVED in one
transaction -> delete the binary from storage (if this fails, log with correlation ID and queue
retry, never restore visibility). Download headers: Content-Disposition: attachment;
filename="<sanitized original>", X-Content-Type-Options: nosniff, and serve the stored mimeType,
never a client-supplied one; never redirect to a storage URL. `downloadUrl` in the AttachmentDto
is `null` when removed, and otherwise composed as a full absolute URL from the same
API_BASE_URL the client already uses (fixes a real bug: a root-relative URL resolves against the
Vite dev origin, not the API, and 404s).
**UI.** See `ui-spec.md` §6. File input + Upload button with constraints stated in visible text
("JPG, PNG, WEBP or PDF, up to 5 MB, maximum 5 files"), count shown as "3 of 5 used" (active
only), upload control disabled at 5 active. List rows: filename, size, uploader, date, Download,
Remove (own active uploads only, with a confirm-and-reason dialog). Removed rows render
de-emphasized with a "Removed" badge, showing reason/remover/removal date, download control
disabled. Empty state (zero attachments ever): "No attachments yet."
**NFRs.** Uploads excluded from the p95 target (NFR-01). Layered validation per OWASP file-upload
guidance (NFR-08). Zen Green theme (NFR-03).
**Dependencies.** Feature-B (create-time uploads reuse this upload path), Feature-D (Ticket
Detail hosts the Attachments section), storage adapter (LocalDiskStorage per D-20b), Feature-G
(Development Requester Selection).
**Out of scope.** IT-Staff removal-with-reason for another user's upload (Lab 3), image
thumbnails/inline preview, drag-and-drop multi-file upload, virus scanning, SeaweedFS driver
enablement (interface only, D-20b), un-removing/restoring a removed attachment.
