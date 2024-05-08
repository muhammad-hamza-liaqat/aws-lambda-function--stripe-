import stripePackage from "stripe";
import { generateCorsHeaders } from "./helper.mjs";

const stripe = stripePackage(process.env.secret_key);

export const webHook = async (event, context) => {
  const headers = await generateCorsHeaders();

  try {
    const sig = event.headers["Stripe-Signature"];
    const endpointSecret = process.env.webhook_secret_endpoint_key;

    if (!sig || !endpointSecret) {
      console.error("Webhook Error: Signature or endpoint secret missing.");
      return {
        statusCode: 400,
        headers,
        body: "Webhook Error: Signature or endpoint secret missing.",
      };
    }

    const eventBody = JSON.parse(event.body);

    try {
      const stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        sig,
        process.env.webhook_secret_endpoint_key
      );

      if (stripeEvent.type === "checkout.session.completed") {
        console.log("Checkout session completed:", stripeEvent.data.object);
      }

      return {
        statusCode: 200,
        headers,
        body: "Webhook received successfully.",
      };
    } catch (error) {
      console.error("Webhook Error: Failed to construct event:", error);
      return {
        statusCode: 400,
        headers,
        body: `Webhook Error: ${error.message}`,
      };
    }
  } catch (err) {
    console.error("Webhook Error:", err.message);
    return {
      statusCode: 400,
      headers,
      body: `Webhook Error: ${err.message}`,
    };
  }
};
