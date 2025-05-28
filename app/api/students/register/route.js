import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Student from '@/models/Student';

export async function POST(request) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { name, phone, email, department, parentName, parentEmail, parentPhone, dob } = body;

    // Validate required fields
    if (!name || !phone || !email || !department || !parentName || !parentEmail || !parentPhone || !dob) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Create default documents checklist based on department
    const defaultDocs = [
      { docName: '10th Marksheet', verified: false },
      { docName: '12th Marksheet', verified: false },
      { docName: 'Transfer Certificate', verified: false },
      { docName: 'Character Certificate', verified: false },
      { docName: 'Caste Certificate (if applicable)', verified: false }
    ];

    // Generate student ID manually
    const year = new Date().getFullYear();
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const studentId = `${year}${randomNum}`;

    // Create new student
    const student = new Student({
      studentId,
      name,
      phone,
      email,
      department,
      parentName,
      parentEmail,
      parentPhone,
      dob: new Date(dob),
      documentsVerified: defaultDocs
    });

    await student.save();

    return NextResponse.json({
      success: true,
      message: 'Registration successful!',
      studentId: student.studentId,
      data: {
        name: student.name,
        studentId: student.studentId,
        department: student.department
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Student with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}