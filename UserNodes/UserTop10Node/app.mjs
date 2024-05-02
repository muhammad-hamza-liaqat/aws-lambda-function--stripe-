import StatusCodes from "http-status-codes";
import {
  HTTPResponse,
  DBConn,
  catchTryAsyncErrors,
  generateCorsHeaders,
} from "./helper.mjs";
import { ObjectId } from "mongodb";

const findNodeById = async (DB, nodeId, collectionName) => {
  const nodeData = await DB.collection(collectionName)
    .find({ _id: new ObjectId(nodeId) }, { projection: { children: 1 } })
    .toArray();
  return nodeData[0];
};

const calculateLevels = async (DB, nodeId, collectionName, childNodes) => {
  const node = await findNodeById(DB, nodeId, collectionName);
  if (!node) return { levelGrow: 0, levelComplete: 0 };

  async function traverse(node, level) {
    // console.log("node------------------->>>>>", node);
    if (node.children.length === 0) return level;
    let maxChildLevel = 0;
    for (const childId of node.children) {
      const childNode = await findNodeById(DB, childId, collectionName);
      if (childNode) {
        const childLevel = await traverse(childNode, level + 1);
        maxChildLevel = Math.max(maxChildLevel, childLevel);
      }
    }
    return maxChildLevel;
  }
  const levelGrow = await traverse(node, 0);

  let highestCompleteLevel = -1;
  let queue = [node];

  while (queue.length > 0) {
    const levelSize = queue.length;
    const expectedNodes = Math.pow(childNodes, highestCompleteLevel + 1);

    if (levelSize === expectedNodes) {
      highestCompleteLevel++;
    } else {
      break;
    }
    for (let i = 0; i < levelSize; i++) {
      const currentNode = queue.shift();
      if (currentNode.children.length > 0) {
        for (const childId of currentNode.children) {
          const childNode = await findNodeById(DB, childId, collectionName);
          if (childNode) {
            queue.push(childNode);
          }
        }
      }
    }
  }
  return { levelGrow, highestCompleteLevel };
};

export const top10UserNodes = catchTryAsyncErrors(async (event) => {
  const DB = await DBConn();
  const headers = generateCorsHeaders();
  const userId = event.pathParameters.userId;

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
    data.map(async (obj) => {
      const chain = chains.find(
        (chain) => chain._id.toString() === obj.chain.toString()
      );
      const { levelGrow, highestCompleteLevel } = await calculateLevels(
        DB,
        obj._id,
        obj.collectionName,
        chain.childNodes
      );
      obj.level = levelGrow;
      obj.levelComplete = highestCompleteLevel;
      delete obj.collectionName;
      return obj;
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
