import mongoose from 'mongoose';
import { loadConfig } from '../config/env.js';
import { Admin } from '../models/Admin.js';
import { hashPassword } from '../services/adminAuth.js';

async function main() {
  const config = loadConfig();
  const usernames = Array.isArray(config.adminUsernames) ? config.adminUsernames : [];
  const force = process.argv.includes('--force');

  if (!usernames.length) {
    throw new Error('Set ADMIN_USERNAMES in backend/.env before seeding admins.');
  }
  if (!config.adminPassword && !config.adminPasswordHash) {
    throw new Error('Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH in backend/.env.');
  }

  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 5000 });
  await Admin.init();

  const passwordHash = config.adminPasswordHash || (await hashPassword(config.adminPassword));

  for (const username of usernames) {
    const existing = await Admin.findOne({ username });

    if (existing && !force) {
      console.log(`Admin "${username}" already exists. Use --force to reset the password.`);
    } else if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = 'admin';
      await existing.save();
      console.log(`Admin "${username}" password updated.`);
    } else {
      await Admin.create({ username, passwordHash, role: 'admin' });
      console.log(`Admin "${username}" created.`);
    }
  }

  const removed = await Admin.deleteMany({ username: { $nin: usernames } });
  if (removed.deletedCount) {
    console.log(`Removed ${removed.deletedCount} admin account(s) not listed in ADMIN_USERNAMES.`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Admin seed failed:', error.message);
  process.exit(1);
});
