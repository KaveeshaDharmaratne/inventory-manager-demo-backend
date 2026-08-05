import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GdnController } from './gdn.controller';
import { GdnService } from './gdn.service';
import { GdnItem } from './entities/gdn-item.entity';
import { Gdn } from './entities/gdn.entity';
import { ItemModule } from '../item/item.module';

@Module({
  imports: [TypeOrmModule.forFeature([Gdn, GdnItem]), ItemModule],
  controllers: [GdnController],
  providers: [GdnService],
})
export class GdnModule {}
