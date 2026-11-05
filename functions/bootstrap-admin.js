const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
async function main(){
  const email=process.argv[2];
  if(!email||!email.includes('@')){console.error('Usage: npm run bootstrap-admin -- admin@company.com');process.exit(1)}
  const user=await getAuth().getUserByEmail(email.trim().toLowerCase());
  await getAuth().setCustomUserClaims(user.uid,{...user.customClaims,role:'director',approved:true,workspaceId:'fbtq'});
  await getFirestore().doc(`users/${user.uid}`).set({email:user.email,name:user.displayName||email,role:'director',approved:true,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  console.log(`Granted director access to ${user.email}. Ask the user to sign out and sign in again.`);
}
main().catch(error=>{console.error(error.message);process.exit(1)});
