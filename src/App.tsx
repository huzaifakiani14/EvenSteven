import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './components/Login';

// Lazy load heavy components for better performance
const GroupsList = lazy(() => import('./components/GroupsList').then(m => ({ default: m.GroupsList })));
const GroupDetails = lazy(() => import('./components/GroupDetails').then(m => ({ default: m.GroupDetails })));
const JoinPage = lazy(() => import('./components/JoinPage').then(m => ({ default: m.JoinPage })));

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

  return user ? <Navigate to="/groups" replace /> : <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingSpinner />}>
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
                    <Suspense fallback={<LoadingSpinner />}>
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
                    <Suspense fallback={<LoadingSpinner />}>
                      <GroupDetails />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/join"
              element={
                <Suspense fallback={<LoadingSpinner />}>
                  <JoinPage />
                </Suspense>
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
