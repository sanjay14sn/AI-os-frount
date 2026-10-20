const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/placementos');
const User = mongoose.connection.collection('users');
async function run() {
  const user = await User.findOne({ email: 'snsanjay2002@gmail.com' });
  console.log("User:", user);
  const Student = mongoose.connection.collection('students');
  const student = await Student.findOne({ email: 'snsanjay2002@gmail.com' });
  console.log("Student:", student);
  process.exit(0);
}
run();
