// Client-side, advisory-only mirror of the server's password policy (api-spec.md #4 re-validates
// independently) -- shared by Change Password's New Password field and Admin User Management's
// Create-mode Initial Password field (ui-spec.md §9: "same live policy checklist as Change
// Password's New Password field").
export function passwordRuleStatus(value: string) {
  return {
    length: value.length >= 8,
    caseMix: /[A-Z]/.test(value) && /[a-z]/.test(value),
    numberAndSymbol: /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value),
  };
}
