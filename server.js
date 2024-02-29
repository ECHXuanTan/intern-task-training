import express from "express";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import userRouter from "./routes/userRoutes.js";
import conversationRouter from "./routes/conversationRoutes.js";
import assignmentRouter from "./routes/assignmentRoutes.js";

dotenv.config();

await mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('connected to db');
  })
  .catch((err) => {
    console.log(err.message);
  });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use('/api/auth', userRouter);
app.use('/conversations', conversationRouter);
app.use('/api/assignments', assignmentRouter);

const port = 5000;
app.listen(port, () => {
    console.log(`serve at http://localhost:${port}`)
})