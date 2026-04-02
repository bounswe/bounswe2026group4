export const validators = {
  required: (value: string) => value.trim().length > 0,
  email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
};
