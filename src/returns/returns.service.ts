import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { CreateReturnDto, ReturnItemDto } from './dto/create-return.dto';
import { Return } from './entities/return.entity';
import { ReturnItem } from './entities/return-item.entity';
import { DealerReturn } from './entities/dealer-return.entity';
import { Dealer } from '../dealers/entities/dealer.entity';
import { Item } from '../item/entities/item.entity';
import { UnusableItem } from '../item/entities/unusable-item.entity';
import { DealerService } from '../dealers/dealer.service';
import { ItemService } from '../item/item.service';
import { toLocalDateString } from '../common/utils/date.util';

@Injectable()
export class ReturnsService {
  constructor(
    @InjectRepository(Return)
    private readonly returnRepository: Repository<Return>,
    private readonly dealerService: DealerService,
    private readonly itemService: ItemService,
    private readonly dataSource: DataSource,
  ) {}

  private async resolverDealer(ref: string): Promise<Dealer> {
    const dealer = await this.dealerService.findByIdOrName(ref);
    if (!dealer) {
      throw new BadRequestException(
        `Dealer "${ref}" not found; create the dealer first`,
      );
    }
    return dealer;
  }

  private async persistReturn(
    manager: EntityManager,
    dto: CreateReturnDto,
    dealerId: string,
  ): Promise<Return> {
    const normalizedDate = toLocalDateString(dto.date);
    const newReturn = manager.create(Return, {
      returnNoteNo: dto.returnNoteNo,
      date: normalizedDate,
      type: dto.type,
      dealerId,
    });
    await manager.save(newReturn);
    const dealerReturn = manager.create(DealerReturn, {
      dealerId,
      returnId: newReturn.returnNoteNo,
    });
    await manager.save(dealerReturn);
    return newReturn;
  }

  private async persistItems(
    manager: EntityManager,
    returnNoteNo: string,
    type: string,
    items: ReturnItemDto[],
  ): Promise<void> {
    for (const itemDto of items) {
      const qty = itemDto.qty ?? 0;
      const item = await manager.findOne(Item, {
        where: { code: itemDto.code },
      });
      if (!item) {
        throw new BadRequestException(`Item codes not found: ${itemDto.code}`);
      }
      const returnItem = manager.create(ReturnItem, {
        returnId: returnNoteNo,
        itemCode: item.code,
        quantity: qty,
      });
      await manager.save(returnItem);

      if (type === 'Good') {
        // Good return: add back to usable stock
        await manager.increment(Item, { code: item.code }, 'quantity', qty);
      } else if (type === 'Damage' || type === 'Expired') {
        // Damage / Expired: track in unusable_item
        const existing = await manager.findOne(UnusableItem, {
          where: { itemCode: item.code, type },
        });
        if (existing) {
          await manager.increment(
            UnusableItem,
            { itemCode: item.code, type },
            'quantity',
            qty,
          );
        } else {
          const unusable = manager.create(UnusableItem, {
            itemCode: item.code,
            type,
            quantity: qty,
          });
          await manager.save(unusable);
        }
      }
    }
  }

  async create(dto: CreateReturnDto): Promise<Return | null> {
    const dealer = await this.resolverDealer(dto.dealer);
    await this.itemService.ensureItemsExist(dto.items.map((item) => item.code));

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const newReturn = await this.persistReturn(
        queryRunner.manager,
        dto,
        dealer.id,
      );
      await this.persistItems(
        queryRunner.manager,
        newReturn.returnNoteNo,
        dto.type,
        dto.items,
      );
      await queryRunner.commitTransaction();
      return this.findOne(newReturn.returnNoteNo);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException(
        'Failed to create return',
        err instanceof Error ? err.message : 'Unknown error',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Return[]> {
    return this.returnRepository.find({
      relations: ['dealer', 'items', 'items.item'],
      order: { date: 'DESC' },
    });
  }

  async findOne(returnNoteNo: string): Promise<Return | null> {
    return this.returnRepository.findOne({
      where: { returnNoteNo },
      relations: ['dealer', 'items', 'items.item'],
    });
  }
}
