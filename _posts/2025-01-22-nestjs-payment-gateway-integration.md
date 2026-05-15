---
title: "How to Integrate Multiple Payment Gateways in NestJS (With Stripe Example)"
excerpt: "NestJS-based payment gateway integration service. It provides a unified interface for processing payments through various payment processors such as Stripe, PayPal, and others. The service handles payment initialization, processing, and refunding, ensuring a seamless payment experience for users."
coverImage: "/blog-assets/nestjs-payment-gateway-integration/screenshot-2025-01-21-at-18-54-04.png"
date: "2025-01-22T12:00:00.000Z"
author:
  name: "Henrique Weiand"
  picture: "/nestjs-ninja.png"
ogImage:
  url: "/blog-assets/nestjs-payment-gateway-integration/screenshot-2025-01-21-at-18-54-04.png"
tags:
  - "NestJS"
  - "Node.js"
  - "Payments"
  - "Stripe"
---
One of the most common use cases that every project has is integrating and offering ways for the customers to pay for your software, which is quite important, isn't it? 

This post will cover some interesting strategies for making it on the backend with NestJS. A simple level of abstraction will allow your project to integrate with multiple payment gateways and even allow the customer to pay with more than one method! Pretty cool, right?

> ⚠️ Before we continue, I wanna let you know that this will be an important year for the blog, I am planning to start publishing more frequent blog posts and even videos! My advice for you is to subscribe to the page and don't miss any new publications or updates!
> 

**Backend repository** 

[https://github.com/henriqueweiand/nestjs-payment-gateway-integration](https://github.com/henriqueweiand/nestjs-payment-gateway-integration)

**Frontend repository** 

[https://github.com/henriqueweiand/nextjs-payment-gateway-integration](https://github.com/henriqueweiand/nextjs-payment-gateway-integration)

### Defining the solution

This solution will implement a few layers to make the payment abstraction clear and reusable. It will perform payments with one or more Payment Gateways, in special with Stripe for the implemented example. I won't focus so much on the details, and more on how the solution works! It's important to mention, that this solution is not the perfect one and of course, it can be implemented in many different ways. There will be possible improvements to the solution that I will be commenting on the way.

## Solution flow

The request flow starts at the Controller and goes through a few Modules and services. 

A big picture of the solution is:

![Screenshot 2025-01-21 at 18.54.04.png](/blog-assets/nestjs-payment-gateway-integration/screenshot-2025-01-21-at-18-54-04.png)

We are going to go deep down over a few of them to understand the solution starting by the Checkout.

### Checkout

This module is responsible for receiving the input from the controller or any other service that ended up implementing it, and it deals with some important steps.

[https://github.com/henriqueweiand/nestjs-payment-gateway-integration/blob/master/libs/components/checkout/src/checkout.service.ts](https://github.com/henriqueweiand/nestjs-payment-gateway-integration/blob/master/libs/components/checkout/src/checkout.service.ts)

The only expose method in this service is `processPayments`, which performs:

1. It creates the checkout entity/record in the database. It's important because I want to have a common ID for one or many payments that will be processed;
2. It processes each one of the payment inputs individually;
3. It gets all successful and failed payments for that checkout;
4. It performs the refunds for those successful payments if any payment fails;
5. It updates the checkout status;

Before understanding the methods that process each one of the payments and the processors, it's important to know that the input that we received on the method `processPayments` has one attribute that `payments` which receives an array of `SpecificPaymentInputs` which allows us to receive multiple formats of inputs. This is an important detail because if any new gateway is integrated, `SpecificPaymentInputs` needs to be updated!

 

https://github.com/henriqueweiand/nestjs-payment-gateway-integration/blob/master/libs/components/checkout/src/checkout.interfaces.ts

![Screenshot 2025-01-21 at 19.08.29.png](/blog-assets/nestjs-payment-gateway-integration/screenshot-2025-01-21-at-19-08-29.png)

Taking `StripePaymentInput` as an example, we have a class that implements an abstraction. 

[https://github.com/henriqueweiand/nestjs-payment-gateway-integration/blob/master/libs/components/checkout/src/stripe/dto/stripe-payment.input.ts](https://github.com/henriqueweiand/nestjs-payment-gateway-integration/blob/master/libs/components/checkout/src/stripe/dto/stripe-payment.input.ts)

This abstraction requires the class to have two important fields that will be used before by the payment processor to identify the correct processor, they are `processorType` and `paymentType`, which are enum values also related to the payment gateways supported. In this initial example, I will implement [Stripe](https://stripe.com/) and a fake/custom voucher integration.

OK! Let's return to the checkout.service and look at the private method `_processOnePayment`. This method is responsible for calling the `PaymentProcessor` which we will detail in a bit. Apart from the payment processor, we're just creating an object that holds the main information of the checkout.

### Payment processor

The payment processor is the core logic behind external integrations like Stripe and the internal abstractions that deal with the processing itself. You'll notice that the `PaymentProcessorsModule` includes the providers for each one of the implementations which is the class that follows the abstracted PaymentProcessor. The module also includes the external modules for the logic of the integrations, for example, the Stripe methods to pay, refund, and so on.

Our starting point is the `_processOnePayment` where we call getProcessor method

```jsx
this.paymentProcessorsService.getProcessor(paymentType, processorType);
```

This service and method hold a switch case logic that will map and return the proper processor for the payment informed (`SpecificPaymentInputs`). The returned class is the payment processor implementation for the specific payment gateway. Overall, the sequence of steps is something like this:

![Screenshot 2025-01-22 at 10.26.43.png](/blog-assets/nestjs-payment-gateway-integration/screenshot-2025-01-22-at-10-26-43.png)

[https://github.com/henriqueweiand/nestjs-payment-gateway-integration/blob/master/libs/components/checkout/src/payment-processors/payment-processors.service.ts](https://github.com/henriqueweiand/nestjs-payment-gateway-integration/blob/master/libs/components/checkout/src/payment-processors/payment-processors.service.ts)

### Stripe payment processor

Each processor has to implement two methods: `_pay` and `_refund`. By the way, I'm not implementing the _refund part in this project, but, it's important to have in case a payment fails and you have to refund the customer automatically. The definition of the methods above is set inside the abstracted class PaymentProcessor

```jsx
protected abstract _pay(paymentData: PaymentData, paymentInput: Input): Promise<PaymentTransactionResult>;
protected abstract _refund(paymentLog: PaymentLog): Promise<PaymentTransactionFailedResult>;

```

> These methods aren't exposed, they are the main logic of the integration and they will be used later by an exposed method.
> 

Inside each processor we defined the logic with the external library, for example, the Stripe processor is calling the method `stripeService.createPaymentIntent` to create the payment, and the same would work for the _refund method. To give you a better idea of the execution flow, let's take a look at the `pay` method inside the abstracted class PaymentProcessor.

[https://github.com/henriqueweiand/nestjs-payment-gateway-integration/blob/master/libs/components/checkout/src/payment-processors/processors/payment.processor.ts](https://github.com/henriqueweiand/nestjs-payment-gateway-integration/blob/master/libs/components/checkout/src/payment-processors/processors/payment.processor.ts)

Two things are happening here:

- it's creating the payment log.
- it's calling the `_pay` method implemented by the specific integration.

The payment log represents things like:

- What we receiving as input;
- What the response was;
- Metadata of the payment/checkout;
- Status of the payment;

This is important information for multiple things, for example, we can debug deeply if necessary to understand why a payment failed by looking at the input, response, and metadata; we can retry; we can easily know the payment methods used and their status.

A big-picture view of the flow described above is

![Screenshot 2025-01-22 at 10.56.11.png](/blog-assets/nestjs-payment-gateway-integration/screenshot-2025-01-22-at-10-56-11.png)

OK! So far, we covered all the payment flow from the controller to the payment integration with the payment gateway! The remaining part is the refund, which happens when one or more payments fail with the payment gateway. Let's return to the service https://github.com/henriqueweiand/nestjs-payment-gateway-integration/blob/master/libs/components/checkout/src/checkout.service.ts

Inside the method `processPayments`, after we process every payment informed, after the line 

```jsx
const results = await Promise.all(paymentInputs.map(paymentInput => this._processOnePayment(checkout, paymentInput)));
```

We are filtering out the results to find the payment logs that were `failed` and `completed`, if we have any payments that failed, then we need to run the refund for all those that were completed. As I mentioned before, I implemented the refund partially, there's only the structure, but the main logic with Stripe, for example, is missing on purpose, I didn't want to go that further on the topic, but the documentation for Stripe's refund is available on https://docs.stripe.com/api/refunds/create

---

### Some extra notes about the implementation

- Instead of processing it during the request as we are doing with Promise.all inside the checkout.service, one option would be putting it in a queue and processing on depend. You can also respond after the processing with some kind of socket connected to the front end which is waiting for the response, or any other strategy you want.
- I didn't create a service only for the repository for example the checkout service is doing it and some other things, it would be nice to have a repository class and reduce the responsibility of some of the services.
- Don't take all the implementation too seriously, it's a base example of how to abstract modules and services to have an easy way to integrate with different payment gateways quickly and easily.

### Other packages inside libs

You'll notice some libs inside the libs folder that are:

- env
- logger
- persistence

I didn't explain them in this article because they are not the focus, but they are modules to deal with the env, logger, and persistence (TypeORM, migrations). They are useful modules that I use from time to time on my blog posts.

### Running frontend and backend project

This article includes both frontend and backend projects with the Stripe integration to show the project working. In the example you can inform the Stripe card and a voucher, simulating everything that we implemented in this article.

If you want to run the projects, please follow the instructions for each one.

![Screenshot 2025-01-22 at 16.33.29.png](/blog-assets/nestjs-payment-gateway-integration/screenshot-2025-01-22-at-16-33-29.png)

That's all for today! Don't forget to subscribe to follow the following post that is about to be released!
