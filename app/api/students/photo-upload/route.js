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

export async function POST(request) {
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

    // Check if user has photo_admin role
    const userData = verification.data;
    if (userData.role !== 'photo_admin') {
      return NextResponse.json(
        { error: 'Access denied. Photo admin privileges required.' },
        { status: 403 }
      );
    }

    await connectDB();
    
    const formData = await request.formData();
    const studentId = formData.get('studentId');
    const photoFile = formData.get('photo');

    if (!studentId || !photoFile) {
      return NextResponse.json(
        { error: 'Student ID and photo are required' },
        { status: 400 }
      );
    }

    // Find student by ID
    const student = await Student.findOne({ studentId });
    if (!student) {
      return NextResponse.json(
        { error: 'Student not found with this ID' },
        { status: 404 }
      );
    }

    // Convert photo to base64 for simple storage
    // In production, you'd upload to cloud storage like AWS S3 or Cloudinary
    const bytes = await photoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Photo = `data:${photoFile.type};base64,${buffer.toString('base64')}`;

    // Generate application number
    const applicationNumber = `APP${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Update student with photo and application number
    student.photoUrl = base64Photo;
    student.applicationNumber = applicationNumber;
    student.status = 'photo_taken';
    
    await student.save();

    return NextResponse.json({
      success: true,
      message: 'Photo uploaded successfully!',
      applicationNumber: applicationNumber,
      studentData: {
        name: student.name,
        studentId: student.studentId,
        department: student.department,
        applicationNumber: student.applicationNumber
      },
      uploadedBy: {
        username: userData.username,
        role: userData.role,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { error: 'Photo upload failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Get student by ID for verification (with auth)
export async function GET(request) {
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

    // Check if user has photo_admin role
    const userData = verification.data;
    if (userData.role !== 'photo_admin') {
      return NextResponse.json(
        { error: 'Access denied. Photo admin privileges required.' },
        { status: 403 }
      );
    }

    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      );
    }

    const student = await Student.findOne({ studentId }, {
      name: 1,
      studentId: 1,
      department: 1,
      phone: 1,
      photoUrl: 1,
      applicationNumber: 1,
      status: 1
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      student: {
        name: student.name,
        studentId: student.studentId,
        department: student.department,
        phone: student.phone,
        hasPhoto: !!student.photoUrl,
        applicationNumber: student.applicationNumber,
        status: student.status
      }
    });

  } catch (error) {
    console.error('Student fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch student details' },
      { status: 500 }
    );
  }
}