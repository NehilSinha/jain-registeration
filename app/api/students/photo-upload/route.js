import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Student from '@/models/Student';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

// Import JWT server-side only
const jwt = require('jsonwebtoken');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Server-side token verification
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key');
    return { valid: true, data: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Compress image function
async function compressImage(buffer, originalSize) {
  try {
    console.log(`📸 Original image size: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
    
    // Compress image with Sharp
    const compressedBuffer = await sharp(buffer)
      .resize(800, 800, { 
        fit: 'inside', // Keep aspect ratio
        withoutEnlargement: true // Don't upscale small images
      })
      .jpeg({ 
        quality: 80, // Good quality but smaller size
        progressive: true,
        mozjpeg: true // Use mozjpeg encoder for better compression
      })
      .toBuffer();
    
    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    
    console.log(`📸 Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% reduction)`);
    
    return compressedBuffer;
  } catch (error) {
    console.error('Image compression error:', error);
    throw new Error('Failed to compress image');
  }
}

export async function POST(request) {
  console.log('📸 Photo upload request received');
  
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No authorization header');
      return NextResponse.json(
        { error: 'Access denied. Authentication required.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const verification = verifyToken(token);

    if (!verification.valid) {
      console.log('❌ Invalid token');
      return NextResponse.json(
        { error: 'Access denied. Invalid token.' },
        { status: 401 }
      );
    }

    // Check if user has photo_admin role
    const userData = verification.data;
    if (userData.role !== 'photo_admin') {
      console.log('❌ Not photo admin');
      return NextResponse.json(
        { error: 'Access denied. Photo admin privileges required.' },
        { status: 403 }
      );
    }

    console.log('✅ Authentication successful');
    await connectDB();
    console.log('✅ Database connected');
    
    // Parse form data with error handling
    let formData;
    try {
      formData = await request.formData();
      console.log('✅ Form data parsed');
    } catch (formError) {
      console.error('❌ Form data parsing error:', formError);
      return NextResponse.json(
        { error: 'Failed to parse form data. Please try again.' },
        { status: 400 }
      );
    }

    const studentId = formData.get('studentId');
    const photoFile = formData.get('photo');

    console.log('📋 Form data:', {
      studentId,
      photoFile: photoFile ? {
        name: photoFile.name,
        size: photoFile.size,
        type: photoFile.type
      } : 'null'
    });

    if (!studentId || !photoFile) {
      console.log('❌ Missing required fields');
      return NextResponse.json(
        { error: 'Student ID and photo are required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!photoFile.type.startsWith('image/')) {
      console.log('❌ Invalid file type:', photoFile.type);
      return NextResponse.json(
        { error: 'Please upload a valid image file' },
        { status: 400 }
      );
    }

    // Validate file size (50MB max for processing)
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    if (photoFile.size > maxFileSize) {
      console.log('❌ File too large:', photoFile.size);
      return NextResponse.json(
        { error: 'File is too large. Please use a smaller image.' },
        { status: 400 }
      );
    }

    // Find student by ID
    console.log('🔍 Finding student:', studentId);
    const student = await Student.findOne({ studentId });
    if (!student) {
      console.log('❌ Student not found:', studentId);
      return NextResponse.json(
        { error: 'Student not found with this ID' },
        { status: 404 }
      );
    }

    console.log('✅ Student found:', student.name);

    try {
      // Convert file to buffer with error handling
      let bytes, originalBuffer;
      try {
        bytes = await photoFile.arrayBuffer();
        originalBuffer = Buffer.from(bytes);
        console.log('✅ File converted to buffer:', originalBuffer.length, 'bytes');
      } catch (bufferError) {
        console.error('❌ Buffer conversion error:', bufferError);
        return NextResponse.json(
          { error: 'Failed to process image file. Please try again.' },
          { status: 400 }
        );
      }

      const originalSize = originalBuffer.length;
      console.log(`📸 Original image size: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);

      // Check if image needs compression
      const maxSize = 8 * 1024 * 1024; // 8MB - safe limit for Cloudinary free
      let finalBuffer = originalBuffer;

      if (originalSize > maxSize) {
        console.log('📸 Image needs compression...');
        try {
          finalBuffer = await compressImage(originalBuffer, originalSize);
          console.log(`✅ Compression successful: ${(finalBuffer.length / 1024 / 1024).toFixed(2)}MB`);
          
          // Check if still too large after compression
          if (finalBuffer.length > maxSize) {
            console.log('❌ Still too large after compression');
            return NextResponse.json(
              { error: 'Image is too large even after compression. Please use a smaller image.' },
              { status: 400 }
            );
          }
        } catch (compressionError) {
          console.error('❌ Compression failed:', compressionError);
          return NextResponse.json(
            { error: 'Failed to compress image. Please try with a smaller image.' },
            { status: 400 }
          );
        }
      }

      // Convert to base64 for Cloudinary
      const base64String = finalBuffer.toString('base64');
      const dataURI = `data:image/jpeg;base64,${base64String}`;

      console.log(`📸 Uploading to Cloudinary for student: ${studentId} (${(finalBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

      // Upload to Cloudinary with comprehensive error handling
      let uploadResult;
      try {
        uploadResult = await cloudinary.uploader.upload(dataURI, {
          folder: 'college-registration/student-photos',
          public_id: `student_${studentId}_${Date.now()}`,
          transformation: [
            { width: 600, height: 600, crop: 'fill' },
            { quality: 'auto:good' },
            { format: 'jpg' },
            { fetch_format: 'auto' }
          ],
          overwrite: true,
          invalidate: true,
          flags: 'progressive',
          resource_type: 'image',
          timeout: 60000 // 60 second timeout
        });

        console.log(`✅ Cloudinary upload successful: ${uploadResult.secure_url}`);
        console.log(`📊 Final Cloudinary size: ${(uploadResult.bytes / 1024 / 1024).toFixed(2)}MB`);
      } catch (cloudinaryError) {
        console.error('❌ Cloudinary upload error:', cloudinaryError);
        
        // Handle specific Cloudinary errors
        if (cloudinaryError.message?.includes('File size too large')) {
          return NextResponse.json(
            { error: 'Image is too large for upload. Please use a smaller image.' },
            { status: 400 }
          );
        } else if (cloudinaryError.message?.includes('timeout')) {
          return NextResponse.json(
            { error: 'Upload timed out. Please check your connection and try again.' },
            { status: 408 }
          );
        } else if (cloudinaryError.message?.includes('Invalid image')) {
          return NextResponse.json(
            { error: 'Invalid image format. Please use JPG or PNG.' },
            { status: 400 }
          );
        } else {
          return NextResponse.json(
            { error: 'Failed to upload photo. Please try again.' },
            { status: 500 }
          );
        }
      }

      // Generate application number
      const applicationNumber = `APP${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // Update student with Cloudinary URL
      try {
        student.photoUrl = uploadResult.secure_url;
        student.applicationNumber = applicationNumber;
        student.status = 'photo_taken';
        
        await student.save();
        console.log(`✅ Student ${studentId} updated with photo URL`);
      } catch (dbError) {
        console.error('❌ Database update error:', dbError);
        return NextResponse.json(
          { error: 'Photo uploaded but failed to update student record. Please contact admin.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Photo uploaded and optimized successfully!',
        applicationNumber: applicationNumber,
        photoUrl: uploadResult.secure_url,
        optimization: {
          originalSize: `${(originalSize / 1024 / 1024).toFixed(2)}MB`,
          finalSize: `${(uploadResult.bytes / 1024 / 1024).toFixed(2)}MB`,
          compression: originalSize > maxSize ? 'Applied' : 'Not needed',
          dimensions: `${uploadResult.width}x${uploadResult.height}`
        },
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

    } catch (unexpectedError) {
      console.error('❌ Unexpected error in photo processing:', unexpectedError);
      return NextResponse.json(
        { error: 'An unexpected error occurred. Please try again.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Photo upload error:', error);
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
        photoUrl: student.photoUrl, // Clean Cloudinary URL
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