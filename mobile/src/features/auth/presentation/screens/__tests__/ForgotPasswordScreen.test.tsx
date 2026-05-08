import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../../app/providers/ThemeProvider';
import { ToastProvider } from '../../../../../shared/toast/ToastProvider';
import { authService } from '../../../application/services';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';

function renderScreen(props: Partial<React.ComponentProps<typeof ForgotPasswordScreen>> = {}) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <ForgotPasswordScreen {...props} />
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the email form', () => {
    renderScreen();

    expect(screen.getByText('Forgot password')).toBeTruthy();
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.getByText('Send reset link')).toBeTruthy();
  });

  it('validates email before submitting', () => {
    const forgotPassword = jest.spyOn(authService, 'forgotPassword').mockResolvedValueOnce(undefined);
    renderScreen();

    fireEvent.changeText(screen.getByLabelText('Email address'), 'not-an-email');
    fireEvent.press(screen.getByText('Send reset link'));

    expect(screen.getByText('Please enter a valid email address.')).toBeTruthy();
    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it('submits the email and shows the vague confirmation message', async () => {
    const forgotPassword = jest.spyOn(authService, 'forgotPassword').mockResolvedValueOnce(undefined);
    renderScreen();

    fireEvent.changeText(screen.getByLabelText('Email address'), ' Traveler@Example.COM ');
    fireEvent.press(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(forgotPassword).toHaveBeenCalledWith('Traveler@Example.COM');
    });
    expect(
      screen.getByText("If an account exists with this email, we've sent a password reset link. Check your inbox."),
    ).toBeTruthy();
  });
});
