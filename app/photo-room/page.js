'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clientAuth } from '@/lib/auth';

export default function PhotoRoom() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminData, setAdminData] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Check authentication ONLY on mount - no automatic API calls
  useEffect(() => {
    const checkAuth = () => {
      if (!clientAuth.isLoggedIn()) {
        router.push(`/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      const admin = clientAuth.getAdminData();

      if (admin?.role !== 'photo_admin') {
        setMessage('Access denied: You need photo admin privileges to access this page');
        setTimeout(() => {
          router.push('/admin/login');
        }, 3000);
        return;
      }

      setIsAuthenticated(true);
      setAdminData(admin);
    };

    checkAuth();
  }, [router]); // Only run once on mount

  const handleLogout = () => {
    stopCamera();
    clientAuth.logout();
    router.push('/admin/login');
  };

  // ONLY search when user explicitly clicks Search button
  const searchStudent = async () => {
    if (!isAuthenticated) return;

    if (!studentId.trim()) {
      setMessage('Please enter a Student ID');
      return;
    }

    // Prevent multiple simultaneous searches
    if (loading) return;

    setLoading(true);
    setMessage('Searching...');
    setStudent(null);

    try {
      const response = await fetch(`/api/students/photo-upload?studentId=${encodeURIComponent(studentId)}`, {
        headers: {
          'Content-Type': 'application/json',
          ...clientAuth.getAuthHeaders()
        }
      });

      if (response.status === 401) {
        clientAuth.logout();
        router.push('/admin/login');
        return;
      }

      const data = await response.json();

      if (data.success) {
        setStudent(data.student);
        if (data.student.hasPhoto) {
          setMessage('Note: This student already has a photo uploaded');
        } else {
          setMessage('Student found! You can now capture their photo.');
        }
      } else {
        setMessage(data.error || 'Student not found');
      }
    } catch (error) {
      console.error('Search error:', error);
      setMessage('Error searching for student. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key in student ID input
  const handleStudentIdKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchStudent();
    }
  };

  // Camera Functions
  const startCamera = async () => {
    try {
      setMessage('Requesting camera access...');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }

      let mediaStream;

      try {
        // First try: Back camera with specific constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: 'environment' },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          },
          audio: false
        });
      } catch (backCameraError) {
        try {
          // Second try: Front camera
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            },
            audio: false
          });
        } catch (frontCameraError) {
          // Third try: Any available camera
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
        }
      }

      setStream(mediaStream);
      setShowCamera(true);
      setMessage('');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;

        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => {
            console.error('Video play error:', e);
            setMessage('Error starting video preview');
          });
        };

        videoRef.current.onerror = (e) => {
          console.error('Video error:', e);
          setMessage('Video error occurred');
        };
      }

    } catch (error) {
      console.error('Camera error:', error);
      stopCamera();

      let errorMessage = 'Unable to access camera. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera permissions and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Camera not supported on this browser.';
      } else {
        errorMessage += 'Please use file upload instead.';
      }

      setMessage(errorMessage);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
    setMessage('');
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      setMessage('Camera not ready');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'student-photo.jpg', { type: 'image/jpeg' });
        const preview = canvas.toDataURL('image/jpeg', 0.8);

        setCapturedPhoto({
          file: file,
          preview: preview
        });

        stopCamera();
        setMessage('Photo captured successfully!');
      } else {
        setMessage('Failed to capture photo');
      }
    }, 'image/jpeg', 0.8);
  }, [stream]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedPhoto({
          file: file,
          preview: e.target.result
        });
        setMessage('Photo selected successfully!');
      };
      reader.readAsDataURL(file);
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setMessage('');
  };

  // ONLY upload when user explicitly clicks Upload button
  const uploadPhoto = async () => {
    if (!isAuthenticated) return;

    if (!capturedPhoto || !student) {
      setMessage('Please capture/select a photo and verify student details');
      return;
    }

    // Prevent multiple simultaneous uploads
    if (uploading) return;

    setUploading(true);
    setMessage('Uploading photo... Please wait');

    try {
      const formData = new FormData();
      formData.append('studentId', student.studentId);

      let fileToUpload = capturedPhoto.file;

      // If file is too large, try to compress it on client side
      if (fileToUpload.size > 8 * 1024 * 1024) { // 8MB
        setMessage('Photo is large, compressing...');
        try {
          fileToUpload = await compressImageFile(fileToUpload);
        } catch (compressionError) {
          console.error('Compression failed:', compressionError);
          setMessage('Photo too large. Please try with a smaller image.');
          setUploading(false);
          return;
        }
      }

      formData.append('photo', fileToUpload);

      console.log('📸 Uploading photo:', {
        studentId: student.studentId,
        originalSize: capturedPhoto.file.size,
        finalSize: fileToUpload.size,
        type: fileToUpload.type
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch('/api/students/photo-upload', {
        method: 'POST',
        headers: {
          ...clientAuth.getAuthHeaders()
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        clientAuth.logout();
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed with status:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setMessage(`Success! Application Number: ${data.applicationNumber}`);
        setStudent(prev => ({
          ...prev,
          applicationNumber: data.applicationNumber,
          hasPhoto: true,
          status: 'photo_taken'
        }));
        setCapturedPhoto(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setMessage(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);

      if (error.name === 'AbortError') {
        setMessage('Upload timeout. Please check your internet connection and try again.');
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        setMessage('Network error. Please check your internet connection and try again.');
      } else {
        setMessage(`Upload failed: ${error.message}. Please try again.`);
      }
    } finally {
      setUploading(false);
    }
  };

  // Client-side image compression function
  const compressImageFile = (file) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        const maxSize = 1024;
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              console.log(`📸 Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
              resolve(compressedFile);
            } else {
              reject(new Error('Compression failed'));
            }
          },
          'image/jpeg',
          0.8
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const resetForm = () => {
    setStudentId('');
    setStudent(null);
    setCapturedPhoto(null);
    setMessage('');
    stopCamera();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Show loading or redirect message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container">
        <div className="card">
          <h1>Photo Room Access</h1>
          <p>Checking authentication...</p>
          {message && (
            <div className="alert alert-error">
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header-actions">
          <div>
            <h1>Photo Room - Student Photo Capture</h1>
            <p>Enter Student ID to find and capture student photo</p>
            {adminData && (
              <p style={{ fontSize: '14px', color: '#666' }}>
                Logged in as: <strong>{adminData.username}</strong> (Photo Admin)
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleLogout}
              className="btn"
              style={{ backgroundColor: '#dc3545' }}
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {message && (
          <div className={`alert ${message.includes('Success') || message.includes('Application Number') || message.includes('found') ? 'alert-success' : 'alert-error'}`}>
            {message}
          </div>
        )}

        {/* Student ID Search */}
        <div className="form-group">
          <label htmlFor="studentId">Student ID</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              id="studentId"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              onKeyPress={handleStudentIdKeyPress}
              placeholder="Enter Student ID (e.g., 2025123456)"
              style={{ flex: 1, minWidth: '200px' }}
            />
            <button
              onClick={searchStudent}
              disabled={loading}
              className="btn"
              style={{ padding: '12px 20px' }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Student Details */}
        {student && (
          <div className="card" style={{ backgroundColor: '#f8f9fa', margin: '20px 0' }}>
            <h3>Student Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <strong>Name:</strong> {student.name}
              </div>
              <div>
                <strong>Student ID:</strong> {student.studentId}
              </div>
              <div>
                <strong>Department:</strong> {student.department}
              </div>
              <div>
                <strong>Phone:</strong> {student.phone}
              </div>
              <div>
                <strong>Status:</strong>
                <span className={`status-badge status-${student.status}`} style={{ marginLeft: '5px' }}>
                  {student.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              {student.applicationNumber && (
                <div>
                  <strong>Application No:</strong> {student.applicationNumber}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Photo Capture Section */}
        {student && !capturedPhoto && (
          <>
            <h3>Capture Student Photo</h3>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {/* Mobile Camera Capture - Native approach */}
              <div style={{ flex: 1, minWidth: '150px' }}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="mobileCamera"
                />
                <button
                  onClick={() => document.getElementById('mobileCamera')?.click()}
                  className="btn btn-success"
                  style={{ width: '100%', padding: '15px' }}
                >
                  📷 Take Photo (Camera)
                </button>
              </div>

              {/* Regular File Upload */}
              <div style={{ flex: 1, minWidth: '150px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="fileUpload"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn"
                  style={{ width: '100%', padding: '15px' }}
                >
                  📁 Upload from Gallery
                </button>
              </div>
            </div>

            {/* Advanced Camera (for desktop/supported browsers) */}
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={startCamera}
                disabled={showCamera}
                className="btn"
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#17a2b8',
                  opacity: showCamera ? 0.6 : 1
                }}
              >
                🎥 Advanced Camera (Desktop/Some Mobiles)
              </button>
            </div>

            {/* Camera Interface */}
            {showCamera && (
              <div style={{
                backgroundColor: '#000',
                borderRadius: '8px',
                padding: '15px',
                margin: '20px 0',
                textAlign: 'center'
              }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      maxWidth: '400px',
                      height: 'auto',
                      borderRadius: '8px',
                      backgroundColor: '#333'
                    }}
                  />

                  {/* Loading overlay */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'white',
                    fontSize: '16px',
                    display: stream ? 'none' : 'block'
                  }}>
                    Loading camera...
                  </div>
                </div>

                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={capturePhoto}
                    disabled={!stream}
                    className="btn btn-success"
                    style={{
                      padding: '15px 30px',
                      fontSize: '16px',
                      opacity: stream ? 1 : 0.6
                    }}
                  >
                    📸 Capture Photo
                  </button>

                  <button
                    onClick={stopCamera}
                    className="btn"
                    style={{ padding: '15px 30px', fontSize: '16px', backgroundColor: '#6c757d' }}
                  >
                    ❌ Cancel
                  </button>
                </div>

                {/* Debug info */}
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#ccc' }}>
                  {stream ? '✅ Camera active' : '⏳ Starting camera...'}
                </div>
              </div>
            )}

            {/* Hidden canvas for photo capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          </>
        )}

        {/* Photo Preview */}
        {capturedPhoto && (
          <div style={{ margin: '20px 0' }}>
            <h3>Photo Preview</h3>
            <div style={{ textAlign: 'center' }}>
              <img
                src={capturedPhoto.preview}
                alt="Student photo preview"
                style={{
                  maxWidth: '300px',
                  maxHeight: '300px',
                  border: '2px solid #ddd',
                  borderRadius: '8px'
                }}
              />

              <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={uploadPhoto}
                  disabled={uploading}
                  className="btn btn-success"
                  style={{ padding: '12px 24px' }}
                >
                  {uploading ? 'Uploading...' : '✅ Upload & Generate Application Number'}
                </button>

                <button
                  onClick={retakePhoto}
                  className="btn"
                  style={{ padding: '12px 24px', backgroundColor: '#ffc107' }}
                >
                  🔄 Retake Photo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {student && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={resetForm}
              className="btn"
              style={{ padding: '12px 20px', backgroundColor: '#6c757d' }}
            >
              🔄 Process Next Student
            </button>
          </div>
        )}
      </div>
    </div>
  );
}