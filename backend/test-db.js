const db = require('./config/db');

async function testConnection() {
  try {
    const connection = await db.getConnection();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Database query test successful:', rows[0]);
    
    connection.release();
    
    // Test tables existence
    const [tables] = await db.execute('SHOW TABLES');
    console.log('📊 Available tables:', tables.map(t => Object.values(t)[0]));
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Make sure your MySQL server is running and credentials are correct in .env file');
  }
}

testConnection();
