import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchUsers,
  createUser,
  updateUser,
  setInitialPassword,
  ApiError,
  type UserAdminDto,
  type UserRole,
} from '../api/adminUsers';
import { Icon } from '../components/Icon';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'REQUESTER', label: 'Requester' },
  { value: 'IT_STAFF', label: 'IT Staff' },
  { value: 'ADMINISTRATOR', label: 'Administrator' },
];

const SEARCH_DEBOUNCE_MS = 300;

type PanelMode = 'closed' | 'create' | 'edit';
type LoadState = 'loading' | 'loaded' | 'error';

interface FormState {
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  initialPassword: string;
}

const EMPTY_FORM: FormState = {
  displayName: '',
  email: '',
  role: 'REQUESTER',
  isActive: true,
  initialPassword: '',
};

export function AdminUserManagementPage() {
  const { currentUser } = useAuth();

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');

  const [users, setUsers] = useState<UserAdminDto[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const [panelMode, setPanelMode] = useState<PanelMode>('closed');
  const [editingUser, setEditingUser] = useState<UserAdminDto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [panelAlert, setPanelAlert] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [passwordDialogUser, setPasswordDialogUser] = useState<UserAdminDto | null>(null);
  const [passwordDialogValue, setPasswordDialogValue] = useState('');
  const [passwordDialogError, setPasswordDialogError] = useState('');

  // Debounce the raw search box, same pattern as MyTicketsPage.
  useEffect(() => {
    const trimmed = searchInput.trim();
    const handle = setTimeout(() => setQ(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const loadUsers = useCallback(() => {
    setLoadState('loading');
    fetchUsers({ q: q || undefined, role: roleFilter || undefined })
      .then((data) => {
        setUsers(data);
        setLoadState('loaded');
      })
      .catch(() => setLoadState('error'));
  }, [q, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openCreatePanel() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setPanelAlert('');
    setPanelMode('create');
  }

  function openEditPanel(target: UserAdminDto) {
    setEditingUser(target);
    setForm({
      displayName: target.displayName,
      email: target.email,
      role: target.role,
      isActive: target.isActive,
      initialPassword: '',
    });
    setFieldErrors({});
    setPanelAlert('');
    setPanelMode('edit');
  }

  function closePanel() {
    setPanelMode('closed');
    setEditingUser(null);
  }

  function applyApiError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.fieldErrors.length > 0) {
        const next: Record<string, string> = {};
        for (const fe of error.fieldErrors) next[fe.field] = fe.message;
        setFieldErrors(next);
      } else {
        setPanelAlert(error.message);
      }
    } else {
      setPanelAlert('Something went wrong. Please try again.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setPanelAlert('');
    try {
      if (panelMode === 'create') {
        await createUser({
          displayName: form.displayName,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
          initialPassword: form.initialPassword,
        });
        setSuccessMessage('User created');
      } else if (panelMode === 'edit' && editingUser) {
        await updateUser(editingUser.id, {
          displayName: form.displayName,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
        });
        setSuccessMessage('User updated');
      }
      closePanel();
      loadUsers();
    } catch (error) {
      applyApiError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(target: UserAdminDto) {
    try {
      await updateUser(target.id, {
        displayName: target.displayName,
        email: target.email,
        role: target.role,
        isActive: !target.isActive,
      });
      setSuccessMessage(target.isActive ? 'User deactivated' : 'User activated');
      loadUsers();
    } catch {
      // A dedicated one-click action -- surfaced as a page-level alert since there's no form
      // panel field to attach a field error to here.
      setPanelAlert('Could not update this user\'s status.');
    }
  }

  async function handleSetPassword(event: FormEvent) {
    event.preventDefault();
    if (!passwordDialogUser) return;
    setPasswordDialogError('');
    try {
      await setInitialPassword(passwordDialogUser.id, passwordDialogValue);
      setSuccessMessage('Password reset — user must change it at next login');
      setPasswordDialogUser(null);
      setPasswordDialogValue('');
      loadUsers();
    } catch (error) {
      setPasswordDialogError(error instanceof ApiError ? error.message : 'Could not reset the password.');
    }
  }

  const isLastActiveAdmin = (target: UserAdminDto) =>
    target.role === 'ADMINISTRATOR' &&
    target.isActive &&
    users.filter((u) => u.role === 'ADMINISTRATOR' && u.isActive).length <= 1;

  const isSelf = (target: UserAdminDto) => currentUser?.id === target.id;

  return (
    <div>
      <h1>Users</h1>

      {successMessage && (
        <div className="alert alert-success alert-dismissible" role="status">
          {successMessage}
          <button type="button" className="btn-close" onClick={() => setSuccessMessage('')} aria-label="Dismiss" />
        </div>
      )}

      <div className="row">
        <div className="col-12 col-lg-6">
          <div className="row g-2 mb-3">
            <div className="col-8">
              <input
                type="text"
                className="form-control"
                placeholder="Search users…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <div className="col-4">
              <select
                className="form-select"
                aria-label="Role filter"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as UserRole | '')}
              >
                <option value="">Any role</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="button" className="btn btn-primary mb-3" onClick={openCreatePanel}>
            Create User
          </button>

          {loadState === 'loading' && <p aria-busy="true">Loading users…</p>}
          {loadState === 'error' && (
            <div role="alert" className="alert alert-danger">
              Failed to load users.
              <button type="button" className="btn btn-outline-danger btn-sm ms-2" onClick={loadUsers}>
                Retry
              </button>
            </div>
          )}
          {loadState === 'loaded' && users.length === 0 && (
            <p className="text-body-secondary">No users match your search.</p>
          )}

          {loadState === 'loaded' && users.length > 0 && (
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {users.map((target) => (
                  <tr key={target.id}>
                    <td>{target.displayName}</td>
                    <td>{ROLE_OPTIONS.find((r) => r.value === target.role)?.label}</td>
                    <td>
                      <span className={`badge ${target.isActive ? 'badge-tone-success' : 'badge-tone-neutral'}`}>
                        {target.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        aria-label={`Edit ${target.displayName}`}
                        onClick={() => openEditPanel(target)}
                      >
                        <Icon name="pencil" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="col-12 col-lg-6">
          {panelMode === 'closed' && (
            <p className="text-body-secondary">Select a user to edit, or create a new one.</p>
          )}

          {panelMode !== 'closed' && (
            <form onSubmit={handleSubmit}>
              <h2>{panelMode === 'create' ? 'Create User' : 'Edit User'}</h2>

              {panelAlert && (
                <div role="alert" className="alert alert-danger">
                  {panelAlert}
                </div>
              )}

              <div className="mb-3">
                <label htmlFor="user-form-name" className="form-label">
                  Full Name
                </label>
                <input
                  id="user-form-name"
                  className="form-control"
                  value={form.displayName}
                  disabled={submitting}
                  onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                />
                {fieldErrors.displayName && <div className="text-danger small">{fieldErrors.displayName}</div>}
              </div>

              <div className="mb-3">
                <label htmlFor="user-form-email" className="form-label">
                  Email Address
                </label>
                <input
                  id="user-form-email"
                  type="email"
                  className="form-control"
                  value={form.email}
                  disabled={submitting}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
                {fieldErrors.email && <div className="text-danger small">{fieldErrors.email}</div>}
              </div>

              <div className="mb-3">
                <label htmlFor="user-form-role" className="form-label">
                  Role
                </label>
                <select
                  id="user-form-role"
                  className="form-select"
                  value={form.role}
                  disabled={submitting}
                  onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.role && <div className="text-danger small">{fieldErrors.role}</div>}
              </div>

              <div className="form-check form-switch mb-3">
                <input
                  id="user-form-active"
                  type="checkbox"
                  className="form-check-input"
                  checked={form.isActive}
                  disabled={submitting}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <label htmlFor="user-form-active" className="form-check-label">
                  Active
                </label>
              </div>

              {panelMode === 'create' && (
                <div className="mb-3">
                  <label htmlFor="user-form-password" className="form-label">
                    Initial Password
                  </label>
                  <input
                    id="user-form-password"
                    type="password"
                    className="form-control"
                    value={form.initialPassword}
                    disabled={submitting}
                    onChange={(event) => setForm((prev) => ({ ...prev, initialPassword: event.target.value }))}
                  />
                  {fieldErrors.initialPassword && (
                    <div className="text-danger small">{fieldErrors.initialPassword}</div>
                  )}
                  <p className="form-text">The user must change this password at first login.</p>
                </div>
              )}

              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={submitting} aria-busy={submitting}>
                  Save User
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={closePanel} disabled={submitting}>
                  Cancel
                </button>
              </div>

              {panelMode === 'edit' && editingUser && (
                <div className="mt-4 pt-3 border-top d-flex flex-column gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setPasswordDialogUser(editingUser)}
                  >
                    Set New Password
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    disabled={isSelf(editingUser) || isLastActiveAdmin(editingUser)}
                    title={
                      isSelf(editingUser)
                        ? 'You cannot deactivate your own account'
                        : isLastActiveAdmin(editingUser)
                          ? 'At least one active Administrator is required'
                          : undefined
                    }
                    onClick={() => handleToggleActive(editingUser)}
                  >
                    {editingUser.isActive ? 'Deactivate User' : 'Activate User'}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {passwordDialogUser && (
        <div role="dialog" aria-label={`Set new password for ${passwordDialogUser.displayName}`}>
          <form onSubmit={handleSetPassword}>
            {passwordDialogError && (
              <div role="alert" className="alert alert-danger">
                {passwordDialogError}
              </div>
            )}
            <label htmlFor="password-dialog-input" className="form-label">
              Initial Password
            </label>
            <input
              id="password-dialog-input"
              type="password"
              className="form-control"
              value={passwordDialogValue}
              onChange={(event) => setPasswordDialogValue(event.target.value)}
            />
            <p className="form-text">The user must change this password at first login.</p>
            <div className="d-flex gap-2 mt-2">
              <button type="submit" className="btn btn-primary">
                Save Password
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setPasswordDialogUser(null);
                  setPasswordDialogValue('');
                  setPasswordDialogError('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
