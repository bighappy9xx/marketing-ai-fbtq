const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const auth = getAuth();
const db = getFirestore();
const roles = new Set(['director', 'branch_manager', 'department_manager', 'employee']);

async function main() {
  let pageToken;
  let count = 0;

  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const ref = db.doc(`users/${user.uid}`);
      const snapshot = await ref.get();
      const profile = snapshot.exists ? snapshot.data() : {};
      const role = [user.customClaims?.role, profile.role].find(value => roles.has(value)) || 'employee';

      await auth.setCustomUserClaims(user.uid, {
        ...user.customClaims,
        role,
        approved: true,
        workspaceId: 'fbtq'
      });
      await ref.set({
        email: user.email || profile.email || '',
        name: profile.name || user.displayName || user.email || user.phoneNumber || 'Tài khoản Firebase',
        role,
        approved: true,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      count += 1;
      console.log(`Approved ${user.email || user.uid} (${role})`);
    }
    pageToken = page.pageToken;
  } while (pageToken);

  console.log(`Approved ${count} Firebase Auth account(s). Existing roles were preserved when valid.`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
