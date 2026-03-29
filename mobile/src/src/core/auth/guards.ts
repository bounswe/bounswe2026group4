export function canAccessRestrictedActions(role: 'guest' | 'user' | 'admin') {
  return role !== 'guest';
}
