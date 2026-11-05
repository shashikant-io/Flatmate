import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initializeApp } from 'firebase-admin/app'
import crypto from 'node:crypto'
import { z } from 'zod'

initializeApp()
const db = getFirestore()

const expenseSchema = z.object({
  flatId: z.string().min(1),
  item: z.string().trim().min(1).max(120),
  amountInPaise: z.number().int().positive(),
  paidBy: z.string().min(1),
  category: z.string().trim().min(1).max(50),
  purchaseDate: z.string().datetime(),
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

const flatNameSchema = z.object({ name: z.string().trim().min(1).max(80), displayName: z.string().trim().min(1).max(80) })

export const createFlat = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required')
  const input = flatNameSchema.safeParse(request.data)
  if (!input.success) throw new HttpsError('invalid-argument', 'A flat name and display name are required')
  const flatRef = db.collection('flats').doc()
  const now = FieldValue.serverTimestamp()
  const memberRef = flatRef.collection('members').doc(request.auth.uid)
  await db.runTransaction(async (transaction) => {
    const userRef = db.doc(`users/${request.auth!.uid}`)
    const user = await transaction.get(userRef)
    const flatIds = Array.from(new Set([...(user.data()?.flatIds ?? []), flatRef.id]))
    transaction.set(flatRef, { name: input.data.name, createdBy: request.auth!.uid, createdAt: now })
    transaction.set(memberRef, { uid: request.auth!.uid, displayName: input.data.displayName, role: 'admin', joinedAt: now })
    transaction.set(userRef, { displayName: input.data.displayName, activeFlatId: flatRef.id, flatIds }, { merge: true })
  })
  return { flatId: flatRef.id }
})

const invitationSchema = z.object({
  flatId: z.string().min(1),
  email: z.string().email(),
})

export const createInvitation = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required')
  const input = invitationSchema.safeParse(request.data)
  if (!input.success) throw new HttpsError('invalid-argument', 'A valid email is required')
  await assertMember(input.data.flatId, request.auth.uid)
  const member = await db.doc(`flats/${input.data.flatId}/members/${request.auth.uid}`).get()
  if (member.data()?.role !== 'admin') throw new HttpsError('permission-denied', 'Only admins can invite members')
  const token = crypto.randomUUID()
  const invitationToken = `${input.data.flatId}.${token}`
  const tokenHash = crypto.createHash('sha256').update(invitationToken).digest('hex')
  const invitationRef = db.doc(`flats/${input.data.flatId}/invitations/${tokenHash}`)
  await invitationRef.set({
    flatId: input.data.flatId, invitedEmail: input.data.email.trim().toLowerCase(),
    invitedBy: request.auth.uid, tokenHash, status: 'pending',
    createdBy: request.auth.uid, createdAt: nowIso(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  })
  await db.collection('mail').add({
    to: input.data.email.toLowerCase(),
    message: {
      subject: 'You are invited to join a FlatMate workspace',
      text: `Use this invitation code in FlatMate: ${invitationToken}. It expires in 7 days.`,
    },
  })
  return { invitationId: invitationRef.id, token: invitationToken }
})

export const acceptInvitation = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth || !request.auth.token.email) throw new HttpsError('unauthenticated', 'Verified email required')
  const token = z.string().min(20).safeParse(request.data?.token)
  if (!token.success) throw new HttpsError('invalid-argument', 'Invalid invitation')
  const separator = token.data.indexOf('.')
  if (separator <= 0) throw new HttpsError('invalid-argument', 'Invalid invitation')
  const flatId = token.data.slice(0, separator)
  const tokenHash = crypto.createHash('sha256').update(token.data).digest('hex')
  const invitation = await db.doc(`flats/${flatId}/invitations/${tokenHash}`).get()
  if (!invitation.exists) throw new HttpsError('not-found', 'Invitation not found')
  const data = invitation.data()
  const authenticatedEmail = String(request.auth.token.email).trim().toLowerCase()
  if (data?.status !== 'pending' || data?.expiresAt < nowIso() || data?.invitedEmail !== authenticatedEmail) {
    throw new HttpsError('permission-denied', 'This invitation is invalid or expired')
  }
  await db.runTransaction(async (transaction) => {
    const userRef = db.doc(`users/${request.auth!.uid}`)
    const user = await transaction.get(userRef)
    const flatIds = Array.from(new Set([...(user.data()?.flatIds ?? []), flatId]))
    transaction.set(db.doc(`flats/${flatId}/members/${request.auth!.uid}`), {
      uid: request.auth!.uid, displayName: user.data()?.displayName ?? request.auth!.token.name ?? request.auth!.token.email,
      role: 'member', joinedAt: FieldValue.serverTimestamp(),
    })
    transaction.set(userRef, { activeFlatId: flatId, flatIds }, { merge: true })
    transaction.update(invitation.ref, { status: 'accepted', acceptedBy: request.auth!.uid, acceptedAt: FieldValue.serverTimestamp() })
  })
  return { flatId }
})

function nowIso() {
  return new Date().toISOString()
}
