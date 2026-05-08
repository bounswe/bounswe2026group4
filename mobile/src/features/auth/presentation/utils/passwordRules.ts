export const passwordRules = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (password: string) => password.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'One number',
    test: (password: string) => /[0-9]/.test(password),
  },
] as const;

export function getPasswordError(password: string) {
  const failedRule = passwordRules.find((rule) => !rule.test(password));

  if (!failedRule) {
    return undefined;
  }

  switch (failedRule.id) {
    case 'length':
      return 'Password must be at least 8 characters long.';
    case 'uppercase':
      return 'Password must contain at least one uppercase letter.';
    case 'lowercase':
      return 'Password must contain at least one lowercase letter.';
    case 'number':
      return 'Password must contain at least one number.';
    default:
      return 'Password does not meet the requirements.';
  }
}
