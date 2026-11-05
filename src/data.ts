import type { Expense } from './types'

export const expenses: Expense[] = [
  { id: '1', item: 'Monthly groceries', amount: 1280, paidBy: 'Shashikant', category: 'Groceries', date: 'Today, 9:42 AM', icon: '🛒', color: 'mint', shared: true },
  { id: '2', item: 'Electricity bill', amount: 860, paidBy: 'Nitesh', category: 'Utilities', date: 'Yesterday, 6:20 PM', icon: '⚡', color: 'yellow', shared: true },
  { id: '3', item: 'Fresh vegetables', amount: 420, paidBy: 'Shashikant', category: 'Groceries', date: 'Oct 18, 8:15 PM', icon: '🥬', color: 'green', shared: true },
  { id: '4', item: 'Cleaning supplies', amount: 310, paidBy: 'Nitesh', category: 'Home care', date: 'Oct 17, 11:30 AM', icon: '🧼', color: 'blue', shared: true },
  { id: '5', item: 'Weekend dinner', amount: 640, paidBy: 'Shashikant', category: 'Eating out', date: 'Oct 15, 9:05 PM', icon: '🍜', color: 'orange', shared: true },
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
