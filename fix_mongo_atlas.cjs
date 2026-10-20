const mongoose = require('mongoose');
const uri = 'mongodb+srv://erphubtechnologiesaws_db_user:Sanjay14@aiplacement.8kc0qq0.mongodb.net/placementos?retryWrites=true&w=majority&appName=aiplacement';
mongoose.connect(uri)
  .then(async () => {
    const db = mongoose.connection.collection('interviews');
    const interviews = await db.find().toArray();
    for (let interview of interviews) {
      if (typeof interview.studentId === 'string' || typeof interview.companyId === 'string') {
        await db.updateOne(
          { _id: interview._id },
          { 
            $set: { 
              studentId: new mongoose.Types.ObjectId(interview.studentId),
              companyId: new mongoose.Types.ObjectId(interview.companyId)
            }
          }
        );
        console.log(`Updated interview ${interview._id}`);
      }
    }
    console.log('Done fixing types');
    process.exit(0);
  });
