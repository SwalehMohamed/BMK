const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const { sendMail } = require('../utils/email');

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
  createUser,
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email required' });
      const [rows] = await db.query('SELECT id, email FROM users WHERE email = ?', [email]);
      if (rows.length === 0) return res.json({ message: 'If that email exists a reset link was sent' });
      const user = rows[0];
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 60);
      await db.query('UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?', [tokenHash, expires, user.id]);
      const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
      const resetLink = `${baseUrl}/reset-password?token=${rawToken}`;
        const html = `<p>You requested a password reset.</p><p><a href="${resetLink}">Reset Password</a></p><p>This link expires in 1 hour.</p>`;
        // Log link for local debugging (not in production)
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔗 Password reset link:', resetLink);
        }
      await sendMail({ to: email, subject: 'Password Reset', html });
      const payload = { message: 'If that email exists a reset link was sent' };
      if (process.env.NODE_ENV !== 'production') {
        payload.debugResetLink = resetLink;
      }
      res.json(payload);
    } catch (e) {
      res.status(500).json({ message: 'Server error', error: e.message });
    }
  },
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ message: 'Token and new password required' });
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const [rows] = await db.query('SELECT id, reset_token_expires FROM users WHERE reset_token_hash = ?', [tokenHash]);
      if (rows.length === 0) return res.status(400).json({ message: 'Invalid or expired token' });
      const user = rows[0];
      if (!user.reset_token_expires || new Date(user.reset_token_expires).getTime() < Date.now()) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }
      const hashed = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?', [hashed, user.id]);
      res.json({ message: 'Password reset successful' });
    } catch (e) {
      res.status(500).json({ message: 'Server error', error: e.message });
    }
  },
  // Update user (admin only). Supports changing name/username, email, role, and optional password
  async updateUser(req, res) {
    try {
      if (req.userRole !== 'admin') {
        return res.status(403).json({ message: 'Only admin can update users' });
      }
      const { id } = req.params;
      const { name, username, email, role, password } = req.body || {};

      const cols = await detectUserColumns();
      const nameCol = cols.hasUsername ? 'username' : (cols.hasName ? 'name' : null);
      const pwdCol = cols.hasPasswordHash ? 'password_hash' : (cols.hasPassword ? 'password' : null);
      if (!nameCol || !pwdCol) {
        return res.status(500).json({ message: 'Server user schema misconfiguration: name/password columns absent.' });
      }

      // Ensure the user exists
      const [existing] = await db.query('SELECT id, email FROM users WHERE id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Unique email constraint if changing email
      if (email && email !== existing[0].email) {
        const [dupes] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ?', [email, id]);
        if (dupes.length > 0) {
          return res.status(400).json({ message: 'Another user with this email already exists' });
        }
      }

      const updates = {};
      if (name != null || username != null) {
        updates[nameCol] = (username || name || '').trim();
      }
      if (email != null) updates.email = email;
      if (role != null) updates.role = role;
      if (password != null && String(password).trim() !== '') {
        const hashed = await bcrypt.hash(password, 10);
        updates[pwdCol] = hashed;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No valid fields provided to update' });
      }

      await db.query('UPDATE users SET ? WHERE id = ?', [updates, id]);
      res.json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },
  // Delete user (admin only); prevent self-deletion to avoid accidental lockout
  async deleteUser(req, res) {
    try {
      if (req.userRole !== 'admin') {
        return res.status(403).json({ message: 'Only admin can delete users' });
      }
      const { id } = req.params;
      if (Number(id) === Number(req.userId)) {
        return res.status(400).json({ message: 'You cannot delete your own account' });
      }
      const [existing] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      await db.query('DELETE FROM users WHERE id = ?', [id]);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};
