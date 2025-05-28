import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Student from '@/models/Student';

// Import JWT server-side only
const jwt = require('jsonwebtoken');

// Server-side token verification
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key');
    return { valid: true, data: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export async function GET(request, { params }) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Access denied. Authentication required.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const verification = verifyToken(token);

    if (!verification.valid) {
      return NextResponse.json(
        { error: 'Access denied. Invalid token.' },
        { status: 401 }
      );
    }

    // Await params before destructuring
    const { dept } = await params;
    
    if (!dept) {
      return NextResponse.json(
        { error: 'Department parameter is required' },
        { status: 400 }
      );
    }

    // Decode department name (in case of URL encoding)
    const departmentName = decodeURIComponent(dept);

    // Check if user has access to this department
    const userData = verification.data;
    if (userData.role === 'department_admin' && userData.department !== departmentName) {
      return NextResponse.json(
        { error: 'Access denied. You are not authorized for this department.' },
        { status: 403 }
      );
    }

    await connectDB();

    // Get all students for this department with optimized query
    const students = await Student.find({ department: departmentName })
      .sort({ createdAt: -1 }) // Most recent first
      .select('-photoUrl') // Exclude photo data for performance
      .lean(); // Use lean for better performance

    return NextResponse.json({
      success: true,
      department: departmentName,
      students: students,
      count: students.length,
      admin: {
        username: userData.username,
        department: userData.department,
        role: userData.role
      }
    });

  } catch (error) {
    console.error('Department students fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch department students' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Access denied. Authentication required.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const verification = verifyToken(token);

    if (!verification.valid) {
      return NextResponse.json(
        { error: 'Access denied. Invalid token.' },
        { status: 401 }
      );
    }

    // Await params before destructuring
    const { dept } = await params;
    const body = await request.json();
    const { studentId, documentsVerified } = body;

    if (!studentId || !documentsVerified) {
      return NextResponse.json(
        { error: 'Student ID and documents verification data required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find and update student
    const student = await Student.findOne({ studentId });
    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this student's department
    const userData = verification.data;
    if (userData.role === 'department_admin' && userData.department !== student.department) {
      return NextResponse.json(
        { error: 'Access denied. You are not authorized for this student\'s department.' },
        { status: 403 }
      );
    }

    // Update documents verification
    student.documentsVerified = documentsVerified;
    
    // Check if all documents are verified
    const allVerified = documentsVerified.every(doc => doc.verified);
    if (allVerified) {
      student.status = 'documents_verified';
    }

    await student.save();

    return NextResponse.json({
      success: true,
      message: 'Student documents updated successfully',
      student: {
        name: student.name,
        studentId: student.studentId,
        status: student.status,
        documentsVerified: student.documentsVerified
      },
      updatedBy: {
        username: userData.username,
        department: userData.department,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Document verification update error:', error);
    return NextResponse.json(
      { error: 'Failed to update document verification' },
      { status: 500 }
    );
  }
}