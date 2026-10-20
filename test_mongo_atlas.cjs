const mongoose = require('mongoose');
const uri = 'mongodb+srv://erphubtechnologiesaws_db_user:Sanjay14@aiplacement.8kc0qq0.mongodb.net/placementos?retryWrites=true&w=majority&appName=aiplacement';
mongoose.connect(uri)
  .then(async () => {
    const interviews = await mongoose.connection.collection('interviews').find().toArray();
    console.log(JSON.stringify(interviews, null, 2));
    process.exit(0);
  });
