import stripePackage from "stripe";

const stripe = stripePackage(process.env.secret_key);

export const completePayment = async (event, context) => {
  const sessionId = event.queryStringParameters.session_id;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    if (!session.payment_intent) {
      throw new Error("Payment intent not found.");
    }

    const paymentIntent = session.payment_intent;

    let feeDetails = [];
    if (paymentIntent.charges && paymentIntent.charges.data) {
      feeDetails = paymentIntent.charges.data.map((charge) => ({
        amount: charge.amount,
        fee: charge.application_fee_amount || 0,
        currency: charge.currency,
      }));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Your payment was successful!",
        paymentIntentId: paymentIntent.id,
        fees: feeDetails,
      }),
    };
  } catch (error) {
    console.error("Error completing payment:", error.message || error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || error }),
    };
  }
};
