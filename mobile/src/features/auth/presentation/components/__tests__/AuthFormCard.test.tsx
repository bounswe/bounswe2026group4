import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../../app/providers/ThemeProvider';
import { AuthFormCard } from '../AuthFormCard';

function renderCard(mode: 'signIn' | 'register' = 'signIn') {
  return render(
    <ThemeProvider>
      <AuthFormCard
        mode={mode}
        username=""
        email="traveler@example.com"
        password="Password1"
        confirmPassword="Password1"
        fieldErrors={{}}
        isLoading={false}
        passwordRules={[
          { id: 'length', label: 'At least 8 characters', passed: true },
          { id: 'uppercase', label: 'One uppercase letter', passed: true },
        ]}
        onUsernameChange={() => undefined}
        onEmailChange={() => undefined}
        onPasswordChange={() => undefined}
        onConfirmPasswordChange={() => undefined}
        onSubmit={() => undefined}
        onToggleMode={() => undefined}
      />
    </ThemeProvider>,
  );
}

describe('AuthFormCard', () => {
  it('toggles password visibility on sign in', () => {
    renderCard();

    const passwordInput = screen.getByLabelText('Password');

    expect(passwordInput.props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);

    fireEvent.press(screen.getByLabelText('Hide password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });

  it('toggles confirm password visibility on registration', () => {
    renderCard('register');

    const confirmPasswordInput = screen.getByLabelText('Confirm password');

    expect(confirmPasswordInput.props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByLabelText('Show confirm password'));
    expect(screen.getByLabelText('Confirm password').props.secureTextEntry).toBe(false);
  });
});
