-- Core baseline: the tables behind the ORM entities in src/infrastructure/database/**, in schema "platform".
-- Ids come from Postgres 18 (uuidv7(): time-ordered); the application never assigns them on insert.
-- Entities and this folder must stay in step: database.int.spec.ts fails when they drift apart.

CREATE TABLE "platform"."User" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "email" character varying(254) NOT NULL,
  "password" character varying NOT NULL,
  "role" integer NOT NULL,
  "status" integer NOT NULL,
  "emailVerifiedAt" TIMESTAMP WITH TIME ZONE,
  "failedLoginAttempts" integer NOT NULL DEFAULT '0',
  "lockedUntil" TIMESTAMP WITH TIME ZONE,
  "lastLoginAt" TIMESTAMP WITH TIME ZONE,
  CONSTRAINT "UX_User_email" UNIQUE ("email"),
  CONSTRAINT "PK_User_id" PRIMARY KEY ("id")
);

CREATE TABLE "platform"."Project" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "name" character varying(120) NOT NULL,
  "code" character varying(32) NOT NULL,
  "description" text,
  "isActive" boolean NOT NULL DEFAULT true,
  CONSTRAINT "PK_Project_id" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IX_Project_code" ON "platform"."Project" ("code") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "IX_Project_name" ON "platform"."Project" ("name") WHERE "deletedAt" IS NULL;

CREATE TABLE "platform"."ExampleItem" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "projectId" uuid NOT NULL,
  "name" character varying(120) NOT NULL,
  "description" text,
  "isActive" boolean NOT NULL DEFAULT true,
  CONSTRAINT "PK_ExampleItem_id" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IX_ExampleItem_projectId_name" ON "platform"."ExampleItem" ("projectId", "name") WHERE "deletedAt" IS NULL;
CREATE INDEX "IX_ExampleItem_projectId" ON "platform"."ExampleItem" ("projectId");
ALTER TABLE "platform"."ExampleItem" ADD CONSTRAINT "FK_ExampleItem_Project" FOREIGN KEY ("projectId") REFERENCES "platform"."Project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TABLE "platform"."Otp" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "userId" uuid NOT NULL,
  "purpose" integer NOT NULL,
  "codeHash" character varying(64) NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "attempts" integer NOT NULL DEFAULT '0',
  "usedAt" TIMESTAMP WITH TIME ZONE,
  CONSTRAINT "PK_Otp_id" PRIMARY KEY ("id")
);
CREATE INDEX "IX_Otp_userId_purpose_createdAt" ON "platform"."Otp" ("userId", "purpose", "createdAt");

CREATE TABLE "platform"."Outbox" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMP WITH TIME ZONE,
  "aggregateType" character varying NOT NULL,
  "aggregateId" character varying NOT NULL,
  "eventType" character varying NOT NULL,
  "payload" jsonb NOT NULL,
  "status" integer NOT NULL,
  "retryCount" integer NOT NULL DEFAULT '0',
  "lastError" text,
  "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "publishedAt" TIMESTAMP WITH TIME ZONE,
  "handledBy" jsonb NOT NULL DEFAULT '[]',
  CONSTRAINT "PK_Outbox_id" PRIMARY KEY ("id")
);
CREATE INDEX "IX_Outbox_status_nextAttemptAt" ON "platform"."Outbox" ("status", "nextAttemptAt");

CREATE TABLE "platform"."Session" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "userId" uuid NOT NULL,
  "refreshTokenHash" character varying(64) NOT NULL,
  "rotatedFrom" character varying(64),
  "rotatedAt" TIMESTAMP WITH TIME ZONE,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "ip" character varying(64),
  "userAgent" character varying(255),
  "deviceLabel" character varying(100),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "lastActiveAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "revokedAt" TIMESTAMP WITH TIME ZONE,
  CONSTRAINT "PK_Session_id" PRIMARY KEY ("id")
);
CREATE INDEX "IX_Session_userId" ON "platform"."Session" ("userId");

CREATE TABLE "platform"."AuthEvent" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "userId" uuid,
  "actorUserId" uuid,
  "type" integer NOT NULL,
  "ip" character varying(64),
  "userAgent" character varying(255),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_AuthEvent_id" PRIMARY KEY ("id")
);
CREATE INDEX "IX_AuthEvent_createdAt" ON "platform"."AuthEvent" ("createdAt");
CREATE INDEX "IX_AuthEvent_userId_createdAt" ON "platform"."AuthEvent" ("userId", "createdAt");
