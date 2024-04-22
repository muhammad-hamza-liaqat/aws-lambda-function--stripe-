import StatusCodes from "http-status-codes";
import {
  HTTPError,
  HTTPResponse,
  DBConn,
  catchTryAsyncErrors,
  catchError,
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
    const body = JSON.parse(event.body || "{}");
    const queryParams = event.queryStringParameters || {};

    switch (method) {
      case "GET":
        if (path.startsWith("/api/user/getUserNodes/") && pathParams.id) {
          return await catchTryAsyncErrors(getUserNodesAcrossChains)(
            DB,
            pathParams.id
          );
        }
        break;
      case "POST":
        if (path.startsWith("/api/user/filterNodes/") && pathParams.id) {
          return await catchTryAsyncErrors(filterNodes)(
            DB,
            body,
            pathParams.id
          );
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
    return catchError(error);
  }
}
export const filterNodes = async (DB, body, id) => {
  const { populate, sort } = body;
  console.log("{incoming _id}", id);

  const chains = [
    {
      name: "10D",
      childNodes: 2,
    },
    {
      name: "30D",
      childNodes: 2,
    },
    {
      name: "20D",
      childNodes: 2,
    },
    {
      name: "3D",
      childNodes: 2,
    },
  ];
  let pipelineStages = [];

  chains.flatMap((chain) => {
    const collectionName = `treeNodes${chain.name}`;
    console.log("collectionName", collectionName);
    const pipeline = [
      {
        $unionWith: { coll: collectionName },
      },
      {
        $match: {
          user: new ObjectId(id),
        },
      },
      // { $sort: { totalMembers: sort === "totalmembers" ? 1 : -1 } },
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
        $addFields: {
          allChildrenCount: { $size: "$allChildren" },
        },
      },
      {
        $project: {
          chain: 1,
          totalMembers: { $size: "$allChildren" },
          // children: 1,
        },
      },
    ];

    pipelineStages = pipelineStages.concat(pipeline);
  });

  pipelineStages.push({
    $sort: {
      totalMembers: sort === "totalmembers" ? -1 : 1,
    },
  });

  const nodes = await DB.collection(`treeNodes${chains[0].name}`)
    .aggregate(pipelineStages)
    .toArray();
  const response = new HTTPResponse(
    `Filtered nodes for user ${id} fetched successfully!`,
    nodes
  );
  return {
    statusCode: StatusCodes.OK,
    body: JSON.stringify(response),
  };
};

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

export const getUserNodesAcrossChains = async (DB, id) => {
  // console.log("{incoming_id}", id);
  const chains = await DB.collection("chains")
    .find({}, { projection: { name: 1, childNodes: 1 } })
    .sort({ createdAt: -1 })
    .toArray();
  console.log("chains", chains);
  let fullyPopulated = 0;
  let underPopulated = 0;
  let totalNodesFetched = 0;

  let userNodes = [];

  for (const chain of chains) {
    const collectionName = `treeNodes${chain.name}`;

    const fullyPopulatedCount = await DB.collection(
      collectionName
    ).countDocuments({
      user: new ObjectId(id),
      children: { $size: chain.childNodes },
    });

    const underPopulatedCount = await DB.collection(collectionName)
      .aggregate([
        {
          $match: {
            user: new ObjectId(id),
            children: { $exists: true },
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

    const pipeline = [
      {
        $match: { user: new ObjectId(id) },
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
          totalMembers: { $size: "$allChildren" },
        },
      },
    ];

    const remainingNodesNeeded = 10 - totalNodesFetched;
    if (remainingNodesNeeded) {
      const nodes = await DB.collection(collectionName)
        .aggregate(pipeline)
        .limit(remainingNodesNeeded)
        .toArray();

      nodes.forEach((obj) => {
        obj.collectionName = collectionName;
      });

      userNodes.push(...nodes);
      totalNodesFetched += nodes.length;
    }
  }
  const nodeWithLevel = await Promise.all(
    userNodes.map(async (obj) => {
      const levelGrow = await calculateLevels(DB, obj._id, obj.collectionName);
      obj.level = levelGrow;
      obj.levelComplete = 0;
      delete obj.collectionName;
      return obj;
    })
  );
  let response = new HTTPResponse(
    "Nodes associated with the user fetched successfully!",
    {
      nodes: nodeWithLevel,
      fullyPopulatedCount: fullyPopulated,
      underPopulatedCount: underPopulated,
    }
  );
  return {
    statusCode: StatusCodes.OK,
    body: JSON.stringify(response),
  };
};
