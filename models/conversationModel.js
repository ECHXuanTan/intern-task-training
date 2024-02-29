import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({

  inviteId: { type: String, required: true },

  notePinned: { type: Array },

  votePinned: { type: Array },
  
  assignmentPinned: { type: Array },

  conversationSetting: { type: Array },

  isConversationHidden: {
    pin: {type: String}
  },


  type: { type: Number, required: true },

  avatar: { type: String },

  createdBy: { 
    _id: { type: mongoose.Schema.Types.ObjectId },
    username: { type: String },
    email: { type: String },
    avatar: { type: String },
    background_img: { type: String },
  },

  name: { type: String, required: true },

  status: { type: Number, required: true },

  lastMessageCreated: { type: Date },

  isDeleted: { type: Boolean, required: true },

  isPinned: {
    type: Boolean,
    required: true
  },

  reviewMember: { type: Boolean, required: true },

  members: [{
    type: { type: Number, required: true },
    ownerAccepted: { type: Boolean, required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    username: { type: String, required: true }, 
    avatar: { type: String },
  }]

},
{
  timestamps: true,
});

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;

