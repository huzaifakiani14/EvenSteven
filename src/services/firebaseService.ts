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
  limit,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { generateJoinCode } from '../utils/joinCodeGenerator';
import type { User, Group, Expense, Activity, GroupMember, Payment } from '../types';

// Timeout wrapper for Firestore operations to prevent infinite hangs
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
};

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
  // Verify authentication state
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to create a group');
  }
  
  if (!groupData.createdBy) {
    throw new Error('Group creator ID is required');
  }
  
  // Verify createdBy matches current user
  if (groupData.createdBy !== currentUser.uid) {
    throw new Error('Group creator ID must match the signed-in user');
  }
  
  console.log('[createGroup] Starting group creation:', {
    createdBy: groupData.createdBy,
    currentUser: currentUser.uid,
    name: groupData.name,
    members: groupData.members,
  });
  
  const groupsRef = collection(db, 'groups');
  
  // Generate unique join code
  // Note: In production with many groups, consider checking for uniqueness
  // For now, collision probability is extremely low (36^6 = ~2 billion combinations)
  const joinCode = generateJoinCode();
  
  // If creator user is provided, create membersDetail with admin
  let groupDoc: any = {
    ...groupData,
    joinCode,
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
  
  console.log('[createGroup] Document to create:', {
    name: groupDoc.name,
    createdBy: groupDoc.createdBy,
    members: groupDoc.members,
    joinCode: groupDoc.joinCode,
  });
  
  try {
    const docRef = await withTimeout(
      addDoc(groupsRef, groupDoc),
      15000 // 15 second timeout
    );
    
    console.log('[createGroup] Group created successfully:', docRef.id);
    
    // Verify the document was created
    if (!docRef.id) {
      throw new Error('Failed to create group: no document ID returned');
    }
    
    return docRef.id;
  } catch (error: any) {
    console.error('[createGroup] Error creating group in Firestore:', {
      error,
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });
    
    // Provide specific error messages for common issues
    if (error?.code === 'permission-denied') {
      throw new Error('Permission denied. Please check Firestore security rules allow group creation. Make sure you are authenticated and the rules allow creating groups.');
    }
    
    if (error?.code === 'unavailable') {
      throw new Error('Firestore is temporarily unavailable. Please check your internet connection and try again.');
    }
    
    if (error?.code === 'deadline-exceeded' || error?.message?.includes('timed out')) {
      throw new Error('Request timed out. Please check your internet connection and try again.');
    }
    
    // Re-throw with a more descriptive message
    throw new Error(`Failed to create group: ${error?.message || 'Unknown error'}`);
  }
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

export const getGroupByJoinCode = async (joinCode: string): Promise<Group | null> => {
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('joinCode', '==', joinCode.toUpperCase()));
  
  try {
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    } as Group;
  } catch (error: any) {
    console.error('Error getting group by join code:', error);
    if (error?.code === 'permission-denied') {
      throw new Error('Permission denied. Please check Firestore security rules allow querying by joinCode.');
    }
    throw error;
  }
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
  // Verify authentication state
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to create an expense');
  }
  
  if (!expenseData.groupId || !expenseData.createdBy) {
    throw new Error('Group ID and creator ID are required');
  }
  
  // Verify createdBy matches current user
  if (expenseData.createdBy !== currentUser.uid) {
    throw new Error('Expense creator ID must match the signed-in user');
  }
  
  console.log('[createExpense] Starting expense creation:', {
    groupId: expenseData.groupId,
    createdBy: expenseData.createdBy,
    currentUser: currentUser.uid,
    title: expenseData.title,
    amount: expenseData.amount,
  });
  
  const expensesRef = collection(db, 'expenses');
  
  const expenseDoc = {
    ...expenseData,
    createdAt: Timestamp.now(),
  };
  
  console.log('[createExpense] Document to create:', {
    groupId: expenseDoc.groupId,
    createdBy: expenseDoc.createdBy,
    title: expenseDoc.title,
    amount: expenseDoc.amount,
  });
  
  try {
    const docRef = await withTimeout(
      addDoc(expensesRef, expenseDoc),
      15000 // 15 second timeout
    );
    
    console.log('[createExpense] Expense created successfully:', docRef.id);
    
    // Verify the document was created
    if (!docRef.id) {
      throw new Error('Failed to create expense: no document ID returned');
    }
    
    // Create activity - fetch userName if not provided
    // Don't let activity creation failure block expense creation
    try {
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
    } catch (activityError) {
      // Log but don't fail the expense creation
      console.error('[createExpense] Error creating activity for expense:', activityError);
    }
    
    return docRef.id;
  } catch (error: any) {
    console.error('[createExpense] Error creating expense in Firestore:', {
      error,
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });
    
    // Provide specific error messages for common issues
    if (error?.code === 'permission-denied') {
      throw new Error('Permission denied. Please check Firestore security rules allow expense creation. Make sure you are authenticated and the rules allow creating expenses.');
    }
    
    if (error?.code === 'unavailable') {
      throw new Error('Firestore is temporarily unavailable. Please check your internet connection and try again.');
    }
    
    if (error?.code === 'deadline-exceeded' || error?.message?.includes('timed out')) {
      throw new Error('Request timed out. Please check your internet connection and try again.');
    }
    
    // Re-throw with a more descriptive message
    throw new Error(`Failed to create expense: ${error?.message || 'Unknown error'}`);
  }
};

export const getExpensesByGroup = async (groupId: string): Promise<Expense[]> => {
  const expensesRef = collection(db, 'expenses');
  const q = query(
    expensesRef,
    where('groupId', '==', groupId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
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
    orderBy('createdAt', 'desc'),
    limit(50)
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

export const updateExpense = async (
  expenseId: string,
  updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'createdBy' | 'groupId'>>,
  userName?: string
): Promise<void> => {
  const expenseRef = doc(db, 'expenses', expenseId);
  
  // Get the current expense to create an activity message
  const expenseSnap = await getDoc(expenseRef);
  if (!expenseSnap.exists()) {
    throw new Error('Expense not found');
  }
  
  const currentExpense = expenseSnap.data() as Expense;
  
  // Update the expense
  await updateDoc(expenseRef, updates);
  
  // Create activity - fetch userName if not provided
  let finalUserName = userName || '';
  if (!finalUserName) {
    const user = await getUser(currentExpense.createdBy);
    finalUserName = user?.name || 'Someone';
  }
  
  // Create activity for expense update
  const changes = [];
  if (updates.title && updates.title !== currentExpense.title) {
    changes.push(`title to "${updates.title}"`);
  }
  if (updates.amount && updates.amount !== currentExpense.amount) {
    changes.push(`amount to $${updates.amount.toFixed(2)}`);
  }
  if (updates.sharedWith && JSON.stringify(updates.sharedWith.sort()) !== JSON.stringify(currentExpense.sharedWith.sort())) {
    changes.push('shared members');
  }
  if (updates.paidBy && updates.paidBy !== currentExpense.paidBy) {
    changes.push('paid by');
  }
  
  if (changes.length > 0) {
    await createActivity({
      groupId: currentExpense.groupId,
      type: 'expense_added', // Reusing type, could add 'expense_updated' later
      message: `updated expense "${updates.title || currentExpense.title}": ${changes.join(', ')}`,
      userId: currentExpense.createdBy,
      userName: finalUserName,
    });
  }
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
  const q = query(
    activitiesRef,
    where('groupId', '==', groupId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
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
    orderBy('createdAt', 'desc'),
    limit(50)
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

export const createPayment = async (
  paymentData: Omit<Payment, 'id' | 'createdAt'>,
  userName?: string
): Promise<string> => {
  if (!paymentData.groupId || !paymentData.from || !paymentData.to || !paymentData.amount || !paymentData.createdBy) {
    throw new Error('Missing required payment fields');
  }

  if (paymentData.from === paymentData.to) {
    throw new Error('Cannot record payment from person to themselves');
  }

  if (paymentData.amount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  try {
    const group = await getGroup(paymentData.groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    if (!group.members.includes(paymentData.createdBy)) {
      throw new Error('You must be a member of the group to record payments');
    }
  } catch (groupError: any) {
    if (groupError?.message && (groupError.message.includes('not found') || groupError.message.includes('member'))) {
      throw groupError;
    }
  }

  const paymentsRef = collection(db, 'payments');
  
  try {
    const paymentDoc: any = {
      groupId: paymentData.groupId,
      from: paymentData.from,
      to: paymentData.to,
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      createdBy: paymentData.createdBy,
      createdAt: Timestamp.now(),
    };
    
    if (paymentData.note && paymentData.note.trim()) {
      paymentDoc.note = paymentData.note.trim();
    }

    const docRef = await addDoc(paymentsRef, paymentDoc);
    
    try {
      let finalUserName = userName || '';
      const [creatorUser, fromUser, toUser] = await Promise.all([
        finalUserName ? Promise.resolve(null) : getUser(paymentData.createdBy),
        getUser(paymentData.from),
        getUser(paymentData.to),
      ]);

      if (!finalUserName) {
        finalUserName = creatorUser?.name || 'Someone';
      }

      await createActivity({
        groupId: paymentData.groupId,
        type: 'expense_added',
        message: `recorded payment: ${fromUser?.name || 'Someone'} paid ${toUser?.name || 'someone'} $${paymentData.amount.toFixed(2)} via ${paymentData.paymentMethod}`,
        userId: paymentData.createdBy,
        userName: finalUserName,
      });
    } catch (activityError) {
      console.error('Error creating payment activity:', activityError);
    }
    
    return docRef.id;
  } catch (error: any) {
    console.error('Error creating payment:', error);
    if (error?.code === 'permission-denied') {
      throw new Error('Permission denied. Please check Firestore security rules allow payment creation.');
    }
    throw error;
  }
};

export const getPaymentsByGroup = async (groupId: string): Promise<Payment[]> => {
  const paymentsRef = collection(db, 'payments');
  const q = query(
    paymentsRef,
    where('groupId', '==', groupId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  })) as Payment[];
};

export const subscribeToPayments = (groupId: string, callback: (payments: Payment[]) => void) => {
  const paymentsRef = collection(db, 'payments');
  const q = query(
    paymentsRef, 
    where('groupId', '==', groupId), 
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(
    q, 
    (snapshot) => {
      const payments = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Payment[];
      callback(payments);
    },
    (error) => {
      console.error('Error subscribing to payments:', error);
      if (error?.code === 'failed-precondition') {
        console.error('Firestore index missing for payments. Please create a composite index: payments (groupId, createdAt)');
      }
      callback([]);
    }
  );
};

export const deletePayment = async (paymentId: string): Promise<void> => {
  const paymentRef = doc(db, 'payments', paymentId);
  await deleteDoc(paymentRef);
};

