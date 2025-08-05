import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('accounts')
export class AccountEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'external_id', unique: true })
  externalId!: string;

  @Column({ name: 'account_string', type: 'text' })
  accountString!: string;

  @Column({ name: 'account_origin' })
  accountOrigin!: string;

  // Class Info como JSON
  @Column({ name: 'class_type' })
  classType!: string;

  @Column({ name: 'class_color' })
  classColor!: string;

  // General Information como columnas separadas para mejor consultas
  @Column({ name: 'name' })
  name!: string;

  @Column({ name: 'age', nullable: true })
  age?: number;

  @Column({ name: 'phone', nullable: true })
  phone?: string;

  @Column({ name: 'email', nullable: true })
  email?: string;

  @Column({ name: 'account_tag', nullable: true })
  accountTag?: string;

  @Column({ name: 'image', nullable: true })
  image?: string;

  @Column({ name: 'location', nullable: true })
  location?: string;

  @Column({ name: 'is_verified', default: false })
  isVerified!: boolean;

  // Proxy info
  @Column({ name: 'proxy_https' })
  proxyHttps!: string;

  @Column({ name: 'status' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}