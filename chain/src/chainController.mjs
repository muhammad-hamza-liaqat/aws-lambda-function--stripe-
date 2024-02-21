import StatusCodes from "http-status-codes";
import Chain from "./chain.model.mjs";
import { HTTPError, HTTPResponse, DBConn, chainSchema, catchError, authToken } from "./utils.mjs";


export const handler = async (event) => {
  try {
    await DBConn();
    await authToken(event)
    const method = event.httpMethod;
    const path = event.path;
    const pathParams = event.pathParameters;
    const body = event.body;
    const queryParams = event.queryStringParameters || {};

    switch (method) {
      case "GET":
        if (path === "/getAllChain") {
          return await getAllChains(queryParams);
        } else if (path.startsWith("/getChainById/") && pathParams && pathParams.id) {
          return await getChainById(pathParams.id);
        }
        break;
      case "POST":
        if (path === "/addChain") {
          return await addChain(body);
        }
        break;
      case "PUT":
        if (path.startsWith("/updateChain/") && pathParams && pathParams.id) {
          return await updateChain(pathParams.id, body);
        } else if (path.startsWith("/pauseChain/") && pathParams && pathParams.id) {
          return await pauseChain(pathParams.id);
        }
        break;
      case "DELETE":
        if (path.startsWith("/deleteChain/") && pathParams && pathParams.id) {
          return await deleteChain(pathParams.id);
        }
        break;
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
};

const getAllChains = async (queryParams) => {
  try {
    const page = Number(queryParams.page) || 1;
    const limit = Number(queryParams.limit) || 10;
    const skip = (page - 1) * limit;
    const chainData = await Chain.find({}).skip(skip).limit(limit);
    const totalChainsCount = await Chain.countDocuments();
    return {
      statusCode: StatusCodes.OK,
      body: JSON.stringify({
        message: "Chains fetched successfully",
        data: chainData,
        totalChainsCount: totalChainsCount,
        currentPage: page,
        totalPages: Math.ceil(totalChainsCount / limit),
      }),
    };
  } catch (error) {
    console.error("An error occurred:", error);
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({ message: "Something Went Wrong", error: error }),
    };
  }
}

const getChainById = async (chainId) => {
  try {
    if (!chainId) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        body: JSON.stringify({
          error: "Invalid chain ID provided",
        }),
      };
    }
    const chain = await Chain.findById(chainId);
    if (!chain) {
      return {
        statusCode: StatusCodes.NOT_FOUND,
        body: JSON.stringify({
          error: "Chain not found",
        }),
      };
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
}


const addChain = async (requestBody) => {
  try {
    const requestData = JSON.parse(requestBody);
    await chainSchema.validate(requestData, { abortEarly: false });

    const { name } = requestData;
    let chain = await Chain.findOne({ name });
    if (chain) {
      let error = new HTTPError("A chain with the provided name already exists", StatusCodes.CONFLICT);
      return {
        statusCode: StatusCodes.CONFLICT,
        body: JSON.stringify(error),
      };
    }
    chain = new Chain(requestData);
    await chain.save();
    let response = new HTTPResponse("Chain created successfully", chain);
    return {
      statusCode: StatusCodes.CREATED,
      body: JSON.stringify(response),
    };
  } catch (error) {
    return await catchError(error);
  }
}

const updateChain = async (chainId, requestBody) => {
  try {
    const requestData = JSON.parse(requestBody);
    await chainSchema.validate(requestData, { abortEarly: false });

    if (requestData.name) {
      const existingChain = await Chain.findOne({
        name: requestData.name,
        _id: { $ne: chainId },
      });
      if (existingChain) {
        const response = new HTTPError(
          "A chain with the provided name already exists",
          StatusCodes.CONFLICT
        );
        return {
          statusCode: StatusCodes.CONFLICT,
          body: JSON.stringify(response),
        };
      }
    }
    const updatedChain = await Chain.findOneAndUpdate({ _id: chainId }, requestData, {
      new: true,
    });
    if (updatedChain) {
      const successResponse = {
        message: "Chain updated successfully",
        data: updatedChain
      };
      return {
        statusCode: StatusCodes.OK,
        body: JSON.stringify(successResponse),
      };
    } else {
      const response = new HTTPError(
        "No chain found with the provided ID",
        StatusCodes.NOT_FOUND
      );
      return {
        statusCode: StatusCodes.NOT_FOUND,
        body: JSON.stringify(response),
      };
    }
  } catch (error) {
    return await catchError(error);
  }
}


const deleteChain = async (chainId) => {
  try {
    if (!chainId) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        body: JSON.stringify({
          error: "Invalid chain ID provided",
        }),
      };
    }
    const deletedChain = await Chain.findOneAndDelete({
      _id: chainId,
    });
    if (deletedChain) {
      const successResponse = {
        message: "Chain successfully deleted",
        data: deletedChain
      };
      return {
        statusCode: StatusCodes.OK,
        body: JSON.stringify(successResponse),
      };
    } else {
      const errorResponse = {
        error: "Chain with the provided ID not found",
      };
      return {
        statusCode: StatusCodes.NOT_FOUND,
        body: JSON.stringify(errorResponse),
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


const pauseChain = async (chainId) => {
  try {
    const chain = await Chain.findById(chainId).lean();
    console.log('chain["isPaused"]', chain["isPaused"]);

    const updatedChain = await Chain.findOneAndUpdate(
      { _id: chainId },
      { $set: { isPaused: !chain["isPaused"] } },
      { new: true }
    );
    const successResponse = {
      message: "Chain pause status updated successfully",
      data: updatedChain
    };
    return {
      statusCode: StatusCodes.OK,
      body: JSON.stringify(successResponse),
    };
  } catch (error) {
    console.error("An error occurred:", error);
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: JSON.stringify({ message: "Something Went Wrong", error: error }),
    };
  }
}