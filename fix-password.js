const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb+srv://erphubtechnologiesaws_db_user:Sanjay14@aiplacement.8kc0qq0.mongodb.net/placementos?retryWrites=true&w=majority&appName=aiplacement');

async function run() {
  const User = mongoose.connection.collection('users');
  const user = await User.findOne({ email: 'snsanjay@gmail.com' });
  if (user) {
    const passwordHash = await bcrypt.hash('Student@123', 12);
    await User.updateOne({ email: 'snsanjay@gmail.com' }, { $set: { passwordHash } });
    console.log("Password fixed for snsanjay@gmail.com");
  } else {
    console.log("User not found");
  }
  process.exit(0);
}
run();
