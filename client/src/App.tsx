import { useState } from 'react';
import { fetchHealth, fetchCategories } from './api';
import type { Category } from './api';

type CheckState = 'idle' | 'loading' | 'success' | 'error';

function App() {
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [backendOnline, setBackendOnline] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const handleCheckSystem = async () => {
    setCheckState('loading');
    setErrorMessage('');

    try {
      await fetchHealth();
      setBackendOnline(true);
      const fetchedCategories = await fetchCategories();
      setCategories(fetchedCategories);
      setCheckState('success');
    } catch {
      setBackendOnline(false);
      setCategories([]);
      setErrorMessage('Unable to connect to TokTickIT API');
      setCheckState('error');
    }
  };

  return (
    <div className="container py-4">
      <h1>TokTickIT IT Service Desk</h1>
      <button className="btn btn-success" onClick={handleCheckSystem}>
        Check System
      </button>

      {checkState === 'loading' && <p>Loading...</p>}

      {checkState === 'success' && (
        <>
          <p>
            System Status: <strong>{backendOnline ? 'Online' : 'Offline'}</strong>
          </p>
          <h2>Supported Request Categories</h2>
          <ul>
            {categories.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
        </>
      )}

      {checkState === 'error' && (
        <>
          <p>
            System Status: <strong>Offline</strong>
          </p>
          <p className="text-danger" role="alert">
            {errorMessage}
          </p>
        </>
      )}
    </div>
  );
}

export default App;
