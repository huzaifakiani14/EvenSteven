import { useState } from 'react';
import { createInvite } from '../services/inviteService';
import { useAuth } from '../contexts/AuthContext';
import type { Group } from '../types';

interface InviteMembersProps {
  group: Group;
  onInviteSent?: () => void;
}

export const InviteMembers = ({ group, onInviteSent }: InviteMembersProps) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    // Check if email is already a member
    const memberEmails = Object.values(group.membersDetail || {}).map((m) => m.email.toLowerCase());
    if (memberEmails.includes(email.toLowerCase().trim())) {
      setError('This user is already a member of the group');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const inviteId = await createInvite(
        group.id,
        group.name,
        email.trim(),
        user.uid,
        user.name
      );

      // Generate invite link
      const inviteLink = `${window.location.origin}/join?groupId=${group.id}&inviteId=${inviteId}`;
      
      // Show toast notification
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Copy to clipboard
      navigator.clipboard.writeText(inviteLink).catch(() => {
        // Ignore clipboard errors
      });

      setEmail('');
      
      if (onInviteSent) {
        onInviteSent();
      }
    } catch (error: any) {
      console.error('Error creating invite:', error);
      setError(error.message || 'Failed to send invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-semibold mb-4">Invite Members</h3>
      <form onSubmit={handleInvite} className="space-y-4">
        <div>
          <label className="block text-gray-300 mb-2 text-sm">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            placeholder="user@example.com"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={loading}
          />
          {error && (
            <p className="text-red-400 text-sm mt-1">{error}</p>
          )}
          <p className="text-gray-400 text-xs mt-1">
            The user must have a Firebase account with this email
          </p>
        </div>
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send Invite'}
        </button>
      </form>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-up">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>Invite sent to {email}! Link copied to clipboard.</span>
          </div>
        </div>
      )}
    </div>
  );
};

