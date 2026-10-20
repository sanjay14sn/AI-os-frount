const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/ai-placementos-db')
  .then(async () => {
    const interviews = await mongoose.connection.collection('interviews').find().toArray();
    console.log(JSON.stringify(interviews, null, 2));
    process.exit(0);
  });
