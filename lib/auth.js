import jwt from 'jsonwebtoken';

// Verify JWT token
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key');
    return { valid: true, data: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Middleware to protect API routes
export function requireAuth(handler, requiredRole = null) {
  return async (request) => {
    try {
      const authHeader = request.headers.get('authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Access denied. No token provided.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.split(' ')[1];
      const verification = verifyToken(token);

      if (!verification.valid) {
        return new Response(
          JSON.stringify({ error: 'Access denied. Invalid token.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check role if specified
      if (requiredRole && verification.data.role !== requiredRole) {
        return new Response(
          JSON.stringify({ error: 'Access denied. Insufficient permissions.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Add user data to request
      request.user = verification.data;
      
      return handler(request);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

// Client-side auth utility
export const clientAuth = {
  // Get stored token
  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('adminToken');
    }
    return null;
  },

  // Get stored admin data
  getAdminData() {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('adminData');
      return data ? JSON.parse(data) : null;
    }
    return null;
  },

  // Check if logged in
  isLoggedIn() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch (e) {
      return false;
    }
  },

  // Logout
  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
    }
  },

  // Get auth headers for API calls
  getAuthHeaders() {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
};