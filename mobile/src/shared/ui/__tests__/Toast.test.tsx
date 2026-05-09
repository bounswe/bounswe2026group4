import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '../../toast/ToastProvider';
import { useToast } from '../../hooks/useToast';
import { Button } from '../Button';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, right: 0, bottom: 34, left: 0 },
};

function renderToastTrigger() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    </SafeAreaProvider>,
  );
}

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
    renderToastTrigger();

    fireEvent.press(screen.getByText('Success'));

    expect(screen.getByText('Story saved!')).toBeTruthy();
  });

  it('dismisses a toast', () => {
    renderToastTrigger();

    fireEvent.press(screen.getByText('Error'));
    expect(screen.getByText('Save failed!')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Dismiss notification'));
    expect(screen.queryByText('Save failed!')).toBeNull();
  });

  it('replaces the current toast instead of stacking several notifications', () => {
    renderToastTrigger();

    fireEvent.press(screen.getByText('Success'));
    fireEvent.press(screen.getByText('Error'));
    fireEvent.press(screen.getByText('Info'));

    expect(screen.queryByText('Story saved!')).toBeNull();
    expect(screen.queryByText('Save failed!')).toBeNull();
    expect(screen.getByText('Session expires soon.')).toBeTruthy();
    expect(screen.getAllByLabelText('Dismiss notification')).toHaveLength(1);
  });

  it('positions toasts above bottom app chrome', () => {
    renderToastTrigger();

    fireEvent.press(screen.getByText('Info'));

    expect(screen.getByTestId('toast-container')).toHaveStyle({
      bottom: 146,
      top: undefined,
    });
  });
});
