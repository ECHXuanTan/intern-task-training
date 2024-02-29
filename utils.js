import jwt from 'jsonwebtoken';

import { v4 as uuidv4 } from 'uuid';

export function generateId() {

  let id = uuidv4().replace(/\-/g, ''); 
  
  id = id.slice(0, 8);
  id = id + '-' + id.slice(8, 12) + '-' + id.slice(12, 16) + '-' + id.slice(16, 28);
  return id.slice(0, 36); 
}

export const generateToken = (user) => {
    return jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: '1h',
      }
    );
  };

  export const generateChatToken = (user) => {
    return jwt.sign(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
      `${process.env.JWT_CHAT_SECRET}`,
      {
        expiresIn: '30d',
      }
    );
  };

  
  export const isAuth = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (authorization) {
      const token = authorization.slice(7, authorization.length); // Bearer XXXXXX
      jwt.verify(token, `${process.env.JWT_CHAT_SECRET}`, (err, decode) => {
        if (err) {
          console.log(err);
          res.status(400).send({ 
            data: "token",
            message: "Bad request.",
            status: 400
           });
        } else {
          req.user = decode;
          next();
        }
      });
    } else {
      res.status(400).send({ 
        data: "token",
        message: "Bad request.",
        status: 400
    });
    }
  };
  