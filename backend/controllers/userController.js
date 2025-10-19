const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Helper: detect users table columns
async function detectUserColumns() {
  const [cols] = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users'`
  );
  const set = new Set(cols.map(c => c.column_name));
  return {
    hasUsername: set.has('username'),
    hasName: set.has('name'),
    hasPasswordHash: set.has('password_hash'),
    hasPassword: set.has('password'),
    hasCreatedAt: set.has('created_at')
  };
}

const login = async (req, res) => {
  try {
    console.log('🔐 Login attempt received');
    console.log('📝 Request body:', req.body);
    
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    console.log('🔍 Looking for user with email:', email);
    
    const cols = await detectUserColumns();
    const nameSel = cols.hasUsername ? 'username' : (cols.hasName ? 'name' : `NULL`);
    const pwdSel = cols.hasPasswordHash ? 'password_hash' : (cols.hasPassword ? 'password' : `NULL`);
    const [users] = await db.query(
      `SELECT id, ${nameSel} AS name, email, ${pwdSel} AS pwd_hash, role FROM users WHERE email = ?`,
      [email]
    );
    
    console.log('👥 Users found:', users.length);
    
    if (users.length === 0) {
      console.log('❌ No user found with email:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    console.log('👤 User found:', { id: user.id, email: user.email, role: user.role });

  // Check password (compare against password_hash)
    console.log('🔒 Checking password...');
    if (!user.pwd_hash) {
      return res.status(500).json({ message: 'Server user schema misconfiguration: no password column.' });
    }
    const validPassword = await bcrypt.compare(password, user.pwd_hash);
    console.log('🔑 Password valid:', validPassword);
    
    if (!validPassword) {
      console.log('❌ Invalid password for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    console.log('🎫 Generating JWT token...');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful for user:', email);
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error('💥 Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const cols = await detectUserColumns();
    const nameSel = cols.hasUsername ? 'username' : (cols.hasName ? 'name' : `NULL`);
    const createdSel = cols.hasCreatedAt ? 'created_at' : 'NULL';
    const [users] = await db.query(
      `SELECT id, ${nameSel} AS name, email, role, ${createdSel} AS created_at FROM users`
    );
    
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const cols = await detectUserColumns();
    const nameSel = cols.hasUsername ? 'username' : (cols.hasName ? 'name' : `NULL`);
    const createdSel = cols.hasCreatedAt ? 'created_at' : 'NULL';
    const [users] = await db.query(
      `SELECT id, ${nameSel} AS name, email, role, ${createdSel} AS created_at FROM users WHERE id = ?`,
      [req.userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, username, email, password, role = 'user' } = req.body;

    const chosenUsername = username || name; // accept either field

    if (!chosenUsername || !email || !password) {
      return res.status(400).json({ message: 'Username (or name), email, and password are required' });
    }

    // Check if user already exists
    const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const cols = await detectUserColumns();
    // Decide columns for insert
    const nameCol = cols.hasUsername ? 'username' : (cols.hasName ? 'name' : null);
    const pwdCol = cols.hasPasswordHash ? 'password_hash' : (cols.hasPassword ? 'password' : null);
    if (!nameCol || !pwdCol) {
      return res.status(500).json({ message: 'Server user schema misconfiguration: name/password columns absent.' });
    }
    const [result] = await db.query(
      `INSERT INTO users (${nameCol}, email, ${pwdCol}, role) VALUES (?, ?, ?, ?)`,
      [chosenUsername, email, hashedPassword, role]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.insertId,
        name: chosenUsername,
        email,
        role
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  login,
  getAllUsers,
  getCurrentUser,
  createUser
};
