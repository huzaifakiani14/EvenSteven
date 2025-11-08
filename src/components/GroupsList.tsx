import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { subscribeToGroups, createGroup } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import type { Group } from '../types';

export const GroupsList = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast, ToastComponent } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToGroups(user.uid, (updatedGroups) => {
      setGroups(updatedGroups);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateGroup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupName.trim() || loading) return;

    try {
      setLoading(true);
      const newGroupId = await createGroup(
        {
          name: groupName.trim(),
          createdBy: user.uid,
          members: [user.uid],
        },
        {
          uid: user.uid,
          name: user.name,
          email: user.email,
        }
      );
      
      // Success: close modal immediately, reset form, show toast
      setGroupName('');
      setShowCreateModal(false);
      setLoading(false); // Reset loading immediately
      
      showToast('✅ Group created successfully!', 'success');

      // Navigate immediately to the new group for faster perceived performance
      if (newGroupId) {
        navigate(`/groups/${newGroupId}`);
      }
    } catch (error: any) {
      console.error('Error creating group:', error);
      setLoading(false);
      
      // Show specific error message if available
      const errorMessage = error?.message || 'Failed to create group. Please try again.';
      showToast(`❌ ${errorMessage}`, 'error');
    }
  }, [user, groupName, loading, showToast, navigate]);

  if (!user) return null;

  return (
    <div>
      {ToastComponent}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold">Your Groups</h2>
        <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            to="/join-code"
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 px-4 sm:px-6 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>🧾</span>
            <span className="hidden sm:inline">Join by Code</span>
            <span className="sm:hidden">Join Code</span>
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 px-4 sm:px-6 py-2 rounded-lg transition-colors text-sm sm:text-base"
          >
            + New Group
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Create New Group</h3>
            <form onSubmit={handleCreateGroup}>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-2 mb-3 sm:mb-4 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sm:space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !groupName.trim()}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <p className="text-gray-400 mb-4">No groups yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/groups/${group.id}`}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 sm:p-6 transition-colors border border-gray-700"
            >
              <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">{group.name}</h3>
              <p className="text-gray-400 text-xs sm:text-sm">
                {group.members.length} member{group.members.length !== 1 ? 's' : ''}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

