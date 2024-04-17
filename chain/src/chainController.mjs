import StatusCodes from "http-status-codes";
import Chain from "./chain.model.mjs";
import {
  HTTPError,
  HTTPResponse,
  DBConn,
  chainSchema,
  catchError,
  updateChainValidation,
} from "./helper.mjs";

export async function handler(event) {
  try {
    await DBConn();
    const method = event.httpMethod;
    const path = event.path;
    const pathParams = event.pathParameters;
    const body = event.body;
    const queryParams = event.queryStringParameters || {};

    switch (method) {
      case "GET":
        if (path === "/getAllChain") {
          return await getAllChains(queryParams);
        } else if (
          path.startsWith("/getChainById/") &&
          pathParams &&
          pathParams.id
        ) {
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
        } else if (
          path.startsWith("/pauseChain/") &&
          pathParams &&
          pathParams.id
        ) {
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

export const getAllChains = async (queryParams) => {
  try {
    const page = Number(queryParams.page) || 1;
    const limit = Number(queryParams.limit) || 10;
    const skip = (page - 1) * limit;
    const chainData = await Chain.find({ isDelete: false })
      .skip(skip)
      .limit(limit);
    const totalChainsCount = await Chain.countDocuments({ isDelete: false });

    let response = new HTTPResponse("Success", {
      chains,
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

export const getChainById = async (chainId) => {
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
};

export const addChain = async (requestBody) => {
  try {
    const requestData = JSON.parse(requestBody);
    await chainSchema.validate(requestData, { abortEarly: false });

    const { name } = requestData;
    let chain = await Chain.findOne({ name });
    if (chain) {
      let error = new HTTPError(
        "A chain with the provided name already exists",
        StatusCodes.CONFLICT
      );
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
};

export const updateChain = async (chainId, requestBody) => {
  try {
    const requestData = JSON.parse(requestBody);
    const { name, icon, parentPercentage } = requestData;

    await updateChainValidation.validate(requestData, { abortEarly: false });

    if (name) {
      const existingChain = await Chain.findOne({
        name: name,
        _id: { $ne: chainId },
      });
      if (existingChain) {
        const response = new HTTPError(
          "Chain with that name already exists!",
          StatusCodes.CONFLICT
        );
        return {
          statusCode: StatusCodes.CONFLICT,
          body: JSON.stringify(response),
        };
      }
    }

    const updatedChain = await Chain.findOneAndUpdate(
      { _id: chainId },
      { name, icon, parentPercentage },
      { new: true }
    );

    if (updatedChain) {
      const response = new HTTPResponse(
        "Chain updated successfully!",
        updatedChain
      );
      return {
        statusCode: StatusCodes.OK,
        body: JSON.stringify(response),
      };
    } else {
      const error = new HTTPError(
        "Chain with that ID not found!",
        StatusCodes.NOT_FOUND
      );
      return {
        statusCode: StatusCodes.NOT_FOUND,
        body: JSON.stringify(error),
      };
    }
  } catch (error) {
    return await catchError(error);
  }
};

export const deleteChain = async (chainId) => {
  try {
    const existingChain = await Chain.findOne({ _id: chainId });

    if (!existingChain) {
      const errorResponse = {
        error: "Chain with that ID not found",
      };
      return {
        statusCode: StatusCodes.NOT_FOUND,
        body: JSON.stringify(errorResponse),
      };
    }

    if (existingChain.isDelete === true) {
      const alreadyDeletedResponse = {
        message: "Chain has been deleted already!",
        data: {
          _id: existingChain._id,
          name: existingChain.name,
          isDelete: existingChain.isDelete,
        },
      };
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        body: JSON.stringify(alreadyDeletedResponse),
      };
    }

    // Update the chain to mark it as deleted
    const updatedChain = await Chain.findOneAndUpdate(
      { _id: chainId },
      { $set: { isDelete: true } },
      { new: true }
    );

    const successResponse = {
      message: "Success",
      data: updatedChain,
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
};

export const pauseChain = async (chainId) => {
  try {
    const chain = await Chain.findById(chainId).lean();

    if (chain) {
      console.log('chain["isPause"]', chain["isPause"]);
      const updatedChain = await Chain.findOneAndUpdate(
        { _id: chainId },
        { $set: { isPause: !chain["isPause"] } },
        { new: true }
      );

      const successResponse = {
        message: "Success",
        data: updatedChain,
      };

      return {
        statusCode: StatusCodes.OK,
        body: JSON.stringify(successResponse),
      };
    } else {
      const errorResponse = {
        error: "Chain with that ID not found",
      };

      return {
        statusCode: StatusCodes.CONFLICT,
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
};