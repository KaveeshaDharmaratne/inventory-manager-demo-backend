import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1719000000000 implements MigrationInterface {
  name = 'InitialSchema1719000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the "item" table already exists.
    // If it does, we assume the base schema is already applied.
    const tableExists = await queryRunner.hasTable('item');
    if (tableExists) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "item" (
        "code" varchar UNIQUE PRIMARY KEY,
        "description" varchar,
        "quantity" integer
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "dealer" (
        "id" varchar UNIQUE PRIMARY KEY,
        "name" varchar
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "invoice" (
        "invoice_number" varchar UNIQUE PRIMARY KEY,
        "date" DATE,
        "dealer_id" varchar
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "invoice_item" (
        "invoice_number" varchar,
        "item_code" varchar,
        "quantity" integer,
        "created_at" TIMESTAMP,
        "modified_at" TIMESTAMP,
        PRIMARY KEY ("invoice_number", "item_code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "return" (
        "return_note_no" varchar UNIQUE PRIMARY KEY,
        "date" DATE,
        "type" varchar,
        "dealer_id" varchar
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "return_item" (
        "return_id" varchar,
        "item_code" varchar,
        "quantity" integer,
        "created_at" TIMESTAMP,
        "modified_at" TIMESTAMP,
        PRIMARY KEY ("return_id", "item_code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "dealer_invoice" (
        "dealer_id" varchar,
        "invoice_id" varchar,
        "created_at" TIMESTAMP,
        "modified_at" TIMESTAMP,
        PRIMARY KEY ("dealer_id", "invoice_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "dealer_return" (
        "dealer_id" varchar,
        "return_id" varchar,
        "created_at" TIMESTAMP,
        "modified_at" TIMESTAMP,
        PRIMARY KEY ("dealer_id", "return_id")
      )
    `);

    await queryRunner.query(`ALTER TABLE "invoice" ADD FOREIGN KEY ("dealer_id") REFERENCES "dealer" ("id")`);
    await queryRunner.query(`ALTER TABLE "invoice_item" ADD FOREIGN KEY ("invoice_number") REFERENCES "invoice" ("invoice_number")`);
    await queryRunner.query(`ALTER TABLE "invoice_item" ADD FOREIGN KEY ("item_code") REFERENCES "item" ("code")`);
    await queryRunner.query(`ALTER TABLE "return" ADD FOREIGN KEY ("dealer_id") REFERENCES "dealer" ("id")`);
    await queryRunner.query(`ALTER TABLE "return_item" ADD FOREIGN KEY ("return_id") REFERENCES "return" ("return_note_no")`);
    await queryRunner.query(`ALTER TABLE "return_item" ADD FOREIGN KEY ("item_code") REFERENCES "item" ("code")`);
    await queryRunner.query(`ALTER TABLE "dealer_invoice" ADD FOREIGN KEY ("dealer_id") REFERENCES "dealer" ("id")`);
    await queryRunner.query(`ALTER TABLE "dealer_invoice" ADD FOREIGN KEY ("invoice_id") REFERENCES "invoice" ("invoice_number")`);
    await queryRunner.query(`ALTER TABLE "dealer_return" ADD FOREIGN KEY ("dealer_id") REFERENCES "dealer" ("id")`);
    await queryRunner.query(`ALTER TABLE "dealer_return" ADD FOREIGN KEY ("return_id") REFERENCES "return" ("return_note_no")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "dealer_return" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dealer_invoice" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "return_item" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "return" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_item" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dealer" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "item" CASCADE`);
  }
}
