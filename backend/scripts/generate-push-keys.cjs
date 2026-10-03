const { generateVAPIDKeys } = require('web-push');
const keys = generateVAPIDKeys();
console.error('Copy these values into backend/.env. Keep the private key secret; do not commit or paste it into chat. Generate once, not at every startup.');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
