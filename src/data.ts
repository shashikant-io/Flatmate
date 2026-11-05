import type { Expense } from './types'

export const expenses: Expense[] = [
  { id: '1', item: 'Monthly groceries', amount: 1280, amountInPaise: 128000, paidBy: 'Shashikant', category: 'Groceries', date: 'Today, 09:42', purchaseDate: '2024-10-23T09:42:00.000Z', icon: '🛒', color: 'mint', shared: true, expenseType: 'shared' },
  { id: '2', item: 'Electricity bill', amount: 860, amountInPaise: 86000, paidBy: 'Nitesh', category: 'Utilities', date: 'Yesterday, 18:20', purchaseDate: '2024-10-22T18:20:00.000Z', icon: '⚡', color: 'yellow', shared: true, expenseType: 'shared' },
  { id: '3', item: 'Fresh vegetables', amount: 420, amountInPaise: 42000, paidBy: 'Shashikant', category: 'Groceries', date: 'Oct 18, 20:15', purchaseDate: '2024-10-18T20:15:00.000Z', icon: '🥬', color: 'green', shared: true, expenseType: 'shared' },
  { id: '4', item: 'Cleaning supplies', amount: 310, amountInPaise: 31000, paidBy: 'Nitesh', category: 'Home care', date: 'Oct 17, 11:30', purchaseDate: '2024-10-17T11:30:00.000Z', icon: '🧼', color: 'blue', shared: true, expenseType: 'shared' },
  { id: '5', item: 'Weekend dinner', amount: 640, amountInPaise: 64000, paidBy: 'Shashikant', category: 'Eating out', date: 'Oct 15, 21:05', purchaseDate: '2024-10-15T21:05:00.000Z', icon: '🍜', color: 'orange', shared: true, expenseType: 'shared' },
]

export const monthlyData = [
  { month: 'May', total: 2400 }, { month: 'Jun', total: 3150 }, { month: 'Jul', total: 2840 },
  { month: 'Aug', total: 3920 }, { month: 'Sep', total: 3410 }, { month: 'Oct', total: 3510 },
]

export const categoryData = [
  { name: 'Groceries', value: 49, color: '#16b67a' },
  { name: 'Utilities', value: 27, color: '#f5b940' },
  { name: 'Home care', value: 15, color: '#6f8cff' },
  { name: 'Eating out', value: 9, color: '#ff8b67' },
]
