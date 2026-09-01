import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext';
import { fetchDevRequesters, selectDevRequester, type DevRequester } from '../api/dev';

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
        <span>Home &gt; Development Requester Selection</span>
      </nav>
      <div className="card">
        <div className="card-body">
          <h1>Select Development Requester</h1>
          <p>
            Choose a development requester to simulate the current requester context for Lab 2.
            This is for testing only and is not a login screen.
          </p>

          <div className="mb-3">
            <label htmlFor="dev-requester-select">
              Development Requester <span aria-hidden="true">*</span>
            </label>
            {loadState === 'empty' ? (
              <p role="alert">
                No active development requesters are available. The application cannot be used
                until at least one active Development Requester exists.
              </p>
            ) : loadState === 'error' ? (
              <div role="alert">
                <p>Failed to load Development Requesters.</p>
                <button type="button" onClick={loadRequesters}>
                  Retry
                </button>
              </div>
            ) : (
              <select
                id="dev-requester-select"
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

          <p>Only active development requesters are shown.</p>
          <p>
            Authentication coming in Lab 3 — in Lab 3, this selection will be replaced with secure
            authentication so you can access the system with your own account.
          </p>

          {continueError && <p role="alert">{continueError}</p>}

          <div className="d-flex justify-content-end gap-2">
            <button type="button" onClick={handleCancel} disabled={!hasPriorSelection}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!selectedId || isSubmitting}
              aria-busy={isSubmitting}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
