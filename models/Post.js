const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  publicId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  collegeCode: {
    type: String,
    required: true,
    index: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['notes', 'project', 'achievement', 'college', 'text', 'image', 'video'],
    default: 'text'
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  images: [{
    type: String
  }],
  pdfUrl: {
    type: String
  },
  pdfName: {
    type: String
  },
  pdfSize: {
    type: String
  },
  category: {
    type: String,
    enum: ['project', 'hackathon', 'internship', 'placement', 'notes', 'achievement', 'certificate', 'question', 'announcement', 'text'],
    default: 'text'
  },
  hashtags: [{
    type: String
  }],
  subjectTags: [{
    type: String
  }],
  location: {
    type: String
  },
  fileUrl: String,
  fileName: String,
  fileSize: String,
  link: String,
  tag: String,
  allowLikes: {
    type: Boolean,
    default: true
  },
  allowComments: {
    type: Boolean,
    default: true
  },
  allowShares: {
    type: Boolean,
    default: true
  },
  visibility: {
    type: String,
    enum: ['public', 'friends_only'],
    default: 'public'
  },
  hideLikeCount: {
    type: Boolean,
    default: false
  },
  hideCommentsCount: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);
