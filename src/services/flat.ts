import { addDoc, collection, collectionGroup, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase'
import type { FlatContext, FlatMember } from '../types'

export async function getUserFlat(uid: string): Promise<FlatContext | null> {
  const profile = await getDoc(doc(db, 'users', uid))
  const data = profile.data()
  const flatId = data?.activeFlatId ?? data?.flatId
  if (!flatId) return null
  const flat = await getDoc(doc(db, 'flats', flatId))
  const members = await getDocs(collection(db, 'flats', flatId, 'members'))
  return {
    flatId,
    flatName: flat.data()?.name ?? 'Our flat',
    displayName: data?.displayName ?? '',
    members: members.docs.map((member) => member.data() as FlatMember),
  }
}

export async function createFlat(uid: string, displayName: string, flatName: string): Promise<FlatContext> {
  const cleanName = flatName.trim()
  const cleanDisplayName = displayName.trim()
  if (!cleanDisplayName) throw new Error('Your name is required')
  if (cleanName.length < 2) throw new Error('Flat name must be at least 2 characters')
  if (cleanName.length > 80) throw new Error('Flat name must be 80 characters or fewer')

  const flatRef = doc(collection(db, 'flats'))
  const memberRef = doc(flatRef, 'members', uid)
  const userRef = doc(db, 'users', uid)
  const profile = await getDoc(userRef)
  const flatIds = Array.from(new Set([...(profile.data()?.flatIds ?? []), flatRef.id]))
  const batch = writeBatch(db)
  batch.set(flatRef, { name: cleanName, createdBy: uid, createdAt: new Date().toISOString() })
  batch.set(memberRef, { uid, displayName: cleanDisplayName, role: 'admin', joinedAt: new Date().toISOString() })
  batch.set(userRef, { displayName: cleanDisplayName, activeFlatId: flatRef.id, flatIds }, { merge: true })
  await batch.commit()
  return { flatId: flatRef.id, flatName: cleanName, displayName: cleanDisplayName, members: [{ uid, displayName: cleanDisplayName, role: 'admin' }] }
}

export async function switchFlat(uid: string, flatId: string): Promise<void> {
  const profile = await getDoc(doc(db, 'users', uid))
  if (!profile.data()?.flatIds?.includes(flatId)) throw new Error('You are not a member of this flat')
  await setDoc(doc(db, 'users', uid), { activeFlatId: flatId }, { merge: true })
}

export async function acceptInvitation(token: string): Promise<void> {
  const currentUser = auth.currentUser
  if (!currentUser) throw new Error('Please create an account or sign in before accepting an invitation')
  if (!currentUser.email) throw new Error('Your account must have an email address')
  const tokenHash = await hashInvitationToken(token.trim())
  const invitationQuery = query(collectionGroup(db, 'invitations'), where('tokenHash', '==', tokenHash))
  const invitations = await getDocs(invitationQuery)
  if (invitations.empty) throw new Error('Invitation code not found or expired')
  const invitation = invitations.docs[0]
  const data = invitation.data()
  if (data.status !== 'pending' || data.email !== currentUser.email.toLowerCase() || data.expiresAt < new Date().toISOString()) {
    throw new Error('This invitation is expired or belongs to another email address')
  }
  const flatRef = invitation.ref.parent.parent
  if (!flatRef) throw new Error('Invitation is linked to an invalid flat')
  const memberRef = doc(flatRef, 'members', currentUser.uid)
  const userRef = doc(db, 'users', currentUser.uid)
  await runTransaction(db, async (transaction) => {
    const user = await transaction.get(userRef)
    const flatIds = Array.from(new Set([...(user.data()?.flatIds ?? []), flatRef.id]))
    transaction.set(memberRef, {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email,
      role: 'member',
      invitationId: invitation.id,
      joinedAt: serverTimestamp(),
    })
    transaction.set(userRef, { activeFlatId: flatRef.id, flatIds }, { merge: true })
    transaction.update(invitation.ref, {
      status: 'accepted',
      acceptedBy: currentUser.uid,
      acceptedAt: serverTimestamp(),
    })
  })
}

export async function createInvitation(flatId: string, email: string): Promise<{ token: string }> {
  const token = crypto.randomUUID()
  const tokenHash = await hashInvitationToken(token)
  await addDoc(collection(db, 'flats', flatId, 'invitations'), {
    email: email.trim().toLowerCase(),
    tokenHash,
    status: 'pending',
    createdBy: auth.currentUser?.uid,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  return { token }
}

async function hashInvitationToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
