import type { Expense, FlatMember } from '../types'

export interface MemberBalance {
  uid: string
  displayName: string
  paidInPaise: number
  shareInPaise: number
  netInPaise: number
}

export function calculateBalances(expenses: Expense[], members: FlatMember[]): MemberBalance[] {
  const shared = expenses.filter((expense) => expense.shared && !expense.deletedAt)
  const total = shared.reduce((sum, expense) => sum + expense.amountInPaise, 0)
  const baseShare = members.length ? Math.floor(total / members.length) : 0
  const remainder = members.length ? total % members.length : 0
  return members.map((member, index) => {
    const paidInPaise = shared.filter((expense) => expense.createdBy === member.uid || expense.paidBy === member.displayName)
      .reduce((sum, expense) => sum + expense.amountInPaise, 0)
    const shareInPaise = baseShare + (index < remainder ? 1 : 0)
    return { uid: member.uid, displayName: member.displayName, paidInPaise, shareInPaise, netInPaise: paidInPaise - shareInPaise }
  })
}
