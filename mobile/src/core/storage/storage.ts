export const storage = {
  get: async (_key: string) => Promise.resolve(null),
  set: async (_key: string, _value: unknown) => Promise.resolve(),
  remove: async (_key: string) => Promise.resolve(),
};
