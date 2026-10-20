const http = require('http');

async function run() {
  try {
    const loginData = JSON.stringify({ email: 'snsanjay@gmail.com', password: 'Student@123' });
    const loginReq = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loginData
    });
    const loginRes = await loginReq.json();
    console.log('Login Result:', loginRes);
  } catch (err) {
    console.error(err);
  }
}
run();
