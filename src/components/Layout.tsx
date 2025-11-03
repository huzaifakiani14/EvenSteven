import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <Link to="/groups" className="flex items-center space-x-1 sm:space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold">EvenSteven</h1>
              <span className="text-gray-400">💸</span>
            </Link>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {user && (
                <div className="flex items-center space-x-1 sm:space-x-3">
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt={user.name}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0"
                    />
                  )}
                  <span className="text-gray-300 text-xs sm:text-base hidden sm:inline">{user.name}</span>
                  <button
                    onClick={handleSignOut}
                    className="bg-red-600 hover:bg-red-700 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm sm:text-base"
                  >
                    <span className="hidden sm:inline">Sign Out</span>
                    <span className="sm:hidden">Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-3 sm:px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {children}
      </main>
    </div>
  );
};

