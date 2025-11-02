export interface User {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  createdAt: Date;
}

export interface GroupMember {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  joinedAt: Date;
}

export interface Group {
  id: string;
  name: string;
  createdBy: string;
  members: string[]; // User UIDs (keeping for backward compatibility)
  membersDetail?: { [userId: string]: GroupMember }; // Enhanced member details
  createdAt: Date;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  paidBy: string; // User UID
  sharedWith: string[]; // User UIDs
  createdAt: Date;
  createdBy: string;
}

export interface Balance {
  from: string; // User UID
  to: string; // User UID
  amount: number;
}

export interface Activity {
  id: string;
  groupId: string;
  type: 'expense_added' | 'member_added' | 'group_created';
  message: string;
  userId: string;
  userName: string;
  createdAt: Date;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface Invite {
  id: string;
  groupId: string;
  groupName: string;
  invitedBy: string; // User UID
  invitedByName: string;
  invitedEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

