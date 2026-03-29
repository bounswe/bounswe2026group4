export function useAsyncState() {
  return {
    isLoading: false,
    error: null as string | null,
  };
}
