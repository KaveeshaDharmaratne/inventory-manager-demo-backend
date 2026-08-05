import { Test, TestingModule } from '@nestjs/testing';
import { DealerService } from './dealer.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Dealer } from './entities/dealer.entity';

const mockDealerRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  })),
};

describe('DealerService', () => {
  let service: DealerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealerService,
        {
          provide: getRepositoryToken(Dealer),
          useValue: mockDealerRepository,
        },
      ],
    }).compile();

    service = module.get<DealerService>(DealerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
