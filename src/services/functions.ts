import { getFunctions, type Functions } from 'firebase/functions'
import { firebaseApp } from '../firebase'

let functions: Functions | undefined

export function getAppFunctions(): Functions {
  functions ??= getFunctions(firebaseApp, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'asia-south1')
  return functions
}
