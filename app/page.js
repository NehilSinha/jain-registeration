'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  
  const departments = [
    'Computer Science',
    'Electronics', 
    'Mechanical',
    'Civil',
    'Chemical'
  ];

  // Helper function for navigation
  const navigateTo = (path) => {
    router.push(path);
  };

  return (
    <div className="container">
      <div className="card">
        <h1>College Registration System</h1>
        <p>Welcome to the student registration and management portal</p>
      </div>

      {/* Student Section */}
      <div className="card">
        <h2>For Students</h2>
        <p>New students can register here and check their status.</p>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          {/* OPTION 1: Link with prefetch disabled */}
          <Link 
            href="/student/register" 
            prefetch={false}
            className="btn" 
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            📝 New Student Registration
          </Link>
          
          {/* OPTION 2: Button with router navigation (recommended for admin pages) */}
          {/* 
          <button 
            onClick={() => navigateTo('/student/register')}
            className="btn"
            style={{ padding: '10px 20px', cursor: 'pointer' }}
          >
            📝 New Student Registration
          </button>
          */}
        </div>
      </div>

      {/* Photo Admin Section */}
      <div className="card">
        <h2>Photo Room</h2>
        <p>For photo admin to capture student photos and generate application numbers</p>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          {/* Use button for admin interfaces - no prefetch needed */}
          <button 
            onClick={() => navigateTo('/photo-room')}
            className="btn btn-success"
            style={{ 
              padding: '10px 20px', 
              cursor: 'pointer',
              border: 'none',
              borderRadius: '4px',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            📸 Photo Room Interface
          </button>
        </div>
      </div>

      {/* Department Admin Section */}
      <div className="card">
        <h2>Department Admin</h2>
        <p>For department admins to view and verify student documents</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          {departments.map(dept => (
            /* OPTION 1: Use buttons (recommended - no prefetch at all) */
            <button
              key={dept}
              onClick={() => navigateTo(`/department/${encodeURIComponent(dept)}`)}
              className="btn"
              style={{ 
                padding: '10px 15px',
                cursor: 'pointer',
                border: 'none',
                borderRadius: '4px',
                textAlign: 'center',
                backgroundColor: '#17a2b8',
                color: 'white',
                fontSize: '14px'
              }}
            >
              🏛️ {dept}
            </button>
            
            /* OPTION 2: Links with prefetch disabled */
            /*
            <Link 
              key={dept}
              href={`/department/${encodeURIComponent(dept)}`} 
              prefetch={false}
              className="btn"
              style={{ 
                textDecoration: 'none', 
                display: 'block',
                textAlign: 'center',
                backgroundColor: '#17a2b8',
                padding: '10px 15px'
              }}
            >
              🏛️ {dept}
            </Link>
            */
          ))}
        </div>
      </div>

      {/* Admin Login */}
      <div className="card">
        <h2>System Access</h2>
        <p>Administrative login for photo room and department access</p>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => navigateTo('/admin/login')}
            className="btn"
            style={{ 
              padding: '10px 20px', 
              cursor: 'pointer',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#6c757d',
              color: 'white'
            }}
          >
            🔐 Admin Login
          </button>
        </div>
      </div>

      {/* System Info */}
      <div className="card" style={{ backgroundColor: '#f8f9fa' }}>
        <h3>System Workflow</h3>
        <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <li><strong>Student Registration:</strong> Student fills the registration form and gets a Student ID</li>
          <li><strong>Photo Capture:</strong> Student visits photo room, admin takes photo and generates Application Number</li>
          <li><strong>Document Verification:</strong> Student meets department admin who verifies submitted documents</li>
          <li><strong>Completion:</strong> Once all documents are verified, registration process is complete</li>
        </ol>
        
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#d1ecf1', borderRadius: '5px', fontSize: '14px' }}>
          <strong>💡 Performance Note:</strong> This system is optimized to reduce server costs. 
          Pages load only when you click on them, ensuring fast and efficient operation.
        </div>
      </div>
    </div>
  );
}