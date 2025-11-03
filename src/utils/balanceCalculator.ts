import type { Expense, Balance, Settlement, Payment } from '../types';

export const calculateBalances = (expenses: Expense[], payments: Payment[] = []): Balance[] => {
  const netBalances: Map<string, number> = new Map();

  expenses.forEach((expense) => {
    const amountPerPerson = expense.amount / expense.sharedWith.length;

    expense.sharedWith.forEach((memberId) => {
      if (memberId !== expense.paidBy) {
        const from = memberId;
        const to = expense.paidBy;
        const key = from < to ? `${from}-${to}` : `${to}-${from}`;
        const currentBalance = netBalances.get(key) || 0;
        
        if (from < to) {
          netBalances.set(key, currentBalance + amountPerPerson);
        } else {
          netBalances.set(key, currentBalance - amountPerPerson);
        }
      }
    });
  });

  payments.forEach((payment) => {
    const from = payment.from;
    const to = payment.to;
    const key = from < to ? `${from}-${to}` : `${to}-${from}`;
    const currentBalance = netBalances.get(key) || 0;
    
    if (from < to) {
      netBalances.set(key, currentBalance - payment.amount);
    } else {
      netBalances.set(key, currentBalance + payment.amount);
    }
  });

  const result: Balance[] = [];
  netBalances.forEach((amount, key) => {
    const roundedAmount = Math.round(amount * 100) / 100;
    if (Math.abs(roundedAmount) >= 0.01) {
      const [id1, id2] = key.split('-');
      if (roundedAmount > 0) {
        result.push({ from: id1, to: id2, amount: Math.abs(roundedAmount) });
      } else {
        result.push({ from: id2, to: id1, amount: Math.abs(roundedAmount) });
      }
    }
  });

  return result;
};

export const minimizeTransactions = (balances: Balance[]): Settlement[] => {
  const netAmounts: Map<string, number> = new Map();

  balances.forEach((balance) => {
    netAmounts.set(balance.from, (netAmounts.get(balance.from) || 0) - balance.amount);
    netAmounts.set(balance.to, (netAmounts.get(balance.to) || 0) + balance.amount);
  });

  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  netAmounts.forEach((amount, userId) => {
    if (amount < -0.01) {
      debtors.push({ id: userId, amount: Math.abs(amount) });
    } else if (amount > 0.01) {
      creditors.push({ id: userId, amount });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

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

    if (debtor.amount < 0.01) debtorIndex++;
    if (creditor.amount < 0.01) creditorIndex++;
  }

  return settlements;
};

