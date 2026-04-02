import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { AuthScreen } from '../../features/auth/presentation/screens/AuthScreen';
import { RegisterPromptScreen } from '../../features/auth/presentation/screens/RegisterPromptScreen';
import { FeedScreen } from '../../features/feed/presentation/screens/FeedScreen';
import { MapScreen } from '../../features/map/presentation/screens/MapScreen';
import { ProfileScreen } from '../../features/profile/presentation/screens/ProfileScreen';
import { SubmissionScreen } from '../../features/submissions/presentation/screens/SubmissionScreen';
import { Loader } from '../../shared';
import { useAuth } from '../../features/auth/presentation/context/AuthContext';
import { AppLayout } from '../layout/AppLayout';
import { useAppNavigation } from '../providers/NavigationProvider';
import { isAuthActionRoute, isProtectedRoute } from './routes';

export function RootNavigator() {
  const { colorScheme } = useAppTheme();
  const { session, isAuthenticated, isRestoring } = useAuth();
  const { currentRoute, navigate } = useAppNavigation();

  useEffect(() => {
    if (!isAuthenticated && isProtectedRoute(currentRoute)) {
      navigate('login');
      return;
    }

    if (isAuthenticated && isAuthActionRoute(currentRoute)) {
      navigate('map');
    }
  }, [currentRoute, isAuthenticated, navigate]);

  if (isRestoring) {
    return (
      <>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        <Loader fullScreen message="Restoring session..." />
      </>
    );
  }

  let content = <MapScreen />;

  if (currentRoute === 'feed') {
    content = <FeedScreen />;
  } else if (currentRoute === 'submission' && session) {
    content = <SubmissionScreen />;
  } else if (currentRoute === 'profile' && session) {
    content = <ProfileScreen />;
  } else if (currentRoute === 'register' && !session) {
    content = <RegisterPromptScreen />;
  } else if (currentRoute === 'login' && !session) {
    content = <AuthScreen />;
  }

  return (
    <>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <AppLayout>{content}</AppLayout>
    </>
  );
}
