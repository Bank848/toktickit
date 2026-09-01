import { Routes, Route, Navigate } from 'react-router-dom';
import { RequesterProvider } from './context/RequesterContext';
import { AppShell } from './components/AppShell';
import { SelectRequesterPage } from './pages/SelectRequesterPage';
import { SystemCheckPage } from './pages/SystemCheckPage';
import { CreateTicketPage } from './pages/CreateTicketPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';

function App() {
  return (
    <RequesterProvider>
      <Routes>
        <Route path="/select-requester" element={<SelectRequesterPage />} />
        <Route path="/system-check" element={<SystemCheckPage />} />
        <Route element={<AppShell />}>
          <Route path="/tickets" element={<MyTicketsPage />} />
          <Route path="/tickets/new" element={<CreateTicketPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/tickets" replace />} />
      </Routes>
    </RequesterProvider>
  );
}

export default App;
