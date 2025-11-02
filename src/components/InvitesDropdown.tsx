import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToInvites } from '../services/inviteService';
import { useAuth } from '../contexts/AuthContext';
import type { Invite } from '../types';

export const InvitesDropdown = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = subscribeToInvites(user.email, (updatedInvites) => {
      setInvites(updatedInvites);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user || invites.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
      >
        <span>🔔</span>
        <span>Invites</span>
        {invites.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {invites.length}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-xl z-50 border border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <h3 className="font-semibold text-white">Pending Invitations</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {invites.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  No pending invitations
                </div>
              ) : (
                invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="p-4 border-b border-gray-700 hover:bg-gray-700 cursor-pointer"
                    onClick={() => {
                      navigate(`/join?groupId=${invite.groupId}&inviteId=${invite.id}`);
                      setShowDropdown(false);
                    }}
                  >
                    <p className="font-semibold text-white">{invite.groupName}</p>
                    <p className="text-sm text-gray-400">
                      Invited by {invite.invitedByName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(invite.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
            {invites.length > 0 && (
              <div className="p-2 border-t border-gray-700">
                <button
                  onClick={() => {
                    navigate('/join');
                    setShowDropdown(false);
                  }}
                  className="w-full text-center text-blue-400 hover:text-blue-300 text-sm py-2"
                >
                  View All Invites
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

