import yup from "yup";
import mongoose from "mongoose";
import StatusCodes from "http-status-codes";

export const DBConn = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log("DB connected");
  } catch (error) {
    console.error("An error occurred connecting DB:", error);
  }
};

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

export const chainSchema = yup.object().shape({
  name: yup.string().required("Name is required"),
  icon: yup.string(),
  seedAmount: yup.number().required("Seed Amount is required"),
  childNodes: yup.number().required("Child Nodes is required"),
  parentPercentage: yup.number().required("Parent Percentage is required"),
});

export const updateChainValidation = yup.object().shape({
  name: yup.string().required("Name is required"),
  icon: yup.string(),
  parentPercentage: yup.number().required("Parent Percentage is required"),
});

export const catchError = async (error) => {
  if (error instanceof yup.ValidationError) {
    const validationErrors = {};
    error.inner.forEach((err) => {
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
};


