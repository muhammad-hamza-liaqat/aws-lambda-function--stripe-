import StatusCodes from "http-status-codes";
import DBConn from "./config.mjs";
import { ObjectId } from "mongodb";

export class HTTPError extends Error {
  constructor(message = "Error", errorCode, details = []) {
    super();
    this.message = message;
    this.code = errorCode;
    this.details = details;
  }
}
export class HTTPResponse {
  constructor(message = "Success", data) {
    this.message = message;
    this.data = data;
  }
}

export const generateCorsHeaders = () => {
  const allowedOrigins = [
    "http://localhost:5173",
    "https://main.d3gzu5jixwdx96.amplifyapp.com",
  ];

  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET",
    // "Access-Control-Allow-Origin": allowedOrigins.join(", "),
    "Access-Control-Allow-Origin": "*",
  };
};

export const catchTryAsyncErrors = (action) => async (event) => {
  const headers = generateCorsHeaders();
  let client;
  try {
    client = await DBConn();
    const resp = await action(event, client.DB);
    return resp;
  } catch (error) {
    console.log("error", error);
    const err = new HTTPError(
      "Something Went Wrong",
      StatusCodes.INTERNAL_SERVER_ERROR,
      error?.message || error
    );
    return {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      headers,
      body: JSON.stringify(err),
    };
  } finally {
    if (client && client.client) {
      await client.client.close();
      console.log("DB Connection Closed!");
    }
  }
};

export const generateCondition = (filter, childNodes) => {
  let condition = {};
  if (filter === "fullypopulated") {
    condition = { children: { $size: childNodes } };
  } else if (filter === "underpopulated") {
    condition = {
      $expr: {
        $lt: [{ $size: "$children" }, childNodes],
      },
    };
  }
  return condition;
};

const findNodeById = async (DB, nodeId, collectionName) => {
  const nodeData = await DB.collection(collectionName)
    .find({ _id: new ObjectId(nodeId) }, { projection: { children: 1 } })
    .toArray();
  return nodeData[0];
};

export const calculateLevels = async (
  DB,
  nodeId,
  collectionName,
  childNodes
) => {
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
