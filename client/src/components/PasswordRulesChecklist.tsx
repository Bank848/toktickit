import { passwordRuleStatus } from '../lib/passwordRules';

export function PasswordRulesChecklist({ value }: { value: string }) {
  const rules = passwordRuleStatus(value);
  return (
    <ul className="list-unstyled small mt-2 mb-0">
      <li>{rules.length ? '✓' : '○'} Be at least 8 characters</li>
      <li>{rules.caseMix ? '✓' : '○'} Include upper and lower case letters</li>
      <li>{rules.numberAndSymbol ? '✓' : '○'} Include a number and a special character</li>
    </ul>
  );
}
