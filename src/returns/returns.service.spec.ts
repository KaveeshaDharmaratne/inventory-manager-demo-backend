import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReturnsService } from './returns.service';
import { Return } from './entities/return.entity';
import { ReturnItem } from './entities/return-item.entity';
import { DealerReturn } from './entities/dealer-return.entity';
import { DealerService } from '../dealers/dealer.service';
import { ItemService } from '../item/item.service';
import { Item } from '../item/entities/item.entity';
import { UnusableItem } from '../item/entities/unusable-item.entity';

const mockReturnRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
};

const mockDealerService = {
  findByIdOrName: jest.fn(),
};

const mockItemService = {
  ensureItemsExist: jest.fn(),
};

const createManager = () => ({
  create: jest.fn((_: unknown, payload: Record<string, unknown>) => payload),
  save: jest.fn().mockResolvedValue(undefined),
  findOne: jest.fn(),
  increment: jest.fn().mockResolvedValue(undefined),
});

const createQueryRunner = () => {
  const manager = createManager();

  return {
    manager,
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
};

describe('ReturnsService', () => {
  let service: ReturnsService;
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(async () => {
    dataSource = {
      createQueryRunner: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnsService,
        {
          provide: getRepositoryToken(Return),
          useValue: mockReturnRepository,
        },
        {
          provide: DealerService,
          useValue: mockDealerService,
        },
        {
          provide: ItemService,
          useValue: mockItemService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<ReturnsService>(ReturnsService);
  });

  it('rejects missing item codes before opening a return transaction', async () => {
    mockDealerService.findByIdOrName.mockResolvedValue({ id: 'dealer-1' });
    mockItemService.ensureItemsExist.mockRejectedValue(
      new BadRequestException('Item codes not found: 99999'),
    );

    await expect(
      service.create({
        date: '2026-03-10',
        type: 'Good',
        dealer: 'dealer-1',
        returnNoteNo: 'RET-1',
        items: [{ code: '99999', description: 'Missing', qty: 2 }],
      }),
    ).rejects.toThrow(new BadRequestException('Item codes not found: 99999'));

    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('creates returns for known items without synthesizing Item entities', async () => {
    const queryRunner = createQueryRunner();
    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    mockDealerService.findByIdOrName.mockResolvedValue({ id: 'dealer-1' });
    mockItemService.ensureItemsExist.mockResolvedValue(undefined);
    mockReturnRepository.findOne.mockResolvedValue({
      returnNoteNo: 'RET-2',
      items: [{ itemCode: '12345', quantity: 2 }],
    });

    queryRunner.manager.findOne.mockImplementation(async (entity, options) => {
      if (entity === Item) {
        return { code: options?.where?.code, quantity: 10 };
      }

      if (entity === UnusableItem) {
        return null;
      }

      return null;
    });

    const result = await service.create({
      date: '2026-03-10',
      type: 'Good',
      dealer: 'dealer-1',
      returnNoteNo: 'RET-2',
      items: [{ code: '12345', description: 'Item A', qty: 2 }],
    });

    expect(mockItemService.ensureItemsExist).toHaveBeenCalledWith(['12345']);
    expect(queryRunner.startTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.manager.create).not.toHaveBeenCalledWith(
      Item,
      expect.anything(),
    );
    expect(queryRunner.manager.increment).toHaveBeenCalledWith(
      Item,
      { code: '12345' },
      'quantity',
      2,
    );
    expect(result).toEqual({
      returnNoteNo: 'RET-2',
      items: [{ itemCode: '12345', quantity: 2 }],
    });
  });
});
