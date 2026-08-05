import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Dealer } from '../../dealers/entities/dealer.entity';
import { ReturnItem } from './return-item.entity';
import { DealerReturn } from './dealer-return.entity';

@Entity('return')
export class Return {
  @PrimaryColumn({ name: 'return_note_no', type: 'varchar' })
  returnNoteNo: string;

  @Column({ type: 'date', nullable: true })
  date: string;

  @Column({ type: 'varchar', nullable: true })
  type: string;

  @Column({ name: 'dealer_id', type: 'varchar', nullable: true })
  dealerId: string;

  @ManyToOne(() => Dealer, (dealer: Dealer) => dealer.returns)
  @JoinColumn({ name: 'dealer_id' })
  dealer: Dealer;

  @OneToMany(() => ReturnItem, (returnItem) => returnItem.return)
  items: ReturnItem[];

  @OneToMany(() => DealerReturn, (dealerReturn) => dealerReturn.return)
  dealerReturns: DealerReturn[];
}
