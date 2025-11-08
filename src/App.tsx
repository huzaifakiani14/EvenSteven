import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { AuthWatcher } from './components/AuthWatcher';
import SkeletonLoader from './components/SkeletonLoader';

// Lazy load heavy components for better performance
const GroupsList = lazy(() => import('./components/GroupsList').then(m => ({ default: m.GroupsList })));
const GroupDetails = lazy(() => import('./components/GroupDetails').then(m => ({ default: m.GroupDetails })));
const JoinPage = lazy(() => import('./components/JoinPage').then(m => ({ default: m.JoinPage })));
const JoinByCode = lazy(() => import('./components/JoinByCode').then(m => ({ default: m.JoinByCode })));

const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="text-white text-xl">Loading...</div>
  </div>
);

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return user ? <>{children}</> : <Navigate to="/" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Check for pending invite - if exists, let AuthWatcher handle redirect
  if (user) {
    const pendingInvite = localStorage.getItem('pendingInvite');
    if (pendingInvite) {
      // Don't redirect here - let AuthWatcher process the invite first
      return <>{children}</>;
    }
    return <Navigate to="/groups" replace />;
  }

  return <>{children}</>;
};

function App() {
  // Global error handler for unhandled promise rejections
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      
      // Log to console for debugging
      if (event.reason) {
        console.error('Error details:', event.reason);
      }
      
      // Prevent default browser error handling
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AuthWatcher />
        <Suspense fallback={<SkeletonLoader />}>
          <Routes>
            <Route
              path="/"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/groups"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<SkeletonLoader />}>
                      <GroupsList />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/groups/:groupId"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<SkeletonLoader />}>
                      <GroupDetails />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/join"
              element={
                <Suspense fallback={<SkeletonLoader />}>
                  <JoinPage />
                </Suspense>
              }
            />
            <Route
              path="/join-code"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<SkeletonLoader />}>
                      <JoinByCode />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
