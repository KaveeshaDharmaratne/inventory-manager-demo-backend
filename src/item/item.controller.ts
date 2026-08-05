import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ItemService } from './item.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Controller('api/v1/items')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Post()
  create(@Body() createItemDto: CreateItemDto) {
    return this.itemService.create(createItemDto);
  }

  @Get()
  findAll() {
    return this.itemService.findAll();
  }

  @Get('ledger')
  getLedgerByDateRange(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('productCode') productCode?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException(
        '"from" and "to" query params are required',
      );
    }
    return this.itemService.getLedgerByDateRange(from, to, productCode);
  }

  @Get(':code/ledger')
  getLedger(
    @Param('code') code: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException(
        '"from" and "to" query params are required',
      );
    }
    return this.itemService.getLedger(code, from, to);
  }

  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.itemService.findOne(code);
  }

  @Patch(':code')
  update(@Param('code') code: string, @Body() updateItemDto: UpdateItemDto) {
    return this.itemService.update(code, updateItemDto);
  }

  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.itemService.remove(code);
  }
}
