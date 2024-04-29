import StatusCodes from "http-status-codes";
import { HTTPResponse, DBConn, catchTryAsyncErrors } from "./helper.mjs";
import { ObjectId } from "mongodb";

const findNodeById = async (DB, nodeId, collectionName) => {
  const nodeData = await DB.collection(collectionName)
    .find({ _id: new ObjectId(nodeId) }, { projection: { children: 1 } })
    .toArray();
  return nodeData[0];
};

const calculateLevels = async (DB, nodeId, collectionName) => {
  const node = await findNodeById(DB, nodeId, collectionName);
  if (!node) return { levelGrow: 0 };

  async function traverse(node, level) {
    if (node.children.length === 0) return level;

    const childPromises = node.children.map(async (childId) => {
      const childNode = await findNodeById(DB, childId, collectionName);
      if (childNode) {
        return traverse(childNode, level + 1);
      }
      return 0;
    });

    const childLevels = await Promise.all(childPromises);
    return Math.max(...childLevels);
  }

  const levelGrow = await traverse(node, 0);
  return levelGrow;
};

export const getUserNodesAcrossChains = catchTryAsyncErrors(async (event) => {
  const DB = await DBConn();
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

  // const chains = [
  //   {
  //     _id: new ObjectId("66269d6633fef9e32624470d"),
  //     name: "10D",
  //     childNodes: 2,
  //   },
  //   {
  //     _id: new ObjectId("660e30401a4faaf7026fd4b9"),
  //     name: "30D",
  //     childNodes: 2,
  //   },
  // ];
  console.log("chains", chains);

  const pipelineData = (collectionName, condition = {}) => {
    // console.log("condition ++++++++>", condition);
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

  let condition = {};
  if (filter === "fullypopulated") {
    condition = { children: { $size: chains[0].childNodes } };
  } else if (filter === "underpopulated") {
    condition = {
      user: new ObjectId(userId),
      $expr: {
        $lt: [{ $size: "$children" }, chains[0].childNodes],
      },
    };
  }

  const unionStages = chains.slice(1).map((chainName) => ({
    $unionWith: {
      coll: "treeNodes" + chainName.name,
      pipeline: pipelineData("treeNodes" + chainName.name, condition),
    },
  }));
  // console.log("unionStages", ...unionStages);

  const commonPipeline = pipelineData("treeNodes" + chains[0].name, condition);
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
      const levelGrow = await calculateLevels(DB, obj._id, obj.collectionName);
      obj.level = levelGrow;
      obj.levelComplete = 0;
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

    const filterQuery = { $and: [condition, { user: new ObjectId(userId) }] };

    const collectionCount = await DB.collection(collectionName).countDocuments(
      filterQuery
    );
    // console.log("hhh ++++> ", chain, collectionCount);
    count += collectionCount;
  }
  if (client) {
    await client.close();
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
    body: JSON.stringify(response),
  };
});
