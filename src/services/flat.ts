import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db } from '../firebase'
import { getAppFunctions } from './functions'
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
  await httpsCallable<{ token: string }, { flatId: string }>(getAppFunctions(), 'acceptInvitation')({ token })
}

export async function createInvitation(flatId: string, email: string): Promise<{ token: string }> {
  const result = await httpsCallable<{ flatId: string; email: string }, { invitationId: string; token: string }>(
    getAppFunctions(), 'createInvitation',
  )({ flatId, email: email.trim().toLowerCase() })
  return { token: result.data.token }
}
