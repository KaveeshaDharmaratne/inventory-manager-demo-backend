import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateGdnDto, GdnItemDto } from './dto/create-gdn.dto';
import { toLocalDateString } from '../common/utils/date.util';
import { Gdn } from './entities/gdn.entity';
import { GdnItem } from './entities/gdn-item.entity';
import { Item } from '../item/entities/item.entity';
import { ItemService } from '../item/item.service';

@Injectable()
export class GdnService {
  private readonly logger = new Logger(GdnService.name);

  constructor(
    @InjectRepository(Gdn)
    private readonly gdnRepository: Repository<Gdn>,
    @InjectRepository(GdnItem)
    private readonly gdnItemRepository: Repository<GdnItem>,
    private readonly itemService: ItemService,
  ) {}

  async create(createGdnDto: CreateGdnDto): Promise<Gdn> {
    const { gdnNumber, date, items } = createGdnDto;

    this.validateGdnItems(items);

    const existing = await this.gdnRepository.findOne({
      where: { gdnNumber },
    });
    if (existing) {
      throw new BadRequestException(`GDN number ${gdnNumber} is already taken`);
    }

    const aggregated = new Map<string, number>();
    for (const item of items) {
      aggregated.set(
        item.code,
        (aggregated.get(item.code) ?? 0) + item.quantity,
      );
    }

    await this.itemService.ensureItemsExist(Array.from(aggregated.keys()));

    try {
      await this.gdnRepository.manager.transaction(async (manager) => {
        const normalizedDate = toLocalDateString(date);
        await manager.insert(Gdn, { gdnNumber, date: normalizedDate });

        const gdnItems = Array.from(aggregated, ([code, quantity]) => ({
          gdnNumber,
          itemCode: code,
          quantity,
        }));

        await manager.insert(GdnItem, gdnItems);

        for (const [code, quantity] of aggregated) {
          await manager.increment(Item, { code }, 'quantity', quantity);
        }
      });

      return (await this.findOne(gdnNumber)) as Gdn;
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        throw err;
      }

      this.logger.error(
        'Failed to create GDN',
        err instanceof Error ? err.stack : err,
      );
      throw new InternalServerErrorException(
        'Failed to create GDN',
        err instanceof Error ? err.message : undefined,
      );
    }
  }

  async findAll(): Promise<Gdn[]> {
    const gdns = await this.gdnRepository.find({
      order: { date: 'DESC' },
    });

    await this.attachItems(gdns);
    return gdns;
  }

  async findOne(gdnNumber: string): Promise<Gdn | null> {
    const gdn = await this.gdnRepository.findOne({ where: { gdnNumber } });
    if (!gdn) {
      return null;
    }

    gdn.items = await this.gdnItemRepository.find({ where: { gdnNumber } });
    return gdn;
  }

  private async attachItems(gdns: Gdn[]): Promise<void> {
    if (gdns.length === 0) {
      return;
    }

    const gdnNumbers = gdns.map((gdn) => gdn.gdnNumber);
    const items = await this.gdnItemRepository.find({
      where: { gdnNumber: In(gdnNumbers) },
      order: { gdnNumber: 'ASC' },
    });

    const itemsByGdn = new Map<string, GdnItem[]>();
    for (const item of items) {
      const existing = itemsByGdn.get(item.gdnNumber) ?? [];
      existing.push(item);
      itemsByGdn.set(item.gdnNumber, existing);
    }

    for (const gdn of gdns) {
      gdn.items = itemsByGdn.get(gdn.gdnNumber) ?? [];
    }
  }

  private validateGdnItems(items: unknown): asserts items is GdnItemDto[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('GDN must contain at least one item');
    }

    for (const [index, item] of items.entries()) {
      if (typeof item !== 'object' || item === null) {
        throw new BadRequestException(`Invalid GDN item at index ${index}`);
      }

      const { code, description, quantity } = item as Record<string, unknown>;

      if (typeof code !== 'string' || !/^\d{5}$/.test(code)) {
        throw new BadRequestException(`Invalid item code at index ${index}`);
      }

      if (typeof description !== 'string' || description.trim() === '') {
        throw new BadRequestException(
          `Invalid item description at index ${index}`,
        );
      }

      if (
        typeof quantity !== 'number' ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        throw new BadRequestException(
          `Invalid item quantity at index ${index}`,
        );
      }
    }
  }
}
