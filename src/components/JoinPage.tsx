import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getInvite, acceptInvite, declineInvite } from '../services/inviteService';
import { useAuth } from '../contexts/AuthContext';
import type { Invite } from '../types';

export const JoinPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const inviteId = searchParams.get('inviteId');

  useEffect(() => {
    const loadInvite = async () => {
      if (!inviteId) {
        setError('Invalid invite link. Missing invite ID.');
        setLoading(false);
        return;
      }

      try {
        const inviteData = await getInvite(inviteId);
        if (!inviteData) {
          setError('Invite not found or has been deleted.');
          setLoading(false);
          return;
        }

        setInvite(inviteData);

        // Check if user is logged in and email matches
        if (!authLoading && user) {
          if (user.email.toLowerCase() !== inviteData.invitedEmail.toLowerCase()) {
            setError(`This invite is for ${inviteData.invitedEmail}, but you're signed in as ${user.email}. Please sign out and sign in with the correct account.`);
          }
        }
      } catch (error: any) {
        console.error('Error loading invite:', error);
        setError(error.message || 'Failed to load invite.');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadInvite();
    }
  }, [inviteId, user, authLoading]);

  const handleAccept = async () => {
    if (!user || !invite) return;

    if (user.email.toLowerCase() !== invite.invitedEmail.toLowerCase()) {
      setError('Email mismatch. Please sign in with the correct account.');
      return;
    }

    try {
      setProcessing(true);
      setError('');
      await acceptInvite(invite.id, user.uid);
      navigate(`/groups/${invite.groupId}`);
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      setError(error.message || 'Failed to accept invite. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!invite) return;

    try {
      setProcessing(true);
      setError('');
      await declineInvite(invite.id);
      navigate('/groups');
    } catch (error: any) {
      console.error('Error declining invite:', error);
      setError(error.message || 'Failed to decline invite. Please try again.');
    } finally {
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

  if (error && !invite) {
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

  if (!invite) {
    return null;
  }

  const emailMatches = user.email.toLowerCase() === invite.invitedEmail.toLowerCase();
  const canAccept = emailMatches && invite.status === 'pending';

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Group Invitation</h2>
          {invite.status === 'accepted' && (
            <p className="text-green-400 mb-4">✓ You've already accepted this invitation</p>
          )}
          {invite.status === 'declined' && (
            <p className="text-red-400 mb-4">This invitation has been declined</p>
          )}
        </div>

        <div className="bg-gray-700 rounded-lg p-6 mb-6">
          <p className="text-gray-300 mb-4">
            You've been invited to join
          </p>
          <h3 className="text-xl font-bold text-white mb-4">{invite.groupName}</h3>
          <p className="text-gray-400 text-sm">
            Invited by <span className="text-white font-semibold">{invite.invitedByName}</span>
          </p>
        </div>

        {!emailMatches && (
          <div className="bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded-lg p-4 mb-6">
            <p className="text-yellow-300 text-sm">
              ⚠️ This invite is for <strong>{invite.invitedEmail}</strong>, but you're signed in as <strong>{user.email}</strong>.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-900 bg-opacity-30 border border-red-600 rounded-lg p-4 mb-6">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {invite.status === 'pending' && (
          <div className="flex space-x-3">
            <button
              onClick={handleAccept}
              disabled={!canAccept || processing}
              className="flex-1 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {processing ? 'Processing...' : 'Accept'}
            </button>
            <button
              onClick={handleDecline}
              disabled={processing}
              className="flex-1 bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {processing ? 'Processing...' : 'Decline'}
            </button>
          </div>
        )}

        {invite.status !== 'pending' && (
          <button
            onClick={() => navigate('/groups')}
            className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors font-semibold"
          >
            Go to Groups
          </button>
        )}
      </div>
    </div>
  );
};

