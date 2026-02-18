import type { NodeExample } from "./types";

const STRIPE = ["@mvfm/plugin-stripe"];

const examples: Record<string, NodeExample> = {
  "stripe/create_payment_intent": {
    description: "Create a PaymentIntent for a given amount and currency",
    code: `const app = mvfm(prelude, console_, stripe_);
const prog = app({}, ($) => {
  const pi = $.stripe.paymentIntents.create({
    amount: 2000,
    currency: "usd",
  });
  return $.console.log(pi);
});
await foldAST(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);`,
    plugins: STRIPE,
  },

  "stripe/retrieve_payment_intent": {
    description: "Retrieve a PaymentIntent by its ID",
    code: `const app = mvfm(prelude, console_, stripe_);
const prog = app({}, ($) => {
  const pi = $.stripe.paymentIntents.retrieve("pi_abc123");
  return $.console.log(pi);
});
await foldAST(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);`,
    plugins: STRIPE,
  },

  "stripe/confirm_payment_intent": {
    description: "Confirm a PaymentIntent with an optional payment method",
    code: `const app = mvfm(prelude, console_, stripe_);
const prog = app({}, ($) => {
  const pi = $.stripe.paymentIntents.confirm("pi_abc123", {
    payment_method: "pm_card_visa",
  });
  return $.console.log(pi);
});
await foldAST(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);`,
    plugins: STRIPE,
  },

  "stripe/create_customer": {
    description: "Create a new Stripe customer",
    code: `const app = mvfm(prelude, console_, stripe_);
const prog = app({}, ($) => {
  const customer = $.stripe.customers.create({
    email: "test@example.com",
    name: "Jane Doe",
  });
  return $.console.log(customer);
});
await foldAST(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);`,
    plugins: STRIPE,
  },

  "stripe/retrieve_customer": {
    description: "Retrieve a customer by ID",
    code: `const app = mvfm(prelude, console_, stripe_);
const prog = app({}, ($) => {
  const customer = $.stripe.customers.retrieve("cus_abc123");
  return $.console.log(customer);
});
await foldAST(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);`,
    plugins: STRIPE,
  },

  "stripe/update_customer": {
    description: "Update an existing customer's details",
    code: `const app = mvfm(prelude, console_, stripe_);
const prog = app({}, ($) => {
  const customer = $.stripe.customers.update("cus_abc123", {
    name: "Jane Smith",
  });
  return $.console.log(customer);
});
await foldAST(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);`,
    plugins: STRIPE,
  },

  "stripe/list_customers": {
    description: "List customers with optional filters",
    code: `const app = mvfm(prelude, console_, stripe_);
const prog = app({}, ($) => {
  const customers = $.stripe.customers.list({ limit: 10 });
  return $.console.log(customers);
});
await foldAST(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);`,
    plugins: STRIPE,
  },

  "stripe/create_charge": {
    description: "Create a charge for a given amount",
    code: `const app = mvfm(prelude, console_, stripe_);
const prog = app({}, ($) => {
  const charge = $.stripe.charges.create({
    amount: 5000,
    currency: "usd",
    source: "tok_visa",
  });
  return $.console.log(charge);
});
await foldAST(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);`,
    plugins: STRIPE,
  },

  "stripe/retrieve_charge": {
    description: "Retrieve a charge by its ID",
    code: `const app = mvfm(prelude, console_, stripe_);
const prog = app({}, ($) => {
  const charge = $.stripe.charges.retrieve("ch_abc123");
  return $.console.log(charge);
});
await foldAST(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);`,
    plugins: STRIPE,
  },

  "stripe/list_charges": {
    description: "List charges with optional filters",
    code: `const app = mvfm(prelude, console_, stripe_);
const prog = app({}, ($) => {
  const charges = $.stripe.charges.list({ limit: 25 });
  return $.console.log(charges);
});
await foldAST(defaults(app, { stripe: crystalBallStripeInterpreter }), prog);`,
    plugins: STRIPE,
  },
};

export default examples;
