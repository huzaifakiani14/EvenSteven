import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { getGroupByJoinCode } from '../services/firebaseService';
import { isValidJoinCode } from '../utils/joinCodeGenerator';
import type { Group } from '../types';

export const JoinPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const groupId = searchParams.get('groupId');
  const codeParam = searchParams.get('code');

  useEffect(() => {
    // If user is not logged in but we have invite params, save them to localStorage
    if (!authLoading && !user && (groupId || codeParam)) {
      const inviteData = {
        groupId: groupId || null,
        code: codeParam || null,
        timestamp: Date.now(),
      };
      localStorage.setItem('pendingInvite', JSON.stringify(inviteData));
      navigate('/?invite=true');
      return;
    }

    // If user just logged in and there's a pending invite, process it
    if (!authLoading && user) {
      const pendingInviteStr = localStorage.getItem('pendingInvite');
      if (pendingInviteStr) {
        try {
          const pendingInvite = JSON.parse(pendingInviteStr);
          // Check if invite is not too old (24 hours)
          if (Date.now() - pendingInvite.timestamp < 24 * 60 * 60 * 1000) {
            // Use pending invite data if no URL params
            if (!groupId && !codeParam && pendingInvite.groupId) {
              navigate(`/join?groupId=${pendingInvite.groupId}`, { replace: true });
              return;
            }
            if (!groupId && !codeParam && pendingInvite.code) {
              navigate(`/join?code=${pendingInvite.code}`, { replace: true });
              return;
            }
          } else {
            // Expired invite
            localStorage.removeItem('pendingInvite');
          }
        } catch (error) {
          console.error('Error parsing pending invite:', error);
          localStorage.removeItem('pendingInvite');
        }
      }
    }

    const loadGroup = async () => {
      // Check if join code is provided in URL
      if (codeParam) {
        try {
          const groupData = await getGroupByJoinCode(codeParam);
          if (groupData) {
            setGroup(groupData);
            setLoading(false);
            return;
          } else {
            setError('Invalid join code. Group not found.');
            setShowCodeInput(true);
            setLoading(false);
            return;
          }
        } catch (error: any) {
          console.error('Error loading group by code:', error);
          setError(error.message || 'Failed to load group.');
          setShowCodeInput(true);
          setLoading(false);
          return;
        }
      }

      // Check if groupId is provided in URL
      if (groupId) {
        try {
          const { getGroup } = await import('../services/firebaseService');
          const groupData = await getGroup(groupId);
          if (groupData) {
            setGroup(groupData);
          } else {
            setError('Group not found or has been deleted.');
            setShowCodeInput(true);
          }
        } catch (error: any) {
          console.error('Error loading group:', error);
          setError(error.message || 'Failed to load group.');
          setShowCodeInput(true);
        } finally {
          setLoading(false);
        }
      } else {
        // No groupId or code - show code input
        setShowCodeInput(true);
        setLoading(false);
      }
    };

    if (!authLoading && user) {
      loadGroup();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [groupId, codeParam, authLoading, user, navigate]);

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
        
        // Clear pending invite from localStorage
        localStorage.removeItem('pendingInvite');
        
        showToast(`🎉 You've joined ${group.name} successfully!`, 'success');
        
        // Redirect to group page
        navigate(`/groups/${group.id}?joined=true`, { replace: true });
      } else {
        // Clear pending invite even if already a member
        localStorage.removeItem('pendingInvite');
        showToast('You are already a member of this group.', 'info');
        
        // Still redirect to group page
        navigate(`/groups/${group.id}`, { replace: true });
      }
    } catch (error: any) {
      console.error('Error joining group:', error);
      const errorMsg = error.message || 'Failed to join group. Please try again.';
      setError(errorMsg);
      showToast(errorMsg, 'error');
      // Clear pending invite on error
      localStorage.removeItem('pendingInvite');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = () => {
    navigate('/groups');
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCode.trim()) return;

    const code = joinCode.trim().toUpperCase();
    if (!isValidJoinCode(code)) {
      setError('Please enter a valid 6-character code.');
      showToast('Invalid code format. Please use 6 letters/numbers.', 'error');
      return;
    }

    try {
      setProcessing(true);
      setError('');
      const groupData = await getGroupByJoinCode(code);
      
      if (!groupData) {
        setError('Invalid code. No group found with this code.');
        showToast('Invalid join code. Please check and try again.', 'error');
        setProcessing(false);
        return;
      }

      setGroup(groupData);
      setShowCodeInput(false);
      // Automatically join if code is valid - trigger after state update
      setTimeout(() => {
        handleAccept();
      }, 100);
    } catch (error: any) {
      console.error('Error joining by code:', error);
      const errorMsg = error.message || 'Failed to join group. Please try again.';
      setError(errorMsg);
      showToast(errorMsg, 'error');
      setProcessing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Auto-accept invite when user logs in with pending invite
  useEffect(() => {
    if (!authLoading && user && group && !processing) {
      const pendingInviteStr = localStorage.getItem('pendingInvite');
      if (pendingInviteStr) {
        try {
          const pendingInvite = JSON.parse(pendingInviteStr);
          // Auto-accept if group matches pending invite
          if (
            (pendingInvite.groupId === group.id) ||
            (pendingInvite.code && codeParam === pendingInvite.code)
          ) {
            // Small delay to ensure UI is ready
            setTimeout(() => {
              handleAccept();
            }, 100);
          }
        } catch (error) {
          console.error('Error processing auto-accept:', error);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, group?.id, processing, codeParam]);

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

  // Show code input if no group loaded and no URL params
  if (showCodeInput && !group) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        {ToastComponent}
        <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Join Group by Code</h2>
            <p className="text-gray-400 text-sm">Enter the 6-character join code</p>
          </div>

          {error && (
            <div className="bg-red-900 bg-opacity-30 border border-red-600 rounded-lg p-4 mb-6">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleJoinByCode} className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2 text-sm">Join Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                  setError('');
                }}
                placeholder="ABC123"
                maxLength={6}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                autoFocus
                disabled={processing}
              />
              <p className="text-gray-400 text-xs mt-2 text-center">
                Enter the 6-character code shared by the group admin
              </p>
            </div>
            <button
              type="submit"
              disabled={processing || !isValidJoinCode(joinCode)}
              className="w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {processing ? 'Joining...' : 'Join Group'}
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
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
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

