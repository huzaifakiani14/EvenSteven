import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { InvitesDropdown } from './InvitesDropdown';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/groups" className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold">EvenSteven</h1>
              <span className="text-gray-400">💸</span>
            </Link>
            <div className="flex items-center space-x-4">
              {user && (
                <div className="flex items-center space-x-3">
                  <InvitesDropdown />
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt={user.name}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-gray-300">{user.name}</span>
                  <button
                    onClick={handleSignOut}
                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

