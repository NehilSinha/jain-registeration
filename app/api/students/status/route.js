import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Student from '@/models/Student';

// Simple in-memory rate limiting
const rateLimitMap = new Map();

function isRateLimited(identifier) {
  const now = Date.now();
  const windowMs = 30000; // 30 seconds window
  const maxRequests = 3; // Increased to 3 requests per 30 seconds
  
  // Clean up old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, requests] of rateLimitMap.entries()) {
      const validRequests = requests.filter(time => now - time < windowMs);
      if (validRequests.length === 0) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  const requests = rateLimitMap.get(identifier) || [];
  const validRequests = requests.filter(time => now - time < windowMs);
  
  // Check if limit exceeded BEFORE adding current request
  if (validRequests.length >= maxRequests) {
    return {
      limited: true,
      resetTime: Math.ceil((validRequests[0] + windowMs - now) / 1000)
    };
  }
  
  // Add current request timestamp
  validRequests.push(now);
  rateLimitMap.set(identifier, validRequests);
  
  return { 
    limited: false,
    remaining: maxRequests - validRequests.length
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, phone, studentId, applicationNumber } = body;
    
    // Determine rate limit identifier (prefer studentId, fallback to others)
    const identifier = studentId || applicationNumber || email || phone;
    
    if (!identifier) {
      return NextResponse.json(
        { error: 'Please provide studentId, applicationNumber, email, or phone' },
        { status: 400 }
      );
    }

    // Check rate limiting
    const rateLimit = isRateLimited(identifier);
    if (rateLimit.limited) {
      return NextResponse.json(
        { 
          error: `Too many status checks. Please wait ${rateLimit.resetTime} seconds before checking again.`,
          rateLimited: true,
          resetTime: rateLimit.resetTime
        },
        { status: 429 }
      );
    }

    console.log(`Status check for ${identifier}, remaining: ${rateLimit.remaining}`); // Debug log

    await connectDB();
    
    let student = null;

    // Optimized query - only select needed fields for better performance
    const selectFields = {
      name: 1,
      email: 1,
      phone: 1,
      department: 1,
      studentId: 1,
      applicationNumber: 1,
      status: 1,
      photoUrl: 1,
      documentsVerified: 1,
      createdAt: 1
    };

    // Search by different criteria with optimized queries
    if (studentId) {
      student = await Student.findOne({ studentId }, selectFields);
    } else if (applicationNumber) {
      student = await Student.findOne({ applicationNumber }, selectFields);
    } else if (email) {
      student = await Student.findOne({ email }, selectFields);
    } else if (phone) {
      student = await Student.findOne({ phone }, selectFields);
    }

    if (!student) {
      return NextResponse.json(
        { error: 'No registration found with the provided information' },
        { status: 404 }
      );
    }

    // Return optimized student status
    const response = {
      success: true,
      student: {
        name: student.name,
        email: student.email,
        phone: student.phone,
        department: student.department,
        studentId: student.studentId,
        applicationNumber: student.applicationNumber,
        status: student.status,
        registrationDate: student.createdAt,
        hasPhoto: !!student.photoUrl,
        documentsVerified: student.documentsVerified,
        lastChecked: new Date().toISOString()
      },
      // Rate limit info for client
      rateLimit: {
        remaining: rateLimit.remaining || 0,
        resetTime: 30 // Next reset in 30 seconds
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Student status fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch student status' },
      { status: 500 }
    );
  }
}

// Optional: Add cleanup function that runs periodically
// This prevents memory leaks in production
setInterval(() => {
  const now = Date.now();
  const windowMs = 30000;
  
  for (const [key, requests] of rateLimitMap.entries()) {
    const validRequests = requests.filter(time => now - time < windowMs);
    if (validRequests.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, validRequests);
    }
  }
  
  console.log(`Rate limit cleanup: ${rateLimitMap.size} active rate limits`);
}, 60000);