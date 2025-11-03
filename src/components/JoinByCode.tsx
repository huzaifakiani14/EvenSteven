import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { getGroupByJoinCode } from '../services/firebaseService';
import { isValidJoinCode } from '../utils/joinCodeGenerator';

export const JoinByCode = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const handleJoinByCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      // Save code to localStorage and redirect to login
      const inviteData = {
        code: code.toUpperCase(),
        timestamp: Date.now(),
      };
      localStorage.setItem('pendingInvite', JSON.stringify(inviteData));
      navigate('/');
      showToast('Please sign in to join the group', 'info');
      return;
    }

    if (!code.trim()) {
      showToast('Please enter a join code', 'error');
      return;
    }

    const upperCode = code.trim().toUpperCase();
    if (!isValidJoinCode(upperCode)) {
      showToast('Invalid code format. Please use 6 letters/numbers.', 'error');
      return;
    }

    try {
      setLoading(true);
      
      const group = await getGroupByJoinCode(upperCode);
      
      if (!group) {
        showToast('❌ Invalid code. Group not found.', 'error');
        setLoading(false);
        return;
      }

      // Check if user is already a member
      if (group.members.includes(user.uid)) {
        showToast('You are already a member of this group.', 'info');
        navigate(`/groups/${group.id}`);
        return;
      }

      // Add user to group
      const { getGroup, updateGroup } = await import('../services/firebaseService');
      const currentGroup = await getGroup(group.id);
      
      if (!currentGroup) {
        throw new Error('Group not found');
      }

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

      showToast(`🎉 You've joined ${group.name} successfully!`, 'success');
      
      // Redirect to group page
      navigate(`/groups/${group.id}?joined=true`, { replace: true });
    } catch (error: any) {
      console.error('Error joining by code:', error);
      const errorMsg = error.message || 'Failed to join group. Please try again.';
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      {ToastComponent}
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Join Group by Code</h2>
          <p className="text-gray-400 text-sm">
            Enter the 6-character code shared by the group admin
          </p>
        </div>

        <form onSubmit={handleJoinByCode} className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2 text-sm">Join Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
              }}
              placeholder="ABC123"
              maxLength={6}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              autoFocus
              disabled={loading}
            />
            <p className="text-gray-400 text-xs mt-2 text-center">
              Enter the 6-character code shared by the group admin
            </p>
          </div>
          
          <button
            type="submit"
            disabled={loading || !isValidJoinCode(code.toUpperCase())}
            className="w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? 'Joining...' : 'Join Group'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-700 text-center">
          <button
            onClick={() => navigate('/groups')}
            className="text-gray-400 hover:text-white text-sm"
          >
            ← Back to Groups
          </button>
        </div>
      </div>
    </div>
  );
};

