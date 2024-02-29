import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  createdBy: {
    username: {
      type: String,
      required: true
    },
    avatar: {
      type: String,
      required: true
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  },
  isPinned: {
    type: Boolean,
    required: true
  }
}, {
  timestamps: true
});

const Note = mongoose.model('Note', noteSchema);

export default Note;