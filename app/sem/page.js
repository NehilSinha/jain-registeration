"use client";
import React, { useState, useEffect } from 'react';

const DepartmentDisplayPage = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [expandedDepts, setExpandedDepts] = useState(new Set());

  // Department list - matches your admin credentials
  const departmentList = [
    { code: 'Computer Science', name: 'Computer Science', admin: 'cs_admin' },
    { code: 'Electronics', name: 'Electronics', admin: 'ec_admin' },
    { code: 'Mechanical', name: 'Mechanical', admin: 'me_admin' },
    { code: 'Civil', name: 'Civil', admin: 'ce_admin' },
    { code: 'Chemical', name: 'Chemical', admin: 'ch_admin' }
  ];

  useEffect(() => {
    fetchAllDepartments();
  }, []);

  const fetchAllDepartments = async () => {
    setLoading(true);
    setError('');
    
    try {
      const departmentData = await Promise.all(
        departmentList.map(async (dept) => {
          try {
            // You'll need to replace this with your actual API call
            // For now, I'm creating mock data based on your API structure
            const response = await fetch(`/api/admin/department/${encodeURIComponent(dept.code)}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}` // Assuming token is stored
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              return {
                ...dept,
                students: data.students || [],
                count: data.count || 0
              };
            } else {
              // If API fails, return department with empty students for display
              return {
                ...dept,
                students: [],
                count: 0,
                error: 'Failed to fetch students'
              };
            }
          } catch (err) {
            return {
              ...dept,
              students: [],
              count: 0,
              error: 'Network error'
            };
          }
        })
      );
      
      setDepartments(departmentData);
    } catch (err) {
      setError('Failed to fetch department data');
      console.error('Error fetching departments:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      'pending': 'status-badge status-pending',
      'documents_verified': 'status-badge status-documents_verified',
      'photo_taken': 'status-badge status-photo_taken',
      'completed': 'status-badge status-completed'
    };
    
    const statusText = {
      'pending': 'Pending',
      'documents_verified': 'Docs Verified',
      'photo_taken': 'Photo Taken',
      'completed': 'Completed'
    };
    
    return (
      <span className={statusClasses[status] || statusClasses['pending']}>
        {statusText[status] || 'Pending'}
      </span>
    );
  };

  const toggleDepartment = (deptCode) => {
    const newExpanded = new Set(expandedDepts);
    if (newExpanded.has(deptCode)) {
      newExpanded.delete(deptCode);
    } else {
      newExpanded.add(deptCode);
    }
    setExpandedDepts(newExpanded);
  };

  const filteredDepartments = departments.filter(dept => {
    if (selectedDepartment !== 'all' && dept.code !== selectedDepartment) {
      return false;
    }
    
    if (searchTerm) {
      return dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             dept.students.some(student => 
               student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               student.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               student.email?.toLowerCase().includes(searchTerm.toLowerCase())
             );
    }
    
    return true;
  });

  const totalStudents = departments.reduce((sum, dept) => sum + dept.count, 0);

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner"></div>
          <p>Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="container">
        <div className="card">
          <div className="header-actions">
            <div>
              <h1>🎓 College Registration Dashboard</h1>
              <p>Overview of all departments and student registrations</p>
            </div>
            <div style={{ 
              background: '#f8f9fa', 
              padding: '8px 16px', 
              borderRadius: '2px',
              border: '1px solid #dee2e6'
            }}>
              <strong>Total Students: {totalStudents}</strong>
            </div>
          </div>

          {/* Filters */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr auto', 
            gap: '16px', 
            marginBottom: '20px',
            paddingBottom: '20px',
            borderBottom: '1px solid #dee2e6'
          }}>
            {/* Search */}
            <div className="form-group" style={{ marginBottom: '0' }}>
              <label htmlFor="search">Search</label>
              <input
                id="search"
                type="text"
                placeholder="Search students, departments, or student IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Department Filter */}
            <div className="form-group" style={{ marginBottom: '0', minWidth: '200px' }}>
              <label htmlFor="department">Filter by Department</label>
              <select
                id="department"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departmentList.map(dept => (
                  <option key={dept.code} value={dept.code}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="alert alert-error">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Departments Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
          gap: '20px',
          marginTop: '20px'
        }}>
          {filteredDepartments.map((dept, index) => {
            // Different background colors for each department
            const departmentColors = [
              { bg: '#f8f9fa', border: '#000000' },
              { bg: '#f1f8e9', border: '#4caf50' },
              { bg: '#f3e5f5', border: '#9c27b0' },
              { bg: '#fff3e0', border: '#ff9800' },
              { bg: '#ffebee', border: '#f44336' }
            ];
            const colorScheme = departmentColors[index % departmentColors.length];
            
            return (
              <div 
                key={dept.code} 
                className="card"
                style={{ 
                  backgroundColor: colorScheme.bg,
                  borderLeft: `4px solid ${colorScheme.border}`,
                  cursor: 'pointer'
                }}
                onClick={() => toggleDepartment(dept.code)}
              >
                {/* Department Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '16px'
                }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ 
                      margin: '0 0 8px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      👥 {dept.name}
                    </h2>
                    <p style={{ margin: '0', color: '#6c757d' }}>
                      {dept.count} students registered
                      {dept.error && (
                        <span style={{ color: '#dc3545', fontSize: '12px', display: 'block' }}>
                          ({dept.error})
                        </span>
                      )}
                    </p>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px'
                  }}>
                    <span style={{
                      background: colorScheme.border,
                      color: '#ffffff',
                      padding: '4px 8px',
                      borderRadius: '2px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {dept.count}
                    </span>
                    <span style={{ fontSize: '18px' }}>
                      {expandedDepts.has(dept.code) ? '👁️‍🗨️' : '👁️'}
                    </span>
                  </div>
                </div>

                {/* Students List */}
                {expandedDepts.has(dept.code) && (
                  <div style={{ 
                    borderTop: '1px solid #dee2e6',
                    marginTop: '16px',
                    paddingTop: '16px'
                  }}>
                    {dept.students.length > 0 ? (
                      <div className="student-list" style={{ 
                        maxHeight: '300px', 
                        overflowY: 'auto',
                        backgroundColor: '#ffffff',
                        border: '1px solid #dee2e6'
                      }}>
                        {dept.students.map((student, studentIndex) => (
                          <div key={student._id || studentIndex} className="student-item">
                            <div className="student-info">
                              <h3>{student.name}</h3>
                              <p><strong>Student ID:</strong> {student.studentId}</p>
                              <p><strong>Email:</strong> {student.email}</p>
                              <p><strong>Phone:</strong> {student.phone}</p>
                              <p><strong>Registration Date:</strong> {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A'}</p>
                              <div style={{ marginTop: '8px' }}>
                                {getStatusBadge(student.status)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '40px',
                        color: '#6c757d',
                        backgroundColor: '#ffffff',
                        border: '1px solid #dee2e6',
                        borderRadius: '2px'
                      }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                        <p>No students registered yet</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredDepartments.length === 0 && (
          <div className="card" style={{ textAlign: 'center', marginTop: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <p>No departments found matching your search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentDisplayPage;