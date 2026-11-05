import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
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
  if (!cleanName) throw new Error('Flat name is required')
  const result = await httpsCallable<{ name: string; displayName: string }, { flatId: string }>(getAppFunctions(), 'createFlat')({
    name: cleanName, displayName: displayName.trim(),
  })
  return { flatId: result.data.flatId, flatName: cleanName, displayName: displayName.trim(), members: [{ uid, displayName: displayName.trim(), role: 'admin' }] }
}

export async function switchFlat(uid: string, flatId: string): Promise<void> {
  const profile = await getDoc(doc(db, 'users', uid))
  if (!profile.data()?.flatIds?.includes(flatId)) throw new Error('You are not a member of this flat')
  await setDoc(doc(db, 'users', uid), { activeFlatId: flatId }, { merge: true })
}

export async function acceptInvitation(token: string): Promise<void> {
  await httpsCallable<{ token: string }, { flatId: string }>(getAppFunctions(), 'acceptInvitation')({ token })
}
