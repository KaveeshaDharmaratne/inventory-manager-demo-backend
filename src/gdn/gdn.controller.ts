import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreateGdnDto } from './dto/create-gdn.dto';
import { GdnService } from './gdn.service';

@Controller('api/v1/gdns')
export class GdnController {
  constructor(private readonly gdnService: GdnService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createGdnDto: CreateGdnDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const gdn = await this.gdnService.create(createGdnDto);
    res.setHeader('Location', `/api/v1/gdns/${gdn.gdnNumber}`);
    return gdn;
  }

  @Get()
  findAll() {
    return this.gdnService.findAll();
  }

  @Get(':gdnNumber')
  async findOne(@Param('gdnNumber') gdnNumber: string) {
    const gdn = await this.gdnService.findOne(gdnNumber);
    if (!gdn) {
      throw new NotFoundException('GDN not found');
    }

    return gdn;
  }
}
