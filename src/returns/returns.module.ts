import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReturnsService } from './returns.service';
import { ReturnsController } from './returns.controller';
import { Return } from './entities/return.entity';
import { ReturnItem } from './entities/return-item.entity';
import { DealerReturn } from './entities/dealer-return.entity';
import { DealerModule } from '../dealers/dealer.module';
import { UnusableItem } from '../item/entities/unusable-item.entity';
import { ItemModule } from '../item/item.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Return, ReturnItem, DealerReturn, UnusableItem]),
    DealerModule,
    ItemModule,
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
