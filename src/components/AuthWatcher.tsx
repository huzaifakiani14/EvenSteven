import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getGroupByJoinCode } from '../services/firebaseService';

/**
 * AuthWatcher processes pending invites immediately after login
 * and redirects users to the correct group before default redirects happen.
 */
export const AuthWatcher = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only process if user is logged in and we're done loading
    if (loading || !user) return;

    const processPendingInvite = async () => {
      const pendingInviteStr = localStorage.getItem('pendingInvite');
      if (!pendingInviteStr) return;

      try {
        const pendingInvite = JSON.parse(pendingInviteStr);
        
        // Check if invite is not too old (24 hours)
        if (pendingInvite.timestamp && Date.now() - pendingInvite.timestamp > 24 * 60 * 60 * 1000) {
          localStorage.removeItem('pendingInvite');
          return;
        }

        let targetGroupId: string | null = null;

        // Process groupId invite
        if (pendingInvite.groupId) {
          try {
            const { getGroup, updateGroup } = await import('../services/firebaseService');
            const group = await getGroup(pendingInvite.groupId);
            
            if (group) {
              // Check if user is already a member
              if (!group.members.includes(user.uid)) {
                const updatedMembers = [...group.members, user.uid];
                const membersDetail = group.membersDetail || {};
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
              }
              targetGroupId = group.id;
            }
          } catch (error) {
            console.error('Error processing groupId invite:', error);
          }
        }
        // Process code invite
        else if (pendingInvite.code) {
          try {
            const group = await getGroupByJoinCode(pendingInvite.code.toUpperCase());
            
            if (group) {
              // Check if user is already a member
              if (!group.members.includes(user.uid)) {
                const { updateGroup } = await import('../services/firebaseService');
                const updatedMembers = [...group.members, user.uid];
                const membersDetail = group.membersDetail || {};
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
              }
              targetGroupId = group.id;
            }
          } catch (error) {
            console.error('Error processing code invite:', error);
          }
        }

        // Clear pending invite
        localStorage.removeItem('pendingInvite');

        // Redirect to group if we found one
        if (targetGroupId) {
          navigate(`/groups/${targetGroupId}?joined=true`, { replace: true });
        }
      } catch (error) {
        console.error('Error processing pending invite:', error);
        localStorage.removeItem('pendingInvite');
      }
    };

    processPendingInvite();
  }, [user, loading, navigate]);

  return null;
};

