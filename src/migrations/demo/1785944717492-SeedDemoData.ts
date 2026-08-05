import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDemoData1785944717492 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Seed demo dealer data
    await queryRunner.query(`
            INSERT INTO dealer (id, name) VALUES
                ('NT00001', 'New Lanka Stores'),
                ('NT00002', 'ABC Traders'),
                ('NT00003', 'Hardware Hub PVT LTD'),
                ('NT00004', 'ANYTHING PVT LTD'),
                ('NT00005', 'Example Store PVT LTD')
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
        `);
    // Seed demo product data
    await queryRunner.query(`
        INSERT INTO item (code, description, quantity) VALUES
            ('10001', 'Red Paint', 525),
            ('10002', 'Green Paint', 456),
            ('10003', 'Large Bucket', 112),
            ('10004', 'Paint Brush', 78),
            ('10005', 'Solvent', 250)
        ON CONFLICT (code) DO UPDATE SET
            description = EXCLUDED.description,
            quantity = EXCLUDED.quantity;    
        `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove demo dealer data
     await queryRunner.query(`
      DELETE FROM dealer WHERE id IN (
        'NT00001',
        'NT00002',
        'NT00003',
        'NT00004',
        'NT00005'
      );
    `);
    // Remove demo product data
    await queryRunner.query(`
      DELETE FROM item WHERE code IN (
        '10001',
        '10002',
        '10003',
        '10004',
        '10005'
      );
    `);
  }
}
