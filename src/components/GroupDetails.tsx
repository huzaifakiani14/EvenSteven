import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getGroup, subscribeToExpenses, createExpense, updateExpense, subscribeToActivities } from '../services/firebaseService';
import { calculateBalances, minimizeTransactions } from '../utils/balanceCalculator';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import type { Group, Expense, Activity, GroupMember } from '../types';
import { getUser } from '../services/firebaseService';
import type { User } from '../types';

export const GroupDetails = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedPaidBy, setSelectedPaidBy] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'activity' | 'members'>('expenses');
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const { showToast, ToastComponent } = useToast();
  
  // Check if user just joined (from URL param)
  useEffect(() => {
    if (searchParams.get('joined') === 'true') {
      setShowWelcomeBanner(true);
      // Remove the query param from URL
      setSearchParams({}, { replace: true });
      // Auto-hide banner after 5 seconds
      const timer = setTimeout(() => {
        setShowWelcomeBanner(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!groupId || !user) return;

    // Load group
    getGroup(groupId).then(setGroup);

    // Subscribe to expenses
    const unsubscribeExpenses = subscribeToExpenses(groupId, (updatedExpenses) => {
      setExpenses(updatedExpenses);
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

  const handleCreateExpense = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupId || !expenseTitle.trim() || !expenseAmount || selectedMembers.length === 0) return;

    try {
      const amount = parseFloat(expenseAmount);
      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
      }

      // Always include the person who paid in the sharedWith array
      const paidBy = selectedPaidBy || user.uid;
      const sharedWith = selectedMembers.includes(paidBy)
        ? selectedMembers
        : [...selectedMembers, paidBy];

      await createExpense(
        {
          groupId,
          title: expenseTitle.trim(),
          amount,
          paidBy,
          sharedWith,
          createdBy: user.uid,
        },
        user.name
      );

      // Success: close modal, reset form, show toast
      showToast('💸 Expense added successfully!', 'success');
      resetExpenseForm();
      setShowExpenseModal(false);
    } catch (error) {
      console.error('Error creating expense:', error);
      showToast('❌ Failed to add expense. Please try again.', 'error');
    }
  }, [user, groupId, expenseTitle, expenseAmount, selectedMembers, selectedPaidBy, showToast]);

  const handleUpdateExpense = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingExpense || !expenseTitle.trim() || !expenseAmount || selectedMembers.length === 0) return;

    try {
      const amount = parseFloat(expenseAmount);
      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
      }

      // Always include the person who paid in the sharedWith array
      const paidBy = selectedPaidBy || user.uid;
      const sharedWith = selectedMembers.includes(paidBy)
        ? selectedMembers
        : [...selectedMembers, paidBy];

      await updateExpense(
        editingExpense.id,
        {
          title: expenseTitle.trim(),
          amount,
          paidBy,
          sharedWith,
        },
        user.name
      );

      // Success: close modal, reset form, show toast
      showToast('✅ Expense updated successfully!', 'success');
      resetExpenseForm();
      setShowExpenseModal(false);
      setEditingExpense(null);
    } catch (error) {
      console.error('Error updating expense:', error);
      showToast('❌ Failed to update expense. Please try again.', 'error');
    }
  }, [user, editingExpense, expenseTitle, expenseAmount, selectedMembers, selectedPaidBy, showToast]);

  const resetExpenseForm = useCallback(() => {
    setExpenseTitle('');
    setExpenseAmount('');
    setSelectedMembers([]);
    setSelectedPaidBy('');
    setEditingExpense(null);
  }, []);

  const handleEditExpense = useCallback((expense: Expense) => {
    setEditingExpense(expense);
    setExpenseTitle(expense.title);
    setExpenseAmount(expense.amount.toString());
    setSelectedMembers(expense.sharedWith);
    setSelectedPaidBy(expense.paidBy);
    setShowExpenseModal(true);
  }, []);

  const handleCloseExpenseModal = useCallback(() => {
    setShowExpenseModal(false);
    resetExpenseForm();
  }, [resetExpenseForm]);

  const toggleMember = useCallback((memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }, []);

  // Memoize expensive calculations
  const balances = useMemo(() => {
    if (expenses.length === 0) return [];
    return calculateBalances(expenses);
  }, [expenses]);

  const settlements = useMemo(() => {
    if (balances.length === 0) return [];
    return minimizeTransactions(balances);
  }, [balances]);

  const handleShareInvite = useCallback(async () => {
    if (!groupId || !group) return;

    const inviteLink = `${window.location.origin}/join?groupId=${groupId}`;
    
    const shareText = group.joinCode
      ? `Join ${group.name} on EvenSteven 💸\n\nLink: ${inviteLink}\nOr use code: ${group.joinCode}`
      : `Join ${group.name} on EvenSteven 💸\n\n${inviteLink}`;

    // Check if Web Share API is available (mobile devices)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${group.name} on EvenSteven 💸`,
          text: shareText,
          url: inviteLink,
        });
        showToast('✅ Invite link shared successfully!', 'success');
      } catch (err: any) {
        // User cancelled or share failed
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
          // Fallback to clipboard
          await handleCopyToClipboard(shareText);
        }
      }
    } else {
      // Fallback to clipboard for desktop
      await handleCopyToClipboard(shareText);
    }
  }, [groupId, group, showToast]);

  const handleCopyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 Link copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      showToast('Failed to copy link. Please try again.', 'error');
    }
  }, [showToast]);

  if (!group || !user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      {ToastComponent}
      
      {/* Welcome Banner */}
      {showWelcomeBanner && group && (
        <div className="mb-6 bg-gradient-to-r from-green-900 to-emerald-900 border border-green-700 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <h3 className="text-white font-semibold">Welcome to {group.name}!</h3>
              <p className="text-green-200 text-sm">
                You can now add or view expenses with your group 👋
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowWelcomeBanner(false)}
            className="text-green-300 hover:text-white transition-colors"
            aria-label="Close banner"
          >
            ✕
          </button>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <Link to="/groups" className="text-blue-400 hover:text-blue-300 mb-2 inline-block">
            ← Back to Groups
          </Link>
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold">{group.name}</h2>
            {/* Join Code Badge */}
            {group.joinCode && (
              <div className="flex items-center gap-2 bg-purple-900 bg-opacity-50 border border-purple-600 rounded-lg px-4 py-2">
                <span className="text-purple-300 text-sm font-semibold">Join Code:</span>
                <code className="bg-black bg-opacity-30 px-3 py-1 rounded text-lg font-mono tracking-widest text-white">
                  {group.joinCode}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(group.joinCode!).then(() => {
                      showToast('📋 Join code copied!', 'success');
                    });
                  }}
                  className="text-purple-300 hover:text-white transition-colors"
                  title="Copy join code"
                >
                  📋
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleShareInvite}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold px-4 sm:px-5 py-2 rounded-lg shadow-md transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <span>🤝</span>
            <span className="hidden sm:inline">Invite via Link</span>
            <span className="sm:hidden">Invite</span>
          </button>
          <button
            onClick={() => {
              resetExpenseForm();
              if (user) {
                setSelectedPaidBy(user.uid);
              }
              setShowExpenseModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
          >
            + Add Expense
          </button>
        </div>
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
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-green-400">
                          ${expense.amount.toFixed(2)}
                        </span>
                        {expense.createdBy === user?.uid && (
                          <button
                            onClick={() => handleEditExpense(expense)}
                            className="text-blue-400 hover:text-blue-300 px-3 py-1 rounded transition-colors"
                            title="Edit expense"
                          >
                            ✏️ Edit
                          </button>
                        )}
                      </div>
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
          </div>

          {/* Join Code Display */}
          {group.joinCode && (
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-6 border border-purple-700">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-white mb-1">Join Code</h4>
                  <p className="text-purple-200 text-sm mb-3">
                    Share this code with friends to let them join easily. They can enter it on the "Join by Code" page.
                  </p>
                  <div className="flex items-center space-x-3 flex-wrap gap-3">
                    <code className="bg-black bg-opacity-30 px-4 py-3 rounded-lg text-2xl font-mono tracking-widest text-white">
                      {group.joinCode}
                    </code>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(group.joinCode!).then(() => {
                            showToast('📋 Join code copied!', 'success');
                          });
                        }}
                        className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        Copy Code
                      </button>
                      <button
                        onClick={() => {
                          const codeLink = `${window.location.origin}/join?code=${group.joinCode}`;
                          navigator.clipboard.writeText(codeLink).then(() => {
                            showToast('📋 Join code link copied!', 'success');
                          });
                        }}
                        className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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

        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingExpense ? 'Edit Expense' : 'Add New Expense'}
            </h3>
            <form onSubmit={editingExpense ? handleUpdateExpense : handleCreateExpense}>
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
                <label className="block text-gray-300 mb-2">Paid by:</label>
                <select
                  value={selectedPaidBy}
                  onChange={(e) => setSelectedPaidBy(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mb-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {group.members.map((memberId) => {
                    const memberUser = users.get(memberId);
                    return (
                      <option key={memberId} value={memberId}>
                        {memberUser?.name || 'Unknown'}
                        {memberId === user?.uid && ' (You)'}
                      </option>
                    );
                  })}
                </select>
              </div>
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
                          {memberId === user?.uid && ' (You)'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseExpenseModal}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedMembers.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {editingExpense ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

