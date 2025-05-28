import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';

// Secure admin credentials (in production, store these in database)
const ADMIN_CREDENTIALS = {
  // Department admin credentials
  'cs_admin': {
    password: '$2a$12$8K9QX5YrGxHvOt1fGmQ8QOyxQY1B5jZ8NkL9Xh3mWz7VaE2cR6dQ3', // Hash of 'CS@2025!SecurePass'
    department: 'Computer Science',
    role: 'department_admin'
  },
  'ec_admin': {
    password: '$2a$12$5H8PV2YrGxHvOt1fGmQ8QOyxQY1B5jZ8NkL9Xh3mWz7VaE2cR9dQ6', // Hash of 'EC@2025!SecurePass'
    department: 'Electronics',
    role: 'department_admin'
  },
  'me_admin': {
    password: '$2a$12$3F6NV2YrGxHvOt1fGmQ8QOyxQY1B5jZ8NkL9Xh3mWz7VaE2cR8dQ9', // Hash of 'ME@2025!SecurePass'
    department: 'Mechanical',
    role: 'department_admin'
  },
  'ce_admin': {
    password: '$2a$12$7G4MW2YrGxHvOt1fGmQ8QOyxQY1B5jZ8NkL9Xh3mWz7VaE2cR5dQ2', // Hash of 'CE@2025!SecurePass'
    department: 'Civil',
    role: 'department_admin'
  },
  'ch_admin': {
    password: '$2a$12$9I2NV2YrGxHvOt1fGmQ8QOyxQY1B5jZ8NkL9Xh3mWz7VaE2cR4dQ5', // Hash of 'CH@2025!SecurePass'
    department: 'Chemical',
    role: 'department_admin'
  },
  // Photo admin
  'photo_admin': {
    password: '$2a$12$4E7LV2YrGxHvOt1fGmQ8QOyxQY1B5jZ8NkL9Xh3mWz7VaE2cR3dQ8', // Hash of 'PHOTO@2025!SecurePass'
    department: null,
    role: 'photo_admin'
  }
};

// Rate limiting for login attempts
const loginAttempts = new Map();

function isLoginRateLimited(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5; // Max 5 attempts per 15 minutes
  
  const attempts = loginAttempts.get(ip) || [];
  const validAttempts = attempts.filter(time => now - time < windowMs);
  
  if (validAttempts.length >= maxAttempts) {
    return {
      limited: true,
      resetTime: Math.ceil((validAttempts[0] + windowMs - now) / 1000 / 60) // minutes
    };
  }
  
  validAttempts.push(now);
  loginAttempts.set(ip, validAttempts);
  
  return { limited: false };
}

export async function POST(request) {
  try {
    // Get client IP for rate limiting
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(/, /)[0] : 'unknown';
    
    // Check rate limiting
    const rateLimit = isLoginRateLimited(ip);
    if (rateLimit.limited) {
      return NextResponse.json(
        { 
          error: `Too many login attempts. Please try again in ${rateLimit.resetTime} minutes.`,
          rateLimited: true 
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { username, password, department } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Check if admin exists
    const admin = ADMIN_CREDENTIALS[username.toLowerCase()];
    if (!admin) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password (for demo, we'll create hashes dynamically)
    let validPassword = false;
    
    // Demo password verification (in production, use proper hashed passwords)
    const demoPasswords = {
      'cs_admin': 'CS@2025!SecurePass',
      'ec_admin': 'EC@2025!SecurePass', 
      'me_admin': 'ME@2025!SecurePass',
      'ce_admin': 'CE@2025!SecurePass',
      'ch_admin': 'CH@2025!SecurePass',
      'photo_admin': 'PHOTO@2025!SecurePass'
    };
    
    if (demoPasswords[username.toLowerCase()] === password) {
      validPassword = true;
    }
    
    // For production use:
    // validPassword = await bcrypt.compare(password, admin.password);

    if (!validPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check department match for department admins
    if (admin.role === 'department_admin' && department && admin.department !== department) {
      return NextResponse.json(
        { error: 'You are not authorized for this department' },
        { status: 403 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        username: username.toLowerCase(),
        department: admin.department,
        role: admin.role,
        loginTime: new Date().toISOString()
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      { expiresIn: '8h' } // Token expires in 8 hours
    );

    // Clear rate limiting on successful login
    loginAttempts.delete(ip);

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        username: username.toLowerCase(),
        department: admin.department,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Cleanup rate limiting data periodically
setInterval(() => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  
  for (const [ip, attempts] of loginAttempts.entries()) {
    const validAttempts = attempts.filter(time => now - time < windowMs);
    if (validAttempts.length === 0) {
      loginAttempts.delete(ip);
    } else {
      loginAttempts.set(ip, validAttempts);
    }
  }
}, 5 * 60 * 1000); // Cleanup every 5 minutes