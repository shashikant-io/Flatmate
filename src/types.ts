export type Person = string
export type Category = 'Groceries' | 'Utilities' | 'Home care' | 'Eating out'

export interface Expense {
  id: string
  item: string
  amount: number
  amountInPaise: number
  paidBy: Person
  category: Category
  date: string
  purchaseDate: string
  icon: string
  color: string
  shared: boolean
  expenseType: 'shared' | 'personal'
  createdBy?: string
  quantity?: number
  notes?: string
  imagePath?: string
  receiptPath?: string
  deletedAt?: string
  deletedBy?: string
}

export interface FlatMember {
  uid: string
  displayName: string
  email?: string
  role: 'admin' | 'member'
  joinedAt?: string
}

export interface FlatContext {
  flatId: string
  flatName: string
  displayName: string
  members: FlatMember[]
}
