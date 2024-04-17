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

export const chainSchema = yup.object().shape({
  name: yup.string().required("Name is required"),
  icon: yup.string(),
  seedAmount: yup.number().required("Seed Amount is required"),
  childNodes: yup.number().required("Child Nodes is required"),
  parentPercentage: yup.number().required("Parent Percentage is required"),
});

export const updateChainValidation = yup.object().shape({
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

export const createRootNodeHelper = async (DB, chain) => {
  try {
    const collectionName = chain.name;
    const currentDate = new Date();

    const rootNodeData = {
      value: 1,
      user: chain.user,
      chain: chain._id,
      mode: "SYSTEM",
      inviteAccepted: 0,
      reward: 0,
      parentReward: 0,
      inDirectChild: false,
      totalReferenceChild: 0,
      totalDirectChild: 0,
      totalMembers: 0,
      totalEarning: 0,
      level: 0,
      status: "Enabled",
      isDeleted: false,
      children: [],
      createdAt: currentDate,
      updatedAt: currentDate,
    };

    const addNode = await DB.collection(`treeNodes${collectionName}`).insertOne(
      rootNodeData
    );

    const qrCode = await generateQRCode(addNode.insertedId);

    const rootNode = await DB.collection(
      `treeNodes${collectionName}`
    ).findOneAndUpdate(
      { _id: addNode.insertedId },
      { $set: { qrCode } },
      { returnDocument: "after" }
    );

    return rootNode;
  } catch (error) {
    console.error("Error creating root node:", error);
    throw error;
  }
};

export const generateQRCode = async (nodeId) => {
  try {
    const fileName = `${nodeId}.png`;
    const baseURL = "http://localhost:5000/uploads/qrCode/";
    const imageURL = baseURL + fileName;
    return imageURL;
  } catch (error) {
    console.error("Error occurred at QR code controller:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error });
  }
};
