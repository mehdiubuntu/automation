export class BaseEntity {
  constructor(
    public readonly id?: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public readonly deletedAt?: Date
  ) {}
}
