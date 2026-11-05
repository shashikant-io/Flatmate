"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptInvitation = exports.createInvitation = exports.createFlat = exports.createExpense = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const node_crypto_1 = __importDefault(require("node:crypto"));
const zod_1 = require("zod");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const expenseSchema = zod_1.z.object({
    flatId: zod_1.z.string().min(1),
    item: zod_1.z.string().trim().min(1).max(120),
    amountInPaise: zod_1.z.number().int().positive(),
    paidBy: zod_1.z.string().min(1),
    category: zod_1.z.string().trim().min(1).max(50),
    purchaseDate: zod_1.z.string().datetime(),
    expenseType: zod_1.z.enum(['shared', 'personal']),
    quantity: zod_1.z.number().positive().optional(),
    notes: zod_1.z.string().max(1000).optional(),
});
async function assertMember(flatId, uid) {
    const member = await db.doc(`flats/${flatId}/members/${uid}`).get();
    if (!member.exists)
        throw new https_1.HttpsError('permission-denied', 'You are not a member of this flat');
}
exports.createExpense = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login required');
    const input = expenseSchema.safeParse(request.data);
    if (!input.success)
        throw new https_1.HttpsError('invalid-argument', 'Invalid expense input');
    await assertMember(input.data.flatId, request.auth.uid);
    const reference = await db.collection(`flats/${input.data.flatId}/expenses`).add({
        ...input.data,
        createdBy: request.auth.uid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        deletedAt: null,
    });
    return { expenseId: reference.id };
});
const flatNameSchema = zod_1.z.object({ name: zod_1.z.string().trim().min(1).max(80), displayName: zod_1.z.string().trim().min(1).max(80) });
exports.createFlat = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login required');
    const input = flatNameSchema.safeParse(request.data);
    if (!input.success)
        throw new https_1.HttpsError('invalid-argument', 'A flat name and display name are required');
    const flatRef = db.collection('flats').doc();
    const now = firestore_1.FieldValue.serverTimestamp();
    const memberRef = flatRef.collection('members').doc(request.auth.uid);
    await db.runTransaction(async (transaction) => {
        const userRef = db.doc(`users/${request.auth.uid}`);
        const user = await transaction.get(userRef);
        const flatIds = Array.from(new Set([...(user.data()?.flatIds ?? []), flatRef.id]));
        transaction.set(flatRef, { name: input.data.name, createdBy: request.auth.uid, createdAt: now });
        transaction.set(memberRef, { uid: request.auth.uid, displayName: input.data.displayName, role: 'admin', joinedAt: now });
        transaction.set(userRef, { displayName: input.data.displayName, activeFlatId: flatRef.id, flatIds }, { merge: true });
    });
    return { flatId: flatRef.id };
});
const invitationSchema = zod_1.z.object({
    flatId: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
});
exports.createInvitation = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Login required');
    const input = invitationSchema.safeParse(request.data);
    if (!input.success)
        throw new https_1.HttpsError('invalid-argument', 'A valid email is required');
    await assertMember(input.data.flatId, request.auth.uid);
    const member = await db.doc(`flats/${input.data.flatId}/members/${request.auth.uid}`).get();
    if (member.data()?.role !== 'admin')
        throw new https_1.HttpsError('permission-denied', 'Only admins can invite members');
    const token = node_crypto_1.default.randomUUID();
    const tokenHash = node_crypto_1.default.createHash('sha256').update(token).digest('hex');
    const invitationRef = db.collection(`flats/${input.data.flatId}/invitations`).doc();
    await invitationRef.set({
        email: input.data.email.toLowerCase(), tokenHash, status: 'pending',
        createdBy: request.auth.uid, createdAt: nowIso(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    await db.collection('mail').add({
        to: input.data.email.toLowerCase(),
        message: {
            subject: 'You are invited to join a FlatMate workspace',
            text: `Use this invitation code in FlatMate: ${token}. It expires in 7 days.`,
        },
    });
    return { invitationId: invitationRef.id, token };
});
exports.acceptInvitation = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    if (!request.auth || !request.auth.token.email)
        throw new https_1.HttpsError('unauthenticated', 'Verified email required');
    const token = zod_1.z.string().min(20).safeParse(request.data?.token);
    if (!token.success)
        throw new https_1.HttpsError('invalid-argument', 'Invalid invitation');
    const tokenHash = node_crypto_1.default.createHash('sha256').update(token.data).digest('hex');
    const invitationQuery = await db.collectionGroup('invitations').where('tokenHash', '==', tokenHash).limit(1).get();
    if (invitationQuery.empty)
        throw new https_1.HttpsError('not-found', 'Invitation not found');
    const invitation = invitationQuery.docs[0];
    const data = invitation.data();
    if (data.status !== 'pending' || data.expiresAt < nowIso() || data.email !== request.auth.token.email.toLowerCase()) {
        throw new https_1.HttpsError('permission-denied', 'This invitation is invalid or expired');
    }
    const flatId = invitation.ref.parent.parent?.id;
    if (!flatId)
        throw new https_1.HttpsError('failed-precondition', 'Invitation flat is invalid');
    await db.runTransaction(async (transaction) => {
        const userRef = db.doc(`users/${request.auth.uid}`);
        const user = await transaction.get(userRef);
        const flatIds = Array.from(new Set([...(user.data()?.flatIds ?? []), flatId]));
        transaction.set(db.doc(`flats/${flatId}/members/${request.auth.uid}`), {
            uid: request.auth.uid, displayName: user.data()?.displayName ?? request.auth.token.name ?? request.auth.token.email,
            role: 'member', joinedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        transaction.set(userRef, { activeFlatId: flatId, flatIds }, { merge: true });
        transaction.update(invitation.ref, { status: 'accepted', acceptedBy: request.auth.uid, acceptedAt: firestore_1.FieldValue.serverTimestamp() });
    });
    return { flatId };
});
function nowIso() {
    return new Date().toISOString();
}
