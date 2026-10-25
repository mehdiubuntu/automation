export interface IMapperStatic<TDomain, TOrm> {
  toDomain(orm: TOrm): TDomain
  toOrm(domain: TDomain): TOrm
  toOrmField?(field: string, value: unknown): unknown
}
