import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Res,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import type { Response } from 'express';
import { GetInvoicesQueryDto } from './dto/get-invoices.query.dto';

@Controller('api/v1/invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const invoice = await this.invoiceService.create(createInvoiceDto);
    res.setHeader('Location', `/api/v1/invoices/${invoice.invoiceNumber}`);
    return invoice;
  }

  @Get()
  async findAll(
    @Query() query: GetInvoicesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const expand = (query.expand ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const { data, total } = await this.invoiceService.findAll({
      offset: query.offset ?? 0,
      limit: query.limit ?? 25,
      search: query.search,
      dealer: query.dealer,
      expand,
    });
    res.setHeader('X-Total-Count', String(total));
    return {
      data,
      meta: {
        total,
        offset: query.offset ?? 0,
        limit: query.limit ?? 25,
      },
    };
  }

  @Get(':invoiceNumber')
  async findOne(
    @Param('invoiceNumber') invoiceNumber: string,
    @Query('expand') expand?: string,
  ) {
    const expandArr = (expand ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const invoice = await this.invoiceService.findOne(invoiceNumber, expandArr);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  @Patch(':invoiceNumber')
  update(
    @Param('invoiceNumber') invoiceNumber: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoiceService.update(invoiceNumber, updateInvoiceDto);
  }

  @Delete(':invoiceNumber')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('invoiceNumber') invoiceNumber: string) {
    await this.invoiceService.remove(invoiceNumber);
    return;
  }
}
