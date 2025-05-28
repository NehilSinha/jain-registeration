// Simple in-memory cache for fast API responses
class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 30000; // 30 seconds default TTL
  }

  set(key, value, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;
    
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });

    // Auto cleanup after TTL
    setTimeout(() => {
      this.cache.delete(key);
    }, ttl);
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  // Get cache statistics
  stats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries
    };
  }

  // Clean expired entries manually
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Create global cache instance
export const departmentCache = new SimpleCache();

// Cache keys generator
export const CacheKeys = {
  departmentStudents: (dept) => `dept:${dept}:students`,
  studentStatus: (studentId) => `student:${studentId}:status`,
  studentPhoto: (studentId) => `student:${studentId}:photo`
};

// Cache TTL constants (in milliseconds)
export const CacheTTL = {
  DEPARTMENT_STUDENTS: 30000, // 30 seconds
  STUDENT_STATUS: 60000, // 1 minute
  STUDENT_SEARCH: 10000 // 10 seconds
};

// Helper functions
export const CacheHelpers = {
  // Invalidate department cache when student data changes
  invalidateDepartment: (department) => {
    departmentCache.delete(CacheKeys.departmentStudents(department));
    console.log(`🗑️ Cache invalidated for department: ${department}`);
  },

  // Invalidate student cache when status changes
  invalidateStudent: (studentId) => {
    departmentCache.delete(CacheKeys.studentStatus(studentId));
    departmentCache.delete(CacheKeys.studentPhoto(studentId));
    console.log(`🗑️ Cache invalidated for student: ${studentId}`);
  },

  // Get cache hit/miss stats
  getStats: () => {
    const stats = departmentCache.stats();
    console.log(`📊 Cache Stats: ${stats.valid} valid, ${stats.expired} expired, ${stats.total} total`);
    return stats;
  }
};