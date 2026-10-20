import mongoose from 'mongoose';
import { env } from './env';

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

export const connectDB = async (): Promise<void> => {
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      attempts++;
      console.log(`[DB] Connecting to MongoDB Atlas... (attempt ${attempts})`);

      await mongoose.connect(env.mongodbUri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });

      console.log('[DB] ✅ MongoDB Atlas connected successfully');
      console.log(`[DB] Database: ${mongoose.connection.db?.databaseName}`);

      mongoose.connection.on('disconnected', () => {
        console.warn('[DB] ⚠️  MongoDB disconnected. Reconnecting...');
      });

      mongoose.connection.on('error', (err) => {
        console.error('[DB] ❌ MongoDB error:', err);
      });

      return;
    } catch (error) {
      const err = error as Error;
      console.error(`[DB] ❌ Connection failed (attempt ${attempts}): ${err.message}`);

      if (attempts >= MAX_RETRIES) {
        console.error('[DB] ❌ Max retries reached. Exiting...');
        process.exit(1);
      }

      console.log(`[DB] Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
    }
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  console.log('[DB] MongoDB disconnected');
};
