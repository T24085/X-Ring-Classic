const http = require('http');

function testRegistration() {
  const userData = {
    username: 'testuser2',
    email: 'test2@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    role: 'competitor'
  };

  const postData = JSON.stringify(userData);

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('Testing registration with minimal data:', userData);

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Response Body:', data);
      
      if (res.statusCode === 201) {
        console.log('✅ Registration successful!');
      } else {
        console.log('❌ Registration failed');
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
  });

  req.write(postData);
  req.end();
}

testRegistration();
