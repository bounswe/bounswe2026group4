import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ToastProvider } from '../../toast/ToastProvider';
import { useToast } from '../../hooks/useToast';
import { Button } from '../Button';

function ToastTrigger() {
  const { toast } = useToast();

  return (
    <>
      <Button onPress={() => toast.success('Story saved!')}>Success</Button>
      <Button onPress={() => toast.error('Save failed!')}>Error</Button>
      <Button onPress={() => toast.info('Session expires soon.')}>Info</Button>
    </>
  );
}

describe('Toast', () => {
  it('shows a success toast', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.press(screen.getByText('Success'));

    expect(screen.getByText('Story saved!')).toBeTruthy();
  });

  it('dismisses a toast', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.press(screen.getByText('Error'));
    expect(screen.getByText('Save failed!')).toBeTruthy();

    fireEvent.press(screen.getByText('x'));
    expect(screen.queryByText('Save failed!')).toBeNull();
  });
});
