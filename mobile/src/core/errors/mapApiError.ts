export class MapApiError extends Error {
  constructor(message = 'Map API error') {
    super(message);
    this.name = 'MapApiError';
  }
}
