import { Outlet, Navigate, Link, useNavigate } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext';

export function AppShell() {
  const { requester, clearRequester } = useRequester();
  const navigate = useNavigate();

  if (!requester) {
    return <Navigate to="/select-requester" replace />;
  }

  const handleChangeRequester = () => {
    clearRequester();
    navigate('/select-requester', { state: { from: 'change-requester' } });
  };

  return (
    <>
      <header className="app-header">
        <span>TokTickIT</span>
        <nav aria-label="Main navigation">
          <Link to="/tickets">My Tickets</Link>
          <Link to="/tickets/new">Create Ticket</Link>
        </nav>
        <span>Testing as: {requester.displayName}</span>
        <button onClick={handleChangeRequester}>Change Requester</button>
      </header>
      <main className="container py-4">
        <Outlet />
      </main>
    </>
  );
}
