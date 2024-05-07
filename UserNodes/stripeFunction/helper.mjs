import StatusCodes from "http-status-codes";
import DBConn from "./config.mjs";
import { ObjectId } from "mongodb";

export const generateCorsHeaders = () => {
  const allowedOrigins = [
    "http://localhost:5173",
    "https://main.d3gzu5jixwdx96.amplifyapp.com",
  ];

  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST",
    // "Access-Control-Allow-Origin": allowedOrigins.join(", "),
    "Access-Control-Allow-Origin": "*",
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
  let client;
  try {
    client = await DBConn();
    const resp = await action(event, client.DB);
    return resp;
  } catch (error) {
    console.log("error", error);
    const err = new HTTPError(
      "Something Went Wrong",
      StatusCodes.INTERNAL_SERVER_ERROR,
      error?.message || error
    );
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      headers,
      body: JSON.stringify(err),
    };
  } finally {
    if (client && client.client) {
      await client.client.close();
      console.log("DB Connection Closed!");
    }
  }
};
