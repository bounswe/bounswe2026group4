import { BrowserRouter, Routes, Route } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout/AppLayout";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { Toaster } from "@/components/ui/toaster";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import ProfileCompletionPage from "@/pages/ProfileCompletionPage";
import NotFoundPage from "@/pages/NotFoundPage";
import FeedPage from "@/pages/FeedPage";
import MapPage from "@/pages/MapPage";
import ProfilePage from "@/pages/ProfilePage";
import SubmitStoryPage from "@/pages/SubmitStoryPage";
import StoryDetailPage from "@/pages/StoryDetailPage";
import TagPage from "@/pages/TagPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<FeedPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route
                path="/complete-profile"
                element={(
                  <ProtectedRoute>
                    <ProfileCompletionPage />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/profile"
                element={(
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/submit-story"
                element={(
                  <ProtectedRoute>
                    <SubmitStoryPage />
                  </ProtectedRoute>
                )}
              />
              <Route path="/profile/:userId" element={<ProfilePage />} />
              <Route path="/stories/:id" element={<StoryDetailPage />} />
              <Route path="/tags/:slug" element={<TagPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          <Toaster />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
