# Feature-F — Attachments

**Identity.** FEAT-F, Attachments, v1.0, Lab 2.
**Traceability.** FR-012 (partial), FR-026…FR-031 · BR-012, BR-013, BR-015 · D-06, D-11, D-20b.
**Behavior.** Actor: any user who can read the ticket (upload); the uploader only (delete).
Upload from Ticket Detail with client-side pre-checks (size, extension) that are advisory only —
the server re-validates everything. Progress/disabled state during upload. List shows filename,
size, uploader, date, Download, and Delete (only on the viewer's own uploads). Deleting requires
a confirmation dialog and removes the file from the list; the removal shows in the Event Log.
**Permissions.** Upload: anyone who can read the ticket. Delete: uploader only
(attachment.uploadedById === req.user.id), and only while ticket.status !== 'CLOSED' (Lab 2). A
non-uploader, including IT_STAFF/ADMINISTRATOR, gets 403 on delete — the IT-Staff
delete-with-reason path is Lab 3, not half-implemented in Lab 2. Download: anyone who can read
the ticket, via the authenticated content endpoint only.
**Workflow.** No status impact; attachment add/remove writes an audit event but does not change
ticket status.
**Data.** Attachment tombstones (never row-deleted, deletedAt/deletedById/deletedReason set
instead), ATTACHMENT_ADDED / ATTACHMENT_REMOVED events.
**API.** GET /api/v1/tickets/:id/attachments (#9), POST /api/v1/tickets/:id/attachments (#10,
multipart, field `file`), GET /api/v1/attachments/:id/content (#11, authenticated download),
DELETE /api/v1/attachments/:id (#12). Upload validation order (fail before touching storage):
authorize -> ticket exists and accessible -> active attachment count < 5 (else 409
ATTACHMENT_LIMIT_REACHED) -> declared size <= 5 MB via the multer limit (else 413) -> extension
in {jpg, jpeg, png, webp, pdf} and declared MIME in {image/jpeg, image/png, image/webp,
application/pdf} and magic-byte sniff of the first bytes agrees with both (else 422
ATTACHMENT_TYPE_REJECTED). Only then write to storage under a generated key, then insert
metadata + ATTACHMENT_ADDED event in one transaction; on transaction failure, delete the
just-written object (compensating cleanup). Download headers: Content-Disposition:
attachment; filename="<sanitized original>", X-Content-Type-Options: nosniff, and serve the
stored mimeType, never a client-supplied one; never redirect to a storage URL. `downloadUrl` in
the AttachmentDto is composed as a full absolute URL from the same API_BASE_URL the client
already uses (fixes a real bug: a root-relative URL resolves against the Vite dev origin, not
the API, and 404s).
**UI.** W4 concern, not part of Issues 5-8. File input + Upload button with constraints stated
in visible text ("JPG, PNG, WEBP or PDF, up to 5 MB, maximum 5 files"), count shown as "3 of 5
used", upload control disabled at 5. List rows: filename, size, uploader, date, Download, Delete
(own only, with confirm dialog). Empty state "No attachments yet."
**NFRs.** Uploads excluded from the p95 target. Layered validation per OWASP file-upload
guidance.
**Dependencies.** Feature-D (Ticket Detail hosts the tab), storage adapter (LocalDiskStorage per
D-20b), identity middleware.
**Out of scope.** Attach-at-creation (see Feature-B's scoping call), IT-Staff removal-with-
reason, image thumbnails/inline preview, drag-and-drop multi-file upload, virus scanning,
SeaweedFS driver enablement (interface only, D-20b).
