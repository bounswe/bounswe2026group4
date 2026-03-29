export class AppError extends Error {
  constructor(message = 'Application error') {
    super(message);
    this.name = 'AppError';
  }
}
