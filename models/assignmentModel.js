import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String, 
    required: true
  },
  content: {
    type: String,
    required: true
  },
  assignTo:[{
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    username: { type: String, required: true }, 
    avatar: { type: String },
  }],
  assigner: {
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    username: { type: String, required: true }, 
    avatar: { type: String },
  },
  tracking: [{
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    username: { type: String, required: true }, 
    avatar: { type: String },
  }],
  acceptedBy:[{
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    username: { type: String, required: true }, 
    avatar: { type: String },
  }],
  deadline: {
    type: Number,
  },
  completedBy: [{
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    username: { type: String, required: true }, 
    avatar: { type: String },
  }],
  reopenedBy: [{
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    username: { type: String, required: true }, 
    avatar: { type: String },
  }],
  conversationId: {
    type: String,
    required: true
  },
  isPinned: {
    type: Boolean,
    default: false
  }
},{
  timestamps: true  
});

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;