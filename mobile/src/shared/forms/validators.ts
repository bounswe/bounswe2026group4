export const validators = {
  required: (value: string) => value.trim().length > 0,
  email: (value: string) => /\S+@\S+\.\S+/.test(value.trim()),
};
