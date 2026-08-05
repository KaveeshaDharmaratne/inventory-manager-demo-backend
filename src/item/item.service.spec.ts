import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ItemService } from './item.service';
import { Item } from './entities/item.entity';

const mockItemRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockDataSource = {
  query: jest.fn(),
};

describe('ItemService', () => {
  let service: ItemService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemService,
        {
          provide: getRepositoryToken(Item),
          useValue: mockItemRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ItemService>(ItemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('groups ledger rows per item and applies balance rules', async () => {
    mockDataSource.query
      .mockResolvedValueOnce([
        {
          itemCode: '10001',
          itemDescription: 'DRAINAGE BEND 40 X 88 EYE',
          date: '2026-02-06',
          transactionType: 'INV',
          transactionNo: 'INV-001',
          dealer: 'RD BUILDERS',
          inQty: null,
          outQty: 2,
          effectQty: -2,
        },
        {
          itemCode: '10001',
          itemDescription: 'DRAINAGE BEND 40 X 88 EYE',
          date: '2026-02-17',
          transactionType: 'RET',
          transactionNo: 'RET-001',
          dealer: 'RD BUILDERS',
          inQty: 3,
          outQty: null,
          effectQty: 3,
        },
        {
          itemCode: '10001',
          itemDescription: 'DRAINAGE BEND 40 X 88 EYE',
          date: '2026-02-18',
          transactionType: 'BAD',
          transactionNo: 'RET-002',
          dealer: 'RD BUILDERS',
          inQty: null,
          outQty: null,
          effectQty: 0,
        },
        {
          itemCode: '10002',
          itemDescription: 'NETZ 16 1.25 TWO TONE GNBK SQ 15M',
          date: '2026-03-01',
          transactionType: 'GDN',
          transactionNo: 'GDN-001',
          dealer: '',
          inQty: 5,
          outQty: null,
          effectQty: 5,
        },
      ])
      .mockResolvedValueOnce([
        { itemCode: '10001', openingStock: 10 },
        { itemCode: '10002', openingStock: 1 },
      ]);

    const result = await service.getLedgerByDateRange('2026-02-01', '2026-04-01');

    expect(result.products).toHaveLength(2);

    expect(result.products[0]).toEqual({
      item: { code: '10001', description: 'DRAINAGE BEND 40 X 88 EYE' },
      openingStock: 10,
      totalIn: 3,
      totalOut: 2,
      closingBalance: 11,
      entries: [
        {
          date: '2026-02-06',
          transactionType: 'INV',
          transactionNo: 'INV-001',
          dealer: 'RD BUILDERS',
          inQty: null,
          outQty: 2,
          balance: 8,
        },
        {
          date: '2026-02-17',
          transactionType: 'RET',
          transactionNo: 'RET-001',
          dealer: 'RD BUILDERS',
          inQty: 3,
          outQty: null,
          balance: 11,
        },
        {
          date: '2026-02-18',
          transactionType: 'BAD',
          transactionNo: 'RET-002',
          dealer: 'RD BUILDERS',
          inQty: null,
          outQty: null,
          balance: 11,
        },
      ],
    });

    expect(result.products[1]).toEqual({
      item: { code: '10002', description: 'NETZ 16 1.25 TWO TONE GNBK SQ 15M' },
      openingStock: 1,
      totalIn: 5,
      totalOut: 0,
      closingBalance: 6,
      entries: [
        {
          date: '2026-03-01',
          transactionType: 'GDN',
          transactionNo: 'GDN-001',
          dealer: '',
          inQty: 5,
          outQty: null,
          balance: 6,
        },
      ],
    });
  });
});
