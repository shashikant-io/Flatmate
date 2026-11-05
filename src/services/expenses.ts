import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { db } from '../firebase'
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
  const reference = await addDoc(expensesRef(flatId), {
    ...input,
    amountInPaise: Math.trunc(input.amountInPaise),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  })
  return reference.id
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
    onChange(snapshot.docs
      .filter((item) => !item.data().deletedAt)
      .map((item) => ({ id: item.id, ...item.data() } as Expense)))
  }, onError)
}

export function updateExpense(flatId: string, expenseId: string, input: Partial<ExpenseInput>) {
  return updateDoc(doc(db, 'flats', flatId, 'expenses', expenseId), { ...input, updatedAt: serverTimestamp() })
}

export function deleteExpense(flatId: string, expenseId: string) {
  return updateDoc(doc(db, 'flats', flatId, 'expenses', expenseId), { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() })
}

export function permanentlyDeleteExpense(flatId: string, expenseId: string) {
  return deleteDoc(doc(db, 'flats', flatId, 'expenses', expenseId))
}
