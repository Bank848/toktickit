# Feature-G — Development Requester Selection

**Identity.** FEAT-G, Development Requester Selection, v1.0, Lab 2. Added during the third
reconciliation pass to give this screen its own feature doc — the other four Lab 2 feature docs
already cited it as a dependency under this name, but no doc existed yet (labsheet §8.1).
**Traceability.** FR-01…FR-05 (spec §4) · BR-03, BR-14 · NFR-02, NFR-03, NFR-06 · D-18.
**Behavior.** Actor: an unauthenticated browser session (no identity selected yet). On load, the
screen shows a dropdown of seeded active Development Requesters and a "Continue" button; no other
part of the app (My Tickets, Create Ticket, Ticket Detail) is reachable until a Requester is
selected. Selecting a Requester and confirming stores that identity (sent as `x-dev-user-id` on
every subsequent request) and navigates to My Tickets scoped to that Requester. The application
shell afterward displays the selected Requester's name and a "Change Requester" control; activating
it clears the stored identity, discards any cached requester-scoped data, and returns to this
screen. This screen is explicitly a testing mechanism, not authentication (BR-03, NFR-06) — Lab 3
replaces it with real login without changing any other endpoint's contract.
**Permissions.** None — this is the pre-identity screen. `GET /dev/requesters` requires no identity
by design (it exists to bootstrap identity). `POST /dev/session` and every subsequent request
validate the selected id against the active-Requester list server-side, every time, not only at
selection (BR-14): a since-deactivated or unknown id is rejected and the client returns here.
**Workflow.** Not applicable — this screen has no ticket lifecycle behavior of its own; it only
establishes and clears the testing identity that the other four features scope their operations to.
**Data.** `User` (Development Requester), filtered to `isActive = true`.
**API.** `GET /api/v1/dev/requesters` (#4 in `api-spec.md`), `POST /api/v1/dev/session` (#5).
**UI.** See `ui-spec.md` §3. TokTickIT title, short "for Lab 2 testing only, not a login screen"
explanatory text, Development Requester dropdown (required, red-asterisk marked), Continue button,
loading state while requesters load, empty state if no active Requesters exist, safe API-failure
state, keyboard-accessible controls, responsive Zen Green styling. After selection, the app shell
shows the Requester's name and the "Change Requester" action.
**NFRs.** WCAG 2.2 AA keyboard-accessible dropdown and button (NFR-02); Zen Green theme (NFR-03);
explicitly not an authentication mechanism (NFR-06).
**Dependencies.** None — this is the entry point every other Lab 2 feature depends on.
**Out of scope.** Real authentication, password/session handling, role selection, remembering the
selection across browser restarts (Lab 3 concerns).
