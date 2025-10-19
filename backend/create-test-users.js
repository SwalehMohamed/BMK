const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function createTestUser() {
  try {
    // Hash password for 'admin123'
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Check if admin user already exists
    const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', ['admin@bmk.com']);
    
    if (existingUsers.length > 0) {
      console.log('✅ Admin user already exists');
      
      // Update password if needed
      await db.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, 'admin@bmk.com']);
      console.log('✅ Admin password updated');
    } else {
      // Create admin user
      const [result] = await db.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Admin User', 'admin@bmk.com', hashedPassword, 'admin']
      );
      console.log('✅ Admin user created with ID:', result.insertId);
    }
    
    // Create a test regular user
    const testUserPassword = await bcrypt.hash('user123', 10);
    const [testUsers] = await db.query('SELECT id FROM users WHERE email = ?', ['user@bmk.com']);
    
    if (testUsers.length === 0) {
      const [result] = await db.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Test User', 'user@bmk.com', testUserPassword, 'user']
      );
      console.log('✅ Test user created with ID:', result.insertId);
    } else {
      console.log('✅ Test user already exists');
    }
    
    // Show all users
    const [allUsers] = await db.query('SELECT id, name, email, role, created_at FROM users');
    console.log('\n📊 Current users:');
    console.table(allUsers);
    
    console.log('\n🔑 Test credentials:');
    console.log('Admin: admin@bmk.com / admin123');
    console.log('User: user@bmk.com / user123');
    
  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    process.exit(0);
  }
}

createTestUser();
