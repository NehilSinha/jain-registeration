import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable in .env.local');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  // Return existing connection immediately
  if (cached.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  // Clear cached connection if it's disconnected
  if (cached.conn && cached.conn.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const opts = {
      // Performance Optimizations
      bufferCommands: false, // Disable mongoose buffering
      
      // Connection Pool Optimizations
      maxPoolSize: 25, // Increase connection pool size for high traffic
      minPoolSize: 5, // Maintain minimum connections
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      
      // Connection Timeouts
      serverSelectionTimeoutMS: 10000, // How long to try selecting a server
      socketTimeoutMS: 45000, // How long a send or receive on a socket can take
      connectTimeoutMS: 10000, // How long to wait for initial connection
      
      // Heartbeat and Keep-Alive
      heartbeatFrequencyMS: 10000, // Heartbeat every 10 seconds
      
      // Compression for Network Performance
      compressors: ['zlib'],
      
      // Retries for Reliability
      retryWrites: true,
      retryReads: true
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ MongoDB connected with performance optimizations');
      console.log(`📊 Connection pool: ${opts.maxPoolSize} max, ${opts.minPoolSize} min`);
      console.log(`⚡ Compression: ${opts.compressors.join(', ')}`);
      console.log(`🔧 Buffer commands: ${opts.bufferCommands}`);
      
      // Set up connection event listeners for monitoring
      mongoose.connection.on('connected', () => {
        console.log('🟢 MongoDB connection established');
      });
      
      mongoose.connection.on('error', (err) => {
        console.error('🔴 MongoDB connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.log('🟡 MongoDB disconnected');
        // Clear cache on disconnect
        cached.conn = null;
        cached.promise = null;
      });
      
      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
      });

      // Optimize Mongoose settings for performance
      mongoose.set('strictQuery', false); // Faster queries
      
      return mongoose;
    }).catch((error) => {
      console.error('❌ MongoDB connection failed:', error.message);
      cached.promise = null;
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
    
    // Verify connection is ready
    if (cached.conn.connection.readyState !== 1) {
      throw new Error('MongoDB connection not ready');
    }
    
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    console.error('💥 MongoDB connection error:', e);
    throw e;
  }

  return cached.conn;
}

// Optimized query helper functions
export const QueryOptimizer = {
  // Optimize queries with lean() for better performance
  lean: true,
  
  // Common projection for student queries (exclude heavy fields)
  studentProjection: {
    photoUrl: 0, // Exclude photo data by default
    __v: 0 // Exclude version key
  },
  
  // Lightweight student projection for lists
  studentListProjection: {
    name: 1,
    studentId: 1,
    department: 1,
    status: 1,
    applicationNumber: 1,
    createdAt: 1,
    phone: 1
  },
  
  // Common sort options
  sortOptions: {
    recent: { createdAt: -1 },
    alphabetical: { name: 1 },
    status: { status: 1, createdAt: -1 }
  }
};

// Connection health check function
export async function checkConnection() {
  try {
    const conn = await connectDB();
    const isConnected = conn.connection.readyState === 1;
    
    return {
      connected: isConnected,
      readyState: conn.connection.readyState,
      host: conn.connection.host,
      port: conn.connection.port,
      name: conn.connection.name
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
}

// Graceful shutdown function
export async function closeConnection() {
  if (cached.conn) {
    await cached.conn.connection.close();
    cached.conn = null;
    cached.promise = null;
    console.log('🔌 MongoDB connection closed gracefully');
  }
}

// Performance monitoring
export function getConnectionStats() {
  if (!cached.conn) return null;
  
  const db = cached.conn.connection.db;
  return {
    readyState: cached.conn.connection.readyState,
    host: cached.conn.connection.host,
    port: cached.conn.connection.port,
    name: cached.conn.connection.name,
    collections: Object.keys(cached.conn.connection.collections).length
  };
}

export default connectDB;