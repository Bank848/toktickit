import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changePassword, ChangePasswordRequestError } from '../api/auth';

const HOME_ROUTE: Record<string, string> = {
  REQUESTER: '/tickets',
  IT_STAFF: '/staff/tickets',
  ADMINISTRATOR: '/admin/users',
};

function passwordRuleStatus(value: string) {
  return {
    length: value.length >= 8,
    caseMix: /[A-Z]/.test(value) && /[a-z]/.test(value),
    numberAndSymbol: /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value),
  };
}

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
    <div className="container py-4">
      <div className="card mx-auto" style={{ maxWidth: '28rem' }}>
        <div className="card-body">
          <h1>Change Your Password.</h1>
          <p>You must change your password to continue.</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="current-password" className="form-label">
                Current (temporary) password
              </label>
              <input
                id="current-password"
                type="password"
                className="form-control"
                required
                value={currentPassword}
                disabled={isSubmitting}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              {currentPasswordError && <div className="text-danger small mt-1">{currentPasswordError}</div>}
            </div>

            <div className="mb-3">
              <label htmlFor="new-password" className="form-label">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                className="form-control"
                required
                value={newPassword}
                disabled={isSubmitting}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              {newPasswordError && <div className="text-danger small mt-1">{newPasswordError}</div>}
              <ul className="list-unstyled small mt-2 mb-0">
                <li>{rules.length ? '✓' : '○'} Be at least 8 characters</li>
                <li>{rules.caseMix ? '✓' : '○'} Include upper and lower case letters</li>
                <li>{rules.numberAndSymbol ? '✓' : '○'} Include a number and a special character</li>
              </ul>
            </div>

            <div className="mb-3">
              <label htmlFor="confirm-password" className="form-label">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                className="form-control"
                required
                value={confirmNewPassword}
                disabled={isSubmitting}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
              />
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
  );
}
