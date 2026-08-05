import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Dealer } from '../../dealers/entities/dealer.entity';
import { Return } from './return.entity';

@Entity('dealer_return')
export class DealerReturn {
  @PrimaryColumn({ name: 'dealer_id', type: 'varchar' })
  dealerId: string;

  @PrimaryColumn({ name: 'return_id', type: 'varchar' })
  returnId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'modified_at', type: 'timestamp' })
  modifiedAt: Date;

  @ManyToOne(() => Dealer, (dealer) => dealer.dealerReturns)
  @JoinColumn({ name: 'dealer_id' })
  dealer: Dealer;

  @ManyToOne(() => Return, (ret) => ret.dealerReturns)
  @JoinColumn({ name: 'return_id' })
  return: Return;
}
