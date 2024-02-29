
import express from 'express';
import expressAsyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import { isAuth, generateId, generateToken, generateChatToken} from '../utils.js';
import { now } from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';


const userRouter = express.Router();

const defaultBackground_img = "https://test3.stechvn.org/api/file/3504639c8-8a24-11ee-9529-0242c0a83003.Grey_and_Brown_Modern_Beauty_Salon_Banner_20231024_124517_0000.svg"
const defaultAvatar = "https://test3.stechvn.org/api/file/318323afa-8a24-11ee-a1eb-0242c0a83003.Circle_user.svg"

userRouter.get(
    '/',
    expressAsyncHandler(async (req, res) => {
        const users = await User.find({});
        res.send(users);
      })
)

function isBcryptHash(password) {
  try {
    const rounds = bcrypt.getRounds(password);
    return rounds > 0;
} catch (error) {
    return false; // If not in bcrypt encrypted string will come error
}
}

userRouter.post(
    '/register',
    expressAsyncHandler(async (req, res) => {
  
        // Check if password is not in bcrypt encrypted form
        if (!isBcryptHash(req.body.password)) {
          console.log(req.body.password)
          return res.status(400).send({
            error_code: "INVALID_INPUT",
            message: "Bad request!",
            success: false,
            error: [{
              field: "password",
              message: "Password must be bcrypt encrypted"  
            }]
          });
        } else {
          let errors = [];

          // Check if username is taken
          const userExists = await User.findOne({username: req.body.username});
          if (userExists) {
              errors.push({
              field: 'username',
              message: 'Username already used!'
              });
          }
  
          // Check if email is taken
          const emailExists = await User.findOne({email: req.body.email});
          if (emailExists) {
              errors.push({
              field: 'email', 
              message: 'Email already used!'
              });
          }
          
  
          // If errors, return 400 with error response body
          if (errors.length > 0) {
              return res.status(400).send({
              message: "Bad request!",
              error_code: "INVALID_INPUT",
              success: false,
              error: errors 
              });
          }
        }
    

        // Register user
        const newUser = new User({
          name: req.body.name,
          username: req.body.username,
          email: req.body.email,
          password: req.body.password,
          avatar: defaultAvatar,
          background_img: defaultBackground_img,
          publicKey: "publicKey",
          privateKey: "privateKey",
          last_login: now(),
          userSetting: [
            {
              type: 1,
              value: true
            }
          ]
        });
        const user = await newUser.save();
        res.status(200).send({
          message: "Succsess",
          success: true,
        });
      })

)
function findUser(id) {

  return User.findOne({
    $or: [
      {email: id},
      {username: id}
    ]
  });

}

userRouter.get(
  '/login/:email_or_username_or_user_id',
  expressAsyncHandler(async (req, res) => {
  const user = await findUser(req.params.email_or_username_or_user_id);
  if(!user) {
    return res.status(404).send({
      message: "Không tìm thấy!",
      error_code: "NOT_FOUND",
      success: false,
    });
  }
   // Generate key pair    
   const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096, // bits - standard for RSA keys
    publicKeyEncoding: {
      type: 'pkcs1', // "Public Key Cryptography Standards 1" 
      format: 'pem'  // Most common formatting choice
    },
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem'  
    }
  });
  // Get public & private key
  const publicKey = keyPair.publicKey;
  const privateKey = keyPair.privateKey; 
  // Update user's public key & private key
  user.publicKey = publicKey;
  user.privateKey = privateKey;
  // Save updated user 
  await user.save();
  // Return keys    
  res.send({
    message: 'Success',
    success: true,     
    publicKey
  });

  })
)

function decryptRsa(privateKey, encrypted) {
  try {
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING  
      },
      encrypted
    );
    
    return decrypted.toString();
  } catch (error) {
    // Log error  
    console.error("Decryption error", error);

    // Throw custom error
    const customError = {
       error_code: 'ENCRYPT_INVALID',
       message: 'Invalid decryption',
       success: false
    };
    
    throw customError;
  }
}

function isValidEncryption(data) {
  // Validate base64 string  
  const isValidBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data);
  if (!isValidBase64) {
    return false; 
  }

  // Try to decode buffer  
  try {
    Buffer.from(data, 'base64'); 
  } catch (err) {
    return false;
  }

  return true;
}

userRouter.post(
    '/login',
    expressAsyncHandler(async (req, res) => {
    const user = await findUser(req.body.usernameOrEmail);
    if(!user) {
      return res.status(401).send({
        message: "Wrong username or password!",
        error_code: "WRONG_INPUT",
        success: false,
      });
    }

    // Generate tokens
    const token = generateToken(user);
    const chatToken = generateChatToken(user);

    // Verify tokens to get exp claims
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const expiredAt = decoded.exp * 1000;

    const chatDecoded = jwt.verify(chatToken, process.env.JWT_CHAT_SECRET);  
    const chatExpiredAt = chatDecoded.exp * 1000;


    // Get user's privateKey key
    const privateKey = user.privateKey;
    // console.log("user.privateKey ",user.privateKey)
    // console.log("req.body.password",req.body.password)
    const encrypted = Buffer.from(req.body.password, 'base64');
    // console.log("encrypted",encrypted)
    if (!isValidEncryption(req.body.password)) {
      return res.status(400).json({
         error_code: 'INVALID_INPUT',
         message: 'Invalid encryption format'  
      });
    }
    let decryptedPassword; 

    // Decrypt password
      try {
        decryptedPassword = decryptRsa(privateKey, encrypted); 
        // console.log("decryptedPassword",decryptedPassword)         
      } catch (error) {
        if (error.error_code) { 
          // Custom error from decryptRsa
          res.status(400).json(error);
      
        } else {
          // Unknown error
          res.status(500).json({ error }); 
        }
      }
    
    
    //Compare the decrypted password with the bcrypt password in the database
    bcrypt.compare(decryptedPassword, user.password, async (err, result) => {
      if (err) {
          console.error(err);
      } else if (!result) {
             // Update user's public key & private key
              user.publicKey = "publicKey";
              user.privateKey = "privateKey";
              user.last_login = now();
              // Save updated user 
              await user.save();
            res.status(200).send({
              message: 'Success',
              success: true,
              data: {
                token: token,
                expired_at: expiredAt,
                chat_token: chatToken,
                chat_expired_at: chatExpiredAt,
                user: {
                  avatar: user.avatar,
                  name: user.name,
                  id: user._id,
                  created_at: user.createdAt,
                  updated_at: user.updatedAt,
                  last_login: user.last_login,
                  background_img: user.background_img
                }
              }
            });
          } else {
            return res.status(401).send({
              message: "Wrong username or password!",
              error_code: "WRONG_INPUT",
              success: false,
            });
          }
      
      });

    })
)

export default userRouter;

