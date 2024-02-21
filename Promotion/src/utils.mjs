import User from "./user.model.mjs";
import * as yup from "yup";
import mongoose from "mongoose";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, UNAUTHORIZED } from "http-status-codes";
import jwt from "jsonwebtoken";

//DB Connection
export const DBConn = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log("DB connected");
  } catch (error) {
    console.error("An error occurred connecting DB:", error);
  }
};

//Error Handling
export class HTTPError extends Error {
  constructor(message = "Error", errorCode, details = []) {
    super(message);
    this.code = errorCode;
    this.details = details;
  }
}
export class HTTPResponse {
  constructor(message = "Success", data) {
    this.message = message;
    this.data = data;
  }
}

//Validation Schema
export const promotionSchema = yup.object({
  code: yup.string().required("Code is required"),
  duration: yup.object({
    start: yup.date(),
    end: yup.date(),
  }),
  noOfUser: yup.number(),
  noOfTime: yup.number(),
});

//CatchError Function
export const catchError = async (error) => {
  if (error instanceof yup.ValidationError) {
    const validationErrors = {};
    error.inner.forEach((err) => {
      validationErrors[err.path] = err.message;
    });
    return {
      statusCode: BAD_REQUEST,
      body: JSON.stringify({ errors: validationErrors }),
    };
  } else {
    console.error("An error occurred:", error);
    return {
      statusCode: INTERNAL_SERVER_ERROR,
      body: JSON.stringify({ message: "Something Went Wrong", error: error }),
    };
  }
};

//Auth Token
export const authToken = async (event) => {
  const headers = event.headers;
  const token = headers?.Authorization?.split(" ")[1];
  console.log('TOKEN:', token)
  if (!token) {
    throw new HTTPError("Token is missing", UNAUTHORIZED);
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded["_id"]).select("-password");
    event.user = user;
    return event;
  } catch (err) {
    throw new HTTPError("Token is expired or invalid", UNAUTHORIZED, err);
  }
};

