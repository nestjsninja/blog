export type PostOgData = {
  author: string;
  date: string;
  excerpt: string;
  slug: string;
  tags: string[];
  title: string;
};

export const postOgData: PostOgData[] = [
  {
    slug: "2025-02-23-nestjs-lambda-localstack-serverless",
    title: "Running NestJS in Lambda with LocalStack and Serverless",
    excerpt:
      "How to package a NestJS QR code generator as an AWS Lambda function, test it locally with LocalStack, and deploy it through the Serverless Framework.",
    date: "2025-02-23T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Lambda", "LocalStack", "Serverless"],
  },
  {
    slug: "2025-02-18-nestjs-kubernetes-jobs-nest-commander",
    title: "Kubernetes Jobs with NestJS and nest-commander",
    excerpt:
      "A practical approach for running NestJS command-line workers as Kubernetes Jobs with nest-commander, Docker, shared libraries, and TypeORM.",
    date: "2025-02-18T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Kubernetes", "CLI", "Jobs"],
  },
  {
    slug: "2025-02-08-nestjs-vienna-meetup-multi-tenancy-modules",
    title: "NestJS Vienna Meetup: Multi-Tenancy and Module Management",
    excerpt:
      "Notes from a NestJS Vienna meetup covering multi-tenancy patterns, module management, and why these topics matter for scalable NestJS applications.",
    date: "2025-02-08T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Community", "Multi-tenancy", "Modules"],
  },
  {
    slug: "2025-02-01-real-time-chat-with-nestjs-socket-io",
    title: "Real-time Chat with NestJS and Socket.io",
    excerpt:
      "A focused walkthrough of a simple NestJS WebSocket gateway that tracks connections, disconnections, and chat messages with Socket.io.",
    date: "2025-02-01T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Socket.io", "Realtime", "WebSockets"],
  },
  {
    slug: "2025-01-23-nestjs-multiple-payment-gateways-stripe",
    title: "Multiple Payment Gateways in NestJS with a Stripe Example",
    excerpt:
      "How to design a payment abstraction in NestJS so Stripe is only one implementation behind a stable application contract.",
    date: "2025-01-23T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Payments", "Stripe", "Architecture"],
  },
  {
    slug: "2024-12-14-nestjs-typeorm-multi-tenancy",
    title: "NestJS, TypeORM, and Multi-Tenancy",
    excerpt:
      "A practical architecture for serving multiple customer databases from one NestJS application using TypeORM and request-scoped tenant context.",
    date: "2024-12-14T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "TypeORM", "Multi-tenancy", "Architecture"],
  },
  {
    slug: "2024-03-15-nestjs-clean-architecture-abstractions-databases",
    title: "Clean Architecture in NestJS: Abstractions and Databases",
    excerpt:
      "How repository abstractions let a NestJS application work with different persistence implementations while keeping use cases focused on domain behavior.",
    date: "2024-03-15T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Clean Architecture", "Databases", "Abstractions"],
  },
  {
    slug: "2024-03-09-nestjs-clean-architecture-ddd-ecommerce-part-1",
    title: "Clean Architecture and DDD in NestJS E-commerce: Part 1",
    excerpt:
      "A first look at structuring a NestJS e-commerce project around domain entities, use cases, infrastructure, and low coupling.",
    date: "2024-03-09T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Clean Architecture", "DDD", "E-commerce"],
  },
  {
    slug: "2024-03-08-language-learning-with-nestjs-nextjs-vercel-neon",
    title: "Language Learning with NestJS, Next.js, Vercel, and Neon",
    excerpt:
      "A tech-infused language learning journey using open-source projects, NestJS, Next.js, Vercel, and Neon as a practical education stack.",
    date: "2024-03-08T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Next.js", "Neon", "Education"],
  },
  {
    slug: "2023-11-17-nestjs-sentry-error-tracking",
    title: "Error Tracking in NestJS with Sentry",
    excerpt:
      "How to add Sentry to a NestJS project with an exception filter so production errors are visible before users report them.",
    date: "2023-11-17T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Sentry", "Observability", "Errors"],
  },
  {
    slug: "2023-11-08-faster-tests-with-ai-nestjs",
    title: "Creating NestJS Tests Faster with AI Assistance",
    excerpt:
      "How AI tools can accelerate unit and e2e test drafting in NestJS while still requiring developer review, corrections, and understanding.",
    date: "2023-11-08T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Testing", "AI", "Jest"],
  },
  {
    slug: "2023-11-06-nestjs-openai-smart-questions",
    title: "Creating Smart Questions with NestJS and OpenAI",
    excerpt:
      "A product-oriented NestJS service that uses OpenAI to generate answer options for educational questions and stores the result with Prisma.",
    date: "2023-11-06T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "OpenAI", "Prisma", "Education"],
  },
  {
    slug: "2023-10-24-migrating-nestjs-typeorm-to-prisma",
    title: "Migrating a NestJS Project from TypeORM to Prisma",
    excerpt:
      "How to replace TypeORM with Prisma in a small NestJS auth project while keeping the application behavior focused and testable.",
    date: "2023-10-24T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Prisma", "TypeORM", "Migration"],
  },
  {
    slug: "2023-10-21-nodejs-without-frameworks-2023",
    title: "Creating a Node.js Project Without Frameworks in 2023",
    excerpt:
      "A Fastify, Prisma, Zod, and Vitest backend built without a full framework to revisit the fundamentals behind modern Node.js APIs.",
    date: "2023-10-21T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["Node.js", "Fastify", "Prisma", "Testing"],
  },
  {
    slug: "2023-10-18-nestjs-unit-tests-jest-github-actions",
    title: "Unit Tests in NestJS with Jest and GitHub Actions",
    excerpt:
      "How to add focused unit tests to a NestJS auth flow with Jest, mocked providers, repository mocks, and a GitHub Actions pipeline.",
    date: "2023-10-18T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Jest", "Unit Testing", "GitHub Actions"],
  },
  {
    slug: "2023-10-16-nestjs-e2e-tests-jest-github-actions",
    title: "E2E Tests in NestJS with Jest and GitHub Actions",
    excerpt:
      "How to add end-to-end tests to a NestJS auth flow and run them in GitHub Actions with a reproducible test environment.",
    date: "2023-10-16T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Testing", "Jest", "GitHub Actions"],
  },
  {
    slug: "2023-10-10-nestjs-config-module-zod",
    title: "A Typed NestJS Configuration Module with Zod",
    excerpt:
      "How to centralize environment variables in NestJS with @nestjs/config, Zod validation, inferred TypeScript types, and a small EnvService.",
    date: "2023-10-10T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Configuration", "Zod", "TypeScript"],
  },
  {
    slug: "2023-10-09-nestjs-auth-flow-typeorm-neon",
    title: "NestJS Auth Flow with TypeORM, Postgres, and Neon",
    excerpt:
      "The third auth-flow step: add Postgres with TypeORM, hash user passwords, run migrations, and prepare the database for Neon deployment.",
    date: "2023-10-09T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Authentication", "TypeORM", "Postgres"],
  },
  {
    slug: "2023-10-07-nestjs-auth-flow-part-2",
    title: "Authentication Part 2 with NestJS",
    excerpt:
      "Create the first auth and users modules, wire JWT sign-in and sign-up behavior, and protect a profile route with a NestJS guard.",
    date: "2023-10-07T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Authentication", "JWT", "Guards"],
  },
  {
    slug: "2023-10-06-nestjs-auth-flow-fast-start",
    title: "Implementing an Auth Flow Fast with NestJS",
    excerpt:
      "The first step in a NestJS auth-flow series: project setup, CLI usage, SWC compilation, TypeScript target tuning, and Vercel deployment basics.",
    date: "2023-10-06T12:00:00.000Z",
    author: "Henrique Weiand",
    tags: ["NestJS", "Authentication", "SWC", "Vercel"],
  },
];

export function getPostOgData(slug: string) {
  return postOgData.find((post) => post.slug === slug);
}
