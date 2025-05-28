import Link from 'next/link';

export default function Home() {
  const departments = [
    'Computer Science',
    'Electronics', 
    'Mechanical',
    'Civil',
    'Chemical'
  ];

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
          <Link href="/student/register" className="btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
            📝 New Student Registration
          </Link>
        </div>
      </div>

      {/* Photo Admin Section */}
      <div className="card">
        <h2>Photo Room</h2>
        <p>For photo admin to capture student photos and generate application numbers</p>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <Link href="/photo-room" className="btn btn-success" style={{ textDecoration: 'none', display: 'inline-block' }}>
            📸 Photo Room Interface
          </Link>
        </div>
      </div>

      {/* Department Admin Section */}
      <div className="card">
        <h2>Department Admin</h2>
        <p>For department admins to view and verify student documents</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          {departments.map(dept => (
            <Link 
              key={dept}
              href={`/department/${encodeURIComponent(dept)}`} 
              className="btn"
              style={{ 
                textDecoration: 'none', 
                display: 'block',
                textAlign: 'center',
                backgroundColor: '#17a2b8'
              }}
            >
              🏛️ {dept}
            </Link>
          ))}
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
      </div>
    </div>
  );
}