import { useState } from 'react';
import { Outlet, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL: Record<string, string> = {
  REQUESTER: 'Requester',
  IT_STAFF: 'IT Staff',
  ADMINISTRATOR: 'Administrator',
};

const HOME_ROUTE: Record<string, string> = {
  REQUESTER: '/tickets',
  IT_STAFF: '/staff/tickets',
  ADMINISTRATOR: '/admin/users',
};

function requiredRoleFor(pathname: string): string | null {
  if (pathname.startsWith('/staff')) return 'IT_STAFF';
  if (pathname.startsWith('/admin')) return 'ADMINISTRATOR';
  if (pathname.startsWith('/tickets')) return 'REQUESTER';
  return null;
}

export function AppShell() {
  const { currentUser, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  if (isLoading) {
    return <div className="container py-4">Loading…</div>;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (currentUser.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  const requiredRole = requiredRoleFor(location.pathname);
  if (requiredRole && requiredRole !== currentUser.role) {
    return <Navigate to={HOME_ROUTE[currentUser.role]} replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <header>
        <nav className="navbar navbar-expand-md app-navbar" aria-label="Main navigation">
          <div className="container">
            <span className="navbar-brand fw-semibold mb-0">TokTickIT</span>

            <div className="d-flex align-items-center gap-2 ms-auto order-md-2">
              <span className="navbar-text small">
                Signed in as: {currentUser.displayName} ({ROLE_LABEL[currentUser.role]})
              </span>
              <button type="button" className="btn btn-sm btn-header" onClick={handleLogout}>
                Logout
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
                {currentUser.role === 'REQUESTER' && (
                  <>
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
                  </>
                )}
                {currentUser.role === 'IT_STAFF' && (
                  <li className="nav-item">
                    <NavLink to="/staff/tickets" className="nav-link" onClick={() => setNavOpen(false)}>
                      My Queue
                    </NavLink>
                  </li>
                )}
                {currentUser.role === 'ADMINISTRATOR' && (
                  <li className="nav-item">
                    <NavLink to="/admin/users" className="nav-link" onClick={() => setNavOpen(false)}>
                      Users
                    </NavLink>
                  </li>
                )}
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
