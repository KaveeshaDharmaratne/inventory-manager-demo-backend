import { Controller, Delete, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { DataManagementService } from './data-management.service';

@Controller('api/v1/data-management')
export class DataManagementController {
  constructor(private readonly dataManagementService: DataManagementService) {}

  @Patch('items/wipe-quantities')
  @HttpCode(HttpStatus.OK)
  wipeItemQuantities() {
    return this.dataManagementService.wipeItemQuantities();
  }

  @Delete('items')
  @HttpCode(HttpStatus.OK)
  deleteAllItems() {
    return this.dataManagementService.deleteAllItems();
  }

  @Delete('invoices')
  @HttpCode(HttpStatus.OK)
  deleteAllInvoices() {
    return this.dataManagementService.deleteAllInvoices();
  }

  @Delete('returns')
  @HttpCode(HttpStatus.OK)
  deleteAllReturns() {
    return this.dataManagementService.deleteAllReturns();
  }

  @Delete('gdns')
  @HttpCode(HttpStatus.OK)
  deleteAllGdns() {
    return this.dataManagementService.deleteAllGdns();
  }
}
