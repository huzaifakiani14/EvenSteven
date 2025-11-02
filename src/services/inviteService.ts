import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { updateGroup, getUser } from './firebaseService';
import type { Invite } from '../types';

// Invite operations
export const createInvite = async (
  groupId: string,
  groupName: string,
  invitedEmail: string,
  invitedBy: string,
  invitedByName: string
): Promise<string> => {
  const invitesRef = collection(db, 'invites');
  const docRef = await addDoc(invitesRef, {
    groupId,
    groupName,
    invitedBy,
    invitedByName,
    invitedEmail: invitedEmail.toLowerCase().trim(),
    status: 'pending',
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getInvite = async (inviteId: string): Promise<Invite | null> => {
  const inviteRef = doc(db, 'invites', inviteId);
  const inviteSnap = await getDoc(inviteRef);
  if (inviteSnap.exists()) {
    const data = inviteSnap.data();
    return {
      id: inviteSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as Invite;
  }
  return null;
};

export const acceptInvite = async (
  inviteId: string,
  userId: string
): Promise<void> => {
  const inviteRef = doc(db, 'invites', inviteId);
  const invite = await getInvite(inviteId);
  
  if (!invite) {
    throw new Error('Invite not found');
  }

  if (invite.status !== 'pending') {
    throw new Error(`Invite has already been ${invite.status}`);
  }

  // Get user details
  const user = await getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Update invite status
  await updateDoc(inviteRef, {
    status: 'accepted',
  });

  // Add user to group
  const group = await getDoc(doc(db, 'groups', invite.groupId));
  if (!group.exists()) {
    throw new Error('Group not found');
  }

  const groupData = group.data();
  const members = groupData.members || [];
  
  // Add user to members array if not already there
  if (!members.includes(userId)) {
    const updatedMembers = [...members, userId];
    
    // Update membersDetail
    const membersDetail = groupData.membersDetail || {};
    const memberInfo = {
      uid: userId,
      name: user.name,
      email: user.email,
      role: 'member',
      joinedAt: Timestamp.now(),
    };
    membersDetail[userId] = memberInfo as any;

    await updateGroup(invite.groupId, {
      members: updatedMembers,
      membersDetail,
    } as any);
  }
};

export const declineInvite = async (inviteId: string): Promise<void> => {
  const inviteRef = doc(db, 'invites', inviteId);
  await updateDoc(inviteRef, {
    status: 'declined',
  });
};

export const getInvitesByEmail = async (email: string): Promise<Invite[]> => {
  const invitesRef = collection(db, 'invites');
  const q = query(
    invitesRef,
    where('invitedEmail', '==', email.toLowerCase().trim()),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  })) as Invite[];
};

export const subscribeToInvites = (
  email: string,
  callback: (invites: Invite[]) => void
) => {
  const invitesRef = collection(db, 'invites');
  const q = query(
    invitesRef,
    where('invitedEmail', '==', email.toLowerCase().trim()),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const invites = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Invite[];
    callback(invites);
  });
};

export const getInvitesByGroup = async (groupId: string): Promise<Invite[]> => {
  const invitesRef = collection(db, 'invites');
  const q = query(
    invitesRef,
    where('groupId', '==', groupId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  })) as Invite[];
};

