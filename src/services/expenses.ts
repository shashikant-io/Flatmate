import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db, functions } from '../firebase'
import { auth } from '../firebase'
import { httpsCallable } from 'firebase/functions'
import type { Expense } from '../types'

export interface ExpenseInput {
  item: string
  amountInPaise: number
  paidBy: string
  category: string
  purchaseDate: string
  expenseType: 'shared' | 'personal'
  quantity?: number
  notes?: string
  imageKey?: string
  receiptKey?: string
}

function expensesRef(flatId: string) {
  return collection(db, 'flats', flatId, 'expenses')
}

export async function createExpense(flatId: string, input: ExpenseInput): Promise<string> {
  const result = await httpsCallable<ExpenseInput & { flatId: string }, { expenseId: string }>(functions, 'createExpense')({
    ...input, flatId, amountInPaise: Math.trunc(input.amountInPaise),
  })
  return result.data.expenseId
}

export function subscribeToExpenses(
  flatId: string,
  month: string,
  onChange: (expenses: Expense[]) => void,
  onError: (error: Error) => void,
): () => void {
  const expensesQuery = query(
    expensesRef(flatId),
    where('purchaseDate', '>=', `${month}-01`),
    where('purchaseDate', '<=', `${month}-31`),
    orderBy('purchaseDate', 'desc'),
  )
  return onSnapshot(expensesQuery, (snapshot) => {
    onChange(snapshot.docs.filter((item) => !item.data().deletedAt).map((item) => {
      const data = item.data()
      const amountInPaise = Number(data.amountInPaise ?? 0)
      const purchaseDate = String(data.purchaseDate)
      const formattedDate = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).format(new Date(purchaseDate))
      return {
        id: item.id,
        item: data.item,
        amount: amountInPaise / 100,
        amountInPaise,
        paidBy: data.paidBy,
        category: data.category,
        date: formattedDate,
        purchaseDate,
        icon: data.category === 'Groceries' ? '🛒' : data.category === 'Utilities' ? '⚡' : data.category === 'Home care' ? '🧼' : '🍜',
        color: data.category === 'Groceries' ? 'mint' : data.category === 'Utilities' ? 'yellow' : data.category === 'Home care' ? 'blue' : 'orange',
        shared: data.expenseType === 'shared',
        expenseType: data.expenseType,
        createdBy: data.createdBy,
      } satisfies Expense
    }))
  }, onError)
}

export function updateExpense(flatId: string, expenseId: string, input: Partial<ExpenseInput>) {
  return updateDoc(doc(db, 'flats', flatId, 'expenses', expenseId), { ...input, updatedAt: serverTimestamp() })
}

export function deleteExpense(flatId: string, expenseId: string) {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in to delete an expense')
  return updateDoc(doc(db, 'flats', flatId, 'expenses', expenseId), { deletedAt: serverTimestamp(), deletedBy: uid, updatedAt: serverTimestamp() })
}

export function restoreExpense(flatId: string, expenseId: string) {
  return updateDoc(doc(db, 'flats', flatId, 'expenses', expenseId), { deletedAt: null, deletedBy: null, updatedAt: serverTimestamp() })
}
