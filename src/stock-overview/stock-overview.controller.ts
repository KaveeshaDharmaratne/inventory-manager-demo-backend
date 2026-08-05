import { Controller, Get, Query } from '@nestjs/common';
import {
  StockOverviewService,
  PaginatedTransactions,
  StockMetrics,
  ProductItem,
} from './stock-overview.service';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { GetTransactionQueryDto } from './dto/get-transaction-query.dto';

@Controller('stock-overview')
export class StockOverviewController {
  constructor(private readonly stockOverviewService: StockOverviewService) {}

  @Get('metrics')
  getMetrics(): Promise<StockMetrics> {
    return this.stockOverviewService.getMetrics();
  }

  @Get('products/all')
  getAllProducts(): Promise<ProductItem[]> {
    return this.stockOverviewService.getProducts('all');
  }

  @Get('products/low-stock')
  getLowStockProducts(): Promise<ProductItem[]> {
    return this.stockOverviewService.getProducts('low-stock');
  }

  @Get('products/out-of-stock')
  getOutOfStockProducts(): Promise<ProductItem[]> {
    return this.stockOverviewService.getProducts('out-of-stock');
  }

  @Get('list-transactions')
  listTransactions(
    @Query() query: ListTransactionsQueryDto,
  ): Promise<PaginatedTransactions> {
    return this.stockOverviewService.listTransactions(query);
  }

  @Get('transaction')
  getTransaction(@Query() query: GetTransactionQueryDto) {
    return this.stockOverviewService.getTransaction(query.type, query.id);
  }
}
