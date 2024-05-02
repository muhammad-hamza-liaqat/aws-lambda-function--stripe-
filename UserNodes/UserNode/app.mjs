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

export const getUserNodesAcrossChains = catchTryAsyncErrors(async (event) => {
  const DB = await DBConn();
  const headers = generateCorsHeaders("GET");

  const userId = event.pathParameters.userId;

  const page = Number(event.queryStringParameters?.page) || 1;
  const limit = Number(event.queryStringParameters?.limit) || 10;
  const filter = event.queryStringParameters?.filter;
  const sort = event.queryStringParameters?.sort;
  let skip = (page - 1) * limit;

  const chains = await DB.collection("chains")
    .find({}, { projection: { name: 1, childNodes: 1 } })
    .sort({ createdAt: -1 })
    .toArray();

  const pipelineData = (collectionName, condition = {}) => {
    return [
      {
        $match: {
          $and: [{ user: new ObjectId(userId) }, condition],
        },
      },
      {
        $graphLookup: {
          from: collectionName,
          startWith: "$children",
          connectFromField: "children",
          connectToField: "_id",
          as: "allChildren",
        },
      },
      {
        $project: {
          chain: 1,
          children: 1,
          totalMembers: { $size: "$allChildren" },
          collectionName: { $literal: collectionName },
        },
      },
    ];
  };

  const generateCondition = (filter, userId, childNodes) => {
    let condition = {};
    if (filter === "fullypopulated") {
      condition = { children: { $size: childNodes } };
    } else if (filter === "underpopulated") {
      condition = {
        user: new ObjectId(userId),
        $expr: {
          $lt: [{ $size: "$children" }, childNodes],
        },
      };
    }
    return condition;
  };

  const unionStages = chains.slice(1).map((chain) => ({
    $unionWith: {
      coll: "treeNodes" + chain.name,
      pipeline: pipelineData(
        "treeNodes" + chain.name,
        generateCondition(filter, userId, chain.childNodes)
      ),
    },
  }));
  // console.log("unionStages", ...unionStages);

  const commonPipeline = pipelineData(
    "treeNodes" + chains[0].name,
    generateCondition(filter, userId, chains[0].childNodes)
  );
  // console.log("commonPipeline", ...commonPipeline);

  const pipeline = [...commonPipeline, ...unionStages];

  if (sort) {
    const sortStage = { $sort: {} };
    sortStage.$sort[sort] = -1;
    pipeline.push(sortStage);
  }

  pipeline.push({ $skip: skip }, { $limit: limit });

  const nodes = await DB.collection("treeNodes" + chains[0].name)
    .aggregate(pipeline)
    .toArray();

  const nodeWithLevel = await Promise.all(
    nodes.map(async (obj) => {
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

  let fullyPopulated = 0;
  let underPopulated = 0;
  let count = 0;
  for (const chain of chains) {
    const collectionName = `treeNodes${chain.name}`;

    const fullyPopulatedCount = await DB.collection(
      collectionName
    ).countDocuments({
      user: new ObjectId(userId),
      children: { $size: chain.childNodes },
    });

    const underPopulatedCount = await DB.collection(collectionName)
      .aggregate([
        {
          $match: {
            user: new ObjectId(userId),
            $expr: {
              $lt: [{ $size: "$children" }, chain.childNodes],
            },
          },
        },
        {
          $count: "count",
        },
      ])
      .toArray();

    fullyPopulated += fullyPopulatedCount || 0;
    underPopulated += underPopulatedCount[0]?.count || 0;

    const filterQuery = {
      $and: [
        generateCondition(filter, userId, chains[0].childNodes),
        { user: new ObjectId(userId) },
      ],
    };
    const collectionCount = await DB.collection(collectionName).countDocuments(
      filterQuery
    );
    // console.log("hhh ++++> ", chain, collectionCount);
    count += collectionCount;
  }
  const response = new HTTPResponse(
    "Nodes associated with the user fetched successfully!",
    {
      nodes: nodeWithLevel,
      count,
      fullyPopulatedCount: fullyPopulated,
      underPopulatedCount: underPopulated,
    }
  );
  return {
    statusCode: StatusCodes.OK,
    headers,
    body: JSON.stringify(response),
  };
});
