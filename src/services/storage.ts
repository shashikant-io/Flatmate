import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../firebase'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES) throw new Error('Choose an image smaller than 5 MB')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to compress image')), 'image/jpeg', 0.82))
}

export async function uploadExpenseImage(flatId: string, expenseId: string, file: File, kind: 'item' | 'receipt'): Promise<string> {
  const blob = await compressImage(file)
  const path = `flats/${flatId}/expenses/${expenseId}/${kind}.jpg`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' })
  return getDownloadURL(storageRef)
}
