import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DataManagementService {
  constructor(private readonly dataSource: DataSource) {}

  async wipeItemQuantities(): Promise<{ affected: number }> {
    const result = await this.dataSource.query(
      `UPDATE item SET quantity = 0`,
    );
    return { affected: result[1] ?? 0 };
  }

  async deleteAllItems(): Promise<{ affected: number }> {
    return this.dataSource.transaction(async (manager) => {
      // Remove child records in dependency order before deleting items
      await manager.query(`DELETE FROM unusable_item`);
      await manager.query(`DELETE FROM gdn_item`);
      await manager.query(`DELETE FROM invoice_item`);
      await manager.query(`DELETE FROM return_item`);
      await manager.query(`DELETE FROM gdn`);
      await manager.query(`DELETE FROM invoice`);
      await manager.query(`DELETE FROM "return"`);
      await manager.query(`DELETE FROM dealer_return`);
      const result = await manager.query(`DELETE FROM item`);
      return { affected: result[1] ?? 0 };
    });
  }

  async deleteAllInvoices(): Promise<{ affected: number }> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM invoice_item`);
      const result = await manager.query(`DELETE FROM invoice`);
      return { affected: result[1] ?? 0 };
    });
  }

  async deleteAllReturns(): Promise<{ affected: number }> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM return_item`);
      await manager.query(`DELETE FROM dealer_return`);
      const result = await manager.query(`DELETE FROM "return"`);
      return { affected: result[1] ?? 0 };
    });
  }

  async deleteAllGdns(): Promise<{ affected: number }> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM gdn_item`);
      const result = await manager.query(`DELETE FROM gdn`);
      return { affected: result[1] ?? 0 };
    });
  }
}
