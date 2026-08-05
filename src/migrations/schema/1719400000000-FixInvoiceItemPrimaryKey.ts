import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixInvoiceItemPrimaryKey1719400000000 implements MigrationInterface {
  name = 'FixInvoiceItemPrimaryKey1719400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE invoice_item
      ALTER COLUMN invoice_number SET NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE invoice_item
      DROP CONSTRAINT IF EXISTS "PK_e1a7993e2237ff829070a93dae8",
      DROP CONSTRAINT IF EXISTS invoice_item_pkey;
    `);

    await queryRunner.query(`
      ALTER TABLE invoice_item
      ADD CONSTRAINT invoice_item_pkey PRIMARY KEY (invoice_number, item_code);
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_b448415b83d41dfd49012b5dc5b'
        ) THEN
          ALTER TABLE invoice_item
          ADD CONSTRAINT "FK_b448415b83d41dfd49012b5dc5b"
          FOREIGN KEY (item_code) REFERENCES item(code);
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE invoice_item
      DROP CONSTRAINT IF EXISTS invoice_item_pkey,
      DROP CONSTRAINT IF EXISTS "FK_b448415b83d41dfd49012b5dc5b";
    `);

    await queryRunner.query(`
      ALTER TABLE invoice_item
      ADD CONSTRAINT "PK_e1a7993e2237ff829070a93dae8" PRIMARY KEY (item_code);
    `);

    await queryRunner.query(`
      ALTER TABLE invoice_item
      ALTER COLUMN invoice_number DROP NOT NULL;
    `);
  }
}
