import express from 'express';
import Conversation from '../models/conversationModel.js';
import User from '../models/userModel.js';
import Note from '../models/noteModel.js';
import Vote from '../models/voteModel.js';
import { isAuth } from '../utils.js';
import { now, CastError  } from 'mongoose';
import mongoose from 'mongoose';

const conversationRouter = express.Router();
//create conversation
conversationRouter.post('/create', isAuth, async (req, res) => {
  try {
    
    const userId = req.user;
    // console.log("userId",userId);
    const user = await User.findById(userId._id);
    
    if(!user) {
      return res.status(400).send('User not found');
    }
    
    const memberIds = req.body.memberIds;
    
    // Create member objects array
    const members = [];
    //Push owner
    members.push({
      type: 1, 
      ownerAccepted: true,
      id: user._id,
      username: user.name,   
      avatar: user.avatar
    });

    // Fetch and add other member details
    for(let id of memberIds) {
        const objectId = new mongoose.Types.ObjectId(id); 
        const member = await User.findById(objectId);
        if (!member) {
          return res.status(400).send({
            data: "Invalid member id.",
            message: "Bad request.",  
            status: 400
          });
        }
        members.push({
          type: 2,
          ownerAccepted: true,
          id: member._id,
          username: member.name,
          avatar: member.avatar   
        });
      }
     
     // Create new conversation  
    const newConversation = new Conversation({
        inviteId: generateId(),
        notePinned: [],
        votePinned: [],
        conversationSetting: getDefaultSettings(),
        avatar: getAvatarImg(),
        createdBy: {
          _id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          background_img: user.background_img
        },
        type: req.body.type,
        status: 0,
        name: req.body.name,
        lastMessageCreated: now(),
        isDeleted: false,
        isPinned: false,
        reviewMember: true,
        members: members,
    });
    
    // Save conversation
   await newConversation.save();
    
      res.status(200).send({
      message: "Succsess",
      success: true,
    });
    
  }catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,
        status: 500  
      });
    } else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }    
});

//coversation detail
conversationRouter.get('/:id', isAuth, async (req, res) => {
  const userId = req.user;
   try {
    const conversation = await Conversation.findById(req.params.id).populate({
      path: 'notePinned',
      model: 'Note',
      select: ['content', 'createdBy', 'isPinned', 'createdAt', 'updatedAt'] 
    })
    .populate({
      path: 'votePinned',
      model: 'Vote', 
      select: ['-conversationId'] 
    });;
        if (!conversation) {
          return res.status(400).send({
            data: "Conversation not found.",
            message: "Bad request.",  
            status: 400
          });
        } else if(!isMember(conversation,userId)) {
          return res.status(403).send({
            message: "Permission denied.",  
            status: 403
          });
        } else {
          res.status(200).send(conversation)
        }
      }
      catch (error) {
        // Invalid ObjectId
        if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
          return res.status(500).json({
            message: error.message,  
            status: 500
          });
        } else {
          console.error(error);
          res.status(500).send({message: 'Server error'});
        }
      }    
})

conversationRouter.put('/setting/notification/:conversationId/:type', isAuth, async (req, res) => {
  const { conversationId, type } = req.params;
  const userId = req.user;
  try {
    const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        } else if(!isMember(conversation,userId)) {
          return res.status(403).send({
            message: "Permission denied.",  
            status: 403
          });
        } else if(type !== 'on' && type !== 'off'){
          return res.status(404).send({
            message: "Not found!",  
            status: 400
          });
        } 
        else {
          if(type === 'on') {

            // Validate time 
            if(!req.body.time) {
              return res.status(400).send({
                message: "Invalid input"   
              });
            }

            if(isNaN(req.body.time)) { 
              return res.status(400).send({
                message: "Invalid input"   
              });
            }

            // Check if type 1 setting exists
            const existing = conversation.conversationSetting.find(s => s.type === 1);

            if(existing) {
              // Update value 
              existing.value = req.body.time; 
            } else {
              // Add new setting
              conversation.conversationSetting.push({
                type: 1, 
                value: req.body.time
              });
            }

            await conversation.save();

            res.status(200).send({
              message: "Succsess",
              success: true,
            });
      
          } else if(type === 'off') {
      
           // Check if type 1 exists
           const settingIndex = conversation.conversationSetting.findIndex(s => s.type === 1);
          
           if(settingIndex !== -1) {
             // Remove from array
             conversation.conversationSetting.splice(settingIndex, 1);
           }
           await conversation.save();
          
          res.status(200).send({
            message: "Succsess",
            success: true,
          });
          }
        }
      }
      catch (error) {
        // Invalid ObjectId
        if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
          return res.status(500).json({
            message: error.message,  
            status: 500
          });
        } else {
          console.error(error);
          res.status(500).send({message: 'Server error'});
        }
      }    
})

conversationRouter.put('/users/setting/status-message/:type', isAuth, async (req, res) => {
  const type  = req.params.type;
  try {
    const userId = req.user;
    // console.log("userId",userId);
    const user = await User.findById(userId._id);
    
    if(!user) {
      return res.status(400).send('Bad token');
    }
    
    if (type !== 'on' && type !== 'off') {
      return res.status(400).send({
        message: "Bad request.",  
        status: 400
      });
    } else {
      if(type === 'on') {

        // Find status-message setting
        const userSetting = user.userSetting.find(s => s.type === 1);
        if(userSetting) {
          // Update value 
          userSetting.value = true; 
          await user.save();

          res.status(200).send({
            message: "Succsess",
            success: true,
          });
        }

        
  
      } else if(type === 'off') {
  
       // Find status-message setting
       const userSetting = user.userSetting.find(s => s.type === 1);

       if(userSetting) {
         // Update value 
         userSetting.value = true; 
         await user.save();

         res.status(200).send({
          message: "Succsess",
          success: true,
        });
       }
        
      }

    }

      }
  catch (error) {
    console.error(error);
    res.status(500).send({message: 'Server error'});
  }  
})

conversationRouter.post('/hidden', isAuth, async (req, res) => {
  const conversationId = req.body.conversationId;
  const userId = req.user;
  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).send({
        message: "Conversation not found.",  
        status: 404
      });
    } else if(!isMember(conversation,userId)) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    }else {
      if(typeof req.body.pin !== 'string') {
        return res.status(400).send({
          message: "Bad request!",
          status: 400  
        });
      }
      conversation.isConversationHidden = {
        pin: req.body.pin 
      };
      
      await conversation.save();
      
      return res.status(200).send({
        message: 'Succsess',
        status: 200
      });
        }
      }
      catch (error) {
        // Invalid ObjectId
        if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
          return res.status(500).json({
            message: error.message,  
            status: 500
          });
        } else {
          console.error(error);
          res.status(500).send({message: 'Server error'});
        }
      }    
})

conversationRouter.post('/unhidden', isAuth, async (req, res) => {
  const conversationId = req.body.conversationId;
  const userId = req.user;
  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).send({
        message: "Conversation not found.",  
        status: 404
      });
    } else if(!isMember(conversation,userId)) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    }else {
            // Check if isConversationHidden exists
            if(conversation.isConversationHidden) {

              // Remove isConversationHidden 
              conversation.isConversationHidden = undefined;
              // Save updated conversation
              await conversation.save();

              return res.status(200).send({
                message: 'Succsess', 
                status: 200
              });

            } else {

              return res.status(400).send({
                message: 'Conversation is not hidden',
                status: 400
              });

            }
            }
      }
      catch (error) {
        // Invalid ObjectId
        if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
          return res.status(500).json({
            message: error.message,  
            status: 500
          });
        } else {
          console.error(error);
          res.status(500).send({message: 'Server error'});
        }
      }    
})

conversationRouter.get('/group/invite/:inviteId', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      inviteId: req.params.inviteId
    });

    if (!conversation) {
      return res.status(404).send({
        message: 'Conversation not found',
        status: 404
      });
    }

    res.send({
      avatar: conversation.avatar,
      name: conversation.name,
      reviewMember: conversation.reviewMember
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Server error'); 
  }
})

conversationRouter.post('/group/invite/:inviteId', isAuth, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      inviteId: req.params.inviteId
    });

    const userId = req.user;
    const user = await User.findById(userId._id);

    if (!conversation) {
      return res.status(404).send({
        message: 'Conversation not found',
        status: 404
      });
    }

    if(!user) {
      return res.status(400).send('User not found');
    }

    // Check if user is already a member
    if(isMember(conversation,userId)) {
      return res.status(400).send( {message: 'User is already a member'});
    }

    // Check reviewMember 
    let memberType, ownerAccepted;

    if(conversation.reviewMember) {
      memberType = 5;
      ownerAccepted = false;
    } else {
      memberType = 4; 
      ownerAccepted = true;
    }

    // Add user to members
    conversation.members.push({
      type: memberType,
      ownerAccepted: ownerAccepted,
      id: user._id,
      username: user.username,  
      avatar: user.avatar
    });

    await conversation.save();


    res.status(200).send({
      message: 'Succsess', 
      status: 200
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Server error'); 
  }
})

//turn off/on pin note, vote, msg in group
conversationRouter.put('/setting/group/pin/:conversationId/:type', isAuth, async (req, res) => {
  const { conversationId, type } = req.params;
  const userId = req.user;
  try {
    const conversation = await Conversation.findById(conversationId);
    
        if (!conversation) {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        } else if(type !== 'on' && type !== 'off') 
        {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        }
        else if(!isOwnerOrAdmin(conversation,userId)){
          return res.status(403).send({
            message: "Permission denied.",  
            status: 403
          });
        }
        else {
         
          const value = type === 'on' ? true : false;

          await Conversation.updateOne({
              _id: conversationId,
              "conversationSetting.type": 3
            },
            {
              $set: {
                "conversationSetting.$.value": value  
              }
          });
          res.status(200).send({
            message: 'Succsess', 
            status: 200
          });
        }
      }
      catch (error) {
        // Invalid ObjectId
        if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
          return res.status(500).json({
            message: error.message,  
            status: 500
          });
        } else {
          console.error(error);
         res.status(500).send({message: 'Server error'});
        }
      }    
})

//turn off/on vote group
conversationRouter.put('/setting/group/vote/:conversationId/:type', isAuth, async (req, res) => {
  const { conversationId, type } = req.params;
  const userId = req.user;
  try {
    const conversation = await Conversation.findById(conversationId);
    
        if (!conversation) {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        } else if(type !== 'on' && type !== 'off') 
        {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        }
        else if(!isOwnerOrAdmin(conversation,userId)){
          return res.status(403).send({
            message: "Permission denied.",  
            status: 403
          });
        }
        else {
         
          const value = type === 'on' ? true : false;

          await Conversation.updateOne({
              _id: conversationId,
              "conversationSetting.type": 5
            },
            {
              $set: {
                "conversationSetting.$.value": value  
              }
          });
          res.status(200).send({
            message: 'Succsess', 
            status: 200
          });
        }
      }
      catch (error) {
        // Invalid ObjectId
        if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
          return res.status(500).json({
            message: error.message,  
            status: 500
          });
        } else {
          console.error(error);
         res.status(500).send({message: 'Server error'});
        }
      }    
})

//turn off/on join group by link invite
conversationRouter.put('/setting/group/join-link-invite/:conversationId/:type', isAuth, async (req, res) => {
  const { conversationId, type } = req.params;
  const userId = req.user;
  try {
    const conversation = await Conversation.findById(conversationId);
    
        if (!conversation) {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        } else if(type !== 'on' && type !== 'off') 
        {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        }
        else if(!isOwnerOrAdmin(conversation,userId)){
          return res.status(403).send({
            message: "Permission denied.",  
            status: 403
          });
        }
        else {
         
          const value = type === 'on' ? true : false;

          await Conversation.updateOne({
              _id: conversationId,
              "conversationSetting.type": 9
            },
            {
              $set: {
                "conversationSetting.$.value": value  
              }
          });
          res.status(200).send({
            message: 'Succsess', 
            status: 200
          });
        }
      }
      catch (error) {
        // Invalid ObjectId
        if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
          return res.status(500).json({
            message: error.message,  
            status: 500
          });
        } else {
          console.error(error);
         res.status(500).send({message: 'Server error'});
        }
      }    
})

//turn off/on note group
conversationRouter.put('/setting/group/note/:conversationId/:type', isAuth, async (req, res) => {
  const { conversationId, type } = req.params;
  const userId = req.user;
  try {
    const conversation = await Conversation.findById(conversationId);
    
        if (!conversation) {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        } else if(type !== 'on' && type !== 'off') 
        {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        }
        else if(!isOwnerOrAdmin(conversation,userId)){
          return res.status(403).send({
            message: "Permission denied.",  
            status: 403
          });
        }
        else {
         
          const value = type === 'on' ? true : false;

          await Conversation.updateOne({
              _id: conversationId,
              "conversationSetting.type": 4
            },
            {
              $set: {
                "conversationSetting.$.value": value  
              }
          });
          res.status(200).send({
            message: 'Succsess', 
            status: 200
          });
        }
      }
      catch (error) {
        // Invalid ObjectId
        if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
          return res.status(500).json({
            message: error.message,  
            status: 500
          });
        } else {
          console.error(error);
         res.status(500).send({message: 'Server error'});
        }
      }    
})

//turn off/on send msg group
conversationRouter.put('/setting/group/send-msg/:conversationId/:type', isAuth, async (req, res) => {
  const { conversationId, type } = req.params;
  const userId = req.user;
  try {
    const conversation = await Conversation.findById(conversationId);
    
        if (!conversation) {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        } else if(type !== 'on' && type !== 'off') 
        {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        }
        else if(!isOwnerOrAdmin(conversation,userId)){
          return res.status(403).send({
            message: "Permission denied.",  
            status: 403
          });
        }
        else {
         
          const value = type === 'on' ? true : false;

          await Conversation.updateOne({
              _id: conversationId,
              "conversationSetting.type": 6
            },
            {
              $set: {
                "conversationSetting.$.value": value  
              }
          });
          res.status(200).send({
            message: 'Succsess', 
            status: 200
          });
        }
      }
      catch (error) {
        // Invalid ObjectId
        if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
          return res.status(500).json({
            message: error.message,  
            status: 500
          });
        } else {
          console.error(error);
         res.status(500).send({message: 'Server error'});
        }
      }    
})

//turn off/on review member group
conversationRouter.put('/setting/group/review-member/:conversationId/:type', isAuth, async (req, res) => {
  const { conversationId, type } = req.params;
  const userId = req.user;
  try {
    const conversation = await Conversation.findById(conversationId);
    
        if (!conversation) {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        } else if(type !== 'on' && type !== 'off') 
        {
          return res.status(400).send({
            message: "Bad request.",  
            status: 400
          });
        }
        else if(!isOwnerOrAdmin(conversation,userId)){
          return res.status(403).send({
            message: "Permission denied.",  
            status: 403
          });
        }
        else {
         
          const value = type === 'on' ? true : false;

          await Conversation.updateOne({
              _id: conversationId,
              "conversationSetting.type": 7
            },
            {
              $set: {
                "conversationSetting.$.value": value  
              }
          });
          res.status(200).send({
            message: 'Succsess', 
            status: 200
          });
        }
      }
      catch (error) {
        // Invalid ObjectId
        if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
          return res.status(500).json({
            message: error.message,  
            status: 500
          });
        } else {
          console.error(error);
         res.status(500).send({message: 'Server error'});
        }
      }    
})

//prevent join group
conversationRouter.put('/setting/group/prevent-join/:conversationId', isAuth, async (req, res) => {
  const { conversationId, type } = req.params;
  const userId = req.user;
  try {
  const userPrevented = await User.findById(req.body.userId);
  const conversation = await Conversation.findById(conversationId);
  const member = conversation.members.find(m => m.id.equals(req.body.userId));
    if (!conversation) {
      return res.status(400).send({
        message: "Bad request.",  
        status: 400
      });
    } else if(!userPrevented) {
      return res.status(404).send({
        data: "userId",
        message: "User not found",  
        status: 400
      });
    }
    else if(!isOwnerOrAdmin(conversation,userId)){
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    }
    else if(member){
      return res.status(400).send({
        message: "User is already a member"   
      });
    }
    else {
        // Check if user already in type 8 value
        const type8Setting = conversation.conversationSetting.find(s => s.type === 8);
        const userPreventedObj = type8Setting.value.find(obj => {
          if (obj.userPrevented.id == req.body.userId) {
            // console.log("obj.userPrevented.id",obj.userPrevented.id)
            return true;
          } else {
            return false;
          }
        });

        if (userPreventedObj) {
          return res.status(400).send({
            message: "User is already prevented from joining"
          });
        }

        //Prevent user from joining
        const newUserPreventedObj = {
          id: generateId(),
          userPrevented: {
            id: userPrevented._id, 
            username: userPrevented.username,
            avatar: userPrevented.avatar
          }
        };
        await Conversation.updateOne({
          _id: conversationId,
        "conversationSetting.type": 8
        },
        { 
          $push: {
            "conversationSetting.$.value": newUserPreventedObj
          }
        });

        res.status(200).send({
          preventId: newUserPreventedObj.id,
          message: 'Succsess', 
          status: 200
        });
      }
    }
  catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,  
        status: 500
      });
    } else if(error instanceof CastError && error.kind === 'ObjectId'){
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }    
})

//unprevent join group
conversationRouter.put('/setting/group/unprevent-join/:conversationId', isAuth, async (req, res) => {
  const { conversationId, type } = req.params;
  const userId = req.user;
  try {
  const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(400).send({
        message: "Bad request.",  
        status: 400
      });
    } 
    else if(!isOwnerOrAdmin(conversation,userId)){
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    }
    else {
      const setting = conversation.conversationSetting.find(s => s.type === 8);
      const preventedObj = setting.value.find(o => o.id === req.body.preventId);
      // Check if preventId exists
      if (!preventedObj) {
        return res.status(400).send({
          message: 'Prevent ID not found'  
        });
      }
      
      // Pull out the prevented user object
      await Conversation.updateOne({
        _id: conversationId,
        "conversationSetting.type": 8 
      }, {
        $pull: { "conversationSetting.$.value": {id: req.body.preventId} } 
      });

        res.status(200).send({
          message: 'Succsess', 
          status: 200
        });
      }
    }
  catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,  
        status: 500
      });
    } else if(error instanceof CastError && error.kind === 'ObjectId'){
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }    
})

//grant role member group
conversationRouter.put('/group/grant/:conversationId', isAuth, async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user;
  try {
  const conversation = await Conversation.findById(conversationId);
  const member = conversation.members.find(m => m.id.equals(req.body.userId));
    if (!conversation) {
      return res.status(400).send({
        message: "Bad request.",  
        status: 400
      });
    } else if(!isMember(conversation,userId)) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else if(!member) {
      return res.status(404).send({
        data: "userId",
        message: "User not found",  
        status: 404
      });
    }
    else if(!isOwner(conversation,userId)){
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    }
    else if (req.body.role == 3){
        
      await Conversation.updateOne({
        _id: conversationId,
        "members.id": req.body.userId 
      }, {
        $set: { "members.$.type": req.body.role} 
      });
        res.status(200).send({
          message: 'Succsess', 
          status: 200
        });
      }
    else if (req.body.role == 2){
      
      await Conversation.updateOne({
        _id: conversationId,
        "members.id": req.body.userId 
      }, {
        $set: { "members.$.type": req.body.role} 
      });
        res.status(200).send({
          message: 'Succsess', 
          status: 200
        });
      }
    else if (req.body.role == 1){
      
      await Conversation.updateOne({
        _id: conversationId,
        "members.id": req.body.userId 
      }, {
        $set: { "members.$.type": req.body.role} 
      });
      await Conversation.updateOne({
        _id: conversationId,
        "members.id": userId 
      }, {
        $set: { "members.$.type": 2} 
      });
        res.status(200).send({
          message: 'Succsess', 
          status: 200
        });
      }
    else{
      res.status(400).send({
        message: 'Bad request.', 
        status: 400
      });
    }
    }
  catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,  
        status: 500
      });
    } else if(error instanceof CastError && error.kind === 'ObjectId'){
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }    
})

//pin conversation
conversationRouter.put('/:action/:conversationId', isAuth, async (req, res) => {
  const { action, conversationId } = req.params;
  const userId = req.user;
  try {
  const conversation = await Conversation.findById(conversationId);
    if (!conversation ) {
      return res.status(404).send({
        data: "Conversation not found.",
        message: "Not found.",  
        status: 404
      });
      
    } else if(!isMember(conversation,userId)) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    }
    else if (action == "pin"){
        
        //Update isPinned
        conversation.isPinned = true;
        await conversation.save();
        res.status(200).send({
          message: 'Succsess', 
          status: 200
        });
      }
    else if (action == "unpin"){
      if(conversation.isPinned == false){
        return res.status(400).send({
          data: 'The conversation has not been pinned.',
          message: 'Bad request.', 
          status: 400
        });
      } else {
        //Update isPinned
        conversation.isPinned = false;
        await conversation.save();
        res.status(200).send({
          message: 'Succsess', 
          status: 200
        });
        }
      }
    else{
      res.status(400).send({
        message: 'Bad request.', 
        status: 400
      });
    }
    }
  catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,  
        status: 500
      });
    } else if(error instanceof CastError && error.kind === 'ObjectId'){
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }    
})

// create note
conversationRouter.post('/note/:conversationId', isAuth, async (req, res) => {
  try {
    const {conversationId } = req.params;
    const userId = req.user;
    const user = await User.findById(userId._id)
    const conversation = await Conversation.findById(conversationId);
    let isPinned = false; 
      if(req.body.isPinned !== undefined) {
        isPinned = req.body.isPinned;
      }
    if (!conversation ) {
      return res.status(404).send({
        data: "Conversation not found.",
        message: "Not found.",  
        status: 404
      });
    } else if(!isOfficialMember(conversation,userId)) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else if(!req.body.content) {
        return res.status(400).send({
          message: "Bad request.",  
          status: 400
        });
    } else if (req.body.isPinned === true || req.body.isPinned === false ||  req.body.isPinned === undefined ){
          //Find setting allows creating note
          const setting = conversation.conversationSetting.find(s => s.type === 4);
          //Find setting allows pinning note
          const settingPin = conversation.conversationSetting.find(s => s.type === 3);

          //Allow creating note
          if(setting.value === true){
              //Allow pinning note
              if(settingPin.value === true) {
                const newNote = new Note({
                  conversationId: conversationId,
                  content: req.body.content,
                  createdBy: {
                    username: user.username,
                    avatar: user.avatar,
                    id: user._id
                  },
                  isPinned: isPinned,
                })
  
                if(isPinned) {
  
                  // If pinned, update conversation  
                  await Conversation.updateOne(
                    { _id: conversationId }, 
                    { $push: { notePinned: newNote._id } }  
                  );
                  
                }
                await newNote.save();
                res.status(200).send({
                  message: 'Succsess', 
                  status: 200
                });
              } else {
                //Dont allow pinning note
                const newNote = new Note({
                  conversationId: conversationId,
                  content: req.body.content,
                  createdBy: {
                    username: user.username,
                    avatar: user.avatar,
                    id: user._id
                  },
                  isPinned: false,
                })
                await newNote.save();
                res.status(200).send({
                  message: 'Succsess', 
                  status: 200
                })
              }
          } else if(setting.value === false && isOwnerOrAdmin(conversation, userId)) {
                //create note
                const newNote = new Note({
                conversationId: conversationId,
                content: req.body.content,
                createdBy: {
                  username: user.username,
                  avatar: user.avatar,
                  id: user._id
                },
                isPinned: isPinned,
              })
              await newNote.save();

              if(isPinned) {

                // If pinned, update conversation  
                await Conversation.updateOne(
                  { _id: conversationId }, 
                  { $push: { notePinned: newNote._id } }  
                );
                
              }
              res.status(200).send({
                message: 'Succsess', 
                status: 200
              });
          } else {
            return res.status(403).send({
              message: "Permission denied.",  
              status: 403
            });
          }
      
    } else {
      return res.status(400).send({
        message: "Bad request.",  
        status: 400
      });
    }
  } catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,  
        status: 500
      });
    } else if(error instanceof CastError && error.kind === 'ObjectId'){
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }
})

// get list note
conversationRouter.get('/note/:conversationId', isAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user;
    const conversation = await Conversation.findById(conversationId)
    if (!conversation ) {
      return res.status(404).send({
        data: "Conversation not found.",
        message: "Not found.",  
        status: 404
      });
    } else if(!isMember(conversation,userId)) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else {
      // Get limit from query params
    const limit = parseInt(req.query.limit) || 0;

    const notes = await Note.find({conversationId})
      .limit(limit);

    return res.status(200).send(notes)
    }
  } catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,  
        status: 500
      });
    } else if(error instanceof CastError && error.kind === 'ObjectId'){
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }
})

// update note
conversationRouter.put('/note/:noteId', isAuth, async (req, res) => {
  try {
    const { noteId } = req.params;
    const note = await Note.findById(noteId)
    const user = await User.findById(req.user._id)
    
    if(!note) {
      return res.status(404).send({
        message:"Not found.",  
        status: 404
      });
    } 
    if(!user) {
      return res.status(404).send({
        message:"User not found.",  
        status: 404
      });
    } 
    const conversation = await Conversation.findById(note.conversationId);

    if(!conversation) {
      return res.status(404).send({
        message: "Conversation not found.",
        satus: 404,
      });
    } 

    //Only the person who created the note can edit the note's content
    const isCreateNote = Note.createdBy.id.find(m => m.id.equals(req.user._id));
    if(!isCreateNote) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else if(!req.body.content) {
      return res.status(400).send({
        message: "Bad request.",  
        status: 400
      });
  } else if (req.body.isPinned === true || req.body.isPinned === false ||  req.body.isPinned === undefined ){
    if(req.body.isPinned !== undefined)
    {
      //Find setting allows pinning note
      const settingPin = conversation.conversationSetting.find(s => s.type === 3);
      if(req.body.isPinned === true)
      {
        //Alow pinning note
        if(settingPin.value === true)
        {
           // Update note 
            note.isPinned = req.body.isPinned;
            note.content = req.body.content;
            // Save updated note
            await note.save();

          const isNotePinned = conversation.find(note.id)
            if(!isNotePinned) {
              // If not pinned, update conversation  
              await Conversation.updateOne(
                { _id: conversation._id }, 
                { $push: { notePinned: note.id } }  
              );
            }
            return res.status(200).send({
              message: "Success.",  
              status: 200,
              // note
            });
        } else if (settingPin.value === false && isOwnerOrAdmin(conversation, req.user)) {
           // Update note 
           note.isPinned = req.body.isPinned;
           note.content = req.body.content;
           // Save updated note
           await note.save();

         const isNotePinned = conversation.find(note.id)
           if(!isNotePinned) {
             // If not pinned, update conversation  
             await Conversation.updateOne(
               { _id: conversation._id }, 
               { $push: { notePinned: note.id } }  
             );
           }
           return res.status(200).send({
             message: "Success.",  
             status: 200,
             // note
           });
        } else if (settingPin.value === false) {
          return res.status(403).send({
            message: "Permission denied.",  
            status: 403
          });
        }
       
      } else if (req.body.isPinned === false) {
        // Update note 
        note.isPinned = req.body.isPinned;
        note.content = req.body.content;
        // Save updated note
        await note.save();

       const isNotePinned = conversation.find(note.id)
        if(isNotePinned) {
          // If not pinned, remove from conversation  
          await Conversation.updateOne(
            { _id: conversation._id }, 
            { $pull: { notePinned: note.id } }  
          );
        }
        return res.status(200).send({
          message: "Success.",  
          status: 200,
          // note
        });
      }
    } else {
      // Update note  
      note.content = req.body.content;
      // Save updated note
      await note.save();
      return res.status(200).send({
        message: "Success.",  
        status: 200,
        note
      });
    }

  } else {
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }

  } catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,  
        status: 500
      });
    } else if(error instanceof CastError && error.kind === 'ObjectId'){
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }
})

//Delete note
conversationRouter.delete('/note/:noteId', isAuth, async (req, res) => {
  try {
    const { noteId } = req.params;
    const note = await Note.findById(noteId); 
    if(!note) {
      return res.status(404).send({
        message: "Not found.",
        satus: 404
      });
    } 
    const conversationId = note.conversationId
    const conversation = await Conversation.findById(conversationId);
    const isCreateNote = note.createdBy.equals(req.user._id);
    if(!conversation) {
      return res.status(404).send({
        message: "Conversation not found.",
        satus: 404
      });
    } else if(isOwnerOrAdmin(conversation,req.user) || isCreateNote()) {
      // If pinned, remove from conversation
      if(note.isPinned) {
        await Conversation.updateOne(
          { _id: note.conversationId },
          { $pull: { notePinned: noteId }} 
        );
        }
        // Delete the note
        const deleteNote = await Note.findByIdAndDelete(noteId); 
  
        return res.status(200).send({
          message: "Success.",  
          status: 200,
        });
    } else {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    }
    
  } catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,  
        status: 500
      });
    } else if(error instanceof CastError && error.kind === 'ObjectId'){
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }
})

// create Vote
conversationRouter.post('/vote/:conversationId', isAuth, async (req, res) => {
  try {
    const {conversationId } = req.params;
    const user = await User.findById(req.user._id)
    const conversation = await Conversation.findById(conversationId);

    //Validate the data type of the fields received from the body

    // Validate other boolean fields
    const booleanFields = [
      'isPinned', 
      'allowMultipleAnswers', 
      'allowAddOption', 
      'hideResultBeforeAnswers',
      'hideMemberAnswers',
      'allowChangeAnswers'
    ];

    for (let field of booleanFields) {
      if (typeof req.body[field] !== 'boolean' && req.body[field] !== undefined) {
        return res.status(400).send({
          message: `${field} must be a boolean`,
          status: 400
        });
      }
    }

    // Validate question
    if (typeof req.body.question !== 'string' || req.body.question.length < 1 || req.body.question.length > 200) {
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      });  
    }

    // Validate options
    if (!Array.isArray(req.body.option) || req.body.option.length < 1 || req.body.option.length > 30) {
      return res.status(400).send({
        message: "Options must be an array of length 2-30", 
        status: 400
      });
    }

    for (let option of req.body.option) {
      if (typeof option !== 'string' || option.length < 1 || option.length > 200) {
        return res.status(400).send({
          message: "Bad request.",
          status: 400
        });
      }
    } 

    // Validate duration
    if (req.body.duration && typeof req.body.duration !== 'string') {
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      });
    }


    //initialize the values of optional fields
    let isPinned = false; 
      if(req.body.isPinned !== undefined) {
        isPinned = req.body.isPinned;
      }
    let allowMultipleAnswers = true; 
      if(req.body.allowMultipleAnswers !== undefined) {
        allowMultipleAnswers = req.body.allowMultipleAnswers;
      }
    let allowAddOption = true; 
      if(req.body.allowAddOption !== undefined) {
        allowAddOption = req.body.allowAddOption;
    }
    let hideResultBeforeAnswers = true; 
      if(req.body.hideResultBeforeAnswers !== undefined) {
        hideResultBeforeAnswers = req.body.hideResultBeforeAnswers;
    }
    let hideMemberAnswers = false; 
    if(req.body.hideMemberAnswers !== undefined) {
      hideMemberAnswers = req.body.hideMemberAnswers;
  }
    let allowChangeAnswers = true; 
      if(req.body.allowChangeAnswers !== undefined) {
        allowChangeAnswers = req.body.allowChangeAnswers;
    }
    let duration = null; 
      if(req.body.duration !== undefined) {
        duration = req.body.duration;
    }

    if (!conversation ) {
      return res.status(404).send({
        data: "Conversation not found.",
        message: "Not found.",  
        status: 404
      });
    } else if(!isOfficialMember(conversation,req.user)) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else if(!req.body.option || !req.body.question) {
        return res.status(400).send({
          message: "Bad request.",  
          status: 400
        });
    } else {
      //Find setting allows creating vote
      const setting = conversation.conversationSetting.find(s => s.type === 5);
      // console.log(setting)
      //Find setting allows pinning note
      const settingPin = conversation.conversationSetting.find(s => s.type === 3);
      
      const options = req.body.option.map(optionText => {
        return {
          _id: new mongoose.Types.ObjectId(), 
          option: optionText
        };
      });
      if (setting.value === true) {
        if (settingPin.value===true) {
          // console.log(options)
          const newVote = new Vote({
            isPinned: isPinned,
            question: req.body.question,
            conversationVoteOptions: options,
            allowMultipleAnswers: allowMultipleAnswers,
            allowAddOption: allowAddOption,
            hideResultBeforeAnswers:hideResultBeforeAnswers,
            hideMemberAnswers: hideMemberAnswers,
            allowChangeAnswers: allowChangeAnswers,
            duration: duration,
            status: 1,
            createdBy: {
              id: user._id,
              username: user.username,
              avatar: user.avatar,
            },
            conversationId: conversationId
          });
          await newVote.save();
          if(isPinned) {

            // If pinned, update conversation  
            await Conversation.updateOne(
              { _id: conversationId }, 
              { $push: { votePinned: newVote._id } }  
            );
            
          }
          return res.status(200).send({
            id: newVote._id,
            message: "Success.",  
            status: 200
          });
          
        } else if (settingPin.value===false) {
            const newVote = new Vote({
            isPinned: false,
            question: req.body.question,
            conversationVoteOptions: options,
            allowMultipleAnswers: allowMultipleAnswers,
            allowAddOption: allowAddOption,
            hideResultBeforeAnswers:hideResultBeforeAnswers,
            hideMemberAnswers: hideMemberAnswers,
            allowChangeAnswers: allowChangeAnswers,
            duration: duration
            });
            await newVote.save();
            return res.status(200).send({
              id: newVote._id,
              message: "Success.",  
              status: 200
            });
        }
      } else if (setting.value === false && isOwnerOrAdmin(conversation, req.user)) {
            const newVote = new Vote({
            isPinned: isPinned,
            question: req.body.question,
            conversationVoteOptions: options,
            allowMultipleAnswers: allowMultipleAnswers,
            allowAddOption: allowAddOption,
            hideResultBeforeAnswers:hideResultBeforeAnswers,
            hideMemberAnswers: hideMemberAnswers,
            allowChangeAnswers: allowChangeAnswers,
            duration: duration
            });
            await newVote.save();
            if(isPinned) {

              // If pinned, update conversation  
              await Conversation.updateOne(
                { _id: conversationId }, 
                { $push: { votePinned: newVote._id } }  
              );
              
            }
            return res.status(200).send({
              id: newVote._id,
              message: "Success.",  
              status: 200
            });
      } else {
        return res.status(403).send({
          message: "Permission denied.",  
          status: 403
        });
      }
    }
  } catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,  
        status: 500
      });
    } else if(error instanceof CastError && error.kind === 'ObjectId'){
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }
})

// get vote
conversationRouter.get('/vote/:conversationId', isAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user;
    const conversation = await Conversation.findById(conversationId)
    if (!conversation ) {
      return res.status(404).send({
        data: "Conversation not found.",
        message: "Not found.",  
        status: 404
      });
    } else if(!isMember(conversation,userId)) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else {
      // Get limit from query params
    const limit = parseInt(req.query.limit) || 0;

    const votes = await Vote.find({conversationId})
      .limit(limit).select('-conversationId');

    return res.status(200).send(votes)
    }
  } catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,  
        status: 500
      });
    } else if(error instanceof CastError && error.kind === 'ObjectId'){
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }
})

//Close or pin/unpin vote
conversationRouter.put('/vote/:voteId/:action', isAuth, async (req, res) => {
  const { action, voteId } = req.params;
  try {
    if (action !== "1" && action !== "2" && action !== "3" && action !== "4") {
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    
    const vote = await Vote.findById(voteId);
    if (!vote) {
      return res.status(404).send({
        message: "Vote not found.",
        status: 404
      }); 
    } 
    const isCreateVote = Vote.createdBy.id.find(m => m.id.equals(req.user._id));
    const conversation = Conversation.findById(vote.conversationId);
    if(isCreateVote) {
      const settingPin = conversation.conversationSetting.find(s => s.type === 3);
      const isPinned = conversation.votePinned.some(id => id.equals(vote._id));
      if(action === 1 && settingPin.value === true) {
        vote.isPinned = true;
        await vote.save()
        if(isPinned) {
          await Conversation.updateOne(
            { _id: vote.conversationId }, 
            { $push: { votePinned: vote._id } }  
          );
        }
        
        return res.status(200).send({
          message: "Success.",  
          status: 200
        });
      } else if (action === 1 && settingPin.value === false) {
        if (isOwnerOrAdmin(conversation, req.user)){
          vote.isPinned = true;
          await vote.save()
          if(isPinned) {
            await Conversation.updateOne(
              { _id: vote.conversationId }, 
              { $push: { votePinned: vote._id } }  
            );
          }
        return res.status(200).send({
          message: "Success.",  
          status: 200
          });
        } else {
          return res.status(403).send({
            message: "Permission denied.",  
            status: 403
          });
        }
      } else if (action === 2) {
        vote.isPinned = false;
        await vote.save()
        if(isPinned) {
          await Conversation.updateOne(
            { _id: vote.conversationId }, 
            { $pull: { votePinned: vote._id } }  
          );
        }
        return res.status(200).send({
          message: "Success.",  
          status: 200
        });
      } else if (action === 3) {
        vote.status = 2;
        await vote.save()
      }

    } else if (isOwnerOrAdmin(conversation, req.user)){
      const isPinned = conversation.votePinned.some(id => id.equals(vote._id));
        if(action === 1) {
          vote.isPinned = true;
          await vote.save()
          if(isPinned) {
            await Conversation.updateOne(
              { _id: vote.conversationId }, 
              { $push: { votePinned: vote._id } }  
            );
          }
          return res.status(200).send({
            message: "Success.",  
            status: 200
          });
        } else if (action === 2) {
          vote.isPinned = false;
          await vote.save()
          if(isPinned) {
            await Conversation.updateOne(
              { _id: vote.conversationId }, 
              { $pull: { votePinned: vote._id } }  
            );
          }
          return res.status(200).send({
            message: "Success.",  
            status: 200
          });
        }
      
    } else if (isOfficialMember(conversation, req.user)) {
      const settingPin = conversation.conversationSetting.find(s => s.type === 3);
      const isPinned = conversation.votePinned.some(id => id.equals(vote._id));
      if(action === 1 && settingPin.value === true) {
        vote.isPinned = true;
        await vote.save()
        if(isPinned) {
          await Conversation.updateOne(
            { _id: vote.conversationId }, 
            { $push: { votePinned: vote._id } }  
          );
        }
        
        return res.status(200).send({
          message: "Success.",  
          status: 200
        });
      } else if (action === 1 && settingPin.value === false) {
          return res.status(403).send({
            message: "Permission denied.",  
            status: 403
          });
      } else if (action === 2) {
        vote.isPinned = false;
        await vote.save()
        if(isPinned) {
          await Conversation.updateOne(
            { _id: vote.conversationId }, 
            { $pull: { votePinned: vote._id } }  
          );
        }
        return res.status(200).send({
          message: "Success.",  
          status: 200
        });
      } else if (action === 4) {
        if(vote.status === 1){
          const options = req.body.option.map(optionText => {
            return {
              _id: new mongoose.Types.ObjectId(), 
              option: optionText
            };
          });

          vote.conversationVoteOptions = [...conversationVoteOptions,...options]
        } else if (vote.status === 2) {
          return res.status(400).send({
            data: "Voting has ended!",
            message: "Permission denied.",  
            status: 400
          });
        }
      }
      
    } else {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    }
  } catch (error) {
    // Invalid ObjectId
    if(error.message.includes('input must be a 24 character hex string, 12 byte Uint8Array, or an integer')) {
      return res.status(500).json({
        message: error.message,  
        status: 500
      });
    } else if(error instanceof CastError && error.kind === 'ObjectId'){
      return res.status(400).send({
        message: "Bad request.",
        status: 400
      }); 
    }
    else {
      console.error(error);
      res.status(500).send({message: 'Server error'});
    }
  }
})




// Helper methods

function generateId() {

  let id = "";
  
  for(let i = 0; i < 24; i++) {
    // Generate random hex character
    const rand = Math.floor(Math.random() * 16).toString(16);
    id += rand;
  }

  return id; 
}

function getDefaultSettings() {
    return [
        {
            type: 3,
            value: true
        },
        {
            type: 4,
            value: true
        },
        {
            type: 7,
            value: true
        },
        {
            type: 6,
            value: true
        },
        {
            type: 5,
            value: true
        },
        {
            type: 9,
            value: true
        },
        {
          type: 10,
          value: true
      },
        {
            type: 8,
            value: []
        }  
    ]; 
  }

function getAvatarImg() {
    return "https://test3.stechvn.org/api/image/2HD1c4cb1b8-9255-11ee-973a-0242c0a83003.Grey_and_Brown_Modern_Beauty_Salon_Banner_20231024_124517_0000.png"; 
}

//check if user chat_token is in conversation member
function isMember(conversation, userId) {

  // Find the member object for the given user id
  const member = conversation.members.find(m => m.id.equals(userId._id));

  if(member) {
    // Member object exists -> user is a member
    return true; 
  } else {
    // Member not found -> user is not a member
    return false;
  }

}

//check if user is Owner or Admin
function isOwnerOrAdmin(conversation, userId) {

  const member = conversation.members.find(m => m.id.equals(userId._id));

  if(member) {

    // Check member type
    if(member.type === 1 || member.type === 2) {
      return true;
    } else {
      return false; 
    }

  } else {  
    return false; 
  }

}

//check if user is Owner
function isOwner(conversation, userId) {

  const member = conversation.members.find(m => m.id.equals(userId._id));

  if(member) {

    // Check member type
    if(member.type === 1) {
      return true;
    } else {
      return false; 
    }

  } else {  
    return false; 
  }

}

//check if user is official member
function isOfficialMember(conversation, userId) {

  const member = conversation.members.find(m => m.id.equals(userId._id));

  if(member) {
    // Check member type & ownerAccepted
    if(member.type === 1 || member.type === 2 || member.type === 3 && ownerAccepted === true) {
      return true;
    } else {
      return false; 
    }
  } else {  
    return false; 
  }

}

export default conversationRouter;