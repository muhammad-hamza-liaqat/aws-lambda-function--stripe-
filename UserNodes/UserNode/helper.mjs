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

export const generateCorsHeaders = () => {
  const allowedOrigins = [
    "http://localhost:5173",
    "https://main.d3gzu5jixwdx96.amplifyapp.com",
  ];

  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Origin": allowedOrigins.join(", "),
  };
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
  const headers = generateCorsHeaders();
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
        headers,
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
      headers,
      body: JSON.stringify(err),
    };
  }
};
