import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../../app/providers/ThemeProvider';
import { ToastProvider } from '../../../../../shared/toast/ToastProvider';
import { authService } from '../../../application/services';
import { ResetPasswordScreen } from '../ResetPasswordScreen';

function renderScreen(props: Partial<React.ComponentProps<typeof ResetPasswordScreen>> = {}) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <ResetPasswordScreen token="reset-token" {...props} />
      </ToastProvider>
    </ThemeProvider>,
  );
}

function resetPasswordButtonText() {
  const matches = screen.getAllByText('Reset password');

  return matches[matches.length - 1];
}

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders password fields and rules', () => {
    renderScreen();

    expect(screen.getAllByText('Reset password').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('New password')).toBeTruthy();
    expect(screen.getByLabelText('Confirm password')).toBeTruthy();
    expect(screen.getByText('[ ] At least 8 characters')).toBeTruthy();
  });

  it('shows inline password validation errors', () => {
    const resetPassword = jest.spyOn(authService, 'resetPassword').mockResolvedValueOnce(undefined);
    renderScreen();

    fireEvent.changeText(screen.getByLabelText('New password'), 'short');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'different');
    fireEvent.press(resetPasswordButtonText());

    expect(screen.getByText('Password must be at least 8 characters long.')).toBeTruthy();
    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('submits the token and matching new password', async () => {
    const resetPassword = jest.spyOn(authService, 'resetPassword').mockResolvedValueOnce(undefined);
    const onResetSuccess = jest.fn();
    renderScreen({ onResetSuccess });

    fireEvent.changeText(screen.getByLabelText('New password'), 'NewPassword1');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'NewPassword1');
    fireEvent.press(resetPasswordButtonText());

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith('reset-token', 'NewPassword1');
    });
    expect(onResetSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows invalid token errors with a link to request a new reset link', async () => {
    jest.spyOn(authService, 'resetPassword').mockRejectedValueOnce(new Error('Invalid token'));
    const onRequestNewLink = jest.fn();
    renderScreen({ onRequestNewLink });

    fireEvent.changeText(screen.getByLabelText('New password'), 'NewPassword1');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'NewPassword1');
    fireEvent.press(resetPasswordButtonText());

    expect(await screen.findByText('This reset link is invalid or expired.')).toBeTruthy();

    fireEvent.press(screen.getByText('Request a new reset link'));
    expect(onRequestNewLink).toHaveBeenCalledTimes(1);
  });

  it('does not submit when the token is missing', () => {
    const resetPassword = jest.spyOn(authService, 'resetPassword').mockResolvedValueOnce(undefined);
    renderScreen({ token: null });

    expect(screen.getByText('This reset link is missing a token.')).toBeTruthy();
    fireEvent.press(resetPasswordButtonText());
    expect(resetPassword).not.toHaveBeenCalled();
  });
});
