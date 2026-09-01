import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext';
import { createTicket, ApiError, type CreateTicketPayload } from '../api/tickets';
import { uploadAttachment } from '../api/attachments';
import { fetchCategories, fetchRelatedSystems, type CategoryDto, type RelatedSystemDto } from '../api/lookups';
import { AttachmentPicker } from '../components/AttachmentPicker';

type LookupState = 'loading' | 'loaded' | 'empty' | 'error';
type Priority = CreateTicketPayload['requestedPriority'];

const SUMMARY_MAX = 150;
const DESCRIPTION_MAX = 5000;

// Order matters: on a validation failure (client-side or server 422), focus moves to whichever
// of these is first to have an error, matching field order on the form.
const FIELD_ORDER = ['summary', 'categoryId', 'relatedSystemId', 'requestedPriority', 'description'] as const;
type FieldName = (typeof FIELD_ORDER)[number];
type FieldErrorMap = Partial<Record<FieldName, string>>;

interface UploadFailure {
  filename: string;
  message: string;
}

export function CreateTicketPage() {
  const { requester } = useRequester();
  const navigate = useNavigate();

  const [lookupState, setLookupState] = useState<LookupState>('loading');
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystemDto[]>([]);

  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [relatedSystemId, setRelatedSystemId] = useState('');
  const [requestedPriority, setRequestedPriority] = useState<Priority>('MEDIUM');
  const [attachments, setAttachments] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [globalError, setGlobalError] = useState('');

  const summaryRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const relatedSystemRef = useRef<HTMLSelectElement>(null);
  const priorityRef = useRef<HTMLSelectElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const fieldRefs: Record<FieldName, React.RefObject<HTMLElement | null>> = {
    summary: summaryRef,
    categoryId: categoryRef,
    relatedSystemId: relatedSystemRef,
    requestedPriority: priorityRef,
    description: descriptionRef,
  };

  // Focus must move to the first invalid field only after the field re-renders as enabled --
  // when the error comes from a 422, submitting is still true (and the field still `disabled`)
  // at the moment the error is caught, so focusing right there is a no-op (jsdom, like real
  // browsers, refuses focus() on a disabled element). Driving it from an effect keyed on
  // fieldErrors guarantees it runs after the re-render that clears `disabled`.
  useEffect(() => {
    const first = FIELD_ORDER.find((field) => fieldErrors[field]);
    if (first) fieldRefs[first].current?.focus();
    // fieldRefs is rebuilt every render from the same stable useRef objects, safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldErrors]);

  const loadLookups = useCallback(() => {
    if (!requester) return;
    setLookupState('loading');
    Promise.all([fetchCategories(requester.id), fetchRelatedSystems(requester.id)])
      .then(([cats, systems]) => {
        setCategories(cats);
        setRelatedSystems(systems);
        setLookupState(cats.length === 0 ? 'empty' : 'loaded');
      })
      .catch(() => {
        setLookupState('error');
      });
  }, [requester]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  if (!requester) return null;

  const formDisabled = lookupState !== 'loaded' || submitting;

  function validateClientSide(): FieldErrorMap {
    const errors: FieldErrorMap = {};
    const trimmedSummary = summary.trim();
    if (trimmedSummary.length === 0) errors.summary = 'Summary is required';
    else if (summary.length > SUMMARY_MAX) errors.summary = `Summary must be ${SUMMARY_MAX} characters or fewer`;

    const trimmedDescription = description.trim();
    if (trimmedDescription.length === 0) errors.description = 'Description is required';
    else if (description.length > DESCRIPTION_MAX) {
      errors.description = `Description must be ${DESCRIPTION_MAX} characters or fewer`;
    }

    if (categoryId === '') errors.categoryId = 'Category is required';

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !requester) return;

    const clientErrors = validateClientSide();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    setGlobalError('');
    setFieldErrors({});

    const payload: CreateTicketPayload = {
      summary,
      description,
      categoryId: Number(categoryId),
      relatedSystemId: relatedSystemId === '' ? null : Number(relatedSystemId),
      requestedPriority,
    };

    let ticket;
    try {
      ticket = await createTicket(requester.id, payload);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiError && error.status === 422) {
        const mapped: FieldErrorMap = {};
        for (const fieldError of error.fieldErrors) {
          if ((FIELD_ORDER as readonly string[]).includes(fieldError.field)) {
            mapped[fieldError.field as FieldName] = fieldError.message;
          }
        }
        setFieldErrors(mapped);
      } else {
        setGlobalError(error instanceof Error ? error.message : 'Failed to create ticket');
      }
      return;
    }

    // Uploads happen sequentially, not Promise.all -- a partial failure must not race with the
    // ticket already existing, and the ticket is never rolled back because an upload failed.
    const failures: UploadFailure[] = [];
    let succeeded = 0;
    for (const file of attachments) {
      try {
        await uploadAttachment(requester.id, ticket.id, file);
        succeeded += 1;
      } catch (error) {
        failures.push({
          filename: file.name,
          message: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }

    const state =
      failures.length > 0
        ? { uploadSummary: { attempted: attachments.length, succeeded, failures } }
        : undefined;
    navigate(`/tickets/${ticket.id}`, { state });
  }

  return (
    <div>
      <h1>Create Ticket</h1>

      {lookupState === 'loading' && <p>Loading form…</p>}
      {lookupState === 'empty' && (
        <p role="alert">
          No active categories are available. A ticket cannot be created until at least one
          active category exists.
        </p>
      )}
      {lookupState === 'error' && (
        <div role="alert">
          <p>Failed to load form data.</p>
          <button type="button" onClick={loadLookups}>
            Retry
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <span>Ticket Number: Assigned on save</span>
        </div>
        <div>
          <span>Ticket Date: Today</span>
        </div>
        <div>
          <span>Requester: {requester.displayName}</span>
        </div>

        <div>
          <label htmlFor="ticket-summary">Summary</label>
          <input
            id="ticket-summary"
            ref={summaryRef}
            type="text"
            required
            maxLength={SUMMARY_MAX}
            value={summary}
            disabled={formDisabled}
            aria-describedby={fieldErrors.summary ? 'ticket-summary-error' : undefined}
            aria-invalid={Boolean(fieldErrors.summary)}
            onChange={(event) => setSummary(event.target.value)}
          />
          <span>
            {summary.length}/{SUMMARY_MAX}
          </span>
          {fieldErrors.summary && (
            <p id="ticket-summary-error" role="alert">
              {fieldErrors.summary}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="ticket-category">Category</label>
          <select
            id="ticket-category"
            ref={categoryRef}
            required
            value={categoryId}
            disabled={formDisabled}
            aria-describedby={fieldErrors.categoryId ? 'ticket-category-error' : undefined}
            aria-invalid={Boolean(fieldErrors.categoryId)}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {fieldErrors.categoryId && (
            <p id="ticket-category-error" role="alert">
              {fieldErrors.categoryId}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="ticket-related-system">Related System</label>
          <select
            id="ticket-related-system"
            ref={relatedSystemRef}
            value={relatedSystemId}
            disabled={formDisabled}
            aria-describedby={fieldErrors.relatedSystemId ? 'ticket-related-system-error' : undefined}
            aria-invalid={Boolean(fieldErrors.relatedSystemId)}
            onChange={(event) => setRelatedSystemId(event.target.value)}
          >
            <option value="">Not applicable</option>
            {relatedSystems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </select>
          {fieldErrors.relatedSystemId && (
            <p id="ticket-related-system-error" role="alert">
              {fieldErrors.relatedSystemId}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="ticket-priority">Requested Priority</label>
          <select
            id="ticket-priority"
            ref={priorityRef}
            required
            value={requestedPriority}
            disabled={formDisabled}
            aria-describedby={fieldErrors.requestedPriority ? 'ticket-priority-error' : undefined}
            aria-invalid={Boolean(fieldErrors.requestedPriority)}
            onChange={(event) => setRequestedPriority(event.target.value as Priority)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
          {fieldErrors.requestedPriority && (
            <p id="ticket-priority-error" role="alert">
              {fieldErrors.requestedPriority}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="ticket-description">Description</label>
          <textarea
            id="ticket-description"
            ref={descriptionRef}
            rows={6}
            required
            maxLength={DESCRIPTION_MAX}
            value={description}
            disabled={formDisabled}
            aria-describedby={fieldErrors.description ? 'ticket-description-error' : undefined}
            aria-invalid={Boolean(fieldErrors.description)}
            onChange={(event) => setDescription(event.target.value)}
          />
          <span>
            {description.length}/{DESCRIPTION_MAX}
          </span>
          {fieldErrors.description && (
            <p id="ticket-description-error" role="alert">
              {fieldErrors.description}
            </p>
          )}
        </div>

        <AttachmentPicker files={attachments} onChange={setAttachments} />

        {globalError && <p role="alert">{globalError}</p>}

        <div>
          <Link to="/tickets">Cancel</Link>
          <button type="submit" disabled={formDisabled} aria-busy={submitting}>
            {submitting ? 'Creating…' : 'Create Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
