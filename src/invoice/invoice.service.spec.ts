import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Dealer } from '../dealers/entities/dealer.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Item } from '../item/entities/item.entity';
import { BadRequestException } from '@nestjs/common';
import { In } from 'typeorm';
import { ItemService } from '../item/item.service';

const mockInvoiceRepository = {
  findOne: jest.fn(),
  delete: jest.fn(),
  findAndCount: jest.fn(),
  manager: {
    transaction: jest.fn(),
  },
};

const mockInvoiceItemRepository = {
  find: jest.fn(),
};

const mockDealerRepository = {
  findOne: jest.fn(),
};

const mockItemService = {
  ensureItemsExist: jest.fn(),
};

const createTransactionManager = () => ({
  insert: jest.fn().mockResolvedValue(undefined),
  decrement: jest.fn().mockResolvedValue(undefined),
  find: jest.fn(),
});

type TransactionManagerMock = ReturnType<typeof createTransactionManager>;
type TransactionCallback = (
  manager: TransactionManagerMock,
) => Promise<unknown>;

describe('InvoiceService', () => {
  let service: InvoiceService;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: mockInvoiceRepository,
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: mockInvoiceItemRepository,
        },
        {
          provide: getRepositoryToken(Dealer),
          useValue: mockDealerRepository,
        },
        {
          provide: ItemService,
          useValue: mockItemService,
        },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects duplicate invoice numbers before inserting', async () => {
    mockInvoiceRepository.findOne.mockResolvedValue({ invoiceNumber: 'I0001' });

    await expect(
      service.create({
        invoiceNumber: 'I0001',
        date: '2026-03-10',
        dealer: 'seed-dealer-001',
        items: [{ code: '12345', description: 'Item', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockInvoiceRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('aggregates repeated item codes and inserts invoice items once per code', async () => {
    mockInvoiceRepository.findOne.mockResolvedValue(null);
    mockDealerRepository.findOne
      .mockResolvedValueOnce({ id: 'dealer-1', name: 'Dealer One' })
      .mockResolvedValueOnce({ id: 'dealer-1', name: 'Dealer One' });
    mockItemService.ensureItemsExist.mockResolvedValue(undefined);

    const transactionManager = createTransactionManager();
    transactionManager.find.mockResolvedValue([
      { code: '12345', quantity: 10 },
      { code: '54321', quantity: 4 },
    ]);
    mockInvoiceRepository.manager.transaction.mockImplementation(
      (callback: TransactionCallback) => callback(transactionManager),
    );
    mockInvoiceRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        invoiceNumber: 'I0002',
        date: '2026-03-10',
        dealerId: 'dealer-1',
        dealer: { id: 'dealer-1', name: 'Dealer One' },
      });
    mockInvoiceItemRepository.find.mockResolvedValue([
      { invoiceNumber: 'I0002', itemCode: '12345', quantity: 5 },
      { invoiceNumber: 'I0002', itemCode: '54321', quantity: 1 },
    ]);

    const result = await service.create({
      invoiceNumber: 'I0002',
      date: '2026-03-10',
      dealer: 'dealer-1',
      items: [
        { code: '12345', description: 'Item A', quantity: 2 },
        { code: '12345', description: 'Item A', quantity: 3 },
        { code: '54321', description: 'Item B', quantity: 1 },
      ],
    });

    expect(mockItemService.ensureItemsExist).toHaveBeenCalledWith([
      '12345',
      '12345',
      '54321',
    ]);
    expect(transactionManager.find).toHaveBeenCalledWith(Item, {
      where: { code: In(['12345', '54321']) },
      select: ['code', 'quantity'],
      lock: { mode: 'pessimistic_write' },
    });
    expect(transactionManager.insert).toHaveBeenNthCalledWith(1, Invoice, {
      invoiceNumber: 'I0002',
      date: '2026-03-10',
      dealerId: 'dealer-1',
    });
    expect(transactionManager.insert).toHaveBeenNthCalledWith(2, InvoiceItem, [
      { invoiceNumber: 'I0002', itemCode: '12345', quantity: 5 },
      { invoiceNumber: 'I0002', itemCode: '54321', quantity: 1 },
    ]);
    expect(transactionManager.decrement).toHaveBeenNthCalledWith(
      1,
      Item,
      { code: '12345' },
      'quantity',
      5,
    );
    expect(transactionManager.decrement).toHaveBeenNthCalledWith(
      2,
      Item,
      { code: '54321' },
      'quantity',
      1,
    );
    expect(result).toMatchObject({
      invoiceNumber: 'I0002',
      dealer: { id: 'dealer-1', name: 'Dealer One' },
      items: [
        { invoiceNumber: 'I0002', itemCode: '12345', quantity: 5 },
        { invoiceNumber: 'I0002', itemCode: '54321', quantity: 1 },
      ],
    });
  });

  it('rejects invoices that request more stock than available', async () => {
    mockInvoiceRepository.findOne.mockResolvedValue(null);
    mockDealerRepository.findOne.mockResolvedValue({
      id: 'dealer-1',
      name: 'Dealer One',
    });
    mockItemService.ensureItemsExist.mockResolvedValue(undefined);

    const transactionManager = createTransactionManager();
    transactionManager.find.mockResolvedValue([
      { code: '10001', quantity: 20 },
    ]);
    mockInvoiceRepository.manager.transaction.mockImplementation(
      (callback: TransactionCallback) => callback(transactionManager),
    );

    await expect(
      service.create({
        invoiceNumber: 'I0004',
        date: '2026-03-10',
        dealer: 'dealer-1',
        items: [{ code: '10001', description: 'Item A', quantity: 35 }],
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Item 10001 has only 20 remaining, but invoice requests 35',
      ),
    );

    expect(transactionManager.insert).not.toHaveBeenCalled();
    expect(transactionManager.decrement).not.toHaveBeenCalled();
  });

  it('rejects invoices that reference missing item codes', async () => {
    mockInvoiceRepository.findOne.mockResolvedValue(null);
    mockDealerRepository.findOne.mockResolvedValue({
      id: 'dealer-1',
      name: 'Dealer One',
    });
    mockItemService.ensureItemsExist.mockRejectedValue(
      new BadRequestException('Item codes not found: 99999'),
    );

    await expect(
      service.create({
        invoiceNumber: 'I0005',
        date: '2026-03-10',
        dealer: 'dealer-1',
        items: [{ code: '99999', description: 'Unknown', quantity: 1 }],
      }),
    ).rejects.toThrow(new BadRequestException('Item codes not found: 99999'));

    expect(mockInvoiceRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('deletes invoice items before deleting the invoice', async () => {
    const removeManager = {
      delete: jest.fn().mockResolvedValue(undefined),
    };

    type RemoveTransactionCallback = (
      manager: typeof removeManager,
    ) => Promise<unknown>;

    mockInvoiceRepository.manager.transaction.mockImplementation(
      (callback: RemoveTransactionCallback) => callback(removeManager),
    );

    await service.remove('I0003');

    expect(removeManager.delete).toHaveBeenNthCalledWith(1, InvoiceItem, {
      invoiceNumber: 'I0003',
    });
    expect(removeManager.delete).toHaveBeenNthCalledWith(2, Invoice, {
      invoiceNumber: 'I0003',
    });
  });
});
