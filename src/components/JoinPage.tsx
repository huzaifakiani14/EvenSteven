import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import type { Group } from '../types';

export const JoinPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const { showToast, ToastComponent } = useToast();

  const groupId = searchParams.get('groupId');

  useEffect(() => {
    const loadGroup = async () => {
      if (!groupId) {
        setError('Invalid invite link. Missing group ID.');
        setLoading(false);
        return;
      }

      try {
        const { getGroup } = await import('../services/firebaseService');
        const groupData = await getGroup(groupId);
        if (groupData) {
          setGroup(groupData);
        } else {
          setError('Group not found or has been deleted.');
        }
      } catch (error: any) {
        console.error('Error loading group:', error);
        setError(error.message || 'Failed to load group.');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadGroup();
    }
  }, [groupId, authLoading]);

  const handleAccept = async () => {
    if (!user || !group) return;

    try {
      setProcessing(true);
      setError('');
      const { getGroup, updateGroup } = await import('../services/firebaseService');
      
      const currentGroup = await getGroup(group.id);
      if (!currentGroup) {
        throw new Error('Group not found');
      }

      // Add user to group if not already a member
      if (!currentGroup.members.includes(user.uid)) {
        const updatedMembers = [...currentGroup.members, user.uid];
        const membersDetail = currentGroup.membersDetail || {};
        membersDetail[user.uid] = {
          uid: user.uid,
          name: user.name,
          email: user.email,
          role: 'member',
          joinedAt: new Date(),
        };

        await updateGroup(group.id, {
          members: updatedMembers,
          membersDetail,
        } as any);
        
        showToast('🎉 Joined group successfully!', 'success');
      } else {
        showToast('You are already a member of this group.', 'info');
      }

      // Small delay to show toast before navigation
      setTimeout(() => {
        navigate(`/groups/${group.id}`);
      }, 500);
    } catch (error: any) {
      console.error('Error joining group:', error);
      const errorMsg = error.message || 'Failed to join group. Please try again.';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = () => {
    navigate('/groups');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Sign In Required</h2>
          <p className="text-gray-300 mb-6">
            Please sign in to accept this invitation.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => navigate('/groups')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
          >
            Go to Groups
          </button>
        </div>
      </div>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      {ToastComponent}
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Join Group</h2>
        </div>

        <div className="bg-gray-700 rounded-lg p-6 mb-6">
          <p className="text-gray-300 mb-4">
            You've been invited to join
          </p>
          <h3 className="text-xl font-bold text-white mb-4">{group.name}</h3>
        </div>

        {error && (
          <div className="bg-red-900 bg-opacity-30 border border-red-600 rounded-lg p-4 mb-6">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={handleAccept}
            disabled={processing}
            className="flex-1 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {processing ? 'Joining...' : 'Join Group'}
          </button>
          <button
            onClick={handleDecline}
            disabled={processing}
            className="flex-1 bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

