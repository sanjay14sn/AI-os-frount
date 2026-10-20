const mongoose = require('mongoose');
const uri = 'mongodb+srv://erphubtechnologiesaws_db_user:Sanjay14@aiplacement.8kc0qq0.mongodb.net/placementos?retryWrites=true&w=majority&appName=aiplacement';
mongoose.connect(uri)
  .then(async () => {
    await mongoose.connection.collection('interviews').deleteMany({});
    console.log("Deleted old interviews");
    process.exit(0);
  });
