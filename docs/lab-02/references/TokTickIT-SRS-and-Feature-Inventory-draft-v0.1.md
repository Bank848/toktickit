> **Status: Reference copy, as supplied for the course, with corrections layered on top.** This
> file is the SRS draft exactly as provided in `TokTickIT-SRS-and-Feature-Inventory-draft-v0.1.md`
> (prepared 18 August 2026). It predates the Lab 2 Decision Register Addendum (D-13...D-20) and
> the official Lab 2 labsheet review, so several items below (D-13 comment scope, D-17 search,
> D-19 theme) are corrected in `../decision-register-addendum.md` and consolidated in
> `../specification.md`. Where this draft conflicts with `../specification.md`, the latter wins.

# TokTickIT — Software Requirements Specification (SRS) — Draft v0.1

CPE 334 Software Engineering Course Project
Prepared: 18 August 2026
Basis: Derived from the **approved** TokTickIT System-Level SDS v1.0 (D-01–D-12) so nothing below contradicts it. Where the SDS was silent, a recommended default is marked **[NEW]** and needs your confirmation, same pattern as the Kaching example.

**Status:** Draft for your review — same iterative pattern as the Kaching ChatGPT session (Lecture 3). Please confirm or edit before this becomes the baseline for feature-level specs.

---

## 1. Functional Requirements

### Authentication & Session (Feature-A)
- **FR-001** The system shall require a user to sign in with email and password before accessing any ticket function.
- **FR-002** The system shall allow a signed-in user to log out, which revokes the current session.
- **FR-003** The system shall enforce a 30-minute idle timeout and an 8-hour absolute session timeout (per SDS Session Management).
- **FR-004** Only an Administrator may create a user account and set its initial password.
- **FR-005** Only an Administrator may set a replacement password for an existing user, which revokes that user's active sessions.

### Access Control (Feature-A)
- **FR-006** The system shall restrict every protected operation according to the role (Requester, IT Staff, Administrator) and resource-ownership rules defined in the SDS Authorization Model.
- **FR-007** A Requester shall be able to view only tickets they requested. IT Staff and Administrators shall be able to view all tickets.

### Ticket Creation (Feature-B)
- **FR-008** The system shall allow a Requester to create a new ticket by supplying a title, description, Category, and Requested Priority.
- **FR-009** The system shall generate a unique, human-readable ticket number in the form TKT-YYYY-NNNNN transactionally at creation time (per D-10).
- **FR-010** A newly created ticket shall start in status **New** with no Ticket Owner assigned.
- **FR-011** IT Priority shall initially copy the Requester's Requested Priority at creation.
- **FR-012** The system shall allow a Requester to attach files to a ticket at creation time or afterward, subject to the Attachment rules (Feature-F).
- **FR-013** Ticket creation shall write a TicketEvent recording the requester, timestamp, and initial field values.
- **FR-008b** *(added, per D-16)* A Requester may optionally associate a ticket with a Related System from an administrator-managed list at creation time.

### My Tickets — Ticket List (Feature-C)
- **FR-014** The system shall allow a Requester to view a list ("My Tickets") of every ticket they requested, regardless of status.
- **FR-015** Each row in My Tickets shall show at minimum: ticket number, title/summary, category, status, and last-updated date.
- **FR-016** The system shall allow a Requester to filter My Tickets by status and by category. *(Resolved, per D-17: free-text search is out of Lab 2 scope; see FR-016b.)*
- **FR-016b** *(new, per D-17, Feature-O, Lab 3+)* The system shall allow a Requester to search their own tickets by free text.
- **FR-017** The system shall paginate My Tickets when the result set exceeds a fixed page size.
- **FR-018** Selecting a row in My Tickets shall open that ticket's Ticket Detail view.

### Ticket Detail (Feature-D)
- **FR-019** The system shall display, on the Ticket Detail view, the ticket's number, date, category, requester, owner (if assigned), Requested Priority, IT Priority, current status, description, and resolution summary (if any).
- **FR-020** The system shall display the ticket's Attachments (Feature-F) on the Ticket Detail view.
- **FR-021** The system shall display the ticket's TicketEvent history (Event Log) to any user authorized to view the ticket.
- **FR-022** A Requester viewing their own ticket shall be able to indicate that the problem appears resolved (a confirmation flag/event), without this directly changing the formal status (per SDS Mandatory Ticket Invariants).
- **FR-023** *(rewritten, per D-13 — supersedes D-02)* A Requester may confirm or reject a proposed resolution, and may request that a Resolved/Closed ticket be reopened; only IT Staff or Administrator may execute the actual status change (including Cancelled and reopening).

### Ticket Comments — *(resolved, per D-15)*
> The illustrative Lab 2 screenshot (Lecture 3, "Figure 1") shows a **Public Comments** tab with a running conversation between Requester and IT Staff. The approved v1.0 domain model has **no Comment entity** — only `TicketEvent` (system audit trail) and `Attachment`. Two options:
> 1. Add a `Comment` entity (id, ticketId, authorId, body, createdAt) as a small SDS extension — needed if Lab 2 must show the comment thread from the mockup.
> 2. Treat the mockup as illustrative only and drop comments from Lab 2 scope; ticket communication happens only through the Description/Resolution Summary fields and TicketEvent log.
>
> Recommendation: **Option 1**, since "My Tickets / Ticket Detail" is explicitly the MVP screen set and the mockup that defines Lab 2's scope shows comments as a core interaction. **Resolved as D-15 (not D-13 as originally guessed here — see the Lab 2 Decision Register Addendum, `docs/lab-02/decision-register-addendum.md`): Option 1 confirmed, Comment entity added.**
- **FR-024** *(confirmed, per D-15)* The system shall allow a Requester or IT Staff member with access to a ticket to add a public comment visible to both parties.
- **FR-025** *(confirmed, per D-15)* Comments shall be immutable once posted (no edit; deletion, if needed, follows the same audited pattern as attachment removal).

### Attachments (Feature-F)
- **FR-026** The system shall allow a Requester or IT Staff member to upload an attachment to a ticket, subject to ticket-status and permission rules.
- **FR-027** The system shall accept only JPG, PNG, WEBP, and PDF files, each up to 5 MB, with no more than 5 active attachments per ticket (per SDS Upload Controls).
- **FR-028** The uploader shall be able to delete their own attachment while the ticket is not Closed.
- **FR-029** IT Staff or an Administrator shall be able to remove any attachment with a required reason.
- **FR-030** Every attachment removal shall create an ATTACHMENT_REMOVED TicketEvent recording filename, uploader, remover, reason, and timestamp.
- **FR-031** The system shall serve attachment downloads only through an authenticated, authorized endpoint that streams from SeaweedFS.

### Notifications (Feature-J — later lab)
- **FR-032** The system shall show an unread in-app notification indicator in the application header (per SDS Frontend Structure). *(Deferred beyond Lab 2 Requester MVP unless you want it earlier.)*

### IT Staff / Workflow Features (Feature-G/H/I — later lab, listed for SRS completeness)
- **FR-033** IT Staff or an Administrator shall be able to assign or change the Ticket Owner.
- **FR-034** IT Staff or an Administrator shall be able to change IT Priority; every change is recorded in the Ticket Event log.
- **FR-035** IT Staff or an Administrator shall be able to create, update, and transition Service Actions (Planned → In Progress → Completed/Cancelled), with an assignee that may differ from the Ticket Owner.
- **FR-036** Only IT Staff or an Administrator shall be able to set a ticket's formal status to Resolved or Closed, and only when no Service Action is Planned or In Progress.

### Administration / Reference Data (Feature-L/M — later lab)
- **FR-037** An Administrator shall be able to create, update, and deactivate Categories used by tickets.
- **FR-038** An Administrator shall be able to create user accounts and assign roles (Requester, IT Staff, Administrator).

---

## 2. Business Rules

- **BR-001** Ticket status shall be one of: New, Assigned, In Progress, Pending Requester, Resolved, Closed, Cancelled (per D-02).
- **BR-002** Priority (Requested and IT) shall be one of: Low, Medium, High, Urgent (per D-03).
- **BR-003** A Ticket Owner is required once a ticket leaves status New (Assigned, In Progress).
- **BR-004** Only IT Staff or an Administrator may set formal status to Resolved or Closed.
- **BR-005** A ticket cannot become Resolved or Closed while any Service Action is Planned or In Progress.
- **BR-006** *(rescoped, per D-13)* Only IT Staff or Administrator may cancel a ticket, from any non-Cancelled status; cancellation requires a reason and atomically cancels any Planned/In Progress Service Actions with the same reason.
- **BR-007** *(rescoped, per D-13)* Only IT Staff or Administrator may execute a reopen, from Resolved, Closed, or Cancelled; a Requester may only request one (BR-008b). Reopening sets status to In Progress if an owner exists, otherwise New. Previously cancelled Service Actions remain Cancelled.
- **BR-008** Requester resolution confirmation records a flag/event and never directly changes formal status; if confirmed while open Service Actions remain, the Ticket Owner is warned and status does not change.
- **BR-008b** *(new, per D-13)* A Requester may reject a proposed resolution; rejection records a TicketEvent and a `requesterResolutionConfirmedAt = null` state, and does not itself change ticket status.
- **BR-009** Requested Priority belongs to the Requester and is set at creation; it is never edited by IT Staff. IT Priority is controlled by IT Staff/Administrator and may initially copy Requested Priority.
- **BR-010** Every IT Priority change is recorded as a TicketEvent.
- **BR-011** A Category may be deactivated but never hard-deleted while referenced by any ticket; inactive categories remain visible on historical tickets but are not offered for new tickets.
- **BR-011b** *(new, per D-16)* A Related System may be deactivated but never hard-deleted while referenced by any ticket.
- **BR-012** Attachments are limited to JPG, PNG, WEBP, PDF; maximum 5 MB per file; maximum 5 active attachments per ticket.
- **BR-013** The uploader of an attachment may delete it only while the ticket is not Closed; IT Staff/Administrator may remove any attachment at any time with a reason.
- **BR-014** Ticket numbers are unique, generated transactionally, in the form TKT-YYYY-NNNNN with an annual sequence reset (per D-10).
- **BR-015** Ticket creation, status transitions, priority changes, ownership changes, and attachment removal shall each write a TicketEvent in the same database transaction as the underlying change.
- **BR-016** Tickets and TicketEvents are never hard-deleted.
- **BR-017** A stale ticket update (based on optimistic version) is rejected with HTTP 409 rather than silently overwritten.
- **BR-018 [NEW, only if D-13 adds comments]** A comment cannot be posted on behalf of another user, and comments are visible to the Requester, the Ticket Owner, and any IT Staff/Administrator with access to the ticket.

---

## 3. Non-Functional Requirements

(Carried forward directly from the approved v1.0 SDS "Non-Functional Design Realization" table — restated here as testable NFRs.)

- **NFR-001 Performance:** p95 API response under 500 ms for normal CRUD operations at 50 concurrent users; file uploads excluded.
- **NFR-002 Security:** Role-based access is enforced server-side on every protected endpoint; hiding a UI control is never sufficient.
- **NFR-003 Accessibility:** WCAG 2.2 Level AA target for all Requester-facing screens.
- **NFR-004 Auditability:** Every material ticket change (creation, status, priority, ownership, attachment removal) is traceable via an append-only TicketEvent.
- **NFR-005 Recoverability:** Daily backups of PostgreSQL and SeaweedFS data, retained 7 days.
- **NFR-006 Maintainability:** Business rules live in backend domain services; UI code cannot bypass them.
- **NFR-007 Localization:** Dates/times are stored in UTC and displayed in the user's locale.
- **NFR-008 Branding:** UI uses the KMUTT color palette (Orange #FA4616, Yellow #FFC72C, Blue Grey #7B8189) per D-09 — not the "Zen Green" theme shown in the illustrative lecture mockup.

---

## 4. Complete Feature Inventory

| ID | Feature | Feature scope | Lab 2 MVP? |
| --- | --- | --- | --- |
| Feature-A | User Authentication and Access Control | Sign-in, sessions, RBAC enforcement | Partial (login only; admin account mgmt is later) |
| Feature-B | Ticket Creation | Requester creates a new ticket with category/priority/description/attachments | **Yes** |
| Feature-C | My Tickets (Ticket List) | Requester's own-ticket list, filter, paginate, navigate to detail | **Yes** |
| Feature-D | Ticket Detail | Full ticket view: fields, status, attachments, event log, resolution confirmation, cancel/reopen | **Yes** |
| Feature-E | Ticket Comments *(confirmed, per D-15)* | Public comment thread on a ticket | **Yes** |
| Feature-F | Attachments | Upload, download, delete/remove with audit | **Yes** |
| Feature-G | Ticket Ownership & Assignment | IT Staff/Admin assign/change Ticket Owner | Later |
| Feature-H | Ticket Status Workflow | Resolve/close/cancel/reopen invariants (IT-Staff-driven parts) | Later (Requester-side cancel/reopen/confirm is in Feature-D) |
| Feature-I | Priority Management | IT Priority set/change by IT Staff/Admin | Later |
| Feature-J | Service Actions | Planned/In Progress/Completed/Cancelled lifecycle, assignee | Later |
| Feature-K | Notifications | In-app unread indicator | Later |
| Feature-L | Audit Trail / Event Log | Append-only TicketEvent creation and retrieval | Partial (read-only display is in Feature-D) |
| Feature-M | Category & Reference Data Administration | Admin manages Categories and Related Systems *(scope note, per D-16: `RelatedSystem` is reference data — id, code, name, isActive — seeded and optional on Ticket; full admin management screen is Later, but the reference table and Create Ticket select are Lab 2 W4 per Feature-B)* | Later (management screen); reference table is Lab 2 |
| Feature-N | User & Role Administration | Admin creates/manages accounts and roles | Later |
| Feature-O | Search, Filtering, Dashboards | Cross-ticket search/reporting for IT Staff/Admin | Later |

---

## 5. Requirements-to-Features Traceability (Lab 2 scope only)

| Requirement | Covered by |
| --- | --- |
| FR-001–FR-003 | Feature-A |
| FR-006, FR-007 | Feature-A |
| FR-008–FR-013 | Feature-B |
| FR-014–FR-018 | Feature-C |
| FR-019–FR-023 | Feature-D |
| FR-024–FR-025 (if D-13) | Feature-E |
| FR-026–FR-031 | Feature-F |
| BR-001–BR-017 | Feature-B/C/D/F as applicable |
| NFR-001–NFR-008 | Cross-cutting, all features |

---

## Open Items Needing Your Confirmation

1. **D-13 (new):** Add a `Comment` entity so Ticket Detail can show a comment thread (matches the Lecture 3 mockup), or drop comments from scope? *Recommendation: add it — small, low-risk extension.*
2. **FR-016:** Is free-text search in My Tickets required for Lab 2, or is status/category filtering enough for the MVP?
3. Confirm the Feature Inventory table above (Lab 2 MVP column) matches what you actually need to implement for W3–W4, or adjust.
