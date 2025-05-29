'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentRegister() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [studentData, setStudentData] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const hasInitialized = useRef(false); // Prevent multiple initializations
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    department: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    dob: ''
  });

  const departments = [
    'Computer Science',
    'Electronics',
    'Mechanical',
    'Civil',
    'Chemical'
  ];

  // ONLY check localStorage ONCE on mount - NO API CALLS
  useEffect(() => {
    // Prevent multiple initializations (React StrictMode protection)
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    try {
      const savedStudentData = JSON.parse(localStorage.getItem('studentRegistration') || 'null');
      
      if (savedStudentData) {
        console.log('Found saved data - NO API CALL');
        setStudentData(savedStudentData);
        setMessage('Welcome back! Your registration details are shown below.');
      }
    } catch (error) {
      console.error('localStorage error:', error);
      localStorage.removeItem('studentRegistration');
    }
  }, []); // Empty deps - runs exactly once

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const requiredFields = [
      { key: 'name', label: 'Full Name' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'email', label: 'Email Address' },
      { key: 'department', label: 'Department' },
      { key: 'dob', label: 'Date of Birth' },
      { key: 'parentName', label: 'Parent Name' },
      { key: 'parentEmail', label: 'Parent Email' },
      { key: 'parentPhone', label: 'Parent Phone' }
    ];

    for (let field of requiredFields) {
      if (!formData[field.key] || formData[field.key].trim() === '') {
        return `Please fill in: ${field.label}`;
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }
    if (!emailRegex.test(formData.parentEmail)) {
      return 'Please enter a valid parent email address';
    }

    if (formData.phone.length < 10) {
      return 'Please enter a valid phone number';
    }
    if (formData.parentPhone.length < 10) {
      return 'Please enter a valid parent phone number';
    }

    return null;
  };

  // ONLY API call when user explicitly submits registration
  const handleRegistration = async () => {
    // Prevent multiple submissions
    if (loading) return;

    console.log('🚀 REGISTRATION API CALL - User initiated');

    const validationError = validateForm();
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setLoading(true);
    setMessage('Processing registration...');

    try {
      const response = await fetch('/api/students/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Registration failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const registrationData = {
          name: data.data.name,
          studentId: data.studentId,
          department: data.data.department,
          status: 'pending',
          hasPhoto: false,
          applicationNumber: null,
          registrationDate: new Date().toISOString()
        };

        localStorage.setItem('studentRegistration', JSON.stringify(registrationData));
        setStudentData(registrationData);
        setMessage('Registration successful! 🎉');
        
      } else {
        setMessage(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ONLY API call when user explicitly clicks "Check for Updates"
  const checkStudentStatus = async () => {
    if (!studentData?.studentId || checkingStatus) return;

    console.log('🔄 STATUS CHECK API CALL - User initiated');

    setCheckingStatus(true);
    setMessage('Checking for updates...');

    try {
      const response = await fetch('/api/students/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId: studentData.studentId }),
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const updatedData = {
          name: data.student.name,
          studentId: data.student.studentId,
          department: data.student.department,
          status: data.student.status,
          hasPhoto: data.student.hasPhoto,
          applicationNumber: data.student.applicationNumber,
          registrationDate: data.student.registrationDate
        };
        
        localStorage.setItem('studentRegistration', JSON.stringify(updatedData));
        setStudentData(updatedData);
        setMessage('Status updated! 🎉');
      } else {
        setMessage(data.error || 'No updates found');
      }
    } catch (error) {
      console.error('Status check error:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setCheckingStatus(false);
    }
  };

  const clearRegistration = () => {
    if (confirm('Clear your registration data? This cannot be undone.')) {
      localStorage.removeItem('studentRegistration');
      setStudentData(null);
      setMessage('Registration data cleared');
    }
  };

  const getStatusMessage = () => {
    if (!studentData) return '';
    
    switch (studentData.status) {
      case 'pending':
        return 'Next step: Visit the photo room with your Student ID';
      case 'photo_taken':
        return 'Next step: Visit your department admin for document verification';
      case 'documents_verified':
        return 'Registration complete! ✅ All steps finished.';
      default:
        return 'Contact administration for status update';
    }
  };

  const getDisplayId = () => {
    if (!studentData) return { label: '', value: '' };
    
    if (studentData.applicationNumber) {
      return {
        label: 'Application Number',
        value: studentData.applicationNumber
      };
    } else {
      return {
        label: 'Student ID',
        value: studentData.studentId
      };
    }
  };

  // Show student dashboard if registered
  if (studentData) {
    const displayId = getDisplayId();
    
    return (
      <div className="container">
        <div className="card">
          <h1>Your Registration Status</h1>
          
          {message && (
            <div className={`alert ${message.includes('successful') || message.includes('Welcome') || message.includes('updated') ? 'alert-success' : 'alert-error'}`}>
              {message}
            </div>
          )}

          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <h2>Welcome, {studentData.name}!</h2>
            
            <div style={{ 
              background: '#f8f9fa', 
              padding: '20px', 
              borderRadius: '8px', 
              margin: '20px 0',
              border: '2px solid #3498db'
            }}>
              <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>
                Your {displayId.label}
              </h3>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                color: '#3498db',
                fontFamily: 'monospace',
                letterSpacing: '1px',
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                wordBreak: 'break-all'
              }}>
                {displayId.value}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p><strong>Department:</strong> {studentData.department}</p>
              <p><strong>Status:</strong> 
                <span 
                  className={`status-badge status-${studentData.status}`}
                  style={{ marginLeft: '5px' }}
                >
                  {studentData.status.replace('_', ' ').toUpperCase()}
                </span>
              </p>
              <p><strong>Registered:</strong> {new Date(studentData.registrationDate).toLocaleDateString()}</p>
            </div>

            <div className="alert alert-success">
              <strong>{getStatusMessage()}</strong>
            </div>

            {studentData.applicationNumber && (
              <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
                <p>Original Student ID: {studentData.studentId}</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '30px' }}>
            <button 
              onClick={checkStudentStatus}
              disabled={checkingStatus}
              className="btn btn-success"
              style={{ minWidth: '140px' }}
            >
              {checkingStatus ? 'Checking...' : '🔄 Check for Updates'}
            </button>
            
            <button 
              onClick={() => router.push('/')}
              className="btn"
              style={{ backgroundColor: '#6c757d', minWidth: '120px' }}
            >
              🏠 Home
            </button>

            <button 
              onClick={clearRegistration}
              className="btn"
              style={{ backgroundColor: '#dc3545', minWidth: '120px' }}
            >
              🗑️ Clear Data
            </button>
          </div>

          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '5px', fontSize: '14px', color: '#6c757d' }}>
            <strong>💡 Tip:</strong> Bookmark this page! Your registration data is saved locally. 
            Click "Check for Updates" whenever you complete a step to see your progress.
          </div>
        </div>
      </div>
    );
  }

  // Show registration form
  return (
    <div className="container">
      <div className="card">
        <h1>Student Registration</h1>
        <p>Please fill in all details for your college registration</p>
        
        {message && (
          <div className={`alert ${message.includes('successful') ? 'alert-success' : 'alert-error'}`}>
            {message}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleRegistration(); }}>
          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
              style={{ fontSize: '16px' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="10-digit phone number"
              required
              style={{ fontSize: '16px' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your.email@example.com"
              required
              style={{ fontSize: '16px' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="department">Department *</label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              style={{ fontSize: '16px' }}
            >
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="dob">Date of Birth *</label>
            <input
              type="date"
              id="dob"
              name="dob"
              value={formData.dob}
              onChange={handleChange}
              required
              style={{ fontSize: '16px' }}
            />
          </div>

          <h3 style={{ marginTop: '30px', marginBottom: '20px' }}>Parent Information</h3>

          <div className="form-group">
            <label htmlFor="parentName">Parent Name *</label>
            <input
              type="text"
              id="parentName"
              name="parentName"
              value={formData.parentName}
              onChange={handleChange}
              placeholder="Parent's full name"
              required
              style={{ fontSize: '16px' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="parentEmail">Parent Email *</label>
            <input
              type="email"
              id="parentEmail"
              name="parentEmail"
              value={formData.parentEmail}
              onChange={handleChange}
              placeholder="parent.email@example.com"
              required
              style={{ fontSize: '16px' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="parentPhone">Parent Phone *</label>
            <input
              type="tel"
              id="parentPhone"
              name="parentPhone"
              value={formData.parentPhone}
              onChange={handleChange}
              placeholder="Parent's phone number"
              required
              style={{ fontSize: '16px' }}
            />
          </div>

          <div style={{ marginTop: '30px', textAlign: 'center' }}>
            <button 
              type="submit"
              disabled={loading}
              className="btn"
              style={{ 
                width: '100%', 
                fontSize: '18px', 
                padding: '15px',
                minHeight: '50px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Processing Registration...' : 'Complete Registration'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px', fontSize: '14px', color: '#6c757d' }}>
          <strong>📱 Mobile Friendly:</strong> This form works on all devices. 
          Your progress will be saved automatically after registration.
        </div>
      </div>
    </div>
  );
}