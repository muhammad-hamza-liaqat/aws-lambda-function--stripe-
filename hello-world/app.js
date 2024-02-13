// const axios = require('axios')
// const url = 'http://checkip.amazonaws.com/';
let response;

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */

import mongoose from "mongoose";

const chainSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    icon: {
      type: String,
    },
    seedAmount: {
      type: Number,
      required: true,
    },
    childNodes: {
      type: Number,
      required: true,
    },
    parentPercentage: {
      type: Number,
      required: true,
    },
    isPause: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Chain = mongoose.model("Chain", chainSchema);


exports.lambdaHandler = async (event, context) => {
    try {
        // const ret = await axios(url);
        response = {
            'statusCode': 200,
            'body': JSON.stringify({
                message: 'hello world',
                // location: ret.data.trim()
            })
        }
    } catch (err) {
        console.log(err);
        return err;
    }

    return response
};



// exports.createChainHandler = async (event, context) => {
//     try {
//         const { name } = JSON.parse(event.body); // Parse the request body to get the name
//         let chain = await Chain.findOne({ name });
//         if (chain) {
//             let error = new HTTPError(
//                 "Chain with that name already exists!",
//                 StatusCodes.CONFLICT
//             );
//             return {
//                 statusCode: StatusCodes.CONFLICT,
//                 body: JSON.stringify(error),
//             };
//         }
//         chain = new Chain({
//             ...JSON.parse(event.body), // Create a new Chain instance from the request body
//         });
//         await chain.save(); // Save the new Chain
//         let response = new HTTPResponse("Chain created successfully!", chain);
//         return {
//             statusCode: StatusCodes.CREATED,
//             body: JSON.stringify(response),
//         };
//     } catch (err) {
//         console.log(err);
//         return {
//             statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
//             body: JSON.stringify(err),
//         };
//     }
// };

// exports.getChainByIdHandler = async (event, context) => {
//     try {
//         const _id = event.pathParameters.id; // Extract the id from the path parameters
//         const chain = await Chain.findById(_id); // Find the chain by id
//         if (!chain) {
//             return {
//                 statusCode: StatusCodes.NOT_FOUND,
//                 body: JSON.stringify({
//                     message: "Chain not found",
//                 }),
//             };
//         }
//         let response = new HTTPResponse("Success", chain);
        
//         return {
//             statusCode: StatusCodes.OK,
//             body: JSON.stringify(response),
//         };
//     } catch (err) {
//         console.log(err);
//         return {
//             statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
//             body: JSON.stringify(err),
//         };
//     }
// };

// exports.getAllChainsHandler = async (event, context) => {
//     try {
//         const page = Number(event.queryStringParameters.page) || 1; // Extract page from query parameters
//         const limit = Number(event.queryStringParameters.limit) || 10; // Extract limit from query parameters
//         const skip = (page - 1) * limit; // Calculate skip value

//         const chains = await Chain.find({}).skip(skip).limit(limit); // Retrieve chains based on pagination
//         const totalChainsCount = await Chain.countDocuments(); // Count total chains
//         let response = new HTTPResponse("Success", {
//             chains,
//             count: totalChainsCount,
//         });
//         return {
//             statusCode: StatusCodes.OK,
//             body: JSON.stringify(response),
//         };
//     } catch (err) {
//         console.log(err);
//         return {
//             statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
//             body: JSON.stringify(err),
//         };
//     }
// };

// exports.updateChainHandler = async (event, context) => {
//     try {
//         let response;
//         const id = event.pathParameters.id; // Extract the id from the path parameters
//         const data = JSON.parse(event.body); // Parse the request body for data
//         if (data.name) {
//             const existingChainWithSameName = await Chain.findOne({
//                 name: data.name,
//                 _id: { $ne: id },
//             });
//             if (existingChainWithSameName) {
//                 response = new HTTPError(
//                     "Chain with that name already exists!",
//                     StatusCodes.CONFLICT
//                 );
//                 return {
//                     statusCode: StatusCodes.CONFLICT,
//                     body: JSON.stringify(response),
//                 };
//             }
//         }
//         const updatedChain = await Chain.findOneAndUpdate({ _id: id }, data, {
//             new: true,
//         });

//         if (updatedChain) {
//             response = new HTTPResponse("Chain updated successfully!", updatedChain);
//             return {
//                 statusCode: StatusCodes.OK,
//                 body: JSON.stringify(response),
//             };
//         } else {
//             response = new HTTPError(
//                 "Chain with that ID not found!",
//                 StatusCodes.CONFLICT
//             );
//             return {
//                 statusCode: StatusCodes.CONFLICT,
//                 body: JSON.stringify(response),
//             };
//         }
//     } catch (err) {
//         console.log(err);
//         return {
//             statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
//             body: JSON.stringify(err),
//         };
//     }
// };

// exports.deleteChainHandler = async (event, context) => {
//     try {
//         let response;
//         const id = event.pathParameters.id; // Extract the id from the path parameters

//         const deletedChain = await Chain.findOneAndDelete({
//             _id: id,
//         });

//         if (deletedChain) {
//             response = new HTTPResponse("Chain deleted successfully!", deletedChain);
//             return {
//                 statusCode: StatusCodes.OK,
//                 body: JSON.stringify(response),
//             };
//         } else {
//             response = new HTTPError(
//                 "Chain with that ID not found!",
//                 StatusCodes.CONFLICT
//             );
//             return {
//                 statusCode: StatusCodes.CONFLICT,
//                 body: JSON.stringify(response),
//             };
//         }
//     } catch (err) {
//         console.log(err);
//         return {
//             statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
//             body: JSON.stringify(err),
//         };
//     }
// };