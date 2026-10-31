// One post-login landing map for every role (ui-spec.md section 8); AppShell, LoginPage and
// ChangePasswordPage all read it so a landing page can never drift between them.
export const HOME_ROUTE: Record<string, string> = {
  REQUESTER: '/dashboard',
  IT_STAFF: '/staff/dashboard',
  ADMINISTRATOR: '/staff/dashboard',
};
