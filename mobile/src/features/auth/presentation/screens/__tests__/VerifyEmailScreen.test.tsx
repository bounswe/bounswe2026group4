import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../../app/providers/ThemeProvider';
import { authService } from '../../../application/services';
import { VerifyEmailScreen } from '../VerifyEmailScreen';

function renderScreen(props: Partial<React.ComponentProps<typeof VerifyEmailScreen>> = {}) {
  return render(
    <ThemeProvider>
      <VerifyEmailScreen email="traveler@example.com" onVerified={jest.fn()} {...props} />
    </ThemeProvider>,
  );
}

function enterCode(code = '123456') {
  code.split('').forEach((digit, index) => {
    fireEvent.changeText(screen.getByLabelText(`Digit ${index + 1}`), digit);
  });
}

describe('VerifyEmailScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders six digit inputs and the registered email', () => {
    renderScreen();

    expect(screen.getByText('Verify your email')).toBeTruthy();
    expect(screen.getByText(/traveler@example.com/)).toBeTruthy();
    expect(screen.getByLabelText('Digit 1')).toBeTruthy();
    expect(screen.getByLabelText('Digit 6')).toBeTruthy();
  });

  it('submits the completed verification code', async () => {
    const verifyEmail = jest.spyOn(authService, 'verifyEmail').mockResolvedValueOnce(undefined);
    const onVerified = jest.fn();
    renderScreen({ onVerified });

    enterCode();
    fireEvent.press(screen.getByText('Verify email'));

    await waitFor(() => {
      expect(verifyEmail).toHaveBeenCalledWith('traveler@example.com', '123456');
    });
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('shows an inline invalid-code error', async () => {
    jest.spyOn(authService, 'verifyEmail').mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          code: ['Invalid or expired verification code.'],
        },
      },
    });
    renderScreen();

    enterCode('000000');
    fireEvent.press(screen.getByText('Verify email'));

    expect(await screen.findByText('Invalid verification code. Please try again.')).toBeTruthy();
  });

  it('shows a resend option for expired codes', async () => {
    jest.spyOn(authService, 'verifyEmail').mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          code: ['Code has expired.'],
        },
      },
    });
    jest.spyOn(authService, 'resendVerificationCode').mockResolvedValueOnce(undefined);
    renderScreen();

    enterCode('000000');
    fireEvent.press(screen.getByText('Verify email'));

    expect(await screen.findByText('Code has expired. Tap to resend.')).toBeTruthy();

    fireEvent.press(screen.getByText('Resend code'));

    await waitFor(() => {
      expect(authService.resendVerificationCode).toHaveBeenCalledWith('traveler@example.com');
    });
    expect(screen.getAllByText(/Resend in 60s/).length).toBeGreaterThan(0);
  });

  it('handles rate limiting gracefully', async () => {
    jest.spyOn(authService, 'verifyEmail').mockRejectedValueOnce({
      response: {
        status: 429,
        data: {},
      },
    });
    renderScreen();

    enterCode('000000');
    fireEvent.press(screen.getByText('Verify email'));

    expect(await screen.findByText('Too many attempts. Please wait a moment and try again.')).toBeTruthy();
  });
});
