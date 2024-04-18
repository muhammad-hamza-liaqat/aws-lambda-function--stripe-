import yup from "yup";
import StatusCodes from "http-status-codes";
import { MongoClient } from "mongodb";

export const DBConn = async () => {
  try {
    const encryptedClient = new MongoClient(process.env.MONGODB_URL, {});
    await encryptedClient.connect();
    console.log("db connected");
    return encryptedClient;
  } catch (err) {
    console.error("Database connection error:", err);
    throw err;
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
    console.error("An error occurred:", error.message);
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({
        message: "Something Went Wrong",
        error: error.message,
      }),
    };
  }
};

export const catchTryAsyncErrors = (action) => async (queryParams, DB) => {
  try {
    const result = await action(queryParams, DB);
    return result;
  } catch (error) {
    console.log("catchAsyncError", error?.message || error);
    return catchError(error);
  }
};