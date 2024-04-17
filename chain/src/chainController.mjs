import StatusCodes from "http-status-codes";
// import Chain from "./chain.model.mjs";
import {
  HTTPError,
  HTTPResponse,
  DBConn,
  chainSchema,
  catchError,
  updateChainValidation,
  catchTryAsyncErrors,
  createRootNodeHelper,
  generateQRCode,
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

    // console.log("object", body);

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
          return await updateChain(
            DB,
            pathParams.id,
            body
          );
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
        if (path.startsWith("/updateChainStatus/") && pathParams && pathParams.id && pathParams.status){
          return await updateChainStatus(DB, pathParams.id, pathParams.status)
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
  try {
    const page = Number(queryParams.page) || 1;
    const limit = Number(queryParams.limit) || 10;
    const skip = (page - 1) * limit;
    const chainData = await DB.collection("chains")
      .aggregate([{ $skip: skip }, { $limit: limit }])
      .toArray();
    const totalChainsCount = await DB.collection("chains").countDocuments();
    let totalInvestment = 0;
    // console.log("data=>", chainData);
    for (const chain of chainData) {
      const collectionName = `treeNodes${chain.name}`;
      const firstNode = await DB.collection(collectionName).findOne({
        _id: new ObjectId(chain.rootNode),
      });
      const totalMembers = firstNode?.totalMembers || 0;
      // console.log("first", firstNode);
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
  } catch (error) {
    console.error("An error occurred:", error);
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({ message: "Something Went Wrong", error: error }),
    };
  }
};

export const getChainById = async (DB, id) => {
  // console.log("{incoming _id}", id);
  try {
    if (!id) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        body: JSON.stringify({
          error: "Invalid chain ID provided",
        }),
      };
    }
    const chain = await DB.collection("chains").findOne({
      _id: new ObjectId(id),
    });
    if (!chain) {
      error = new HTTPError("Chain not found!", StatusCodes.NOT_FOUND);
      return res.status(StatusCodes.CONFLICT).json(error);
    }
    return {
      statusCode: StatusCodes.OK,
      body: JSON.stringify({
        message: "SuccessFuly fetched Chain",
        data: chain,
      }),
    };
  } catch (error) {
    console.error("An error occurred:", error);
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({ message: "Something Went Wrong", error: error }),
    };
  }
};

export const addChain = async (DB, body) => {
  try {
    let error, response;
    const chainData = await DB.collection("chains");

    const { name, user } = JSON.parse(body);

    const existingChain = await chainData.findOne({ name: name });
    if (existingChain) {
      error = {
        message: "Chain with that name already exists!",
      };
      return {
        statusCode: StatusCodes.CONFLICT,
        body: JSON.stringify(error),
      };
    }

    const userId = new ObjectId(user);
    const currentDate = new Date();
    const createChainData = {
      name: name,
      user: userId,
      isPause: false,
      createdAt: currentDate,
      updatedAt: currentDate,
    };

    const insertChain = await chainData.insertOne(createChainData);
    let chain = await chainData.findOne({
      _id: new ObjectId(insertChain.insertedId),
    });

    const rootNode = await createRootNodeHelper(DB, chain);
    chain = await chainData.findOneAndUpdate(
      { _id: chain._id },
      { $set: { rootNode: rootNode?._id } },
      { returnDocument: "after" }
    );
    response = new HTTPResponse("Chain created successfully", chain);
    return {
      statusCode: StatusCodes.CREATED,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("An error occurred:", error);
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({ message: "Something Went Wrong", error: error }),
    };
  }
};

export const updateChain = async (DB, id, body) => {
  console.log("id", id);
  console.log("body", body);
  const { name, icon, parentPercentage } = JSON.parse(body);
  if (!body) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({
        error: "Request body is missing.",
      }),
    };
  }

  if (name) {
    const existingChainWithSameName = await DB.collection("chains").findOne({
      name: name,
      _id: { $ne: id },
    });
    if (existingChainWithSameName) {
      return {
        statusCode: StatusCodes.CONFLICT,
        body: JSON.stringify({
          error: "Chain with that name already exists!",
        }),
      };
    }
  }

  const updatedChain = await DB.collection("chains").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: {  icon, parentPercentage } },
    { returnDocument: "after" }
  );

  if (updatedChain) {
    return {
      statusCode: StatusCodes.OK,
      body: JSON.stringify({
        response: "Chain updated successfully!",
        chain: updatedChain,
      }),
    };
  } else {
    return {
      statusCode: StatusCodes.NOT_FOUND,
      body: JSON.stringify({
        error: "Chain with that ID not found!",
      }),
    };
  }
};

export const deleteChain = async (DB, id) => {
  let response, error;
  console.log("{incoming _id}=>", id);
  if (!id) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({
        error: "chain _id not found",
      }),
    };
  }

  const updatedChain = await DB.collection("chains").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { isDelete: true } },
    { new: true }
  );

  if (!updatedChain) {
    return {
      statusCode: StatusCodes.NOT_FOUND,
      body: JSON.stringify({
        error: "Chain not found with the provided _id",
      }),
    };
  }

  response = new HTTPResponse("Success", updatedChain);
  return {
    statusCode: StatusCodes.OK,
    body: JSON.stringify({
      response: "chain deleted successfully!",
    }),
  };
};

export const pauseChain = async (DB, id) => {
  let response, error;
  console.log("{incoming_pause_id}=>", id);
  if (!id) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      body: JSON.stringify({
        error: "Chain _id not found",
      }),
    };
  }
  const chain = await DB.collection("chains").findOne({
    _id: new ObjectId(id),
  });
  if (!chain) {
    return {
      statusCode: StatusCodes.NOT_FOUND,
      body: JSON.stringify({
        error: "Chain not found with the provided _id",
      }),
    };
  }
  console.log('chain["isPause"]', chain["isPause"]);
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

export const updateChainStatus= async (DB, id, status) =>{
  console.log("status:", status);
  console.log("id", id);
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
    body: JSON.stringify(response)
  };
  
}
