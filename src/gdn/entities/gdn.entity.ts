import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { GdnItem } from './gdn-item.entity';

@Entity('gdn')
export class Gdn {
  @PrimaryColumn({ name: 'gdn_number', type: 'varchar' })
  gdnNumber: string;

  @Column({ type: 'date', nullable: true })
  date: string;

  @OneToMany(() => GdnItem, (item) => item.gdn)
  items: GdnItem[];
}
