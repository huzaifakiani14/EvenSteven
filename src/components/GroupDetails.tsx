import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getGroup, subscribeToExpenses, createExpense, updateExpense, subscribeToActivities, subscribeToPayments, createPayment } from '../services/firebaseService';
import { calculateBalances, minimizeTransactions } from '../utils/balanceCalculator';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import type { Group, Expense, Activity, GroupMember, Payment } from '../types';
import { getUser } from '../services/firebaseService';
import type { User } from '../types';

export const GroupDetails = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedPaidBy, setSelectedPaidBy] = useState<string>('');
  const [paymentFrom, setPaymentFrom] = useState<string>('');
  const [paymentTo, setPaymentTo] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'zelle' | 'venmo' | 'paypal' | 'other'>('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'activity' | 'members'>('expenses');
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
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

    // Load group and ensure it has a join code
    const loadGroup = async () => {
      const groupData = await getGroup(groupId);
      if (groupData) {
        // If group doesn't have a join code, generate one
        if (!groupData.joinCode) {
          const { updateGroup } = await import('../services/firebaseService');
          const { generateJoinCode } = await import('../utils/joinCodeGenerator');
          const newJoinCode = generateJoinCode();
          try {
            await updateGroup(groupId, { joinCode: newJoinCode } as any);
            setGroup({ ...groupData, joinCode: newJoinCode });
          } catch (error) {
            console.error('Error generating join code:', error);
            setGroup(groupData); // Still set group even if code generation fails
          }
        } else {
          setGroup(groupData);
        }
      }
    };
    loadGroup();

    // Subscribe to expenses
    const unsubscribeExpenses = subscribeToExpenses(groupId, (updatedExpenses) => {
      setExpenses(updatedExpenses);
    });

    const unsubscribePayments = subscribeToPayments(groupId, (updatedPayments) => {
      setPayments(updatedPayments);
    });

    // Subscribe to activities
    const unsubscribeActivities = subscribeToActivities(groupId, (updatedActivities) => {
      setActivities(updatedActivities);
    });

    return () => {
      unsubscribeExpenses();
      unsubscribePayments();
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

  const resetExpenseForm = useCallback(() => {
    setExpenseTitle('');
    setExpenseAmount('');
    setSelectedMembers([]);
    setSelectedPaidBy('');
    setEditingExpense(null);
  }, []);

  const handleCreateExpense = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupId || !expenseTitle.trim() || !expenseAmount || selectedMembers.length === 0) {
      console.log('[handleCreateExpense] Early return:', {
        hasUser: !!user,
        groupId,
        expenseTitle: expenseTitle.trim(),
        expenseAmount,
        selectedMembers: selectedMembers.length,
      });
      return;
    }

    console.log('[handleCreateExpense] Starting expense creation:', {
      userId: user.uid,
      groupId,
      title: expenseTitle.trim(),
      amount: expenseAmount,
    });

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

      console.log('[handleCreateExpense] Calling createExpense...');
      
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

      console.log('[handleCreateExpense] Expense created successfully');

      // Success: close modal immediately, reset form, show toast
      resetExpenseForm();
      setShowExpenseModal(false);
      showToast('💸 Expense added successfully!', 'success');
    } catch (error: any) {
      console.error('[handleCreateExpense] Error creating expense:', {
        error,
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      });
      
      // Show specific error message if available
      const errorMessage = error?.message || 'Failed to add expense. Please try again.';
      console.log('[handleCreateExpense] Showing error toast:', errorMessage);
      showToast(`❌ ${errorMessage}`, 'error');
    }
  }, [user, groupId, expenseTitle, expenseAmount, selectedMembers, selectedPaidBy, showToast, resetExpenseForm]);

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
  }, [user, editingExpense, expenseTitle, expenseAmount, selectedMembers, selectedPaidBy, showToast, resetExpenseForm]);

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

  const resetPaymentForm = useCallback(() => {
    setPaymentFrom('');
    setPaymentTo('');
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentNote('');
  }, []);

  const handleRecordPayment = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (recordingPayment || !user || !groupId || !paymentFrom || !paymentTo || !paymentAmount) return;

    try {
      setRecordingPayment(true);
      
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
      }

      if (paymentFrom === paymentTo) {
        showToast('Cannot record payment from person to themselves', 'error');
        return;
      }

      await createPayment(
        {
          groupId,
          from: paymentFrom,
          to: paymentTo,
          amount,
          paymentMethod,
          note: paymentNote.trim() || undefined,
          createdBy: user.uid,
        },
        user.name
      );

      showToast('✅ Payment recorded successfully!', 'success');
      resetPaymentForm();
      setShowPaymentModal(false);
    } catch (error: any) {
      console.error('Error recording payment:', error);
      let errorMessage = 'Failed to record payment. Please try again.';
      
      if (error?.code === 'permission-denied') {
        errorMessage = 'Permission denied. You may not have permission to record payments in this group.';
      } else if (error?.code === 'failed-precondition') {
        errorMessage = 'Firestore index missing. Please create a composite index for payments (groupId, createdAt).';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      showToast(`❌ ${errorMessage}`, 'error');
      console.error('Full error details:', error);
    } finally {
      setRecordingPayment(false);
    }
  }, [user, groupId, paymentFrom, paymentTo, paymentAmount, paymentMethod, paymentNote, showToast, resetPaymentForm, recordingPayment]);

  const toggleMember = useCallback((memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }, []);

  const balances = useMemo(() => {
    if (expenses.length === 0 && payments.length === 0) return [];
    return calculateBalances(expenses, payments);
  }, [expenses, payments]);

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
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <Link to="/groups" className="text-blue-400 hover:text-blue-300 mb-2 inline-block text-sm sm:text-base">
            ← Back to Groups
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold truncate">{group.name}</h2>
            {/* Join Code Badge - Always show if group exists */}
            {group.joinCode && (
              <div className="flex items-center gap-2 bg-purple-900 bg-opacity-50 border border-purple-600 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 flex-shrink-0">
                <span className="text-purple-300 text-xs sm:text-sm font-semibold hidden sm:inline">Join Code:</span>
                <code className="bg-black bg-opacity-30 px-2 sm:px-3 py-1 rounded text-base sm:text-lg font-mono tracking-widest text-white">
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
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={handleShareInvite}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold px-3 sm:px-4 sm:px-5 py-2 rounded-lg shadow-md transition-transform hover:scale-105 active:scale-95 flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
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
            className="bg-blue-600 hover:bg-blue-700 px-4 sm:px-6 py-2 rounded-lg transition-colors text-sm sm:text-base"
          >
            + Add Expense
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 sm:space-x-4 mb-4 sm:mb-6 border-b border-gray-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-2 px-2 sm:px-4 whitespace-nowrap text-sm sm:text-base ${
            activeTab === 'expenses'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Expenses
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={`pb-2 px-2 sm:px-4 whitespace-nowrap text-sm sm:text-base ${
            activeTab === 'balances'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Balances
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-2 px-2 sm:px-4 whitespace-nowrap text-sm sm:text-base ${
            activeTab === 'activity'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Activity
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-2 px-2 sm:px-4 whitespace-nowrap text-sm sm:text-base ${
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
            <div className="text-center py-8 sm:py-12 bg-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm sm:text-base">No expenses yet. Add one to get started!</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {expenses.map((expense) => {
                const paidByUser = users.get(expense.paidBy);
                const sharedWithUsers = expense.sharedWith
                  .map((id) => users.get(id))
                  .filter(Boolean) as User[];
                const amountPerPerson = expense.amount / expense.sharedWith.length;

                return (
                  <div key={expense.id} className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3 mb-2">
                      <h3 className="text-lg sm:text-xl font-semibold">{expense.title}</h3>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-xl sm:text-2xl font-bold text-green-400">
                          ${expense.amount.toFixed(2)}
                        </span>
                        {expense.createdBy === user?.uid && (
                          <button
                            onClick={() => handleEditExpense(expense)}
                            className="text-blue-400 hover:text-blue-300 px-2 sm:px-3 py-1 rounded transition-colors text-sm sm:text-base"
                            title="Edit expense"
                          >
                            ✏️ <span className="hidden sm:inline">Edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-400 mb-2 sm:mb-3 text-sm sm:text-base">
                      Paid by <span className="text-white font-semibold">{paidByUser?.name || 'Unknown'}</span>
                    </p>
                    <div className="text-xs sm:text-sm text-gray-300">
                      <p className="mb-1">Shared with:</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
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
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h3 className="text-xl sm:text-2xl font-semibold">Current Balances</h3>
            <button
              onClick={() => {
                if (balances.length > 0 && group) {
                  // Pre-fill payment with first balance
                  const firstBalance = balances[0];
                  setPaymentFrom(firstBalance.from);
                  setPaymentTo(firstBalance.to);
                  setPaymentAmount(firstBalance.amount.toFixed(2));
                  setPaymentMethod('cash');
                  setPaymentNote('');
                }
                setShowPaymentModal(true);
              }}
              disabled={balances.length === 0}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg transition-colors text-sm sm:text-base font-semibold"
            >
              💵 Record Payment
            </button>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
            {balances.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No balances to show. All settled up! 🎉</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {balances.map((balance, idx) => {
                  const fromUser = users.get(balance.from);
                  const toUser = users.get(balance.to);
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 py-2 sm:py-3 border-b border-gray-700 last:border-0">
                      <div className="flex-1">
                        <span className="text-gray-300 text-sm sm:text-base">
                          <span className="font-semibold text-white">{fromUser?.name || 'Unknown'}</span> owes{' '}
                          <span className="font-semibold text-white">{toUser?.name || 'Unknown'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className="text-lg sm:text-xl font-bold text-red-400">
                          ${balance.amount.toFixed(2)}
                        </span>
                        <button
                          onClick={() => {
                            setPaymentFrom(balance.from);
                            setPaymentTo(balance.to);
                            setPaymentAmount(balance.amount.toFixed(2));
                            setPaymentMethod('cash');
                            setPaymentNote('');
                            setShowPaymentModal(true);
                          }}
                          className="text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 px-3 sm:px-4 py-1.5 rounded transition-colors"
                        >
                          Mark Paid
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recorded Payments */}
          {payments.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Recorded Payments</h3>
              <div className="space-y-2 sm:space-y-3">
                {payments.map((payment) => {
                  const fromUser = users.get(payment.from);
                  const toUser = users.get(payment.to);
                  const paymentMethodIcons: Record<string, string> = {
                    cash: '💵',
                    zelle: '🏦',
                    venmo: '💸',
                    paypal: '🔵',
                    other: '💳',
                  };
                  return (
                    <div key={payment.id} className="bg-gray-700 rounded-lg p-3 sm:p-4 border border-gray-600">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="flex-1">
                          <p className="text-white text-sm sm:text-base">
                            <span className="font-semibold">{fromUser?.name || 'Unknown'}</span> paid{' '}
                            <span className="font-semibold">{toUser?.name || 'Unknown'}</span>
                          </p>
                          <p className="text-gray-400 text-xs sm:text-sm mt-1">
                            {paymentMethodIcons[payment.paymentMethod]} {payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1)}
                            {payment.note && ` • ${payment.note}`}
                          </p>
                        </div>
                        <span className="text-lg sm:text-xl font-bold text-green-400">
                          ${payment.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-blue-900 bg-opacity-30 rounded-lg p-4 sm:p-6 border border-blue-700">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">💡 Optimized Settlements</h3>
            <p className="text-gray-300 mb-3 sm:mb-4 text-xs sm:text-sm">
              These transactions minimize the total number of payments needed:
            </p>
            {settlements.length === 0 ? (
              <p className="text-gray-400 text-center py-2">Everyone is all settled up! 🎉</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {settlements.map((settlement, idx) => {
                  const fromUser = users.get(settlement.from);
                  const toUser = users.get(settlement.to);
                  return (
                    <div key={idx} className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-blue-600">
                      <p className="text-white text-sm sm:text-base">
                        <span className="font-bold">{fromUser?.name || 'Unknown'}</span> should pay{' '}
                        <span className="font-bold">{toUser?.name || 'Unknown'}</span>
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-green-400 mt-2">
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
            <div className="text-center py-8 sm:py-12 bg-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm sm:text-base">No activity yet.</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {activities.map((activity) => {
                const activityUser = users.get(activity.userId);
                return (
                  <div key={activity.id} className="bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-700">
                    <p className="text-gray-300 text-sm sm:text-base">
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
        <div className="space-y-4 sm:space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg sm:text-xl font-semibold">Group Members</h3>
          </div>

          {/* Join Code Display - Always show */}
          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg p-4 sm:p-6 border border-purple-700">
            <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="text-base sm:text-lg font-semibold text-white mb-1">Join Code</h4>
                <p className="text-purple-200 text-xs sm:text-sm mb-3">
                  Share this code with friends to let them join easily. They can enter it on the "Join by Code" page.
                </p>
                {group.joinCode ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 gap-3">
                    <code className="bg-black bg-opacity-30 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xl sm:text-2xl font-mono tracking-widest text-white">
                      {group.joinCode}
                    </code>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(group.joinCode!).then(() => {
                            showToast('📋 Join code copied!', 'success');
                          });
                        }}
                        className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm transition-colors"
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
                        className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm transition-colors"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-purple-300 text-xs sm:text-sm">Generating join code...</div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
            {group.membersDetail ? (
              <div className="space-y-2 sm:space-y-3">
                {Object.values(group.membersDetail).map((member: GroupMember) => (
                  <div
                    key={member.uid}
                    className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                      {users.get(member.uid)?.photoURL && (
                        <img
                          src={users.get(member.uid)?.photoURL}
                          alt={member.name}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm sm:text-base truncate">
                          {member.name}
                          {member.uid === user.uid && ' (You)'}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-400 truncate">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
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
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
              {editingExpense ? 'Edit Expense' : 'Add New Expense'}
            </h3>
            <form onSubmit={editingExpense ? handleUpdateExpense : handleCreateExpense}>
              <input
                type="text"
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder="Expense title"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-2 mb-3 sm:mb-4 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="Amount"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-2 mb-3 sm:mb-4 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <div className="mb-3 sm:mb-4">
                <label className="block text-gray-300 mb-2 text-sm sm:text-base">Paid by:</label>
                <select
                  value={selectedPaidBy}
                  onChange={(e) => setSelectedPaidBy(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-2 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="mb-3 sm:mb-4">
                <label className="block text-gray-300 mb-2 text-sm sm:text-base">Split with:</label>
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
                          className="w-4 h-4 text-blue-600 rounded flex-shrink-0"
                        />
                        <span className="text-gray-300 text-sm sm:text-base">
                          {memberUser?.name || 'Unknown'}
                          {memberId === user?.uid && ' (You)'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sm:space-x-3">
                <button
                  type="button"
                  onClick={handleCloseExpenseModal}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedMembers.length === 0}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  {editingExpense ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold mb-4">Record Payment</h3>
            <form onSubmit={handleRecordPayment}>
              <div className="mb-4">
                <label className="block text-gray-300 mb-2 text-sm sm:text-base">Paid by:</label>
                <select
                  value={paymentFrom}
                  onChange={(e) => setPaymentFrom(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-2 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select who paid</option>
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
                <label className="block text-gray-300 mb-2 text-sm sm:text-base">Paid to:</label>
                <select
                  value={paymentTo}
                  onChange={(e) => setPaymentTo(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-2 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select who received</option>
                  {group.members
                    .filter((memberId) => memberId !== paymentFrom)
                    .map((memberId) => {
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
                <label className="block text-gray-300 mb-2 text-sm sm:text-base">Amount:</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-2 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-300 mb-2 text-sm sm:text-base">Payment Method:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['cash', 'zelle', 'venmo', 'paypal', 'other'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${
                        paymentMethod === method
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {method === 'cash' && '💵'}
                      {method === 'zelle' && '🏦'}
                      {method === 'venmo' && '💸'}
                      {method === 'paypal' && '🔵'}
                      {method === 'other' && '💳'}
                      <span className="ml-1 capitalize">{method}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-gray-300 mb-2 text-sm sm:text-base">Note (optional):</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g., Paid at restaurant"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 sm:px-4 py-2 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    resetPaymentForm();
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment || !paymentFrom || !paymentTo || !paymentAmount || paymentFrom === paymentTo}
                  className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {recordingPayment ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

