const mongoose = require('mongoose');
const uri = 'mongodb+srv://erphubtechnologiesaws_db_user:Sanjay14@aiplacement.8kc0qq0.mongodb.net/placementos?retryWrites=true&w=majority&appName=aiplacement';
mongoose.connect(uri)
  .then(async () => {
    const student = await mongoose.connection.collection('students').findOne({ _id: new mongoose.Types.ObjectId("6aab9831158393979eb6a85a") });
    console.log("Student exists:", !!student);
    const company = await mongoose.connection.collection('companies').findOne({ _id: new mongoose.Types.ObjectId("6aac27c86dd82df5c04bbda8") });
    console.log("Company exists:", !!company);
    process.exit(0);
  });
