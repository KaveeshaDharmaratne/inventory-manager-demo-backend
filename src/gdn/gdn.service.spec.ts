import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GdnService } from './gdn.service';
import { Gdn } from './entities/gdn.entity';
import { GdnItem } from './entities/gdn-item.entity';
import { Item } from '../item/entities/item.entity';
import { ItemService } from '../item/item.service';

const mockGdnRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  manager: {
    transaction: jest.fn(),
  },
};

const mockGdnItemRepository = {
  find: jest.fn(),
};

const mockItemService = {
  ensureItemsExist: jest.fn(),
};

const createTransactionManager = () => ({
  insert: jest.fn().mockResolvedValue(undefined),
  increment: jest.fn().mockResolvedValue(undefined),
});

type TransactionManagerMock = ReturnType<typeof createTransactionManager>;
type TransactionCallback = (
  manager: TransactionManagerMock,
) => Promise<unknown>;

describe('GdnService', () => {
  let service: GdnService;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdnService,
        {
          provide: getRepositoryToken(Gdn),
          useValue: mockGdnRepository,
        },
        {
          provide: getRepositoryToken(GdnItem),
          useValue: mockGdnItemRepository,
        },
        {
          provide: ItemService,
          useValue: mockItemService,
        },
      ],
    }).compile();

    service = module.get<GdnService>(GdnService);
  });

  it('rejects missing item codes before opening a transaction', async () => {
    mockGdnRepository.findOne.mockResolvedValue(null);
    mockItemService.ensureItemsExist.mockRejectedValue(
      new BadRequestException('Item codes not found: 99999'),
    );

    await expect(
      service.create({
        gdnNumber: 'GDN-1',
        date: '2026-03-10',
        items: [{ code: '99999', description: 'Missing', quantity: 1 }],
      }),
    ).rejects.toThrow(new BadRequestException('Item codes not found: 99999'));

    expect(mockGdnRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('creates a GDN for existing items only', async () => {
    mockGdnRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        gdnNumber: 'GDN-2',
        date: '2026-03-10',
      });
    mockGdnItemRepository.find.mockResolvedValue([
      { gdnNumber: 'GDN-2', itemCode: '12345', quantity: 5 },
      { gdnNumber: 'GDN-2', itemCode: '54321', quantity: 1 },
    ]);
    mockItemService.ensureItemsExist.mockResolvedValue(undefined);

    const transactionManager = createTransactionManager();
    mockGdnRepository.manager.transaction.mockImplementation(
      (callback: TransactionCallback) => callback(transactionManager),
    );

    const result = await service.create({
      gdnNumber: 'GDN-2',
      date: '2026-03-10',
      items: [
        { code: '12345', description: 'Item A', quantity: 2 },
        { code: '12345', description: 'Item A', quantity: 3 },
        { code: '54321', description: 'Item B', quantity: 1 },
      ],
    });

    expect(mockItemService.ensureItemsExist).toHaveBeenCalledWith([
      '12345',
      '54321',
    ]);
    expect(transactionManager.insert).toHaveBeenNthCalledWith(1, Gdn, {
      gdnNumber: 'GDN-2',
      date: '2026-03-10',
    });
    expect(transactionManager.insert).toHaveBeenNthCalledWith(2, GdnItem, [
      { gdnNumber: 'GDN-2', itemCode: '12345', quantity: 5 },
      { gdnNumber: 'GDN-2', itemCode: '54321', quantity: 1 },
    ]);
    expect(transactionManager.increment).toHaveBeenNthCalledWith(
      1,
      Item,
      { code: '12345' },
      'quantity',
      5,
    );
    expect(transactionManager.increment).toHaveBeenNthCalledWith(
      2,
      Item,
      { code: '54321' },
      'quantity',
      1,
    );
    expect(result).toMatchObject({
      gdnNumber: 'GDN-2',
      items: [
        { gdnNumber: 'GDN-2', itemCode: '12345', quantity: 5 },
        { gdnNumber: 'GDN-2', itemCode: '54321', quantity: 1 },
      ],
    });
  });
});
