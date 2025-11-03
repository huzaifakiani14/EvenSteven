import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { User, Group, Expense, Activity, GroupMember } from '../types';

// User operations
export const createUser = async (uid: string, userData: Omit<User, 'uid' | 'createdAt'>): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...userData,
    createdAt: Timestamp.now(),
  });
};

export const getUser = async (uid: string): Promise<User | null> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      uid: userSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as User;
  }
  return null;
};

export const createOrUpdateUser = async (user: User): Promise<void> => {
  if (!user.uid) {
    throw new Error('User ID is required');
  }
  if (!user.email) {
    throw new Error('User email is required');
  }

  const userRef = doc(db, 'users', user.uid);
  const userData: any = {
    uid: user.uid,
    name: user.name || 'User',
    email: user.email,
    createdAt: user.createdAt ? Timestamp.fromDate(user.createdAt) : Timestamp.now(),
  };

  // Only include photoURL if it exists
  if (user.photoURL) {
    userData.photoURL = user.photoURL;
  }

  try {
    await setDoc(userRef, userData, { merge: true });
  } catch (error: any) {
    console.error('Firestore error:', error);
    if (error?.code === 'permission-denied') {
      throw new Error('Permission denied. Make sure Firestore security rules allow users to create/update their own document.');
    }
    throw error;
  }
};

// Group operations
export const createGroup = async (
  groupData: Omit<Group, 'id' | 'createdAt'>,
  creatorUser?: { uid: string; name: string; email: string }
): Promise<string> => {
  const groupsRef = collection(db, 'groups');
  
  // If creator user is provided, create membersDetail with admin
  let groupDoc: any = {
    ...groupData,
    createdAt: Timestamp.now(),
  };
  
  if (creatorUser && groupData.members && groupData.members.length > 0) {
    const membersDetail: { [userId: string]: GroupMember } = {};
    membersDetail[creatorUser.uid] = {
      uid: creatorUser.uid,
      name: creatorUser.name,
      email: creatorUser.email,
      role: 'admin',
      joinedAt: new Date(),
    };
    groupDoc.membersDetail = membersDetail;
  }
  
  const docRef = await addDoc(groupsRef, groupDoc);
  return docRef.id;
};

export const getGroupsByUser = async (userId: string): Promise<Group[]> => {
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('members', 'array-contains', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  })) as Group[];
};

export const getGroup = async (groupId: string): Promise<Group | null> => {
  const groupRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (groupSnap.exists()) {
    const data = groupSnap.data();
    return {
      id: groupSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as Group;
  }
  return null;
};

export const updateGroup = async (groupId: string, updates: Partial<Group>): Promise<void> => {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, updates as any);
};

export const subscribeToGroups = (userId: string, callback: (groups: Group[]) => void) => {
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('members', 'array-contains', userId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const groups = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Group[];
    callback(groups);
  });
};

// Expense operations
export const createExpense = async (
  expenseData: Omit<Expense, 'id' | 'createdAt'>,
  userName?: string
): Promise<string> => {
  const expensesRef = collection(db, 'expenses');
  const docRef = await addDoc(expensesRef, {
    ...expenseData,
    createdAt: Timestamp.now(),
  });
  
  // Create activity - fetch userName if not provided
  let finalUserName = userName || '';
  if (!finalUserName) {
    const user = await getUser(expenseData.createdBy);
    finalUserName = user?.name || 'Someone';
  }
  
  await createActivity({
    groupId: expenseData.groupId,
    type: 'expense_added',
    message: `added expense "${expenseData.title}" for $${expenseData.amount.toFixed(2)}`,
    userId: expenseData.createdBy,
    userName: finalUserName,
  });
  
  return docRef.id;
};

export const getExpensesByGroup = async (groupId: string): Promise<Expense[]> => {
  const expensesRef = collection(db, 'expenses');
  const q = query(expensesRef, where('groupId', '==', groupId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  })) as Expense[];
};

export const subscribeToExpenses = (groupId: string, callback: (expenses: Expense[]) => void) => {
  const expensesRef = collection(db, 'expenses');
  const q = query(
    expensesRef, 
    where('groupId', '==', groupId), 
    orderBy('createdAt', 'desc')
    // Limit for performance - can be increased if needed
    // Note: Remove limit() if you want all expenses, but add Firestore index for performance
  );
  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Expense[];
    callback(expenses);
  });
};

export const deleteExpense = async (expenseId: string): Promise<void> => {
  const expenseRef = doc(db, 'expenses', expenseId);
  await deleteDoc(expenseRef);
};

// Activity operations
export const createActivity = async (activityData: Omit<Activity, 'id' | 'createdAt'>): Promise<void> => {
  const activitiesRef = collection(db, 'activities');
  await addDoc(activitiesRef, {
    ...activityData,
    createdAt: Timestamp.now(),
  });
};

export const getActivitiesByGroup = async (groupId: string): Promise<Activity[]> => {
  const activitiesRef = collection(db, 'activities');
  const q = query(activitiesRef, where('groupId', '==', groupId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  })) as Activity[];
};

export const subscribeToActivities = (groupId: string, callback: (activities: Activity[]) => void) => {
  const activitiesRef = collection(db, 'activities');
  const q = query(
    activitiesRef, 
    where('groupId', '==', groupId), 
    orderBy('createdAt', 'desc')
    // Limit for performance - showing last 50 activities
    // Note: Remove limit() if you want all activities, but add Firestore index
  );
  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Activity[];
    callback(activities);
  });
};

