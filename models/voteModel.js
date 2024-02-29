import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true
  },
  question: {
    type: String,
    required: true
  },

  createdBy: {
    username: {type: String, required: true},
    avatar: {type: String, required: true},
    id: {type: mongoose.Schema.Types.ObjectId, required: true}
  },

  isPinned: {
    type: Boolean,
  },

  allowMultipleAnswers: {
    type: Boolean,
  },

  allowAddOption: {
    type: Boolean, 
  },

  hideResultBeforeAnswers: {
    type: Boolean,
  },

  hideMemberAnswers: {
    type: Boolean,
  },

  allowChangeAnswers: {
    type: Boolean,
   
  },

  status: {
    type: Number,
    required: true
  },

  duration: {
    type: Number,
  },

  conversationVoteOptions: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,  
      default: mongoose.Types.ObjectId
    },
    option: {
      type: String,  
      required: true,
      maxlength: 200
    },
    conversationVoteAnswers: [],
  }],

}, {
  timestamps: true  
});

const Vote = mongoose.model('Vote', voteSchema);

export default Vote;