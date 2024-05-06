import StatusCodes from "http-status-codes";
import {
  HTTPResponse,
  calculateLevels,
  catchTryAsyncErrors,
  generateCondition,
  generateCorsHeaders,
} from "./helper.mjs";
import { ObjectId } from "mongodb";

export const getUserNodes = catchTryAsyncErrors(async (event, DB) => {
  const headers = generateCorsHeaders();

  const userId = event.pathParameters.userId;

  const page = Number(event.queryStringParameters?.page) || 1;
  const limit = Number(event.queryStringParameters?.limit) || 10;
  let skip = (page - 1) * limit;

  const filter = event.queryStringParameters?.filter;
  const sort = event.queryStringParameters?.sort;

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

  const unionStages = chains.slice(1).map((chain) => ({
    $unionWith: {
      coll: "treeNodes" + chain.name,
      pipeline: pipelineData(
        "treeNodes" + chain.name,
        generateCondition(filter, chain.childNodes)
      ),
    },
  }));
  // console.log("unionStages", ...unionStages);

  const commonPipeline = pipelineData(
    "treeNodes" + chains[0].name,
    generateCondition(filter, chains[0].childNodes)
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
    nodes.map(async (node) => {
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
        generateCondition(filter, chains[0].childNodes),
        { user: new ObjectId(userId) },
      ],
    };
    const collectionCount = await DB.collection(collectionName).countDocuments(
      filterQuery
    );
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
