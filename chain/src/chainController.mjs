import StatusCodes from "http-status-codes";
import {
  HTTPError,
  HTTPResponse,
  DBConn,
  catchTryAsyncErrors,
  createRootNodeHelper,
} from "./helper.mjs";
import { ObjectId } from "mongodb";

export async function handler(event) {
  let client;
  try {
    client = await DBConn();
    const DB = client.db(process.env.DB_NAME);

    const method = event.httpMethod;
    const path = event.path;
    const pathParams = event.pathParameters;
    const body = event.body;
    const queryParams = event.queryStringParameters || {};

    switch (method) {
      case "GET":
        if (path === "/getAllChain") {
          return await catchTryAsyncErrors(getAllChains)(DB, queryParams);
        } else if (
          path.startsWith("/getChainById/") &&
          pathParams &&
          pathParams.id
        ) {
          return await catchTryAsyncErrors(getChainById)(DB, pathParams.id);
        }
        break;
      case "POST":
        if (path === "/addChain") {
          return await catchTryAsyncErrors(addChain)(DB, body);
        }
        break;
      case "PUT":
        if (path.startsWith("/updateChain/") && pathParams && pathParams.id) {
          return await updateChain(DB, pathParams.id, body);
        } else if (
          path.startsWith("/pauseChain/") &&
          pathParams &&
          pathParams.id
        ) {
          return await catchTryAsyncErrors(pauseChain)(DB, pathParams.id);
        }
        break;
      case "DELETE":
        if (path.startsWith("/deleteChain/") && pathParams && pathParams.id) {
          return await catchTryAsyncErrors(deleteChain)(DB, pathParams.id);
        }
        break;
      case "PATCH":
        if (
          path.startsWith("/updateChainStatus/") &&
          pathParams &&
          pathParams.id &&
          pathParams.status
        ) {
          return await updateChainStatus(DB, pathParams.id, pathParams.status);
        }
      default:
        return {
          statusCode: StatusCodes.METHOD_NOT_ALLOWED,
          body: JSON.stringify({
            message: "Endpoint not allowed",
          }),
        };
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({ message: "Something Went Wrong", error: error }),
    };
  }
}

export const getAllChains = async (DB, queryParams) => {
  const page = Number(queryParams.page) || 1;
  const limit = Number(queryParams.limit) || 10;
  const skip = (page - 1) * limit;

  const chainData = await DB.collection("chains")
    .aggregate([{ $skip: skip }, { $limit: limit }])
    .toArray();

  const totalChainsCount = await DB.collection("chains").countDocuments();

  let totalInvestment = 0;
  for (const chain of chainData) {
    const collectionName = `treeNodes${chain.name}`;
    const rootNode = await DB.collection(collectionName).findOne({
      _id: new ObjectId(chain.rootNode),
    });
    const totalMembers = rootNode?.totalMembers || 0;
    const chainInvestment = totalMembers * chain.seedAmount;
    chain.investment = chainInvestment;
    totalInvestment += chainInvestment;
  }

  let response = new HTTPResponse("Success", {
    chainData,
    count: totalChainsCount,
    totalInvestment: totalInvestment,
  });

  return {
    statusCode: StatusCodes.OK,
    body: JSON.stringify(response),
  };
};

export const getChainById = async (DB, id) => {
  const chain = await DB.collection("chains").findOne({
    _id: new ObjectId(id),
  });
  if (!chain) {
    error = new HTTPError("Chain not found!", StatusCodes.NOT_FOUND);
    return {
      statusCode: StatusCodes.CONFLICT,
      body: JSON.stringify(error),
    };
  }

  let response = new HTTPResponse("SuccessFuly fetched Chain", chain);

  return {
    statusCode: StatusCodes.OK,
    body: JSON.stringify(response),
  };
};

export const addChain = async (DB, body) => {
  let error, response;
  const chainCollection = await DB.collection("chains");

  const { name, user } = JSON.parse(body);

  const existingChain = await chainCollection.findOne({ name: name });
  if (existingChain) {
    error = new HTTPError(
      "Chain with that name already exists!",
      StatusCodes.CONFLICT
    );

    return {
      statusCode: StatusCodes.CONFLICT,
      body: JSON.stringify(error),
    };
  }

  const currentDate = new Date();
  const createChainData = {
    name: name,
    user: new ObjectId(user),
    status: "Enabled",
    isPause: false,
    isDelete: false,
    createdAt: currentDate,
    updatedAt: currentDate,
  };

  const insertChain = await chainCollection.insertOne(createChainData);
  let chain = await chainCollection.findOne({
    _id: new ObjectId(insertChain.insertedId),
  });

  const rootNode = await createRootNodeHelper(DB, chain);
  chain = await chainCollection.findOneAndUpdate(
    { _id: chain._id },
    { $set: { rootNode: new ObjectId(rootNode?._id) } },
    { returnDocument: "after" }
  );
  response = new HTTPResponse("Chain created successfully", chain);
  return {
    statusCode: StatusCodes.CREATED,
    body: JSON.stringify(response),
  };
};

export const updateChain = async (DB, id, body) => {
  let response, error;
  const { icon, parentPercentage } = JSON.parse(body);

  const updatedChain = await DB.collection("chains").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { icon, parentPercentage } },
    { returnDocument: "after" }
  );

  if (updatedChain) {
    response = new HTTPResponse("Chain updated successfully!", updatedChain);
    return {
      statusCode: StatusCodes.OK,
      body: JSON.stringify(response),
    };
  } else {
    error = new HTTPError(
      "Chain with that ID not found!",
      StatusCodes.CONFLICT
    );

    return {
      statusCode: StatusCodes.NOT_FOUND,
      body: JSON.stringify(error),
    };
  }
};

export const deleteChain = async (DB, id) => {
  let response, error;

  const updatedChain = await DB.collection("chains").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { isDelete: true } },
    { new: true }
  );

  if (updatedChain) {
    response = new HTTPResponse("Success", updatedChain);

    return {
      statusCode: StatusCodes.OK,
      body: JSON.stringify(response),
    };
  } else {
    error = new HTTPError(
      "Chain with that ID not found!",
      StatusCodes.CONFLICT
    );
    return {
      statusCode: StatusCodes.CONFLICT,
      body: JSON.stringify(error),
    };
  }
};

export const pauseChain = async (DB, id) => {
  let response, error;

  const chain = await DB.collection("chains").findOne({
    _id: new ObjectId(id),
  });
  if (!chain) {
    error = new HTTPError(
      "Chain with that ID not found!",
      StatusCodes.NOT_FOUND
    );
    return {
      statusCode: StatusCodes.NOT_FOUND,
      body: JSON.stringify(error),
    };
  }

  const updatedChain = await DB.collection("chains").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { isPause: !chain["isPause"] } },
    { returnDocument: "after" }
  );
  response = new HTTPResponse("Success", updatedChain);
  return {
    statusCode: StatusCodes.OK,
    body: JSON.stringify(response),
  };
};

export const updateChainStatus = async (DB, id, status) => {
  const updatedChain = await DB.collection("chains").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { status } },
    { new: true }
  );
  if (!updatedChain) {
    response = new HTTPResponse("Chain not found");
    return res.status(StatusCodes.NOT_FOUND).json(response);
  }
  let response = new HTTPResponse("Success", updatedChain);
  return {
    statusCode: StatusCodes.OK,
    body: JSON.stringify(response),
  };
};
