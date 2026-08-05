import { Test, TestingModule } from '@nestjs/testing';
import { DealerController } from './dealer.controller';
import { DealerService } from './dealer.service';

const mockDealerService: Partial<Record<keyof DealerService, jest.Mock>> = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('DealerController', () => {
  let controller: DealerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DealerController],
      providers: [
        DealerService,
        {
          provide: DealerService,
          useValue: mockDealerService,
        },
      ],
    }).compile();

    controller = module.get<DealerController>(DealerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
