import User from "./user.model.mjs";
import * as yup from "yup";
import mongoose from "mongoose";
import StatusCodes from "http-status-codes";
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
  code;
  details;

  constructor(message = "Error", errorCode, details = []) {
    super();
    this.message = message;
    this.code = errorCode;
    this.details = details;
  }
}
export class HTTPResponse {
  message;
  data;

  constructor(message = "Success", data) {
    this.message = message;
    this.data = data;
  }
}

//Validation Schema
export const chainSchema = yup.object().shape({
  name: yup.string().required("Name is required"),
  icon: yup.string(),
  seedAmount: yup.number().required("Seed Amount is required"),
  childNodes: yup.number().required("Child Nodes is required"),
  parentPercentage: yup.number().required("Parent Percentage is required"),
});

//Catch Error Function
export const catchError = async (error) => {
  if (error instanceof yup.ValidationError) {
    const validationErrors = {};
    error.inner.forEach(err => {
      validationErrors[err.path] = err.message;
    });
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({ errors: validationErrors }),
    };
  } else {
    console.error("An error occurred:", error);
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({ message: "Something Went Wrong", error: error }),
    };
  }
}

//Token Handler
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


