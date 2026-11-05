export type Person = 'Shashikant' | 'Nitesh'
export type Category = 'Groceries' | 'Utilities' | 'Home care' | 'Eating out'

export interface Expense {
  id: string
  item: string
  amount: number
  paidBy: Person
  category: Category
  date: string
  icon: string
  color: string
  shared: boolean
}
