import mongoose from 'mongoose';
import { Department } from './src/models/Department';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/ai-placementos');
  const depts = await Department.find({}, 'name code collegeId');
  console.log(depts);
  process.exit(0);
}
run().catch(console.error);
