import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true,
    enum: ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Chemical']
  },
  parentName: {
    type: String,
    required: true
  },
  parentEmail: {
    type: String,
    required: true
  },
  parentPhone: {
    type: String,
    required: true
  },
  dob: {
    type: Date,
    required: true
  },
  photoUrl: {
    type: String,
    default: null
  },
  applicationNumber: {
    type: String,
    default: null
  },
  documentsVerified: [{
    docName: {
      type: String,
      required: true
    },
    verified: {
      type: Boolean,
      default: false
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'photo_taken', 'documents_verified', 'completed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

export default mongoose.models.Student || mongoose.model('Student', StudentSchema);