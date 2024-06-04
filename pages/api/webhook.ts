import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import getRawBody from "raw-body";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-04-10",
});

const endpointSecret = process.env.WEBHOOK_SECRET as string;

// Make sure to add this, otherwise you will get a stream.not.readable error
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log("req.headers", req.headers);
    if (req.method !== "POST")
      return res.status(405).send("Only POST requests allowed");

    const sig: any = req.headers["stripe-signature"];
    const rawBody = await getRawBody(req);

    let event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log("event.type", JSON.stringify(event.type));

    if (event.type === "checkout.session.completed") {
      const sessionWithLineItems = await stripe.checkout.sessions.retrieve(
        (event.data.object as any).id,
        {
          expand: ["line_items"],
        }
      );
      const lineItems = sessionWithLineItems.line_items;

      if (!lineItems) return res.status(500).send("Internal Server Error");

      try {
        // Save the data, change customer account info, etc
        console.log("Fullfill the order with custom logic");
        console.log("data", lineItems.data);
        
        console.log(
          "customer email",
          (event.data.object as any).customer_details.email
        );
        console.log("created", (event.data.object as any).created);
      } catch (error) {
        console.log("Handling when you're unable to save an order");
      }
    }

    res.status(200).end();
  } catch (error) {
    console.error(error);
    res.status(500).json("Internal Server Error");
  }
}




// import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
// import { NextRequest, NextResponse } from 'next/server';
// import Stripe from 'stripe';
// import { Prisma, PrismaClient } from '@prisma/client';
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
//   apiVersion: "2024-04-10",
// });
// export const config = {
//     api: {
//       bodyParser: false,
//     },
//   };
// const prisma = new PrismaClient();

// export async function POST(req: NextRequest) {
//   const reqText = await req.text();
//   console.log("im here");
//   return webhooksHandler(reqText, req, prisma);
// }

// async function getCustomerEmail(customerId: string): Promise<string | null> {
//   try {
//     const customer = await stripe.customers.retrieve(customerId);
//     return (customer as Stripe.Customer).email;
//   } catch (error) {
//     console.error('Error fetching customer:', error);
//     return null;
//   }
// }

// //______________________________________
// async function handleSubscriptionEvent(
//   event: Stripe.Event,
//   type: 'created' | 'updated' | 'deleted',
//   prisma: PrismaClient
// ) {
//   const subscription = event.data.object as Stripe.Subscription;
//   const customerEmail = await getCustomerEmail(subscription.customer as string);

//   if (!customerEmail) {
//     return NextResponse.json({
//       status: 500,
//       error: 'Customer email could not be fetched',
//     });
//   }

//   const defaultPaymentMethodId =
//     typeof subscription.default_payment_method === 'string'
//       ? subscription.default_payment_method
//       : subscription.default_payment_method?.id || null;

//   const subscriptionData: Prisma.subscriptionsCreateInput = {
//     subscription_id: subscription.id,
//     stripe_user_id: typeof subscription.customer === 'string' ? subscription.customer : '',
//     status: subscription.status,
//     start_date: new Date(subscription.created * 1000).toISOString(),
//     plan_id: subscription.items.data[0]?.price.id || '',
//     user_id: subscription.metadata?.userId || '',
//     email: customerEmail,
//     end_date: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : undefined,
//     default_payment_method_id: defaultPaymentMethodId || undefined,
//   };

//   try {
//     let result;

//     if (type === 'deleted') {
//       result = await prisma.subscriptions.updateMany({
//         where: { subscription_id: subscription.id },
//         data: { status: 'cancelled', email: customerEmail },
//       });

//       if (result.count > 0) {
//         const userResult = await prisma.user.updateMany({
//           where: { email: customerEmail },
//           data: { subscription: null },
//         });

//         if (userResult.count === 0) {
//           console.error('Error updating user subscription status');
//           return NextResponse.json({
//             status: 500,
//             error: 'Error updating user subscription status',
//           });
//         }
//       }
//     } else {
//       if (type === 'created') {
//         result = await prisma.subscriptions.create({
//           data: subscriptionData,
//         });
//       } else if (type === 'updated') {
//         result = await prisma.subscriptions.updateMany({
//           where: { subscription_id: subscription.id },
//           data: subscriptionData,
//         });
//       }
//     }

//     return NextResponse.json({
//       status: 200,
//       message:` Subscription ${type} success`,
//       data: result,
//     });
//   } catch (error) {
//     console.error(`Error during subscription ${type}:`, error);
//     return NextResponse.json({
//       status: 500,
//       error: `Error during subscription ${type}`,
//     });
//   }
// }


// async function handleInvoiceEvent(
//   event: Stripe.Event,
//   status: 'succeeded' | 'failed',
//   prisma: PrismaClient
// ) {
//   const invoice = event.data.object as Stripe.Invoice;
//   const customerEmail = await getCustomerEmail(invoice.customer as string);

//   if (!customerEmail) {
//     return NextResponse.json({
//       status: 500,
//       error: 'Customer email could not be fetched',
//     });
//   }
//   const amountPaidString = status === 'succeeded' ? (invoice.amount_paid / 100).toString() : "0";
//   const amountDueString = status === 'failed' ? (invoice.amount_due / 100).toString() : "0";
//   const invoiceData: Prisma.invoicesCreateInput = {
//     invoice_id: invoice.id,
//     subscription_id: invoice.subscription as string,
//     amount_paid: amountPaidString,
//     amount_due: amountDueString,
//     currency: invoice.currency,
//     status,
//     user_id: invoice.metadata?.userId,
//     email: customerEmail,
//   };

//   try {
//     const data = await prisma.invoices.create({
//       data: invoiceData,
//     });

//     return NextResponse.json({
//       status: 200,
//       message: `Invoice payment ${status} success`,
//       data,
//     });
//   } catch (error) {
//     console.error(`Error inserting invoice (payment ${status}):`, error);
//     return NextResponse.json({
//       status: 500,
//       error:` Error inserting invoice (payment ${status})`,
//     });
//   }
// }


// async function handleCheckoutSessionCompleted(
//   event: Stripe.Event,
//   stripe: Stripe
// ) {
//   const session = event.data.object as Stripe.Checkout.Session;
//   const metadata = session.metadata;

//   if (metadata?.subscription === 'true') {
//     const subscriptionId = session.subscription;
//     try {
//       await stripe.subscriptions.update(subscriptionId as string, { metadata });

//       const updatedInvoice = await prisma.invoices.updateMany({
//         where: { email: metadata?.email },
//         data: { user_id: metadata?.userId },
//       });

//       if (!updatedInvoice.count) {
//         throw new Error('Error updating invoice');
//       }

//       const updatedUser = await prisma.user.update({
//         where: { user_id: metadata?.userId },
//         data: { subscription: session.id },
//       });

//       return NextResponse.json({
//         status: 200,
//         message: 'Subscription metadata updated successfully',
//       });
//     } catch (error) {
//       console.error('Error updating subscription metadata:', error);
//       return NextResponse.json({
//         status: 500,
//         error: 'Error updating subscription metadata',
//       });
//     }
//   } else {
//     const dateTime = new Date(session.created * 1000).toISOString();
//     try {
//       const user = await prisma.user.findUnique({
//         where: { user_id: metadata?.userId },
//       });
//       if (!user) throw new Error('Error fetching user');

//       const paymentData = {
//         user_id: metadata?.userId || "",
//         stripe_id: session.id,
//         email: metadata?.email || "",
//         amount: (session.amount_total! / 100).toFixed(2),
//         customer_details: JSON.stringify(session.customer_details),
//         payment_intent: session.payment_intent as string,
//         payment_time: dateTime,
//         currency: session.currency || "",
//         payment_date: new Date(session.created * 1000).toISOString(),
//       };

//       const newPayment = await prisma.payments.create({
//         data: paymentData,
//       });

//       const updatedCredits =
//         Number(user.credits || 0) + (session.amount_total || 0) / 100;

//       const updatedUser = await prisma.user.update({
//         where: { user_id: metadata?.userId },
//         data: { credits: updatedCredits },
//       });

//       return NextResponse.json({
//         status: 200,
//         message: 'Payment and credits updated successfully',
//         updatedUser,
//       });
//     } catch (error) {
//       console.error('Error handling checkout session:', error);
//       return NextResponse.json({
//         status: 500,
//         error,
//       });
//     }
//   }
// }

// async function webhooksHandler(
//   reqText: string,
//   request: NextRequest,
//   primsa:PrismaClient
// ): Promise<NextResponse> {
//   const sig = request.headers.get('Stripe-Signature');

//   try {
//     console.log("im in web hook handler too")
//     const event = await stripe.webhooks.constructEventAsync(
//       reqText,
//       sig!,
//       process.env.STRIPE_WEBHOOK_SECRET!
//     );
//     console.log(event.type)
//     switch (event.type) {
//       case 'customer.subscription.created':
//         return handleSubscriptionEvent(event, 'created', prisma);
//       case 'customer.subscription.updated':
//         return handleSubscriptionEvent(event, 'updated', prisma);
//       case 'customer.subscription.deleted':
//         return handleSubscriptionEvent(event, 'deleted', prisma);
//       case 'invoice.payment_succeeded':
//         return handleInvoiceEvent(event, 'succeeded', prisma);
//       case 'invoice.payment_failed':
//         return handleInvoiceEvent(event, 'failed', prisma);
//       case 'checkout.session.completed':
//         return handleCheckoutSessionCompleted(event,stripe);
//       default:
//         return NextResponse.json({
//           status: 400,
//           error: 'Unhandled event type',
//         });
//     }
//   } catch (err) {
//     console.error('Error constructing Stripe event:', err);
//     return NextResponse.json({
//       status: 500,
//       error: 'Webhook Error: Invalid Signature',
//     });
//   }
// }