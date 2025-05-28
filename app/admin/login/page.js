'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Separate component that uses useSearchParams
function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || '/';
  const department = searchParams?.get('department');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          // Token is still valid, redirect
          router.push(redirectTo);
          return;
        }
      } catch (e) {
        // Invalid token, remove it
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
      }
    }
  }, [router, redirectTo]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          department: department
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Store token and admin data
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminData', JSON.stringify(data.admin));
        
        setMessage('Login successful! Redirecting...');
        
        // Redirect after short delay
        setTimeout(() => {
          router.push(redirectTo);
        }, 1000);
        
      } else {
        setMessage(data.error || 'Login failed');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDepartmentInfo = () => {
    if (department) {
      return {
        title: `${department} Department Admin Login`,
        description: `Access ${department} department student management`
      };
    }
    return {
      title: 'Admin Login',
      description: 'Access admin dashboard'
    };
  };

  const { title, description } = getDepartmentInfo();

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '400px', margin: '50px auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1>{title}</h1>
          <p style={{ color: '#666' }}>{description}</p>
          {department && (
            <div style={{ 
              backgroundColor: '#e7f3ff', 
              padding: '10px', 
              borderRadius: '4px',
              marginTop: '15px',
              border: '1px solid #b8daff'
            }}>
              <strong>Department:</strong> {department}
            </div>
          )}
        </div>
        
        {message && (
          <div className={`alert ${message.includes('successful') ? 'alert-success' : 'alert-error'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Admin Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter admin username"
              required
              autoComplete="username"
              style={{ fontSize: '16px' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password"
                required
                autoComplete="current-password"
                style={{ fontSize: '16px', paddingRight: '50px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn"
            disabled={loading}
            style={{ width: '100%', marginTop: '20px' }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Demo Credentials Info */}
        <div style={{ 
          marginTop: '30px', 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666'
        }}>
          <strong>Demo Credentials:</strong>
          <ul style={{ marginTop: '5px', paddingLeft: '15px' }}>
            <li><strong>CS Admin:</strong> cs_admin / CS@2025!SecurePass</li>
            <li><strong>EC Admin:</strong> ec_admin / EC@2025!SecurePass</li>
            <li><strong>ME Admin:</strong> me_admin / ME@2025!SecurePass</li>
            <li><strong>CE Admin:</strong> ce_admin / CE@2025!SecurePass</li>
            <li><strong>CH Admin:</strong> ch_admin / CH@2025!SecurePass</li>
            <li><strong>Photo Admin:</strong> photo_admin / PHOTO@2025!SecurePass</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button 
            onClick={() => router.push('/')}
            className="btn"
            style={{ backgroundColor: '#6c757d', padding: '8px 16px' }}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

// Main component with Suspense wrapper
export default function AdminLogin() {
  return (
    <Suspense fallback={
      <div className="container">
        <div className="card" style={{ maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
          <div>Loading admin login...</div>
        </div>
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  );
}