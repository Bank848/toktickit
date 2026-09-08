import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changePassword, ChangePasswordRequestError } from '../api/auth';
import { Icon } from '../components/Icon';
import { PasswordRulesChecklist } from '../components/PasswordRulesChecklist';
import { passwordRuleStatus } from '../lib/passwordRules';

const HOME_ROUTE: Record<string, string> = {
  REQUESTER: '/tickets',
  IT_STAFF: '/staff/tickets',
  ADMINISTRATOR: '/admin/users',
};

export function ChangePasswordPage() {
  const { currentUser, isLoading, setCurrentUser } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (isLoading) {
    return <div className="container py-4">Loading…</div>;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (!currentUser.mustChangePassword) {
    return <Navigate to={HOME_ROUTE[currentUser.role]} replace />;
  }

  const rules = passwordRuleStatus(newPassword);
  const rulesSatisfied = rules.length && rules.caseMix && rules.numberAndSymbol;
  const matches = newPassword.length > 0 && newPassword === confirmNewPassword;
  const canSubmit = currentPassword.length > 0 && rulesSatisfied && matches && !isSubmitting;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setCurrentPasswordError('');
    setNewPasswordError('');
    setConfirmError('');
    try {
      const user = await changePassword({ currentPassword, newPassword, confirmNewPassword });
      setCurrentUser(user);
      navigate(HOME_ROUTE[user.role]);
    } catch (error) {
      if (error instanceof ChangePasswordRequestError) {
        if (error.code === 'INVALID_CURRENT_PASSWORD') {
          setCurrentPasswordError('Current password is incorrect.');
        } else {
          for (const fieldError of error.fieldErrors) {
            if (fieldError.field === 'confirmNewPassword') setConfirmError(fieldError.message);
            else setNewPasswordError(fieldError.message);
          }
        }
      } else {
        setNewPasswordError('Something went wrong. Please try again.');
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
            <h1>Change Your Password.</h1>
            <p>You must change your password to continue.</p>
            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label htmlFor="current-password" className="form-label">
                  Current (temporary) password
                </label>
                <div className="input-group">
                  <input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="form-control"
                    required
                    value={currentPassword}
                    disabled={isSubmitting}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowCurrentPassword((value) => !value)}
                  >
                    <Icon name={showCurrentPassword ? 'eye-slash' : 'eye'} />
                  </button>
                </div>
                {currentPasswordError && <div className="text-danger small mt-1">{currentPasswordError}</div>}
              </div>

              <div className="mb-3">
                <label htmlFor="new-password" className="form-label">
                  New password
                </label>
                <div className="input-group">
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-control"
                    required
                    value={newPassword}
                    disabled={isSubmitting}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowNewPassword((value) => !value)}
                  >
                    <Icon name={showNewPassword ? 'eye-slash' : 'eye'} />
                  </button>
                </div>
                {newPasswordError && <div className="text-danger small mt-1">{newPasswordError}</div>}
                <PasswordRulesChecklist value={newPassword} />
              </div>

              <div className="mb-3">
                <label htmlFor="confirm-password" className="form-label">
                  Confirm new password
                </label>
                <div className="input-group">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-control"
                    required
                    value={confirmNewPassword}
                    disabled={isSubmitting}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirmPassword((value) => !value)}
                  >
                    <Icon name={showConfirmPassword ? 'eye-slash' : 'eye'} />
                  </button>
                </div>
                {confirmError && <div className="text-danger small mt-1">{confirmError}</div>}
              </div>

              <button type="submit" className="btn btn-primary w-100" disabled={!canSubmit} aria-busy={isSubmitting}>
                {isSubmitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
                Continue
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
