import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { GroupsList } from './components/GroupsList';
import { GroupDetails } from './components/GroupDetails';
import { JoinPage } from './components/JoinPage';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
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
                  <GroupsList />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/groups/:groupId"
            element={
              <PrivateRoute>
                <Layout>
                  <GroupDetails />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/join"
            element={
              <PrivateRoute>
                <JoinPage />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
