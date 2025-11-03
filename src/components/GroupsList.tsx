import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
      await createGroup(
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
      
      // Success: close modal, reset form, show toast
      showToast('✅ Group created successfully!', 'success');
      setGroupName('');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating group:', error);
      showToast('❌ Failed to create group. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, groupName, loading, showToast]);

  if (!user) return null;

  return (
    <div>
      {ToastComponent}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Your Groups</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
        >
          + New Group
        </button>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Create New Group</h3>
            <form onSubmit={handleCreateGroup}>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mb-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !groupName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/groups/${group.id}`}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 transition-colors border border-gray-700"
            >
              <h3 className="text-xl font-semibold mb-2">{group.name}</h3>
              <p className="text-gray-400 text-sm">
                {group.members.length} member{group.members.length !== 1 ? 's' : ''}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

