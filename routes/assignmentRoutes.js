import express from 'express';
import expressAsyncHandler from 'express-async-handler';
import Assignment from '../models/assignmentModel.js';
import { isAuth} from '../utils.js';
import { now } from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import Conversation from '../models/conversationModel.js';


const assignmentRouter = express.Router();

//Create assignment
assignmentRouter.post('/:conversationId', isAuth, async (req, res) => {
  try {
    const {conversationId } = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId)
    const conversation = await Conversation.findById(conversationId);
    let isPinned = false; 
      if(req.body.isPinned !== undefined) {
        isPinned = req.body.isPinned;
      }
    // Validate title
    if(!req.body.title) {
      return res.status(400).send({message: 'Title is required'});
    }

    if(typeof req.body.title !== 'string') {
      return res.status(400).send({message: 'Title must be a string'});   
    }

    if(req.body.title.length > 20) {
      return res.status(400).send({message: 'Title must be less than 20 characters'});
    }

    // Validate content 
    if(!req.body.content) {
      return res.status(400).send({message: 'Content is required'});
    }

    if(typeof req.body.content !== 'string') {
      return res.status(400).send({message: 'Content must be a string'});
    }

    if(req.body.content.length > 50) {
      return res.status(400).send({message: 'Content must be less than 50 characters'});  
    }

    // Validate assignTo
    if(!req.body.assignTo) {
      return res.status(400).send({message: 'assignTo is required'}); 
    } 

    if(!Array.isArray(req.body.assignTo)) {
      return res.status(400).send({message: 'assignTo must be an array'});
    }

    // Check each ID  
    const invalidAssignUsers = req.body.assignTo.filter(userId => {
      return !isMember(conversation, userId) 
    });

    if(invalidAssignUsers.length > 0) {
      return res.status(400).send({message: 'One or more assignTo users are not valid members'})
    }

    // Validate deadline
    const now = Date.now();

    if(!req.body.deadline) {
      return res.status(400).send({message: 'deadline is required'});
    } 

    if(req.body.deadline <= now) {
      return res.status(400).send({message: 'deadline must be in future'}); 
    }


    // If all checks pass, create assignment
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
    } else if(!req.body) {
        return res.status(400).send({
          message: "Bad request.",  
          status: 400
        });
    } else if (req.body.isPinned === true || req.body.isPinned === false ||  req.body.isPinned === undefined ){
          //Find setting allows creating assignment
          const setting = conversation.conversationSetting.find(s => s.type === 10);
          //Find setting allows pinning message
          const settingPin = conversation.conversationSetting.find(s => s.type === 3);

          //Allow creating assignment
          if(setting.value === true){
              //Allow pinning assignment
              if(settingPin.value === true) {
                // Lookup user objects
                const assignUsers = await User.find({
                  _id: { $in: req.body.assignTo } 
                });

                const trackUsers = await User.find({
                  _id: { $in: req.body.tracking }  
                });

                // Initialize arrays
                const assignTo = assignUsers.map(u => ({
                  id: u._id,
                  username: u.username,
                  avatar: u.avatar
                }));

                const tracking = trackUsers.map(u => ({
                  id: u._id,
                  username: u.username, 
                  avatar: u.avatar  
                }));
                
                //Create assignment
                const newAssignment = new Assignment({
                  conversationId: conversationId,
                  title: req.body.title,
                  content: req.body.content,
                  assigner:{
                    username: user.username,
                    avatar: user.avatar,
                    id: user._id
                  },
                  assignTo: assignTo,
                  tracking: tracking,
                  deadline: req.body.deadline,
                  isPinned: isPinned,
                })
  
                if(isPinned) {
  
                  // If pinned, update conversation  
                  await Conversation.updateOne(
                    { _id: conversationId }, 
                    { $push: { assignmentPinned: newAssignment._id } }  
                  );
                  
                }
                await newAssignment.save();
                res.status(200).send({
                  message: 'Succsess', 
                  status: 200,
                  id: newAssignment._id
                });
              } else {
                //Dont allow pinning assignment


                // Lookup user objects
                const assignUsers = await User.find({
                  _id: { $in: req.body.assignTo } 
                });

                const trackUsers = await User.find({
                  _id: { $in: req.body.tracking }  
                });

                // Initialize arrays
                const assignTo = assignUsers.map(u => ({
                  id: u._id,
                  username: u.username,
                  avatar: u.avatar
                }));

                const tracking = trackUsers.map(u => ({
                  id: u._id,
                  username: u.username, 
                  avatar: u.avatar  
                }));

                //Create assignment
                const newAssignment = new Assignment({
                  conversationId: conversationId,
                  title: req.body.title,
                  content: req.body.content,
                  assigner:{
                    username: user.username,
                    avatar: user.avatar,
                    id: user._id
                  },
                  assignTo: assignTo,
                  tracking: tracking,
                  deadline: req.body.deadline,
                  isPinned: false,
                })
                await newAssignment.save();
                res.status(200).send({
                  message: 'Succsess', 
                  status: 200,
                  id: newAssignment._id
                })
              }
            //Not allow creating assignment
          } else if(setting.value === false && isOwnerOrAdmin(conversation, userId)) {
                // Lookup user objects
                const assignUsers = await User.find({
                  _id: { $in: req.body.assignTo } 
                });

                const trackUsers = await User.find({
                  _id: { $in: req.body.tracking }  
                });

                // Initialize arrays
                const assignTo = assignUsers.map(u => ({
                  id: u._id,
                  username: u.username,
                  avatar: u.avatar
                }));

                const tracking = trackUsers.map(u => ({
                  id: u._id,
                  username: u.username, 
                  avatar: u.avatar  
                }));

                //Create assignment
                const newAssignment = new Assignment({
                  conversationId: conversationId,
                  title: req.body.title,
                  content: req.body.content,
                  assigner:{
                    username: user.username,
                    avatar: user.avatar,
                    id: user._id
                  },
                  assignTo: assignTo,
                  tracking: tracking,
                  deadline: req.body.deadline,
                  isPinned: isPinned,
              })
              await newAssignment.save();

              if(isPinned) {

                // If pinned, update conversation  
                await Conversation.updateOne(
                  { _id: conversationId }, 
                  { $push: { assignmentPinned: newAssignment._id } }  
                );
                
              }
              res.status(200).send({
                message: 'Succsess', 
                status: 200,
                id: newAssignment._id
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

//Accept assignment
assignmentRouter.put('/:id/accept', isAuth, async (req, res) => {
  try {
    const {id} = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId)
    const assignment = await Assignment.findById(id);

    if (!user) {
      return res.status(404).send({
        data: "User not found.",
        message: "Not found.",
        status: 404
      });
    }
    // Check if user is assigned
    const isAssigned = assignment.assignTo.find(u => u.id.equals(userId));

    
    if (!assignment ) {
      return res.status(404).send({
        data: "Assignment not found.",
        message: "Not found.",
        status: 404
      });
    } else if(!isAssigned) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else {

      // Add user to acceptedBy 
      assignment.acceptedBy.push({
        id: userId, 
        username: user.username,
        avatar: user.avatar
      });

      await assignment.save();
      return res.status(200).send({
        message: 'Succsess',   
        status: 200
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

//Complete assignment
assignmentRouter.put('/:id/complete', isAuth, async (req, res) => {
  try {
    const {id} = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId)
    const assignment = await Assignment.findById(id);

    if (!user) {
      return res.status(404).send({
        data: "User not found.",
        message: "Not found.",
        status: 404
      });
    }
    // Check if user accepted assignment
    const isAccepted = assignment.acceptedBy.find(u => u.id.equals(userId));

    
    if (!assignment ) {
      return res.status(404).send({
        data: "Assignment not found.",
        message: "Not found.",
        status: 404
      });
    } else if(!isAccepted) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else {

      // Add user to completedBy 
      assignment.completedBy.push({
        id: userId, 
        username: user.username,
        avatar: user.avatar
      });

      await assignment.save();
      return res.status(200).send({
        message: 'Succsess',   
        status: 200
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

//Reopen assignment
assignmentRouter.put('/:id/reopen', isAuth, async (req, res) => {
  try {
    const {id} = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId)
    const assignment = await Assignment.findById(id);

    if (!user) {
      return res.status(404).send({
        data: "User not found.",
        message: "Not found.",
        status: 404
      });
    }
    // Check if user completed assignment
    const isCompleted = assignment.completedBy.find(u => u.id.equals(userId));

    
    if (!assignment ) {
      return res.status(404).send({
        data: "Assignment not found.",
        message: "Not found.",
        status: 404
      });
    } else if(!isCompleted) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else {

      // Remove user from completedBy
      await Assignment.updateOne(
        { _id: assignmentId },
        { $pull: { completedBy: { id: userId } } } 
      );

      // Add user to reopenedBy 
      assignment.reopenedBy.push({
        id: userId, 
        username: user.username,
        avatar: user.avatar
      });

      await assignment.save();
      return res.status(200).send({
        message: 'Succsess',   
        status: 200
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

//Update assignment
assignmentRouter.put('/:id/update', isAuth, async (req, res) => {
  try {
    const {conversationId,id} = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId)
    const assignment = await Assignment.findById(id);
    const conversation = await Conversation.findById(assignment.conversationId);

    if (!user) {
      return res.status(404).send({
        data: "User not found.",
        message: "Not found.",
        status: 404
      });
    }

    if (!conversation) {
      return res.status(404).send({
        data: "Conversation not found.",
        message: "Not found.",
        status: 404
      });
    }
    
    // Check if user is assigner
    const isAssigner = assignment.assigner.id.equals(userId);

    // Validate title
    if(!req.body.title) {
      return res.status(400).send({message: 'Title is required'});
    }

    if(typeof req.body.title !== 'string') {
      return res.status(400).send({message: 'Title must be a string'});   
    }

    if(req.body.title.length > 20) {
      return res.status(400).send({message: 'Title must be less than 20 characters'});
    }

    // Validate content 
    if(!req.body.content) {
      return res.status(400).send({message: 'Content is required'});
    }

    if(typeof req.body.content !== 'string') {
      return res.status(400).send({message: 'Content must be a string'});
    }

    if(req.body.content.length > 50) {
      return res.status(400).send({message: 'Content must be less than 50 characters'});  
    }

    // Validate deadline
    const now = Date.now();

    if(!req.body.deadline) {
      return res.status(400).send({message: 'deadline is required'});
    } 

    if(req.body.deadline <= now) {
      return res.status(400).send({message: 'deadline must be in future'}); 
    }
    

    //If all check pass, update assignment
    if (!assignment ) {
      return res.status(404).send({
        data: "Assignment not found.",
        message: "Not found.",
        status: 404
      });
    } else if(!isAssigner) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else if (req.body.isPinned === true || req.body.isPinned === false ||  req.body.isPinned === undefined ){
        if(req.body.isPinned !== undefined)
        {
          //Find setting allows pinning assignment
          const settingPin = conversation.conversationSetting.find(s => s.type === 3);
          if(req.body.isPinned === true)
          {
            //Alow pinning assignment
            if(settingPin.value === true)
            {
              // Update assignment 
              assignment.isPinned = req.body.isPinned;
              assignment.title = req.body.title;
              assignment.content = req.body.content;
              assignment.deadline = req.body.deadline;
                // Save updated assignment
                await assignment.save();
    
              const isAssignmentPinned = conversation.find(assignment.id)
                if(!isAssignmentPinned) {
                  // If not pinned, update conversation  
                  await Conversation.updateOne(
                    { _id: conversation._id }, 
                    { $push: { assignmentPinned: assignment.id } }  
                  );
                }
                return res.status(200).send({
                  message: "Success.",  
                  status: 200,
                });
            } else if (settingPin.value === false && isOwnerOrAdmin(conversation, req.user)) {
              // Update assignment 
              assignment.isPinned = req.body.isPinned;
              assignment.title = req.body.title;
              assignment.content = req.body.content;
              assignment.deadline = req.body.deadline;
              // Save updated assignment
              await assignment.save();
    
            const isAssignmentPinned = conversation.find(assignment.id)
              if(!isAssignmentPinned) {
                // If not pinned, update conversation  
                await Conversation.updateOne(
                  { _id: conversation._id }, 
                  { $push: { assignmentPinned: assignment.id } }  
                );
              }
              return res.status(200).send({
                message: "Success.",  
                status: 200,
              });
            } else if (settingPin.value === false) {
              return res.status(403).send({
                message: "Permission denied.",  
                status: 403
              });
            }
          
          } else if (req.body.isPinned === false) {
            // Update assignment 
            assignment.isPinned = req.body.isPinned;
            assignment.title = req.body.title;
            assignment.content = req.body.content;
            assignment.deadline = req.body.deadline;
            // Save updated assignment
            await assignment.save();
    
          const isAssignmentPinned = conversation.find(assignment.id)
            if(isAssignmentPinned) {
              // If not pinned, remove from conversation  
              await Conversation.updateOne(
                { _id: conversation._id }, 
                { $pull: { assignmentPinned: assignment.id } }  
              );
            }
            return res.status(200).send({
              message: "Success.",  
              status: 200,
            });
          }
        } else {
          // Update assignment  
          assignment.title = req.body.title;
          assignment.content = req.body.content;
          assignment.deadline = req.body.deadline;
          // Save updated assignment
          await assignment.save();
          return res.status(200).send({
            message: "Success.",  
            status: 200,
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

//Get assignment by id
assignmentRouter.get(':conversationId/:id', isAuth, async (req, res) => {
  try {
    const {conversationId,id} = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId)
    const assignment = await Assignment.findById(id);
    const conversation = await Conversation.findById(conversationId);

    if (!user) {
      return res.status(404).send({
        data: "User not found.",
        message: "Not found.",
        status: 404
      });
    }
    
    if (!conversation) {
      return res.status(404).send({
        data: "Conversation not found.",
        message: "Not found.",
        status: 404
      });
    }
    
    //find assignment by id
    if (!assignment ) {
      return res.status(404).send({
        data: "Assignment not found.",
        message: "Not found.",
        status: 404
      });
    } else if(isOfficialMember(conversation, userId)) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else {
      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignment: assignment
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

//Get user's assigned assignments
assignmentRouter.get('assigned/:status', isAuth, async (req, res) => {
  try {
    const {status} = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).send({
        data: "User not found.",
        message: "Not found.",
        status: 404
      });
    }
    
    // Filter assignments where user is assignor
    const assignments = await Assignment.find({"assigner.id": userId});

    // Filter by status
    let results;
    if(status === 'pending') {
      /// Find assignments where acceptedBy is empty
      results = assignments.find(a => a.acceptedBy.length === 0);
      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
      });
    } else if (status === 'accepted') {
      // Find assignment where accepted not empty but completed empty
      results = assignments.find(
        a => a.acceptedBy.length > 0 && a.completedBy.length === 0  
      );
      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
      });
    } else if (status === 'done') {
      // Completed
      results = assignments.filter(a => a.completedBy.length > 0);  
      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
      });
    } else if (status === 'overdue') {  
      // Check deadline vs current time
      results = assignments.filter(a => a.deadline < Date.now());
      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
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

//Get user's todo assignments
assignmentRouter.get('todo/:status', isAuth, async (req, res) => {
  try {
    const {status} = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).send({
        data: "User not found.",
        message: "Not found.",
        status: 404
      });
    }
    
    // Filter assignments where user is assigned
    const assignments = await Assignment.find({'assignTo.id': userId});

    // Filter by status
    if (status === 'pending') {
      // Not in acceptedBy
      results = assignments.filter(a => {
        return !a.acceptedBy.some(u => u.id.equals(userId));  
      });

      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
      });

    } else if (status === 'accepted') {
      // In acceptedBy but not completedBy
      results = assignments.filter(a => {
        return (
          a.acceptedBy.some(u => u.id.equals(userId)) && 
          !a.completedBy.some(u => u.id.equals(userId))
        );
      });

      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
      });

    } else if (status === 'done') {
      // In completedBy
      results = assignments.filter(a => {
        return a.completedBy.some(u => u.id.equals(userId));
      });

      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
      });

    } else if (status === 'overdue') {
      // Past deadline
      results = assignments.filter(a => a.deadline < Date.now());

      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
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

//Get user's tracking assignments
assignmentRouter.get('tracking/:status', isAuth, async (req, res) => {
  try {
    const {status} = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).send({
        data: "User not found.",
        message: "Not found.",
        status: 404
      });
    }
    
    // Filter assignments where user is assignor
    const assignments = await Assignment.find({"tracking.id": userId});

    // Filter by status
    let results;
    if(status === 'pending') {
      /// Find assignments where acceptedBy is empty
      results = assignments.find(a => a.acceptedBy.length === 0);
      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
      });
    } else if (status === 'accepted') {
      // Find assignment where accepted not empty but completed empty
      results = assignments.find(
        a => a.acceptedBy.length > 0 && a.completedBy.length === 0  
      );
      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
      });
    } else if (status === 'done') {
      // Completed
      results = assignments.filter(a => a.completedBy.length > 0);  
      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
      });
    } else if (status === 'overdue') {  
      // Check deadline vs current time
      results = assignments.filter(a => a.deadline < Date.now());
      return res.status(200).send({
        message: 'Succsess',   
        status: 200,
        assignments: results
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

//Get assignment by conversation
assignmentRouter.get(':conversationId?limit', isAuth, async (req, res) => {
  try {
    const {conversationId} = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId)
    const conversation = await Conversation.findById(conversationId)


    if (!user) {
      return res.status(404).send({
        data: "User not found.",
        message: "Not found.",
        status: 404
      });
    }

    if (!conversation) {
      return res.status(404).send({
        data: "Conversation not found.",
        message: "Not found.",
        status: 404
      });
    }

    if(!isMember(conversation,userId)) {
      return res.status(403).send({
        message: "Permission denied.",  
        status: 403
      });
    } else {
      // Get limit from query params
    const limit = parseInt(req.query.limit) || 0;

    const assignments = await Assignment.find({conversationId})
      .limit(limit).select('-conversationId');

    return res.status(200).send(assignments)
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

//Endpoint Delete assignment
assignmentRouter.delete('/:id', isAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findById(id); 
    if(!assignment) {
      return res.status(404).send({
        message: "Not found.",
        satus: 404
      });
    } 
    const conversationId = note.conversationId
    const conversation = await Conversation.findById(conversationId);
    if(!conversation) {
      return res.status(404).send({
        message: "Conversation not found.",
        satus: 404
      });
    } else if(isOwnerOrAdmin(conversation,req.user) || !assignment.assigner.equals(userId)) {
      // If pinned, remove from conversation
      if(assignment.isPinned) {
        await Conversation.updateOne(
          { _id: assignment.conversationId },
          { $pull: { assignmentPinned: id }} 
        );
        }
        // Delete the note
        const deleteAssignment = await Assignment.findByIdAndDelete(id); 
  
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

////////////helper methods
//check if user chat_token is in conversation member
function isMember(conversation, userId) {

  // Find the member object for the given user id
  const member = conversation.members.find(m => m.id.equals(userId));

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

  const member = conversation.members.find(m => m.id.equals(userId));

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

  const member = conversation.members.find(m => m.id.equals(userId));

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

  const member = conversation.members.find(m => m.id.equals(userId));

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

export default assignmentRouter;