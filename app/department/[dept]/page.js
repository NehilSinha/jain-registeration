'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { clientAuth } from '@/lib/auth';

export default function DepartmentAdmin() {
  const params = useParams();
  const router = useRouter();
  const department = params?.dept ? decodeURIComponent(params.dept) : '';
  
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [studentsLoaded, setStudentsLoaded] = useState(false); // Track if students are loaded

  // Check authentication ONLY on mount - no automatic API calls
  useEffect(() => {
    const checkAuth = () => {
      if (!clientAuth.isLoggedIn()) {
        router.push(`/admin/login?redirect=${encodeURIComponent(window.location.pathname)}&department=${encodeURIComponent(department)}`);
        return;
      }

      const admin = clientAuth.getAdminData();
      
      if (admin?.role === 'department_admin' && admin?.department !== department) {
        setMessage('Access denied: You are not authorized for this department');
        setTimeout(() => {
          router.push('/admin/login');
        }, 3000);
        return;
      }

      setIsAuthenticated(true);
      setAdminData(admin);
    };

    checkAuth();
  }, [department, router]); // Only run when department or router changes

  // ONLY fetch students when user explicitly requests it
  const fetchStudents = async () => {
    if (!isAuthenticated) return;
    
    // Prevent multiple simultaneous requests
    if (loading) return;
    
    setLoading(true);
    setMessage('Loading students...');
    
    try {
      const response = await fetch(`/api/department/${encodeURIComponent(department)}`, {
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
        setStudents(data.students);
        setStudentsLoaded(true);
        setMessage(`Found ${data.count} students in ${department} department`);
      } else {
        setMessage(data.error || 'Failed to fetch students');
        setStudents([]);
      }
    } catch (error) {
      console.error('Fetch students error:', error);
      setMessage('Network error. Please try again.');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load students only once when authenticated (optional - you can remove this)
  useEffect(() => {
    if (isAuthenticated && !studentsLoaded) {
      fetchStudents();
    }
  }, [isAuthenticated]); // Only run once when authenticated

  const handleLogout = () => {
    clientAuth.logout();
    router.push('/admin/login');
  };

  // Filter students based on search (client-side filtering - no API call)
  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentId.includes(searchTerm) ||
    (student.applicationNumber && student.applicationNumber.includes(searchTerm))
  );

  // Open student details modal (no API call)
  const openStudentDetails = (student) => {
    setSelectedStudent({
      ...student,
      documentsVerified: [...student.documentsVerified] // Create copy for editing
    });
  };

  // Handle document verification toggle (client-side only)
  const toggleDocumentVerification = (docIndex) => {
    setSelectedStudent(prev => ({
      ...prev,
      documentsVerified: prev.documentsVerified.map((doc, index) => 
        index === docIndex ? { ...doc, verified: !doc.verified } : doc
      )
    }));
  };

  // ONLY update when user explicitly clicks "Update Documents"
  const updateStudentDocuments = async () => {
    if (!selectedStudent) return;
    
    // Prevent multiple simultaneous updates
    if (loading) return;
    
    setLoading(true);
    setMessage('Updating documents...');
    
    try {
      const response = await fetch(`/api/department/${encodeURIComponent(department)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...clientAuth.getAuthHeaders()
        },
        body: JSON.stringify({
          studentId: selectedStudent.studentId,
          documentsVerified: selectedStudent.documentsVerified
        }),
      });

      if (response.status === 401) {
        clientAuth.logout();
        router.push('/admin/login');
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        setMessage('Student documents updated successfully!');
        setSelectedStudent(null);
        
        // Update the student in the local state instead of refetching all students
        setStudents(prev => prev.map(student => 
          student.studentId === selectedStudent.studentId 
            ? { ...student, documentsVerified: selectedStudent.documentsVerified, status: data.newStatus || student.status }
            : student
        ));
      } else {
        setMessage(data.error || 'Failed to update documents');
      }
    } catch (error) {
      console.error('Update error:', error);
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return '#ffc107';
      case 'photo_taken': return '#17a2b8';
      case 'documents_verified': return '#28a745';
      case 'completed': return '#6f42c1';
      default: return '#6c757d';
    }
  };

  // Show loading or redirect message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container">
        <div className="card">
          <h1>Department Admin Access</h1>
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

  if (!department) {
    return (
      <div className="container">
        <div className="card">
          <h1>Department Admin</h1>
          <p>Invalid department specified.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header-actions">
          <div>
            <h1>{department} Department Admin</h1>
            <p>Manage student registrations and document verification</p>
            {adminData && (
              <p style={{ fontSize: '14px', color: '#666' }}>
                Logged in as: <strong>{adminData.username}</strong>
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={fetchStudents} 
              disabled={loading}
              className="btn btn-refresh"
            >
              {loading ? 'Loading...' : '🔄 Refresh Students'}
            </button>
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
          <div className={`alert ${message.includes('successfully') || message.includes('Found') ? 'alert-success' : 'alert-error'}`}>
            {message}
          </div>
        )}

        {/* Only show content if students are loaded */}
        {studentsLoaded && (
          <>
            {/* Search Bar */}
            <div className="form-group">
              <label htmlFor="search">Search Students</label>
              <input
                type="text"
                id="search"
                placeholder="Search by name, Student ID, or Application Number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <small style={{ color: '#666', fontSize: '12px' }}>
                Searching {students.length} loaded students
              </small>
            </div>

            {/* Students List */}
            <div className="student-list">
              {filteredStudents.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  {students.length === 0 ? 'No students found for this department' : 'No students match your search'}
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div key={student._id} className="student-item">
                    <div className="student-info">
                      <h3>{student.name}</h3>
                      <p><strong>Student ID:</strong> {student.studentId}</p>
                      <p><strong>Phone:</strong> {student.phone}</p>
                      {student.applicationNumber && (
                        <p><strong>Application No:</strong> {student.applicationNumber}</p>
                      )}
                      <p><strong>Registration:</strong> {new Date(student.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div 
                        className="status-badge"
                        style={{ 
                          backgroundColor: getStatusColor(student.status),
                          color: 'white',
                          marginBottom: '10px'
                        }}
                      >
                        {student.status.replace('_', ' ').toUpperCase()}
                      </div>
                      <br />
                      <button 
                        onClick={() => openStudentDetails(student)}
                        className="btn"
                        style={{ padding: '8px 16px', fontSize: '14px' }}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Show load button if students not loaded yet */}
        {!studentsLoaded && !loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <button 
              onClick={fetchStudents}
              className="btn btn-success"
              style={{ padding: '15px 30px', fontSize: '16px' }}
            >
              📚 Load Students
            </button>
            <p style={{ marginTop: '10px', color: '#666' }}>
              Click to load students for {department} department
            </p>
          </div>
        )}
      </div>

      {/* Student Details Modal */}
      {selectedStudent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ 
            maxWidth: '600px', 
            maxHeight: '80vh', 
            overflow: 'auto',
            margin: '20px'
          }}>
            <h2>{selectedStudent.name} - Document Verification</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <p><strong>Student ID:</strong> {selectedStudent.studentId}</p>
              <p><strong>Email:</strong> {selectedStudent.email}</p>
              <p><strong>Phone:</strong> {selectedStudent.phone}</p>
              <p><strong>DOB:</strong> {new Date(selectedStudent.dob).toLocaleDateString()}</p>
              {selectedStudent.applicationNumber && (
                <p><strong>Application Number:</strong> {selectedStudent.applicationNumber}</p>
              )}
            </div>

            <h3>Document Verification</h3>
            <div style={{ marginBottom: '20px' }}>
              {selectedStudent.documentsVerified.map((doc, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '10px',
                  backgroundColor: doc.verified ? '#d4edda' : '#f8f9fa',
                  marginBottom: '5px',
                  borderRadius: '4px'
                }}>
                  <input
                    type="checkbox"
                    checked={doc.verified}
                    onChange={() => toggleDocumentVerification(index)}
                    style={{ marginRight: '10px' }}
                  />
                  <label style={{ flex: 1, margin: 0 }}>
                    {doc.docName}
                  </label>
                  <span style={{ 
                    fontSize: '12px',
                    color: doc.verified ? '#155724' : '#856404'
                  }}>
                    {doc.verified ? '✓ Verified' : '⏳ Pending'}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={updateStudentDocuments}
                disabled={loading}
                className="btn btn-success"
                style={{ flex: 1 }}
              >
                {loading ? 'Updating...' : 'Update Documents'}
              </button>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="btn"
                style={{ backgroundColor: '#6c757d' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}