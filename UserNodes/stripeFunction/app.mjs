import StatusCodes from "http-status-codes";
import {
  catchTryAsyncErrors,
  generateCorsHeaders,
} from "./helper.mjs";
import Stripe from "stripe";
const stripe = Stripe(process.env.secret_key);

export const stripeCheckSession = catchTryAsyncErrors(async (event) => {
  const headers = generateCorsHeaders();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "amazon_pay", "klarna", "us_bank_account"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "2D",
          },
          unit_amount: 500 * 100,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `/api/payment/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: "/api/payment/cancel",
    metadata: {
      lineItemsMetadata: JSON.stringify([
        {
          index: "0",
          chainID: "660a428a002938f126abfc83",
          nodeID: "660a428a002938f126abfc84",
        },
      ]),
    },
  });

  return {
    statusCode: StatusCodes.PERMANENT_REDIRECT,
    headers: {
      Location: session.url,
    },
  };
});
