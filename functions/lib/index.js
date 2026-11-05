"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpense = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const zod_1 = require("zod");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const expenseSchema = zod_1.z.object({
    flatId: zod_1.z.string().min(1),
    item: zod_1.z.string().trim().min(1).max(120),
    amountInPaise: zod_1.z.number().int().positive(),
    paidBy: zod_1.z.string().min(1),
    category: zod_1.z.string().trim().min(1).max(50),
    purchaseDate: zod_1.z.string().date(),
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
