import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Dealer } from '../dealers/entities/dealer.entity';
import { ItemModule } from '../item/item.module';

@Module({
  controllers: [InvoiceController],
  providers: [InvoiceService],
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Dealer]),
    ItemModule,
  ],
})
export class InvoiceModule {}
