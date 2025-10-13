const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const dns = require('dns');

// Load .env from project root relative to this script to avoid cwd issues
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });
const MONGO_URI = process.env.MONGO_URI;

console.log('Using env path:', envPath);
console.log('.env exists:', fs.existsSync(envPath));

function mask(uri) {
  if (!uri) return uri;
  return uri.replace(/:(.*)@/, ':*****@');
}

async function checkSrv(host) {
  return new Promise((resolve) => {
    dns.resolveSrv(host, (err, addresses) => {
      if (err) return resolve({ ok: false, error: err.message });
      resolve({ ok: true, addresses });
    });
  });
}

async function main() {
  if (!MONGO_URI) {
    console.error('MONGO_URI not set. Copy .env.example to .env and set MONGO_URI.');
    // If .env exists show a hint (do NOT print the value)
    if (fs.existsSync(envPath)) {
      console.error('Found .env at', envPath, 'but MONGO_URI is missing or empty in that file.');
    } else {
      console.error('No .env file found at', envPath);
    }
    process.exit(1);
  }

  console.log('Testing MongoDB connection using:', mask(MONGO_URI));

  // If SRV, try DNS SRV lookup for diagnostics
  const srvMatch = MONGO_URI.match(/^mongodb\+srv:\/\/([^/]+)/);
  if (srvMatch) {
    // srvMatch[1] may include user:pass@host, strip optional userinfo
    const authority = srvMatch[1];
    const hostOnlyMatch = authority.match(/(?:[^@]+@)?(.+)$/);
    const hostOnly = hostOnlyMatch ? hostOnlyMatch[1] : authority;
    const srvHost = `_mongodb._tcp.${hostOnly}`;
    console.log('Performing SRV DNS lookup for', srvHost);
    const srvRes = await checkSrv(srvHost);
    if (!srvRes.ok) {
      console.error('SRV lookup failed:', srvRes.error);
    } else {
      console.log('SRV lookup returned', srvRes.addresses);
    }
  }

  try {
    // Use only serverSelectionTimeoutMS; newer drivers ignore old flags
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Successfully connected to MongoDB');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Connection attempt failed:');
    console.error(err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
