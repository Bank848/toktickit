import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, LoginRequestError } from '../api/auth';
import { Icon } from '../components/Icon';

const HOME_ROUTE: Record<string, string> = {
  REQUESTER: '/tickets',
  IT_STAFF: '/staff/tickets',
  ADMINISTRATOR: '/admin/users',
};

export function LoginPage() {
  const { setCurrentUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const user = await login(email, password);
      setCurrentUser(user);
      navigate(user.mustChangePassword ? '/change-password' : HOME_ROUTE[user.role]);
    } catch (error) {
      setPassword('');
      if (error instanceof LoginRequestError && error.code === 'ACCOUNT_DEACTIVATED') {
        setErrorMessage('This account has been deactivated. Contact an administrator.');
      } else {
        setErrorMessage('Invalid email or password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <header className="app-navbar py-3 mb-4">
        <div className="container">
          <span className="navbar-brand fw-semibold mb-0 text-white">TokTickIT</span>
        </div>
      </header>
      <div className="container pb-4">
        <div className="card mx-auto" style={{ maxWidth: '28rem' }}>
          <div className="card-body">
            <h1>Sign in to your account.</h1>
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label htmlFor="login-email" className="form-label">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  className="form-control"
                  required
                  autoComplete="username"
                  value={email}
                  disabled={isSubmitting}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="mb-3">
                <label htmlFor="login-password" className="form-label">
                  Password
                </label>
                <div className="input-group">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    required
                    autoComplete="current-password"
                    value={password}
                    disabled={isSubmitting}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <Icon name={showPassword ? 'eye-slash' : 'eye'} />
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div role="alert" className="alert alert-danger">
                  <Icon name="exclamation-triangle-fill" className="text-danger" />
                  <p>{errorMessage}</p>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-100 mb-3"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
                Sign In
              </button>

              <button
                type="button"
                className="btn btn-tertiary w-100"
                disabled
                aria-disabled="true"
                title="Contact an administrator to reset your password"
              >
                Forgot your password?
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
