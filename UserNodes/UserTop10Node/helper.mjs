import yup from "yup";
import StatusCodes from "http-status-codes";
import { MongoClient } from "mongodb";

export const DBConn = async () => {
  try {
    const encryptedClient = new MongoClient(process.env.MONGODB_URL, {});
    await encryptedClient.connect();
    const DB = encryptedClient.db(process.env.DB_NAME);
    console.log("db connected");
    return DB;
  } catch (err) {
    console.error("Database connection error:", err);
    throw err;
  }
};

export class HTTPError extends Error {
  constructor(message = "Error", errorCode, details = []) {
    super();
    this.message = message;
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

export const catchTryAsyncErrors = (action) => async (event) => {
  try {
    const result = await action(event);
    return result;
  } catch (error) {
    console.log("catchAsyncError", error?.message || error);
    if (error instanceof yup.ValidationError) {
      const validationErrors = [];
      error.inner.forEach((err) => {
        validationErrors.push(err.message);
      });
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        body: JSON.stringify({ error: validationErrors }),
      };
    }

    let err = new HTTPError(
      "Something Went Wrong",
      StatusCodes.INTERNAL_SERVER_ERROR,
      error?.message || error
    );
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify(err),
    };
  }
};
