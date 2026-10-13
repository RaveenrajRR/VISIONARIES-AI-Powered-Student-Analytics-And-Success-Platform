import mongoose, { Schema } from 'mongoose';

const options = { timestamps: true, strict: true };

export const MentorProfile = mongoose.model('MentorProfile', new Schema({
  ownerUserId: { type: Schema.Types.ObjectId, required: true, index: true },
  ownerRole: { type: String, enum: ['faculty', 'student'], required: true },
  studentId: { type: String, index: true },
  department: { type: String, required: true, index: true },
  expertise: { type: [String], default: [] },
  availability: { type: [String], default: [] },
  topics: { type: [String], default: [] },
  capacity: { type: Number, default: 1, min: 1, max: 100 },
  acceptingRequests: { type: Boolean, default: true },
}, options));

export const MentorshipRequest = mongoose.model('MentorshipRequest', new Schema({
  profileId: { type: Schema.Types.ObjectId, required: true, index: true },
  mentorUserId: { type: Schema.Types.ObjectId, required: true, index: true },
  requesterStudentId: { type: String, required: true, index: true },
  department: { type: String, required: true, index: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
}, options));

export const LearningProfile = mongoose.model('LearningProfile', new Schema({
  studentId: { type: String, required: true, unique: true, index: true },
  department: { type: String, required: true, index: true },
  topics: { type: [String], default: [] },
  availability: { type: [String], default: [] },
  discoverable: { type: Boolean, default: true },
}, options));

export const LearningInvitation = mongoose.model('LearningInvitation', new Schema({
  senderStudentId: { type: String, required: true, index: true },
  receiverStudentId: { type: String, required: true, index: true },
  department: { type: String, required: true, index: true },
  message: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
}, options));

export const LearningGroup = mongoose.model('LearningGroup', new Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  ownerStudentId: { type: String, required: true, index: true },
  memberStudentIds: { type: [String], default: [] },
  department: { type: String, required: true, index: true },
  topics: { type: [String], default: [] },
}, options));

export const Certificate = mongoose.model('Certificate', new Schema({
  studentId: { type: String, required: true, index: true },
  department: { type: String, required: true, index: true },
  title: { type: String, required: true },
  issuer: { type: String },
  issuedAt: { type: Date },
  originalFileName: { type: String, required: true },
  contentType: { type: String, enum: ['application/pdf', 'image/png', 'image/jpeg'], required: true },
  size: { type: Number, required: true },
  storageName: { type: String, required: true, select: false },
  reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewerUserId: { type: Schema.Types.ObjectId },
  reviewedAt: { type: Date },
  reviewNote: { type: String },
}, options));

export const Scholarship = mongoose.model('Scholarship', new Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  departments: { type: [String], default: [] },
  minimumYear: { type: Number },
  maximumYear: { type: Number },
  requiredDocuments: { type: [String], default: [] },
  metrics: {
    type: [new Schema({
      key: { type: String, required: true },
      minimum: { type: Number },
      maximum: { type: Number },
    }, { _id: false, strict: true })], default: []
  },
}, options));

export const ScholarshipApplication = mongoose.model('ScholarshipApplication', new Schema({
  scholarshipId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: String, required: true, index: true },
  department: { type: String, required: true, index: true },
  eligible: { type: Boolean, required: true },
  missingCriteria: { type: [String], default: [] },
  missingDocuments: { type: [String], default: [] },
  supportingDocuments: {
    type: [new Schema({
      certificateId: { type: Schema.Types.ObjectId, required: true },
      title: { type: String, required: true },
      originalFileName: { type: String, required: true },
      reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected'], required: true },
    }, { _id: false, strict: true })], default: []
  },
  status: { type: String, enum: ['submitted', 'under_review', 'approved', 'rejected'], default: 'submitted', index: true },
  reviewerUserId: { type: Schema.Types.ObjectId },
  reviewedAt: { type: Date },
  reviewNote: { type: String },
}, options).index({ scholarshipId: 1, studentId: 1 }, { unique: true }));

export const Course = mongoose.model('Course', new Schema({
  code: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
  title: { type: String, required: true },
  department: { type: String, required: true, index: true },
  credits: { type: Number, required: true, min: 0.5, max: 30 },
  prerequisites: { type: [String], default: [] },
  teaches: { type: [String], default: [] },
  description: { type: String, default: '' },
}, options));

export const RoleCatalog = mongoose.model('RoleCatalog', new Schema({
  roleId: { type: String, required: true, unique: true, index: true, trim: true },
  title: { type: String, required: true, trim: true },
  department: { type: String, index: true },
  requiredSkills: { type: [String], default: [] },
  interests: { type: [String], default: [] },
  milestones: { type: [String], default: [] },
  active: { type: Boolean, default: true, index: true },
}, options));

export const ResumeDocument = mongoose.model('ResumeDocument', new Schema({
  studentId: { type: String, required: true, index: true },
  department: { type: String, required: true, index: true },
  roleId: { type: String, required: true },
  originalFileName: { type: String, required: true },
  contentType: { type: String, enum: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], required: true },
  size: { type: Number, required: true },
  storageName: { type: String, required: true, select: false },
  analysis: { type: Schema.Types.Mixed, required: true },
}, options));

export const StudentSkillProfile = mongoose.model('StudentSkillProfile', new Schema({
  studentId: { type: String, required: true, unique: true, index: true },
  selfReportedSkills: { type: [String], default: [] },
  interests: { type: [String], default: [] },
}, options));
