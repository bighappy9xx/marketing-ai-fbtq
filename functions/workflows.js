'use strict';
const core = require('./workflow-core');

// Inject Firestore and callable wrappers to exercise transactions without production credentials.
function registerWorkflows({ db, onCall, HttpsError, logger = console }) {
  function callable(operation, work) {
    return onCall({ timeoutSeconds: 30, memory: '256MiB' }, async request => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Vui lòng đăng nhập.');
      try { return await work(request); }
      catch (error) {
        if (error instanceof core.WorkflowError) throw new HttpsError(error.code, error.message);
        if (error instanceof HttpsError) throw error;
        // Never log form contents or personal details. The operation and error
        // class/code are enough to find the failed server execution safely.
        logger.error('Workflow operation failed', {
          operation,
          errorName: String(error?.name || 'Error').slice(0, 80),
          errorCode: String(error?.code || 'unknown').slice(0, 80)
        });
        throw new HttpsError('internal', 'Lỗi máy chủ khi xử lý hồ sơ. Hãy thử lại; nếu lỗi tiếp tục, quản trị viên cần kiểm tra nhật ký Cloud Functions.');
      }
    });
  }
  function recordRef(kind, id) {
    if (!core.COLLECTIONS[kind] || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(id)) throw new HttpsError('invalid-argument', 'Mã hồ sơ không hợp lệ.');
    return db.doc(`workspaces/fbtq/${core.COLLECTIONS[kind]}/${id}`);
  }
  return {
    createWorkflow: callable('createWorkflow', async request => {
      const input = request.data || {};
      if (typeof input.clientRequestId !== 'string' || !/^[a-zA-Z0-9-]{16,60}$/.test(input.clientRequestId)) throw new HttpsError('invalid-argument', 'Mã gửi hồ sơ không hợp lệ.');
      const id = `${request.auth.uid}_${input.clientRequestId}`, ref = recordRef(input.kind, id);
      await db.runTransaction(async tx => {
        const [profile, existing] = await Promise.all([tx.get(db.doc(`users/${request.auth.uid}`)), tx.get(ref)]);
        const user = core.actor(request.auth.uid, profile.exists ? profile.data() : null);
        const record = core.createRecord(input.kind, input, user, new Date());
        if (existing.exists) {
          const previous = existing.data();
          const fields = ['kind','amount','date','paymentInfo','description','type','sessions','title'];
          if (fields.some(field => JSON.stringify(previous[field] ?? null) !== JSON.stringify(record[field] ?? null))) throw new HttpsError('already-exists', 'Mã gửi này đã tạo một hồ sơ khác. Đóng form và tạo hồ sơ mới.');
          return; // Retry after a lost response must not create another invoice.
        }
        const locks = core.slotIds(record).map(slot => db.doc(`workspaces/fbtq/leaveSlots/${slot}`));
        const taken = await Promise.all(locks.map(lock => tx.get(lock)));
        if (taken.some(s => s.exists)) throw new HttpsError('already-exists', 'Buổi nghỉ này đã có đơn chờ duyệt hoặc đã được duyệt.');
        tx.create(ref, record);
        locks.forEach(lock => tx.create(lock, { requestId: id, createdBy: user.uid }));
      });
      return { ok: true, id };
    }),
    reviewWorkflow: callable('reviewWorkflow', async request => {
      const input = request.data || {}, ref = recordRef(input.kind, input.id);
      await db.runTransaction(async tx => {
        const [profile, snap] = await Promise.all([tx.get(db.doc(`users/${request.auth.uid}`)), tx.get(ref)]);
        const user = core.actor(request.auth.uid, profile.exists ? profile.data() : null);
        if (!snap.exists) throw new HttpsError('not-found', 'Không tìm thấy hồ sơ.');
        const record = snap.data(), next = core.reviewRecord(record, input, user, new Date());
        tx.set(ref, next);
        if (next.status === 'rejected') core.slotIds(record).forEach(slot => tx.delete(db.doc(`workspaces/fbtq/leaveSlots/${slot}`)));
      });
      return { ok: true };
    }),
    disburseAdvance: callable('disburseAdvance', async request => {
      const input = request.data || {}, ref = recordRef('advance', input.id);
      await db.runTransaction(async tx => {
        const [profile, snap] = await Promise.all([tx.get(db.doc(`users/${request.auth.uid}`)), tx.get(ref)]);
        const user = core.actor(request.auth.uid, profile.exists ? profile.data() : null);
        if (!snap.exists) throw new HttpsError('not-found', 'Không tìm thấy hóa đơn.');
        tx.set(ref, core.disburseRecord(snap.data(), input, user, new Date()));
      });
      return { ok: true };
    })
  };
}
module.exports = { registerWorkflows };
