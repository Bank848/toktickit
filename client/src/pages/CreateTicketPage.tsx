import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext';
import { createTicket, ApiError, type CreateTicketPayload } from '../api/tickets';
import { uploadAttachment } from '../api/attachments';
import { fetchCategories, fetchRelatedSystems, type CategoryDto, type RelatedSystemDto } from '../api/lookups';
import { AttachmentPicker } from '../components/AttachmentPicker';
import { Icon } from '../components/Icon';

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
    <div className="mx-auto" style={{ maxWidth: '48rem' }}>
      <h1>Create Ticket</h1>

      {lookupState === 'loading' && (
        <p className="text-body-secondary d-flex align-items-center gap-2">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading form…
        </p>
      )}
      {lookupState === 'empty' && (
        <div role="alert" className="alert alert-warning">
          <Icon name="exclamation-triangle-fill" />
          <p>
            No active categories are available. A ticket cannot be created until at least one
            active category exists.
          </p>
        </div>
      )}
      {lookupState === 'error' && (
        <div role="alert" className="alert alert-danger">
          <Icon name="exclamation-triangle-fill" />
          <div>
            <p>Failed to load form data.</p>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadLookups}>
              <Icon name="arrow-repeat" className="me-1" />
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit} noValidate>
            <div className="row g-3 mb-4">
              <div className="col-12 col-md-4">
                <span className="field-label d-block">Ticket Number</span>
                <span className="field-readonly">Assigned on save</span>
              </div>
              <div className="col-12 col-md-4">
                <span className="field-label d-block">Ticket Date</span>
                <span className="field-readonly">Today</span>
              </div>
              <div className="col-12 col-md-4">
                <span className="field-label d-block">Requester</span>
                <span className="field-readonly">{requester.displayName}</span>
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="ticket-summary" className="form-label is-required">
                Summary
              </label>
              <input
                id="ticket-summary"
                ref={summaryRef}
                type="text"
                className={`form-control${fieldErrors.summary ? ' is-invalid' : ''}`}
                required
                maxLength={SUMMARY_MAX}
                value={summary}
                disabled={formDisabled}
                aria-describedby={fieldErrors.summary ? 'ticket-summary-error' : undefined}
                aria-invalid={Boolean(fieldErrors.summary)}
                onChange={(event) => setSummary(event.target.value)}
              />
              <div className="d-flex justify-content-between">
                {fieldErrors.summary ? (
                  <p id="ticket-summary-error" role="alert" className="invalid-feedback d-block mb-0">
                    {fieldErrors.summary}
                  </p>
                ) : (
                  <span />
                )}
                <span className="form-text ms-auto" aria-live="polite">
                  {summary.length}/{SUMMARY_MAX}
                </span>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-12 col-md-6 mb-3">
                <label htmlFor="ticket-category" className="form-label is-required">
                  Category
                </label>
                <select
                  id="ticket-category"
                  ref={categoryRef}
                  className={`form-select${fieldErrors.categoryId ? ' is-invalid' : ''}`}
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
                  <p id="ticket-category-error" role="alert" className="invalid-feedback d-block">
                    {fieldErrors.categoryId}
                  </p>
                )}
              </div>

              <div className="col-12 col-md-6 mb-3">
                <label htmlFor="ticket-related-system" className="form-label">
                  Related System
                </label>
                <select
                  id="ticket-related-system"
                  ref={relatedSystemRef}
                  className={`form-select${fieldErrors.relatedSystemId ? ' is-invalid' : ''}`}
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
                  <p id="ticket-related-system-error" role="alert" className="invalid-feedback d-block">
                    {fieldErrors.relatedSystemId}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-3" style={{ maxWidth: '16rem' }}>
              <label htmlFor="ticket-priority" className="form-label is-required">
                Requested Priority
              </label>
              <select
                id="ticket-priority"
                ref={priorityRef}
                className={`form-select${fieldErrors.requestedPriority ? ' is-invalid' : ''}`}
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
                <p id="ticket-priority-error" role="alert" className="invalid-feedback d-block">
                  {fieldErrors.requestedPriority}
                </p>
              )}
            </div>

            <div className="mb-3">
              <label htmlFor="ticket-description" className="form-label is-required">
                Description
              </label>
              <textarea
                id="ticket-description"
                ref={descriptionRef}
                className={`form-control${fieldErrors.description ? ' is-invalid' : ''}`}
                rows={6}
                required
                maxLength={DESCRIPTION_MAX}
                value={description}
                disabled={formDisabled}
                aria-describedby={fieldErrors.description ? 'ticket-description-error' : undefined}
                aria-invalid={Boolean(fieldErrors.description)}
                onChange={(event) => setDescription(event.target.value)}
              />
              <div className="d-flex justify-content-between">
                {fieldErrors.description ? (
                  <p id="ticket-description-error" role="alert" className="invalid-feedback d-block mb-0">
                    {fieldErrors.description}
                  </p>
                ) : (
                  <span />
                )}
                <span className="form-text ms-auto" aria-live="polite">
                  {description.length}/{DESCRIPTION_MAX}
                </span>
              </div>
            </div>

            <AttachmentPicker files={attachments} onChange={setAttachments} />

            {globalError && (
              <div role="alert" className="alert alert-danger mt-3">
                <Icon name="exclamation-triangle-fill" />
                <p>{globalError}</p>
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
              <Link to="/tickets" className="btn btn-tertiary">
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={formDisabled}
                aria-disabled={formDisabled}
                aria-busy={submitting}
              >
                {submitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
                Create Ticket
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
