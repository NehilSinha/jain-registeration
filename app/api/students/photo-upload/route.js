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

    try {
      // Convert file to buffer
      const bytes = await photoFile.arrayBuffer();
      const originalBuffer = Buffer.from(bytes);
      const originalSize = originalBuffer.length;

      // Check if image needs compression
      const maxSize = 8 * 1024 * 1024; // 8MB - safe limit for Cloudinary free
      let finalBuffer = originalBuffer;

      if (originalSize > maxSize) {
        console.log(`📸 Image too large (${(originalSize / 1024 / 1024).toFixed(2)}MB), compressing...`);
        finalBuffer = await compressImage(originalBuffer, originalSize);
        
        // Check if still too large after compression
        if (finalBuffer.length > maxSize) {
          return NextResponse.json(
            { error: 'Image is too large even after compression. Please use a smaller image.' },
            { status: 400 }
          );
        }
      }

      // Convert to base64 for Cloudinary
      const base64String = finalBuffer.toString('base64');
      const dataURI = `data:image/jpeg;base64,${base64String}`;

      console.log(`📸 Uploading photo for student: ${studentId} (${(finalBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

      // Upload to Cloudinary with aggressive optimization
      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: 'college-registration/student-photos',
        public_id: `student_${studentId}_${Date.now()}`,
        transformation: [
          { width: 600, height: 600, crop: 'fill' }, // Resize to 600x600
          { quality: 'auto:good' }, // Auto-optimize quality
          { format: 'jpg' }, // Convert to JPG
          { fetch_format: 'auto' } // Use best format for browser
        ],
        overwrite: true,
        invalidate: true,
        // Additional compression settings
        flags: 'progressive',
        resource_type: 'image'
      });

      console.log(`✅ Cloudinary upload successful: ${uploadResult.secure_url}`);
      console.log(`📊 Final Cloudinary size: ${(uploadResult.bytes / 1024 / 1024).toFixed(2)}MB`);

      // Generate application number
      const applicationNumber = `APP${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // Update student with Cloudinary URL
      student.photoUrl = uploadResult.secure_url;
      student.applicationNumber = applicationNumber;
      student.status = 'photo_taken';
      
      await student.save();

      console.log(`✅ Student ${studentId} updated with compressed photo URL`);

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

    } catch (cloudinaryError) {
      console.error('Cloudinary upload error:', cloudinaryError);
      
      // Provide specific error messages
      if (cloudinaryError.message?.includes('File size too large')) {
        return NextResponse.json(
          { error: 'Image is too large. Please use a smaller image or compress it before uploading.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to upload photo. Please try again with a smaller image.' },
        { status: 500 }
      );
    }

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