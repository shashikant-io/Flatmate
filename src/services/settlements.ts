import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

export interface SettlementInput {
  amountInPaise: number
  senderId: string
  receiverId: string
  paymentDate: string
  notes?: string
}

export interface Settlement extends SettlementInput {
  id: string
  status: 'pending' | 'completed'
}

export async function createSettlement(flatId: string, input: SettlementInput): Promise<string> {
  if (!auth.currentUser) throw new Error('You must be signed in to record a settlement')
  const result = await addDoc(collection(db, 'flats', flatId, 'settlements'), {
    ...input,
    createdBy: auth.currentUser.uid,
    amountInPaise: Math.trunc(input.amountInPaise),
    status: 'completed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return result.id
}

export function subscribeToSettlements(flatId: string, onChange: (items: Settlement[]) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(query(collection(db, 'flats', flatId, 'settlements'), orderBy('paymentDate', 'desc')), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Settlement)))
  }, onError)
}
