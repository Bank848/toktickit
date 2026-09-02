import { useState } from 'react';
import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext';

export function AppShell() {
  const { requester, clearRequester } = useRequester();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  if (!requester) {
    return <Navigate to="/select-requester" replace />;
  }

  const handleChangeRequester = () => {
    clearRequester();
    navigate('/select-requester', { state: { from: 'change-requester' } });
  };

  return (
    <>
      <header>
        <nav className="navbar navbar-expand-md app-navbar" aria-label="Main navigation">
          <div className="container">
            <span className="navbar-brand fw-semibold mb-0">TokTickIT</span>

            <div className="d-flex align-items-center gap-2 ms-auto order-md-2">
              <span className="navbar-text small">Testing as: {requester.displayName}</span>
              <button type="button" className="btn btn-sm btn-header" onClick={handleChangeRequester}>
                Change Requester
              </button>
            </div>

            <button
              type="button"
              className="navbar-toggler ms-2"
              aria-controls="primary-nav"
              aria-expanded={navOpen}
              aria-label="Toggle navigation"
              onClick={() => setNavOpen((open) => !open)}
            >
              <span className="navbar-toggler-icon" />
            </button>

            <div id="primary-nav" className={`collapse navbar-collapse order-md-1${navOpen ? ' show' : ''}`}>
              <ul className="navbar-nav me-auto">
                <li className="nav-item">
                  <NavLink to="/tickets" end className="nav-link" onClick={() => setNavOpen(false)}>
                    My Tickets
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/tickets/new" className="nav-link" onClick={() => setNavOpen(false)}>
                    Create Ticket
                  </NavLink>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </header>
      <main className="container py-4">
        <Outlet />
      </main>
    </>
  );
}
