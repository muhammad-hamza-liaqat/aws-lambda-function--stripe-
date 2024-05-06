import StatusCodes from "http-status-codes";
import {
  HTTPResponse,
  catchTryAsyncErrors,
  generateCorsHeaders,
  calculateLevels,
} from "./helper.mjs";
import { ObjectId } from "mongodb";

export const top10UserNodes = catchTryAsyncErrors(async (event, DB) => {
  const headers = generateCorsHeaders();
  // const userId = event.pathParameters.userId;
  const userId = "663088475a62f16d73df53d3";
  const chains = await DB.collection("chains")
    .find({}, { projection: { name: 1, childNodes: 1 } })
    .sort({ createdAt: -1 })
    .toArray();
  // console.log("chainNames", chains);

  const pipelineData = (collectionName) => {
    return [
      { $match: { user: new ObjectId(userId) } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userData",
        },
      },
      { $unwind: "$userData" },
      {
        $project: {
          value: 1,
          chain: 1,
          user: 1,
          totalEarning: 1,
          username: "$userData.userName",
          collectionName: { $literal: collectionName },
        },
      },
    ];
  };

  const unionStages = chains.slice(1).map((chainName) => ({
    $unionWith: {
      coll: "treeNodes" + chainName.name,
      pipeline: pipelineData("treeNodes" + chainName.name),
    },
  }));
  console.log("unionStages", ...unionStages);

  const commonPipeline = pipelineData("treeNodes" + chains[0].name);
  console.log("commonPipeline", ...commonPipeline);

  const data = await DB.collection("treeNodes" + chains[0].name)
    .aggregate([
      ...commonPipeline,
      ...unionStages,
      { $sort: { totalEarning: -1 } },
      { $limit: 10 },
    ])
    .toArray();

  const nodeWithLevel = await Promise.all(
    data.map(async (node) => {
      const chain = chains.find(
        (chain) => chain._id.toString() === node.chain.toString()
      );
      const { levelGrow, highestCompleteLevel } = await calculateLevels(
        DB,
        node._id,
        node.collectionName,
        chain.childNodes
      );
      node.level = levelGrow;
      node.levelComplete = highestCompleteLevel;
      delete node.collectionName;
      return node;
    })
  );
  const response = new HTTPResponse(
    "Top 10 Nodes across all chains fetched successfully!",
    nodeWithLevel
  );
  return {
    statusCode: StatusCodes.OK,
    headers,
    body: JSON.stringify(response),
  };
});
