---
title: >-
  Implementing Kubernetes Jobs with NestJS and nest-commander: A Practical Guide
  (Ex. implementation with Ticketmaster)
excerpt: >-
  Implementing Kubernetes Jobs with NestJS and nest-commander: A Practical Guide
  (Ex. implementation with ticketmaster)
coverImage: >-
  /blog-assets/implementing-kubernetes-jobs-with-nestjs-and-nest-commander-a-practical-guide-ex-implement/cover.png
date: '2025-02-18T12:00:00.000Z'
author:
  name: Henrique Weiand
  picture: /nestjs-ninja.png
ogImage:
  url: >-
    /blog-assets/implementing-kubernetes-jobs-with-nestjs-and-nest-commander-a-practical-guide-ex-implement/cover.png
tags:
  - CLI
  - K8S
  - Nest
  - Nest-Commander
  - NestJS
  - Node.js
  - TicketMaster
  - TypeORM
---
Hey there! Ever found yourself knee-deep in building NestJS applications and thought, “Man, I wish I could bring this awesome structure to my command-line tools”? Well, you’re in luck! The [nest-commander package](https://docs.nestjs.com/recipes/nest-commander) does just that, letting you craft CLI applications with the same NestJS flair you know and love.

But wait, there’s more! Imagine taking these slick CLI apps and running them as jobs in a Kubernetes environment. Sounds like a dream, right? That’s where the [nestjs-job-commander repository](https://github.com/henriqueweiand/nestjs-job-commander) comes into play. It’s a nifty example showing how to set up a job processing system using NestJS and nest-commander, all within Kubernetes.

In this article, we’ll explore the details of this setup, breaking down the implementation so you can try it out yourself. Let’s get started!

[https://github.com/henriqueweiand/nestjs-job-commander](https://github.com/henriqueweiand/nestjs-job-commander)

### **Technologies used 🛠️**

- **NestJS:** A progressive Node.js framework for building efficient and scalable server-side applications.
- **nest-commander:** A NestJS module that facilitates the creation of CLI applications with a structure similar to typical NestJS applications. Find out more about it [https://docs.nestjs.com/recipes/nest-commander](https://docs.nestjs.com/recipes/nest-commander)
- **TypeORM:** An ORM for TypeScript and JavaScript that supports various databases. Find out more about it [https://docs.nestjs.com/recipes/sql-typeorm](https://docs.nestjs.com/recipes/sql-typeorm)
- **Kubernetes (k8s):** An open-source system for automating deployment, scaling, and management of containerized applications.
- **Monorepo:** A repository structure that holds multiple projects, allowing for shared code and unified project management. Find out more about it [https://docs.nestjs.com/cli/monorepo](https://docs.nestjs.com/cli/monorepo)

### **Repository Structure 🗺️**

The repository is organized as a monorepo, containing multiple projects and shared libraries. Key components include:

- apps/cli-enricher: The CLI application is built with NestJS and nest-commander.
- libs: Shared libraries utilized by the CLI application.
- k8s: Kubernetes configuration files for deploying the job.
- Dockerfile: Defines the Docker image for the CLI application.
- .env: Environment variables configuration file.

In this repository, we will get into just one CLI, but you can have as many as you need.

### CLI Enricher

Similar to a traditional NestJS application, an application with NestJS Commander is set up quite simply. In the main.ts we define the bootstrap method

[https://github.com/henriqueweiand/nestjs-job-commander/blob/master/apps/cli-enricher/src/main.ts](https://github.com/henriqueweiand/nestjs-job-commander/blob/master/apps/cli-enricher/src/main.ts)

Then, we need to create the AppModule, which will require the base modules like ENV Module, Database connection, and also the module for your CLI, in this case, I just have one, but, if you have more, don't forget to add them here!

[https://github.com/henriqueweiand/nestjs-job-commander/blob/master/apps/cli-enricher/src/app.module.ts](https://github.com/henriqueweiand/nestjs-job-commander/blob/master/apps/cli-enricher/src/app.module.ts)

The AppModule needs to export the main command, that's why there's an export. Opening the `CliCommand`, you will notice a base structure for a general CLI command, and the reason it is quite basic is that this project is not using the root command, it is using `subCommands`. There's no big reason for that, I decided to use it as a subcommand instead of a root, but I will detail more about it later.

[https://github.com/henriqueweiand/nestjs-job-commander/blob/master/apps/cli-enricher/src/cli-command.ts](https://github.com/henriqueweiand/nestjs-job-commander/blob/master/apps/cli-enricher/src/cli-command.ts)

I'm going to explain more about how to use the root command at the end of the article, for now, let's stick to the app context. 

Yet inside the CliCommand, we need to define the `subCommands`, and then it is necessary to add the command file of that.

[https://github.com/henriqueweiand/nestjs-job-commander/blob/master/apps/cli-enricher/src/cli-command.ts](https://github.com/henriqueweiand/nestjs-job-commander/blob/master/apps/cli-enricher/src/cli-command.ts)

This is the core of our CLI Enricher. In this file, we define the command name

```bash
@SubCommand({ name: 'ticketmaster-event-refresh' })
```

`TicketMasterEventRefreshCommand` holds the logic of our CLI Job. The job gets the events from the Ticket Master API, verifies whether the event exists or not, and stores it. Again, the logic is not the focus of the post, but how to manage Nest Commander inside the Kubernetes.

[https://github.com/henriqueweiand/nestjs-job-commander/blob/master/apps/cli-enricher/src/ticketmaster-event-refresh/ticketmaster_event_refresh.command.ts](https://github.com/henriqueweiand/nestjs-job-commander/blob/master/apps/cli-enricher/src/ticketmaster-event-refresh/ticketmaster_event_refresh.command.ts)

By using `subCommands`, in the end, we will execute it like this

```bash
-- cli ticketmaster-event-refresh
```

### Running the job - outside k8s

In case you need to test the application before putting it inside the k8s, which I strongly recommend. You can do that by running the command

```bash
nest start --watch -- cli ticketmaster-event-refresh
```

<aside>
⚠️

Make sure you have everything that your application needs to run ready, for example, the database instance and the tables. 

</aside>

This project has a `how-to-run` section in the [README](https://github.com/henriqueweiand/nestjs-job-commander) file to help you to run this example locally without any issues.

### Running the job - inside k8s

So far, we have a NestJS application with NestJS Commander, and we know that the application works! The next step is putting the app inside a Pod in the k8s, and for that, we will need to create two things!

1. The docker image;
2. Kubeclt file for the cronjob;

For the docker image, we only need to run 

```bash
docker build -t ticketmaster-event-refresh-job .
```

The command will build the [Dockerfile](https://github.com/henriqueweiand/nestjs-job-commander/blob/master/Dockerfile) available at the root level, and this Dockerfile doesn't have anything different from any other NestJS application with docker, but, feel free to take a look.

Next, change the .env file and add the following envs

```bash
CLI-ENRICHER.HOST=host.docker.internal
NODE_ENV=production
```

Since we are going to run the app inside the cluster, we need to set the correct host to make it able to reach the database. The NODE_ENV with the production value is required because of the logic for the EnvModule.

Now, create a config map inside your cluster. Run the command 

```bash
kubectl create configmap env-config --from-env-file=.env
```

This command will create a config map and add the .env variables inside it. We will need the .env to run the application inside the cluster.

The last step is running the `kubeclt` command. Go to the k8s folder and execute

```bash
kubectl apply -f cronjob.yaml
```

In case you want to know, the `cronjob.yaml` is a spec file to create a job inside the k8s.

[https://github.com/henriqueweiand/nestjs-job-commander/blob/master/k8s/cronjob.yaml](https://github.com/henriqueweiand/nestjs-job-commander/blob/master/k8s/cronjob.yaml)

The job is being set to run each minute, and it follows the same sequence of commands as we tested outside the k8s previously.

```bash
command:
  - node
  - dist/apps/cli-enricher/main.js
  - cli
  - ticketmaster-event-refresh
```

I recorded a video to help you to run everything in case is needed! 

[https://youtu.be/GCfBnEMHVEE](https://youtu.be/GCfBnEMHVEE)

---

### Conclusion

And there you have it! With **NestJS Commander** and **Kubernetes**, you can seamlessly build and deploy CLI applications using the familiar NestJS structure. This setup allows you to manage jobs efficiently, whether running them locally or within a Kubernetes cluster.

By leveraging **subCommands**, **Docker**, and **Kubernetes CronJobs**, we’ve created a system that can scale and automate job execution while maintaining flexibility. If you’re working on task automation, scheduled jobs, or batch processing, this approach can help you streamline your workflow.

I mentioned earlier that I’d dive deeper into **root commands** and **parameter handling**—don’t worry, that’s coming in a future post! Stay tuned, and in the meantime, feel free to check out the [nestjs-job-commander repository](https://github.com/henriqueweiand/nestjs-job-commander) and try it yourself.

Got questions or feedback? Drop a comment or reach out—I’d love to hear your thoughts! 🚀
