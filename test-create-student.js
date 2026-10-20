const http = require('http');

async function run() {
  try {
    const loginData = JSON.stringify({ email: 'admin@placementos.ai', password: 'password123' });
    const loginReq = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loginData
    });
    const loginRes = await loginReq.json();
    const token = loginRes.data.token;

    const collegesReq = await fetch('http://localhost:5001/api/colleges', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const collegesRes = await collegesReq.json();
    console.log('Colleges Res:', collegesRes);
    
    // The res is probably { success: true, data: { data: [...], total: ... } } because of pagination
    const collegesList = Array.isArray(collegesRes.data) ? collegesRes.data : collegesRes.data.data;
    const sona = collegesList.find(c => c.name.includes('Sona'));

    const studentData = {
      name: 'Sanjay',
      studentId: '123',
      email: 'snsanjay2002@gmail.com',
      phone: '07868000645',
      collegeId: sona._id || sona.id,
      department: 'CSE',
      degree: 'B.E.',
      batch: '2025',
      cgpa: 7,
      gender: 'male',
      skills: ['java']
    };
    
    const createReq = await fetch('http://localhost:5001/api/students', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(studentData)
    });
    const createRes = await createReq.json();
    console.log('Create Response:', createRes);
  } catch (err) {
    console.error(err);
  }
}
run();
