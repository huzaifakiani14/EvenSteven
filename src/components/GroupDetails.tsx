import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getGroup, subscribeToExpenses, createExpense, subscribeToActivities } from '../services/firebaseService';
import { calculateBalances, minimizeTransactions } from '../utils/balanceCalculator';
import { useAuth } from '../contexts/AuthContext';
import { InviteMembers } from './InviteMembers';
import type { Group, Expense, Activity, Balance, Settlement, GroupMember } from '../types';
import { getUser } from '../services/firebaseService';
import type { User } from '../types';

export const GroupDetails = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'activity' | 'members'>('expenses');
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    if (!groupId || !user) return;

    // Load group
    getGroup(groupId).then(setGroup);

    // Subscribe to expenses
    const unsubscribeExpenses = subscribeToExpenses(groupId, (updatedExpenses) => {
      setExpenses(updatedExpenses);
      const calculated = calculateBalances(updatedExpenses);
      setBalances(calculated);
      setSettlements(minimizeTransactions(calculated));
    });

    // Subscribe to activities
    const unsubscribeActivities = subscribeToActivities(groupId, (updatedActivities) => {
      setActivities(updatedActivities);
    });

    return () => {
      unsubscribeExpenses();
      unsubscribeActivities();
    };
  }, [groupId, user]);

  // Load user details
  useEffect(() => {
    if (!group) return;

    const loadUsers = async () => {
      const userMap = new Map<string, User>();
      for (const memberId of group.members) {
        const memberUser = await getUser(memberId);
        if (memberUser) {
          userMap.set(memberId, memberUser);
        }
      }
      setUsers(userMap);
    };

    loadUsers();
  }, [group]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupId || !expenseTitle.trim() || !expenseAmount || selectedMembers.length === 0) return;

    try {
      const amount = parseFloat(expenseAmount);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      // Always include the person who paid in the sharedWith array
      const sharedWith = selectedMembers.includes(user.uid)
        ? selectedMembers
        : [...selectedMembers, user.uid];

      await createExpense(
        {
          groupId,
          title: expenseTitle.trim(),
          amount,
          paidBy: user.uid,
          sharedWith,
          createdBy: user.uid,
        },
        user.name
      );

      setExpenseTitle('');
      setExpenseAmount('');
      setSelectedMembers([]);
      setShowExpenseModal(false);
    } catch (error) {
      console.error('Error creating expense:', error);
      alert('Failed to create expense. Please try again.');
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  if (!group || !user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/groups" className="text-blue-400 hover:text-blue-300 mb-2 inline-block">
            ← Back to Groups
          </Link>
          <h2 className="text-3xl font-bold">{group.name}</h2>
        </div>
        <button
          onClick={() => setShowExpenseModal(true)}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
        >
          + Add Expense
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-2 px-4 ${
            activeTab === 'expenses'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Expenses
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={`pb-2 px-4 ${
            activeTab === 'balances'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Balances
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-2 px-4 ${
            activeTab === 'activity'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Activity
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-2 px-4 ${
            activeTab === 'members'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Members ({group.members.length})
        </button>
      </div>

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div>
          {expenses.length === 0 ? (
            <div className="text-center py-12 bg-gray-800 rounded-lg">
              <p className="text-gray-400">No expenses yet. Add one to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense) => {
                const paidByUser = users.get(expense.paidBy);
                const sharedWithUsers = expense.sharedWith
                  .map((id) => users.get(id))
                  .filter(Boolean) as User[];
                const amountPerPerson = expense.amount / expense.sharedWith.length;

                return (
                  <div key={expense.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-semibold">{expense.title}</h3>
                      <span className="text-2xl font-bold text-green-400">
                        ${expense.amount.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-gray-400 mb-3">
                      Paid by <span className="text-white font-semibold">{paidByUser?.name || 'Unknown'}</span>
                    </p>
                    <div className="text-sm text-gray-300">
                      <p>Shared with:</p>
                      <ul className="list-disc list-inside mt-1">
                        {sharedWithUsers.map((u) => (
                          <li key={u.uid}>
                            {u.name} - ${amountPerPerson.toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Balances Tab */}
      {activeTab === 'balances' && (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-semibold mb-4">Current Balances</h3>
            {balances.length === 0 ? (
              <p className="text-gray-400">No balances to show. All settled up!</p>
            ) : (
              <div className="space-y-2">
                {balances.map((balance, idx) => {
                  const fromUser = users.get(balance.from);
                  const toUser = users.get(balance.to);
                  return (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                      <span className="text-gray-300">
                        <span className="font-semibold text-white">{fromUser?.name || 'Unknown'}</span> owes{' '}
                        <span className="font-semibold text-white">{toUser?.name || 'Unknown'}</span>
                      </span>
                      <span className="text-lg font-bold text-red-400">
                        ${balance.amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-blue-900 bg-opacity-30 rounded-lg p-6 border border-blue-700">
            <h3 className="text-xl font-semibold mb-4">💡 Optimized Settlements</h3>
            <p className="text-gray-300 mb-4 text-sm">
              These transactions minimize the total number of payments needed:
            </p>
            {settlements.length === 0 ? (
              <p className="text-gray-400">Everyone is all settled up! 🎉</p>
            ) : (
              <div className="space-y-3">
                {settlements.map((settlement, idx) => {
                  const fromUser = users.get(settlement.from);
                  const toUser = users.get(settlement.to);
                  return (
                    <div key={idx} className="bg-gray-800 rounded-lg p-4 border border-blue-600">
                      <p className="text-white">
                        <span className="font-bold">{fromUser?.name || 'Unknown'}</span> should pay{' '}
                        <span className="font-bold">{toUser?.name || 'Unknown'}</span>
                      </p>
                      <p className="text-2xl font-bold text-green-400 mt-2">
                        ${settlement.amount.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div>
          {activities.length === 0 ? (
            <div className="text-center py-12 bg-gray-800 rounded-lg">
              <p className="text-gray-400">No activity yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => {
                const activityUser = users.get(activity.userId);
                return (
                  <div key={activity.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <p className="text-gray-300">
                      <span className="font-semibold text-white">{activityUser?.name || activity.userName || 'Unknown'}</span>{' '}
                      {activity.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Group Members</h3>
            {group.createdBy === user.uid && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
              >
                + Invite Members
              </button>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            {group.membersDetail ? (
              <div className="space-y-3">
                {Object.values(group.membersDetail).map((member: GroupMember) => (
                  <div
                    key={member.uid}
                    className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {users.get(member.uid)?.photoURL && (
                        <img
                          src={users.get(member.uid)?.photoURL}
                          alt={member.name}
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-semibold text-white">
                          {member.name}
                          {member.uid === user.uid && ' (You)'}
                        </p>
                        <p className="text-sm text-gray-400">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        member.role === 'admin'
                          ? 'bg-blue-900 text-blue-300'
                          : 'bg-gray-600 text-gray-300'
                      }`}>
                        {member.role === 'admin' ? 'Admin' : 'Member'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {group.members.map((memberId) => {
                  const memberUser = users.get(memberId);
                  return (
                    <div
                      key={memberId}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {memberUser?.photoURL && (
                          <img
                            src={memberUser.photoURL}
                            alt={memberUser.name}
                            className="w-10 h-10 rounded-full"
                          />
                        )}
                        <div>
                          <p className="font-semibold text-white">
                            {memberUser?.name || 'Unknown'}
                            {memberId === user.uid && ' (You)'}
                            {memberId === group.createdBy && ' 👑'}
                          </p>
                          <p className="text-sm text-gray-400">{memberUser?.email || ''}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {group.createdBy === user.uid && !showInviteModal && (
            <InviteMembers
              group={group}
              onInviteSent={() => {
                setShowInviteModal(false);
                // Refresh group data
                if (groupId) {
                  getGroup(groupId).then(setGroup);
                }
              }}
            />
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Invite Members</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <InviteMembers
              group={group}
              onInviteSent={() => {
                setShowInviteModal(false);
                if (groupId) {
                  getGroup(groupId).then(setGroup);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Add New Expense</h3>
            <form onSubmit={handleCreateExpense}>
              <input
                type="text"
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder="Expense title"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mb-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="Amount"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mb-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <div className="mb-4">
                <label className="block text-gray-300 mb-2">Split with:</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {group.members.map((memberId) => {
                    const memberUser = users.get(memberId);
                    return (
                      <label
                        key={memberId}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(memberId)}
                          onChange={() => toggleMember(memberId)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-gray-300">
                          {memberUser?.name || 'Unknown'}
                          {memberId === user.uid && ' (You)'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedMembers.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

