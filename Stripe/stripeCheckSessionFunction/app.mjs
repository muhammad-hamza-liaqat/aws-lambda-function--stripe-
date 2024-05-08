import stripePackage from "stripe";

const stripe = stripePackage(process.env.secret_key);

export const checkoutSessionHandler = async (event, context) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
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
      // if want to implement webhook(s), secure https method required..
      // success_url: `https://stripe-server.loca.lt/api/payment/complete?session_id={CHECKOUT_SESSION_ID}`,
      // cancel_url: "https://stripe-server.loca.lt/api/payment/cancel",

      success_url: `http://127.0.0.1:3000/api/payment/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: "http://127.0.0.1:3000/api/payment/cancel",
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
      statusCode: 302,
      headers: {
        Location: session.url,
      },
    };
  } catch (error) {
    console.error("Error creating checkout session:", error.message || error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || error }),
    };
  }
};
