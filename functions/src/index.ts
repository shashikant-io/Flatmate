import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initializeApp } from 'firebase-admin/app'
import { z } from 'zod'

initializeApp()
const db = getFirestore()

const expenseSchema = z.object({
  flatId: z.string().min(1),
  item: z.string().trim().min(1).max(120),
  amountInPaise: z.number().int().positive(),
  paidBy: z.string().min(1),
  category: z.string().trim().min(1).max(50),
  purchaseDate: z.string().date(),
  expenseType: z.enum(['shared', 'personal']),
  quantity: z.number().positive().optional(),
  notes: z.string().max(1000).optional(),
})

async function assertMember(flatId: string, uid: string) {
  const member = await db.doc(`flats/${flatId}/members/${uid}`).get()
  if (!member.exists) throw new HttpsError('permission-denied', 'You are not a member of this flat')
}

export const createExpense = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required')
  const input = expenseSchema.safeParse(request.data)
  if (!input.success) throw new HttpsError('invalid-argument', 'Invalid expense input')
  await assertMember(input.data.flatId, request.auth.uid)
  const reference = await db.collection(`flats/${input.data.flatId}/expenses`).add({
    ...input.data,
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    deletedAt: null,
  })
  return { expenseId: reference.id }
})
