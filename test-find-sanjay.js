const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://erphubtechnologiesaws_db_user:Sanjay14@aiplacement.8kc0qq0.mongodb.net/placementos?retryWrites=true&w=majority&appName=aiplacement');

async function run() {
  const User = mongoose.connection.collection('users');
  const user = await User.findOne({ email: 'snsanjay2002@gmail.com' });
  console.log("User:", user);
  const Student = mongoose.connection.collection('students');
  const student = await Student.findOne({ email: 'snsanjay2002@gmail.com' });
  console.log("Student:", student);
  process.exit(0);
}
run();
