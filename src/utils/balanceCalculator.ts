import type { Expense, Balance, Settlement } from '../types';

export const calculateBalances = (expenses: Expense[]): Balance[] => {
  // Track net balances between pairs of users
  // Key format: "userId1-userId2" where userId1 < userId2 (for consistency)
  const netBalances: Map<string, number> = new Map();

  expenses.forEach((expense) => {
    const amountPerPerson = expense.amount / expense.sharedWith.length;

    expense.sharedWith.forEach((memberId) => {
      if (memberId !== expense.paidBy) {
        // This member owes money to the person who paid
        const from = memberId;
        const to = expense.paidBy;
        
        // Create consistent key (always smaller ID first)
        const key = from < to ? `${from}-${to}` : `${to}-${from}`;
        const currentBalance = netBalances.get(key) || 0;
        
        // If from < to, this is a positive balance (from owes to)
        // If to < from, this is a negative balance (to owes from)
        if (from < to) {
          netBalances.set(key, currentBalance + amountPerPerson);
        } else {
          netBalances.set(key, currentBalance - amountPerPerson);
        }
      }
    });
  });

  // Convert to Balance array format
  const result: Balance[] = [];
  netBalances.forEach((amount, key) => {
    if (Math.abs(amount) > 0.01) {
      const [id1, id2] = key.split('-');
      if (amount > 0) {
        // id1 owes id2
        result.push({ from: id1, to: id2, amount: Math.abs(amount) });
      } else {
        // id2 owes id1
        result.push({ from: id2, to: id1, amount: Math.abs(amount) });
      }
    }
  });

  return result;
};

export const minimizeTransactions = (balances: Balance[]): Settlement[] => {
  // Calculate net amounts for each user
  const netAmounts: Map<string, number> = new Map();

  balances.forEach((balance) => {
    // User who owes money (negative)
    netAmounts.set(balance.from, (netAmounts.get(balance.from) || 0) - balance.amount);
    // User who gets money (positive)
    netAmounts.set(balance.to, (netAmounts.get(balance.to) || 0) + balance.amount);
  });

  // Separate debtors (negative) and creditors (positive)
  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  netAmounts.forEach((amount, userId) => {
    if (amount < -0.01) {
      debtors.push({ id: userId, amount: Math.abs(amount) });
    } else if (amount > 0.01) {
      creditors.push({ id: userId, amount });
    }
  });

  // Sort by amount (largest first)
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  // Greedy algorithm to minimize transactions
  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    const amount = Math.min(debtor.amount, creditor.amount);

    settlements.push({
      from: debtor.id,
      to: creditor.id,
      amount: parseFloat(amount.toFixed(2)),
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) {
      debtorIndex++;
    }
    if (creditor.amount < 0.01) {
      creditorIndex++;
    }
  }

  return settlements;
};

