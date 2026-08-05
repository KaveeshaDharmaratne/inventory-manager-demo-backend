import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDealerDto } from './dto/create-dealer.dto';
import { UpdateDealerDto } from './dto/update-dealer.dto';
import { Dealer } from './entities/dealer.entity';

@Injectable()
export class DealerService {
  constructor(
    @InjectRepository(Dealer)
    private readonly dealerRepository: Repository<Dealer>,
  ) {}

  async create(createDealerDto: CreateDealerDto): Promise<Dealer> {
    const dealer = this.dealerRepository.create(createDealerDto);
    const saved = await this.dealerRepository.save(dealer);
    return saved as unknown as Dealer;
  }

  async findAll(opts?: {
    search?: string;
    offset?: number;
    limit?: number;
  }): Promise<{ data: Dealer[]; total: number }> {
    const { search, offset = 0, limit = 25 } = opts ?? {};

    const qb = this.dealerRepository.createQueryBuilder('dealer');
    if (search) {
      qb.where('dealer.name ILIKE :search', { search: `%${search}%` });
    }
    qb.orderBy('dealer.name', 'ASC').skip(offset).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string): Promise<Dealer> {
    const dealer = await this.dealerRepository.findOne({ where: { id } });
    if (!dealer) throw new NotFoundException('Dealer not found');
    return dealer;
  }

  async findByIdOrName(ref: string): Promise<Dealer | null> {
    const byId = await this.dealerRepository.findOne({ where: { id: ref } });
    if (byId) return byId;
    return this.dealerRepository.findOne({ where: { name: ref } });
  }

  async update(id: string, updateDealerDto: UpdateDealerDto): Promise<Dealer> {
    await this.dealerRepository.update(id, updateDealerDto);
    return this.findOne(id);
  }

  async remove(id: string) {
    return this.dealerRepository.delete(id);
  }
}
