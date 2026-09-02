import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext';
import { fetchDevRequesters, selectDevRequester, type DevRequester } from '../api/dev';
import { Icon } from '../components/Icon';

type LoadState = 'loading' | 'loaded' | 'empty' | 'error';

export function SelectRequesterPage() {
  const { setRequester } = useRequester();
  const navigate = useNavigate();
  const location = useLocation();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [requesters, setRequesters] = useState<DevRequester[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [continueError, setContinueError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasPriorSelection =
    (location.state as { from?: string } | null)?.from === 'change-requester';

  const loadRequesters = useCallback(() => {
    setLoadState('loading');
    setContinueError('');
    fetchDevRequesters()
      .then((data) => {
        setRequesters(data);
        setLoadState(data.length === 0 ? 'empty' : 'loaded');
      })
      .catch(() => {
        setRequesters([]);
        setLoadState('error');
      });
  }, []);

  useEffect(() => {
    loadRequesters();
  }, [loadRequesters]);

  const handleContinue = async () => {
    if (!selectedId) return;
    setIsSubmitting(true);
    setContinueError('');
    try {
      const selected = await selectDevRequester(selectedId);
      setRequester(selected);
      navigate('/tickets');
    } catch {
      setContinueError('Failed to select Development Requester. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!hasPriorSelection) return;
    navigate(-1);
  };

  return (
    <div className="container py-4">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item">Home</li>
          <li className="breadcrumb-item active" aria-current="page">
            Development Requester Selection
          </li>
        </ol>
      </nav>
      <div className="card mx-auto" style={{ maxWidth: '40rem' }}>
        <div className="card-body">
          <h1 className="d-flex align-items-center gap-2">
            <Icon name="person-check" className="text-primary" />
            Select Development Requester
          </h1>
          <p className="mb-4">
            Choose a development requester to simulate the current requester context for Lab 2.
            This is for testing only and is not a login screen.
          </p>

          <div className="mb-3">
            <label htmlFor="dev-requester-select" className="form-label">
              Development Requester <span aria-hidden="true" className="text-danger">*</span>
            </label>
            {loadState === 'empty' ? (
              <div role="alert" className="alert alert-danger">
                <Icon name="exclamation-triangle-fill" className="text-danger" />
                <p>
                  No active development requesters are available. The application cannot be used
                  until at least one active Development Requester exists.
                </p>
              </div>
            ) : loadState === 'error' ? (
              <div role="alert" className="alert alert-danger">
                <Icon name="exclamation-triangle-fill" className="text-danger" />
                <div>
                  <p>Failed to load Development Requesters.</p>
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadRequesters}>
                    <Icon name="arrow-repeat" className="me-1" />
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <select
                id="dev-requester-select"
                className="form-select"
                aria-label="Development Requester"
                required
                disabled={loadState === 'loading'}
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                <option value="">
                  {loadState === 'loading' ? 'Loading requesters…' : 'Select a requester'}
                </option>
                {requesters.map((requester) => (
                  <option key={requester.id} value={requester.id}>
                    {requester.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="alert alert-note mb-2">
            <Icon name="info-circle" />
            <p>Only active development requesters are shown.</p>
          </div>
          <div className="alert alert-note-neutral mb-4">
            <Icon name="shield-check" />
            <p>
              Authentication coming in Lab 3 — in Lab 3, this selection will be replaced with
              secure authentication so you can access the system with your own account.
            </p>
          </div>

          {continueError && (
            <div role="alert" className="alert alert-danger">
              <Icon name="exclamation-triangle-fill" className="text-danger" />
              <p>{continueError}</p>
            </div>
          )}

          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-tertiary"
              onClick={handleCancel}
              disabled={!hasPriorSelection}
              aria-disabled={!hasPriorSelection}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleContinue}
              disabled={!selectedId || isSubmitting}
              aria-disabled={!selectedId || isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
