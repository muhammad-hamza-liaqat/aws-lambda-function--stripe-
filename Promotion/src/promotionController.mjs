import Promotion from "./promotion.model.mjs";
import StatusCodes from "http-status-codes";
import { HTTPError, HTTPResponse, DBConn, promotionSchema, catchError, authToken } from "./utils.mjs";

export const handler = async (event) => {
  try {
    await authToken(event);
    await DBConn();
    const method = event.httpMethod;
    const path = event.path;
    const pathParams = event.pathParameters || {};
    const body = event.body;
    const queryParams = event.queryStringParameters || {};

    switch (method) {
      case "GET":
        if (path === "/getAllPromotions") {
          return await getAllPromotions(queryParams);
        } else if (path.startsWith("/getPromotionById/") && pathParams.id) {
          return await getPromotionById(pathParams.id);
        }
        break;
      case "POST":
        if (path === "/addPromotion") {
          return await addPromotion(body);
        }
        break;
      case "PUT":
        if (path.startsWith("/updatePromotion/") && pathParams.id) {
          return await updatePromotion(pathParams.id, body);
        } else if (path.startsWith("/pausePromotion/") && pathParams.id) {
          return await pausePromotion(pathParams.id);
        }
        break;
      case "DELETE":
        if (path.startsWith("/deletePromotion/") && pathParams.id) {
          return await deletePromotion(pathParams.id);
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

const getAllPromotions = async (queryParams) => {
  try {
    const page = Number(queryParams.page) || 1;
    const limit = Number(queryParams.limit) || 10;
    const skip = (page - 1) * limit;
    const promotions = await Promotion.find({}).skip(skip).limit(limit);
    const totalPromotionsCount = await Promotion.countDocuments();

    return {
      statusCode: StatusCodes.OK,
      body: JSON.stringify({
        message: "Success",
        data: {
          promotions,
          count: totalPromotionsCount,
        },
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

const getPromotionById = async (promotionId) => {
  try {
    if (!promotionId) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        body: JSON.stringify({
          error: "Invalid promotion ID provided",
        }),
      };
    }
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      return {
        statusCode: StatusCodes.NOT_FOUND,
        body: JSON.stringify({
          error: "Promotion not found",
        }),
      };
    }
    return {
      statusCode: StatusCodes.OK,
      body: JSON.stringify({
        message: "Success",
        data: promotion,
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

const addPromotion = async (requestBody) => {
  try {
    const requestData = JSON.parse(requestBody);
    await promotionSchema.validate(requestBody, { abortEarly: false });

    const { code } = requestData;
    let promotion = await Promotion.findOne({ code });
    if (promotion) {
      let error = new HTTPError(
        "Promotion with that code already exists!",
        StatusCodes.CONFLICT
      );
      return {
        statusCode: StatusCodes.CONFLICT,
        body: JSON.stringify(error),
      };
    }
    promotion = new Promotion(requestData);
    await promotion.save();
    let response = new HTTPResponse("Promotion created successfully!", promotion);
    return {
      statusCode: StatusCodes.CREATED,
      body: JSON.stringify(response),
    };
  } catch (error) {
    return await catchError(error);
  }
};

const updatePromotion = async (promotionId, requestBody) => {
  try {
    const requestData = JSON.parse(requestBody);
    await promotionSchema.validate(requestBody, { abortEarly: false });

    const updatedPromotion = await Promotion.findOneAndUpdate(
      { _id: promotionId },
      requestData,
      { new: true }
    );
    if (updatedPromotion) {
      const successResponse = {
        message: "Promotion updated successfully",
        data: updatedPromotion,
      };
      return {
        statusCode: StatusCodes.OK,
        body: JSON.stringify(successResponse),
      };
    } else {
      return {
        statusCode: StatusCodes.NOT_FOUND,
        body: JSON.stringify({
          error: "No promotion found with the provided ID",
        }),
      };
    }
  } catch (error) {
    return await catchError(error);
  }
};

const deletePromotion = async (promotionId) => {
  try {
    const deletedPromotion = await Promotion.findOneAndDelete({
      _id: promotionId,
    });
    if (deletedPromotion) {
      const successResponse = {
        message: "Promotion deleted successfully",
        data: deletedPromotion,
      };
      return {
        statusCode: StatusCodes.OK,
        body: JSON.stringify(successResponse),
      };
    } else {
      return {
        statusCode: StatusCodes.NOT_FOUND,
        body: JSON.stringify({
          error: "Promotion with the provided ID not found",
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

const pausePromotion = async (promotionId) => {
  try {
    const promotion = await Promotion.findById(promotionId).lean();
    console.log('promotion["isPaused"]', promotion["isPaused"]);

    const updatedPromotion = await Promotion.findOneAndUpdate(
      { _id: promotionId },
      { $set: { isPaused: !promotion["isPaused"] } },
      { new: true }
    );
    const successResponse = {
      message: "Promotion pause status updated successfully",
      data: updatedPromotion,
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
