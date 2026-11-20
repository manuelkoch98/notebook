const project = process.env.GCLOUD_PROJECT || 'demo-atelier';
const emailSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
const password = 'Local-emulator-only-9x!';

async function account(suffix) {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${suffix}-${emailSuffix}`, password, returnSecureToken: true })
  });
  if (!response.ok) throw new Error(`Auth Emulator account creation failed (${response.status})`);
  return response.json();
}

async function firestore(path, method, token, body) {
  return fetch(`http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

const owner = await account('owner');
const other = await account('other');
const vaultPath = `users/${owner.localId}/vaults/private-vault`;
const create = await firestore(vaultPath, 'PATCH', owner.idToken, { fields: { name: { stringValue: 'Private test vault' } } });
if (!create.ok) throw new Error(`Owner could not create own vault (${create.status})`);
const ownerRead = await firestore(vaultPath, 'GET', owner.idToken);
if (!ownerRead.ok) throw new Error(`Owner could not read own vault (${ownerRead.status})`);
const otherRead = await firestore(vaultPath, 'GET', other.idToken);
if (otherRead.status !== 403) throw new Error(`Foreign vault read must be denied; got ${otherRead.status}`);
const otherWrite = await firestore(vaultPath, 'PATCH', other.idToken, { fields: { name: { stringValue: 'Modified by other' } } });
if (otherWrite.status !== 403) throw new Error(`Foreign vault write must be denied; got ${otherWrite.status}`);
console.log('PASS: owner can read/write own vault; second account cannot read or modify it.');
