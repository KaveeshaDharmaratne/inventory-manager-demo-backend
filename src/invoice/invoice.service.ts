import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ILike,
  In,
  Repository,
  FindOptionsWhere,
  EntityManager,
} from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Dealer } from '../dealers/entities/dealer.entity';
import { Item } from '../item/entities/item.entity';
import { ItemService } from '../item/item.service';
import { toLocalDateString } from '../common/utils/date.util';
@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Dealer)
    private readonly dealerRepository: Repository<Dealer>,
    private readonly itemService: ItemService,
  ) {}

  async create(createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    const { dealer: dealerRef, items, ...rest } = createInvoiceDto;

    this.validateInvoiceItems(items);

    // Check if invoice number is already taken
    const existing = await this.invoiceRepository.findOne({
      where: { invoiceNumber: rest.invoiceNumber },
    });
    if (existing) {
      throw new BadRequestException(
        `Invoice number ${rest.invoiceNumber} is already taken`,
      );
    }

    const dealerEntity = await this.resolveDealer(dealerRef);
    if (!dealerEntity) {
      throw new BadRequestException('Dealer not found; provide existing name');
    }

    await this.itemService.ensureItemsExist(items.map((item) => item.code));

    // Aggregate duplicate item codes by summing quantities
    const aggregated = new Map<string, number>();
    for (const item of items) {
      aggregated.set(
        item.code,
        (aggregated.get(item.code) ?? 0) + item.quantity,
      );
    }

    try {
      await this.invoiceRepository.manager.transaction(async (manager) => {
        await this.ensureSufficientStock(manager, aggregated);

        const normalizedDate = toLocalDateString(rest.date);

        await manager.insert(Invoice, {
          invoiceNumber: rest.invoiceNumber,
          date: normalizedDate,
          dealerId: dealerEntity.id,
        });

        const invoiceItems = Array.from(aggregated, ([code, quantity]) => ({
          invoiceNumber: rest.invoiceNumber,
          itemCode: code,
          quantity,
        }));
        await manager.insert(InvoiceItem, invoiceItems);

        // Decrease item stock quantities
        for (const [code, quantity] of aggregated) {
          await manager.decrement(Item, { code }, 'quantity', quantity);
        }
      });

      return (await this.loadInvoiceWithRelations(rest.invoiceNumber, [
        'items',
        'dealer',
      ]))!;
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(
        'Failed to create invoice',
        err instanceof Error ? err.stack : err,
      );
      throw new InternalServerErrorException(
        'Failed to create invoice',
        err instanceof Error ? err.message : undefined,
      );
    }
  }

  private async ensureSufficientStock(
    manager: EntityManager,
    aggregated: Map<string, number>,
  ): Promise<void> {
    const itemCodes = Array.from(aggregated.keys());
    const stockItems = await manager.find(Item, {
      where: { code: In(itemCodes) },
      select: ['code', 'quantity'],
      lock: { mode: 'pessimistic_write' },
    });

    const stockByCode = new Map(
      stockItems.map((item) => [item.code, item.quantity ?? 0]),
    );

    const insufficientItems = itemCodes
      .map((code) => {
        const requestedQuantity = aggregated.get(code) ?? 0;
        const availableQuantity = stockByCode.get(code) ?? 0;

        if (requestedQuantity <= availableQuantity) {
          return null;
        }

        return `Item ${code} has only ${availableQuantity} remaining, but invoice requests ${requestedQuantity}`;
      })
      .filter((message): message is string => message !== null);

    if (insufficientItems.length > 0) {
      throw new BadRequestException(insufficientItems.join('; '));
    }
  }

  private validateInvoiceItems(
    items: unknown,
  ): asserts items is import('./dto/create-invoice.dto').InvoiceItemDto[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Invoice must contain at least one item');
    }

    const arr = items as import('./dto/create-invoice.dto').InvoiceItemDto[];
    for (const [idx, it] of arr.entries()) {
      if (!it.code || !/^\d{5}$/.test(String(it.code))) {
        throw new BadRequestException(`Invalid item code at index ${idx}`);
      }
      if (!it.description || String(it.description).trim() === '') {
        throw new BadRequestException(
          `Invalid item description at index ${idx}`,
        );
      }
      if (!Number.isInteger(it.quantity) || it.quantity < 1) {
        throw new BadRequestException(`Invalid item quantity at index ${idx}`);
      }
    }
  }

  private async resolveDealer(dealerRef: string): Promise<Dealer | null> {
    if (!dealerRef) return null;

    // try exact id match first
    let dealer = await this.dealerRepository.findOne({
      where: { id: dealerRef },
    });
    if (dealer) return dealer;

    // then try exact name match
    dealer = await this.dealerRepository.findOne({
      where: { name: dealerRef },
    });
    if (dealer) return dealer;

    return null;
  }

  private async loadInvoiceWithRelations(
    invoiceNumber: string,
    expand?: string[],
  ): Promise<Invoice | null> {
    const relations: Record<string, boolean> = {};
    if (expand?.includes('dealer')) relations.dealer = true;

    const invoice = await this.invoiceRepository.findOne({
      where: { invoiceNumber },
      relations,
    });
    if (!invoice) return null;

    if (expand?.includes('items')) {
      invoice.items = await this.invoiceItemRepository.find({
        where: { invoiceNumber },
      });
    }
    return invoice;
  }

  async findAll(opts: {
    offset?: number;
    limit?: number;
    search?: string;
    dealer?: string;
    expand?: string[];
  }): Promise<{ data: Invoice[]; total: number }> {
    const { offset, limit, search, dealer, expand } = opts;
    const relations: Record<string, boolean> = {};
    if (expand?.includes('dealer')) {
      relations.dealer = true;
    }

    const where: FindOptionsWhere<Invoice> = {};
    if (search) {
      where.invoiceNumber = ILike(`%${search}%`);
    }
    if (dealer) {
      const qb = this.invoiceRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.dealer', 'dealer')
        .where('dealer.name ILIKE :dealerName', { dealerName: `%${dealer}%` });

      if (search)
        qb.andWhere('invoice.invoice_number ILIKE :search', {
          search: `%${search}%`,
        });

      qb.orderBy('invoice.date', 'DESC').skip(offset).take(limit);
      const [data, total] = await qb.getManyAndCount();

      if (expand?.includes('items')) {
        await this.attachItems(data);
      }
      return { data, total };
    }

    const [data, total] = await this.invoiceRepository.findAndCount({
      where,
      relations,
      skip: offset,
      take: limit,
      order: { date: 'DESC' },
    });

    if (expand?.includes('items')) {
      await this.attachItems(data);
    }

    return { data, total };
  }

  private async attachItems(invoices: Invoice[]): Promise<void> {
    if (invoices.length === 0) return;
    const numbers = invoices.map((i) => i.invoiceNumber);
    const allItems = await this.invoiceItemRepository.find({
      where: { invoiceNumber: In(numbers) },
    });
    const itemsByInvoice = new Map<string, InvoiceItem[]>();
    for (const item of allItems) {
      const list = itemsByInvoice.get(item.invoiceNumber) ?? [];
      list.push(item);
      itemsByInvoice.set(item.invoiceNumber, list);
    }
    for (const inv of invoices) {
      inv.items = itemsByInvoice.get(inv.invoiceNumber) ?? [];
    }
  }

  findOne(invoiceNumber: string, expand?: string[]): Promise<Invoice | null> {
    return this.loadInvoiceWithRelations(invoiceNumber, expand);
  }

  update(invoiceNumber: string, updateInvoiceDto: UpdateInvoiceDto) {
    return (async () => {
      const invoice = await this.loadInvoiceWithRelations(invoiceNumber, [
        'items',
        'dealer',
      ]);
      if (!invoice) {
        throw new BadRequestException('Invoice not found');
      }

      if (updateInvoiceDto.dealer) {
        const dealer = await this.resolveDealer(updateInvoiceDto.dealer);
        if (!dealer) throw new BadRequestException('Dealer not found');
        invoice.dealer = dealer;
      }

      Object.assign(invoice, { ...updateInvoiceDto, dealer: undefined });
      return this.invoiceRepository.save(invoice);
    })();
  }

  async remove(invoiceNumber: string): Promise<void> {
    await this.invoiceRepository.manager.transaction(async (manager) => {
      await manager.delete(InvoiceItem, { invoiceNumber });
      await manager.delete(Invoice, { invoiceNumber });
    });
  }
}
