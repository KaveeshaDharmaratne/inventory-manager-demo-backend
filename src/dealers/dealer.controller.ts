import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { DealerService } from './dealer.service';
import { CreateDealerDto } from './dto/create-dealer.dto';
import { UpdateDealerDto } from './dto/update-dealer.dto';
import type { Response } from 'express';

@Controller('api/v1/dealers')
export class DealerController {
  constructor(private readonly dealerService: DealerService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDealerDto: CreateDealerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const dealer = await this.dealerService.create(createDealerDto);
    res.setHeader('Location', `/api/v1/dealers/${dealer.id}`);
    return dealer;
  }

  // Optional search query params: ?search=term&limit=25&offset=0
  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const lim = limit ? Number(limit) : 25;
    const off = offset ? Number(offset) : 0;
    const { data, total } = await this.dealerService.findAll({
      search,
      limit: lim,
      offset: off,
    });
    res?.setHeader('X-Total-Count', String(total));
    return {
      data,
      meta: { total, limit: lim, offset: off },
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dealerService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDealerDto: UpdateDealerDto) {
    return this.dealerService.update(id, updateDealerDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.dealerService.remove(id);
    return;
  }
}
