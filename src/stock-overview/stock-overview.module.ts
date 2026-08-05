import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockOverviewService } from './stock-overview.service';
import { StockOverviewController } from './stock-overview.controller';
import { Invoice } from '../invoice/entities/invoice.entity';
import { InvoiceItem } from '../invoice/entities/invoice-item.entity';
import { Return } from '../returns/entities/return.entity';
import { ReturnItem } from '../returns/entities/return-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Return, ReturnItem]),
  ],
  controllers: [StockOverviewController],
  providers: [StockOverviewService],
})
export class StockOverviewModule {}
